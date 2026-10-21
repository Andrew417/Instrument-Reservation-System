import { Router, Request, Response } from "express";
import {
  createReservation,
  createReservationSeries,
  editReservation,
  editReservationSeries,
  cancelReservation,
  runStatusTransitions,
  ensureCurrentReservationStatuses,
  evaluateReservationSubmission,
  getHardLimits,
} from "../services/reservation-logic.js";
import { db } from "../db/index.js";
import { reservations, users, admins, messages } from "../db/schema.js";
import { eq, sql } from "drizzle-orm";
import { validateSession } from "./session-manager.js";
import {
  getCairoDateString,
  getCairoParts,
  cairoDateTimeToDate,
  addDaysToDateString,
  parseLocalDate,
} from "../lib/date-utils.js";
import { sendPushToUser, sendPushToAdmins } from "../lib/push-service.js";

const router = Router();

/**
 * 0. Get current hard limits
 */
router.get("/limits", async (_req: Request, res: Response): Promise<void> => {
  try {
    res.set(
      "Cache-Control",
      "no-store, no-cache, must-revalidate, proxy-revalidate",
    );
    const limits = await getHardLimits();
    res.json({ success: true, limits });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * Helper to safely extract user or admin ID from valid session token
 */
async function extractSessionIdentity(req: Request) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return null;
  }
  const token = authHeader.substring(7).trim();
  try {
    const sessionRes = await validateSession(token);
    if (sessionRes.valid && sessionRes.session) {
      const isAdm =
        sessionRes.session.role === "admin" ||
        sessionRes.session.role === "super_admin";
      return {
        userId: isAdm ? null : sessionRes.session.userId,
        adminId: isAdm ? sessionRes.session.adminId : null,
      };
    }
  } catch {
    // Ignore and fallback to body parameters
  }
  return null;
}

/**
 * Resolves who owns a new booking. Admins may book for a member via
 * `onBehalfOfUserId`; the admin id always comes from the session.
 */
async function resolveBookingOwner(req: Request) {
  const identity = await extractSessionIdentity(req);
  const onBehalfOfUserId = String(req.body?.onBehalfOfUserId ?? "").trim();

  if (!onBehalfOfUserId) {
    return identity
      ? { userId: identity.userId, adminId: identity.adminId }
      : {};
  }

  if (!identity?.adminId) {
    throw new Error("Not authorized to book on behalf of a member.");
  }

  const [member] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.id, onBehalfOfUserId))
    .limit(1);
  if (!member) throw new Error("Member not found.");

  return { userId: member.id, adminId: identity.adminId };
}

/**
 * Resolve the calling user's OWN identity for "self-booking" features
 * like quick-rebook. Returns the users.id when a member session is present,
 * or the admins.id when an admin / super_admin session is present.
 *
 * Admins are musicians too and often book instruments for themselves
 * through the normal member flow — those bookings are stored with
 * r.admin_id set and r.user_id = NULL.
 */
async function extractSelfBookingIdentity(
  req: Request,
): Promise<{ id: string; kind: "user" | "admin" } | null> {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) return null;
  const token = authHeader.substring(7).trim();
  try {
    const { valid, session } = await validateSession(token);
    if (!valid || !session) return null;
    const role = (session as any).role;
    const isAdminRole = role === "admin" || role === "super_admin";
    if (isAdminRole) {
      const adminId =
        (session as any).adminId ?? (session as any).admin?.id ?? null;
      if (!adminId) return null;
      return { id: adminId, kind: "admin" };
    }
    const userId = (session as any).userId ?? (session as any).user?.id ?? null;
    if (!userId) return null;
    return { id: userId, kind: "user" };
  } catch {
    return null;
  }
}

/**
 * FIX: Returns true only when the Bearer token belongs to a super_admin session.
 * Never reads from the request body.
 */
async function resolveIsSuperAdmin(req: Request): Promise<boolean> {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) return false;
  const token = authHeader.substring(7).trim();
  try {
    const { valid, session } = await validateSession(token);
    if (valid && session) {
      return (
        (session as any).role === "super_admin" ||
        Boolean((session as any).user?.isSuperAdmin)
      );
    }
  } catch {
    // fall through
  }
  return false;
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
 * 1. Evaluate/Dry-run submission without creating a row
 */
router.post("/evaluate", async (req: Request, res: Response): Promise<void> => {
  try {
    const sessionIdentity = await extractSessionIdentity(req);
    const payload = {
      ...req.body,
      ...(sessionIdentity
        ? { userId: sessionIdentity.userId, adminId: sessionIdentity.adminId }
        : {}),
    };
    const result = await evaluateReservationSubmission(payload);
    res.json({ success: true, evaluation: result });
  } catch (err: any) {
    console.error("Reservations list error:", err);
    res
      .status(500)
      .json({ success: false, error: err.message, cause: err.cause?.message });
  }
});

/**
 * 2. Create recurring reservation series
 */
router.post("/series", async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.body.serviceName || !req.body.serviceName.trim()) {
      res.status(400).json({
        success: false,
        error: "What this reservation is for (service_name) is required.",
      });
      return;
    }
    if (!req.body.musicianName || !req.body.musicianName.trim()) {
      res.status(400).json({
        success: false,
        error: "Musician name is required.",
      });
      return;
    }
    if (!req.body.instrumentId) {
      res.status(400).json({
        success: false,
        error: "Instrument is required.",
      });
      return;
    }
    if (
      !Array.isArray(req.body.occurrences) ||
      req.body.occurrences.length === 0
    ) {
      res.status(400).json({
        success: false,
        error: "Series must have at least one occurrence.",
      });
      return;
    }

    const payload = { ...req.body, ...(await resolveBookingOwner(req)) };
    const result = await createReservationSeries(payload);
    res.status(201).json({ success: true, ...result });
  } catch (err: any) {
    console.error("Reservation series create error:", err);
    const msg: string = err.message || "Failed to create reservation series.";
    const status =
      err.code === "SUBMISSION_BLOCKED"
        ? 400
        : /not authorized/i.test(msg)
          ? 403
          : /not found/i.test(msg)
            ? 404
            : /conflicts?|working hours|maximum duration|exceeds|overlap|future|at least|at most|selected|invalid date|duration must|limit/i.test(
                  msg,
                )
              ? 400
              : 500;
    res.status(status).json({
      success: false,
      error: msg,
      cause: err.cause?.message,
    });
  }
});

/**
 * 3. Create single reservation
 */
