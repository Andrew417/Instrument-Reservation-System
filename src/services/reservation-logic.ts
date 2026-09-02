import { db, pool } from "../db/index.js";
import { sendSuperAdminNotificationEmail } from "../lib/mailer.js";
import {
  users,
  admins,
  instruments,
  reservations,
  reservationSeries,
  notificationSettings,
  notifications,
  hardLimits,
} from "../db/schema.js";
import { eq, and, sql, inArray, gte, lte, desc } from "drizzle-orm";
import {
  cairoDateTimeToDate,
  getCairoDateString,
  getCairoParts,
  getCairoTimeString,
} from "../lib/date-utils.js";

export interface TimeSlot {
  date: string; // 'YYYY-MM-DD'
  startTime: string; // 'HH:mm' (e.g. '09:00', '14:30')
  duration: number; // Duration in hours (e.g. 1, 2, 1.5)
}

export interface ReservationSubmissionInput {
  userId?: string;
  adminId?: string;
  instrumentId: string;
  serviceName: string; // Required free-text (e.g. 'Sunday Morning Service', 'Youth Choir Practice')
  date: string; // 'YYYY-MM-DD'
  startTime: string; // 'HH:mm'
  duration: number; // in hours
  reservationType: "in_church" | "outside_church";
  feeAcknowledged?: boolean;
}

export interface SeriesSubmissionInput {
  userId?: string;
  adminId?: string;
  instrumentId: string;
  serviceName: string; // Applies to the whole series
  patternType: "weekly" | "custom";
  occurrences: TimeSlot[];
  reservationType: "in_church" | "outside_church";
  feeAcknowledged?: boolean;
}

export interface EvaluationResult {
  status: "approved" | "pending";
  reasons: string[];
  isTrustedOrAdmin: boolean;
  outsideFeeSnapshot: string | null;
  startTimeUtc: Date;
  endTimeUtc: Date;
  timeRangeSqlString: string;
}

/**
 * Parses date ('YYYY-MM-DD') and time ('HH:mm') into Cairo-time Date objects,
 * and formats the PostgreSQL tstzrange string.
 */
export function buildTimeRange(
  date: string,
  startTime: string,
  duration: number,
) {
  // Validate format
  const dateMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date.trim());
  const timeMatch = /^(\d{1,2}):(\d{2})$/.exec(startTime.trim());

  if (!dateMatch || !timeMatch) {
    throw new Error(
      "Invalid date or time format. Expected YYYY-MM-DD and HH:mm.",
    );
  }

  const [_, year, month, day] = dateMatch.map(Number);
  const [__, hours, minutes] = timeMatch.map(Number);

  if (duration <= 0) {
    throw new Error("Duration must be greater than 0.");
  }

  const start = cairoDateTimeToDate(date, startTime);
  const end = new Date(start.getTime() + Math.round(duration * 3600 * 1000));

  const startIso = start.toISOString();
  const endIso = end.toISOString();
  const timeRangeSqlString = `[${startIso},${endIso})`;

  return { start, end, timeRangeSqlString };
}

/**
 * 1. Working Hours Check:
 * Must be strictly within 09:00:00 - 22:00:00 Cairo time on the same calendar day.
 */
export function validateWorkingHours(start: Date, end: Date) {
  const startCairo = getCairoParts(start);
  const endCairo = getCairoParts(end);
  const startHour = startCairo.hour + startCairo.minute / 60;
  const endHour = endCairo.hour + endCairo.minute / 60;

  const startDay = `${startCairo.year}-${startCairo.month}-${startCairo.day}`;
  const endDay = `${endCairo.year}-${endCairo.month}-${endCairo.day}`;

  if (startDay !== endDay) {
    throw new Error("Reservation cannot span multiple calendar days.");
  }

  const now = new Date();
  if (start <= now || end <= now) {
    throw new Error("Reservation time must be in the future.");
  }

  if (startHour < 9 || endHour > 22 || startHour >= endHour) {
    throw new Error(
      `Reservation time (${String(startCairo.hour).padStart(2, "0")}:${String(startCairo.minute).padStart(2, "0")} - ${String(endCairo.hour).padStart(2, "0")}:${String(endCairo.minute).padStart(2, "0")}) falls outside working hours (09:00 - 22:00 Cairo time).`,
    );
  }

  return true;
}

/**
 * Fetches default or current hard limits from DB (ordered by latest update)
 */
export async function getNotificationSettings() {
  const rows = await db.select().from(notificationSettings).limit(1);
  if (rows.length > 0) return rows[0];
  const [inserted] = await db
    .insert(notificationSettings)
    .values({})
    .returning();
  return inserted;
}

export async function getHardLimits() {
  const limits = await db
    .select()
    .from(hardLimits)
    .orderBy(desc(hardLimits.updatedAt))
    .limit(1);

  if (limits.length > 0) {
    const row = limits[0];
    return {
      ...row,
      maxActiveReservations: row.maxActiveReservations,
      maxReservationsPerDay: row.maxReservationsPerDay,
      maxDurationHours: row.maxDurationHours,
      maxConcurrentPerType: row.maxConcurrentPerType,
      maxSeriesOccurrences: row.maxSeriesOccurrences,
      maxSubmissionsPerHour: row.maxSubmissionsPerHour,
      bypassHardLimits: Boolean(row.bypassHardLimits),
      max_active_reservations: row.maxActiveReservations,
      max_reservations_per_day: row.maxReservationsPerDay,
      max_duration_hours: row.maxDurationHours,
      max_concurrent_per_type: row.maxConcurrentPerType,
      max_series_occurrences: row.maxSeriesOccurrences,
      max_submissions_per_hour: row.maxSubmissionsPerHour,
      bypass_hard_limits: Boolean(row.bypassHardLimits),
    };
  }

  return {
    maxActiveReservations: 5,
    maxReservationsPerDay: 5,
    maxDurationHours: 5,
    maxConcurrentPerType: 2,
    maxSeriesOccurrences: 8,
    maxSubmissionsPerHour: 10,
    bypassHardLimits: false,
    max_active_reservations: 5,
    max_reservations_per_day: 5,
    max_duration_hours: 5,
    max_concurrent_per_type: 2,
    max_series_occurrences: 8,
    max_submissions_per_hour: 10,
    bypass_hard_limits: false,
  };
}

