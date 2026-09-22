import React, { useState } from "react";
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
  DollarSign,
  Shield,
  Sparkles,
  ChevronRight,
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
  { labelKey: "reservationForm.duration30m", value: 0.5 },
  { labelKey: "reservationForm.duration1h", value: 1 },
  { labelKey: "reservationForm.duration1h30", value: 1.5 },
  { labelKey: "reservationForm.duration2h", value: 2 },
  { labelKey: "reservationForm.duration2h30", value: 2.5 },
  { labelKey: "reservationForm.duration3h", value: 3 },
  { labelKey: "reservationForm.duration4h", value: 4 },
  { labelKey: "reservationForm.duration5h", value: 5 },
];

export const EditReservationModal: React.FC<EditReservationModalProps> = ({
  reservation,
  allInstruments,
  onClose,
  onSuccess,
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

  const durationOptions = React.useMemo(() => {
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
  const endTimeStr = calculateEndTime();

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
    isSubmitting ||
    !serviceName.trim() ||
    !musicianName.trim() ||
    (reservationType === "outside_church" && !feeAcknowledged);

  return (
    <div
      id="edit-reservation-modal-backdrop"
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 bg-stone-900/60 backdrop-blur-xs flex items-stretch sm:items-center justify-center p-0 sm:p-4"
    >
      <div
        id="edit-reservation-modal"
        className="bg-white sm:rounded-3xl sm:border sm:border-stone-200 shadow-2xl w-full sm:max-w-xl z-10 flex flex-col h-full sm:h-auto sm:max-h-[90vh] overflow-hidden animate-in fade-in zoom-in-95 duration-150 pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]"
        dir={isAr ? "rtl" : "ltr"}
      >
        {/* Modal Top Header */}
        <div className="shrink-0 bg-stone-900 text-white px-4 sm:px-6 py-3 sm:py-5 flex items-center justify-between border-b border-stone-800">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-2xl bg-amber-800 text-amber-100 flex items-center justify-center font-bold shadow-xs shrink-0">
              <Music2 className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h2 className="text-sm sm:text-base font-bold text-white leading-tight truncate">
                {t("editReservation.headerTitle")}
              </h2>
              <p className="text-[11px] sm:text-xs text-stone-400 truncate">
                {t("editReservation.headerSubtitle")}
              </p>
            </div>
          </div>

          <button
            id="btn-close-edit-reservation-modal"
            type="button"
            onClick={onClose}
            aria-label={t("common.close")}
            className="shrink-0 w-11 h-11 flex items-center justify-center rounded-full bg-stone-800 text-stone-300 hover:text-white hover:bg-stone-700 active:bg-stone-600 transition cursor-pointer touch-manipulation"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form
          id="edit-reservation-form"
          onSubmit={handleEditSubmit}
          className="flex flex-col flex-1 min-h-0"
        >
          {/* Scrollable Form Body */}
          <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain p-4 sm:p-7 space-y-5 sm:space-y-6">
            {/* Error Notification Banner */}
            {errorMsg && (
              <div
                id="edit-reservation-error-banner"
                className="bg-red-50 border border-red-200 rounded-2xl p-4 text-red-900 flex items-start gap-3 animate-in fade-in"
              >
                <AlertCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
                <div className="space-y-1 text-xs">
                  <div className="font-bold text-red-950">
                    {t("editReservation.updateBlockedTitle")}
                  </div>
                  <div className="text-red-800 leading-relaxed break-words">
                    {errorMsg}
                  </div>
                </div>
              </div>
            )}

            {/* 1. Instrument Selector */}
            <div className="space-y-2">
              <label className="block text-xs font-bold text-stone-700">
                {t("editReservation.selectInstrumentLabel")}
              </label>

              {/* Instrument Photo & Summary Card */}
              <div className="flex items-center gap-3 p-3 bg-stone-50 border border-stone-200 rounded-2xl">
                <div className="w-12 h-12 rounded-xl bg-amber-100/70 border border-amber-200 text-amber-800 flex items-center justify-center shrink-0 overflow-hidden shadow-2xs">
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
                  <div className="text-[11px] text-stone-500 truncate">
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
                  className="w-full appearance-none bg-stone-50 hover:bg-stone-100 border border-stone-300 rounded-2xl px-4 py-3 text-sm font-semibold text-stone-900 focus:outline-none focus:ring-2 focus:ring-amber-800/40 focus:border-amber-800 transition cursor-pointer pr-10"
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
                  className={`pointer-events-none absolute inset-y-0 flex items-center px-4 text-stone-500 ${
                    isAr ? "left-0" : "right-0"
                  }`}
                >
                  <ChevronRight
                    className={`w-4 h-4 ${isAr ? "-rotate-90" : "rotate-90"}`}
                  />
                </div>
              </div>

              {/* Instrument Details Pills */}
              <div className="flex flex-wrap items-center gap-2 pt-1">
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl text-[11px] font-semibold bg-stone-100 text-stone-700 border border-stone-200 whitespace-nowrap">
                  {t("reservationForm.typeBadgeLabel", {
                    type: currentInstrument?.type,
                  })}
                </span>
                <span
                  className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-xl text-[11px] font-bold uppercase tracking-wider whitespace-nowrap ${
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
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl text-[11px] font-bold bg-amber-100 text-amber-900 border border-amber-200 whitespace-nowrap">
                    <Sparkles className="w-3 h-3 shrink-0" />
                    {t("reservationForm.trustedUserBadge")}
                  </span>
                )}
              </div>

              {willResetToPending && (
                <div className="flex items-start gap-2 p-3 bg-amber-50 border border-amber-200 rounded-2xl text-xs text-amber-900">
                  <AlertTriangle className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
                  <span className="leading-relaxed">
                    {t("editReservation.manualResetWarning")}
                  </span>
                </div>
              )}
            </div>

            {/* 2. Purpose */}
            <div className="space-y-1.5">
              <label
                htmlFor="input-edit-service-name"
                className="block text-xs font-bold text-stone-700"
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
                className="w-full bg-stone-50 border border-stone-300 rounded-2xl px-3.5 py-2.5 text-sm font-medium text-stone-900 placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-amber-800/40 focus:border-amber-800 transition"
                required
              />
            </div>

            {/* Musician Name */}
            <div className="space-y-1.5">
              <label
                htmlFor="input-edit-musician-name"
                className="block text-xs font-bold text-stone-700"
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
                className="w-full bg-stone-50 border border-stone-300 rounded-2xl px-3.5 py-2.5 text-sm font-medium text-stone-900 placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-amber-800/40 focus:border-amber-800 transition"
                required
              />
            </div>

            {/* Notes */}
            <div className="space-y-1.5">
              <label
                htmlFor="input-edit-reservation-note"
                className="block text-xs font-bold text-stone-700"
              >
                {t("reservationForm.leaveANoteLabel", {
                  defaultValue: "Notes / Special Requests",
                })}{" "}
                <span className="text-stone-400 font-medium">
                  ({t("common.optional", { defaultValue: "Optional" })})
                </span>
              </label>
              <textarea
                id="input-edit-reservation-note"
                rows={2}
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder={t("reservationForm.notePlaceholder", {
                  defaultValue:
                    "Add any notes, special requirements, or requests (optional)...",
                })}
                className="w-full bg-stone-50 border border-stone-300 rounded-2xl px-3.5 py-2.5 text-sm font-medium text-stone-900 placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-amber-800/40 focus:border-amber-800 transition resize-none"
              />
            </div>

            {/* 3. Date (left half) + Duration preview (right half) — same grid as below */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label
                  htmlFor="input-edit-reservation-date"
                  className="block text-xs font-bold text-stone-700"
                >
                  {t("editReservation.dateLabel")}
                </label>
                <input
                  id="input-edit-reservation-date"
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="w-full bg-stone-50 border border-stone-300 rounded-2xl px-3.5 py-2.5 text-sm font-medium text-stone-900 focus:outline-none focus:ring-2 focus:ring-amber-800/40 focus:border-amber-800 transition"
                  required
                />
              </div>

              {/* Preview chip sits in the same cell width as the Duration dropdown below */}
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-stone-700 opacity-0 select-none">
                  &nbsp;
                </label>
                <div className="w-full h-[42px] flex items-center justify-center text-xs font-bold text-amber-900 bg-amber-50 border border-amber-200 rounded-2xl px-2 whitespace-nowrap">
                  {formatHhmmTo12Hour(startTime)} →{" "}
                  {formatHhmmTo12Hour(endTimeStr)}
                </div>
              </div>
            </div>

            {/* 4. Start Time & Duration — same row, both dropdowns */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-stone-700">
                  {t("editReservation.startTimeLabel")}
                </label>
                <div className="relative">
                  <select
                    id="select-edit-start-time"
                    value={startTime}
                    onChange={(e) => setStartTime(e.target.value)}
                    className="w-full appearance-none bg-stone-50 border border-stone-300 rounded-2xl px-3.5 py-2.5 text-sm font-medium text-stone-900 focus:outline-none focus:ring-2 focus:ring-amber-800/40 focus:border-amber-800 transition pr-8 cursor-pointer"
                  >
                    {TIME_SLOTS.map((slot) => (
                      <option key={slot} value={slot}>
                        {formatHhmmTo12Hour(slot)}
                      </option>
                    ))}
                  </select>
                  <div
                    className={`pointer-events-none absolute inset-y-0 flex items-center px-3 text-stone-500 ${
                      isAr ? "left-0" : "right-0"
                    }`}
                  >
                    <ChevronRight
                      className={`w-3.5 h-3.5 ${isAr ? "-rotate-90" : "rotate-90"}`}
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-stone-700">
                  {t("editReservation.durationLabel", {
                    defaultValue: "Duration",
                  })}
                </label>
                <div className="relative">
                  <select
                    id="select-edit-duration"
                    value={duration}
                    onChange={(e) => setDuration(Number(e.target.value))}
                    className="w-full appearance-none bg-stone-50 border border-stone-300 rounded-2xl px-3.5 py-2.5 text-sm font-medium text-stone-900 focus:outline-none focus:ring-2 focus:ring-amber-800/40 focus:border-amber-800 transition pr-8 cursor-pointer"
                  >
                    {durationOptions.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {t(opt.labelKey)}
                      </option>
                    ))}
                  </select>
                  <div
                    className={`pointer-events-none absolute inset-y-0 flex items-center px-3 text-stone-500 ${
                      isAr ? "left-0" : "right-0"
                    }`}
                  >
                    <ChevronRight
                      className={`w-3.5 h-3.5 ${isAr ? "-rotate-90" : "rotate-90"}`}
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* 5. Usage Type Toggle */}
            <div className="space-y-2.5">
              <label className="block text-xs font-bold text-stone-700">
                {t("editReservation.usageTypeLabel")}
              </label>

              <div className="grid grid-cols-2 gap-2 sm:gap-3">
                {/* In-Church */}
                <button
                  type="button"
                  id="btn-edit-type-in-church"
                  onClick={() => {
                    setReservationType("in_church");
                    setFeeAcknowledged(false);
                  }}
                  aria-pressed={reservationType === "in_church"}
                  className={`p-3.5 rounded-2xl border text-left transition cursor-pointer flex flex-col justify-between active:scale-[0.98] touch-manipulation ${
                    reservationType === "in_church"
                      ? "bg-amber-50/70 border-amber-800 ring-2 ring-amber-800/30"
                      : "bg-white hover:bg-stone-50 border-stone-200 text-stone-700"
                  }`}
                >
                  <div className="flex items-center justify-between gap-1 mb-1">
                    <span className="font-bold text-xs text-stone-900">
                      {t("editReservation.inChurchUseLabel")}
                    </span>
                    <span className="px-1.5 py-0.5 rounded-md text-[10px] font-bold bg-emerald-100 text-emerald-800 whitespace-nowrap">
                      {t("editReservation.freeBadge")}
                    </span>
                  </div>
                  <p className="text-[11px] text-stone-500 leading-tight text-start">
                    {t("editReservation.inChurchDesc")}
                  </p>
                </button>

                {/* Outside-Church */}
                <button
                  type="button"
                  id="btn-edit-type-outside-church"
                  onClick={() => setReservationType("outside_church")}
                  aria-pressed={reservationType === "outside_church"}
                  className={`p-3.5 rounded-2xl border text-left transition cursor-pointer flex flex-col justify-between active:scale-[0.98] touch-manipulation ${
                    reservationType === "outside_church"
                      ? "bg-purple-50/70 border-purple-800 ring-2 ring-purple-800/30"
                      : "bg-white hover:bg-stone-50 border-stone-200 text-stone-700"
                  }`}
                >
                  <div className="flex items-center justify-between gap-1 mb-1">
                    <span className="font-bold text-xs text-stone-900">
                      {t("editReservation.outsideChurchLabel")}
                    </span>
                    <span className="px-1.5 py-0.5 rounded-md text-[10px] font-bold bg-purple-100 text-purple-800 whitespace-nowrap">
                      {t("editReservation.egpPerDayBadge", { fee: feeNumber })}
                    </span>
                  </div>
                  <p className="text-[11px] text-stone-500 leading-tight text-start">
                    {t("editReservation.outsideChurchDesc")}
                  </p>
                </button>
              </div>

              {reservationType === "outside_church" && (
                <div
                  id="edit-outside-fee-acknowledgment-box"
                  className="bg-purple-50 border border-purple-200 rounded-2xl p-4 space-y-3 animate-in fade-in"
                >
                  <div className="flex items-start gap-2.5">
                    <DollarSign className="w-4 h-4 text-purple-700 mt-0.5 shrink-0" />
                    <div className="text-xs space-y-1 min-w-0">
                      <div className="font-bold text-purple-950">
                        {t("reservationForm.policyFeeTitle")}
                      </div>
                      <div className="text-purple-900 text-[11px] leading-relaxed">
                        {t("reservationDetail.paymentNotice")}
                      </div>
                    </div>
                  </div>

                  <label className="flex items-start gap-2.5 pt-2 border-t border-purple-200/80 cursor-pointer select-none">
                    <input
                      id="checkbox-edit-fee-acknowledged"
                      type="checkbox"
                      checked={feeAcknowledged}
                      onChange={(e) => setFeeAcknowledged(e.target.checked)}
                      className="mt-0.5 w-5 h-5 rounded-md border-purple-300 text-purple-700 focus:ring-purple-600 cursor-pointer shrink-0"
                    />
                    <span className="text-xs font-semibold text-purple-950">
                      {t("editReservation.feeAcknowledgeLabel", {
                        fee: feeNumber,
                      })}
                    </span>
                  </label>
                </div>
              )}
            </div>
          </div>

          {/* Sticky Footer Actions */}
          <div className="shrink-0 flex items-center gap-2 sm:gap-3 p-4 sm:px-7 sm:pb-6 border-t border-stone-200 bg-white">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="py-3 px-4 sm:px-5 bg-stone-100 hover:bg-stone-200 active:bg-stone-300 text-stone-700 text-sm font-bold rounded-2xl transition cursor-pointer touch-manipulation disabled:opacity-50"
            >
              {t("editReservation.cancelButton")}
            </button>

            <button
              type="submit"
              id="btn-submit-edit-reservation"
              disabled={submitDisabled}
              className={`flex-1 py-3 px-4 sm:px-6 rounded-2xl text-sm font-bold text-white transition flex items-center justify-center gap-2 shadow-md cursor-pointer touch-manipulation ${
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
                  {isAr ? (
                    <ArrowRight className="w-4 h-4 rotate-180" />
                  ) : (
                    <ArrowRight className="w-4 h-4" />
                  )}
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
