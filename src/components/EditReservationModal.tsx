import React, { useState, type SelectHTMLAttributes } from "react";
import { useTranslation } from "react-i18next";
import { useAuth } from "../contexts/AuthContext.tsx";
import { Instrument } from "./AvailabilityCalendar.tsx";
import {
  getCairoDateString,
  getCairoTimeString,
  formatHhmmTo12Hour,
} from "../lib/date-utils";
import {
  Music2,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  X,
  ArrowRight,
  Calendar as CalendarIcon,
  Clock,
  MapPin,
  DollarSign,
  User as UserIcon,
  FileText,
  ChevronDown,
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

/** Native select wrapper: adds a custom chevron and keeps the text at 16px
 * (native <select> text below 16px triggers iOS Safari's zoom-on-focus). */
const SelectField: React.FC<SelectHTMLAttributes<HTMLSelectElement>> = ({
  className = "",
  children,
  ...props
}) => (
  <div className="relative">
    <select
      {...props}
      className={`w-full min-h-[48px] appearance-none bg-white border border-stone-300 rounded-xl pl-3.5 pr-10 py-3 text-base font-medium text-stone-900 focus:outline-none focus:ring-2 focus:ring-amber-800/30 focus:border-amber-800 cursor-pointer touch-manipulation ${className}`}
    >
      {children}
    </select>
    <ChevronDown className="w-4 h-4 text-stone-400 absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
  </div>
);

const FieldLabel: React.FC<{
  icon: React.ReactNode;
  required?: boolean;
  children: React.ReactNode;
}> = ({ icon, required, children }) => (
  <label className="flex items-center gap-2 text-xs font-bold text-stone-700">
    {icon}
    <span>
      {children} {required && <span className="text-amber-800">*</span>}
    </span>
  </label>
);

export const EditReservationModal: React.FC<EditReservationModalProps> = ({
  reservation,
  allInstruments,
  onClose,
  onSuccess,
}) => {
  const { profile, sessionToken } = useAuth();
  const { t } = useTranslation();

  const isAdmin = Boolean(
    profile?.role === "admin" ||
    profile?.role === "super_admin" ||
    (profile as any)?.isSuperAdmin,
  );

  // ---- Derive initial values from reservation ----
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

  const DURATION_OPTIONS = [
    { label: t("reservationForm.duration30m"), value: 0.5 },
    { label: t("reservationForm.duration1h"), value: 1 },
    { label: t("reservationForm.duration1h30"), value: 1.5 },
    { label: t("reservationForm.duration2h"), value: 2 },
    { label: t("reservationForm.duration2h30"), value: 2.5 },
    { label: t("reservationForm.duration3h"), value: 3 },
    { label: t("reservationForm.duration4h"), value: 4 },
    { label: t("reservationForm.duration5h"), value: 5 },
    ...(isAdmin || initialDurationHours >= 13 || reservation.is_full_day
      ? [{ label: t("reservationForm.durationFullDay"), value: 13 }]
      : []),
  ];

  const [selectedInstrumentId, setSelectedInstrumentId] = useState<string>(
    reservation.instrument_id ||
      reservation.instrumentId ||
      allInstruments[0]?.id ||
      "",
  );
  const [serviceName, setServiceName] = useState<string>(
    reservation.service_name || reservation.serviceName || "",
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

  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const currentInstrument =
    allInstruments.find((i) => i.id === selectedInstrumentId) ||
    allInstruments[0];
  const feeNumber = Number(currentInstrument?.outsideFeePerDay || 0);

  const isTrustedOrAdmin =
    profile?.isTrusted ||
    profile?.role === "admin" ||
    profile?.role === "super_admin";

  const willResetToPending =
    reservation.status === "approved" &&
    currentInstrument?.bookingMode === "manual" &&
    !isTrustedOrAdmin;

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
    if (reservationType === "outside_church" && !feeAcknowledged) {
      setErrorMsg(t("editReservation.errAcknowledgeFee"));
      return;
    }

    setIsSubmitting(true);
    setErrorMsg(null);

    try {
      // Server derives admin/user identity from the Bearer token.
      // `userId` is only included for the no-session legacy/self-edit fallback.
      const body: Record<string, unknown> = {
        instrumentId: currentInstrument.id,
        serviceName: serviceName.trim(),
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

      const res = await fetch(`/api/reservations/${reservation.id}`, {
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
    isSubmitting || !serviceName.trim() || !musicianName.trim();

  return (
    <div
      id="edit-reservation-modal-backdrop"
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 bg-stone-900/60 backdrop-blur-xs flex items-stretch sm:items-center justify-center p-0 sm:p-4"
    >
      <div
        id="edit-reservation-modal"
        className="bg-white w-full sm:max-w-xl sm:rounded-3xl sm:border sm:border-stone-200 shadow-2xl flex flex-col h-full sm:h-auto sm:max-h-[92vh] overflow-hidden animate-in fade-in zoom-in-95 duration-150 pt-[env(safe-area-inset-top)]"
      >
        {/* ============ STICKY HEADER ============ */}
        <div className="bg-stone-900 text-white px-4 sm:px-6 py-3.5 sm:py-4 flex items-center justify-between gap-3 border-b border-stone-800 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-2xl bg-amber-800 text-amber-100 flex items-center justify-center shrink-0 shadow-xs">
              <Music2 className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h2 className="text-xs sm:text-sm font-bold text-white leading-tight truncate">
                {t("editReservation.headerTitle")}
              </h2>
              <p className="text-[11px] text-stone-400 truncate">
                {t("editReservation.headerSubtitle")}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label={t("common.close")}
            className="w-11 h-11 -mr-2 rounded-full text-stone-300 hover:text-white hover:bg-stone-700 active:bg-stone-600 flex items-center justify-center transition cursor-pointer shrink-0 touch-manipulation"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* ============ STICKY INLINE ERROR ============ */}
        {errorMsg && (
          <div className="px-4 sm:px-6 pt-3 shrink-0">
            <div className="bg-red-50 border border-red-200 rounded-2xl p-3.5 flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
              <div className="space-y-0.5 text-xs min-w-0">
                <div className="font-bold text-red-950">
                  {t("editReservation.updateBlockedTitle")}
                </div>
                <div className="text-red-800 leading-relaxed break-words">
                  {errorMsg}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ============ SCROLLABLE FORM ============ */}
        <form
          id="edit-reservation-form"
          onSubmit={handleEditSubmit}
          className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-4 sm:px-6 py-4 sm:py-5 space-y-6"
        >
          {/* -------- Instrument -------- */}
          <section className="space-y-2">
            <FieldLabel icon={<Music2 className="w-4 h-4 text-amber-800" />}>
              {t("editReservation.selectInstrumentLabel")}
            </FieldLabel>
            <SelectField
              value={selectedInstrumentId}
              onChange={(e) => setSelectedInstrumentId(e.target.value)}
            >
              {allInstruments.map((inst) => (
                <option key={inst.id} value={inst.id}>
                  {t("editReservation.instrumentOptionLabel", {
                    name: inst.name,
                    type: inst.type,
                    mode: inst.bookingMode,
                  })}
                </option>
              ))}
            </SelectField>

            {willResetToPending && (
              <div className="flex items-start gap-2 p-3 bg-amber-50 border border-amber-200 rounded-2xl text-xs text-amber-900">
                <AlertTriangle className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
                <span className="leading-relaxed">
                  {t("editReservation.manualResetWarning")}
                </span>
              </div>
            )}
          </section>

          {/* -------- Purpose -------- */}
          <section className="space-y-2">
            <FieldLabel
              icon={<FileText className="w-4 h-4 text-amber-800" />}
              required
            >
              {t("editReservation.purposeQuestionLabel")}
            </FieldLabel>
            <input
              type="text"
              inputMode="text"
              autoComplete="off"
              value={serviceName}
              onChange={(e) => setServiceName(e.target.value)}
              placeholder={t("editReservation.purposePlaceholder")}
              className="w-full min-h-[48px] bg-stone-50 border border-stone-300 rounded-2xl px-4 py-3 text-base font-medium text-stone-900 placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-amber-800/40 focus:border-amber-800 touch-manipulation"
              required
            />
          </section>

          {/* -------- Musician -------- */}
          <section className="space-y-2">
            <FieldLabel
              icon={<UserIcon className="w-4 h-4 text-amber-800" />}
              required
            >
              {t("editReservation.musicianNameLabel")}
            </FieldLabel>
            <input
              type="text"
              inputMode="text"
              autoComplete="name"
              value={musicianName}
              onChange={(e) => setMusicianName(e.target.value)}
              placeholder={t("editReservation.musicianNamePlaceholder")}
              className="w-full min-h-[48px] bg-stone-50 border border-stone-300 rounded-2xl px-4 py-3 text-base font-medium text-stone-900 placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-amber-800/40 focus:border-amber-800 touch-manipulation"
              required
            />
          </section>

          {/* -------- Note -------- */}
          <section className="space-y-2">
            <div className="flex items-center justify-between">
              <FieldLabel
                icon={<FileText className="w-4 h-4 text-amber-800" />}
              >
                {t("reservationForm.leaveANoteLabel") ||
                  "Notes / Special Requests"}
              </FieldLabel>
              <span className="text-[11px] text-stone-400 font-medium">
                {t("common.optional") || "Optional"}
              </span>
            </div>
            <textarea
              rows={3}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder={t("reservationForm.notePlaceholder")}
              className="w-full bg-stone-50 border border-stone-300 rounded-2xl px-4 py-3 text-base font-medium text-stone-900 placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-amber-800/40 focus:border-amber-800 resize-none touch-manipulation"
            />
          </section>

          {/* -------- Date & Time -------- */}
          <section className="p-4 bg-stone-50 border border-stone-200 rounded-2xl space-y-3.5">
            <div className="flex items-center gap-2 text-xs font-bold text-stone-900">
              <CalendarIcon className="w-4 h-4 text-amber-800" />
              <span>{t("editReservation.scheduleDurationTitle")}</span>
            </div>

            {/* Date — full width (native date pickers need room) */}
            <div className="space-y-1.5">
              <label className="block text-[11px] font-bold text-stone-600 uppercase tracking-wider">
                {t("editReservation.dateLabel")}
              </label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full min-h-[48px] bg-white border border-stone-300 rounded-xl px-4 py-3 text-base font-medium text-stone-900 focus:outline-none focus:ring-2 focus:ring-amber-800/30 focus:border-amber-800 touch-manipulation"
                required
              />
            </div>

            {/* Start time + Duration — two columns */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="flex items-center gap-1.5 text-[11px] font-bold text-stone-600 uppercase tracking-wider">
                  <Clock className="w-3.5 h-3.5 text-stone-500" />
                  <span>{t("editReservation.startTimeLabel")}</span>
                </label>
                <SelectField
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                >
                  {TIME_SLOTS.map((tm) => (
                    <option key={tm} value={tm}>
                      {formatHhmmTo12Hour(tm)}
                    </option>
                  ))}
                </SelectField>
              </div>

              <div className="space-y-1.5">
                <label className="block text-[11px] font-bold text-stone-600 uppercase tracking-wider truncate">
                  {t("editReservation.durationUntilLabel", {
                    end: formatHhmmTo12Hour(calculateEndTime()),
                  })}
                </label>
                <SelectField
                  value={duration}
                  onChange={(e) => setDuration(Number(e.target.value))}
                >
                  {DURATION_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </SelectField>
              </div>
            </div>

            {/* Live end-time summary chip */}
            <div className="flex items-center justify-center gap-2 pt-1">
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-stone-200 rounded-full text-xs font-semibold text-stone-800">
                <Clock className="w-3.5 h-3.5 text-stone-500" />
                {formatHhmmTo12Hour(startTime)} –{" "}
                {formatHhmmTo12Hour(calculateEndTime())}
              </span>
            </div>
          </section>

          {/* -------- Usage Type -------- */}
          <section className="space-y-2.5">
            <FieldLabel icon={<MapPin className="w-4 h-4 text-amber-800" />}>
              {t("editReservation.usageTypeLabel")}
            </FieldLabel>

            <div className="grid grid-cols-2 gap-2.5">
              {/* In-church */}
              <button
                type="button"
                onClick={() => setReservationType("in_church")}
                aria-pressed={reservationType === "in_church"}
                className={`min-h-[92px] p-3.5 rounded-2xl border-2 text-start transition cursor-pointer touch-manipulation active:scale-[0.98] flex flex-col justify-between ${
                  reservationType === "in_church"
                    ? "bg-amber-50 border-amber-800 ring-2 ring-amber-800/30"
                    : "bg-white border-stone-200 hover:bg-stone-50"
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <span className="font-bold text-xs text-stone-900 leading-snug">
                    {t("editReservation.inChurchUseLabel")}
                  </span>
                  <span className="px-2 py-0.5 rounded-md text-[11px] font-bold bg-emerald-100 text-emerald-800 shrink-0">
                    {t("editReservation.freeBadge")}
                  </span>
                </div>
                <p className="text-[11px] text-stone-500 leading-snug mt-1.5">
                  {t("editReservation.inChurchDesc")}
                </p>
              </button>

              {/* Outside-church */}
              <button
                type="button"
                onClick={() => setReservationType("outside_church")}
                aria-pressed={reservationType === "outside_church"}
                className={`min-h-[92px] p-3.5 rounded-2xl border-2 text-start transition cursor-pointer touch-manipulation active:scale-[0.98] flex flex-col justify-between ${
                  reservationType === "outside_church"
                    ? "bg-purple-50 border-purple-800 ring-2 ring-purple-800/30"
                    : "bg-white border-stone-200 hover:bg-stone-50"
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <span className="font-bold text-xs text-stone-900 leading-snug">
                    {t("editReservation.outsideChurchLabel")}
                  </span>
                  <span className="px-2 py-0.5 rounded-md text-[11px] font-bold bg-purple-100 text-purple-800 shrink-0 whitespace-nowrap">
                    {t("editReservation.egpPerDayBadge", { fee: feeNumber })}
                  </span>
                </div>
                <p className="text-[11px] text-stone-500 leading-snug mt-1.5">
                  {t("editReservation.outsideChurchDesc")}
                </p>
              </button>
            </div>

            {reservationType === "outside_church" && (
              <>
                <label className="flex items-start gap-3 p-4 bg-purple-50 border border-purple-200 rounded-2xl cursor-pointer select-none min-h-[56px] touch-manipulation">
                  <input
                    type="checkbox"
                    checked={feeAcknowledged}
                    onChange={(e) => setFeeAcknowledged(e.target.checked)}
                    className="mt-0.5 w-5 h-5 rounded-md border-purple-300 text-purple-700 focus:ring-purple-600 cursor-pointer shrink-0"
                  />
                  <span className="text-xs font-semibold text-purple-950 leading-snug">
                    {t("editReservation.feeAcknowledgeLabel", {
                      fee: feeNumber,
                    })}
                  </span>
                </label>

                <div className="flex items-start gap-2 p-3 bg-white border border-purple-200 rounded-xl text-[11px] text-purple-900">
                  <DollarSign className="w-3.5 h-3.5 text-purple-700 shrink-0 mt-0.5" />
                  <span className="leading-relaxed">
                    {t("reservationDetail.paymentNotice")}
                  </span>
                </div>
              </>
            )}
          </section>
        </form>

        {/* ============ STICKY ACTION FOOTER ============ */}
        <div className="shrink-0 bg-stone-50 border-t border-stone-200 px-4 sm:px-6 pt-3 pb-[calc(env(safe-area-inset-bottom)+12px)] sm:pb-4 flex items-center gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="min-h-[48px] px-4 py-3 bg-white hover:bg-stone-100 active:bg-stone-200 border border-stone-300 text-stone-700 text-xs font-bold rounded-2xl transition cursor-pointer shrink-0 disabled:opacity-50 touch-manipulation"
          >
            {t("editReservation.cancelButton")}
          </button>

          <button
            type="submit"
            form="edit-reservation-form"
            disabled={submitDisabled}
            className={`flex-1 min-h-[48px] px-6 py-3 rounded-2xl text-xs font-bold text-white transition flex items-center justify-center gap-2 shadow-md cursor-pointer touch-manipulation ${
              submitDisabled
                ? "bg-stone-300 cursor-not-allowed text-stone-500 shadow-none"
                : "bg-amber-800 hover:bg-amber-900 active:scale-[0.99]"
            }`}
          >
            {isSubmitting ? (
              <>
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                <span>{t("editReservation.savingChanges")}</span>
              </>
            ) : (
              <>
                <CheckCircle2 className="w-4 h-4" />
                <span>{t("editReservation.updateButton")}</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
