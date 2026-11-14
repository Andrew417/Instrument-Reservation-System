import React, { useState, useEffect, useMemo, useRef } from "react";
import { useTranslation } from "react-i18next";
import i18n from "../lib/i18n";
import { Instrument } from "./AvailabilityCalendar.tsx";
import { useAuth } from "../contexts/AuthContext.tsx";
import { PolicyExplainerModal } from "./PolicyExplainerModal.tsx";
import { ReservationUsageTypeSelector } from "./ReservationUsageTypeSelector.tsx";
import {
  addDaysToDateString,
  cairoDateTimeToDate,
  formatHhmmTo12Hour,
  getCairoParts,
  getCairoTimeString,
  getTodayDateString,
} from "../lib/date-utils";
import { getAuthSessionToken } from "../lib/auth-helpers";
import { buildOwnerPayload, OnBehalfOf } from "../lib/reservation-owner";
import {
  getInstrumentDisplayName,
  formatInstrumentOptionLabel,
} from "../lib/instrument-display";
import {
  Calendar,
  CalendarDays,
  Clock,
  Music2,
  AlertCircle,
  CheckCircle2,
  AlertTriangle,
  X,
  Repeat,
  Shield,
  HelpCircle,
  ChevronRight,
  ArrowRight,
  User,
  FileText,
  Church,
  Zap,
  Sparkles,
  Layers,
  Info,
  Trash2,
} from "lucide-react";

