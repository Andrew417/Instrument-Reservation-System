import React, { useState, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useAuth } from "../contexts/AuthContext.tsx";
import { Instrument } from "./AvailabilityCalendar.tsx";
import {
  formatHhmmTo12Hour,
  getTodayDateString,
  getCairoDateString,
} from "../lib/date-utils";
import {
  Music2,
  Calendar,
  Clock,
  User,
  Plus,
  Trash2,
  AlertCircle,
  CheckCircle2,
  X,
  Sparkles,
  Shield,
  HelpCircle,
  Church,
  Car,
  ChevronRight,
  Info,
  DollarSign,
} from "lucide-react";
import { ReservationUsageTypeSelector } from "./ReservationUsageTypeSelector.tsx";

export interface BandPackModalProps {
  isOpen: boolean;
  onClose: () => void;
  allInstruments: Instrument[];
  initialDate?: string;
  onSuccess: (bandPackId: string) => void;
}

interface BandItem {
  id: string;
  instrumentId: string;
  musicianName: string;
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
  { labelAr: "نصف ساعة (0.5 س)", labelEn: "30 Minutes (0.5h)", value: 0.5 },
  { labelAr: "ساعة واحدة (1 س)", labelEn: "1 Hour", value: 1 },
  { labelAr: "ساعة ونصف (1.5 س)", labelEn: "1.5 Hours", value: 1.5 },
  { labelAr: "ساعتان (2 س)", labelEn: "2 Hours", value: 2 },
  { labelAr: "ساعتان ونصف (2.5 س)", labelEn: "2.5 Hours", value: 2.5 },
  { labelAr: "3 ساعات (3 س)", labelEn: "3 Hours", value: 3 },
  { labelAr: "4 ساعات (4 س)", labelEn: "4 Hours", value: 4 },
  { labelAr: "5 ساعات (5 س)", labelEn: "5 Hours", value: 5 },
];