router.post("/", async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.body.serviceName || !req.body.serviceName.trim()) {
      res.status(400).json({
        success: false,
        error: "What this reservation is for (service_name) is required.",
      });
      return;
    }
    if (!req.body.musicianName || !req.body.musicianName.trim()) {
      res.status(400).json({
        success: false,
        error: "Musician name is required.",
      });
      return;
    }
    const payload = { ...req.body, ...(await resolveBookingOwner(req)) };
    const result = await createReservation(payload);
    res.status(201).json({ success: true, ...result });
  } catch (err: any) {
    console.error("Reservation create error:", err);
    const msg: string = err.message || "Failed to create reservation.";
    const status =
      err.code === "SUBMISSION_BLOCKED"
        ? 400
        : /not authorized/i.test(msg)
          ? 403
          : /not found/i.test(msg)
            ? 404
            : /conflicts?|working hours|maximum duration|exceeds/i.test(msg)
              ? 400
              : 500;
    res.status(status).json({
      success: false,
      error: msg,
      cause: err.cause?.message,
    });
  }
});

/**
 * Bulk edit upcoming occurrences of a recurring series (owner or admin)
 */
router.patch(
  "/series/:seriesId",
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { seriesId } = req.params;
      const sessionIdentity = await extractSessionIdentity(req);
      const rawBody = (req.body ?? {}) as Record<string, unknown>;

      const actor = sessionIdentity
        ? {
            userId: sessionIdentity.userId,
            adminId: sessionIdentity.adminId,
            isSuperAdmin: await resolveIsSuperAdmin(req),
          }
        : {
            userId: (rawBody.userId as string | undefined) ?? null,
            adminId: null,
            isSuperAdmin: false,
          };

      const result = await editReservationSeries(seriesId, req.body, actor);

      res.json({
        success: true,
        updatedCount: result.updatedCount,
        statusSummary: result.statusSummary,
        ...(result.message ? { message: result.message } : {}),
      });
    } catch (err: any) {
      console.error("Series edit error:", err);
      const msg: string = err.message || "Failed to edit recurring series.";
      const status = /not authorized/i.test(msg)
        ? 403
        : /not found/i.test(msg)
          ? 404
          : /conflict|working hours|past/i.test(msg)
            ? 400
            : 500;
      res.status(status).json({
        success: false,
        error: msg,
        conflicts: err.conflicts || undefined,
      });
    }
  },
);

/**
 * FIX: Actor identity is ALWAYS resolved from the Bearer session token — never
 * trusted from the request body. This is what lets Admins / Super Admin edit
 * reservations belonging to other users.
 */
router.put("/:id", async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    const rawBody = (req.body ?? {}) as Record<string, unknown>;
    const updates: Record<string, unknown> = { ...rawBody };
    delete updates.userId;
    delete updates.adminId;
    delete updates.isSuperAdmin;

    const sessionIdentity = await extractSessionIdentity(req);

    const actor: {
      userId?: string | null;
      adminId?: string | null;
      isSuperAdmin?: boolean;
    } = sessionIdentity
      ? {
          userId: sessionIdentity.userId,
          adminId: sessionIdentity.adminId,
          isSuperAdmin: await resolveIsSuperAdmin(req),
        }
      : {
          userId: (rawBody.userId as string | undefined) ?? null,
          adminId: null,
          isSuperAdmin: false,
        };

    const updated = await editReservation(
      id,
      updates as Parameters<typeof editReservation>[1],
      actor,
    );
    res.json({ success: true, reservation: updated });
  } catch (err: any) {
    console.error("Reservation edit error:", err);
    const msg: string = err.message || "Failed to edit reservation.";
    const status = /not authorized/i.test(msg)
      ? 403
      : /not found/i.test(msg)
        ? 404
        : /conflicts?/i.test(msg) || /working hours/i.test(msg)
          ? 400
          : 500;
    res.status(status).json({
      success: false,
      error: msg,
      cause: err.cause?.message,
    });
  }
});

/**
 * 4b. Record or update pre-handover instrument condition & damage check
 */
router.put(
  "/:id/condition-check",
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { id } = req.params;
      const { status, notes, photoUrl, tags, checkedBy } = req.body;

      const lookup = await db.execute(sql`
        SELECT id, user_id, musician_name, service_name, instrument_id
        FROM reservations WHERE id = ${id} LIMIT 1
      `);
      const rows = (lookup as any).rows || [];
      if (rows.length === 0) {
        res
          .status(404)
          .json({ success: false, error: "Reservation not found" });
        return;
      }

      const resRecord = rows[0];
      const windowCheck = await db.execute(sql`
        SELECT status
        FROM reservations
        WHERE id = ${id}
          AND status IN ('approved', 'ongoing')
          AND NOW() < lower(time_range) + INTERVAL '30 minutes'
        LIMIT 1
      `);
      if (((windowCheck as any).rows || []).length === 0) {
        res.status(400).json({
          success: false,
          error:
            "Condition check is available before the reservation and during its first 30 minutes. The window closes 30 minutes after the reservation starts.",
        });
        return;
      }

      const cleanCheckedBy = (
        checkedBy ||
        resRecord.musician_name ||
        "Musician"
      ).trim();
      const cleanStatus =
        status === "reported_issues" ? "reported_issues" : "pristine";

      const updateRes = await db.execute(sql`
        UPDATE reservations
        SET condition_status = ${cleanStatus},
            condition_notes = ${notes ? String(notes).trim() : null},
            condition_photo_url = ${photoUrl || null},
            condition_tags = ${tags ? String(tags).trim() : null},
            condition_checked_at = NOW(),
            condition_checked_by = ${cleanCheckedBy}
        WHERE id = ${id}
        RETURNING *
      `);

      const updated = (updateRes as any).rows?.[0];

      res.json({
        success: true,
        reservation: updated,
      });
    } catch (err: any) {
      console.error("Condition check error:", err);
      res.status(500).json({
        success: false,
        error: err.message || "Failed to save condition check.",
      });
    }
  },
);

/**
 * 5. Cancel a reservation (single or series)
 */
router.post(
  "/:id/cancel",
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { id } = req.params;
      const { userId, adminId, cancelMode, cancellationReason } = req.body;
      const sessionIdentity = await extractSessionIdentity(req);
      const result = await cancelReservation(
        id,
        { cancelMode, cancellationReason },
        sessionIdentity || { userId, adminId },
      );
      res.json({ success: true, ...result });
    } catch (err: any) {
      console.error("Reservations list error:", err);
      res.status(500).json({
        success: false,
        error: err.message,
        cause: err.cause?.message,
      });
    }
  },
);

/**
 * Run scheduled status transitions
 */
router.post(
  "/transitions/run",
  async (_req: Request, res: Response): Promise<void> => {
    try {
      const result = await runStatusTransitions();
      res.json({ success: true, ...result });
    } catch (err: any) {
      console.error("Reservations list error:", err);
      res.status(500).json({
        success: false,
        error: err.message,
        cause: err.cause?.message,
      });
    }
  },
);

/**
 * 12. Get payment settings (Instapay details)
 */
