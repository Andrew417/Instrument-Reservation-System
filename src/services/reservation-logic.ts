import { db, pool } from "../db/index.js";
import {
  sendSuperAdminNotificationEmail,
  sendReservationApprovedEmail,
  sendReservationRejectedEmail,
} from "../lib/mailer.js";
import {
  users,
  admins,
  instruments,
  reservations,
  reservationSeries,
  notificationSettings,
  notifications,
  hardLimits,
  messages,
} from "../db/schema.js";
import { eq, and, sql, inArray, gte, lte, desc } from "drizzle-orm";
import {
  addDaysToDateString,
  cairoDateTimeToDate,
  getCairoDateString,
  getCairoParts,
  getCairoTimeString,
  shiftDateToWeekday,
} from "../lib/date-utils.js";
import { sendPushToUser, sendPushToAdmins } from "../lib/push-service.js";

export interface TimeSlot {
  date: string; // 'YYYY-MM-DD'
  startTime: string; // 'HH:mm' (e.g. '09:00', '14:30')
  duration: number; // Duration in hours (e.g. 1, 2, 1.5)
}

export interface ReservationSubmissionInput {
  userId?: string;
  adminId?: string;
  instrumentId?: string;
  serviceName: string; // Required free-text (e.g. 'Sunday Morning Service', 'Youth Choir Practice')
  serviceLocation?: string; // Location or hall (e.g. 'Main Church Sanctuary', 'Youth Hall', 'St. George Chapel')
  musicianName: string;
  date: string; // 'YYYY-MM-DD'
  startTime: string; // 'HH:mm'
  duration: number; // in hours
  reservationType: "in_church" | "outside_church";
  feeAcknowledged?: boolean;
  bandPackId?: string;
  note?: string;
  isTypeRequest?: boolean;
  requestedType?: string;
}

export interface SeriesSubmissionInput {
  userId?: string;
  adminId?: string;
  instrumentId?: string;
  serviceName: string; // Applies to the whole series
  serviceLocation?: string;
  musicianName: string;
  patternType: "weekly" | "custom";
  occurrences: TimeSlot[];
  reservationType: "in_church" | "outside_church";
  feeAcknowledged?: boolean;
  note?: string;
  isTypeRequest?: boolean;
  requestedType?: string;
}

export interface EvaluationResult {
  status: "approved" | "pending";
  reasons: string[];
  isTrustedOrAdmin: boolean;
  outsideFeeSnapshot: string | null;
  startTimeUtc: Date;
  endTimeUtc: Date;
  timeRangeSqlString: string;
  exceededLimits?: string[];
  isTypeRequest?: boolean;
  requestedType?: string;
}

/**
 * Mask retired/vault or reserve pool instruments to preserve confidentiality
 */
