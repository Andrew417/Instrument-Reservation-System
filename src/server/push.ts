import { Router, Request, Response } from "express";
import { db } from "../db/index.js";
import { sql } from "drizzle-orm";
import { validateSession } from "./session-manager.js";
import { getVapidPublicKey, isPushConfigured } from "../lib/push-vapid.js";
import { sendTestPushToSubscription } from "../lib/push-service.js";

const router = Router();

// In-memory rate limiting map for test push requests: callerId -> timestamps[]
const testRateLimits = new Map<string, number[]>();

/**
 * Resolves authenticated account identity from Authorization header
 */
async function resolveAccount(req: Request) {
  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith("Bearer ")
    ? authHeader.substring(7).trim()
    : (req.headers["x-session-token"] as string);

  if (!token) return null;

  try {
    const { valid, session } = await validateSession(token);
    if (!valid || !session) return null;

    const isAdmin =
      session.role === "admin" || session.role === "super_admin";

    return {
      userId: isAdmin ? null : session.userId,
      adminId: isAdmin ? session.adminId : null,
      role: session.role,
    };
  } catch {
    return null;
  }
}

/**
 * 1. GET /api/push/public-key
 * Returns the VAPID public key needed by browser pushManager
 */
router.get("/public-key", (_req: Request, res: Response) => {
  try {
    if (!isPushConfigured()) {
      res.json({
        success: false,
        enabled: false,
        error: "Web Push notifications are not configured on this server.",
      });
      return;
    }
    const publicKey = getVapidPublicKey();
    res.json({ success: true, enabled: true, publicKey });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * 2. POST /api/push/subscribe
 * Registers or updates a device subscription for the logged-in user or admin
 */
router.post("/subscribe", async (req: Request, res: Response): Promise<void> => {
  try {
    const account = await resolveAccount(req);
    if (!account) {
      res.status(401).json({ success: false, error: "Authentication required" });
      return;
    }

    const { subscription, language } = req.body;
    if (!subscription || !subscription.endpoint || !subscription.keys) {
      res.status(400).json({ success: false, error: "Invalid subscription payload" });
      return;
    }

    const { endpoint, keys } = subscription;
    const { p256dh, auth } = keys;

    if (!p256dh || !auth) {
      res.status(400).json({ success: false, error: "Missing subscription keys (p256dh, auth)" });
      return;
    }

    const userAgent = req.headers["user-agent"] || null;
    const lang = language === "en" ? "en" : "ar";

    await db.execute(sql`
      INSERT INTO push_subscriptions (
        user_id, admin_id, endpoint, p256dh, auth, user_agent, language, updated_at
      ) VALUES (
        ${account.userId},
        ${account.adminId},
        ${endpoint},
        ${p256dh},
        ${auth},
        ${userAgent},
        ${lang},
        NOW()
      )
      ON CONFLICT (endpoint) DO UPDATE SET
        user_id = EXCLUDED.user_id,
        admin_id = EXCLUDED.admin_id,
        p256dh = EXCLUDED.p256dh,
        auth = EXCLUDED.auth,
        user_agent = EXCLUDED.user_agent,
        language = EXCLUDED.language,
        updated_at = NOW()
    `);

    res.json({ success: true, message: "Subscription saved successfully" });
  } catch (err: any) {
    console.error("[Push Subscribe Error]:", err);
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * 3. POST /api/push/unsubscribe
 * Removes a subscription for a device (requires authentication and deletes only the caller's device)
 */
router.post("/unsubscribe", async (req: Request, res: Response): Promise<void> => {
  try {
    const account = await resolveAccount(req);
    if (!account) {
      res.status(401).json({ success: false, error: "Authentication required" });
      return;
    }

    const { endpoint } = req.body;
    if (!endpoint || typeof endpoint !== "string") {
      res.status(400).json({ success: false, error: "Endpoint is required" });
      return;
    }

    // Delete only if endpoint belongs to this user or admin
    const ownershipCondition = account.userId
      ? sql`user_id = ${account.userId} AND endpoint = ${endpoint}`
      : sql`admin_id = ${account.adminId} AND endpoint = ${endpoint}`;

    const delRes = await db.execute(sql`
      DELETE FROM push_subscriptions WHERE ${ownershipCondition} RETURNING id
    `);

    const deleted = ((delRes as any).rows?.length || 0) > 0;
    res.json({
      success: true,
      message: deleted ? "Unsubscribed successfully" : "No matching subscription found to delete",
      deleted,
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * 4. POST /api/push/test
 * Sends a real test notification to the requester's own devices only.
 * Ignores any foreign endpoint parameter and enforces rate limiting.
 */
router.post("/test", async (req: Request, res: Response): Promise<void> => {
  try {
    const account = await resolveAccount(req);
    if (!account) {
      res.status(401).json({ success: false, error: "Authentication required" });
      return;
    }

    // Rate limiting: max 3 tests per 60 seconds per account
    const callerId = (account.userId || account.adminId) as string;
    const now = Date.now();
    const timestamps = (testRateLimits.get(callerId) || []).filter((t) => now - t < 60000);
    if (timestamps.length >= 3) {
      res.status(429).json({
        success: false,
        error: "Too many test requests. Please wait a moment before sending another test.",
      });
      return;
    }
    timestamps.push(now);
    testRateLimits.set(callerId, timestamps);

    const { language } = req.body;

    // Strictly find subscriptions belonging to the current user or admin (never arbitrary endpoint)
    const condition = account.userId
      ? sql`user_id = ${account.userId}`
      : sql`admin_id = ${account.adminId}`;

    const subsRes = await db.execute(sql`
      SELECT endpoint, language FROM push_subscriptions WHERE ${condition}
    `);
    const targetEndpoints: { endpoint: string; language: string }[] =
      (subsRes as any).rows || [];

    if (targetEndpoints.length === 0) {
      res.status(404).json({
        success: false,
        error: "No active push subscription found for your account. Please enable notifications on this device first.",
      });
      return;
    }

    let successCount = 0;
    for (const sub of targetEndpoints) {
      const result = await sendTestPushToSubscription(
        sub.endpoint,
        sub.language || language || "ar",
      );
      if (result.success) successCount++;
    }

    if (successCount > 0) {
      res.json({
        success: true,
        message: "Test notification sent successfully to your device! Check your screen.",
      });
    } else {
      res.status(500).json({
        success: false,
        error: "Failed to deliver test notification to your device.",
      });
    }
  } catch (err: any) {
    console.error("[Push Test Error]:", err);
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * 5. GET /api/push/preferences
 * Returns the 3 toggle preferences for an authenticated admin
 */
router.get("/preferences", async (req: Request, res: Response): Promise<void> => {
  try {
    const account = await resolveAccount(req);
    if (!account || !account.adminId) {
      res.status(403).json({ success: false, error: "Admin access required" });
      return;
    }

    const prefRes = await db.execute(sql`
      SELECT notify_new_registrations, notify_new_requests, notify_member_messages
      FROM admin_push_preferences
      WHERE admin_id = ${account.adminId}
      LIMIT 1
    `);
    const pref = (prefRes as any).rows?.[0] || {
      notify_new_registrations: true,
      notify_new_requests: true,
      notify_member_messages: true,
    };

    res.json({
      success: true,
      preferences: {
        notifyNewRegistrations: Boolean(pref.notify_new_registrations),
        notifyNewRequests: Boolean(pref.notify_new_requests),
        notifyMemberMessages: Boolean(pref.notify_member_messages),
      },
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * 6. POST /api/push/preferences
 * Updates the 3 toggle preferences for an authenticated admin
 */
router.post("/preferences", async (req: Request, res: Response): Promise<void> => {
  try {
    const account = await resolveAccount(req);
    if (!account || !account.adminId) {
      res.status(403).json({ success: false, error: "Admin access required" });
      return;
    }

    const { notifyNewRegistrations, notifyNewRequests, notifyMemberMessages } = req.body;

    const r = notifyNewRegistrations !== false;
    const q = notifyNewRequests !== false;
    const m = notifyMemberMessages !== false;

    await db.execute(sql`
      INSERT INTO admin_push_preferences (
        admin_id, notify_new_registrations, notify_new_requests, notify_member_messages, updated_at
      ) VALUES (
        ${account.adminId}, ${r}, ${q}, ${m}, NOW()
      )
      ON CONFLICT (admin_id) DO UPDATE SET
        notify_new_registrations = EXCLUDED.notify_new_registrations,
        notify_new_requests = EXCLUDED.notify_new_requests,
        notify_member_messages = EXCLUDED.notify_member_messages,
        updated_at = NOW()
    `);

    res.json({
      success: true,
      preferences: {
        notifyNewRegistrations: r,
        notifyNewRequests: q,
        notifyMemberMessages: m,
      },
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
