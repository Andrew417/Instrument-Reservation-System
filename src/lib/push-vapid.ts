import webpush from "web-push";
import fs from "fs";
import path from "path";

interface VapidKeys {
  publicKey: string;
  privateKey: string;
  subject: string;
}

let cachedKeys: VapidKeys | null = null;
let productionMissingWarned = false;

export function isPushConfigured(): boolean {
  return Boolean(getVapidKeys());
}

export function getVapidKeys(): VapidKeys | null {
  if (cachedKeys) return cachedKeys;

  const envPublic = process.env.VAPID_PUBLIC_KEY?.trim();
  const envPrivate = process.env.VAPID_PRIVATE_KEY?.trim();
  const envSubject =
    process.env.VAPID_SUBJECT?.trim() || "mailto:andrewehab417@gmail.com";

  if (envPublic && envPrivate) {
    cachedKeys = {
      publicKey: envPublic,
      privateKey: envPrivate,
      subject: envSubject,
    };
    try {
      webpush.setVapidDetails(
        cachedKeys.subject,
        cachedKeys.publicKey,
        cachedKeys.privateKey,
      );
    } catch (err: any) {
      console.error("[Push VAPID Error] Invalid VAPID credentials:", err?.message || err);
      cachedKeys = null;
      return null;
    }
    return cachedKeys;
  }

  const isProd =
    process.env.NODE_ENV === "production" || process.env.VERCEL === "1";

  if (isProd) {
    if (!productionMissingWarned) {
      productionMissingWarned = true;
      console.error(
        "🚨 [CRITICAL CONFIGURATION ERROR] Web Push is DISABLED in production: " +
          "VAPID_PUBLIC_KEY and/or VAPID_PRIVATE_KEY environment variables are missing! " +
          "Web Push notifications cannot be delivered. " +
          "Please configure VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, and VAPID_SUBJECT in Vercel project environment variables.",
      );
    }
    return null;
  }

  // Non-production fallback (local dev only): check .vapid.json if present
  const vapidFilePath = path.join(process.cwd(), ".vapid.json");
  if (fs.existsSync(vapidFilePath)) {
    try {
      const data = JSON.parse(fs.readFileSync(vapidFilePath, "utf-8"));
      if (data.publicKey && data.privateKey) {
        cachedKeys = {
          publicKey: data.publicKey,
          privateKey: data.privateKey,
          subject: data.subject || envSubject,
        };
        webpush.setVapidDetails(
          cachedKeys.subject,
          cachedKeys.publicKey,
          cachedKeys.privateKey,
        );
        return cachedKeys;
      }
    } catch {
      // Ignored in dev
    }
  }

  // Auto-generate keys in non-production if not present
  if (!isProd) {
    try {
      const generated = webpush.generateVAPIDKeys();
      const newKeys = {
        publicKey: generated.publicKey,
        privateKey: generated.privateKey,
        subject: envSubject,
      };
      try {
        fs.writeFileSync(vapidFilePath, JSON.stringify(newKeys, null, 2), "utf-8");
      } catch {}
      cachedKeys = newKeys;
      webpush.setVapidDetails(
        cachedKeys.subject,
        cachedKeys.publicKey,
        cachedKeys.privateKey,
      );
      return cachedKeys;
    } catch (err: any) {
      console.warn("[Push VAPID Warning] Failed to auto-generate keys:", err?.message || err);
    }
  }

  return null;
}

export function getVapidPublicKey(): string {
  const keys = getVapidKeys();
  return keys ? keys.publicKey : "";
}

export { webpush };
