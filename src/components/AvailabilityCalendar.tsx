import React, { useState, useEffect, useMemo, useRef } from "react";
import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  Clock,
  Sparkles,
  ShieldCheck,
  Zap,
  Info,
  DollarSign,
  Music2,
  CalendarDays,
  Plus,
  RefreshCw,
  SlidersHorizontal,
} from "lucide-react";
import { useAuth } from "../contexts/AuthContext.tsx";
import { useTranslation } from "react-i18next";
import { getReservantColorTheme } from "../lib/reservant-colors";
import {
  formatHhmmTo12Hour,
  getLocalDateString,
  getTodayDateString,
  addDaysToDateString,
  parseLocalDate,
  formatDisplayDate,
  getCairoDateString,
  getCairoTimeString,
} from "../lib/date-utils";

export interface Instrument {
  id: string;
  name: string;
  type: string;
  photoUrl: string | null;
  description: string | null;
  outsideFeePerDay: string;
  bookingMode: "manual" | "instant";
  isRemoved: boolean;
  createdAt: string;
}

export interface ReservedSlot {
  id: string;
  instrumentId: string;
  status: string;
  reservationType: string;
  userId?: string;
  userName?: string;
  serviceName?: string;
  startTime: string;
  endTime: string;
  startHhmm: string;
  endHhmm: string;
}

interface AvailabilityCalendarProps {
  onSelectSlot: (
    instrument: Instrument,
    date: string,
    timeHhmm: string,
    durationHours: number,
  ) => void;
  onSelectInstrument: (instrument: Instrument) => void;
  refreshTrigger?: number;
  onLoadedInstruments?: (instruments: Instrument[]) => void;
}

// Generate 30-minute intervals from 09:00 to 22:00 (26 slots)
const TIME_SLOTS: string[] = [];
for (let hour = 9; hour <= 21; hour++) {
  const hStr = hour < 10 ? `0${hour}` : `${hour}`;
  TIME_SLOTS.push(`${hStr}:00`);
  TIME_SLOTS.push(`${hStr}:30`);
}
TIME_SLOTS.push("22:00");

const MANUAL_TYPE_ORDER: string[] = ["Piano", "Drums", "Percussion", "Violin"];
const MANUAL_INSTRUMENT_ORDER_BY_TYPE: Record<string, string[]> = {
  Piano: [
    "Yamaha E-443",
    "Roland E-09",
    "Korg Pa-50",
    "Roland E-A7",
    "Roland GW-8",
  ],
  Drums: ["Tama Swing Star", "Tama Silver Star", "Tama Star Classic"],
  Percussion: ["Conga", "Bongos"],
  Violin: ["Violin 3/4"],
};

const normalizeCategoryName = (value: string): string => value.trim();

const getTypeOrderIndex = (type: string): number => {
  const normalizedType = normalizeCategoryName(type);
  const index = MANUAL_TYPE_ORDER.findIndex(
    (item) => item.toLowerCase() === normalizedType.toLowerCase(),
  );
  return index >= 0 ? index : MANUAL_TYPE_ORDER.length + 1;
};

const getInstrumentOrderIndex = (
  type: string,
  instrumentName: string,
): number => {
  const normalizedType = normalizeCategoryName(type);
  const perTypeOrder =
    MANUAL_INSTRUMENT_ORDER_BY_TYPE[normalizedType] ||
    MANUAL_INSTRUMENT_ORDER_BY_TYPE[normalizedType.toLowerCase()];
  const matchingOrder = perTypeOrder ?? [];
  const nameIndex = matchingOrder.findIndex(
    (item) => item.toLowerCase() === instrumentName.trim().toLowerCase(),
  );
  return nameIndex >= 0 ? nameIndex : matchingOrder.length;
};

const sortInstrumentsByManualOrder = (items: Instrument[]): Instrument[] => {
  return [...items].sort((a, b) => {
    const typeCompare = getTypeOrderIndex(a.type) - getTypeOrderIndex(b.type);
    if (typeCompare !== 0) return typeCompare;

    const instrumentCompare =
      getInstrumentOrderIndex(a.type, a.name) -
      getInstrumentOrderIndex(b.type, b.name);
    if (instrumentCompare !== 0) return instrumentCompare;

    return a.name.localeCompare(b.name, undefined, { sensitivity: "base" });
  });
};

