import React, { useState, useEffect, useMemo } from "react";
import { useTranslation } from "react-i18next";
import i18n from "../lib/i18n";
import { Instrument } from "./AvailabilityCalendar.tsx";
import { useAuth } from "../contexts/AuthContext.tsx";
import { PolicyExplainerModal } from "./PolicyExplainerModal.tsx";
import { formatHhmmTo12Hour, getTodayDateString } from "../lib/date-utils";
import {
  Calendar,
  Clock,
  Music2,
  DollarSign,
  AlertCircle,
  CheckCircle2,
  AlertTriangle,
  X,
  Repeat,
  Sparkles,
  Shield,
  HelpCircle,
  ChevronRight,
  ArrowRight,
  User,
  FileText,
  Church,
  Zap,
} from "lucide-react";

export interface ReservationFormProps {
  initialInstrument: Instrument;
  allInstruments: Instrument[];
  initialDate: string; // 'YYYY-MM-DD'
  initialTimeHhmm: string; // 'HH:mm'
  initialDuration?: number; // hours
  onClose: () => void;
  onSuccess: (reservationData: any) => void;
  onOpenSeriesBuilder?: (prefill: {
    instrument: Instrument;
    serviceName: string;
    musicianName: string;
    date: string;
    startTime: string;
    duration: number;
    reservationType: "in_church" | "outside_church";
    note?: string;
  }) => void;
}

const TIME_SLOTS = [
  "09:00",
  "09:30",
  "10:00",
  "10:30",
  "11:00",
  "11:30",
  "12:00",
  "12:30",
  "13:00",
  "13:30",
  "14:00",
  "14:30",
  "15:00",
  "15:30",
  "16:00",
  "16:30",
  "17:00",
  "17:30",
  "18:00",
  "18:30",
  "19:00",
  "19:30",
  "20:00",
  "20:30",
  "21:00",
  "21:30",
];

const DURATION_OPTIONS = [
  { labelKey: "reservationForm.duration30m", value: 0.5 },
  { labelKey: "reservationForm.duration1h", value: 1 },
  { labelKey: "reservationForm.duration1h30", value: 1.5 },
  { labelKey: "reservationForm.duration2h", value: 2 },
  { labelKey: "reservationForm.duration2h30", value: 2.5 },
  { labelKey: "reservationForm.duration3h", value: 3 },
  { labelKey: "reservationForm.duration4h", value: 4 },
  { labelKey: "reservationForm.duration5h", value: 5 },
];

interface LimitMessage {
  title: string;
  description: string;
  nextStep: string;
}

const getLimitMessage = (reason: string): LimitMessage | null => {
  const activeReservationsMatch = reason.match(
    /active reservations limit \((\d+)\/(\d+)\)/i,
  );
  if (activeReservationsMatch) {
    return {
      title: i18n.t("reservationForm.activeLimitTitle"),
      description: i18n.t("reservationForm.activeLimitDesc", {
        current: activeReservationsMatch[1],
        max: activeReservationsMatch[2],
      }),
      nextStep: i18n.t("reservationForm.activeLimitNext"),
    };
  }

  const dailyReservationsMatch = reason.match(
    /daily reservations limit \((\d+)\/(\d+)\)/i,
  );
  if (dailyReservationsMatch) {
    return {
      title: i18n.t("reservationForm.dailyLimitTitle"),
      description: i18n.t("reservationForm.dailyLimitDesc", {
        current: dailyReservationsMatch[1],
        max: dailyReservationsMatch[2],
      }),
      nextStep: i18n.t("reservationForm.dailyLimitNext"),
    };
  }

  const durationMatch = reason.match(
    /requested (\d+(?:\.\d+)?) hours, but maximum allowed is (\d+(?:\.\d+)?)/i,
  );
  if (durationMatch) {
    return {
      title: i18n.t("reservationForm.durationLimitTitle"),
      description: i18n.t("reservationForm.durationLimitDesc", {
        actual: durationMatch[1],
        max: durationMatch[2],
      }),
      nextStep: i18n.t("reservationForm.durationLimitNext"),
    };
  }

  const categoryLimitMatch = reason.match(
    /category limit: you already have (\d+) active reservation.*max allowed is (\d+)/i,
  );
  if (categoryLimitMatch) {
    return {
      title: i18n.t("reservationForm.categoryLimitTitle"),
      description: i18n.t("reservationForm.categoryLimitDesc", {
        current: categoryLimitMatch[1],
        max: categoryLimitMatch[2],
      }),
      nextStep: i18n.t("reservationForm.categoryLimitNext"),
    };
  }

  const seriesMatch = reason.match(
    /at most (\d+) occurrences.*selected (\d+)/i,
  );
  if (seriesMatch) {
    return {
      title: i18n.t("reservationForm.seriesLimitTitle"),
      description: i18n.t("reservationForm.seriesLimitDesc", {
        actual: seriesMatch[2],
        max: seriesMatch[1],
      }),
      nextStep: i18n.t("reservationForm.seriesLimitNext"),
    };
  }

  const submissionRateMatch = reason.match(
    /limit of (\d+) submissions per hour/i,
  );
  if (submissionRateMatch) {
    return {
      title: i18n.t("reservationForm.rateLimitTitle"),
      description: i18n.t("reservationForm.rateLimitDesc", {
        max: submissionRateMatch[1],
      }),
      nextStep: i18n.t("reservationForm.rateLimitNext"),
    };
  }

  return null;
};

