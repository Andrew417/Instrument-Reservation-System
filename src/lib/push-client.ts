import { getMessaging, getToken, onMessage, isSupported } from "firebase/messaging";
import { app } from "./firebase.js";

const CURRENT_PUSH_TOKEN_KEY = "church_fcm_push_token_v1";

/**
 * Detects if user is browsing inside an in-app browser (WhatsApp, Facebook, Instagram, etc.)
 */
export function isInAppBrowser(): boolean {
  if (typeof window === "undefined" || !window.navigator) return false;
  const ua = window.navigator.userAgent || "";
  return /FBAN|FBAV|Instagram|WhatsApp|Line\/|musical_ly/i.test(ua);
}

/**
 * Detects iOS device (iPhone / iPad / iPod)
 */
export function isIosDevice(): boolean {
  if (typeof window === "undefined" || !window.navigator) return false;
  const ua = window.navigator.userAgent || "";
  const isApple = /iPad|iPhone|iPod/.test(ua);
  const isIpadOs = window.navigator.platform === "MacIntel" && window.navigator.maxTouchPoints > 1;
  return isApple || isIpadOs;
}

/**
 * Checks if the app is currently running as an installed PWA on iOS/iPadOS
 */
export function isIosPwaInstalled(): boolean {
  if (typeof window === "undefined") return false;
  const isStandaloneProp = (window.navigator as any)?.standalone === true;
  const isDisplayStandalone = window.matchMedia("(display-mode: standalone)").matches;
  return isStandaloneProp || isDisplayStandalone;
}

/**
 * Checks if Web Push / Notification is supported in current browser environment
 */
export async function isPushNotificationSupported(): Promise<boolean> {
  if (typeof window === "undefined") return false;
  if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) {
    return false;
  }
  try {
    return await isSupported();
  } catch {
    return false;
  }
}

/**
 * Retrieves current browser notification permission
 */
export function getNotificationPermission(): NotificationPermission {
  if (typeof window === "undefined" || !("Notification" in window)) {
    return "denied";
  }
  return Notification.permission;
}

/**
 * Detect device platform string for token metadata
 */
export function getPlatformType(): string {
  if (isIosDevice()) return isIosPwaInstalled() ? "ios-pwa" : "ios-browser";
  if (typeof window !== "undefined" && /Android/i.test(window.navigator.userAgent)) return "android";
  return "desktop";
}

/**
 * Subscribes to FCM push notifications and registers token with server
 */
export async function registerPushNotification(
  sessionToken: string,
  language: "ar" | "en" = "ar",
): Promise<{ success: boolean; token?: string; error?: string }> {
  try {
    const supported = await isPushNotificationSupported();
    if (!supported) {
      return { success: false, error: "Web push is not supported in this browser." };
    }

    if (isInAppBrowser()) {
      return {
        success: false,
        error: "in_app_browser",
      };
    }

    if (isIosDevice() && !isIosPwaInstalled()) {
      return {
        success: false,
        error: "ios_not_installed",
      };
    }

    // Request native permission
    const permission = await Notification.requestPermission();
    if (permission !== "granted") {
      return { success: false, error: "permission_denied" };
    }

    // Register service worker
    const swRegistration = await navigator.serviceWorker.register("/firebase-messaging-sw.js", {
      scope: "/",
    });
    await navigator.serviceWorker.ready;

    const messaging = getMessaging(app);
    const vapidKey =
      (import.meta as any).env?.VITE_FIREBASE_VAPID_KEY ||
      "BHx3wH_K9U6f9bCq8UfDqD_eB7EwJzQ4UvB2PjY-q6x8rB1e5Y5a2_3f4g5h6j7k8l9"; // Will be overridden by env if present

    let token = "";
    try {
      token = await getToken(messaging, {
        serviceWorkerRegistration: swRegistration,
        vapidKey: (import.meta as any).env?.VITE_FIREBASE_VAPID_KEY ? vapidKey : undefined,
      });
    } catch (tokenErr: any) {
      // Retry without explicit vapidKey if not provided
      token = await getToken(messaging, {
        serviceWorkerRegistration: swRegistration,
      });
    }

    if (!token) {
      return { success: false, error: "Failed to generate FCM push token" };
    }

    // Store in localStorage for cleanup on logout
    localStorage.setItem(CURRENT_PUSH_TOKEN_KEY, token);

    // Sync token with backend
    await syncTokenWithServer(token, sessionToken, language);

    return { success: true, token };
  } catch (err: any) {
    console.error("[FCM Client] Error registering push notification:", err);
    return { success: false, error: err.message || "Failed to enable notifications" };
  }
}

/**
 * Syncs the FCM token with our backend
 */
export async function syncTokenWithServer(
  token: string,
  sessionToken: string,
  language: "ar" | "en",
): Promise<boolean> {
  if (!token || !sessionToken) return false;
  try {
    const res = await fetch("/api/push/tokens", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${sessionToken}`,
      },
      body: JSON.stringify({
        token,
        language,
        platform: getPlatformType(),
      }),
    });
    return res.ok;
  } catch (err) {
    console.warn("[FCM Client] Failed to sync push token with server:", err);
    return false;
  }
}

/**
 * Unregisters the stored FCM token on logout
 */
export async function unregisterPushNotification(sessionToken?: string | null): Promise<void> {
  const token = localStorage.getItem(CURRENT_PUSH_TOKEN_KEY);
  if (!token) return;

  try {
    if (sessionToken) {
      await fetch("/api/push/tokens", {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${sessionToken}`,
        },
        body: JSON.stringify({ token }),
      });
    }
  } catch (err) {
    console.warn("[FCM Client] Failed to remove push token from server:", err);
  } finally {
    localStorage.removeItem(CURRENT_PUSH_TOKEN_KEY);
  }
}

/**
 * Returns stored token from localStorage if present
 */
export function getStoredPushToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(CURRENT_PUSH_TOKEN_KEY);
}

/**
 * Listens for foreground push messages and triggers callback to refresh bell count
 * instead of showing duplicate native system notifications when app is open.
 */
export function setupForegroundPushListener(onNewMessage?: () => void): () => void {
  if (typeof window === "undefined") return () => {};

  isPushNotificationSupported().then((supported) => {
    if (!supported) return;

    try {
      const messaging = getMessaging(app);
      return onMessage(messaging, (payload) => {
        // App is in foreground: do not create duplicate system banner
        // Trigger notification bell count refresh
        window.dispatchEvent(new CustomEvent("refresh-notifications", { detail: payload }));
        if (onNewMessage) {
          onNewMessage();
        }
      });
    } catch (err) {
      console.warn("[FCM Client] Could not set up foreground listener:", err);
    }
  });

  return () => {};
}
