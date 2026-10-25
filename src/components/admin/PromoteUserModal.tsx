import React from "react";
import { useTranslation } from "react-i18next";
import { X, ShieldCheck, Sparkles, Music2, User } from "lucide-react";

export type PromoteRoleOption = "user" | "admin" | "super_admin" | "musician";

export interface PromoteModalState {
  userId: string;
  userName: string;
  role: PromoteRoleOption;
  isMusician?: boolean;
  isCurrentlyAdmin?: boolean;
  isCurrentlySuperAdmin?: boolean;
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

  const RoleRadio = ({ current }: { current: boolean }) => (
    <span
      className={`mt-0.5 w-4 h-4 rounded-full border-2 shrink-0 flex items-center justify-center ${
        current ? "border-amber-700" : "border-stone-300"
      }`}
    >
      {current && <span className="w-2 h-2 rounded-full bg-amber-700" />}
    </span>
  );

  const OptionCard = ({
    role,
    icon,
    title,
    desc,
    tone = "amber",
  }: {
    role: PromoteRoleOption;
    icon: React.ReactNode;
    title: string;
    desc: string;
    tone?: "amber" | "indigo" | "purple" | "stone";
  }) => {
    const isSelected = modal.role === role;
    const toneRing = {
      amber: isSelected
        ? "border-amber-400 bg-amber-50 shadow-2xs"
        : "border-stone-200 hover:border-amber-300 hover:bg-amber-50/40",
      indigo: isSelected
        ? "border-indigo-400 bg-indigo-50/70 shadow-2xs"
        : "border-stone-200 hover:border-indigo-200 hover:bg-stone-50/80",
      purple: isSelected
        ? "border-purple-400 bg-purple-50/70 shadow-2xs"
        : "border-stone-200 hover:border-purple-300 hover:bg-purple-50/30",
      stone: isSelected
        ? "border-stone-400 bg-stone-100 shadow-2xs"
        : "border-stone-200 hover:border-stone-300 hover:bg-stone-50",
    }[tone];

    return (
      <button
        type="button"
        onClick={() => onSelectRole(role)}
        className={`w-full text-left p-3 sm:p-3.5 rounded-xl border cursor-pointer flex items-start gap-3 transition touch-manipulation ${toneRing}`}
      >
        <RoleRadio current={isSelected} />
        <div className="min-w-0 flex-1">
          <div className="font-bold text-stone-900 text-xs flex items-center gap-1.5">
            {icon}
            <span>{title}</span>
          </div>
          <p className="text-[11px] text-stone-600 mt-1 leading-snug">{desc}</p>
        </div>
      </button>
    );
  };

  const buttonLabel =
    modal.role === "musician"
      ? isCurrentMusician
        ? t("admin.modals.promote.revokeMusician", {
            defaultValue: "Revoke Musician Status",
          })
        : t("admin.modals.promote.grantMusician", {
            defaultValue: "Grant Musician Status",
          })
      : modal.role === "user"
        ? t("admin.modals.promote.setUser", { defaultValue: "Set as User" })
        : modal.role === "admin"
          ? t("admin.modals.promote.setAdmin", { defaultValue: "Set as Admin" })
          : t("admin.modals.promote.setSuperAdmin", {
              defaultValue: "Set as Super Admin",
            });

  const buttonTone =
    modal.role === "musician"
      ? isCurrentMusician
        ? "bg-rose-700 hover:bg-rose-800"
        : "bg-indigo-700 hover:bg-indigo-800"
      : "bg-amber-800 hover:bg-amber-900";

  return (
    <div className="fixed inset-0 z-[130] bg-black/50 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
      <div className="bg-white border border-stone-200 rounded-2xl max-w-md w-full p-4 sm:p-6 space-y-4 shadow-xl max-h-[92vh] flex flex-col">
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
                defaultValue: "Select a role to apply",
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

        <div className="space-y-2.5 overflow-y-auto min-h-0 py-1">
          <OptionCard
            role="user"
            icon={<User className="w-4 h-4 text-stone-600 shrink-0" />}
            title={t("admin.modals.promote.userTitle", {
              defaultValue: "Regular Member",
            })}
            desc={t("admin.modals.promote.userDesc", {
              defaultValue:
                "Standard member. No musician privileges, no admin access.",
            })}
            tone="stone"
          />
          <OptionCard
            role="musician"
            icon={<Music2 className="w-4 h-4 text-indigo-700 shrink-0" />}
            title={
              isCurrentMusician
                ? t("admin.modals.promote.musicianTitleRevoke", {
                    defaultValue: "Revoke Musician Status",
                  })
                : t("admin.modals.promote.musicianTitleGrant", {
                    defaultValue: "Grant Musician Status",
                  })
            }
            desc={
              isCurrentMusician
                ? t("admin.modals.promote.musicianDescRevoke", {
                    defaultValue:
                      "Remove musician privileges. They return to standard category-based requests.",
                  })
                : t("admin.modals.promote.musicianDescGrant", {
                    defaultValue:
                      "Enable direct viewing and booking of musician-only instruments.",
                  })
            }
            tone="indigo"
          />
          <OptionCard
            role="admin"
            icon={<ShieldCheck className="w-4 h-4 text-amber-800 shrink-0" />}
            title={t("admin.modals.promote.adminTitle", {
              defaultValue: "Administrator",
            })}
            desc={t("admin.modals.promote.adminDesc", {
              defaultValue:
                "Can review, approve, assign instruments, and manage reservations. Gains access to the Admin Portal.",
            })}
          />
          <OptionCard
            role="super_admin"
            icon={<Sparkles className="w-4 h-4 text-amber-700 shrink-0" />}
            title={t("admin.modals.promote.superAdminTitle", {
              defaultValue: "Super Administrator",
            })}
            desc={t("admin.modals.promote.superAdminDesc", {
              defaultValue:
                "Full access including fair usage limits, payments, category fees, and role grants.",
            })}
          />
        </div>

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
            className={`px-4 py-2 rounded-xl text-white font-bold cursor-pointer shadow-xs text-xs transition touch-manipulation active:scale-95 ${buttonTone}`}
          >
            {buttonLabel}
          </button>
        </div>
      </div>
    </div>
  );
};
