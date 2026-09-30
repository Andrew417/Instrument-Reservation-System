import React, { useState, useRef } from "react";
import { useTranslation } from "react-i18next";
import { useAuth } from "../contexts/AuthContext.tsx";
import {
  Camera,
  ShieldCheck,
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  X,
  Sparkles,
  Calendar,
  Clock,
  Music2,
  Trash2,
  User,
  Shield,
} from "lucide-react";
import { formatDisplayDate, formatHhmmTo12Hour } from "../lib/date-utils";

export interface ConditionCheckModalProps {
  isOpen: boolean;
  onClose: () => void;
  reservation: any;
  onSaved: (updatedReservation: any) => void;
}

const CONDITION_TAG_OPTIONS = [
  {
    id: "all_cables_present",
    ar: "✨ الكابلات والمحول الأصلي كاملة",
    en: "✨ All Cables & Adapters Present",
  },
  {
    id: "scratches_dents",
    ar: "⚠️ خدوش أو تجريح خارجي سابق",
    en: "⚠️ Pre-existing Scratches / Dents",
  },
  {
    id: "broken_missing_string",
    ar: "⚠️ وتر مقطوع أو ناقص",
    en: "⚠️ Broken or Missing String",
  },
  {
    id: "sticky_key_loose_knob",
    ar: "⚠️ مفتاح يعلق أو مفتاح تحكم رخو",
    en: "⚠️ Sticky Key or Loose Knob",
  },
  {
    id: "missing_pedal_stand",
    ar: "⚠️ دواسة سوستين أو حامل مفقود",
    en: "⚠️ Missing Sustain Pedal / Stand",
  },
  {
    id: "audio_jack_noise",
    ar: "⚠️ شوشرة بمخرج الصوت (Jack)",
    en: "⚠️ Audio Jack Noise / Loose Port",
  },
  {
    id: "drum_skin_cymbal",
    ar: "⚠️ جلد طبلة ممزق أو صاج مشروخ",
    en: "⚠️ Torn Drum Head or Cracked Cymbal",
  },
  {
    id: "clean_pristine",
    ar: "✨ نظيفة ومحفوظة بالحقيبة بعناية",
    en: "✨ Clean & Well Stored in Case",
  },
];

