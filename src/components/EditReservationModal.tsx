import React, { useState, useEffect, useMemo, useRef } from "react";
import { useTranslation } from "react-i18next";
import { useAuth } from "../contexts/AuthContext.tsx";
import { Instrument } from "./AvailabilityCalendar.tsx";
import {
  getCairoDateString,
  getCairoTimeString,
  formatHhmmTo12Hour,
  formatDisplayDate,
  addDaysToDateString,
  shiftDateToWeekday,
  cairoDateTimeToDate,
} from "../lib/date-utils";
import {
  Music2,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  X,
  ArrowRight,
  DollarSign,
  Shield,
  Sparkles,
  ChevronRight,
  Church,
  Calendar,
  Repeat,
  Layers,
  CheckSquare,
} from "lucide-react";

export interface EditReservationModalProps {
  reservation: any;
  allInstruments: Instrument[];
  onClose: () => void;
  onSuccess: (updatedReservation: any) => void;
  initialScope?: "chooser" | "single" | "series";
  initialSelectedIds?: string[];
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

const WEEKDAYS = [
  { val: 0, labelEn: "Sun", labelAr: "الأحد" },
  { val: 1, labelEn: "Mon", labelAr: "الإثنين" },
  { val: 2, labelEn: "Tue", labelAr: "الثلاثاء" },
  { val: 3, labelEn: "Wed", labelAr: "الأربعاء" },
  { val: 4, labelEn: "Thu", labelAr: "الخميس" },
  { val: 5, labelEn: "Fri", labelAr: "الجمعة" },
  { val: 6, labelEn: "Sat", labelAr: "السبت" },
];

export const EditReservationModal: React.FC<EditReservationModalProps> = ({
  reservation,
  allInstruments,
  onClose,
  onSuccess,
  initialScope,
  initialSelectedIds,
}) => {
  const { profile, sessionToken } = useAuth();
  const { t, i18n } = useTranslation();
  const isAr = i18n.language === "ar";

  const isAdmin = Boolean(
    profile?.role === "admin" ||
    profile?.role === "super_admin" ||
    (profile as any)?.isSuperAdmin,
  );
  const isTrustedOrAdmin = Boolean(profile?.isTrusted || isAdmin);

  // 🚫 Completed reservations are locked from editing (user or admin).
  const isLocked = reservation?.status === "completed";

  const seriesId = reservation.series_id || reservation.seriesId || null;
  const [scope, setScope] = useState<"chooser" | "series">(
    initialScope === "chooser"
      ? "chooser"
      : initialScope === "single" || initialScope === "series"
        ? "series"
        : seriesId
          ? "chooser"
          : "series",
  );

  const startUtc = new Date(reservation.start_time || reservation.startTime);
  const endUtc = new Date(reservation.end_time || reservation.endTime);
  const initialDateStr =
    reservation.reservation_date ||
    (reservation.start_time
      ? String(reservation.start_time).substring(0, 10)
      : getCairoDateString(startUtc));
  const initialTimeStr = reservation.start_hhmm || getCairoTimeString(startUtc);
  const initialDurationHours = Math.max(
    0.5,
    (endUtc.getTime() - startUtc.getTime()) / (3600 * 1000),
  );

  const durationOptions = useMemo(() => {
    const isFullDayAlready =
      initialDurationHours >= 13 || reservation.is_full_day;
    if (isAdmin || isFullDayAlready) {
      return [
        ...DURATION_OPTIONS,
        { labelKey: "reservationForm.durationFullDay", value: 13 },
      ];
    }
    return DURATION_OPTIONS;
  }, [isAdmin, initialDurationHours, reservation.is_full_day]);

  // Form State
  const [selectedInstrumentId, setSelectedInstrumentId] = useState<string>(
    reservation.instrument_id ||
      reservation.instrumentId ||
      allInstruments[0]?.id ||
      "",
  );
  const [serviceName, setServiceName] = useState<string>(
    reservation.service_name || reservation.serviceName || "",
  );
  const [serviceLocation, setServiceLocation] = useState<string>(
    reservation.service_location || reservation.serviceLocation || "",
  );
  const [musicianName, setMusicianName] = useState<string>(
    reservation.musician_name || reservation.musicianName || "",
  );
  const [note, setNote] = useState<string>(reservation.note || "");
  const [date, setDate] = useState<string>(initialDateStr);
  const [startTime, setStartTime] = useState<string>(initialTimeStr);
  const [duration, setDuration] = useState<number>(initialDurationHours);
  const [reservationType, setReservationType] = useState<
    "in_church" | "outside_church"
  >(reservation.reservation_type || reservation.reservationType || "in_church");
  const [feeAcknowledged, setFeeAcknowledged] = useState<boolean>(true);

  // Bulk Series State
  const [activeReservation, setActiveReservation] = useState<any>(reservation);
  const [allSeriesOccurrences, setAllSeriesOccurrences] = useState<any[]>([]);
  const [upcomingOccurrences, setUpcomingOccurrences] = useState<any[]>([]);
  const [isLoadingOccurrences, setIsLoadingOccurrences] =
    useState<boolean>(false);
  const [selectedOccurrenceIds, setSelectedOccurrenceIds] = useState<string[]>(
    initialSelectedIds && initialSelectedIds.length > 0
      ? initialSelectedIds
      : reservation?.id
        ? [reservation.id]
        : [],
  );
  const [applySelectionMode, setApplySelectionMode] = useState<
    "all" | "selected"
  >(
    initialScope === "single" ||
      (initialSelectedIds && initialSelectedIds.length > 0)
      ? "selected"
      : "all",
  );
  const [isMultiSelectMode, setIsMultiSelectMode] = useState<boolean>(
    Boolean(initialSelectedIds && initialSelectedIds.length > 1),
  );
  const [shiftType, setShiftType] = useState<"none" | "days" | "weekday">(
    "weekday",
  );
  const [targetWeekday, setTargetWeekday] = useState<number>(
    new Date(startUtc).getUTCDay(),
  );

  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [conflictsList, setConflictsList] = useState<any[] | null>(null);

  // Escape key listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  // Auto-grow note textarea
  const noteRef = useRef<HTMLTextAreaElement>(null);
  const autoGrowNote = (el: HTMLTextAreaElement | null) => {
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  };

  useEffect(() => {
    autoGrowNote(noteRef.current);
  }, [note]);

  // Load series occurrences whenever seriesId is present
  useEffect(() => {
    if (seriesId) {
      setIsLoadingOccurrences(true);
      const token =
        sessionToken ||
        localStorage.getItem("auth_token") ||
        localStorage.getItem("admin_session_token");

      fetch(`/api/reservations?seriesId=${seriesId}`, {
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      })
        .then((res) => res.json())
        .then((data) => {
          if (data.success && Array.isArray(data.reservations)) {
            const sorted = [...data.reservations].sort(
              (a, b) =>
                new Date(a.start_time || a.startTime).getTime() -
                new Date(b.start_time || b.startTime).getTime(),
            );
            setAllSeriesOccurrences(sorted);
            const now = Date.now();
            const future = sorted.filter((r: any) => {
              const statusOk =
                r.status === "pending" || r.status === "approved";
              const startMs = new Date(r.start_time || r.startTime).getTime();
              return statusOk && startMs > now;
            });
            setUpcomingOccurrences(future);
            if (selectedOccurrenceIds.length === 0 && future.length > 0) {
              if (
                activeReservation?.id &&
                future.some((f: any) => f.id === activeReservation.id)
              ) {
                setSelectedOccurrenceIds([activeReservation.id]);
              } else {
                setSelectedOccurrenceIds(future.map((f: any) => f.id));
              }
            }
          }
        })
        .catch((err) => {
          console.error("Failed to load upcoming series occurrences:", err);
        })
        .finally(() => {
          setIsLoadingOccurrences(false);
        });
    }
  }, [seriesId, sessionToken]);

  const currentInstrument =
    allInstruments.find((i) => i.id === selectedInstrumentId) ||
    allInstruments[0];
  const feeNumber = Number(currentInstrument?.outsideFeePerDay || 0);

  const calculateEndTime = () => {
    try {
      const [h, m] = startTime.split(":").map(Number);
      const totalMinutes = h * 60 + m + Math.round(duration * 60);
      const endH = Math.floor(totalMinutes / 60);
      const endM = totalMinutes % 60;
      return `${String(endH).padStart(2, "0")}:${String(endM).padStart(2, "0")}`;
    } catch {
      return "--:--";
    }
  };
  const endTimeStr = calculateEndTime();

  // Multi-occurrence selection helpers
  const toggleOccurrenceSelection = (id: string) => {
    setSelectedOccurrenceIds((prev) => {
      const next = prev.includes(id)
        ? prev.filter((x) => x !== id)
        : [...prev, id];
      if (next.length === 1) {
        const chosen = allSeriesOccurrences.find((o) => o.id === next[0]);
        if (chosen) {
          setActiveReservation(chosen);
          const sUtc = new Date(chosen.start_time || chosen.startTime);
          const eUtc = new Date(chosen.end_time || chosen.endTime);
          const dStr =
            chosen.reservation_date ||
            (chosen.start_time
              ? String(chosen.start_time).substring(0, 10)
              : getCairoDateString(sUtc));
          const tStr = chosen.start_hhmm || getCairoTimeString(sUtc);
          const durH = Math.max(
            0.5,
            (eUtc.getTime() - sUtc.getTime()) / (3600 * 1000),
          );
          setDate(dStr);
          setStartTime(tStr);
          setDuration(durH);
        }
      }
      return next;
    });
  };

  const selectAllOccurrences = () => {
    setSelectedOccurrenceIds(
      (upcomingOccurrences.length > 0
        ? upcomingOccurrences
        : allSeriesOccurrences
      ).map((o) => o.id),
    );
  };

  const clearOccurrenceSelection = () => {
    setSelectedOccurrenceIds([]);
  };

  const targetOccurrences = useMemo(() => {
    if (scope !== "series" && !seriesId) return [];
    const baseList =
      upcomingOccurrences.length > 0
        ? upcomingOccurrences
        : allSeriesOccurrences;
    if (applySelectionMode === "selected") {
      if (selectedOccurrenceIds.length > 0) {
        const set = new Set(selectedOccurrenceIds);
        return baseList.filter((o) => set.has(o.id));
      }
      return [];
    }
    return baseList;
  }, [
    scope,
    seriesId,
    applySelectionMode,
    selectedOccurrenceIds,
    upcomingOccurrences,
    allSeriesOccurrences,
  ]);

  // Series Date Shift Previews
  const previewOccurrences = useMemo(() => {
    if (scope !== "series" || targetOccurrences.length === 0) return [];
    const now = new Date();
    const graceThreshold = new Date(now.getTime() - 2 * 60 * 1000);

    return targetOccurrences.map((occ: any, idx: number) => {
      const oldDate =
        occ.reservation_date ||
        (occ.start_time
          ? String(occ.start_time).substring(0, 10)
          : getCairoDateString(new Date(occ.start_time)));
      let newDate = oldDate;

      if (shiftType === "days") {
        newDate = addDaysToDateString(oldDate, 0);
      } else if (shiftType === "weekday") {
        newDate = shiftDateToWeekday(oldDate, targetWeekday);
      }

      let isPast = false;
      try {
        const startInstant = cairoDateTimeToDate(newDate, startTime);
        isPast = startInstant < graceThreshold;
      } catch {
        isPast = false;
      }

      return {
        id: occ.id,
        index: idx + 1,
        oldDate,
        newDate,
        isPast,
      };
    });
  }, [scope, targetOccurrences, shiftType, targetWeekday, startTime]);

  const hasPastShiftError = previewOccurrences.some((p) => p.isPast);

  const willResetToPendingSingle =
    reservation.status === "approved" &&
    currentInstrument?.bookingMode === "manual" &&
    !isTrustedOrAdmin;

  const willResetToPendingCountSeries = useMemo(() => {
    if (isTrustedOrAdmin || scope !== "series") return 0;
    const isManual = currentInstrument?.bookingMode === "manual";
    const isOutside = reservationType === "outside_church";
    if (isManual || isOutside) {
      return targetOccurrences.filter((o) => o.status === "approved").length;
    }
    return 0;
  }, [
    isTrustedOrAdmin,
    scope,
    currentInstrument,
    reservationType,
    targetOccurrences,
  ]);

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isLocked) {
      setErrorMsg(
        t("editReservation.errCompletedLocked", {
          defaultValue: "Completed reservations cannot be edited.",
        }),
      );
      return;
    }
    if (!profile) {
      setErrorMsg(t("editReservation.errSignIn"));
      return;
    }
    if (!serviceName.trim()) {
      setErrorMsg(t("editReservation.errSpecifyPurpose"));
      return;
    }
    if (!musicianName.trim()) {
      setErrorMsg(t("editReservation.musicianNameRequired"));
      return;
    }
    if (reservationType === "outside_church" && !feeAcknowledged && !isAdmin) {
      setErrorMsg(t("editReservation.errAcknowledgeFee"));
      return;
    }
    const isBulkMode = Boolean(seriesId) && applySelectionMode === "selected";
    if (isBulkMode) {
      if (selectedOccurrenceIds.length === 0) {
        setErrorMsg(
          t("editReservation.errNoOccurrencesSelected", {
            defaultValue: "Please select at least one session to update.",
          }),
        );
        return;
      }
      if (hasPastShiftError) {
        setErrorMsg(
          t("editReservation.errShiftPast", {
            defaultValue: "Shifted dates cannot land in the past.",
          }),
        );
        return;
      }
    }