router.get(
  "/payment-settings",
  async (_req: Request, res: Response): Promise<void> => {
    try {
      const result = await db.execute(
        sql`SELECT * FROM payment_settings LIMIT 1`,
      );
      let rows = (result as any).rows || [];
      if (rows.length === 0) {
        const inserted = await db.execute(sql`
        INSERT INTO payment_settings (instapay_number, instapay_link, updated_at)
        VALUES ('0100 123 4567', 'https://ipn.eg/coptic-church-instruments', NOW())
        RETURNING *
      `);
        rows = (inserted as any).rows || [];
      }
      res.json({ success: true, settings: rows[0] });
    } catch (err: any) {
      console.error("Reservations list error:", err);
      res.status(500).json({
        success: false,
        error: err.message,
        cause: err.cause?.message,
      });
    }
  },
);

/**
 * 13. Get single reservation messages (scoped to this reservation)
 */
router.get(
  "/:id/messages",
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { id } = req.params;
      const result = await db.execute(sql`
      SELECT 
        m.id,
        m.reservation_id,
        m.admin_id,
        m.user_id,
        m.sender_role,
        m.sender_name,
        m.content,
        m.is_read,
        m.created_at,
        COALESCE(m.sender_name, a.name, u.name, CASE WHEN m.sender_role = 'admin' THEN 'Church Administrator' ELSE 'Member' END) as author_name,
        a.name as admin_name,
        u.name as user_name
      FROM messages m
      LEFT JOIN admins a ON m.admin_id = a.id
      LEFT JOIN users u ON m.user_id = u.id
      WHERE m.reservation_id = ${id}
      ORDER BY m.created_at ASC
    `);

      res.json({ success: true, messages: (result as any).rows || [] });
    } catch (err: any) {
      console.error("Reservations list error:", err);
      res.status(500).json({
        success: false,
        error: err.message,
        cause: err.cause?.message,
      });
    }
  },
);

/**
 * 14. Upload / update payment screenshot for reservation
 */
router.post(
  "/:id/payment-screenshot",
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { id } = req.params;
      const { screenshotUrl } = req.body;

      if (!screenshotUrl) {
        res
          .status(400)
          .json({ success: false, error: "screenshotUrl is required" });
        return;
      }

      const result = await db.execute(sql`
      UPDATE reservations
      SET payment_screenshot_url = ${screenshotUrl}
      WHERE id = ${id}
      RETURNING *
    `);

      const rows = (result as any).rows || [];
      if (rows.length === 0) {
        res
          .status(404)
          .json({ success: false, error: "Reservation not found" });
        return;
      }

      res.json({ success: true, reservation: rows[0] });
    } catch (err: any) {
      console.error("Reservations list error:", err);
      res.status(500).json({
        success: false,
        error: err.message,
        cause: err.cause?.message,
      });
    }
  },
);

/**
 * 14b. Delete payment screenshot for reservation
 */
router.delete(
  "/:id/payment-screenshot",
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { id } = req.params;

      const sessionIdentity = await extractSessionIdentity(req);

      const lookup = await db.execute(sql`
        SELECT id, user_id, payment_screenshot_url
        FROM reservations
        WHERE id = ${id}
        LIMIT 1
      `);
      const lookupRows = (lookup as any).rows || [];
      if (lookupRows.length === 0) {
        res
          .status(404)
          .json({ success: false, error: "Reservation not found" });
        return;
      }

      const reservation = lookupRows[0];

      if (sessionIdentity) {
        const isAdminActor = Boolean(sessionIdentity.adminId);
        const isOwner =
          sessionIdentity.userId &&
          reservation.user_id === sessionIdentity.userId;

        if (!isAdminActor && !isOwner) {
          res.status(403).json({ success: false, error: "Not authorized" });
          return;
        }
      }

      const result = await db.execute(sql`
        UPDATE reservations
        SET payment_screenshot_url = NULL
        WHERE id = ${id}
        RETURNING id, payment_screenshot_url
      `);

      const rows = (result as any).rows || [];
      if (rows.length === 0) {
        res
          .status(404)
          .json({ success: false, error: "Reservation not found" });
        return;
      }

      res.json({ success: true, reservation: rows[0] });
    } catch (err: any) {
      console.error("Reservations list error:", err);
      res.status(500).json({
        success: false,
        error: err.message,
        cause: err.cause?.message,
      });
    }
  },
);

/**
 * 14c. Confirm payment (member presses "Save") → email all approved admins
 */
router.post(
  "/:id/confirm-paid",
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { id } = req.params;

      const sessionIdentity = await extractSessionIdentity(req);

      const lookup = await db.execute(sql`
        SELECT
          r.id,
          r.user_id,
          r.service_name,
          r.musician_name,
          r.payment_screenshot_url,
          r.fee_snapshot,
          r.outside_fee_per_day,
          r.reservation_type,
          lower(r.time_range) as start_time,
          upper(r.time_range) as end_time,
          COALESCE(u.name, 'A member') AS member_name,
          u.email AS user_email,
          u.phone_number AS user_phone,
          COALESCE(i.name, 'an instrument') AS instrument_name
        FROM reservations r
        LEFT JOIN users u ON r.user_id = u.id
        LEFT JOIN instruments i ON r.instrument_id = i.id
        WHERE r.id = ${id}
        LIMIT 1
      `);
      const rows = (lookup as any).rows || [];
      if (rows.length === 0) {
        res
          .status(404)
          .json({ success: false, error: "Reservation not found" });
        return;
      }
      const r = rows[0];

      if (sessionIdentity) {
        const isAdminActor = Boolean(sessionIdentity.adminId);
        const isOwner =
          sessionIdentity.userId && r.user_id === sessionIdentity.userId;
        if (!isAdminActor && !isOwner) {
          res.status(403).json({ success: false, error: "Not authorized" });
          return;
        }
      }
      const feeAmount = r.fee_snapshot ?? r.outside_fee_per_day ?? 0;
      const memberName = r.member_name || "A member";
      const instrumentName = r.instrument_name || "an instrument";
      const serviceName = r.service_name || "Reservation";

      let emailSent = false;
      let emailError: string | null = null;
      let recipientCount = 0;
      try {
        const { sendReservationPaidEmail } = await import("../lib/mailer.js");
        const result = await sendReservationPaidEmail({
          reservationId: r.id,
          instrumentName,
          serviceName,
          musicianName: r.musician_name || undefined,
          memberName,
          memberEmail: r.user_email || undefined,
          memberPhone: r.user_phone || undefined,
          reservationType: r.reservation_type,
          startTime: r.start_time,
          endTime: r.end_time,
          feeSnapshot: feeAmount,
        });
        emailSent = result.sent;
        emailError = result.error || null;
        recipientCount = result.recipientCount || 0;
      } catch (mailErr: any) {
        emailError = mailErr.message || "Mailer threw";
        console.warn("Confirm-paid email failed:", emailError);
      }

      try {
        const adminIdsRes = await db.execute(sql`
          SELECT id FROM admins WHERE approval_status = 'approved'
        `);
        const adminIds = ((adminIdsRes as any).rows || []).map(
          (a: any) => a.id,
        );
        const notifMsg = `${memberName} marked the outside-church payment as PAID for "${serviceName}" (${instrumentName}). Please verify the receipt.`;
        for (const adminId of adminIds) {
          await db.execute(sql`
            INSERT INTO notifications
              (admin_id, type, message, is_read, reservation_id, created_at)
            VALUES (
              ${adminId},
              'reservation_paid',
              ${notifMsg},
              false,
              ${id},
              NOW()
            )
          `);
        }
      } catch (notifErr: any) {
        console.warn("Paid notification insert failed:", notifErr.message);
      }

      res.json({
        success: true,
        emailSent,
        emailError,
        recipientCount,
      });
    } catch (err: any) {
      console.error("Confirm-paid error:", err);
      res.status(500).json({
        success: false,
        error: err.message,
        cause: err.cause?.message,
      });
    }
  },
);

