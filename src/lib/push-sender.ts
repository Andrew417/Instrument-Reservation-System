import { initializeApp, getApps, cert, type App } from "firebase-admin/app";
import { getMessaging, type MulticastMessage } from "firebase-admin/messaging";
import { db } from "../db/index.js";
import { pushTokens } from "../db/schema.js";
import { inArray } from "drizzle-orm";

let firebaseAdminApp: App | null = null;
let initialized = false;

/**
 * Lazily initialize Firebase Admin SDK using available environment credentials
 */
export function getFirebaseAdmin(): App | null {
  if (initialized) {
    return firebaseAdminApp;
  }
  initialized = true;

  try {
    const existingApps = getApps();
    if (existingApps.length > 0) {
      firebaseAdminApp = existingApps[0];
      return firebaseAdminApp;
    }

    if (process.env.FIREBASE_SERVICE_ACCOUNT) {
      try {
        const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
        firebaseAdminApp = initializeApp({
          credential: cert(serviceAccount),
        });
        return firebaseAdminApp;
      } catch (parseErr) {
        console.warn("[FCM] Failed to parse FIREBASE_SERVICE_ACCOUNT JSON:", parseErr);
      }
    }

    if (
      process.env.FIREBASE_PROJECT_ID &&
      process.env.FIREBASE_CLIENT_EMAIL &&
      process.env.FIREBASE_PRIVATE_KEY
    ) {
      const privateKey = process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, "\n");
      firebaseAdminApp = initializeApp({
        credential: cert({
          projectId: process.env.FIREBASE_PROJECT_ID,
          clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
          privateKey,
        }),
      });
      return firebaseAdminApp;
    }

    if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
      firebaseAdminApp = initializeApp();
      return firebaseAdminApp;
    }

    // No credentials configured in environment
    return null;
  } catch (err: any) {
    console.warn(
      "[FCM] Firebase Admin credentials not configured or initialization failed:",
      err?.message || err,
    );
    firebaseAdminApp = null;
    return null;
  }
}

export interface PushPayload {
  title: string;
  body: string;
  data?: Record<string, string>;
  collapseKey?: string;
  icon?: string;
}

/**
 * Remove invalid or unregistered tokens from database
 */
export async function removeInvalidTokens(invalidTokens: string[]): Promise<void> {
  if (!invalidTokens || invalidTokens.length === 0) return;
  try {
    await db.delete(pushTokens).where(inArray(pushTokens.token, invalidTokens));
    console.log(`[FCM] Cleaned up ${invalidTokens.length} unregistered/invalid push token(s).`);
  } catch (dbErr: any) {
    console.warn("[FCM] Failed to remove invalid tokens from database:", dbErr?.message);
  }
}

/**
 * Sends multicast push notifications via Firebase Cloud Messaging.
 * Never throws an error to the caller; cleans up dead tokens automatically.
 */
export async function sendPushMulticast(
  tokens: string[],
  payload: PushPayload,
): Promise<{ successCount: number; failureCount: number }> {
  if (!tokens || tokens.length === 0) {
    return { successCount: 0, failureCount: 0 };
  }

  const appInstance = getFirebaseAdmin();
  if (!appInstance) {
    console.warn("[FCM] Push skipped: Firebase Admin SDK not configured.");
    return { successCount: 0, failureCount: tokens.length };
  }

  // De-duplicate tokens
  const uniqueTokens = Array.from(new Set(tokens.filter(Boolean)));
  if (uniqueTokens.length === 0) {
    return { successCount: 0, failureCount: 0 };
  }

  const stringData: Record<string, string> = {};
  if (payload.data) {
    for (const [key, val] of Object.entries(payload.data)) {
      if (val !== undefined && val !== null) {
        stringData[key] = String(val);
      }
    }
  }

  const message: MulticastMessage = {
    tokens: uniqueTokens,
    notification: {
      title: payload.title,
      body: payload.body,
    },
    data: stringData,
    webpush: {
      headers: payload.collapseKey
        ? {
            Topic: payload.collapseKey,
            Urgency: "high",
          }
        : { Urgency: "high" },
      notification: {
        title: payload.title,
        body: payload.body,
        icon: payload.icon || "/logo.png",
        badge: "/logo.png",
        tag: payload.collapseKey,
        renotify: !payload.collapseKey,
        data: stringData,
      },
      fcmOptions: {
        link: stringData.url || "/",
      },
    },
  };

  try {
    const messaging = getMessaging(appInstance);
    const response = await messaging.sendEachForMulticast(message);
    const deadTokens: string[] = [];

    response.responses.forEach((resp, idx) => {
      if (!resp.success && resp.error) {
        const code = resp.error.code;
        if (
          code === "messaging/registration-token-not-registered" ||
          code === "messaging/invalid-registration-token" ||
          code === "messaging/invalid-argument"
        ) {
          deadTokens.push(uniqueTokens[idx]);
        } else {
          console.warn(`[FCM] Token delivery failure (${code}):`, resp.error.message);
        }
      }
    });

    if (deadTokens.length > 0) {
      await removeInvalidTokens(deadTokens);
    }

    return {
      successCount: response.successCount,
      failureCount: response.failureCount,
    };
  } catch (err: any) {
    console.error("[FCM] Error dispatching multicast push notification:", err?.message || err);
    return { successCount: 0, failureCount: uniqueTokens.length };
  }
}
