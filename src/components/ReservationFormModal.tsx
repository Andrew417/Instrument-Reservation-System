import React, { useState, useEffect, useMemo, useRef } from "react";
import { useTranslation } from "react-i18next";
import i18n from "../lib/i18n";
import { Instrument } from "./AvailabilityCalendar.tsx";
import { useAuth } from "../contexts/AuthContext.tsx";
import { PolicyExplainerModal } from "./PolicyExplainerModal.tsx";
import { ReservationUsageTypeSelector } from "./ReservationUsageTypeSelector.tsx";
import { formatHhmmTo12Hour, getTodayDateString } from "../lib/date-utils";
import { buildOwnerPayload, OnBehalfOf } from "../lib/reservation-owner";
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
  ListFilter,
  Shield,
  HelpCircle,
  ChevronRight,
  ArrowRight,
  User,
  FileText,
  Church,
  Zap,
} from "lucide-react";

export interface SeriesPrefill {
  instrument: Instrument;
  serviceName: string;
  musicianName: string;
  date: string;
  startTime: string;
  duration: number;
  reservationType: "in_church" | "outside_church";
  note?: string;
  isTypeRequest?: boolean;
  requestedType?: string;
  flatFeeOutside?: string;
}

export interface ReservationFormProps {
  onBehalfOf?: OnBehalfOf;
  initialInstrument: Instrument;
  allInstruments: Instrument[];
  initialDate: string;
  initialTimeHhmm: string;
  initialDuration?: number;
  initialServiceName?: string;
  initialMusicianName?: string;
  initialIsTypeRequest?: boolean;
  initialRequestedType?: string;
  onClose: () => void;
  onSuccess: (reservationData: any) => void;
  onOpenSeriesBuilder?: (prefill: SeriesPrefill) => void;
}

import { START_TIME_SLOTS as TIME_SLOTS } from "../constants/reservationTimes";

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

interface TypeSettingResponse {
  type: string;
  can_be_requested?: boolean;
  canBeRequested?: boolean;
  flat_fee_outside?: string | null;
  flatFeeOutside?: string | null;
  active_instruments_count?: number;
}

