import { Router, Request, Response } from "express";
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
 * 2. Create single reservation
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
    console.error("Reservations list error:", err);
    res
      .status(500)
      .json({ success: false, error: err.message, cause: err.cause?.message });
  }
});

/**
 * 3. Create recurring reservation series
 */
router.post("/series", async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.body.serviceName || !req.body.serviceName.trim()) {
      res.status(400).json({
        success: false,
        error:
          "What this reservation is for (service_name) is required for the series.",
      });
      return;
    }
    if (!req.body.musicianName || !req.body.musicianName.trim()) {
      res.status(400).json({
        success: false,
        error: "Musician name is required for the series.",
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
    console.error("Reservations list error:", err);
    res
      .status(500)
      .json({ success: false, error: err.message, cause: err.cause?.message });
  }
});

/**
 * 4. Edit a reservation
 *
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

      // Fetch reservation record
      const resInfo = await db.execute(
        sql`SELECT r.user_id, r.service_name, u.name as user_name FROM reservations r LEFT JOIN users u ON r.user_id = u.id WHERE r.id = ${id}`,
      );
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
          // Notify approved admins of user reply
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
          // Notify user of admin message
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

      res.json({
        success: true,
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
 * 16. Get single reservation detail
 */
router.get("/:id", async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    // Ensure status transitions are up-to-date in serverless environment
    await ensureCurrentReservationStatuses().catch(() => {});

    const result = await db.execute(sql`
      SELECT 
        r.id,
        r.series_id,
        r.user_id,
        r.admin_id,
        r.instrument_id,
        r.service_name,
        r.musician_name,
        r.note,
        r.reservation_type,
        r.fee_snapshot,
        r.status,
        r.rejection_reason,
        r.payment_screenshot_url,
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

    res.json({
      success: true,
      reservation: {
        ...r,
        is_full_day: isFullDay,
        isFullDay,
      },
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
        r.musician_name,
        r.note,
        r.reservation_type,
        r.fee_snapshot,
        r.status,
        r.rejection_reason,
        r.payment_screenshot_url,
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
          ? sql`AND (r.user_id = ${userId as string} OR ${isAdmin ? sql`r.admin_id = ${userId as string}` : sql`false`})`
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
        };
      }
      if (isOwn && userId && String(userId) === currentUserId) {
        // User querying their own reservations (MyReservations view)
        return {
          ...r,
          is_full_day: isFullDay,
          isFullDay,
        };
      }
      // For regular users querying instruments / general calendars:
      // Redact reservant identity, phone, payment, and service name completely
      return {
        ...r,
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
