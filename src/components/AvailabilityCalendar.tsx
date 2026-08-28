import React, { useState, useEffect, useMemo, useRef } from 'react';
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
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext.tsx';
import { getReservantColorTheme } from '../lib/reservant-colors.ts';

export interface Instrument {
  id: string;
  name: string;
  type: string;
  photoUrl: string | null;
  description: string | null;
  outsideFeePerDay: string;
  bookingMode: 'manual' | 'instant';
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
  onSelectSlot: (instrument: Instrument, date: string, timeHhmm: string, durationHours: number) => void;
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
TIME_SLOTS.push('22:00');

function formatHhmmTo12Hour(hhmm: string): string {
  const [hStr, mStr] = hhmm.split(':');
  let h = parseInt(hStr, 10);
  const ampm = h >= 12 ? 'PM' : 'AM';
  if (h === 0) h = 12;
  else if (h > 12) h -= 12;
  return `${h}:${mStr} ${ampm}`;
}

export const AvailabilityCalendar: React.FC<AvailabilityCalendarProps> = ({
  onSelectSlot,
  onSelectInstrument,
  refreshTrigger,
  onLoadedInstruments,
}) => {
  const { profile, sessionToken } = useAuth();
  const isAdminOrSuperAdmin =
    profile?.role === 'admin' ||
    profile?.role === 'super_admin' ||
    Boolean(profile?.isSuperAdmin);

  const [selectedDate, setSelectedDate] = useState<string>(() => {
    return new Date().toISOString().split('T')[0];
  });
  const [instruments, setInstruments] = useState<Instrument[]>([]);
  const [reservations, setReservations] = useState<ReservedSlot[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedTypeFilter, setSelectedTypeFilter] = useState<string>('all');
  const [modeNotice, setModeNotice] = useState<string | null>(null);
  const [updatingModeId, setUpdatingModeId] = useState<string | null>(null);
  const dateStripRef = useRef<HTMLDivElement>(null);

  // Admin: Toggle instrument booking mode directly from calendar view
  const handleToggleBookingMode = async (inst: Instrument) => {
    if (!isAdminOrSuperAdmin || updatingModeId) return;
    const nextMode: 'manual' | 'instant' = inst.bookingMode === 'instant' ? 'manual' : 'instant';
    const nextLabel = nextMode === 'instant' ? 'Instant Booking' : 'Manual Approval';

    setUpdatingModeId(inst.id);

    // Optimistic UI update in calendar
    setInstruments((prev) =>
      prev.map((i) => (i.id === inst.id ? { ...i, bookingMode: nextMode } : i))
    );

    try {
      const token = sessionToken || localStorage.getItem('church_session_token_v1');
      let res = await fetch(`/api/instruments/${inst.id}/mode`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: token ? `Bearer ${token}` : '',
        },
        body: JSON.stringify({ bookingMode: nextMode }),
      });

      if (!res.ok) {
        // Fallback to admin route
        res = await fetch(`/api/admin/instruments/${inst.id}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            Authorization: token ? `Bearer ${token}` : '',
          },
          body: JSON.stringify({ bookingMode: nextMode }),
        });
      }

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to update booking mode');
      }

      setModeNotice(`${inst.name} booking mode switched to ${nextLabel}`);
      setTimeout(() => setModeNotice(null), 3500);

      if (onLoadedInstruments) {
        onLoadedInstruments(
          instruments.map((i) => (i.id === inst.id ? { ...i, bookingMode: nextMode } : i))
        );
      }
    } catch (err: any) {
      console.error('Failed to toggle instrument booking mode:', err);
      // Revert optimistic update
      setInstruments((prev) =>
        prev.map((i) => (i.id === inst.id ? { ...i, bookingMode: inst.bookingMode } : i))
      );
      setModeNotice(`Error updating mode: ${err.message}`);
      setTimeout(() => setModeNotice(null), 4000);
    } finally {
      setUpdatingModeId(null);
    }
  };

  // Generate a 30-day window for the horizontal date strip
  const dateChips = useMemo(() => {
    const chips: { dateStr: string; dayName: string; dayNum: number; monthName: string; isToday: boolean }[] = [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    for (let i = 0; i < 30; i++) {
      const d = new Date(today);
      d.setDate(today.getDate() + i);
      const dateStr = d.toISOString().split('T')[0];
      chips.push({
        dateStr,
        dayName: d.toLocaleDateString('en-US', { weekday: 'short' }),
        dayNum: d.getDate(),
        monthName: d.toLocaleDateString('en-US', { month: 'short' }),
        isToday: i === 0,
      });
    }
    return chips;
  }, []);

  // Fetch availability for selected date
  const fetchAvailability = async (date: string) => {
    setLoading(true);
    setError(null);
    try {
      const token = sessionToken || localStorage.getItem('church_session_token_v1');
      const res = await fetch(`/api/instruments/availability/date?date=${date}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) {
        throw new Error('Failed to fetch instrument availability');
      }
      const data = await res.json();
      const insts = data.instruments || [];
      setInstruments(insts);
      setReservations(data.reservations || []);
      if (onLoadedInstruments) {
        onLoadedInstruments(insts);
      }
    } catch (err: any) {
      console.error('Error fetching calendar data:', err);
      setError(err.message || 'Unable to load schedule.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAvailability(selectedDate);
  }, [selectedDate, refreshTrigger, sessionToken, profile?.role]);

  // Group instruments by type
  const groupedInstruments: Record<string, Instrument[]> = useMemo(() => {
    const filtered = selectedTypeFilter === 'all'
      ? instruments
      : instruments.filter((inst) => inst.type === selectedTypeFilter);

    const groups: Record<string, Instrument[]> = {};
    for (const inst of filtered) {
      if (!groups[inst.type]) {
        groups[inst.type] = [];
      }
      groups[inst.type].push(inst);
    }
    return groups;
  }, [instruments, selectedTypeFilter]);

  const instrumentTypes = useMemo(() => {
    const types = new Set<string>();
    instruments.forEach((inst) => types.add(inst.type));
    return Array.from(types);
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
  const getSlotReservation = (instrumentId: string, slotHhmm: string): ReservedSlot | undefined => {
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
    const [h, m] = hhmm.split(':').map((x) => parseInt(x, 10));
    return h * 60 + (m || 0);
  }

  const navigateDate = (direction: 'prev' | 'next') => {
    const current = new Date(selectedDate);
    current.setDate(current.getDate() + (direction === 'next' ? 1 : -1));
    setSelectedDate(current.toISOString().split('T')[0]);
  };

  const jumpToToday = () => {
    setSelectedDate(new Date().toISOString().split('T')[0]);
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
      <div className="bg-white rounded-2xl border border-stone-200 p-4 sm:p-6 shadow-xs">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-stone-100">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl sm:text-2xl font-bold text-stone-900 tracking-tight">
                Instrument Availability
              </h1>
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-900 border border-amber-200">
                Live Timeline
              </span>
            </div>
            <p className="text-xs text-stone-500 mt-1">
              Select any open 30-minute slot to book. Approved bookings are shown as solid blocks to protect member privacy.
            </p>
          </div>

          {/* Quick Filter & Jump Controls */}
          <div className="flex flex-wrap items-center gap-2 sm:gap-3">
            {/* Category Filter */}
            {instrumentTypes.length > 0 && (
              <div className="flex items-center gap-1.5 bg-stone-50 border border-stone-200 rounded-xl px-2.5 py-1.5 text-xs text-stone-700">
                <SlidersHorizontal className="w-3.5 h-3.5 text-stone-500" />
                <select
                  id="category-filter-select"
                  value={selectedTypeFilter}
                  onChange={(e) => setSelectedTypeFilter(e.target.value)}
                  className="bg-transparent font-medium text-stone-800 focus:outline-none cursor-pointer"
                >
                  <option value="all">All Categories ({instruments.length})</option>
                  {instrumentTypes.map((type) => (
                    <option key={type} value={type}>
                      {type}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Jump to Today Button */}
            <button
              id="btn-jump-today"
              onClick={jumpToToday}
              className="px-3 py-1.5 rounded-xl border border-stone-200 bg-stone-50 hover:bg-stone-100 text-xs font-semibold text-stone-800 transition cursor-pointer"
            >
              Today
            </button>

            {/* Jump To Date Input */}
            <div className="relative flex items-center">
              <input
                id="jump-to-date-input"
                type="date"
                value={selectedDate}
                onChange={(e) => {
                  if (e.target.value) setSelectedDate(e.target.value);
                }}
                className="pl-8 pr-2.5 py-1.5 text-xs font-semibold bg-stone-50 border border-stone-200 rounded-xl text-stone-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-amber-600/30 transition cursor-pointer"
              />
              <CalendarIcon className="w-3.5 h-3.5 text-stone-500 absolute left-2.5 pointer-events-none" />
            </div>

            {/* Refresh Button */}
            <button
              id="btn-refresh-calendar"
              onClick={() => fetchAvailability(selectedDate)}
              disabled={loading}
              className="p-2 rounded-xl border border-stone-200 bg-stone-50 hover:bg-stone-100 text-stone-700 text-xs transition cursor-pointer"
              title="Refresh Availability"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-amber-700' : ''}`} />
            </button>
          </div>
        </div>

        {/* 2. Horizontally Scrollable Date Chip Strip */}
        <div className="pt-4 flex items-center gap-2">
          <button
            id="btn-date-prev"
            onClick={() => navigateDate('prev')}
            className="p-2 rounded-xl border border-stone-200 text-stone-600 hover:bg-stone-100 shrink-0 transition cursor-pointer"
            title="Previous Day"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>

          <div
            id="date-chip-strip"
            ref={dateStripRef}
            className="flex-1 flex items-center gap-2 overflow-x-auto py-1 scrollbar-none scroll-smooth"
          >
            {dateChips.map((chip) => {
              const isSelected = chip.dateStr === selectedDate;
              return (
                <button
                  key={chip.dateStr}
                  id={`date-chip-${chip.dateStr}`}
                  onClick={() => setSelectedDate(chip.dateStr)}
                  className={`flex flex-col items-center justify-center min-w-[70px] sm:min-w-[80px] py-2 px-3 rounded-xl border transition-all cursor-pointer ${
                    isSelected
                      ? 'bg-amber-800 text-white border-amber-900 shadow-md font-bold'
                      : chip.isToday
                      ? 'bg-amber-50/80 text-amber-900 border-amber-200 hover:bg-amber-100/70 font-semibold'
                      : 'bg-stone-50 text-stone-700 border-stone-200 hover:bg-stone-100'
                  }`}
                >
                  <span className="text-[10px] uppercase tracking-wider font-semibold opacity-90">
                    {chip.dayName}
                  </span>
                  <span className="text-sm sm:text-base font-bold my-0.5 leading-none">
                    {chip.dayNum}
                  </span>
                  <span className="text-[10px] opacity-80">{chip.monthName}</span>
                </button>
              );
            })}
          </div>

          <button
            id="btn-date-next"
            onClick={() => navigateDate('next')}
            className="p-2 rounded-xl border border-stone-200 text-stone-600 hover:bg-stone-100 shrink-0 transition cursor-pointer"
            title="Next Day"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        {/* Legend Indicators */}
        <div className="flex flex-wrap items-center gap-4 pt-4 mt-2 border-t border-stone-100 text-xs text-stone-600">
          <div className="flex items-center gap-1.5">
            <span className="w-3.5 h-3.5 rounded-md bg-white border border-stone-300 shadow-2xs inline-block" />
            <span>Available (Tap to Book)</span>
          </div>
          {isAdminOrSuperAdmin ? (
            <div className="flex items-center gap-1.5">
              <span className="w-3.5 h-3.5 rounded-md bg-indigo-950 border border-indigo-600 inline-block shadow-2xs" />
              <span>Assigned Color per Reservant (Name &amp; Service)</span>
            </div>
          ) : (
            <div className="flex items-center gap-1.5">
              <span className="w-3.5 h-3.5 rounded-md bg-black inline-block shadow-2xs" />
              <span className="font-semibold text-stone-900">Booked</span>
            </div>
          )}
          <div className="ml-auto text-[11px] text-stone-500 font-medium">
            Operating Hours: 09:00 AM – 10:00 PM
          </div>
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
            <span className="text-xs text-stone-500 font-medium">Loading timeline schedule...</span>
          </div>
        ) : error ? (
          <div className="p-12 text-center text-red-700 bg-red-50 text-xs">
            <p className="font-semibold mb-2">Error loading calendar</p>
            <p>{error}</p>
            <button
              onClick={() => fetchAvailability(selectedDate)}
              className="mt-3 px-4 py-1.5 bg-red-600 text-white rounded-xl text-xs font-semibold cursor-pointer"
            >
              Try Again
            </button>
          </div>
        ) : Object.keys(groupedInstruments).length === 0 ? (
          <div className="p-16 text-center text-stone-500 text-xs">
            <Music2 className="w-8 h-8 mx-auto mb-2 text-stone-400" />
            <p className="font-semibold text-stone-700 text-sm">No instruments found</p>
            <p className="mt-1">No active instruments match the selected category filter.</p>
          </div>
        ) : (
          <div className="overflow-x-auto scrollbar-thin">
            <table className="w-full border-collapse text-left min-w-[760px]">
              {/* TOP SPANNING HEADER: Instrument Group / Type */}
              <thead>
                <tr className="bg-stone-100/90 border-b border-stone-200">
                  {/* Sticky Time column top-left corner */}
                  <th
                    scope="col"
                    className="sticky left-0 z-20 bg-stone-100 w-24 min-w-[96px] p-3 text-xs font-bold text-stone-600 border-r border-stone-200 uppercase tracking-wider"
                  >
                    Time
                  </th>
                  {Object.entries(groupedInstruments).map(([typeName, typeInsts]) => (
                    <th
                      key={typeName}
                      colSpan={typeInsts.length}
                      className="p-2.5 text-center text-xs font-bold text-stone-800 border-r border-stone-200 bg-stone-200/50 uppercase tracking-wider"
                    >
                      <div className="flex items-center justify-center gap-1.5">
                        <Music2 className="w-3.5 h-3.5 text-amber-800" />
                        <span>{typeName}</span>
                        <span className="text-[10px] font-semibold text-stone-500 bg-white px-1.5 py-0.5 rounded-full border border-stone-200">
                          {typeInsts.length}
                        </span>
                      </div>
                    </th>
                  ))}
                </tr>

                {/* INDIVIDUAL COLUMN HEADERS: Instrument Details */}
                <tr className="bg-stone-50/95 border-b border-stone-200">
                  <th
                    scope="col"
                    className="sticky left-0 z-20 bg-stone-50/95 p-3 text-[11px] font-semibold text-stone-500 border-r border-stone-200 text-center"
                  >
                    Slot (30m)
                  </th>
                  {Object.values(groupedInstruments).flatMap((typeInsts) =>
                    typeInsts.map((inst) => {
                      const hasFee = parseFloat(inst.outsideFeePerDay || '0') > 0;
                      return (
                        <th
                          key={inst.id}
                          id={`instrument-col-header-${inst.id}`}
                          onClick={() => onSelectInstrument(inst)}
                          className="p-3 w-48 min-w-[180px] max-w-[220px] border-r border-stone-200 align-top hover:bg-amber-50/60 transition-colors cursor-pointer group select-none"
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
                                    inst.bookingMode === 'instant' ? 'Manual Approval' : 'Instant Booking'
                                  }`}
                                  className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold cursor-pointer transition shadow-2xs hover:scale-105 active:scale-95 ${
                                    inst.bookingMode === 'instant'
                                      ? 'bg-emerald-100 hover:bg-emerald-200 text-emerald-800 border border-emerald-300'
                                      : 'bg-amber-100 hover:bg-amber-200 text-amber-900 border border-amber-300'
                                  } ${updatingModeId === inst.id ? 'opacity-50 cursor-wait' : ''}`}
                                >
                                  {inst.bookingMode === 'instant' ? (
                                    <>
                                      <Zap className="w-2.5 h-2.5" />
                                      <span>Instant</span>
                                    </>
                                  ) : (
                                    <>
                                      <Clock className="w-2.5 h-2.5" />
                                      <span>Manual</span>
                                    </>
                                  )}
                                </button>
                              ) : (
                                <span
                                  className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-bold ${
                                    inst.bookingMode === 'instant'
                                      ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                                      : 'bg-amber-100 text-amber-900 border border-amber-200'
                                  }`}
                                >
                                  {inst.bookingMode === 'instant' ? (
                                    <>
                                      <Zap className="w-2.5 h-2.5" />
                                      <span>Instant</span>
                                    </>
                                  ) : (
                                    <>
                                      <Clock className="w-2.5 h-2.5" />
                                      <span>Manual</span>
                                    </>
                                  )}
                                </span>
                              )}

                              {/* Outside Fee Badge (if fee > 0) */}
                              {hasFee && (
                                <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md text-[10px] font-bold bg-purple-50 text-purple-800 border border-purple-200">
                                  <span>EGP {inst.outsideFeePerDay}/d</span>
                                </span>
                              )}
                            </div>
                          </div>
                        </th>
                      );
                    })
                  )}
                </tr>
              </thead>

              {/* TIMELINE BODY (30-minute rows) */}
              <tbody className="divide-y divide-stone-100">
                {TIME_SLOTS.slice(0, -1).map((slotHhmm) => {
                  const isHourStart = slotHhmm.endsWith(':00');
                  return (
                    <tr
                      key={slotHhmm}
                      className={`hover:bg-amber-50/20 transition-colors ${
                        isHourStart ? 'bg-stone-50/30' : 'bg-white'
                      }`}
                    >
                      {/* Sticky Time Label Column */}
                      <td
                        className={`sticky left-0 z-10 p-2 text-center text-xs font-mono border-r border-stone-200 select-none ${
                          isHourStart
                            ? 'font-bold text-stone-800 bg-stone-100/90'
                            : 'text-stone-500 bg-white/90 font-normal'
                        }`}
                      >
                        {formatHhmmTo12Hour(slotHhmm)}
                      </td>

                      {/* Instrument Slot Cells */}
                      {Object.values(groupedInstruments).flatMap((typeInsts) =>
                        typeInsts.map((inst) => {
                          const booked = isSlotBooked(inst.id, slotHhmm);
                          const userOwn = isUserOwnBooking(inst.id, slotHhmm);

                          if (booked) {
                            if (isAdminOrSuperAdmin) {
                              const slotRes = getSlotReservation(inst.id, slotHhmm);
                              const reservantKey = slotRes?.userId || slotRes?.userName || slotRes?.id || 'admin-booking';
                              const colorTheme = getReservantColorTheme(reservantKey);
                              const reservantName = slotRes?.userName || 'Reservant';
                              const serviceName = slotRes?.serviceName || 'Reserved Service';

                              return (
                                <td
                                  key={`${inst.id}-${slotHhmm}`}
                                  id={`slot-booked-${inst.id}-${slotHhmm}`}
                                  className="p-1 border-r border-stone-200 text-center select-none"
                                >
                                  <div
                                    className="w-full min-h-8 py-1 px-1.5 rounded-lg flex flex-col items-center justify-center text-[10px] font-medium shadow-2xs transition-all border overflow-hidden"
                                    style={{
                                      backgroundColor: colorTheme.bgHex,
                                      borderColor: colorTheme.borderHex,
                                    }}
                                    title={`Reserved by: ${reservantName} | Service: ${serviceName} (${formatHhmmTo12Hour(slotHhmm)})`}
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
                                className="p-1 border-r border-stone-200 text-center select-none"
                              >
                                <div
                                  className="w-full min-h-8 py-1 px-1.5 rounded-lg flex items-center justify-center text-[10px] font-bold shadow-2xs bg-black text-white border border-black select-none"
                                  title="Booked"
                                >
                                  <span className="tracking-wider uppercase text-[9px] font-bold text-white">
                                    Booked
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
                              onClick={() => onSelectSlot(inst, selectedDate, slotHhmm, 1)}
                              className="p-1 border-r border-stone-200 cursor-pointer group/cell"
                              title={`Tap to reserve ${inst.name} at ${formatHhmmTo12Hour(slotHhmm)}`}
                            >
                              <div className="w-full h-8 rounded-lg bg-white border border-transparent group-hover/cell:border-amber-400 group-hover/cell:bg-amber-50 text-transparent group-hover/cell:text-amber-800 flex items-center justify-center text-xs font-semibold transition-all">
                                <Plus className="w-3.5 h-3.5 mr-1" />
                                <span className="text-[11px]">Reserve</span>
                              </div>
                            </td>
                          );
                        })
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
