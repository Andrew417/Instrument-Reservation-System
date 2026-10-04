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
} from "lucide-react";

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

export interface OccurrenceItem {
  id: string;
  date: string; // 'YYYY-MM-DD'
  startTime: string; // 'HH:mm'
  duration: number; // in hours
}

export interface SeriesBuilderModalProps {
  initialInstrument: Instrument;
  allInstruments: Instrument[];
  initialServiceName?: string;
  initialMusicianName?: string;
  initialNote?: string;
  initialDate: string; // 'YYYY-MM-DD'
  initialTimeHhmm: string; // 'HH:mm'
  initialDuration?: number; // hours
  initialReservationType?: "in_church" | "outside_church";
  onClose: () => void;
  onSuccess: (seriesData: any) => void;
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
}) => {
  const { profile, sessionToken } = useAuth();
  const { t, i18n } = useTranslation();
  const isAr = i18n.language === "ar";

  const DURATION_OPTIONS = [
    { label: t("reservationForm.duration30m"), value: 0.5 },
    { label: t("reservationForm.duration1h"), value: 1 },
    { label: t("reservationForm.duration1h30"), value: 1.5 },
    { label: t("reservationForm.duration2h"), value: 2 },
    { label: t("reservationForm.duration2h30"), value: 2.5 },
    { label: t("reservationForm.duration3h"), value: 3 },
    { label: t("reservationForm.duration4h"), value: 4 },
    { label: t("reservationForm.duration5h"), value: 5 },
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

  // Pattern Selection: 'weekly' | 'custom'
  const [patternType, setPatternType] = useState<"weekly" | "custom">("weekly");

  // Base Schedule
  const [baseDate, setBaseDate] = useState<string>(initialDate);
  const [baseStartTime, setBaseStartTime] = useState<string>(
    initialTimeHhmm || "10:00",
  );
  const [baseDuration, setBaseDuration] = useState<number>(initialDuration);

  // Weekly Pattern Settings
  const [weeklyInterval, setWeeklyInterval] = useState<number>(1); // Every 1 week, 2 weeks, etc.
  const [weeklyCount, setWeeklyCount] = useState<number>(4); // Default 4 occurrences

  // Custom Pattern Specific Dates List
  const [customDates, setCustomDates] = useState<string[]>([initialDate]);
  const [newCustomDateInput, setNewCustomDateInput] = useState<string>("");
  const [skippedNotice, setSkippedNotice] = useState<number | null>(null);

  // Runtime Hard Limits
  const [maxSeriesLimit, setMaxSeriesLimit] = useState<number>(8);
  const [isLoadingLimits, setIsLoadingLimits] = useState<boolean>(true);

  // Existing Approved Reservations cache for conflict checking
  const [approvedReservations, setApprovedReservations] = useState<any[]>([]);
  const [isLoadingReservations, setIsLoadingReservations] =
    useState<boolean>(false);

  // Submission State & Result
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

  // 1. Fetch runtime hard limits from /api/reservations/limits
  useEffect(() => {
    let isMounted = true;
    async function fetchLimits() {
      try {
        const res = await fetch("/api/reservations/limits");
        const data = await res.json();
        if (isMounted && data.success && data.limits?.maxSeriesOccurrences) {
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

  // 2. Fetch approved/ongoing reservations for current instrument
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

  // 3. Helper to format end time string
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

  // 4. Compute the active list of occurrences
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
    } else {
      // Custom pattern
      return customDates.slice(0, maxSeriesLimit).map((d, index) => ({
        id: `custom-${index}-${d}`,
        date: d,
        startTime: baseStartTime,
        duration: baseDuration,
      }));
    }
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

    // Parse all occurrences to Cairo-time ranges
    const parsed = generatedOccurrences.map((occ, idx) => {
      const start = cairoDateTimeToDate(occ.date, occ.startTime);
      const end = new Date(
        start.getTime() + Math.round(occ.duration * 3600 * 1000),
      );
      return { ...occ, start, end, index: idx + 1 };
    });

    // Check A: Working Hours (09:00 - 22:00 Cairo time)
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

    // Check B: Self-Overlap within the in-progress series
    for (let i = 0; i < parsed.length; i++) {
      for (let j = i + 1; j < parsed.length; j++) {
        const a = parsed[i];
        const b = parsed[j];
        // startA < endB && startB < endA
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

    // Check C: Existing approved/ongoing reservations from database
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

  // Handle Custom Date Add
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

  // Enhancement A: One-click "Skip Conflicting Dates"
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
    // Switch to custom pattern with the remaining conflict-free dates preserved
    setPatternType("custom");
    setCustomDates(validDates);
    if (validDates[0]) {
      setBaseDate(validDates[0]);
    }
  };

  // Submit Recurring Series to Backend
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
      const isAdminRole =
        profile.role === "admin" || profile.role === "super_admin";
      const payload = {
        userId: isAdminRole ? null : profile.id,
        adminId: isAdminRole ? profile.id : null,
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

      const res = await fetch("/api/reservations/series", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${sessionToken}`,
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
        className="bg-stone-50 sm:rounded-3xl sm:border sm:border-stone-200 shadow-2xl w-full sm:max-w-2xl z-10 flex flex-col h-full sm:h-auto sm:max-h-[90vh] overflow-hidden animate-in fade-in zoom-in-95 duration-150 pt-[env(safe-area-inset-top)]"
      >
        {/* Header */}
        <div className="shrink-0 bg-stone-900 text-white px-4 sm:px-6 py-3 sm:py-5 flex items-center justify-between border-b border-stone-800">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-2xl bg-amber-800 text-amber-100 flex items-center justify-center font-bold shadow-xs shrink-0">
              <Repeat className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h2 className="text-sm sm:text-base font-bold text-white leading-tight truncate">
                {seriesResult
                  ? t("seriesBuilder.confirmationTitle")
                  : t("seriesBuilder.title")}
              </h2>
              <p className="text-[11px] sm:text-xs text-stone-400 truncate">
                {seriesResult
                  ? t("seriesBuilder.confirmationSubtitle")
                  : t("seriesBuilder.builderSubtitle")}
              </p>
            </div>
          </div>

          <button
            id="btn-close-series-modal"
            onClick={onClose}
            className="shrink-0 w-11 h-11 flex items-center justify-center rounded-full bg-stone-800 text-stone-300 hover:text-white hover:bg-stone-700 active:bg-stone-600 transition cursor-pointer touch-manipulation"
            aria-label={t("common.close")}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* ------------------------------------------------------------- */}
        {/* RESULT / CONFIRMATION VIEW (Per-occurrence breakdown) */}
        {/* ------------------------------------------------------------- */}
        {seriesResult ? (
          <>
            <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain p-4 sm:p-7 space-y-4 sm:space-y-5">
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
                    {/* Top Status Banner */}
                    <div
                      className={`p-3.5 sm:p-4 rounded-2xl border flex items-start gap-3 shadow-2xs ${
                        allApproved
                          ? "bg-emerald-50 border-emerald-200 text-emerald-950"
                          : "bg-amber-50 border-amber-200 text-amber-950"
                      }`}
                    >
                      <div
                        className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold shrink-0 mt-0.5 shadow-2xs ${
                          allApproved
                            ? "bg-emerald-600 text-white"
                            : "bg-amber-700 text-white"
                        }`}
                      >
                        {allApproved ? (
                          <CheckCircle2 className="w-5 h-5 stroke-[2.5]" />
                        ) : (
                          <Clock className="w-5 h-5 stroke-[2.5]" />
                        )}
                      </div>
                      <div className="min-w-0 flex-1 space-y-0.5">
                        <div className="font-bold text-xs sm:text-sm">
                          {allApproved
                            ? t("seriesBuilder.allApprovedTitle", {
                                defaultValue:
                                  "All occurrences automatically approved!",
                              })
                            : pendingCount === totalCount
                              ? t("seriesBuilder.allPendingTitle", {
                                  defaultValue:
                                    "Recurring schedule submitted for admin review",
                                })
                              : t("seriesBuilder.mixedApprovalTitle", {
                                  defaultValue: `${approvedCount} approved, ${pendingCount} pending admin review`,
                                })}
                        </div>
                        <p className="text-[11px] sm:text-xs text-stone-600 leading-relaxed">
                          {allApproved
                            ? t("seriesBuilder.allApprovedDesc", {
                                defaultValue:
                                  "All dates in this recurring series have been approved and booked on the calendar.",
                              })
                            : t("seriesBuilder.pendingReviewDesc", {
                                defaultValue:
                                  "Your series has been created. Dates requiring admin review will be evaluated by church leadership.",
                              })}
                        </p>
                      </div>
                    </div>

                    {/* Series Summary Card */}
                    <div className="bg-white border border-stone-200 rounded-2xl p-4 sm:p-5 shadow-2xs space-y-3.5">
                      {/* Instrument & Type Row */}
                      <div className="flex items-center justify-between gap-3 pb-3 border-b border-stone-100">
                        <div className="flex items-center gap-2.5 min-w-0 flex-1">
                          <div className="w-9 h-9 rounded-xl bg-amber-800 text-white flex items-center justify-center font-bold shrink-0 shadow-2xs">
                            <Music2 className="w-4 h-4" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="text-[10px] font-bold text-stone-400 uppercase tracking-wider">
                              {t("seriesBuilder.instrumentColonLabel")}
                            </div>
                            <div className="text-xs sm:text-sm font-bold text-stone-900 truncate">
                              {currentInstrument.name}
                            </div>
                          </div>
                        </div>

                        <span
                          className={`shrink-0 inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold ${
                            reservationType === "outside_church"
                              ? "bg-amber-100 text-amber-950 border border-amber-300"
                              : "bg-stone-100 text-stone-700 border border-stone-200"
                          }`}
                        >
                          {reservationType === "outside_church" ? (
                            <>
                              <DollarSign className="w-3 h-3 text-amber-800 shrink-0" />
                              <span>{t("admin.review.outsideBadge")}</span>
                            </>
                          ) : (
                            <>
                              <Church className="w-3 h-3 text-stone-500 shrink-0" />
                              <span>{t("admin.review.inChurchBadge")}</span>
                            </>
                          )}
                        </span>
                      </div>

                      {/* Key Info Grid */}
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <div className="bg-stone-50 rounded-xl p-2.5 border border-stone-100 min-w-0">
                          <div className="text-[10px] font-bold text-stone-400 uppercase tracking-wider">
                            {t("seriesBuilder.whatForLabel")}
                          </div>
                          <div className="font-bold text-stone-800 truncate mt-0.5">
                            {serviceName || "—"}
                          </div>
                        </div>

                        <div className="bg-stone-50 rounded-xl p-2.5 border border-stone-100 min-w-0">
                          <div className="text-[10px] font-bold text-stone-400 uppercase tracking-wider">
                            {t("seriesBuilder.musicianNameLabel")}
                          </div>
                          <div className="font-bold text-stone-800 truncate mt-0.5">
                            {musicianName || "—"}
                          </div>
                        </div>

                        <div className="bg-stone-50 rounded-xl p-2.5 border border-stone-100 min-w-0">
                          <div className="text-[10px] font-bold text-stone-400 uppercase tracking-wider">
                            {t("seriesBuilder.patternLabel")}
                          </div>
                          <div className="font-bold text-stone-800 capitalize truncate mt-0.5">
                            {seriesResult.series.patternType} · {totalCount}{" "}
                            {t("admin.review.datesCount", {
                              count: totalCount,
                              defaultValue: `${totalCount} dates`,
                            })}
                          </div>
                        </div>

                        {serviceLocation ? (
                          <div className="bg-stone-50 rounded-xl p-2.5 border border-stone-100 min-w-0">
                            <div className="text-[10px] font-bold text-stone-400 uppercase tracking-wider">
                              {t("reservationForm.serviceLocation")}
                            </div>
                            <div className="font-bold text-stone-800 truncate mt-0.5">
                              {serviceLocation}
                            </div>
                          </div>
                        ) : (
                          <div className="bg-stone-50 rounded-xl p-2.5 border border-stone-100 min-w-0">
                            <div className="text-[10px] font-bold text-stone-400 uppercase tracking-wider">
                              {t("seriesBuilder.seriesIdLabel")}
                            </div>
                            <div className="font-mono text-[11px] font-bold text-stone-600 truncate mt-0.5">
                              {seriesResult.series.id.substring(0, 13)}...
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Notes (if present) */}
                      {note.trim() && (
                        <div className="bg-stone-50 rounded-xl p-2.5 border border-stone-100 text-xs">
                          <span className="text-[10px] font-bold text-stone-400 uppercase tracking-wider block mb-0.5">
                            {t("seriesBuilder.noteLabel", {
                              defaultValue: "Notes",
                            })}
                          </span>
                          <p className="text-stone-700 leading-relaxed whitespace-pre-wrap break-words">
                            {note.trim()}
                          </p>
                        </div>
                      )}

                      {/* Outside church WhatsApp notification */}
                      {reservationType === "outside_church" && (
                        <div className="bg-amber-100/70 border border-amber-300 rounded-xl p-3 text-xs text-amber-950 font-medium flex items-start gap-2.5">
                          <div className="w-5 h-5 rounded-full bg-emerald-600 text-white flex items-center justify-center shrink-0 mt-0.5 text-[10px] font-bold">
                            WA
                          </div>
                          <p className="leading-relaxed">
                            {t("seriesBuilder.whatsappNotice")}
                          </p>
                        </div>
                      )}
                    </div>

                    {/* Per-Occurrence Status Breakdown */}
                    <div className="space-y-2.5">
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <div className="flex items-center gap-1.5 text-xs font-bold text-stone-900">
                          <CalendarDays className="w-4 h-4 text-amber-800 shrink-0" />
                          <span>
                            {t("seriesBuilder.perOccurrenceBreakdown")}
                          </span>
                          <button
                            type="button"
                            onClick={() => setShowPolicyExplainer(true)}
                            className="text-stone-400 hover:text-amber-800 transition cursor-pointer p-0.5"
                            title={t("seriesBuilder.learnMoreLimitsTooltip")}
                          >
                            <Info className="w-3.5 h-3.5" />
                          </button>
                        </div>

                        <div className="flex items-center gap-1.5 flex-wrap">
                          {approvedCount > 0 && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-900 border border-emerald-200">
                              <CheckCircle2 className="w-3 h-3 text-emerald-700 stroke-[2.5]" />
                              <span>
                                {approvedCount} {t("common.approved")}
                              </span>
                            </span>
                          )}
                          {pendingCount > 0 && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-900 border border-amber-200">
                              <Clock className="w-3 h-3 text-amber-700 stroke-[2.5]" />
                              <span>
                                {pendingCount}{" "}
                                {t("seriesBuilder.pendingReviewBadge")}
                              </span>
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Naturally scrollable cards - NO nested scroll trap */}
                      <div className="space-y-2.5">
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

                          const reasons = item.evaluation.reasons || [];

                          return (
                            <div
                              key={item.reservation?.id || idx}
                              className={`bg-white border rounded-2xl p-3 sm:p-4 shadow-2xs space-y-2.5 transition ${
                                isApproved
                                  ? "border-emerald-200/90"
                                  : "border-stone-200"
                              }`}
                            >
                              {/* Top Row: Occurrence #, Date & Time, Status Badge */}
                              <div className="flex items-start justify-between gap-2.5">
                                <div className="flex items-start gap-2.5 min-w-0">
                                  <span
                                    className={`shrink-0 w-7 h-7 rounded-xl flex items-center justify-center font-bold text-xs shadow-2xs ${
                                      isApproved
                                        ? "bg-emerald-100 text-emerald-800 border border-emerald-200"
                                        : "bg-amber-100 text-amber-800 border border-amber-200"
                                    }`}
                                  >
                                    #{idx + 1}
                                  </span>
                                  <div className="min-w-0">
                                    <div className="font-bold text-stone-900 text-xs sm:text-sm leading-snug">
                                      {fullDateDisplay}
                                    </div>
                                    <div className="text-[11px] text-stone-500 flex items-center gap-1 mt-0.5">
                                      <Clock className="w-3 h-3 text-stone-400 shrink-0" />
                                      <span>{timeStr}</span>
                                    </div>
                                  </div>
                                </div>

                                <span
                                  className={`shrink-0 inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] sm:text-[11px] font-extrabold uppercase tracking-wide whitespace-nowrap shadow-2xs ${
                                    isApproved
                                      ? "bg-emerald-100 text-emerald-900 border border-emerald-300"
                                      : "bg-amber-100 text-amber-900 border border-amber-300"
                                  }`}
                                >
                                  {isApproved ? (
                                    <>
                                      <CheckCircle2 className="w-3 h-3 text-emerald-700 stroke-[2.5]" />
                                      <span>{t("common.approved")}</span>
                                    </>
                                  ) : (
                                    <>
                                      <Clock className="w-3 h-3 text-amber-700 stroke-[2.5]" />
                                      <span>
                                        {t("seriesBuilder.pendingReviewBadge")}
                                      </span>
                                    </>
                                  )}
                                </span>
                              </div>

                              {/* Clean Bulleted Reasons Box (If Pending) */}
                              {!isApproved && reasons.length > 0 && (
                                <div className="pt-2 border-t border-amber-100/80 bg-amber-50/70 rounded-xl p-2.5 space-y-1 text-amber-950">
                                  <div className="flex items-center gap-1.5 font-bold text-[11px] text-amber-900">
                                    <AlertCircle className="w-3.5 h-3.5 text-amber-700 shrink-0" />
                                    <span>
                                      {t("seriesBuilder.reviewReasonsLabel")}
                                    </span>
                                  </div>
                                  <ul className="space-y-1 ps-4 text-[11px] text-amber-900/90 list-disc leading-snug">
                                    {reasons.map(
                                      (rStr: string, rIdx: number) => (
                                        <li key={rIdx}>{rStr}</li>
                                      ),
                                    )}
                                  </ul>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </>
                );
              })()}
            </div>

            {/* Confirmation Footer */}
            <div className="shrink-0 p-3.5 sm:px-8 pb-[calc(1rem+env(safe-area-inset-bottom,0px))] sm:pb-6 border-t border-stone-200 bg-white shadow-xs">
              <button
                id="btn-series-done"
                onClick={onClose}
                className="w-full py-3 bg-stone-900 hover:bg-stone-800 active:bg-stone-950 text-white text-xs sm:text-sm font-bold rounded-2xl transition cursor-pointer shadow-md touch-manipulation flex items-center justify-center gap-2 active:scale-[0.99]"
              >
                <Check className="w-4 h-4 text-emerald-400 stroke-[2.5]" />
                <span>{t("seriesBuilder.doneReturnToCalendar")}</span>
              </button>
            </div>
          </>
        ) : (
          /* ------------------------------------------------------------- */
          /* BUILDER CONFIGURATION FORM */
          /* ------------------------------------------------------------- */
          <form
            onSubmit={handleSubmitSeries}
            className="flex flex-col flex-1 min-h-0"
          >
            {/* Scrollable Form Body */}
            <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain p-4 sm:p-7 space-y-5 sm:space-y-6">
              {/* Top Error Notice */}
              {submitError && (
                <div
                  id="series-error-banner"
                  className="bg-red-50 border border-red-200 rounded-2xl p-4 text-red-900 flex items-start gap-3 animate-in fade-in"
                >
                  <AlertCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
                  <div className="space-y-1 text-xs">
                    <div className="font-bold text-red-950">
                      {t("seriesBuilder.submissionBlockedTitle")}
                    </div>
                    <div className="text-red-800 leading-relaxed">
                      {submitError}
                    </div>
                  </div>
                </div>
              )}

              {/* Instrument Header & Occurrence Counter Pill */}
              <div className="flex flex-wrap items-center justify-between gap-3 p-3.5 bg-stone-50 border border-stone-200 rounded-2xl">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-8 h-8 rounded-xl bg-amber-800 text-white flex items-center justify-center font-bold text-xs shrink-0">
                    <Music2 className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <span className="text-xs font-bold text-stone-900 block truncate">
                      {currentInstrument.name}
                    </span>
                    <span className="text-[11px] text-stone-500 block capitalize truncate">
                      {t("seriesBuilder.instrumentModeSuffix", {
                        type: currentInstrument.type,
                        mode: currentInstrument.bookingMode,
                      })}
                    </span>
                  </div>
                </div>

                {/* Dynamic Live Occurrence Counter */}
                <div className="flex items-center gap-2 shrink-0">
                  <div
                    className={`px-3 py-1.5 rounded-xl text-[11px] font-bold flex items-center gap-1.5 border ${
                      isAtMaxLimit
                        ? "bg-amber-100 text-amber-900 border-amber-300"
                        : "bg-white text-stone-700 border-stone-200 shadow-2xs"
                    }`}
                  >
                    <Layers className="w-3.5 h-3.5 text-stone-500 shrink-0" />
                    <span>
                      {t("seriesBuilder.occurrenceCounter", {
                        count: generatedOccurrences.length,
                        max: maxSeriesLimit,
                      })}
                    </span>
                  </div>
                </div>
              </div>

              {/* 1. Purpose / Service Name */}
              <div className="space-y-1.5">
                <label
                  htmlFor="series-service-name"
                  className="block text-xs font-bold text-stone-700"
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
                  className="w-full bg-stone-50 border border-stone-300 rounded-2xl px-3.5 py-2.5 text-sm font-medium text-stone-900 placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-amber-800/40 focus:border-amber-800 transition"
                  required
                />
              </div>

              {/* Service Location Input */}
              <div className="space-y-1.5">
                <label
                  htmlFor="series-service-location"
                  className="block text-xs font-bold text-stone-700 flex items-center gap-1"
                >
                  <Church className="w-3.5 h-3.5 text-amber-800" />
                  <span>{t("reservationForm.serviceLocationLabel")}</span>
                </label>
                <input
                  id="series-service-location"
                  type="text"
                  value={serviceLocation}
                  onChange={(e) => setServiceLocation(e.target.value)}
                  placeholder={t("reservationForm.serviceLocationPlaceholder")}
                  className="w-full bg-stone-50 border border-stone-300 rounded-2xl px-3.5 py-2.5 text-sm font-medium text-stone-900 placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-amber-800/40 focus:border-amber-800 transition"
                />
              </div>

              <div className="space-y-1.5">
                <label
                  htmlFor="series-musician-name"
                  className="block text-xs font-bold text-stone-700"
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
                  className="w-full bg-stone-50 border border-stone-300 rounded-2xl px-3.5 py-2.5 text-sm font-medium text-stone-900 placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-amber-800/40 focus:border-amber-800 transition"
                  required
                />
              </div>

              {/* Optional Notes / Special Requests */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label
                    htmlFor="series-note"
                    className="block text-xs font-bold text-stone-700"
                  >
                    {t("seriesBuilder.noteLabel") || "Notes / Special Requests"}
                  </label>
                  <span className="text-[11px] text-stone-400 font-medium">
                    {t("common.optional") || "Optional"}
                  </span>
                </div>
                <textarea
                  id="series-note"
                  rows={2}
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder={t("seriesBuilder.notePlaceholder")}
                  className="w-full bg-stone-50 border border-stone-300 rounded-2xl px-3.5 py-2.5 text-sm font-medium text-stone-900 placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-amber-800/40 focus:border-amber-800 transition resize-none"
                />
              </div>

              {/* 2. Pattern Choice (Weekly vs Custom) */}
              <div className="space-y-2">
                <label className="block text-xs font-bold text-stone-700">
                  {t("seriesBuilder.recurrencePatternLabel")}
                </label>
                <div className="grid grid-cols-2 gap-2 sm:gap-3">
                  <button
                    type="button"
                    id="btn-pattern-weekly"
                    onClick={() => setPatternType("weekly")}
                    className={`p-3.5 rounded-2xl border text-left transition cursor-pointer flex flex-col justify-between active:scale-[0.98] touch-manipulation ${
                      patternType === "weekly"
                        ? "bg-amber-50/70 border-amber-800 ring-2 ring-amber-800/30"
                        : "bg-white hover:bg-stone-50 border-stone-200 text-stone-700"
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1 gap-2">
                      <span className="font-bold text-xs text-stone-900">
                        {t("seriesBuilder.weeklyCadenceTitle")}
                      </span>
                      <Repeat className="w-4 h-4 text-amber-800 shrink-0" />
                    </div>
                    <p className="text-[11px] text-stone-500 leading-tight text-start">
                      {t("seriesBuilder.weeklyCadenceDesc")}
                    </p>
                  </button>

                  <button
                    type="button"
                    id="btn-pattern-custom"
                    onClick={() => setPatternType("custom")}
                    className={`p-3.5 rounded-2xl border text-left transition cursor-pointer flex flex-col justify-between active:scale-[0.98] touch-manipulation ${
                      patternType === "custom"
                        ? "bg-amber-50/70 border-amber-800 ring-2 ring-amber-800/30"
                        : "bg-white hover:bg-stone-50 border-stone-200 text-stone-700"
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1 gap-2">
                      <span className="font-bold text-xs text-stone-900">
                        {t("seriesBuilder.customDatesTitle")}
                      </span>
                      <Calendar className="w-4 h-4 text-amber-800 shrink-0" />
                    </div>
                    <p className="text-[11px] text-stone-500 leading-tight text-start">
                      {t("seriesBuilder.customDatesDesc")}
                    </p>
                  </button>
                </div>
              </div>

              {/* 3. Base Time Slot Settings (Applies to all occurrences) */}
              <div className="p-4 bg-stone-50 border border-stone-200 rounded-2xl space-y-3">
                <div className="text-xs font-bold text-stone-900">
                  {t("seriesBuilder.baseTimeTitle")}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {/* Initial Anchor Date */}
                  <div>
                    <label className="block text-[11px] font-bold text-stone-600 mb-1">
                      {patternType === "weekly"
                        ? t("seriesBuilder.firstSessionDateLabel")
                        : t("seriesBuilder.referenceDateLabel")}
                    </label>
                    <input
                      type="date"
                      value={baseDate}
                      min={todayStr}
                      onChange={(e) => setBaseDate(e.target.value)}
                      className="w-full bg-white border border-stone-300 rounded-xl px-3 py-2.5 text-sm font-medium text-stone-900 focus:outline-none focus:ring-2 focus:ring-amber-800/30"
                    />
                  </div>

                  {/* Start Time */}
                  <div>
                    <label className="block text-[11px] font-bold text-stone-600 mb-1">
                      {t("reservationForm.startTimeLabel")}
                    </label>
                    <select
                      value={baseStartTime}
                      onChange={(e) => setBaseStartTime(e.target.value)}
                      className="w-full bg-white border border-stone-300 rounded-xl px-3 py-2.5 text-sm font-medium text-stone-900 focus:outline-none focus:ring-2 focus:ring-amber-800/30 cursor-pointer"
                    >
                      {TIME_SLOTS.map((slot) => (
                        <option key={slot} value={slot}>
                          {formatHhmmTo12Hour(slot)}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Duration */}
                  <div>
                    <label className="block text-[11px] font-bold text-stone-600 mb-1">
                      {t("seriesBuilder.durationUntilLabel", {
                        end: formatHhmmTo12Hour(
                          calculateEndTime(baseStartTime, baseDuration),
                        ),
                      })}
                    </label>
                    <select
                      value={baseDuration}
                      onChange={(e) => setBaseDuration(Number(e.target.value))}
                      className="w-full bg-white border border-stone-300 rounded-xl px-3 py-2.5 text-sm font-medium text-stone-900 focus:outline-none focus:ring-2 focus:ring-amber-800/30 cursor-pointer"
                    >
                      {DURATION_OPTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              {/* 4. Pattern-Specific Controls */}
              {patternType === "weekly" ? (
                <div className="p-4 bg-amber-50/50 border border-amber-200/80 rounded-2xl space-y-4">
                  <div className="text-xs font-bold text-amber-950">
                    {t("seriesBuilder.weeklyRepeatConfigTitle")}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[11px] font-bold text-stone-700 mb-1">
                        {t("seriesBuilder.repeatCadenceLabel")}
                      </label>
                      <select
                        value={weeklyInterval}
                        onChange={(e) =>
                          setWeeklyInterval(Number(e.target.value))
                        }
                        className="w-full bg-white border border-stone-300 rounded-xl px-3 py-2.5 text-sm font-medium text-stone-900 focus:outline-none focus:ring-2 focus:ring-amber-800/30"
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
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-stone-700 mb-1">
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
                          className="w-full bg-white border border-stone-300 rounded-xl px-3 py-2.5 text-sm font-medium text-stone-900 focus:outline-none focus:ring-2 focus:ring-amber-800/30"
                        />
                        <span className="text-xs text-stone-500 font-medium shrink-0">
                          {t("seriesBuilder.sessionsUnit")}
                        </span>
                      </div>
                    </div>
                  </div>

                  {weeklyCount >= maxSeriesLimit && (
                    <div className="text-[11px] text-amber-900 bg-amber-100/60 px-3 py-1.5 rounded-xl flex items-center gap-1.5 font-medium">
                      <Info className="w-3.5 h-3.5 shrink-0" />
                      <span>
                        {t("seriesBuilder.reachedMax", { max: maxSeriesLimit })}
                      </span>
                    </div>
                  )}
                </div>
              ) : (
                /* Custom Specific Dates Builder */
                <div className="p-4 bg-stone-50 border border-stone-200 rounded-2xl space-y-4">
                  <div className="flex items-center justify-between gap-2">
                    <div className="text-xs font-bold text-stone-900">
                      {t("seriesBuilder.customDatesListTitle")}
                    </div>
                    <span className="text-[11px] text-stone-500">
                      {t("seriesBuilder.allowedDates", {
                        count: customDates.length,
                        max: maxSeriesLimit,
                      })}
                    </span>
                  </div>

                  {/* Add Custom Date Input */}
                  <div className="flex items-center gap-2">
                    <input
                      type="date"
                      value={newCustomDateInput}
                      min={todayStr}
                      disabled={isAtMaxLimit}
                      onChange={(e) => setNewCustomDateInput(e.target.value)}
                      className="flex-1 min-w-0 bg-white border border-stone-300 rounded-xl px-3 py-2.5 text-sm font-medium text-stone-900 focus:outline-none focus:ring-2 focus:ring-amber-800/30 disabled:bg-stone-100 disabled:text-stone-400"
                    />
                    <button
                      type="button"
                      disabled={isAtMaxLimit || !newCustomDateInput}
                      onClick={handleAddCustomDate}
                      className="shrink-0 px-4 py-2.5 bg-stone-900 hover:bg-stone-800 active:bg-stone-950 disabled:bg-stone-300 text-white text-sm font-bold rounded-xl transition flex items-center gap-1.5 cursor-pointer disabled:cursor-not-allowed touch-manipulation"
                    >
                      <Plus className="w-4 h-4" />
                      <span className="hidden sm:inline">
                        {t("seriesBuilder.addCustomDate")}
                      </span>
                    </button>
                  </div>

                  {isAtMaxLimit && (
                    <div className="text-[11px] text-amber-900 bg-amber-100/60 px-3 py-1.5 rounded-xl flex items-center gap-1.5 font-medium">
                      <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                      <span>
                        {t("seriesBuilder.reachedMax", { max: maxSeriesLimit })}
                      </span>
                    </div>
                  )}

                  {/* Custom Dates Chip List */}
                  <div className="flex flex-wrap gap-2 max-h-36 overflow-y-auto overscroll-contain pt-1">
                    {customDates.map((d, idx) => (
                      <div
                        key={d}
                        className="inline-flex items-center gap-1 pl-3 pr-1 py-1 bg-white border border-stone-300 rounded-xl text-xs font-medium text-stone-800 shadow-2xs"
                      >
                        <span>
                          #{idx + 1}: {d}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleRemoveCustomDate(d)}
                          className="w-7 h-7 flex items-center justify-center rounded-lg text-stone-400 hover:text-red-600 hover:bg-red-50 active:bg-red-100 transition cursor-pointer touch-manipulation"
                          title={t("seriesBuilder.removeDate")}
                          aria-label="Remove date"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* 5. In-Progress Occurrences Preview List */}
              <div className="space-y-2">
                <div className="text-xs font-bold text-stone-800 flex items-center justify-between gap-2">
                  <span>{t("seriesBuilder.calculatedScheduleTitle")}</span>
                  <span className="text-[11px] font-normal text-stone-500">
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
                  <div className="text-[11px] text-stone-500 flex items-center gap-1.5">
                    <Info className="w-3.5 h-3.5 shrink-0" />
                    <span>{t("seriesBuilder.autoCheckedNotice")}</span>
                  </div>
                )}

                <div className="border border-stone-200 rounded-2xl overflow-hidden divide-y divide-stone-100 max-h-40 overflow-y-auto overscroll-contain">
                  {generatedOccurrences.map((occ, idx) => (
                    <div
                      key={occ.id}
                      className="px-3.5 py-2.5 bg-white flex items-center justify-between text-xs gap-2"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <span className="w-5 h-5 rounded-lg bg-stone-100 text-stone-600 font-bold flex items-center justify-center text-[10px] shrink-0">
                          {idx + 1}
                        </span>
                        <span className="font-semibold text-stone-900 truncate">
                          {occ.date}
                        </span>
                      </div>
                      <span className="text-stone-500 text-[11px] whitespace-nowrap shrink-0">
                        {formatHhmmTo12Hour(occ.startTime)} –{" "}
                        {formatHhmmTo12Hour(
                          calculateEndTime(occ.startTime, occ.duration),
                        )}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* 6. Real-Time Conflict Warning Panel (Listing ALL conflicts) */}
              {hasConflicts && (
                <div
                  id="series-conflict-warning-panel"
                  className="bg-red-50 border border-red-200 rounded-2xl p-4 space-y-3 animate-in fade-in"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-red-950 font-bold text-xs">
                    <div className="flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
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
                      className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 bg-red-600 hover:bg-red-700 active:bg-red-800 text-white font-bold text-xs rounded-xl shadow-xs transition cursor-pointer self-start sm:self-auto touch-manipulation"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>{t("seriesBuilder.skipConflicts")}</span>
                    </button>
                  </div>
                  <div className="space-y-1.5 pt-1">
                    {conflicts.map((conf, i) => (
                      <div
                        key={i}
                        className="bg-white/80 border border-red-200 rounded-xl p-2 text-xs text-red-900 flex items-start gap-2"
                      >
                        <span className="w-1.5 h-1.5 rounded-full bg-red-600 mt-1.5 shrink-0" />
                        <span className="leading-snug">{conf.message}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Skipped Conflicts Notice */}
              {skippedNotice !== null && !hasConflicts && (
                <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-3 flex items-center justify-between gap-2 text-xs text-emerald-900 font-medium animate-in fade-in">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>
                      {t("seriesBuilder.skippedConflictsNotice", {
                        count: skippedNotice,
                      })}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSkippedNotice(null)}
                    className="text-stone-400 hover:text-stone-700 text-xs px-2 py-1 rounded-lg"
                  >
                    ✕
                  </button>
                </div>
              )}

              {/* 7. Reservation Usage Type & Fee Agreement */}
              <div className="space-y-2.5">
                <label className="block text-xs font-bold text-stone-700">
                  {t("reservationForm.usageTypeLabel")}
                </label>
                <div className="grid grid-cols-2 gap-2 sm:gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      setReservationType("in_church");
                      setFeeAcknowledged(false);
                    }}
                    className={`p-3 rounded-2xl border text-left transition cursor-pointer active:scale-[0.98] touch-manipulation ${
                      reservationType === "in_church"
                        ? "bg-amber-50/70 border-amber-800 ring-2 ring-amber-800/30"
                        : "bg-white hover:bg-stone-50 border-stone-200 text-stone-700"
                    }`}
                  >
                    <div className="flex items-center justify-between mb-0.5 gap-1">
                      <span className="font-bold text-xs text-stone-900">
                        {t("reservationForm.inChurchUseLabel")}
                      </span>
                      <span className="px-1.5 py-0.5 rounded-md text-[10px] font-bold bg-emerald-100 text-emerald-800 whitespace-nowrap">
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
                    className={`p-3 rounded-2xl border text-left transition cursor-pointer active:scale-[0.98] touch-manipulation ${
                      reservationType === "outside_church"
                        ? "bg-purple-50/70 border-purple-800 ring-2 ring-purple-800/30"
                        : "bg-white hover:bg-stone-50 border-stone-200 text-stone-700"
                    }`}
                  >
                    <div className="flex items-center justify-between mb-0.5 gap-1">
                      <span className="font-bold text-xs text-stone-900">
                        {t("reservationForm.outsideChurchLabel")}
                      </span>
                      <span className="px-1.5 py-0.5 rounded-md text-[10px] font-bold bg-purple-100 text-purple-800 whitespace-nowrap">
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
                  <label className="flex items-start gap-2.5 p-3 bg-purple-50 border border-purple-200 rounded-xl cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={feeAcknowledged}
                      onChange={(e) => setFeeAcknowledged(e.target.checked)}
                      className="mt-0.5 w-5 h-5 rounded-md border-purple-300 text-purple-700 focus:ring-purple-600 cursor-pointer shrink-0"
                    />
                    <span className="text-xs font-semibold text-purple-950">
                      {t("seriesBuilder.feeAckPerOccurrence", {
                        fee: feeNumber,
                      })}
                    </span>
                  </label>
                )}
              </div>
            </div>

            {/* Sticky Footer Actions */}
            <div className="shrink-0 flex items-center gap-2 sm:gap-3 p-3.5 sm:px-7 sm:pb-6 border-t border-stone-200 bg-white shadow-xs">
              <button
                type="button"
                onClick={onClose}
                className="py-2.5 sm:py-3 px-4 sm:px-5 bg-stone-100 hover:bg-stone-200 active:bg-stone-300 text-stone-700 text-xs sm:text-sm font-bold rounded-2xl transition cursor-pointer touch-manipulation"
              >
                {t("common.cancel")}
              </button>

              <button
                type="submit"
                id="btn-submit-series"
                disabled={
                  isSubmitting ||
                  !serviceName.trim() ||
                  hasConflicts ||
                  generatedOccurrences.length === 0 ||
                  (reservationType === "outside_church" && !feeAcknowledged)
                }
                className={`flex-1 py-2.5 sm:py-3 px-4 sm:px-6 rounded-2xl text-xs sm:text-sm font-bold text-white transition flex items-center justify-center gap-2 shadow-md cursor-pointer touch-manipulation ${
                  isSubmitting ||
                  !serviceName.trim() ||
                  hasConflicts ||
                  generatedOccurrences.length === 0 ||
                  (reservationType === "outside_church" && !feeAcknowledged)
                    ? "bg-stone-300 cursor-not-allowed text-stone-500 shadow-none"
                    : "bg-amber-800 hover:bg-amber-900 active:scale-[0.99]"
                }`}
              >
                {isSubmitting ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
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
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </div>
          </form>
        )}
      </div>

      {/* Policy Explainer modal (unchanged) */}
      {showPolicyExplainer && (
        <PolicyExplainerModal
          isOpen={showPolicyExplainer}
          onClose={() => setShowPolicyExplainer(false)}
        />
      )}
    </div>
  );
};
