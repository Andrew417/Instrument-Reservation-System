import React, { useState, useEffect, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Instrument } from "./AvailabilityCalendar.tsx";
import { PolicyExplainerModal } from "./PolicyExplainerModal.tsx";
import { useAuth } from "../contexts/AuthContext.tsx";
import {
  addDaysToDateString,
  cairoDateTimeToDate,
  getCairoDateString,
  getCairoParts,
  getCairoTimeString,
  getTodayDateString,
  formatHhmmTo12Hour,
} from "../lib/date-utils";
import { getAuthSessionToken } from "../lib/auth-helpers";

import {
  Calendar,
  CalendarDays,
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
  Plus,
  Trash2,
  ArrowRight,
  ChevronRight,
  Layers,
  Info,
  Church,
  Check,
  User,
  HelpCircle,
  Zap,
} from "lucide-react";

import { START_TIME_SLOTS as TIME_SLOTS } from "../constants/reservationTimes";

export interface OccurrenceItem {
  id: string;
  date: string;
  startTime: string;
  duration: number;
}

export interface SeriesBuilderModalProps {
  initialInstrument: Instrument;
  allInstruments: Instrument[];
  initialServiceName?: string;
  initialMusicianName?: string;
  initialNote?: string;
  initialDate: string;
  initialTimeHhmm: string;
  initialDuration?: number;
  initialReservationType?: "in_church" | "outside_church";
  onClose: () => void;
  onSuccess: (seriesData: any) => void;
  onBack?: () => void;
  targetUser?: { id: string; name: string } | null;
  isAdminBooking?: boolean;
}

interface ConflictDetail {
  type: "existing_reservation" | "self_overlap" | "working_hours";
  occurrenceIndex: number;
  occurrenceDate: string;
  occurrenceTime: string;
  message: string;
}

