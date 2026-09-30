import React from "react";
import { useTranslation } from "react-i18next";
import { Church, DollarSign } from "lucide-react";

export interface ReservationUsageTypeSelectorProps {
  reservationType: "in_church" | "outside_church";
  onReservationTypeChange: (type: "in_church" | "outside_church") => void;
  feeAcknowledged: boolean;
  onFeeAcknowledgedChange: (acknowledged: boolean) => void;
  feePerDay: number;
  isBandPack?: boolean;
  containerClassName?: string;
}

export const ReservationUsageTypeSelector: React.FC<
  ReservationUsageTypeSelectorProps
> = ({
  reservationType,
  onReservationTypeChange,
  feeAcknowledged,
  onFeeAcknowledgedChange,
  feePerDay,
  isBandPack = false,
  containerClassName = "bg-white rounded-2xl border border-stone-200 p-3.5 sm:p-4 shadow-2xs space-y-3",
}) => {
  const { t, i18n } = useTranslation();
  const isAr = i18n.language === "ar";

  return (
    <div className={containerClassName}>
      {/* Section Header */}
      <div className="text-xs font-bold text-stone-800 flex items-center gap-1.5 border-b border-stone-100 pb-2">
        <Church className="w-4 h-4 text-amber-800" />
        <span>
          {t("reservationForm.usageTypeLabel", {
            defaultValue: isAr ? "نوع استخدام الحجز" : "Reservation Usage Type",
          })}
        </span>
      </div>

      {/* Two Choice Cards */}
      <div className="grid grid-cols-2 gap-2 sm:gap-3">
        {/* In-Church Option */}
        <button
          type="button"
          id="btn-type-in-church"
          onClick={() => {
            onReservationTypeChange("in_church");
            onFeeAcknowledgedChange(false);
          }}
          className={`p-3 sm:p-3.5 rounded-2xl border text-start transition cursor-pointer flex flex-col justify-between active:scale-[0.98] touch-manipulation ${
            reservationType === "in_church"
              ? "bg-emerald-50/60 border-emerald-600 ring-2 ring-emerald-600/30"
              : "bg-stone-50/60 hover:bg-stone-100 border-stone-200 text-stone-700"
          }`}
        >
          <div className="flex items-center justify-between gap-1 mb-1">
            <span className="font-bold text-xs text-stone-900">
              {t("reservationForm.inChurchUseLabel", {
                defaultValue: isAr ? "استخدام داخل الكنيسة" : "In-Church Use",
              })}
            </span>
            <span className="px-1.5 py-0.5 rounded-md text-[10px] font-bold bg-emerald-100 text-emerald-800 whitespace-nowrap">
              {t("reservationForm.freeBadge", {
                defaultValue: isAr ? "مجاني" : "Free",
              })}
            </span>
          </div>
          <p className="text-[11px] text-stone-500 leading-tight text-start">
            {t("reservationForm.inChurchDesc", {
              defaultValue: isAr
                ? "مخصص لصلاة وترانيم وبروفات الكورال وحفلات داخل الكنيسة."
                : "Dedicated for prayer services and hymns, choir practice, and concerts inside the church.",
            })}
          </p>
        </button>

        {/* Outside-Church Option */}
        <button
          type="button"
          id="btn-type-outside-church"
          onClick={() => onReservationTypeChange("outside_church")}
          className={`p-3 sm:p-3.5 rounded-2xl border text-start transition cursor-pointer flex flex-col justify-between active:scale-[0.98] touch-manipulation ${
            reservationType === "outside_church"
              ? "bg-purple-50/60 border-purple-600 ring-2 ring-purple-600/30"
              : "bg-stone-50/60 hover:bg-stone-100 border-stone-200 text-stone-700"
          }`}
        >
          <div className="flex items-center justify-between gap-1 mb-1">
            <span className="font-bold text-xs text-stone-900">
              {t("reservationForm.outsideChurchLabel", {
                defaultValue: isAr ? "خارج الكنيسة" : "Outside Church",
              })}
            </span>
            <span className="px-1.5 py-0.5 rounded-md text-[10px] font-bold bg-purple-100 text-purple-800 whitespace-nowrap">
              {isAr
                ? `${feePerDay} ج.م/يوم`
                : `EGP ${feePerDay}/day`}
            </span>
          </div>
          <p className="text-[11px] text-stone-500 leading-tight text-start">
            {t("reservationForm.outsideChurchDesc", {
              defaultValue: isAr
                ? "للفعاليات الخارجية والعروض والمؤتمرات"
                : "For external events, outside performances, and conferences",
            })}
          </p>
        </button>
      </div>

      {/* Outside Church Fee Notice & Acknowledgment */}
      {reservationType === "outside_church" && (
        <div
          id="outside-fee-acknowledgment-box"
          className="bg-purple-50/80 border border-purple-200 rounded-2xl p-3.5 space-y-2.5 animate-in fade-in"
        >
          <div className="flex items-start gap-2.5">
            <DollarSign className="w-4 h-4 text-purple-700 mt-0.5 shrink-0" />
            <div className="text-xs space-y-1 min-w-0 flex-1">
              <div className="font-bold text-purple-950">
                {t("reservationForm.policyFeeTitle", {
                  defaultValue: isAr
                    ? "سياسة ورسوم الاستعارة خارج الكنيسة"
                    : "Outside Church Borrowing Policy & Fee",
                })}
              </div>
              <div className="text-purple-900 text-[11px] leading-relaxed">
                {isBandPack ? (
                  isAr ? (
                    `إجمالي الرسوم لطاقم الآلات بالكامل: ${feePerDay} ج.م. تتطلب الحجوزات الخارجية إعادة الآلات بحالتها الأصلية وتصريح الإدارة.`
                  ) : (
                    `Total fee for all selected instruments: EGP ${feePerDay}. Outside reservations require return in original condition and admin authorization.`
                  )
                ) : (
                  t("reservationForm.policyFeeDesc", {
                    fee: isAr ? `${feePerDay} ج.م` : `EGP ${feePerDay}`,
                    defaultValue: isAr
                      ? `تحتوي هذه الآلة على رسم استخدام خارجي قدره ${feePerDay} ج.م لكل يوم تقويمي. تتطلب الحجوزات الخارجية إعادة الآلة بحالتها الأصلية وتصريح الإدارة.`
                      : `This instrument has an outside usage fee of EGP ${feePerDay} per calendar day. Outside reservations require return in original condition and admin authorization.`,
                  })
                )}
              </div>
            </div>
          </div>

          <label className="flex items-start gap-2.5 pt-2 border-t border-purple-200/80 cursor-pointer select-none">
            <input
              id="checkbox-fee-acknowledged"
              type="checkbox"
              checked={feeAcknowledged}
              onChange={(e) => onFeeAcknowledgedChange(e.target.checked)}
              className="mt-0.5 w-4 h-4 rounded-md border-purple-300 text-purple-700 focus:ring-purple-600 cursor-pointer shrink-0"
            />
            <span className="text-xs font-semibold text-purple-950">
              {isBandPack
                ? isAr
                  ? "أقر بالموافقة على سداد إجمالي الرسوم عبر انستاباي بعد موافقة الإدارة وقبل استلام الآلات."
                  : `I agree to pay the total rental fee of EGP ${feePerDay} via Instapay upon approval.`
                : t("reservationForm.feeAcknowledgeFull", {
                    fee: feePerDay,
                    defaultValue: isAr
                      ? `أقر وأوافق على رسم الاستخدام خارج الكنيسة البالغ ${feePerDay} ج.م/يوم وأوافق على قواعد العناية بمعدات الكنيسة.`
                      : `I agree to the outside fee of EGP ${feePerDay}/day and church care policies.`,
                  })}
            </span>
          </label>
        </div>
      )}
    </div>
  );
};