/**
 * 15. Post message or reply to reservation (by user or admin)
 */
router.post(
  "/:id/messages",
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { id } = req.params;
      const { content, senderRole: bodyRole, senderName: bodyName } = req.body;
      let { adminId, userId } = req.body;

      if (!content || !content.trim()) {
        res
          .status(400)
          .json({ success: false, error: "Message content is required" });
        return;
      }

      const sessionIdentity = await extractSessionIdentity(req);
      let senderRole = bodyRole;
      let senderName = bodyName || null;

      if (sessionIdentity) {
        if (sessionIdentity.adminId) {
          adminId = sessionIdentity.adminId;
          senderRole = "admin";
          const adm = await db.execute(
            sql`SELECT name FROM admins WHERE id = ${adminId}`,
          );
          if ((adm as any).rows?.length > 0) {
            senderName = (adm as any).rows[0].name;
          }
        } else if (sessionIdentity.userId) {
          userId = sessionIdentity.userId;
          senderRole = "user";
          const usr = await db.execute(
            sql`SELECT name FROM users WHERE id = ${userId}`,
          );
          if ((usr as any).rows?.length > 0) {
            senderName = (usr as any).rows[0].name;
          }
        }
      }

      const resInfo = await db.execute(sql`
        SELECT
          r.user_id,
          r.service_name,
          r.musician_name,
          lower(r.time_range) as start_time,
          upper(r.time_range) as end_time,
          u.name as user_name,
          u.email as user_email,
          COALESCE(i.name, 'Instrument') as instrument_name
        FROM reservations r
        LEFT JOIN users u ON r.user_id = u.id
        LEFT JOIN instruments i ON r.instrument_id = i.id
        WHERE r.id = ${id}
      `);
      const resRows = (resInfo as any).rows || [];
      const resRecord = resRows[0];

      if (!senderRole) {
        if (userId || (!adminId && resRecord?.user_id)) {
          senderRole = "user";
        } else {
          senderRole = "admin";
        }
      }

      if (senderRole === "user") {
        if (!userId && resRecord?.user_id) {
          userId = resRecord.user_id;
        }
        if (!senderName) {
          senderName = resRecord?.user_name || "Member";
        }
      } else {
        if (!adminId) {
          const adminRes = await db.execute(
            sql`SELECT id, name FROM admins LIMIT 1`,
          );
          const adminsList = (adminRes as any).rows || [];
          if (adminsList.length > 0) {
            adminId = adminsList[0].id;
            if (!senderName) senderName = adminsList[0].name;
          }
        }
      }

      const inserted = await db.execute(sql`
      INSERT INTO messages (reservation_id, admin_id, user_id, sender_role, sender_name, content, is_read, created_at)
      VALUES (
        ${id}, 
        ${adminId || null}, 
        ${userId || null}, 
        ${senderRole}, 
        ${senderName}, 
        ${content.trim()}, 
        false, 
        NOW()
      )
      RETURNING *
    `);

      const createdMessage = (inserted as any).rows?.[0];

      try {
        if (senderRole === "user") {
          const adminList = await db.execute(
            sql`SELECT id FROM admins WHERE approval_status = 'approved'`,
          );
          const allAdmins = (adminList as any).rows || [];
          for (const adm of allAdmins) {
            await db.execute(sql`
            INSERT INTO notifications (admin_id, type, message, is_read, reservation_id, created_at)
            VALUES (
              ${adm.id},
              'user_reply',
              ${`${senderName || "Member"} replied on reservation "${resRecord?.service_name || "Reservation"}": "${content.trim()}"`},
              false,
              ${id},
              NOW()
            )
          `);
          }
        } else {
          if (resRecord?.user_id) {
            await db.execute(sql`
            INSERT INTO notifications (user_id, type, message, is_read, reservation_id, created_at)
            VALUES (
              ${resRecord.user_id}, 
              'admin_message', 
              ${`New message from administration regarding "${resRecord.service_name || "Reservation"}": "${content.trim()}"`}, 
              false, 
              ${id}, 
              NOW()
            )
          `);
          }
        }
      } catch (notifErr: any) {
        console.warn(
          "Could not insert chat message notification:",
          notifErr.message,
        );
      }

      try {
        const cleanContent = content.trim();
        const snippet =
          cleanContent.length > 70
            ? cleanContent.substring(0, 67) + "..."
            : cleanContent;
        const resTitle =
          resRecord?.service_name ||
          resRecord?.instrument_name ||
          "Reservation";

        if (senderRole === "user") {
          const memberLabelAr = senderName || resRecord?.user_name || "عضو";
          const memberLabelEn =
            senderName || resRecord?.user_name || "A member";

          sendPushToAdmins(
            {
              titleAr: `رسالة جديدة من ${memberLabelAr}`,
              titleEn: `New message from ${memberLabelEn}`,
              bodyAr: `${resTitle}: "${snippet}"`,
              bodyEn: `${resTitle}: "${snippet}"`,
              tag: `chat-${id}`,
              url: `/?reservationId=${id}&tab=chat`,
              data: { reservationId: id, tab: "chat", type: "chat_message" },
            },
            "member_messages",
          ).catch((e) =>
            console.warn("[Push chat member->admin error]:", e.message),
          );
        } else {
          if (resRecord?.user_id) {
            sendPushToUser(resRecord.user_id, {
              titleAr: "رسالة من إدارة الكنيسة",
              titleEn: "Message from Church Administration",
              bodyAr: `${resTitle}: "${snippet}"`,
              bodyEn: `${resTitle}: "${snippet}"`,
              tag: `chat-${id}`,
              url: `/?reservationId=${id}&tab=chat`,
              data: { reservationId: id, tab: "chat", type: "chat_message" },
            }).catch((e) =>
              console.warn("[Push chat admin->member error]:", e.message),
            );
          }
        }
      } catch (pushErr: any) {
        console.warn(
          "Could not dispatch chat push notification (non-fatal):",
          pushErr.message,
        );
      }

      let emailSent = false;
      let emailError: string | null = null;
      let emailRecipientCount = 0;
      try {
        if (senderRole === "user") {
          const { sendNewMessageToAdminsEmail } =
            await import("../lib/mailer.js");
          const result = await sendNewMessageToAdminsEmail({
            memberName: senderName || resRecord?.user_name || "A member",
            instrumentName: resRecord?.instrument_name || "an instrument",
            serviceName: resRecord?.service_name || undefined,
            startTime: resRecord?.start_time || null,
            endTime: resRecord?.end_time || null,
            reservationId: id,
            messageContent: content.trim(),
          });
          emailSent = result.sent;
          emailError = result.error || null;
          emailRecipientCount = result.recipientCount || 0;
        } else {
          if (resRecord?.user_id && resRecord?.user_email) {
            const { sendNewMessageToMemberEmail } =
              await import("../lib/mailer.js");
            const result = await sendNewMessageToMemberEmail({
              email: resRecord.user_email,
              memberName: resRecord.user_name || "Member",
              adminName: senderName || "Church Administration",
              instrumentName: resRecord.instrument_name || "an instrument",
              serviceName: resRecord.service_name || undefined,
              startTime: resRecord.start_time || null,
              endTime: resRecord.end_time || null,
              reservationId: id,
              messageContent: content.trim(),
            });
            emailSent = result.sent;
            emailError = result.error || null;
            emailRecipientCount = result.sent ? 1 : 0;
          } else {
            emailError = "No member email on reservation to notify";
          }
        }
      } catch (mailErr: any) {
        emailError = mailErr.message || "Mailer threw";
        console.warn("Chat-message email dispatch failed:", emailError);
      }

      res.json({
        success: true,
        emailSent,
        emailError,
        emailRecipientCount,
        message: {
          ...createdMessage,
          author_name:
            senderName ||
            (senderRole === "admin" ? "Church Administrator" : "Member"),
          admin_name: senderRole === "admin" ? senderName : null,
          user_name: senderRole === "user" ? senderName : null,
        },
      });
    } catch (err: any) {
      console.error("Reservations list error:", err);
      res.status(500).json({
        success: false,
        error: err.message,
        cause: err.cause?.message,
      });
    }
  },
);

