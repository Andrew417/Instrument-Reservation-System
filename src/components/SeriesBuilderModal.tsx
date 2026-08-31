import React, { useState, useEffect, useMemo } from 'react';
import { Instrument } from './AvailabilityCalendar.tsx';
import { useAuth } from '../contexts/AuthContext.tsx';
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
  Plus,
  Trash2,
  ArrowRight,
  ChevronRight,
  Layers,
  Info,
} from 'lucide-react';

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
  initialDate: string; // 'YYYY-MM-DD'
  initialTimeHhmm: string; // 'HH:mm'
  initialDuration?: number; // hours
  initialReservationType?: 'in_church' | 'outside_church';
  onClose: () => void;
  onSuccess: (seriesData: any) => void;
}

interface ConflictDetail {
  type: 'existing_reservation' | 'self_overlap' | 'working_hours';
  occurrenceIndex: number;
  occurrenceDate: string;
  occurrenceTime: string;
  message: string;
}

export const SeriesBuilderModal: React.FC<SeriesBuilderModalProps> = ({
  initialInstrument,
  allInstruments,
  initialServiceName = '',
  initialDate,
  initialTimeHhmm,
  initialDuration = 2,
  initialReservationType = 'in_church',
  onClose,
  onSuccess,
}) => {
  const { profile, sessionToken } = useAuth();

  // Core Series State
  const [selectedInstrumentId, setSelectedInstrumentId] = useState<string>(initialInstrument.id);
  const [serviceName, setServiceName] = useState<string>(initialServiceName);
  const [reservationType, setReservationType] = useState<'in_church' | 'outside_church'>(initialReservationType);
  const [feeAcknowledged, setFeeAcknowledged] = useState<boolean>(false);

  // Pattern Selection: 'weekly' | 'custom'
  const [patternType, setPatternType] = useState<'weekly' | 'custom'>('weekly');

  // Base Schedule
  const [baseDate, setBaseDate] = useState<string>(initialDate);
  const [baseStartTime, setBaseStartTime] = useState<string>(initialTimeHhmm || '10:00');
  const [baseDuration, setBaseDuration] = useState<number>(initialDuration);

  // Weekly Pattern Settings
  const [weeklyInterval, setWeeklyInterval] = useState<number>(1); // Every 1 week, 2 weeks, etc.
  const [weeklyCount, setWeeklyCount] = useState<number>(4); // Default 4 occurrences

  // Custom Pattern Specific Dates List
  const [customDates, setCustomDates] = useState<string[]>([initialDate]);
  const [newCustomDateInput, setNewCustomDateInput] = useState<string>('');

  // Runtime Hard Limits
  const [maxSeriesLimit, setMaxSeriesLimit] = useState<number>(8);
  const [isLoadingLimits, setIsLoadingLimits] = useState<boolean>(true);

  // Existing Approved Reservations cache for conflict checking
  const [approvedReservations, setApprovedReservations] = useState<any[]>([]);
  const [isLoadingReservations, setIsLoadingReservations] = useState<boolean>(false);

  // Submission State & Result
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [seriesResult, setSeriesResult] = useState<{
    series: any;
    occurrences: Array<{
      reservation: any;
      evaluation: {
        status: 'approved' | 'pending';
        reasons: string[];
        outsideFeeSnapshot: string | null;
        startTimeUtc: string;
        endTimeUtc: string;
      };
    }>;
  } | null>(null);

  const currentInstrument =
    allInstruments.find((i) => i.id === selectedInstrumentId) || initialInstrument;
  const feeNumber = Number(currentInstrument.outsideFeePerDay || 0);

  // 1. Fetch runtime hard limits from /api/reservations/limits
  useEffect(() => {
    let isMounted = true;
    async function fetchLimits() {
      try {
        const res = await fetch('/api/reservations/limits');
        const data = await res.json();
        if (isMounted && data.success && data.limits?.maxSeriesOccurrences) {
          setMaxSeriesLimit(data.limits.maxSeriesOccurrences);
        }
      } catch (err) {
        console.error('Failed to load runtime limits, defaulting to 8:', err);
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
        const res = await fetch(`/api/reservations?instrumentId=${currentInstrument.id}&status=approved`);
        const data = await res.json();
        if (isMounted && data.success && Array.isArray(data.reservations)) {
          setApprovedReservations(data.reservations);
        }
      } catch (err) {
        console.error('Failed to fetch existing reservations:', err);
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
      const [h, m] = startHhmm.split(':').map(Number);
      const totalMinutes = h * 60 + m + Math.round(durationHours * 60);
      const endH = Math.floor(totalMinutes / 60);
      const endM = totalMinutes % 60;
      return `${String(endH).padStart(2, '0')}:${String(endM).padStart(2, '0')}`;
    } catch {
      return '--:--';
    }
  };

  // 4. Compute the active list of occurrences
  const generatedOccurrences: OccurrenceItem[] = useMemo(() => {
    if (patternType === 'weekly') {
      const list: OccurrenceItem[] = [];
      const count = Math.min(weeklyCount, maxSeriesLimit);
      const [y, m, d] = baseDate.split('-').map(Number);

      for (let i = 0; i < count; i++) {
        const occDate = new Date(Date.UTC(y, m - 1, d + i * 7 * weeklyInterval));
        const dateStr = occDate.toISOString().split('T')[0];
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
  }, [patternType, baseDate, baseStartTime, baseDuration, weeklyInterval, weeklyCount, customDates, maxSeriesLimit]);

  // 5. Real-Time Multi-Check Conflict Detection
  const conflicts: ConflictDetail[] = useMemo(() => {
    const list: ConflictDetail[] = [];

    // Parse all occurrences to UTC Date ranges
    const parsed = generatedOccurrences.map((occ, idx) => {
      const [y, m, d] = occ.date.split('-').map(Number);
      const [h, min] = occ.startTime.split(':').map(Number);
      const start = new Date(Date.UTC(y, m - 1, d, h, min, 0, 0));
      const end = new Date(start.getTime() + Math.round(occ.duration * 3600 * 1000));
      return { ...occ, start, end, index: idx + 1 };
    });

    // Check A: Working Hours (09:00 - 22:00 UTC)
    parsed.forEach((occ) => {
      const startHour = occ.start.getUTCHours() + occ.start.getUTCMinutes() / 60;
      const endHour = occ.end.getUTCHours() + occ.end.getUTCMinutes() / 60;
      if (startHour < 9 || endHour > 22 || startHour >= endHour) {
        list.push({
          type: 'working_hours',
          occurrenceIndex: occ.index,
          occurrenceDate: occ.date,
          occurrenceTime: `${occ.startTime} - ${calculateEndTime(occ.startTime, occ.duration)}`,
          message: `Occurrence #${occ.index} (${occ.date} ${occ.startTime}) falls outside church hours (09:00 - 22:00).`,
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
            type: 'self_overlap',
            occurrenceIndex: a.index,
            occurrenceDate: a.date,
            occurrenceTime: `${a.startTime} - ${calculateEndTime(a.startTime, a.duration)}`,
            message: `Occurrence #${a.index} (${a.date} ${a.startTime}) self-overlaps with Occurrence #${b.index} (${b.date} ${b.startTime}).`,
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
          const resStartHhmm = res.start_hhmm || resStart.toISOString().substring(11, 16);
          const resEndHhmm = res.end_hhmm || resEnd.toISOString().substring(11, 16);
          list.push({
            type: 'existing_reservation',
            occurrenceIndex: occ.index,
            occurrenceDate: occ.date,
            occurrenceTime: `${occ.startTime} - ${calculateEndTime(occ.startTime, occ.duration)} UTC`,
            message: `Occurrence #${occ.index} (${occ.date} ${occ.startTime}) conflicts with existing reservation (${resStartHhmm} - ${resEndHhmm} UTC).`,
          });
        }
      }
    });

    return list;
  }, [generatedOccurrences, approvedReservations]);

  // Handle Custom Date Add
  const handleAddCustomDate = () => {
    if (!newCustomDateInput) return;
    if (customDates.includes(newCustomDateInput)) {
      setSubmitError('This date is already in your custom list.');
      return;
    }
    if (customDates.length >= maxSeriesLimit) {
      setSubmitError(`Maximum series occurrences limit of ${maxSeriesLimit} reached.`);
      return;
    }
    setSubmitError(null);
    setCustomDates([...customDates, newCustomDateInput].sort());
    setNewCustomDateInput('');
  };

  const handleRemoveCustomDate = (dateToRemove: string) => {
    if (customDates.length <= 1) {
      setSubmitError('Series must have at least one occurrence.');
      return;
    }
    setSubmitError(null);
    setCustomDates(customDates.filter((d) => d !== dateToRemove));
  };

  // Submit Recurring Series to Backend
  const handleSubmitSeries = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!profile) {
      setSubmitError('You must be signed in to create a series.');
      return;
    }

    if (!serviceName.trim()) {
      setSubmitError('Please enter what this series is for (e.g. Sunday Morning Worship, Choir Rehearsals).');
      return;
    }

    if (generatedOccurrences.length === 0) {
      setSubmitError('Please configure at least one occurrence.');
      return;
    }

    if (generatedOccurrences.length > maxSeriesLimit) {
      setSubmitError(`Series exceeds maximum allowed occurrences of ${maxSeriesLimit}.`);
      return;
    }

    if (conflicts.length > 0) {
      setSubmitError('Cannot submit: Please resolve all conflicts first.');
      return;
    }

    if (reservationType === 'outside_church' && !feeAcknowledged) {
      setSubmitError('Please acknowledge the outside-church fee agreement before proceeding.');
      return;
    }

    setIsSubmitting(true);
    setSubmitError(null);

    try {
      const isAdminRole = profile.role === 'admin' || profile.role === 'super_admin';
      const payload = {
        userId: isAdminRole ? null : profile.id,
        adminId: isAdminRole ? profile.id : null,
        instrumentId: currentInstrument.id,
        serviceName: serviceName.trim(),
        patternType,
        reservationType,
        feeAcknowledged: reservationType === 'outside_church' ? feeAcknowledged : false,
        occurrences: generatedOccurrences.map((occ) => ({
          date: occ.date,
          startTime: occ.startTime,
          duration: occ.duration,
        })),
      };

      const res = await fetch('/api/reservations/series', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${sessionToken}`,
        },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        setSubmitError(data.error || 'Failed to create recurring series.');
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
      setSubmitError(err.message || 'Network error occurred while creating series.');
      setIsSubmitting(false);
    }
  };

  const isAtMaxLimit = generatedOccurrences.length >= maxSeriesLimit;
  const hasConflicts = conflicts.length > 0;

  return (
    <div
      id="series-builder-modal-backdrop"
      className="fixed inset-0 z-50 bg-stone-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto"
    >
      <div
        id="series-builder-modal"
        className="bg-white rounded-3xl border border-stone-200 shadow-2xl max-w-2xl w-full my-auto overflow-hidden animate-in fade-in zoom-in-95 duration-150"
      >
        {/* Header */}
        <div className="bg-stone-900 text-white px-6 py-5 flex items-center justify-between border-b border-stone-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-800 text-amber-100 flex items-center justify-center font-bold shadow-xs">
              <Repeat className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white leading-tight">
                {seriesResult ? 'Series Confirmation' : 'Recurring Series Builder'}
              </h2>
              <p className="text-xs text-stone-400">
                {seriesResult
                  ? 'Multi-date recurring schedule submitted'
                  : 'Build and validate multi-session series'}
              </p>
            </div>
          </div>

          <button
            id="btn-close-series-modal"
            onClick={onClose}
            className="w-8 h-8 rounded-xl bg-stone-800 text-stone-400 hover:text-white hover:bg-stone-700 flex items-center justify-center transition cursor-pointer"
            aria-label="Close modal"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* ------------------------------------------------------------- */}
        {/* RESULT / CONFIRMATION VIEW (Per-occurrence breakdown) */}
        {/* ------------------------------------------------------------- */}
        {seriesResult ? (
          <div className="p-6 sm:p-8 space-y-6">
            {/* Series Summary Banner */}
            <div className="bg-stone-50 border border-stone-200 rounded-2xl p-5 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-xs text-stone-500 font-medium block">What this series is for:</span>
                  <span className="font-bold text-stone-900 text-sm">{serviceName}</span>
                </div>
                <div className="text-right">
                  <span className="text-xs text-stone-500 font-medium block">Instrument:</span>
                  <span className="font-bold text-amber-900 text-xs">{currentInstrument.name}</span>
                </div>
              </div>

              <div className="pt-2 border-t border-stone-200 flex flex-wrap items-center justify-between text-xs text-stone-600 gap-2">
                <div>
                  <span>Pattern: </span>
                  <strong className="capitalize text-stone-900">{seriesResult.series.patternType}</strong>
                  <span> ({seriesResult.occurrences.length} occurrences)</span>
                </div>
                <div className="font-mono text-[11px] text-stone-500">
                  Series ID: {seriesResult.series.id.substring(0, 13)}...
                </div>
              </div>

              {/* Outside church WhatsApp notification message */}
              {reservationType === 'outside_church' && (
                <div className="bg-amber-100/70 border border-amber-300 rounded-xl p-3 text-xs text-amber-950 font-medium flex items-start gap-2.5 mt-2">
                  <div className="w-5 h-5 rounded-full bg-emerald-600 text-white flex items-center justify-center shrink-0 mt-0.5 text-[10px] font-bold">
                    WA
                  </div>
                  <p className="leading-relaxed">
                    If your reservation is approved, the admin will contact you on WhatsApp for confirmation and payment.
                  </p>
                </div>
              )}
            </div>

            {/* Per-Occurrence Status Table */}
            <div className="space-y-2">
              <div className="text-xs font-bold text-stone-800 flex items-center justify-between">
                <span>Per-Occurrence Status Breakdown:</span>
                <span className="text-[11px] font-normal text-stone-500">
                  {seriesResult.occurrences.filter((o) => o.evaluation.status === 'approved').length} Approved,{' '}
                  {seriesResult.occurrences.filter((o) => o.evaluation.status === 'pending').length} Pending Review
                </span>
              </div>

              <div className="border border-stone-200 rounded-2xl overflow-hidden divide-y divide-stone-100 max-h-64 overflow-y-auto">
                {seriesResult.occurrences.map((item, idx) => {
                  const isApproved = item.evaluation.status === 'approved';
                  const startUtc = new Date(item.evaluation.startTimeUtc);
                  const endUtc = new Date(item.evaluation.endTimeUtc);
                  const dateStr = startUtc.toISOString().split('T')[0];
                  const timeStr = `${startUtc.toISOString().substring(11, 16)} – ${endUtc.toISOString().substring(11, 16)} UTC`;

                  return (
                    <div key={item.reservation.id || idx} className="p-3.5 bg-white hover:bg-stone-50 transition text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div className="flex items-center gap-3">
                        <div
                          className={`w-7 h-7 rounded-xl flex items-center justify-center font-bold text-xs shrink-0 ${
                            isApproved ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                          }`}
                        >
                          {idx + 1}
                        </div>
                        <div>
                          <div className="font-bold text-stone-900">{dateStr}</div>
                          <div className="text-[11px] text-stone-500">{timeStr}</div>
                        </div>
                      </div>

                      <div className="flex flex-col sm:items-end gap-1">
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold uppercase tracking-wider ${
                            isApproved
                              ? 'bg-emerald-100 text-emerald-900 border border-emerald-200'
                              : 'bg-amber-100 text-amber-900 border border-amber-200'
                          }`}
                        >
                          {isApproved ? (
                            <>
                              <CheckCircle2 className="w-3 h-3 text-emerald-700" />
                              Approved
                            </>
                          ) : (
                            <>
                              <Clock className="w-3 h-3 text-amber-700" />
                              Pending Review
                            </>
                          )}
                        </span>

                        {/* If hard limits or downgrade reason occurred, show reason per occurrence */}
                        {!isApproved && item.evaluation.reasons && item.evaluation.reasons.length > 0 && (
                          <span className="text-[10px] text-amber-800 text-right">
                            {item.evaluation.reasons.join(', ')}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Done Action Button */}
            <div className="pt-2">
              <button
                id="btn-series-done"
                onClick={onClose}
                className="w-full py-3 bg-stone-900 hover:bg-stone-800 text-white text-xs font-bold rounded-2xl transition cursor-pointer shadow-md"
              >
                Done (Return to Calendar)
              </button>
            </div>
          </div>
        ) : (
          /* ------------------------------------------------------------- */
          /* BUILDER CONFIGURATION FORM */
          /* ------------------------------------------------------------- */
          <form onSubmit={handleSubmitSeries} className="p-6 sm:p-7 space-y-6">
            {/* Top Error Notice */}
            {submitError && (
              <div
                id="series-error-banner"
                className="bg-red-50 border border-red-200 rounded-2xl p-4 text-red-900 flex items-start gap-3 animate-in fade-in"
              >
                <AlertCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
                <div className="space-y-1 text-xs">
                  <div className="font-bold text-red-950">Submission Blocked</div>
                  <div className="text-red-800 leading-relaxed">{submitError}</div>
                </div>
              </div>
            )}

            {/* Instrument Header & Occurrence Counter Pill */}
            <div className="flex flex-wrap items-center justify-between gap-3 p-3.5 bg-stone-50 border border-stone-200 rounded-2xl">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-amber-800 text-white flex items-center justify-center font-bold text-xs">
                  <Music2 className="w-4 h-4" />
                </div>
                <div>
                  <span className="text-xs font-bold text-stone-900 block">{currentInstrument.name}</span>
                  <span className="text-[11px] text-stone-500 block capitalize">
                    {currentInstrument.type} • {currentInstrument.bookingMode} mode
                  </span>
                </div>
              </div>

              {/* Dynamic Live Occurrence Counter */}
              <div className="flex items-center gap-2">
                <div
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 border ${
                    isAtMaxLimit
                      ? 'bg-amber-100 text-amber-900 border-amber-300'
                      : 'bg-white text-stone-700 border-stone-200 shadow-2xs'
                  }`}
                >
                  <Layers className="w-3.5 h-3.5 text-stone-500" />
                  <span>
                    {generatedOccurrences.length} / {maxSeriesLimit} Occurrences
                  </span>
                </div>
              </div>
            </div>

            {/* 1. Purpose / Service Name */}
            <div className="space-y-1.5">
              <label htmlFor="series-service-name" className="block text-xs font-bold text-stone-700">
                What is this recurring series for? <span className="text-amber-800 font-bold">*</span>
              </label>
              <input
                id="series-service-name"
                type="text"
                value={serviceName}
                onChange={(e) => setServiceName(e.target.value)}
                placeholder="e.g. Sunday Morning Worship, Youth Choir Practice"
                className="w-full bg-stone-50 border border-stone-300 rounded-2xl px-3.5 py-2.5 text-xs font-medium text-stone-900 placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-amber-800/40 focus:border-amber-800 transition"
                required
              />
            </div>

            {/* 2. Pattern Choice (Weekly vs Custom) */}
            <div className="space-y-2">
              <label className="block text-xs font-bold text-stone-700">Recurrence Pattern</label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  id="btn-pattern-weekly"
                  onClick={() => setPatternType('weekly')}
                  className={`p-3.5 rounded-2xl border text-left transition cursor-pointer flex flex-col justify-between ${
                    patternType === 'weekly'
                      ? 'bg-amber-50/70 border-amber-800 ring-2 ring-amber-800/30'
                      : 'bg-white hover:bg-stone-50 border-stone-200 text-stone-700'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-bold text-xs text-stone-900">Weekly Cadence</span>
                    <Repeat className="w-4 h-4 text-amber-800" />
                  </div>
                  <p className="text-[11px] text-stone-500 leading-tight">
                    Repeats every X weeks on the same day-of-week & time.
                  </p>
                </button>

                <button
                  type="button"
                  id="btn-pattern-custom"
                  onClick={() => setPatternType('custom')}
                  className={`p-3.5 rounded-2xl border text-left transition cursor-pointer flex flex-col justify-between ${
                    patternType === 'custom'
                      ? 'bg-amber-50/70 border-amber-800 ring-2 ring-amber-800/30'
                      : 'bg-white hover:bg-stone-50 border-stone-200 text-stone-700'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-bold text-xs text-stone-900">Custom Dates</span>
                    <Calendar className="w-4 h-4 text-amber-800" />
                  </div>
                  <p className="text-[11px] text-stone-500 leading-tight">
                    Manually pick specific dates sharing the same time & duration.
                  </p>
                </button>
              </div>
            </div>

            {/* 3. Base Time Slot Settings (Applies to all occurrences) */}
            <div className="p-4 bg-stone-50 border border-stone-200 rounded-2xl space-y-3">
              <div className="text-xs font-bold text-stone-900">Base Time & Duration (All Occurrences)</div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {/* Initial Anchor Date */}
                <div>
                  <label className="block text-[11px] font-bold text-stone-600 mb-1">
                    {patternType === 'weekly' ? 'First Session Date' : 'Reference Date'}
                  </label>
                  <input
                    type="date"
                    value={baseDate}
                    onChange={(e) => setBaseDate(e.target.value)}
                    className="w-full bg-white border border-stone-300 rounded-xl px-3 py-2 text-xs font-medium text-stone-900 focus:outline-none focus:ring-2 focus:ring-amber-800/30"
                  />
                </div>

                {/* Start Time */}
                <div>
                  <label className="block text-[11px] font-bold text-stone-600 mb-1">Start Time (UTC)</label>
                  <input
                    type="time"
                    value={baseStartTime}
                    onChange={(e) => setBaseStartTime(e.target.value)}
                    className="w-full bg-white border border-stone-300 rounded-xl px-3 py-2 text-xs font-medium text-stone-900 focus:outline-none focus:ring-2 focus:ring-amber-800/30"
                  />
                </div>

                {/* Duration */}
                <div>
                  <label className="block text-[11px] font-bold text-stone-600 mb-1">
                    Duration ({calculateEndTime(baseStartTime, baseDuration)} UTC)
                  </label>
                  <select
                    value={baseDuration}
                    onChange={(e) => setBaseDuration(Number(e.target.value))}
                    className="w-full bg-white border border-stone-300 rounded-xl px-3 py-2 text-xs font-medium text-stone-900 focus:outline-none focus:ring-2 focus:ring-amber-800/30 cursor-pointer"
                  >
                    <option value={0.5}>30 min</option>
                    <option value={1}>1 hour</option>
                    <option value={1.5}>1.5 hours</option>
                    <option value={2}>2 hours</option>
                    <option value={2.5}>2.5 hours</option>
                    <option value={3}>3 hours</option>
                    <option value={4}>4 hours</option>
                    <option value={5}>5 hours</option>
                  </select>
                </div>
              </div>
            </div>

            {/* 4. Pattern-Specific Controls */}
            {patternType === 'weekly' ? (
              <div className="p-4 bg-amber-50/50 border border-amber-200/80 rounded-2xl space-y-4">
                <div className="text-xs font-bold text-amber-950">Weekly Repeat Configuration</div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[11px] font-bold text-stone-700 mb-1">Repeat Cadence</label>
                    <select
                      value={weeklyInterval}
                      onChange={(e) => setWeeklyInterval(Number(e.target.value))}
                      className="w-full bg-white border border-stone-300 rounded-xl px-3 py-2 text-xs font-medium text-stone-900 focus:outline-none focus:ring-2 focus:ring-amber-800/30"
                    >
                      <option value={1}>Every week (1 week)</option>
                      <option value={2}>Every 2 weeks (Bi-weekly)</option>
                      <option value={3}>Every 3 weeks</option>
                      <option value={4}>Every 4 weeks (Monthly)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-stone-700 mb-1">
                      Total Occurrences (Max {maxSeriesLimit})
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        min={1}
                        max={maxSeriesLimit}
                        value={weeklyCount}
                        onChange={(e) => {
                          const val = Math.min(Math.max(1, Number(e.target.value)), maxSeriesLimit);
                          setWeeklyCount(val);
                        }}
                        className="w-full bg-white border border-stone-300 rounded-xl px-3 py-2 text-xs font-medium text-stone-900 focus:outline-none focus:ring-2 focus:ring-amber-800/30"
                      />
                      <span className="text-xs text-stone-500 font-medium shrink-0">sessions</span>
                    </div>
                  </div>
                </div>

                {weeklyCount >= maxSeriesLimit && (
                  <div className="text-[11px] text-amber-900 bg-amber-100/60 px-3 py-1.5 rounded-xl flex items-center gap-1.5 font-medium">
                    <Info className="w-3.5 h-3.5 shrink-0" />
                    <span>Reached maximum limit of {maxSeriesLimit} series occurrences.</span>
                  </div>
                )}
              </div>
            ) : (
              /* Custom Specific Dates Builder */
              <div className="p-4 bg-stone-50 border border-stone-200 rounded-2xl space-y-4">
                <div className="flex items-center justify-between">
                  <div className="text-xs font-bold text-stone-900">Custom Dates List</div>
                  <span className="text-[11px] text-stone-500">
                    {customDates.length} of {maxSeriesLimit} allowed
                  </span>
                </div>

                {/* Add Custom Date Input */}
                <div className="flex items-center gap-2">
                  <input
                    type="date"
                    value={newCustomDateInput}
                    disabled={isAtMaxLimit}
                    onChange={(e) => setNewCustomDateInput(e.target.value)}
                    className="flex-1 bg-white border border-stone-300 rounded-xl px-3 py-2 text-xs font-medium text-stone-900 focus:outline-none focus:ring-2 focus:ring-amber-800/30 disabled:bg-stone-100 disabled:text-stone-400"
                  />
                  <button
                    type="button"
                    disabled={isAtMaxLimit || !newCustomDateInput}
                    onClick={handleAddCustomDate}
                    className="px-4 py-2 bg-stone-900 hover:bg-stone-800 disabled:bg-stone-300 text-white text-xs font-bold rounded-xl transition flex items-center gap-1.5 cursor-pointer disabled:cursor-not-allowed"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add Date</span>
                  </button>
                </div>

                {isAtMaxLimit && (
                  <div className="text-[11px] text-amber-900 bg-amber-100/60 px-3 py-1.5 rounded-xl flex items-center gap-1.5 font-medium">
                    <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                    <span>Maximum occurrence limit ({maxSeriesLimit}) reached. Remove a date to add another.</span>
                  </div>
                )}

                {/* Custom Dates Chip List */}
                <div className="flex flex-wrap gap-2 max-h-36 overflow-y-auto pt-1">
                  {customDates.map((d, idx) => (
                    <div
                      key={d}
                      className="inline-flex items-center gap-2 px-3 py-1.5 bg-white border border-stone-300 rounded-xl text-xs font-medium text-stone-800 shadow-2xs"
                    >
                      <span>
                        #{idx + 1}: {d}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleRemoveCustomDate(d)}
                        className="text-stone-400 hover:text-red-600 transition cursor-pointer"
                        title="Remove date"
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
              <div className="text-xs font-bold text-stone-800 flex items-center justify-between">
                <span>Calculated Occurrence Schedule:</span>
                <span className="text-[11px] text-stone-500 font-normal">
                  All sessions: {baseStartTime} – {calculateEndTime(baseStartTime, baseDuration)} UTC ({baseDuration}h)
                </span>
              </div>

              <div className="border border-stone-200 rounded-2xl overflow-hidden divide-y divide-stone-100 max-h-40 overflow-y-auto">
                {generatedOccurrences.map((occ, idx) => (
                  <div key={occ.id} className="px-3.5 py-2 bg-white flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2.5">
                      <span className="w-5 h-5 rounded-lg bg-stone-100 text-stone-600 font-bold flex items-center justify-center text-[10px]">
                        {idx + 1}
                      </span>
                      <span className="font-semibold text-stone-900">{occ.date}</span>
                    </div>
                    <span className="text-stone-500 text-[11px]">
                      {occ.startTime} – {calculateEndTime(occ.startTime, occ.duration)} UTC
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* 6. Real-Time Conflict Warning Panel (Listing ALL conflicts) */}
            {hasConflicts && (
              <div
                id="series-conflict-warning-panel"
                className="bg-red-50 border border-red-200 rounded-2xl p-4 space-y-2 animate-in fade-in"
              >
                <div className="flex items-center gap-2 text-red-950 font-bold text-xs">
                  <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
                  <span>
                    Conflicts Detected ({conflicts.length} issue{conflicts.length > 1 ? 's' : ''}) — Submission Disabled
                  </span>
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

            {/* 7. Reservation Usage Type & Fee Agreement */}
            <div className="space-y-2.5">
              <label className="block text-xs font-bold text-stone-700">Usage Type</label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setReservationType('in_church');
                    setFeeAcknowledged(false);
                  }}
                  className={`p-3 rounded-2xl border text-left transition cursor-pointer ${
                    reservationType === 'in_church'
                      ? 'bg-amber-50/70 border-amber-800 ring-2 ring-amber-800/30'
                      : 'bg-white hover:bg-stone-50 border-stone-200 text-stone-700'
                  }`}
                >
                  <div className="flex items-center justify-between mb-0.5">
                    <span className="font-bold text-xs text-stone-900">In-Church Use</span>
                    <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-100 text-emerald-800">
                      Free
                    </span>
                  </div>
                  <p className="text-[10px] text-stone-500">For choir, liturgy, and church services.</p>
                </button>

                <button
                  type="button"
                  onClick={() => setReservationType('outside_church')}
                  className={`p-3 rounded-2xl border text-left transition cursor-pointer ${
                    reservationType === 'outside_church'
                      ? 'bg-purple-50/70 border-purple-800 ring-2 ring-purple-800/30'
                      : 'bg-white hover:bg-stone-50 border-stone-200 text-stone-700'
                  }`}
                >
                  <div className="flex items-center justify-between mb-0.5">
                    <span className="font-bold text-xs text-stone-900">Outside Church</span>
                    <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-purple-100 text-purple-800">
                      EGP {feeNumber}/day
                    </span>
                  </div>
                  <p className="text-[10px] text-stone-500">Off-premises borrow with daily fee.</p>
                </button>
              </div>

              {reservationType === 'outside_church' && (
                <label className="flex items-start gap-2.5 p-3 bg-purple-50 border border-purple-200 rounded-xl cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={feeAcknowledged}
                    onChange={(e) => setFeeAcknowledged(e.target.checked)}
                    className="mt-0.5 w-4 h-4 rounded-md border-purple-300 text-purple-700 focus:ring-purple-600 cursor-pointer"
                  />
                  <span className="text-xs font-semibold text-purple-950">
                    I acknowledge outside usage fee of EGP {feeNumber}/day per occurrence in this series.
                  </span>
                </label>
              )}
            </div>

            {/* Actions */}
            <div className="flex items-center gap-3 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="py-3 px-5 bg-stone-100 hover:bg-stone-200 text-stone-700 text-xs font-bold rounded-2xl transition cursor-pointer"
              >
                Cancel
              </button>

              <button
                type="submit"
                id="btn-submit-series"
                disabled={
                  isSubmitting ||
                  !serviceName.trim() ||
                  hasConflicts ||
                  generatedOccurrences.length === 0 ||
                  (reservationType === 'outside_church' && !feeAcknowledged)
                }
                className={`flex-1 py-3 px-6 rounded-2xl text-xs font-bold text-white transition flex items-center justify-center gap-2 shadow-md cursor-pointer ${
                  isSubmitting ||
                  !serviceName.trim() ||
                  hasConflicts ||
                  generatedOccurrences.length === 0 ||
                  (reservationType === 'outside_church' && !feeAcknowledged)
                    ? 'bg-stone-300 cursor-not-allowed text-stone-500 shadow-none'
                    : 'bg-amber-800 hover:bg-amber-900 active:scale-[0.99]'
                }`}
              >
                {isSubmitting ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    <span>Creating {generatedOccurrences.length}-Part Series...</span>
                  </>
                ) : (
                  <>
                    <span>Submit Recurring Series ({generatedOccurrences.length} Sessions)</span>
                    <ArrowRight className="w-4 h-4" />
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
