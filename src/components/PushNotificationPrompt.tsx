import React, { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useAuth } from "../contexts/AuthContext.js";
import {
  Bell,
  BellRing,
  X,
  Share,
  Compass,
  AlertTriangle,
  CheckCircle2,
  ExternalLink,
  Copy,
  Check,
} from "lucide-react";
import {
  registerPushNotification,
  isInAppBrowser,
  isIosDevice,
  isIosPwaInstalled,
  getNotificationPermission,
  getStoredPushToken,
} from "../lib/push-client.js";

const DISMISSED_KEY = "church_push_prompt_dismissed_until";

export const PushNotificationPrompt: React.FC = () => {
  const { t, i18n } = useTranslation();
  const isAr = i18n.language === "ar";
  const { sessionToken, user, profile } = useAuth();

  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [permissionState, setPermissionState] = useState<NotificationPermission>("default");

  const [inAppBrowser, setInAppBrowser] = useState(false);
  const [iosNeedsInstall, setIosNeedsInstall] = useState(false);
  const [alreadyRegistered, setAlreadyRegistered] = useState(false);

  useEffect(() => {
    if (!sessionToken) return;

    const inApp = isInAppBrowser();
    setInAppBrowser(inApp);

    const iosUninstalled = isIosDevice() && !isIosPwaInstalled();
    setIosNeedsInstall(iosUninstalled);

    const perm = getNotificationPermission();
    setPermissionState(perm);

    const hasStoredToken = Boolean(getStoredPushToken());
    setAlreadyRegistered(perm === "granted" && hasStoredToken);

    // Check if dismissed recently (e.g. within 3 days)
    const dismissedUntil = localStorage.getItem(DISMISSED_KEY);
    if (dismissedUntil && Number(dismissedUntil) > Date.now()) {
      return;
    }

    // Auto-show banner bar only if permission not already granted
    if (perm !== "granted" || !hasStoredToken) {
      setIsOpen(true);
    }
  }, [sessionToken]);

  if (!sessionToken || alreadyRegistered || !isOpen) {
    return null;
  }

  const handleDismiss = () => {
    // Dismiss for 3 days
    localStorage.setItem(DISMISSED_KEY, String(Date.now() + 3 * 24 * 60 * 60 * 1000));
    setIsOpen(false);
  };

  const handleEnablePush = async () => {
    if (!sessionToken) return;
    setLoading(true);
    setErrorMsg(null);

    const currentLang = (i18n.language === "en" ? "en" : "ar") as "ar" | "en";
    const res = await registerPushNotification(sessionToken, currentLang);

    setLoading(false);
    if (res.success) {
      setSuccess(true);
      setAlreadyRegistered(true);
      setTimeout(() => {
        setIsOpen(false);
      }, 2500);
    } else {
      if (res.error === "permission_denied") {
        setPermissionState("denied");
      } else {
        setErrorMsg(res.error || "Failed to enable notifications");
      }
    }
  };

  const handleCopyLink = () => {
    navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div
      dir={isAr ? "rtl" : "ltr"}
      className="fixed bottom-4 start-4 end-4 md:start-auto md:end-6 md:max-w-md z-40 bg-stone-900 text-stone-100 rounded-2xl p-4 shadow-2xl border border-amber-600/30 animate-in fade-in slide-in-from-bottom-4 duration-200"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center shrink-0 border border-amber-500/30">
            {success ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-400" />
            ) : inAppBrowser || iosNeedsInstall ? (
              <AlertTriangle className="w-5 h-5 text-amber-400" />
            ) : (
              <BellRing className="w-5 h-5" />
            )}
          </div>

          <div>
            <h4 className="font-bold text-sm text-stone-100">
              {success
                ? isAr
                  ? "تم تفعيل الإشعارات بنجاح!"
                  : "Notifications Enabled!"
                : inAppBrowser
                  ? isAr
                    ? "افتح الموقع في المتصفح الخارجي"
                    : "Open in External Browser"
                  : iosNeedsInstall
                    ? isAr
                      ? "إضافة التطبيق للشاشة الرئيسية"
                      : "Add to Home Screen (iOS)"
                    : permissionState === "denied"
                      ? isAr
                        ? "الإشعارات محظورة في المتصفح"
                        : "Notifications Blocked"
                      : isAr
                        ? "تفعيل إشعارات الحجز الفورية"
                        : "Enable Push Notifications"}
            </h4>

            <p className="text-xs text-stone-300 mt-1 leading-relaxed">
              {success ? (
                isAr ? (
                  "ستصلك الآن تنبيهات الحجز والرسائل مباشرة على جهازك."
                ) : (
                  "You will now receive booking and chat updates on this device."
                )
              ) : inAppBrowser ? (
                isAr ? (
                  "أنت تتصفح من داخل تطبيق محادثة. يرجى فتح الموقع في متصفح Chrome أو Safari لتفعيل الإشعارات."
                ) : (
                  "You are browsing inside an in-app viewer. Please open in Chrome or Safari to allow push alerts."
                )
              ) : iosNeedsInstall ? (
                isAr ? (
                  "على أجهزة iPhone، يتطلب استلام الإشعارات إضافة الموقع للشاشة الرئيسية: اضغط زر المشاركة (⎋) ثم 'إضافة إلى الصفحة الرئيسية'."
                ) : (
                  "On iOS, web push requires installing to Home Screen: tap Share (⎋), then choose 'Add to Home Screen'."
                )
              ) : permissionState === "denied" ? (
                isAr ? (
                  "تم رفض الإذن سابقاً. يرجى الضغط على أيقونة القفل أو الإعدادات بجانب شريط العنوان والسماح بالإشعارات."
                ) : (
                  "Notifications were previously blocked. Click the site settings/lock icon in your address bar to allow alerts."
                )
              ) : isAr ? (
                "احصل على تنبيه فوري فور موافقة الإدارة على حجزك أو تلقي رسائل جديدة، حتى عندما لا يكون الموقع مفتوحاً."
              ) : (
                "Get instant phone alerts when your reservation is approved or when admin sends you a message."
              )}
            </p>

            {errorMsg && (
              <p className="text-xs text-rose-400 mt-2 font-medium bg-rose-950/40 px-2 py-1 rounded-lg border border-rose-800/40">
                {errorMsg}
              </p>
            )}

            {/* Action buttons */}
            <div className="flex items-center gap-2 mt-3">
              {inAppBrowser ? (
                <button
                  type="button"
                  onClick={handleCopyLink}
                  className="px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-500 text-white text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer"
                >
                  {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  {copied
                    ? isAr
                      ? "تم نسخ الرابط"
                      : "Copied!"
                    : isAr
                      ? "نسخ الرابط لفتحه في المتصفح"
                      : "Copy Link"}
                </button>
              ) : iosNeedsInstall ? (
                <div className="flex items-center gap-2 text-xs text-amber-300 bg-amber-950/40 px-2.5 py-1.5 rounded-lg border border-amber-800/40 font-medium">
                  <Share className="w-3.5 h-3.5 shrink-0" />
                  <span>{isAr ? "اضغط مشاركة ⎋ ← إضافة للشاشة" : "Tap Share ⎋ → Add to Home"}</span>
                </div>
              ) : permissionState === "denied" ? (
                <span className="text-xs text-amber-300 font-medium">
                  {isAr ? "راجع إعدادات المتصفح لإعادة التفعيل" : "Check browser site permissions"}
                </span>
              ) : (
                <button
                  type="button"
                  onClick={handleEnablePush}
                  disabled={loading || success}
                  className="px-3.5 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-white text-xs font-semibold transition cursor-pointer shadow-sm flex items-center gap-1.5"
                >
                  {loading ? (
                    <span>{isAr ? "جاري التفعيل..." : "Enabling..."}</span>
                  ) : (
                    <>
                      <Bell className="w-3.5 h-3.5" />
                      <span>{isAr ? "تفعيل الإشعارات الآن" : "Enable Push Alerts"}</span>
                    </>
                  )}
                </button>
              )}

              <button
                type="button"
                onClick={handleDismiss}
                className="px-3 py-1.5 rounded-lg text-xs font-medium text-stone-400 hover:text-stone-200 hover:bg-stone-800 transition cursor-pointer"
              >
                {isAr ? "لاحقاً" : "Later"}
              </button>
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={handleDismiss}
          className="text-stone-400 hover:text-stone-200 transition cursor-pointer p-1 rounded-lg hover:bg-stone-800"
          aria-label="إغلاق"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
