import React, { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useAuth } from "../contexts/AuthContext";
import {
  isInAppBrowser,
  isIOS,
  isIOSStandalone,
  getNotificationPermission,
  getCurrentSubscription,
  subscribeToPush,
  sendTestNotification,
} from "../lib/push-client";
import {
  Bell,
  CheckCircle2,
  AlertTriangle,
  X,
  Share,
  PlusSquare,
  Smartphone,
  Send,
  Loader2,
  ChevronDown,
} from "lucide-react";

const DISMISSED_KEY = "church_push_banner_dismissed_v1";

export const PushNotificationPrompt: React.FC = () => {
  const { t, i18n } = useTranslation();
  const { isAuthenticated, sessionToken, user } = useAuth();
  const isRTL = i18n.language === "ar";

  const [isDismissed, setIsDismissed] = useState<boolean>(() => {
    try {
      return localStorage.getItem(DISMISSED_KEY) === "true";
    } catch {
      return false;
    }
  });

  const [permission, setPermission] = useState<NotificationPermission | "unsupported">("default");
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [testSending, setTestSending] = useState(false);
  const [testStatus, setTestStatus] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [showSteps, setShowSteps] = useState(false);

  const inAppBrowser = isInAppBrowser();
  const ios = isIOS();
  const iosStandalone = isIOSStandalone();

  useEffect(() => {
    if (!isAuthenticated || !sessionToken) return;

    const currentPerm = getNotificationPermission();
    setPermission(currentPerm);

    if (currentPerm === "granted") {
      getCurrentSubscription().then(async (sub) => {
        setIsSubscribed(Boolean(sub));
        if (sub) {
          try {
            await subscribeToPush(sessionToken, i18n.language);
          } catch (e) {
            console.warn("[Push resync on login error]:", e);
          }
        }
      });
    }
  }, [isAuthenticated, sessionToken, i18n.language]);

  if (!isAuthenticated || !sessionToken) return null;

  const isAdmin = user?.role === "admin" || user?.role === "super_admin";

  const handleDismiss = () => {
    try {
      localStorage.setItem(DISMISSED_KEY, "true");
    } catch {
      // ignore
    }
    setIsDismissed(true);
  };

  const handleRestore = () => {
    try {
      localStorage.removeItem(DISMISSED_KEY);
    } catch {
      // ignore
    }
    setIsDismissed(false);
  };

  const handleSubscribe = async () => {
    if (!sessionToken) return;
    setLoading(true);
    setErrorMsg(null);
    setTestStatus(null);

    const res = await subscribeToPush(sessionToken, i18n.language);
    setLoading(false);

    if (res.success) {
      setPermission("granted");
      setIsSubscribed(true);
      setTestStatus(t("pushPrompt.testSuccess"));
    } else {
      setPermission(getNotificationPermission());
      if (res.permission === "denied") {
        setErrorMsg(t("pushPrompt.permissionDenied"));
      } else {
        setErrorMsg(res.error || t("pushPrompt.enableFailed"));
      }
    }
  };

  const handleSendTest = async () => {
    if (!sessionToken) return;
    setTestSending(true);
    setTestStatus(null);
    setErrorMsg(null);

    const res = await sendTestNotification(sessionToken, i18n.language);
    setTestSending(false);

    if (res.success) {
      setTestStatus(t("pushPrompt.testSent"));
    } else {
      setErrorMsg(res.error || t("pushPrompt.testFailed"));
    }
  };

  // Slim / Collapsed State if user dismissed banner
  if (isDismissed) {
    return (
      <aside
        dir={isRTL ? "rtl" : "ltr"}
        aria-label={t("pushPrompt.collapsedTitle")}
        className="w-full max-w-4xl mx-auto mb-3 bg-stone-900/90 border border-amber-500/30 text-stone-200 rounded-xl px-3.5 py-1.5 shadow-sm flex items-center justify-between gap-3 text-xs sm:text-sm transition-all"
      >
        <div className="flex items-center gap-2 min-w-0">
          <Bell className="w-4 h-4 text-amber-400 shrink-0" />
          <span className="truncate font-medium">{t("pushPrompt.collapsedTitle")}</span>
        </div>
        <button
          type="button"
          onClick={handleRestore}
          className="min-h-[44px] px-3 py-1.5 text-xs sm:text-sm font-bold text-amber-300 hover:text-amber-200 active:scale-[0.98] hover:bg-white/10 rounded-lg transition cursor-pointer shrink-0 flex items-center gap-1.5"
        >
          <span>{t("pushPrompt.restoreBtn")}</span>
        </button>
      </aside>
    );
  }

  return (
    <aside
      dir={isRTL ? "rtl" : "ltr"}
      aria-label={t("pushPrompt.promptTitle")}
      className="w-full max-w-4xl mx-auto mb-4 bg-gradient-to-r from-stone-900 via-stone-900/98 to-amber-950/90 border border-amber-500/30 text-white rounded-2xl p-3.5 sm:p-4 shadow-lg relative backdrop-blur-md transition-all duration-200 overflow-hidden"
    >
      <button
        type="button"
        onClick={handleDismiss}
        className="absolute top-2.5 end-2.5 w-11 h-11 rounded-xl bg-white/10 hover:bg-white/20 active:bg-white/25 text-stone-300 hover:text-white flex items-center justify-center transition cursor-pointer z-10"
        aria-label={t("pushPrompt.dismiss")}
      >
        <X className="w-4 h-4" />
      </button>

      {/* Case 1: WhatsApp / In-App Browser Detected */}
      {inAppBrowser && (
        <div className="pe-11 space-y-2.5 text-start">
          <div className="flex items-center gap-2.5 text-amber-300 font-bold text-sm sm:text-base">
            <div className="w-8 h-8 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center shrink-0">
              <AlertTriangle className="w-4 h-4" />
            </div>
            <span className="leading-snug">{t("pushPrompt.whatsappTitle")}</span>
          </div>
          <p className="text-sm text-stone-200 leading-snug break-words">
            {t("pushPrompt.whatsappDesc")}
          </p>

          <button
            type="button"
            onClick={() => setShowSteps(!showSteps)}
            className="w-full min-h-[44px] px-3 py-2 text-xs sm:text-sm font-semibold text-amber-300 hover:text-amber-200 bg-white/5 hover:bg-white/10 rounded-xl transition flex items-center justify-between cursor-pointer"
          >
            <span>{t("pushPrompt.whatsappHow")}</span>
            <ChevronDown
              className={`w-4 h-4 transition-transform duration-200 ${showSteps ? "rotate-180" : ""}`}
            />
          </button>

          {showSteps && (
            <div className="bg-black/40 rounded-xl p-3 border border-white/10 text-xs sm:text-sm space-y-2 mt-2 animate-in fade-in duration-150 text-stone-200">
              <div className="flex items-start gap-2">
                <span className="w-5 h-5 rounded-full bg-amber-500/30 text-amber-300 font-bold flex items-center justify-center text-xs shrink-0 mt-0.5">
                  1
                </span>
                <span>{t("pushPrompt.whatsappStep1")}</span>
              </div>
              <div className="flex items-start gap-2">
                <span className="w-5 h-5 rounded-full bg-amber-500/30 text-amber-300 font-bold flex items-center justify-center text-xs shrink-0 mt-0.5">
                  2
                </span>
                <span>{t("pushPrompt.whatsappStep2")}</span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Case 2: iPhone / iPad not yet added to Home Screen */}
      {!inAppBrowser && ios && !iosStandalone && (
        <div className="pe-11 space-y-2.5 text-start">
          <div className="flex items-center gap-2.5 text-amber-300 font-bold text-sm sm:text-base">
            <div className="w-8 h-8 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center shrink-0">
              <Smartphone className="w-4 h-4" />
            </div>
            <span className="leading-snug">{t("pushPrompt.iosTitle")}</span>
          </div>
          <p className="text-sm text-stone-200 leading-snug break-words">
            {t("pushPrompt.iosDesc")}
          </p>

          <button
            type="button"
            onClick={() => setShowSteps(!showSteps)}
            className="w-full min-h-[44px] px-3 py-2 text-xs sm:text-sm font-semibold text-amber-300 hover:text-amber-200 bg-white/5 hover:bg-white/10 rounded-xl transition flex items-center justify-between cursor-pointer"
          >
            <span>{t("pushPrompt.iosHow")}</span>
            <ChevronDown
              className={`w-4 h-4 transition-transform duration-200 ${showSteps ? "rotate-180" : ""}`}
            />
          </button>

          {showSteps && (
            <div className="bg-black/40 rounded-xl p-3 border border-white/10 text-xs sm:text-sm space-y-2.5 mt-2 animate-in fade-in duration-150 text-stone-200">
              <div className="flex items-start gap-2">
                <Share className="w-4 h-4 text-amber-300 shrink-0 mt-0.5" />
                <span>{t("pushPrompt.iosStep1")}</span>
              </div>
              <div className="flex items-start gap-2">
                <PlusSquare className="w-4 h-4 text-amber-300 shrink-0 mt-0.5" />
                <span>{t("pushPrompt.iosStep2")}</span>
              </div>
              <div className="flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                <span>{t("pushPrompt.iosStep3")}</span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Case 3: Permission Blocked / Denied */}
      {!inAppBrowser && !(ios && !iosStandalone) && permission === "denied" && (
        <div className="pe-11 space-y-2.5 text-start">
          <div className="flex items-center gap-2.5 text-red-300 font-bold text-sm sm:text-base">
            <div className="w-8 h-8 rounded-xl bg-red-500/20 text-red-400 flex items-center justify-center shrink-0">
              <AlertTriangle className="w-4 h-4" />
            </div>
            <span className="leading-snug">{t("pushPrompt.blockedTitle")}</span>
          </div>
          <p className="text-sm text-stone-200 leading-snug break-words">
            {t("pushPrompt.blockedWhy")}
          </p>

          <button
            type="button"
            onClick={() => setShowSteps(!showSteps)}
            className="w-full min-h-[44px] px-3 py-2 text-xs sm:text-sm font-semibold text-red-200 hover:text-red-100 bg-white/5 hover:bg-white/10 rounded-xl transition flex items-center justify-between cursor-pointer"
          >
            <span>{t("pushPrompt.blockedHow")}</span>
            <ChevronDown
              className={`w-4 h-4 transition-transform duration-200 ${showSteps ? "rotate-180" : ""}`}
            />
          </button>

          {showSteps && (
            <div className="bg-black/40 rounded-xl p-3 border border-white/10 text-xs sm:text-sm space-y-1.5 mt-2 animate-in fade-in duration-150 text-stone-200">
              <p className="leading-relaxed">{t("pushPrompt.blockedStep1")}</p>
              <p className="leading-relaxed">{t("pushPrompt.blockedStep2")}</p>
            </div>
          )}
        </div>
      )}

      {/* Case 4: Subscribed and Ready -> Show Test Notification Button */}
      {!inAppBrowser && !(ios && !iosStandalone) && isSubscribed && permission === "granted" && (
        <div className="pe-11 space-y-2 text-start">
          <div className="flex items-center gap-2.5 text-emerald-300 font-bold text-sm sm:text-base">
            <div className="w-8 h-8 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0">
              <CheckCircle2 className="w-4 h-4" />
            </div>
            <span className="leading-snug">{t("pushPrompt.enabledTitle")}</span>
          </div>
          <p className="text-sm text-stone-200 leading-snug break-words">
            {t("pushPrompt.enabledDesc")}
          </p>

          {testStatus && (
            <div className="bg-emerald-500/20 border border-emerald-400/30 text-emerald-200 text-xs sm:text-sm p-2.5 rounded-xl flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>{testStatus}</span>
            </div>
          )}

          {errorMsg && (
            <div className="bg-red-500/20 border border-red-400/30 text-red-200 text-xs sm:text-sm p-2.5 rounded-xl flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          <button
            type="button"
            onClick={handleSendTest}
            disabled={testSending}
            className="w-full min-h-[44px] px-4 py-2.5 rounded-xl font-bold text-sm bg-amber-600 hover:bg-amber-500 active:scale-[0.99] text-white shadow-md transition flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 mt-2.5"
          >
            {testSending ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>{t("pushPrompt.sending")}</span>
              </>
            ) : (
              <>
                <Send className="w-4 h-4" />
                <span>{t("pushPrompt.sendTestBtn")}</span>
              </>
            )}
          </button>
        </div>
      )}

      {/* Case 5: Normal Flow -> Ask to Enable Notifications */}
      {!inAppBrowser && !(ios && !iosStandalone) && permission !== "denied" && !isSubscribed && (
        <div className="pe-11 space-y-2 text-start">
          <div className="flex items-center gap-2.5 text-amber-200 font-bold text-sm sm:text-base">
            <div className="w-8 h-8 rounded-xl bg-amber-500/20 text-amber-300 flex items-center justify-center shrink-0">
              <Bell className="w-4 h-4" />
            </div>
            <span className="leading-snug">
              {isAdmin
                ? t("pushPrompt.adminPromptTitle")
                : t("pushPrompt.memberPromptTitle")}
            </span>
          </div>

          <p className="text-sm text-stone-200 leading-snug break-words">
            {isAdmin
              ? t("pushPrompt.adminPromptDesc")
              : t("pushPrompt.memberPromptDesc")}
          </p>

          <p className="text-xs text-amber-200/90 flex items-center gap-1.5 leading-snug">
            <span>{t("pushPrompt.reassurance")}</span>
          </p>

          {errorMsg && (
            <div className="bg-red-500/20 border border-red-400/30 text-red-200 text-xs sm:text-sm p-2.5 rounded-xl flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          <div className="space-y-1 pt-1">
            <button
              type="button"
              onClick={handleSubscribe}
              disabled={loading}
              className="w-full min-h-[44px] px-4 py-2.5 rounded-xl font-bold text-sm bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-500 hover:to-amber-600 active:scale-[0.99] text-white shadow-md transition flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>{t("pushPrompt.enabling")}</span>
                </>
              ) : (
                <>
                  <Bell className="w-4 h-4" />
                  <span>{t("pushPrompt.enableNow")}</span>
                </>
              )}
            </button>

            <button
              type="button"
              onClick={handleDismiss}
              className="w-full min-h-[44px] px-3 py-2 text-xs sm:text-sm font-medium text-stone-300 hover:text-white rounded-xl transition flex items-center justify-center cursor-pointer"
            >
              {t("pushPrompt.later")}
            </button>
          </div>
        </div>
      )}
    </aside>
  );
};