/**
 * Safe helper to coerce nullable inputs (such as UUIDs, snapshots, reasons) to null instead of empty strings
 */
export function toNullableString(val: any): string | null {
  if (val === undefined || val === null) return null;
  const str = String(val).trim();
  return str === "" ? null : str;
}

/**
 * Robust identity resolver that correctly separates user IDs (users table) and admin IDs (admins table).
 * If a frontend or API passes an admin's account ID in the userId field, this safely routes it to adminId.
 */
export async function resolveUserAndAdminIds(
  rawUserId?: string | null,
  rawAdminId?: string | null,
): Promise<{
  resolvedUserId: string | null;
  resolvedAdminId: string | null;
  isTrusted: boolean;
  isAdmin: boolean;
}> {
  let userId = toNullableString(rawUserId);
  let adminId = toNullableString(rawAdminId);
  let isTrusted = false;
  let isAdmin = false;

  // 1. If adminId provided, verify it against admins or fallback to users
  if (adminId) {
    try {
      const adminRows = await db
        .select({ id: admins.id })
        .from(admins)
        .where(eq(admins.id, adminId))
        .limit(1);

      if (adminRows.length > 0) {
        isAdmin = true;
      } else {
        const userRows = await db
          .select({ id: users.id, isTrusted: users.isTrusted })
          .from(users)
          .where(eq(users.id, adminId))
          .limit(1);

        if (userRows.length > 0) {
          userId = adminId;
          adminId = null;
          isTrusted = Boolean(userRows[0].isTrusted);
        } else {
          adminId = null;
        }
      }
    } catch {
      adminId = null;
    }
  }

  // 2. If userId provided, check if it's actually in users table or in admins table
  if (userId) {
    try {
      const userRows = await db
        .select({ id: users.id, isTrusted: users.isTrusted })
        .from(users)
        .where(eq(users.id, userId))
        .limit(1);

      if (userRows.length > 0) {
        isTrusted = Boolean(userRows[0].isTrusted);
      } else {
        const adminRows = await db
          .select({ id: admins.id })
          .from(admins)
          .where(eq(admins.id, userId))
          .limit(1);

        if (adminRows.length > 0) {
          adminId = userId;
          userId = null;
          isAdmin = true;
        } else {
          userId = null;
        }
      }
    } catch {
      userId = null;
    }
  }

  return {
    resolvedUserId: userId,
    resolvedAdminId: adminId,
    isTrusted,
    isAdmin,
  };
}

/**
 * =========================================================================
 * 1. SINGLE RESERVATION SUBMISSION EVALUATION LOGIC (Exact Sequence)
 * =========================================================================
 */
