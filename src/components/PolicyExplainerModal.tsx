import React from "react";
import { useTranslation } from "react-i18next";
import {
  Info,
  X,
  Zap,
  ClipboardCheck,
  CheckCircle2,
  Clock,
  Layers,
  CalendarDays,
  Timer,
  Repeat,
  Gauge,
  Phone,
  DollarSign,
  ShieldCheck,
  AlertTriangle,
  ChevronDown,
} from "lucide-react";

interface HardLimitExplainer {
  icon: React.ReactNode;
  titleKey: string;
  descKey: string;
  nextKey: string;
}

const HARD_LIMIT_EXPLAINERS: HardLimitExplainer[] = [
  {
    icon: <Layers className="w-4 h-4 text-amber-800" />,
    titleKey: "policyExplainer.activeReservations",
    descKey: "policyExplainer.activeReservationsDesc",
    nextKey: "policyExplainer.activeReservationsNext",
  },
  {
    icon: <CalendarDays className="w-4 h-4 text-amber-800" />,
    titleKey: "policyExplainer.reservationsPerDay",
    descKey: "policyExplainer.reservationsPerDayDesc",
    nextKey: "policyExplainer.reservationsPerDayNext",
  },
  {
    icon: <Timer className="w-4 h-4 text-amber-800" />,
    titleKey: "policyExplainer.durationPerReservation",
    descKey: "policyExplainer.durationPerReservationDesc",
    nextKey: "policyExplainer.durationPerReservationNext",
  },
  {
    icon: <Repeat className="w-4 h-4 text-amber-800" />,
    titleKey: "policyExplainer.sameTypeLimit",
    descKey: "policyExplainer.sameTypeLimitDesc",
    nextKey: "policyExplainer.sameTypeLimitNext",
  },
  {
    icon: <Repeat className="w-4 h-4 text-amber-800" />,
    titleKey: "policyExplainer.occurrencesPerSeries",
    descKey: "policyExplainer.occurrencesPerSeriesDesc",
    nextKey: "policyExplainer.occurrencesPerSeriesNext",
  },
  {
    icon: <Gauge className="w-4 h-4 text-amber-800" />,
    titleKey: "policyExplainer.submissionRate",
    descKey: "policyExplainer.submissionRateDesc",
    nextKey: "policyExplainer.submissionRateNext",
  },
];

