import { db } from "../db/index.js";
import {
  notifications,
  pushTokens,
  adminPushPreferences,
  users,
  admins,
} from "../db/schema.js";
import { eq, inArray, and, sql } from "drizzle-orm";
import { sendPushMulticast, PushPayload } from "../lib/push-sender.js";

export type PushCategory = "registrations" | "reservations" | "chat" | "system";

export interface PushNotificationContent {
  title: { ar: string; en: string };
  body: { ar: string; en: string };
  url: string;
  collapseKey?: string;
}

export interface DispatchNotificationParams {
  /** Target user (member) ID */
  userId?: string | null;
  /** Single admin ID recipient */
  adminId?: string | null;
  /** Broadcast to all approved admins */
  broadcastToAdmins?: boolean;
  /** The actor who triggered this action (excluded from push notifications) */
  actorId?: string | null;
  /** Associated reservation ID */
  reservationId?: string | null;
  /** Notification type tag (matches existing schema notifications.type) */
  type: string;
  /** In-app bell notification message */
  bellMessage: string;
  /** Push category for admin preference filtering */
  pushCategory?: PushCategory;
  /** Explicit push content (if omitted, push is derived from type or skipped) */
  pushContent?: PushNotificationContent;
  /** Structured metadata for default push content generation */
  metadata?: {
    userName?: string;
    instrumentName?: string;
    date?: string;
    time?: string;
    reason?: string;
    content?: string;
    senderName?: string;
    count?: number;
    url?: string;
  };
}

/**
 * Generates translated push title and body based on event type and metadata
 */
function resolvePushContent(
  type: string,
  meta: DispatchNotificationParams["metadata"] = {},
  reservationId?: string | null,
): PushNotificationContent | null {
  const uName = meta.userName || "عضو";
  const uNameEn = meta.userName || "A member";
  const instName = meta.instrumentName || "الآلة";
  const instNameEn = meta.instrumentName || "Instrument";
  const dateStr = meta.date || "";
  const countStr = meta.count ? String(meta.count) : "";
  const resId = reservationId || "";

  switch (type) {
    case "account_approval_submitted":
      return {
        title: {
          ar: "تسجيل عضو جديد",
          en: "New Member Registration",
        },
        body: {
          ar: `سجل ${uName} وفي انتظار موافقة الإدارة.`,
          en: `${uNameEn} has registered and is awaiting approval.`,
        },
        url: "/?adminTab=approvals",
      };

    case "reservation_submitted":
    case "series_submitted":
      return {
        title: {
          ar: meta.count && meta.count > 1 ? "طلب حجز دوري جديد" : "طلب حجز جديد",
          en: meta.count && meta.count > 1 ? "New Recurring Series Request" : "New Reservation Request",
        },
        body: {
          ar:
            meta.count && meta.count > 1
              ? `طلب حجز سلسلة (${countStr} فترات) من ${uName} لـ ${instName}.`
              : `طلب حجز جديد من ${uName} لـ ${instName}${dateStr ? ` (${dateStr})` : ""}.`,
          en:
            meta.count && meta.count > 1
              ? `New recurring series (${countStr} occurrences) from ${uNameEn} for ${instNameEn}.`
              : `New reservation request from ${uNameEn} for ${instNameEn}${dateStr ? ` (${dateStr})` : ""}.`,
        },
        url: resId ? `/?reservationId=${resId}&tab=details` : "/?adminTab=review",
        collapseKey: "admin-pending-reservations",
      };

    case "user_reply":
      return {
        title: {
          ar: "رسالة جديدة بشأن الحجز",
          en: "New Message on Reservation",
        },
        body: {
          ar: `${meta.senderName || uName}: ${meta.content || "رسالة جديدة"}`,
          en: `${meta.senderName || uNameEn}: ${meta.content || "New message"}`,
        },
        url: resId ? `/?reservationId=${resId}&tab=chat` : "/",
      };

    case "admin_message":
      return {
        title: {
          ar: "رسالة جديدة من الإدارة",
          en: "New Message from Administration",
        },
        body: {
          ar: `${meta.senderName ? `${meta.senderName}: ` : ""}${meta.content || "رسالة جديدة"}`,
          en: `${meta.senderName ? `${meta.senderName}: ` : ""}${meta.content || "New message"}`,
        },
        url: resId ? `/?reservationId=${resId}&tab=chat` : "/",
      };

    case "reservation_approved":
      return {
        title: {
          ar: "تمت الموافقة على حجزك",
          en: "Reservation Approved",
        },
        body: {
          ar: `تمت الموافقة على حجز ${instName}${dateStr ? ` بتاريخ ${dateStr}` : ""}.`,
          en: `Your reservation for ${instNameEn}${dateStr ? ` on ${dateStr}` : ""} has been approved.`,
        },
        url: resId ? `/?reservationId=${resId}&tab=details` : "/",
      };

    case "reservation_rejected":
      return {
        title: {
          ar: "تم رفض طلب الحجز",
          en: "Reservation Rejected",
        },
        body: {
          ar: `تم رفض حجز ${instName}${meta.reason ? `: ${meta.reason}` : ""}.`,
          en: `Your reservation request for ${instNameEn} was rejected${meta.reason ? `: ${meta.reason}` : ""}.`,
        },
        url: resId ? `/?reservationId=${resId}&tab=details` : "/",
      };

    case "reservation_auto_rejected":
      return {
        title: {
          ar: "تم إلغاء الحجز تلقائياً (تعارض)",
          en: "Reservation Auto-Rejected",
        },
        body: {
          ar: `تم إلغاء طلب حجز ${instName} تلقائياً لوجود تعارض مع حجز مؤكد آخر.`,
          en: `Your reservation for ${instNameEn} was auto-rejected due to a conflict with an approved booking.`,
        },
        url: resId ? `/?reservationId=${resId}&tab=details` : "/",
      };

    case "reservation_cancelled":
      return {
        title: {
          ar: "تم إلغاء الحجز من الإدارة",
          en: "Reservation Cancelled",
        },
        body: {
          ar: `تم إلغاء حجز ${instName}${dateStr ? ` بتاريخ ${dateStr}` : ""}${meta.reason ? ` (${meta.reason})` : ""}.`,
          en: `Your reservation for ${instNameEn} was cancelled by an admin${meta.reason ? ` (${meta.reason})` : ""}.`,
        },
        url: resId ? `/?reservationId=${resId}&tab=details` : "/",
      };

    default:
      return null;
  }
}