export async function evaluateReservationSubmission(
  input: ReservationSubmissionInput,
  options?: { skipRateLimitCheck?: boolean; preloadedLimits?: any },
): Promise<EvaluationResult> {
  const {
    userId,
    adminId,
    instrumentId,
    date,
    startTime,
    duration,
    reservationType,
    feeAcknowledged,
  } = input;

  const { resolvedUserId, resolvedAdminId, isTrusted, isAdmin } =
    await resolveUserAndAdminIds(userId, adminId);
  const cleanUserId = resolvedUserId;
  const cleanAdminId = resolvedAdminId;

  // 1. Working hours check
  const { start, end, timeRangeSqlString } = buildTimeRange(
    date,
    startTime,
    duration,
  );
  validateWorkingHours(start, end);

  // Fetch instrument
  const instrumentRes = await db
    .select()
    .from(instruments)
    .where(
      and(eq(instruments.id, instrumentId), eq(instruments.isRemoved, false)),
    )
    .limit(1);

  if (instrumentRes.length === 0) {
    throw new Error("Instrument not found or has been removed.");
  }
  const instrument = instrumentRes[0];

  const limits = options?.preloadedLimits || (await getHardLimits());

  // 2. Submission rate limit (skip if series-level check already evaluated it or bypass enabled)
  if (!options?.skipRateLimitCheck && cleanUserId && !limits.bypassHardLimits) {
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    const recentSubmissions = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(reservations)
      .where(
        and(
          eq(reservations.userId, cleanUserId),
          gte(reservations.createdAt, oneHourAgo),
        ),
      );

    const submissionCount = Number(recentSubmissions[0]?.count || 0);
    if (submissionCount >= limits.maxSubmissionsPerHour) {
      throw new Error(
        `Submission rate limit exceeded (maximum ${limits.maxSubmissionsPerHour} submissions per hour). Please try again later.`,
      );
    }
  }

  // 3. Conflict check: does this time range overlap an existing APPROVED reservation for this instrument?
  // Applies to EVERY user type, no exceptions (including Trusted and Admin).
  const conflicts = await db
    .select({ id: reservations.id, timeRange: reservations.timeRange })
    .from(reservations)
    .where(
      sql`${reservations.instrumentId} = ${instrumentId}
        AND ${reservations.status} = 'approved'
        AND ${reservations.timeRange} && tstzrange(${start.toISOString()}, ${end.toISOString()}, '[)')`,
    )
    .limit(1);

  if (conflicts.length > 0) {
    throw new Error(
      "This time slot conflicts with an existing approved reservation on this instrument.",
    );
  }

  // 4. Trusted or Admin check
  const isTrustedOrAdmin = isTrusted || isAdmin;

  // 5. Outside church fee requirement check
  let outsideFeeSnapshot: string | null = null;
  if (reservationType === "outside_church") {
    if (!feeAcknowledged) {
      throw new Error(
        `Outside church reservation requires fee acknowledgment (fee: ${instrument.outsideFeePerDay} EGP/day).`,
      );
    }
    outsideFeeSnapshot = instrument.outsideFeePerDay
      ? String(instrument.outsideFeePerDay)
      : "0.00";
  }

  let calculatedStatus: "approved" | "pending" = "pending";
  const reasons: string[] = [];

  if (reservationType === "outside_church") {
    // Outside-church ALWAYS sets status to Pending on submission (manual review), never Instant — regardless of instrument mode
    calculatedStatus = "pending";
    reasons.push(
      "Outside-church reservation requires administrator review and payment arrangement.",
    );
  } else if (isTrustedOrAdmin) {
    // Auto-approve immediately for Trusted Users and Admins (in-church reservations)
    calculatedStatus = "approved";
    reasons.push("Auto-approved via Trusted User / Admin privilege");
  } else {
    // Regular user, in_church reservation:
    let limitExceeded = false;

    if (!limits.bypassHardLimits) {
      // Check 5a: max_active_reservations (Pending + Approved, series counts as 1)
      if (cleanUserId) {
        const activeRes = await db
          .select({
            activeCount: sql<number>`COUNT(DISTINCT COALESCE(${reservations.seriesId}, ${reservations.id}))::int`,
          })
          .from(reservations)
          .where(
            and(
              eq(reservations.userId, cleanUserId),
              inArray(reservations.status, ["pending", "approved"]),
            ),
          );

        const activeCount = Number(activeRes[0]?.activeCount || 0);
        if (activeCount >= limits.maxActiveReservations) {
          limitExceeded = true;
          reasons.push(
            `Active reservations limit reached (${activeCount}/${limits.maxActiveReservations} active slots). Forced to Pending.`,
          );
        }
      }

      // Check 5b: max_reservations_per_day
      if (cleanUserId) {
        const dateStr = getCairoDateString(start);
        const dayRes = await db
          .select({ count: sql<number>`count(*)::int` })
          .from(reservations)
          .where(
            sql`${reservations.userId} = ${cleanUserId}
              AND ${reservations.status} IN ('pending', 'approved', 'ongoing', 'completed')
              AND (lower(${reservations.timeRange}) AT TIME ZONE 'Africa/Cairo')::date = ${dateStr}::date`,
          );

        const dayCount = Number(dayRes[0]?.count || 0);
        if (dayCount >= limits.maxReservationsPerDay) {
          limitExceeded = true;
          reasons.push(
            `Daily reservation limit reached for ${dateStr} (${dayCount}/${limits.maxReservationsPerDay}). Forced to Pending.`,
          );
        }
      }

      // Check 5c: max_duration_hours
      if (duration > limits.maxDurationHours) {
        limitExceeded = true;
        reasons.push(
          `Duration (${duration}h) exceeds maximum allowed duration (${limits.maxDurationHours}h). Forced to Pending.`,
        );
      }

      // Check 5d: max_concurrent_per_type (counts each individual occurrence)
      if (cleanUserId) {
        const concurrentRes = await db
          .select({ count: sql<number>`count(*)::int` })
          .from(reservations)
          .innerJoin(instruments, eq(reservations.instrumentId, instruments.id))
          .where(
            and(
              eq(reservations.userId, cleanUserId),
              inArray(reservations.status, ["pending", "approved"]),
              eq(instruments.type, instrument.type),
            ),
          );

        const concurrentCount = Number(concurrentRes[0]?.count || 0);
        if (concurrentCount >= limits.maxConcurrentPerType) {
          limitExceeded = true;
          reasons.push(
            `Concurrent active reservations limit for instrument type '${instrument.type}' reached (${concurrentCount}/${limits.maxConcurrentPerType}). Forced to Pending.`,
          );
        }
      }
    }

    // Instrument mode check + limit decision
    if (instrument.bookingMode === "instant" && !limitExceeded) {
      calculatedStatus = "approved";
      reasons.push("Auto-approved via Instant Booking mode");
    } else {
      calculatedStatus = "pending";
      if (instrument.bookingMode === "manual") {
        reasons.push("Instrument is set to Manual Approval mode");
      }
    }
  }

  return {
    status: calculatedStatus,
    reasons,
    isTrustedOrAdmin,
    outsideFeeSnapshot,
    startTimeUtc: start,
    endTimeUtc: end,
    timeRangeSqlString,
  };
}

/**
 * 7. Helper: Auto-reject overlapping pending reservations when a reservation is approved
 */
export async function autoRejectOverlappingPending(
  instrumentId: string,
  start: Date,
  end: Date,
  approvedReservationId?: string,
) {
  const query = sql`
    UPDATE reservations
    SET status = 'auto_rejected',
        rejection_reason = 'Another reservation was approved for this time slot'
    WHERE instrument_id = ${instrumentId}
      AND status = 'pending'
      ${approvedReservationId ? sql`AND id != ${approvedReservationId}` : sql``}
      AND time_range && tstzrange(${start.toISOString()}, ${end.toISOString()}, '[)')
    RETURNING id, user_id, time_range;
  `;

  const result = await db.execute(query);
  const autoRejectedRows = (result as any).rows || [];

  // Notify affected users
  for (const row of autoRejectedRows) {
    if (row.user_id) {
      await db.insert(notifications).values({
        userId: row.user_id,
        reservationId: row.id,
        type: "reservation_auto_rejected",
        message:
          "Your pending reservation was auto-rejected due to a conflict with an approved reservation for this time slot.",
      });
    }
  }

  return autoRejectedRows;
}

/**
 * Creates a single reservation end-to-end
 */

