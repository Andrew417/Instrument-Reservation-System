import React from "react";
import { useTranslation } from "react-i18next";
import { XCircle, RefreshCw } from "lucide-react";

export interface CancelReasonModalState {
  isOpen: boolean;
  ids: string[];
  preset: string;
  customText: string;
  submitting: boolean;
}

export const CANCELLATION_REASON_PRESETS = [
  "Instrument in maintenance",
  "Schedule conflict",
  "Duplicate reservation",
  "Policy violation",
  "Urgent event — no other instrument available",
  "Other",
];

interface CancelReasonModalProps {
  modal: CancelReasonModalState | null;
  onClose: () => void;
  onUpdateModal: (updated: CancelReasonModalState) => void;
  onConfirm: () => void;
}

import { ModalShell } from "../shared/ModalShell";

export const CancelReasonModal: React.FC<CancelReasonModalProps> = ({
  modal,
  onClose,
  onUpdateModal,
  onConfirm,
}) => {
  const { t } = useTranslation();

  if (!modal || !modal.isOpen) return null;

  return (
    <ModalShell
      isOpen={modal.isOpen}
      onClose={onClose}
      size="md"
      zIndex="z-[130]"
      titleClassName="text-sm"
      icon={
        <div className="p-2 rounded-xl bg-amber-50 text-amber-800 border border-amber-200">
          <XCircle className="w-5 h-5" />
        </div>
      }
      title={t(
        modal.ids.length > 1
          ? "admin.modals.cancelReason.title_plural"
          : "admin.modals.cancelReason.title",
        { count: modal.ids.length },
      )}
      subtitle={t("admin.modals.cancelReason.subtitle")}
    >

        <div className="space-y-1.5">
          <label className="block text-[11px] font-bold uppercase text-stone-500">
            {t("admin.modals.cancelReason.reasonLabel")}
          </label>
          <select
            value={modal.preset}
            onChange={(e) =>
              onUpdateModal({
                ...modal,
                preset: e.target.value,
              })
            }
            className="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-xl text-xs text-stone-900 focus:outline-none focus:border-amber-700"
          >
            {CANCELLATION_REASON_PRESETS.map((preset) => (
              <option key={preset} value={preset}>
                {preset}
              </option>
            ))}
          </select>
        </div>

        {modal.preset === "Other" && (
          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-stone-700">
              {t("admin.modals.cancelReason.customLabel")}
            </label>
            <textarea
              rows={2}
              value={modal.customText}
              onChange={(e) =>
                onUpdateModal({
                  ...modal,
                  customText: e.target.value,
                })
              }
              placeholder={t("admin.modals.cancelReason.customPlaceholder")}
              className="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-xl text-xs text-stone-900 focus:outline-none focus:border-amber-700"
            />
          </div>
        )}

        <div className="pt-2 flex items-center justify-end gap-2">
          <button
            type="button"
            disabled={modal.submitting}
            onClick={onClose}
            className="px-3.5 py-2 rounded-xl bg-stone-50 hover:bg-stone-100 text-stone-700 text-xs font-semibold cursor-pointer border border-stone-200 disabled:opacity-50"
          >
            {t("admin.modals.cancelReason.back")}
          </button>
          <button
            type="button"
            disabled={modal.submitting}
            onClick={onConfirm}
            className="px-4 py-2 rounded-xl bg-amber-700 hover:bg-amber-800 text-white text-xs font-bold cursor-pointer shadow-xs disabled:opacity-50 flex items-center gap-1.5"
          >
            {modal.submitting ? (
              <>
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                <span>{t("admin.modals.cancelReason.cancelling")}</span>
              </>
            ) : (
              <>
                <XCircle className="w-3.5 h-3.5" />
                <span>
                  {t(
                    modal.ids.length > 1
                      ? "admin.modals.cancelReason.confirm_plural"
                      : "admin.modals.cancelReason.confirm",
                    { count: modal.ids.length },
                  )}
                </span>
              </>
            )}
          </button>
      </div>
    </ModalShell>
  );
};
