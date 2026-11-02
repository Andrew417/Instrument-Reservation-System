import React, { useState } from "react";
import {
  X,
  Calendar,
  CheckCircle2,
  HelpCircle,
  ChevronDown,
  ChevronUp,
  Church,
  ArrowLeft,
  Repeat,
  Bell,
  Zap,
  MessageSquare,
} from "lucide-react";

export interface PolicyExplainerModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const PolicyExplainerModal: React.FC<PolicyExplainerModalProps> = ({
  isOpen,
  onClose,
}) => {
  const [showAdvancedDetails, setShowAdvancedDetails] = useState(false);

  React.useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      id="policy-explainer-modal-backdrop"
      className="fixed inset-0 bottom-[4.25rem] lg:bottom-0 z-[100] bg-stone-950/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5"
      dir="rtl"
    >
      <div
        id="policy-explainer-modal"
        className="bg-stone-50 rounded-3xl border border-stone-200 shadow-2xl max-w-xl w-full h-full max-h-[85vh] flex flex-col font-sans overflow-hidden animate-in fade-in zoom-in-95 duration-150 text-right"
        dir="rtl"
      >
        {/* Header - Fixed at top of modal */}
        <div className="bg-stone-900 text-white px-5 sm:px-6 py-4 flex items-center justify-between border-b border-stone-800 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-2xl bg-amber-700/30 border border-amber-500/40 text-amber-300 flex items-center justify-center shrink-0">
              <Church className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-white leading-tight">
                دليل حجز الآلات الموسيقية
              </h2>
              <p className="text-xs text-amber-200/90 mt-0.5 font-medium">
                خطوتان بسيطتان لحجز آلتك لخدمة الكنيسة
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-9 h-9 rounded-xl bg-stone-800 text-stone-300 hover:text-white hover:bg-stone-700 flex items-center justify-center transition cursor-pointer border border-stone-700 shrink-0"
            aria-label="إغلاق الدليل"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Content Inside Modal */}
        <div className="p-4 sm:p-5 overflow-y-auto space-y-4 flex-1 min-h-0 text-stone-800">
          {/* 2-Step Visual Guide */}
          <div className="space-y-2.5">
            <h3 className="text-xs sm:text-sm font-bold text-stone-900 flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-600 inline-block"></span>
              <span>كيف تحجز في خطوتين فقط؟</span>
            </h3>

            {/* Step 1 */}
            <div className="bg-white rounded-2xl p-3.5 sm:p-4 border border-stone-200 shadow-2xs flex items-start gap-3 sm:gap-4 transition hover:border-amber-300">
              <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-2xl bg-amber-100 text-amber-900 font-black text-lg sm:text-xl flex items-center justify-center shrink-0 border border-amber-200">
                ١
              </div>
              <div className="flex-1 space-y-1">
                <div className="flex items-center gap-2 text-sm sm:text-base font-bold text-stone-900">
                  <Calendar className="w-4 h-4 text-amber-700 shrink-0" />
                  <span>اختر الآلة والميعاد المناسب</span>
                </div>
                <p className="text-xs sm:text-sm text-stone-600 leading-relaxed">
                  اضغط على أي ميعاد متاح (فترة بيضاء) في جدول الآلات، أو اضغط زر <span className="font-bold text-stone-800">«حجز جديد»</span>.
                </p>
              </div>
            </div>

            {/* Step 2 */}
            <div className="bg-white rounded-2xl p-3.5 sm:p-4 border border-stone-200 shadow-2xs flex items-start gap-3 sm:gap-4 transition hover:border-amber-300">
              <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-2xl bg-emerald-100 text-emerald-900 font-black text-lg sm:text-xl flex items-center justify-center shrink-0 border border-emerald-200">
                ٢
              </div>
              <div className="flex-1 space-y-1">
                <div className="flex items-center gap-2 text-sm sm:text-base font-bold text-stone-900">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>اكتب اسم الخدمة واضغط «تأكيد الحجز»</span>
                </div>
                <p className="text-xs sm:text-sm text-stone-600 leading-relaxed">
                  اكتب اسم خدمتك والعازف والمدة، ثم اضغط زر <span className="font-bold text-emerald-800">«تأكيد الحجز»</span>.
                </p>
              </div>
            </div>

            {/* 1 Quick Line: Instant vs Manual Mode Clarification */}
            <div className="bg-amber-50/80 rounded-2xl p-3 border border-amber-200/80 shadow-2xs flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl bg-amber-600/90 text-white flex items-center justify-center shrink-0 shadow-2xs">
                <Zap className="w-4 h-4" />
              </div>
              <div className="text-xs sm:text-sm text-stone-800 leading-relaxed">
                <span className="font-bold text-stone-900">الفرق بين الآلات: </span>
                آلات <span className="font-bold text-amber-900 bg-amber-100 px-1.5 py-0.5 rounded border border-amber-200 text-xs">Instant</span> تُعتمد فورياً في نفس اللحظة، بينما آلات <span className="font-bold text-stone-800 bg-stone-200/80 px-1.5 py-0.5 rounded border border-stone-300 text-xs">Manual</span> تنتظر موافقة سريعة من الخادم المسؤول.
              </div>
            </div>
          </div>

          {/* 3 Simple Information Highlights */}
          <div className="space-y-2.5 pt-1">
            <h3 className="text-xs sm:text-sm font-bold text-stone-900 flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-600 inline-block"></span>
              <span>معلومات سريعة تهمك:</span>
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              {/* Card 1: Free */}
              <div className="bg-white p-3 rounded-2xl border border-stone-200 shadow-2xs space-y-1">
                <div className="flex items-center gap-2 font-bold text-xs sm:text-sm text-purple-950">
                  <Church className="w-4 h-4 text-purple-600 shrink-0" />
                  <span>مجاناً داخل الكنيسة</span>
                </div>
                <p className="text-xs text-stone-600 leading-relaxed">
                  جميع الآلات متاحة بدون أي مقابل لصلوات واجتماعات وبروفات الكنيسة.
                </p>
              </div>

              {/* Card 2: Pickup Timing */}
              <div className="bg-white p-3 rounded-2xl border border-stone-200 shadow-2xs space-y-1">
                <div className="flex items-center gap-2 font-bold text-xs sm:text-sm text-sky-950">
                  <Calendar className="w-4 h-4 text-sky-600 shrink-0" />
                  <span>استلام الآلة</span>
                </div>
                <p className="text-xs text-stone-600 leading-relaxed">
                  تتوجه لغرفة الموسيقى في ميعاد حجزك لاستلام الآلة مباشرة.
                </p>
              </div>

              {/* Card 3: In-app Chat / Help */}
              <div className="bg-white p-3 rounded-2xl border border-stone-200 shadow-2xs space-y-1">
                <div className="flex items-center gap-2 font-bold text-xs sm:text-sm text-amber-950">
                  <MessageSquare className="w-4 h-4 text-amber-700 shrink-0" />
                  <span>تواصل ومساعدة</span>
                </div>
                <p className="text-xs text-stone-600 leading-relaxed">
                  افتح حجزك واكتب للمسؤول في المحادثة لأي طلب أو استفسار وسيرد عليك.
                </p>
              </div>
            </div>
          </div>

          {/* Collapsible Section for Special Details */}
          <div className="border border-stone-200 rounded-2xl overflow-hidden bg-white shadow-2xs">
            <button
              type="button"
              id="btn-toggle-advanced-policy"
              onClick={() => setShowAdvancedDetails((prev) => !prev)}
              className="w-full flex items-center justify-between gap-3 p-3 sm:p-3.5 bg-stone-50 hover:bg-stone-100/80 transition cursor-pointer text-right"
            >
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-xl bg-amber-100 text-amber-900 border border-amber-200 flex items-center justify-center shrink-0 font-bold">
                  <HelpCircle className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-xs sm:text-sm font-bold text-stone-900">
                    تفاصيل إضافية لمن يريد
                  </div>
                  <div className="text-[11px] text-stone-500">
                    الحجز الأسبوعي المتكرر، الفعاليات الخارجية، وتنبيهات الهاتف
                  </div>
                </div>
              </div>
              {showAdvancedDetails ? (
                <ChevronUp className="w-4 h-4 text-stone-500 shrink-0" />
              ) : (
                <ChevronDown className="w-4 h-4 text-stone-500 shrink-0" />
              )}
            </button>

            {showAdvancedDetails && (
              <div className="p-3.5 sm:p-4 border-t border-stone-200 bg-white space-y-3 text-xs text-stone-700 animate-in fade-in">
                {/* Topic 1: Recurring weekly booking */}
                <div className="p-3 bg-sky-50/50 rounded-xl space-y-1 border border-sky-100">
                  <div className="font-bold text-sky-950 flex items-center gap-1.5 text-xs sm:text-sm">
                    <Repeat className="w-4 h-4 text-sky-700 shrink-0" />
                    <span>لو عندك بروفة أو خدمة ثابتة كل أسبوع؟</span>
                  </div>
                  <p className="text-stone-700 leading-relaxed text-xs">
                    عند عمل الحجز، فعّل زر <span className="font-bold text-sky-900">«حجز دوري متكرر»</span> وسيقوم النظام بتثبيت نفس الميعاد أسبوعياً تلقائياً لعدة أسابيع دون الحاجة لإعادة الحجز كل مرة.
                  </p>
                </div>

                {/* Topic 2: Outside church use */}
                <div className="p-3 bg-purple-50/50 rounded-xl space-y-1 border border-purple-100">
                  <div className="font-bold text-purple-950 flex items-center gap-1.5 text-xs sm:text-sm">
                    <Church className="w-4 h-4 text-purple-700 shrink-0" />
                    <span>لو محتاج الآلة لخدمة أو فعالية خارج الكنيسة؟</span>
                  </div>
                  <p className="text-stone-700 leading-relaxed text-xs">
                    يوجد رسم يومي رمزي موضح بجانب كل آلة. بعد مراجعة الإدارة والموافقة، يمكنك تحويل المبلغ بسهولة عبر إنستاباي ورفع صورة الإيصال من داخل تفاصيل الحجز.
                  </p>
                </div>

                {/* Topic 3: Phone push notifications */}
                <div className="p-3 bg-amber-50/50 rounded-xl space-y-1 border border-amber-100">
                  <div className="font-bold text-amber-950 flex items-center gap-1.5 text-xs sm:text-sm">
                    <Bell className="w-4 h-4 text-amber-700 shrink-0" />
                    <span>تفعيل تنبيهات شاشة الهاتف (الإشعارات)</span>
                  </div>
                  <p className="text-stone-700 leading-relaxed text-xs">
                    احرص على الضغط على زر <span className="font-bold text-amber-900">«تفعيل الإشعارات»</span> بأعلى الشاشة لتصلك رسالة فورية على هاتفك أول ما حجزك يُقبل أو لو أرسلت لك الإدارة رسالة.
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer - Fixed at bottom of modal */}
        <div className="p-3 sm:p-4 bg-stone-100 border-t border-stone-200 flex flex-col sm:flex-row items-center justify-between gap-2.5 shrink-0">
          <div className="text-[11px] sm:text-xs text-stone-500 text-center sm:text-right">
            💡 يمكنك فتح هذا الدليل مجدداً في أي وقت من زر <span className="font-bold text-stone-700">«دليل الحجز»</span> أعلى الصفحة.
          </div>
          <button
            type="button"
            id="policy-explainer-dismiss-btn"
            onClick={onClose}
            className="w-full sm:w-auto px-5 py-2.5 bg-stone-900 hover:bg-stone-800 text-white text-xs sm:text-sm font-bold rounded-2xl transition cursor-pointer flex items-center justify-center gap-2 shadow-xs active:bg-stone-950 shrink-0"
          >
            <span>فهمت، ابدأ الحجز الآن</span>
            <ArrowLeft className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};