/**
 * Hook push into the single place where bell notifications are created.
 * Writes to bell notification table and triggers FCM push according to rules.
 */
export async function dispatchSystemNotification(
  params: DispatchNotificationParams,
): Promise<void> {
  const {
    userId,
    adminId,
    broadcastToAdmins = false,
    actorId,
    reservationId,
    type,
    bellMessage,
    pushCategory,
    pushContent: customPushContent,
    metadata = {},
  } = params;

  // 1. Insert in-app bell notification(s)
  try {
    if (broadcastToAdmins) {
      const allAdmins = await db
        .select({ id: admins.id })
        .from(admins)
        .where(eq(admins.approvalStatus, "approved"));

      for (const adm of allAdmins) {
        await db.insert(notifications).values({
          adminId: adm.id,
          reservationId: reservationId || null,
          type,
          message: bellMessage,
        }).catch((err) => {
          console.warn(`[Notification] Bell insert failed for admin ${adm.id}:`, err?.message);
        });
      }
    } else if (adminId) {
      await db.insert(notifications).values({
        adminId,
        reservationId: reservationId || null,
        type,
        message: bellMessage,
      }).catch((err) => {
        console.warn(`[Notification] Bell insert failed for admin ${adminId}:`, err?.message);
      });
    } else if (userId) {
      await db.insert(notifications).values({
        userId,
        reservationId: reservationId || null,
        type,
        message: bellMessage,
      }).catch((err) => {
        console.warn(`[Notification] Bell insert failed for user ${userId}:`, err?.message);
      });
    }
  } catch (bellErr: any) {
    console.error("[Notification] In-app bell dispatch error:", bellErr?.message || bellErr);
  }

  // 2. Resolve push content
  const resolvedContent =
    customPushContent || resolvePushContent(type, metadata, reservationId);

  // If no push mapping for this notification, exit early
  if (!resolvedContent) {
    return;
  }

  // 3. Dispatch FCM Push Notifications
  try {
    if (broadcastToAdmins || adminId) {
      // Determine which category this event maps to
      const category: PushCategory =
        pushCategory ||
        (type === "account_approval_submitted"
          ? "registrations"
          : type === "user_reply"
            ? "chat"
            : "reservations");

      // Fetch all candidate admins
      const targetAdminRows = await db
        .select({ id: admins.id })
        .from(admins)
        .where(eq(admins.approvalStatus, "approved"));

      const candidateAdminIds = targetAdminRows
        .map((a) => a.id)
        .filter((id) => (broadcastToAdmins || id === adminId) && id !== actorId);

      if (candidateAdminIds.length === 0) {
        return;
      }

      // Check admin preferences
      const prefs = await db
        .select()
        .from(adminPushPreferences)
        .where(inArray(adminPushPreferences.adminId, candidateAdminIds));

      const prefsMap = new Map(prefs.map((p) => [p.adminId, p]));

      const allowedAdminIds = candidateAdminIds.filter((admId) => {
        const p = prefsMap.get(admId);
        if (!p) return true; // defaults to true
        if (category === "registrations") return p.notifyRegistrations;
        if (category === "reservations") return p.notifyReservations;
        if (category === "chat") return p.notifyChat;
        return true;
      });

      if (allowedAdminIds.length === 0) {
        return;
      }

      // Fetch push tokens for allowed admins
      const tokens = await db
        .select({
          token: pushTokens.token,
          language: pushTokens.language,
        })
        .from(pushTokens)
        .where(inArray(pushTokens.adminId, allowedAdminIds));

      if (tokens.length === 0) {
        return;
      }

      // Group tokens by language
      const arTokens: string[] = [];
      const enTokens: string[] = [];
      for (const t of tokens) {
        if (t.language === "en") {
          enTokens.push(t.token);
        } else {
          arTokens.push(t.token);
        }
      }

      const commonData = {
        url: resolvedContent.url,
        type,
        reservationId: reservationId || "",
      };

      if (arTokens.length > 0) {
        await sendPushMulticast(arTokens, {
          title: resolvedContent.title.ar,
          body: resolvedContent.body.ar,
          collapseKey: resolvedContent.collapseKey,
          data: commonData,
        });
      }

      if (enTokens.length > 0) {
        await sendPushMulticast(enTokens, {
          title: resolvedContent.title.en,
          body: resolvedContent.body.en,
          collapseKey: resolvedContent.collapseKey,
          data: commonData,
        });
      }
    } else if (userId) {
      // Member push notification:
      // Exclude actor (if member performed the action)
      if (actorId && actorId === userId) {
        return;
      }

      // Deactivated users receive no push
      const [userRow] = await db
        .select({ isActive: users.isActive, approvalStatus: users.approvalStatus })
        .from(users)
        .where(eq(users.id, userId))
        .limit(1);

      if (!userRow || !userRow.isActive || userRow.approvalStatus !== "approved") {
        return;
      }

      // Fetch member's registered tokens
      const memberTokens = await db
        .select({
          token: pushTokens.token,
          language: pushTokens.language,
        })
        .from(pushTokens)
        .where(eq(pushTokens.userId, userId));

      if (memberTokens.length === 0) {
        return;
      }

      const arTokens: string[] = [];
      const enTokens: string[] = [];
      for (const t of memberTokens) {
        if (t.language === "en") {
          enTokens.push(t.token);
        } else {
          arTokens.push(t.token);
        }
      }

      const commonData = {
        url: resolvedContent.url,
        type,
        reservationId: reservationId || "",
      };

      if (arTokens.length > 0) {
        await sendPushMulticast(arTokens, {
          title: resolvedContent.title.ar,
          body: resolvedContent.body.ar,
          collapseKey: resolvedContent.collapseKey,
          data: commonData,
        });
      }

      if (enTokens.length > 0) {
        await sendPushMulticast(enTokens, {
          title: resolvedContent.title.en,
          body: resolvedContent.body.en,
          collapseKey: resolvedContent.collapseKey,
          data: commonData,
        });
      }
    }
  } catch (pushErr: any) {
    // Failure must NEVER break or delay the main request
    console.error("[FCM Push] Non-fatal error while processing push notifications:", pushErr?.message || pushErr);
  }
}