export async function createReservation(input: ReservationSubmissionInput) {
  const { resolvedUserId, resolvedAdminId } = await resolveUserAndAdminIds(
    input.userId,
    input.adminId,
  );

  const evalResult = await evaluateReservationSubmission({
    ...input,
    userId: resolvedUserId || undefined,
    adminId: resolvedAdminId || undefined,
  });

  const cleanUserId = resolvedUserId;
  const cleanAdminId = resolvedAdminId;
  const cleanFeeSnapshot = toNullableString(evalResult.outsideFeeSnapshot);
  const cleanServiceName = (input.serviceName || "").trim() || "Not specified";

  // Runtime validation assertion
  if (!input.instrumentId) {
    throw new Error("Instrument ID is required.");
  }

  const reservationParams = {
    seriesId: null,
    userId: cleanUserId,
    adminId: cleanAdminId,
    instrumentId: input.instrumentId,
    serviceName: cleanServiceName,
    timeRange:
      sql`tstzrange(${evalResult.startTimeUtc.toISOString()}, ${evalResult.endTimeUtc.toISOString()}, '[)')` as any,
    reservationType: input.reservationType,
    feeSnapshot: cleanFeeSnapshot,
    status: evalResult.status,
    rejectionReason: null,
    paymentScreenshotUrl: null,
  };

  const [newReservation] = await db
    .insert(reservations)
    .values(reservationParams)
    .returning();

  // If approved: auto-reject other overlapping pending reservations
  if (evalResult.status === "approved") {
    await autoRejectOverlappingPending(
      input.instrumentId,
      evalResult.startTimeUtc,
      evalResult.endTimeUtc,
      newReservation.id,
    );

    // 8. Notification for approved user
    if (cleanUserId) {
      await db.insert(notifications).values({
        userId: cleanUserId,
        reservationId: newReservation.id,
        type: "reservation_approved",
        message: `Your reservation on ${input.date} (${input.startTime} - ${getCairoTimeString(evalResult.endTimeUtc)}) has been approved.`,
      });
    }
  } else if (cleanUserId) {
    // Notification for pending submission
    const pendingMsg =
      input.reservationType === "outside_church"
        ? "Your outside-church reservation request has been submitted. If approved, an administrator will contact you on WhatsApp to confirm details and arrange payment."
        : `Your reservation request on ${input.date} (${input.startTime}) has been submitted and is pending administrator review.`;

    await db.insert(notifications).values({
      userId: cleanUserId,
      reservationId: newReservation.id,
      type: "reservation_submitted",
      message: pendingMsg,
    });

    const [requester] = await db
      .select({ name: users.name, phoneNumber: users.phoneNumber })
      .from(users)
      .where(eq(users.id, cleanUserId))
      .limit(1);

    const [instrumentRow] = await db
      .select({ name: instruments.name })
      .from(instruments)
      .where(eq(instruments.id, input.instrumentId))
      .limit(1);

    const formattedStartTime = input.startTime;
    const formattedEndTime = getCairoTimeString(evalResult.endTimeUtc);

    const notifSettings = await getNotificationSettings(); // new helper, same pattern as getHardLimits
    if (!notifSettings.muteReservationRequestEmails) {
      await sendSuperAdminNotificationEmail(
        "New Reservation Pending Approval - St. Mark Musicians",
        "New Reservation Request",
        "A reservation request is awaiting your approval.",
        [
          { label: "Requested by:", value: requester?.name || "Unknown" },
          { label: "Phone:", value: requester?.phoneNumber || "N/A" },
          { label: "Instrument:", value: instrumentRow?.name || "Unknown" },
          { label: "Service:", value: input.serviceName },
          { label: "Date:", value: input.date },
          { label: "Start Time", value: formattedStartTime },
          { label: "End Time", value: formattedEndTime },
          {
            label: "Duration:",
            value: `${input.duration} hour${input.duration === 1 ? "" : "s"}`,
          },
          {
            label: "Type:",
            value:
              input.reservationType === "outside_church"
                ? "Outside Church"
                : "In-Church",
          },
        ],
      ).catch(() => {});
    }
    const allAdmins = await db.select({ id: admins.id }).from(admins);
    for (const adm of allAdmins) {
      await db
        .insert(notifications)
        .values({
          adminId: adm.id,
          reservationId: newReservation.id,
          type: "reservation_submitted",
          message: `New reservation request from ${requester?.name || "a member"} for ${instrumentRow?.name || "an instrument"} on ${input.date}.`,
        })
        .catch(() => {});
    }
  }

  return {
    reservation: newReservation,
    evaluation: evalResult,
  };
}

/**
 * =========================================================================
 * 2. RECURRING SERIES SUBMISSION LOGIC
 * =========================================================================
 */

