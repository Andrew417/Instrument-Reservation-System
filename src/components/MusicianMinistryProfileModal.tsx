import React, { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useAuth } from "../contexts/AuthContext.tsx";
import {
  Award,
  Sparkles,
  Music2,
  Clock,
  Calendar,
  CheckCircle2,
  ShieldCheck,
  Share2,
  X,
  Heart,
  TrendingUp,
  User,
  Shield,
} from "lucide-react";
import { formatDisplayDate } from "../lib/date-utils";

export interface MusicianMinistryProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  targetUserId?: string;
}

export const MusicianMinistryProfileModal: React.FC<
  MusicianMinistryProfileModalProps
> = ({ isOpen, onClose, targetUserId }) => {
  const { profile, sessionToken } = useAuth();
  const { t, i18n } = useTranslation();
  const isAr = i18n.language === "ar";

  const userId = targetUserId || profile?.id;
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [stats, setStats] = useState<any | null>(null);
  const [copied, setCopied] = useState(false);
  const [shareNotice, setShareNotice] = useState<string | null>(null);

  // Keyboard accessibility: ESC to close
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  useEffect(() => {
    if (!isOpen || !userId) return;

    let isMounted = true;
    setLoading(true);
    setErrorMsg(null);

    fetch(
      `/api/reservations/ministry-stats?userId=${encodeURIComponent(userId)}`,
      {
        headers: {
          Authorization: `Bearer ${sessionToken || ""}`,
        },
      },
    )
      .then((res) => res.json())
      .then((data) => {
        if (!isMounted) return;
        if (!data.success) {
          setErrorMsg(data.error || "Failed to load ministry stats.");
        } else {
          setStats(data.stats);
        }
      })
      .catch((err) => {
        if (isMounted)
          setErrorMsg(err.message || "Failed to load ministry profile.");
      })
      .finally(() => {
        if (isMounted) setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [isOpen, userId, sessionToken]);

  if (!isOpen) return null;

  const getShareMessage = () => {
    if (!stats) return "";
    const name = stats.userName || profile?.name || (isAr ? "خادم التسبيح" : "Church Musician");
    const hours = stats.totalHours || 0;
    const services = stats.totalServices || 0;
    const reliability = stats.reliabilityScore || 100;

    if (isAr) {
      return `🎵 *سجل خدمة وتسبيح كنسي*\n«سَبِّحُوا الرَّبَّ بِأَوْتَارٍ وَمِزْمَارٍ» (مز 150: 4)\n\n👤 *الخادم:* ${name}\n⏳ *ساعات الخدمة:* ${hours} ساعة\n⛪ *عدد البروفات والصلوات:* ${services} خدمة\n🛡️ *مؤشر الالتزام والأمانة:* ${reliability}%\n\nنشكر ربنا على نعمة الخدمة والتسبيح في بيت الله! ✨`;
    }
    return `🎵 *Church Musical Ministry Record*\n"Praise Him with stringed instruments and flutes" (Ps 150:4)\n\n👤 *Musician:* ${name}\n⏳ *Total Service Hours:* ${hours} hrs\n⛪ *Services & Rehearsals:* ${services}\n🛡️ *Stewardship & Reliability:* ${reliability}%\n\nThankful for the blessing of praise and service! ✨`;
  };

  const shareMessage = getShareMessage();
  const whatsappUrl = stats ? `https://wa.me/?text=${encodeURIComponent(shareMessage)}` : "#";

  const handleCopyMessage = async () => {
    if (!shareMessage) return;
    try {
      await navigator.clipboard.writeText(shareMessage);
      setCopied(true);
      setShareNotice(isAr ? "تم نسخ نص التهنئة إلى الحافظة بنجاح! ✨" : "Ministry record copied to clipboard! ✨");
      setTimeout(() => {
        setCopied(false);
        setShareNotice(null);
      }, 4000);
    } catch {
      // clipboard fallback
    }
  };

  const handleShareWhatsApp = async (e: React.MouseEvent) => {
    e.preventDefault();
    if (!shareMessage) return;

    // 1. Immediately copy to clipboard as guaranteed fallback
    try {
      await navigator.clipboard.writeText(shareMessage);
      setCopied(true);
      setTimeout(() => setCopied(false), 3000);
    } catch {
      // ignore
    }

    // 2. Try native Web Share API first
    if (navigator.share) {
      try {
        await navigator.share({
          title: isAr ? "سجل خدمة وتسبيح كنسي" : "Church Musical Ministry Record",
          text: shareMessage,
        });
        setShareNotice(isAr ? "تمت المشاركة بنجاح! ✨" : "Shared successfully! ✨");
        setTimeout(() => setShareNotice(null), 4000);
        return;
      } catch (err: any) {
        if (err.name === "AbortError") return;
      }
    }

    // 3. Try opening WhatsApp directly
    try {
      const win = window.open(whatsappUrl, "_blank", "noopener,noreferrer");
      if (win) {
        setShareNotice(
          isAr
            ? "تم فتح واتساب ونسخ النص إلى الحافظة! 📲"
            : "Opening WhatsApp! Text is also copied to clipboard. 📲",
        );
      } else {
        setShareNotice(
          isAr
            ? "تم نسخ النص إلى الحافظة! يمكنك الآن لصقه مباشرة في محادثة واتساب. ✨"
            : "Copied to clipboard! You can now paste directly into your WhatsApp chat. ✨",
        );
      }
    } catch {
      setShareNotice(
        isAr
          ? "تم نسخ النص إلى الحافظة! يمكنك الآن لصقه مباشرة في محادثة واتساب. ✨"
          : "Copied to clipboard! You can now paste directly into your WhatsApp chat. ✨",
      );
    }
    setTimeout(() => setShareNotice(null), 6000);
  };

  return (
    <div
      id="ministry-profile-modal-backdrop"
      className="fixed inset-0 z-[100] bg-stone-900/60 backdrop-blur-xs flex items-stretch sm:items-center justify-center p-0 sm:p-4"
    >
      <div
        id="ministry-profile-modal"
        className="bg-stone-50 sm:rounded-3xl sm:border sm:border-stone-200 shadow-2xl w-full sm:max-w-xl md:max-w-2xl z-10 flex flex-col h-full sm:h-auto sm:max-h-[90vh] overflow-hidden animate-in fade-in zoom-in-95 duration-150 pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]"
        dir={isAr ? "rtl" : "ltr"}
      >
        {/* Top Header - Consistent with ReservationFormModal & EditReservationModal */}
        <div className="shrink-0 bg-stone-900 text-white px-4 sm:px-6 py-3.5 sm:py-4 flex items-center justify-between border-b border-stone-800">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-2xl bg-amber-800 text-amber-100 flex items-center justify-center font-bold shadow-xs shrink-0">
              <Award className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-sm sm:text-base font-bold text-white leading-tight truncate">
                  {stats?.userName ||
                    profile?.name ||
                    (isAr ? "سجل خدمة التسبيح" : "Worship Ministry Record")}
                </h2>
                {stats?.isTrusted && (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-900/60 text-amber-200 border border-amber-700/50 hidden xs:inline-block">
                    {isAr ? "خادم موثوق" : "Trusted"}
                  </span>
                )}
              </div>
              <p className="text-[11px] sm:text-xs text-stone-400 truncate mt-0.5 flex items-center gap-2">
                <span>{stats?.userPhone || profile?.phoneNumber || ""}</span>
                {stats?.memberSince && (
                  <>
                    <span>•</span>
                    <span>
                      {isAr ? "في الخدمة منذ " : "Serving since "}
                      {formatDisplayDate(stats.memberSince)}
                    </span>
                  </>
                )}
              </p>
            </div>
          </div>

          <button
            id="btn-close-ministry-modal"
            type="button"
            onClick={onClose}
            aria-label="Close modal"
            className="w-9 h-9 sm:w-10 sm:h-10 flex items-center justify-center rounded-xl bg-stone-800/90 text-stone-300 hover:text-white hover:bg-stone-700 active:bg-stone-600 transition cursor-pointer border border-stone-700/70 shrink-0 touch-manipulation"
          >
            <X className="w-4 h-4 sm:w-5 sm:h-5" />
          </button>
        </div>

        {/* Spiritual Scripture Verse Banner */}
        <div className="bg-amber-50/90 border-b border-amber-200/80 px-4 sm:px-6 py-2.5 flex items-start gap-2.5 text-xs text-amber-950 shrink-0">
          <Heart className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
          <div className="leading-relaxed font-semibold">
            {isAr
              ? "«سَبِّحُوا الرَّبَّ... سَبِّحُوهُ بِأَوْتَارٍ وَمِزْمَارٍ» (مزمور 150: 4) — تشجيع وتقدير لأمانة العزف والتسبيح في بيت الله"
              : "“Praise the Lord... Praise Him with stringed instruments and flutes” (Psalm 150:4)"}
          </div>
        </div>

        {/* Scrollable Content Body */}
        <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain p-4 sm:p-6 space-y-4 sm:space-y-5">
          {loading ? (
            <div className="py-14 flex flex-col items-center justify-center gap-3 text-stone-500">
              <div className="w-8 h-8 border-3 border-amber-800 border-t-transparent rounded-full animate-spin" />
              <span className="text-xs sm:text-sm font-bold">
                {isAr
                  ? "جاري تجميع سجل بركة الخدمة والتسبيح..."
                  : "Loading ministry record..."}
              </span>
            </div>
          ) : errorMsg ? (
            <div className="bg-red-50 border border-red-200 rounded-2xl p-4 text-red-900 text-xs sm:text-sm font-bold">
              {errorMsg}
            </div>
          ) : stats ? (
            <>
              {/* 1. Large 4-Grid Key Metrics */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                {/* Total Hours */}
                <div className="bg-white rounded-2xl border border-stone-200 p-3 sm:p-3.5 shadow-2xs space-y-1">
                  <div className="flex items-center justify-between text-stone-500 text-[11px] font-semibold">
                    <span>{isAr ? "ساعات التسبيح" : "Worship Hours"}</span>
                    <Clock className="w-3.5 h-3.5 text-amber-700" />
                  </div>
                  <div className="text-xl sm:text-2xl font-black text-stone-900">
                    {stats.totalHours}
                    <span className="text-xs font-semibold text-stone-500 ms-1">
                      {isAr ? "ساعة" : "hrs"}
                    </span>
                  </div>
                </div>

                {/* Total Services */}
                <div className="bg-white rounded-2xl border border-stone-200 p-3 sm:p-3.5 shadow-2xs space-y-1">
                  <div className="flex items-center justify-between text-stone-500 text-[11px] font-semibold">
                    <span>{isAr ? "الصلوات والبروفات" : "Services"}</span>
                    <Calendar className="w-3.5 h-3.5 text-blue-700" />
                  </div>
                  <div className="text-xl sm:text-2xl font-black text-stone-900">
                    {stats.totalServices}
                    <span className="text-xs font-semibold text-stone-500 ms-1">
                      {isAr ? "خدمة" : "events"}
                    </span>
                  </div>
                </div>

                {/* Reliability Score */}
                <div className="bg-white rounded-2xl border border-stone-200 p-3 sm:p-3.5 shadow-2xs space-y-1">
                  <div className="flex items-center justify-between text-stone-500 text-[11px] font-semibold">
                    <span>{isAr ? "مؤشر الالتزام" : "Reliability"}</span>
                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-700" />
                  </div>
                  <div className="text-xl sm:text-2xl font-black text-stone-900">
                    {stats.reliabilityScore}%
                  </div>
                  <span className="text-[10px] font-bold text-emerald-700 block truncate">
                    {stats.noShows === 0
                      ? isAr
                        ? "✓ التزام كامل 0 غياب"
                        : "✓ 0 No-shows"
                      : `${stats.noShows} ${isAr ? "غياب" : "no-shows"}`}
                  </span>
                </div>

                {/* Care Checks */}
                <div className="bg-white rounded-2xl border border-stone-200 p-3 sm:p-3.5 shadow-2xs space-y-1">
                  <div className="flex items-center justify-between text-stone-500 text-[11px] font-semibold">
                    <span>{isAr ? "أمانة فحص الآلات" : "Care Checks"}</span>
                    <CheckCircle2 className="w-3.5 h-3.5 text-purple-700" />
                  </div>
                  <div className="text-xl sm:text-2xl font-black text-stone-900">
                    {stats.conditionChecksCount}
                    <span className="text-xs font-semibold text-stone-500 ms-1">
                      {isAr ? "فحص" : "verified"}
                    </span>
                  </div>
                </div>
              </div>

              {/* 2. Ministry Honors & Badges Card */}
              <div className="bg-white rounded-2xl border border-stone-200 p-3.5 sm:p-4 shadow-2xs space-y-3">
                <div className="flex items-center gap-1.5 border-b border-stone-100 pb-2">
                  <Sparkles className="w-4 h-4 text-amber-700" />
                  <h3 className="text-xs sm:text-sm font-bold text-stone-900">
                    {isAr
                      ? "أوسمة وتقدير الخدمة الكنسية"
                      : "Ministry Honors & Badges"}
                  </h3>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {stats.badges?.map((badge: any) => {
                    return (
                      <div
                        key={badge.id}
                        className={`p-3 rounded-xl border flex items-start gap-3 transition ${
                          badge.unlocked
                            ? "bg-amber-50/50 border-amber-200 shadow-2xs"
                            : "bg-stone-50 border-stone-200 opacity-60"
                        }`}
                      >
                        <div
                          className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                            badge.unlocked
                              ? "bg-amber-100 text-amber-900 border border-amber-300"
                              : "bg-stone-200 text-stone-500"
                          }`}
                        >
                          <Award className="w-5 h-5" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between gap-1">
                            <span className="text-xs font-bold text-stone-900 truncate">
                              {isAr ? badge.titleAr : badge.titleEn}
                            </span>
                            {badge.unlocked ? (
                              <span className="px-1.5 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-100 text-emerald-900 border border-emerald-300 shrink-0">
                                {isAr ? "ممنوح ✓" : "Earned ✓"}
                              </span>
                            ) : (
                              <span className="text-[10px] font-semibold text-stone-400 shrink-0">
                                {badge.progress}
                              </span>
                            )}
                          </div>
                          <p className="text-[11px] text-stone-500 mt-0.5 leading-normal">
                            {isAr ? badge.descAr : badge.descEn}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* 3. Top Instruments Played */}
              {stats.topInstruments?.length > 0 && (
                <div className="bg-white rounded-2xl border border-stone-200 p-3.5 sm:p-4 shadow-2xs space-y-3">
                  <div className="flex items-center gap-1.5 border-b border-stone-100 pb-2">
                    <Music2 className="w-4 h-4 text-amber-800" />
                    <h3 className="text-xs sm:text-sm font-bold text-stone-900">
                      {isAr
                        ? "أكثر الآلات المستخدمة في التسبيح"
                        : "Top Instruments Played"}
                    </h3>
                  </div>

                  <div className="space-y-2">
                    {stats.topInstruments.map((inst: any) => {
                      const maxHours = stats.topInstruments[0]?.hours || 1;
                      const percent = Math.min(
                        100,
                        Math.round((inst.hours / maxHours) * 100),
                      );
                      return (
                        <div
                          key={inst.name}
                          className="p-2.5 bg-stone-50 rounded-xl border border-stone-200/80 space-y-1.5"
                        >
                          <div className="flex items-center justify-between text-xs font-bold text-stone-900">
                            <div className="flex items-center gap-1.5">
                              <span>{inst.name}</span>
                              <span className="text-[11px] text-stone-500 font-normal">
                                ({inst.type})
                              </span>
                            </div>
                            <span className="text-amber-900 font-bold text-[11px]">
                              {inst.hours} {isAr ? "ساعة" : "hrs"} (
                              {inst.count} {isAr ? "خدمات" : "sessions"})
                            </span>
                          </div>
                          <div className="w-full h-2 bg-stone-200 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-amber-700 rounded-full transition-all duration-500"
                              style={{ width: `${percent}%` }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </>
          ) : null}
        </div>

        {/* Feedback / Fallback Banner */}
        {shareNotice && (
          <div className="shrink-0 px-4 sm:px-6 py-2.5 bg-emerald-50 border-t border-emerald-200 text-emerald-950 text-xs font-medium flex items-center justify-between gap-2 animate-in fade-in duration-150">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>{shareNotice}</span>
            </div>
            <button
              type="button"
              onClick={() => setShareNotice(null)}
              className="text-stone-400 hover:text-stone-600 p-0.5"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Sticky Bottom Footer - Matching ReservationFormModal */}
        <div className="shrink-0 p-4 sm:px-6 sm:pb-5 border-t border-stone-200 bg-white flex flex-col-reverse sm:flex-row items-center justify-between gap-3">
          <button
            type="button"
            onClick={onClose}
            className="w-full sm:w-auto px-5 py-3 rounded-2xl border border-stone-200 text-stone-700 hover:bg-stone-100 active:bg-stone-200 text-xs sm:text-sm font-bold transition cursor-pointer touch-manipulation"
          >
            {isAr ? "إغلاق" : "Close"}
          </button>

          <div className="w-full sm:flex-1 flex items-center gap-2">
            <button
              type="button"
              onClick={handleCopyMessage}
              disabled={!stats}
              className="px-3.5 py-3.5 rounded-2xl border border-stone-200 hover:bg-stone-50 active:bg-stone-100 text-stone-700 text-xs sm:text-sm font-bold transition flex items-center justify-center gap-1.5 cursor-pointer touch-manipulation shrink-0"
              title={isAr ? "نسخ نص البركة" : "Copy text"}
            >
              {copied ? (
                <>
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  <span className="text-emerald-700">{isAr ? "تم النسخ" : "Copied"}</span>
                </>
              ) : (
                <span>{isAr ? "نسخ النص" : "Copy"}</span>
              )}
            </button>

            <button
              type="button"
              onClick={handleShareWhatsApp}
              disabled={!stats}
              className={`flex-1 py-3.5 px-4 rounded-2xl bg-emerald-700 hover:bg-emerald-800 active:bg-emerald-900 text-white text-xs sm:text-sm font-bold transition flex items-center justify-center gap-2 cursor-pointer shadow-md shadow-emerald-900/20 touch-manipulation ${
                !stats ? "pointer-events-none opacity-50" : ""
              }`}
            >
              <Share2 className="w-4 h-4 shrink-0" />
              <span className="truncate">
                {isAr
                  ? "مشاركة على واتساب 📲"
                  : "Share on WhatsApp 📲"}
              </span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
