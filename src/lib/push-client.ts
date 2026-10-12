// Client-side Web Push subscription and detection helpers

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding)
    .replace(/\-/g, "+")
    .replace(/_/g, "/");

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export function isPushSupported(): boolean {
  if (typeof window === "undefined") return false;
  return (
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window
  );
}

/**
 * Detects if the site was opened inside an in-app browser (e.g. WhatsApp, Facebook)
 * where Web Push cannot function properly.
 */
export function isInAppBrowser(): boolean {
  if (typeof window === "undefined") return false;
  const ua = navigator.userAgent || navigator.vendor || "";
  return /WhatsApp|FBAN|FBAV|Instagram|Line|Messenger/i.test(ua);
}

/**
 * Detects iOS device (iPhone, iPad, iPod)
 */
export function isIOS(): boolean {
  if (typeof window === "undefined") return false;
  const ua = navigator.userAgent || "";
  return (
    /iPad|iPhone|iPod/.test(ua) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)
  );
}

/**
 * Detects if the web app is running in Standalone (Home Screen / PWA) mode on iOS.
 * On iOS, Web Push is only enabled once the user adds the site to Home Screen.
 */
export function isIOSStandalone(): boolean {
  if (typeof window === "undefined") return false;
  const isStandaloneNavigator =
    "standalone" in window.navigator &&
    Boolean((window.navigator as any).standalone);
  const isStandaloneDisplay = window.matchMedia(
    "(display-mode: standalone)",
  ).matches;
  return isStandaloneNavigator || isStandaloneDisplay;
}

/**
 * Returns current permission state
 */
export function getNotificationPermission(): NotificationPermission | "unsupported" {
  if (!isPushSupported()) return "unsupported";
  return Notification.permission;
}

/**
 * Registers the Service Worker at /sw.js
 */
export async function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (!isPushSupported()) return null;
  try {
    const reg = await navigator.serviceWorker.register("/sw.js", {
      scope: "/",
    });
    return reg;
  } catch (err) {
    console.warn("[SW Registration Error]:", err);
    return null;
  }
}

/**
 * Checks if the current browser device already has an active push subscription
 */
export async function getCurrentSubscription(): Promise<PushSubscription | null> {
  if (!isPushSupported()) return null;
  try {
    const reg = await navigator.serviceWorker.ready;
    return await reg.pushManager.getSubscription();
  } catch {
    return null;
  }
}

/**
 * Subscribes the current device to Web Push
 */
export async function subscribeToPush(
  sessionToken: string,
  language: string = "ar",
): Promise<{ success: boolean; error?: string; permission?: NotificationPermission }> {
  if (!isPushSupported()) {
    return { success: false, error: "Push notifications are not supported in this browser." };
  }

  try {
    // 1. Request permission from user (must be triggered by a user gesture)
    const permission = await Notification.requestPermission();
    if (permission !== "granted") {
      return { success: false, permission, error: "Permission not granted" };
    }

    // 2. Fetch public key from backend
    const keyRes = await fetch("/api/push/public-key");
    const keyData = await keyRes.json();
    if (!keyData.success || !keyData.publicKey) {
      return { success: false, error: "Failed to retrieve VAPID public key" };
    }

    // 3. Register / get ready service worker
    await registerServiceWorker();
    const reg = await navigator.serviceWorker.ready;

    // 4. Subscribe to PushManager
    const applicationServerKey = urlBase64ToUint8Array(keyData.publicKey);
    let subscription = await reg.pushManager.getSubscription();

    if (!subscription) {
      subscription = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey,
      });
    }

    // 5. Send subscription to server
    const subJson = subscription.toJSON();
    const saveRes = await fetch("/api/push/subscribe", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${sessionToken}`,
      },
      body: JSON.stringify({
        subscription: subJson,
        language,
      }),
    });

    const saveData = await saveRes.json();
    if (!saveRes.ok || !saveData.success) {
      return { success: false, error: saveData.error || "Failed to save subscription on server" };
    }

    return { success: true, permission: "granted" };
  } catch (err: any) {
    console.error("[Subscribe Error]:", err);
    return { success: false, error: err.message || "Failed to subscribe" };
  }
}

/**
 * Unsubscribes current device from Web Push
 */
export async function unsubscribeFromPush(sessionToken?: string | null): Promise<boolean> {
  if (!isPushSupported()) return true;
  try {
    const reg = await navigator.serviceWorker.ready;
    const subscription = await reg.pushManager.getSubscription();
    if (subscription) {
      const endpoint = subscription.endpoint;
      await subscription.unsubscribe();

      if (sessionToken) {
        await fetch("/api/push/unsubscribe", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${sessionToken}`,
          },
          body: JSON.stringify({ endpoint }),
        }).catch(() => {});
      }
    }
    return true;
  } catch {
    return false;
  }
}

/**
 * Sends a test push notification to this device
 */
export async function sendTestNotification(
  sessionToken: string,
  language: string = "ar",
): Promise<{ success: boolean; message?: string; error?: string }> {
  try {
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.getSubscription();
    const endpoint = sub?.endpoint;

    const res = await fetch("/api/push/test", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${sessionToken}`,
      },
      body: JSON.stringify({ endpoint, language }),
    });

    const data = await res.json();
    if (res.ok && data.success) {
      return { success: true, message: data.message };
    }
    return { success: false, error: data.error || "Failed to send test push" };
  } catch (err: any) {
    return { success: false, error: err.message || "Network error" };
  }
}

/**
 * Re-sync on login:
 * When permission is already "granted" and a subscription exists,
 * POST it to /api/push/subscribe with the current session token after login,
 * so a shared device is re-bound to the logged-in account and stops delivering
 * the previous account's notifications.
 */
export async function resyncPushSubscriptionOnLogin(
  sessionToken: string,
  language: string = "ar",
): Promise<boolean> {
  if (!isPushSupported() || getNotificationPermission() !== "granted") {
    return false;
  }
  try {
    const sub = await getCurrentSubscription();
    if (!sub) return false;
    const res = await subscribeToPush(sessionToken, language);
    return res.success;
  } catch (err) {
    console.warn("[Push resync on login error]:", err);
    return false;
  }
}