export async function createReservationSeries(input: SeriesSubmissionInput) {
  const {
    userId,
    adminId,
    instrumentId,
    patternType,
    occurrences,
    reservationType,
    feeAcknowledged,
  } = input;

  if (!occurrences || occurrences.length === 0) {
    throw new Error("Series must have at least one occurrence.");
  }

  const { resolvedUserId, resolvedAdminId } = await resolveUserAndAdminIds(
    userId,
    adminId,
  );
  const cleanUserId = resolvedUserId;
  const cleanAdminId = resolvedAdminId;

  const limits = await getHardLimits();

  // 1. Occurrence count check: reject if > max_series_occurrences (unless bypass enabled)
  if (
    !limits.bypassHardLimits &&
    occurrences.length > limits.maxSeriesOccurrences
  ) {
    throw new Error(
      `Series exceeds maximum allowed occurrences of ${limits.maxSeriesOccurrences} (provided ${occurrences.length}).`,
    );
  }

  // 2. Working hours check for each occurrence
  const parsedOccurrences = occurrences.map((occ, idx) => {
    const { start, end, timeRangeSqlString } = buildTimeRange(
      occ.date,
      occ.startTime,
      occ.duration,
    );
    try {
      validateWorkingHours(start, end);
    } catch (err: any) {
      throw new Error(
        `Occurrence #${idx + 1} (${occ.date} ${occ.startTime}): ${err.message}`,
      );
    }
    return { ...occ, start, end, timeRangeSqlString, index: idx + 1 };
  });

  // 3. Self-overlap check within series
  for (let i = 0; i < parsedOccurrences.length; i++) {
    for (let j = i + 1; j < parsedOccurrences.length; j++) {
      const a = parsedOccurrences[i];
      const b = parsedOccurrences[j];

      // Overlap condition: startA < endB AND startB < endA
      if (a.start < b.end && b.start < a.end) {
        throw new Error(
          `Self-overlap detected within series: Occurrence #${a.index} (${a.date} ${a.startTime}) overlaps with Occurrence #${b.index} (${b.date} ${b.startTime}).`,
        );
      }
    }
  }

  // 4. Conflict check against existing approved reservations
  const conflictingOccurrences: any[] = [];
  for (const occ of parsedOccurrences) {
    const conflicts = await db
      .select({ id: reservations.id, timeRange: reservations.timeRange })
      .from(reservations)
      .where(
        sql`${reservations.instrumentId} = ${instrumentId}
          AND ${reservations.status} = 'approved'
          AND ${reservations.timeRange} && tstzrange(${occ.start.toISOString()}, ${occ.end.toISOString()}, '[)')`,
      );

    if (conflicts.length > 0) {
      conflictingOccurrences.push({
        occurrenceIndex: occ.index,
        date: occ.date,
        startTime: occ.startTime,
        duration: occ.duration,
        conflictingReservationId: conflicts[0].id,
      });
    }
  }

  if (conflictingOccurrences.length > 0) {
    const conflictDescriptions = conflictingOccurrences.map(
      (c) => `Occurrence #${c.occurrenceIndex} on ${c.date} at ${c.startTime}`,
    );
    const error: any = new Error(
      `Series has ${conflictingOccurrences.length} occurrence(s) conflicting with existing approved reservations: ${conflictDescriptions.join(", ")}.`,
    );
    error.conflicts = conflictingOccurrences;
    throw error;
  }

  // 5. Rate limit check for the series submission
  if (cleanUserId && !limits.bypassHardLimits) {
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    const recentSubmissions = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(reservations)
      .where(
        and(
          eq(reservations.userId, cleanUserId),
          gte(reservations.createdAt, oneHourAgo),
        ),
      );

    const submissionCount = Number(recentSubmissions[0]?.count || 0);
    if (submissionCount >= limits.maxSubmissionsPerHour) {
      throw new Error(
        `Submission rate limit exceeded (maximum ${limits.maxSubmissionsPerHour} submissions per hour). Please try again later.`,
      );
    }
  }

  // 6. Create series row in database
  const [newSeries] = await db
    .insert(reservationSeries)
    .values({
      userId: cleanUserId,
      adminId: cleanAdminId,
      instrumentId,
      patternType,
    })
    .returning();

  // 7. Process each occurrence through single evaluation (steps 4-8)
  const createdOccurrences: any[] = [];

  for (const occ of parsedOccurrences) {
    const evalResult = await evaluateReservationSubmission(
      {
        userId: cleanUserId || undefined,
        adminId: cleanAdminId || undefined,
        instrumentId,
        serviceName: input.serviceName,
        date: occ.date,
        startTime: occ.startTime,
        duration: occ.duration,
        reservationType,
        feeAcknowledged,
      },
      { skipRateLimitCheck: true, preloadedLimits: limits },
    );

    const cleanFeeSnapshot = toNullableString(evalResult.outsideFeeSnapshot);

    const occurrenceParams = {
      seriesId: newSeries.id,
      userId: cleanUserId,
      adminId: cleanAdminId,
      instrumentId,
      serviceName: (input.serviceName || "").trim() || "Not specified",
      timeRange:
        sql`tstzrange(${evalResult.startTimeUtc.toISOString()}, ${evalResult.endTimeUtc.toISOString()}, '[)')` as any,
      reservationType,
      feeSnapshot: cleanFeeSnapshot,
      status: evalResult.status,
      rejectionReason: null,
      paymentScreenshotUrl: null,
    };

    const [resRow] = await db
      .insert(reservations)
      .values(occurrenceParams)
      .returning();

    if (evalResult.status === "approved") {
      await autoRejectOverlappingPending(
        instrumentId,
        evalResult.startTimeUtc,
        evalResult.endTimeUtc,
        resRow.id,
      );
    }

    createdOccurrences.push({
      reservation: resRow,
      evaluation: evalResult,
    });
  }

  // User notification for series creation
  if (cleanUserId) {
    const approvedCount = createdOccurrences.filter(
      (c) => c.reservation.status === "approved",
    ).length;
    await db.insert(notifications).values({
      userId: cleanUserId,
      type: "series_submitted",
      message: `Your recurring series (${createdOccurrences.length} occurrences) has been created (${approvedCount} approved, ${createdOccurrences.length - approvedCount} pending review).`,
    });
  }

  return {
    series: newSeries,
    occurrences: createdOccurrences,
  };
}

/**
 * =========================================================================
 * 3. EDITING A RESERVATION
 * =========================================================================
 */
