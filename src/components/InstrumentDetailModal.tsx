import React, { useState, useEffect, useMemo } from 'react';
import { Instrument } from './AvailabilityCalendar.tsx';
import { useAuth } from '../contexts/AuthContext.tsx';
import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  Clock,
  Music2,
  DollarSign,
  Shield,
  Sparkles,
  X,
  Layers,
  CalendarDays,
  Info,
  CalendarRange,
} from 'lucide-react';

export interface InstrumentDetailModalProps {
  instrument: Instrument;
  allInstruments: Instrument[];
  initialDate?: string;
  onClose: () => void;
  onSelectSlot: (instrument: Instrument, date: string, timeHhmm: string, durationHours: number) => void;
}

// 30-min intervals 09:00 to 22:00
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

function hhmmToMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
}

export const InstrumentDetailModal: React.FC<InstrumentDetailModalProps> = ({
  instrument,
  allInstruments,
  initialDate,
  onClose,
  onSelectSlot,
}) => {
  const { profile } = useAuth();

  // View mode: 'daily' | 'weekly' | 'monthly'
  const [viewMode, setViewMode] = useState<'daily' | 'weekly' | 'monthly'>('daily');

  // Navigation anchors
  const [selectedDate, setSelectedDate] = useState<string>(() => {
    return initialDate || new Date().toISOString().split('T')[0];
  });

  // Current month anchor for monthly view
  const [currentMonthDate, setCurrentMonthDate] = useState<Date>(() => {
    const d = initialDate ? new Date(initialDate) : new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });

  // Approved reservations list for this instrument
  const [approvedReservations, setApprovedReservations] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  // Fetch approved reservations for this specific instrument
  const fetchReservations = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/reservations?instrumentId=${instrument.id}&status=approved`);
      const data = await res.json();
      if (data.success && Array.isArray(data.reservations)) {
        setApprovedReservations(data.reservations);
      }
    } catch (err) {
      console.error('Failed to load reservations for instrument:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReservations();
  }, [instrument.id]);

  const feeNumber = Number(instrument.outsideFeePerDay || 0);

  // Fallback instrument photo placeholder generator
  const photoUrl =
    instrument.photoUrl ||
    `https://images.unsplash.com/photo-1511192336575-5a79af67a629?auto=format&fit=crop&w=600&q=80`;

  // Helper to check if a specific date and time slot is booked
  const isSlotBooked = (dateStr: string, slotHhmm: string) => {
    const [y, m, d] = dateStr.split('-').map(Number);
    const [h, min] = slotHhmm.split(':').map(Number);
    const slotStart = new Date(Date.UTC(y, m - 1, d, h, min, 0, 0));
    const slotEnd = new Date(slotStart.getTime() + 30 * 60 * 1000);

    return approvedReservations.some((res) => {
      const resStart = new Date(res.start_time || res.startTime);
      const resEnd = new Date(res.end_time || res.endTime);
      return slotStart < resEnd && resStart < slotEnd;
    });
  };

  // -------------------------------------------------------------
  // WEEKLY VIEW CALCULATIONS (7 days around or starting from selectedDate)
  // -------------------------------------------------------------
  const weekDays = useMemo(() => {
    const [y, m, d] = selectedDate.split('-').map(Number);
    const base = new Date(Date.UTC(y, m - 1, d));
    // Find Monday of the current week
    const dayOfWeek = base.getUTCDay(); // 0 is Sunday, 1 is Monday...
    const diffToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    const monday = new Date(base.getTime() + diffToMonday * 86400000);

    const days: { dateStr: string; dayName: string; dayNum: number; isSelected: boolean }[] = [];
    for (let i = 0; i < 7; i++) {
      const dayDate = new Date(monday.getTime() + i * 86400000);
      const dateStr = dayDate.toISOString().split('T')[0];
      days.push({
        dateStr,
        dayName: dayDate.toLocaleDateString('en-US', { weekday: 'short', timeZone: 'UTC' }),
        dayNum: dayDate.getUTCDate(),
        isSelected: dateStr === selectedDate,
      });
    }
    return days;
  }, [selectedDate]);

  // -------------------------------------------------------------
  // MONTHLY VIEW CALCULATIONS (Month grid with density indicators)
  // -------------------------------------------------------------
  const monthCalendarData = useMemo(() => {
    const year = currentMonthDate.getFullYear();
    const month = currentMonthDate.getMonth();

    const firstDayOfMonth = new Date(year, month, 1);
    const lastDayOfMonth = new Date(year, month + 1, 0);

    const startingDayOfWeek = firstDayOfMonth.getDay(); // 0 is Sunday
    const daysInMonth = lastDayOfMonth.getDate();

    const cells: {
      dateStr: string;
      dayNumber: number;
      isCurrentMonth: boolean;
      approvedCount: number;
      isToday: boolean;
    }[] = [];

    const todayStr = new Date().toISOString().split('T')[0];

    // Padding previous month days
    for (let i = 0; i < startingDayOfWeek; i++) {
      const prevDate = new Date(year, month, -startingDayOfWeek + i + 1);
      const dateStr = prevDate.toISOString().split('T')[0];
      cells.push({
        dateStr,
        dayNumber: prevDate.getDate(),
        isCurrentMonth: false,
        approvedCount: 0,
        isToday: dateStr === todayStr,
      });
    }

    // Current month days
    for (let day = 1; day <= daysInMonth; day++) {
      const thisDate = new Date(Date.UTC(year, month, day));
      const dateStr = thisDate.toISOString().split('T')[0];

      // Count approved reservations on this date
      const dayStart = new Date(Date.UTC(year, month, day, 0, 0, 0));
      const dayEnd = new Date(Date.UTC(year, month, day, 23, 59, 59));

      const count = approvedReservations.filter((res) => {
        const rStart = new Date(res.start_time || res.startTime);
        const rEnd = new Date(res.end_time || res.endTime);
        return dayStart < rEnd && rStart < dayEnd;
      }).length;

      cells.push({
        dateStr,
        dayNumber: day,
        isCurrentMonth: true,
        approvedCount: count,
        isToday: dateStr === todayStr,
      });
    }

    return cells;
  }, [currentMonthDate, approvedReservations]);

  // Date Navigation Handlers
  const handlePrevDay = () => {
    const [y, m, d] = selectedDate.split('-').map(Number);
    const prev = new Date(Date.UTC(y, m - 1, d - 1));
    setSelectedDate(prev.toISOString().split('T')[0]);
  };

  const handleNextDay = () => {
    const [y, m, d] = selectedDate.split('-').map(Number);
    const next = new Date(Date.UTC(y, m - 1, d + 1));
    setSelectedDate(next.toISOString().split('T')[0]);
  };

  const handlePrevWeek = () => {
    const [y, m, d] = selectedDate.split('-').map(Number);
    const prev = new Date(Date.UTC(y, m - 1, d - 7));
    setSelectedDate(prev.toISOString().split('T')[0]);
  };

  const handleNextWeek = () => {
    const [y, m, d] = selectedDate.split('-').map(Number);
    const next = new Date(Date.UTC(y, m - 1, d + 7));
    setSelectedDate(next.toISOString().split('T')[0]);
  };

  const handlePrevMonth = () => {
    setCurrentMonthDate(
      new Date(currentMonthDate.getFullYear(), currentMonthDate.getMonth() - 1, 1)
    );
  };

  const handleNextMonth = () => {
    setCurrentMonthDate(
      new Date(currentMonthDate.getFullYear(), currentMonthDate.getMonth() + 1, 1)
    );
  };

  return (
    <div
      id="instrument-detail-modal-backdrop"
      className="fixed inset-0 z-50 bg-stone-900/60 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 overflow-y-auto"
    >
      <div
        id="instrument-detail-modal"
        className="bg-white rounded-3xl border border-stone-200 shadow-2xl max-w-4xl w-full my-auto overflow-hidden animate-in fade-in zoom-in-95 duration-150 max-h-[92vh] flex flex-col"
      >
        {/* ========================================================= */}
        {/* MODAL TOP BAR & CLOSE */}
        {/* ========================================================= */}
        <div className="bg-stone-900 text-white px-5 sm:px-6 py-4 flex items-center justify-between border-b border-stone-800 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-2xl bg-amber-800 text-amber-100 flex items-center justify-center font-bold shadow-xs">
              <Music2 className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm sm:text-base font-bold text-white leading-tight">
                {instrument.name}
              </h2>
              <p className="text-[11px] text-stone-400">
                Instrument Details & Dedicated Availability (Screen 4)
              </p>
            </div>
          </div>

          <button
            id="btn-close-instrument-detail"
            onClick={onClose}
            className="w-8 h-8 rounded-xl bg-stone-800 text-stone-400 hover:text-white hover:bg-stone-700 flex items-center justify-center transition cursor-pointer"
            aria-label="Close modal"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Scrollable Content Container */}
        <div className="overflow-y-auto p-5 sm:p-6 space-y-6 flex-1">
          {/* ========================================================= */}
          {/* HEADER: NAME, TYPE, DESCRIPTION, PHOTO & BADGES */}
          {/* ========================================================= */}
          <div className="bg-stone-50 border border-stone-200 rounded-2xl p-4 sm:p-5 flex flex-col sm:flex-row gap-5 items-start">
            {/* Instrument Photo */}
            <div className="w-full sm:w-44 h-36 rounded-2xl overflow-hidden bg-stone-200 border border-stone-300 shrink-0 relative shadow-inner">
              <img
                src={photoUrl}
                alt={instrument.name}
                referrerPolicy="no-referrer"
                className="w-full h-full object-cover"
                onError={(e) => {
                  (e.currentTarget as HTMLImageElement).src =
                    'https://images.unsplash.com/photo-1511192336575-5a79af67a629?auto=format&fit=crop&w=600&q=80';
                }}
              />
              <div className="absolute top-2 left-2 px-2 py-0.5 rounded-lg bg-stone-900/80 backdrop-blur-xs text-white text-[10px] font-bold">
                {instrument.type}
              </div>
            </div>

            {/* Instrument Info & Badges */}
            <div className="space-y-2.5 flex-1">
              <div>
                <div className="flex flex-wrap items-center gap-2 mb-1">
                  <h1 className="text-lg font-bold text-stone-900">
                    {instrument.name}
                  </h1>

                  {/* Matching Screen 2 Badges */}
                  <span
                    className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold uppercase tracking-wider ${
                      instrument.bookingMode === 'instant'
                        ? 'bg-emerald-100 text-emerald-900 border border-emerald-200'
                        : 'bg-amber-100 text-amber-900 border border-amber-200'
                    }`}
                  >
                    <Shield className="w-3 h-3" />
                    {instrument.bookingMode === 'instant' ? 'Instant Booking' : 'Manual Approval'}
                  </span>

                  {feeNumber > 0 && (
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-purple-100 text-purple-900 border border-purple-200">
                      <DollarSign className="w-3 h-3" />
                      Outside Fee: EGP {feeNumber} / day
                    </span>
                  )}
                </div>

                <p className="text-xs text-stone-600 leading-relaxed">
                  {instrument.description ||
                    'Church sanctuary instrument available for liturgical services, rehearsals, and approved ministries.'}
                </p>
              </div>

              {/* Quick Meta Stats */}
              <div className="pt-2 border-t border-stone-200 flex flex-wrap items-center gap-4 text-xs text-stone-500">
                <div className="flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-stone-400" />
                  <span>Hours: 09:00 AM – 10:00 PM</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <CalendarIcon className="w-3.5 h-3.5 text-stone-400" />
                  <span>30-min booking intervals</span>
                </div>
              </div>
            </div>
          </div>

          {/* ========================================================= */}
          {/* VIEW MODE TOGGLE & NAVIGATION BAR */}
          {/* ========================================================= */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-2 rounded-2xl border border-stone-200 shadow-2xs">
            {/* View Mode Toggle: Daily / Weekly / Monthly */}
            <div className="inline-flex p-1 bg-stone-100 rounded-xl border border-stone-200">
              <button
                type="button"
                id="btn-view-daily"
                onClick={() => setViewMode('daily')}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${
                  viewMode === 'daily'
                    ? 'bg-white text-stone-900 shadow-xs'
                    : 'text-stone-600 hover:text-stone-900'
                }`}
              >
                <Clock className="w-3.5 h-3.5" />
                <span>Daily</span>
              </button>

              <button
                type="button"
                id="btn-view-weekly"
                onClick={() => setViewMode('weekly')}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${
                  viewMode === 'weekly'
                    ? 'bg-white text-stone-900 shadow-xs'
                    : 'text-stone-600 hover:text-stone-900'
                }`}
              >
                <CalendarRange className="w-3.5 h-3.5" />
                <span>Weekly</span>
              </button>

              <button
                type="button"
                id="btn-view-monthly"
                onClick={() => setViewMode('monthly')}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${
                  viewMode === 'monthly'
                    ? 'bg-white text-stone-900 shadow-xs'
                    : 'text-stone-600 hover:text-stone-900'
                }`}
              >
                <CalendarDays className="w-3.5 h-3.5" />
                <span>Monthly</span>
              </button>
            </div>

            {/* Date Navigator depending on View */}
            <div className="flex items-center gap-2">
              {viewMode === 'daily' && (
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handlePrevDay}
                    className="p-1.5 rounded-lg bg-stone-100 hover:bg-stone-200 text-stone-700 transition cursor-pointer"
                    title="Previous Day"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <input
                    type="date"
                    value={selectedDate}
                    onChange={(e) => setSelectedDate(e.target.value)}
                    className="bg-stone-50 border border-stone-300 rounded-xl px-3 py-1.5 text-xs font-bold text-stone-900 focus:outline-none focus:ring-2 focus:ring-amber-800/30"
                  />
                  <button
                    type="button"
                    onClick={handleNextDay}
                    className="p-1.5 rounded-lg bg-stone-100 hover:bg-stone-200 text-stone-700 transition cursor-pointer"
                    title="Next Day"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              )}

              {viewMode === 'weekly' && (
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handlePrevWeek}
                    className="p-1.5 rounded-lg bg-stone-100 hover:bg-stone-200 text-stone-700 transition cursor-pointer"
                    title="Previous Week"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <span className="text-xs font-bold text-stone-800 px-2 py-1 bg-stone-50 rounded-lg border border-stone-200">
                    Week of {weekDays[0]?.dateStr}
                  </span>
                  <button
                    type="button"
                    onClick={handleNextWeek}
                    className="p-1.5 rounded-lg bg-stone-100 hover:bg-stone-200 text-stone-700 transition cursor-pointer"
                    title="Next Week"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              )}

              {viewMode === 'monthly' && (
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handlePrevMonth}
                    className="p-1.5 rounded-lg bg-stone-100 hover:bg-stone-200 text-stone-700 transition cursor-pointer"
                    title="Previous Month"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <span className="text-xs font-bold text-stone-800 px-2 py-1 bg-stone-50 rounded-lg border border-stone-200">
                    {currentMonthDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                  </span>
                  <button
                    type="button"
                    onClick={handleNextMonth}
                    className="p-1.5 rounded-lg bg-stone-100 hover:bg-stone-200 text-stone-700 transition cursor-pointer"
                    title="Next Month"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* ========================================================= */}
          {/* 1. DAILY VIEW GRID (30-min intervals, 09:00 - 22:00) */}
          {/* ========================================================= */}
          {viewMode === 'daily' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between text-xs text-stone-500">
                <span className="font-semibold text-stone-800">
                  Schedule for {selectedDate}
                </span>
                <span className="flex items-center gap-2">
                  <span className="inline-block w-2.5 h-2.5 rounded-sm bg-stone-200 border border-stone-300" />
                  <span>Free</span>
                  <span className="inline-block w-2.5 h-2.5 rounded-sm bg-amber-800" />
                  <span>Booked (Privacy Protected)</span>
                </span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-2">
                {TIME_SLOTS.slice(0, -1).map((slotHhmm) => {
                  const booked = isSlotBooked(selectedDate, slotHhmm);

                  return (
                    <button
                      key={slotHhmm}
                      type="button"
                      disabled={booked}
                      onClick={() => {
                        if (!booked) {
                          onSelectSlot(instrument, selectedDate, slotHhmm, 2);
                        }
                      }}
                      className={`p-3 rounded-xl border text-left transition relative flex flex-col justify-between h-18 select-none ${
                        booked
                          ? 'bg-amber-900/90 text-white border-amber-950 cursor-not-allowed shadow-inner opacity-90'
                          : 'bg-white hover:bg-amber-50/60 hover:border-amber-700 border-stone-200 text-stone-800 cursor-pointer shadow-2xs hover:shadow-xs'
                      }`}
                    >
                      <div className="flex items-center justify-between w-full">
                        <span className={`text-[11px] font-bold ${booked ? 'text-amber-100' : 'text-stone-900'}`}>
                          {formatHhmmTo12Hour(slotHhmm)}
                        </span>
                        {booked ? (
                          <span className="w-2 h-2 rounded-full bg-amber-400 shrink-0" />
                        ) : (
                          <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
                        )}
                      </div>

                      <div className="text-[10px] font-medium">
                        {booked ? (
                          <span className="text-amber-200 uppercase tracking-wider font-bold text-[9px]">
                            Reserved
                          </span>
                        ) : (
                          <span className="text-stone-400 group-hover:text-amber-800">
                            Available • Tap
                          </span>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* ========================================================= */}
          {/* 2. WEEKLY VIEW GRID (7-day columns x 30-min intervals) */}
          {/* ========================================================= */}
          {viewMode === 'weekly' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between text-xs text-stone-500">
                <span className="font-semibold text-stone-800">
                  7-Day Availability Grid
                </span>
                <span className="text-[11px] text-stone-400">
                  Tap any available slot to create reservation
                </span>
              </div>

              <div className="border border-stone-200 rounded-2xl overflow-x-auto bg-white shadow-2xs">
                <div className="min-w-[640px]">
                  {/* Day Headers */}
                  <div className="grid grid-cols-8 border-b border-stone-200 bg-stone-50 text-center text-xs font-bold text-stone-800">
                    <div className="p-2.5 text-stone-400 border-r border-stone-200 text-[11px]">
                      Time (UTC)
                    </div>
                    {weekDays.map((d) => (
                      <div
                        key={d.dateStr}
                        className={`p-2.5 border-r last:border-r-0 border-stone-200 ${
                          d.isSelected ? 'bg-amber-100/60 text-amber-950 font-extrabold' : ''
                        }`}
                      >
                        <div className="text-[10px] text-stone-500 uppercase">{d.dayName}</div>
                        <div>{d.dateStr.slice(5)}</div>
                      </div>
                    ))}
                  </div>

                  {/* Time rows */}
                  <div className="divide-y divide-stone-100 max-h-[380px] overflow-y-auto">
                    {TIME_SLOTS.slice(0, -1).map((slotHhmm) => (
                      <div key={slotHhmm} className="grid grid-cols-8 text-center text-xs">
                        {/* Time Column */}
                        <div className="p-2 text-[11px] font-semibold text-stone-500 bg-stone-50/50 border-r border-stone-200 flex items-center justify-center">
                          {formatHhmmTo12Hour(slotHhmm)}
                        </div>

                        {/* 7 Days for this time */}
                        {weekDays.map((d) => {
                          const booked = isSlotBooked(d.dateStr, slotHhmm);
                          return (
                            <button
                              key={d.dateStr}
                              type="button"
                              disabled={booked}
                              onClick={() => {
                                if (!booked) {
                                  onSelectSlot(instrument, d.dateStr, slotHhmm, 2);
                                }
                              }}
                              className={`p-2 border-r last:border-r-0 border-stone-100 transition h-10 flex items-center justify-center select-none ${
                                booked
                                  ? 'bg-amber-900 text-white cursor-not-allowed font-bold text-[10px]'
                                  : 'bg-white hover:bg-amber-100/50 text-stone-300 hover:text-amber-900 cursor-pointer'
                              }`}
                            >
                              {booked ? (
                                <span className="w-2 h-2 rounded-full bg-amber-400" />
                              ) : (
                                <span className="text-[10px] opacity-0 hover:opacity-100 font-bold">+</span>
                              )}
                            </button>
                          );
                        })}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ========================================================= */}
          {/* 3. MONTHLY VIEW GRID (Day cells with density indicators) */}
          {/* ========================================================= */}
          {viewMode === 'monthly' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between text-xs text-stone-500">
                <span className="font-semibold text-stone-800">
                  Month Overview ({currentMonthDate.toLocaleDateString('en-US', { month: 'long' })})
                </span>
                <span className="text-[11px] text-stone-400">
                  Select a day to jump into its daily time slot schedule
                </span>
              </div>

              <div className="border border-stone-200 rounded-2xl overflow-hidden bg-white shadow-2xs">
                {/* Day of week headers */}
                <div className="grid grid-cols-7 border-b border-stone-200 bg-stone-50 text-center text-[11px] font-bold text-stone-600 py-2">
                  <div>Sun</div>
                  <div>Mon</div>
                  <div>Tue</div>
                  <div>Wed</div>
                  <div>Thu</div>
                  <div>Fri</div>
                  <div>Sat</div>
                </div>

                {/* Month Grid Cells */}
                <div className="grid grid-cols-7 divide-x divide-y divide-stone-100">
                  {monthCalendarData.map((cell, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => {
                        setSelectedDate(cell.dateStr);
                        setViewMode('daily');
                      }}
                      className={`p-3 min-h-[70px] text-left transition flex flex-col justify-between cursor-pointer hover:bg-amber-50/50 ${
                        !cell.isCurrentMonth
                          ? 'bg-stone-50/40 text-stone-300 opacity-60'
                          : cell.isToday
                          ? 'bg-amber-50/40 text-stone-900 font-bold'
                          : 'bg-white text-stone-800'
                      }`}
                    >
                      <div className="flex items-center justify-between w-full">
                        <span
                          className={`text-xs font-bold ${
                            cell.isToday
                              ? 'w-5 h-5 rounded-full bg-amber-800 text-white flex items-center justify-center text-[10px]'
                              : ''
                          }`}
                        >
                          {cell.dayNumber}
                        </span>

                        {cell.approvedCount > 0 && (
                          <span className="px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-amber-800 text-amber-100">
                            {cell.approvedCount} booked
                          </span>
                        )}
                      </div>

                      {/* Density Dots */}
                      <div className="flex items-center gap-1 pt-1">
                        {cell.approvedCount > 0 ? (
                          <div className="flex items-center gap-0.5">
                            {Array.from({ length: Math.min(cell.approvedCount, 4) }).map((_, dotIdx) => (
                              <span key={dotIdx} className="w-1.5 h-1.5 rounded-full bg-amber-800" />
                            ))}
                            {cell.approvedCount > 4 && (
                              <span className="text-[9px] text-amber-800 font-bold">+</span>
                            )}
                          </div>
                        ) : cell.isCurrentMonth ? (
                          <span className="text-[9px] text-emerald-600 font-medium">Available</span>
                        ) : null}
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-4 bg-stone-50 border-t border-stone-200 flex items-center justify-between text-xs text-stone-500 shrink-0">
          <div className="flex items-center gap-2">
            <Info className="w-4 h-4 text-stone-400" />
            <span>Strict privacy: Booking details & reserved users are hidden.</span>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2.5 bg-stone-900 hover:bg-stone-800 text-white font-bold rounded-xl transition cursor-pointer shadow-xs"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