export const ReservationFormModal: React.FC<ReservationFormProps> = ({
  initialInstrument,
  allInstruments,
  initialDate,
  initialTimeHhmm,
  initialDuration = 2,
  onClose,
  onSuccess,
  onOpenSeriesBuilder,
}) => {
  const { profile, sessionToken } = useAuth();
  const { t, i18n } = useTranslation();
  const isAr = i18n.language === "ar";

  // Form State
  const [selectedInstrumentId, setSelectedInstrumentId] = useState<string>(
    initialInstrument.id,
  );
  const [serviceName, setServiceName] = useState<string>("");
  const [musicianName, setMusicianName] = useState<string>("");
  const [note, setNote] = useState<string>("");
  const [date, setDate] = useState<string>(initialDate);
  const [startTime, setStartTime] = useState<string>(
    initialTimeHhmm || "10:00",
  );
  const [duration, setDuration] = useState<number>(initialDuration);
  const [reservationType, setReservationType] = useState<
    "in_church" | "outside_church"
  >("in_church");
  const [feeAcknowledged, setFeeAcknowledged] = useState<boolean>(false);
  const [isRecurring, setIsRecurring] = useState<boolean>(false);
  const [showPolicyExplainer, setShowPolicyExplainer] =
    useState<boolean>(false);

  // Status & Submission States
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const isAdmin = Boolean(
    profile?.role === "admin" ||
    profile?.role === "super_admin" ||
    profile?.isSuperAdmin,
  );

  const durationOptions = useMemo(() => {
    if (isAdmin) {
      return [
        ...DURATION_OPTIONS,
        { labelKey: "reservationForm.durationFullDay", value: 13 },
      ];
    }
    return DURATION_OPTIONS;
  }, [isAdmin]);

  const [submissionResult, setSubmissionResult] = useState<{
    reservation: any;
    evaluation: {
      status: "approved" | "pending";
      reasons: string[];
      isTrustedOrAdmin: boolean;
      outsideFeeSnapshot: string | null;
      startTimeUtc: string;
      endTimeUtc: string;
    };
  } | null>(null);

  // Find active instrument object
  const currentInstrument =
    allInstruments.find((i) => i.id === selectedInstrumentId) ||
    initialInstrument;

  // Calculate formatted end time
  const [startH, startM] = startTime.split(":").map(Number);
  const startTotalMinutes = startH * 60 + startM;
  const endTotalMinutes = startTotalMinutes + Math.round(duration * 60);
  const endH = Math.floor(endTotalMinutes / 60);
  const endM = endTotalMinutes % 60;
  const endTimeStr = `${String(endH).padStart(2, "0")}:${String(endM).padStart(2, "0")}`;

  const todayStr = getTodayDateString();

  // Price calculations
  const feeNumber =
    currentInstrument.dailyRentalFee != null
      ? Number(currentInstrument.dailyRentalFee)
      : 0;

  useEffect(() => {
    if (reservationType === "in_church") {
      setFeeAcknowledged(false);
    }
  }, [reservationType]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!profile) {
      setErrorMsg(t("reservationForm.msgSignInRequired"));
      return;
    }

    if (!serviceName.trim()) {
      setErrorMsg(t("reservationForm.msgSpecifyPurpose"));
      return;
    }

    if (!musicianName.trim()) {
      setErrorMsg(t("reservationForm.musicianNameRequired"));
      return;
    }

    if (reservationType === "outside_church" && !feeAcknowledged) {
      setErrorMsg(t("reservationForm.msgAcknowledgeFee"));
      return;
    }

    // If recurring is checked, handover to the Series Builder modal
    if (isRecurring && onOpenSeriesBuilder) {
      onOpenSeriesBuilder({
        instrument: currentInstrument,
        serviceName: serviceName.trim(),
        musicianName: musicianName.trim(),
        date,
        startTime,
        duration,
        reservationType,
        note: note.trim() || undefined,
      });
      return;
    }

    setIsSubmitting(true);
    setErrorMsg(null);

    try {
      const isAdminRole =
        profile.role === "admin" || profile.role === "super_admin";
      const res = await fetch("/api/reservations", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${sessionToken}`,
        },
        body: JSON.stringify({
          userId: isAdminRole ? null : profile.id,
          adminId: isAdminRole ? profile.id : null,
          instrumentId: currentInstrument.id,
          serviceName: serviceName.trim(),
          musicianName: musicianName.trim(),
          note: note.trim() || undefined,
          date,
          startTime,
          duration,
          reservationType,
          feeAcknowledged:
            reservationType === "outside_church" ? feeAcknowledged : false,
        }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        setErrorMsg(data.error || t("reservationForm.msgSubmitFailed"));
        setIsSubmitting(false);
        return;
      }

      setSubmissionResult({
        reservation: data.reservation,
        evaluation: data.evaluation,
      });
      setIsSubmitting(false);
      onSuccess(data);
    } catch (err: any) {
      setErrorMsg(err.message || t("reservationForm.msgNetworkError"));
      setIsSubmitting(false);
    }
  };

  const isSubmitDisabled =
    isSubmitting ||
    !serviceName.trim() ||
    !musicianName.trim() ||
    (reservationType === "outside_church" && !feeAcknowledged);

  return (
    <>
      <div
        id="reservation-form-modal-backdrop"
        className="fixed inset-0 z-50 bg-stone-900/60 backdrop-blur-xs flex items-stretch sm:items-center justify-center p-0 sm:p-4"
      >
        <div
          id="reservation-form-modal"
          className="bg-stone-50 sm:rounded-3xl sm:border sm:border-stone-200 shadow-2xl w-full sm:max-w-xl z-10 flex flex-col h-full sm:h-auto sm:max-h-[90vh] overflow-hidden animate-in fade-in zoom-in-95 duration-150 pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]"
          dir={isAr ? "rtl" : "ltr"}
        >
          {/* Modal Top Header */}
          <div className="shrink-0 bg-stone-900 text-white px-4 sm:px-6 py-3.5 sm:py-4 flex items-center justify-between border-b border-stone-800">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 rounded-2xl bg-amber-800 text-amber-100 flex items-center justify-center font-bold shadow-xs shrink-0">
                <Music2 className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <h2 className="text-sm sm:text-base font-bold text-white leading-tight truncate">
                    {submissionResult
                      ? t("reservationForm.confirmTitle")
                      : t("reservationForm.title")}
                  </h2>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-900/60 text-amber-200 border border-amber-700/50 hidden sm:inline-block">
                    {currentInstrument.name}
                  </span>
                </div>
                <p className="text-[11px] sm:text-xs text-stone-400 truncate mt-0.5">
                  {submissionResult
                    ? t("reservationForm.confirmSubtitle")
                    : t("reservationForm.formSubtitle")}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1.5 shrink-0">
              <button
                type="button"
                onClick={() => setShowPolicyExplainer(true)}
                className="w-9 h-9 sm:w-10 sm:h-10 flex items-center justify-center rounded-xl bg-stone-800/90 text-amber-300 hover:text-white hover:bg-stone-700 transition cursor-pointer border border-stone-700/70"
                title={t("nav.howBookingWorks")}
              >
                <HelpCircle className="w-4 h-4 sm:w-4.5 sm:h-4.5" />
              </button>

              <button
                id="btn-close-reservation-modal"
                onClick={onClose}
                className="w-9 h-9 sm:w-10 sm:h-10 flex items-center justify-center rounded-xl bg-stone-800/90 text-stone-300 hover:text-white hover:bg-stone-700 active:bg-stone-600 transition cursor-pointer border border-stone-700/70"
                aria-label="Close modal"
              >
                <X className="w-4 h-4 sm:w-5 sm:h-5" />
              </button>
            </div>
          </div>

          {/* ------------------------------------------------------------- */}
          {/* SUCCESS / OUTCOME RECEIPT VIEW */}
          {/* ------------------------------------------------------------- */}
          {submissionResult ? (
            <>
              <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain p-4 sm:p-6 space-y-4 sm:space-y-5 bg-white">
                {/* Status Hero Card */}
                {submissionResult.evaluation.status === "approved" ? (
                  <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 sm:p-5 text-emerald-900 flex items-start gap-3.5 shadow-2xs">
                    <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-sm">
                      <CheckCircle2 className="w-6 h-6" />
                    </div>
                    <div className="space-y-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-base text-emerald-950">
                          {t("reservationForm.resultApprovedTitle")}
                        </span>
                        <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-emerald-200 text-emerald-900 uppercase tracking-wide whitespace-nowrap">
                          {t("reservationForm.resultInstantBadge")}
                        </span>
                      </div>
                      <p className="text-xs text-emerald-800 leading-relaxed">
                        {t("reservationForm.resultApprovedDesc")}
                      </p>
                      {submissionResult.evaluation.reasons.length > 0 && (
                        <div className="pt-2 text-[11px] text-emerald-900 font-medium space-y-1">
                          {submissionResult.evaluation.reasons.map((r, i) => (
                            <div key={i} className="flex items-start gap-1.5">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 mt-1.5 shrink-0" />
                              <span>{r}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 sm:p-5 text-amber-900 flex items-start gap-3.5 shadow-2xs">
                    <div className="w-10 h-10 rounded-xl bg-amber-600 text-white flex items-center justify-center shrink-0 shadow-sm">
                      <Clock className="w-5 h-5" />
                    </div>
                    <div className="space-y-1.5 min-w-0">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="font-bold text-sm sm:text-base text-amber-950">
                          {t("reservationForm.resultPendingTitle")}
                        </span>
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-200 text-amber-900 uppercase tracking-wide whitespace-nowrap">
                          {t("reservationForm.resultPendingBadge")}
                        </span>
                      </div>
                      <p className="text-xs text-amber-800 leading-relaxed">
                        {t("reservationForm.queuedForAdmin")}
                      </p>

                      {submissionResult.evaluation.reasons.length > 0 && (
                        <div className="pt-2 border-t border-amber-200/80 space-y-1">
                          <span className="text-[11px] font-bold text-amber-950 block">
                            {t("reservationForm.whyPendingLabel")}
                          </span>
                          {submissionResult.evaluation.reasons.map((r, i) => (
                            <div
                              key={i}
                              className="text-[11px] text-amber-900 flex items-start gap-1.5"
                            >
                              <span className="w-1.5 h-1.5 rounded-full bg-amber-600 mt-1.5 shrink-0" />
                              <span>{r}</span>
                            </div>
                          ))}
                        </div>
                      )}

                      <div className="pt-2 text-[11px] text-amber-800/90 font-medium">
                        {t("reservationForm.msgWhatsAppNotice")}
                      </div>
                    </div>
                  </div>
                )}

                {/* Receipt Summary Grid */}
                <div className="bg-stone-50 border border-stone-200 rounded-2xl p-4 sm:p-5 space-y-3 text-xs shadow-2xs">
                  <div className="font-bold text-stone-900 text-sm border-b border-stone-200 pb-2 flex items-center justify-between">
                    <span>{t("reservationForm.bookingDetailsTitle")}</span>
                    <span className="text-[11px] text-stone-500 font-mono">
                      #{submissionResult.reservation.id?.slice(0, 8)}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="min-w-0">
                      <span className="text-stone-500 font-medium block">
                        {t("reservationForm.instrumentColonLabel")}
                      </span>
                      <span className="font-bold text-stone-900 text-sm block truncate">
                        {currentInstrument.name}
                      </span>
                      <span className="text-[11px] text-stone-500 block truncate">
                        {currentInstrument.type}
                      </span>
                    </div>
                    <div className="min-w-0">
                      <span className="text-stone-500 font-medium block">
                        {t("reservationForm.typeColonLabel")}
                      </span>
                      <span className="font-bold text-stone-900 capitalize">
                        {submissionResult.reservation.reservationType ===
                        "in_church"
                          ? t("reservationForm.inChurchFreeLabel")
                          : t("reservationForm.outsideChurchPaidLabel")}
                      </span>
                      {submissionResult.reservation.feeSnapshot && (
                        <span className="text-[11px] text-purple-700 font-semibold block">
                          {t("reservationForm.feePerDayLabel", {
                            fee: submissionResult.reservation.feeSnapshot,
                          })}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="pt-2 border-t border-stone-200">
                    <span className="text-stone-500 font-medium block">
                      {t("reservationForm.purposeColonLabel")}
                    </span>
                    <span className="font-bold text-stone-900 text-sm">
                      {submissionResult.reservation.serviceName ||
                        serviceName ||
                        t("reservationForm.notSpecifiedLabel")}
                    </span>
                  </div>
                  <div className="pt-2 border-t border-stone-200">
                    <span className="text-stone-500 font-medium block">
                      {t("reservationForm.musicianNameLabel")}
                    </span>
                    <span className="font-bold text-stone-900 text-sm">
                      {submissionResult.reservation.musicianName ||
                        musicianName}
                    </span>
                  </div>

                  {(submissionResult.reservation.note || note) && (
                    <div className="pt-2 border-t border-stone-200">
                      <span className="text-stone-500 font-medium block">
                        {t("reservationForm.leaveANoteLabel") || "Notes"}
                      </span>
                      <span className="font-medium text-stone-900 text-xs whitespace-pre-wrap">
                        {submissionResult.reservation.note || note}
                      </span>
                    </div>
                  )}

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-stone-200">
                    <div>
                      <span className="text-stone-500 font-medium block">
                        {t("reservationForm.dateTimeColonLabel")}
                      </span>
                      <span className="font-semibold text-stone-900">
                        {date}
                      </span>
                      <span className="text-[11px] text-stone-600 block">
                        {formatHhmmTo12Hour(startTime)} –{" "}
                        {formatHhmmTo12Hour(endTimeStr)} ({duration}h)
                      </span>
                    </div>

                    <div>
                      <span className="text-stone-500 font-medium block">
                        {t("reservationForm.reservationIdColonLabel")}
                      </span>
                      <span className="font-mono text-stone-800 text-[11px] break-all">
                        {submissionResult.reservation.id}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Receipt Footer Actions */}
              <div className="shrink-0 p-4 sm:px-6 sm:pb-5 border-t border-stone-200 bg-white">
                <button
                  type="button"
                  id="btn-done-back-calendar"
                  onClick={onClose}
                  className="w-full py-3 bg-stone-900 hover:bg-stone-800 active:bg-stone-950 text-white text-sm font-bold rounded-2xl transition cursor-pointer shadow-md touch-manipulation"
                >
                  {t("reservationForm.doneBackToCalendar")}
                </button>
              </div>
            </>
          ) : (
            /* ------------------------------------------------------------- */
            /* RESERVATION INPUT FORM VIEW */
            /* ------------------------------------------------------------- */
            <form
              onSubmit={handleSubmit}
              className="flex flex-col flex-1 min-h-0"
            >
              {/* Scrollable Form Body */}
              <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain p-4 sm:p-6 space-y-4 sm:space-y-5">
                {/* Error Notification Banner */}
                {errorMsg && (
                  <div
                    id="reservation-form-error-banner"
                    className="bg-red-50 border border-red-200 rounded-2xl p-4 text-red-900 flex items-start gap-3 animate-in fade-in shadow-2xs"
                  >
                    <AlertCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
                    <div className="space-y-1 text-xs flex-1">
                      <div className="font-bold text-red-950">
                        {getLimitMessage(errorMsg)?.title ||
                          t("reservationForm.submissionBlocked")}
                      </div>
                      <div className="text-red-800 leading-relaxed">
                        {getLimitMessage(errorMsg)?.description || errorMsg}
                      </div>
                      {getLimitMessage(errorMsg) && (
                        <div className="text-red-700 leading-relaxed pt-1 border-t border-red-200/80">
                          <span className="font-semibold">
                            {t("policyExplainer.step2Title", "What to do:")}
                          </span>{" "}
                          {getLimitMessage(errorMsg)?.nextStep}
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Section 1: Instrument & Mode Hero Card */}
                <div className="bg-white rounded-2xl border border-stone-200 p-3.5 sm:p-4 shadow-2xs space-y-3">
                  <div className="flex items-center justify-between gap-2 border-b border-stone-100 pb-2.5">
                    <span className="text-xs font-bold text-stone-800 flex items-center gap-1.5">
                      <Music2 className="w-4 h-4 text-amber-800" />
                      <span>{t("reservationForm.selectedInstrumentLabel")}</span>
                    </span>
                    <span
                      className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider ${
                        currentInstrument.bookingMode === "instant"
                          ? "bg-emerald-100 text-emerald-900 border border-emerald-200"
                          : "bg-amber-100 text-amber-900 border border-amber-200"
                      }`}
                    >
                      {currentInstrument.bookingMode === "instant" ? (
                        <>
                          <Zap className="w-2.5 h-2.5" />
                          <span>{t("common.instant")}</span>
                        </>
                      ) : (
                        <>
                          <Shield className="w-2.5 h-2.5" />
                          <span>{t("common.manual")}</span>
                        </>
                      )}
                    </span>
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="w-14 h-14 rounded-2xl bg-amber-50 border border-amber-200 text-amber-800 flex items-center justify-center shrink-0 overflow-hidden shadow-2xs">
                      {currentInstrument.photoUrl ? (
                        <img
                          src={currentInstrument.photoUrl}
                          alt={currentInstrument.name}
                          referrerPolicy="no-referrer"
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <Music2 className="w-6 h-6 text-amber-800" />
                      )}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="relative">
                        <select
                          id="select-instrument"
                          value={selectedInstrumentId}
                          onChange={(e) =>
                            setSelectedInstrumentId(e.target.value)
                          }
                          className="w-full appearance-none bg-stone-50 hover:bg-stone-100/80 border border-stone-200 rounded-xl px-3 py-2 text-xs sm:text-sm font-bold text-stone-900 focus:outline-none focus:ring-2 focus:ring-amber-800/40 focus:border-amber-800 transition cursor-pointer pr-8"
                        >
                          {allInstruments.map((inst) => (
                            <option key={inst.id} value={inst.id}>
                              {inst.name} ({inst.type})
                            </option>
                          ))}
                        </select>
                        <div
                          className={`pointer-events-none absolute inset-y-0 flex items-center px-2.5 text-stone-500 ${
                            isAr ? "left-0" : "right-0"
                          }`}
                        >
                          <ChevronRight
                            className={`w-3.5 h-3.5 ${isAr ? "-rotate-90" : "rotate-90"}`}
                          />
                        </div>
                      </div>

                      <div className="flex items-center gap-2 mt-1.5 text-[11px] text-stone-500">
                        <span className="font-medium">{currentInstrument.type}</span>
                        {currentInstrument.dailyRentalFee != null && (
                          <>
                            <span>•</span>
                            <span className="font-semibold text-purple-700">
                              {currentInstrument.dailyRentalFee} ج.م/يوم (خارج الكنيسة)
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Section 2: Service & Musician Inputs */}
                <div className="bg-white rounded-2xl border border-stone-200 p-3.5 sm:p-4 shadow-2xs space-y-3">
                  <div className="text-xs font-bold text-stone-800 flex items-center gap-1.5 border-b border-stone-100 pb-2">
                    <User className="w-4 h-4 text-amber-800" />
                    <span>بيانات الخدمة والعازف</span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label
                        htmlFor="input-service-name"
                        className="block text-xs font-bold text-stone-700"
                      >
                        {t("reservationForm.purposeQuestionLabel")}{" "}
                        <span className="text-amber-800 font-bold">*</span>
                      </label>
                      <input
                        id="input-service-name"
                        type="text"
                        value={serviceName}
                        onChange={(e) => setServiceName(e.target.value)}
                        placeholder={t("reservationForm.serviceNamePlaceholder")}
                        className="w-full bg-stone-50 border border-stone-300 rounded-xl px-3 py-2 text-xs sm:text-sm font-medium text-stone-900 placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-amber-800/40 focus:border-amber-800 transition"
                        required
                      />
                    </div>

                    <div className="space-y-1">
                      <label
                        htmlFor="input-musician-name"
                        className="block text-xs font-bold text-stone-700"
                      >
                        {t("reservationForm.musicianNameLabel")}{" "}
                        <span className="text-amber-800 font-bold">*</span>
                      </label>
                      <input
                        id="input-musician-name"
                        type="text"
                        value={musicianName}
                        onChange={(e) => setMusicianName(e.target.value)}
                        placeholder={t("reservationForm.musicianNamePlaceholder")}
                        className="w-full bg-stone-50 border border-stone-300 rounded-xl px-3 py-2 text-xs sm:text-sm font-medium text-stone-900 placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-amber-800/40 focus:border-amber-800 transition"
                        required
                      />
                    </div>
                  </div>

                  {/* Optional Notes */}
                  <div className="space-y-1 pt-1">
                    <div className="flex items-center justify-between">
                      <label
                        htmlFor="input-reservation-note"
                        className="block text-xs font-bold text-stone-700"
                      >
                        {t("reservationForm.leaveANoteLabel", {
                          defaultValue: "ملاحظات / طلبات خاصة",
                        })}
                      </label>
                      <span className="text-[10px] text-stone-400 font-medium">
                        ({t("common.optional", { defaultValue: "اختياري" })})
                      </span>
                    </div>
                    <textarea
                      id="input-reservation-note"
                      rows={2}
                      value={note}
                      onChange={(e) => setNote(e.target.value)}
                      placeholder={t("reservationForm.notePlaceholder", {
                        defaultValue:
                          "أي طلبات خاصة أو مستلزمات مثل محول أو كابل...",
                      })}
                      className="w-full bg-stone-50 border border-stone-300 rounded-xl px-3 py-2 text-xs sm:text-sm font-medium text-stone-900 placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-amber-800/40 focus:border-amber-800 transition resize-none"
                    />
                  </div>
                </div>

                {/* Section 3: Date, Time & Duration Card */}
                <div className="bg-white rounded-2xl border border-stone-200 p-3.5 sm:p-4 shadow-2xs space-y-3.5">
                  <div className="flex items-center justify-between border-b border-stone-100 pb-2">
                    <span className="text-xs font-bold text-stone-800 flex items-center gap-1.5">
                      <Calendar className="w-4 h-4 text-amber-800" />
                      <span>الموعد والتوقيت</span>
                    </span>
                    <span className="text-[11px] font-bold text-amber-900 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-lg whitespace-nowrap">
                      {isAr ? (
                        <>
                          {formatHhmmTo12Hour(startTime)} ←{" "}
                          {formatHhmmTo12Hour(endTimeStr)} ({duration}h)
                        </>
                      ) : (
                        <>
                          {formatHhmmTo12Hour(startTime)} →{" "}
                          {formatHhmmTo12Hour(endTimeStr)} ({duration}h)
                        </>
                      )}
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {/* Date Input */}
                    <div className="space-y-1">
                      <label className="block text-xs font-bold text-stone-700">
                        {t("reservationForm.dateLabel")}
                      </label>
                      <input
                        id="input-reservation-date"
                        type="date"
                        value={date}
                        min={todayStr}
                        onChange={(e) => setDate(e.target.value)}
                        className="w-full bg-stone-50 border border-stone-300 rounded-xl px-3 py-2 text-xs sm:text-sm font-medium text-stone-900 focus:outline-none focus:ring-2 focus:ring-amber-800/40 focus:border-amber-800 transition"
                        required
                      />
                    </div>

                    {/* Start Time Select */}
                    <div className="space-y-1">
                      <label className="block text-xs font-bold text-stone-700">
                        {t("reservationForm.startTimeLabel")}
                      </label>
                      <div className="relative">
                        <select
                          id="select-start-time"
                          value={startTime}
                          onChange={(e) => setStartTime(e.target.value)}
                          className="w-full appearance-none bg-stone-50 border border-stone-300 rounded-xl px-3 py-2 text-xs sm:text-sm font-medium text-stone-900 focus:outline-none focus:ring-2 focus:ring-amber-800/40 focus:border-amber-800 transition pr-8 cursor-pointer"
                        >
                          {TIME_SLOTS.map((slot) => (
                            <option key={slot} value={slot}>
                              {formatHhmmTo12Hour(slot)}
                            </option>
                          ))}
                        </select>
                        <div
                          className={`pointer-events-none absolute inset-y-0 flex items-center px-2.5 text-stone-500 ${
                            isAr ? "left-0" : "right-0"
                          }`}
                        >
                          <ChevronRight
                            className={`w-3.5 h-3.5 ${isAr ? "-rotate-90" : "rotate-90"}`}
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Duration Selector */}
                  <div className="space-y-1.5 pt-1">
                    <label className="block text-xs font-bold text-stone-700">
                      {t("reservationForm.durationLabel")}
                    </label>
                    <div className="grid grid-cols-4 sm:grid-cols-4 gap-1.5 sm:gap-2">
                      {durationOptions.map((opt) => (
                        <button
                          key={opt.value}
                          type="button"
                          onClick={() => {
                            setDuration(opt.value);
                            if (opt.value === 13) {
                              setStartTime("09:00");
                            }
                          }}
                          className={`py-2 px-1.5 rounded-xl text-[11px] sm:text-xs font-bold text-center transition cursor-pointer border active:scale-[0.98] touch-manipulation ${
                            duration === opt.value
                              ? "bg-amber-800 text-white border-amber-900 shadow-xs ring-2 ring-amber-800/20"
                              : "bg-stone-50 hover:bg-stone-100 text-stone-700 border-stone-200"
                          } ${
                            opt.value === 13
                              ? "col-span-2 sm:col-span-1 border-amber-400 bg-amber-50/50"
                              : ""
                          }`}
                        >
                          {t(opt.labelKey)}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Section 4: Reservation Location / Scope (In vs Outside Church) */}
                <div className="bg-white rounded-2xl border border-stone-200 p-3.5 sm:p-4 shadow-2xs space-y-3">
                  <div className="text-xs font-bold text-stone-800 flex items-center gap-1.5 border-b border-stone-100 pb-2">
                    <Church className="w-4 h-4 text-amber-800" />
                    <span>{t("reservationForm.usageTypeLabel")}</span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 sm:gap-3">
                    {/* In-Church Option */}
                    <button
                      type="button"
                      id="btn-type-in-church"
                      onClick={() => {
                        setReservationType("in_church");
                        setFeeAcknowledged(false);
                      }}
                      className={`p-3 sm:p-3.5 rounded-2xl border text-left transition cursor-pointer flex flex-col justify-between active:scale-[0.98] touch-manipulation ${
                        reservationType === "in_church"
                          ? "bg-emerald-50/60 border-emerald-600 ring-2 ring-emerald-600/30"
                          : "bg-stone-50/60 hover:bg-stone-100 border-stone-200 text-stone-700"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-1 mb-1">
                        <span className="font-bold text-xs text-stone-900">
                          {t("reservationForm.inChurchUseLabel")}
                        </span>
                        <span className="px-1.5 py-0.5 rounded-md text-[10px] font-bold bg-emerald-100 text-emerald-800 whitespace-nowrap">
                          {t("reservationForm.freeBadge")}
                        </span>
                      </div>
                      <p className="text-[11px] text-stone-500 leading-tight text-start">
                        {t("reservationForm.inChurchDesc")}
                      </p>
                    </button>

                    {/* Outside-Church Option */}
                    <button
                      type="button"
                      id="btn-type-outside-church"
                      onClick={() => setReservationType("outside_church")}
                      className={`p-3 sm:p-3.5 rounded-2xl border text-left transition cursor-pointer flex flex-col justify-between active:scale-[0.98] touch-manipulation ${
                        reservationType === "outside_church"
                          ? "bg-purple-50/60 border-purple-600 ring-2 ring-purple-600/30"
                          : "bg-stone-50/60 hover:bg-stone-100 border-stone-200 text-stone-700"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-1 mb-1">
                        <span className="font-bold text-xs text-stone-900">
                          {t("reservationForm.outsideChurchLabel")}
                        </span>
                        <span className="px-1.5 py-0.5 rounded-md text-[10px] font-bold bg-purple-100 text-purple-800 whitespace-nowrap">
                          {t("reservationForm.egpPerDayBadge", {
                            fee: feeNumber,
                          })}
                        </span>
                      </div>
                      <p className="text-[11px] text-stone-500 leading-tight text-start">
                        {t("reservationForm.outsideChurchDesc")}
                      </p>
                    </button>
                  </div>

                  {/* Outside Church Fee Notice */}
                  {reservationType === "outside_church" && (
                    <div
                      id="outside-fee-acknowledgment-box"
                      className="bg-purple-50/80 border border-purple-200 rounded-2xl p-3.5 space-y-2.5 animate-in fade-in"
                    >
                      <div className="flex items-start gap-2.5">
                        <DollarSign className="w-4 h-4 text-purple-700 mt-0.5 shrink-0" />
                        <div className="text-xs space-y-1 min-w-0 flex-1">
                          <div className="font-bold text-purple-950">
                            {t("reservationForm.policyFeeTitle")}
                          </div>
                          <div className="text-purple-900 text-[11px] leading-relaxed">
                            {t("reservationForm.policyFeeDesc", {
                              fee: (
                                <strong
                                  key="fee"
                                  className="font-bold text-purple-950"
                                >
                                  {`EGP ${feeNumber}`}
                                </strong>
                              ) as any,
                            })}
                          </div>
                        </div>
                      </div>

                      <label className="flex items-start gap-2.5 pt-2 border-t border-purple-200/80 cursor-pointer select-none">
                        <input
                          id="checkbox-fee-acknowledged"
                          type="checkbox"
                          checked={feeAcknowledged}
                          onChange={(e) => setFeeAcknowledged(e.target.checked)}
                          className="mt-0.5 w-4 h-4 rounded-md border-purple-300 text-purple-700 focus:ring-purple-600 cursor-pointer shrink-0"
                        />
                        <span className="text-xs font-semibold text-purple-950">
                          {t("reservationForm.feeAcknowledgeFull", {
                            fee: feeNumber,
                          })}
                        </span>
                      </label>
                    </div>
                  )}
                </div>

                {/* Section 5: Recurring Series Option */}
                <div className="bg-white border border-stone-200 rounded-2xl p-3 sm:p-3.5 shadow-2xs">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-xl bg-amber-100/80 text-amber-900 flex items-center justify-center shrink-0">
                        <Repeat className="w-4 h-4" />
                      </div>
                      <div>
                        <span className="text-xs font-bold text-stone-900 block">
                          {t("reservationForm.recurringToggleLabel")}
                        </span>
                        <span className="text-[11px] text-stone-500 block">
                          تكرار الحجز أسبوعياً أو في تواريخ متعددة
                        </span>
                      </div>
                    </div>

                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        id="toggle-recurring-series"
                        type="checkbox"
                        checked={isRecurring}
                        onChange={(e) => setIsRecurring(e.target.checked)}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-stone-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-stone-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-amber-800" />
                    </label>
                  </div>

                  {isRecurring && (
                    <div className="mt-2.5 pt-2 border-t border-stone-100 text-xs text-amber-900 bg-amber-50/60 p-2.5 rounded-xl flex items-center justify-between gap-2">
                      <span>{t("reservationForm.recurringNextStepNote")}</span>
                      {isAr ? (
                        <ArrowRight className="w-3.5 h-3.5 rotate-180 shrink-0" />
                      ) : (
                        <ArrowRight className="w-3.5 h-3.5 shrink-0" />
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Sticky Footer Actions */}
              <div className="shrink-0 flex items-center gap-2 sm:gap-3 p-3.5 sm:px-6 sm:pb-5 border-t border-stone-200 bg-white shadow-xs">
                <button
                  type="button"
                  onClick={onClose}
                  className="py-2.5 sm:py-3 px-4 sm:px-5 bg-stone-100 hover:bg-stone-200 active:bg-stone-300 text-stone-700 text-xs sm:text-sm font-bold rounded-2xl transition cursor-pointer touch-manipulation"
                >
                  {t("common.cancel")}
                </button>

                <button
                  type="submit"
                  id="btn-submit-reservation"
                  disabled={isSubmitDisabled}
                  className={`flex-1 py-2.5 sm:py-3 px-4 sm:px-6 rounded-2xl text-xs sm:text-sm font-bold text-white transition flex items-center justify-center gap-2 shadow-md cursor-pointer touch-manipulation ${
                    isSubmitDisabled
                      ? "bg-stone-300 cursor-not-allowed text-stone-500 shadow-none"
                      : "bg-amber-800 hover:bg-amber-900 active:scale-[0.99]"
                  }`}
                >
                  {isSubmitting ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      <span>{t("reservationForm.processingSubmission")}</span>
                    </>
                  ) : isRecurring ? (
                    <>
                      <span>
                        {t("reservationForm.continueToSeriesBuilder")}
                      </span>
                      {isAr ? (
                        <ArrowRight className="w-4 h-4 rotate-180" />
                      ) : (
                        <ArrowRight className="w-4 h-4" />
                      )}
                    </>
                  ) : (
                    <>
                      <span>{t("reservationForm.confirmAndReserve")}</span>
                      {isAr ? (
                        <ArrowRight className="w-4 h-4 rotate-180" />
                      ) : (
                        <ArrowRight className="w-4 h-4" />
                      )}
                    </>
                  )}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>

      {showPolicyExplainer && (
        <PolicyExplainerModal
          isOpen={showPolicyExplainer}
          onClose={() => setShowPolicyExplainer(false)}
        />
      )}
    </>
  );
};