    setIsSubmitting(true);
    setErrorMsg(null);
    setConflictsList(null);

    try {
      const shouldBulkPatch =
        Boolean(seriesId) &&
        (applySelectionMode === "all" ||
          selectedOccurrenceIds.length > 1 ||
          shiftType !== "none");

      if (shouldBulkPatch) {
        const body: Record<string, unknown> = {
          changes: {
            instrumentId: currentInstrument.id,
            serviceName: serviceName.trim(),
            serviceLocation: serviceLocation.trim() || undefined,
            musicianName: musicianName.trim(),
            note: note.trim() || undefined,
            startTime,
            duration,
            reservationType,
            feeAcknowledged:
              reservationType === "outside_church" ? feeAcknowledged : false,
          },
          dateShift: {
            type: shiftType,
            value: shiftType === "weekday" ? targetWeekday : undefined,
          },
          scope: "future",
          occurrenceIds:
            applySelectionMode === "selected"
              ? selectedOccurrenceIds
              : undefined,
        };

        const endpoint = isAdmin
          ? `/api/admin/reservations/series/${seriesId}`
          : `/api/reservations/series/${seriesId}`;

        const res = await fetch(endpoint, {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            ...(sessionToken
              ? { Authorization: `Bearer ${sessionToken}` }
              : {}),
          },
          body: JSON.stringify(body),
        });

        const data = await res.json();
        if (!res.ok || !data.success) {
          if (data.conflicts) setConflictsList(data.conflicts);
          setErrorMsg(
            data.error ||
              t("editReservation.errSeriesUpdateFailed", {
                defaultValue: "Failed to update recurring series.",
              }),
          );
          setIsSubmitting(false);
          return;
        }

        setIsSubmitting(false);
        onSuccess(data);
        return;
      }