export const ConditionCheckModal: React.FC<ConditionCheckModalProps> = ({
  isOpen,
  onClose,
  reservation,
  onSaved,
}) => {
  const { profile, sessionToken } = useAuth();
  const { t, i18n } = useTranslation();
  const isAr = i18n.language === "ar";

  const [status, setStatus] = useState<"pristine" | "reported_issues">(
    reservation?.condition_status === "reported_issues"
      ? "reported_issues"
      : "pristine",
  );
  const [selectedTags, setSelectedTags] = useState<string[]>(() => {
    if (reservation?.condition_tags) {
      return reservation.condition_tags
        .split(",")
        .map((s: string) => s.trim())
        .filter(Boolean);
    }
    return [];
  });
  const [notes, setNotes] = useState(reservation?.condition_notes || "");
  const [photoUrl, setPhotoUrl] = useState<string | null>(
    reservation?.condition_photo_url || null,
  );
  const [checkedBy, setCheckedBy] = useState(
    reservation?.condition_checked_by ||
      reservation?.musician_name ||
      profile?.name ||
      "",
  );

  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen || !reservation) return null;

  const handleToggleTag = (tagId: string) => {
    setSelectedTags((prev) =>
      prev.includes(tagId) ? prev.filter((t) => t !== tagId) : [...prev, tagId],
    );
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 8 * 1024 * 1024) {
      setErrorMsg(
        isAr
          ? "حجم الصورة كبير جداً (الحد الأقصى 8 ميجابايت)."
          : "File size too large (max 8MB).",
      );
      return;
    }

    const reader = new FileReader();
    reader.onload = (uploadEvent) => {
      setPhotoUrl(uploadEvent.target?.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSubmitting(true);

    try {
      const payload = {
        status,
        notes: notes.trim() || null,
        photoUrl,
        tags: selectedTags.join(","),
        checkedBy: checkedBy.trim() || profile?.name || "Musician",
      };

      const res = await fetch(
        `/api/reservations/${reservation.id}/condition-check`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${sessionToken || ""}`,
          },
          body: JSON.stringify(payload),
        },
      );

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to save condition check.");
      }

      onSaved(data.reservation);
      onClose();
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to record condition check.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      id="condition-check-modal-backdrop"
      className="fixed inset-0 z-[100] bg-stone-900/60 backdrop-blur-xs flex items-stretch sm:items-center justify-center p-0 sm:p-4"
    >
      <div
        id="condition-check-modal"
        className="bg-stone-50 sm:rounded-3xl sm:border sm:border-stone-200 shadow-2xl w-full sm:max-w-xl z-10 flex flex-col h-full sm:h-auto sm:max-h-[90vh] overflow-hidden animate-in fade-in zoom-in-95 duration-150 pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]"
        dir={isAr ? "rtl" : "ltr"}
      >
        {/* Top Header - Consistent with ReservationFormModal & EditReservationModal */}
        <div className="shrink-0 bg-stone-900 text-white px-4 sm:px-6 py-3.5 sm:py-4 flex items-center justify-between border-b border-stone-800">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-2xl bg-emerald-800 text-emerald-100 flex items-center justify-center font-bold shadow-xs shrink-0">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-sm sm:text-base font-bold text-white leading-tight truncate">
                  {isAr
                    ? "توثيق وفحص حالة الآلة عند الاستلام"
                    : "Instrument Condition Check"}
                </h2>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-900/60 text-emerald-200 border border-emerald-700/50 hidden xs:inline-block">
                  {isAr ? "حماية وسلامة العازف" : "Musician Protection"}
                </span>
              </div>
              <p className="text-[11px] sm:text-xs text-stone-400 truncate mt-0.5">
                {isAr
                  ? "خطوة بسيطة لإثبات أي عيوب سابقة وحمايتك من أي مسؤولية"
                  : "Document pre-existing condition for your peace of mind and protection"}
              </p>
            </div>
          </div>

          <button
            id="btn-close-condition-modal"
            type="button"
            onClick={onClose}
            aria-label="Close modal"
            className="w-9 h-9 sm:w-10 sm:h-10 flex items-center justify-center rounded-xl bg-stone-800/90 text-stone-300 hover:text-white hover:bg-stone-700 active:bg-stone-600 transition cursor-pointer border border-stone-700/70 shrink-0 touch-manipulation"
          >
            <X className="w-4 h-4 sm:w-5 sm:h-5" />
          </button>
        </div>

        {/* Reassuring Guidance Banner */}
        <div className="bg-emerald-50/90 border-b border-emerald-200/80 px-4 sm:px-6 py-2.5 flex items-start gap-2.5 text-xs text-emerald-950 shrink-0">
          <Shield className="w-4 h-4 text-emerald-700 shrink-0 mt-0.5" />
          <div className="leading-relaxed">
            <strong className="font-bold">
              {isAr ? "لحمايتك الشخصية:" : "Why this helps:"}
            </strong>{" "}
            {isAr
              ? "إذا كان هناك أي خدش قديم، وتر مقطوع، أو كابل ناقص، سجل ذلك هنا الآن لكي لا يتحمل أي خادم عيباً لم يتسبب فيه."
              : "Record any existing scratches or missing cables now so you are not held responsible for prior wear."}
          </div>
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
                id="condition-error-banner"
                className="bg-red-50 border border-red-200 rounded-2xl p-4 text-red-900 flex items-start gap-3 animate-in fade-in shadow-2xs"
              >
                <AlertCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
                <div className="space-y-0.5 text-xs flex-1">
                  <div className="font-bold text-red-950">
                    {isAr ? "تعذر حفظ الفحص" : "Save Failed"}
                  </div>
                  <div className="text-red-800 leading-relaxed font-medium">
                    {errorMsg}
                  </div>
                </div>
              </div>
            )}

            {/* Instrument Info Summary Card */}
            <div className="bg-white rounded-2xl border border-stone-200 p-3.5 sm:p-4 shadow-2xs space-y-2">
              <div className="flex items-center justify-between gap-2 border-b border-stone-100 pb-2">
                <span className="text-xs font-bold text-stone-800 flex items-center gap-1.5">
                  <Music2 className="w-4 h-4 text-emerald-800" />
                  <span>
                    {isAr ? "بيانات الآلة والحجز" : "Instrument & Booking"}
                  </span>
                </span>
                <span className="text-[11px] font-bold text-stone-500 font-mono">
                  #{reservation.id?.slice(0, 8)}
                </span>
              </div>

              <div className="flex items-center justify-between flex-wrap gap-2 pt-1 text-xs">
                <div className="font-bold text-stone-900 text-sm">
                  {reservation.instrument_name || "Instrument"}{" "}
                  <span className="text-xs text-stone-500 font-normal">
                    ({reservation.instrument_type})
                  </span>
                </div>
                <div className="flex items-center gap-3 text-stone-600 font-medium text-[11px]">
                  <span className="flex items-center gap-1">
                    <Calendar className="w-3.5 h-3.5 text-stone-400" />
                    {reservation.start_time
                      ? formatDisplayDate(reservation.start_time)
                      : ""}
                  </span>
                  <span className="flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5 text-stone-400" />
                    {reservation.start_hhmm
                      ? formatHhmmTo12Hour(reservation.start_hhmm)
                      : ""}
                  </span>
                </div>
              </div>
            </div>

            {/* Section 1: Two-Choice Status Selector */}
            <div className="bg-white rounded-2xl border border-stone-200 p-3.5 sm:p-4 shadow-2xs space-y-3">
              <label className="block text-xs font-bold text-stone-800">
                {isAr
                  ? "1. كيف ترى حالة الآلة عند الاستلام؟ *"
                  : "1. Instrument Overall Condition *"}
              </label>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {/* Option A: Pristine */}
                <button
                  type="button"
                  onClick={() => setStatus("pristine")}
                  className={`flex items-start gap-3 p-3.5 rounded-xl border-2 text-start transition cursor-pointer touch-manipulation ${
                    status === "pristine"
                      ? "bg-emerald-50/80 border-emerald-700 text-stone-900 shadow-2xs"
                      : "bg-stone-50 border-stone-200 hover:bg-stone-100/60 text-stone-700"
                  }`}
                >
                  <CheckCircle2
                    className={`w-4 h-4 mt-0.5 shrink-0 ${
                      status === "pristine"
                        ? "text-emerald-700"
                        : "text-stone-300"
                    }`}
                  />
                  <div>
                    <div className="text-xs sm:text-sm font-bold text-stone-950">
                      {isAr ? "🟢 سليمة وممتازة 100%" : "🟢 Pristine & Ready"}
                    </div>
                    <div className="text-[11px] text-stone-500 mt-0.5 leading-normal font-normal">
                      {isAr
                        ? "الأوتار والمفاتيح والكابلات سليمة، جاهزة للعزف"
                        : "No pre-existing issues, ready for service"}
                    </div>
                  </div>
                </button>

                {/* Option B: Has Notes / Scratches */}
                <button
                  type="button"
                  onClick={() => setStatus("reported_issues")}
                  className={`flex items-start gap-3 p-3.5 rounded-xl border-2 text-start transition cursor-pointer touch-manipulation ${
                    status === "reported_issues"
                      ? "bg-amber-50/80 border-amber-700 text-stone-900 shadow-2xs"
                      : "bg-stone-50 border-stone-200 hover:bg-stone-100/60 text-stone-700"
                  }`}
                >
                  <AlertTriangle
                    className={`w-4 h-4 mt-0.5 shrink-0 ${
                      status === "reported_issues"
                        ? "text-amber-700"
                        : "text-stone-300"
                    }`}
                  />
                  <div>
                    <div className="text-xs sm:text-sm font-bold text-stone-950">
                      {isAr
                        ? "🟡 يوجد ملاحظات أو عيوب سابقة"
                        : "🟡 Has Notes or Wear"}
                    </div>
                    <div className="text-[11px] text-stone-500 mt-0.5 leading-normal font-normal">
                      {isAr
                        ? "أرغب في تسجيل خدوش أو ملحقات ناقصة لحمايتي"
                        : "Document scratches or missing items to protect myself"}
                    </div>
                  </div>
                </button>
              </div>
            </div>

            {/* Section 2: Quick Tag Chips */}
            <div className="bg-white rounded-2xl border border-stone-200 p-3.5 sm:p-4 shadow-2xs space-y-2.5">
              <label className="block text-xs font-bold text-stone-800">
                {isAr
                  ? "2. اختيارات سريعة للملحقات والحالة (انقر للاختيار):"
                  : "2. Quick Condition Tags (Tap to toggle):"}
              </label>

              <div className="flex flex-wrap gap-1.5 pt-1">
                {CONDITION_TAG_OPTIONS.map((tag) => {
                  const isSelected = selectedTags.includes(tag.id);
                  return (
                    <button
                      key={tag.id}
                      type="button"
                      onClick={() => handleToggleTag(tag.id)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition cursor-pointer touch-manipulation flex items-center gap-1 ${
                        isSelected
                          ? "bg-emerald-100 border-emerald-700 text-emerald-950 shadow-2xs"
                          : "bg-stone-50 border-stone-200 text-stone-700 hover:bg-emerald-50 hover:border-emerald-300"
                      }`}
                    >
                      <span>{isAr ? tag.ar : tag.en}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Section 3: Notes */}
            <div className="bg-white rounded-2xl border border-stone-200 p-3.5 sm:p-4 shadow-2xs space-y-2">
              <label className="block text-xs font-bold text-stone-800">
                {isAr
                  ? "3. ملاحظات إضافية بالكلمات (اختياري)"
                  : "3. Specific Notes or Remarks (Optional)"}
              </label>
              <textarea
                rows={2}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder={
                  isAr
                    ? "مثال: استلمت الآلة وفيها خدش بسيط بجانب مخرج الصوت، أو ينقصها كابل الكهرباء الأصلي..."
                    : "e.g., Minor scratch on back casing, missing adapter..."
                }
                className="w-full bg-stone-50 hover:bg-stone-100/80 border border-stone-200 rounded-xl px-3.5 py-2 text-xs sm:text-sm font-medium text-stone-900 focus:outline-none focus:ring-2 focus:ring-emerald-800/40 focus:border-emerald-800 transition resize-none placeholder:text-stone-400"
              />
            </div>

            {/* Section 4: Photo Capture / Upload */}
            <div className="bg-white rounded-2xl border border-stone-200 p-3.5 sm:p-4 shadow-2xs space-y-2.5">
              <label className="block text-xs font-bold text-stone-800">
                {isAr
                  ? "4. صورة توثيقية للآلة أو التلف السابق (اختياري)"
                  : "4. Photo Evidence (Optional)"}
              </label>

              {photoUrl ? (
                <div className="relative rounded-xl border border-stone-200 overflow-hidden bg-stone-100 p-2">
                  <img
                    src={photoUrl}
                    alt="Condition proof"
                    className="w-full max-h-52 object-contain rounded-lg bg-white"
                  />
                  <button
                    type="button"
                    onClick={() => setPhotoUrl(null)}
                    className="absolute top-3 end-3 px-2.5 py-1 bg-red-600 text-white rounded-xl shadow-md hover:bg-red-700 transition cursor-pointer font-bold text-xs flex items-center gap-1.5 touch-manipulation"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>{isAr ? "حذف الصورة" : "Remove"}</span>
                  </button>
                </div>
              ) : (
                <div>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleFileChange}
                    className="hidden"
                  />
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="w-full py-4 px-3 border-2 border-dashed border-stone-300 hover:border-emerald-700 rounded-xl bg-stone-50 hover:bg-emerald-50/40 flex flex-col items-center justify-center gap-1.5 transition cursor-pointer text-stone-700 touch-manipulation group"
                  >
                    <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-800 flex items-center justify-center group-hover:bg-emerald-200 transition">
                      <Camera className="w-5 h-5" />
                    </div>
                    <span className="text-xs sm:text-sm font-bold text-stone-900">
                      {isAr
                        ? "📸 اضغط لالتقاط صورة بالموبايل أو اختيار صورة"
                        : "📸 Tap to take photo with camera or choose file"}
                    </span>
                    <span className="text-[11px] text-stone-500">
                      {isAr
                        ? "لحفظ حقك في حال وجود أي خدش أو تلفيات سابقة"
                        : "To keep proof of any pre-existing issues"}
                    </span>
                  </button>
                </div>
              )}
            </div>

            {/* Section 5: Verified By Name */}
            <div className="bg-white rounded-2xl border border-stone-200 p-3.5 sm:p-4 shadow-2xs space-y-2">
              <label className="block text-xs font-bold text-stone-800">
                {isAr
                  ? "5. اسم الخادم أو العازف الفاحص *"
                  : "5. Verified By (Musician Name) *"}
              </label>
              <div className="relative">
                <User className="w-3.5 h-3.5 text-stone-400 absolute start-3 top-3 pointer-events-none" />
                <input
                  type="text"
                  required
                  value={checkedBy}
                  onChange={(e) => setCheckedBy(e.target.value)}
                  className="w-full ps-9 pe-3 py-2 bg-stone-50 hover:bg-stone-100/80 border border-stone-200 rounded-xl text-xs sm:text-sm font-bold text-stone-900 focus:outline-none focus:ring-2 focus:ring-emerald-800/40 focus:border-emerald-800 transition"
                />
              </div>
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
              className="w-full sm:flex-1 py-3.5 px-6 rounded-2xl bg-emerald-800 hover:bg-emerald-900 active:bg-emerald-950 text-white text-xs sm:text-sm font-bold transition cursor-pointer shadow-md shadow-emerald-900/20 disabled:opacity-50 touch-manipulation flex items-center justify-center gap-2"
            >
              {submitting ? (
                <span>{isAr ? "جاري الحفظ..." : "Saving..."}</span>
              ) : (
                <>
                  <ShieldCheck className="w-4 h-4 text-emerald-200" />
                  <span>
                    {isAr
                      ? "حفظ وتوثيق الفحص رسمياً ✅"
                      : "Save & Verify Condition ✅"}
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
