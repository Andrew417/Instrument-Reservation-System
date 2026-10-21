import React from "react";
import { useTranslation } from "react-i18next";

export interface PaymentSettingsState {
  instapayNumber: string;
  instapayLink: string;
}

interface PaymentSettingsTabProps {
  paymentSettingsState: PaymentSettingsState;
  setPaymentSettingsState: React.Dispatch<React.SetStateAction<PaymentSettingsState>>;
  savingPayment: boolean;
  onSave: (e: React.FormEvent) => void;
}

export const PaymentSettingsTab: React.FC<PaymentSettingsTabProps> = ({
  paymentSettingsState,
  setPaymentSettingsState,
  savingPayment,
  onSave,
}) => {
  const { t } = useTranslation();

  return (
    <div className="bg-white border border-stone-200 rounded-2xl p-5 shadow-2xs space-y-4">
      <div className="border-b border-stone-100 pb-3">
        <h2 className="font-bold text-stone-900 text-sm">
          {t("admin.paymentSettings.title")}
        </h2>
        <p className="text-xs text-stone-500">
          {t("admin.paymentSettings.subtitle")}
        </p>
      </div>

      <form onSubmit={onSave} className="space-y-4 text-xs">
        <div>
          <label className="block font-bold text-stone-700 mb-1">
            {t("admin.paymentSettings.numberLabel")}
          </label>
          <input
            type="text"
            required
            placeholder={t("admin.paymentSettings.numberPlaceholder")}
            value={paymentSettingsState.instapayNumber}
            onChange={(e) =>
              setPaymentSettingsState({
                ...paymentSettingsState,
                instapayNumber: e.target.value,
              })
            }
            className="w-full p-2.5 bg-stone-50 border border-stone-200 rounded-xl text-stone-900 focus:outline-none focus:border-amber-700"
          />
        </div>

        <div>
          <label className="block font-bold text-stone-700 mb-1">
            {t("admin.paymentSettings.linkLabel")}
          </label>
          <input
            type="url"
            placeholder={t("admin.paymentSettings.linkPlaceholder")}
            value={paymentSettingsState.instapayLink}
            onChange={(e) =>
              setPaymentSettingsState({
                ...paymentSettingsState,
                instapayLink: e.target.value,
              })
            }
            className="w-full p-2.5 bg-stone-50 border border-stone-200 rounded-xl text-stone-900 focus:outline-none focus:border-amber-700"
          />
        </div>

        <div className="pt-3 border-t border-stone-100 flex justify-end">
          <button
            type="submit"
            disabled={savingPayment}
            className="px-4 py-2 rounded-xl bg-amber-800 hover:bg-amber-900 disabled:opacity-50 text-white font-bold text-xs transition cursor-pointer shadow-xs"
          >
            {savingPayment
              ? t("admin.paymentSettings.saving")
              : t("admin.paymentSettings.saveButton")}
          </button>
        </div>
      </form>
    </div>
  );
};
