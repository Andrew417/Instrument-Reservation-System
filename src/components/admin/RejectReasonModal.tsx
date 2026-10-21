import React from "react";
import { useTranslation } from "react-i18next";
import { X, XCircle, Repeat, RefreshCw } from "lucide-react";
import { REJECTION_REASON_PRESETS } from "../../constants/reservationPresets";

export interface RejectModalState {
  isOpen: boolean;
  reservationId?: string;
  seriesId?: string | null;
  instrumentName: string;
  memberName: string;
  dateFormatted: string;
  timeFormatted: string;
  isSeriesReject: boolean;
  reason: string;
  submitting: boolean;
}

interface RejectReasonModalProps {
  modal: RejectModalState | null;
  onClose: () => void;
  onUpdateModal: (updated: RejectModalState) => void;
  onConfirm: () => void;
}

export const RejectReasonModal: React.FC<RejectReasonModalProps> = ({
  modal,
  onClose,
  onUpdateModal,
  onConfirm,
}) => {
  const { t } = useTranslation();

  if (!modal || !modal.isOpen) return null;

  return (
    <div className="fixed inset-0 z-[130] bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white border border-stone-200 rounded-2xl max-w-lg w-full p-6 space-y-4 shadow-xl animate-in fade-in zoom-in-95 duration-150">
        <div className="flex items-center justify-between border-b border-stone-100 pb-3">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-red-50 text-red-700 border border-red-200">
              <XCircle className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-stone-900 text-sm">
                {modal.isSeriesReject
                  ? t("admin.modals.reject.titleSeries")
                  : t("admin.modals.reject.titleSingle")}
              </h3>
              <p className="text-xs text-stone-500">
                {t("admin.modals.reject.subtitle")}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={modal.submitting}
            className="text-stone-400 hover:text-stone-600 cursor-pointer disabled:opacity-50"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="bg-stone-50 border border-stone-200/80 rounded-xl p-3.5 space-y-1.5 text-xs">
          <div className="flex justify-between items-center">
            <span className="text-stone-500 font-medium">
              {t("admin.modals.reject.memberLabel")}
            </span>
            <span className="font-bold text-stone-900">
              {modal.memberName}
            </span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-stone-500 font-medium">
              {t("admin.modals.reject.instrumentLabel")}
            </span>
            <span className="font-bold text-amber-900">
              {modal.instrumentName}
            </span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-stone-500 font-medium">
              {t("admin.modals.reject.slotLabel")}
            </span>
            <span className="text-stone-800 font-medium">
              {modal.dateFormatted} ({modal.timeFormatted})
            </span>
          </div>
        </div>

        {modal.seriesId && (
          <div className="p-3 bg-amber-50/70 border border-amber-200/80 rounded-xl space-y-2 text-xs">
            <div className="font-bold text-amber-950 flex items-center gap-1.5">
              <Repeat className="w-3.5 h-3.5 text-amber-800" />
              <span>{t("admin.modals.reject.seriesNotice")}</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
              <button
                type="button"
                onClick={() =>
                  onUpdateModal({ ...modal, isSeriesReject: false })
                }
                className={`px-3 py-2 rounded-lg text-left text-xs font-semibold border transition cursor-pointer ${
                  !modal.isSeriesReject
                    ? "bg-amber-800 text-white border-amber-900 shadow-2xs"
                    : "bg-white text-stone-700 border-stone-200 hover:bg-stone-50"
                }`}
              >
                {t("admin.modals.reject.occurrenceOnly")}
              </button>
              <button
                type="button"
                onClick={() =>
                  onUpdateModal({ ...modal, isSeriesReject: true })
                }
                className={`px-3 py-2 rounded-lg text-left text-xs font-semibold border transition cursor-pointer ${
                  modal.isSeriesReject
                    ? "bg-amber-800 text-white border-amber-900 shadow-2xs"
                    : "bg-white text-stone-700 border-stone-200 hover:bg-stone-50"
                }`}
              >
                {t("admin.modals.reject.allFuture")}
              </button>
            </div>
          </div>
        )}

        <div className="space-y-1.5">
          <label className="block text-[11px] font-bold uppercase text-stone-500">
            {t("admin.modals.reject.presetsLabel")}
          </label>
          <div className="flex flex-wrap gap-1.5">
            {REJECTION_REASON_PRESETS.map((preset) => (
              <button
                key={preset}
                type="button"
                onClick={() =>
                  onUpdateModal({ ...modal, reason: preset })
                }
                className={`px-2.5 py-1 rounded-lg text-[11px] font-medium border transition cursor-pointer ${
                  modal.reason === preset
                    ? "bg-amber-100 text-amber-950 border-amber-300"
                    : "bg-stone-50 text-stone-600 border-stone-200 hover:bg-stone-100"
                }`}
              >
                {preset}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-1.5">
          <label className="block text-xs font-bold text-stone-700">
            {t("admin.modals.reject.messageLabel")}{" "}
            <span className="text-red-600">*</span>
          </label>
          <textarea
            rows={3}
            required
            value={modal.reason}
            onChange={(e) =>
              onUpdateModal({ ...modal, reason: e.target.value })
            }
            placeholder={t("admin.modals.reject.messagePlaceholder")}
            className="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-xl text-xs text-stone-900 focus:outline-none focus:border-amber-700"
          />
        </div>

        <div className="pt-2 flex items-center justify-end gap-2">
          <button
            type="button"
            disabled={modal.submitting}
            onClick={onClose}
            className="px-3.5 py-2 rounded-xl bg-stone-50 hover:bg-stone-100 text-stone-700 text-xs font-semibold cursor-pointer border border-stone-200 disabled:opacity-50"
          >
            {t("admin.modals.reject.cancel")}
          </button>
          <button
            type="button"
            disabled={modal.submitting || !modal.reason.trim()}
            onClick={onConfirm}
            className="px-4 py-2 rounded-xl bg-red-700 hover:bg-red-800 text-white text-xs font-bold cursor-pointer shadow-xs disabled:opacity-50 flex items-center gap-1.5"
          >
            {modal.submitting ? (
              <>
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                <span>{t("admin.modals.reject.rejecting")}</span>
              </>
            ) : (
              <>
                <XCircle className="w-3.5 h-3.5" />
                <span>{t("admin.modals.reject.confirm")}</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
