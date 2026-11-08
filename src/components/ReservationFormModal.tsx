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
  getInstrumentDisplayName,
  formatInstrumentOptionLabel,
} from "../lib/instrument-display";
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
  Sparkles,
} from "lucide-react";
import {
  INSTRUMENT_CATEGORIES,
  DEFAULT_INSTRUMENT_TYPE,
} from "../constants/instruments";

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

  const [isLoadingInstruments, setIsLoadingInstruments] = useState<boolean>(() => {
    const hasInstruments =
      (Array.isArray(allInstruments) && allInstruments.length > 0) ||
      Boolean(
        initialInstrument &&
          typeof initialInstrument === "object" &&
          initialInstrument.id &&
          initialInstrument.id !== "default-piano",
      );
    return !hasInstruments;
  });

  // Sync instrumentsList when allInstruments prop updates
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

  // Fetch from /api/instruments if instrumentsList is empty
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
          Boolean(inst && typeof inst === "object" && inst.id && inst.id !== "default-piano"),
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

  // Categories derived exclusively from instruments visible to the current user
  const availableCategories = useMemo(() => {
    const set = new Set<string>();
    safeAllInstruments.forEach((i) => {
      if (i && typeof i.type === "string" && i.type.trim()) {
        set.add(i.type.trim());
      }
    });
    const list = Array.from(set).filter(Boolean);
    // Sort with Piano first if present, then alphabetically
    return list.sort((a, b) => {
      if (a.toLowerCase() === "piano") return -1;
      if (b.toLowerCase() === "piano") return 1;
      return a.localeCompare(b);
    });
  }, [safeAllInstruments]);

  const isInstrumentsLoading =
    isLoadingInstruments ||
    (safeAllInstruments.length === 0 && availableCategories.length === 0);

  // Category state (only pre-filled if initial requested type or valid initial instrument type is passed; otherwise empty until categories load)
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

  // Ensure selectedCategory is automatically selected when categories become available
  useEffect(() => {
    if (availableCategories.length === 0) return;
    if (
      !selectedCategory ||
      !availableCategories.includes(selectedCategory)
    ) {
      const piano = availableCategories.find(
        (c) => c.toLowerCase() === "piano",
      );
      setSelectedCategory(piano || availableCategories[0]);
    }
  }, [availableCategories, selectedCategory]);

  // Available categories & type settings from server
  const [availableTypes, setAvailableTypes] = useState<
    Array<{
      type: string;
      can_be_requested: boolean;
      flat_fee_outside: string;
      active_instruments_count: number;
    }>
  >([]);
  const [isLoadingTypes, setIsLoadingTypes] = useState<boolean>(false);

  useEffect(() => {
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
        }
      })
      .catch(console.error)
      .finally(() => setIsLoadingTypes(false));
  }, []);

  // Instrument dropdown selection:
  // Defaults to "" (-- Any [Category] --) so that admin assigns by default
  const [selectedInstrumentId, setSelectedInstrumentId] = useState<string>("");

  // If selectedInstrumentId is empty or whitespace, this reservation is submitted as a category request for admin assignment
  const isTypeRequest =
    !selectedInstrumentId || selectedInstrumentId.trim() === "";
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
  const [showConflictPopup, setShowConflictPopup] = useState<boolean>(false);

  // Status & Submission States
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Availability & conflict checking for selected date
  const [dateReservations, setDateReservations] = useState<any[]>([]);
  const [isLoadingDateReservations, setIsLoadingDateReservations] =
    useState<boolean>(false);

  useEffect(() => {
    if (!date) return;
    let isCancelled = false;
    setIsLoadingDateReservations(true);

    const token =
      sessionToken || localStorage.getItem("church_session_token_v1");
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
      })
      .finally(() => {
        if (!isCancelled) {
          setIsLoadingDateReservations(false);
        }
      });

    return () => {
      isCancelled = true;
    };
  }, [date, sessionToken]);

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

  // Instruments in currently selected category
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

  const handleCategoryChange = (newCategory: string) => {
    setSelectedCategory(newCategory);
    // When changing category, default the specific instrument to -- Any [Category] --
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
    if (
      isTypeRequest &&
      (!selectedCategory || !selectedCategory.trim())
    ) {
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

    // Intercept if there is an active conflict
    if (hasConflict) {
      setShowConflictPopup(true);
      return;
    }

    if (isRecurring && onOpenSeriesBuilder) {
      const seriesInst = currentInstrument || safeAllInstruments[0];
      if (!seriesInst) return;
      onOpenSeriesBuilder({
        instrument: seriesInst,
        serviceName: serviceName.trim(),
        musicianName: musicianName.trim(),
        date,
        startTime,
        duration,
        reservationType,
        note: note.trim() || undefined,
        isTypeRequest,
        requestedType: selectedCategory,
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
          Authorization: `Bearer ${sessionToken}`,
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
    (isTypeRequest && !selectedCategory);

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
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    {/* Dropdown 1: Category */}
                    <div>
                      <label
                        htmlFor="select-category"
                        className="block text-[11px] font-bold text-stone-700 mb-1"
                      >
                        {t("reservationForm.chooseCategoryLabel", {
                          defaultValue: "Category / Type",
                        })}
                      </label>
                      {isInstrumentsLoading ? (
                        <div className="w-full bg-stone-100/90 border border-stone-200 rounded-xl px-2.5 py-2 text-xs sm:text-[13px] font-medium text-stone-500 flex items-center gap-2 select-none h-[38px]">
                          <span className="w-3.5 h-3.5 border-2 border-stone-300 border-t-amber-800 rounded-full animate-spin shrink-0" />
                          <span className="truncate">
                            {t("common.loadingCategories", {
                              defaultValue: "Loading categories...",
                            })}
                          </span>
                        </div>
                      ) : (
                        <div className="relative">
                          <select
                            id="select-category"
                            value={selectedCategory}
                            onChange={(e) => handleCategoryChange(e.target.value)}
                            className="w-full appearance-none bg-stone-50 hover:bg-stone-100/80 border border-stone-200 rounded-xl px-2.5 py-2 text-xs sm:text-[13px] font-bold text-stone-900 focus:outline-none focus:ring-2 focus:ring-amber-800/40 focus:border-amber-800 transition cursor-pointer pr-8"
                          >
                            {availableCategories.map((cat) => (
                              <option key={cat} value={cat}>
                                {cat}
                              </option>
                            ))}
                          </select>
                          <div
                            className={`pointer-events-none absolute inset-y-0 flex items-center px-2 text-stone-500 ${
                              isAr ? "left-0" : "right-0"
                            }`}
                          >
                            <ChevronRight
                              className={`w-3.5 h-3.5 ${isAr ? "-rotate-90" : "rotate-90"}`}
                            />
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Dropdown 2: Specific Instrument */}
                    <div>
                      <label
                        htmlFor="select-instrument"
                        className="block text-[11px] font-bold text-stone-700 mb-1"
                      >
                        {t("reservationForm.chooseInstrumentLabel", {
                          defaultValue: "Specific Instrument",
                        })}
                      </label>
                      {isInstrumentsLoading ? (
                        <div className="w-full bg-stone-100/90 border border-stone-200 rounded-xl px-2.5 py-2 text-xs sm:text-[13px] font-medium text-stone-500 flex items-center gap-2 select-none h-[38px]">
                          <span className="w-3.5 h-3.5 border-2 border-stone-300 border-t-amber-800 rounded-full animate-spin shrink-0" />
                          <span className="truncate">
                            {t("common.loadingInstruments", {
                              defaultValue: "Loading instruments...",
                            })}
                          </span>
                        </div>
                      ) : (
                        <div className="relative">
                          <select
                            id="select-instrument"
                            value={selectedInstrumentId}
                            onChange={(e) => setSelectedInstrumentId(e.target.value)}
                            className="w-full appearance-none bg-stone-50 hover:bg-stone-100/80 border border-stone-200 rounded-xl px-2.5 py-2 text-xs sm:text-[13px] font-bold text-stone-900 focus:outline-none focus:ring-2 focus:ring-amber-800/40 focus:border-amber-800 transition cursor-pointer pr-8"
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
                          <div
                            className={`pointer-events-none absolute inset-y-0 flex items-center px-2 text-stone-500 ${
                              isAr ? "left-0" : "right-0"
                            }`}
                          >
                            <ChevronRight
                              className={`w-3.5 h-3.5 ${isAr ? "-rotate-90" : "rotate-90"}`}
                            />
                          </div>
                        </div>
                      )}

                      {/* Simple, quick inline note if left as Any [Category] */}
                      {!isInstrumentsLoading && isTypeRequest && selectedCategory && (
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

                  {/* Instrument Details (shown only when a specific instrument is chosen and loaded) */}
                  {!isInstrumentsLoading && !isTypeRequest && currentInstrument && (
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
                            {getInstrumentDisplayName(currentInstrument, isAdmin)}
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

                  {/* Reused Conflict Warning Panel from SeriesBuilderModal (adapted for single reservation) */}
                  {hasConflict && (
                    <div
                      id="reservation-conflict-warning-panel"
                      className="bg-red-50 border border-red-200 rounded-2xl p-3 space-y-2.5 animate-in fade-in shadow-2xs"
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-red-950 font-bold text-[11px] sm:text-xs">
                        <div className="flex items-center gap-2">
                          <AlertTriangle className="w-3.5 h-3.5 text-red-600 shrink-0" />
                          <span>
                            {t("seriesBuilder.conflictsDetectedTitle", {
                              count: conflictingReservations.length,
                              defaultValue: `Conflicts Detected (${conflictingReservations.length} issue)`,
                            })}{" "}
                            {t("seriesBuilder.submissionDisabledSuffix", {
                              defaultValue: "— Submission Disabled",
                            })}
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => setSelectedInstrumentId("")}
                          className="inline-flex items-center justify-center gap-1.5 px-2.5 py-1 bg-red-600 hover:bg-red-700 active:bg-red-800 text-white font-bold text-[11px] rounded-lg shadow-xs transition cursor-pointer self-start sm:self-auto touch-manipulation"
                          title={
                            isAr
                              ? `طلب تخصيص من الإدارة (أي ${selectedCategory})`
                              : `Assign any available ${selectedCategory}`
                          }
                        >
                          <Sparkles className="w-3 h-3" />
                          <span>
                            {isAr
                              ? `طلب تخصيص من الإدارة (أي ${selectedCategory})`
                              : `Let Admin Assign (Any ${selectedCategory})`}
                          </span>
                        </button>
                      </div>
                      <div className="space-y-1 pt-1">
                        {conflictingReservations.map((conf, i) => {
                          const resStartHhmm = conf.startHhmm || conf.start_hhmm;
                          const resEndHhmm = conf.endHhmm || conf.end_hhmm;
                          return (
                            <div
                              key={i}
                              className="bg-white/80 border border-red-200 rounded-lg p-1.5 text-[11px] text-red-900 flex items-start gap-2"
                            >
                              <span className="w-1.5 h-1.5 rounded-full bg-red-600 mt-1.5 shrink-0" />
                              <span className="leading-snug">
                                {isAr ? (
                                  <>
                                    الحجز في {date} ({formatHhmmTo12Hour(startTime)} ← {formatHhmmTo12Hour(endTimeStr)}) يتعارض مع حجز موجود ({formatHhmmTo12Hour(resStartHhmm)} ← {formatHhmmTo12Hour(resEndHhmm)}).
                                  </>
                                ) : (
                                  <>
                                    Reservation on {date} ({formatHhmmTo12Hour(startTime)} → {formatHhmmTo12Hour(endTimeStr)}) conflicts with existing reservation ({formatHhmmTo12Hour(resStartHhmm)} → {formatHhmmTo12Hour(resEndHhmm)}).
                                  </>
                                )}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
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

      {/* Schedule Conflict Popup Dialog */}
      {showConflictPopup && (
        <div
          id="reservation-conflict-popup-backdrop"
          className="fixed inset-0 z-[200] bg-stone-900/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150"
          onClick={() => setShowConflictPopup(false)}
        >
          <div
            id="reservation-conflict-popup"
            role="dialog"
            aria-modal="true"
            className="bg-white rounded-3xl border border-rose-200 shadow-2xl max-w-sm w-full p-4 sm:p-5 space-y-4 text-stone-800 animate-in zoom-in-95 duration-150"
            dir={isAr ? "rtl" : "ltr"}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-2xl bg-rose-100 border border-rose-200 flex items-center justify-center text-rose-600 shrink-0 shadow-xs">
                <AlertTriangle className="w-5 h-5 stroke-[2.5]" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-bold text-sm sm:text-base text-stone-900">
                  {isAr ? "تعارض في المواعيد" : "Schedule Conflict"}
                </h3>
                <p className="text-xs sm:text-[13px] text-stone-700 mt-1.5 leading-relaxed font-medium">
                  {t("reservationForm.conflictPopupText", {
                    defaultValue: isAr
                      ? "يوجد تعارض، يرجى اختيار آلة أخرى أو تغيير الوقت لتجنب التعارض."
                      : "There is a conflict, please choose another instrument or change time to avoid conflicting.",
                  })}
                </p>
              </div>
            </div>

            {conflictingTimesFormatted && (
              <div className="bg-rose-50 border border-rose-200 rounded-xl p-2.5 text-xs text-rose-900">
                <span className="font-bold block text-[11px] text-rose-800 mb-0.5">
                  {t("reservationForm.conflictingTimesLabel", {
                    defaultValue: isAr ? "الأوقات المتعارضة:" : "Conflicting times:",
                  })}
                </span>
                <span className="font-mono font-bold text-rose-950">
                  {conflictingTimesFormatted}
                </span>
              </div>
            )}

            <div className="flex items-center justify-end gap-2 pt-1 border-t border-stone-100">
              <button
                type="button"
                id="btn-close-conflict-popup"
                onClick={() => setShowConflictPopup(false)}
                className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-amber-800 hover:bg-amber-900 active:scale-95 text-white font-bold text-xs sm:text-[13px] transition cursor-pointer shadow-sm"
              >
                {isAr ? "حسناً، فهمت" : "OK, I understand"}
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
