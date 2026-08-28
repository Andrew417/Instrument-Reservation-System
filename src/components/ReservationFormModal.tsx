import React, { useState, useEffect } from 'react';
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
  Info,
  ChevronRight,
  ArrowRight,
  ExternalLink,
} from 'lucide-react';

export interface ReservationFormProps {
  initialInstrument: Instrument;
  allInstruments: Instrument[];
  initialDate: string; // 'YYYY-MM-DD'
  initialTimeHhmm: string; // 'HH:mm'
  initialDuration?: number; // hours
  onClose: () => void;
  onSuccess: (reservationData: any) => void;
  onOpenSeriesBuilder?: (prefill: {
    instrument: Instrument;
    serviceName: string;
    date: string;
    startTime: string;
    duration: number;
    reservationType: 'in_church' | 'outside_church';
  }) => void;
}

const TIME_SLOTS = [
  '09:00', '09:30', '10:00', '10:30', '11:00', '11:30',
  '12:00', '12:30', '13:00', '13:30', '14:00', '14:30',
  '15:00', '15:30', '16:00', '16:30', '17:00', '17:30',
  '18:00', '18:30', '19:00', '19:30', '20:00', '20:30',
  '21:00', '21:30'
];

const DURATION_OPTIONS = [
  { label: '30 min', value: 0.5 },
  { label: '1 hour', value: 1 },
  { label: '1.5 hrs', value: 1.5 },
  { label: '2 hours', value: 2 },
  { label: '2.5 hrs', value: 2.5 },
  { label: '3 hours', value: 3 },
  { label: '4 hours', value: 4 },
  { label: '5 hours', value: 5 },
];