export const BandPackModal: React.FC<BandPackModalProps> = ({
  isOpen,
  onClose,
  allInstruments,
  initialDate,
  onSuccess,
}) => {
  const { profile, sessionToken } = useAuth();
  const { t, i18n } = useTranslation();
  const isAr = i18n.language === "ar";

  const todayStr = getTodayDateString();
  const [serviceName, setServiceName] = useState("");
  const [serviceLocation, setServiceLocation] = useState("");
  const [date, setDate] = useState(initialDate || todayStr);
  const [startTime, setStartTime] = useState("18:00");
  const [duration, setDuration] = useState<number>(2);
  const [reservationType, setReservationType] = useState<
    "in_church" | "outside_church"
  >("in_church");
  const [feeAcknowledged, setFeeAcknowledged] = useState(false);
  const [note, setNote] = useState("");

  // Filter available instruments (not removed)
  const bookableInstruments = useMemo(() => {
    return allInstruments.filter((inst) => !inst.isRemoved);
  }, [allInstruments]);

  // Band Pack Items
  const [items, setItems] = useState<BandItem[]>(() => {
    const firstInst = bookableInstruments[0];
    const secondInst = bookableInstruments[1];
    const initialItems: BandItem[] = [];
    if (firstInst) {
      initialItems.push({
        id: "item_1",
        instrumentId: firstInst.id,
        musicianName: profile?.name || "",
      });
    }
    if (secondInst) {
      initialItems.push({
        id: "item_2",
        instrumentId: secondInst.id,
        musicianName: "",
      });
    }
    return initialItems;
  });

  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleAddItem = () => {
    const usedIds = new Set(items.map((i) => i.instrumentId));
    const nextAvail = bookableInstruments.find((inst) => !usedIds.has(inst.id));
    if (!nextAvail) {
      setErrorMsg(
        isAr
          ? "تمت إضافة جميع الآلات المتاحة في الكتالوج بالفعل."
          : "All available catalog instruments have already been added.",
      );
      return;
    }
    setItems((prev) => [
      ...prev,
      {
        id: `item_${Date.now()}_${Math.random().toString(36).substring(2, 5)}`,
        instrumentId: nextAvail.id,
        musicianName: "",
      },
    ]);
  };

  const handleRemoveItem = (index: number) => {
    if (items.length <= 1) return;
    setItems((prev) => prev.filter((_, idx) => idx !== index));
  };

  const handleUpdateItem = (
    index: number,
    field: "instrumentId" | "musicianName",
    value: string,
  ) => {
    setItems((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
  };

  // Calculate total outside fees
  const totalOutsideFee = useMemo(() => {
    if (reservationType !== "outside_church") return 0;
    return items.reduce((sum, it) => {
      const inst = bookableInstruments.find((x) => x.id === it.instrumentId);
      const fee = Number(inst?.outsideFeePerDay || 0);
      return sum + fee;
    }, 0);
  }, [items, reservationType, bookableInstruments]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!serviceName.trim()) {
      setErrorMsg(
        t("reservationForm.msgSpecifyPurpose", {
          defaultValue: isAr
            ? "يرجى تحديد الغرض من هذا الحجز (مثال: صلاة الأحد صباحاً، كورال الشباب)."
            : "Please specify the purpose of this reservation (e.g., Sunday Service, Youth Choir).",
        }),
      );
      return;
    }

    if (items.length === 0) {
      setErrorMsg(
        isAr
          ? "يجب إضافة آلة واحدة على الأقل لطاقم الباند."
          : "Please add at least one instrument to the band pack.",
      );
      return;
    }

    // Check unique instruments
    const chosenIds = items.map((i) => i.instrumentId);
    if (new Set(chosenIds).size !== chosenIds.length) {
      setErrorMsg(
        isAr
          ? "لا يمكن تكرار نفس الآلة مرتين في نفس الحجز."
          : "Duplicate instruments detected. Each instrument must be unique.",
      );
      return;
    }

    // Check all musician names
    for (let i = 0; i < items.length; i++) {
      if (!items[i].musicianName.trim()) {
        const inst = bookableInstruments.find(
          (x) => x.id === items[i].instrumentId,
        );
        setErrorMsg(
          isAr
            ? `يرجى إدخال اسم العازف المسؤول عن الآلة (${inst?.name || `#${i + 1}`}).`
            : `${t("reservationForm.musicianNameRequired", { defaultValue: "Please enter the musician name." })} (${inst?.name || `#${i + 1}`})`,
        );
        return;
      }
    }

    if (reservationType === "outside_church" && !feeAcknowledged) {
      setErrorMsg(
        t("reservationForm.msgAcknowledgeFee", {
          defaultValue: isAr
            ? "يرجى الموافقة على رسوم الاستخدام خارج الكنيسة قبل المتابعة."
            : "Please agree to the outside church fee before continuing.",
        }),
      );
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        serviceName: serviceName.trim(),
        serviceLocation: serviceLocation.trim() || undefined,
        date,
        startTime,
        duration: Number(duration),
        reservationType,
        feeAcknowledged:
          reservationType === "outside_church" ? feeAcknowledged : false,
        note: note.trim() || undefined,
        items: items.map((it) => ({
          instrumentId: it.instrumentId,
          musicianName: it.musicianName.trim(),
        })),
      };

      const res = await fetch("/api/reservations/band-pack", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${sessionToken || ""}`,
        },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to submit band pack reservation.");
      }

      onSuccess(data.bandPackId);
      onClose();
    } catch (err: any) {
      setErrorMsg(err.message || "An unexpected error occurred.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      id="band-pack-modal-backdrop"
      className="fixed inset-0 z-[100] bg-stone-900/60 backdrop-blur-xs flex items-stretch sm:items-center justify-center p-0 sm:p-4"
    >
      <div
        id="band-pack-modal"
        className="bg-stone-50 sm:rounded-3xl sm:border sm:border-stone-200 shadow-2xl w-full sm:max-w-xl md:max-w-2xl z-10 flex flex-col h-full sm:h-auto sm:max-h-[90vh] overflow-hidden animate-in fade-in zoom-in-95 duration-150 pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]"
        dir={isAr ? "rtl" : "ltr"}
      >
        {/* Top Header - Consistent with ReservationFormModal & EditReservationModal */}
        <div className="shrink-0 bg-stone-900 text-white px-4 sm:px-6 py-3.5 sm:py-4 flex items-center justify-between border-b border-stone-800">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-2xl bg-amber-800 text-amber-100 flex items-center justify-center font-bold shadow-xs shrink-0">
              <Music2 className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-sm sm:text-base font-bold text-white leading-tight truncate">
                  {isAr
                    ? "حجز طاقم باند كامل (مجموعة آلات)"
                    : "Full Band Pack Booking"}
                </h2>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-900/60 text-amber-200 border border-amber-700/50 hidden xs:inline-block">
                  {isAr ? "حجز جماعي موحد" : "All-in-One"}
                </span>
              </div>
              <p className="text-[11px] sm:text-xs text-stone-400 truncate mt-0.5">
                {isAr
                  ? "احجز كل آلات البروفة أو الخدمة معاً في خطوة واحدة بسيطة"
                  : "Book all rehearsal instruments together in one single request"}
              </p>
            </div>
          </div>

          <button
            id="btn-close-band-pack-modal"
            type="button"
            onClick={onClose}
            aria-label="Close modal"
            className="w-9 h-9 sm:w-10 sm:h-10 flex items-center justify-center rounded-xl bg-stone-800/90 text-stone-300 hover:text-white hover:bg-stone-700 active:bg-stone-600 transition cursor-pointer border border-stone-700/70 shrink-0 touch-manipulation"
          >
            <X className="w-4 h-4 sm:w-5 sm:h-5" />
          </button>
        </div>

        {/* Guidance Banner - Simple & clear 1-line notice */}
        <div className="bg-amber-50/90 border-b border-amber-200/80 px-4 sm:px-6 py-2 flex items-center gap-2 text-xs text-amber-950 shrink-0">
          <Info className="w-4 h-4 text-amber-700 shrink-0" />
          <span className="text-[11px] sm:text-xs text-amber-950 font-medium leading-snug">
            {isAr
              ? "لحجز عدة آلات معاً لطاقم باند أو كورال. (لحجز آلة واحدة فقط، أغلق هذه النافذة واخترها مباشرة من الجدول)."
              : "For booking multiple band instruments together. (For a single instrument, close this and select it on the calendar)."}
          </span>
        </div>

        {/* Scrollable Form Body */}
        <form
          onSubmit={handleSubmit}
          className="flex flex-col flex-1 min-h-0"
        >
          <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain p-4 sm:p-6 space-y-4 sm:space-y-5">
            {/* Error Notification Banner */}
            {errorMsg && (
              <div
                id="band-pack-error-banner"
                className="bg-red-50 border border-red-200 rounded-2xl p-4 text-red-900 flex items-start gap-3 animate-in fade-in shadow-2xs"
              >
                <AlertCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
                <div className="space-y-0.5 text-xs flex-1">
                  <div className="font-bold text-red-950">
                    {t("reservationForm.submissionBlocked", {
                      defaultValue: isAr ? "تعذر إتمام الحجز" : "Booking Blocked",
                    })}
                  </div>
                  <div className="text-red-800 leading-relaxed font-medium">
                    {errorMsg}
                  </div>
                </div>
              </div>
            )}

            {/* Section 1: Service Name / Purpose & Service Location */}
            <div className="bg-white rounded-2xl border border-stone-200 p-3.5 sm:p-4 shadow-2xs space-y-3">
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-stone-700">
                  {t("reservationForm.purposeQuestionLabel", {
                    defaultValue: isAr
                      ? "ما هو الغرض من هذا الحجز؟"
                      : "What is the purpose of this reservation?",
                  })}{" "}
                  <span className="text-amber-800 font-bold">*</span>
                </label>

                <input
                  type="text"
                  required
                  value={serviceName}
                  onChange={(e) => setServiceName(e.target.value)}
                  placeholder={t("reservationForm.serviceNamePlaceholder", {
                    defaultValue: isAr
                      ? "مثال: ترانيم مدارس الأحد، بروفة كورال الشباب"
                      : "e.g., Sunday School Praise, Youth Choir Rehearsal",
                  })}
                  className="w-full bg-stone-50 hover:bg-stone-100/80 border border-stone-200 rounded-xl px-3.5 py-2.5 text-xs sm:text-sm font-medium text-stone-900 focus:outline-none focus:ring-2 focus:ring-amber-800/40 focus:border-amber-800 transition placeholder:text-stone-400"
                />
              </div>

              <div className="space-y-1.5 pt-1 border-t border-stone-100">
                <label className="block text-xs font-bold text-stone-700 flex items-center gap-1">
                  <Church className="w-3.5 h-3.5 text-amber-800" />
                  <span>{t("reservationForm.serviceLocationLabel")}</span>
                </label>
                <input
                  type="text"
                  value={serviceLocation}
                  onChange={(e) => setServiceLocation(e.target.value)}
                  placeholder={t("reservationForm.serviceLocationPlaceholder")}
                  className="w-full bg-stone-50 hover:bg-stone-100/80 border border-stone-200 rounded-xl px-3.5 py-2.5 text-xs sm:text-sm font-medium text-stone-900 focus:outline-none focus:ring-2 focus:ring-amber-800/40 focus:border-amber-800 transition placeholder:text-stone-400"
                />
              </div>
            </div>

            {/* Section 2: Date, Time & Duration */}
            <div className="bg-white rounded-2xl border border-stone-200 p-3.5 sm:p-4 shadow-2xs space-y-3">
              <div className="flex items-center justify-between border-b border-stone-100 pb-2">
                <span className="text-xs font-bold text-stone-800 flex items-center gap-1.5">
                  <Calendar className="w-4 h-4 text-amber-800" />
                  <span>{isAr ? "الموعد والتوقيت" : "Date & Timing"}</span>
                </span>
                <span className="text-[11px] font-bold text-amber-900 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-lg whitespace-nowrap">
                  {formatHhmmTo12Hour(startTime)} ({duration}h)
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {/* Date */}
                <div className="space-y-1">
                  <label className="block text-xs font-bold text-stone-700">
                    {t("reservationForm.dateLabel", {
                      defaultValue: isAr ? "تاريخ الحجز" : "Reservation Date",
                    })}
                  </label>
                  <input
                    type="date"
                    required
                    min={todayStr}
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    className="w-full bg-stone-50 hover:bg-stone-100/80 border border-stone-200 rounded-xl px-3 py-2 text-xs sm:text-sm font-medium text-stone-900 focus:outline-none focus:ring-2 focus:ring-amber-800/40 focus:border-amber-800 transition"
                  />
                </div>

                {/* Start Time */}
                <div className="space-y-1">
                  <label className="block text-xs font-bold text-stone-700">
                    {t("reservationForm.startTimeLabel", {
                      defaultValue: isAr ? "وقت البدء" : "Start Time",
                    })}
                  </label>
                  <div className="relative">
                    <select
                      value={startTime}
                      onChange={(e) => setStartTime(e.target.value)}
                      className="w-full appearance-none bg-stone-50 hover:bg-stone-100/80 border border-stone-200 rounded-xl px-3 py-2 text-xs sm:text-sm font-medium text-stone-900 focus:outline-none focus:ring-2 focus:ring-amber-800/40 focus:border-amber-800 transition cursor-pointer pr-8"
                    >
                      {TIME_SLOTS.map((time) => (
                        <option key={time} value={time}>
                          {formatHhmmTo12Hour(time)}
                        </option>
                      ))}
                    </select>
                    <div
                      className={`pointer-events-none absolute inset-y-0 flex items-center px-2.5 text-stone-500 ${
                        isAr ? "left-0" : "right-0"
                      }`}
                    >
                      <ChevronRight
                        className={`w-3.5 h-3.5 ${isAr ? "-rotate-90" : "rotate-90"}`}
                      />
                    </div>
                  </div>
                </div>

                {/* Duration */}
                <div className="space-y-1">
                  <label className="block text-xs font-bold text-stone-700">
                    {t("reservationForm.durationLabel", {
                      defaultValue: isAr ? "مدة الحجز" : "Duration",
                    })}
                  </label>
                  <div className="relative">
                    <select
                      value={duration}
                      onChange={(e) => setDuration(Number(e.target.value))}
                      className="w-full appearance-none bg-stone-50 hover:bg-stone-100/80 border border-stone-200 rounded-xl px-3 py-2 text-xs sm:text-sm font-medium text-stone-900 focus:outline-none focus:ring-2 focus:ring-amber-800/40 focus:border-amber-800 transition cursor-pointer pr-8"
                    >
                      {DURATION_OPTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {isAr ? opt.labelAr : opt.labelEn}
                        </option>
                      ))}
                    </select>
                    <div
                      className={`pointer-events-none absolute inset-y-0 flex items-center px-2.5 text-stone-500 ${
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
            </div>

            {/* Section 3: Band Instrument Roster & Musicians */}
            <div className="bg-white rounded-2xl border border-stone-200 p-3.5 sm:p-4 shadow-2xs space-y-3">
              <div className="flex items-center justify-between gap-2 border-b border-stone-100 pb-2.5 flex-wrap">
                <div>
                  <span className="text-xs font-bold text-stone-800 flex items-center gap-1.5">
                    <Music2 className="w-4 h-4 text-amber-800" />
                    <span>
                      {isAr
                        ? "آلات طاقم الباند والعازفين المسؤولين"
                        : "Band Instruments & Musicians"}
                    </span>
                  </span>
                  <p className="text-[11px] text-stone-500 mt-0.5">
                    {isAr
                      ? "حدد كل آلة واكتب اسم العازف الذي سيستخدمها"
                      : "Choose each instrument and assign the responsible musician"}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={handleAddItem}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-amber-800 hover:bg-amber-900 active:bg-amber-950 text-white rounded-xl text-xs font-bold transition cursor-pointer shadow-2xs touch-manipulation"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>
                    {isAr ? "إضافة آلة أخرى" : "Add Instrument"}
                  </span>
                </button>
              </div>

              <div className="space-y-3 pt-1">
                {items.map((item, index) => {
                  const currentInst = bookableInstruments.find(
                    (x) => x.id === item.instrumentId,
                  );
                  return (
                    <div
                      key={item.id}
                      className="p-3 bg-stone-50 border border-stone-200 rounded-xl space-y-2.5 hover:border-amber-400/80 transition"
                    >
                      <div className="flex items-center justify-between">
                        <span className="flex items-center gap-1.5 text-xs font-bold text-amber-950 bg-amber-100/80 px-2.5 py-0.5 rounded-lg border border-amber-200">
                          <Music2 className="w-3.5 h-3.5 text-amber-800" />
                          <span>
                            {isAr
                              ? `الآلة رقم (${index + 1})`
                              : `Instrument #${index + 1}`}
                          </span>
                        </span>

                        {items.length > 1 && (
                          <button
                            type="button"
                            onClick={() => handleRemoveItem(index)}
                            className="inline-flex items-center gap-1 text-[11px] font-bold text-red-600 hover:text-red-800 p-1 hover:bg-red-50 rounded-lg transition cursor-pointer touch-manipulation"
                            title={isAr ? "حذف هذه الآلة" : "Remove"}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            <span>{isAr ? "إزالة" : "Remove"}</span>
                          </button>
                        )}
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                        {/* Instrument Selector */}
                        <div className="space-y-1">
                          <label className="block text-xs font-bold text-stone-700">
                            {t("reservationForm.instrumentLabel", {
                              defaultValue: isAr ? "الآلة الموسيقية" : "Musical Instrument",
                            })}{" "}
                            <span className="text-amber-800 font-bold">*</span>
                          </label>
                          <div className="relative">
                            <select
                              value={item.instrumentId}
                              onChange={(e) =>
                                handleUpdateItem(
                                  index,
                                  "instrumentId",
                                  e.target.value,
                                )
                              }
                              className="w-full appearance-none bg-white hover:bg-stone-100/80 border border-stone-200 rounded-xl px-3 py-2 text-xs sm:text-sm font-bold text-stone-900 focus:outline-none focus:ring-2 focus:ring-amber-800/40 focus:border-amber-800 transition cursor-pointer pr-8"
                            >
                              {bookableInstruments.map((inst) => (
                                <option key={inst.id} value={inst.id}>
                                  {inst.name} ({inst.type})
                                  {reservationType === "outside_church" &&
                                  Number(inst.outsideFeePerDay) > 0
                                    ? ` - ${inst.outsideFeePerDay} ج.م`
                                    : ""}
                                </option>
                              ))}
                            </select>
                            <div
                              className={`pointer-events-none absolute inset-y-0 flex items-center px-2.5 text-stone-500 ${
                                isAr ? "left-0" : "right-0"
                              }`}
                            >
                              <ChevronRight
                                className={`w-3.5 h-3.5 ${isAr ? "-rotate-90" : "rotate-90"}`}
                              />
                            </div>
                          </div>
                        </div>

                        {/* Musician Name */}
                        <div className="space-y-1">
                          <label className="block text-xs font-bold text-stone-700">
                            {t("reservationForm.musicianNameLabel", {
                              defaultValue: isAr ? "اسم العازف" : "Musician Name",
                            })}{" "}
                            <span className="text-amber-800 font-bold">*</span>
                          </label>
                          <div className="relative">
                            <User className="w-3.5 h-3.5 text-stone-400 absolute start-3 top-3 pointer-events-none" />
                            <input
                              type="text"
                              required
                              value={item.musicianName}
                              onChange={(e) =>
                                handleUpdateItem(
                                  index,
                                  "musicianName",
                                  e.target.value,
                                )
                              }
                              placeholder={t("reservationForm.musicianNamePlaceholder", {
                                defaultValue: isAr ? "أدخل اسم العازف" : "Enter musician name",
                              })}
                              className="w-full ps-9 pe-3 py-2 bg-white border border-stone-200 rounded-xl text-xs sm:text-sm font-medium text-stone-900 focus:outline-none focus:ring-2 focus:ring-amber-800/40 focus:border-amber-800 transition placeholder:text-stone-400"
                            />
                          </div>
                        </div>
                      </div>

                      {currentInst && (
                        <div className="flex items-center justify-between text-[11px] text-stone-500 pt-1.5 border-t border-stone-200/60 font-medium">
                          <span className="text-stone-700">
                            {currentInst.type} •{" "}
                            {currentInst.bookingMode === "instant"
                              ? t("common.instant", { defaultValue: isAr ? "فوري" : "Instant" })
                              : t("common.manual", { defaultValue: isAr ? "موافقة الادمن" : "Manual" })}
                          </span>
                          {reservationType === "in_church" ? (
                            <span className="text-emerald-700 font-bold">
                              {t("reservationForm.inChurchFreeLabel", {
                                defaultValue: isAr ? "داخل الكنيسة (مجاني)" : "In Church (Free)",
                              })}
                            </span>
                          ) : Number(currentInst.outsideFeePerDay) > 0 ? (
                            <span className="font-bold text-purple-800">
                              {currentInst.outsideFeePerDay}{" "}
                              {isAr ? "ج.م/يوم" : "EGP/day"}
                            </span>
                          ) : null}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Section 4: Location (In-Church vs Outside-Church) */}
            <ReservationUsageTypeSelector
              reservationType={reservationType}
              onReservationTypeChange={setReservationType}
              feeAcknowledged={feeAcknowledged}
              onFeeAcknowledgedChange={setFeeAcknowledged}
              feePerDay={totalOutsideFee}
              isBandPack={true}
            />

            {/* Section 5: Optional Note */}
            <div className="bg-white rounded-2xl border border-stone-200 p-3.5 sm:p-4 shadow-2xs space-y-1 pt-1">
              <div className="flex items-center justify-between">
                <label
                  htmlFor="input-reservation-note"
                  className="block text-xs font-bold text-stone-700"
                >
                  {t("reservationForm.leaveANoteLabel", {
                    defaultValue: isAr ? "ملاحظات / طلبات خاصة" : "Notes / Special Requests",
                  })}
                </label>
                <span className="text-[10px] text-stone-400 font-medium">
                  ({t("common.optional", { defaultValue: isAr ? "اختياري" : "Optional" })})
                </span>
              </div>
              <textarea
                id="input-reservation-note"
                rows={2}
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder={t("reservationForm.notePlaceholder", {
                  defaultValue: isAr
                    ? "أضف أي ملاحظات أو متطلبات خاصة..."
                    : "Add any special requests or notes...",
                })}
                className="w-full bg-stone-50 border border-stone-300 rounded-xl px-3 py-2 text-xs sm:text-sm font-medium text-stone-900 placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-amber-800/40 focus:border-amber-800 transition resize-none"
              />
            </div>
          </div>

          {/* Sticky Bottom Footer - Matching ReservationFormModal */}
          <div className="shrink-0 p-4 sm:px-6 sm:pb-5 border-t border-stone-200 bg-white flex flex-col-reverse sm:flex-row items-center justify-between gap-3">
            <button
              type="button"
              onClick={onClose}
              className="w-full sm:w-auto px-5 py-3 rounded-2xl border border-stone-200 text-stone-700 hover:bg-stone-100 active:bg-stone-200 text-xs sm:text-sm font-bold transition cursor-pointer touch-manipulation"
            >
              {isAr ? "إلغاء وتراجع" : "Cancel"}
            </button>

            <button
              type="submit"
              disabled={submitting}
              className="w-full sm:flex-1 py-3.5 px-6 rounded-2xl bg-amber-800 hover:bg-amber-900 active:bg-amber-950 text-white text-xs sm:text-sm font-bold transition cursor-pointer shadow-md shadow-amber-900/20 disabled:opacity-50 touch-manipulation flex items-center justify-center gap-2"
            >
              {submitting ? (
                <span>{isAr ? "جاري الحجز..." : "Submitting..."}</span>
              ) : (
                <>
                  <Sparkles className="w-4 h-4 text-amber-200" />
                  <span>
                    {isAr
                      ? `تأكيد وحجز (${items.length}) آلات ✨`
                      : `Confirm & Reserve (${items.length}) Instruments ✨`}
                  </span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
