import { db } from "../db/index.js";
import { sql } from "drizzle-orm";
import { webpush, getVapidKeys, isPushConfigured } from "./push-vapid.js";
import { waitUntil } from "@vercel/functions";

export interface PushNotificationPayload {
  titleAr: string;
  titleEn: string;
  bodyAr: string;
  bodyEn: string;
  url?: string;
  tag?: string;
  data?: Record<string, any>;
}

export type AdminNotificationCategory =
  | "new_registrations"
  | "new_requests"
  | "member_messages";

/**
 * Registers a background task with Vercel's waitUntil when available,
 * or falls back to a 3-second timeout with Promise.allSettled on local/Node servers.
 * This guarantees the HTTP response is never blocked or delayed, while preventing
 * serverless function freeze before push messages are dispatched.
 */
export function safeWaitUntil(task: Promise<any>): void {
  let vercelHandled = false;
  try {
    if (typeof waitUntil === "function") {
      waitUntil(
        task.catch((err) => {
          console.warn("[Push Service Warning] Background push delivery:", err?.message || err);
        }),
      );
      vercelHandled = true;
    }
  } catch {
    vercelHandled = false;
  }

  if (!vercelHandled) {
    const timeout = new Promise((resolve) => setTimeout(resolve, 3000));
    Promise.allSettled([task, timeout]).catch(() => {});
  }
}

/**
 * Sends a push notification to all active devices of a specific user.
 * Deactivated or unapproved users receive nothing.
 * Automatically wraps execution in safeWaitUntil so serverless execution isn't frozen.
 */
export async function sendPushToUser(
  userId: string,
  payload: PushNotificationPayload,
  excludeSubscriptionEndpoint?: string,
): Promise<{ sent: number; failed: number }> {
  const task = (async () => {
    try {
      if (!isPushConfigured()) {
        return { sent: 0, failed: 0 };
      }

      // Check if user is active and approved
      const userRes = await db.execute(sql`
        SELECT id, is_active, approval_status 
        FROM users 
        WHERE id = ${userId} 
        LIMIT 1
      `);
      const userRow = (userRes as any).rows?.[0];
      if (!userRow || !userRow.is_active || userRow.approval_status !== "approved") {
        return { sent: 0, failed: 0 };
      }

      // Retrieve all device subscriptions for this user
      const subsRes = await db.execute(sql`
        SELECT id, endpoint, p256dh, auth, language 
        FROM push_subscriptions 
        WHERE user_id = ${userId}
      `);
      const subscriptions = (subsRes as any).rows || [];

      return await dispatchToSubscriptions(
        subscriptions,
        payload,
        excludeSubscriptionEndpoint,
      );
    } catch (err: any) {
      console.warn("[Push Service Error] sendPushToUser failed non-fatally:", err?.message || err);
      return { sent: 0, failed: 0 };
    }
  })();

  safeWaitUntil(task);
  return await task;
}

/**
 * Sends a push notification to all approved admins who have enabled
 * the given notification category for themselves.
 * Optionally excludes the admin who initiated the action.
 * Automatically wraps execution in safeWaitUntil so serverless execution isn't frozen.
 */
export async function sendPushToAdmins(
  payload: PushNotificationPayload,
  category: AdminNotificationCategory,
  excludeAdminId?: string | null,
): Promise<{ sent: number; failed: number }> {
  const task = (async () => {
    try {
      if (!isPushConfigured()) {
        return { sent: 0, failed: 0 };
      }

      // Select admins who are approved and have NOT opted out of this category
      const prefColumn =
        category === "new_registrations"
          ? sql`p.notify_new_registrations`
          : category === "new_requests"
            ? sql`p.notify_new_requests`
            : sql`p.notify_member_messages`;

      const adminQuery = sql`
        SELECT s.id, s.endpoint, s.p256dh, s.auth, s.language
        FROM push_subscriptions s
        JOIN admins a ON s.admin_id = a.id
        LEFT JOIN admin_push_preferences p ON a.id = p.admin_id
        WHERE a.approval_status = 'approved'
          ${excludeAdminId ? sql`AND a.id != ${excludeAdminId}` : sql``}
          AND COALESCE(${prefColumn}, true) = true
      `;

      const subsRes = await db.execute(adminQuery);
      const subscriptions = (subsRes as any).rows || [];

      return await dispatchToSubscriptions(subscriptions, payload);
    } catch (err: any) {
      console.warn("[Push Service Error] sendPushToAdmins failed non-fatally:", err?.message || err);
      return { sent: 0, failed: 0 };
    }
  })();

  safeWaitUntil(task);
  return await task;
}

