import { Router, Request, Response } from "express";
import { dispatchSystemNotification } from "./notifications-service.js";
import {
  createReservation,
  createReservationSeries,
  editReservation,
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
router.post(
  "/series",
  async (req: Request, res: Response): Promise<void> => {
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

      const sessionIdentity = await extractSessionIdentity(req);
      const payload = {
        ...req.body,
        ...(sessionIdentity
          ? { userId: sessionIdentity.userId, adminId: sessionIdentity.adminId }
          : {}),
      };
      const result = await createReservationSeries(payload);
      res.status(201).json({ success: true, ...result });
    } catch (err: any) {
      console.error("Reservation series create error:", err);
      const msg: string =
        err.message || "Failed to create reservation series.";
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
  },
);

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
    const sessionIdentity = await extractSessionIdentity(req);
    const payload = {
      ...req.body,
      ...(sessionIdentity
        ? { userId: sessionIdentity.userId, adminId: sessionIdentity.adminId }
        : {}),
    };
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
 * FIX: Actor identity is ALWAYS resolved from the Bearer session token — never
 * trusted from the request body. This is what lets Admins / Super Admin edit
 * reservations belonging to other users.
 */
router.put("/:id", async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    // FIX: strip client-supplied identity claims so they can't be spoofed.
    const rawBody = (req.body ?? {}) as Record<string, unknown>;
    const updates: Record<string, unknown> = { ...rawBody };
    delete updates.userId;
    delete updates.adminId;
    delete updates.isSuperAdmin;

    const sessionIdentity = await extractSessionIdentity(req);

    // FIX: build the actor from the token; only fall back to a body userId
    // (never a body adminId) when there is no session at all.
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
        // Initialize default payment settings
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

      // Resolve actor identity from the Bearer token (same pattern as other routes)
      const sessionIdentity = await extractSessionIdentity(req);

      // Fetch the reservation to verify ownership
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

      // If we have a session token, enforce ownership for non-admins.
      // Admins / super_admins may delete on behalf of any reservation.
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
      // If no session identity is present, we still allow the request
      // (matches the trust model of the existing POST endpoint in this file,
      //  which also has no auth check). If you want stricter behavior,
      // return 401 here instead.

      // Clear the screenshot column
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
 * No DB schema changes: uses existing payment_screenshot_url as proof.
 */
router.post(
  "/:id/confirm-paid",
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { id } = req.params;

      // Resolve actor from Bearer token
      const sessionIdentity = await extractSessionIdentity(req);

      // Load reservation + member + instrument context
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

      // Ownership check (session-based)
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

      // Send email via shared mailer
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

      // Also insert in-app notifications for approved admins (fallback / belt & suspenders)
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

      // Check session identity from bearer token
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

      // Fetch reservation record (expanded with contact + slot context for email dispatch)
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

      // Create notifications
      try {
        if (senderRole === "user") {
          // Notify approved admins of user reply (excluding sender if admin)
          await dispatchSystemNotification({
            broadcastToAdmins: true,
            actorId: userId || null,
            reservationId: id,
            type: "user_reply",
            bellMessage: `${senderName || "Member"} replied on reservation "${resRecord?.service_name || "Reservation"}": "${content.trim()}"`,
            pushCategory: "chat",
            metadata: {
              senderName: senderName || "Member",
              content: content.trim(),
            },
          });
        } else {
          // Notify user of admin message (excluding sender if admin)
          if (resRecord?.user_id) {
            await dispatchSystemNotification({
              userId: resRecord.user_id,
              actorId: adminId || null,
              reservationId: id,
              type: "admin_message",
              bellMessage: `New message from administration regarding "${resRecord.service_name || "Reservation"}": "${content.trim()}"`,
              pushCategory: "chat",
              metadata: {
                senderName: senderName || "Administration",
                content: content.trim(),
              },
            });
          }
        }
      } catch (notifErr: any) {
        console.warn(
          "Could not insert chat message notification:",
          notifErr.message,
        );
      }

      // Send email notification to the other party
      let emailSent = false;
      let emailError: string | null = null;
      let emailRecipientCount = 0;
      try {
        if (senderRole === "user") {
          // Member replied → email all approved admins
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
          // Admin sent → email the reservation's owning member (if any)
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

      // Get user info
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

      // Get all user reservations
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
 * Analyzes the user's routine service patterns and calculates the next upcoming routine slot
 * for 1-Tap Quick Re-Book.
 */
router.get(
  "/quick-rebook-suggestion",
  async (req: Request, res: Response): Promise<void> => {
    try {
      const sessionIdentity = await extractSessionIdentity(req);
      const userId = sessionIdentity?.userId;
      if (!userId) {
        res.json({ success: true, hasSuggestion: false });
        return;
      }

      // 1. Get user name
      const userRes = await db.execute(sql`
        SELECT name FROM users WHERE id = ${userId} LIMIT 1
      `);
      const userName = (userRes as any).rows?.[0]?.name || "Musician";

      // 2. Fetch user's latest 25 reservations
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
        WHERE r.user_id = ${userId}
          AND r.status IN ('approved', 'pending', 'completed')
          AND i.is_removed = false
        ORDER BY lower(r.time_range) DESC
        LIMIT 25
      `);

      const rows = (pastRes as any).rows || [];
      const routineCandidates: any[] = [];

      if (rows.length > 0) {
        // Group by pattern (instrumentId + dow + start_time_cairo)
        const patternCounts: Record<string, { count: number; sample: any }> = {};
        for (const row of rows) {
          const key = `${row.instrument_id}__${row.dow}__${row.start_time_cairo}`;
          if (!patternCounts[key]) {
            patternCounts[key] = { count: 0, sample: row };
          }
          patternCounts[key].count += 1;
        }

        const sortedPatterns = Object.values(patternCounts)
          .filter((p) => p.sample.service_name && p.sample.service_name.trim().length > 1)
          .sort((a, b) => b.count - a.count);

        // Include the single best past user pattern if valid
        if (sortedPatterns.length > 0) {
          routineCandidates.push(sortedPatterns[0].sample);
        } else if (rows[0] && rows[0].service_name && rows[0].service_name.trim().length > 1) {
          routineCandidates.push(rows[0]);
        }
      }

      // Always query available instruments to back standard services
      const instRes = await db.execute(sql`
        SELECT id, name, type FROM instruments WHERE is_removed = false ORDER BY name ASC LIMIT 4
      `);
      const instRows = (instRes as any).rows || [];

      if (routineCandidates.length === 0 && instRows.length === 0) {
        res.json({ success: true, hasSuggestion: false });
        return;
      }

      // Primary instrument to use for standard church services
      const primaryInst = routineCandidates[0]
        ? {
            id: routineCandidates[0].instrument_id,
            name: routineCandidates[0].instrument_name,
            type: routineCandidates[0].instrument_type,
          }
        : instRows[0] || { id: "", name: "Instrument", type: "Instrument" };

      // Standard church services to always offer as switchable options
      const standardServices = [
        {
          service_name: "Youth Meeting",
          dow: 5, // Friday
          start_time_cairo: "18:00",
          duration_hours: 2,
        },
        {
          service_name: "Sunday Liturgy",
          dow: 0, // Sunday
          start_time_cairo: "08:30",
          duration_hours: 2.5,
        },
        {
          service_name: "Choir Rehearsal",
          dow: 4, // Thursday
          start_time_cairo: "19:00",
          duration_hours: 2,
        },
      ];

      for (const std of standardServices) {
        // Only append if not already in routineCandidates with identical service name and dow
        const exists = routineCandidates.some(
          (c) =>
            Number(c.dow) === std.dow &&
            c.service_name.trim().toLowerCase() === std.service_name.toLowerCase(),
        );
        if (!exists && routineCandidates.length < 5) {
          routineCandidates.push({
            instrument_id: primaryInst.id,
            instrument_name: primaryInst.name,
            instrument_type: primaryInst.type,
            service_name: std.service_name,
            musician_name: userName,
            dow: std.dow,
            start_time_cairo: std.start_time_cairo,
            duration_hours: std.duration_hours,
            reservation_type: "in_church",
          });
        }
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
        // Calculate next target date for this day of week (dow: 0=Sun, 1=Mon, ..., 5=Fri, 6=Sat)
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

        // Check if user already has an active booking for this slot
        const existingUserBooking = await db.execute(sql`
          SELECT id, status FROM reservations
          WHERE user_id = ${userId}
            AND instrument_id = ${routine.instrument_id}
            AND status IN ('approved', 'pending')
            AND time_range && tstzrange(${startLocal.toISOString()}, ${endLocal.toISOString()}, '[)')
          LIMIT 1
        `);
        const alreadyBookedRow = (existingUserBooking as any).rows?.[0];

        // Check if another reservation conflicts
        const conflictCheck = await db.execute(sql`
          SELECT id FROM reservations
          WHERE instrument_id = ${routine.instrument_id}
            AND status IN ('approved', 'pending')
            AND time_range && tstzrange(${startLocal.toISOString()}, ${endLocal.toISOString()}, '[)')
            ${alreadyBookedRow ? sql`AND id != ${alreadyBookedRow.id}` : sql``}
          LIMIT 1
        `);
        const isAvailable = (conflictCheck as any).rows?.length === 0;

        const endTotalMinutes = startH * 60 + (startM || 0) + Math.round(durationHours * 60);
        const endH = Math.floor(endTotalMinutes / 60);
        const endM = endTotalMinutes % 60;
        const endTimeCairo = `${String(endH).padStart(2, "0")}:${String(endM).padStart(2, "0")}`;

        suggestionsList.push({
          instrumentId: routine.instrument_id,
          instrumentName: routine.instrument_name,
          instrumentType: routine.instrument_type,
          serviceName: routine.service_name || "Youth Meeting",
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

      res.json({
        success: true,
        hasSuggestion: suggestionsList.length > 0,
        suggestion: suggestionsList[0] || null,
        allSuggestions: suggestionsList,
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

    // Ensure status transitions are up-to-date in serverless environment
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
        u.is_trusted as user_is_trusted
      FROM reservations r
      JOIN instruments i ON r.instrument_id = i.id
      LEFT JOIN reservation_series s ON r.series_id = s.id
      LEFT JOIN users u ON r.user_id = u.id
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

    // Fetch sibling reservations in same Band Pack if applicable
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

    // Ensure status transitions are up-to-date in serverless environment
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
        u.is_trusted as user_is_trusted
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
        // User querying their own reservations (MyReservations view)
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
      // For regular users querying instruments / general calendars:
      // Redact reservant identity, phone, payment, and service name completely
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
