import React, { useState } from "react";
import { useAuth } from "../contexts/AuthContext.tsx";
import { Instrument } from "./AvailabilityCalendar.tsx";
import { getCairoDateString, getCairoTimeString } from "../lib/date-utils";
import {
  Calendar,
  Clock,
  Music2,
  DollarSign,
  Shield,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  X,
  Repeat,
  Sparkles,
  ArrowRight,
  Info,
  CalendarRange,
  Layers,
} from "lucide-react";

export interface EditReservationModalProps {
  reservation: any;
  allInstruments: Instrument[];
  onClose: () => void;
  onSuccess: (updatedReservation: any) => void;
}

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

const DURATION_OPTIONS = [
  { label: "30 min", value: 0.5 },
  { label: "1 hour", value: 1 },
  { label: "1.5 hrs", value: 1.5 },
  { label: "2 hours", value: 2 },
  { label: "2.5 hrs", value: 2.5 },
  { label: "3 hours", value: 3 },
  { label: "4 hours", value: 4 },
  { label: "5 hours", value: 5 },
];

export const EditReservationModal: React.FC<EditReservationModalProps> = ({
  reservation,
  allInstruments,
  onClose,
  onSuccess,
}) => {
  const { profile, sessionToken } = useAuth();

  // Derive initial values from reservation
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

  const [selectedInstrumentId, setSelectedInstrumentId] = useState<string>(
    reservation.instrument_id ||
      reservation.instrumentId ||
      allInstruments[0]?.id ||
      "",
  );
  const [serviceName, setServiceName] = useState<string>(
    reservation.service_name || reservation.serviceName || "",
  );
  const [date, setDate] = useState<string>(initialDateStr);
  const [startTime, setStartTime] = useState<string>(initialTimeStr);
  const [duration, setDuration] = useState<number>(initialDurationHours);
  const [reservationType, setReservationType] = useState<
    "in_church" | "outside_church"
  >(reservation.reservation_type || reservation.reservationType || "in_church");
  const [feeAcknowledged, setFeeAcknowledged] = useState<boolean>(true);

  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

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

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile) {
      setErrorMsg("You must be signed in.");
      return;
    }

    if (!serviceName.trim()) {
      setErrorMsg("Please specify what this reservation is for.");
      return;
    }

    if (reservationType === "outside_church" && !feeAcknowledged) {
      setErrorMsg("Please acknowledge the outside-church fee agreement.");
      return;
    }

    setIsSubmitting(true);
    setErrorMsg(null);

    try {
      const res = await fetch(`/api/reservations/${reservation.id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
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
          feeAcknowledged:
            reservationType === "outside_church" ? feeAcknowledged : false,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        setErrorMsg(data.error || "Failed to update reservation.");
        setIsSubmitting(false);
        return;
      }

      setIsSubmitting(false);
      onSuccess(data.reservation);
    } catch (err: any) {
      setErrorMsg(err.message || "Network error updating reservation.");
      setIsSubmitting(false);
    }
  };

  return (
    <div
      id="edit-reservation-modal-backdrop"
      className="fixed inset-0 z-50 bg-stone-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto"
    >
      <div
        id="edit-reservation-modal"
        className="bg-white rounded-3xl border border-stone-200 shadow-2xl max-w-xl w-full my-auto overflow-hidden animate-in fade-in zoom-in-95 duration-150"
      >
        {/* Header */}
        <div className="bg-stone-900 text-white px-6 py-5 flex items-center justify-between border-b border-stone-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-800 text-amber-100 flex items-center justify-center font-bold shadow-xs">
              <Music2 className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white leading-tight">
                Edit Reservation
              </h2>
              <p className="text-xs text-stone-400">
                Update date, time slot, duration, or purpose
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-8 h-8 rounded-xl bg-stone-800 text-stone-400 hover:text-white hover:bg-stone-700 flex items-center justify-center transition cursor-pointer"
            aria-label="Close modal"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleEditSubmit} className="p-6 sm:p-7 space-y-6">
          {errorMsg && (
            <div className="bg-red-50 border border-red-200 rounded-2xl p-4 text-red-900 flex items-start gap-3 animate-in fade-in">
              <AlertCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
              <div className="space-y-1 text-xs">
                <div className="font-bold text-red-950">Update Blocked</div>
                <div className="text-red-800 leading-relaxed">{errorMsg}</div>
              </div>
            </div>
          )}

          {/* Instrument Selector */}
          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-stone-700">
              Select Instrument
            </label>
            <select
              value={selectedInstrumentId}
              onChange={(e) => setSelectedInstrumentId(e.target.value)}
              className="w-full bg-stone-50 border border-stone-300 rounded-2xl px-3.5 py-2.5 text-xs font-medium text-stone-900 focus:outline-none focus:ring-2 focus:ring-amber-800/40 cursor-pointer"
            >
              {allInstruments.map((inst) => (
                <option key={inst.id} value={inst.id}>
                  {inst.name} ({inst.type} • {inst.bookingMode} booking)
                </option>
              ))}
            </select>
          </div>

          {/* Purpose */}
          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-stone-700">
              What is this reservation for?{" "}
              <span className="text-amber-800 font-bold">*</span>
            </label>
            <input
              type="text"
              value={serviceName}
              onChange={(e) => setServiceName(e.target.value)}
              placeholder="e.g. Sunday Morning Liturgy, Choir Rehearsal"
              className="w-full bg-stone-50 border border-stone-300 rounded-2xl px-3.5 py-2.5 text-xs font-medium text-stone-900 focus:outline-none focus:ring-2 focus:ring-amber-800/40"
              required
            />
          </div>

          {/* Date & Time Slot Grid */}
          <div className="p-4 bg-stone-50 border border-stone-200 rounded-2xl space-y-3">
            <div className="text-xs font-bold text-stone-900">
              Schedule & Duration
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-[11px] font-bold text-stone-600 mb-1">
                  Date
                </label>
                <input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="w-full bg-white border border-stone-300 rounded-xl px-3 py-2 text-xs font-medium text-stone-900 focus:outline-none focus:ring-2 focus:ring-amber-800/30"
                  required
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-stone-600 mb-1">
                  Start Time
                </label>
                <select
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                  className="w-full bg-white border border-stone-300 rounded-xl px-3 py-2 text-xs font-medium text-stone-900 focus:outline-none focus:ring-2 focus:ring-amber-800/30 cursor-pointer"
                >
                  {TIME_SLOTS.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-stone-600 mb-1">
                  Duration (until {calculateEndTime()})
                </label>
                <select
                  value={duration}
                  onChange={(e) => setDuration(Number(e.target.value))}
                  className="w-full bg-white border border-stone-300 rounded-xl px-3 py-2 text-xs font-medium text-stone-900 focus:outline-none focus:ring-2 focus:ring-amber-800/30 cursor-pointer"
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

          {/* Usage Type */}
          <div className="space-y-2.5">
            <label className="block text-xs font-bold text-stone-700">
              Usage Type
            </label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setReservationType("in_church")}
                className={`p-3 rounded-2xl border text-left transition cursor-pointer ${
                  reservationType === "in_church"
                    ? "bg-amber-50/70 border-amber-800 ring-2 ring-amber-800/30"
                    : "bg-white hover:bg-stone-50 border-stone-200 text-stone-700"
                }`}
              >
                <div className="flex items-center justify-between mb-0.5">
                  <span className="font-bold text-xs text-stone-900">
                    In-Church Use
                  </span>
                  <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-100 text-emerald-800">
                    Free
                  </span>
                </div>
                <p className="text-[10px] text-stone-500">
                  For choir, liturgy, and church services.
                </p>
              </button>

              <button
                type="button"
                onClick={() => setReservationType("outside_church")}
                className={`p-3 rounded-2xl border text-left transition cursor-pointer ${
                  reservationType === "outside_church"
                    ? "bg-purple-50/70 border-purple-800 ring-2 ring-purple-800/30"
                    : "bg-white hover:bg-stone-50 border-stone-200 text-stone-700"
                }`}
              >
                <div className="flex items-center justify-between mb-0.5">
                  <span className="font-bold text-xs text-stone-900">
                    Outside Church
                  </span>
                  <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-purple-100 text-purple-800">
                    EGP {feeNumber}/day
                  </span>
                </div>
                <p className="text-[10px] text-stone-500">
                  Off-premises borrow with daily fee.
                </p>
              </button>
            </div>

            {reservationType === "outside_church" && (
              <label className="flex items-start gap-2.5 p-3 bg-purple-50 border border-purple-200 rounded-xl cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={feeAcknowledged}
                  onChange={(e) => setFeeAcknowledged(e.target.checked)}
                  className="mt-0.5 w-4 h-4 rounded-md border-purple-300 text-purple-700 focus:ring-purple-600 cursor-pointer"
                />
                <span className="text-xs font-semibold text-purple-950">
                  I acknowledge the outside usage fee of EGP {feeNumber}/day for
                  this instrument.
                </span>
              </label>
            )}
          </div>

          {/* Action Buttons */}
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
              disabled={isSubmitting || !serviceName.trim()}
              className={`flex-1 py-3 px-6 rounded-2xl text-xs font-bold text-white transition flex items-center justify-center gap-2 shadow-md cursor-pointer ${
                isSubmitting || !serviceName.trim()
                  ? "bg-stone-300 cursor-not-allowed text-stone-500 shadow-none"
                  : "bg-amber-800 hover:bg-amber-900 active:scale-[0.99]"
              }`}
            >
              {isSubmitting ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>Saving Changes...</span>
                </>
              ) : (
                <>
                  <span>Update Reservation</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