/**
 * 15b. Musician Ministry Profile Stats (celebration & recognition)
 */
router.get(
  "/ministry-stats",
  async (req: Request, res: Response): Promise<void> => {
    try {
      const sessionIdentity = await extractSessionIdentity(req);
      const targetUserId =
        (req.query.userId as string) || sessionIdentity?.userId;

      if (!targetUserId) {
        res.status(400).json({ success: false, error: "User ID is required." });
        return;
      }

      const userRes = await db.execute(sql`
        SELECT id, name, phone_number, created_at, is_trusted
        FROM users WHERE id = ${targetUserId} LIMIT 1
      `);
      const userRows = (userRes as any).rows || [];
      if (userRows.length === 0) {
        res.status(404).json({ success: false, error: "User not found." });
        return;
      }
      const user = userRows[0];

      const reservationsRes = await db.execute(sql`
        SELECT 
          r.id,
          r.status,
          r.service_name,
          r.musician_name,
          r.band_pack_id,
          r.condition_status,
          r.condition_checked_at,
          r.is_no_show,
          lower(r.time_range) as start_time,
          upper(r.time_range) as end_time,
          ROUND(EXTRACT(EPOCH FROM (upper(r.time_range) - lower(r.time_range))) / 3600.0, 1) as duration_hours,
          i.name as instrument_name,
          i.type as instrument_type
        FROM reservations r
        JOIN instruments i ON r.instrument_id = i.id
        WHERE r.user_id = ${targetUserId}
        ORDER BY lower(r.time_range) DESC
      `);

      const rows = (reservationsRes as any).rows || [];

      let totalHours = 0;
      let totalServices = 0;
      let noShows = 0;
      let conditionChecksCount = 0;
      const instrumentHours: Record<
        string,
        { count: number; hours: number; type: string }
      > = {};
      const serviceCategoryCounts: Record<string, number> = {};

      for (const r of rows) {
        const hours = Number(r.duration_hours) || 0;
        if (r.is_no_show) {
          noShows++;
        }
        if (["approved", "completed", "ongoing"].includes(r.status)) {
          totalHours += hours;
          totalServices++;

          const instName = r.instrument_name || "Instrument";
          if (!instrumentHours[instName]) {
            instrumentHours[instName] = {
              count: 0,
              hours: 0,
              type: r.instrument_type || "Instrument",
            };
          }
          instrumentHours[instName].count += 1;
          instrumentHours[instName].hours += hours;

          const sName = (r.service_name || "").toLowerCase();
          let cat = "Other Church Service";
          if (sName.includes("شباب") || sName.includes("youth")) {
            cat = "Youth Meeting (اجتماع الشباب)";
          } else if (
            sName.includes("قداس") ||
            sName.includes("liturgy") ||
            sName.includes("أحد") ||
            sName.includes("جمعة")
          ) {
            cat = "Liturgy & Worship (قداسات وصلوات)";
          } else if (
            sName.includes("كورال") ||
            sName.includes("choir") ||
            sName.includes("ترانيم")
          ) {
            cat = "Choir Rehearsal (بروفة كورال)";
          } else if (
            sName.includes("صلاة") ||
            sName.includes("prayer") ||
            sName.includes("عشية")
          ) {
            cat = "Prayer & Praise (اجتماع صلاة وتسبيح)";
          } else if (r.service_name) {
            cat = r.service_name;
          }

          serviceCategoryCounts[cat] = (serviceCategoryCounts[cat] || 0) + 1;
        }

        if (r.condition_status && r.condition_status !== "uninspected") {
          conditionChecksCount++;
        }
      }

      const topInstruments = Object.entries(instrumentHours)
        .map(([name, data]) => ({ name, ...data }))
        .sort((a, b) => b.hours - a.hours)
        .slice(0, 5);

      const badges = [
        {
          id: "faithful_servant",
          titleAr: "خادم أمين وموثوق",
          titleEn: "Faithful & Reliable Servant",
          descAr: "حضور كامل ومسؤول بدون أي غياب مسجل",
          descEn: "100% attendance with zero no-shows recorded",
          icon: "ShieldCheck",
          unlocked: noShows === 0 && totalServices >= 2,
          progress: `${Math.min(totalServices, 2)}/2`,
        },
        {
          id: "dedicated_worshipper",
          titleAr: "عازف تسبيح مكرّس",
          titleEn: "Dedicated Musician",
          descAr: "خدم أكثر من 6 ساعات في التسبيح والبروفات",
          descEn: "Served 6+ hours in church musical ministry",
          icon: "Music2",
          unlocked: totalHours >= 6,
          progress: `${Math.round(totalHours)}/6h`,
        },
        {
          id: "instrument_caretaker",
          titleAr: "حارس أمانة الآلات",
          titleEn: "Asset Caretaker",
          descAr: "إجراء فحوصات الاستلام لحماية الآلات",
          descEn: "Documented condition checks for instrument care",
          icon: "CheckCircle2",
          unlocked: conditionChecksCount >= 1,
          progress: `${conditionChecksCount}/1`,
        },
      ];

      res.json({
        success: true,
        stats: {
          userId: user.id,
          userName: user.name,
          userPhone: user.phone_number,
          memberSince: user.created_at,
          isTrusted: user.is_trusted,
          totalHours: Math.round(totalHours * 10) / 10,
          totalServices,
          noShows,
          reliabilityScore:
            totalServices > 0
              ? Math.max(
                  0,
                  Math.round(((totalServices - noShows) / totalServices) * 100),
                )
              : 100,
          conditionChecksCount,
          topInstruments,
          serviceCategoryCounts,
          badges,
        },
      });
    } catch (err: any) {
      console.error("Ministry stats error:", err);
      res.status(500).json({ success: false, error: err.message });
    }
  },
);