export async function editReservation(
  reservationId: string,
  updates: {
    instrumentId?: string;
    serviceName?: string;
    date?: string;
    startTime?: string;
    duration?: number;
    reservationType?: "in_church" | "outside_church";
    feeAcknowledged?: boolean;
  },
  caller: { userId?: string; adminId?: string; isSuperAdmin?: boolean },
) {
  const existingRes = await db
    .select()
    .from(reservations)
    .where(eq(reservations.id, reservationId))
    .limit(1);

  if (existingRes.length === 0) {
    throw new Error("Reservation not found.");
  }

  const existing = existingRes[0];

  // Authorization check
  if (
    !caller.adminId &&
    (!caller.userId || existing.userId !== caller.userId)
  ) {
    throw new Error("You are not authorized to edit this reservation.");
  }

  const instrumentId = updates.instrumentId || existing.instrumentId;

  // Extract current time range if not updated
  // If date/startTime/duration provided, compute new range
  let start: Date;
  let end: Date;

  if (updates.date || updates.startTime || updates.duration) {
    // Need all three or fallback
    if (!updates.date || !updates.startTime || !updates.duration) {
      throw new Error(
        "When editing time, date, startTime, and duration must all be provided.",
      );
    }
    const tr = buildTimeRange(
      updates.date,
      updates.startTime,
      updates.duration,
    );
    start = tr.start;
    end = tr.end;
  } else {
    // Query postgres to extract bounds of existing time_range
    const boundsRes: any = await db.execute(
      sql`SELECT lower(time_range) as start_time, upper(time_range) as end_time FROM reservations WHERE id = ${reservationId}`,
    );
    start = new Date(boundsRes.rows[0].start_time);
    end = new Date(boundsRes.rows[0].end_time);
  }

  validateWorkingHours(start, end);

  // Check conflicts with OTHER approved reservations on this instrument
  const conflicts = await db
    .select({ id: reservations.id })
    .from(reservations)
    .where(
      sql`${reservations.instrumentId} = ${instrumentId}
        AND ${reservations.id} != ${reservationId}
        AND ${reservations.status} = 'approved'
        AND ${reservations.timeRange} && tstzrange(${start.toISOString()}, ${end.toISOString()}, '[)')`,
    )
    .limit(1);

  if (conflicts.length > 0) {
    throw new Error(
      "The updated time slot conflicts with an existing approved reservation.",
    );
  }

  // Fetch instrument
  const [instrument] = await db
    .select()
    .from(instruments)
    .where(eq(instruments.id, instrumentId))
    .limit(1);

  if (!instrument) {
    throw new Error("Target instrument not found.");
  }

  // Check Trusted or Admin status
  let isTrustedOrAdmin = false;
  if (existing.adminId || caller.adminId) {
    isTrustedOrAdmin = true;
  } else if (existing.userId) {
    const [u] = await db
      .select()
      .from(users)
      .where(eq(users.id, existing.userId))
      .limit(1);
    if (u?.isTrusted) isTrustedOrAdmin = true;
  }

  let newStatus: "approved" | "pending" = "pending";

  if (isTrustedOrAdmin) {
    // Always re-run and auto-approve again (skip limit/mode checks, conflict check already passed)
    newStatus = "approved";
  } else if (existing.status === "pending") {
    // Stays pending, conflict check already passed
    newStatus = "pending";
  } else if (existing.status === "approved") {
    if (instrument.bookingMode === "manual") {
      newStatus = "pending";
    } else {
      // Check hard limits
      const limits = await getHardLimits();
      let limitExceeded = false;
      const durationHours = (end.getTime() - start.getTime()) / (3600 * 1000);

      if (durationHours > limits.maxDurationHours) limitExceeded = true;

      if (!limitExceeded && existing.userId) {
        // Active reservations check (exclude current reservation)
        const activeRes = await db
          .select({ count: sql<number>`count(*)::int` })
          .from(reservations)
          .where(
            and(
              eq(reservations.userId, existing.userId),
              sql`${reservations.id} != ${reservationId}`,
              inArray(reservations.status, ["pending", "approved"]),
            ),
          );
        if (Number(activeRes[0]?.count || 0) >= limits.maxActiveReservations) {
          limitExceeded = true;
        }
      }

      newStatus = limitExceeded ? "pending" : "approved";
    }
  }

  let outsideFee = existing.feeSnapshot;
  const resType = updates.reservationType || existing.reservationType;
  if (resType === "outside_church") {
    if (!updates.feeAcknowledged && !existing.feeSnapshot) {
      throw new Error(
        "Outside church reservation requires fee acknowledgment.",
      );
    }
    outsideFee = instrument.outsideFeePerDay;
  } else {
    outsideFee = null;
  }

  const cleanFee = toNullableString(outsideFee);
  const cleanServiceName =
    updates.serviceName !== undefined
      ? updates.serviceName.trim()
      : existing.serviceName;

  const [updated] = await db
    .update(reservations)
    .set({
      instrumentId,
      serviceName: cleanServiceName,
      timeRange:
        sql`tstzrange(${start.toISOString()}, ${end.toISOString()}, '[)')` as any,
      reservationType: resType,
      feeSnapshot: cleanFee,
      status: newStatus,
      rejectionReason: null,
    })
    .where(eq(reservations.id, reservationId))
    .returning();

  if (newStatus === "approved") {
    await autoRejectOverlappingPending(instrumentId, start, end, reservationId);
  }

  return updated;
}

/**
 * =========================================================================
 * 4. CANCELLATION LOGIC
 * =========================================================================
 */
export async function cancelReservation(
  reservationId: string,
  options: { cancelMode?: "single" | "series" },
  caller: { userId?: string; adminId?: string },
) {
  const [target] = await db
    .select()
    .from(reservations)
    .where(eq(reservations.id, reservationId))
    .limit(1);

  if (!target) {
    throw new Error("Reservation not found.");
  }

  // Authorization check
  const cleanCallerAdminId = toNullableString(caller.adminId);
  const cleanCallerUserId = toNullableString(caller.userId);
  if (
    !cleanCallerAdminId &&
    (!cleanCallerUserId || target.userId !== cleanCallerUserId)
  ) {
    throw new Error("You are not authorized to cancel this reservation.");
  }

  if (options.cancelMode === "series" && target.seriesId) {
    // Cancel all active/pending/approved occurrences in this series
    const cancelled = await db
      .update(reservations)
      .set({ status: "cancelled" })
      .where(
        and(
          eq(reservations.seriesId, target.seriesId),
          inArray(reservations.status, ["pending", "approved", "ongoing"]),
        ),
      )
      .returning();

    return {
      mode: "series",
      cancelledCount: cancelled.length,
      reservations: cancelled,
    };
  }

  // Cancel single occurrence
  const [cancelled] = await db
    .update(reservations)
    .set({ status: "cancelled" })
    .where(eq(reservations.id, reservationId))
    .returning();

  return { mode: "single", reservation: cancelled };
}

