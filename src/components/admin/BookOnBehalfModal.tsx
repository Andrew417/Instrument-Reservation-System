import React, { useState, useEffect, useMemo } from "react";
import { useTranslation } from "react-i18next";
import {
  Music2,
  Calendar,
  Clock,
  DollarSign,
  AlertCircle,
  CheckCircle2,
  X,
  Repeat,
  Sparkles,
  Shield,
  ArrowRight,
  ArrowLeft,
  User,
  Church,
  FileText,
  HelpCircle,
} from "lucide-react";
import { formatHhmmTo12Hour, getTodayDateString } from "../../lib/date-utils";
import { START_TIME_SLOTS as TIME_SLOTS } from "../../constants/reservationTimes";
import { ReservationUsageTypeSelector } from "../ReservationUsageTypeSelector";
import { SeriesBuilderModal } from "../SeriesBuilderModal";
import { PolicyExplainerModal } from "../PolicyExplainerModal";
import { adminFetch } from "../../lib/auth-helpers";

export interface BookOnBehalfUserState {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  musicianName?: string;
  role?: string;
}

export interface BehalfFormState {
  instrumentId: string;
  serviceName: string;
  serviceLocation?: string;
  musicianName: string;
  date: string;
  startTime: string;
  duration: number;
  reservationType: "in_church" | "outside_church";
  note?: string;
  feeAcknowledged?: boolean;
  userId?: string;
}

interface BookOnBehalfModalProps {
  user: BookOnBehalfUserState | null;
  instrumentsList: any[];
  onClose: () => void;
  onSubmit?: (formData: any) => void;
  onSuccess?: () => void;
}

const DURATION_OPTIONS = [
  { labelKey: "reservationForm.duration30m", value: 0.5 },
  { labelKey: "reservationForm.duration1h", value: 1 },
  { labelKey: "reservationForm.duration1h30", value: 1.5 },
  { labelKey: "reservationForm.duration2h", value: 2 },
  { labelKey: "reservationForm.duration2h30", value: 2.5 },
  { labelKey: "reservationForm.duration3h", value: 3 },
  { labelKey: "reservationForm.duration4h", value: 4 },
  { labelKey: "reservationForm.duration5h", value: 5 },
  { labelKey: "reservationForm.durationFullDay", value: 13 },
];

