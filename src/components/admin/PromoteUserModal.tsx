import React from "react";
import { useTranslation } from "react-i18next";
import { X, ShieldCheck, Sparkles } from "lucide-react";

export interface PromoteModalState {
  userId: string;
  userName: string;
  role: "admin" | "super_admin";
}

interface PromoteUserModalProps {
  modal: PromoteModalState | null;
  onClose: () => void;
  onSelectRole: (role: "admin" | "super_admin") => void;
  onConfirm: (role: "admin" | "super_admin") => void;
}

export const PromoteUserModal: React.FC<PromoteUserModalProps> = ({
  modal,
  onClose,
  onSelectRole,
  onConfirm,
}) => {
  const { t } = useTranslation();

  if (!modal) return null;

  return (
    <div className="fixed inset-0 z-[130] bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white border border-stone-200 rounded-2xl max-w-md w-full p-6 space-y-4 shadow-xl">
        <div className="flex items-center justify-between border-b border-stone-100 pb-3">
          <div>
            <h3 className="font-bold text-stone-900 text-sm">
              {t("admin.modals.promote.title", {
                name: modal.userName,
              })}
            </h3>
            <p className="text-xs text-stone-500">
              {t("admin.modals.promote.subtitle")}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-stone-400 hover:text-stone-600 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-2.5">
          <button
            type="button"
            onClick={() => onSelectRole("admin")}
            className={`w-full text-left p-3.5 rounded-xl border cursor-pointer flex items-start gap-3 ${
              modal.role === "admin"
                ? "border-amber-400 bg-amber-50 shadow-2xs"
                : "border-stone-200 hover:border-amber-300 hover:bg-amber-50/50"
            }`}
          >
            <span
              className={`mt-0.5 w-4 h-4 rounded-full border-2 shrink-0 flex items-center justify-center ${
                modal.role === "admin"
                  ? "border-amber-700"
                  : "border-stone-300"
              }`}
            >
              {modal.role === "admin" && (
                <span className="w-2 h-2 rounded-full bg-amber-700" />
              )}
            </span>
            <div>
              <div className="font-bold text-stone-900 text-xs flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-amber-800" />
                <span>{t("admin.modals.promote.adminTitle")}</span>
              </div>
              <p className="text-[11px] text-stone-500 mt-1">
                {t("admin.modals.promote.adminDesc")}
              </p>
            </div>
          </button>

          <button
            type="button"
            onClick={() => onSelectRole("super_admin")}
            className={`w-full text-left p-3.5 rounded-xl border cursor-pointer flex items-start gap-3 ${
              modal.role === "super_admin"
                ? "border-amber-400 bg-amber-50 shadow-2xs"
                : "border-amber-200 hover:border-amber-400 hover:bg-amber-50"
            }`}
          >
            <span
              className={`mt-0.5 w-4 h-4 rounded-full border-2 shrink-0 flex items-center justify-center ${
                modal.role === "super_admin"
                  ? "border-amber-700"
                  : "border-stone-300"
              }`}
            >
              {modal.role === "super_admin" && (
                <span className="w-2 h-2 rounded-full bg-amber-700" />
              )}
            </span>
            <div>
              <div className="font-bold text-stone-900 text-xs flex items-center gap-1.5">
                <Sparkles className="w-4 h-4 text-amber-700" />
                <span>{t("admin.modals.promote.superAdminTitle")}</span>
              </div>
              <p className="text-[11px] text-stone-500 mt-1">
                {t("admin.modals.promote.superAdminDesc")}
              </p>
            </div>
          </button>
        </div>

        <div className="pt-1 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="px-3.5 py-2 rounded-xl bg-stone-50 hover:bg-stone-100 text-stone-700 font-semibold cursor-pointer border border-stone-200 text-xs"
          >
            {t("admin.modals.promote.cancel")}
          </button>
          <button
            type="button"
            onClick={() => onConfirm(modal.role)}
            className="px-4 py-2 rounded-xl bg-amber-800 hover:bg-amber-900 text-white font-bold cursor-pointer shadow-xs text-xs"
          >
            {t("admin.modals.promote.confirmButton")}
          </button>
        </div>
      </div>
    </div>
  );
};
