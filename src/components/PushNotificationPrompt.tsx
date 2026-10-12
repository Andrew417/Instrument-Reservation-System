import React, { useState, useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { useAuth } from "../contexts/AuthContext";
import {
  isInAppBrowser,
  isIOS,
  isIOSStandalone,
  getNotificationPermission,
  getCurrentSubscription,
  subscribeToPush,
} from "../lib/push-client";
import {
  Bell,
  CheckCircle2,
  AlertTriangle,
  X,
  Share,
  PlusSquare,
  Smartphone,
  Loader2,
  ChevronDown,
  Lock,
} from "lucide-react";

/* ------------------------------------------------------------------ */
/* Colored keyword spans                                              */
/* ------------------------------------------------------------------ */

const KeywordApproved: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => <span className="font-bold text-emerald-700">{children}</span>;

const KeywordRejected: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => <span className="font-bold text-red-600">{children}</span>;

const KeywordNeutral: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => <span className="font-bold text-amber-800">{children}</span>;

/* ------------------------------------------------------------------ */
/* Component                                                          */
/* ------------------------------------------------------------------ */

type PromptVariant = "inApp" | "ios" | "blocked" | "normal";

export const PushNotificationPrompt: React.FC = () => {
  const { t, i18n } = useTranslation();
  const { isAuthenticated, sessionToken, user } = useAuth();
  const isRTL = i18n.language === "ar";

  const [isDismissed, setIsDismissed] = useState(false);
  const [permission, setPermission] = useState<
    NotificationPermission | "unsupported"
  >("default");
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [showEnabledConfirmation, setShowEnabledConfirmation] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isExpanded, setIsExpanded] = useState(false);
  const dismissTimerRef = useRef<number | null>(null);

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

  useEffect(() => {
    return () => {
      if (dismissTimerRef.current !== null) {
        window.clearTimeout(dismissTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!showEnabledConfirmation) return;

    dismissTimerRef.current = window.setTimeout(() => {
      setIsDismissed(true);
      setShowEnabledConfirmation(false);
    }, 2000);

    return () => {
      if (dismissTimerRef.current !== null) {
        window.clearTimeout(dismissTimerRef.current);
        dismissTimerRef.current = null;
      }
    };
  }, [showEnabledConfirmation]);

  if (!isAuthenticated || !sessionToken) return null;
  if (isDismissed) return null;

  const isAdmin = user?.role === "admin" || user?.role === "super_admin";

  const handleDismiss = () => setIsDismissed(true);

  const handleSubscribe = async () => {
    if (!sessionToken) return;
    setLoading(true);
    setErrorMsg(null);

    const res = await subscribeToPush(sessionToken, i18n.language);
    setLoading(false);

    if (res.success) {
      setPermission("granted");
      setIsSubscribed(true);
      setShowEnabledConfirmation(true);
    } else {
      setPermission(getNotificationPermission());
      if (res.permission === "denied") {
        setErrorMsg(t("pushPrompt.permissionDenied"));
      } else {
        setErrorMsg(res.error || t("pushPrompt.enableFailed"));
      }
    }
  };

  /* ---- Success confirmation ---- */
  if (showEnabledConfirmation) {
    return (
      <aside
        dir={isRTL ? "rtl" : "ltr"}
        aria-label={t("pushPrompt.enabledTitle")}
        className="w-full mb-3 rounded-2xl bg-emerald-50 border border-emerald-300 px-3.5 py-2.5 shadow-2xs animate-in fade-in zoom-in-95 duration-200"
      >
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-2xs">
            <CheckCircle2 className="w-4 h-4" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs sm:text-sm font-bold text-emerald-950 leading-tight truncate">
              {t("pushPrompt.enabledTitle")}
            </p>
            <p className="text-[11px] text-emerald-800/90 leading-tight mt-0.5 truncate">
              {t("pushPrompt.enabledDesc")}
            </p>
          </div>
          <button
            type="button"
            onClick={handleDismiss}
            aria-label={t("pushPrompt.dismiss")}
            className="h-8 w-8 -me-1 rounded-lg text-emerald-800/70 hover:text-emerald-950 hover:bg-emerald-100 flex items-center justify-center transition cursor-pointer shrink-0 touch-manipulation"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </aside>
    );
  }

  if (isSubscribed && permission === "granted") return null;

  /* ---- Pick variant ---- */
  const variant: PromptVariant = inAppBrowser
    ? "inApp"
    : ios && !iosStandalone
      ? "ios"
      : permission === "denied"
        ? "blocked"
        : "normal";

  /* ---- Per-variant config ---- */
  const variantConfig: Record<
    PromptVariant,
    {
      Icon: typeof Bell;
      title: string;
      desc?: string;
      steps?: { Icon: typeof Bell; text: string }[];
      tone: "amber" | "red";
    }
  > = {
    inApp: {
      Icon: AlertTriangle,
      title: t("pushPrompt.whatsappTitle"),
      desc: t("pushPrompt.whatsappDesc"),
      steps: [
        { Icon: Share, text: t("pushPrompt.whatsappStep1") },
        { Icon: Smartphone, text: t("pushPrompt.whatsappStep2") },
      ],
      tone: "amber",
    },
    ios: {
      Icon: Smartphone,
      title: t("pushPrompt.iosTitle"),
      desc: t("pushPrompt.iosDesc"),
      steps: [
        { Icon: Share, text: t("pushPrompt.iosStep1") },
        { Icon: PlusSquare, text: t("pushPrompt.iosStep2") },
        { Icon: CheckCircle2, text: t("pushPrompt.iosStep3") },
      ],
      tone: "amber",
    },
    blocked: {
      Icon: Lock,
      title: t("pushPrompt.blockedTitle"),
      desc: t("pushPrompt.blockedWhy"),
      steps: [
        { Icon: Lock, text: t("pushPrompt.blockedStep1") },
        { Icon: CheckCircle2, text: t("pushPrompt.blockedStep2") },
      ],
      tone: "red",
    },
    normal: {
      Icon: Bell,
      title: isAdmin
        ? t("pushPrompt.adminPromptTitle")
        : t("pushPrompt.memberPromptTitle"),
      tone: "amber",
    },
  };

  const cfg = variantConfig[variant];

  const tone = {
    amber: {
      headerBg: "bg-amber-50/70 hover:bg-amber-100/60",
      headerBorder: "border-amber-200",
      chipBg: "bg-amber-800",
      chipText: "text-amber-100",
      titleText: "text-stone-900",
      bodyBorder: "border-amber-100",
      stepChip: "bg-amber-100 text-amber-900",
      linkText: "text-amber-800 hover:text-amber-950",
    },
    red: {
      headerBg: "bg-red-50/70 hover:bg-red-100/60",
      headerBorder: "border-red-200",
      chipBg: "bg-red-700",
      chipText: "text-red-50",
      titleText: "text-stone-900",
      bodyBorder: "border-red-100",
      stepChip: "bg-red-100 text-red-900",
      linkText: "text-red-800 hover:text-red-950",
    },
  }[cfg.tone];

  const hasExpandableContent =
    variant === "normal" || Boolean(cfg.steps && cfg.steps.length > 0);

  /* ---- Main card ---- */
  return (
    <aside
      dir={isRTL ? "rtl" : "ltr"}
      aria-label={t("pushPrompt.promptTitle")}
      className={`w-full mb-3 rounded-2xl bg-white border ${tone.headerBorder} shadow-2xs overflow-hidden transition-all`}
    >
      {/* Header */}
      <div
        role="button"
        tabIndex={0}
        onClick={() => hasExpandableContent && setIsExpanded((p) => !p)}
        onKeyDown={(e) => {
          if (!hasExpandableContent) return;
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            setIsExpanded((p) => !p);
          }
        }}
        className={`${tone.headerBg} px-3.5 py-2.5 flex items-center justify-between gap-2 transition select-none touch-manipulation ${
          hasExpandableContent ? "cursor-pointer" : ""
        }`}
        aria-expanded={hasExpandableContent ? isExpanded : undefined}
      >
        <div className="flex items-center gap-2 min-w-0">
          <div
            className={`w-7 h-7 rounded-lg ${tone.chipBg} ${tone.chipText} flex items-center justify-center shrink-0 shadow-2xs`}
          >
            <cfg.Icon className="w-3.5 h-3.5" />
          </div>
          <span
            className={`text-xs sm:text-sm font-bold ${tone.titleText} truncate`}
          >
            {cfg.title}
          </span>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              handleDismiss();
            }}
            className={`px-2 py-1 rounded-md text-[11px] font-semibold ${tone.linkText} hover:bg-white/60 transition cursor-pointer touch-manipulation`}
          >
            {t("pushPrompt.later")}
          </button>

          {hasExpandableContent && (
            <div
              className={`w-6 h-6 rounded-md flex items-center justify-center text-stone-500 transition-transform duration-200 ${
                isExpanded ? "rotate-180" : ""
              }`}
            >
              <ChevronDown className="w-4 h-4" />
            </div>
          )}
        </div>
      </div>

      {/* Body */}
      {isExpanded && hasExpandableContent && (
        <div
          className={`p-3 space-y-3 border-t ${tone.bodyBorder} animate-in fade-in duration-150`}
        >
          {/* Benefit line — colored keywords for the normal variant */}
          {variant === "normal" ? (
            isAdmin ? (
              <p className="text-xs text-stone-600 leading-relaxed">
                {t("pushPrompt.adminPromptPrefix")}{" "}
                <KeywordNeutral>
                  {t("pushPrompt.adminKbBooking")}
                </KeywordNeutral>
                {t("pushPrompt.adminKbComma1")}{" "}
                <KeywordNeutral>{t("pushPrompt.adminKbSignup")}</KeywordNeutral>
                {t("pushPrompt.adminKbComma2")}{" "}
                <KeywordNeutral>
                  {t("pushPrompt.adminKbReplies")}
                </KeywordNeutral>
                {t("pushPrompt.adminPromptSuffix")}
              </p>
            ) : (
              <p className="text-xs text-stone-600 leading-relaxed">
                {t("pushPrompt.memberPromptPrefix")}{" "}
                <KeywordApproved>
                  {t("pushPrompt.memberKbApproved")}
                </KeywordApproved>
                {t("pushPrompt.memberKbComma1")}{" "}
                <KeywordRejected>
                  {t("pushPrompt.memberKbRejected")}
                </KeywordRejected>
                {t("pushPrompt.memberKbComma2")}{" "}
                <KeywordNeutral>
                  {t("pushPrompt.memberKbReplies")}
                </KeywordNeutral>
                {t("pushPrompt.memberPromptSuffix")}
              </p>
            )
          ) : (
            <p className="text-xs text-stone-600 leading-snug">{cfg.desc}</p>
          )}

          {/* Steps (inApp / iOS / blocked) */}
          {cfg.steps && cfg.steps.length > 0 && (
            <div className="bg-stone-50 rounded-xl border border-stone-200 p-2.5 space-y-2">
              {cfg.steps.map((step, idx) => {
                const StepIcon = step.Icon;
                return (
                  <div key={idx} className="flex items-start gap-2">
                    <span
                      className={`w-5 h-5 rounded-md ${tone.stepChip} font-bold flex items-center justify-center text-[10px] shrink-0 mt-0.5`}
                    >
                      {idx + 1}
                    </span>
                    <span className="text-xs text-stone-700 leading-snug flex items-start gap-1.5">
                      <StepIcon className="w-3.5 h-3.5 text-stone-500 shrink-0 mt-0.5" />
                      <span>{step.text}</span>
                    </span>
                  </div>
                );
              })}
            </div>
          )}

          {/* CTA (normal only) */}
          {variant === "normal" && (
            <>
              {errorMsg && (
                <div className="bg-red-50 border border-red-200 text-red-800 text-xs p-2.5 rounded-xl flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-red-500 shrink-0" />
                  <span className="break-words">{errorMsg}</span>
                </div>
              )}

              <button
                type="button"
                onClick={handleSubscribe}
                disabled={loading}
                className="w-full h-9 rounded-xl font-bold text-xs bg-amber-800 hover:bg-amber-900 active:bg-amber-950 text-white shadow-2xs transition flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 active:scale-[0.99] touch-manipulation"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>{t("pushPrompt.enabling")}</span>
                  </>
                ) : (
                  <>
                    <Bell className="w-3.5 h-3.5" />
                    <span>{t("pushPrompt.enableNow")}</span>
                  </>
                )}
              </button>
            </>
          )}
        </div>
      )}
    </aside>
  );
};
