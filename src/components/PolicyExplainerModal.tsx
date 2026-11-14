import React, { useEffect } from "react";
import { useTranslation } from "react-i18next";
import {
  X,
  Zap,
  Clock,
  Layers,
  Church,
  CreditCard,
  ShieldCheck,
  Repeat,
  MessageSquare,
  Bell,
  Camera,
  Lock,
  Sparkles,
  CheckCircle2,
  ArrowLeft,
  ArrowRight,
} from "lucide-react";

export interface PolicyExplainerModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const PolicyExplainerModal: React.FC<PolicyExplainerModalProps> = ({
  isOpen,
  onClose,
}) => {
  const { t, i18n } = useTranslation();
  const isRTL = i18n.language === "ar";

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const ActionArrow = isRTL ? ArrowLeft : ArrowRight;

  return (
    <div
      id="policy-explainer-modal-backdrop"
      onClick={onClose}
      className="fixed inset-0 bottom-[4.25rem] lg:bottom-0 z-[100] bg-stone-950/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5"
      dir={isRTL ? "rtl" : "ltr"}
    >
      <div
        id="policy-explainer-modal"
        onClick={(e) => e.stopPropagation()}
        className={`bg-stone-50 rounded-3xl border border-stone-200 shadow-2xl max-w-2xl w-full max-h-[86vh] flex flex-col font-sans overflow-hidden animate-in fade-in zoom-in-95 duration-150 ${
          isRTL ? "text-right" : "text-left"
        }`}
        dir={isRTL ? "rtl" : "ltr"}
      >
        {/* Header */}
        <div className="bg-stone-900 text-white px-5 sm:px-6 py-4 flex items-center justify-between gap-3 border-b border-stone-800 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-2xl bg-sky-500/20 border border-sky-400/40 text-sky-300 flex items-center justify-center shrink-0">
              <Sparkles className="w-5 h-5 sm:w-6 sm:h-6" />
            </div>
            <div className="min-w-0">
              <h2 className="text-base sm:text-lg font-bold text-white leading-tight truncate">
                {t("policyExplainer.featuresTitle")}
              </h2>
              <p className="text-xs text-stone-300 mt-0.5 font-medium">
                {t("policyExplainer.featuresSubtitle")}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-9 h-9 rounded-xl bg-stone-800 text-stone-300 hover:text-white hover:bg-stone-700 flex items-center justify-center transition cursor-pointer border border-stone-700 shrink-0"
            aria-label={t("policyExplainer.closeAriaLabel")}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="p-4 sm:p-5 overflow-y-auto space-y-3.5 flex-1 min-h-0 text-stone-800">
          {/* 1. Booking Modes: Instant vs Manual */}
          <div className="bg-white rounded-2xl p-3.5 sm:p-4 border border-stone-200 shadow-2xs space-y-2.5">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="w-7 h-7 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
                  <Zap className="w-4 h-4" />
                </span>
                <h3 className="text-sm sm:text-base font-bold text-stone-900">
                  {t("policyExplainer.modesSectionTitle")}
                </h3>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <div className="rounded-xl p-3 bg-emerald-50/80 border border-emerald-200 space-y-1">
                <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-emerald-600 text-white text-[11px] font-bold">
                  <Zap className="w-3 h-3" />
                  {t("policyExplainer.modesInstantBadge")}
                </span>
                <p className="text-xs sm:text-[13px] text-emerald-950 leading-relaxed font-medium">
                  {t("policyExplainer.modesInstantText")}
                </p>
              </div>

              <div className="rounded-xl p-3 bg-amber-50/80 border border-amber-200 space-y-1">
                <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-amber-600 text-white text-[11px] font-bold">
                  <Clock className="w-3 h-3" />
                  {t("policyExplainer.modesManualBadge")}
                </span>
                <p className="text-xs sm:text-[13px] text-amber-950 leading-relaxed font-medium">
                  {t("policyExplainer.modesManualText")}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-stone-100 border border-stone-200 text-xs text-stone-700 font-medium">
              <Lock className="w-3.5 h-3.5 text-stone-600 shrink-0" />
              <span>{t("policyExplainer.modesLockedNote")}</span>
            </div>
          </div>

          {/* 2. Request by Category */}
          <div className="bg-violet-50/70 rounded-2xl p-3.5 sm:p-4 border border-violet-200 shadow-2xs space-y-2">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div className="flex items-center gap-2">
                <span className="w-7 h-7 rounded-xl bg-violet-600 text-white flex items-center justify-center shrink-0">
                  <Layers className="w-4 h-4" />
                </span>
                <h3 className="text-sm sm:text-base font-bold text-violet-950">
                  {t("policyExplainer.categorySectionTitle")}
                </h3>
              </div>
              <span className="px-2 py-0.5 rounded-md bg-violet-100 text-violet-800 border border-violet-200 text-[11px] font-bold">
                {t("policyExplainer.categoryBadge")}
              </span>
            </div>

            <ul className="space-y-1.5 text-xs sm:text-[13px] text-violet-950/90 leading-relaxed">
              <li className="flex items-start gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-violet-500 mt-1.5 shrink-0" />
                <span>{t("policyExplainer.categoryLine1")}</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-violet-500 mt-1.5 shrink-0" />
                <span>{t("policyExplainer.categoryLine2")}</span>
              </li>
              <li className="flex items-start gap-2 text-violet-800 font-medium">
                <span className="w-1.5 h-1.5 rounded-full bg-violet-400 mt-1.5 shrink-0" />
                <span>{t("policyExplainer.categoryExpireNote")}</span>
              </li>
            </ul>
          </div>

          {/* 3. In-Church (Free) vs Outside-Church (Fee + InstaPay) */}
          <div className="bg-white rounded-2xl p-3.5 sm:p-4 border border-stone-200 shadow-2xs space-y-2.5">
            <div className="flex items-center gap-2">
              <span className="w-7 h-7 rounded-xl bg-purple-100 text-purple-700 flex items-center justify-center shrink-0">
                <Church className="w-4 h-4" />
              </span>
              <h3 className="text-sm sm:text-base font-bold text-stone-900">
                {t("policyExplainer.usageSectionTitle")}
              </h3>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <div className="rounded-xl p-3 bg-teal-50/70 border border-teal-200 space-y-1">
                <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-teal-700 text-white text-[11px] font-bold">
                  <Church className="w-3 h-3" />
                  {t("policyExplainer.usageInChurchBadge")}
                </span>
                <p className="text-xs sm:text-[13px] text-teal-950 leading-relaxed">
                  {t("policyExplainer.usageInChurchText")}
                </p>
              </div>

              <div className="rounded-xl p-3 bg-purple-50/80 border border-purple-200 space-y-1">
                <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-purple-700 text-white text-[11px] font-bold">
                  <CreditCard className="w-3 h-3" />
                  {t("policyExplainer.usageOutsideBadge")}
                </span>
                <p className="text-xs sm:text-[13px] text-purple-950 leading-relaxed">
                  {t("policyExplainer.usageOutsideText")}
                </p>
              </div>
            </div>
          </div>

          {/* 4. Fair Usage Limits */}
          <div className="bg-amber-50/70 rounded-2xl p-3.5 sm:p-4 border border-amber-200 shadow-2xs space-y-2">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div className="flex items-center gap-2">
                <span className="w-7 h-7 rounded-xl bg-amber-600 text-white flex items-center justify-center shrink-0">
                  <ShieldCheck className="w-4 h-4" />
                </span>
                <h3 className="text-sm sm:text-base font-bold text-amber-950">
                  {t("policyExplainer.limitsSectionTitle")}
                </h3>
              </div>
              <span className="px-2 py-0.5 rounded-md bg-amber-100 text-amber-900 border border-amber-300 text-[11px] font-bold">
                {t("policyExplainer.limitsBadge")}
              </span>
            </div>

            <ul className="space-y-1.5 text-xs sm:text-[13px] text-amber-950/90 leading-relaxed">
              <li className="flex items-start gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-600 mt-1.5 shrink-0" />
                <span>{t("policyExplainer.limitsLine1")}</span>
              </li>
              <li className="flex items-start gap-2 font-semibold text-amber-950">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 mt-1.5 shrink-0" />
                <span>{t("policyExplainer.limitsLine2")}</span>
              </li>
              <li className="flex items-start gap-2 text-amber-800">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400 mt-1.5 shrink-0" />
                <span>{t("policyExplainer.limitsHardNote")}</span>
              </li>
            </ul>
          </div>

          {/* 5. Recurring Series, Quick Re-Book & Easy Edits */}
          <div className="bg-sky-50/70 rounded-2xl p-3.5 sm:p-4 border border-sky-200 shadow-2xs space-y-2">
            <div className="flex items-center gap-2">
              <span className="w-7 h-7 rounded-xl bg-sky-600 text-white flex items-center justify-center shrink-0">
                <Repeat className="w-4 h-4" />
              </span>
              <h3 className="text-sm sm:text-base font-bold text-sky-950">
                {t("policyExplainer.smartToolsTitle")}
              </h3>
            </div>

            <ul className="space-y-1.5 text-xs sm:text-[13px] text-sky-950 leading-relaxed">
              <li className="flex items-start gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-sky-600 mt-1.5 shrink-0" />
                <span>
                  <strong className="text-sky-900">
                    {t("policyExplainer.smartToolsRecurringLabel")}{" "}
                  </strong>
                  {t("policyExplainer.smartToolsRecurringText")}
                </span>
              </li>
              <li className="flex items-start gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-sky-600 mt-1.5 shrink-0" />
                <span>
                  <strong className="text-sky-900">
                    {t("policyExplainer.smartToolsQuickLabel")}{" "}
                  </strong>
                  {t("policyExplainer.smartToolsQuickText")}
                </span>
              </li>
              <li className="flex items-start gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-sky-600 mt-1.5 shrink-0" />
                <span>
                  <strong className="text-sky-900">
                    {t("policyExplainer.smartToolsEditLabel")}{" "}
                  </strong>
                  {t("policyExplainer.smartToolsEditText")}
                </span>
              </li>
            </ul>
          </div>

          {/* 6. Communication, Alerts & Condition Check */}
          <div className="space-y-2 pt-0.5">
            <h3 className="text-xs sm:text-sm font-bold text-stone-900 flex items-center gap-2 px-1">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>{t("policyExplainer.extrasTitle")}</span>
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              <div className="bg-white p-3 rounded-2xl border border-sky-200 shadow-2xs space-y-1">
                <div className="flex items-center gap-1.5 font-bold text-xs sm:text-[13px] text-sky-900">
                  <MessageSquare className="w-4 h-4 text-sky-600 shrink-0" />
                  <span>{t("policyExplainer.extraChatTitle")}</span>
                </div>
                <p className="text-xs text-stone-600 leading-relaxed">
                  {t("policyExplainer.extraChatText")}
                </p>
              </div>

              <div className="bg-white p-3 rounded-2xl border border-amber-200 shadow-2xs space-y-1">
                <div className="flex items-center gap-1.5 font-bold text-xs sm:text-[13px] text-amber-900">
                  <Bell className="w-4 h-4 text-amber-600 shrink-0" />
                  <span>{t("policyExplainer.extraNotifTitle")}</span>
                </div>
                <p className="text-xs text-stone-600 leading-relaxed">
                  {t("policyExplainer.extraNotifText")}
                </p>
              </div>

              <div className="bg-white p-3 rounded-2xl border border-emerald-200 shadow-2xs space-y-1">
                <div className="flex items-center gap-1.5 font-bold text-xs sm:text-[13px] text-emerald-900">
                  <Camera className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>{t("policyExplainer.extraCheckTitle")}</span>
                </div>
                <p className="text-xs text-stone-600 leading-relaxed">
                  {t("policyExplainer.extraCheckText")}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div
          className={`p-3 sm:p-4 bg-stone-100 border-t border-stone-200 flex flex-col sm:flex-row items-center justify-between gap-2.5 shrink-0`}
        >
          <div
            className={`text-[11px] sm:text-xs text-stone-600 text-center ${
              isRTL ? "sm:text-right" : "sm:text-left"
            }`}
          >
            {t("policyExplainer.reopenNotice")}
          </div>
          <button
            type="button"
            id="policy-explainer-dismiss-btn"
            onClick={onClose}
            className="w-full sm:w-auto px-5 py-2.5 bg-stone-900 hover:bg-stone-800 text-white text-xs sm:text-sm font-bold rounded-2xl transition cursor-pointer flex items-center justify-center gap-2 shadow-xs active:bg-stone-950 shrink-0"
          >
            <span>{t("policyExplainer.startBtn")}</span>
            <ActionArrow className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