/**
 * =========================================================================
 * 5. ADMIN ACTIONS
 * =========================================================================
 */
export async function adminApproveReservation(
  reservationId: string,
  adminId?: string | null,
) {
  const [res] = await db
    .select()
    .from(reservations)
    .where(eq(reservations.id, reservationId))
    .limit(1);

  if (!res) throw new Error("Reservation not found.");

  // Extract time range
  const boundsRes: any = await db.execute(
    sql`SELECT lower(time_range) as start_time, upper(time_range) as end_time FROM reservations WHERE id = ${reservationId}`,
  );
  const start = new Date(boundsRes.rows[0].start_time);
  const end = new Date(boundsRes.rows[0].end_time);

  // Check if conflict exists
  const conflicts = await db
    .select({ id: reservations.id })
    .from(reservations)
    .where(
      sql`${reservations.instrumentId} = ${res.instrumentId}
        AND ${reservations.id} != ${reservationId}
        AND ${reservations.status} = 'approved'
        AND ${reservations.timeRange} && tstzrange(${start.toISOString()}, ${end.toISOString()}, '[)')`,
    )
    .limit(1);

  if (conflicts.length > 0) {
    throw new Error(
      "Cannot approve: this time slot conflicts with another already approved reservation.",
    );
  }

  const cleanAdminId = toNullableString(adminId);

  const [approved] = await db
    .update(reservations)
    .set({
      status: "approved",
      rejectionReason: null,
      adminId: cleanAdminId,
    })
    .where(eq(reservations.id, reservationId))
    .returning();

  // Auto-reject other pending overlapping
  await autoRejectOverlappingPending(
    res.instrumentId,
    start,
    end,
    reservationId,
  );

  // Notify user
  if (res.userId) {
    await db.insert(notifications).values({
      userId: res.userId,
      reservationId: res.id,
      type: "reservation_approved",
      message: "Your reservation has been approved by an administrator.",
    });
  }

  return approved;
}

export async function adminRejectReservation(
  reservationId: string,
  reason: string,
  adminId?: string | null,
) {
  if (!reason || !reason.trim()) {
    throw new Error("A rejection reason is required.");
  }

  const [res] = await db
    .select()
    .from(reservations)
    .where(eq(reservations.id, reservationId))
    .limit(1);

  if (!res) throw new Error("Reservation not found.");

  const cleanAdminId = toNullableString(adminId);

  const [rejected] = await db
    .update(reservations)
    .set({
      status: "rejected",
      rejectionReason: reason.trim(),
      adminId: cleanAdminId,
    })
    .where(eq(reservations.id, reservationId))
    .returning();

  if (res.userId) {
    await db.insert(notifications).values({
      userId: res.userId,
      reservationId: res.id,
      type: "reservation_rejected",
      message: `Your reservation request was rejected by an administrator. Reason: ${reason.trim()}`,
    });
  }

  return rejected;
}

export async function adminApproveSeries(
  seriesId: string,
  adminId?: string | null,
) {
  // Find all pending occurrences in this series
  const pendingOccurrences = await db
    .select()
    .from(reservations)
    .where(
      and(
        eq(reservations.seriesId, seriesId),
        eq(reservations.status, "pending"),
      ),
    );

  const cleanAdminId = toNullableString(adminId);
  const approvedList: any[] = [];

  for (const occ of pendingOccurrences) {
    try {
      const app = await adminApproveReservation(occ.id, cleanAdminId);
      approvedList.push(app);
    } catch (e: any) {
      console.warn(
        `Could not approve occurrence ${occ.id} in series:`,
        e.message,
      );
    }
  }

  return {
    seriesId,
    approvedCount: approvedList.length,
    approved: approvedList,
  };
}

export async function adminRejectSeries(
  seriesId: string,
  reason: string,
  adminId?: string | null,
) {
  if (!reason || !reason.trim()) {
    throw new Error("A rejection reason is required.");
  }

  const cleanAdminId = toNullableString(adminId);

  // Find all pending, approved, or active uncompleted occurrences in this series
  const seriesOccurrences = await db
    .select()
    .from(reservations)
    .where(
      and(
        eq(reservations.seriesId, seriesId),
        inArray(reservations.status, ["pending", "approved", "ongoing"]),
      ),
    );

  const rejectedList = await db
    .update(reservations)
    .set({
      status: "rejected",
      rejectionReason: reason.trim(),
      adminId: cleanAdminId,
    })
    .where(
      and(
        eq(reservations.seriesId, seriesId),
        inArray(reservations.status, ["pending", "approved", "ongoing"]),
      ),
    )
    .returning();

  // Notify user
  const userId = seriesOccurrences[0]?.userId;
  if (userId) {
    await db.insert(notifications).values({
      userId,
      type: "series_rejected",
      message: `Your recurring series was rejected by an administrator. Reason: ${reason.trim()}`,
    });
  }

  return {
    seriesId,
    rejectedCount: rejectedList.length,
    rejected: rejectedList,
  };
}