export function getMaskedInstrumentName(type?: string | null): string {
  const cleanType = (type || "").trim();
  if (/keyboard/i.test(cleanType)) return "Church Assigned Keyboard";
  if (/drum/i.test(cleanType)) return "Church Assigned Drum Kit";
  if (/guitar/i.test(cleanType)) return "Church Assigned Guitar";
  if (/violin/i.test(cleanType)) return "Church Assigned Violin";
  if (/brass|wind/i.test(cleanType)) return "Church Assigned Wind Instrument";
  if (/string/i.test(cleanType)) return "Church Assigned Strings";
  if (/audio/i.test(cleanType)) return "Church Assigned Audio Equipment";
  return cleanType
    ? `Church Assigned ${cleanType}`
    : "Church Assigned Instrument";
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
  // Allow a 2-minute grace window to protect against network delay and client-server clock drift
  const graceThreshold = new Date(now.getTime() - 2 * 60 * 1000);
  if (start < graceThreshold || end <= now) {
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
  isMusician: boolean;
  isAdmin: boolean;
}> {
  let userId = toNullableString(rawUserId);
  let adminId = toNullableString(rawAdminId);
  let isTrusted = false;
  let isMusician = false;
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
          .select({
            id: users.id,
            isTrusted: users.isTrusted,
            isMusician: users.isMusician,
          })
          .from(users)
          .where(eq(users.id, adminId))
          .limit(1);

        if (userRows.length > 0) {
          userId = adminId;
          adminId = null;
          isTrusted = Boolean(userRows[0].isTrusted);
          isMusician = Boolean(userRows[0].isMusician);
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
        .select({
          id: users.id,
          isTrusted: users.isTrusted,
          isMusician: users.isMusician,
        })
        .from(users)
        .where(eq(users.id, userId))
        .limit(1);

      if (userRows.length > 0) {
        isTrusted = Boolean(userRows[0].isTrusted);
        isMusician = Boolean(userRows[0].isMusician);
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
    isMusician,
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
    isTypeRequest,
    requestedType,
  } = input;

  const { resolvedUserId, resolvedAdminId, isTrusted, isMusician, isAdmin } =
    await resolveUserAndAdminIds(userId, adminId);
  const cleanUserId = resolvedUserId;
  const cleanAdminId = resolvedAdminId;
  const isTrustedOrAdmin = isTrusted || isAdmin;

  // 1. Working hours check
  const { start, end, timeRangeSqlString } = buildTimeRange(
    date,
    startTime,
    duration,
  );
  validateWorkingHours(start, end);

  const limits = options?.preloadedLimits || (await getHardLimits());

  // 2. Submission rate limit (skip if series-level check already evaluated it or bypass enabled, or admin booking)
  if (
    !options?.skipRateLimitCheck &&
    cleanUserId &&
    !cleanAdminId &&
    !isAdmin &&
    !limits.bypassHardLimits
  ) {
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
        `You've hit the limit of ${limits.maxSubmissionsPerHour} submissions per hour. Please wait a bit and try again.`,
      );
    }
  }

  // BRANCH A: TYPE REQUEST
  if (isTypeRequest) {
    if (isMusician && !isAdmin && !cleanAdminId) {
      throw new Error(
        "Musicians don't use type requests; they book visible instruments directly.",
      );
    }
    const cleanType = requestedType?.trim();
    if (!cleanType) {
      throw new Error("Requested instrument type is required.");
    }

    // Verify type is configured and can be requested
    const typeRes = await db.execute(sql`
      SELECT type, can_be_requested, flat_fee_outside
      FROM instrument_type_settings
      WHERE type ILIKE ${cleanType}
      LIMIT 1;
    `);
    const typeRow = (typeRes as any).rows?.[0];
    if (!typeRow || !typeRow.can_be_requested) {
      throw new Error(`Requests for type "${cleanType}" are not currently enabled.`);
    }

    // Outside church fee check: flat fee per type locked at submission
    let outsideFeeSnapshot: string | null = null;
    if (reservationType === "outside_church") {
      if (!feeAcknowledged && !isAdmin && !cleanAdminId) {
        throw new Error(
          `Outside church type request requires fee acknowledgment (flat fee: ${typeRow.flat_fee_outside || "0.00"} EGP).`,
        );
      }
      outsideFeeSnapshot = String(typeRow.flat_fee_outside || "0.00");
    }

    // Limits check for type requests:
    // - Regular user cannot submit if active reservations limit reached (Pending type requests count, series counts as 1).
    // - Trusted users and admins bypass this limit.
    if (!isTrustedOrAdmin && !limits.bypassHardLimits && cleanUserId) {
      await ensureCurrentReservationStatuses().catch(() => {});
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
        throw new Error(
          `You've reached your active reservations limit (${activeCount}/${limits.maxActiveReservations}). Pending requests and approved bookings count toward this limit.`,
        );
      }
    }

    // Other limits (daily reservations, duration, concurrent same-type):
    // Accepted anyway, but marked in exceededLimits so the admin sees why.
    const exceededLimits: string[] = [];
    if (!limits.bypassHardLimits && cleanUserId && !isAdmin && !cleanAdminId) {
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
        exceededLimits.push(
          `Exceeded daily reservation limit (${dayCount}/${limits.maxReservationsPerDay} on ${dateStr})`,
        );
      }

      if (duration > limits.maxDurationHours) {
        exceededLimits.push(
          `Exceeded single booking duration limit (${duration}h > ${limits.maxDurationHours}h)`,
        );
      }

      const concurrentRes = await db.execute(sql`
        SELECT count(*)::int as count
        FROM reservations r
        LEFT JOIN instruments i ON r.instrument_id = i.id
        WHERE r.user_id = ${cleanUserId}
          AND r.status IN ('pending', 'approved')
          AND (COALESCE(i.type, r.requested_type) ILIKE ${cleanType})
          AND r.time_range && tstzrange(${start.toISOString()}, ${end.toISOString()}, '[)')
      `);
      const concurrentCount = Number((concurrentRes as any).rows?.[0]?.count || 0);
      if (concurrentCount >= limits.maxConcurrentPerType) {
        exceededLimits.push(
          `Exceeded concurrent bookings limit for ${cleanType} (${concurrentCount}/${limits.maxConcurrentPerType})`,
        );
      }
    }

    // Type requests always start as Pending, even for Trusted users!
    // Never appears on calendar and doesn't block slots until assigned.
    const reasons = [
      "Type request submitted for administrator assignment.",
      ...exceededLimits,
    ];

    return {
      status: "pending",
      reasons,
      isTrustedOrAdmin,
      outsideFeeSnapshot,
      startTimeUtc: start,
      endTimeUtc: end,
      timeRangeSqlString,
      exceededLimits: exceededLimits.length > 0 ? exceededLimits : undefined,
      isTypeRequest: true,
      requestedType: cleanType,
    };
  }

  // BRANCH B: DIRECT BOOKING
  if (!instrumentId) {
    throw new Error("Instrument ID is required for direct booking.");
  }

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

  if (instrument.isOutOfService) {
    throw new Error("This instrument is currently marked Out of service and cannot be booked.");
  }

  if (instrument.visibilityLevel === "room_stock" && !isAdmin && !cleanAdminId) {
    throw new Error("Room stock instruments cannot be booked directly.");
  }

  if (instrument.visibilityLevel === "musician" && !isMusician && !isAdmin && !cleanAdminId) {
    throw new Error("This instrument is restricted to registered church musicians.");
  }

  // Conflict check: does this time range overlap an existing APPROVED reservation for this instrument?
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

  // Outside church fee requirement check
  let outsideFeeSnapshot: string | null = null;
  if (reservationType === "outside_church") {
    if (!feeAcknowledged && !isAdmin && !cleanAdminId) {
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
    if (isAdmin || cleanAdminId) {
      calculatedStatus = "approved";
      reasons.push(
        "Auto-approved via Administrator Privilege (Outside-church fee snapshotted)",
      );
    } else {
      calculatedStatus = "pending";
      reasons.push(
        "Outside-church reservation requires administrator review and payment arrangement.",
      );
    }
  } else if (isTrustedOrAdmin) {
    calculatedStatus = "approved";
    reasons.push("Auto-approved via Trusted User / Admin privilege");
  } else {
    await ensureCurrentReservationStatuses().catch(() => {});

    let limitExceeded = false;

    if (!limits.bypassHardLimits) {
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
            `You've reached your active reservations limit (${activeCount}/${limits.maxActiveReservations}). This request will wait for admin review instead of auto-approving.`,
          );
        }
      }

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
            `You've reached your daily reservation limit for ${dateStr} (${dayCount}/${limits.maxReservationsPerDay}). This request will wait for admin review instead of auto-approving.`,
          );
        }
      }

      if (duration > limits.maxDurationHours) {
        limitExceeded = true;
        reasons.push(
          `This booking (${duration}h) is longer than the ${limits.maxDurationHours}h limit for a single reservation. It will wait for admin review instead of auto-approving.`,
        );
      }

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
              sql`${reservations.timeRange} && tstzrange(${start.toISOString()}, ${end.toISOString()}, '[)')`,
            ),
          );

        const concurrentCount = Number(concurrentRes[0]?.count || 0);
        if (concurrentCount >= limits.maxConcurrentPerType) {
          limitExceeded = true;
          reasons.push(
            `You already have ${concurrentCount}/${limits.maxConcurrentPerType} ${instrument.type} reservations at this same time. This request will wait for admin review instead of auto-approving.`,
          );
        }
      }
    }

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
    isTypeRequest: false,
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
      AND (is_type_request = false OR is_type_request IS NULL)
      ${approvedReservationId ? sql`AND id != ${approvedReservationId}` : sql``}
      AND time_range && tstzrange(${start.toISOString()}, ${end.toISOString()}, '[)')
    RETURNING id, user_id, service_name, time_range;
  `;

  const result = await db.execute(query);
  const autoRejectedRows = (result as any).rows || [];

  // Notify affected users in-app
  for (const row of autoRejectedRows) {
    if (row.user_id) {
      await db.insert(notifications).values({
        userId: row.user_id,
        reservationId: row.id,
        type: "reservation_auto_rejected",
        message:
          "Your pending reservation was auto-rejected due to a conflict with an approved reservation for this time slot.",
      });

      sendPushToUser(row.user_id, {
        titleAr: "تعذر حجز الموعد بسبب تعارض",
        titleEn: "Reservation Request Conflict",
        bodyAr: `تم رفض حجز "${row.service_name || "الخدمة"}" تلقائياً بسبب اعتماد حجز آخر في نفس التوقيت.`,
        bodyEn: `Your booking for "${row.service_name || "Reservation"}" was auto-rejected due to a conflict with an approved reservation.`,
        tag: `res-status-${row.id}`,
        url: `/?reservationId=${row.id}`,
        data: { reservationId: row.id, status: "auto_rejected" },
      }).catch((e) =>
        console.warn("[Push auto-reject error]:", e.message),
      );
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
  const cleanMusicianName = (input.musicianName || "").trim();
  const cleanNote = toNullableString(input.note);

  if (!cleanMusicianName) {
    throw new Error("Musician name is required.");
  }

  // Runtime validation assertion: instrumentId is required only for direct bookings
  if (!input.isTypeRequest && !input.instrumentId) {
    throw new Error("Instrument ID is required.");
  }

  const reservationParams = {
    seriesId: null,
    userId: cleanUserId,
    adminId: cleanAdminId,
    instrumentId: input.isTypeRequest ? null : input.instrumentId,
    serviceName: cleanServiceName,
    serviceLocation: toNullableString(input.serviceLocation),
    musicianName: cleanMusicianName,
    note: cleanNote,
    bandPackId: input.bandPackId || null,
    conditionStatus: "uninspected",
    timeRange:
      sql`tstzrange(${evalResult.startTimeUtc.toISOString()}, ${evalResult.endTimeUtc.toISOString()}, '[)')` as any,
    reservationType: input.reservationType,
    feeSnapshot: cleanFeeSnapshot,
    status: evalResult.status,
    rejectionReason: null,
    paymentScreenshotUrl: null,
    bookedByAdmin: Boolean(cleanAdminId),
    isTypeRequest: Boolean(input.isTypeRequest),
    requestedType: input.isTypeRequest ? input.requestedType?.trim() || null : null,
    exceededLimits:
      evalResult.exceededLimits && evalResult.exceededLimits.length > 0
        ? JSON.stringify(evalResult.exceededLimits)
        : null,
  };

  const [newReservation] = await db
    .insert(reservations)
    .values(reservationParams)
    .returning();

  // If requester provided a note, also record it as the initial message in the reservation thread
  if (cleanNote) {
    try {
      const senderRole = cleanAdminId ? "admin" : "user";
      let senderName = null;
      if (cleanAdminId) {
        const [adm] = await db
          .select({ name: admins.name })
          .from(admins)
          .where(eq(admins.id, cleanAdminId))
          .limit(1);
        senderName = adm?.name || "Administrator";
      } else if (cleanUserId) {
        const [usr] = await db
          .select({ name: users.name })
          .from(users)
          .where(eq(users.id, cleanUserId))
          .limit(1);
        senderName = usr?.name || "Member";
      }
      await db.insert(messages).values({
        reservationId: newReservation.id,
        adminId: cleanAdminId || null,
        userId: cleanUserId || null,
        senderRole,
        senderName,
        content: cleanNote,
        isRead: false,
      });
    } catch (msgErr) {
      console.error(
        "Non-fatal: failed to create initial note in messages:",
        msgErr,
      );
    }
  }

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

      // Instant bookings do not require approval, but admins still receive an
      // in-app audit notification. This intentionally does not send email.
      if (
        evalResult.reasons.some((reason) =>
          reason.includes("Auto-approved via Instant Booking mode"),
        )
      ) {
        const allAdmins = await db.select({ id: admins.id }).from(admins);
        for (const admin of allAdmins) {
          await db.insert(notifications).values({
            adminId: admin.id,
            reservationId: newReservation.id,
            type: "reservation_instant_approved",
            message: `Instant reservation created for ${input.serviceName} on ${input.date} at ${input.startTime}.`,
          });
        }
      }

      // Send approval email for auto-approved booking (non-blocking)
      (async () => {
        try {
          const [userInfo] = await db
            .select({ name: users.name, email: users.email })
            .from(users)
            .where(eq(users.id, cleanUserId))
            .limit(1);

          const [instInfo] = await db
            .select({ name: instruments.name })
            .from(instruments)
            .where(eq(instruments.id, input.instrumentId))
            .limit(1);

          if (userInfo?.email) {
            await sendReservationApprovedEmail({
              email: userInfo.email,
              name: userInfo.name,
              instrumentName: instInfo?.name || "Instrument",
              musicianName: input.musicianName,
              serviceName: input.serviceName,
              reservationType: input.reservationType,
              startTime: evalResult.startTimeUtc,
              endTime: evalResult.endTimeUtc,
              isSeries: false,
              feeSnapshot: cleanFeeSnapshot,
            });
          }
        } catch (mailErr) {
          console.error(
            "Error sending auto-approved reservation email:",
            mailErr,
          );
        }
      })();
    }
  } else if (cleanUserId) {
    // Notification for pending submission
    const targetTypeOrName = input.isTypeRequest
      ? input.requestedType || "Instrument"
      : "an instrument";

    const pendingMsg = input.isTypeRequest
      ? `Your request for a ${input.requestedType} on ${input.date} (${input.startTime}) has been submitted and is awaiting administrator assignment.`
      : input.reservationType === "outside_church"
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

    const [instrumentRow] = input.instrumentId
      ? await db
          .select({ name: instruments.name })
          .from(instruments)
          .where(eq(instruments.id, input.instrumentId))
          .limit(1)
      : [null];

    const instrumentDisplayName = input.isTypeRequest
      ? `${input.requestedType} (Type Request)`
      : instrumentRow?.name || "Instrument";

    const formattedStartTime = input.startTime;
    const formattedEndTime = getCairoTimeString(evalResult.endTimeUtc);

    const notifSettings = await getNotificationSettings();
    if (!notifSettings.muteReservationRequestEmails) {
      await sendSuperAdminNotificationEmail(
        input.isTypeRequest
          ? "New Instrument Type Request Awaiting Assignment - St. Mark Musicians"
          : "New Reservation Pending Approval - St. Mark Musicians",
        input.isTypeRequest ? "New Type Request" : "New Reservation Request",
        input.isTypeRequest
          ? "A member has requested an instrument by type and requires assignment."
          : "A reservation request is awaiting your approval.",
        [
          { label: "Requested by:", value: requester?.name || "Unknown" },
          { label: "Phone:", value: requester?.phoneNumber || "N/A" },
          { label: "Instrument / Type:", value: instrumentDisplayName },
          { label: "Musician:", value: input.musicianName },
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

    let minimalRequestMsg = input.isTypeRequest
      ? `New type request from ${requester?.name || "a member"} for ${input.requestedType} on ${input.date}.`
      : `New reservation request from ${requester?.name || "a member"} for ${instrumentRow?.name || "an instrument"} on ${input.date}.`;

    try {
      const [y, m, d] = input.date.split("-").map(Number);
      const dateUtc = new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
      const dayNames = [
        "Sunday",
        "Monday",
        "Tuesday",
        "Wednesday",
        "Thursday",
        "Friday",
        "Saturday",
      ];
      const dayName = dayNames[dateUtc.getUTCDay()] || "";
      const formattedDate = `${d}-${m}-${y}`;

      const formatTimeToClean = (timeStr: string) => {
        if (!timeStr) return "";
        const match = timeStr.match(/^(\d{1,2}):(\d{2})/);
        if (!match) return timeStr;
        let h = parseInt(match[1], 10);
        const min = match[2];
        if (h > 12) h -= 12;
        if (h === 0) h = 12;
        return `${h}:${min}`;
      };

      const startFmt = formatTimeToClean(input.startTime);
      const endFmt = formatTimeToClean(
        getCairoTimeString(evalResult.endTimeUtc),
      );
      const durStr = input.duration ? ` (${input.duration}h)` : "";
      minimalRequestMsg = input.isTypeRequest
        ? `[Type Request] ${input.requestedType} on ${dayName} ${formattedDate} from ${startFmt} to ${endFmt}${durStr}`
        : `${instrumentRow?.name || "Instrument"} on ${dayName} ${formattedDate} from ${startFmt} to ${endFmt}${durStr}`;
    } catch {
      // fallback to default
    }

    for (const adm of allAdmins) {
      await db
        .insert(notifications)
        .values({
          adminId: adm.id,
          reservationId: newReservation.id,
          type: "reservation_submitted",
          message: minimalRequestMsg,
        })
        .catch(() => {});
    }

    // Web Push notification to admins for new request
    sendPushToAdmins(
      {
        titleAr: input.isTypeRequest ? "طلب نوع آلة جديد" : "طلب حجز جديد",
        titleEn: input.isTypeRequest
          ? "New Instrument Type Request"
          : "New Reservation Request",
        bodyAr: `${requester?.name || "عضو"}: ${instrumentDisplayName} (${input.serviceName || "خدمة"})`,
        bodyEn: `${requester?.name || "A member"}: ${instrumentDisplayName} (${input.serviceName || "Service"})`,
        tag: "admin-new-requests",
        url: `/?reservationId=${newReservation.id}`,
        data: {
          reservationId: newReservation.id,
          type: input.isTypeRequest ? "type_request" : "reservation_request",
        },
      },
      "new_requests",
    ).catch((e) =>
      console.warn("[Push new reservation error]:", e.message),
    );
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

  const { resolvedUserId, resolvedAdminId, isTrusted, isMusician, isAdmin } =
    await resolveUserAndAdminIds(userId, adminId);
  const cleanUserId = resolvedUserId;
  const cleanAdminId = resolvedAdminId;

  if (input.isTypeRequest && isMusician && !isAdmin && !cleanAdminId) {
    throw new Error(
      "Musicians don't use type requests; they book visible instruments directly.",
    );
  }

  const cleanRequestedType = input.isTypeRequest
    ? input.requestedType?.trim()
    : undefined;
  let typeFlatFeeSnapshot: string | null = null;
  if (input.isTypeRequest) {
    if (!cleanRequestedType) {
      throw new Error("Requested instrument type is required.");
    }
    const typeRes = await db.execute(sql`
      SELECT type, can_be_requested, flat_fee_outside
      FROM instrument_type_settings
      WHERE type ILIKE ${cleanRequestedType}
      LIMIT 1;
    `);
    const typeRow = (typeRes as any).rows?.[0];
    if (!typeRow || !typeRow.can_be_requested) {
      throw new Error(
        `Requests for type "${cleanRequestedType}" are not currently enabled.`,
      );
    }
    if (reservationType === "outside_church") {
      if (!feeAcknowledged && !isAdmin && !cleanAdminId) {
        throw new Error(
          `Outside church type request requires fee acknowledgment (flat fee: ${typeRow.flat_fee_outside || "0.00"} EGP).`,
        );
      }
      typeFlatFeeSnapshot = String(typeRow.flat_fee_outside || "0.00");
    }
  }

  const limits = await getHardLimits();

  // Active reservations limit for type requests:
  // Pending type requests count toward this number, and a recurring series counts as one.
  // Trusted users and admins are not blocked by these limits.
  if (
    input.isTypeRequest &&
    !isTrusted &&
    !isAdmin &&
    !limits.bypassHardLimits &&
    cleanUserId
  ) {
    await ensureCurrentReservationStatuses().catch(() => {});
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
      throw new Error(
        `You've reached your active reservations limit (${activeCount}/${limits.maxActiveReservations}). Pending requests and approved bookings count toward this limit.`,
      );
    }
  }

  // 1. Occurrence count check: reject if > max_series_occurrences (unless bypass enabled or user is Trusted/Admin)
  if (
    !limits.bypassHardLimits &&
    !isTrusted &&
    !isAdmin &&
    occurrences.length > limits.maxSeriesOccurrences
  ) {
    throw new Error(
      `A recurring series can have at most ${limits.maxSeriesOccurrences} occurrences. Please reduce the number of dates and try again (you selected ${occurrences.length}).`,
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

  // 4. Conflict check against existing approved reservations (direct booking only)
  const conflictingOccurrences: any[] = [];
  if (!input.isTypeRequest) {
    if (!instrumentId) {
      throw new Error("Instrument ID is required for direct booking series.");
    }
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
  }

  // 5. Rate limit check for the series submission (bypassed for admin)
  if (cleanUserId && !cleanAdminId && !isAdmin && !limits.bypassHardLimits) {
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
        `You've hit the limit of ${limits.maxSubmissionsPerHour} submissions per hour. Please wait a bit and try again.`,
      );
    }
  }

  const cleanNote = toNullableString(input.note);
  const isBookedByAdminOnBehalf = Boolean(cleanAdminId && cleanUserId);

  // 6 & 7: Atomic Transaction for Series and all Occurrences
  const { newSeries, createdOccurrences } = await db.transaction(async (tx) => {
    // 6. Create series row in database
    const [seriesRow] = await tx
      .insert(reservationSeries)
      .values({
        userId: cleanUserId,
        adminId: cleanAdminId,
        instrumentId: input.isTypeRequest ? null : instrumentId,
        patternType,
        serviceLocation: toNullableString(input.serviceLocation),
        note: cleanNote,
        isTypeRequest: Boolean(input.isTypeRequest),
        requestedType: input.isTypeRequest ? cleanRequestedType || null : null,
      })
      .returning();

    // 7. Process each occurrence through evaluation and insertion
    const occurrencesList: any[] = [];

    for (const occ of parsedOccurrences) {
      const evalResult = await evaluateReservationSubmission(
        {
          userId: cleanUserId || undefined,
          adminId: cleanAdminId || undefined,
          instrumentId: input.isTypeRequest ? undefined : instrumentId,
          serviceName: input.serviceName,
          serviceLocation: input.serviceLocation,
          musicianName: input.musicianName,
          date: occ.date,
          startTime: occ.startTime,
          duration: occ.duration,
          reservationType,
          feeAcknowledged: cleanAdminId ? true : feeAcknowledged,
          isTypeRequest: input.isTypeRequest,
          requestedType: cleanRequestedType,
        },
        { skipRateLimitCheck: true, preloadedLimits: limits },
      );

      const cleanFeeSnapshot = toNullableString(
        input.isTypeRequest ? typeFlatFeeSnapshot : evalResult.outsideFeeSnapshot,
      );
      // Type requests ALWAYS start as pending (even for Trusted users)
      const occurrenceStatus = input.isTypeRequest
        ? "pending"
        : (isBookedByAdminOnBehalf || isAdmin ? "approved" : evalResult.status);

      const occurrenceParams = {
        seriesId: seriesRow.id,
        userId: cleanUserId,
        adminId: cleanAdminId,
        instrumentId: input.isTypeRequest ? null : instrumentId,
        serviceName: (input.serviceName || "").trim() || "Not specified",
        serviceLocation: toNullableString(input.serviceLocation),
        musicianName: (input.musicianName || "").trim(),
        note: cleanNote,
        timeRange:
          sql`tstzrange(${evalResult.startTimeUtc.toISOString()}, ${evalResult.endTimeUtc.toISOString()}, '[)')` as any,
        reservationType,
        feeSnapshot: cleanFeeSnapshot,
        status: occurrenceStatus,
        rejectionReason: null,
        paymentScreenshotUrl: null,
        bookedByAdmin: Boolean(cleanAdminId),
        isTypeRequest: Boolean(input.isTypeRequest),
        requestedType: input.isTypeRequest ? cleanRequestedType || null : null,
        exceededLimits:
          evalResult.exceededLimits && evalResult.exceededLimits.length > 0
            ? JSON.stringify(evalResult.exceededLimits)
            : null,
      };

      const [resRow] = await tx
        .insert(reservations)
        .values(occurrenceParams)
        .returning();

      // If requester provided a note, also record it as the initial message in this occurrence's thread
      if (cleanNote) {
        try {
          const senderRole = cleanAdminId ? "admin" : "user";
          let senderName = null;
          if (cleanAdminId) {
            const [adm] = await tx
              .select({ name: admins.name })
              .from(admins)
              .where(eq(admins.id, cleanAdminId))
              .limit(1);
            senderName = adm?.name || "Administrator";
          } else if (cleanUserId) {
            const [usr] = await tx
              .select({ name: users.name })
              .from(users)
              .where(eq(users.id, cleanUserId))
              .limit(1);
            senderName = usr?.name || "Member";
          }
          await tx.insert(messages).values({
            reservationId: resRow.id,
            adminId: cleanAdminId || null,
            userId: cleanUserId || null,
            senderRole,
            senderName,
            content: cleanNote,
            isRead: false,
          });
        } catch (msgErr) {
          console.error(
            "Non-fatal: failed to record initial series note in messages:",
            msgErr,
          );
        }
      }

      occurrencesList.push({
        reservation: resRow,
        evaluation: { ...evalResult, status: occurrenceStatus },
      });
    }

    return { newSeries: seriesRow, createdOccurrences: occurrencesList };
  });

  // Post-transaction: auto-reject other overlapping pending reservations
  if (!input.isTypeRequest && instrumentId) {
    for (const occ of createdOccurrences) {
      if (occ.reservation.status === "approved") {
        await autoRejectOverlappingPending(
          instrumentId,
          occ.evaluation.startTimeUtc,
          occ.evaluation.endTimeUtc,
          occ.reservation.id,
        ).catch(() => {});
      }
    }
  }

  // User notification for series creation
  if (isBookedByAdminOnBehalf) {
    // Admin booked on behalf of user: Send ONE summary bell notification to target user
    const [instRow] = await db
      .select({ name: instruments.name })
      .from(instruments)
      .where(eq(instruments.id, instrumentId))
      .limit(1);
    const instrumentName = instRow?.name || "the instrument";
    const firstDate = occurrences[0]?.date || "";

    await db
      .insert(notifications)
      .values({
        userId: cleanUserId!,
        reservationId: createdOccurrences[0]?.reservation?.id,
        type: "reservation_approved",
        message: `An admin booked a recurring series (${createdOccurrences.length} occurrences) for you on ${instrumentName} starting ${firstDate}.`,
      })
      .catch(() => {});

    sendPushToUser(cleanUserId!, {
      titleAr: "تم حجز سلسلة مواعيد واعتمادها لك",
      titleEn: "Recurring Series Created & Approved",
      bodyAr: `قامت إدارة الكنيسة بحجز واعتماد سلسلة (${createdOccurrences.length} مواعيد) لك لخدمة "${input.serviceName}".`,
      bodyEn: `Church administration has reserved and approved ${createdOccurrences.length} sessions for you for "${input.serviceName}".`,
      url: `/?reservationId=${createdOccurrences[0]?.reservation?.id}`,
      data: {
        seriesId: newSeries.id,
        type: "series_approved",
      },
    }).catch((e) => console.warn("[Push series error]:", e.message));
  } else if (cleanUserId) {
    const approvedCount = createdOccurrences.filter(
      (c) => c.reservation.status === "approved",
    ).length;
    const pendingCount = createdOccurrences.length - approvedCount;

    await db.insert(notifications).values({
      userId: cleanUserId,
      reservationId: createdOccurrences[0]?.reservation?.id,
      type: "series_submitted",
      message: `Your recurring series (${createdOccurrences.length} occurrences) has been created (${approvedCount} approved, ${pendingCount} pending review).`,
    });

    // If all occurrences were auto-approved, send approval email to user
    if (
      approvedCount > 0 &&
      pendingCount === 0 &&
      createdOccurrences.length > 0
    ) {
      (async () => {
        try {
          const [userInfo] = await db
            .select({ name: users.name, email: users.email })
            .from(users)
            .where(eq(users.id, cleanUserId))
            .limit(1);

          const [instInfo] = await db
            .select({ name: instruments.name })
            .from(instruments)
            .where(eq(instruments.id, instrumentId))
            .limit(1);

          const firstOcc = createdOccurrences[0];
          if (userInfo?.email) {
            await sendReservationApprovedEmail({
              email: userInfo.email,
              name: userInfo.name,
              instrumentName: instInfo?.name || "Instrument",
              musicianName: input.musicianName,
              serviceName: input.serviceName,
              reservationType,
              startTime: firstOcc.evaluation.startTimeUtc,
              endTime: firstOcc.evaluation.endTimeUtc,
              isSeries: true,
              seriesOccurrencesCount: createdOccurrences.length,
              feeSnapshot: firstOcc.reservation.feeSnapshot,
            });
          }
        } catch (mailErr) {
          console.error(
            "Error sending series auto-approved reservation email:",
            mailErr,
          );
        }
      })();
    }

    // If any occurrence is pending, broadcast to admins and notify super admin
    if (pendingCount > 0 && createdOccurrences.length > 0) {
      const [requester] = await db
        .select({ name: users.name, phoneNumber: users.phoneNumber })
        .from(users)
        .where(eq(users.id, cleanUserId))
        .limit(1);

      const [instrumentRow] = await db
        .select({ name: instruments.name })
        .from(instruments)
        .where(eq(instruments.id, instrumentId))
        .limit(1);

      const notifSettings = await getNotificationSettings();
      if (!notifSettings.muteReservationRequestEmails) {
        await sendSuperAdminNotificationEmail(
          "New Recurring Series Pending Approval - St. Mark Musicians",
          "New Recurring Series Request",
          "A recurring reservation series request is awaiting your approval.",
          [
            { label: "Requested by:", value: requester?.name || "Unknown" },
            { label: "Phone:", value: requester?.phoneNumber || "N/A" },
            { label: "Instrument:", value: instrumentRow?.name || "Unknown" },
            { label: "Musician:", value: input.musicianName },
            { label: "Service:", value: input.serviceName },
            {
              label: "Occurrences:",
              value: `${createdOccurrences.length} occurrences (${pendingCount} pending review)`,
            },
            {
              label: "Starting Date:",
              value: occurrences[0]?.date || "N/A",
            },
            {
              label: "Type:",
              value:
                reservationType === "outside_church"
                  ? "Outside Church"
                  : "In-Church",
            },
          ],
        ).catch(() => {});
      }

      const allAdmins = await db.select({ id: admins.id }).from(admins);

      let seriesMinimalMsg = `New recurring series request (${createdOccurrences.length} occurrences) from ${requester?.name || "a member"} for ${instrumentRow?.name || "an instrument"} starting ${occurrences[0]?.date}.`;
      try {
        const firstOcc = occurrences[0];
        const [sy, sm, sd] = firstOcc.date.split("-").map(Number);
        const sDateUtc = new Date(Date.UTC(sy, sm - 1, sd, 12, 0, 0));
        const sDayNames = [
          "Sunday",
          "Monday",
          "Tuesday",
          "Wednesday",
          "Thursday",
          "Friday",
          "Saturday",
        ];
        const sDayName = sDayNames[sDateUtc.getUTCDay()] || "";
        const sFormattedDate = `${sd}-${sm}-${sy}`;

        const formatTimeToClean = (timeStr: string) => {
          if (!timeStr) return "";
          const match = timeStr.match(/^(\d{1,2}):(\d{2})/);
          if (!match) return timeStr;
          let h = parseInt(match[1], 10);
          const min = match[2];
          if (h > 12) h -= 12;
          if (h === 0) h = 12;
          return `${h}:${min}`;
        };

        const sStartFmt = formatTimeToClean(firstOcc.startTime);
        const sDuration = firstOcc.duration;
        const [sh, smin] = (firstOcc.startTime || "00:00")
          .split(":")
          .map(Number);
        const sEndH = sh + (sDuration || 0);
        const sEndFmt = formatTimeToClean(
          `${sEndH}:${String(smin || 0).padStart(2, "0")}`,
        );
        const sDurStr = sDuration ? ` (${sDuration}h)` : "";

        seriesMinimalMsg = `${instrumentRow?.name || "Instrument"} (${createdOccurrences.length} sessions) on ${sDayName} ${sFormattedDate} from ${sStartFmt} to ${sEndFmt}${sDurStr}`;
      } catch {
        // fallback
      }

      for (const adm of allAdmins) {
        await db
          .insert(notifications)
          .values({
            adminId: adm.id,
            reservationId: createdOccurrences[0].reservation.id,
            type: "reservation_submitted",
            message: seriesMinimalMsg,
          })
          .catch(() => {});
      }

      // Web Push notification to admins for new recurring series (1 notification only)
      sendPushToAdmins(
        {
          titleAr: "طلب حجز متكرر جديد",
          titleEn: "New Recurring Series Request",
          bodyAr: `${requester?.name || "عضو"}: ${instrumentRow?.name || "آلة"} (${createdOccurrences.length} مواعيد)`,
          bodyEn: `${requester?.name || "A member"}: ${instrumentRow?.name || "Instrument"} (${createdOccurrences.length} dates)`,
          tag: "admin-new-requests",
          url: `/?reservationId=${createdOccurrences[0].reservation.id}`,
          data: {
            reservationId: createdOccurrences[0].reservation.id,
            seriesId: newSeries.id,
            type: "series_request",
          },
        },
        "new_requests",
      ).catch((e) =>
        console.warn("[Push series request error]:", e.message),
      );
    }
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
    serviceLocation?: string;
    musicianName?: string;
    note?: string;
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

  const isTypeRequest = Boolean(existing.isTypeRequest);
  const timeChanged = Boolean(
    updates.date || updates.startTime || updates.duration,
  );

  let start: Date;
  let end: Date;

  if (timeChanged) {
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
    const boundsRes: any = await db.execute(
      sql`SELECT lower(time_range) as start_time, upper(time_range) as end_time FROM reservations WHERE id = ${reservationId}`,
    );
    start = new Date(boundsRes.rows[0].start_time);
    end = new Date(boundsRes.rows[0].end_time);
  }

  validateWorkingHours(start, end);

  let finalInstrumentId: string | null = null;
  let newStatus: "approved" | "pending" = "pending";
  let outsideFee = existing.feeSnapshot;
  const resType = updates.reservationType || existing.reservationType;

  if (isTypeRequest) {
    if (timeChanged) {
      // Per spec:
      // "Pending type request: stays Pending after an edit."
      // "Approved type request: any change to date, time or duration returns it to Pending and removes the assigned instrument. The admin assigns again and the user is told it needs another review."
      newStatus = "pending";
      finalInstrumentId = null;
    } else {
      // Non-time edit (musician, note, etc.)
      finalInstrumentId = existing.instrumentId;
      newStatus = existing.status === "approved" ? "approved" : "pending";
    }

    if (resType === "outside_church" && existing.requestedType) {
      const typeRes = await db.execute(sql`
        SELECT flat_fee_outside FROM instrument_type_settings WHERE type ILIKE ${existing.requestedType} LIMIT 1;
      `);
      const row = (typeRes as any).rows?.[0];
      outsideFee = row?.flat_fee_outside ? String(row.flat_fee_outside) : existing.feeSnapshot;
    }
  } else {
    // Direct booking flow
    const targetInstId = updates.instrumentId || existing.instrumentId;
    if (!targetInstId) {
      throw new Error("Target instrument not specified.");
    }
    finalInstrumentId = targetInstId;

    // Check conflicts with OTHER approved reservations on this instrument
    const conflicts = await db
      .select({ id: reservations.id })
      .from(reservations)
      .where(
        sql`${reservations.instrumentId} = ${finalInstrumentId}
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

    const [instrument] = await db
      .select()
      .from(instruments)
      .where(eq(instruments.id, finalInstrumentId))
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

    if (resType === "outside_church" && !isTrustedOrAdmin) {
      newStatus = "pending";
    } else if (isTrustedOrAdmin) {
      newStatus = "approved";
    } else if (existing.status === "pending") {
      newStatus = "pending";
    } else if (existing.status === "approved") {
      if (instrument.bookingMode === "manual") {
        newStatus = "pending";
      } else {
        const limits = await getHardLimits();
        let limitExceeded = false;
        const durationHours = (end.getTime() - start.getTime()) / (3600 * 1000);

        if (durationHours > limits.maxDurationHours) limitExceeded = true;

        if (!limitExceeded && existing.userId) {
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
  }

  const cleanFee = toNullableString(outsideFee);
  const cleanServiceName =
    updates.serviceName !== undefined
      ? updates.serviceName.trim()
      : existing.serviceName;
  const cleanMusicianName =
    updates.musicianName !== undefined
      ? updates.musicianName.trim()
      : existing.musicianName;
  const cleanServiceLocation =
    updates.serviceLocation !== undefined
      ? toNullableString(updates.serviceLocation)
      : existing.serviceLocation;
  const cleanNote =
    updates.note !== undefined ? toNullableString(updates.note) : existing.note;

  if (!cleanMusicianName) {
    throw new Error("Musician name is required.");
  }

  const [updated] = await db
    .update(reservations)
    .set({
      instrumentId: finalInstrumentId,
      serviceName: cleanServiceName,
      serviceLocation: cleanServiceLocation,
      musicianName: cleanMusicianName,
      note: cleanNote,
      timeRange:
        sql`tstzrange(${start.toISOString()}, ${end.toISOString()}, '[)')` as any,
      reservationType: resType,
      feeSnapshot: cleanFee,
      status: newStatus,
      rejectionReason: null,
    })
    .where(eq(reservations.id, reservationId))
    .returning();

  if (newStatus === "approved" && finalInstrumentId) {
    await autoRejectOverlappingPending(finalInstrumentId, start, end, reservationId);
  }

  // If an approved type request was modified and returned to pending, notify user and admins
  if (isTypeRequest && existing.status === "approved" && newStatus === "pending") {
    if (existing.userId) {
      await db.insert(notifications).values({
        userId: existing.userId,
        reservationId: updated.id,
        type: "reservation_submitted",
        message:
          "Your modified type request has returned to pending review and is awaiting administrator instrument assignment.",
      });
      sendPushToUser(existing.userId, {
        titleAr: "طلب الحجز قيد المراجعة مجدداً",
        titleEn: "Type Request Pending Assignment",
        bodyAr: "تمت إعادة طلبك إلى قائمة المراجعة لتخصيص آلة جديدة بعد تعديل الموعد.",
        bodyEn: "Your modified type request returned to pending review for instrument assignment.",
        tag: `res-status-${updated.id}`,
        url: `/?reservationId=${updated.id}`,
        data: { reservationId: updated.id, status: "pending" },
      }).catch(() => {});
    }

    const allAdmins = await db.select({ id: admins.id }).from(admins);
    for (const adm of allAdmins) {
      await db.insert(notifications).values({
        adminId: adm.id,
        reservationId: updated.id,
        type: "reservation_submitted",
        message: `Member modified an approved type request (${existing.requestedType}). Returned to pending for instrument assignment.`,
      }).catch(() => {});
    }
  }

  return updated;
}

export interface EditSeriesDateShift {
  type: "none" | "days" | "weekday";
  value?: number;
}

export interface EditSeriesChanges {
  instrumentId?: string;
  startTime?: string;
  duration?: number;
  serviceName?: string;
  serviceLocation?: string;
  musicianName?: string;
  note?: string;
  reservationType?: "in_church" | "outside_church";
  feeAcknowledged?: boolean;
}

export interface EditSeriesOptions {
  changes?: EditSeriesChanges;
  dateShift?: EditSeriesDateShift;
  scope?: "future";
  occurrenceIds?: string[];
}

/**
 * Bulk edits upcoming occurrences of a recurring series (Pending or Approved)
 */
export async function editReservationSeries(
  seriesId: string,
  options: EditSeriesOptions,
  caller: { userId?: string | null; adminId?: string | null; isSuperAdmin?: boolean },
) {
  const [series] = await db
    .select()
    .from(reservationSeries)
    .where(eq(reservationSeries.id, seriesId))
    .limit(1);

  if (!series) {
    throw new Error("Reservation series not found.");
  }

  const cleanCallerAdminId = toNullableString(caller.adminId);
  const cleanCallerUserId = toNullableString(caller.userId);

  // Authorization check
  if (
    !cleanCallerAdminId &&
    (!cleanCallerUserId || series.userId !== cleanCallerUserId)
  ) {
    throw new Error("You are not authorized to edit this reservation series.");
  }

  const isAdmin = Boolean(cleanCallerAdminId);

  // Check if owner is trusted
  let isOwnerTrusted = false;
  if (series.userId) {
    const [ownerUser] = await db
      .select({ isTrusted: users.isTrusted })
      .from(users)
      .where(eq(users.id, series.userId))
      .limit(1);
    if (ownerUser?.isTrusted) isOwnerTrusted = true;
  }

  // Fetch affected future occurrences with status Pending or Approved
  const queryResult: any = await db.execute(sql`
    SELECT id, series_id, user_id, admin_id, instrument_id, service_name, service_location,
           musician_name, reservation_type, fee_snapshot, status, note, booked_by_admin,
           lower(time_range) as start_time,
           upper(time_range) as end_time,
           to_char(lower(time_range) AT TIME ZONE 'Africa/Cairo', 'YYYY-MM-DD') as occurrence_date,
           to_char(lower(time_range) AT TIME ZONE 'Africa/Cairo', 'HH24:MI') as occurrence_start_time,
           ROUND(EXTRACT(EPOCH FROM (upper(time_range) - lower(time_range))) / 3600.0, 2) as occurrence_duration
    FROM reservations
    WHERE series_id = ${seriesId}
      AND status IN ('pending', 'approved')
      AND lower(time_range) > NOW()
    ORDER BY lower(time_range) ASC
  `);

  const rawUpcomingRows = queryResult.rows || [];
  let affectedRows = rawUpcomingRows;
  if (Array.isArray(options.occurrenceIds) && options.occurrenceIds.length > 0) {
    const filterSet = new Set(options.occurrenceIds.map(String));
    affectedRows = rawUpcomingRows.filter((r: any) => filterSet.has(String(r.id)));
  }

  if (affectedRows.length === 0) {
    return {
      success: true,
      updatedCount: 0,
      statusSummary: { approved: 0, pending: 0 },
      message: "No matching upcoming occurrences to update.",
    };
  }

  const changes = options.changes || {};
  const dateShift = options.dateShift || { type: "none" };

  const targetInstrumentId = changes.instrumentId || series.instrumentId;
  const [targetInstrument] = await db
    .select()
    .from(instruments)
    .where(
      and(
        eq(instruments.id, targetInstrumentId),
        eq(instruments.isRemoved, false),
      ),
    )
    .limit(1);

  if (!targetInstrument) {
    throw new Error("Target instrument not found or has been removed.");
  }

  const now = new Date();
  const graceThreshold = new Date(now.getTime() - 2 * 60 * 1000);

  // Step 1: Compute updated dates/times and validate working hours & past dates
  const plannedOccurrences = affectedRows.map((occ: any, idx: number) => {
    let newDate = occ.occurrence_date;
    if (dateShift.type === "days" && typeof dateShift.value === "number") {
      newDate = addDaysToDateString(occ.occurrence_date, dateShift.value);
    } else if (dateShift.type === "weekday" && typeof dateShift.value === "number") {
      newDate = shiftDateToWeekday(occ.occurrence_date, dateShift.value);
    }

    const newStartTime =
      changes.startTime !== undefined
        ? changes.startTime
        : occ.occurrence_start_time;
    const newDuration =
      changes.duration !== undefined
        ? Number(changes.duration)
        : Number(occ.occurrence_duration);
    const newInstrumentId = changes.instrumentId || occ.instrument_id;
    const newServiceName =
      changes.serviceName !== undefined
        ? changes.serviceName.trim()
        : occ.service_name;
    const newMusicianName =
      changes.musicianName !== undefined
        ? changes.musicianName.trim()
        : occ.musician_name;
    const newServiceLocation =
      changes.serviceLocation !== undefined
        ? toNullableString(changes.serviceLocation)
        : occ.service_location;
    const newNote =
      changes.note !== undefined
        ? toNullableString(changes.note)
        : occ.note;
    const newReservationType =
      changes.reservationType || occ.reservation_type;

    if (!newMusicianName) {
      throw new Error("Musician name is required.");
    }
    if (!newServiceName) {
      throw new Error("Service name is required.");
    }

    const { start, end, timeRangeSqlString } = buildTimeRange(
      newDate,
      newStartTime,
      newDuration,
    );

    if (start < graceThreshold) {
      throw new Error(
        `Shifted date (${newDate} ${newStartTime}) cannot be in the past.`,
      );
    }

    try {
      validateWorkingHours(start, end);
    } catch (err: any) {
      throw new Error(
        `Occurrence #${idx + 1} (${newDate} ${newStartTime}): ${err.message}`,
      );
    }

    return {
      id: occ.id,
      oldDate: occ.occurrence_date,
      oldStartTime: occ.occurrence_start_time,
      oldDuration: Number(occ.occurrence_duration),
      currentStatus: occ.status,
      currentFeeSnapshot: occ.fee_snapshot,
      currentInstrumentId: occ.instrument_id,
      newDate,
      newStartTime,
      newDuration,
      newInstrumentId,
      newServiceName,
      newMusicianName,
      newServiceLocation,
      newNote,
      newReservationType,
      start,
      end,
      timeRangeSqlString,
      index: idx + 1,
    };
  });

  // Step 2: Self-overlap check between occurrences in the series
  for (let i = 0; i < plannedOccurrences.length; i++) {
    for (let j = i + 1; j < plannedOccurrences.length; j++) {
      const a = plannedOccurrences[i];
      const b = plannedOccurrences[j];
      if (
        a.newInstrumentId === b.newInstrumentId &&
        a.start < b.end &&
        b.start < a.end
      ) {
        throw new Error(
          `Self-overlap detected: Occurrence #${a.index} (${a.newDate} ${a.newStartTime}) overlaps with Occurrence #${b.index} (${b.newDate} ${b.newStartTime}).`,
        );
      }
    }
  }

  // Step 3: Conflict check against existing approved reservations on target instrument(s)
  // excluding all occurrences of this series!
  const allAffectedIds = plannedOccurrences.map((p) => p.id);
  const conflictingOccurrences: any[] = [];

  for (const p of plannedOccurrences) {
    const conflicts = await db
      .select({ id: reservations.id, timeRange: reservations.timeRange })
      .from(reservations)
      .where(
        sql`${reservations.instrumentId} = ${p.newInstrumentId}
          AND ${reservations.status} = 'approved'
          AND ${reservations.id} NOT IN (${sql.join(allAffectedIds.map((id) => sql`${id}`), sql`, `)})
          AND ${reservations.timeRange} && tstzrange(${p.start.toISOString()}, ${p.end.toISOString()}, '[)')`,
      );

    if (conflicts.length > 0) {
      conflictingOccurrences.push({
        occurrenceIndex: p.index,
        occurrenceDate: p.newDate,
        occurrenceTime: p.newStartTime,
        duration: p.newDuration,
        conflictingReservationId: conflicts[0].id,
      });
    }
  }

  if (conflictingOccurrences.length > 0) {
    const conflictDescriptions = conflictingOccurrences.map(
      (c) => `${c.occurrenceDate} at ${c.occurrenceTime}`,
    );
    const error: any = new Error(
      `Series has ${conflictingOccurrences.length} occurrence(s) conflicting with existing approved reservations: ${conflictDescriptions.join(", ")}.`,
    );
    error.conflicts = conflictingOccurrences;
    throw error;
  }

  // Step 4: Evaluate status and fees per occurrence
  const limits = await getHardLimits();
  let approvedCount = 0;
  let pendingCount = 0;

  const evaluatedOccurrences = plannedOccurrences.map((p) => {
    const instrumentChanged = p.newInstrumentId !== p.currentInstrumentId;
    let feeSnapshot = p.currentFeeSnapshot;

    if (p.newReservationType === "outside_church") {
      if (instrumentChanged || !p.currentFeeSnapshot) {
        feeSnapshot = targetInstrument.outsideFeePerDay
          ? String(targetInstrument.outsideFeePerDay)
          : "0.00";
      }
    } else {
      feeSnapshot = null;
    }

    let newStatus: "approved" | "pending" = "pending";

    if (isAdmin) {
      // Admin editor:
      // Occurrences that were Approved remain Approved; occurrences that were Pending remain Pending.
      newStatus = p.currentStatus === "approved" ? "approved" : "pending";
    } else if (isOwnerTrusted) {
      newStatus = "approved";
    } else if (p.currentStatus === "pending") {
      newStatus = "pending";
    } else {
      // Regular user, currentStatus was 'approved':
      if (p.newReservationType === "outside_church") {
        newStatus = "pending";
      } else if (
        targetInstrument.bookingMode === "manual" ||
        (instrumentChanged && targetInstrument.bookingMode === "manual")
      ) {
        newStatus = "pending";
      } else if (p.newDuration > limits.maxDurationHours) {
        newStatus = "pending";
      } else {
        newStatus = "approved";
      }
    }

    if (newStatus === "approved") {
      approvedCount++;
    } else {
      pendingCount++;
    }

    return {
      ...p,
      newStatus,
      feeSnapshot,
    };
  });

  // Step 5: Execute atomic transaction
  try {
    await db.transaction(async (tx) => {
      // Update parent reservation_series row if needed (when editing all upcoming occurrences)
      if (!options.occurrenceIds || options.occurrenceIds.length >= rawUpcomingRows.length) {
        await tx
          .update(reservationSeries)
          .set({
            instrumentId: targetInstrumentId,
            serviceLocation:
              changes.serviceLocation !== undefined
                ? toNullableString(changes.serviceLocation)
                : series.serviceLocation,
            note:
              changes.note !== undefined
                ? toNullableString(changes.note)
                : series.note,
          })
          .where(eq(reservationSeries.id, seriesId));
      }

      // Update each occurrence
      for (const occ of evaluatedOccurrences) {
        await tx
          .update(reservations)
          .set({
            instrumentId: occ.newInstrumentId,
            serviceName: occ.newServiceName,
            serviceLocation: occ.newServiceLocation,
            musicianName: occ.newMusicianName,
            note: occ.newNote,
            timeRange:
              sql`tstzrange(${occ.start.toISOString()}, ${occ.end.toISOString()}, '[)')` as any,
            reservationType: occ.newReservationType,
            feeSnapshot: occ.feeSnapshot,
            status: occ.newStatus,
            rejectionReason: null,
          })
          .where(eq(reservations.id, occ.id));
      }
    });
  } catch (err: any) {
    if (
      String(err.message).includes("exclusion") ||
      String(err.message).includes("conflict") ||
      String(err.code) === "23P01"
    ) {
      const conflictErr: any = new Error(
        "One or more time slots conflict with an existing approved reservation.",
      );
      conflictErr.conflicts = [
        { message: "Database exclusion constraint violation" },
      ];
      throw conflictErr;
    }
    throw err;
  }

  // Step 6: Post-transaction cleanup: auto-reject overlapping pending reservations for re-approved slots
  for (const occ of evaluatedOccurrences) {
    if (occ.newStatus === "approved") {
      await autoRejectOverlappingPending(
        occ.newInstrumentId,
        occ.start,
        occ.end,
        occ.id,
      ).catch(() => {});
    }
  }

  // Step 7: Notifications
  if (isAdmin && series.userId) {
    // Notify owner user of admin edit
    const summaryMsg = `Church Administration updated your recurring series (${evaluatedOccurrences.length} upcoming occurrences updated).`;
    await db
      .insert(notifications)
      .values({
        userId: series.userId,
        reservationId: evaluatedOccurrences[0]?.id,
        type: "series_updated",
        message: summaryMsg,
      })
      .catch(() => {});

    sendPushToUser(series.userId, {
      titleAr: "تم تعديل سلسلتك المتكررة بواسطة الإدارة",
      titleEn: "Recurring Series Updated by Administration",
      bodyAr: `تم تحديث ${evaluatedOccurrences.length} مواعيد قادمة في سلسلة "${changes.serviceName || series.note || "الخدمة"}".`,
      bodyEn: `Administration updated ${evaluatedOccurrences.length} upcoming dates in your series.`,
      url: `/?reservationId=${evaluatedOccurrences[0]?.id}`,
      data: { seriesId, type: "series_updated" },
    }).catch(() => {});
  } else if (!isAdmin && pendingCount > 0) {
    // Notify admins of re-pended occurrences (ONE summary notification)
    const allAdmins = await db.select({ id: admins.id }).from(admins);
    const summaryMsg = `Member updated a recurring series (${evaluatedOccurrences.length} occurrences, ${pendingCount} returned to pending review).`;
    for (const adm of allAdmins) {
      await db
        .insert(notifications)
        .values({
          adminId: adm.id,
          reservationId: evaluatedOccurrences[0]?.id,
          type: "series_updated",
          message: summaryMsg,
        })
        .catch(() => {});
    }
    sendPushToAdmins(
      {
        titleAr: "تحديث سلسلة حجوزات تتطلب مراجعة",
        titleEn: "Recurring Series Updated",
        bodyAr: `قام عضو بتعديل سلسلة: ${pendingCount} مواعيد عادت بانتظار الاعتماد.`,
        bodyEn: `A member updated a series: ${pendingCount} dates returned to pending review.`,
        url: `/?reservationId=${evaluatedOccurrences[0]?.id}`,
        data: { seriesId, type: "series_updated" },
      },
      "new_requests",
    ).catch(() => {});
  }

  return {
    success: true,
    updatedCount: evaluatedOccurrences.length,
    statusSummary: {
      approved: approvedCount,
      pending: pendingCount,
    },
  };
}