/**
 * 15b. GET /quick-rebook-suggestion
 * Analyzes the calling user's (or admin's) routine service patterns and
 * returns the next upcoming routine slot for 1-Tap Quick Re-Book.
 *
 * Admins are musicians too — this endpoint resolves the caller's OWN
 * identity whether they're a regular user or an admin, then looks at
 * their own bookings on the appropriate column (r.user_id or r.admin_id).
 */
router.get(
  "/quick-rebook-suggestion",
  async (req: Request, res: Response): Promise<void> => {
    try {
      // Admins are musicians too — resolve their own identity as either
      // a user (r.user_id) or an admin (r.admin_id). Both kinds can self-book.
      const selfIdentity = await extractSelfBookingIdentity(req);
      if (!selfIdentity) {
        res.json({
          success: true,
          hasSuggestion: false,
          reason: "no-session",
        });
        return;
      }
      const { id: actorId, kind: actorKind } = selfIdentity;

      // A row counts as the caller's own booking when:
      //
      //   - Admin caller:  admin_id = caller  AND  user_id IS NULL
      //   - Member caller: user_id = caller
      //
      // `booked_by_admin` is IGNORED because in this system it is set to
      // `true` on every admin-created row (self or on-behalf), so it cannot
      // distinguish the two. `musician_name` is IGNORED because the spelling
      // varies between reservations.
      //
      // Rows where a member UUID is set in `user_id` are "Book For" bookings
      // made on behalf of someone else and are excluded.
      const ownPredicate =
        actorKind === "user"
          ? sql`r.user_id = ${actorId}`
          : sql`(
              r.admin_id = ${actorId}
              AND r.user_id IS NULL
            )`;

      // 1. Resolve display name (user or admin)
      let userName = "Musician";
      if (actorKind === "user") {
        const userRes = await db.execute(sql`
          SELECT name FROM users WHERE id = ${actorId} LIMIT 1
        `);
        userName = (userRes as any).rows?.[0]?.name || "Musician";
      } else {
        const adminRes = await db.execute(sql`
          SELECT name FROM admins WHERE id = ${actorId} LIMIT 1
        `);
        userName = (adminRes as any).rows?.[0]?.name || "Administrator";
      }

      // 2. Fetch the actor's latest 25 own bookings. The predicate above
      //    selects admin self-bookings (user_id IS NULL) and member
      //    self-bookings (user_id = caller).
      const pastRes = await db.execute(sql`
        SELECT 
          r.id,
          r.instrument_id,
          r.service_name,
          r.musician_name,
          r.reservation_type,
          r.status,
          to_char(lower(r.time_range) AT TIME ZONE 'Africa/Cairo', 'YYYY-MM-DD') as date_str,
          to_char(lower(r.time_range) AT TIME ZONE 'Africa/Cairo', 'FMHH24:MI') as start_time_cairo,
          extract(dow from (lower(r.time_range) AT TIME ZONE 'Africa/Cairo'))::int as dow,
          ROUND(EXTRACT(EPOCH FROM (upper(r.time_range) - lower(r.time_range))) / 3600.0, 1) as duration_hours,
          i.name as instrument_name,
          i.type as instrument_type
        FROM reservations r
        JOIN instruments i ON r.instrument_id = i.id
        WHERE ${ownPredicate}
          AND r.status IN ('approved', 'pending', 'completed')
          AND i.is_removed = false
        ORDER BY lower(r.time_range) DESC
        LIMIT 25
      `);

      const rows = (pastRes as any).rows || [];
      const routineCandidates: any[] = [];

      if (rows.length > 0) {
        // Group by (normalized service name + weekday + start time), NOT by
        // instrument. This collapses the same routine booked on two different
        // instruments (e.g. Roland E-09 and Yamaha E-443 on Sunday 17:00)
        // into ONE suggestion. Rows are ordered DESC by start time, so the
        // first sample we keep is always the member's most recent — that
        // instrument is the one offered on the card.
        const patternCounts: Record<string, { count: number; sample: any }> =
          {};
        for (const row of rows) {
          const svc = String(row.service_name || "")
            .trim()
            .toLowerCase();
          if (!svc) continue; // skip rows without a service name
          const key = `${svc}__${row.dow}__${row.start_time_cairo}`;
          if (!patternCounts[key]) {
            patternCounts[key] = { count: 0, sample: row };
          }
          patternCounts[key].count += 1;
        }

        const sortedPatterns = Object.values(patternCounts)
          .filter(
            (p) =>
              p.sample.service_name && p.sample.service_name.trim().length > 1,
          )
          .sort((a, b) => b.count - a.count);

        if (sortedPatterns.length > 0) {
          // Offer up to 4 distinct routines so the member can pick between
          // multiple equally-valid weekday patterns.
          const top = sortedPatterns.slice(0, 4).map((p) => p.sample);
          for (const candidate of top) routineCandidates.push(candidate);
        } else if (
          rows[0] &&
          rows[0].service_name &&
          rows[0].service_name.trim().length > 1
        ) {
          routineCandidates.push(rows[0]);
        }
      }

      // No hardcoded fallbacks: only real booking history drives suggestions.
      // If the caller has no past self-bookings, the card is not shown.
      if (routineCandidates.length === 0) {
        res.json({
          success: true,
          hasSuggestion: false,
          reason: "no-history",
        });
        return;
      }

      const dayNamesEn = [
        "Sunday",
        "Monday",
        "Tuesday",
        "Wednesday",
        "Thursday",
        "Friday",
        "Saturday",
      ];
      const dayNamesAr = [
        "الأحد",
        "الإثنين",
        "الثلاثاء",
        "الأربعاء",
        "الخميس",
        "الجمعة",
        "السبت",
      ];

      const suggestionsList: any[] = [];

      for (const routine of routineCandidates) {
        // Skip candidates with no meaningful service name — they'd render
        // as blank cards and confuse the member.
        if (!routine.service_name || !routine.service_name.trim()) {
          continue;
        }

        const targetDow =
          routine.dow !== null && routine.dow !== undefined
            ? Number(routine.dow)
            : 5;
        const nowParts = getCairoParts(new Date());
        const currentDow = new Date(
          Date.UTC(nowParts.year, nowParts.month - 1, nowParts.day, 12, 0, 0),
        ).getUTCDay();
        let diff = targetDow - currentDow;

        const [startH, startM] = (routine.start_time_cairo || "18:00")
          .split(":")
          .map(Number);
        if (diff === 0) {
          if (
            nowParts.hour < startH ||
            (nowParts.hour === startH && nowParts.minute + 15 <= (startM || 0))
          ) {
            diff = 0;
          } else {
            diff = 7;
          }
        } else if (diff < 0) {
          diff += 7;
        }

        const targetDateStr = addDaysToDateString(getCairoDateString(), diff);
        const startLocal = cairoDateTimeToDate(
          targetDateStr,
          routine.start_time_cairo || "18:00",
        );
        const durationHours = Math.max(
          1,
          Math.min(8, Number(routine.duration_hours) || 2),
        );
        const endLocal = new Date(
          startLocal.getTime() + durationHours * 3600 * 1000,
        );

        // Already-booked check uses the same ownPredicate so admins see
        // "Already Booked" correctly against their own self-bookings
        // (rows where user_id IS NULL).
        const existingUserBooking = await db.execute(sql`
          SELECT id, status FROM reservations r
          WHERE ${ownPredicate}
            AND r.instrument_id = ${routine.instrument_id}
            AND r.status IN ('approved', 'pending')
            AND r.time_range && tstzrange(${startLocal.toISOString()}, ${endLocal.toISOString()}, '[)')
          LIMIT 1
        `);
        const alreadyBookedRow = (existingUserBooking as any).rows?.[0];

        const conflictCheck = await db.execute(sql`
          SELECT id FROM reservations r
          WHERE r.instrument_id = ${routine.instrument_id}
            AND r.status IN ('approved', 'pending')
            AND r.time_range && tstzrange(${startLocal.toISOString()}, ${endLocal.toISOString()}, '[)')
            ${alreadyBookedRow ? sql`AND r.id != ${alreadyBookedRow.id}` : sql``}
          LIMIT 1
        `);
        const isAvailable = (conflictCheck as any).rows?.length === 0;

        const endTotalMinutes =
          startH * 60 + (startM || 0) + Math.round(durationHours * 60);
        const endH = Math.floor(endTotalMinutes / 60);
        const endM = endTotalMinutes % 60;
        const endTimeCairo = `${String(endH).padStart(2, "0")}:${String(endM).padStart(2, "0")}`;

        suggestionsList.push({
          instrumentId: routine.instrument_id,
          instrumentName: routine.instrument_name,
          instrumentType: routine.instrument_type,
          serviceName: routine.service_name || "",
          musicianName: routine.musician_name || userName,
          date: targetDateStr,
          dayNameEn: dayNamesEn[targetDow],
          dayNameAr: dayNamesAr[targetDow],
          startTime: routine.start_time_cairo || "18:00",
          endTime: endTimeCairo,
          duration: durationHours,
          reservationType: routine.reservation_type || "in_church",
          isAvailable,
          alreadyBooked: Boolean(alreadyBookedRow),
          alreadyBookedStatus: alreadyBookedRow?.status || null,
          alreadyBookedId: alreadyBookedRow?.id || null,
        });
      }

      // Final safety net: dedupe by (serviceName + day + startTime) so the
      // same routine can never appear twice in the dropdown, and drop any
      // entry that ended up with an empty service name.
      const seen = new Set<string>();
      const dedupedSuggestions = suggestionsList.filter((s) => {
        if (!s.serviceName || !String(s.serviceName).trim()) return false;
        const key = `${String(s.serviceName).trim().toLowerCase()}__${s.dayNameEn}__${s.startTime}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });

      if (
        typeof process !== "undefined" &&
        process.env?.NODE_ENV !== "production"
      ) {
        console.info(
          "[QuickRebook] actor=",
          actorId,
          "kind=",
          actorKind,
          "historyRows=",
          rows.length,
          "deduped=",
          dedupedSuggestions.length,
        );
      }

      res.json({
        success: true,
        hasSuggestion: dedupedSuggestions.length > 0,
        suggestion: dedupedSuggestions[0] || null,
        allSuggestions: dedupedSuggestions,
      });
    } catch (err: any) {
      console.error("Quick rebook suggestion error:", err);
      res.status(500).json({ success: false, error: err.message });
    }
  },
);

/**
 * 16. Get single reservation detail
 */
router.get("/:id", async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    await ensureCurrentReservationStatuses().catch(() => {});

    const authHeader = req.headers.authorization;
    const token = authHeader?.startsWith("Bearer ")
      ? authHeader.substring(7)
      : (req.headers["x-session-token"] as string);

    let isAdmin = false;
    if (token) {
      try {
        const { valid, session } = await validateSession(token);
        if (
          valid &&
          session &&
          (session.role === "admin" ||
            session.role === "super_admin" ||
            session.user?.isSuperAdmin)
        ) {
          isAdmin = true;
        }
      } catch {
        // Continue with standard permissions
      }
    }

    const result = await db.execute(sql`
      SELECT 
        r.id,
        r.series_id,
        r.user_id,
        r.admin_id,
        r.instrument_id,
        r.service_name,
        r.service_location,
        r.musician_name,
        r.note,
        r.reservation_type,
        r.fee_snapshot,
        r.status,
        r.rejection_reason,
        r.payment_screenshot_url,
        r.band_pack_id,
        r.condition_status,
        r.condition_notes,
        r.condition_photo_url,
        r.condition_tags,
        r.condition_checked_at,
        r.condition_checked_by,
        r.created_at,
        r.is_no_show,
        r.no_show_marked_at,
        r.no_show_admin_id,
        r.booked_by_admin,
        lower(r.time_range) as start_time,
        upper(r.time_range) as end_time,
        to_char(lower(r.time_range) AT TIME ZONE 'Africa/Cairo', 'HH24:MI') as start_hhmm,
        to_char(upper(r.time_range) AT TIME ZONE 'Africa/Cairo', 'HH24:MI') as end_hhmm,
        ROUND(EXTRACT(EPOCH FROM (upper(r.time_range) - lower(r.time_range))) / 3600.0, 1) as duration_hours,
        i.name as instrument_name,
        i.type as instrument_type,
        i.booking_mode,
        i.outside_fee_per_day,
        i.is_reserve_pool,
        i.is_removed as instrument_is_removed,
        i.photo_url as instrument_photo_url,
        i.description as instrument_description,
        s.pattern_type as series_pattern_type,
        u.name as user_name,
        u.phone_number as user_phone,
        u.is_trusted as user_is_trusted,
        a.name as admin_name
      FROM reservations r
      JOIN instruments i ON r.instrument_id = i.id
      LEFT JOIN reservation_series s ON r.series_id = s.id
      LEFT JOIN users u ON r.user_id = u.id
      LEFT JOIN admins a ON r.admin_id = a.id
      WHERE r.id = ${id}
      LIMIT 1
    `);

    const rows = (result as any).rows || [];
    if (rows.length === 0) {
      res.status(404).json({ success: false, error: "Reservation not found" });
      return;
    }

    const r = rows[0];
    const isFullDay =
      (r.start_hhmm === "09:00" && r.end_hhmm === "22:00") ||
      Number(r.duration_hours) >= 13;

    let bandPackItems: any[] = [];
    if (r.band_pack_id) {
      const packRes = await db.execute(sql`
        SELECT 
          r2.id,
          r2.instrument_id,
          r2.musician_name,
          r2.status,
          r2.condition_status,
          i2.name as instrument_name,
          i2.type as instrument_type,
          i2.photo_url as instrument_photo_url,
          i2.is_removed as instrument_is_removed,
          i2.is_reserve_pool
        FROM reservations r2
        JOIN instruments i2 ON r2.instrument_id = i2.id
        WHERE r2.band_pack_id = ${r.band_pack_id}
        ORDER BY r2.created_at ASC
      `);
      bandPackItems = ((packRes as any).rows || []).map((bp: any) => {
        return {
          ...bp,
          instrument_is_masked: false,
        };
      });
    }

    const processedReservation = {
      ...r,
      instrument_is_masked: false,
      is_full_day: isFullDay,
      isFullDay,
      band_pack_items: bandPackItems,
    };

    res.json({
      success: true,
      reservation: processedReservation,
    });
  } catch (err: any) {
    console.error("Reservations list error:", err);
    res
      .status(500)
      .json({ success: false, error: err.message, cause: err.cause?.message });
  }
});

/**
 * 17. Query reservations (with bounds extracted)
 */
router.get("/", async (req: Request, res: Response): Promise<void> => {
  try {
    const { userId, instrumentId, status, seriesId } = req.query;

    await ensureCurrentReservationStatuses().catch(() => {});

    const authHeader = req.headers.authorization;
    const token = authHeader?.startsWith("Bearer ")
      ? authHeader.substring(7)
      : (req.headers["x-session-token"] as string);

    let isAdmin = false;
    let currentUserId: string | null = null;
    if (token) {
      try {
        const { valid, session } = await validateSession(token);
        if (valid && session) {
          currentUserId = session.user?.id || session.userId || null;
          if (
            session.role === "admin" ||
            session.role === "super_admin" ||
            session.user?.isSuperAdmin
          ) {
            isAdmin = true;
          }
        }
      } catch {
        // Continue with guest/standard permissions
      }
    }

    const result = await db.execute(sql`
      SELECT 
        r.id,
        r.series_id,
        r.user_id,
        r.admin_id,
        r.instrument_id,
        r.service_name,
        r.service_location,
        r.musician_name,
        r.note,
        r.reservation_type,
        r.fee_snapshot,
        r.status,
        r.rejection_reason,
        r.payment_screenshot_url,
        r.band_pack_id,
        r.condition_status,
        r.condition_notes,
        r.condition_photo_url,
        r.condition_tags,
        r.condition_checked_at,
        r.condition_checked_by,
        r.created_at,
        r.is_no_show,
        r.no_show_marked_at,
        r.no_show_admin_id,
        r.booked_by_admin,
        lower(r.time_range) as start_time,
        upper(r.time_range) as end_time,
        to_char(lower(r.time_range) AT TIME ZONE 'Africa/Cairo', 'HH24:MI') as start_hhmm,
        to_char(upper(r.time_range) AT TIME ZONE 'Africa/Cairo', 'HH24:MI') as end_hhmm,
        ROUND(EXTRACT(EPOCH FROM (upper(r.time_range) - lower(r.time_range))) / 3600.0, 1) as duration_hours,
        i.name as instrument_name,
        i.type as instrument_type,
        i.booking_mode,
        i.outside_fee_per_day,
        i.is_reserve_pool,
        i.is_removed as instrument_is_removed,
        i.photo_url as instrument_photo_url,
        i.description as instrument_description,
        s.pattern_type as series_pattern_type,
        COALESCE(u.name, a.name, 'Administrator') as user_name,
        u.phone_number as user_phone,
        u.is_trusted as user_is_trusted,
        a.name as admin_name
      FROM reservations r
      JOIN instruments i ON r.instrument_id = i.id
      LEFT JOIN reservation_series s ON r.series_id = s.id
      LEFT JOIN users u ON r.user_id = u.id
      LEFT JOIN admins a ON r.admin_id = a.id
      WHERE 1=1
      ${
        userId
          ? sql`AND (r.user_id = ${userId as string} OR ${isAdmin ? sql`(r.admin_id = ${userId as string} AND r.booked_by_admin = true)` : sql`false`})`
          : sql``
      }
      ${instrumentId ? sql`AND r.instrument_id = ${instrumentId as string}` : sql``}
      ${status ? ((status as string).includes(",") ? sql`AND r.status = ANY(string_to_array(${status as string}, ','))` : sql`AND r.status = ${status as string}`) : sql``}
      ${seriesId ? sql`AND r.series_id = ${seriesId as string}` : sql``}
      ORDER BY lower(r.time_range) ASC
    `);

    const rows = (result as any).rows || [];
    const sanitizedRows = rows.map((r: any) => {
      const isFullDay =
        (r.start_hhmm === "09:00" && r.end_hhmm === "22:00") ||
        Number(r.duration_hours) >= 13;
      const isOwn =
        currentUserId &&
        (r.user_id === currentUserId || r.admin_id === currentUserId);

      if (isAdmin) {
        return {
          ...r,
          is_full_day: isFullDay,
          isFullDay,
          instrument_is_masked: false,
        };
      }

      const shouldMask = false;
      const maskedName = r.instrument_name;
      const maskedDesc = r.instrument_description;
      const maskedPhoto = r.instrument_photo_url;

      if (isOwn && userId && String(userId) === currentUserId) {
        return {
          ...r,
          instrument_name: maskedName,
          instrument_description: maskedDesc,
          instrument_photo_url: maskedPhoto,
          instrument_is_masked: shouldMask,
          is_full_day: isFullDay,
          isFullDay,
        };
      }
      return {
        ...r,
        instrument_name: maskedName,
        instrument_description: maskedDesc,
        instrument_photo_url: maskedPhoto,
        instrument_is_masked: shouldMask,
        is_full_day: isFullDay,
        isFullDay,
        user_name: undefined,
        user_phone: undefined,
        service_name: undefined,
        payment_screenshot_url: undefined,
        user_id: undefined,
        admin_id: undefined,
      };
    });

    res.json({ success: true, reservations: sanitizedRows });
  } catch (err: any) {
    console.error("Reservations list error:", err);
    res
      .status(500)
      .json({ success: false, error: err.message, cause: err.cause?.message });
  }
});

export default router;