export async function adminBulkApprove(
  reservationIds: string[],
  adminId?: string | null,
) {
  if (!Array.isArray(reservationIds) || reservationIds.length === 0) {
    throw new Error("No reservation IDs provided for bulk approval.");
  }

  const cleanAdminId = toNullableString(adminId);
  const approvedList: any[] = [];
  const errors: { id: string; error: string }[] = [];

  for (const id of reservationIds) {
    try {
      const approved = await adminApproveReservation(id, cleanAdminId);
      approvedList.push(approved);
    } catch (err: any) {
      errors.push({ id, error: err.message });
    }
  }

  return {
    success: true,
    totalRequested: reservationIds.length,
    approvedCount: approvedList.length,
    approved: approvedList,
    errors,
  };
}

export async function adminBulkReject(
  reservationIds: string[],
  reason: string,
  adminId?: string | null,
) {
  if (!Array.isArray(reservationIds) || reservationIds.length === 0) {
    throw new Error("No reservation IDs provided for bulk rejection.");
  }
  if (!reason || !reason.trim()) {
    throw new Error("A rejection reason is required for bulk rejection.");
  }

  const cleanAdminId = toNullableString(adminId);

  const rejectedList = await db
    .update(reservations)
    .set({
      status: "rejected",
      rejectionReason: reason.trim(),
      adminId: cleanAdminId,
    })
    .where(
      and(
        inArray(reservations.id, reservationIds),
        inArray(reservations.status, ["pending", "approved", "ongoing"]),
      ),
    )
    .returning();

  // Group notifications by userId
  const userIds = Array.from(
    new Set(rejectedList.map((r) => r.userId).filter(Boolean)),
  );
  for (const uid of userIds) {
    await db.insert(notifications).values({
      userId: uid as string,
      type: "reservation_rejected",
      message: `Your reservation request(s) were rejected by an administrator. Reason: ${reason.trim()}`,
    });
  }

  return {
    success: true,
    totalRequested: reservationIds.length,
    rejectedCount: rejectedList.length,
    rejected: rejectedList,
  };
}

export async function adminBulkCancel(
  reservationIds: string[],
  adminId?: string | null,
) {
  if (!Array.isArray(reservationIds) || reservationIds.length === 0) {
    throw new Error("No reservation IDs provided for bulk cancellation.");
  }

  const cleanAdminId = toNullableString(adminId);
  const cancelled: any[] = [];
  const errors: { id: string; error: string }[] = [];

  for (const id of reservationIds) {
    try {
      const result = await cancelReservation(
        id,
        { cancelMode: "single" },
        { adminId: cleanAdminId || undefined },
      );
      cancelled.push(result.reservation || result);
    } catch (err: any) {
      errors.push({ id, error: err.message });
    }
  }

  return {
    success: true,
    totalRequested: reservationIds.length,
    cancelledCount: cancelled.length,
    cancelled,
    errors,
  };
}

/**
 * =========================================================================
 * 6. STATUS TRANSITIONS (Scheduled Check / Background Job)
 * =========================================================================
 */
export async function ensureCurrentReservationStatuses() {
  const toOngoingRes = await db.execute(sql`
    UPDATE reservations
    SET status = 'ongoing'
    WHERE status = 'approved'
      AND lower(time_range) <= NOW()
      AND upper(time_range) > NOW()
    RETURNING id;
  `);

  const toCompletedRes = await db.execute(sql`
    UPDATE reservations
    SET status = 'completed'
    WHERE status IN ('ongoing', 'approved')
      AND upper(time_range) <= NOW()
    RETURNING id;
  `);

  const ongoingCount = ((toOngoingRes as any).rows || []).length;
  const completedCount = ((toCompletedRes as any).rows || []).length;

  return { ongoingCount, completedCount };
}

export async function runStatusTransitions() {
  return ensureCurrentReservationStatuses();
}

/**
 * =========================================================================
 * 7. INSTRUMENT REMOVAL (Force-Remove with Conflict Cancellation)
 * =========================================================================
 */
export async function removeInstrumentWithConfirmation(
  instrumentId: string,
  options: { confirmForce: boolean },
  adminId?: string | null,
) {
  const cleanAdminId = toNullableString(adminId);

  // Check future active reservations
  const futureActive = await db
    .select({
      id: reservations.id,
      userId: reservations.userId,
      status: reservations.status,
    })
    .from(reservations)
    .where(
      and(
        eq(reservations.instrumentId, instrumentId),
        inArray(reservations.status, ["approved", "pending"]),
        sql`upper(${reservations.timeRange}) > NOW()`,
      ),
    );

  if (futureActive.length > 0 && !options.confirmForce) {
    return {
      requiresConfirmation: true,
      futureReservationCount: futureActive.length,
      message: `There are ${futureActive.length} active/pending future reservations for this instrument. Pass confirmForce: true to cancel them and remove the instrument.`,
    };
  }

  // Cancel all future active reservations
  if (futureActive.length > 0) {
    await db
      .update(reservations)
      .set({
        status: "cancelled",
        rejectionReason: "Instrument removed by administration",
        adminId: cleanAdminId,
      })
      .where(
        and(
          eq(reservations.instrumentId, instrumentId),
          inArray(reservations.status, ["approved", "pending"]),
          sql`upper(${reservations.timeRange}) > NOW()`,
        ),
      );

    // Notify all affected users
    for (const res of futureActive) {
      if (res.userId) {
        await db.insert(notifications).values({
          userId: res.userId,
          reservationId: res.id,
          type: "instrument_removed_cancellation",
          message:
            "Your reservation was cancelled because the instrument was removed from the inventory by administration.",
        });
      }
    }
  }

  // Mark instrument as removed
  const [removedInstrument] = await db
    .update(instruments)
    .set({ isRemoved: true })
    .where(eq(instruments.id, instrumentId))
    .returning();

  return {
    success: true,
    cancelledReservationsCount: futureActive.length,
    instrument: removedInstrument,
  };
}