/**
 * =========================================================================
 * 4. CANCELLATION LOGIC
 * =========================================================================
 */
export async function cancelReservation(
  reservationId: string,
  options: {
    cancelMode?: "single" | "series";
    cancellationReason?: string | null;
  },
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

  // Terminal state check: gracefully skip reservations already completed or cancelled
  if (target.status === "completed" || target.status === "cancelled") {
    return { mode: "single", reservation: target, skipped: true };
  }

  // cancellation_reason only applies to admin-initiated cancellations
  const cleanReason = cleanCallerAdminId
    ? toNullableString(options.cancellationReason)
    : null;
  const bellMessage = cleanReason
    ? `Reservation cancelled — ${cleanReason}`
    : "Reservation cancelled";

  if (options.cancelMode === "series" && target.seriesId) {
    // Cancel all active/pending/approved occurrences in this series
    const cancelled = await db
      .update(reservations)
      .set({ status: "cancelled", cancellationReason: cleanReason })
      .where(
        and(
          eq(reservations.seriesId, target.seriesId),
          inArray(reservations.status, ["pending", "approved", "ongoing"]),
        ),
      )
      .returning();

    if (cleanCallerAdminId) {
      const userIds = Array.from(
        new Set(cancelled.map((r) => r.userId).filter(Boolean)),
      );
      for (const uid of userIds) {
        if (uid !== cleanCallerAdminId) {
          await db.insert(notifications).values({
            userId: uid as string,
            type: "reservation_cancelled",
            message: bellMessage,
          });

          sendPushToUser(uid as string, {
            titleAr: "تم إلغاء السلسلة بواسطة الإدارة",
            titleEn: "Series Cancelled by Administration",
            bodyAr: cleanReason
              ? `تم إلغاء حجز سلسلتك المتكررة — السبب: ${cleanReason}`
              : "تم إلغاء حجز سلسلتك المتكررة بواسطة إدارة الكنيسة.",
            bodyEn: cleanReason
              ? `Your recurring series was cancelled — Reason: ${cleanReason}`
              : "Your recurring series was cancelled by administration.",
            tag: `series-status-${target.seriesId}`,
            url: `/?reservationId=${cancelled[0]?.id || ""}`,
            data: { seriesId: target.seriesId, status: "cancelled" },
          }).catch((e) =>
            console.warn("[Push series cancel error]:", e.message),
          );
        }
      }
    }

    return {
      mode: "series",
      cancelledCount: cancelled.length,
      reservations: cancelled,
    };
  }

  // Cancel single occurrence
  const [cancelled] = await db
    .update(reservations)
    .set({ status: "cancelled", cancellationReason: cleanReason })
    .where(eq(reservations.id, reservationId))
    .returning();

  if (cleanCallerAdminId && cancelled.userId && cancelled.userId !== cleanCallerAdminId) {
    await db.insert(notifications).values({
      userId: cancelled.userId,
      reservationId: cancelled.id,
      type: "reservation_cancelled",
      message: bellMessage,
    });

    sendPushToUser(cancelled.userId, {
      titleAr: "تم إلغاء الحجز بواسطة الإدارة",
      titleEn: "Reservation Cancelled by Administration",
      bodyAr: cleanReason
        ? `تم إلغاء حجز "${cancelled.serviceName}" — السبب: ${cleanReason}`
        : `تم إلغاء حجز "${cancelled.serviceName}" بواسطة إدارة الكنيسة.`,
      bodyEn: cleanReason
        ? `Your reservation for "${cancelled.serviceName}" was cancelled — Reason: ${cleanReason}`
        : `Your reservation for "${cancelled.serviceName}" was cancelled by administration.`,
      tag: `res-status-${cancelled.id}`,
      url: `/?reservationId=${cancelled.id}`,
      data: { reservationId: cancelled.id, status: "cancelled" },
    }).catch((e) =>
      console.warn("[Push single cancel error]:", e.message),
    );
  }

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
  options?: {
    skipEmail?: boolean;
    assignInstrumentId?: string;
    serviceLocation?: string;
  },
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

  const targetInstrumentId = options?.assignInstrumentId || res.instrumentId;

  // Check if conflict exists on the target instrument
  const conflicts = await db
    .select({
      id: reservations.id,
      serviceName: reservations.serviceName,
      musicianName: reservations.musicianName,
      timeRange: reservations.timeRange,
    })
    .from(reservations)
    .where(
      sql`${reservations.instrumentId} = ${targetInstrumentId}
        AND ${reservations.id} != ${reservationId}
        AND ${reservations.status} = 'approved'
        AND ${reservations.timeRange} && tstzrange(${start.toISOString()}, ${end.toISOString()}, '[)')`,
    )
    .limit(1);

  if (conflicts.length > 0) {
    const [instInfo] = await db
      .select({ name: instruments.name })
      .from(instruments)
      .where(eq(instruments.id, targetInstrumentId))
      .limit(1);
    const instName = instInfo?.name || "Selected instrument";
    throw new Error(
      `Conflict detected: "${instName}" is already approved for another reservation ("${conflicts[0].serviceName}") during this time slot.`,
    );
  }

  const cleanAdminId = toNullableString(adminId);

  const updateFields: any = {
    instrumentId: targetInstrumentId,
    status: "approved",
    rejectionReason: null,
    adminId: cleanAdminId,
  };

  if (options?.serviceLocation !== undefined) {
    updateFields.serviceLocation = toNullableString(options.serviceLocation);
  }

  const [approved] = await db
    .update(reservations)
    .set(updateFields)
    .where(eq(reservations.id, reservationId))
    .returning();

  // Auto-reject other pending overlapping on target instrument
  await autoRejectOverlappingPending(
    targetInstrumentId,
    start,
    end,
    reservationId,
  );

  // Fetch final instrument info
  const [instInfo] = await db
    .select({
      name: instruments.name,
      type: instruments.type,
      isRemoved: instruments.isRemoved,
      isReservePool: instruments.isReservePool,
    })
    .from(instruments)
    .where(eq(instruments.id, targetInstrumentId))
    .limit(1);

  const finalInstName = instInfo?.name || "Instrument";
  const userVisibleInstName = finalInstName;

  // Notify user in-app
  if (res.userId) {
    const isReallocated = targetInstrumentId !== res.instrumentId;
    const approvalNotice = isReallocated
      ? `Your reservation for "${res.serviceName}" has been approved! The church administration has allocated "${userVisibleInstName}" for your service.`
      : `Your reservation for "${res.serviceName}" (${userVisibleInstName}) has been approved by an administrator.`;

    await db.insert(notifications).values({
      userId: res.userId,
      reservationId: res.id,
      type: "reservation_approved",
      message: approvalNotice,
    });

    if (!options?.skipEmail && res.userId !== cleanAdminId) {
      sendPushToUser(res.userId, {
        titleAr: "تمت الموافقة على حجزك! 🎉",
        titleEn: "Your reservation has been approved! 🎉",
        bodyAr: `تم قبول حجز "${res.serviceName}" (${userVisibleInstName}).`,
        bodyEn: `Your reservation for "${res.serviceName}" (${userVisibleInstName}) has been approved.`,
        tag: `res-status-${res.id}`,
        url: `/?reservationId=${res.id}`,
        data: { reservationId: res.id, status: "approved" },
      }).catch((e) =>
        console.warn("[Push single approve error]:", e.message),
      );
    }

    // Send transactional email (non-blocking) unless skipped (e.g. during series approval)
    if (!options?.skipEmail) {
      (async () => {
        try {
          const [userInfo] = await db
            .select({ name: users.name, email: users.email })
            .from(users)
            .where(eq(users.id, res.userId!))
            .limit(1);

          if (userInfo?.email) {
            await sendReservationApprovedEmail({
              email: userInfo.email,
              name: userInfo.name,
              instrumentName: userVisibleInstName,
              musicianName: res.musicianName,
              serviceName: res.serviceName,
              reservationType: res.reservationType,
              startTime: start,
              endTime: end,
              isSeries: Boolean(res.seriesId),
              feeSnapshot: res.feeSnapshot,
            });
          }
        } catch (mailErr) {
          console.error("Error sending reservation approval email:", mailErr);
        }
      })();
    }
  }

  return approved;
}