export const ReservationFormModal: React.FC<ReservationFormProps> = ({
  initialInstrument,
  allInstruments,
  initialDate,
  initialTimeHhmm,
  initialDuration = 2,
  onClose,
  onSuccess,
  onOpenSeriesBuilder,
}) => {
  const { profile, sessionToken } = useAuth();

  // Form State
  const [selectedInstrumentId, setSelectedInstrumentId] = useState<string>(initialInstrument.id);
  const [serviceName, setServiceName] = useState<string>('');
  const [date, setDate] = useState<string>(initialDate);
  const [startTime, setStartTime] = useState<string>(initialTimeHhmm || '10:00');
  const [duration, setDuration] = useState<number>(initialDuration);
  const [reservationType, setReservationType] = useState<'in_church' | 'outside_church'>('in_church');
  const [feeAcknowledged, setFeeAcknowledged] = useState<boolean>(false);
  const [isRecurring, setIsRecurring] = useState<boolean>(false);

  // Status & Submission States
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [submissionResult, setSubmissionResult] = useState<{
    reservation: any;
    evaluation: {
      status: 'approved' | 'pending';
      reasons: string[];
      isTrustedOrAdmin: boolean;
      outsideFeeSnapshot: string | null;
      startTimeUtc: string;
      endTimeUtc: string;
    };
  } | null>(null);

  // Find active instrument object
  const currentInstrument =
    allInstruments.find((i) => i.id === selectedInstrumentId) || initialInstrument;

  // Calculate formatted end time
  const calculateEndTime = () => {
    try {
      const [h, m] = startTime.split(':').map(Number);
      const totalMinutes = h * 60 + m + Math.round(duration * 60);
      const endH = Math.floor(totalMinutes / 60);
      const endM = totalMinutes % 60;
      const formattedH = String(endH).padStart(2, '0');
      const formattedM = String(endM).padStart(2, '0');
      return `${formattedH}:${formattedM}`;
    } catch {
      return '--:--';
    }
  };

  const endTimeStr = calculateEndTime();
  const feeNumber = Number(currentInstrument.outsideFeePerDay || 0);

  // Handle submit to backend
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile) {
      setErrorMsg('You must be signed in to submit a reservation.');
      return;
    }

    if (!serviceName.trim()) {
      setErrorMsg('Please specify what this reservation is for (e.g. Sunday Morning Worship, Youth Practice).');
      return;
    }

    if (reservationType === 'outside_church' && !feeAcknowledged) {
      setErrorMsg('Please acknowledge the outside-church fee agreement before proceeding.');
      return;
    }

    // If recurring toggle was selected, redirect to Series Builder
    if (isRecurring && onOpenSeriesBuilder) {
      onOpenSeriesBuilder({
        instrument: currentInstrument,
        serviceName: serviceName.trim(),
        date,
        startTime,
        duration,
        reservationType,
      });
      return;
    }

    setIsSubmitting(true);
    setErrorMsg(null);

    try {
      const res = await fetch('/api/reservations', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${sessionToken}`,
        },
        body: JSON.stringify({
          userId: profile.id,
          instrumentId: currentInstrument.id,
          serviceName: serviceName.trim(),
          date,
          startTime,
          duration,
          reservationType,
          feeAcknowledged: reservationType === 'outside_church' ? feeAcknowledged : false,
        }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        // Show raw backend error message exactly as returned
        setErrorMsg(data.error || 'Failed to submit reservation. Please try again.');
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
      setErrorMsg(err.message || 'Network error occurred while submitting reservation.');
      setIsSubmitting(false);
    }
  };

  return (
    <div
      id="reservation-form-modal-backdrop"
      className="fixed inset-0 z-50 bg-stone-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto"
    >
      <div
        id="reservation-form-modal"
        className="bg-white rounded-3xl border border-stone-200 shadow-2xl max-w-xl w-full my-auto overflow-hidden animate-in fade-in zoom-in-95 duration-150"
      >
        {/* Modal Top Header */}
        <div className="bg-stone-900 text-white px-6 py-5 flex items-center justify-between border-b border-stone-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-800 text-amber-100 flex items-center justify-center font-bold shadow-xs">
              <Music2 className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white leading-tight">
                {submissionResult ? 'Reservation Confirmation' : 'Reserve Instrument'}
              </h2>
              <p className="text-xs text-stone-400">
                {submissionResult
                  ? 'Your reservation request has been processed'
                  : 'St. Mark Church Sanctuary & Music Ministry'}
              </p>
            </div>
          </div>

          <button
            id="btn-close-reservation-modal"
            onClick={onClose}
            className="w-8 h-8 rounded-xl bg-stone-800 text-stone-400 hover:text-white hover:bg-stone-700 flex items-center justify-center transition cursor-pointer"
            aria-label="Close modal"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* ------------------------------------------------------------- */}
        {/* SUCCESS / OUTCOME RECEIPT VIEW */}
        {/* ------------------------------------------------------------- */}
        {submissionResult ? (
          <div className="p-6 sm:p-8 space-y-6">
            {/* Status Hero Card */}
            {submissionResult.evaluation.status === 'approved' ? (
              <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-5 text-emerald-900 flex items-start gap-4">
                <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-sm">
                  <CheckCircle2 className="w-6 h-6" />
                </div>
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-base text-emerald-950">
                      Reservation Approved
                    </span>
                    <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-emerald-200 text-emerald-900 uppercase tracking-wide">
                      Instant Confirmed
                    </span>
                  </div>
                  <p className="text-xs text-emerald-800 leading-relaxed">
                    Your time slot is officially confirmed and locked in the master church calendar.
                  </p>
                  {submissionResult.evaluation.reasons.length > 0 && (
                    <div className="pt-2 text-[11px] text-emerald-900 font-medium">
                      {submissionResult.evaluation.reasons.map((r, i) => (
                        <div key={i} className="flex items-center gap-1.5">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-600" />
                          <span>{r}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5 text-amber-900 flex items-start gap-4">
                <div className="w-10 h-10 rounded-xl bg-amber-600 text-white flex items-center justify-center shrink-0 shadow-sm">
                  <Clock className="w-6 h-6" />
                </div>
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-base text-amber-950">
                      Reservation Submitted (Pending Review)
                    </span>
                    <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-amber-200 text-amber-900 uppercase tracking-wide">
                      Pending Admin
                    </span>
                  </div>
                  <p className="text-xs text-amber-800 leading-relaxed">
                    This reservation has been queued for admin approval. You will receive an update once a church administrator reviews it.
                  </p>

                  {/* Specific Downgrade Reasons List */}
                  {submissionResult.evaluation.reasons.length > 0 && (
                    <div className="pt-2.5 border-t border-amber-200/80 mt-2">
                      <div className="text-[11px] font-bold text-amber-950 mb-1">
                        Reason(s) for Manual Review:
                      </div>
                      <div className="space-y-1">
                        {submissionResult.evaluation.reasons.map((reason, idx) => (
                          <div key={idx} className="flex items-start gap-1.5 text-xs text-amber-900">
                            <span className="w-1.5 h-1.5 rounded-full bg-amber-600 mt-1.5 shrink-0" />
                            <span>{reason}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Receipt Summary Grid */}
            <div className="bg-stone-50 border border-stone-200 rounded-2xl p-5 space-y-3 text-xs">
              <div className="font-bold text-stone-900 text-sm border-b border-stone-200 pb-2">
                Booking Details
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <span className="text-stone-500 font-medium block">Instrument:</span>
                  <span className="font-bold text-stone-900 text-sm">
                    {currentInstrument.name}
                  </span>
                  <span className="text-[11px] text-stone-500 block">
                    {currentInstrument.type}
                  </span>
                </div>
                <div>
                  <span className="text-stone-500 font-medium block">Reservation Type:</span>
                  <span className="font-bold text-stone-900 capitalize">
                    {submissionResult.reservation.reservationType === 'in_church'
                      ? 'In-Church (Free)'
                      : 'Outside-Church (Paid)'}
                  </span>
                  {submissionResult.reservation.feeSnapshot && (
                    <span className="text-[11px] text-purple-700 font-semibold block">
                      Fee: EGP {submissionResult.reservation.feeSnapshot}/day
                    </span>
                  )}
                </div>
              </div>

              {/* Service Name / Purpose in Receipt */}
              <div className="pt-2 border-t border-stone-200">
                <span className="text-stone-500 font-medium block">What this reservation is for:</span>
                <span className="font-bold text-stone-900 text-sm">
                  {submissionResult.reservation.serviceName || serviceName || 'Not specified'}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-3 pt-2 border-t border-stone-200">
                <div>
                  <span className="text-stone-500 font-medium block">Date & Time:</span>
                  <span className="font-semibold text-stone-900">
                    {date}
                  </span>
                  <span className="text-[11px] text-stone-600 block">
                    {startTime} – {endTimeStr} UTC ({duration}h)
                  </span>
                </div>
                <div>
                  <span className="text-stone-500 font-medium block">Reservation ID:</span>
                  <span className="font-mono text-[11px] text-stone-600 break-all select-all">
                    {submissionResult.reservation.id}
                  </span>
                </div>
              </div>
            </div>

            {/* Action button */}
            <div className="pt-2">
              <button
                id="btn-done-confirmation"
                onClick={onClose}
                className="w-full py-3 bg-stone-900 hover:bg-stone-800 text-white text-xs font-bold rounded-2xl transition cursor-pointer shadow-md"
              >
                Done (Back to Calendar)
              </button>
            </div>
          </div>
        ) : (
          /* ------------------------------------------------------------- */
          /* RESERVATION INPUT FORM VIEW */
          /* ------------------------------------------------------------- */
          <form onSubmit={handleSubmit} className="p-6 sm:p-7 space-y-6">
            {/* Error Notification Banner */}
            {errorMsg && (
              <div
                id="reservation-form-error-banner"
                className="bg-red-50 border border-red-200 rounded-2xl p-4 text-red-900 flex items-start gap-3 animate-in fade-in"
              >
                <AlertCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
                <div className="space-y-1 text-xs">
                  <div className="font-bold text-red-950">Submission Blocked</div>
                  <div className="text-red-800 leading-relaxed">{errorMsg}</div>
                </div>
              </div>
            )}

            {/* 1. Instrument Selector */}
            <div className="space-y-2">
              <label className="block text-xs font-bold text-stone-700">
                Selected Instrument
              </label>

              {/* Instrument Photo & Summary Card */}
              <div className="flex items-center gap-3 p-3 bg-stone-50 border border-stone-200 rounded-2xl">
                <div className="w-12 h-12 rounded-xl bg-amber-100/70 border border-amber-200 text-amber-800 flex items-center justify-center shrink-0 overflow-hidden shadow-2xs">
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
                  <div className="text-xs font-bold text-stone-900 truncate">
                    {currentInstrument.name}
                  </div>
                  <div className="text-[11px] text-stone-500">
                    {currentInstrument.type} • {currentInstrument.bookingMode === 'instant' ? '⚡ Instant Booking' : '🛡️ Manual Review'}
                  </div>
                </div>
              </div>

              <div className="relative">
                <select
                  id="select-instrument"
                  value={selectedInstrumentId}
                  onChange={(e) => setSelectedInstrumentId(e.target.value)}
                  className="w-full appearance-none bg-stone-50 hover:bg-stone-100 border border-stone-300 rounded-2xl px-4 py-3 text-xs font-semibold text-stone-900 focus:outline-none focus:ring-2 focus:ring-amber-800/40 focus:border-amber-800 transition cursor-pointer pr-10"
                >
                  {allInstruments.map((inst) => (
                    <option key={inst.id} value={inst.id}>
                      {inst.name} ({inst.type}) — {inst.bookingMode === 'instant' ? 'Instant' : 'Manual'} mode
                    </option>
                  ))}
                </select>
                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-4 text-stone-500">
                  <ChevronRight className="w-4 h-4 rotate-90" />
                </div>
              </div>

              {/* Instrument Details Pill */}
              <div className="flex flex-wrap items-center gap-2 pt-1">
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl text-[11px] font-semibold bg-stone-100 text-stone-700 border border-stone-200">
                  Type: {currentInstrument.type}
                </span>
                <span
                  className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-xl text-[11px] font-bold uppercase tracking-wider ${
                    currentInstrument.bookingMode === 'instant'
                      ? 'bg-emerald-100 text-emerald-900 border border-emerald-200'
                      : 'bg-amber-100 text-amber-900 border border-amber-200'
                  }`}
                >
                  <Shield className="w-3 h-3" />
                  {currentInstrument.bookingMode} Approval
                </span>
                {profile?.isTrusted && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl text-[11px] font-bold bg-amber-100 text-amber-900 border border-amber-200">
                    <Sparkles className="w-3 h-3" />
                    Trusted User (Auto-Approved)
                  </span>
                )}
              </div>
            </div>

            {/* 2. Purpose / Service Name (Required free-text input) */}
            <div className="space-y-1.5">
              <label htmlFor="input-service-name" className="block text-xs font-bold text-stone-700">
                What is this reservation for? <span className="text-amber-800 font-bold">*</span>
              </label>
              <input
                id="input-service-name"
                type="text"
                value={serviceName}
                onChange={(e) => setServiceName(e.target.value)}
                placeholder="e.g. Sunday Morning Worship, Youth Practice"
                className="w-full bg-stone-50 border border-stone-300 rounded-2xl px-3.5 py-2.5 text-xs font-medium text-stone-900 placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-amber-800/40 focus:border-amber-800 transition"
                required
              />
            </div>

            {/* 3. Date & Time Selection */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Date Input */}
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-stone-700">
                  Date
                </label>
                <div className="relative">
                  <input
                    id="input-reservation-date"
                    type="date"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    className="w-full bg-stone-50 border border-stone-300 rounded-2xl px-3.5 py-2.5 text-xs font-medium text-stone-900 focus:outline-none focus:ring-2 focus:ring-amber-800/40 focus:border-amber-800 transition"
                    required
                  />
                </div>
              </div>

              {/* Start Time Select */}
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-stone-700">
                  Start Time (UTC)
                </label>
                <div className="relative">
                  <select
                    id="select-start-time"
                    value={startTime}
                    onChange={(e) => setStartTime(e.target.value)}
                    className="w-full appearance-none bg-stone-50 border border-stone-300 rounded-2xl px-3.5 py-2.5 text-xs font-medium text-stone-900 focus:outline-none focus:ring-2 focus:ring-amber-800/40 focus:border-amber-800 transition pr-8"
                  >
                    {TIME_SLOTS.map((slot) => (
                      <option key={slot} value={slot}>
                        {slot} UTC
                      </option>
                    ))}
                  </select>
                  <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-stone-500">
                    <ChevronRight className="w-3.5 h-3.5 rotate-90" />
                  </div>
                </div>
              </div>
            </div>

            {/* 3. Duration Selector & Time Preview */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="block text-xs font-bold text-stone-700">
                  Duration
                </label>
                <span className="text-xs font-bold text-amber-900 bg-amber-50 border border-amber-200 px-2.5 py-0.5 rounded-lg">
                  {startTime} → {endTimeStr} UTC ({duration}h)
                </span>
              </div>
              <div className="grid grid-cols-4 gap-2">
                {DURATION_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setDuration(opt.value)}
                    className={`py-2 px-2 rounded-xl text-xs font-bold text-center transition cursor-pointer border ${
                      duration === opt.value
                        ? 'bg-amber-800 text-white border-amber-900 shadow-xs'
                        : 'bg-stone-50 hover:bg-stone-100 text-stone-700 border-stone-200'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* 4. Reservation Type Toggle (In-Church vs Outside-Church) */}
            <div className="space-y-2.5">
              <label className="block text-xs font-bold text-stone-700">
                Reservation Usage Type
              </label>

              <div className="grid grid-cols-2 gap-3">
                {/* In-Church Option */}
                <button
                  type="button"
                  id="btn-type-in-church"
                  onClick={() => {
                    setReservationType('in_church');
                    setFeeAcknowledged(false);
                  }}
                  className={`p-3.5 rounded-2xl border text-left transition cursor-pointer flex flex-col justify-between ${
                    reservationType === 'in_church'
                      ? 'bg-amber-50/70 border-amber-800 ring-2 ring-amber-800/30'
                      : 'bg-white hover:bg-stone-50 border-stone-200 text-stone-700'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-bold text-xs text-stone-900">
                      In-Church Use
                    </span>
                    <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-100 text-emerald-800">
                      Free
                    </span>
                  </div>
                  <p className="text-[11px] text-stone-500 leading-tight">
                    For liturgical services, choir practice & rehearsals on premises.
                  </p>
                </button>

                {/* Outside-Church Option */}
                <button
                  type="button"
                  id="btn-type-outside-church"
                  onClick={() => setReservationType('outside_church')}
                  className={`p-3.5 rounded-2xl border text-left transition cursor-pointer flex flex-col justify-between ${
                    reservationType === 'outside_church'
                      ? 'bg-purple-50/70 border-purple-800 ring-2 ring-purple-800/30'
                      : 'bg-white hover:bg-stone-50 border-stone-200 text-stone-700'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-bold text-xs text-stone-900">
                      Outside Church
                    </span>
                    <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-purple-100 text-purple-800">
                      EGP {feeNumber}/day
                    </span>
                  </div>
                  <p className="text-[11px] text-stone-500 leading-tight">
                    For external events, conferences, or off-premises borrow.
                  </p>
                </button>
              </div>

              {/* Outside Church Fee Notice & Mandatory Acknowledgment Checkbox */}
              {reservationType === 'outside_church' && (
                <div
                  id="outside-fee-acknowledgment-box"
                  className="bg-purple-50 border border-purple-200 rounded-2xl p-4 space-y-3 animate-in fade-in"
                >
                  <div className="flex items-start gap-2.5">
                    <DollarSign className="w-4 h-4 text-purple-700 mt-0.5 shrink-0" />
                    <div className="text-xs space-y-1">
                      <div className="font-bold text-purple-950">
                        Outside-Church Borrowing Policy & Fee
                      </div>
                      <div className="text-purple-900 text-[11px] leading-relaxed">
                        This instrument has an outside usage fee of{' '}
                        <strong className="font-bold text-purple-950">
                          EGP {feeNumber} per calendar day
                        </strong>
                        . Outside reservations require return in original condition and admin authorization.
                      </div>
                    </div>
                  </div>

                  <label className="flex items-start gap-2.5 pt-2 border-t border-purple-200/80 cursor-pointer select-none">
                    <input
                      id="checkbox-fee-acknowledged"
                      type="checkbox"
                      checked={feeAcknowledged}
                      onChange={(e) => setFeeAcknowledged(e.target.checked)}
                      className="mt-0.5 w-4 h-4 rounded-md border-purple-300 text-purple-700 focus:ring-purple-600 cursor-pointer"
                    />
                    <span className="text-xs font-semibold text-purple-950">
                      I acknowledge and accept the outside-church fee of EGP {feeNumber}/day and agree to church equipment care rules.
                    </span>
                  </label>
                </div>
              )}
            </div>

            {/* 5. Recurring Series Toggle (Screen 3b bridge) */}
            <div className="bg-stone-50 border border-stone-200 rounded-2xl p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-amber-100 text-amber-800 flex items-center justify-center">
                    <Repeat className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="text-xs font-bold text-stone-900 block">
                      Make this a recurring reservation
                    </span>
                    <span className="text-[11px] text-stone-500 block">
                      Repeat weekly or customize multi-date series (Screen 3b)
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
                  <div className="w-10 h-6 bg-stone-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-stone-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-amber-800" />
                </label>
              </div>

              {isRecurring && (
                <div className="mt-3 pt-3 border-t border-stone-200 text-xs text-amber-900 bg-amber-50/50 p-2.5 rounded-xl flex items-center justify-between">
                  <span>
                    Ready to build recurring schedule with live conflict checking.
                  </span>
                  <span className="font-bold text-amber-800 flex items-center gap-1">
                    Screen 3b Builder <ArrowRight className="w-3 h-3" />
                  </span>
                </div>
              )}
            </div>

            {/* Modal Bottom Actions */}
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
                id="btn-submit-reservation"
                disabled={
                  isSubmitting ||
                  !serviceName.trim() ||
                  (reservationType === 'outside_church' && !feeAcknowledged)
                }
                className={`flex-1 py-3 px-6 rounded-2xl text-xs font-bold text-white transition flex items-center justify-center gap-2 shadow-md cursor-pointer ${
                  isSubmitting ||
                  !serviceName.trim() ||
                  (reservationType === 'outside_church' && !feeAcknowledged)
                    ? 'bg-stone-300 cursor-not-allowed text-stone-500 shadow-none'
                    : 'bg-amber-800 hover:bg-amber-900 active:scale-[0.99]'
                }`}
              >
                {isSubmitting ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    <span>Processing Submission...</span>
                  </>
                ) : isRecurring ? (
                  <>
                    <span>Continue to Series Builder</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                ) : (
                  <>
                    <span>Confirm & Reserve</span>
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