      const targetId =
        seriesId && selectedOccurrenceIds.length === 1
          ? selectedOccurrenceIds[0]
          : activeReservation?.id || reservation.id;

      const body: Record<string, unknown> = {
        instrumentId: currentInstrument.id,
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
      if (!sessionToken && !isAdmin) {
        body.userId = profile.id;
      }

      const res = await fetch(`/api/reservations/${targetId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          ...(sessionToken ? { Authorization: `Bearer ${sessionToken}` } : {}),
        },
        body: JSON.stringify(body),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        setErrorMsg(data.error || t("editReservation.errUpdateFailed"));
        setIsSubmitting(false);
        return;
      }

      setIsSubmitting(false);
      onSuccess(data.reservation);
    } catch (err: any) {
      setErrorMsg(err.message || t("editReservation.errNetwork"));
      setIsSubmitting(false);
    }
  };

  const submitDisabled =
    isLocked ||
    isSubmitting ||
    !serviceName.trim() ||
    !musicianName.trim() ||
    (reservationType === "outside_church" && !feeAcknowledged && !isAdmin) ||
    (Boolean(seriesId) && hasPastShiftError) ||
    (Boolean(seriesId) &&
      applySelectionMode === "selected" &&
      selectedOccurrenceIds.length === 0);

  // 🚫 If completed, render a locked notice instead of the form.
  if (isLocked) {
    return (
      <div
        id="edit-reservation-modal-backdrop"
        role="dialog"
        aria-modal="true"
        className="fixed inset-0 z-[115] bg-stone-900/60 backdrop-blur-xs flex items-stretch sm:items-center justify-center p-0 sm:p-4"
      >
        <div
          className="bg-stone-50 sm:rounded-3xl sm:border sm:border-stone-200 shadow-2xl w-full sm:max-w-md z-10 flex flex-col h-full sm:h-auto overflow-hidden animate-in fade-in zoom-in-95 duration-150 pt-[env(safe-area-inset-top)]"
          dir={isAr ? "rtl" : "ltr"}
        >
          <div className="shrink-0 bg-stone-900 text-white px-4 sm:px-5 py-3 sm:py-3.5 flex items-center justify-between border-b border-stone-800">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-9 h-9 rounded-2xl bg-stone-700 text-stone-200 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-4.5 h-4.5" />
              </div>
              <div className="min-w-0">
                <h2 className="text-[13px] sm:text-sm font-bold text-white leading-tight truncate">
                  {t("editReservation.lockedTitle", {
                    defaultValue: "Reservation Completed",
                  })}
                </h2>
                <p className="text-[10px] sm:text-[11px] text-stone-400 truncate mt-0.5">
                  {t("editReservation.lockedSubtitle", {
                    defaultValue: "This reservation can no longer be edited.",
                  })}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label={t("common.close")}
              className="shrink-0 w-8 h-8 sm:w-9 sm:h-9 flex items-center justify-center rounded-full bg-stone-800 text-stone-300 hover:text-white hover:bg-stone-700 transition cursor-pointer touch-manipulation"
            >
              <X className="w-4 h-4 sm:w-4.5 sm:h-4.5" />
            </button>
          </div>

          <div className="p-4 sm:p-6 space-y-3">
            <div className="bg-stone-100 border border-stone-200 rounded-2xl p-4 text-xs text-stone-700 leading-relaxed">
              {t("editReservation.lockedBody", {
                defaultValue:
                  "Completed reservations are locked for record integrity. If you need to make changes, please contact church administration.",
              })}
            </div>
            <button
              type="button"
              onClick={onClose}
              className="w-full py-2 sm:py-2.5 px-4 rounded-2xl bg-stone-900 hover:bg-stone-800 text-white text-xs sm:text-[13px] font-bold transition cursor-pointer touch-manipulation"
            >
              {t("common.close")}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      id="edit-reservation-modal-backdrop"
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-[115] bg-stone-900/60 backdrop-blur-xs flex items-stretch sm:items-center justify-center p-0 sm:p-4"
    >
      <div
        id="edit-reservation-modal"
        className="bg-stone-50 sm:rounded-3xl sm:border sm:border-stone-200 shadow-2xl w-full sm:max-w-xl z-10 flex flex-col h-full sm:h-auto sm:max-h-[90vh] overflow-hidden animate-in fade-in zoom-in-95 duration-150 pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]"
        dir={isAr ? "rtl" : "ltr"}
      >
        {/* ── Header ── */}
        <div className="shrink-0 bg-stone-900 text-white px-4 sm:px-5 py-3 sm:py-3.5 flex items-center justify-between border-b border-stone-800">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-2xl bg-amber-800 text-amber-100 flex items-center justify-center font-bold shadow-xs shrink-0">
              {scope === "series" && seriesId ? (
                <Repeat className="w-4.5 h-4.5" />
              ) : (
                <Music2 className="w-4.5 h-4.5" />
              )}
            </div>
            <div className="min-w-0">
              <h2 className="text-[13px] sm:text-sm font-bold text-white leading-tight truncate">
                {scope === "chooser"
                  ? t("editReservation.scopeChooserTitle", {
                      defaultValue: "Edit Recurring Reservation",
                    })
                  : seriesId
                    ? applySelectionMode === "selected"
                      ? t("editReservation.scopeSelectedTitle", {
                          defaultValue: "Edit Selected Occurrences",
                        })
                      : t("editReservation.scopeSeriesTitle", {
                          defaultValue: "Edit Entire Series",
                        })
                    : t("editReservation.headerTitle")}
              </h2>
              <div className="flex items-center gap-2 flex-wrap">
                <p className="text-[10px] sm:text-[11px] text-stone-400 truncate">
                  {seriesId
                    ? applySelectionMode === "selected"
                      ? t("editReservation.editingSelectedBanner", {
                          count: targetOccurrences.length,
                          total: upcomingOccurrences.length,
                          defaultValue: `Editing ${targetOccurrences.length} of ${upcomingOccurrences.length} occurrences`,
                        })
                      : t("editReservation.editingUpcomingBanner", {
                          count: upcomingOccurrences.length,
                          defaultValue: `Editing ${upcomingOccurrences.length} upcoming occurrences`,
                        })
                    : t("editReservation.headerSubtitle")}
                </p>
              </div>
            </div>
          </div>

          <button
            id="btn-close-edit-reservation-modal"
            type="button"
            onClick={onClose}
            aria-label={t("common.close")}
            className="shrink-0 w-8 h-8 sm:w-9 sm:h-9 flex items-center justify-center rounded-full bg-stone-800 text-stone-300 hover:text-white hover:bg-stone-700 active:bg-stone-600 transition cursor-pointer touch-manipulation"
          >
            <X className="w-4 h-4 sm:w-4.5 sm:h-4.5" />
          </button>
        </div>

        {/* ── SCOPE CHOOSER VIEW ── */}
        {scope === "chooser" ? (
          <div className="p-6 sm:p-8 space-y-5 max-w-md w-full mx-auto my-auto text-center flex-1 flex flex-col justify-center">
            <div className="w-14 h-14 rounded-2xl bg-amber-100 text-amber-900 flex items-center justify-center mx-auto shadow-xs">
              <Repeat className="w-7 h-7" />
            </div>
            <div>
              <h3 className="text-[15px] sm:text-base font-bold text-stone-900">
                {t("editReservation.scopeChooserTitle", {
                  defaultValue: "Edit Recurring Reservation",
                })}
              </h3>
              <p className="text-xs sm:text-sm text-stone-500 mt-1.5 leading-relaxed">
                {t("editReservation.scopeChooserSubtitle", {
                  defaultValue:
                    "This booking is part of a recurring series. Choose whether to update only this single occurrence or customize multiple dates across the series.",
                })}
              </p>
            </div>

            <div className="space-y-3 pt-2 text-start">
              <button
                type="button"
                onClick={() => {
                  setScope("series");
                  setApplySelectionMode("selected");
                  if (selectedOccurrenceIds.length === 0) {
                    if (activeReservation?.id) {
                      setSelectedOccurrenceIds([activeReservation.id]);
                    } else if (upcomingOccurrences.length > 0) {
                      setSelectedOccurrenceIds([upcomingOccurrences[0].id]);
                    }
                  }
                }}
                className="w-full p-4 rounded-2xl border border-stone-200 hover:border-amber-400 hover:bg-amber-50/20 active:bg-amber-50/40 flex items-start gap-3 transition cursor-pointer group touch-manipulation shadow-2xs"
              >
                <div className="w-10 h-10 rounded-xl bg-stone-100 group-hover:bg-amber-100 text-stone-700 group-hover:text-amber-800 flex items-center justify-center shrink-0 transition">
                  <CheckSquare className="w-5 h-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-xs sm:text-sm font-bold text-stone-900 group-hover:text-amber-900">
                    {t("editReservation.tabSelected", {
                      defaultValue: "Selected Sessions",
                    })}
                  </div>
                  <div className="text-[11px] sm:text-xs text-stone-500 mt-0.5 leading-snug">
                    {t("editReservation.scopeSelectedSubtitle", {
                      defaultValue:
                        "Edit this session or choose specific occurrences across the series.",
                    })}
                  </div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => {
                  setScope("series");
                  setApplySelectionMode("all");
                }}
                className="w-full p-4 rounded-2xl border border-stone-200 hover:border-amber-400 hover:bg-amber-50/20 active:bg-amber-50/40 flex items-start gap-3 transition cursor-pointer group touch-manipulation shadow-2xs"
              >
                <div className="w-10 h-10 rounded-xl bg-stone-100 group-hover:bg-amber-100 text-stone-700 group-hover:text-amber-800 flex items-center justify-center shrink-0 transition">
                  <Repeat className="w-5 h-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-xs sm:text-sm font-bold text-stone-900 group-hover:text-amber-900">
                    {t("editReservation.scopeSeriesTitle", {
                      defaultValue: "Edit entire series (all upcoming)",
                    })}
                  </div>
                  <div className="text-[11px] sm:text-xs text-stone-500 mt-0.5 leading-snug">
                    {t("editReservation.scopeSeriesDesc", {
                      defaultValue:
                        "Shift dates, change instrument/service, or update all upcoming sessions in this series.",
                    })}
                  </div>
                </div>
              </button>
            </div>

            <div className="pt-2">
              <button
                type="button"
                onClick={onClose}
                className="w-full py-2.5 rounded-2xl bg-stone-100 hover:bg-stone-200 text-stone-700 text-xs sm:text-[13px] font-bold transition cursor-pointer touch-manipulation min-h-[44px]"
              >
                {t("common.cancel")}
              </button>
            </div>
          </div>
        ) : (
          /* ── FORM VIEW ── */
          <form
            id="edit-reservation-form"
            onSubmit={handleEditSubmit}
            className="flex flex-col flex-1 min-h-0"
          >
            <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain p-3.5 sm:p-5 space-y-3 sm:space-y-3.5">
              {/* Series Options panel — always inline */}
              {seriesId && (
                <div className="space-y-3">
                  <div className="bg-stone-200/70 p-1 rounded-2xl flex items-center gap-1 text-xs font-bold shadow-2xs">
                    <button
                      type="button"
                      onClick={() => {
                        setApplySelectionMode("selected");
                        if (selectedOccurrenceIds.length === 0) {
                          if (activeReservation?.id) {
                            setSelectedOccurrenceIds([activeReservation.id]);
                          } else if (upcomingOccurrences.length > 0) {
                            setSelectedOccurrenceIds([
                              upcomingOccurrences[0].id,
                            ]);
                          }
                        }
                      }}
                      className={`flex-1 py-2 px-2.5 rounded-xl transition flex items-center justify-center gap-1.5 cursor-pointer touch-manipulation ${
                        applySelectionMode === "selected"
                          ? "bg-white text-stone-900 shadow-2xs"
                          : "text-stone-600 hover:text-stone-900"
                      }`}
                    >
                      <CheckSquare className="w-3.5 h-3.5" />
                      <span>
                        {t("editReservation.tabSelected", {
                          defaultValue: "Selected Sessions",
                        })}
                      </span>
                      {selectedOccurrenceIds.length > 0 && (
                        <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-amber-100 text-amber-900 font-bold">
                          {selectedOccurrenceIds.length}
                        </span>
                      )}
                    </button>

                    <button
                      type="button"
                      onClick={() => setApplySelectionMode("all")}
                      className={`flex-1 py-2 px-2.5 rounded-xl transition flex items-center justify-center gap-1.5 cursor-pointer touch-manipulation ${
                        applySelectionMode === "all"
                          ? "bg-white text-stone-900 shadow-2xs"
                          : "text-stone-600 hover:text-stone-900"
                      }`}
                    >
                      <Repeat className="w-3.5 h-3.5" />
                      <span>
                        {t("editReservation.tabSeries", {
                          defaultValue: "Entire Series",
                        })}
                      </span>
                      {upcomingOccurrences.length > 0 && (
                        <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-amber-100 text-amber-900 font-bold">
                          {upcomingOccurrences.length}
                        </span>
                      )}
                    </button>
                  </div>

                  {/* Selected Sessions: Checklist */}
                  {applySelectionMode === "selected" && (
                    <div className="bg-white rounded-2xl border border-stone-200 p-3 sm:p-3.5 space-y-2.5 shadow-2xs animate-in fade-in">
                      <div className="flex flex-wrap items-center justify-between gap-1.5 text-xs">
                        <div className="font-bold text-stone-900 flex items-center gap-1.5 min-w-0">
                          <Layers className="w-3.5 h-3.5 text-amber-800 shrink-0" />
                          <span className="truncate">
                            {t("editReservation.chooseOccurrencesToUpdate", {
                              defaultValue: "Sessions in this series:",
                            })}
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0 flex-wrap">
                          <span className="text-[11px] font-bold text-amber-950 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">
                            {selectedOccurrenceIds.length} /{" "}
                            {upcomingOccurrences.length ||
                              allSeriesOccurrences.length}
                          </span>
                          <button
                            type="button"
                            onClick={() =>
                              setIsMultiSelectMode((prev) => !prev)
                            }
                            className={`px-2 py-0.5 rounded-lg text-[11px] font-bold transition cursor-pointer flex items-center gap-1 ${
                              isMultiSelectMode
                                ? "bg-amber-800 text-white shadow-2xs"
                                : "bg-stone-200/80 hover:bg-stone-300 text-stone-700"
                            }`}
                          >
                            <CheckSquare className="w-3 h-3" />
                            <span>
                              {isMultiSelectMode
                                ? t("common.done", { defaultValue: "Done" })
                                : t("common.select", {
                                    defaultValue: "Select",
                                  })}
                            </span>
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setIsMultiSelectMode(true);
                              selectAllOccurrences();
                            }}
                            className="text-[11px] text-amber-800 font-bold hover:underline cursor-pointer"
                          >
                            {t("common.selectAll", {
                              defaultValue: "Select All",
                            })}
                          </button>
                          {isMultiSelectMode && (
                            <>
                              <span className="text-stone-300">·</span>
                              <button
                                type="button"
                                onClick={clearOccurrenceSelection}
                                className="text-[11px] text-stone-500 hover:text-stone-800 font-bold hover:underline cursor-pointer"
                              >
                                {t("common.clear", { defaultValue: "Clear" })}
                              </button>
                            </>
                          )}
                        </div>
                      </div>

                      <div className="max-h-48 overflow-y-auto space-y-1.5 pr-1">
                        {(upcomingOccurrences.length > 0
                          ? upcomingOccurrences
                          : allSeriesOccurrences
                        ).map((occ, idx) => {
                          const isChecked = selectedOccurrenceIds.includes(
                            occ.id,
                          );
                          const rawDate =
                            occ.reservation_date ||
                            (occ.start_time
                              ? String(occ.start_time).substring(0, 10)
                              : getCairoDateString(new Date(occ.start_time)));
                          const timeStr =
                            occ.start_hhmm ||
                            getCairoTimeString(new Date(occ.start_time));
                          return (
                            <div
                              key={occ.id}
                              onClick={() => {
                                if (isMultiSelectMode) {
                                  toggleOccurrenceSelection(occ.id);
                                } else {
                                  setActiveReservation(occ);
                                  const sUtc = new Date(
                                    occ.start_time || occ.startTime,
                                  );
                                  const eUtc = new Date(
                                    occ.end_time || occ.endTime,
                                  );
                                  const dStr =
                                    occ.reservation_date ||
                                    (occ.start_time
                                      ? String(occ.start_time).substring(0, 10)
                                      : getCairoDateString(sUtc));
                                  const tStr =
                                    occ.start_hhmm || getCairoTimeString(sUtc);
                                  const durH = Math.max(
                                    0.5,
                                    (eUtc.getTime() - sUtc.getTime()) /
                                      (3600 * 1000),
                                  );
                                  setDate(dStr);
                                  setStartTime(tStr);
                                  setDuration(durH);
                                  if (occ.instrument_id)
                                    setSelectedInstrumentId(occ.instrument_id);
                                  if (occ.service_name)
                                    setServiceName(occ.service_name);
                                  if (occ.service_location !== undefined)
                                    setServiceLocation(
                                      occ.service_location || "",
                                    );
                                  if (occ.musician_name)
                                    setMusicianName(occ.musician_name);
                                  if (occ.note !== undefined)
                                    setNote(occ.note || "");
                                  if (occ.reservation_type)
                                    setReservationType(occ.reservation_type);
                                  setSelectedOccurrenceIds([occ.id]);
                                }
                              }}
                              className={`flex items-center justify-between p-2 rounded-xl border text-xs cursor-pointer transition select-none gap-2 ${
                                isChecked
                                  ? "bg-amber-50/70 border-amber-300 text-stone-900 shadow-2xs ring-1 ring-amber-300/60"
                                  : "bg-stone-50/50 border-stone-200 text-stone-600 hover:bg-stone-100/60"
                              }`}
                            >
                              <div className="flex items-center gap-2 min-w-0 flex-1">
                                {isMultiSelectMode && (
                                  <input
                                    type="checkbox"
                                    checked={isChecked}
                                    onChange={(e) => {
                                      e.stopPropagation();
                                      toggleOccurrenceSelection(occ.id);
                                    }}
                                    className="rounded border-stone-300 text-amber-800 focus:ring-amber-700 w-4 h-4 cursor-pointer shrink-0"
                                  />
                                )}
                                <span
                                  className={`w-5 h-5 rounded-md flex items-center justify-center text-[10px] font-bold shrink-0 ${
                                    isChecked
                                      ? "bg-amber-800 text-white"
                                      : "bg-stone-200/80 text-stone-700"
                                  }`}
                                >
                                  {idx + 1}
                                </span>
                                <div className="flex flex-col min-w-0 flex-1">
                                  <span className="font-semibold truncate">
                                    {formatDisplayDate(rawDate)}
                                  </span>
                                  <span className="text-[10px] text-stone-500 truncate">
                                    {formatHhmmTo12Hour(timeStr)} –{" "}
                                    {formatHhmmTo12Hour(
                                      occ.end_hhmm ||
                                        getCairoTimeString(
                                          new Date(occ.end_time || occ.endTime),
                                        ),
                                    )}
                                  </span>
                                </div>
                              </div>
                              <span
                                className={`text-[10px] px-1.5 py-0.2 rounded-md font-bold uppercase shrink-0 ${
                                  occ.status === "approved"
                                    ? "bg-emerald-50 text-emerald-800 border border-emerald-200"
                                    : "bg-amber-50 text-amber-800 border border-amber-200"
                                }`}
                              >
                                {occ.status}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Entire Series Banner */}
                  {applySelectionMode === "all" && (
                    <div className="p-2.5 bg-stone-100 border border-stone-200 rounded-xl text-xs flex items-center justify-between gap-2 text-stone-700 animate-in fade-in">
                      <div className="flex items-center gap-2">
                        <Repeat className="w-4 h-4 text-amber-800 shrink-0" />
                        <span className="font-semibold">
                          {t("editReservation.editingUpcomingBanner", {
                            count: upcomingOccurrences.length,
                            defaultValue: `All ${upcomingOccurrences.length} upcoming occurrences in this series will be updated.`,
                          })}
                        </span>
                      </div>
                    </div>
                  )}

                  {/* Date Shifting — weekday only */}
                  {applySelectionMode === "all" ||
                  selectedOccurrenceIds.length > 1 ? (
                    <div className="bg-white border border-stone-200 rounded-2xl p-3 sm:p-3.5 space-y-3 shadow-2xs">
                      <div className="flex items-center justify-between border-b border-stone-100 pb-1.5">
                        <span className="text-[11px] sm:text-xs font-bold text-stone-800 flex items-center gap-1.5">
                          <Calendar className="w-3.5 h-3.5 text-amber-800" />
                          <span>
                            {t("editReservation.dateShiftTitle", {
                              defaultValue: "Date Shifting",
                            })}
                          </span>
                        </span>
                        <span className="text-[10px] font-mono text-stone-500">
                          {upcomingOccurrences.length} sessions
                        </span>
                      </div>

                      <div className="grid grid-cols-1 gap-1 p-1 bg-stone-100 rounded-xl">
                        <button
                          type="button"
                          onClick={() => setShiftType("weekday")}
                          className="py-1.5 px-2 rounded-lg text-[11px] font-bold transition cursor-pointer text-center touch-manipulation bg-white text-stone-900 shadow-xs"
                        >
                          {t("editReservation.dateShiftWeekday", {
                            defaultValue: "Change weekday",
                          })}
                        </button>
                      </div>

                      <div className="p-2.5 bg-stone-50 border border-stone-200 rounded-xl space-y-2">
                        <label className="block text-[11px] font-semibold text-stone-700">
                          {t("editReservation.shiftWeekdayLabel", {
                            defaultValue:
                              "Move all dates to the nearest weekday on or after each occurrence:",
                          })}
                        </label>
                        <div className="grid grid-cols-7 gap-1">
                          {WEEKDAYS.map((wd) => (
                            <button
                              key={wd.val}
                              type="button"
                              onClick={() => setTargetWeekday(wd.val)}
                              className={`py-1.5 px-1 rounded-lg text-[10px] font-bold transition cursor-pointer text-center touch-manipulation border ${
                                targetWeekday === wd.val
                                  ? "bg-amber-800 text-white border-amber-900 shadow-xs"
                                  : "bg-white text-stone-700 border-stone-200 hover:bg-stone-100"
                              }`}
                            >
                              {isAr ? wd.labelAr : wd.labelEn}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Live Schedule Preview — dates only */}
                      <div className="space-y-1 pt-1">
                        <span className="block text-[10px] font-bold text-stone-600 uppercase tracking-wide">
                          {t("editReservation.dateShiftPreviewTitle", {
                            defaultValue:
                              "Schedule Preview (Old Date → New Date)",
                          })}
                        </span>
                        <div className="space-y-1 max-h-28 overflow-y-auto p-1.5 bg-stone-50 border border-stone-200 rounded-xl text-[11px]">
                          {isLoadingOccurrences ? (
                            <div className="py-2 text-center text-stone-400">
                              Loading...
                            </div>
                          ) : previewOccurrences.length === 0 ? (
                            <div className="py-1 text-center text-stone-400">
                              No upcoming occurrences.
                            </div>
                          ) : (
                            previewOccurrences.map((item) => (
                              <div
                                key={item.id}
                                className={`flex items-center justify-between py-0.5 px-1.5 rounded border ${
                                  item.isPast
                                    ? "bg-rose-50 border-rose-200 text-rose-900 font-bold"
                                    : "bg-white border-stone-100 text-stone-700"
                                }`}
                              >
                                <span className="text-stone-500 font-mono truncate">
                                  #{item.index}{" "}
                                  {formatDisplayDate(item.oldDate)}
                                </span>
                                <span className="font-bold flex items-center gap-1 shrink-0">
                                  <span>→</span>
                                  <span
                                    className={
                                      item.isPast
                                        ? "text-rose-700 underline"
                                        : "text-amber-900"
                                    }
                                  >
                                    {formatDisplayDate(item.newDate)}
                                  </span>
                                </span>
                              </div>
                            ))
                          )}
                        </div>
                      </div>

                      {hasPastShiftError && (
                        <div className="p-2 rounded-lg bg-rose-50 border border-rose-200 text-rose-900 text-[11px] flex items-center gap-1.5 font-bold">
                          <AlertTriangle className="w-3.5 h-3.5 text-rose-700 shrink-0" />
                          <span>
                            {t("editReservation.dateShiftPastError", {
                              defaultValue:
                                "Shifted dates cannot land in the past.",
                            })}
                          </span>
                        </div>
                      )}
                    </div>
                  ) : null}
                </div>
              )}

              {/* Error Banner */}
              {errorMsg && (
                <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-red-900 flex items-start gap-2.5 animate-in fade-in">
                  <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                  <div className="space-y-0.5 text-[11px] sm:text-xs">
                    <div className="font-bold text-red-950">
                      {t("editReservation.updateBlockedTitle")}
                    </div>
                    <div className="text-red-800 leading-relaxed break-words">
                      {errorMsg}
                    </div>
                  </div>
                </div>
              )}

              {/* Conflict Warning */}
              {conflictsList && conflictsList.length > 0 && (
                <div className="bg-rose-50 border border-rose-200 rounded-2xl p-3 text-rose-950 space-y-1.5 animate-in fade-in">
                  <div className="flex items-center gap-2 font-bold text-[11px] sm:text-xs text-rose-900">
                    <AlertTriangle className="w-3.5 h-3.5 text-rose-700 shrink-0" />
                    <span>
                      {t("editReservation.conflictWarningTitle", {
                        defaultValue: "Schedule Conflict Detected",
                      })}
                    </span>
                  </div>
                  <ul className="text-[11px] space-y-0.5 list-disc list-inside text-rose-900 font-medium bg-white/70 p-2 rounded-lg border border-rose-200/60 max-h-28 overflow-y-auto">
                    {conflictsList.map((c: any, i: number) => (
                      <li key={i}>
                        {c.occurrenceDate || c.date}{" "}
                        {c.occurrenceTime || c.startTime
                          ? `at ${formatHhmmTo12Hour(c.occurrenceTime || c.startTime)}`
                          : ""}{" "}
                        {c.message ? `— ${c.message}` : ""}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* 1. Instrument Selector */}
              <div className="bg-white rounded-2xl border border-stone-200 p-3 sm:p-3.5 shadow-2xs space-y-2.5">
                <div className="text-[11px] sm:text-xs font-bold text-stone-800 flex items-center gap-1.5 border-b border-stone-100 pb-1.5">
                  <Music2 className="w-3.5 h-3.5 text-amber-800" />
                  <span>
                    {t("editReservation.selectInstrumentLabel", {
                      defaultValue: "Selected Instrument",
                    })}
                  </span>
                </div>

                <div className="flex items-center gap-2.5">
                  <div className="w-12 h-12 rounded-2xl bg-amber-50 border border-amber-200 text-amber-800 flex items-center justify-center shrink-0 overflow-hidden shadow-2xs">
                    {currentInstrument?.photoUrl ? (
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
                    <div className="text-sm font-bold text-stone-900 truncate">
                      {currentInstrument?.name}
                    </div>
                    <div className="text-[10px] sm:text-[11px] text-stone-500 truncate">
                      {currentInstrument?.type} •{" "}
                      {currentInstrument?.bookingMode === "instant"
                        ? t("admin.instruments.instantBooking")
                        : t("admin.instruments.manualReview")}
                    </div>
                  </div>
                </div>

                <div className="relative">
                  <select
                    id="select-edit-instrument"
                    value={selectedInstrumentId}
                    onChange={(e) => setSelectedInstrumentId(e.target.value)}
                    className="w-full appearance-none bg-stone-50 hover:bg-stone-100 border border-stone-300 rounded-xl px-2.5 py-1.5 text-xs sm:text-[13px] font-semibold text-stone-900 focus:outline-none focus:ring-2 focus:ring-amber-800/40 focus:border-amber-800 transition cursor-pointer pr-8"
                  >
                    {allInstruments.map((inst) => (
                      <option key={inst.id} value={inst.id}>
                        {inst.name} ({inst.type}) —{" "}
                        {inst.bookingMode === "instant"
                          ? t("common.instant")
                          : t("common.manual")}
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

                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] sm:text-[11px] font-semibold bg-stone-100 text-stone-700 border border-stone-200 whitespace-nowrap">
                    {t("reservationForm.typeBadgeLabel", {
                      type: currentInstrument?.type,
                    })}
                  </span>
                  <span
                    className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] sm:text-[11px] font-bold uppercase tracking-wide whitespace-nowrap ${
                      currentInstrument?.bookingMode === "instant"
                        ? "bg-emerald-100 text-emerald-900 border border-emerald-200"
                        : "bg-amber-100 text-amber-900 border border-amber-200"
                    }`}
                  >
                    <Shield className="w-3 h-3 shrink-0" />
                    {currentInstrument?.bookingMode === "instant"
                      ? t("reservationForm.instantApprovalBadge")
                      : t("reservationForm.manualApprovalBadge")}
                  </span>
                  {profile?.isTrusted && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] sm:text-[11px] font-bold bg-amber-100 text-amber-900 border border-amber-200 whitespace-nowrap">
                      <Sparkles className="w-3 h-3 shrink-0" />
                      {t("reservationForm.trustedUserBadge")}
                    </span>
                  )}
                </div>

                {!seriesId && willResetToPendingSingle && (
                  <div className="flex items-start gap-2 p-2.5 bg-amber-50 border border-amber-200 rounded-xl text-[11px] text-amber-900">
                    <AlertTriangle className="w-3.5 h-3.5 text-amber-700 shrink-0 mt-0.5" />
                    <span className="leading-relaxed">
                      {t("editReservation.manualResetWarning")}
                    </span>
                  </div>
                )}
                {seriesId && willResetToPendingCountSeries > 0 && (
                  <div className="flex items-start gap-2 p-2.5 bg-amber-50 border border-amber-200 rounded-xl text-[11px] text-amber-900">
                    <AlertTriangle className="w-3.5 h-3.5 text-amber-700 shrink-0 mt-0.5" />
                    <span className="leading-relaxed">
                      {t("editReservation.mixedPendingNotice", {
                        count: willResetToPendingCountSeries,
                        defaultValue: `${willResetToPendingCountSeries} occurrence(s) will return to Pending review.`,
                      })}
                    </span>
                  </div>
                )}
              </div>

              {/* 2. Purpose */}
              <div className="bg-white rounded-2xl border border-stone-200 p-3 sm:p-3.5 shadow-2xs space-y-2.5">
                <div className="text-[11px] sm:text-xs font-bold text-stone-800 flex items-center gap-1.5 border-b border-stone-100 pb-1.5">
                  <Church className="w-3.5 h-3.5 text-amber-800" />
                  <span>
                    {t("editReservation.purposeQuestionLabel", {
                      defaultValue: "Service & Musician",
                    })}
                  </span>
                </div>

                <div className="space-y-1">
                  <label
                    htmlFor="input-edit-service-name"
                    className="block text-[11px] sm:text-xs font-bold text-stone-700"
                  >
                    {t("editReservation.purposeQuestionLabel")}{" "}
                    <span className="text-amber-800 font-bold">*</span>
                  </label>
                  <input
                    id="input-edit-service-name"
                    type="text"
                    value={serviceName}
                    onChange={(e) => setServiceName(e.target.value)}
                    placeholder={t("editReservation.purposePlaceholder")}
                    className="w-full bg-stone-50 border border-stone-300 rounded-xl px-2.5 py-1.5 text-xs sm:text-[13px] font-medium text-stone-900 placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-amber-800/40 focus:border-amber-800 transition"
                    required
                  />
                </div>

                <div className="space-y-1">
                  <label
                    htmlFor="input-edit-service-location"
                    className="block text-[11px] sm:text-xs font-bold text-stone-700 flex items-center gap-1"
                  >
                    <Church className="w-3 h-3 text-amber-800" />
                    <span>{t("reservationForm.serviceLocationLabel")}</span>
                  </label>
                  <input
                    id="input-edit-service-location"
                    type="text"
                    value={serviceLocation}
                    onChange={(e) => setServiceLocation(e.target.value)}
                    placeholder={t(
                      "reservationForm.serviceLocationPlaceholder",
                    )}
                    className="w-full bg-stone-50 border border-stone-300 rounded-xl px-2.5 py-1.5 text-xs sm:text-[13px] font-medium text-stone-900 placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-amber-800/40 focus:border-amber-800 transition"
                  />
                </div>

                <div className="space-y-1">
                  <label
                    htmlFor="input-edit-musician-name"
                    className="block text-[11px] sm:text-xs font-bold text-stone-700"
                  >
                    {t("editReservation.musicianNameLabel")}{" "}
                    <span className="text-amber-800 font-bold">*</span>
                  </label>
                  <input
                    id="input-edit-musician-name"
                    type="text"
                    value={musicianName}
                    onChange={(e) => setMusicianName(e.target.value)}
                    placeholder={t("editReservation.musicianNamePlaceholder")}
                    className="w-full bg-stone-50 border border-stone-300 rounded-xl px-2.5 py-1.5 text-xs sm:text-[13px] font-medium text-stone-900 placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-amber-800/40 focus:border-amber-800 transition"
                    required
                  />
                </div>

                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <label
                      htmlFor="input-edit-reservation-note"
                      className="block text-[11px] sm:text-xs font-bold text-stone-700"
                    >
                      {t("reservationForm.leaveANoteLabel", {
                        defaultValue: "Notes / Special Requests",
                      })}
                    </label>
                    <span className="text-[10px] text-stone-400 font-medium">
                      ({t("common.optional", { defaultValue: "Optional" })})
                    </span>
                  </div>
                  <textarea
                    id="input-edit-reservation-note"
                    ref={noteRef}
                    rows={1}
                    value={note}
                    onChange={(e) => {
                      setNote(e.target.value);
                      autoGrowNote(e.target);
                    }}
                    placeholder={t("reservationForm.notePlaceholder", {
                      defaultValue:
                        "Add any notes, special requirements, or requests (optional)...",
                    })}
                    className="w-full bg-stone-50 border border-stone-300 rounded-xl px-2.5 py-1.5 text-xs sm:text-[13px] font-medium text-stone-900 placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-amber-800/40 focus:border-amber-800 transition resize-none overflow-hidden"
                  />
                </div>
              </div>

              {/* 3. Date + Duration preview */}
              {(!seriesId ||
                (applySelectionMode === "selected" &&
                  selectedOccurrenceIds.length === 1 &&
                  shiftType === "none")) && (
                <div className="grid grid-cols-2 gap-2.5">
                  <div className="space-y-1">
                    <label
                      htmlFor="input-edit-reservation-date"
                      className="block text-[11px] sm:text-xs font-bold text-stone-700"
                    >
                      {t("editReservation.dateLabel")}
                    </label>
                    <input
                      id="input-edit-reservation-date"
                      type="date"
                      value={date}
                      onChange={(e) => setDate(e.target.value)}
                      className="w-full bg-stone-50 border border-stone-300 rounded-xl px-2.5 py-1.5 text-xs sm:text-[13px] font-medium text-stone-900 focus:outline-none focus:ring-2 focus:ring-amber-800/40 focus:border-amber-800 transition"
                      required
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="block text-[11px] sm:text-xs font-bold text-stone-700 opacity-0 select-none">
                      &nbsp;
                    </label>
                    <div className="w-full h-[32px] flex items-center justify-center text-[11px] font-bold text-amber-900 bg-amber-50 border border-amber-200 rounded-xl px-2 whitespace-nowrap overflow-hidden">
                      {formatHhmmTo12Hour(startTime)} →{" "}
                      {formatHhmmTo12Hour(endTimeStr)}
                    </div>
                  </div>
                </div>
              )}

              {/* 4. Start Time & Duration */}
              <div className="grid grid-cols-2 gap-2.5">
                <div className="space-y-1">
                  <label className="block text-[11px] sm:text-xs font-bold text-stone-700">
                    {t("editReservation.startTimeLabel")}
                  </label>
                  <div className="relative">
                    <select
                      id="select-edit-start-time"
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

                <div className="space-y-1">
                  <label className="block text-[11px] sm:text-xs font-bold text-stone-700">
                    {t("editReservation.durationLabel", {
                      defaultValue: "Duration",
                    })}
                  </label>
                  <div className="relative">
                    <select
                      id="select-edit-duration"
                      value={duration}
                      onChange={(e) => setDuration(Number(e.target.value))}
                      className="w-full appearance-none bg-stone-50 border border-stone-300 rounded-xl px-2.5 py-1.5 text-xs sm:text-[13px] font-medium text-stone-900 focus:outline-none focus:ring-2 focus:ring-amber-800/40 focus:border-amber-800 transition pr-8 cursor-pointer"
                    >
                      {durationOptions.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {t(opt.labelKey)}
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

              {/* 5. Usage Type */}
              <div className="bg-white rounded-2xl border border-stone-200 p-3 sm:p-3.5 shadow-2xs space-y-2.5">
                <div className="text-[11px] sm:text-xs font-bold text-stone-800 flex items-center gap-1.5 border-b border-stone-100 pb-1.5">
                  <DollarSign className="w-3.5 h-3.5 text-amber-800" />
                  <span>{t("editReservation.usageTypeLabel")}</span>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    id="btn-edit-type-in-church"
                    onClick={() => {
                      setReservationType("in_church");
                      setFeeAcknowledged(false);
                    }}
                    aria-pressed={reservationType === "in_church"}
                    className={`p-2.5 rounded-xl border text-left transition cursor-pointer flex flex-col justify-between active:scale-[0.98] touch-manipulation ${
                      reservationType === "in_church"
                        ? "bg-amber-50/70 border-amber-800 ring-2 ring-amber-800/30"
                        : "bg-stone-50 hover:bg-stone-100 border-stone-200 text-stone-700"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-1 mb-0.5">
                      <span className="font-bold text-[11px] sm:text-xs text-stone-900">
                        {t("editReservation.inChurchUseLabel")}
                      </span>
                      <span className="px-1.5 py-0.5 rounded-md text-[9px] font-bold bg-emerald-100 text-emerald-800 whitespace-nowrap">
                        {t("editReservation.freeBadge")}
                      </span>
                    </div>
                    <p className="text-[10px] text-stone-500 leading-snug text-start">
                      {t("editReservation.inChurchDesc")}
                    </p>
                  </button>

                  <button
                    type="button"
                    id="btn-edit-type-outside-church"
                    onClick={() => setReservationType("outside_church")}
                    aria-pressed={reservationType === "outside_church"}
                    className={`p-2.5 rounded-xl border text-left transition cursor-pointer flex flex-col justify-between active:scale-[0.98] touch-manipulation ${
                      reservationType === "outside_church"
                        ? "bg-purple-50/70 border-purple-800 ring-2 ring-purple-800/30"
                        : "bg-stone-50 hover:bg-stone-100 border-stone-200 text-stone-700"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-1 mb-0.5">
                      <span className="font-bold text-[11px] sm:text-xs text-stone-900">
                        {t("editReservation.outsideChurchLabel")}
                      </span>
                      <span className="px-1.5 py-0.5 rounded-md text-[9px] font-bold bg-purple-100 text-purple-800 whitespace-nowrap">
                        {t("editReservation.egpPerDayBadge", {
                          fee: feeNumber,
                        })}
                      </span>
                    </div>
                    <p className="text-[10px] text-stone-500 leading-snug text-start">
                      {t("editReservation.outsideChurchDesc")}
                    </p>
                  </button>
                </div>

                {reservationType === "outside_church" && (
                  <div
                    id="edit-outside-fee-acknowledgment-box"
                    className="bg-purple-50 border border-purple-200 rounded-xl p-2.5 space-y-2 animate-in fade-in"
                  >
                    <div className="flex items-start gap-2">
                      <DollarSign className="w-3.5 h-3.5 text-purple-700 mt-0.5 shrink-0" />
                      <div className="text-[11px] space-y-0.5 min-w-0">
                        <div className="font-bold text-purple-950">
                          {t("reservationForm.policyFeeTitle")}
                        </div>
                        <div className="text-purple-900 text-[10px] leading-relaxed">
                          {t("reservationDetail.paymentNotice")}
                        </div>
                        {seriesId && (
                          <div className="text-purple-950 font-bold text-[11px] pt-1 border-t border-purple-200">
                            Total estimated fee: EGP{" "}
                            {feeNumber * (targetOccurrences.length || 1)} (
                            {targetOccurrences.length} sessions)
                          </div>
                        )}
                      </div>
                    </div>

                    {!isAdmin && (
                      <label className="flex items-start gap-2 pt-2 border-t border-purple-200/80 cursor-pointer select-none">
                        <input
                          id="checkbox-edit-fee-acknowledged"
                          type="checkbox"
                          checked={feeAcknowledged}
                          onChange={(e) => setFeeAcknowledged(e.target.checked)}
                          className="mt-0.5 w-4 h-4 rounded border-purple-300 text-purple-700 focus:ring-purple-600 cursor-pointer shrink-0"
                        />
                        <span className="text-[11px] font-semibold text-purple-950 leading-snug">
                          {t("editReservation.feeAcknowledgeLabel", {
                            fee: feeNumber,
                          })}
                        </span>
                      </label>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Footer */}
            <div className="shrink-0 flex items-center gap-2 sm:gap-2.5 p-3 sm:px-5 sm:pb-4 border-t border-stone-200 bg-white shadow-xs">
              <button
                type="button"
                onClick={onClose}
                disabled={isSubmitting}
                className="py-2 sm:py-2.5 px-3.5 sm:px-4 bg-stone-100 hover:bg-stone-200 active:bg-stone-300 text-stone-700 text-[11px] sm:text-xs font-bold rounded-2xl transition cursor-pointer touch-manipulation disabled:opacity-50"
              >
                {t("editReservation.cancelButton")}
              </button>

              <button
                type="submit"
                id="btn-submit-edit-reservation"
                disabled={submitDisabled}
                className={`flex-1 py-2 sm:py-2.5 px-4 sm:px-5 rounded-2xl text-[11px] sm:text-xs font-bold text-white transition flex items-center justify-center gap-2 shadow-md cursor-pointer touch-manipulation ${
                  submitDisabled
                    ? "bg-stone-300 cursor-not-allowed text-stone-500 shadow-none"
                    : "bg-amber-800 hover:bg-amber-900 active:scale-[0.99]"
                }`}
              >
                {isSubmitting ? (
                  <>
                    <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    <span>
                      {seriesId
                        ? t("editReservation.updatingSeries", {
                            defaultValue: "Updating Series...",
                          })
                        : t("editReservation.savingChanges")}
                    </span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>
                      {seriesId
                        ? applySelectionMode === "selected" &&
                          selectedOccurrenceIds.length > 1
                          ? t("editReservation.updateSelectedButton", {
                              count: selectedOccurrenceIds.length,
                              defaultValue: `Update ${selectedOccurrenceIds.length} Selected`,
                            })
                          : t("editReservation.updateSeriesButton", {
                              defaultValue: "Update Entire Series",
                            })
                        : t("editReservation.updateButton")}
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
    </div>
  );
};