/**
 * Transform a reservation into a Full Day reservation (09:00 - 22:00 Cairo time)
 * Can transform a pending or approved reservation into a full day booking.
 * Exclusively available to administrators. Auto-approves and auto-rejects any overlapping pending requests.
 */
export async function adminTransformToFullDay(
  reservationId: string,
  adminId?: string | null,
  options?: { skipEmail?: boolean },
) {
  const [res] = await db
    .select()
    .from(reservations)
    .where(eq(reservations.id, reservationId))
    .limit(1);

  if (!res) throw new Error("Reservation not found.");

  if (res.status === "cancelled" || res.status === "rejected") {
    throw new Error(
      "Cannot transform a cancelled or rejected reservation to full day.",
    );
  }

  // Extract date of current reservation
  const boundsRes: any = await db.execute(
    sql`SELECT lower(time_range) as start_time, upper(time_range) as end_time FROM reservations WHERE id = ${reservationId}`,
  );
  if (!boundsRes.rows || boundsRes.rows.length === 0) {
    throw new Error("Could not determine reservation time boundaries.");
  }
  const currentStart = new Date(boundsRes.rows[0].start_time);
  const dateStr = getCairoDateString(currentStart);

  // Full day window: 09:00 to 22:00 Cairo time (13 hours)
  const fullDayStart = cairoDateTimeToDate(dateStr, "09:00");
  const fullDayEnd = cairoDateTimeToDate(dateStr, "22:00");

  // Conflict check: check if any OTHER approved reservation exists for this instrument on this day
  const conflicts = await db
    .select({
      id: reservations.id,
      serviceName: reservations.serviceName,
      musicianName: reservations.musicianName,
    })
    .from(reservations)
    .where(
      sql`${reservations.instrumentId} = ${res.instrumentId}
        AND ${reservations.id} != ${reservationId}
        AND ${reservations.status} = 'approved'
        AND ${reservations.timeRange} && tstzrange(${fullDayStart.toISOString()}, ${fullDayEnd.toISOString()}, '[)')`,
    );

  if (conflicts.length > 0) {
    const conflictNames = conflicts
      .map((c) => `"${c.serviceName}" (${c.musicianName || "Musician"})`)
      .join(", ");
    throw new Error(
      `Cannot transform to full day: another approved reservation (${conflictNames}) already exists on ${dateStr} for this instrument.`,
    );
  }

  const cleanAdminId = toNullableString(adminId);

  // If outside church, ensure fee is set to full day fee
  let outsideFee = res.feeSnapshot;
  if (res.reservationType === "outside_church") {
    const [inst] = await db
      .select({ outsideFeePerDay: instruments.outsideFeePerDay })
      .from(instruments)
      .where(eq(instruments.id, res.instrumentId))
      .limit(1);
    if (inst?.outsideFeePerDay) {
      outsideFee = inst.outsideFeePerDay;
    }
  }

  const [transformed] = await db
    .update(reservations)
    .set({
      timeRange:
        sql`tstzrange(${fullDayStart.toISOString()}, ${fullDayEnd.toISOString()}, '[)')` as any,
      status: "approved",
      rejectionReason: null,
      adminId: cleanAdminId || res.adminId,
      feeSnapshot: outsideFee,
    })
    .where(eq(reservations.id, reservationId))
    .returning();

  // Auto-reject any overlapping pending requests on this day
  await autoRejectOverlappingPending(
    res.instrumentId,
    fullDayStart,
    fullDayEnd,
    reservationId,
  );

  // Send admin note message in conversation thread
  try {
    await db.insert(messages).values({
      reservationId,
      adminId: cleanAdminId,
      senderRole: "admin",
      senderName: "Church Administration",
      content:
        "Reservation has been transformed to a Full Day booking (09:00 AM – 10:00 PM) by church administration.",
      isRead: false,
    });
  } catch (msgErr) {
    console.warn("Could not insert transform system message:", msgErr);
  }

  // Notify user in-app
  if (res.userId) {
    await db.insert(notifications).values({
      userId: res.userId,
      reservationId: res.id,
      type: "reservation_approved",
      message: `Your reservation for "${res.serviceName}" on ${dateStr} has been transformed to a Full Day booking (09:00 AM – 10:00 PM) and approved by administration.`,
    });

    if (res.userId !== cleanAdminId) {
      sendPushToUser(res.userId, {
        titleAr: "تعديل الموعد ليوم كامل 📅",
        titleEn: "Reservation Transformed to Full Day! 📅",
        bodyAr: `تم تعديل حجز "${res.serviceName}" يوم ${dateStr} ليوم كامل (٩ ص - ١٠ م) والموافقة عليه.`,
        bodyEn: `Your reservation for "${res.serviceName}" on ${dateStr} was transformed to a Full Day slot (9 AM - 10 PM) and approved.`,
        tag: `res-status-${res.id}`,
        url: `/?reservationId=${res.id}`,
        data: { reservationId: res.id, status: "approved" },
      }).catch((e) =>
        console.warn("[Push full day error]:", e.message),
      );
    }

    if (!options?.skipEmail) {
      (async () => {
        try {
          const [userInfo] = await db
            .select({ name: users.name, email: users.email })
            .from(users)
            .where(eq(users.id, res.userId!))
            .limit(1);

          const [instInfo] = await db
            .select({ name: instruments.name })
            .from(instruments)
            .where(eq(instruments.id, res.instrumentId))
            .limit(1);

          if (userInfo?.email) {
            await sendReservationApprovedEmail({
              email: userInfo.email,
              name: userInfo.name,
              instrumentName: instInfo?.name || "Instrument",
              musicianName: res.musicianName,
              serviceName: `${res.serviceName} (Full Day Booking)`,
              startTime: fullDayStart,
              endTime: fullDayEnd,
              reservationType: res.reservationType,
              feeSnapshot: outsideFee,
            });
          }
        } catch (mailErr) {
          console.error(
            "Failed to send full-day transformed approval email:",
            mailErr,
          );
        }
      })().catch(() => {});
    }
  }

  return transformed;
}