export const AvailabilityCalendar: React.FC<AvailabilityCalendarProps> = ({
  onSelectSlot,
  onSelectInstrument,
  refreshTrigger,
  onLoadedInstruments,
}) => {
  const { profile, sessionToken } = useAuth();
  const { t, i18n } = useTranslation();
  const isAr = i18n.language === "ar";
  const isAdminOrSuperAdmin =
    profile?.role === "admin" ||
    profile?.role === "super_admin" ||
    Boolean(profile?.isSuperAdmin);

  const [selectedDate, setSelectedDate] = useState<string>(() => {
    return getTodayDateString();
  });
  const [instruments, setInstruments] = useState<Instrument[]>([]);
  const [reservations, setReservations] = useState<ReservedSlot[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [checkedTypes, setCheckedTypes] = useState<string[]>([]);
  const [checkedInstrumentIds, setCheckedInstrumentIds] = useState<Set<string>>(
    new Set(),
  );
  const [isFilterPanelOpen, setIsFilterPanelOpen] = useState(false);
  const filtersInitialized = useRef(false);
  const [modeNotice, setModeNotice] = useState<string | null>(null);
  const [updatingModeId, setUpdatingModeId] = useState<string | null>(null);
  const [showHelperText, setShowHelperText] = useState(false);
  const [currentTime, setCurrentTime] = useState(() => new Date());
  const dateStripRef = useRef<HTMLDivElement>(null);
  const filterPanelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const timer = window.setInterval(() => setCurrentTime(new Date()), 60_000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (filtersInitialized.current || instruments.length === 0) return;

    const defaultCheckedTypes = ["Piano", "Drums"];
    const defaultTypes = Array.from(new Set(instruments.map((i) => i.type)))
      .sort((a, b) => getTypeOrderIndex(a) - getTypeOrderIndex(b))
      .filter((type) =>
        MANUAL_TYPE_ORDER.some(
          (manualType) => manualType.toLowerCase() === type.toLowerCase(),
        ),
      )
      .filter((type) =>
        defaultCheckedTypes.some(
          (dt) => dt.toLowerCase() === type.toLowerCase(),
        ),
      );

    const defaultIds = new Set(
      instruments
        .filter((i) =>
          defaultTypes.some(
            (type) => type.toLowerCase() === i.type.toLowerCase(),
          ),
        )
        .map((i) => i.id),
    );

    setCheckedTypes(defaultTypes);
    setCheckedInstrumentIds(defaultIds);
    filtersInitialized.current = true;
  }, [instruments]);

  useEffect(() => {
    if (!isFilterPanelOpen) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (
        filterPanelRef.current &&
        !filterPanelRef.current.contains(e.target as Node)
      ) {
        setIsFilterPanelOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isFilterPanelOpen]);

  const handleToggleType = (type: string) => {
    const isChecked = checkedTypes.includes(type);
    if (isChecked) {
      setCheckedTypes((prev) => prev.filter((t) => t !== type));
      setCheckedInstrumentIds((prev) => {
        const next = new Set(prev);
        instruments
          .filter((i) => i.type === type)
          .forEach((i) => next.delete(i.id));
        return next;
      });
    } else {
      setCheckedTypes((prev) => [...prev, type]);
      setCheckedInstrumentIds((prev) => {
        const next = new Set(prev);
        instruments
          .filter((i) => i.type === type)
          .forEach((i) => next.add(i.id));
        return next;
      });
    }
  };

  const handleToggleInstrument = (instrumentId: string) => {
    setCheckedInstrumentIds((prev) => {
      const next = new Set(prev);
      if (next.has(instrumentId)) next.delete(instrumentId);
      else next.add(instrumentId);
      return next;
    });
  };

  // Admin: Toggle instrument booking mode directly from calendar view
  const handleToggleBookingMode = async (inst: Instrument) => {
    if (!isAdminOrSuperAdmin || updatingModeId) return;
    const nextMode: "manual" | "instant" =
      inst.bookingMode === "instant" ? "manual" : "instant";
    const nextLabel =
      nextMode === "instant" ? "Instant Booking" : "Manual Approval";

    setUpdatingModeId(inst.id);

    // Optimistic UI update in calendar
    setInstruments((prev) =>
      prev.map((i) => (i.id === inst.id ? { ...i, bookingMode: nextMode } : i)),
    );

    try {
      const token =
        sessionToken || localStorage.getItem("church_session_token_v1");
      let res = await fetch(`/api/instruments/${inst.id}/mode`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: token ? `Bearer ${token}` : "",
        },
        body: JSON.stringify({ bookingMode: nextMode }),
      });

      if (!res.ok) {
        // Fallback to admin route
        res = await fetch(`/api/admin/instruments/${inst.id}`, {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization: token ? `Bearer ${token}` : "",
          },
          body: JSON.stringify({ bookingMode: nextMode }),
        });
      }

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to update booking mode");
      }

      setModeNotice(`${inst.name} booking mode switched to ${nextLabel}`);
      setTimeout(() => setModeNotice(null), 3500);

      if (onLoadedInstruments) {
        onLoadedInstruments(
          instruments.map((i) =>
            i.id === inst.id ? { ...i, bookingMode: nextMode } : i,
          ),
        );
      }
    } catch (err: any) {
      console.error("Failed to toggle instrument booking mode:", err);
      // Revert optimistic update
      setInstruments((prev) =>
        prev.map((i) =>
          i.id === inst.id ? { ...i, bookingMode: inst.bookingMode } : i,
        ),
      );
      setModeNotice(`Error updating mode: ${err.message}`);
      setTimeout(() => setModeNotice(null), 4000);
    } finally {
      setUpdatingModeId(null);
    }
  };

  // Generate a 30-day window for the horizontal date strip
  const dateChips = useMemo(() => {
    const chips: {
      dateStr: string;
      dayName: string;
      dayNum: number;
      monthName: string;
      isToday: boolean;
    }[] = [];
    const todayStr = getTodayDateString();
    const today = parseLocalDate(todayStr);

    for (let i = 0; i < 30; i++) {
      const d = new Date(
        today.getFullYear(),
        today.getMonth(),
        today.getDate() + i,
      );
      const dateStr = getLocalDateString(d);
      chips.push({
        dateStr,
        dayName: d.toLocaleDateString(isAr ? "ar-u-nu-latn" : "en-US", { weekday: "short" }),
        dayNum: d.getDate(),
        monthName: d.toLocaleDateString(isAr ? "ar-u-nu-latn" : "en-US", { month: "short" }),
        isToday: dateStr === todayStr,
      });
    }
    return chips;
  }, [isAr]);

  // Fetch availability for selected date
  const fetchAvailability = async (date: string) => {
    setLoading(true);
    setError(null);
    try {
      const token =
        sessionToken || localStorage.getItem("church_session_token_v1");
      const res = await fetch(
        `/api/instruments/availability/date?date=${date}`,
        {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        },
      );
      if (!res.ok) {
        throw new Error("Failed to fetch instrument availability");
      }
      const data = await res.json();
      const insts = data.instruments || [];
      setInstruments(insts);
      setReservations(data.reservations || []);
      if (onLoadedInstruments) {
        onLoadedInstruments(insts);
      }
    } catch (err: any) {
      console.error("Error fetching calendar data:", err);
      setError(err.message || "Unable to load schedule.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAvailability(selectedDate);
  }, [selectedDate, refreshTrigger, sessionToken, profile?.role]);

  // Group instruments by type
  const groupedInstruments: Record<string, Instrument[]> = useMemo(() => {
    const groups: Record<string, Instrument[]> = {};

    Array.from(new Set(checkedTypes))
      .sort((a, b) => getTypeOrderIndex(a) - getTypeOrderIndex(b))
      .forEach((type) => {
        const typeInstruments = sortInstrumentsByManualOrder(
          instruments.filter(
            (inst) => inst.type === type && checkedInstrumentIds.has(inst.id),
          ),
        );
        if (typeInstruments.length > 0) groups[type] = typeInstruments;
      });

    return groups;
  }, [instruments, checkedTypes, checkedInstrumentIds]);

  const allInstrumentTypes = useMemo(() => {
    const types = new Set<string>();
    instruments.forEach((inst) => types.add(inst.type));
    return Array.from(types).sort(
      (a, b) => getTypeOrderIndex(a) - getTypeOrderIndex(b),
    );
  }, [instruments]);

  // Check if a specific instrument slot is booked
  const isSlotBooked = (instrumentId: string, slotHhmm: string) => {
    const slotMins = hhmmToMinutes(slotHhmm);
    return reservations.some((res) => {
      if (res.instrumentId !== instrumentId) return false;
      const startMins = hhmmToMinutes(res.startHhmm);
      const endMins = hhmmToMinutes(res.endHhmm);
      return slotMins >= startMins && slotMins < endMins;
    });
  };

  // Retrieve reservation details for a booked slot
  const getSlotReservation = (
    instrumentId: string,
    slotHhmm: string,
  ): ReservedSlot | undefined => {
    const slotMins = hhmmToMinutes(slotHhmm);
    return reservations.find((res) => {
      if (res.instrumentId !== instrumentId) return false;
      const startMins = hhmmToMinutes(res.startHhmm);
      const endMins = hhmmToMinutes(res.endHhmm);
      return slotMins >= startMins && slotMins < endMins;
    });
  };

  const isUserOwnBooking = (instrumentId: string, slotHhmm: string) => {
    if (!profile) return false;
    const slotMins = hhmmToMinutes(slotHhmm);
    return reservations.some((res) => {
      if (res.instrumentId !== instrumentId) return false;
      if (res.userId !== profile.id) return false;
      const startMins = hhmmToMinutes(res.startHhmm);
      const endMins = hhmmToMinutes(res.endHhmm);
      return slotMins >= startMins && slotMins < endMins;
    });
  };

  function hhmmToMinutes(hhmm: string): number {
    if (!hhmm) return 0;
    const [h, m] = hhmm.split(":").map((x) => parseInt(x, 10));
    return h * 60 + (m || 0);
  }

  const currentDateCairo = getCairoDateString(currentTime);
  const currentTimeHhmm = getCairoTimeString(currentTime);
  const [currentHour, currentMinute] = currentTimeHhmm.split(":").map(Number);
  const currentMinutesCairo = currentHour * 60 + currentMinute;
  const currentSlotStartMinutes = Math.floor(currentMinutesCairo / 30) * 30;
  const currentSlotHhmm =
    currentMinutesCairo >= 9 * 60 && currentMinutesCairo < 22 * 60
      ? `${String(Math.floor(currentSlotStartMinutes / 60)).padStart(2, "0")}:${String(currentSlotStartMinutes % 60).padStart(2, "0")}`
      : null;

  const navigateDate = (direction: "prev" | "next") => {
    setSelectedDate((prev) =>
      addDaysToDateString(prev, direction === "next" ? 1 : -1),
    );
  };

  const jumpToToday = () => {
    setSelectedDate(getTodayDateString());
  };

  return (
    <div id="availability-calendar-container" className="space-y-6">
      {/* Admin Mode Switch Notification */}
      {modeNotice && (
        <div
          id="calendar-mode-update-notice"
          className="bg-emerald-50 border border-emerald-200 text-emerald-900 px-4 py-3 rounded-2xl flex items-center justify-between text-xs font-semibold shadow-xs animate-in fade-in slide-in-from-top-2 duration-200"
        >
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-600 animate-pulse" />
            <span>{modeNotice}</span>
          </div>
          <button
            type="button"
            onClick={() => setModeNotice(null)}
            className="text-emerald-700 hover:text-emerald-900 cursor-pointer font-bold px-1.5 py-0.5"
          >
            ✕
          </button>
        </div>
      )}

      {/* 1. Header Controls & Date Navigator */}
      <div className="bg-white rounded-2xl border border-stone-200 p-3 sm:p-4 shadow-xs">
        <div className="flex flex-col gap-3 pb-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0 flex items-center gap-2 flex-wrap">
            <h1 className="text-base sm:text-xl font-bold text-stone-900 tracking-tight leading-none">
              {t("calendar.title")}
            </h1>
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-100 text-amber-900 border border-amber-200 whitespace-nowrap">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-600 mr-1 rtl:mr-0 rtl:ml-1 inline-block" />
              {t("calendar.updatedNow")}
            </span>
            <button
              type="button"
              onClick={() => setShowHelperText(!showHelperText)}
              className="shrink-0 flex items-center gap-1 px-1.5 py-0.5 rounded-full text-stone-400 hover:text-stone-600 hover:bg-stone-100 transition text-[10px] font-semibold"
              title="Toggle timeline help and reference info"
            >
              <Info className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">{t("calendar.howThisWorks")}</span>
            </button>
          </div>

          <div className="flex items-center justify-end gap-2 min-w-0 overflow-x-auto scrollbar-none flex-nowrap sm:shrink-0">
            {allInstrumentTypes.length > 0 && (
              <div className="relative shrink-0" ref={filterPanelRef}>
                <button
                  id="btn-open-instrument-filter"
                  onClick={() => setIsFilterPanelOpen((o) => !o)}
                  className="flex items-center gap-1.5 bg-stone-50 border border-stone-200 rounded-xl px-2.5 py-1.5 text-xs text-stone-700 font-medium hover:bg-stone-100 transition cursor-pointer whitespace-nowrap shrink-0"
                >
                  <SlidersHorizontal className="w-3.5 h-3.5 text-stone-500 shrink-0" />
                  <span className="hidden sm:inline">{t("common.filter")}</span>
                  <span className="sm:hidden">
                    ({checkedInstrumentIds.size})
                  </span>
                </button>

                {isFilterPanelOpen && (
                  <div
                    id="instrument-filter-panel"
                    className="fixed left-1/2 top-24 -translate-x-1/2 w-[min(20rem,calc(100vw-2rem))] max-h-[70vh] overflow-y-auto bg-white border border-stone-200 rounded-xl shadow-lg z-30 p-3 space-y-3"
                  >
                    {allInstrumentTypes.map((type) => {
                      const isTypeChecked = checkedTypes.includes(type);
                      const typeInstruments = sortInstrumentsByManualOrder(
                        instruments.filter((inst) => inst.type === type),
                      );
                      return (
                        <div key={type} className="space-y-1.5">
                          <label className="flex items-center gap-2 text-xs font-bold text-stone-800 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={isTypeChecked}
                              onChange={() => handleToggleType(type)}
                              className="w-3.5 h-3.5 accent-amber-800 cursor-pointer"
                            />
                            <span>{type}</span>
                            <span className="text-[10px] font-medium text-stone-400">
                              ({typeInstruments.length})
                            </span>
                          </label>

                          {isTypeChecked && (
                            <div className="pl-5 space-y-1">
                              {typeInstruments.map((inst) => (
                                <label
                                  key={inst.id}
                                  className="flex items-center gap-2 text-xs text-stone-700 cursor-pointer"
                                >
                                  <input
                                    type="checkbox"
                                    checked={checkedInstrumentIds.has(inst.id)}
                                    onChange={() =>
                                      handleToggleInstrument(inst.id)
                                    }
                                    className="w-3.5 h-3.5 accent-amber-700 cursor-pointer"
                                  />
                                  <span>{inst.name}</span>
                                </label>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            <button
              id="btn-jump-today"
              onClick={jumpToToday}
              className="px-2.5 py-1.5 rounded-xl border border-stone-200 bg-stone-50 hover:bg-stone-100 text-[11px] font-semibold text-stone-800 transition cursor-pointer shrink-0"
            >
              {t("common.today")}
            </button>

            <div className="relative flex items-center shrink-0">
              <input
                id="jump-to-date-input"
                type="date"
                value={selectedDate}
                onChange={(e) => {
                  if (e.target.value) setSelectedDate(e.target.value);
                }}
                className={`py-1.5 text-[11px] font-semibold bg-stone-50 border border-stone-200 rounded-xl text-stone-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-amber-600/30 transition cursor-pointer ${
                  isAr ? "pr-7 pl-2.5" : "pl-7 pr-2.5"
                }`}
              />
              <CalendarIcon
                className={`w-3.5 h-3.5 text-stone-500 absolute pointer-events-none ${
                  isAr ? "right-2.5" : "left-2.5"
                }`}
              />
            </div>

            <button
              id="btn-refresh-calendar"
              onClick={() => fetchAvailability(selectedDate)}
              disabled={loading}
              className="p-2 rounded-xl border border-stone-200 bg-stone-50 hover:bg-stone-100 text-stone-700 text-xs transition cursor-pointer shrink-0"
              title={t("common.refresh")}
            >
              <RefreshCw
                className={`w-3.5 h-3.5 ${loading ? "animate-spin text-amber-700" : ""}`}
              />
            </button>
          </div>
        </div>

        {showHelperText && (
          <div className="mb-3 rounded-xl border border-stone-200 bg-stone-50 px-3 py-2 space-y-2 text-[11px] text-stone-600">
            <p className="text-stone-700 font-medium">
              {t("calendar.selectOpenSlot")}
            </p>
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-1.5">
                <span className="w-3.5 h-3.5 rounded-md bg-white border border-stone-300 inline-block" />
                <span>{t("common.available")}</span>
              </div>
              {isAdminOrSuperAdmin ? (
                <div className="flex items-center gap-1.5">
                  <span className="w-3.5 h-3.5 rounded-md bg-indigo-950 border border-indigo-600 inline-block" />
                  <span>{t("calendar.assignedColor")}</span>
                </div>
              ) : (
                <div className="flex items-center gap-1.5">
                  <span className="w-3.5 h-3.5 rounded-md bg-black inline-block" />
                  <span>{t("common.booked")}</span>
                </div>
              )}
              <div className="text-stone-500">{t("calendar.hoursRange")}</div>
            </div>
          </div>
        )}

        <div className="flex items-center gap-2 pb-2">
          <button
            id="btn-date-prev"
            onClick={() => navigateDate("prev")}
            className="p-2 rounded-xl border border-stone-200 text-stone-600 hover:bg-stone-100 shrink-0 transition cursor-pointer"
            title={t("calendar.prevDay")}
          >
            <ChevronLeft className="w-4 h-4 rtl:rotate-180" />
          </button>

          <div className="flex-1 min-w-0 text-center text-[11px] font-semibold text-stone-600 uppercase tracking-[0.12em]">
            {parseLocalDate(selectedDate).toLocaleDateString(isAr ? "ar-u-nu-latn" : "en-US", {
              month: "long",
              year: "numeric",
            })}
          </div>

          <button
            id="btn-date-next"
            onClick={() => navigateDate("next")}
            className="p-2 rounded-xl border border-stone-200 text-stone-600 hover:bg-stone-100 shrink-0 transition cursor-pointer"
            title={t("calendar.nextDay")}
          >
            <ChevronRight className="w-4 h-4 rtl:rotate-180" />
          </button>
        </div>

        <div
          id="date-chip-strip"
          ref={dateStripRef}
          className="flex items-center gap-1.5 overflow-x-auto py-1 scrollbar-none scroll-smooth"
        >
          {dateChips.map((chip) => {
            const isSelected = chip.dateStr === selectedDate;
            return (
              <button
                key={chip.dateStr}
                id={`date-chip-${chip.dateStr}`}
                onClick={() => setSelectedDate(chip.dateStr)}
                className={`flex-shrink-0 flex flex-col items-center justify-center w-[52px] sm:w-[58px] h-[52px] rounded-xl border transition-all cursor-pointer ${
                  isSelected
                    ? "bg-amber-800 text-white border-amber-900 shadow-md font-bold"
                    : chip.isToday
                      ? "bg-amber-50/80 text-amber-900 border-amber-200 hover:bg-amber-100/70 font-semibold"
                      : "bg-stone-50 text-stone-700 border-stone-200 hover:bg-stone-100"
                }`}
              >
                <div className="flex items-center gap-1">
                  {chip.isToday && (
                    <span className="w-1.5 h-1.5 rounded-full bg-current opacity-80" />
                  )}
                  <span className="text-[9px] uppercase tracking-[0.12em] font-semibold leading-none">
                    {chip.dayName}
                  </span>
                </div>
                <span className="text-base font-bold leading-none mt-1">
                  {chip.dayNum}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* 3. Resource Timeline Grid (Side-by-side Columns with Spanning Header) */}
      <div
        id="resource-timeline-wrapper"
        className="bg-white rounded-2xl border border-stone-200 shadow-xs overflow-hidden"
      >
        {loading && instruments.length === 0 ? (
          <div className="p-16 flex flex-col items-center justify-center gap-3">
            <div className="w-8 h-8 border-3 border-amber-800/20 border-t-amber-800 rounded-full animate-spin" />
            <span className="text-xs text-stone-500 font-medium">
              {t("calendar.loadingSchedule")}
            </span>
          </div>
        ) : error ? (
          <div className="p-12 text-center text-red-700 bg-red-50 text-xs">
            <p className="font-semibold mb-2">{t("calendar.errorLoading")}</p>
            <p>{error}</p>
            <button
              onClick={() => fetchAvailability(selectedDate)}
              className="mt-3 px-4 py-1.5 bg-red-600 text-white rounded-xl text-xs font-semibold cursor-pointer"
            >
              {t("calendar.tryAgain")}
            </button>
          </div>
        ) : Object.keys(groupedInstruments).length === 0 ? (
          <div className="p-16 text-center text-stone-500 text-xs">
            <Music2 className="w-8 h-8 mx-auto mb-2 text-stone-400" />
            <p className="font-semibold text-stone-700 text-sm">
              {t("calendar.noInstrumentsFound")}
            </p>
            <p className="mt-1">
              {t("calendar.noInstrumentsMatchFilter")}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto scrollbar-thin">
            <table className={`w-full border-collapse min-w-[760px] ${isAr ? "text-right" : "text-left"}`}>
              {/* TOP SPANNING HEADER: Instrument Group / Type */}
              <thead>
                <tr className="bg-stone-100/90 border-b border-stone-200">
                  {/* Sticky Time column */}
                  <th
                    scope="col"
                    className={`sticky ${
                      isAr ? "right-0 border-l" : "left-0 border-r"
                    } z-20 bg-stone-100 w-20 min-w-[80px] p-3 text-xs font-bold text-stone-600 border-stone-200 uppercase tracking-wider text-center`}
                  >
                    {t("common.time")}
                  </th>
                  {Object.entries(groupedInstruments).map(
                    ([typeName, typeInsts]) => (
                      <th
                        key={typeName}
                        colSpan={typeInsts.length}
                        className={`p-2.5 text-center text-xs font-bold text-stone-800 ${
                          isAr ? "border-l" : "border-r"
                        } border-stone-200 bg-stone-200/50 uppercase tracking-wider`}
                      >
                        <div className="flex items-center justify-center gap-1.5">
                          <Music2 className="w-3.5 h-3.5 text-amber-800" />
                          <span>{typeName}</span>
                          <span className="text-[10px] font-semibold text-stone-500 bg-white px-1.5 py-0.5 rounded-full border border-stone-200">
                            {typeInsts.length}
                          </span>
                        </div>
                      </th>
                    ),
                  )}
                </tr>

                {/* INDIVIDUAL COLUMN HEADERS: Instrument Details */}
                <tr className="bg-stone-50/95 border-b border-stone-200">
                  <th
                    scope="col"
                    className={`sticky ${
                      isAr ? "right-0 border-l" : "left-0 border-r"
                    } z-20 bg-stone-50/95 p-3 text-[11px] font-semibold text-stone-500 border-stone-200 text-center`}
                  >
                    {t("calendar.slot30m")}
                  </th>
                  {Object.values(groupedInstruments).flatMap((typeInsts) =>
                    typeInsts.map((inst) => {
                      const hasFee =
                        parseFloat(inst.outsideFeePerDay || "0") > 0;
                      return (
                        <th
                          key={inst.id}
                          id={`instrument-col-header-${inst.id}`}
                          onClick={() => onSelectInstrument(inst)}
                          className={`p-3 w-48 min-w-[180px] max-w-[220px] ${
                            isAr ? "border-l" : "border-r"
                          } border-stone-200 align-top hover:bg-amber-50/60 transition-colors cursor-pointer group select-none`}
                          title="Tap to view instrument profile & full schedule"
                        >
                          <div className="flex flex-col gap-1.5">
                            <div className="flex items-center gap-2">
                              <div className="w-8 h-8 rounded-lg bg-stone-100 border border-stone-200 text-stone-700 flex items-center justify-center shrink-0 overflow-hidden shadow-2xs">
                                {inst.photoUrl ? (
                                  <img
                                    src={inst.photoUrl}
                                    alt={inst.name}
                                    referrerPolicy="no-referrer"
                                    className="w-full h-full object-cover"
                                  />
                                ) : (
                                  <Music2 className="w-4 h-4 text-stone-400" />
                                )}
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-start justify-between gap-1">
                                  <span className="text-xs font-bold text-stone-900 group-hover:text-amber-900 transition truncate">
                                    {inst.name}
                                  </span>
                                  <Info className="w-3.5 h-3.5 text-stone-400 group-hover:text-amber-800 shrink-0 transition" />
                                </div>
                              </div>
                            </div>

                            <div className="flex flex-wrap items-center gap-1.5">
                              {/* Booking Mode Chip: Interactive toggle for Admins, static badge for users */}
                              {isAdminOrSuperAdmin ? (
                                <button
                                  type="button"
                                  id={`calendar-toggle-mode-btn-${inst.id}`}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleToggleBookingMode(inst);
                                  }}
                                  disabled={updatingModeId === inst.id}
                                  title={`Admin Quick-Toggle: Click to switch to ${
                                    inst.bookingMode === "instant"
                                      ? "Manual Approval"
                                      : "Instant Booking"
                                  }`}
                                  className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold cursor-pointer transition shadow-2xs hover:scale-105 active:scale-95 ${
                                    inst.bookingMode === "instant"
                                      ? "bg-emerald-100 hover:bg-emerald-200 text-emerald-800 border border-emerald-300"
                                      : "bg-amber-100 hover:bg-amber-200 text-amber-900 border border-amber-300"
                                  } ${updatingModeId === inst.id ? "opacity-50 cursor-wait" : ""}`}
                                >
                                  {inst.bookingMode === "instant" ? (
                                    <>
                                      <Zap className="w-2.5 h-2.5" />
                                      <span>{t("common.instant")}</span>
                                    </>
                                  ) : (
                                    <>
                                      <Clock className="w-2.5 h-2.5" />
                                      <span>{t("common.manual")}</span>
                                    </>
                                  )}
                                </button>
                              ) : (
                                <span
                                  className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-bold ${
                                    inst.bookingMode === "instant"
                                      ? "bg-emerald-100 text-emerald-800 border border-emerald-200"
                                      : "bg-amber-100 text-amber-900 border border-amber-200"
                                  }`}
                                >
                                  {inst.bookingMode === "instant" ? (
                                    <>
                                      <Zap className="w-2.5 h-2.5" />
                                      <span>{t("common.instant")}</span>
                                    </>
                                  ) : (
                                    <>
                                      <Clock className="w-2.5 h-2.5" />
                                      <span>{t("common.manual")}</span>
                                    </>
                                  )}
                                </span>
                              )}

                              {/* Outside Fee Badge (if fee > 0) */}
                              {hasFee && (
                                <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md text-[10px] font-bold bg-purple-50 text-purple-800 border border-purple-200">
                                  <span>{t("common.egp")} {inst.outsideFeePerDay}{t("common.perDay")}</span>
                                </span>
                              )}
                            </div>
                          </div>
                        </th>
                      );
                    }),
                  )}
                </tr>
              </thead>

              {/* TIMELINE BODY (30-minute rows) */}
              <tbody className="divide-y divide-stone-100">
                {TIME_SLOTS.slice(0, -1).map((slotHhmm) => {
                  const isHourStart = slotHhmm.endsWith(":00");
                  const isCurrentSlot =
                    selectedDate === currentDateCairo &&
                    slotHhmm === currentSlotHhmm;
                  return (
                    <tr
                      key={slotHhmm}
                      className={`hover:bg-amber-50/20 transition-colors ${
                        isHourStart ? "bg-stone-50/30" : "bg-white"
                      } ${isCurrentSlot ? "border-t-2 border-black" : ""}`}
                    >
                      {/* Sticky Time Label Column */}
                      <td
                        className={`sticky ${
                          isAr ? "right-0 border-l" : "left-0 border-r"
                        } z-10 p-2 text-center text-xs font-mono border-stone-200 select-none ${
                          isHourStart
                            ? "font-bold text-stone-800 bg-stone-100/90"
                            : "text-stone-500 bg-white/90 font-normal"
                        }`}
                      >
                        <div className="flex flex-col items-center gap-0.5">
                          <span>{formatHhmmTo12Hour(slotHhmm, isAr ? "ar" : "en")}</span>
                          {isCurrentSlot && (
                            <span className="rounded bg-black px-1 py-0.5 text-[9px] font-bold leading-none text-white">
                              {t("common.now")} {formatHhmmTo12Hour(currentTimeHhmm, isAr ? "ar" : "en")}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Instrument Slot Cells */}
                      {Object.values(groupedInstruments).flatMap((typeInsts) =>
                        typeInsts.map((inst) => {
                          const booked = isSlotBooked(inst.id, slotHhmm);
                          const userOwn = isUserOwnBooking(inst.id, slotHhmm);

                          if (booked) {
                            if (isAdminOrSuperAdmin) {
                              const slotRes = getSlotReservation(
                                inst.id,
                                slotHhmm,
                              );
                              const reservantKey =
                                slotRes?.userId ||
                                slotRes?.userName ||
                                slotRes?.id ||
                                "admin-booking";
                              const colorTheme =
                                getReservantColorTheme(reservantKey);
                              const reservantName =
                                slotRes?.userName || "Reservant";
                              const serviceName =
                                slotRes?.serviceName || "Reserved Service";

                              return (
                                <td
                                  key={`${inst.id}-${slotHhmm}`}
                                  id={`slot-booked-${inst.id}-${slotHhmm}`}
                                  className={`p-1 ${
                                    isAr ? "border-l" : "border-r"
                                  } border-stone-200 text-center select-none`}
                                >
                                  <div
                                    className="w-full min-h-8 py-1 px-1.5 rounded-lg flex flex-col items-center justify-center text-[10px] font-medium shadow-2xs transition-all border overflow-hidden"
                                    style={{
                                      backgroundColor: colorTheme.bgHex,
                                      borderColor: colorTheme.borderHex,
                                    }}
                                    title={`Reserved by: ${reservantName} | Service: ${serviceName} (${formatHhmmTo12Hour(slotHhmm, isAr ? "ar" : "en")})`}
                                  >
                                    <div className="flex flex-col items-center justify-center leading-tight w-full overflow-hidden text-center">
                                      <span
                                        className="font-bold truncate max-w-full text-[10px]"
                                        style={{ color: colorTheme.nameHex }}
                                        title={reservantName}
                                      >
                                        {reservantName}
                                      </span>
                                      <span
                                        className="text-[9px] truncate max-w-full opacity-90"
                                        style={{ color: colorTheme.serviceHex }}
                                        title={serviceName}
                                      >
                                        {serviceName}
                                      </span>
                                    </div>
                                  </div>
                                </td>
                              );
                            }

                            // Regular users: approved slots show only a solid black box labeled "Booked"
                            // No name, no service_name, no reservant-specific color
                            return (
                              <td
                                key={`${inst.id}-${slotHhmm}`}
                                id={`slot-booked-${inst.id}-${slotHhmm}`}
                                className={`p-1 ${
                                  isAr ? "border-l" : "border-r"
                                } border-stone-200 text-center select-none`}
                              >
                                <div
                                  className="w-full min-h-8 py-1 px-1.5 rounded-lg flex items-center justify-center text-[10px] font-bold shadow-2xs bg-black text-white border border-black select-none"
                                  title={t("common.booked")}
                                >
                                  <span className="tracking-wider uppercase text-[9px] font-bold text-white">
                                    {t("common.booked")}
                                  </span>
                                </div>
                              </td>
                            );
                          }

                          // Free Slot -> Tappable
                          return (
                            <td
                              key={`${inst.id}-${slotHhmm}`}
                              id={`slot-free-${inst.id}-${slotHhmm}`}
                              onClick={() =>
                                onSelectSlot(inst, selectedDate, slotHhmm, 1)
                              }
                              className={`p-1 ${
                                isAr ? "border-l" : "border-r"
                              } border-stone-200 cursor-pointer group/cell`}
                              title={`Tap to reserve ${inst.name} at ${formatHhmmTo12Hour(slotHhmm, isAr ? "ar" : "en")}`}
                            >
                              <div className="w-full h-8 rounded-lg bg-white border border-transparent group-hover/cell:border-amber-400 group-hover/cell:bg-amber-50 text-transparent group-hover/cell:text-amber-800 flex items-center justify-center text-xs font-semibold transition-all">
                                <Plus className={`w-3.5 h-3.5 ${isAr ? "ml-1" : "mr-1"}`} />
                                <span className="text-[11px]">{t("calendar.reserveSlot")}</span>
                              </div>
                            </td>
                          );
                        }),
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
