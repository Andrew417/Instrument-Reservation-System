import React from "react";
import { useTranslation } from "react-i18next";
import { X, ShieldCheck, Sparkles, Music2 } from "lucide-react";

export type PromoteRoleOption = "user" | "admin" | "super_admin" | "musician";

export interface PromoteModalState {
  userId: string;
  userName: string;
  role: PromoteRoleOption;
  isMusician?: boolean;
}

interface PromoteUserModalProps {
  modal: PromoteModalState | null;
  onClose: () => void;
  onSelectRole: (role: PromoteRoleOption) => void;
  onConfirm: (role: PromoteRoleOption) => void;
}

export const PromoteUserModal: React.FC<PromoteUserModalProps> = ({
  modal,
  onClose,
  onSelectRole,
  onConfirm,
}) => {
  const { t } = useTranslation();

  if (!modal) return null;

  const isCurrentMusician = Boolean(modal.isMusician);

  return (
    <div className="fixed inset-0 z-[130] bg-black/50 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
      <div className="bg-white border border-stone-200 rounded-2xl max-w-md w-full p-4 sm:p-6 space-y-4 shadow-xl max-h-[92vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-stone-100 pb-3 shrink-0">
          <div className="min-w-0 pr-2">
            <h3 className="font-bold text-stone-900 text-sm truncate">
              {t("admin.modals.promote.title", {
                name: modal.userName,
                defaultValue: `Role & Privileges for ${modal.userName}`,
              })}
            </h3>
            <p className="text-xs text-stone-500 truncate">
              {t("admin.modals.promote.subtitle", {
                defaultValue: "Select role promotion or privileges to apply",
              })}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-stone-400 hover:text-stone-600 p-1 cursor-pointer shrink-0"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Options */}
        <div className="space-y-2.5 overflow-y-auto min-h-0 py-1">
          {/* Regular User Option */}
          <button
            type="button"
            onClick={() => onSelectRole("user")}
            className={`w-full text-left p-3 sm:p-3.5 rounded-xl border cursor-pointer flex items-start gap-3 transition touch-manipulation ${
              modal.role === "user"
                ? "border-yellow-400 bg-yellow-50 shadow-2xs"
                : "border-stone-200 hover:border-yellow-300 hover:bg-yellow-50/40"
            }`}
          >
            <span
              className={`mt-0.5 w-4 h-4 rounded-full border-2 shrink-0 flex items-center justify-center ${
                modal.role === "user"
                  ? "border-yellow-700"
                  : "border-stone-300"
              }`}
            >
              {modal.role === "user" && (
                <span className="w-2 h-2 rounded-full bg-yellow-700" />
              )}
            </span>
            <div className="min-w-0 flex-1">
              <div className="font-bold text-stone-900 text-xs flex items-center gap-1.5">
                <span className="w-4 h-4 rounded-full bg-yellow-100 border border-yellow-300 shrink-0" />
                <span>User</span>
              </div>
              <p className="text-[11px] text-stone-600 mt-1 leading-snug">
                Remove musician status and return this member to the regular user role.
              </p>
            </div>
          </button>

          {/* Musician Status Option */}
          <button
            type="button"
            onClick={() => onSelectRole("musician")}
            className={`w-full text-left p-3 sm:p-3.5 rounded-xl border cursor-pointer flex items-start gap-3 transition touch-manipulation ${
              modal.role === "musician"
                ? "border-indigo-400 bg-indigo-50/70 shadow-2xs"
                : "border-stone-200 hover:border-indigo-200 hover:bg-stone-50/80"
            }`}
          >
            <span
              className={`mt-0.5 w-4 h-4 rounded-full border-2 shrink-0 flex items-center justify-center ${
                modal.role === "musician"
                  ? "border-indigo-700"
                  : "border-stone-300"
              }`}
            >
              {modal.role === "musician" && (
                <span className="w-2 h-2 rounded-full bg-indigo-700" />
              )}
            </span>
            <div className="min-w-0 flex-1">
              <div className="font-bold text-stone-900 text-xs flex items-center justify-between gap-1">
                <div className="flex items-center gap-1.5">
                  <Music2 className="w-4 h-4 text-indigo-700 shrink-0" />
                  <span>
                    {isCurrentMusician
                      ? "Revoke Musician Status"
                      : "Grant Musician Status"}
                  </span>
                </div>
                <span
                  className={`text-[10px] font-bold px-1.5 py-0.2 rounded ${
                    isCurrentMusician
                      ? "bg-indigo-100 text-indigo-800"
                      : "bg-stone-100 text-stone-600"
                  }`}
                >
                  {isCurrentMusician ? "Currently Active" : "Not Active"}
                </span>
              </div>
              <p className="text-[11px] text-stone-600 mt-1 leading-snug">
                {isCurrentMusician
                  ? "Remove musician status. The user returns to standard category-based requests."
                  : "Enable direct viewing and booking of musician-only instruments on the calendar."}
              </p>
            </div>
          </button>

          {/* Admin Option */}
          <button
            type="button"
            onClick={() => onSelectRole("admin")}
            className={`w-full text-left p-3 sm:p-3.5 rounded-xl border cursor-pointer flex items-start gap-3 transition touch-manipulation ${
              modal.role === "admin"
                ? "border-amber-400 bg-amber-50 shadow-2xs"
                : "border-stone-200 hover:border-amber-300 hover:bg-amber-50/40"
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
            <div className="min-w-0 flex-1">
              <div className="font-bold text-stone-900 text-xs flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-amber-800 shrink-0" />
                <span>{t("admin.modals.promote.adminTitle", { defaultValue: "Administrator" })}</span>
              </div>
              <p className="text-[11px] text-stone-600 mt-1 leading-snug">
                {t("admin.modals.promote.adminDesc", {
                  defaultValue: "Can review, approve, assign instruments, and manage church reservations.",
                })}
              </p>
            </div>
          </button>

          {/* Super Admin Option */}
          <button
            type="button"
            onClick={() => onSelectRole("super_admin")}
            className={`w-full text-left p-3 sm:p-3.5 rounded-xl border cursor-pointer flex items-start gap-3 transition touch-manipulation ${
              modal.role === "super_admin"
                ? "border-amber-400 bg-amber-50 shadow-2xs"
                : "border-stone-200 hover:border-amber-400 hover:bg-amber-50/40"
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
            <div className="min-w-0 flex-1">
              <div className="font-bold text-stone-900 text-xs flex items-center gap-1.5">
                <Sparkles className="w-4 h-4 text-amber-700 shrink-0" />
                <span>{t("admin.modals.promote.superAdminTitle", { defaultValue: "Super Administrator" })}</span>
              </div>
              <p className="text-[11px] text-stone-600 mt-1 leading-snug">
                {t("admin.modals.promote.superAdminDesc", {
                  defaultValue: "Full access including fair usage limits, payments, category fees, and role grants.",
                })}
              </p>
            </div>
          </button>
        </div>

        {/* Footer actions */}
        <div className="pt-2 flex items-center justify-end gap-2 border-t border-stone-100 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-3.5 py-2 rounded-xl bg-stone-50 hover:bg-stone-100 text-stone-700 font-semibold cursor-pointer border border-stone-200 text-xs touch-manipulation"
          >
            {t("admin.modals.promote.cancel", { defaultValue: "Cancel" })}
          </button>
          <button
            type="button"
            onClick={() => onConfirm(modal.role)}
            className={`px-4 py-2 rounded-xl text-white font-bold cursor-pointer shadow-xs text-xs transition touch-manipulation active:scale-95 ${
              modal.role === "musician"
                ? isCurrentMusician
                  ? "bg-rose-700 hover:bg-rose-800"
                  : "bg-indigo-700 hover:bg-indigo-800"
                : "bg-amber-800 hover:bg-amber-900"
            }`}
          >
            {modal.role === "musician"
              ? isCurrentMusician
                ? "Revoke Musician Status"
                : "Grant Musician Status"
              : modal.role === "user"
                ? "Set as User"
              : t("admin.modals.promote.confirmButton", { defaultValue: "Confirm Promotion" })}
          </button>
        </div>
      </div>
    </div>
  );
};