export async function adminRejectReservation(
  reservationId: string,
  reason: string,
  adminId?: string | null,
  options?: { skipEmail?: boolean },
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

    if (res.userId !== cleanAdminId) {
      sendPushToUser(res.userId, {
        titleAr: "تنبيه بشأن طلب حجزك",
        titleEn: "Update on your reservation request",
        bodyAr: `تعذر قبول حجز "${res.serviceName}" — السبب: ${reason.trim()}`,
        bodyEn: `Your reservation for "${res.serviceName}" was not approved — Reason: ${reason.trim()}`,
        tag: `res-status-${res.id}`,
        url: `/?reservationId=${res.id}`,
        data: { reservationId: res.id, status: "rejected" },
      }).catch((e) =>
        console.warn("[Push single reject error]:", e.message),
      );
    }

    // Also record the rejection reason as an admin message in the conversation thread
    try {
      let adminName = "Church Administrator";
      if (cleanAdminId) {
        const [adm] = await db
          .select({ name: admins.name })
          .from(admins)
          .where(eq(admins.id, cleanAdminId))
          .limit(1);
        if (adm?.name) adminName = adm.name;
      }
      await db.insert(messages).values({
        reservationId: res.id,
        adminId: cleanAdminId,
        senderRole: "admin",
        senderName: adminName,
        content: `Rejection notice: ${reason.trim()}`,
        isRead: false,
      });
    } catch (msgErr: any) {
      console.warn("[Rejection message thread err]:", msgErr.message);
    }

    // Send rejection email (non-blocking)
    if (!options?.skipEmail) {
      (async () => {
        try {
          const boundsRes: any = await db.execute(
            sql`SELECT lower(time_range) as start_time, upper(time_range) as end_time FROM reservations WHERE id = ${reservationId}`,
          );
          const start = boundsRes.rows?.[0]?.start_time
            ? new Date(boundsRes.rows[0].start_time)
            : null;
          const end = boundsRes.rows?.[0]?.end_time
            ? new Date(boundsRes.rows[0].end_time)
            : null;

          const [userInfo] = await db
            .select({ name: users.name, email: users.email })
            .from(users)
            .where(eq(users.id, res.userId!))
            .limit(1);

          const [instInfo] = await db
            .select({ name: instruments.name })
            .from(instruments)
            .where(eq(instruments.id, res.instrumentId))
            .limit(1);

          if (userInfo?.email) {
            await sendReservationRejectedEmail({
              email: userInfo.email,
              name: userInfo.name,
              instrumentName: instInfo?.name || "Instrument",
              musicianName: res.musicianName,
              serviceName: res.serviceName,
              reservationType: res.reservationType,
              startTime: start,
              endTime: end,
              rejectionReason: reason.trim(),
              isSeries: Boolean(res.seriesId),
            });
          }
        } catch (mailErr) {
          console.error("Error sending reservation rejection email:", mailErr);
        }
      })();
    }
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
      const app = await adminApproveReservation(occ.id, cleanAdminId, {
        skipEmail: true,
      });
      approvedList.push(app);
    } catch (e: any) {
      console.warn(
        `Could not approve occurrence ${occ.id} in series:`,
        e.message,
      );
    }
  }

  // Send ONE consolidated approval email and Web Push for the recurring series
  if (approvedList.length > 0 && pendingOccurrences[0]?.userId) {
    const firstOcc = pendingOccurrences[0];
    if (firstOcc.userId !== cleanAdminId) {
      sendPushToUser(firstOcc.userId!, {
        titleAr: "تمت الموافقة على سلسلتك المتكررة! 🎉",
        titleEn: "Your recurring series has been approved! 🎉",
        bodyAr: `تم قبول حجز "${firstOcc.serviceName}" (${approvedList.length} مواعيد).`,
        bodyEn: `Your series for "${firstOcc.serviceName}" (${approvedList.length} dates) has been approved.`,
        tag: `series-status-${seriesId}`,
        url: `/?reservationId=${firstOcc.id}`,
        data: { reservationId: firstOcc.id, seriesId, status: "approved" },
      }).catch((e) =>
        console.warn("[Push series approve error]:", e.message),
      );
    }

    (async () => {
      try {
        const firstOcc = pendingOccurrences[0];
        const [userInfo] = await db
          .select({ name: users.name, email: users.email })
          .from(users)
          .where(eq(users.id, firstOcc.userId!))
          .limit(1);

        const [instInfo] = await db
          .select({ name: instruments.name })
          .from(instruments)
          .where(eq(instruments.id, firstOcc.instrumentId))
          .limit(1);

        const boundsRes: any = await db.execute(
          sql`SELECT lower(time_range) as start_time, upper(time_range) as end_time FROM reservations WHERE id = ${firstOcc.id}`,
        );
        const start = boundsRes.rows?.[0]?.start_time
          ? new Date(boundsRes.rows[0].start_time)
          : null;
        const end = boundsRes.rows?.[0]?.end_time
          ? new Date(boundsRes.rows[0].end_time)
          : null;

        if (userInfo?.email) {
          await sendReservationApprovedEmail({
            email: userInfo.email,
            name: userInfo.name,
            instrumentName: instInfo?.name || "Instrument",
            musicianName: firstOcc.musicianName,
            serviceName: firstOcc.serviceName,
            reservationType: firstOcc.reservationType,
            startTime: start,
            endTime: end,
            isSeries: true,
            seriesOccurrencesCount: approvedList.length,
            feeSnapshot: firstOcc.feeSnapshot,
          });
        }
      } catch (mailErr) {
        console.error("Error sending series approval email:", mailErr);
      }
    })();
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

  // Notify user in-app
  const userId = seriesOccurrences[0]?.userId;
  if (userId) {
    await db.insert(notifications).values({
      userId,
      type: "series_rejected",
      message: `Your recurring series was rejected by an administrator. Reason: ${reason.trim()}`,
    });

    if (userId !== cleanAdminId) {
      sendPushToUser(userId, {
        titleAr: "تنبيه بشأن سلسلتك المتكررة",
        titleEn: "Update on your recurring series",
        bodyAr: `تم رفض السلسلة المتكررة (${seriesOccurrences.length} مواعيد) — السبب: ${reason.trim()}`,
        bodyEn: `Your recurring series (${seriesOccurrences.length} dates) was rejected — Reason: ${reason.trim()}`,
        tag: `series-status-${seriesId}`,
        url: `/?reservationId=${seriesOccurrences[0]?.id || ""}`,
        data: { seriesId, status: "rejected" },
      }).catch((e) =>
        console.warn("[Push series reject error]:", e.message),
      );
    }

    // Also record the rejection reason as an admin message in the conversation thread for each occurrence
    try {
      let adminName = "Church Administrator";
      if (cleanAdminId) {
        const [adm] = await db
          .select({ name: admins.name })
          .from(admins)
          .where(eq(admins.id, cleanAdminId))
          .limit(1);
        if (adm?.name) adminName = adm.name;
      }
      for (const occ of rejectedList) {
        await db.insert(messages).values({
          reservationId: occ.id,
          adminId: cleanAdminId,
          senderRole: "admin",
          senderName: adminName,
          content: `Series rejection notice: ${reason.trim()}`,
          isRead: false,
        });
      }
    } catch (msgErr: any) {
      console.warn("[Series rejection message thread err]:", msgErr.message);
    }

    // Send ONE consolidated rejection email for the series
    (async () => {
      try {
        const firstOcc = seriesOccurrences[0];
        const [userInfo] = await db
          .select({ name: users.name, email: users.email })
          .from(users)
          .where(eq(users.id, userId))
          .limit(1);

        const [instInfo] = await db
          .select({ name: instruments.name })
          .from(instruments)
          .where(eq(instruments.id, firstOcc.instrumentId))
          .limit(1);

        const boundsRes: any = await db.execute(
          sql`SELECT lower(time_range) as start_time, upper(time_range) as end_time FROM reservations WHERE id = ${firstOcc.id}`,
        );
        const start = boundsRes.rows?.[0]?.start_time
          ? new Date(boundsRes.rows[0].start_time)
          : null;
        const end = boundsRes.rows?.[0]?.end_time
          ? new Date(boundsRes.rows[0].end_time)
          : null;

        if (userInfo?.email) {
          await sendReservationRejectedEmail({
            email: userInfo.email,
            name: userInfo.name,
            instrumentName: instInfo?.name || "Instrument",
            musicianName: firstOcc.musicianName,
            serviceName: firstOcc.serviceName,
            reservationType: firstOcc.reservationType,
            startTime: start,
            endTime: end,
            rejectionReason: reason.trim(),
            isSeries: true,
            seriesOccurrencesCount: rejectedList.length,
          });
        }
      } catch (mailErr) {
        console.error("Error sending series rejection email:", mailErr);
      }
    })();
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

    sendPushToUser(uid as string, {
      titleAr: "تنبيه بشأن طلبات الحجز",
      titleEn: "Update on reservation requests",
      bodyAr: `تم رفض طلبات الحجز بواسطة الإدارة — السبب: ${reason.trim()}`,
      bodyEn: `Your reservation request(s) were rejected — Reason: ${reason.trim()}`,
      tag: `bulk-reject-${Date.now()}`,
      url: "/?view=my_reservations",
      data: { status: "rejected" },
    }).catch((e) =>
      console.warn("[Push bulk reject error]:", e.message),
    );
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
  cancellationReason?: string | null,
) {
  if (!Array.isArray(reservationIds) || reservationIds.length === 0) {
    throw new Error("No reservation IDs provided for bulk cancellation.");
  }

  const cleanAdminId = toNullableString(adminId);
  const cancelled: any[] = [];
  const skipped: any[] = [];
  const errors: { id: string; error: string }[] = [];

  for (const id of reservationIds) {
    try {
      const result = await cancelReservation(
        id,
        { cancelMode: "single", cancellationReason },
        { adminId: cleanAdminId || undefined },
      );
      if ((result as any)?.skipped) {
        skipped.push(result.reservation);
      } else {
        cancelled.push(result.reservation || result);
      }
    } catch (err: any) {
      errors.push({ id, error: err.message });
    }
  }

  return {
    success: true,
    totalRequested: reservationIds.length,
    cancelledCount: cancelled.length,
    skippedCount: skipped.length,
    cancelled,
    skipped,
    errors,
  };
}

/**
 * Window in hours after a reservation's end time during which an administrator can mark it as No-Show.
 * Default: 48 hours.
 */
export const NO_SHOW_WINDOW_HOURS = 48;

/**
 * =========================================================================
 * 6. STATUS TRANSITIONS (Scheduled Check / Background Job / Lazy-on-read)
 * =========================================================================
 */
export async function ensureCurrentReservationStatuses() {
  // 0. Auto-reject unassigned type requests whose start time has arrived
  // Spec: "If nobody assigns an instrument before the start time, the request is automatically rejected with the reason 'Not assigned before the start time', and the user is notified. For a series, only the dates already in the past are affected."
  const unassignedTypeReqs = await db.execute(sql`
    UPDATE reservations
    SET status = 'rejected',
        rejection_reason = 'Not assigned before the start time'
    WHERE status = 'pending'
      AND is_type_request = true
      AND lower(time_range) <= NOW()
    RETURNING id, user_id, service_name, requested_type;
  `);

  const rejectedTypeRows = (unassignedTypeReqs as any).rows || [];
  for (const row of rejectedTypeRows) {
    if (row.user_id) {
      await db
        .insert(notifications)
        .values({
          userId: row.user_id,
          reservationId: row.id,
          type: "reservation_rejected",
          message: `Your request for a ${row.requested_type || "instrument"} was not assigned before the start time and has been cancelled.`,
        })
        .catch(() => {});

      sendPushToUser(row.user_id, {
        titleAr: "تعذر تخصيص آلة لطلبك",
        titleEn: "Type Request Not Assigned",
        bodyAr: `لم يتم تخصيص آلة لطلب "${row.service_name || row.requested_type}" قبل موعد البدء وتم إلغاؤه تلقائياً.`,
        bodyEn: `Your request for "${row.service_name || row.requested_type}" was not assigned before the start time.`,
        tag: `res-status-${row.id}`,
        url: `/?reservationId=${row.id}`,
        data: { reservationId: row.id, status: "rejected" },
      }).catch(() => {});
    }
  }

  // 1. Expired: A regular pending direct reservation whose start datetime has passed transitions to Expired
  const toExpiredRes = await db.execute(sql`
    UPDATE reservations
    SET status = 'expired'
    WHERE status = 'pending'
      AND (is_type_request = false OR is_type_request IS NULL)
      AND lower(time_range) <= NOW()
    RETURNING id;
  `);

  // 2. Ongoing: Approved reservations whose start time has arrived and end time is in future
  const toOngoingRes = await db.execute(sql`
    UPDATE reservations
    SET status = 'ongoing'
    WHERE status = 'approved'
      AND lower(time_range) <= NOW()
      AND upper(time_range) > NOW()
    RETURNING id;
  `);

  // 3. Completed: Ongoing or approved reservations whose end time has passed
  const toCompletedRes = await db.execute(sql`
    UPDATE reservations
    SET status = 'completed'
    WHERE status IN ('ongoing', 'approved')
      AND upper(time_range) <= NOW()
    RETURNING id;
  `);

  const expiredCount = ((toExpiredRes as any).rows || []).length;
  const ongoingCount = ((toOngoingRes as any).rows || []).length;
  const completedCount = ((toCompletedRes as any).rows || []).length;

  return { expiredCount, ongoingCount, completedCount };
}

export async function runStatusTransitions() {
  return ensureCurrentReservationStatuses();
}

/**
 * Mark a completed reservation as No-Show.
 * - Admin-only action
 * - Must be in 'completed' status
 * - Time-bound: only available within NO_SHOW_WINDOW_HOURS (default 48h) after reservation's end time
 * - Timestamped and attributed to the admin
 */
export async function markReservationNoShow(
  reservationId: string,
  adminId: string,
) {
  const [resRow] = await db
    .select({
      id: reservations.id,
      status: reservations.status,
      isNoShow: reservations.isNoShow,
    })
    .from(reservations)
    .where(eq(reservations.id, reservationId))
    .limit(1);

  if (!resRow) {
    throw new Error("Reservation not found.");
  }

  if (resRow.status !== "completed") {
    throw new Error("Only completed reservations can be marked as no-show.");
  }

  const timeQuery = await db.execute(sql`
    SELECT upper(time_range) as end_time FROM reservations WHERE id = ${reservationId}
  `);
  const endTimeVal = (timeQuery as any).rows?.[0]?.end_time;
  if (!endTimeVal) {
    throw new Error("Unable to determine reservation end time.");
  }

  const endTime = new Date(endTimeVal);
  const now = new Date();
  const cutoffTime = new Date(
    endTime.getTime() + NO_SHOW_WINDOW_HOURS * 60 * 60 * 1000,
  );

  if (now.getTime() > cutoffTime.getTime()) {
    throw new Error(
      `No-show marking window has expired. Reservations can only be marked as no-show within ${NO_SHOW_WINDOW_HOURS} hours after their end time.`,
    );
  }

  const [updated] = await db
    .update(reservations)
    .set({
      isNoShow: true,
      noShowMarkedAt: new Date(),
      noShowAdminId: adminId || null,
    })
    .where(eq(reservations.id, reservationId))
    .returning();

  return updated;
}

/**
 * Unmark a reservation's No-Show status.
 * - Admin-only action
 * - Explicit deliberate unmarking action
 */
export async function unmarkReservationNoShow(
  reservationId: string,
  _adminId?: string,
) {
  const [resRow] = await db
    .select({
      id: reservations.id,
      status: reservations.status,
      isNoShow: reservations.isNoShow,
    })
    .from(reservations)
    .where(eq(reservations.id, reservationId))
    .limit(1);

  if (!resRow) {
    throw new Error("Reservation not found.");
  }

  const [updated] = await db
    .update(reservations)
    .set({
      isNoShow: false,
      noShowMarkedAt: null,
      noShowAdminId: null,
    })
    .where(eq(reservations.id, reservationId))
    .returning();

  return updated;
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

  // Send Web Push notification to each affected member (1 push per member per instrument)
  if (futureActive.length > 0) {
    const uniqueUserIds = Array.from(
      new Set(futureActive.map((r) => r.userId).filter(Boolean) as string[]),
    );
    const instName = removedInstrument?.name || "الآلة";
    for (const uid of uniqueUserIds) {
      if (uid !== cleanAdminId) {
        sendPushToUser(uid, {
          titleAr: "إلغاء حجز بسبب إزالة الآلة ⚠️",
          titleEn: "Reservation Cancelled - Instrument Removed ⚠️",
          bodyAr: `تم إلغاء حجزك لأن الآلة "${instName}" تمت إزالتها من العهدة بواسطة الإدارة.`,
          bodyEn: `Your reservation was cancelled because "${instName}" was removed from inventory by church administration.`,
          tag: `inst-removed-${instrumentId}`,
          url: "/?view=calendar",
          data: { instrumentId, type: "instrument_removed" },
        }).catch((e) =>
          console.warn("[Push inst remove error]:", e.message),
        );
      }
    }
  }

  return {
    success: true,
    cancelledReservationsCount: futureActive.length,
    instrument: removedInstrument,
  };
}

/**
 * =========================================================================
 * 9. TYPE REQUEST CANDIDATE MATCHING & ADMIN ASSIGNMENT
 * =========================================================================
 */

/**
 * Fetches candidate instruments of the requested type for a single type request.
 * Sorts according to policy: Room stock first, then Musician, then Public (so public is the last choice).
 * Free candidates are prioritized within each level; busy and out-of-service candidates are clearly flagged.
 */
export async function getTypeRequestCandidates(reservationId: string) {
  const [res] = await db
    .select()
    .from(reservations)
    .where(eq(reservations.id, reservationId))
    .limit(1);

  if (!res) throw new Error("Reservation not found.");
  if (!res.isTypeRequest || !res.requestedType) {
    throw new Error("This reservation is not a type request.");
  }

  const boundsRes: any = await db.execute(
    sql`SELECT lower(time_range) as start_time, upper(time_range) as end_time FROM reservations WHERE id = ${reservationId}`,
  );
  if (!boundsRes.rows || boundsRes.rows.length === 0) {
    throw new Error("Could not determine reservation time boundaries.");
  }
  const start = new Date(boundsRes.rows[0].start_time);
  const end = new Date(boundsRes.rows[0].end_time);

  const matchingInstruments = await db
    .select()
    .from(instruments)
    .where(
      and(
        eq(instruments.isRemoved, false),
        sql`${instruments.type} ILIKE ${res.requestedType.trim()}`,
      ),
    );

  const candidates = [];
  for (const inst of matchingInstruments) {
    let candidateStatus: "free" | "busy" | "out_of_service" = "free";
    let statusReason: string | null = null;
    let conflictDetails: any = null;

    if (inst.isOutOfService) {
      candidateStatus = "out_of_service";
      statusReason = "Instrument is marked Out of service";
    } else {
      const conflictRes = await db
        .select({
          id: reservations.id,
          serviceName: reservations.serviceName,
          musicianName: reservations.musicianName,
        })
        .from(reservations)
        .where(
          sql`${reservations.instrumentId} = ${inst.id}
            AND ${reservations.status} = 'approved'
            AND ${reservations.id} != ${reservationId}
            AND ${reservations.timeRange} && tstzrange(${start.toISOString()}, ${end.toISOString()}, '[)')`,
        )
        .limit(1);

      if (conflictRes.length > 0) {
        candidateStatus = "busy";
        const c = conflictRes[0];
        const cBounds: any = await db.execute(
          sql`SELECT lower(time_range) as st, upper(time_range) as et FROM reservations WHERE id = ${c.id}`,
        );
        const cStart = cBounds.rows?.[0]?.st ? new Date(cBounds.rows[0].st) : null;
        const cEnd = cBounds.rows?.[0]?.et ? new Date(cBounds.rows[0].et) : null;
        const timeFmt = cStart && cEnd ? ` (${getCairoTimeString(cStart)} - ${getCairoTimeString(cEnd)})` : "";
        statusReason = `Busy: conflicts with "${c.serviceName}" (${c.musicianName || "Musician"})${timeFmt}`;
        conflictDetails = {
          reservationId: c.id,
          serviceName: c.serviceName,
          musicianName: c.musicianName,
          start: cStart,
          end: cEnd,
        };
      }
    }

    candidates.push({
      instrument: inst,
      status: candidateStatus,
      statusReason,
      conflictDetails,
    });
  }

  // Sorting rule per spec:
  // "Room stock is listed first, then musician level, then public, so public instruments are the last choice."
  const levelPriority: Record<string, number> = {
    room_stock: 1,
    musician: 2,
    public: 3,
  };
  const statusPriority: Record<string, number> = {
    free: 1,
    busy: 2,
    out_of_service: 3,
  };

  candidates.sort((a, b) => {
    const levelDiff =
      (levelPriority[a.instrument.visibilityLevel || "public"] || 9) -
      (levelPriority[b.instrument.visibilityLevel || "public"] || 9);
    if (levelDiff !== 0) return levelDiff;

    const statusDiff =
      (statusPriority[a.status] || 9) - (statusPriority[b.status] || 9);
    if (statusDiff !== 0) return statusDiff;

    return a.instrument.name.localeCompare(b.instrument.name);
  });

  return {
    reservation: res,
    requestedType: res.requestedType,
    start,
    end,
    candidates,
    freeCount: candidates.filter((c) => c.status === "free").length,
  };
}

/**
 * Fetches candidates for all occurrences of a recurring series type request.
 */
export async function getSeriesTypeRequestCandidates(seriesId: string) {
  const [series] = await db
    .select()
    .from(reservationSeries)
    .where(eq(reservationSeries.id, seriesId))
    .limit(1);

  if (!series) throw new Error("Series not found.");
  if (!series.isTypeRequest || !series.requestedType) {
    throw new Error("This series is not a type request.");
  }

  const occurrences = await db
    .select()
    .from(reservations)
    .where(
      and(
        eq(reservations.seriesId, seriesId),
        inArray(reservations.status, ["pending", "approved"]),
      ),
    );

  const occEvaluations = [];
  for (const occ of occurrences) {
    const evalData = await getTypeRequestCandidates(occ.id);
    occEvaluations.push({
      occurrence: occ,
      ...evalData,
    });
  }

  const matchingInstruments = await db
    .select()
    .from(instruments)
    .where(
      and(
        eq(instruments.isRemoved, false),
        sql`${instruments.type} ILIKE ${series.requestedType.trim()}`,
      ),
    );

  const levelPriority: Record<string, number> = {
    room_stock: 1,
    musician: 2,
    public: 3,
  };

  const aggregateCandidates = matchingInstruments.map((inst) => {
    const isOutOfService = inst.isOutOfService;
    let freeOnAllDates = !isOutOfService;
    let conflictDatesCount = 0;
    const occStatuses = occEvaluations.map((oe) => {
      const match = oe.candidates.find((c) => c.instrument.id === inst.id);
      if (match?.status !== "free") {
        freeOnAllDates = false;
        conflictDatesCount++;
      }
      return {
        reservationId: oe.reservation.id,
        status: match?.status || "free",
        statusReason: match?.statusReason,
      };
    });

    return {
      instrument: inst,
      freeOnAllDates,
      conflictDatesCount,
      isOutOfService,
      occStatuses,
    };
  });

  aggregateCandidates.sort((a, b) => {
    const levelDiff =
      (levelPriority[a.instrument.visibilityLevel || "public"] || 9) -
      (levelPriority[b.instrument.visibilityLevel || "public"] || 9);
    if (levelDiff !== 0) return levelDiff;
    if (a.freeOnAllDates && !b.freeOnAllDates) return -1;
    if (!a.freeOnAllDates && b.freeOnAllDates) return 1;
    return a.instrument.name.localeCompare(b.instrument.name);
  });

  return {
    series,
    requestedType: series.requestedType,
    occurrences: occEvaluations,
    aggregateCandidates,
    freeOnAllCount: aggregateCandidates.filter((c) => c.freeOnAllDates).length,
  };
}

/**
 * Assigns an instrument to a type request and approves it.
 * Validates candidate is not out of service and not busy.
 * Auto-rejects overlapping pending direct requests.
 */
export async function adminAssignTypeRequest(
  reservationId: string,
  instrumentId: string,
  adminId?: string | null,
) {
  const [res] = await db
    .select()
    .from(reservations)
    .where(eq(reservations.id, reservationId))
    .limit(1);

  if (!res) throw new Error("Reservation not found.");

  const [instrument] = await db
    .select()
    .from(instruments)
    .where(eq(instruments.id, instrumentId))
    .limit(1);

  if (!instrument || instrument.isRemoved) {
    throw new Error("Selected instrument was not found or was removed.");
  }
  if (instrument.isOutOfService) {
    throw new Error("Cannot assign: This instrument is marked Out of service.");
  }

  const boundsRes: any = await db.execute(
    sql`SELECT lower(time_range) as start_time, upper(time_range) as end_time FROM reservations WHERE id = ${reservationId}`,
  );
  const start = new Date(boundsRes.rows[0].start_time);
  const end = new Date(boundsRes.rows[0].end_time);

  const conflicts = await db
    .select({ id: reservations.id, serviceName: reservations.serviceName })
    .from(reservations)
    .where(
      sql`${reservations.instrumentId} = ${instrumentId}
        AND ${reservations.status} = 'approved'
        AND ${reservations.id} != ${reservationId}
        AND ${reservations.timeRange} && tstzrange(${start.toISOString()}, ${end.toISOString()}, '[)')`,
    )
    .limit(1);

  if (conflicts.length > 0) {
    throw new Error(
      `Cannot assign: "${instrument.name}" conflicts with another approved reservation ("${conflicts[0].serviceName}") in this slot.`,
    );
  }

  const cleanAdminId = toNullableString(adminId);

  const [approved] = await db
    .update(reservations)
    .set({
      instrumentId,
      status: "approved",
      rejectionReason: null,
      adminId: cleanAdminId || res.adminId,
    })
    .where(eq(reservations.id, reservationId))
    .returning();

  // Auto-reject other pending direct requests for this instrument and time
  await autoRejectOverlappingPending(instrumentId, start, end, reservationId);

  if (res.userId) {
    const notifyMsg = `Your request for a ${res.requestedType || "instrument"} has been approved! The church administration has allocated "${instrument.name}".`;
    await db.insert(notifications).values({
      userId: res.userId,
      reservationId: res.id,
      type: "reservation_approved",
      message: notifyMsg,
    });

    sendPushToUser(res.userId, {
      titleAr: "تم تخصيص الآلة واعتماد طلبك! 🎉",
      titleEn: "Instrument Assigned & Approved! 🎉",
      bodyAr: `تم تخصيص "${instrument.name}" لطلبك (${res.serviceName}).`,
      bodyEn: `Your type request was approved! "${instrument.name}" has been allocated.`,
      tag: `res-status-${res.id}`,
      url: `/?reservationId=${res.id}`,
      data: { reservationId: res.id, status: "approved" },
    }).catch(() => {});

    (async () => {
      try {
        const [userInfo] = await db
          .select({ name: users.name, email: users.email })
          .from(users)
          .where(eq(users.id, res.userId!))
          .limit(1);

        if (userInfo?.email) {
          await sendReservationApprovedEmail({
            email: userInfo.email,
            name: userInfo.name,
            instrumentName: instrument.name,
            musicianName: res.musicianName,
            serviceName: res.serviceName,
            reservationType: res.reservationType,
            startTime: start,
            endTime: end,
            isSeries: Boolean(res.seriesId),
            feeSnapshot: res.feeSnapshot,
          });
        }
      } catch (mailErr) {
        console.error("Error sending assignment approval email:", mailErr);
      }
    })();
  }

  return approved;
}

/**
 * Assigns one instrument to a series of type requests.
 * Supports approving fitting dates and optionally rejecting conflicting dates with a reason.
 */
export async function adminAssignSeriesTypeRequest(
  seriesId: string,
  instrumentId: string,
  adminId?: string | null,
  options?: {
    rejectConflicting?: boolean;
    conflictRejectionReason?: string;
  },
) {
  const [series] = await db
    .select()
    .from(reservationSeries)
    .where(eq(reservationSeries.id, seriesId))
    .limit(1);

  if (!series) throw new Error("Series not found.");

  const [instrument] = await db
    .select()
    .from(instruments)
    .where(eq(instruments.id, instrumentId))
    .limit(1);

  if (!instrument || instrument.isRemoved) {
    throw new Error("Target instrument not found.");
  }
  if (instrument.isOutOfService) {
    throw new Error("Cannot assign: This instrument is marked Out of service.");
  }

  const occurrences = await db
    .select()
    .from(reservations)
    .where(
      and(
        eq(reservations.seriesId, seriesId),
        inArray(reservations.status, ["pending", "approved"]),
      ),
    );

  const cleanAdminId = toNullableString(adminId);
  const approvedList: any[] = [];
  const rejectedList: any[] = [];
  const conflictList: any[] = [];

  for (const occ of occurrences) {
    const boundsRes: any = await db.execute(
      sql`SELECT lower(time_range) as start_time, upper(time_range) as end_time FROM reservations WHERE id = ${occ.id}`,
    );
    const start = new Date(boundsRes.rows[0].start_time);
    const end = new Date(boundsRes.rows[0].end_time);

    const conflicts = await db
      .select({ id: reservations.id, serviceName: reservations.serviceName })
      .from(reservations)
      .where(
        sql`${reservations.instrumentId} = ${instrumentId}
          AND ${reservations.status} = 'approved'
          AND ${reservations.id} != ${occ.id}
          AND ${reservations.timeRange} && tstzrange(${start.toISOString()}, ${end.toISOString()}, '[)')`,
      )
      .limit(1);

    if (conflicts.length > 0) {
      if (options?.rejectConflicting) {
        const reason =
          options.conflictRejectionReason ||
          `Conflicted with approved reservation ("${conflicts[0].serviceName}") on ${instrument.name}`;
        const [rej] = await db
          .update(reservations)
          .set({
            status: "rejected",
            rejectionReason: reason,
            adminId: cleanAdminId || occ.adminId,
          })
          .where(eq(reservations.id, occ.id))
          .returning();
        rejectedList.push(rej);
      } else {
        conflictList.push({
          reservationId: occ.id,
          serviceName: occ.serviceName,
          conflictingWith: conflicts[0].serviceName,
        });
      }
    } else {
      const [app] = await db
        .update(reservations)
        .set({
          instrumentId,
          status: "approved",
          rejectionReason: null,
          adminId: cleanAdminId || occ.adminId,
        })
        .where(eq(reservations.id, occ.id))
        .returning();

      await autoRejectOverlappingPending(instrumentId, start, end, occ.id);
      approvedList.push(app);
    }
  }

  if (conflictList.length > 0 && !options?.rejectConflicting) {
    throw new Error(
      `Cannot assign: ${conflictList.length} date(s) conflict with existing approved reservations on "${instrument.name}".`,
    );
  }

  // Update parent series
  await db
    .update(reservationSeries)
    .set({ instrumentId })
    .where(eq(reservationSeries.id, seriesId));

  // User notification
  if (series.userId) {
    const notifyMsg = `Church administration assigned "${instrument.name}" to your recurring series (${approvedList.length} dates approved${rejectedList.length > 0 ? `, ${rejectedList.length} dates rejected due to conflict` : ""}).`;
    await db.insert(notifications).values({
      userId: series.userId,
      reservationId: approvedList[0]?.id || rejectedList[0]?.id,
      type: "reservation_approved",
      message: notifyMsg,
    });

    sendPushToUser(series.userId, {
      titleAr: "تم تخصيص آلة لسلسلتك المتكررة 🎉",
      titleEn: "Instrument Assigned to Recurring Series",
      bodyAr: `تم تخصيص "${instrument.name}" لـ ${approvedList.length} مواعيد في سلسلتك.`,
      bodyEn: `Assigned "${instrument.name}" to ${approvedList.length} dates in your series.`,
      tag: `series-assigned-${seriesId}`,
      url: `/?reservationId=${approvedList[0]?.id}`,
      data: { seriesId, status: "approved" },
    }).catch(() => {});
  }

  return {
    seriesId,
    instrumentId,
    approvedCount: approvedList.length,
    rejectedCount: rejectedList.length,
    approved: approvedList,
    rejected: rejectedList,
  };
}

/**
 * Reassigns an approved reservation to a different instrument (e.g., if one breaks).
 * User is notified of the change with the new instrument name.
 */
export async function adminReassignReservation(
  reservationId: string,
  newInstrumentId: string,
  adminId?: string | null,
  reason?: string,
) {
  const [res] = await db
    .select()
    .from(reservations)
    .where(eq(reservations.id, reservationId))
    .limit(1);

  if (!res) throw new Error("Reservation not found.");

  const [newInstrument] = await db
    .select()
    .from(instruments)
    .where(eq(instruments.id, newInstrumentId))
    .limit(1);

  if (!newInstrument || newInstrument.isRemoved) {
    throw new Error("Target instrument not found.");
  }
  if (newInstrument.isOutOfService) {
    throw new Error("Cannot reassign to an instrument marked Out of service.");
  }

  const boundsRes: any = await db.execute(
    sql`SELECT lower(time_range) as start_time, upper(time_range) as end_time FROM reservations WHERE id = ${reservationId}`,
  );
  const start = new Date(boundsRes.rows[0].start_time);
  const end = new Date(boundsRes.rows[0].end_time);

  const conflicts = await db
    .select({ id: reservations.id, serviceName: reservations.serviceName })
    .from(reservations)
    .where(
      sql`${reservations.instrumentId} = ${newInstrumentId}
        AND ${reservations.status} = 'approved'
        AND ${reservations.id} != ${reservationId}
        AND ${reservations.timeRange} && tstzrange(${start.toISOString()}, ${end.toISOString()}, '[)')`,
    )
    .limit(1);

  if (conflicts.length > 0) {
    throw new Error(
      `Cannot reassign: "${newInstrument.name}" conflicts with another approved reservation ("${conflicts[0].serviceName}") in this slot.`,
    );
  }

  const cleanAdminId = toNullableString(adminId);

  const [reassigned] = await db
    .update(reservations)
    .set({
      instrumentId: newInstrumentId,
      adminId: cleanAdminId || res.adminId,
    })
    .where(eq(reservations.id, reservationId))
    .returning();

  await autoRejectOverlappingPending(newInstrumentId, start, end, reservationId);

  try {
    let adminName = "Church Administration";
    if (cleanAdminId) {
      const [adm] = await db
        .select({ name: admins.name })
        .from(admins)
        .where(eq(admins.id, cleanAdminId))
        .limit(1);
      if (adm?.name) adminName = adm.name;
    }
    await db.insert(messages).values({
      reservationId: res.id,
      adminId: cleanAdminId,
      senderRole: "admin",
      senderName: adminName,
      content: `Reassignment notice: Allocated instrument updated to "${newInstrument.name}".${reason ? ` Reason: ${reason}` : ""}`,
      isRead: false,
    });
  } catch {}

  if (res.userId) {
    const reassignedMsg = `Your reservation for "${res.serviceName}" has been reallocated to "${newInstrument.name}" by church administration.${reason ? ` (${reason})` : ""}`;
    await db.insert(notifications).values({
      userId: res.userId,
      reservationId: res.id,
      type: "reservation_reassigned",
      message: reassignedMsg,
    });

    sendPushToUser(res.userId, {
      titleAr: "تم تغيير الآلة المخصصة لحجزك 🔄",
      titleEn: "Reservation Instrument Reassigned 🔄",
      bodyAr: `تم تحديث الآلة المخصصة لحجز "${res.serviceName}" لتصبح "${newInstrument.name}".`,
      bodyEn: `Your reservation instrument for "${res.serviceName}" was changed to "${newInstrument.name}".`,
      tag: `res-reassigned-${res.id}`,
      url: `/?reservationId=${res.id}`,
      data: { reservationId: res.id, status: "approved" },
    }).catch(() => {});
  }

  return reassigned;
}

/**
 * Gets future approved and pending bookings for an instrument.
 * Used when an instrument is marked Out of Service so the admin sees affected bookings.
 */
export async function getFutureBookingsForInstrument(instrumentId: string) {
  const query = sql`
    SELECT
      r.id,
      r.user_id,
      r.service_name,
      r.musician_name,
      r.status,
      r.reservation_type,
      lower(r.time_range) as start_time,
      upper(r.time_range) as end_time,
      u.name as user_name,
      u.phone_number as user_phone
    FROM reservations r
    LEFT JOIN users u ON r.user_id = u.id
    WHERE r.instrument_id = ${instrumentId}
      AND r.status IN ('pending', 'approved')
      AND upper(r.time_range) > NOW()
    ORDER BY lower(r.time_range) ASC;
  `;

  const res: any = await db.execute(query);
  return res.rows || [];
}