/**
 * Sends a test push notification to a specific single subscription
 */
export async function sendTestPushToSubscription(
  endpoint: string,
  language: string = "ar",
): Promise<{ success: boolean; error?: string }> {
  try {
    if (!isPushConfigured()) {
      return {
        success: false,
        error: "Web Push notifications are not configured on this server.",
      };
    }

    const subsRes = await db.execute(sql`
      SELECT id, endpoint, p256dh, auth, language 
      FROM push_subscriptions 
      WHERE endpoint = ${endpoint}
      LIMIT 1
    `);
    const sub = (subsRes as any).rows?.[0];
    if (!sub) {
      return { success: false, error: "Subscription not found" };
    }

    const isAr = (sub.language || language) === "ar";
    const payload = JSON.stringify({
      title: isAr
        ? "تجربة إشعارات كنيسة مارمرقس"
        : "St. Mark Church Notification Test",
      body: isAr
        ? "تم تفعيل إشعارات الهاتف بنجاح على هذا الجهاز! 🎉"
        : "Push notifications enabled successfully on this device! 🎉",
      icon: "/logo.png",
      badge: "/logo.png",
      tag: "test-notification",
      renotify: true,
      data: {
        url: "/",
        type: "test",
      },
    });

    getVapidKeys(); // ensures keys are ready

    await webpush.sendNotification(
      {
        endpoint: sub.endpoint,
        keys: {
          p256dh: sub.p256dh,
          auth: sub.auth,
        },
      },
      payload,
    );

    return { success: true };
  } catch (err: any) {
    console.warn("[Push Test Error]:", err?.message || err);
    // If expired/gone, remove subscription
    if (err?.statusCode === 410 || err?.statusCode === 404) {
      await db.execute(sql`DELETE FROM push_subscriptions WHERE endpoint = ${endpoint}`).catch(() => {});
    }
    return { success: false, error: err?.message || "Failed to deliver push notification" };
  }
}

/**
 * Internal helper to dispatch to multiple subscriptions in parallel with a 3s timeout.
 */
async function dispatchToSubscriptions(
  subscriptions: any[],
  payload: PushNotificationPayload,
  excludeEndpoint?: string,
): Promise<{ sent: number; failed: number }> {
  if (subscriptions.length === 0) return { sent: 0, failed: 0 };
  if (!isPushConfigured()) return { sent: 0, failed: 0 };

  getVapidKeys(); // initialize VAPID

  let sent = 0;
  let failed = 0;
  const expiredEndpoints: string[] = [];

  const promises = subscriptions.map(async (sub) => {
    if (excludeEndpoint && sub.endpoint === excludeEndpoint) return;

    const isAr = (sub.language || "ar") === "ar";
    const title = isAr ? payload.titleAr : payload.titleEn;
    const body = isAr ? payload.bodyAr : payload.bodyEn;

    const notificationData = JSON.stringify({
      title,
      body,
      icon: "/logo.png",
      badge: "/logo.png",
      tag: payload.tag || undefined,
      renotify: Boolean(payload.tag),
      data: {
        url: payload.url || "/",
        ...payload.data,
      },
    });

    try {
      await webpush.sendNotification(
        {
          endpoint: sub.endpoint,
          keys: {
            p256dh: sub.p256dh,
            auth: sub.auth,
          },
        },
        notificationData,
      );
      sent++;
    } catch (err: any) {
      failed++;
      // HTTP 404 or 410 means subscription is no longer valid or unsubscribed
      if (err?.statusCode === 410 || err?.statusCode === 404) {
        expiredEndpoints.push(sub.endpoint);
      }
    }
  });

  // Execute all deliveries in parallel with a 3-second safeguard timeout
  const batchPromise = Promise.allSettled(promises);
  const timeoutPromise = new Promise<{ timeout: true }>((resolve) =>
    setTimeout(() => resolve({ timeout: true }), 3000),
  );

  await Promise.race([batchPromise, timeoutPromise]);

  // Clean up any dead endpoints
  if (expiredEndpoints.length > 0) {
    try {
      for (const ep of expiredEndpoints) {
        await db.execute(sql`DELETE FROM push_subscriptions WHERE endpoint = ${ep}`);
      }
    } catch {
      // non-fatal
    }
  }

  return { sent, failed };
}
