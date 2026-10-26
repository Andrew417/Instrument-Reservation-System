import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import { AlertTriangle, Loader2 } from "lucide-react";

export interface ConfirmModalState {
  isOpen: boolean;
  title: string;
  description: string;
  confirmLabel: string;
  isDestructive?: boolean;
  onConfirm: () => Promise<void> | void;
}

interface AdminConfirmModalProps {
  modal: ConfirmModalState | null;
  onClose: () => void;
}

export const AdminConfirmModal: React.FC<AdminConfirmModalProps> = ({
  modal,
  onClose,
}) => {
  const { t } = useTranslation();
  const [isProcessing, setIsProcessing] = useState(false);

  if (!modal || !modal.isOpen) return null;

  const handleConfirm = async () => {
    if (isProcessing) return;
    try {
      setIsProcessing(true);
      await modal.onConfirm();
      // The parent's onConfirm (handleDemoteAdmin) calls setConfirmModal(null)
      // on success, which will unmount this modal. If it didn't (e.g. because
      // the server returned success: false), we should stop the loading spinner
      // so the user can retry or cancel.
    } catch (err) {
      console.error("[AdminConfirmModal] onConfirm threw:", err);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[140] bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white border border-stone-200 rounded-2xl max-w-md w-full p-6 space-y-4 shadow-xl animate-in fade-in zoom-in-95 duration-150">
        <div className="flex items-start gap-3">
          <div
            className={`p-2.5 rounded-xl border shrink-0 ${
              modal.isDestructive
                ? "bg-red-50 text-red-700 border-red-200"
                : "bg-amber-50 text-amber-900 border-amber-200"
            }`}
          >
            <AlertTriangle className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <h3 className="font-bold text-stone-900 text-sm">{modal.title}</h3>
            <p className="text-xs text-stone-500 mt-0.5 leading-relaxed">
              {modal.description}
            </p>
          </div>
        </div>

        <div className="pt-3 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={isProcessing}
            className="px-3.5 py-2 rounded-xl bg-stone-50 hover:bg-stone-100 text-stone-700 text-xs font-semibold cursor-pointer border border-stone-200 disabled:opacity-60"
          >
            {t("common.cancel")}
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={isProcessing}
            className={`px-4 py-2 rounded-xl text-white text-xs font-bold cursor-pointer shadow-xs disabled:opacity-60 inline-flex items-center gap-2 ${
              modal.isDestructive
                ? "bg-red-700 hover:bg-red-800"
                : "bg-amber-800 hover:bg-amber-900"
            }`}
          >
            {isProcessing && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            {isProcessing ? t("common.processing") : modal.confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
};
