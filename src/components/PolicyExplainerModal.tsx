import React, { useState } from "react";
import {
  X,
  Calendar,
  Clock,
  PhoneCall,
  CheckCircle,
  HelpCircle,
  ChevronDown,
  ChevronUp,
  FileText,
  AlertCircle,
  Church,
  ArrowRight,
  Repeat,
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

  if (!isOpen) return null;

  return (
    <div
      id="policy-explainer-modal-backdrop"
      className="fixed inset-0 z-[100] bg-stone-950/80 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5 overflow-y-auto"
      dir="rtl"
    >
      <div
        id="policy-explainer-modal"
        className="bg-stone-50 rounded-3xl border border-stone-200 shadow-2xl max-w-2xl w-full my-auto overflow-hidden animate-in fade-in zoom-in-95 duration-150 max-h-[90vh] flex flex-col font-sans mb-20 lg:mb-auto"
        dir="rtl"
      >
        {/* Header */}
        <div className="bg-stone-900 text-white px-5 sm:px-6 py-4 sm:py-5 flex items-center justify-between border-b border-stone-800 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-2xl bg-amber-700/30 border border-amber-500/40 text-amber-300 flex items-center justify-center shrink-0">
              <Church className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-white leading-tight">
                دليل حجز الآلات
              </h2>
              <p className="text-xs text-amber-200/80 mt-0.5 font-medium">
                خطوات سهلة لحجز الآلة لخدمتك
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

        {/* Scrollable Content */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-4 sm:space-y-5 flex-1 text-stone-800">
          
          {/* 3 Step Visual Guide */}
          <div className="space-y-3">
            <h3 className="text-xs sm:text-sm font-bold text-stone-900 flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-600 inline-block"></span>
              <span>كيف تحجز الآلة؟ (٣ خطوات سهلة فقط)</span>
            </h3>

            {/* Step 1 */}
            <div className="bg-white rounded-2xl p-4 border border-stone-200 shadow-2xs flex items-start gap-3 sm:gap-4 transition hover:border-amber-300">
              <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-2xl bg-amber-100 text-amber-900 font-extrabold text-base sm:text-lg flex items-center justify-center shrink-0 border border-amber-200">
                ١
              </div>
              <div className="flex-1 space-y-1">
                <div className="flex items-center gap-2 text-sm sm:text-base font-bold text-stone-900">
                  <Calendar className="w-4 h-4 text-amber-700" />
                  <span>اختر الآلة والموعد من الجدول</span>
                </div>
                <p className="text-xs sm:text-sm text-stone-600 leading-relaxed">
                  اضغط على أي وقت غير محجوز في الجدول، أو اضغط على اسم الآلة. أو اضغط زر <span className="inline-block px-1.5 py-0.5 rounded-md bg-amber-50 text-amber-900 font-bold border border-amber-200 text-xs">"حجز جديد"</span> أعلى صفحة "حجوزاتي".
                </p>
              </div>
            </div>

            {/* Step 2 */}
            <div className="bg-white rounded-2xl p-4 border border-stone-200 shadow-2xs flex items-start gap-3 sm:gap-4 transition hover:border-amber-300">
              <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-2xl bg-amber-100 text-amber-900 font-extrabold text-base sm:text-lg flex items-center justify-center shrink-0 border border-amber-200">
                ٢
              </div>
              <div className="flex-1 space-y-1">
                <div className="flex items-center gap-2 text-sm sm:text-base font-bold text-stone-900">
                  <FileText className="w-4 h-4 text-amber-700" />
                  <span>اكتب اسم الخدمة واسم العازف ثم اضغط "تأكيد الحجز"</span>
                </div>
                <p className="text-xs sm:text-sm text-stone-600 leading-relaxed">
                  اكتب اسم الخدمة (مثل بروفة كورال إعدادي أو اجتماع صلاة). واكتب اسم العازف. اكتب البيانات بوضوح، حتى تتم الموافقة على حجزك. حدد عدد الساعات، ثم اضغط زر <span className="inline-block px-1.5 py-0.5 rounded-md bg-emerald-50 text-emerald-900 font-bold border border-emerald-200 text-xs">"تأكيد الحجز"</span>.
                </p>
              </div>
            </div>

            {/* Step 3 */}
            <div className="bg-white rounded-2xl p-4 border border-stone-200 shadow-2xs flex items-start gap-3 sm:gap-4 transition hover:border-amber-300">
              <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-2xl bg-amber-100 text-amber-900 font-extrabold text-base sm:text-lg flex items-center justify-center shrink-0 border border-amber-200">
                ٣
              </div>
              <div className="flex-1 space-y-1">
                <div className="flex items-center gap-2 text-sm sm:text-base font-bold text-stone-900">
                  <CheckCircle className="w-4 h-4 text-emerald-600" />
                  <span>استلم الآلة في موعدك</span>
                </div>
                <p className="text-xs sm:text-sm text-stone-600 leading-relaxed">
                  سيصلك تنبيه على الجرس وعلى الإيميل عند الموافقة على حجزك. وبعدها، اطلب من أي مسؤول أن يفتح لك الغرفة في الوقت المحجوز.
                </p>
              </div>
            </div>
          </div>

          {/* 3 Info Cards */}
          <div className="space-y-3 pt-1">
            <h3 className="text-xs sm:text-sm font-bold text-stone-900 flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-600 inline-block"></span>
              <span>معلومات هامة:</span>
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              {/* Card 1 */}
              <div className="bg-white p-3.5 rounded-2xl border border-sky-100 bg-sky-50/20 shadow-2xs space-y-1.5">
                <div className="flex items-center gap-2 font-bold text-xs sm:text-sm text-sky-950">
                  <Clock className="w-4 h-4 text-sky-600 shrink-0" />
                  <span>الموافقة على الحجز</span>
                </div>
                <p className="text-xs text-stone-600 leading-relaxed">
                  الآلات المكتوب عليها <span className="inline-block px-1 rounded bg-emerald-100 text-emerald-900 font-bold text-[11px] border border-emerald-300">"Instant"</span> تتم الموافقة عليها فوراً، بشرط أن تكون داخل الحد المسموح لك من الحجوزات. أما الآلات المكتوب عليها <span className="inline-block px-1 rounded bg-amber-100 text-amber-950 font-bold text-[11px] border border-amber-300">"Manual"</span> فتنتظر موافقة الادمن.
                </p>
              </div>

              {/* Card 2 */}
              <div className="bg-white p-3.5 rounded-2xl border border-purple-100 bg-purple-50/20 shadow-2xs space-y-1.5">
                <div className="flex items-center gap-2 font-bold text-xs sm:text-sm text-purple-950">
                  <Church className="w-4 h-4 text-purple-600 shrink-0" />
                  <span>داخل الكنيسة مجاناً دائماً</span>
                </div>
                <p className="text-xs text-stone-600 leading-relaxed">
                  الحجز <span className="font-semibold text-emerald-800">داخل الكنيسة مجاني تماماً</span>. وخارج الكنيسة له رسم يومي موضح بجانب الآلة.
                </p>
              </div>

              {/* Card 3 */}
              <div className="bg-white p-3.5 rounded-2xl border border-amber-100 bg-amber-50/20 shadow-2xs space-y-1.5">
                <div className="flex items-center gap-2 font-bold text-xs sm:text-sm text-amber-950">
                  <PhoneCall className="w-4 h-4 text-amber-700 shrink-0" />
                  <span>تحتاج مساعدة؟</span>
                </div>
                <p className="text-xs text-stone-600 leading-relaxed">
                  افتح حجزك واكتب للادمن في المحادثة.
                </p>
              </div>
            </div>
          </div>

          {/* Collapsible Section */}
          <div className="border border-stone-200 rounded-2xl overflow-hidden bg-white shadow-2xs">
            <button
              type="button"
              id="btn-toggle-advanced-policy"
              onClick={() => setShowAdvancedDetails((prev) => !prev)}
              className="w-full flex items-center justify-between gap-3 p-3.5 sm:p-4 bg-stone-50 hover:bg-stone-100/80 transition cursor-pointer text-right"
            >
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-xl bg-amber-100/80 text-amber-900 border border-amber-200 flex items-center justify-center shrink-0 font-bold">
                  <HelpCircle className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-xs sm:text-sm font-bold text-stone-900">
                    تفاصيل إضافية
                  </div>
                  <div className="text-[11px] sm:text-xs text-stone-500">
                    اضغط هنا لمعرفة تفاصيل أكثر
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
              <div className="p-4 border-t border-stone-200 bg-white space-y-3.5 text-xs text-stone-700 animate-in fade-in">
                {/* Topic 1: Instant limit */}
                <div className="p-3.5 bg-amber-50/40 rounded-xl space-y-1.5 border border-amber-200/60">
                  <div className="font-bold text-stone-900 flex items-center gap-1.5">
                    <AlertCircle className="w-4 h-4 text-amber-700 shrink-0" />
                    <span className="text-amber-950 font-bold">الحد المسموح للحجوزات في وضع "Instant"</span>
                  </div>
                  <p className="text-stone-700 leading-relaxed text-[11px] sm:text-xs">
                    لكل شخص عدد محدد من الحجوزات تتم الموافقة عليها فوراً على آلات <span className="font-semibold text-emerald-800">"Instant"</span>، حتى يأخذ الجميع دورهم. إذا زاد عددك، لا يُرفض طلبك. بل ينتظر موافقة الادمن.
                    <br />
                    <span className="inline-block mt-1 text-stone-500 font-medium">يتجدد هذا الحد كل فترة معينة</span>
                  </p>
                </div>

                {/* Topic 2: Outside church */}
                <div className="p-3.5 bg-purple-50/40 rounded-xl space-y-1.5 border border-purple-200/60">
                  <div className="font-bold text-stone-900 flex items-center gap-1.5">
                    <Church className="w-4 h-4 text-purple-700 shrink-0" />
                    <span className="text-purple-950 font-bold">الحجز خارج الكنيسة</span>
                  </div>
                  <p className="text-stone-700 leading-relaxed text-[11px] sm:text-xs">
                    يجب أن يوافق الادمن أولاً. بعد الموافقة، افتح حجزك وستجد زر <span className="inline-block px-1 py-0.5 rounded bg-purple-100 text-purple-900 font-bold text-[11px] border border-purple-300">"ادفع الآن"</span>. سيظهر لك المبلغ المطلوب، وتدفعه عبر انستاباي من الرابط الموجود في الحجز. بعد الدفع، ارفع صورة التحويل لتأكيد العملية.
                  </p>
                </div>

                {/* Topic 3: New booking & Recurring booking */}
                <div className="p-3.5 bg-sky-50/40 rounded-xl space-y-2 border border-sky-200/60">
                  <div className="font-bold text-stone-900 flex items-center gap-1.5">
                    <Repeat className="w-4 h-4 text-sky-700 shrink-0" />
                    <span className="text-sky-950 font-bold">الحجز الجديد والحجز المتكرر</span>
                  </div>
                  <div className="text-stone-700 leading-relaxed text-[11px] sm:text-xs space-y-1.5">
                    <p>
                      زر <span className="font-bold text-stone-900">"حجز جديد"</span>: لحجز آلة مرة واحدة في يوم واحد.
                    </p>
                    <p>
                      زر <span className="font-bold text-stone-900">"حجز متكرر"</span>: لحجز نفس الآلة في نفس الوقت أكثر من مرة. مثل بروفة كل سبت.
                    </p>
                    <div className="pt-1 border-t border-sky-100">
                      <p className="font-bold text-sky-950 mb-1">في الحجز المتكرر توجد طريقتان:</p>
                      <ul className="list-disc list-inside space-y-1 pr-1 text-stone-600">
                        <li>
                          <span className="font-semibold text-stone-800">الأسبوعي:</span> يتكرر الحجز كل أسبوع في نفس اليوم ونفس الوقت. مثال: كل سبت من ٦ إلى ٨ مساءً.
                        </li>
                        <li>
                          <span className="font-semibold text-stone-800">تواريخ مخصصة:</span> أنت تختار التواريخ بنفسك. الوقت نفسه في كل التواريخ.
                        </li>
                      </ul>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 sm:p-5 bg-stone-100 border-t border-stone-200 flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0">
          <div className="text-xs text-stone-500 text-center sm:text-right hidden sm:block">
            يمكنك فتح هذا الدليل في أي وقت من زر "دليل الحجز (كيف تحجز؟)" أعلى الصفحة.
          </div>
          <button
            type="button"
            id="policy-explainer-dismiss-btn"
            onClick={onClose}
            className="w-full sm:w-auto px-6 py-2.5 sm:py-3 bg-stone-900 hover:bg-stone-800 text-white text-xs sm:text-sm font-bold rounded-2xl transition cursor-pointer flex items-center justify-center gap-2 shadow-xs active:bg-stone-950"
          >
            <span>فهمت، والبدء في الاستخدام</span>
            <ArrowRight className="w-4 h-4 rotate-180" />
          </button>
        </div>
      </div>
    </div>
  );
};