export const SeriesBuilderModal: React.FC<SeriesBuilderModalProps> = ({
  initialInstrument,
  allInstruments,
  initialServiceName = "",
  initialMusicianName = "",
  initialNote = "",
  initialDate,
  initialTimeHhmm,
  initialDuration = 2,
  initialReservationType = "in_church",
  onClose,
  onSuccess,
  onBack,
  targetUser = null,
  isAdminBooking = false,
}) => {
  const { profile, sessionToken } = useAuth();
  const { t, i18n } = useTranslation();
  const isAr = i18n.language === "ar";

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

  // Core Series State
  const [selectedInstrumentId, setSelectedInstrumentId] = useState<string>(
    initialInstrument.id,
  );
  const [serviceName, setServiceName] = useState<string>(initialServiceName);
  const [serviceLocation, setServiceLocation] = useState<string>("");
  const [musicianName, setMusicianName] = useState<string>(initialMusicianName);
  const [note, setNote] = useState<string>(initialNote);
  const [reservationType, setReservationType] = useState<
    "in_church" | "outside_church"
  >(initialReservationType);
  const [feeAcknowledged, setFeeAcknowledged] = useState<boolean>(false);
  const [showPolicyExplainer, setShowPolicyExplainer] =
    useState<boolean>(false);

  // Pattern: 'weekly' | 'custom'
  const [patternType, setPatternType] = useState<"weekly" | "custom">("weekly");

  // Base Schedule
  const [baseDate, setBaseDate] = useState<string>(initialDate);
  const [baseStartTime, setBaseStartTime] = useState<string>(
    initialTimeHhmm || "10:00",
  );
  const [baseDuration, setBaseDuration] = useState<number>(initialDuration);

  // Weekly Pattern Settings
  const [weeklyInterval, setWeeklyInterval] = useState<number>(1);
  const [weeklyCount, setWeeklyCount] = useState<number>(4);

  // Custom Pattern
  const [customDates, setCustomDates] = useState<string[]>([initialDate]);
  const [newCustomDateInput, setNewCustomDateInput] = useState<string>("");
  const [skippedNotice, setSkippedNotice] = useState<number | null>(null);

  const isAdminRole =
    isAdminBooking ||
    profile?.role === "admin" ||
    profile?.role === "super_admin";

  const [maxSeriesLimit, setMaxSeriesLimit] = useState<number>(8);
  const [isLoadingLimits, setIsLoadingLimits] = useState<boolean>(true);

  const [approvedReservations, setApprovedReservations] = useState<any[]>([]);
  const [isLoadingReservations, setIsLoadingReservations] =
    useState<boolean>(false);

  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [seriesResult, setSeriesResult] = useState<{
    series: any;
    occurrences: Array<{
      reservation: any;
      evaluation: {
        status: "approved" | "pending";
        reasons: string[];
        outsideFeeSnapshot: string | null;
        startTimeUtc: string;
        endTimeUtc: string;
      };
    }>;
  } | null>(null);

  const currentInstrument =
    allInstruments.find((i) => i.id === selectedInstrumentId) ||
    initialInstrument;
  const feeNumber = Number(currentInstrument.outsideFeePerDay || 0);

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

  useEffect(() => {
    let isMounted = true;
    async function fetchLimits() {
      try {
        const res = await fetch("/api/reservations/limits");
        const data = await res.json();
        if (data.success && data.limits?.maxSeriesOccurrences) {
          setMaxSeriesLimit(data.limits.maxSeriesOccurrences);
        }
      } catch (err) {
        console.error("Failed to load runtime limits, defaulting to 8:", err);
      } finally {
        if (isMounted) setIsLoadingLimits(false);
      }
    }
    fetchLimits();
    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    let isMounted = true;
    async function fetchInstrumentReservations() {
      setIsLoadingReservations(true);
      try {
        const res = await fetch(
          `/api/reservations?instrumentId=${currentInstrument.id}&status=approved`,
        );
        const data = await res.json();
        if (isMounted && data.success && Array.isArray(data.reservations)) {
          setApprovedReservations(data.reservations);
        }
      } catch (err) {
        console.error("Failed to fetch existing reservations:", err);
      } finally {
        if (isMounted) setIsLoadingReservations(false);
      }
    }
    fetchInstrumentReservations();
    return () => {
      isMounted = false;
    };
  }, [currentInstrument.id]);

  const calculateEndTime = (startHhmm: string, durationHours: number) => {
    try {
      const [h, m] = startHhmm.split(":").map(Number);
      const totalMinutes = h * 60 + m + Math.round(durationHours * 60);
      const endH = Math.floor(totalMinutes / 60);
      const endM = totalMinutes % 60;
      return `${String(endH).padStart(2, "0")}:${String(endM).padStart(2, "0")}`;
    } catch {
      return "--:--";
    }
  };

  const generatedOccurrences: OccurrenceItem[] = useMemo(() => {
    if (patternType === "weekly") {
      const list: OccurrenceItem[] = [];
      const count = Math.min(weeklyCount, maxSeriesLimit);
      for (let i = 0; i < count; i++) {
        const dateStr = addDaysToDateString(baseDate, i * 7 * weeklyInterval);
        list.push({
          id: `weekly-${i}-${dateStr}`,
          date: dateStr,
          startTime: baseStartTime,
          duration: baseDuration,
        });
      }
      return list;
    }
    return customDates.slice(0, maxSeriesLimit).map((d, index) => ({
      id: `custom-${index}-${d}`,
      date: d,
      startTime: baseStartTime,
      duration: baseDuration,
    }));
  }, [
    patternType,
    baseDate,
    baseStartTime,
    baseDuration,
    weeklyInterval,
    weeklyCount,
    customDates,
    maxSeriesLimit,
  ]);

  const conflicts: ConflictDetail[] = useMemo(() => {
    const list: ConflictDetail[] = [];
    const parsed = generatedOccurrences.map((occ, idx) => {
      const start = cairoDateTimeToDate(occ.date, occ.startTime);
      const end = new Date(
        start.getTime() + Math.round(occ.duration * 3600 * 1000),
      );
      return { ...occ, start, end, index: idx + 1 };
    });

    parsed.forEach((occ) => {
      const startParts = getCairoParts(occ.start);
      const endParts = getCairoParts(occ.end);
      const startHour = startParts.hour + startParts.minute / 60;
      const endHour = endParts.hour + endParts.minute / 60;
      if (startHour < 9 || endHour > 22 || startHour >= endHour) {
        list.push({
          type: "working_hours",
          occurrenceIndex: occ.index,
          occurrenceDate: occ.date,
          occurrenceTime: `${formatHhmmTo12Hour(occ.startTime)} - ${formatHhmmTo12Hour(calculateEndTime(occ.startTime, occ.duration))}`,
          message: t("seriesBuilder.occurrenceWorkingHoursMsg", {
            index: occ.index,
            date: occ.date,
            time: formatHhmmTo12Hour(occ.startTime),
          }),
        });
      }
    });

    for (let i = 0; i < parsed.length; i++) {
      for (let j = i + 1; j < parsed.length; j++) {
        const a = parsed[i];
        const b = parsed[j];
        if (a.start < b.end && b.start < a.end) {
          list.push({
            type: "self_overlap",
            occurrenceIndex: a.index,
            occurrenceDate: a.date,
            occurrenceTime: `${formatHhmmTo12Hour(a.startTime)} - ${formatHhmmTo12Hour(calculateEndTime(a.startTime, a.duration))}`,
            message: t("seriesBuilder.occurrenceSelfOverlapMsg", {
              indexA: a.index,
              dateA: a.date,
              timeA: formatHhmmTo12Hour(a.startTime),
              indexB: b.index,
              dateB: b.date,
              timeB: formatHhmmTo12Hour(b.startTime),
            }),
          });
        }
      }
    }

    parsed.forEach((occ) => {
      for (const res of approvedReservations) {
        const resStart = new Date(res.start_time || res.startTime);
        const resEnd = new Date(res.end_time || res.endTime);
        if (occ.start < resEnd && resStart < occ.end) {
          const resStartHhmm = res.start_hhmm || getCairoTimeString(resStart);
          const resEndHhmm = res.end_hhmm || getCairoTimeString(resEnd);
          list.push({
            type: "existing_reservation",
            occurrenceIndex: occ.index,
            occurrenceDate: occ.date,
            occurrenceTime: `${formatHhmmTo12Hour(occ.startTime)} - ${formatHhmmTo12Hour(calculateEndTime(occ.startTime, occ.duration))}`,
            message: t("seriesBuilder.occurrenceConflictMsg", {
              index: occ.index,
              date: occ.date,
              time: formatHhmmTo12Hour(occ.startTime),
              resStart: formatHhmmTo12Hour(resStartHhmm),
              resEnd: formatHhmmTo12Hour(resEndHhmm),
            }),
          });
        }
      }
    });

    return list;
  }, [generatedOccurrences, approvedReservations, t]);

  const handleAddCustomDate = () => {
    if (!newCustomDateInput) return;
    if (customDates.includes(newCustomDateInput)) {
      setSubmitError(t("seriesBuilder.dateAlreadyAdded"));
      return;
    }
    if (customDates.length >= maxSeriesLimit) {
      setSubmitError(t("seriesBuilder.reachedMax", { max: maxSeriesLimit }));
      return;
    }
    setSubmitError(null);
    setCustomDates([...customDates, newCustomDateInput].sort());
    setNewCustomDateInput("");
  };

  const handleRemoveCustomDate = (dateToRemove: string) => {
    if (customDates.length <= 1) {
      setSubmitError(t("seriesBuilder.mustHaveOneOccurrence"));
      return;
    }
    setSubmitError(null);
    setCustomDates(customDates.filter((d) => d !== dateToRemove));
  };

  const handleSkipConflicts = () => {
    if (conflicts.length === 0) return;
    const conflictingDates = new Set(conflicts.map((c) => c.occurrenceDate));
    const validDates = generatedOccurrences
      .map((o) => o.date)
      .filter((d) => !conflictingDates.has(d));

    if (validDates.length === 0) {
      setSubmitError(t("seriesBuilder.mustHaveOneOccurrence"));
      return;
    }

    setSubmitError(null);
    setSkippedNotice(conflictingDates.size);
    setPatternType("custom");
    setCustomDates(validDates);
    if (validDates[0]) setBaseDate(validDates[0]);
  };

  const handleSubmitSeries = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!profile) {
      setSubmitError(t("seriesBuilder.errSignIn"));
      return;
    }
    if (!serviceName.trim()) {
      setSubmitError(t("seriesBuilder.errSpecifyPurpose"));
      return;
    }
    if (!musicianName.trim()) {
      setSubmitError(t("seriesBuilder.musicianNameRequired"));
      return;
    }
    if (generatedOccurrences.length === 0) {
      setSubmitError(t("seriesBuilder.errNoOccurrences"));
      return;
    }
    if (generatedOccurrences.length > maxSeriesLimit) {
      setSubmitError(t("seriesBuilder.reachedMax", { max: maxSeriesLimit }));
      return;
    }
    if (conflicts.length > 0) {
      setSubmitError(t("seriesBuilder.errResolveConflicts"));
      return;
    }
    if (reservationType === "outside_church" && !feeAcknowledged) {
      setSubmitError(t("seriesBuilder.errAcknowledgeFee"));
      return;
    }

    setIsSubmitting(true);
    setSubmitError(null);

    try {
      const token = getAuthSessionToken(sessionToken);

      let endpoint = "/api/reservations/series";
      let payload: any;

      if (isAdminBooking && targetUser?.id) {
        endpoint = `/api/admin/users/${targetUser.id}/book-series-on-behalf`;
        payload = {
          instrumentId: currentInstrument.id,
          serviceName: serviceName.trim(),
          serviceLocation: serviceLocation.trim() || undefined,
          musicianName: musicianName.trim(),
          note: note.trim() || undefined,
          patternType,
          reservationType,
          feeAcknowledged: true,
          occurrences: generatedOccurrences.map((occ) => ({
            date: occ.date,
            startTime: occ.startTime,
            duration: occ.duration,
          })),
        };
      } else {
        payload = {
          userId: isAdminRole ? null : profile?.id,
          adminId: isAdminRole ? profile?.id : null,
          instrumentId: currentInstrument.id,
          serviceName: serviceName.trim(),
          serviceLocation: serviceLocation.trim() || undefined,
          musicianName: musicianName.trim(),
          note: note.trim() || undefined,
          patternType,
          reservationType,
          feeAcknowledged:
            reservationType === "outside_church" ? feeAcknowledged : false,
          occurrences: generatedOccurrences.map((occ) => ({
            date: occ.date,
            startTime: occ.startTime,
            duration: occ.duration,
          })),
        };
      }

      const res = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        setSubmitError(data.error || t("seriesBuilder.errCreateFailed"));
        setIsSubmitting(false);
        return;
      }

      setSeriesResult({
        series: data.series,
        occurrences: data.occurrences || [],
      });
      setIsSubmitting(false);
      onSuccess(data);
    } catch (err: any) {
      setSubmitError(err.message || t("seriesBuilder.errNetwork"));
      setIsSubmitting(false);
    }
  };

  const isAtMaxLimit = generatedOccurrences.length >= maxSeriesLimit;
  const hasConflicts = conflicts.length > 0;
  const todayStr = getTodayDateString();

  return (
    <div
      id="series-builder-modal-backdrop"
      className="fixed inset-0 z-[100] bg-stone-900/60 backdrop-blur-xs flex items-stretch sm:items-center justify-center p-0 sm:p-4"
    >
      <div
        id="series-builder-modal"
        className="bg-stone-50 sm:rounded-3xl sm:border sm:border-stone-200 shadow-2xl w-full sm:max-w-xl z-10 flex flex-col h-full sm:h-auto sm:max-h-[90vh] overflow-hidden animate-in fade-in zoom-in-95 duration-150 pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]"
        dir={isAr ? "rtl" : "ltr"}
      >
        {/* ── Header ── */}
        <div className="shrink-0 bg-stone-900 text-white px-4 sm:px-5 py-3 sm:py-3.5 flex items-center justify-between border-b border-stone-800">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-2xl bg-amber-800 text-amber-100 flex items-center justify-center font-bold shadow-xs shrink-0">
              <Repeat className="w-4.5 h-4.5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h2 className="text-[13px] sm:text-sm font-bold text-white leading-tight truncate">
                  {seriesResult
                    ? t("seriesBuilder.confirmationTitle")
                    : t("seriesBuilder.title")}
                </h2>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-900/60 text-amber-200 border border-amber-700/50 hidden sm:inline-block truncate max-w-[140px]">
                  {currentInstrument.name}
                </span>
              </div>
              <p className="text-[10px] sm:text-[11px] text-stone-400 truncate mt-0.5">
                {targetUser ? (
                  <span className="text-amber-300 font-bold">
                    {isAr
                      ? `حجز بالنيابة عن: ${targetUser.name}`
                      : `Booking on behalf of: ${targetUser.name}`}
                  </span>
                ) : seriesResult ? (
                  t("seriesBuilder.confirmationSubtitle")
                ) : (
                  t("seriesBuilder.builderSubtitle")
                )}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            {onBack && !seriesResult && (
              <button
                type="button"
                onClick={onBack}
                className="w-8 h-8 sm:w-9 sm:h-9 flex items-center justify-center rounded-xl bg-stone-800/90 text-stone-300 hover:text-white hover:bg-stone-700 transition cursor-pointer border border-stone-700/70"
                title={t("common.back", { defaultValue: "Back to Single Booking" })}
                aria-label={t("common.back", { defaultValue: "Back" })}
              >
                <ArrowRight
                  className={`w-4 h-4 ${isAr ? "" : "rotate-180"}`}
                />
              </button>
            )}

            <button
              type="button"
              onClick={() => setShowPolicyExplainer(true)}
              className="w-8 h-8 sm:w-9 sm:h-9 flex items-center justify-center rounded-xl bg-stone-800/90 text-amber-300 hover:text-white hover:bg-stone-700 transition cursor-pointer border border-stone-700/70"
              title={t("nav.howBookingWorks")}
            >
              <HelpCircle className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            </button>

            <button
              id="btn-close-series-modal"
              onClick={onClose}
              className="w-8 h-8 sm:w-9 sm:h-9 flex items-center justify-center rounded-xl bg-stone-800/90 text-stone-300 hover:text-white hover:bg-stone-700 active:bg-stone-600 transition cursor-pointer border border-stone-700/70"
              aria-label={t("common.close")}
            >
              <X className="w-4 h-4 sm:w-4.5 sm:h-4.5" />
            </button>
          </div>
        </div>

        {/* ── CONFIRMATION / RECEIPT ── */}
        {seriesResult ? (
          <>
            <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain p-3.5 sm:p-5 space-y-3 sm:space-y-3.5 bg-white">
              {(() => {
                const occurrences = seriesResult.occurrences || [];
                const approvedCount = occurrences.filter(
                  (o) => o.evaluation.status === "approved",
                ).length;
                const pendingCount = occurrences.filter(
                  (o) => o.evaluation.status === "pending",
                ).length;
                const totalCount = occurrences.length;
                const allApproved =
                  approvedCount === totalCount && totalCount > 0;

                return (
                  <>
                    {allApproved ? (
                      <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-3.5 sm:p-4 text-emerald-900 flex items-start gap-3 shadow-2xs">
                        <div className="w-9 h-9 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-sm">
                          <CheckCircle2 className="w-5 h-5" />
                        </div>
                        <div className="space-y-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-bold text-sm sm:text-[15px] text-emerald-950">
                              {t("seriesBuilder.allApprovedTitle", {
                                defaultValue: "All Occurrences Approved!",
                              })}
                            </span>
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-200 text-emerald-900 uppercase tracking-wide whitespace-nowrap">
                              {t("reservationForm.resultInstantBadge", {
                                defaultValue: "Instant Approval",
                              })}
                            </span>
                          </div>
                          <p className="text-[11px] sm:text-xs text-emerald-800 leading-relaxed">
                            {t("seriesBuilder.allApprovedDesc", {
                              defaultValue:
                                "All dates in this recurring series have been approved and booked on the calendar.",
                            })}
                          </p>
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
                              {pendingCount === totalCount
                                ? t("seriesBuilder.allPendingTitle", {
                                    defaultValue:
                                      "Recurring schedule submitted for admin review",
                                  })
                                : t("seriesBuilder.mixedApprovalTitle", {
                                    approved: approvedCount,
                                    pending: pendingCount,
                                    defaultValue: `${approvedCount} approved, ${pendingCount} pending admin review`,
                                  })}
                            </span>
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-200 text-amber-900 uppercase tracking-wide whitespace-nowrap">
                              {t("reservationForm.resultPendingBadge", {
                                defaultValue: "Pending Review",
                              })}
                            </span>
                          </div>
                          <p className="text-[11px] sm:text-xs text-amber-800 leading-relaxed">
                            {t("seriesBuilder.pendingReviewDesc", {
                              defaultValue:
                                "Your series has been created. Dates requiring admin review will be evaluated by church leadership.",
                            })}
                          </p>
                          {reservationType === "outside_church" && (
                            <div className="pt-2 text-[10px] sm:text-[11px] text-amber-800/90 font-medium">
                              {t("seriesBuilder.whatsappNotice", {
                                defaultValue:
                                  "If your reservation is approved, the admin will contact you on WhatsApp for confirmation and payment.",
                              })}
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Receipt Summary Grid */}
                    <div className="bg-stone-50 border border-stone-200 rounded-2xl p-3.5 sm:p-4 space-y-2.5 text-xs shadow-2xs">
                      <div className="font-bold text-stone-900 text-[13px] border-b border-stone-200 pb-1.5 flex items-center justify-between">
                        <span>
                          {t("reservationForm.bookingDetailsTitle", {
                            defaultValue: "Booking Details",
                          })}
                        </span>
                        <span className="text-[10px] text-stone-500 font-mono">
                          #{seriesResult.series.id?.slice(0, 8)}
                        </span>
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div className="min-w-0">
                          <span className="text-stone-500 font-medium block text-[11px]">
                            {t("reservationForm.instrumentColonLabel", {
                              defaultValue: "Instrument:",
                            })}
                          </span>
                          <span className="font-bold text-stone-900 text-xs block truncate">
                            {currentInstrument.name}
                          </span>
                          <span className="text-[10px] text-stone-500 block truncate">
                            {currentInstrument.type}
                          </span>
                        </div>
                        <div className="min-w-0">
                          <span className="text-stone-500 font-medium block text-[11px]">
                            {t("reservationForm.typeColonLabel", {
                              defaultValue: "Type:",
                            })}
                          </span>
                          <span className="font-bold text-stone-900 text-xs capitalize">
                            {reservationType === "in_church"
                              ? t("reservationForm.inChurchFreeLabel", {
                                  defaultValue: "In Church (Free)",
                                })
                              : t("reservationForm.outsideChurchPaidLabel", {
                                  defaultValue: "Outside Church (Paid)",
                                })}
                          </span>
                          {reservationType === "outside_church" &&
                            feeNumber > 0 && (
                              <span className="text-[10px] text-purple-700 font-semibold block">
                                {t("reservationForm.feePerDayLabel", {
                                  fee: feeNumber,
                                  defaultValue: `${feeNumber} EGP / day`,
                                })}
                              </span>
                            )}
                        </div>
                      </div>

                      <div className="pt-1.5 border-t border-stone-200">
                        <span className="text-stone-500 font-medium block text-[11px]">
                          {t("reservationForm.purposeColonLabel", {
                            defaultValue: "What this series is for:",
                          })}
                        </span>
                        <span className="font-bold text-stone-900 text-xs">
                          {serviceName ||
                            t("reservationForm.notSpecifiedLabel", {
                              defaultValue: "Not specified",
                            })}
                        </span>
                      </div>

                      {serviceLocation && (
                        <div className="pt-1.5 border-t border-stone-200">
                          <span className="text-stone-500 font-medium flex items-center gap-1 text-[11px]">
                            <Church className="w-3 h-3 text-amber-800 shrink-0" />
                            <span>
                              {t("reservationForm.serviceLocationLabel", {
                                defaultValue: "Service Location:",
                              })}
                            </span>
                          </span>
                          <span className="font-bold text-stone-900 text-xs">
                            {serviceLocation}
                          </span>
                        </div>
                      )}

                      <div className="pt-1.5 border-t border-stone-200">
                        <span className="text-stone-500 font-medium block text-[11px]">
                          {t("reservationForm.musicianNameLabel", {
                            defaultValue: "Musician Name:",
                          })}
                        </span>
                        <span className="font-bold text-stone-900 text-xs">
                          {musicianName}
                        </span>
                      </div>

                      <div className="pt-1.5 border-t border-stone-200">
                        <span className="text-stone-500 font-medium block text-[11px]">
                          {t("seriesBuilder.patternLabel", {
                            defaultValue: "Pattern:",
                          })}
                        </span>
                        <span className="font-bold text-stone-900 text-xs capitalize">
                          {seriesResult.series.patternType === "weekly"
                            ? t("seriesBuilder.weeklyCadenceTitle", {
                                defaultValue: "Weekly",
                              })
                            : seriesResult.series.patternType}{" "}
                          (
                          {t("admin.review.datesCount", {
                            count: totalCount,
                            defaultValue: `${totalCount} dates`,
                          })}
                          )
                        </span>
                      </div>

                      {note.trim() && (
                        <div className="pt-1.5 border-t border-stone-200">
                          <span className="text-stone-500 font-medium block text-[11px]">
                            {t("reservationForm.leaveANoteLabel", {
                              defaultValue: "Notes",
                            })}
                          </span>
                          <span className="font-medium text-stone-900 text-[11px] whitespace-pre-wrap">
                            {note.trim()}
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Per-Occurrence Breakdown */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <div className="flex items-center gap-1.5 text-[11px] font-bold text-stone-900">
                          <CalendarDays className="w-3.5 h-3.5 text-amber-800 shrink-0" />
                          <span>
                            {t("seriesBuilder.perOccurrenceBreakdown", {
                              defaultValue: "Per-Occurrence Status Breakdown:",
                            })}
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5 flex-wrap">
                          {approvedCount > 0 && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-900 border border-emerald-200">
                              <CheckCircle2 className="w-3 h-3 text-emerald-700 stroke-[2.5]" />
                              <span>
                                {approvedCount}{" "}
                                {t("common.approved", {
                                  defaultValue: "Approved",
                                })}
                              </span>
                            </span>
                          )}
                          {pendingCount > 0 && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-900 border border-amber-200">
                              <Clock className="w-3 h-3 text-amber-700 stroke-[2.5]" />
                              <span>
                                {pendingCount}{" "}
                                {t("seriesBuilder.pendingReviewBadge", {
                                  defaultValue: "Pending Review",
                                })}
                              </span>
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="space-y-1.5">
                        {occurrences.map((item, idx) => {
                          const isApproved =
                            item.evaluation.status === "approved";
                          const startUtc = new Date(
                            item.evaluation.startTimeUtc,
                          );
                          const endUtc = new Date(item.evaluation.endTimeUtc);

                          const weekdayStr = startUtc.toLocaleDateString(
                            isAr ? "ar-EG" : "en-US",
                            { weekday: "short", timeZone: "Africa/Cairo" },
                          );
                          const dateStr = startUtc.toLocaleDateString(
                            isAr ? "ar-EG" : "en-US",
                            {
                              year: "numeric",
                              month: "short",
                              day: "numeric",
                              timeZone: "Africa/Cairo",
                            },
                          );
                          const fullDateDisplay = `${weekdayStr}, ${dateStr}`;
                          const timeStr = `${formatHhmmTo12Hour(
                            getCairoTimeString(startUtc),
                          )} – ${formatHhmmTo12Hour(
                            getCairoTimeString(endUtc),
                          )}`;

                          return (
                            <div
                              key={item.reservation?.id || idx}
                              className={`border rounded-xl p-2.5 sm:px-3 sm:py-2.5 shadow-2xs flex items-center justify-between gap-2 transition ${
                                isApproved
                                  ? "bg-emerald-50/30 border-emerald-200/80"
                                  : "bg-stone-50 border-stone-200"
                              }`}
                            >
                              <div className="flex items-center gap-2 min-w-0 flex-1">
                                <span
                                  className={`shrink-0 w-6 h-6 rounded-md flex items-center justify-center font-bold text-[10px] shadow-2xs ${
                                    isApproved
                                      ? "bg-emerald-100 text-emerald-800 border border-emerald-200"
                                      : "bg-amber-100 text-amber-800 border border-amber-200"
                                  }`}
                                >
                                  #{idx + 1}
                                </span>
                                <div className="font-semibold text-stone-900 text-[11px] sm:text-xs leading-tight">
                                  <div className="flex flex-wrap items-center gap-x-1.5">
                                    <span>{fullDateDisplay}</span>
                                    <span className="text-stone-400 font-normal hidden xs:inline">
                                      -
                                    </span>
                                    <span className="text-stone-600 font-medium">
                                      {timeStr}
                                    </span>
                                  </div>
                                </div>
                              </div>
                              <span
                                className={`shrink-0 inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] sm:text-[10px] font-bold uppercase tracking-wide whitespace-nowrap shadow-2xs ${
                                  isApproved
                                    ? "bg-emerald-100 text-emerald-900 border border-emerald-300"
                                    : "bg-amber-100 text-amber-900 border border-amber-300"
                                }`}
                              >
                                {isApproved ? (
                                  <>
                                    <CheckCircle2 className="w-2.5 h-2.5 text-emerald-700 stroke-[2.5]" />
                                    <span>
                                      {t("common.approved", {
                                        defaultValue: "Approved",
                                      })}
                                    </span>
                                  </>
                                ) : (
                                  <>
                                    <Clock className="w-2.5 h-2.5 text-amber-700 stroke-[2.5]" />
                                    <span>
                                      {t("seriesBuilder.pendingReviewBadge", {
                                        defaultValue: "Pending Review",
                                      })}
                                    </span>
                                  </>
                                )}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </>
                );
              })()}
            </div>

            <div className="shrink-0 p-3 sm:px-5 sm:pb-4 border-t border-stone-200 bg-white shadow-xs">
              <button
                type="button"
                id="btn-series-done"
                onClick={onClose}
                className="w-full py-2 sm:py-2.5 px-4 sm:px-5 rounded-2xl text-xs sm:text-[13px] font-bold text-white transition flex items-center justify-center gap-2 shadow-md cursor-pointer touch-manipulation bg-stone-900 hover:bg-stone-800 active:bg-stone-950"
              >
                {t("seriesBuilder.doneReturnToCalendar", {
                  defaultValue: "Done (Return to Calendar)",
                })}
              </button>
            </div>
          </>
        ) : (
          /* ── BUILDER FORM ── */
          <form
            onSubmit={handleSubmitSeries}
            className="flex flex-col flex-1 min-h-0"
          >
            <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain p-3.5 sm:p-5 space-y-3 sm:space-y-3.5">
              {/* Error banner */}
              {submitError && (
                <div
                  id="series-error-banner"
                  className="bg-red-50 border border-red-200 rounded-2xl p-3 text-red-900 flex items-start gap-2.5 animate-in fade-in shadow-2xs"
                >
                  <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                  <div className="space-y-0.5 text-[11px] sm:text-xs flex-1">
                    <div className="font-bold text-red-950">
                      {t("seriesBuilder.submissionBlockedTitle")}
                    </div>
                    <div className="text-red-800 leading-relaxed">
                      {submitError}
                    </div>
                  </div>
                </div>
              )}

              {/* Section 1: Instrument & Mode Hero Card */}
              <div className="bg-white rounded-2xl border border-stone-200 p-3 sm:p-3.5 shadow-2xs space-y-2.5">
                <div className="flex items-center justify-between gap-2 border-b border-stone-100 pb-1.5">
                  <span className="text-[11px] sm:text-xs font-bold text-stone-800 flex items-center gap-1.5">
                    <Music2 className="w-3.5 h-3.5 text-amber-800" />
                    <span>
                      {t("reservationForm.selectedInstrumentLabel", {
                        defaultValue: "Selected Instrument",
                      })}
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
                        id="series-instrument"
                        value={selectedInstrumentId}
                        onChange={(e) =>
                          setSelectedInstrumentId(e.target.value)
                        }
                        className="w-full appearance-none bg-stone-50 hover:bg-stone-100/80 border border-stone-200 rounded-xl px-2.5 py-1.5 text-xs sm:text-[13px] font-bold text-stone-900 focus:outline-none focus:ring-2 focus:ring-amber-800/40 focus:border-amber-800 transition cursor-pointer pr-8"
                      >
                        {allInstruments.map((inst) => (
                          <option key={inst.id} value={inst.id}>
                            {inst.name} ({inst.type})
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

                    <div className="flex items-center gap-2 mt-1 text-[10px] sm:text-[11px] text-stone-500">
                      <span className="font-medium">
                        {currentInstrument.type}
                      </span>
                      {feeNumber > 0 && (
                        <>
                          <span>•</span>
                          <span className="font-semibold text-purple-700">
                            {t("reservationForm.feePerDayLabel", {
                              fee: feeNumber,
                              defaultValue: `${feeNumber} EGP / day`,
                            })}
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-1.5 border-t border-stone-100">
                  <span className="text-[10px] sm:text-[11px] font-medium text-stone-600 flex items-center gap-1.5">
                    <Layers className="w-3 h-3 text-stone-500 shrink-0" />
                    {t("seriesBuilder.occurrenceCounter", {
                      count: generatedOccurrences.length,
                      max: maxSeriesLimit,
                    })}
                  </span>
                  {isAtMaxLimit && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[9px] font-bold bg-amber-100 text-amber-900 border border-amber-200">
                      <Info className="w-2.5 h-2.5" />
                      <span>
                        {t("seriesBuilder.reachedMax", { max: maxSeriesLimit })}
                      </span>
                    </span>
                  )}
                </div>
              </div>

              {/* Section 2: Service & Musician */}
              <div className="bg-white rounded-2xl border border-stone-200 p-3 sm:p-3.5 shadow-2xs space-y-2.5">
                <div className="text-[11px] sm:text-xs font-bold text-stone-800 flex items-center gap-1.5 border-b border-stone-100 pb-1.5">
                  <User className="w-3.5 h-3.5 text-amber-800" />
                  <span>
                    {t("seriesBuilder.serviceSectionTitle", {
                      defaultValue: "Service & Musician",
                    })}
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <div className="space-y-1">
                    <label
                      htmlFor="series-service-name"
                      className="block text-[11px] sm:text-xs font-bold text-stone-700"
                    >
                      {t("seriesBuilder.serviceNameQuestion")}{" "}
                      <span className="text-amber-800 font-bold">*</span>
                    </label>
                    <input
                      id="series-service-name"
                      type="text"
                      value={serviceName}
                      onChange={(e) => setServiceName(e.target.value)}
                      placeholder={t("seriesBuilder.serviceNamePlaceholder")}
                      className="w-full bg-stone-50 border border-stone-300 rounded-xl px-2.5 py-1.5 text-xs sm:text-[13px] font-medium text-stone-900 placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-amber-800/40 focus:border-amber-800 transition"
                      required
                    />
                  </div>

                  <div className="space-y-1">
                    <label
                      htmlFor="series-musician-name"
                      className="block text-[11px] sm:text-xs font-bold text-stone-700"
                    >
                      {t("seriesBuilder.musicianNameLabel")}{" "}
                      <span className="text-amber-800 font-bold">*</span>
                    </label>
                    <input
                      id="series-musician-name"
                      type="text"
                      value={musicianName}
                      onChange={(e) => setMusicianName(e.target.value)}
                      placeholder={t("seriesBuilder.musicianNamePlaceholder")}
                      className="w-full bg-stone-50 border border-stone-300 rounded-xl px-2.5 py-1.5 text-xs sm:text-[13px] font-medium text-stone-900 placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-amber-800/40 focus:border-amber-800 transition"
                      required
                    />
                  </div>

                  <div className="space-y-1 sm:col-span-2">
                    <label
                      htmlFor="series-service-location"
                      className="block text-[11px] sm:text-xs font-bold text-stone-700 flex items-center gap-1"
                    >
                      <Church className="w-3 h-3 text-amber-800" />
                      <span>{t("reservationForm.serviceLocationLabel")}</span>
                    </label>
                    <input
                      id="series-service-location"
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
                      htmlFor="series-note"
                      className="block text-[11px] sm:text-xs font-bold text-stone-700"
                    >
                      {t("seriesBuilder.noteLabel") ||
                        "Notes / Special Requests"}
                    </label>
                    <span className="text-[10px] text-stone-400 font-medium">
                      ({t("common.optional") || "Optional"})
                    </span>
                  </div>
                  <textarea
                    id="series-note"
                    rows={2}
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    placeholder={t("seriesBuilder.notePlaceholder")}
                    className="w-full bg-stone-50 border border-stone-300 rounded-xl px-2.5 py-1.5 text-xs sm:text-[13px] font-medium text-stone-900 placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-amber-800/40 focus:border-amber-800 transition resize-none"
                  />
                </div>
              </div>

              {/* Section 3: Pattern choice */}
              <div className="bg-white rounded-2xl border border-stone-200 p-3 sm:p-3.5 shadow-2xs space-y-2.5">
                <div className="text-[11px] sm:text-xs font-bold text-stone-800 flex items-center gap-1.5 border-b border-stone-100 pb-1.5">
                  <Repeat className="w-3.5 h-3.5 text-amber-800" />
                  <span>{t("seriesBuilder.recurrencePatternLabel")}</span>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    id="btn-pattern-weekly"
                    onClick={() => setPatternType("weekly")}
                    className={`p-2.5 rounded-xl border text-left transition cursor-pointer flex flex-col justify-between active:scale-[0.98] touch-manipulation ${
                      patternType === "weekly"
                        ? "bg-amber-50/70 border-amber-800 ring-2 ring-amber-800/30"
                        : "bg-stone-50 hover:bg-stone-100 border-stone-200 text-stone-700"
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1 gap-2">
                      <span className="font-bold text-[11px] sm:text-xs text-stone-900">
                        {t("seriesBuilder.weeklyCadenceTitle")}
                      </span>
                      <Repeat className="w-3.5 h-3.5 text-amber-800 shrink-0" />
                    </div>
                    <p className="text-[10px] text-stone-500 leading-tight text-start">
                      {t("seriesBuilder.weeklyCadenceDesc")}
                    </p>
                  </button>

                  <button
                    type="button"
                    id="btn-pattern-custom"
                    onClick={() => setPatternType("custom")}
                    className={`p-2.5 rounded-xl border text-left transition cursor-pointer flex flex-col justify-between active:scale-[0.98] touch-manipulation ${
                      patternType === "custom"
                        ? "bg-amber-50/70 border-amber-800 ring-2 ring-amber-800/30"
                        : "bg-stone-50 hover:bg-stone-100 border-stone-200 text-stone-700"
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1 gap-2">
                      <span className="font-bold text-[11px] sm:text-xs text-stone-900">
                        {t("seriesBuilder.customDatesTitle")}
                      </span>
                      <Calendar className="w-3.5 h-3.5 text-amber-800 shrink-0" />
                    </div>
                    <p className="text-[10px] text-stone-500 leading-tight text-start">
                      {t("seriesBuilder.customDatesDesc")}
                    </p>
                  </button>
                </div>
              </div>

              {/* Section 4: Base Time Slot */}
              <div className="bg-white rounded-2xl border border-stone-200 p-3 sm:p-3.5 shadow-2xs space-y-3">
                <div className="flex items-center justify-between border-b border-stone-100 pb-1.5">
                  <span className="text-[11px] sm:text-xs font-bold text-stone-800 flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5 text-amber-800" />
                    <span>
                      {t("seriesBuilder.baseTimeTitle", {
                        defaultValue: "Date, Time & Duration",
                      })}
                    </span>
                  </span>
                  <span className="text-[10px] font-bold text-amber-900 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-lg whitespace-nowrap">
                    {isAr ? (
                      <>
                        {formatHhmmTo12Hour(baseStartTime)} ←{" "}
                        {formatHhmmTo12Hour(
                          calculateEndTime(baseStartTime, baseDuration),
                        )}{" "}
                        ({baseDuration}h)
                      </>
                    ) : (
                      <>
                        {formatHhmmTo12Hour(baseStartTime)} →{" "}
                        {formatHhmmTo12Hour(
                          calculateEndTime(baseStartTime, baseDuration),
                        )}{" "}
                        ({baseDuration}h)
                      </>
                    )}
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <div className="space-y-1">
                    <label className="block text-[11px] sm:text-xs font-bold text-stone-700">
                      {patternType === "weekly"
                        ? t("seriesBuilder.firstSessionDateLabel")
                        : t("seriesBuilder.referenceDateLabel")}
                    </label>
                    <input
                      type="date"
                      value={baseDate}
                      min={todayStr}
                      onChange={(e) => setBaseDate(e.target.value)}
                      className="w-full bg-stone-50 border border-stone-300 rounded-xl px-2.5 py-1.5 text-xs sm:text-[13px] font-medium text-stone-900 focus:outline-none focus:ring-2 focus:ring-amber-800/40 focus:border-amber-800 transition"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="block text-[11px] sm:text-xs font-bold text-stone-700">
                      {t("reservationForm.startTimeLabel")}
                    </label>
                    <div className="relative">
                      <select
                        value={baseStartTime}
                        onChange={(e) => setBaseStartTime(e.target.value)}
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

                <div className="space-y-1 pt-1">
                  <label className="block text-[11px] sm:text-xs font-bold text-stone-700">
                    {t("reservationForm.durationLabel", {
                      defaultValue: "Duration",
                    })}
                  </label>
                  <div className="grid grid-cols-4 gap-1.5">
                    {DURATION_OPTIONS.map((opt) => (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => setBaseDuration(opt.value)}
                        className={`py-1.5 px-1.5 rounded-xl text-[10px] sm:text-[11px] font-bold text-center transition cursor-pointer border active:scale-[0.98] touch-manipulation ${
                          baseDuration === opt.value
                            ? "bg-amber-800 text-white border-amber-900 shadow-xs ring-2 ring-amber-800/20"
                            : "bg-stone-50 hover:bg-stone-100 text-stone-700 border-stone-200"
                        }`}
                      >
                        {t(opt.labelKey)}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Section 5: Pattern-specific config */}
              {patternType === "weekly" ? (
                <div className="bg-white rounded-2xl border border-stone-200 p-3 sm:p-3.5 shadow-2xs space-y-2.5">
                  <div className="text-[11px] sm:text-xs font-bold text-stone-800 flex items-center gap-1.5 border-b border-stone-100 pb-1.5">
                    <Repeat className="w-3.5 h-3.5 text-amber-800" />
                    <span>{t("seriesBuilder.weeklyRepeatConfigTitle")}</span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    <div className="space-y-1">
                      <label className="block text-[11px] sm:text-xs font-bold text-stone-700">
                        {t("seriesBuilder.repeatCadenceLabel")}
                      </label>
                      <div className="relative">
                        <select
                          value={weeklyInterval}
                          onChange={(e) =>
                            setWeeklyInterval(Number(e.target.value))
                          }
                          className="w-full appearance-none bg-stone-50 border border-stone-300 rounded-xl px-2.5 py-1.5 text-xs sm:text-[13px] font-medium text-stone-900 focus:outline-none focus:ring-2 focus:ring-amber-800/40 focus:border-amber-800 transition pr-8 cursor-pointer"
                        >
                          <option value={1}>
                            {t("seriesBuilder.everyWeek")}
                          </option>
                          <option value={2}>
                            {t("seriesBuilder.everyTwoWeeks")}
                          </option>
                          <option value={3}>
                            {t("seriesBuilder.everyThreeWeeks")}
                          </option>
                          <option value={4}>
                            {t("seriesBuilder.everyFourWeeks")}
                          </option>
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

                    <div className="space-y-1">
                      <label className="block text-[11px] sm:text-xs font-bold text-stone-700">
                        {t("seriesBuilder.totalOccurrences", {
                          max: maxSeriesLimit,
                        })}
                      </label>
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          inputMode="numeric"
                          min={1}
                          max={maxSeriesLimit}
                          value={weeklyCount}
                          onChange={(e) => {
                            const val = Math.min(
                              Math.max(1, Number(e.target.value)),
                              maxSeriesLimit,
                            );
                            setWeeklyCount(val);
                          }}
                          className="flex-1 min-w-0 bg-stone-50 border border-stone-300 rounded-xl px-2.5 py-1.5 text-xs sm:text-[13px] font-medium text-stone-900 focus:outline-none focus:ring-2 focus:ring-amber-800/40 focus:border-amber-800 transition"
                        />
                        <span className="text-[11px] text-stone-500 font-medium shrink-0">
                          {t("seriesBuilder.sessionsUnit")}
                        </span>
                      </div>
                    </div>
                  </div>

                  {weeklyCount >= maxSeriesLimit && (
                    <div className="text-[10px] text-amber-900 bg-amber-50 px-2.5 py-1 rounded-xl flex items-center gap-1.5 font-medium border border-amber-200">
                      <Info className="w-3 h-3 shrink-0" />
                      <span>
                        {t("seriesBuilder.reachedMax", { max: maxSeriesLimit })}
                      </span>
                    </div>
                  )}
                </div>
              ) : (
                <div className="bg-white rounded-2xl border border-stone-200 p-3 sm:p-3.5 shadow-2xs space-y-2.5">
                  <div className="flex items-center justify-between border-b border-stone-100 pb-1.5">
                    <span className="text-[11px] sm:text-xs font-bold text-stone-800 flex items-center gap-1.5">
                      <Calendar className="w-3.5 h-3.5 text-amber-800" />
                      <span>{t("seriesBuilder.customDatesListTitle")}</span>
                    </span>
                    <span className="text-[10px] text-stone-500">
                      {t("seriesBuilder.allowedDates", {
                        count: customDates.length,
                        max: maxSeriesLimit,
                      })}
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <input
                      type="date"
                      value={newCustomDateInput}
                      min={todayStr}
                      disabled={isAtMaxLimit}
                      onChange={(e) => setNewCustomDateInput(e.target.value)}
                      className="flex-1 min-w-0 bg-stone-50 border border-stone-300 rounded-xl px-2.5 py-1.5 text-xs sm:text-[13px] font-medium text-stone-900 focus:outline-none focus:ring-2 focus:ring-amber-800/40 focus:border-amber-800 transition disabled:bg-stone-100 disabled:text-stone-400"
                    />
                    <button
                      type="button"
                      disabled={isAtMaxLimit || !newCustomDateInput}
                      onClick={handleAddCustomDate}
                      className="shrink-0 px-3 py-1.5 bg-stone-900 hover:bg-stone-800 active:bg-stone-950 disabled:bg-stone-300 text-white text-[11px] sm:text-xs font-bold rounded-xl transition flex items-center gap-1.5 cursor-pointer disabled:cursor-not-allowed touch-manipulation"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span className="hidden sm:inline">
                        {t("seriesBuilder.addCustomDate")}
                      </span>
                    </button>
                  </div>

                  {isAtMaxLimit && (
                    <div className="text-[10px] text-amber-900 bg-amber-50 px-2.5 py-1 rounded-xl flex items-center gap-1.5 font-medium border border-amber-200">
                      <AlertTriangle className="w-3 h-3 shrink-0" />
                      <span>
                        {t("seriesBuilder.reachedMax", { max: maxSeriesLimit })}
                      </span>
                    </div>
                  )}

                  <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto overscroll-contain pt-1">
                    {customDates.map((d, idx) => (
                      <div
                        key={d}
                        className="inline-flex items-center gap-1 pl-2.5 pr-1 py-0.5 bg-stone-50 border border-stone-300 rounded-lg text-[11px] font-medium text-stone-800 shadow-2xs"
                      >
                        <span>
                          #{idx + 1}: {d}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleRemoveCustomDate(d)}
                          className="w-6 h-6 flex items-center justify-center rounded-md text-stone-400 hover:text-red-600 hover:bg-red-50 active:bg-red-100 transition cursor-pointer touch-manipulation"
                          title={t("seriesBuilder.removeDate")}
                          aria-label="Remove date"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Section 6: Occurrence preview */}
              <div className="bg-white rounded-2xl border border-stone-200 p-3 sm:p-3.5 shadow-2xs space-y-2">
                <div className="flex items-center justify-between border-b border-stone-100 pb-1.5">
                  <span className="text-[11px] sm:text-xs font-bold text-stone-800 flex items-center gap-1.5">
                    <Layers className="w-3.5 h-3.5 text-amber-800" />
                    <span>{t("seriesBuilder.calculatedScheduleTitle")}</span>
                  </span>
                  <span className="text-[10px] font-normal text-stone-500">
                    {t("seriesBuilder.allSessionsLabel", {
                      start: formatHhmmTo12Hour(baseStartTime),
                      end: formatHhmmTo12Hour(
                        calculateEndTime(baseStartTime, baseDuration),
                      ),
                      duration: baseDuration,
                    })}
                  </span>
                </div>

                {!hasConflicts && (
                  <div className="text-[10px] sm:text-[11px] text-stone-500 flex items-center gap-1.5">
                    <Info className="w-3 h-3 shrink-0" />
                    <span>{t("seriesBuilder.autoCheckedNotice")}</span>
                  </div>
                )}

                <div className="border border-stone-200 rounded-xl overflow-hidden divide-y divide-stone-100 max-h-40 overflow-y-auto overscroll-contain bg-stone-50/60">
                  {generatedOccurrences.map((occ, idx) => (
                    <div
                      key={occ.id}
                      className="px-2.5 py-1.5 flex items-center justify-between text-[11px] sm:text-xs gap-2"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="w-5 h-5 rounded-md bg-white border border-stone-200 text-stone-600 font-bold flex items-center justify-center text-[9px] shrink-0">
                          {idx + 1}
                        </span>
                        <span className="font-semibold text-stone-900 truncate">
                          {occ.date}
                        </span>
                      </div>
                      <span className="text-stone-500 text-[10px] sm:text-[11px] whitespace-nowrap shrink-0">
                        {formatHhmmTo12Hour(occ.startTime)} –{" "}
                        {formatHhmmTo12Hour(
                          calculateEndTime(occ.startTime, occ.duration),
                        )}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Section 7: Conflicts */}
              {hasConflicts && (
                <div
                  id="series-conflict-warning-panel"
                  className="bg-red-50 border border-red-200 rounded-2xl p-3 space-y-2.5 animate-in fade-in shadow-2xs"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-red-950 font-bold text-[11px] sm:text-xs">
                    <div className="flex items-center gap-2">
                      <AlertTriangle className="w-3.5 h-3.5 text-red-600 shrink-0" />
                      <span>
                        {t("seriesBuilder.conflictsDetectedTitle", {
                          count: conflicts.length,
                        })}{" "}
                        {t("seriesBuilder.submissionDisabledSuffix")}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={handleSkipConflicts}
                      className="inline-flex items-center justify-center gap-1.5 px-2.5 py-1 bg-red-600 hover:bg-red-700 active:bg-red-800 text-white font-bold text-[11px] rounded-lg shadow-xs transition cursor-pointer self-start sm:self-auto touch-manipulation"
                    >
                      <Trash2 className="w-3 h-3" />
                      <span>{t("seriesBuilder.skipConflicts")}</span>
                    </button>
                  </div>
                  <div className="space-y-1 pt-1">
                    {conflicts.map((conf, i) => (
                      <div
                        key={i}
                        className="bg-white/80 border border-red-200 rounded-lg p-1.5 text-[11px] text-red-900 flex items-start gap-2"
                      >
                        <span className="w-1.5 h-1.5 rounded-full bg-red-600 mt-1.5 shrink-0" />
                        <span className="leading-snug">{conf.message}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {skippedNotice !== null && !hasConflicts && (
                <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-2.5 flex items-center justify-between gap-2 text-[11px] text-emerald-900 font-medium animate-in fade-in shadow-2xs">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                    <span>
                      {t("seriesBuilder.skippedConflictsNotice", {
                        count: skippedNotice,
                      })}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSkippedNotice(null)}
                    className="text-stone-400 hover:text-stone-700 text-xs px-1.5 py-0.5 rounded-md cursor-pointer"
                  >
                    ✕
                  </button>
                </div>
              )}

              {/* Section 8: Usage Type */}
              <div className="bg-white rounded-2xl border border-stone-200 p-3 sm:p-3.5 shadow-2xs space-y-2.5">
                <div className="text-[11px] sm:text-xs font-bold text-stone-800 flex items-center gap-1.5 border-b border-stone-100 pb-1.5">
                  <DollarSign className="w-3.5 h-3.5 text-amber-800" />
                  <span>{t("reservationForm.usageTypeLabel")}</span>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setReservationType("in_church");
                      setFeeAcknowledged(false);
                    }}
                    className={`p-2.5 rounded-xl border text-left transition cursor-pointer active:scale-[0.98] touch-manipulation ${
                      reservationType === "in_church"
                        ? "bg-amber-50/70 border-amber-800 ring-2 ring-amber-800/30"
                        : "bg-stone-50 hover:bg-stone-100 border-stone-200 text-stone-700"
                    }`}
                  >
                    <div className="flex items-center justify-between mb-0.5 gap-1">
                      <span className="font-bold text-[11px] sm:text-xs text-stone-900">
                        {t("reservationForm.inChurchUseLabel")}
                      </span>
                      <span className="px-1.5 py-0.5 rounded-md text-[9px] font-bold bg-emerald-100 text-emerald-800 whitespace-nowrap">
                        {t("reservationForm.freeBadge")}
                      </span>
                    </div>
                    <p className="text-[10px] text-stone-500 text-start">
                      {t("reservationForm.inChurchDesc")}
                    </p>
                  </button>

                  <button
                    type="button"
                    onClick={() => setReservationType("outside_church")}
                    className={`p-2.5 rounded-xl border text-left transition cursor-pointer active:scale-[0.98] touch-manipulation ${
                      reservationType === "outside_church"
                        ? "bg-purple-50/70 border-purple-800 ring-2 ring-purple-800/30"
                        : "bg-stone-50 hover:bg-stone-100 border-stone-200 text-stone-700"
                    }`}
                  >
                    <div className="flex items-center justify-between mb-0.5 gap-1">
                      <span className="font-bold text-[11px] sm:text-xs text-stone-900">
                        {t("reservationForm.outsideChurchLabel")}
                      </span>
                      <span className="px-1.5 py-0.5 rounded-md text-[9px] font-bold bg-purple-100 text-purple-800 whitespace-nowrap">
                        {t("reservationForm.egpPerDayBadge", {
                          fee: feeNumber,
                        })}
                      </span>
                    </div>
                    <p className="text-[10px] text-stone-500 text-start">
                      {t("reservationForm.outsideChurchDesc")}
                    </p>
                  </button>
                </div>

                {reservationType === "outside_church" && (
                  <label className="flex items-start gap-2 p-2.5 bg-purple-50 border border-purple-200 rounded-xl cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={feeAcknowledged}
                      onChange={(e) => setFeeAcknowledged(e.target.checked)}
                      className="mt-0.5 w-4 h-4 rounded-md border-purple-300 text-purple-700 focus:ring-purple-600 cursor-pointer shrink-0"
                    />
                    <span className="text-[11px] font-semibold text-purple-950">
                      {t("seriesBuilder.feeAckPerOccurrence", {
                        fee: feeNumber,
                      })}
                    </span>
                  </label>
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
                id="btn-submit-series"
                disabled={
                  isSubmitting ||
                  !serviceName.trim() ||
                  !musicianName.trim() ||
                  hasConflicts ||
                  generatedOccurrences.length === 0 ||
                  (reservationType === "outside_church" && !feeAcknowledged)
                }
                className={`flex-1 py-2 sm:py-2.5 px-4 sm:px-5 rounded-2xl text-[11px] sm:text-xs font-bold text-white transition flex items-center justify-center gap-2 shadow-md cursor-pointer touch-manipulation ${
                  isSubmitting ||
                  !serviceName.trim() ||
                  !musicianName.trim() ||
                  hasConflicts ||
                  generatedOccurrences.length === 0 ||
                  (reservationType === "outside_church" && !feeAcknowledged)
                    ? "bg-stone-300 cursor-not-allowed text-stone-500 shadow-none"
                    : "bg-amber-800 hover:bg-amber-900 active:scale-[0.99]"
                }`}
              >
                {isSubmitting ? (
                  <>
                    <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    <span>
                      {t("seriesBuilder.creatingSessions", {
                        count: generatedOccurrences.length,
                      })}
                    </span>
                  </>
                ) : (
                  <>
                    <span>
                      {t("seriesBuilder.submitSeriesButton", {
                        count: generatedOccurrences.length,
                      })}
                    </span>
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

      {showPolicyExplainer && (
        <PolicyExplainerModal
          isOpen={showPolicyExplainer}
          onClose={() => setShowPolicyExplainer(false)}
        />
      )}
    </div>
  );
};