export interface ReservationFormProps {
  onBehalfOf?: OnBehalfOf;
  initialInstrument?: Instrument | null;
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

interface OccurrenceItem {
  id: string;
  date: string;
  startTime: string;
  duration: number;
}

interface SeriesConflictDetail {
  type: "existing_reservation" | "self_overlap" | "working_hours";
  occurrenceIndex: number;
  occurrenceDate: string;
  occurrenceTime: string;
  message: string;
}

const getValidFee = (value: unknown): number => {
  const fee = Number(value);
  return Number.isFinite(fee) && fee >= 0 ? fee : 0;
};

const calculateEndTime = (startHhmm: string, durationHours: number): string => {
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
}) => {
  const { profile, sessionToken } = useAuth();
  const { t, i18n } = useTranslation();
  const isAr = i18n.language === "ar";

  const isAdmin = Boolean(
    profile?.role === "admin" ||
    profile?.role === "super_admin" ||
    profile?.isSuperAdmin,
  );

  // Real instruments list state & fetching (never inject fake 'Grand Piano' or 'Piano' defaults)
  const [instrumentsList, setInstrumentsList] = useState<Instrument[]>(() => {
    if (Array.isArray(allInstruments) && allInstruments.length > 0) {
      return allInstruments.filter(
        (i) => Boolean(i && i.id && i.id !== "default-piano"),
      );
    }
    if (
      initialInstrument &&
      typeof initialInstrument === "object" &&
      initialInstrument.id &&
      initialInstrument.id !== "default-piano"
    ) {
      return [initialInstrument];
    }
    return [];
  });

  const [isLoadingInstruments, setIsLoadingInstruments] = useState<boolean>(
    () => {
      const hasInstruments =
        (Array.isArray(allInstruments) && allInstruments.length > 0) ||
        Boolean(
          initialInstrument &&
            typeof initialInstrument === "object" &&
            initialInstrument.id &&
            initialInstrument.id !== "default-piano",
        );
      return !hasInstruments;
    },
  );

  useEffect(() => {
    if (Array.isArray(allInstruments) && allInstruments.length > 0) {
      const valid = allInstruments.filter(
        (i) => Boolean(i && i.id && i.id !== "default-piano"),
      );
      if (valid.length > 0) {
        setInstrumentsList(valid);
        setIsLoadingInstruments(false);
      }
    }
  }, [allInstruments]);

  useEffect(() => {
    if (instrumentsList.length > 0) return;
    let isCancelled = false;
    setIsLoadingInstruments(true);
    fetch("/api/instruments", {
      headers: sessionToken
        ? { Authorization: `Bearer ${sessionToken}` }
        : {},
    })
      .then((res) => res.json())
      .then((data) => {
        if (!isCancelled && data.success && Array.isArray(data.instruments)) {
          const valid = data.instruments.filter(
            (i: any) => Boolean(i && i.id && i.id !== "default-piano"),
          );
          setInstrumentsList(valid);
        }
      })
      .catch((err) => {
        console.error("Failed to fetch instruments in modal:", err);
      })
      .finally(() => {
        if (!isCancelled) {
          setIsLoadingInstruments(false);
        }
      });

    return () => {
      isCancelled = true;
    };
  }, [instrumentsList.length, sessionToken]);

  const safeAllInstruments: Instrument[] = useMemo(() => {
    if (instrumentsList.length > 0) {
      return instrumentsList;
    }
    if (Array.isArray(allInstruments) && allInstruments.length > 0) {
      const valid = allInstruments.filter(
        (inst): inst is Instrument =>
          Boolean(
            inst &&
              typeof inst === "object" &&
              inst.id &&
              inst.id !== "default-piano",
          ),
      );
      if (valid.length > 0) return valid;
    }
    if (
      initialInstrument &&
      typeof initialInstrument === "object" &&
      initialInstrument.id &&
      initialInstrument.id !== "default-piano"
    ) {
      return [initialInstrument];
    }
    return [];
  }, [instrumentsList, allInstruments, initialInstrument]);

  const availableCategories = useMemo(() => {
    const set = new Set<string>();
    safeAllInstruments.forEach((i) => {
      if (i && typeof i.type === "string" && i.type.trim()) {
        set.add(i.type.trim());
      }
    });
    const list = Array.from(set).filter(Boolean);
    return list.sort((a, b) => {
      if (a.toLowerCase() === "piano") return -1;
      if (b.toLowerCase() === "piano") return 1;
      return a.localeCompare(b);
    });
  }, [safeAllInstruments]);

  const isInstrumentsLoading =
    isLoadingInstruments ||
    (safeAllInstruments.length === 0 && availableCategories.length === 0);

  const [selectedCategory, setSelectedCategory] = useState<string>(() => {
    if (initialRequestedType) return initialRequestedType;
    if (
      initialInstrument &&
      initialInstrument.id &&
      initialInstrument.id !== "default-piano" &&
      initialInstrument.type
    ) {
      return initialInstrument.type;
    }
    return "";
  });

  useEffect(() => {
    if (availableCategories.length === 0) return;
    if (!selectedCategory || !availableCategories.includes(selectedCategory)) {
      const piano = availableCategories.find(
        (c) => c.toLowerCase() === "piano",
      );
      setSelectedCategory(piano || availableCategories[0]);
    }
  }, [availableCategories, selectedCategory]);

  const [availableTypes, setAvailableTypes] = useState<
    Array<{
      type: string;
      can_be_requested: boolean;
      flat_fee_outside: string;
      active_instruments_count: number;
    }>
  >([]);

  useEffect(() => {
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
        }
      })
      .catch(console.error);
  }, []);

  // Pre-fill specific instrument when opened from a calendar/instrument slot;
  // otherwise default to "" (-- Any [Category] --) for admin assignment.
  const [selectedInstrumentId, setSelectedInstrumentId] = useState<string>(
    () => {
      if (initialIsTypeRequest) return "";
      if (
        initialInstrument &&
        typeof initialInstrument === "object" &&
        initialInstrument.id &&
        initialInstrument.id !== "default-piano"
      ) {
        return initialInstrument.id;
      }
      return "";
    },
  );
  const isTypeRequest =
    !selectedInstrumentId || selectedInstrumentId.trim() === "";

  const [serviceName, setServiceName] = useState<string>(
    initialServiceName || "",
  );
  const [serviceLocation, setServiceLocation] = useState<string>("");
  const [musicianName, setMusicianName] = useState<string>(
    initialMusicianName || "",
  );
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

  // Unified Recurring / Repeat State
  const [isRecurring, setIsRecurring] = useState<boolean>(false);
  const [patternType, setPatternType] = useState<"weekly" | "custom">("weekly");
  const [weeklyInterval, setWeeklyInterval] = useState<number>(1);
  const [weeklyCount, setWeeklyCount] = useState<number>(4);
  const [customDates, setCustomDates] = useState<string[]>([initialDate]);
  const [hasEditedCustomDates, setHasEditedCustomDates] =
    useState<boolean>(false);
  const [skippedNotice, setSkippedNotice] = useState<number | null>(null);
  const [maxSeriesLimit, setMaxSeriesLimit] = useState<number>(8);

  const [showPolicyExplainer, setShowPolicyExplainer] =
    useState<boolean>(false);
  const [showConflictPopup, setShowConflictPopup] = useState<boolean>(false);

  // Status & Submission States
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Single-date availability & conflict checking
  const [dateReservations, setDateReservations] = useState<any[]>([]);
  // Multi-date availability for recurring series checking
  const [instrumentReservations, setInstrumentReservations] = useState<any[]>(
    [],
  );

  // Keep customDates synced with primary `date` until user manually customizes dates
  useEffect(() => {
    if (!hasEditedCustomDates && date) {
      setCustomDates([date]);
    }
  }, [date, hasEditedCustomDates]);

  // Fetch recurring limits once
  useEffect(() => {
    let isMounted = true;
    fetch("/api/reservations/limits")
      .then((res) => res.json())
      .then((data) => {
        if (isMounted && data.success && data.limits?.maxSeriesOccurrences) {
          setMaxSeriesLimit(data.limits.maxSeriesOccurrences);
        }
      })
      .catch((err) => {
        console.error("Failed to load runtime limits, defaulting to 8:", err);
      });
    return () => {
      isMounted = false;
    };
  }, []);

  // Fetch single-date reservations for conflict check
  useEffect(() => {
    if (!date) return;
    let isCancelled = false;

    const token = getAuthSessionToken(sessionToken);
    fetch(
      `/api/instruments/availability/date?date=${encodeURIComponent(date)}`,
      {
        headers: {
          Accept: "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      },
    )
      .then((res) => res.json())
      .then((data) => {
        if (!isCancelled && data.success && Array.isArray(data.reservations)) {
          setDateReservations(data.reservations);
        }
      })
      .catch((err) => {
        console.error(
          "Failed to fetch reservations for date conflict check:",
          err,
        );
      });

    return () => {
      isCancelled = true;
    };
  }, [date, sessionToken]);

  // Fetch instrument-wide reservations when recurring is enabled for a specific instrument
  useEffect(() => {
    if (!isRecurring || isTypeRequest || !selectedInstrumentId) {
      setInstrumentReservations([]);
      return;
    }
    let isMounted = true;
    const token = getAuthSessionToken(sessionToken);

    fetch(
      `/api/reservations?instrumentId=${encodeURIComponent(selectedInstrumentId)}&status=approved,ongoing,completed`,
      {
        headers: {
          Accept: "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      },
    )
      .then((res) => res.json())
      .then((data) => {
        if (isMounted && data.success && Array.isArray(data.reservations)) {
          setInstrumentReservations(data.reservations);
        }
      })
      .catch((err) => {
        console.error("Failed to fetch existing reservations for series:", err);
      });

    return () => {
      isMounted = false;
    };
  }, [isRecurring, isTypeRequest, selectedInstrumentId, sessionToken]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        if (showConflictPopup) {
          setShowConflictPopup(false);
        } else if (showPolicyExplainer) {
          setShowPolicyExplainer(false);
        } else {
          onClose();
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [showConflictPopup, showPolicyExplainer, onClose]);

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

  const sortedInstruments = useMemo(() => {
    const categoryOrder = new Map<string, number>();
    safeAllInstruments.forEach((instrument, index) => {
      const category = (instrument?.type || "").trim().toLowerCase();
      if (category && !categoryOrder.has(category)) {
        categoryOrder.set(category, index);
      }
    });

    const getVisibilityRank = (instrument: Instrument): number => {
      if (!instrument) return 99;
      const visibility =
        instrument.visibilityLevel ||
        (instrument as any).visibility_level ||
        "public";
      if (visibility === "room_stock") return 1;
      if (visibility === "service") return 2;
      if (visibility === "public") return 0;
      return 3;
    };

    return [...safeAllInstruments]
      .map((instrument, index) => ({ instrument, index }))
      .sort((a, b) => {
        const catA = (a.instrument?.type || "").trim().toLowerCase();
        const catB = (b.instrument?.type || "").trim().toLowerCase();
        const categoryCompare =
          (categoryOrder.get(catA) ?? 0) - (categoryOrder.get(catB) ?? 0);
        if (categoryCompare !== 0) return categoryCompare;

        const visibilityCompare =
          getVisibilityRank(a.instrument) - getVisibilityRank(b.instrument);
        if (visibilityCompare !== 0) return visibilityCompare;

        return a.index - b.index;
      })
      .map(({ instrument }) => instrument);
  }, [safeAllInstruments]);

  const categoryInstruments = useMemo(() => {
    const targetCat = (selectedCategory || "").trim().toLowerCase();
    return sortedInstruments.filter(
      (inst) =>
        inst &&
        typeof inst.type === "string" &&
        inst.type.trim().toLowerCase() === targetCat,
    );
  }, [sortedInstruments, selectedCategory]);

  const currentInstrument = useMemo(() => {
    if (selectedInstrumentId) {
      const found = safeAllInstruments.find(
        (i) => i && i.id === selectedInstrumentId,
      );
      if (found) return found;
    }
    return categoryInstruments[0] || null;
  }, [selectedInstrumentId, safeAllInstruments, categoryInstruments]);

  const isServiceInstant = Boolean(
    !isTypeRequest &&
      currentInstrument &&
      (currentInstrument.visibilityLevel ||
        (currentInstrument as any).visibility_level) === "service" &&
      (currentInstrument.bookingMode ||
        (currentInstrument as any).booking_mode) === "instant",
  );
  const effectiveMaxSeriesLimit = isServiceInstant ? 52 : maxSeriesLimit;

  useEffect(() => {
    if (!isServiceInstant && weeklyCount > maxSeriesLimit) {
      setWeeklyCount(maxSeriesLimit);
    }
  }, [isServiceInstant, maxSeriesLimit, weeklyCount]);

  const handleCategoryChange = (newCategory: string) => {
    setSelectedCategory(newCategory);
    setSelectedInstrumentId("");
  };

  const [startH, startM] = startTime.split(":").map(Number);
  const startTotalMinutes = startH * 60 + startM;
  const endTotalMinutes = startTotalMinutes + Math.round(duration * 60);
  const endH = Math.floor(endTotalMinutes / 60);
  const endM = endTotalMinutes % 60;
  const endTimeStr = `${String(endH).padStart(2, "0")}:${String(endM).padStart(2, "0")}`;

  const hhmmToMinutes = (hhmm: string): number => {
    if (!hhmm) return 0;
    const [h, m] = hhmm.split(":").map((x) => parseInt(x, 10));
    return (h || 0) * 60 + (m || 0);
  };

  const conflictingReservations = useMemo(() => {
    if (isTypeRequest || !selectedInstrumentId) return [];
    const reqStart = startTotalMinutes;
    const reqEnd = endTotalMinutes;

    return dateReservations.filter((res) => {
      if (!res || res.instrumentId !== selectedInstrumentId) return false;
      if (
        res.status &&
        !["approved", "ongoing", "completed"].includes(res.status)
      ) {
        return false;
      }
      const resStart = hhmmToMinutes(res.startHhmm || res.start_hhmm);
      const resEnd = hhmmToMinutes(res.endHhmm || res.end_hhmm);
      return reqStart < resEnd && reqEnd > resStart;
    });
  }, [
    isTypeRequest,
    selectedInstrumentId,
    startTotalMinutes,
    endTotalMinutes,
    dateReservations,
  ]);

  const hasConflict = conflictingReservations.length > 0;

  const conflictingTimesFormatted = useMemo(() => {
    if (conflictingReservations.length === 0) return "";
    return conflictingReservations
      .map((res) => {
        const s = formatHhmmTo12Hour(res.startHhmm || res.start_hhmm);
        const e = formatHhmmTo12Hour(res.endHhmm || res.end_hhmm);
        return isAr ? `${s} ← ${e}` : `${s} → ${e}`;
      })
      .join(isAr ? "، " : ", ");
  }, [conflictingReservations, isAr]);

  // Recurring occurrences generation
  const generatedOccurrences: OccurrenceItem[] = useMemo(() => {
    if (!isRecurring) return [];
    if (patternType === "weekly") {
      const list: OccurrenceItem[] = [];
      const count = Math.min(Math.max(1, weeklyCount), effectiveMaxSeriesLimit);
      for (let i = 0; i < count; i++) {
        const dateStr = addDaysToDateString(date, i * 7 * weeklyInterval);
        list.push({
          id: `weekly-${i}-${dateStr}`,
          date: dateStr,
          startTime,
          duration,
        });
      }
      return list;
    }
    return customDates.slice(0, effectiveMaxSeriesLimit).map((d, index) => ({
      id: `custom-${index}-${d}`,
      date: d,
      startTime,
      duration,
    }));
  }, [
    isRecurring,
    patternType,
    date,
    startTime,
    duration,
    weeklyInterval,
    weeklyCount,
    customDates,
    effectiveMaxSeriesLimit,
  ]);

  // Recurring conflicts detection
  const seriesConflicts: SeriesConflictDetail[] = useMemo(() => {
    if (!isRecurring || generatedOccurrences.length === 0) return [];
    const list: SeriesConflictDetail[] = [];
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

    if (!isTypeRequest && selectedInstrumentId) {
      parsed.forEach((occ) => {
        for (const res of instrumentReservations) {
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
    }

    return list;
  }, [
    isRecurring,
    generatedOccurrences,
    isTypeRequest,
    selectedInstrumentId,
    instrumentReservations,
    t,
  ]);

  const hasSeriesConflicts = seriesConflicts.length > 0;

  const handleSkipConflicts = () => {
    if (seriesConflicts.length === 0) return;
    const conflictingDates = new Set(
      seriesConflicts.map((c) => c.occurrenceDate),
    );
    const validDates = generatedOccurrences
      .map((o) => o.date)
      .filter((d) => !conflictingDates.has(d));

    if (validDates.length === 0) {
      setErrorMsg(t("seriesBuilder.mustHaveOneOccurrence"));
      return;
    }

    setErrorMsg(null);
    setSkippedNotice(conflictingDates.size);
    setHasEditedCustomDates(true);
    setPatternType("custom");
    setCustomDates(validDates);
    if (validDates[0]) setDate(validDates[0]);
  };

  const todayStr = getTodayDateString();

  const selectedTypeSetting = (availableTypes || []).find(
    (t) =>
      t &&
      typeof t.type === "string" &&
      t.type.toLowerCase() === (selectedCategory || "").toLowerCase(),
  );
  const selectedTypeFee = getValidFee(selectedTypeSetting?.flat_fee_outside);

  const feeNumber = isTypeRequest
    ? selectedTypeFee
    : getValidFee(currentInstrument?.outsideFeePerDay);

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
    if (isTypeRequest && (!selectedCategory || !selectedCategory.trim())) {
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

    const token = getAuthSessionToken(sessionToken);

    if (isRecurring) {
      if (generatedOccurrences.length === 0) {
        setErrorMsg(t("seriesBuilder.errNoOccurrences"));
        return;
      }
      if (
        !isServiceInstant &&
        generatedOccurrences.length > maxSeriesLimit
      ) {
        setErrorMsg(t("seriesBuilder.reachedMax", { max: maxSeriesLimit }));
        return;
      }
      if (hasSeriesConflicts) {
        setErrorMsg(t("seriesBuilder.errResolveConflicts"));
        return;
      }

      setIsSubmitting(true);
      setErrorMsg(null);

      try {
        const payload = {
          ...buildOwnerPayload(profile, onBehalfOf),
          instrumentId: isTypeRequest ? null : selectedInstrumentId,
          isTypeRequest: Boolean(isTypeRequest),
          requestedType: isTypeRequest ? selectedCategory : null,
          serviceName: serviceName.trim(),
          serviceLocation: serviceLocation.trim() || undefined,
          musicianName: musicianName.trim(),
          note: note.trim() || undefined,
          patternType,
          reservationType,
          feeAcknowledged:
            reservationType === "outside_church" ? feeAcknowledged : false,
          occurrences: generatedOccurrences.map(
            ({ date: occDate, startTime: occStart, duration: occDur }) => ({
              date: occDate,
              startTime: occStart,
              duration: occDur,
            }),
          ),
        };

        const res = await fetch("/api/reservations/series", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify(payload),
        });

        const data = await res.json();

        if (!res.ok || !data.success) {
          setErrorMsg(data.error || t("seriesBuilder.errCreateFailed"));
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
        setErrorMsg(err.message || t("seriesBuilder.errNetwork"));
        setIsSubmitting(false);
      }
      return;
    }

    // Single reservation submission
    if (hasConflict) {
      setShowConflictPopup(true);
      return;
    }

    setIsSubmitting(true);
    setErrorMsg(null);

    try {
      const payload: any = {
        ...buildOwnerPayload(profile, onBehalfOf),
        isTypeRequest,
        requestedType: isTypeRequest ? selectedCategory : undefined,
        instrumentId: isTypeRequest ? null : selectedInstrumentId,
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
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        if (data.error && /conflict/i.test(data.error)) {
          setShowConflictPopup(true);
        }
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
      if (err.message && /conflict/i.test(err.message)) {
        setShowConflictPopup(true);
      }
      setErrorMsg(err.message || t("reservationForm.msgNetworkError"));
      setIsSubmitting(false);
    }
  };

  const isSubmitDisabled =
    isSubmitting ||
    isInstrumentsLoading ||
    !serviceName.trim() ||
    !musicianName.trim() ||
    (reservationType === "outside_church" && !feeAcknowledged) ||
    (isTypeRequest && !selectedCategory) ||
    (isRecurring && (hasSeriesConflicts || generatedOccurrences.length === 0));

  const formatShortDateWithWeekday = (dateStr: string) => {
    try {
      const d = cairoDateTimeToDate(dateStr, "12:00");
      return d.toLocaleDateString(isAr ? "ar-EG" : "en-US", {
        weekday: "short",
        month: "short",
        day: "numeric",
        year: "numeric",
        timeZone: "Africa/Cairo",
      });
    } catch {
      return dateStr;
    }
  };

  const hasResult = Boolean(submissionResult || seriesResult);

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
                {isRecurring ? (
                  <Repeat className="w-4.5 h-4.5" />
                ) : (
                  <Music2 className="w-4.5 h-4.5" />
                )}
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <h2 className="text-[13px] sm:text-sm font-bold text-white leading-tight truncate">
                    {seriesResult
                      ? t("seriesBuilder.confirmationTitle")
                      : submissionResult
                        ? t("reservationForm.confirmTitle")
                        : onBehalfOf
                          ? t("reservationForm.bookedOnBehalf", {
                              name: onBehalfOf.name,
                            })
                          : t("reservationForm.title")}
                  </h2>
                  {isInstrumentsLoading ? (
                    <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-stone-800 text-stone-300 border border-stone-700 hidden sm:inline-flex items-center gap-1">
                      <span className="w-2 h-2 border-2 border-stone-400 border-t-amber-400 rounded-full animate-spin shrink-0" />
                      <span>{t("common.loading", "Loading...")}</span>
                    </span>
                  ) : isTypeRequest ? (
                    selectedCategory ? (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-purple-900/60 text-purple-200 border border-purple-700/50 hidden sm:inline-block">
                        {t("reservationForm.categoryBookingLabel", {
                          category: selectedCategory,
                          defaultValue: `${selectedCategory} (Admin Assignment)`,
                        })}
                      </span>
                    ) : null
                  ) : currentInstrument ? (
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-900/60 text-amber-200 border border-amber-700/50 hidden sm:inline-block">
                      {getInstrumentDisplayName(currentInstrument, isAdmin)}
                    </span>
                  ) : null}
                </div>
                <p className="text-[10px] sm:text-[11px] text-stone-400 truncate mt-0.5">
                  {seriesResult
                    ? t("seriesBuilder.confirmationSubtitle")
                    : submissionResult
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
                type="button"
                onClick={onClose}
                className="w-8 h-8 sm:w-9 sm:h-9 flex items-center justify-center rounded-xl bg-stone-800/90 text-stone-300 hover:text-white hover:bg-stone-700 active:bg-stone-600 transition cursor-pointer border border-stone-700/70"
                aria-label="Close modal"
              >
                <X className="w-4 h-4 sm:w-4.5 sm:h-4.5" />
              </button>
            </div>
          </div>

          {/* ── SERIES RECEIPT VIEW ── */}
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

                      {/* Series Receipt Summary */}
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
                          {isTypeRequest ? (
                            <div className="min-w-0">
                              <span className="text-stone-500 font-medium block text-[11px]">
                                {t("reservationForm.requestedCategory", {
                                  defaultValue: "Requested Category",
                                })}
                              </span>
                              <span className="font-bold text-stone-900 text-xs block truncate">
                                {selectedCategory}
                              </span>
                              <span className="text-[10px] text-purple-700 font-semibold block truncate">
                                {t("reservations.awaitingAssignment", {
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
                                {getInstrumentDisplayName(
                                  currentInstrument,
                                  isAdmin,
                                )}
                              </span>
                              <span className="text-[10px] text-stone-500 block truncate">
                                {currentInstrument?.type || selectedCategory}
                              </span>
                            </div>
                          )}

                          <div className="min-w-0">
                            <span className="text-stone-500 font-medium block text-[11px]">
                              {t("reservationForm.typeColonLabel")}
                            </span>
                            <span className="font-bold text-stone-900 text-xs capitalize">
                              {reservationType === "in_church"
                                ? t("reservationForm.inChurchFreeLabel")
                                : t("reservationForm.outsideChurchPaidLabel")}
                            </span>
                            {reservationType === "outside_church" &&
                              feeNumber > 0 && (
                                <span className="text-[10px] text-purple-700 font-semibold block">
                                  {t("reservationForm.feePerDayLabel", {
                                    fee: feeNumber,
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
                            {serviceName ||
                              t("reservationForm.notSpecifiedLabel")}
                          </span>
                        </div>

                        {serviceLocation && (
                          <div className="pt-1.5 border-t border-stone-200">
                            <span className="text-stone-500 font-medium flex items-center gap-1 text-[11px]">
                              <Church className="w-3 h-3 text-amber-800 shrink-0" />
                              <span>
                                {t("reservationForm.serviceLocationLabel")}
                              </span>
                            </span>
                            <span className="font-bold text-stone-900 text-xs">
                              {serviceLocation}
                            </span>
                          </div>
                        )}

                        <div className="pt-1.5 border-t border-stone-200">
                          <span className="text-stone-500 font-medium block text-[11px]">
                            {t("reservationForm.musicianNameLabel")}
                          </span>
                          <span className="font-bold text-stone-900 text-xs">
                            {musicianName}
                          </span>
                        </div>

                        <div className="pt-1.5 border-t border-stone-200">
                          <span className="text-stone-500 font-medium block text-[11px]">
                            {t("seriesBuilder.patternLabel")}
                          </span>
                          <span className="font-bold text-stone-900 text-xs capitalize">
                            {seriesResult.series.patternType === "weekly"
                              ? t("seriesBuilder.weeklyCadenceTitle")
                              : t("seriesBuilder.customDatesTitle")}{" "}
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
                              {t("reservationForm.leaveANoteLabel")}
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
                              {t("seriesBuilder.perOccurrenceBreakdown")}
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
                                  {t("seriesBuilder.pendingReviewBadge")}
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
                                        {t("seriesBuilder.pendingReviewBadge")}
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
                  {t("seriesBuilder.doneReturnToCalendar")}
                </button>
              </div>
            </>
          ) : submissionResult ? (
            /* ── SINGLE RECEIPT VIEW ── */
            <>
              <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain p-3.5 sm:p-5 space-y-3 sm:space-y-3.5 bg-white">
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

                      {reservationType === "outside_church" && (
                        <div className="pt-1.5 text-[10px] sm:text-[11px] text-amber-800/90 font-medium">
                          {t("reservationForm.msgWhatsAppNotice")}
                        </div>
                      )}
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
                            selectedCategory}
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
                          {getInstrumentDisplayName(currentInstrument, isAdmin)}
                        </span>
                        <span className="text-[10px] text-stone-500 block truncate">
                          {currentInstrument?.type || selectedCategory}
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
                      <span className="text-stone-500 font-medium flex items-center gap-1 text-[11px]">
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
            /* ── UNIFIED FORM VIEW ── */
            <form
              onSubmit={handleSubmit}
              className="flex flex-col flex-1 min-h-0"
            >
              <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain p-3.5 sm:p-5 space-y-3 sm:space-y-3.5">
                {/* Section 1: Category & Instrument Selection */}
                <div className="bg-white rounded-2xl border border-stone-200 p-3 sm:p-3.5 shadow-2xs space-y-3">
                  <div className="flex items-center justify-between gap-2 border-b border-stone-100 pb-2">
                    <span className="text-[11px] sm:text-xs font-bold text-stone-800 flex items-center gap-1.5">
                      <Music2 className="w-3.5 h-3.5 text-amber-800" />
                      <span>
                        {t("reservationForm.chooseCategoryLabel", {
                          defaultValue: "Category & Instrument",
                        })}
                      </span>
                    </span>
                    <div className="inline-flex items-center gap-1.5 flex-wrap justify-end">
                      {isInstrumentsLoading ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] sm:text-[10px] font-medium text-stone-500 bg-stone-100 border border-stone-200">
                          <span className="w-2 h-2 border-2 border-stone-400 border-t-amber-800 rounded-full animate-spin shrink-0" />
                          <span>{t("common.loading", "Loading...")}</span>
                        </span>
                      ) : isTypeRequest ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] sm:text-[10px] font-extrabold uppercase tracking-wider bg-purple-100 text-purple-900 border border-purple-200">
                          <Shield className="w-2.5 h-2.5" />
                          <span>
                            {t("reservations.adminAssignment", {
                              defaultValue: "Admin Assignment",
                            })}
                          </span>
                        </span>
                      ) : (
                        <>
                          {currentInstrument?.serviceName?.trim() && (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[9px] sm:text-[10px] font-extrabold text-blue-900 bg-blue-100 border border-blue-200">
                              {currentInstrument.serviceName.trim()}
                            </span>
                          )}
                          <span
                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] sm:text-[10px] font-extrabold uppercase tracking-wider ${
                              currentInstrument?.bookingMode === "instant"
                                ? "bg-emerald-100 text-emerald-900 border border-emerald-200"
                                : "bg-amber-100 text-amber-900 border border-amber-200"
                            }`}
                          >
                            {currentInstrument?.bookingMode === "instant" ? (
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
                        </>
                      )}
                    </div>
                  </div>

                  {/* Connected Dropdowns */}
                  <div className="grid grid-cols-2 gap-2">
                    {/* Dropdown 1: Category */}
                    <div className="min-w-0">
                      <label
                        htmlFor="select-category"
                        className="block text-[11px] font-bold text-stone-700 mb-1 truncate"
                      >
                        {t("reservationForm.chooseCategoryLabel", {
                          defaultValue: "Category / Type",
                        })}
                      </label>
                      {isInstrumentsLoading ? (
                        <div className="w-full bg-stone-100/90 border border-stone-200 rounded-xl px-2.5 py-2 text-sm sm:text-[13px] font-medium text-stone-500 flex items-center gap-2 select-none h-[38px] min-w-0">
                          <span className="w-3.5 h-3.5 border-2 border-stone-300 border-t-amber-800 rounded-full animate-spin shrink-0" />
                          <span className="truncate">
                            {t("common.loadingCategories", {
                              defaultValue: "Loading categories...",
                            })}
                          </span>
                        </div>
                      ) : (
                        <div className="relative min-w-0">
                          <select
                            id="select-category"
                            value={selectedCategory}
                            onChange={(e) =>
                              handleCategoryChange(e.target.value)
                            }
                            className="w-full min-w-0 truncate appearance-none bg-stone-50 hover:bg-stone-100/80 border border-stone-200 rounded-xl px-2.5 py-2 text-sm sm:text-[13px] font-bold text-stone-900 focus:outline-none focus:ring-2 focus:ring-amber-800/40 focus:border-amber-800 transition cursor-pointer pe-8"
                          >
                            {availableCategories.map((cat) => (
                              <option key={cat} value={cat}>
                                {cat}
                              </option>
                            ))}
                          </select>
                          <div className="pointer-events-none absolute inset-y-0 end-0 flex items-center px-2 text-stone-500">
                            <ChevronRight
                              className={`w-3.5 h-3.5 ${isAr ? "-rotate-90" : "rotate-90"}`}
                            />
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Dropdown 2: Specific Instrument */}
                    <div className="min-w-0">
                      <label
                        htmlFor="select-instrument"
                        className="block text-[11px] font-bold text-stone-700 mb-1 truncate"
                      >
                        {t("reservationForm.chooseInstrumentLabel", {
                          defaultValue: "Specific Instrument",
                        })}
                      </label>
                      {isInstrumentsLoading ? (
                        <div className="w-full bg-stone-100/90 border border-stone-200 rounded-xl px-2.5 py-2 text-sm sm:text-[13px] font-medium text-stone-500 flex items-center gap-2 select-none h-[38px] min-w-0">
                          <span className="w-3.5 h-3.5 border-2 border-stone-300 border-t-amber-800 rounded-full animate-spin shrink-0" />
                          <span className="truncate">
                            {t("common.loadingInstruments", {
                              defaultValue: "Loading instruments...",
                            })}
                          </span>
                        </div>
                      ) : (
                        <div className="relative min-w-0">
                          <select
                            id="select-instrument"
                            value={selectedInstrumentId}
                            onChange={(e) =>
                              setSelectedInstrumentId(e.target.value)
                            }
                            className="w-full min-w-0 truncate appearance-none bg-stone-50 hover:bg-stone-100/80 border border-stone-200 rounded-xl px-2.5 py-2 text-sm sm:text-[13px] font-bold text-stone-900 focus:outline-none focus:ring-2 focus:ring-amber-800/40 focus:border-amber-800 transition cursor-pointer pe-8"
                          >
                            <option value="">
                              {t("reservationForm.adminAssignOption", {
                                category: selectedCategory,
                                defaultValue: `-- Any [${selectedCategory || ""}] --`,
                              })}
                            </option>
                            {categoryInstruments.map((inst) => (
                              <option key={inst.id} value={inst.id}>
                                {formatInstrumentOptionLabel(inst, {
                                  showType: false,
                                  showTag: true,
                                })}
                              </option>
                            ))}
                          </select>
                          <div className="pointer-events-none absolute inset-y-0 end-0 flex items-center px-2 text-stone-500">
                            <ChevronRight
                              className={`w-3.5 h-3.5 ${isAr ? "-rotate-90" : "rotate-90"}`}
                            />
                          </div>
                        </div>
                      )}

                      {!isInstrumentsLoading &&
                        isTypeRequest &&
                        selectedCategory && (
                          <p className="mt-1.5 text-[11px] text-purple-800 font-medium flex items-center gap-1.5 leading-snug">
                            <Sparkles className="w-3.5 h-3.5 text-purple-600 shrink-0" />
                            <span>
                              {t("reservationForm.adminAssignInlineNote", {
                                category: selectedCategory,
                                defaultValue: `Admin will assign an available ${selectedCategory} for your booking.`,
                              })}
                            </span>
                          </p>
                        )}
                    </div>
                  </div>

                  {/* Instrument Details (shown only when a specific instrument is chosen) */}
                  {!isInstrumentsLoading &&
                    !isTypeRequest &&
                    currentInstrument && (
                      <div className="flex items-center gap-2.5 p-2.5 rounded-2xl bg-stone-50 border border-stone-200">
                        <div className="w-11 h-11 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 flex items-center justify-center shrink-0 overflow-hidden shadow-2xs">
                          {currentInstrument?.photoUrl ? (
                            <img
                              src={currentInstrument.photoUrl}
                              alt={currentInstrument?.name || "Instrument"}
                              referrerPolicy="no-referrer"
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <Music2 className="w-5 h-5 text-amber-800" />
                          )}
                        </div>

                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="font-bold text-xs sm:text-[13px] text-stone-900 truncate">
                              {getInstrumentDisplayName(
                                currentInstrument,
                                isAdmin,
                              )}
                            </span>
                          </div>

                          <div className="flex items-center gap-2 mt-0.5 text-[10px] sm:text-[11px] text-stone-500">
                            <span className="font-medium">
                              {currentInstrument?.type || selectedCategory}
                            </span>
                          </div>

                          {currentInstrument?.description?.trim() && (
                            <div
                              className="mt-1 flex items-start gap-1 text-[10px] leading-snug text-stone-500"
                              title={currentInstrument.description}
                            >
                              <FileText className="w-3 h-3 mt-0.5 shrink-0 text-stone-400" />
                              <p className="line-clamp-1">
                                {currentInstrument.description.trim()}
                              </p>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                </div>

                {/* Section 2: Service & Musician */}
                <div className="bg-white rounded-2xl border border-stone-200 p-3 sm:p-3.5 shadow-2xs space-y-2.5">
                  <div className="text-[11px] sm:text-xs font-bold text-stone-800 flex items-center gap-1.5 border-b border-stone-100 pb-1.5">
                    <User className="w-3.5 h-3.5 text-amber-800" />
                    <span>
                      {t("reservationForm.serviceSectionTitle", {
                        defaultValue: isAr
                          ? "بيانات الخدمة والعازف والمكان"
                          : "Service, Musician & Location",
                      })}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1 min-w-0">
                      <label
                        htmlFor="input-service-name"
                        className="block text-[11px] sm:text-xs font-bold text-stone-700 truncate"
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
                        className="w-full min-w-0 bg-stone-50 border border-stone-300 rounded-xl px-2.5 py-1.5 text-sm sm:text-[13px] font-medium text-stone-900 placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-amber-800/40 focus:border-amber-800 transition"
                        required
                      />
                    </div>

                    <div className="space-y-1 min-w-0">
                      <label
                        htmlFor="input-musician-name"
                        className="block text-[11px] sm:text-xs font-bold text-stone-700 truncate"
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
                        className="w-full min-w-0 bg-stone-50 border border-stone-300 rounded-xl px-2.5 py-1.5 text-sm sm:text-[13px] font-medium text-stone-900 placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-amber-800/40 focus:border-amber-800 transition"
                        required
                      />
                    </div>

                    <div className="space-y-1 col-span-2 min-w-0">
                      <label
                        htmlFor="input-service-location"
                        className="block text-[11px] sm:text-xs font-bold text-stone-700 flex items-center gap-1 truncate"
                      >
                        <Church className="w-3 h-3 text-amber-800 shrink-0" />
                        <span className="truncate">{t("reservationForm.serviceLocationLabel")}</span>
                      </label>
                      <input
                        id="input-service-location"
                        type="text"
                        value={serviceLocation}
                        onChange={(e) => setServiceLocation(e.target.value)}
                        placeholder={t(
                          "reservationForm.serviceLocationPlaceholder",
                        )}
                        className="w-full min-w-0 bg-stone-50 border border-stone-300 rounded-xl px-2.5 py-1.5 text-sm sm:text-[13px] font-medium text-stone-900 placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-amber-800/40 focus:border-amber-800 transition"
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

                {/* Section 3: Date, Time & Duration (الموعد والتوقيت) */}
                <div className="bg-white rounded-2xl border border-stone-200 p-3 sm:p-3.5 shadow-2xs space-y-3">
                  <div className="flex items-center justify-between border-b border-stone-100 pb-1.5">
                    <span className="text-[11px] sm:text-xs font-bold text-stone-800 flex items-center gap-1.5">
                      <Calendar className="w-3.5 h-3.5 text-amber-800" />
                      <span>
                        {t("reservationForm.dateTimeSectionTitle", {
                          defaultValue: isAr ? "الموعد والتوقيت" : "Date & Time",
                        })}
                      </span>
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
                        {isRecurring
                          ? t("seriesBuilder.firstSessionDateLabel")
                          : t("reservationForm.dateLabel")}
                      </label>
                      <input
                        id="input-reservation-date"
                        type="date"
                        value={date}
                        min={todayStr}
                        onChange={(e) => {
                          setDate(e.target.value);
                          if (patternType !== "weekly") {
                            setPatternType("weekly");
                            setHasEditedCustomDates(false);
                            setSkippedNotice(null);
                          }
                        }}
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

                  {/* Single-Booking Conflict Warning Card */}
                  {!isRecurring && hasConflict && (
                    <div
                      id="reservation-conflict-warning-panel"
                      className="rounded-xl border border-rose-200/90 bg-rose-50/80 p-3 sm:p-3.5 space-y-2.5 animate-in fade-in"
                    >
                      <div className="flex items-start gap-2.5">
                        <div className="w-7 h-7 rounded-lg bg-rose-100 border border-rose-200/80 flex items-center justify-center text-rose-600 shrink-0 mt-0.5">
                          <AlertTriangle className="w-4 h-4 stroke-[2.2]" />
                        </div>
                        <div className="flex-1 min-w-0 space-y-1">
                          <div className="flex flex-wrap items-center gap-1.5 text-xs">
                            <span className="font-semibold text-rose-950">
                              {t("reservationForm.conflictLineWarning", {
                                defaultValue: isAr
                                  ? "الآلة محجوزة بالفعل في هذا الوقت:"
                                  : "This instrument is already booked:",
                              })}
                            </span>
                            <span className="inline-flex items-center font-mono font-bold text-rose-800 bg-white/90 border border-rose-200/90 px-2 py-0.5 rounded-md text-[11px] shadow-2xs">
                              {conflictingTimesFormatted}
                            </span>
                          </div>
                          <p className="text-[11px] sm:text-xs text-rose-800/90 leading-relaxed">
                            {t("reservationForm.conflictResolutionHint", {
                              defaultValue: isAr
                                ? "يرجى تغيير الوقت أو اختيار آلة أخرى."
                                : "Please change the time or choose another instrument.",
                            })}
                          </p>
                        </div>
                      </div>

                      <div className="pt-2 border-t border-rose-200/60 flex items-center justify-end">
                        <button
                          type="button"
                          onClick={() => setSelectedInstrumentId("")}
                          className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 px-3 py-1.5 bg-white hover:bg-rose-100/70 active:bg-rose-200/50 border border-rose-300 text-rose-900 font-semibold text-xs rounded-lg shadow-2xs transition cursor-pointer touch-manipulation"
                        >
                          <Sparkles className="w-3.5 h-3.5 text-rose-600 shrink-0" />
                          <span>
                            {t("reservationForm.conflictLetAdminAssign", {
                              category: selectedCategory,
                              defaultValue: isAr
                                ? `طلب تخصيص تلقائي (أي ${selectedCategory})`
                                : `Or let admin assign (Any ${selectedCategory})`,
                            })}
                          </span>
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                {/* Section 4: Inline Repeat / Recurring Option (Right after الموعد والتوقيت) */}
                <div
                  className={`rounded-2xl p-3 sm:p-3.5 shadow-2xs transition border space-y-3 ${
                    isRecurring
                      ? "bg-white border-amber-800/50 ring-2 ring-amber-800/15"
                      : "bg-white border-stone-200 hover:border-stone-300"
                  }`}
                >
                  {/* Clickable Toggle Button / Check Row */}
                  <button
                    type="button"
                    id="toggle-recurring-series"
                    role="switch"
                    aria-checked={isRecurring}
                    onClick={() => {
                      setIsRecurring((prev) => !prev);
                      setPatternType("weekly");
                      setHasEditedCustomDates(false);
                      setSkippedNotice(null);
                    }}
                    className="w-full flex items-center justify-between gap-3 text-start cursor-pointer touch-manipulation"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div
                        className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 shadow-2xs transition ${
                          isRecurring
                            ? "bg-amber-800 text-white"
                            : "bg-amber-50 text-amber-800 border border-amber-200"
                        }`}
                      >
                        <Repeat className="w-4 h-4" />
                      </div>
                      <div className="min-w-0">
                        <span className="text-[11px] sm:text-xs font-extrabold text-stone-900 block">
                          {t("reservationForm.recurringToggleLabel", {
                            defaultValue: isAr
                              ? "هل تريد تكرار الحجز؟"
                              : "Want to repeat this reservation?",
                          })}
                        </span>
                        <span className="text-[10px] sm:text-[11px] text-stone-500 block">
                          {t("reservationForm.recurringToggleSubtitle", {
                            defaultValue: isAr
                              ? "تكرار أسبوعي في نفس اليوم والوقت"
                              : "Repeat weekly on the same day and time",
                          })}
                        </span>
                      </div>
                    </div>

                    <div
                      className={`relative w-11 h-6 rounded-full transition-colors shrink-0 ${
                        isRecurring ? "bg-amber-800" : "bg-stone-300"
                      }`}
                    >
                      <span
                        className={`absolute top-[2px] w-5 h-5 bg-white rounded-full shadow-xs transition-transform ${
                          isAr
                            ? isRecurring
                              ? "left-[2px]"
                              : "left-[22px]"
                            : isRecurring
                              ? "left-[22px]"
                              : "left-[2px]"
                        }`}
                      />
                    </div>
                  </button>

                  {/* Expanded Recurrence Options */}
                  {isRecurring && (
                    <div className="pt-3 border-t border-stone-200 space-y-3 animate-in fade-in slide-in-from-top-1 duration-150">
                      {/* Weekly Cadence Header & Occurrence Counter */}
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-bold text-stone-700 flex items-center gap-1.5">
                          <Repeat className="w-3.5 h-3.5 text-amber-800 shrink-0" />
                          <span>{t("seriesBuilder.weeklyCadenceTitle")}</span>
                        </span>
                        <span className="text-[10px] font-semibold text-stone-500 flex items-center gap-1">
                          <Layers className="w-3 h-3 text-amber-800" />
                          {isServiceInstant
                            ? t("seriesBuilder.occurrenceCountNoCap", {
                                count: generatedOccurrences.length,
                                defaultValue: `${generatedOccurrences.length} Occurrences`,
                              })
                            : t("seriesBuilder.occurrenceCounter", {
                                count: generatedOccurrences.length,
                                max: maxSeriesLimit,
                              })}
                        </span>
                      </div>

                      {/* Weekly Configuration */}
                      <div className="bg-stone-50/80 rounded-xl border border-stone-200/80 p-2.5 sm:p-3 space-y-2.5">
                        <div className="grid grid-cols-2 gap-2">
                          <div className="space-y-1 min-w-0">
                            <label className="block text-[11px] font-bold text-stone-700 truncate">
                              {t("seriesBuilder.repeatCadenceLabel")}
                            </label>
                            <div className="relative min-w-0">
                              <select
                                id="select-weekly-interval"
                                value={weeklyInterval}
                                onChange={(e) => {
                                  setWeeklyInterval(Number(e.target.value));
                                  if (patternType !== "weekly") {
                                    setPatternType("weekly");
                                    setHasEditedCustomDates(false);
                                    setSkippedNotice(null);
                                  }
                                }}
                                className="w-full min-w-0 truncate appearance-none bg-white border border-stone-300 rounded-xl px-2.5 py-1.5 text-sm sm:text-[13px] font-medium text-stone-900 focus:outline-none focus:ring-2 focus:ring-amber-800/40 focus:border-amber-800 transition pe-8 cursor-pointer"
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
                              <div className="pointer-events-none absolute inset-y-0 end-0 flex items-center px-2 text-stone-500">
                                <ChevronRight
                                  className={`w-3 h-3 ${isAr ? "-rotate-90" : "rotate-90"}`}
                                />
                              </div>
                            </div>
                          </div>

                          <div className="space-y-1 min-w-0">
                            <label className="block text-[11px] font-bold text-stone-700 truncate">
                              {isServiceInstant
                                ? t("seriesBuilder.totalOccurrencesNoCap", {
                                    defaultValue: "Total Occurrences",
                                  })
                                : t("seriesBuilder.totalOccurrences", {
                                    max: maxSeriesLimit,
                                  })}
                            </label>
                            <div className="flex items-center gap-1.5 min-w-0">
                              <input
                                id="input-weekly-count"
                                type="number"
                                inputMode="numeric"
                                min={1}
                                max={effectiveMaxSeriesLimit}
                                value={weeklyCount}
                                onChange={(e) => {
                                  const raw = Number(e.target.value);
                                  if (!Number.isFinite(raw)) return;
                                  const val = Math.min(
                                    Math.max(1, raw),
                                    effectiveMaxSeriesLimit,
                                  );
                                  setWeeklyCount(val);
                                  if (patternType !== "weekly") {
                                    setPatternType("weekly");
                                    setHasEditedCustomDates(false);
                                    setSkippedNotice(null);
                                  }
                                }}
                                className="flex-1 min-w-0 bg-white border border-stone-300 rounded-xl px-2.5 py-1.5 text-sm sm:text-[13px] font-medium text-stone-900 focus:outline-none focus:ring-2 focus:ring-amber-800/40 focus:border-amber-800 transition"
                              />
                              <span className="text-[11px] text-stone-500 font-medium shrink-0">
                                {t("seriesBuilder.sessionsUnit")}
                              </span>
                            </div>
                          </div>
                        </div>

                        {!isServiceInstant && weeklyCount >= maxSeriesLimit && (
                          <div className="text-[10px] text-amber-900 bg-amber-50 px-2.5 py-1 rounded-xl flex items-center gap-1.5 font-medium border border-amber-200">
                            <Info className="w-3 h-3 shrink-0" />
                            <span>
                              {t("seriesBuilder.reachedMax", {
                                max: maxSeriesLimit,
                              })}
                            </span>
                          </div>
                        )}
                      </div>

                      {/* Calculated Occurrence Schedule Preview */}
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between gap-2 flex-wrap">
                          <span className="text-[11px] font-bold text-stone-700 flex items-center gap-1.5">
                            <CalendarDays className="w-3.5 h-3.5 text-amber-800" />
                            <span>
                              {t("seriesBuilder.calculatedScheduleTitle")}
                            </span>
                          </span>
                          {!hasSeriesConflicts && (
                            <span className="text-[10px] text-stone-500 flex items-center gap-1">
                              <Info className="w-3 h-3 shrink-0" />
                              <span>
                                {t("seriesBuilder.allSessionsLabel", {
                                  start: formatHhmmTo12Hour(startTime),
                                  end: formatHhmmTo12Hour(endTimeStr),
                                  duration,
                                })}
                              </span>
                            </span>
                          )}
                        </div>

                        <div className="border border-stone-200 rounded-xl overflow-hidden divide-y divide-stone-100 max-h-36 overflow-y-auto overscroll-contain bg-stone-50/70">
                          {generatedOccurrences.map((occ, idx) => {
                            const hasOccConflict = seriesConflicts.some(
                              (c) => c.occurrenceIndex === idx + 1,
                            );
                            return (
                              <div
                                key={occ.id}
                                className={`px-2.5 py-1.5 flex items-center justify-between text-[11px] gap-2 ${
                                  hasOccConflict ? "bg-rose-50/80" : ""
                                }`}
                              >
                                <div className="flex items-center gap-2 min-w-0">
                                  <span
                                    className={`w-5 h-5 rounded-md font-bold flex items-center justify-center text-[9px] shrink-0 border ${
                                      hasOccConflict
                                        ? "bg-rose-100 border-rose-300 text-rose-800"
                                        : "bg-white border-stone-200 text-stone-600"
                                    }`}
                                  >
                                    {idx + 1}
                                  </span>
                                  <span
                                    className={`font-semibold truncate ${
                                      hasOccConflict
                                        ? "text-rose-900"
                                        : "text-stone-900"
                                    }`}
                                  >
                                    {formatShortDateWithWeekday(occ.date)}
                                  </span>
                                </div>
                                <span className="text-stone-500 text-[10px] whitespace-nowrap shrink-0">
                                  {formatHhmmTo12Hour(occ.startTime)} –{" "}
                                  {formatHhmmTo12Hour(
                                    calculateEndTime(
                                      occ.startTime,
                                      occ.duration,
                                    ),
                                  )}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      </div>

                      {/* Recurring Conflicts Warning Panel */}
                      {hasSeriesConflicts && (
                        <div
                          id="series-conflict-warning-panel"
                          className="bg-red-50 border border-red-200 rounded-xl p-3 space-y-2.5 animate-in fade-in shadow-2xs"
                        >
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-red-950 font-bold text-[11px] sm:text-xs">
                            <div className="flex items-center gap-2">
                              <AlertTriangle className="w-3.5 h-3.5 text-red-600 shrink-0" />
                              <span>
                                {t("seriesBuilder.conflictsDetectedTitle", {
                                  count: seriesConflicts.length,
                                })}
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
                          <div className="space-y-1 pt-0.5">
                            {seriesConflicts.map((conf, i) => (
                              <div
                                key={i}
                                className="bg-white/80 border border-red-200 rounded-lg p-1.5 text-[11px] text-red-900 flex items-start gap-2"
                              >
                                <span className="w-1.5 h-1.5 rounded-full bg-red-600 mt-1.5 shrink-0" />
                                <span className="leading-snug">
                                  {conf.message}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {skippedNotice !== null && !hasSeriesConflicts && (
                        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-2.5 flex items-center justify-between gap-2 text-[11px] text-emerald-900 font-medium animate-in fade-in shadow-2xs">
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
                    </div>
                  )}
                </div>

                {/* Section 5: Usage Type */}
                <ReservationUsageTypeSelector
                  reservationType={reservationType}
                  onReservationTypeChange={setReservationType}
                  feeAcknowledged={feeAcknowledged}
                  onFeeAcknowledgedChange={setFeeAcknowledged}
                  feePerDay={feeNumber}
                  isServiceInstant={isServiceInstant}
                />
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
                      : "bg-amber-800 hover:bg-amber-900 active:scale-[0.99]"
                  }`}
                >
                  {isSubmitting ? (
                    <>
                      <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      <span>
                        {isRecurring
                          ? t("seriesBuilder.creatingSessions", {
                              count: generatedOccurrences.length,
                            })
                          : t("reservationForm.processingSubmission")}
                      </span>
                    </>
                  ) : isRecurring ? (
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

      {errorMsg && !hasResult && (
        <div
          id="reservation-form-error-alert"
          role="alert"
          aria-live="assertive"
          dir={isAr ? "rtl" : "ltr"}
          className={`fixed inset-x-3 top-4 z-[220] sm:max-w-md animate-in fade-in slide-in-from-top-2 duration-200 ${
            isAr ? "sm:left-5 sm:right-auto" : "sm:right-5 sm:left-auto"
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

      {/* Schedule Conflict Popup Dialog - Single Booking */}
      {showConflictPopup && (
        <div
          id="reservation-conflict-popup-backdrop"
          className="fixed inset-0 z-[200] bg-stone-900/50 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150"
          onClick={() => setShowConflictPopup(false)}
        >
          <div
            id="reservation-conflict-popup"
            role="dialog"
            aria-modal="true"
            className="bg-white rounded-2xl border border-stone-200/90 shadow-xl max-w-sm w-full p-5 space-y-4 text-stone-800 animate-in zoom-in-95 duration-150"
            dir={isAr ? "rtl" : "ltr"}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-xl bg-rose-50 border border-rose-200/80 flex items-center justify-center text-rose-600 shrink-0">
                <AlertTriangle className="w-4 h-4 stroke-[2.2]" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-bold text-sm sm:text-base text-stone-900 leading-tight">
                  {isAr ? "تعارض في الموعد" : "Schedule Conflict"}
                </h3>
                <p className="text-xs sm:text-[13px] text-stone-600 mt-1 leading-relaxed">
                  {t("reservationForm.conflictPopupText", {
                    defaultValue: isAr
                      ? "هذه الآلة محجوزة بالفعل خلال هذا الوقت. يرجى تغيير الوقت أو اختيار آلة أخرى."
                      : "This instrument is already booked during this time. Please change the time or choose another instrument.",
                  })}
                </p>
              </div>
            </div>

            {conflictingTimesFormatted && (
              <div className="bg-stone-50 border border-stone-200 rounded-xl px-3 py-2 text-xs flex items-center justify-between gap-2">
                <span className="text-stone-500 font-medium">
                  {t("reservationForm.conflictingTimesLabel", {
                    defaultValue: isAr ? "الوقت المحجوز:" : "Booked time:",
                  })}
                </span>
                <span className="font-mono font-bold text-rose-700 bg-rose-50 px-2 py-0.5 rounded border border-rose-200/60">
                  {conflictingTimesFormatted}
                </span>
              </div>
            )}

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-stone-100">
              <button
                type="button"
                onClick={() => {
                  setSelectedInstrumentId("");
                  setShowConflictPopup(false);
                }}
                className="flex-1 py-2 px-3 rounded-xl border border-stone-200 hover:bg-stone-50 active:bg-stone-100 text-stone-700 font-semibold text-xs transition cursor-pointer text-center inline-flex items-center justify-center gap-1.5"
              >
                <Sparkles className="w-3.5 h-3.5 text-amber-600" />
                <span>
                  {isAr
                    ? `تخصيص تلقائي (${selectedCategory || "النوع"})`
                    : `Auto-assign (${selectedCategory || "Any"})`}
                </span>
              </button>
              <button
                type="button"
                id="btn-close-conflict-popup"
                onClick={() => setShowConflictPopup(false)}
                className="flex-1 py-2 px-3 rounded-xl bg-amber-800 hover:bg-amber-900 active:bg-amber-950 text-white font-semibold text-xs transition cursor-pointer shadow-xs text-center"
              >
                {t("reservationForm.conflictAdjustTime", {
                  defaultValue: isAr ? "تعديل الموعد" : "Adjust Time",
                })}
              </button>
            </div>
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