export interface PolicyExplainerModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const PolicyExplainerModal: React.FC<PolicyExplainerModalProps> = ({
  isOpen,
  onClose,
}) => {
  const { t } = useTranslation();
  const [showLimitExplainer, setShowLimitExplainer] =
    React.useState<boolean>(false);

  if (!isOpen) return null;

  return (
    <div
      id="policy-explainer-modal-backdrop"
      className="fixed inset-0 z-50 bg-stone-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto"
    >
      <div
        id="policy-explainer-modal"
        className="bg-white rounded-3xl border border-stone-200 shadow-2xl max-w-2xl w-full my-auto overflow-hidden animate-in fade-in zoom-in-95 duration-150 max-h-[92vh] flex flex-col"
      >
        {/* Header */}
        <div className="bg-stone-900 text-white px-6 py-5 flex items-center justify-between border-b border-stone-800 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-800 text-amber-100 flex items-center justify-center font-bold shadow-xs">
              <Info className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white leading-tight">
                {t("policyExplainer.modalTitle")}
              </h2>
              <p className="text-xs text-stone-400">
                {t("policyExplainer.modalSubtitle")}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-xl bg-stone-800 text-stone-400 hover:text-white hover:bg-stone-700 flex items-center justify-center transition cursor-pointer"
            aria-label="Close modal"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="p-6 sm:p-7 overflow-y-auto space-y-6 flex-1">
          {/* 1. Instant vs Manual */}
          <div className="space-y-2.5">
            <div className="flex items-center gap-2 text-xs font-bold text-stone-800">
              <ClipboardCheck className="w-4 h-4 text-amber-800" />
              <span>{t("policyExplainer.bookingModes")}</span>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="p-3 bg-emerald-50/70 border border-emerald-200 rounded-xl space-y-1.5">
                <div className="flex items-center gap-1.5 text-[11px] font-bold text-emerald-900">
                  <Zap className="w-3.5 h-3.5 text-emerald-700" />
                  <span>{t("policyExplainer.instantMode")}</span>
                </div>
                <p className="text-[11px] text-emerald-900/80 leading-snug">
                  {t("policyExplainer.instantModeDesc")}
                </p>
              </div>

              <div className="p-3 bg-amber-50/70 border border-amber-200 rounded-xl space-y-1.5">
                <div className="flex items-center gap-1.5 text-[11px] font-bold text-amber-900">
                  <Clock className="w-3.5 h-3.5 text-amber-700" />
                  <span>{t("policyExplainer.manualMode")}</span>
                </div>
                <p className="text-[11px] text-amber-900/80 leading-snug">
                  {t("policyExplainer.manualModeDesc")}
                </p>
              </div>
            </div>

            <p className="text-[11px] text-stone-500 leading-relaxed pt-0.5">
              {t("policyExplainer.perInstrumentNote")}
            </p>
          </div>

          {/* 2. Hard Limits */}
          <div className="space-y-2.5">
            <div className="space-y-2.5">
              <div className="flex items-center gap-2 text-xs font-bold text-stone-800">
                <ShieldCheck className="w-4 h-4 text-amber-800" />
                <span>{t("policyExplainer.fairUsageLimits")}</span>
              </div>
              <p className="text-xs text-stone-600 leading-relaxed">
                {t("policyExplainer.fairUsageDesc")}
              </p>

              <div className="p-3.5 bg-red-50 border border-red-200 rounded-2xl flex items-start gap-2.5">
                <AlertTriangle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                <p className="text-xs text-red-800 leading-relaxed">
                  {t("policyExplainer.noExceptions")}
                </p>
              </div>
            </div>
          </div>

          {/* 3. Outside-Church Fee & Payment Flow */}
          <div className="space-y-2.5">
            <div className="flex items-center gap-2 text-xs font-bold text-stone-800">
              <DollarSign className="w-4 h-4 text-amber-800" />
              <span>{t("policyExplainer.outsideFeeTitle")}</span>
            </div>
            <p className="text-xs text-stone-600 leading-relaxed">
              {t("policyExplainer.outsideFeeDesc")}
            </p>

            <div className="border border-stone-200 rounded-2xl divide-y divide-stone-100 bg-stone-50/50">
              <div className="p-3.5 flex items-start gap-3">
                <div className="w-8 h-8 rounded-xl bg-amber-100/70 border border-amber-200 flex items-center justify-center shrink-0">
                  <CheckCircle2 className="w-4 h-4 text-amber-800" />
                </div>
                <div className="text-xs space-y-0.5">
                  <div className="font-bold text-stone-900">
                    {t("policyExplainer.step1Title")}
                  </div>
                  <div className="text-stone-600 leading-relaxed">
                    {t("policyExplainer.step1Desc")}
                  </div>
                </div>
              </div>

              <div className="p-3.5 flex items-start gap-3">
                <div className="w-8 h-8 rounded-xl bg-amber-100/70 border border-amber-200 flex items-center justify-center shrink-0">
                  <Phone className="w-4 h-4 text-amber-800" />
                </div>
                <div className="text-xs space-y-0.5">
                  <div className="font-bold text-stone-900">
                    {t("policyExplainer.step2Title")}
                  </div>
                  <div className="text-stone-600 leading-relaxed">
                    {t("policyExplainer.step2Desc")}
                  </div>
                </div>
              </div>
            </div>
          </div>
          {/* 4. Hard Limit Explainer — collapsed, opt-in detail */}
          <div className="border border-stone-200 rounded-2xl overflow-hidden">
            <button
              type="button"
              id="btn-toggle-hardlimit-explainer"
              onClick={() => setShowLimitExplainer((v) => !v)}
              className="w-full flex items-center justify-between gap-3 p-4 bg-stone-50 hover:bg-stone-100 transition cursor-pointer text-start"
            >
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-stone-200 text-stone-700 flex items-center justify-center shrink-0">
                  <Gauge className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-xs font-bold text-stone-900">
                    {t("policyExplainer.hardLimitsExplained")}
                  </div>
                  <div className="text-[11px] text-stone-500">
                    {t("policyExplainer.hardLimitsSubtitle")}
                  </div>
                </div>
              </div>
              <ChevronDown
                className={`w-4 h-4 text-stone-500 shrink-0 transition-transform ${
                  showLimitExplainer ? "rotate-180" : ""
                }`}
              />
            </button>

            {showLimitExplainer && (
              <div className="p-4 pt-3 border-t border-stone-200 bg-white space-y-2.5 animate-in fade-in">
                {HARD_LIMIT_EXPLAINERS.map((item) => (
                  <div
                    key={item.titleKey}
                    className="flex items-start gap-2.5 p-2.5 rounded-xl bg-stone-50 border border-stone-100"
                  >
                    <div className="w-7 h-7 rounded-lg bg-amber-100/70 border border-amber-200 flex items-center justify-center shrink-0">
                      {item.icon}
                    </div>
                    <div className="text-xs space-y-0.5">
                      <div className="font-bold text-stone-900">
                        {t(item.titleKey)}
                      </div>
                      <div className="text-stone-600 leading-snug">
                        {t(item.descKey)}
                      </div>
                      <div className="text-stone-500 leading-snug">
                        <span className="font-semibold text-stone-700">
                          {t("common.next", "Next:")}
                        </span>{" "}
                        {t(item.nextKey)}
                      </div>
                    </div>
                  </div>
                ))}

                <div className="pt-2 border-t border-stone-100 flex items-start gap-2 text-[11px] text-stone-500">
                  <ShieldCheck className="w-3.5 h-3.5 text-amber-700 shrink-0 mt-0.5" />
                  <span>{t("policyExplainer.fairUsageFooter")}</span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 bg-stone-50 border-t border-stone-200 flex items-center justify-end shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-stone-900 hover:bg-stone-800 text-white text-xs font-bold rounded-xl transition cursor-pointer"
          >
            {t("policyExplainer.gotIt")}
          </button>
        </div>
      </div>
    </div>
  );
};
