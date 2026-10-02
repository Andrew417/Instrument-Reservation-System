import React, { useState, useEffect, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { useAuth } from "../contexts/AuthContext.tsx";
import { Instrument } from "./AvailabilityCalendar.tsx";
import { formatHhmmTo12Hour, formatDisplayDate } from "../lib/date-utils";
import {
  Zap,
  CheckCircle2,
  Calendar,
  Clock,
  Music2,
  Share2,
  AlertCircle,
  X,
  Sliders,
  User,
  Church,
  RotateCcw,
  ChevronDown,
} from "lucide-react";

export interface QuickRebookSuggestion {
  instrumentId: string;
  instrumentName: string;
  instrumentType: string;
  serviceName: string;
  musicianName: string;
  date: string;
  dayNameEn: string;
  dayNameAr: string;
  startTime: string;
  endTime: string;
  duration: number;
  reservationType: "in_church" | "outside_church";
  isAvailable: boolean;
  alreadyBooked: boolean;
  alreadyBookedStatus?: "approved" | "pending" | null;
  alreadyBookedId?: string | null;
}

export interface QuickRebookCardProps {
  instruments: Instrument[];
  onSelectDate: (date: string) => void;
  onOpenCustomize: (prefill: {
    instrument: Instrument;
    date: string;
    startTime: string;
    duration: number;
    serviceName: string;
    musicianName: string;
  }) => void;
  onReservationSuccess: () => void;
  refreshTrigger?: number;
}

export const QuickRebookCard: React.FC<QuickRebookCardProps> = ({
  instruments,
  onSelectDate,
  onOpenCustomize,
  onReservationSuccess,
  refreshTrigger,
}) => {
  const { profile, sessionToken } = useAuth();
  const { t, i18n } = useTranslation();
  const isAr = i18n.language === "ar";

  const [suggestions, setSuggestions] = useState<QuickRebookSuggestion[]>([]);
  const [selectedIndex, setSelectedIndex] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(true);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [confirmedBooking, setConfirmedBooking] = useState<{
    id: string;
    instrumentName: string;
    serviceName: string;
    musicianName: string;
    date: string;
    dayName: string;
    startTime: string;
    endTime: string;
    duration: number;
    status: string;
  } | null>(null);
  const [isDismissed, setIsDismissed] = useState<boolean>(false);

  const fetchSuggestions = useCallback(async () => {
    if (!profile?.id) return;
    try {
      setLoading(true);
      setErrorMsg(null);
      const res = await fetch("/api/reservations/quick-rebook-suggestion", {
        headers: {
          Authorization: `Bearer ${sessionToken || ""}`,
        },
      });
      const data = await res.json();
      if (data.success && data.hasSuggestion) {
        const list: QuickRebookSuggestion[] =
          data.allSuggestions || (data.suggestion ? [data.suggestion] : []);
        setSuggestions(list);
        if (selectedIndex >= list.length) {
          setSelectedIndex(0);
        }
      } else {
        setSuggestions([]);
      }
    } catch (err: any) {
      console.warn("Could not load quick rebook suggestion:", err.message);
      setSuggestions([]);
    } finally {
      setLoading(false);
    }
  }, [profile?.id, sessionToken, selectedIndex]);

  useEffect(() => {
    fetchSuggestions();
  }, [fetchSuggestions, refreshTrigger]);

  if (!profile || loading || suggestions.length === 0) {
    return null;
  }

  // Collapsed / dismissed view with restore button
  if (isDismissed) {
    return (
      <div className="flex items-center justify-start animate-in fade-in duration-150 mb-1">
        <button
          type="button"
          onClick={() => setIsDismissed(false)}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-200 text-xs font-bold transition cursor-pointer shadow-2xs active:scale-95 touch-manipulation"
          title={t("quickRebook.reopenPrompt", "Re-book Regular Service")}
        >
          <Zap className="w-3.5 h-3.5 text-amber-700 fill-current" />
          <span>{t("quickRebook.reopenPrompt", "Re-book Regular Service")}</span>
        </button>
      </div>
    );
  }

  const activeSuggestion = suggestions[selectedIndex] || suggestions[0];
  const dayName = isAr ? activeSuggestion.dayNameAr : activeSuggestion.dayNameEn;
  const timeFormatted = `${formatHhmmTo12Hour(activeSuggestion.startTime)} – ${formatHhmmTo12Hour(activeSuggestion.endTime)}`;
  const dateFormatted = formatDisplayDate(activeSuggestion.date, isAr ? "ar" : "en");

  // Helper to format service display name nicely according to active language
  const getLocalizedServiceName = (name: string): string => {
    if (!name) return "";
    const lower = name.toLowerCase().trim();
    if (isAr) {
      if (lower.includes("youth") || lower.includes("شباب")) return "اجتماع الشباب";
      if (lower.includes("sunday") || (lower.includes("liturgy") && lower.includes("أحد"))) return "قداس الأحد";
      if (lower.includes("friday") || (lower.includes("liturgy") && lower.includes("جمعة"))) return "قداس الجمعة";
      if (lower.includes("choir") || lower.includes("كورال") || lower.includes("ترانيم")) return "بروفة الكورال";
      if (lower.includes("prayer") || lower.includes("صلاة") || lower.includes("عشية")) return "اجتماع صلاة وعشية";
    } else {
      if (lower.includes("شباب")) return "Youth Meeting";
      if (lower.includes("قداس") && lower.includes("أحد")) return "Sunday Liturgy";
      if (lower.includes("قداس") && lower.includes("جمعة")) return "Friday Liturgy";
      if (lower.includes("كورال")) return "Choir Rehearsal";
      if (lower.includes("صلاة")) return "Prayer Meeting";
    }
    return name;
  };

  const localizedActiveService = getLocalizedServiceName(activeSuggestion.serviceName);

  // Find instrument object from loaded instruments
  const matchedInstrument =
    instruments.find((i) => i.id === activeSuggestion.instrumentId) ||
    instruments[0] ||
    ({
      id: activeSuggestion.instrumentId,
      name: activeSuggestion.instrumentName,
      type: activeSuggestion.instrumentType,
      bookingMode: "instant",
      isRemoved: false,
    } as Instrument);

  const handle1TapConfirm = async () => {
    if (!activeSuggestion || submitting) return;

    setSubmitting(true);
    setErrorMsg(null);

    try {
      const res = await fetch("/api/reservations", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${sessionToken || ""}`,
        },
        body: JSON.stringify({
          instrumentId: activeSuggestion.instrumentId,
          serviceName: activeSuggestion.serviceName,
          musicianName: activeSuggestion.musicianName || profile.name,
          date: activeSuggestion.date,
          startTime: activeSuggestion.startTime,
          duration: activeSuggestion.duration,
          reservationType: activeSuggestion.reservationType || "in_church",
          feeAcknowledged: true,
          note: "1-Tap Quick Re-Book",
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        setErrorMsg(
          data.error ||
            t("reservationForm.msgSubmitFailed", "Failed to book slot."),
        );
        return;
      }

      const resObj = data.reservation;
      setConfirmedBooking({
        id: resObj?.id || "quick",
        instrumentName: activeSuggestion.instrumentName,
        serviceName: localizedActiveService,
        musicianName: activeSuggestion.musicianName || profile.name,
        date: activeSuggestion.date,
        dayName,
        startTime: activeSuggestion.startTime,
        endTime: activeSuggestion.endTime,
        duration: activeSuggestion.duration,
        status: resObj?.status || "approved",
      });

      onReservationSuccess();
    } catch (err: any) {
      setErrorMsg(err.message || "Network error. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleShareWhatsApp = (customMsg?: string) => {
    const booking = confirmedBooking || {
      instrumentName: activeSuggestion.instrumentName,
      serviceName: localizedActiveService,
      musicianName: activeSuggestion.musicianName || profile.name,
      date: activeSuggestion.date,
      dayName,
      startTime: activeSuggestion.startTime,
      endTime: activeSuggestion.endTime,
      duration: activeSuggestion.duration,
    };

    let text = "";
    if (isAr) {
      text =
        `🎵 *تأكيد حجز آلة موسيقية كنسية*\n` +
        `🎸 *الآلة:* ${booking.instrumentName}\n` +
        `⛪ *الخدمة:* ${booking.serviceName}\n` +
        `📅 *الموعد:* ${booking.dayName} (${booking.date})\n` +
        `⏰ *الوقت:* ${formatHhmmTo12Hour(booking.startTime)} إلى ${formatHhmmTo12Hour(booking.endTime)} (${booking.duration} ساعة)\n` +
        `👤 *العازف:* ${booking.musicianName}\n\n` +
        `تم تأكيد الحجز في جدول الكنيسة الرسمي. نراكم في الخدمة! ✨`;
    } else {
      text =
        `🎵 *Church Instrument Reservation Confirmed!*\n` +
        `🎸 *Instrument:* ${booking.instrumentName}\n` +
        `⛪ *Service:* ${booking.serviceName}\n` +
        `📅 *Date:* ${booking.dayName}, ${booking.date}\n` +
        `⏰ *Time:* ${formatHhmmTo12Hour(booking.startTime)} – ${formatHhmmTo12Hour(booking.endTime)} (${booking.duration}h)\n` +
        `👤 *Musician:* ${booking.musicianName}\n\n` +
        `Reserved and scheduled in the master church calendar! ✨`;
    }

    const encoded = encodeURIComponent(customMsg || text);
    window.open(`https://wa.me/?text=${encoded}`, "_blank");
  };

  const handleCustomizeClick = () => {
    if (!activeSuggestion) return;
    onOpenCustomize({
      instrument: matchedInstrument,
      date: activeSuggestion.date,
      startTime: activeSuggestion.startTime,
      duration: activeSuggestion.duration,
      serviceName: activeSuggestion.serviceName,
      musicianName: activeSuggestion.musicianName || profile.name,
    });
  };

  // State A: Confirmation Receipt (Compact)
  if (confirmedBooking) {
    return (
      <div
        id="quick-rebook-success-card"
        className="rounded-2xl bg-gradient-to-r from-emerald-50 to-teal-50 border border-emerald-300 p-3 shadow-xs animate-in fade-in zoom-in-95 duration-200"
      >
        <div className="flex items-center justify-between gap-2.5">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-xs">
              <CheckCircle2 className="w-4 h-4" />
            </div>

            <div className="min-w-0">
              <h4 className="text-xs sm:text-sm font-bold text-stone-900 truncate">
                {t("quickRebook.successTitle", "Reservation Confirmed!")} — {confirmedBooking.instrumentName}
              </h4>
              <p className="text-[11px] text-stone-600 font-medium truncate mt-0.5">
                {confirmedBooking.serviceName} · {confirmedBooking.dayName}, {formatDisplayDate(confirmedBooking.date, isAr ? "ar" : "en")} · {formatHhmmTo12Hour(confirmedBooking.startTime)} – {formatHhmmTo12Hour(confirmedBooking.endTime)}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={() => handleShareWhatsApp()}
              className="h-8 px-2.5 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs transition cursor-pointer flex items-center gap-1 shadow-2xs active:scale-95 touch-manipulation"
              title={t("quickRebook.shareWhatsApp", "Share to WhatsApp Group")}
            >
              <Share2 className="w-3.5 h-3.5" />
              <span className="hidden xs:inline">{t("quickRebook.shareWhatsApp", "Share")}</span>
            </button>

            <button
              type="button"
              onClick={() => setConfirmedBooking(null)}
              className="h-8 w-8 rounded-lg bg-white hover:bg-stone-50 text-stone-600 flex items-center justify-center border border-stone-200 transition cursor-pointer touch-manipulation"
              title={t("quickRebook.rebookAnother", "Book Another Slot")}
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>

            <button
              type="button"
              onClick={() => setIsDismissed(true)}
              className="h-8 w-8 rounded-lg text-stone-400 hover:text-stone-600 flex items-center justify-center cursor-pointer"
              title={t("quickRebook.dismiss", "Hide")}
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
    );
  }

  // State B: Routine Service Ready to Re-Book (Ultra Compact, Zero Redundancy, Best Mobile Layout)
  return (
    <div
      id="quick-rebook-routine-card"
      className="rounded-2xl bg-white border border-amber-200 shadow-xs overflow-hidden transition-all hover:border-amber-300"
    >
      {/* 1. Header Row (Super Compact) */}
      <div className="bg-amber-50/70 px-3 py-1.5 flex items-center justify-between border-b border-amber-100 gap-2">
        <div className="flex items-center gap-1.5 min-w-0">
          <div className="w-5 h-5 rounded-md bg-amber-800 text-amber-100 flex items-center justify-center shrink-0">
            <Zap className="w-3 h-3 fill-current" />
          </div>
          <span className="text-xs font-bold text-stone-900 truncate">
            {t("quickRebook.title", "Re-Book Your Regular Service")}
          </span>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          <button
            type="button"
            onClick={handleCustomizeClick}
            className="px-2 py-0.5 rounded-md text-[11px] font-semibold text-stone-600 hover:text-stone-900 bg-white border border-stone-200 hover:border-stone-300 transition cursor-pointer touch-manipulation flex items-center gap-1"
            title={t("quickRebook.customize", "Change Details")}
          >
            <Sliders className="w-3 h-3 text-stone-500" />
            <span>{t("quickRebook.customize", "Change Details")}</span>
          </button>

          <button
            type="button"
            onClick={() => setIsDismissed(true)}
            className="w-6 h-6 rounded-md flex items-center justify-center text-stone-400 hover:text-stone-600 hover:bg-stone-100 transition cursor-pointer"
            title={t("quickRebook.dismiss", "Hide")}
            aria-label="Dismiss"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* 2. Card Content & Compact CTA (Zero text repetition) */}
      <div className="p-2.5 sm:p-3 space-y-2">
        {/* Main Details and Action Button container */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
          <div className="space-y-1.5 min-w-0 flex-1">
            {/* Row 1: Instrument Name + Service Dropdown (Best UX on mobile) */}
            <div className="flex items-center gap-2 flex-wrap text-xs">
              {/* Instrument */}
              <div className="flex items-center gap-1 font-bold text-stone-900 min-w-0">
                <Music2 className="w-3.5 h-3.5 text-amber-800 shrink-0" />
                <span className="truncate">{activeSuggestion.instrumentName}</span>
              </div>

              <span className="text-stone-300 font-bold">·</span>

              {/* Service: Clean single interactive selector (no separate pill strip) */}
              <div className="flex items-center gap-1 min-w-0">
                <Church className="w-3.5 h-3.5 text-stone-400 shrink-0" />
                <div className="relative inline-flex items-center">
                  <select
                    value={selectedIndex}
                    onChange={(e) => setSelectedIndex(Number(e.target.value))}
                    className="bg-stone-100 hover:bg-stone-200/80 border border-stone-300 text-stone-900 font-bold text-xs rounded-md pl-1.5 pr-5 rtl:pr-1.5 rtl:pl-5 py-0.5 focus:outline-none focus:ring-1 focus:ring-amber-700 cursor-pointer appearance-none max-w-[200px] truncate"
                    title={t("quickRebook.switchRoutine", "Choose Service")}
                  >
                    {suggestions.map((sug, idx) => (
                      <option key={idx} value={idx}>
                        {getLocalizedServiceName(sug.serviceName)} ({isAr ? sug.dayNameAr : sug.dayNameEn})
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="w-3 h-3 text-stone-500 absolute right-1 rtl:right-auto rtl:left-1 pointer-events-none" />
                </div>
              </div>

              <span className="text-stone-300 font-bold hidden xs:inline">·</span>

              {/* Musician */}
              <div className="items-center gap-1 text-stone-600 hidden xs:inline-flex min-w-0">
                <User className="w-3 h-3 text-stone-400 shrink-0" />
                <span className="truncate font-medium">{activeSuggestion.musicianName || profile.name}</span>
              </div>
            </div>

            {/* Row 2: Date & Time in 1 single row + Live Status */}
            <div className="flex items-center gap-1.5 flex-wrap text-xs text-stone-700 font-semibold">
              <div className="inline-flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5 text-amber-700 shrink-0" />
                <span>{dateFormatted}</span>
              </div>

              <span className="text-stone-300 font-bold">·</span>

              <div className="inline-flex items-center gap-1">
                <Clock className="w-3.5 h-3.5 text-amber-700 shrink-0" />
                <span>{timeFormatted}</span>
                <span className="text-stone-400 font-normal">
                  ({activeSuggestion.duration} {isAr ? "ساعة" : "hr"})
                </span>
              </div>

              <span className="text-stone-300 font-bold">·</span>

              {/* Status Indicator */}
              {activeSuggestion.alreadyBooked ? (
                <span className="inline-flex items-center gap-0.5 text-[11px] font-bold text-emerald-800 bg-emerald-100/90 px-1.5 py-0.2 rounded">
                  <CheckCircle2 className="w-3 h-3 text-emerald-700" />
                  <span>{t("quickRebook.alreadyBookedShort", "Already Booked")}</span>
                </span>
              ) : activeSuggestion.isAvailable ? (
                <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 animate-pulse" />
                  <span>{t("quickRebook.available", "Available")}</span>
                </span>
              ) : (
                <span className="inline-flex items-center gap-0.5 text-[11px] font-bold text-amber-800 bg-amber-100/90 px-1.5 py-0.2 rounded">
                  <AlertCircle className="w-3 h-3 text-amber-700" />
                  <span>{t("quickRebook.slotOccupiedShort", "Occupied")}</span>
                </span>
              )}
            </div>
          </div>

          {/* Compact Action Button (Fits neatly on mobile without occupying large vertical screen height) */}
          <div className="shrink-0 flex items-center justify-end">
            {activeSuggestion.alreadyBooked ? (
              <button
                type="button"
                onClick={() => handleShareWhatsApp()}
                className="w-full sm:w-auto h-9 px-3.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 active:bg-emerald-900 text-white font-bold text-xs transition cursor-pointer flex items-center justify-center gap-1.5 shadow-2xs active:scale-95 touch-manipulation"
              >
                <Share2 className="w-3.5 h-3.5" />
                <span>{t("quickRebook.shareWhatsApp", "Share to WhatsApp")}</span>
              </button>
            ) : activeSuggestion.isAvailable ? (
              <button
                type="button"
                onClick={handle1TapConfirm}
                disabled={submitting}
                className="w-full sm:w-auto h-9 px-3.5 rounded-xl bg-stone-900 hover:bg-amber-950 active:bg-black text-amber-300 hover:text-white font-bold text-xs transition cursor-pointer flex items-center justify-center gap-1.5 shadow-2xs active:scale-95 touch-manipulation disabled:opacity-50"
              >
                {submitting ? (
                  <>
                    <div className="w-3.5 h-3.5 border-2 border-amber-300 border-t-transparent rounded-full animate-spin" />
                    <span>{t("quickRebook.confirming", "Confirming...")}</span>
                  </>
                ) : (
                  <>
                    <Zap className="w-3.5 h-3.5 fill-current text-amber-400" />
                    <span>{t("quickRebook.confirmBtn", "Confirm in 1 Tap")}</span>
                  </>
                )}
              </button>
            ) : (
              <button
                type="button"
                onClick={() => onSelectDate(activeSuggestion.date)}
                className="w-full sm:w-auto h-9 px-3 rounded-xl bg-white text-stone-800 border border-stone-300 hover:bg-stone-50 font-bold text-xs transition cursor-pointer flex items-center justify-center gap-1.5 touch-manipulation"
              >
                <Calendar className="w-3.5 h-3.5 text-stone-500" />
                <span>{t("quickRebook.viewCalendar", "View Calendar")}</span>
              </button>
            )}
          </div>
        </div>

        {/* Error notification if submit failed */}
        {errorMsg && (
          <div className="bg-red-50 border border-red-200 text-red-800 text-[11px] font-semibold px-2 py-1 rounded-md flex items-center justify-between gap-2 animate-in fade-in">
            <span className="truncate">{errorMsg}</span>
            <button
              type="button"
              onClick={() => setErrorMsg(null)}
              className="text-red-700 hover:text-red-900 font-bold px-1"
            >
              ✕
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default QuickRebookCard;