const getValidFee = (value: unknown): number => {
  const fee = Number(value);
  return Number.isFinite(fee) && fee >= 0 ? fee : 0;
};

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
  initialServiceName = "",
  initialMusicianName = "",
  initialIsTypeRequest = false,
  initialRequestedType = "",
  onBehalfOf,
  onClose,
  onSuccess,
  onOpenSeriesBuilder,
}) => {
  const { profile, sessionToken } = useAuth();
  const { t, i18n } = useTranslation();
  const isAr = i18n.language === "ar";

  const isMusicianUser = Boolean(profile?.isMusician);
  const isAdmin = Boolean(
    profile?.role === "admin" ||
    profile?.role === "super_admin" ||
    profile?.isSuperAdmin,
  );
  // Admins and Musicians book instruments directly (admins see all instruments, including room stock); only regular users request by category
  const canRequestByType = !isMusicianUser && !isAdmin;

  // Form State
  const [isTypeRequest, setIsTypeRequest] = useState<boolean>(
    Boolean(initialIsTypeRequest && canRequestByType),
  );
  const [availableTypes, setAvailableTypes] = useState<
    Array<{
      type: string;
      can_be_requested: boolean;
      flat_fee_outside: string;
      active_instruments_count: number;
    }>
  >([]);
  const [selectedRequestedType, setSelectedRequestedType] = useState<string>(
    initialRequestedType || "",
  );
  const [isLoadingTypes, setIsLoadingTypes] = useState<boolean>(false);

  useEffect(() => {
    if (canRequestByType) {
      setIsLoadingTypes(true);
      fetch("/api/instruments/types")
        .then((res) => res.json())
        .then((data) => {
          if (data.success && Array.isArray(data.types)) {
            setAvailableTypes(
              (data.types as TypeSettingResponse[]).map((item) => ({
                type: item.type,
                can_be_requested:
                  item.can_be_requested ?? item.canBeRequested ?? false,
                flat_fee_outside:
                  item.flat_fee_outside ?? item.flatFeeOutside ?? "0.00",
                active_instruments_count: item.active_instruments_count ?? 0,
              })),
            );
            if (!selectedRequestedType && data.types.length > 0) {
              setSelectedRequestedType(data.types[0].type);
            }
          }
        })
        .catch(console.error)
        .finally(() => setIsLoadingTypes(false));
    }
  }, [canRequestByType]);

  const [selectedInstrumentId, setSelectedInstrumentId] = useState<string>(
    initialInstrument.id,
  );
  const [serviceName, setServiceName] = useState<string>(
    initialServiceName || "",
  );
  const [serviceLocation, setServiceLocation] = useState<string>("");
  const [musicianName, setMusicianName] = useState<string>("");
  const [note, setNote] = useState<string>("");
  const noteRef = useRef<HTMLTextAreaElement>(null);
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

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        if (showPolicyExplainer) {
          setShowPolicyExplainer(false);
        } else {
          onClose();
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [showPolicyExplainer, onClose]);

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

  const currentInstrument =
    allInstruments.find((i) => i.id === selectedInstrumentId) ||
    initialInstrument;

  const [startH, startM] = startTime.split(":").map(Number);
  const startTotalMinutes = startH * 60 + startM;
  const endTotalMinutes = startTotalMinutes + Math.round(duration * 60);
  const endH = Math.floor(endTotalMinutes / 60);
  const endM = endTotalMinutes % 60;
  const endTimeStr = `${String(endH).padStart(2, "0")}:${String(endM).padStart(2, "0")}`;

  const todayStr = getTodayDateString();

  const selectedTypeSetting = availableTypes.find(
    (t) => t.type.toLowerCase() === selectedRequestedType.toLowerCase(),
  );
  const selectedTypeFee = getValidFee(selectedTypeSetting?.flat_fee_outside);

  const feeNumber = isTypeRequest
    ? selectedTypeFee
    : getValidFee(currentInstrument.outsideFeePerDay);

  useEffect(() => {
    if (reservationType === "in_church") {
      setFeeAcknowledged(false);
    }
  }, [reservationType]);

  useEffect(() => {
    const textarea = noteRef.current;
    if (!textarea) return;

    textarea.style.height = "auto";
    textarea.style.height = `${textarea.scrollHeight}px`;
  }, [note]);

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
    if (isTypeRequest && (!selectedRequestedType || !selectedRequestedType.trim())) {
      setErrorMsg(
        t("reservationForm.msgSelectCategory", {
          defaultValue: "Please select an instrument category.",
        }),
      );
      return;
    }
    if (reservationType === "outside_church" && !feeAcknowledged) {
      setErrorMsg(t("reservationForm.msgAcknowledgeFee"));
      return;
    }

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
        isTypeRequest,
        requestedType: selectedRequestedType,
        flatFeeOutside: String(feeNumber),
      });
      return;
    }

    setIsSubmitting(true);
    setErrorMsg(null);

    try {
      const payload: any = {
        ...buildOwnerPayload(profile, onBehalfOf),
        isTypeRequest,
        requestedType: isTypeRequest ? selectedRequestedType : undefined,
        instrumentId: isTypeRequest ? null : currentInstrument.id,
        serviceName: serviceName.trim(),
        serviceLocation: serviceLocation.trim() || undefined,
        musicianName: musicianName.trim(),
        note: note.trim() || undefined,
        date,
        startTime,
        duration,
        reservationType,
        feeAcknowledged:
          reservationType === "outside_church" ? feeAcknowledged : false,
      };

      const res = await fetch("/api/reservations", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${sessionToken}`,
        },
        body: JSON.stringify(payload),
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
    (reservationType === "outside_church" && !feeAcknowledged) ||
    (isTypeRequest && (!selectedRequestedType || availableTypes.length === 0));

  return (
    <>
      <div
        id="reservation-form-modal-backdrop"
        className="fixed inset-0 z-[100] bg-stone-900/60 backdrop-blur-xs flex items-stretch sm:items-center justify-center p-0 sm:p-4"
      >
        <div
          id="reservation-form-modal"
          className="bg-stone-50 sm:rounded-3xl sm:border sm:border-stone-200 shadow-2xl w-full sm:max-w-xl z-10 flex flex-col h-full sm:h-auto sm:max-h-[90vh] overflow-hidden animate-in fade-in zoom-in-95 duration-150 pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]"
          dir={isAr ? "rtl" : "ltr"}
        >
          {/* ── Header ── */}
          <div className="shrink-0 bg-stone-900 text-white px-4 sm:px-5 py-3 sm:py-3.5 flex items-center justify-between border-b border-stone-800">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-9 h-9 rounded-2xl bg-amber-800 text-amber-100 flex items-center justify-center font-bold shadow-xs shrink-0">
                <Music2 className="w-4.5 h-4.5" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <h2 className="text-[13px] sm:text-sm font-bold text-white leading-tight truncate">
                    {submissionResult
                      ? t("reservationForm.confirmTitle")
                      : onBehalfOf
                        ? t("reservationForm.bookedOnBehalf", {
                            name: onBehalfOf.name,
                          })
                        : t("reservationForm.title")}
                  </h2>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-900/60 text-amber-200 border border-amber-700/50 hidden sm:inline-block">
                    {currentInstrument.name}
                  </span>
                </div>
                <p className="text-[10px] sm:text-[11px] text-stone-400 truncate mt-0.5">
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
                className="w-8 h-8 sm:w-9 sm:h-9 flex items-center justify-center rounded-xl bg-stone-800/90 text-amber-300 hover:text-white hover:bg-stone-700 transition cursor-pointer border border-stone-700/70"
                title={t("nav.howBookingWorks")}
              >
                <HelpCircle className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              </button>

              <button
                id="btn-close-reservation-modal"
                onClick={onClose}
                className="w-8 h-8 sm:w-9 sm:h-9 flex items-center justify-center rounded-xl bg-stone-800/90 text-stone-300 hover:text-white hover:bg-stone-700 active:bg-stone-600 transition cursor-pointer border border-stone-700/70"
                aria-label="Close modal"
              >
                <X className="w-4 h-4 sm:w-4.5 sm:h-4.5" />
              </button>
            </div>
          </div>

          {/* ── RECEIPT VIEW ── */}
          {submissionResult ? (
            <>
              <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain p-3.5 sm:p-5 space-y-3 sm:space-y-3.5 bg-white">
                {/* Status Hero Card */}
                {submissionResult.evaluation.status === "approved" ? (
                  <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-3.5 sm:p-4 text-emerald-900 flex items-start gap-3 shadow-2xs">
                    <div className="w-9 h-9 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-sm">
                      <CheckCircle2 className="w-5 h-5" />
                    </div>
                    <div className="space-y-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-sm sm:text-[15px] text-emerald-950">
                          {t("reservationForm.resultApprovedTitle")}
                        </span>
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-200 text-emerald-900 uppercase tracking-wide whitespace-nowrap">
                          {t("reservationForm.resultInstantBadge")}
                        </span>
                      </div>
                      <p className="text-[11px] sm:text-xs text-emerald-800 leading-relaxed">
                        {t("reservationForm.resultApprovedDesc")}
                      </p>
                      {submissionResult.evaluation.reasons.length > 0 && (
                        <div className="pt-1.5 text-[10px] sm:text-[11px] text-emerald-900 font-medium space-y-1">
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
                  <div className="bg-amber-50 border border-amber-200 rounded-2xl p-3.5 sm:p-4 text-amber-900 flex items-start gap-3 shadow-2xs">
                    <div className="w-9 h-9 rounded-xl bg-amber-600 text-white flex items-center justify-center shrink-0 shadow-sm">
                      <Clock className="w-4.5 h-4.5" />
                    </div>
                    <div className="space-y-1.5 min-w-0">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="font-bold text-[13px] sm:text-sm text-amber-950">
                          {t("reservationForm.resultPendingTitle")}
                        </span>
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-200 text-amber-900 uppercase tracking-wide whitespace-nowrap">
                          {t("reservationForm.resultPendingBadge")}
                        </span>
                      </div>
                      <p className="text-[11px] sm:text-xs text-amber-800 leading-relaxed">
                        {t("reservationForm.queuedForAdmin")}
                      </p>

                      {submissionResult.evaluation.reasons.length > 0 && (
                        <div className="pt-1.5 border-t border-amber-200/80 space-y-1">
                          <span className="text-[10px] sm:text-[11px] font-bold text-amber-950 block">
                            {t("reservationForm.whyPendingLabel")}
                          </span>
                          {submissionResult.evaluation.reasons.map((r, i) => (
                            <div
                              key={i}
                              className="text-[10px] sm:text-[11px] text-amber-900 flex items-start gap-1.5"
                            >
                              <span className="w-1.5 h-1.5 rounded-full bg-amber-600 mt-1.5 shrink-0" />
                              <span>{r}</span>
                            </div>
                          ))}
                        </div>
                      )}

                      <div className="pt-1.5 text-[10px] sm:text-[11px] text-amber-800/90 font-medium">
                        {t("reservationForm.msgWhatsAppNotice")}
                      </div>
                    </div>
                  </div>
                )}

                {/* Receipt Summary */}
                <div className="bg-stone-50 border border-stone-200 rounded-2xl p-3.5 sm:p-4 space-y-2.5 text-xs shadow-2xs">
                  <div className="font-bold text-stone-900 text-[13px] border-b border-stone-200 pb-1.5 flex items-center justify-between">
                    <span>{t("reservationForm.bookingDetailsTitle")}</span>
                    <span className="text-[10px] text-stone-500 font-mono">
                      #{submissionResult.reservation.id?.slice(0, 8)}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    {submissionResult.reservation.is_type_request ? (
                      <div className="min-w-0">
                        <span className="text-stone-500 font-medium block text-[11px]">
                          {t("reservationForm.requestedCategory", {
                            defaultValue: "Requested Category",
                          })}
                        </span>
                        <span className="font-bold text-stone-900 text-xs block truncate">
                          {submissionResult.reservation.requested_type ||
                            selectedRequestedType}
                        </span>
                        <span className="text-[10px] text-purple-700 font-semibold block truncate">
                          {submissionResult.reservation.instrument_id
                            ? t("reservationForm.assigned", {
                                defaultValue: "Assigned",
                              })
                            : t("reservations.awaitingAssignment", {
                                defaultValue: "Awaiting Admin Assignment",
                              })}
                        </span>
                      </div>
                    ) : (
                      <div className="min-w-0">
                        <span className="text-stone-500 font-medium block text-[11px]">
                          {t("reservationForm.instrumentColonLabel")}
                        </span>
                        <span className="font-bold text-stone-900 text-xs block truncate">
                          {currentInstrument.name}
                        </span>
                        <span className="text-[10px] text-stone-500 block truncate">
                          {currentInstrument.type}
                        </span>
                      </div>
                    )}
                    <div className="min-w-0">
                      <span className="text-stone-500 font-medium block text-[11px]">
                        {t("reservationForm.typeColonLabel")}
                      </span>
                      <span className="font-bold text-stone-900 text-xs capitalize">
                        {submissionResult.reservation.reservationType ===
                        "in_church"
                          ? t("reservationForm.inChurchFreeLabel")
                          : t("reservationForm.outsideChurchPaidLabel")}
                      </span>
                      {submissionResult.reservation.feeSnapshot && (
                        <span className="text-[10px] text-purple-700 font-semibold block">
                          {t("reservationForm.feePerDayLabel", {
                            fee: submissionResult.reservation.feeSnapshot,
                          })}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="pt-1.5 border-t border-stone-200">
                    <span className="text-stone-500 font-medium block text-[11px]">
                      {t("reservationForm.purposeColonLabel")}
                    </span>
                    <span className="font-bold text-stone-900 text-xs">
                      {submissionResult.reservation.serviceName ||
                        serviceName ||
                        t("reservationForm.notSpecifiedLabel")}
                    </span>
                  </div>
                  {(submissionResult.reservation.serviceLocation ||
                    serviceLocation) && (
                    <div className="pt-1.5 border-t border-stone-200">
                      <span className="text-stone-500 font-medium block flex items-center gap-1 text-[11px]">
                        <Church className="w-3 h-3 text-amber-800" />
                        <span>{t("reservationForm.serviceLocationLabel")}</span>
                      </span>
                      <span className="font-bold text-stone-900 text-xs">
                        {submissionResult.reservation.serviceLocation ||
                          serviceLocation}
                      </span>
                    </div>
                  )}
                  <div className="pt-1.5 border-t border-stone-200">
                    <span className="text-stone-500 font-medium block text-[11px]">
                      {t("reservationForm.musicianNameLabel")}
                    </span>
                    <span className="font-bold text-stone-900 text-xs">
                      {submissionResult.reservation.musicianName ||
                        musicianName}
                    </span>
                  </div>

                  {(submissionResult.reservation.note || note) && (
                    <div className="pt-1.5 border-t border-stone-200">
                      <span className="text-stone-500 font-medium block text-[11px]">
                        {t("reservationForm.leaveANoteLabel") || "Notes"}
                      </span>
                      <span className="font-medium text-stone-900 text-[11px] whitespace-pre-wrap">
                        {submissionResult.reservation.note || note}
                      </span>
                    </div>
                  )}

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1.5 border-t border-stone-200">
                    <div>
                      <span className="text-stone-500 font-medium block text-[11px]">
                        {t("reservationForm.dateTimeColonLabel")}
                      </span>
                      <span className="font-semibold text-stone-900 text-xs">
                        {date}
                      </span>
                      <span className="text-[10px] text-stone-600 block">
                        {formatHhmmTo12Hour(startTime)} –{" "}
                        {formatHhmmTo12Hour(endTimeStr)} ({duration}h)
                      </span>
                    </div>

                    <div>
                      <span className="text-stone-500 font-medium block text-[11px]">
                        {t("reservationForm.reservationIdColonLabel")}
                      </span>
                      <span className="font-mono text-stone-800 text-[10px] break-all">
                        {submissionResult.reservation.id}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="shrink-0 p-3 sm:px-5 sm:pb-4 border-t border-stone-200 bg-white shadow-xs">
                <button
                  type="button"
                  id="btn-done-back-calendar"
                  onClick={onClose}
                  className="w-full py-2 sm:py-2.5 px-4 sm:px-5 rounded-2xl text-xs sm:text-[13px] font-bold text-white transition flex items-center justify-center gap-2 shadow-md cursor-pointer touch-manipulation bg-stone-900 hover:bg-stone-800 active:bg-stone-950"
                >
                  {t("reservationForm.doneBackToCalendar")}
                </button>
              </div>
            </>
          ) : (
            /* ── FORM VIEW ── */
            <form
              onSubmit={handleSubmit}
              className="flex flex-col flex-1 min-h-0"
            >
              <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain p-3.5 sm:p-5 space-y-3 sm:space-y-3.5">
                {/* Errors are shown in the fixed alert overlay below. */}
                {/* Mode Selector for Regular Users */}
                {canRequestByType && (
                  <div className="flex p-1 bg-stone-200/70 rounded-2xl text-xs font-semibold gap-1">
                    <button
                      type="button"
                      onClick={() => setIsTypeRequest(false)}
                      className={`flex-1 py-1.5 px-3 rounded-xl transition flex items-center justify-center gap-1.5 cursor-pointer ${
                        !isTypeRequest
                          ? "bg-white text-stone-900 shadow-2xs font-bold"
                          : "text-stone-600 hover:text-stone-900"
                      }`}
                    >
                      <Music2 className="w-3.5 h-3.5 text-amber-800" />
                      <span>
                        {t("reservationForm.directBooking", {
                          defaultValue: "Specific Instrument",
                        })}
                      </span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setIsTypeRequest(true)}
                      className={`flex-1 py-1.5 px-3 rounded-xl transition flex items-center justify-center gap-1.5 cursor-pointer ${
                        isTypeRequest
                          ? "bg-white text-purple-950 shadow-2xs font-bold"
                          : "text-stone-600 hover:text-stone-900"
                      }`}
                    >
                      <ListFilter className="w-3.5 h-3.5 text-purple-600" />
                      <span>
                        {t("reservationForm.typeRequest", {
                          defaultValue: "Request by Category",
                        })}
                      </span>
                    </button>
                  </div>
                )}

                {/* Section 1: Instrument & Mode Hero Card */}
                <div className="bg-white rounded-2xl border border-stone-200 p-3 sm:p-3.5 shadow-2xs space-y-2.5">
                  {isTypeRequest && canRequestByType ? (
                    <>
                      <div className="flex items-center justify-between gap-2 border-b border-stone-100 pb-1.5">
                        <span className="text-[11px] sm:text-xs font-bold text-stone-800 flex items-center gap-1.5">
                          <Music2 className="w-3.5 h-3.5 text-purple-800" />
                          <span>
                            {t("reservationForm.typeRequestCategory", {
                              defaultValue: "Instrument Type Request",
                            })}
                          </span>
                        </span>
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] sm:text-[10px] font-extrabold uppercase tracking-wider bg-purple-100 text-purple-900 border border-purple-200">
                          <Shield className="w-2.5 h-2.5" />
                          <span>
                            {t("reservations.adminAssignment", {
                              defaultValue: "Admin Assignment",
                            })}
                          </span>
                        </span>
                      </div>

                      <div className="flex items-start gap-2.5">
                        <div className="w-12 h-12 rounded-2xl bg-purple-50 border border-purple-200 text-purple-800 flex items-center justify-center shrink-0 shadow-2xs">
                          <Music2 className="w-6 h-6" />
                        </div>

                        <div className="flex-1 min-w-0">
                          <label
                            htmlFor="select-request-type"
                            className="block text-[11px] font-bold text-stone-700 mb-1"
                          >
                            {t("reservationForm.chooseCategoryLabel", {
                              defaultValue: "Select Category / Type",
                            })}
                          </label>
                          {isLoadingTypes ? (
                            <div className="text-xs text-stone-500 py-2">
                              {t("common.loading", {
                                defaultValue: "Loading...",
                              })}
                            </div>
                          ) : availableTypes.length === 0 ? (
                            <div className="text-xs text-stone-500 bg-stone-50 p-2 rounded-xl border border-stone-200">
                              {t("reservationForm.noTypesAvailable", {
                                defaultValue:
                                  "No categories currently enabled for requests. Please book a specific instrument.",
                              })}
                            </div>
                          ) : (
                            <div className="relative">
                              <select
                                id="select-request-type"
                                value={selectedRequestedType}
                                onChange={(e) =>
                                  setSelectedRequestedType(e.target.value)
                                }
                                className="w-full appearance-none bg-stone-50 hover:bg-stone-100/80 border border-stone-200 rounded-xl px-2.5 py-1.5 text-xs sm:text-[13px] font-bold text-stone-900 focus:outline-none focus:ring-2 focus:ring-purple-800/40 focus:border-purple-800 transition cursor-pointer pr-8"
                              >
                                {availableTypes.map((item) => (
                                  <option key={item.type} value={item.type}>
                                    {item.type}
                                  </option>
                                ))}
                              </select>
                              <div
                                className={`pointer-events-none absolute inset-y-0 flex items-center px-2 text-stone-500 ${
                                  isAr ? "left-0" : "right-0"
                                }`}
                              >
                                <ChevronRight
                                  className={`w-3 h-3 ${isAr ? "-rotate-90" : "rotate-90"}`}
                                />
                              </div>
                            </div>
                          )}

                          <div className="mt-2 text-[10px] sm:text-[11px] text-stone-600 leading-relaxed">
                            {t("reservationForm.typeRequestNotice", {
                              defaultValue:
                                "Choose the kind of instrument you need. The church team will choose an available instrument from this category and assign it to you before your event.",
                            })}
                          </div>
                        </div>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="flex items-center justify-between gap-2 border-b border-stone-100 pb-1.5">
                        <span className="text-[11px] sm:text-xs font-bold text-stone-800 flex items-center gap-1.5">
                          <Music2 className="w-3.5 h-3.5 text-amber-800" />
                          <span>
                            {t("reservationForm.selectedInstrumentLabel")}
                          </span>
                        </span>
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] sm:text-[10px] font-extrabold uppercase tracking-wider ${
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

                      <div className="flex items-center gap-2.5">
                        <div className="w-12 h-12 rounded-2xl bg-amber-50 border border-amber-200 text-amber-800 flex items-center justify-center shrink-0 overflow-hidden shadow-2xs">
                          {currentInstrument.photoUrl ? (
                            <img
                              src={currentInstrument.photoUrl}
                              alt={currentInstrument.name}
                              referrerPolicy="no-referrer"
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <Music2 className="w-5 h-5 text-amber-800" />
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
                              className="w-full appearance-none bg-stone-50 hover:bg-stone-100/80 border border-stone-200 rounded-xl px-2.5 py-1.5 text-xs sm:text-[13px] font-bold text-stone-900 focus:outline-none focus:ring-2 focus:ring-amber-800/40 focus:border-amber-800 transition cursor-pointer pr-8"
                            >
                              {allInstruments.map((inst) => {
                                const vis =
                                  inst.visibilityLevel ||
                                  (inst as any).visibility_level;
                                const isOOS =
                                  inst.isOutOfService ||
                                  (inst as any).is_out_of_service;
                                const tag = isOOS
                                  ? " — [Out of Service]"
                                  : vis === "room_stock"
                                    ? " — [Room Stock]"
                                    : vis === "musician"
                                      ? " — [Musicians Only]"
                                      : "";
                                return (
                                  <option key={inst.id} value={inst.id}>
                                    {inst.name} ({inst.type})
                                    {tag}
                                  </option>
                                );
                              })}
                            </select>
                            <div
                              className={`pointer-events-none absolute inset-y-0 flex items-center px-2 text-stone-500 ${
                                isAr ? "left-0" : "right-0"
                              }`}
                            >
                              <ChevronRight
                                className={`w-3 h-3 ${isAr ? "-rotate-90" : "rotate-90"}`}
                              />
                            </div>
                          </div>

                          <div className="flex items-center gap-2 mt-1 text-[10px] sm:text-[11px] text-stone-500">
                            <span className="font-medium">
                              {currentInstrument.type}
                            </span>
                            {currentInstrument.outsideFeePerDay != null &&
                              Number(currentInstrument.outsideFeePerDay) >
                                0 && (
                                <>
                                  <span>•</span>
                                  <span className="font-semibold text-purple-700">
                                    {currentInstrument.outsideFeePerDay} ج.م/يوم
                                    (خارج الكنيسة)
                                  </span>
                                </>
                              )}
                          </div>
                          {currentInstrument.description?.trim() && (
                            <div
                              className="mt-1 flex items-start gap-1 text-[10px] leading-snug text-stone-500"
                              title={currentInstrument.description}
                            >
                              <FileText className="w-3 h-3 mt-0.5 shrink-0 text-stone-400" />
                              <p className="line-clamp-2">
                                {currentInstrument.description.trim()}
                              </p>
                            </div>
                          )}
                        </div>
                      </div>
                    </>
                  )}
                </div>

                {/* Section 2: Service & Musician */}
                <div className="bg-white rounded-2xl border border-stone-200 p-3 sm:p-3.5 shadow-2xs space-y-2.5">
                  <div className="text-[11px] sm:text-xs font-bold text-stone-800 flex items-center gap-1.5 border-b border-stone-100 pb-1.5">
                    <User className="w-3.5 h-3.5 text-amber-800" />
                    <span>بيانات الخدمة والعازف والمكان</span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    <div className="space-y-1">
                      <label
                        htmlFor="input-service-name"
                        className="block text-[11px] sm:text-xs font-bold text-stone-700"
                      >
                        {t("reservationForm.purposeQuestionLabel")}{" "}
                        <span className="text-amber-800 font-bold">*</span>
                      </label>
                      <input
                        id="input-service-name"
                        type="text"
                        value={serviceName}
                        onChange={(e) => setServiceName(e.target.value)}
                        placeholder={t(
                          "reservationForm.serviceNamePlaceholder",
                        )}
                        className="w-full bg-stone-50 border border-stone-300 rounded-xl px-2.5 py-1.5 text-xs sm:text-[13px] font-medium text-stone-900 placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-amber-800/40 focus:border-amber-800 transition"
                        required
                      />
                    </div>

                    <div className="space-y-1">
                      <label
                        htmlFor="input-musician-name"
                        className="block text-[11px] sm:text-xs font-bold text-stone-700"
                      >
                        {t("reservationForm.musicianNameLabel")}{" "}
                        <span className="text-amber-800 font-bold">*</span>
                      </label>
                      <input
                        id="input-musician-name"
                        type="text"
                        value={musicianName}
                        onChange={(e) => setMusicianName(e.target.value)}
                        placeholder={t(
                          "reservationForm.musicianNamePlaceholder",
                        )}
                        className="w-full bg-stone-50 border border-stone-300 rounded-xl px-2.5 py-1.5 text-xs sm:text-[13px] font-medium text-stone-900 placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-amber-800/40 focus:border-amber-800 transition"
                        required
                      />
                    </div>

                    <div className="space-y-1 sm:col-span-2">
                      <label
                        htmlFor="input-service-location"
                        className="block text-[11px] sm:text-xs font-bold text-stone-700 flex items-center gap-1"
                      >
                        <Church className="w-3 h-3 text-amber-800" />
                        <span>{t("reservationForm.serviceLocationLabel")}</span>
                      </label>
                      <input
                        id="input-service-location"
                        type="text"
                        value={serviceLocation}
                        onChange={(e) => setServiceLocation(e.target.value)}
                        placeholder={t(
                          "reservationForm.serviceLocationPlaceholder",
                        )}
                        className="w-full bg-stone-50 border border-stone-300 rounded-xl px-2.5 py-1.5 text-xs sm:text-[13px] font-medium text-stone-900 placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-amber-800/40 focus:border-amber-800 transition"
                      />
                    </div>
                  </div>

                  <div className="space-y-1 pt-1">
                    <div className="flex items-center justify-between">
                      <label
                        htmlFor="input-reservation-note"
                        className="block text-[11px] sm:text-xs font-bold text-stone-700"
                      >
                        {t("reservationForm.leaveANoteLabel", {
                          defaultValue: "Notes",
                        })}
                      </label>
                    </div>
                    <textarea
                      id="input-reservation-note"
                      ref={noteRef}
                      rows={1}
                      value={note}
                      onChange={(e) => {
                        e.currentTarget.style.height = "auto";
                        e.currentTarget.style.height = `${e.currentTarget.scrollHeight}px`;
                        setNote(e.target.value);
                      }}
                      placeholder={t("reservationForm.notePlaceholder", {
                        defaultValue:
                          "أي طلبات خاصة أو مستلزمات مثل محول أو كابل...",
                      })}
                      className="w-full min-h-9 overflow-hidden bg-stone-50 border border-stone-300 rounded-xl px-2.5 py-1.5 text-xs sm:text-[13px] font-medium text-stone-900 placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-amber-800/40 focus:border-amber-800 transition resize-none"
                    />
                  </div>
                </div>

                {/* Section 3: Date, Time & Duration */}
                <div className="bg-white rounded-2xl border border-stone-200 p-3 sm:p-3.5 shadow-2xs space-y-3">
                  <div className="flex items-center justify-between border-b border-stone-100 pb-1.5">
                    <span className="text-[11px] sm:text-xs font-bold text-stone-800 flex items-center gap-1.5">
                      <Calendar className="w-3.5 h-3.5 text-amber-800" />
                      <span>الموعد والتوقيت</span>
                    </span>
                    <span className="text-[10px] font-bold text-amber-900 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-lg whitespace-nowrap">
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

                  <div className="grid grid-cols-2 gap-2.5">
                    <div className="space-y-1">
                      <label className="block text-[11px] sm:text-xs font-bold text-stone-700">
                        {t("reservationForm.dateLabel")}
                      </label>
                      <input
                        id="input-reservation-date"
                        type="date"
                        value={date}
                        min={todayStr}
                        onChange={(e) => setDate(e.target.value)}
                        className="w-full bg-stone-50 border border-stone-300 rounded-xl px-2.5 py-1.5 text-xs sm:text-[13px] font-medium text-stone-900 focus:outline-none focus:ring-2 focus:ring-amber-800/40 focus:border-amber-800 transition"
                        required
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="block text-[11px] sm:text-xs font-bold text-stone-700">
                        {t("reservationForm.startTimeLabel")}
                      </label>
                      <div className="relative">
                        <select
                          id="select-start-time"
                          value={startTime}
                          onChange={(e) => setStartTime(e.target.value)}
                          className="w-full appearance-none bg-stone-50 border border-stone-300 rounded-xl px-2.5 py-1.5 text-xs sm:text-[13px] font-medium text-stone-900 focus:outline-none focus:ring-2 focus:ring-amber-800/40 focus:border-amber-800 transition pr-8 cursor-pointer"
                        >
                          {TIME_SLOTS.map((slot) => (
                            <option key={slot} value={slot}>
                              {formatHhmmTo12Hour(slot)}
                            </option>
                          ))}
                        </select>
                        <div
                          className={`pointer-events-none absolute inset-y-0 flex items-center px-2 text-stone-500 ${
                            isAr ? "left-0" : "right-0"
                          }`}
                        >
                          <ChevronRight
                            className={`w-3 h-3 ${isAr ? "-rotate-90" : "rotate-90"}`}
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-1.5 pt-1">
                    <label className="block text-[11px] sm:text-xs font-bold text-stone-700">
                      {t("reservationForm.durationLabel")}
                    </label>
                    <div className="grid grid-cols-4 gap-1.5">
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
                          className={`py-1.5 px-1.5 rounded-xl text-[10px] sm:text-[11px] font-bold text-center transition cursor-pointer border active:scale-[0.98] touch-manipulation ${
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

                {/* Section 4: Usage Type */}
                <ReservationUsageTypeSelector
                  reservationType={reservationType}
                  onReservationTypeChange={setReservationType}
                  feeAcknowledged={feeAcknowledged}
                  onFeeAcknowledgedChange={setFeeAcknowledged}
                  feePerDay={feeNumber}
                />

                {/* Section 5: Recurring toggle */}
                <div
                  className={`rounded-2xl p-2.5 sm:p-3 shadow-2xs transition border ${
                    isRecurring
                      ? "bg-brand-50 border-brand-500 ring-2 ring-brand-300"
                      : "bg-brand-50 border-brand-300"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-xl bg-brand-600 text-white flex items-center justify-center shrink-0 shadow-xs">
                        <Repeat className="w-3.5 h-3.5" />
                      </div>
                      <div>
                        <span className="text-[11px] sm:text-xs font-extrabold text-brand-950 block">
                          {t("reservationForm.recurringToggleLabel")}
                        </span>
                        <span className="text-[10px] sm:text-[11px] text-brand-800 block">
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
                      <div className="w-11 h-6 bg-brand-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-brand-400 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-brand-700" />
                    </label>
                  </div>

                  {isRecurring && (
                    <div className="mt-2 pt-1.5 border-t border-brand-200 text-[11px] text-brand-900 bg-brand-100 p-2 rounded-xl flex items-center justify-between gap-2">
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

              {/* ── Footer ── */}
              <div className="shrink-0 flex items-center gap-2 sm:gap-2.5 p-3 sm:px-5 sm:pb-4 border-t border-stone-200 bg-white shadow-xs">
                <button
                  type="button"
                  onClick={onClose}
                  className="py-2 sm:py-2.5 px-3.5 sm:px-4 bg-stone-100 hover:bg-stone-200 active:bg-stone-300 text-stone-700 text-[11px] sm:text-xs font-bold rounded-2xl transition cursor-pointer touch-manipulation"
                >
                  {t("common.cancel")}
                </button>

                <button
                  type="submit"
                  id="btn-submit-reservation"
                  disabled={isSubmitDisabled}
                  className={`flex-1 py-2 sm:py-2.5 px-4 sm:px-5 rounded-2xl text-[11px] sm:text-xs font-bold text-white transition flex items-center justify-center gap-2 shadow-md cursor-pointer touch-manipulation ${
                    isSubmitDisabled
                      ? "bg-stone-300 cursor-not-allowed text-stone-500 shadow-none"
                      : isRecurring
                        ? "bg-brand-700 hover:bg-brand-800 active:scale-[0.99] ring-2 ring-brand-300 ring-offset-2"
                        : "bg-amber-800 hover:bg-amber-900 active:scale-[0.99]"
                  }`}
                >
                  {isSubmitting ? (
                    <>
                      <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      <span>{t("reservationForm.processingSubmission")}</span>
                    </>
                  ) : isRecurring ? (
                    <>
                      <span>
                        {t("reservationForm.continueToSeriesBuilder")}
                      </span>
                      {isAr ? (
                        <ArrowRight className="w-3.5 h-3.5 rotate-180" />
                      ) : (
                        <ArrowRight className="w-3.5 h-3.5" />
                      )}
                    </>
                  ) : (
                    <>
                      <span>{t("reservationForm.confirmAndReserve")}</span>
                      {isAr ? (
                        <ArrowRight className="w-3.5 h-3.5 rotate-180" />
                      ) : (
                        <ArrowRight className="w-3.5 h-3.5" />
                      )}
                    </>
                  )}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>

      {errorMsg && (
        <div
          id="reservation-form-error-alert"
          role="alert"
          aria-live="assertive"
          dir={isAr ? "rtl" : "ltr"}
          className={`fixed inset-x-3 top-4 z-[220] sm:max-w-md animate-in fade-in slide-in-from-top-2 duration-200 ${
            isAr
              ? "sm:left-5 sm:right-auto"
              : "sm:right-5 sm:left-auto"
          }`}
        >
          <div className="bg-red-50 border-2 border-red-300 rounded-2xl p-4 text-red-950 flex items-start gap-3 shadow-2xl">
            <div className="w-9 h-9 rounded-xl bg-red-100 flex items-center justify-center shrink-0">
              <AlertCircle className="w-5 h-5 text-red-700" />
            </div>
            <div className="space-y-1 text-xs flex-1 min-w-0">
              <div className="font-bold text-sm">
                {getLimitMessage(errorMsg)?.title ||
                  t("reservationForm.submissionBlocked")}
              </div>
              <div className="text-red-800 leading-relaxed break-words">
                {getLimitMessage(errorMsg)?.description || errorMsg}
              </div>
              {getLimitMessage(errorMsg) && (
                <div className="text-red-700 leading-relaxed pt-1.5 border-t border-red-200/80">
                  <span className="font-semibold">
                    {t("policyExplainer.step2Title", "What to do:")}
                  </span>{" "}
                  {getLimitMessage(errorMsg)?.nextStep}
                </div>
              )}
            </div>
            <button
              type="button"
              onClick={() => setErrorMsg(null)}
              className="w-7 h-7 rounded-lg flex items-center justify-center text-red-700 hover:bg-red-100 transition shrink-0 cursor-pointer"
              aria-label={t("common.dismiss", "Dismiss")}
              title={t("common.dismiss", "Dismiss")}
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {showPolicyExplainer && (
        <PolicyExplainerModal
          isOpen={showPolicyExplainer}
          onClose={() => setShowPolicyExplainer(false)}
        />
      )}
    </>
  );
};