export const BookOnBehalfModal: React.FC<BookOnBehalfModalProps> = ({
  user,
  instrumentsList,
  onClose,
  onSubmit,
  onSuccess,
}) => {
  const { t, i18n } = useTranslation();
  const isAr = i18n.language === "ar";

  const availableInstruments = useMemo(() => {
    return (instrumentsList || []).filter(
      (i) => !(i.isRemoved ?? i.is_removed),
    );
  }, [instrumentsList]);

  // Step state: "form" (single/initial) or "series" (recurring series builder)
  const [step, setStep] = useState<"form" | "series">("form");

  // Form State
  const [selectedInstrumentId, setSelectedInstrumentId] = useState<string>(
    availableInstruments[0]?.id || "",
  );
  const [serviceName, setServiceName] = useState<string>("");
  const [serviceLocation, setServiceLocation] = useState<string>("");
  const [musicianName, setMusicianName] = useState<string>(
    user?.musicianName || user?.name || "",
  );
  const [date, setDate] = useState<string>(getTodayDateString());
  const [startTime, setStartTime] = useState<string>("18:00");
  const [duration, setDuration] = useState<number>(2);
  const [reservationType, setReservationType] = useState<
    "in_church" | "outside_church"
  >("in_church");
  const [feeAcknowledged, setFeeAcknowledged] = useState<boolean>(false);
  const [note, setNote] = useState<string>("");
  const [isRecurring, setIsRecurring] = useState<boolean>(false);

  // Status & Submission States
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [showPolicyExplainer, setShowPolicyExplainer] =
    useState<boolean>(false);
  const [submissionResult, setSubmissionResult] = useState<any | null>(null);

  // Sync initial instrument and musician name when user or instrument list changes
  useEffect(() => {
    if (availableInstruments.length > 0 && !selectedInstrumentId) {
      setSelectedInstrumentId(availableInstruments[0].id);
    }
  }, [availableInstruments, selectedInstrumentId]);

  useEffect(() => {
    if (user) {
      setMusicianName(user.musicianName || user.name || "");
      setStep("form");
      setSubmissionResult(null);
      setErrorMsg(null);
      setIsRecurring(false);
    }
  }, [user]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        if (showPolicyExplainer) {
          setShowPolicyExplainer(false);
        } else {
          onClose();
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [showPolicyExplainer, onClose]);

  const currentInstrument = useMemo(() => {
    return (
      availableInstruments.find((i) => i.id === selectedInstrumentId) ||
      availableInstruments[0] || {
        id: selectedInstrumentId,
        name: "Instrument",
        type: "Gear",
        outsideFeePerDay: "0",
      }
    );
  }, [availableInstruments, selectedInstrumentId]);

  const feeNumber = Number(currentInstrument.outsideFeePerDay || 0);

  const [startH, startM] = (startTime || "18:00").split(":").map(Number);
  const startTotalMinutes = (startH || 0) * 60 + (startM || 0);
  const endTotalMinutes = startTotalMinutes + Math.round(duration * 60);
  const endH = Math.floor(endTotalMinutes / 60);
  const endM = endTotalMinutes % 60;
  const endTimeStr = `${String(endH).padStart(2, "0")}:${String(endM).padStart(2, "0")}`;

  if (!user) return null;

  // If in series step, show the SeriesBuilderModal configured for admin booking on behalf
  if (step === "series") {
    return (
      <SeriesBuilderModal
        initialInstrument={currentInstrument}
        allInstruments={availableInstruments}
        initialServiceName={serviceName.trim()}
        initialMusicianName={musicianName.trim()}
        initialNote={note.trim()}
        initialDate={date}
        initialTimeHhmm={startTime}
        initialDuration={duration}
        initialReservationType={reservationType}
        targetUser={user}
        isAdminBooking={true}
        onBack={() => setStep("form")}
        onClose={onClose}
        onSuccess={(seriesData) => {
          onSubmit?.(seriesData);
          onSuccess?.();
          onClose();
        }}
      />
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!serviceName.trim()) {
      setErrorMsg(t("reservationForm.msgSpecifyPurpose"));
      return;
    }
    if (!musicianName.trim()) {
      setErrorMsg(t("reservationForm.musicianNameRequired"));
      return;
    }
    if (reservationType === "outside_church" && !feeAcknowledged) {
      setErrorMsg(t("reservationForm.msgAcknowledgeFee"));
      return;
    }

    // If recurring toggle is ON, transition directly to the Series Builder Modal
    if (isRecurring) {
      setStep("series");
      return;
    }

    setIsSubmitting(true);
    setErrorMsg(null);

    try {
      const payload: BehalfFormState = {
        instrumentId: currentInstrument.id,
        serviceName: serviceName.trim(),
        serviceLocation: serviceLocation.trim() || undefined,
        musicianName: musicianName.trim(),
        date,
        startTime,
        duration,
        reservationType,
        note: note.trim() || undefined,
        feeAcknowledged: true,
        userId: user.id,
      };

      const res = await adminFetch(`/users/${user.id}/book-on-behalf`, {
        method: "POST",
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        setErrorMsg(data.error || t("reservationForm.msgSubmitFailed"));
        setIsSubmitting(false);
        return;
      }

      setSubmissionResult(data.reservation || data);
      setIsSubmitting(false);
      onSubmit?.(data);
      onSuccess?.();
    } catch (err: any) {
      setErrorMsg(err.message || t("reservationForm.msgNetworkError"));
      setIsSubmitting(false);
    }
  };

  const isSubmitDisabled =
    isSubmitting ||
    !serviceName.trim() ||
    !musicianName.trim() ||
    (reservationType === "outside_church" && !feeAcknowledged);

  return (
    <>
      <div
        id="book-on-behalf-modal-backdrop"
        className="fixed inset-0 z-[100] bg-stone-900/60 backdrop-blur-xs flex items-stretch sm:items-center justify-center p-0 sm:p-4"
      >
        <div
          id="book-on-behalf-modal"
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
                      ? t("reservationForm.confirmTitle", {
                          defaultValue: "Reservation Confirmed!",
                        })
                      : t("admin.modals.bookOnBehalf.title", {
                          name: user.name,
                          defaultValue: `Book on Behalf of ${user.name}`,
                        })}
                  </h2>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-900/60 text-amber-200 border border-amber-700/50 hidden sm:inline-block truncate max-w-[140px]">
                    {currentInstrument.name}
                  </span>
                </div>
                <p className="text-[10px] sm:text-[11px] text-amber-300 truncate mt-0.5 font-medium flex items-center gap-1">
                  <Shield className="w-3 h-3 shrink-0" />
                  <span>
                    {submissionResult
                      ? t("reservationForm.confirmSubtitle", {
                          defaultValue:
                            "Your reservation is booked on the calendar.",
                        })
                      : t("admin.modals.bookOnBehalf.subtitle", {
                          defaultValue:
                            "Auto-Approved via Administrator Privilege",
                        })}
                  </span>
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
                id="btn-close-behalf-modal"
                onClick={onClose}
                className="w-8 h-8 sm:w-9 sm:h-9 flex items-center justify-center rounded-xl bg-stone-800/90 text-stone-300 hover:text-white hover:bg-stone-700 active:bg-stone-600 transition cursor-pointer border border-stone-700/70"
                aria-label={t("common.close")}
              >
                <X className="w-4 h-4 sm:w-4.5 sm:h-4.5" />
              </button>
            </div>
          </div>

          {/* ── SUCCESS RECEIPT VIEW ── */}
          {submissionResult ? (
            <div className="flex flex-col flex-1 min-h-0 bg-white">
              <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain p-4 sm:p-5 space-y-3.5">
                {/* Instant approval banner */}
                <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-3.5 sm:p-4 text-emerald-900 flex items-start gap-3 shadow-2xs">
                  <div className="w-9 h-9 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-sm">
                    <CheckCircle2 className="w-5 h-5" />
                  </div>
                  <div className="space-y-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-bold text-sm sm:text-[15px] text-emerald-950">
                        {t("admin.modals.bookOnBehalf.bookedSuccess", {
                          defaultValue: "Reservation Booked & Auto-Approved!",
                        })}
                      </span>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-200 text-emerald-900 uppercase tracking-wide">
                        {t("reservationForm.resultInstantBadge", {
                          defaultValue: "Instant Approval",
                        })}
                      </span>
                    </div>
                    <p className="text-[11px] sm:text-xs text-emerald-800 leading-relaxed">
                      {t("admin.modals.bookOnBehalf.bookedSuccessDesc", {
                        defaultValue:
                          "The reservation was created with administrator privilege and immediately approved.",
                      })}
                    </p>
                  </div>
                </div>

                {/* Receipt Card */}
                <div className="bg-stone-50 border border-stone-200 rounded-2xl p-3.5 sm:p-4 space-y-2.5 text-xs shadow-2xs">
                  <div className="font-bold text-stone-900 text-[13px] border-b border-stone-200 pb-1.5 flex items-center justify-between">
                    <span>{t("reservationForm.bookingDetailsTitle")}</span>
                    <span className="text-[10px] text-stone-500 font-mono">
                      #{String(submissionResult.id || "").slice(0, 8)}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="min-w-0">
                      <span className="text-stone-500 font-medium block text-[11px]">
                        {t("reservationForm.instrumentColonLabel")}
                      </span>
                      <span className="font-bold text-stone-900 text-xs block truncate">
                        {currentInstrument.name}
                      </span>
                      <span className="text-[10px] text-stone-500 block truncate">
                        {currentInstrument.type}
                      </span>
                    </div>

                    <div className="min-w-0">
                      <span className="text-stone-500 font-medium block text-[11px]">
                        {t("reservationForm.typeColonLabel")}
                      </span>
                      <span className="font-bold text-stone-900 text-xs capitalize">
                        {reservationType === "in_church"
                          ? t("reservationForm.inChurchFreeLabel")
                          : t("reservationForm.outsideChurchPaidLabel")}
                      </span>
                    </div>
                  </div>

                  <div className="pt-1.5 border-t border-stone-200">
                    <span className="text-stone-500 font-medium block text-[11px]">
                      {t("admin.modals.bookOnBehalf.bookedForUser", {
                        defaultValue: "Member:",
                      })}
                    </span>
                    <span className="font-bold text-amber-900 text-xs flex items-center gap-1.5">
                      <User className="w-3 h-3 text-amber-800" />
                      <span>{user.name}</span>
                    </span>
                  </div>

                  <div className="pt-1.5 border-t border-stone-200">
                    <span className="text-stone-500 font-medium block text-[11px]">
                      {t("reservationForm.purposeColonLabel")}
                    </span>
                    <span className="font-bold text-stone-900 text-xs">
                      {serviceName}
                    </span>
                  </div>

                  {serviceLocation && (
                    <div className="pt-1.5 border-t border-stone-200">
                      <span className="text-stone-500 font-medium block flex items-center gap-1 text-[11px]">
                        <Church className="w-3 h-3 text-amber-800" />
                        <span>{t("reservationForm.serviceLocationLabel")}</span>
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

                  {note && (
                    <div className="pt-1.5 border-t border-stone-200">
                      <span className="text-stone-500 font-medium block text-[11px]">
                        {t("reservationForm.leaveANoteLabel")}
                      </span>
                      <span className="font-medium text-stone-900 text-[11px] whitespace-pre-wrap">
                        {note}
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
                        {submissionResult.id}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="shrink-0 p-3 sm:px-5 sm:pb-4 border-t border-stone-200 bg-white shadow-xs">
                <button
                  type="button"
                  id="btn-done-book-on-behalf"
                  onClick={onClose}
                  className="w-full py-2 sm:py-2.5 px-4 sm:px-5 rounded-2xl text-xs sm:text-[13px] font-bold text-white transition flex items-center justify-center gap-2 shadow-md cursor-pointer touch-manipulation bg-stone-900 hover:bg-stone-800 active:bg-stone-950"
                >
                  {t("reservationForm.doneBackToCalendar")}
                </button>
              </div>
            </div>
          ) : (
            /* ── FORM VIEW ── */
            <form
              onSubmit={handleSubmit}
              className="flex flex-col flex-1 min-h-0"
            >
              <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain p-3.5 sm:p-5 space-y-3 sm:space-y-3.5">
                {/* Target User Banner Card */}
                <div className="bg-amber-50/80 border border-amber-200/80 rounded-2xl p-3 sm:p-3.5 flex items-center justify-between gap-3 shadow-2xs">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-8 h-8 rounded-xl bg-amber-800 text-white flex items-center justify-center font-bold text-xs shrink-0 shadow-xs">
                      <User className="w-4 h-4" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-amber-950 truncate">
                          {user.name}
                        </span>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-200/80 text-amber-900">
                          {t("admin.users.member", { defaultValue: "Member" })}
                        </span>
                      </div>
                      <p className="text-[10px] sm:text-[11px] text-amber-800/90 truncate mt-0.5">
                        {t("admin.modals.bookOnBehalf.bannerNotice", {
                          defaultValue:
                            "This reservation will be booked and auto-approved on behalf of this member.",
                        })}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Error Banner */}
                {errorMsg && (
                  <div
                    id="book-on-behalf-error-banner"
                    className="bg-red-50 border border-red-200 rounded-2xl p-3 text-red-900 flex items-start gap-2.5 animate-in fade-in shadow-2xs"
                  >
                    <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                    <div className="space-y-0.5 text-[11px] sm:text-xs flex-1">
                      <div className="font-bold text-red-950">
                        {t("reservationForm.submissionBlocked")}
                      </div>
                      <div className="text-red-800 leading-relaxed">
                        {errorMsg}
                      </div>
                    </div>
                  </div>
                )}

                {/* Section 1: Instrument Selection */}
                <div className="bg-white rounded-2xl border border-stone-200 p-3 sm:p-3.5 shadow-2xs space-y-2">
                  <label className="block text-xs font-bold text-stone-800">
                    {t("admin.modals.bookOnBehalf.instrumentLabel")} *
                  </label>
                  <select
                    id="behalf-instrument-select"
                    value={selectedInstrumentId}
                    onChange={(e) => setSelectedInstrumentId(e.target.value)}
                    className="w-full px-3 py-2 bg-stone-50 hover:bg-stone-100/60 border border-stone-200 rounded-xl text-stone-900 text-xs sm:text-[13px] font-semibold focus:outline-none focus:ring-2 focus:ring-amber-800/40 focus:border-amber-800 transition cursor-pointer"
                  >
                    {availableInstruments.map((inst) => (
                      <option key={inst.id} value={inst.id}>
                        {inst.name} ({inst.type})
                        {inst.outsideFeePerDay && Number(inst.outsideFeePerDay) > 0
                          ? ` • ${inst.outsideFeePerDay} EGP/day`
                          : ""}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Section 2: Usage Type Selector */}
                <ReservationUsageTypeSelector
                  reservationType={reservationType}
                  onReservationTypeChange={(t) => setReservationType(t)}
                  feeAcknowledged={feeAcknowledged}
                  onFeeAcknowledgedChange={(a) => setFeeAcknowledged(a)}
                  feePerDay={feeNumber}
                  containerClassName="bg-white rounded-2xl border border-stone-200 p-3 sm:p-3.5 shadow-2xs space-y-3"
                />

                {/* Section 3: Purpose / Service Details */}
                <div className="bg-white rounded-2xl border border-stone-200 p-3 sm:p-3.5 shadow-2xs space-y-3">
                  <div>
                    <label className="block text-xs font-bold text-stone-800 mb-1">
                      {t("admin.modals.bookOnBehalf.serviceLabel")} *
                    </label>
                    <input
                      type="text"
                      required
                      placeholder={t("admin.modals.bookOnBehalf.servicePlaceholder")}
                      value={serviceName}
                      onChange={(e) => setServiceName(e.target.value)}
                      className="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-xl text-stone-900 text-xs focus:outline-none focus:ring-2 focus:ring-amber-800/40 focus:border-amber-800 transition"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-stone-800 mb-1">
                      {t("reservationForm.serviceLocationLabel")} (
                      {t("common.optional", { defaultValue: "Optional" })})
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 start-0 flex items-center ps-3 pointer-events-none text-stone-400">
                        <Church className="w-3.5 h-3.5" />
                      </div>
                      <input
                        type="text"
                        placeholder={t("reservationForm.serviceLocationPlaceholder", {
                          defaultValue: "e.g. Main Church Hall, St. Mary Altar",
                        })}
                        value={serviceLocation}
                        onChange={(e) => setServiceLocation(e.target.value)}
                        className="w-full ps-8.5 pe-3 py-2 bg-stone-50 border border-stone-200 rounded-xl text-stone-900 text-xs focus:outline-none focus:ring-2 focus:ring-amber-800/40 focus:border-amber-800 transition"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-stone-800 mb-1">
                      {t("reservationForm.musicianNameLabel")} *
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 start-0 flex items-center ps-3 pointer-events-none text-stone-400">
                        <User className="w-3.5 h-3.5" />
                      </div>
                      <input
                        type="text"
                        required
                        placeholder={t("reservationForm.musicianNamePlaceholder")}
                        value={musicianName}
                        onChange={(e) => setMusicianName(e.target.value)}
                        className="w-full ps-8.5 pe-3 py-2 bg-stone-50 border border-stone-200 rounded-xl text-stone-900 text-xs focus:outline-none focus:ring-2 focus:ring-amber-800/40 focus:border-amber-800 transition"
                      />
                    </div>
                  </div>
                </div>

                {/* Section 4: Schedule */}
                <div className="bg-white rounded-2xl border border-stone-200 p-3 sm:p-3.5 shadow-2xs space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-bold text-stone-800 mb-1">
                        {t("admin.modals.bookOnBehalf.dateLabel")} *
                      </label>
                      <input
                        type="date"
                        required
                        value={date}
                        onChange={(e) => setDate(e.target.value)}
                        className="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-xl text-stone-900 text-xs focus:outline-none focus:ring-2 focus:ring-amber-800/40 focus:border-amber-800 transition cursor-pointer"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-stone-800 mb-1">
                        {t("admin.modals.bookOnBehalf.startTimeLabel")} *
                      </label>
                      <select
                        value={startTime}
                        onChange={(e) => setStartTime(e.target.value)}
                        className="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-xl text-stone-900 text-xs focus:outline-none focus:ring-2 focus:ring-amber-800/40 focus:border-amber-800 transition cursor-pointer"
                      >
                        {TIME_SLOTS.map((slot) => (
                          <option key={slot} value={slot}>
                            {formatHhmmTo12Hour(slot)}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="block text-xs font-bold text-stone-800">
                        {t("admin.modals.bookOnBehalf.durationLabel")} *
                      </label>
                      <span className="text-[11px] font-bold text-amber-800">
                        {formatHhmmTo12Hour(startTime)} –{" "}
                        {formatHhmmTo12Hour(endTimeStr)} ({duration}h)
                      </span>
                    </div>
                    <select
                      value={duration}
                      onChange={(e) =>
                        setDuration(parseFloat(e.target.value) || 1)
                      }
                      className="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-xl text-stone-900 text-xs focus:outline-none focus:ring-2 focus:ring-amber-800/40 focus:border-amber-800 transition cursor-pointer"
                    >
                      {DURATION_OPTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {t(opt.labelKey)} ({opt.value}h)
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Section 5: Notes */}
                <div className="bg-white rounded-2xl border border-stone-200 p-3 sm:p-3.5 shadow-2xs">
                  <label className="block text-xs font-bold text-stone-800 mb-1">
                    {t("reservationForm.leaveANoteLabel", {
                      defaultValue: "Notes & Special Requests",
                    })}{" "}
                    ({t("common.optional", { defaultValue: "Optional" })})
                  </label>
                  <textarea
                    rows={2}
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    placeholder={t("reservationForm.leaveANotePlaceholder", {
                      defaultValue: "Add any specific requests or instructions...",
                    })}
                    className="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-xl text-stone-900 text-xs focus:outline-none focus:ring-2 focus:ring-amber-800/40 focus:border-amber-800 transition"
                  />
                </div>

                {/* Section 6: Recurring Reservation Toggle */}
                <div className="bg-white border border-stone-200 rounded-2xl p-2.5 sm:p-3 shadow-2xs">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-xl bg-amber-100/80 text-amber-900 flex items-center justify-center shrink-0">
                        <Repeat className="w-3.5 h-3.5" />
                      </div>
                      <div>
                        <span className="text-[11px] sm:text-xs font-bold text-stone-900 block">
                          {t("reservationForm.recurringToggleLabel", {
                            defaultValue: "Recurring Reservation (Series)",
                          })}
                        </span>
                        <span className="text-[10px] sm:text-[11px] text-stone-500 block">
                          {isAr
                            ? "تكرار الحجز أسبوعياً أو في تواريخ متعددة"
                            : "Repeat reservation weekly or on custom dates"}
                        </span>
                      </div>
                    </div>

                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        id="toggle-behalf-recurring"
                        type="checkbox"
                        checked={isRecurring}
                        onChange={(e) => setIsRecurring(e.target.checked)}
                        className="sr-only peer"
                      />
                      <div className="w-10 h-5.5 bg-stone-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-stone-300 after:border after:rounded-full after:h-4.5 after:w-4.5 after:transition-all peer-checked:bg-amber-800" />
                    </label>
                  </div>

                  {isRecurring && (
                    <div className="mt-2 pt-1.5 border-t border-stone-100 text-[11px] text-amber-900 bg-amber-50/60 p-2 rounded-xl flex items-center justify-between gap-2">
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
                  {t("admin.modals.bookOnBehalf.cancel")}
                </button>

                <button
                  type="submit"
                  id="btn-submit-behalf"
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
                      <span>{t("reservationForm.processingSubmission")}</span>
                    </>
                  ) : isRecurring ? (
                    <>
                      <span>{t("reservationForm.continueToSeriesBuilder")}</span>
                      {isAr ? (
                        <ArrowRight className="w-3.5 h-3.5 rotate-180" />
                      ) : (
                        <ArrowRight className="w-3.5 h-3.5" />
                      )}
                    </>
                  ) : (
                    <>
                      <span>{t("admin.modals.bookOnBehalf.submit")}</span>
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

      {showPolicyExplainer && (
        <PolicyExplainerModal
          isOpen={showPolicyExplainer}
          onClose={() => setShowPolicyExplainer(false)}
        />
      )}
    </>
  );
};
