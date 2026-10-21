import React from "react";
import { useTranslation } from "react-i18next";
import { LoadingSpinner } from "./LoadingSpinner";

export interface ModalActionButtonsProps {
  onCancel: () => void;
  cancelText?: string;
  confirmText?: string;
  confirmIcon?: React.ReactNode;
  isSubmitting?: boolean;
  submittingText?: string;
  isDisabled?: boolean;
  confirmVariant?: "primary" | "danger" | "amber" | "neutral";
  className?: string;
  type?: "button" | "submit";
  onConfirm?: () => void;
}

const VARIANT_CLASSES: Record<"primary" | "danger" | "amber" | "neutral", string> = {
  primary: "bg-amber-800 hover:bg-amber-900 text-white shadow-xs",
  danger: "bg-red-700 hover:bg-red-800 text-white shadow-xs",
  amber: "bg-amber-700 hover:bg-amber-800 text-white shadow-xs",
  neutral: "bg-stone-800 hover:bg-stone-900 text-white shadow-xs",
};

export const ModalActionButtons: React.FC<ModalActionButtonsProps> = ({
  onCancel,
  cancelText,
  confirmText,
  confirmIcon,
  isSubmitting = false,
  submittingText,
  isDisabled = false,
  confirmVariant = "primary",
  className = "",
  type = "submit",
  onConfirm,
}) => {
  const { t } = useTranslation();
  const variantClass = VARIANT_CLASSES[confirmVariant] || VARIANT_CLASSES.primary;

  return (
    <div
      className={`flex items-center justify-end gap-2 pt-3 border-t border-stone-100 ${className}`}
    >
      <button
        type="button"
        disabled={isSubmitting}
        onClick={onCancel}
        className="px-4 py-2 text-xs font-bold text-stone-600 hover:bg-stone-100 rounded-xl transition cursor-pointer disabled:opacity-50"
      >
        {cancelText || t("common.cancel", "Cancel")}
      </button>

      <button
        type={type}
        disabled={isDisabled || isSubmitting}
        onClick={onConfirm}
        className={`px-4 py-2 text-xs font-bold rounded-xl transition flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${variantClass}`}
      >
        {isSubmitting ? (
          <>
            <LoadingSpinner size="xs" color="white" />
            <span>{submittingText || t("common.saving", "Saving...")}</span>
          </>
        ) : (
          <>
            {confirmIcon}
            <span>{confirmText || t("common.confirm", "Confirm")}</span>
          </>
        )}
      </button>
    </div>
  );
};
