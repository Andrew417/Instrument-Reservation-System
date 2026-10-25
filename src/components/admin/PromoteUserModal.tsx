import React, { useCallback, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { X, ShieldCheck, Sparkles, Music2 } from "lucide-react";

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

/* Move sub-components outside to prevent re-mounting on every click */
const RoleRadio = React.memo(({ current }: { current: boolean }) => (
  <span
    className={`mt-0.5 w-4 h-4 rounded-full border-2 shrink-0 flex items-center justify-center ${
      current ? "border-yellow-700" : "border-stone-300"
    }`}
  >
    {current && <span className="w-2 h-2 rounded-full bg-yellow-700" />}
  </span>
));
RoleRadio.displayName = "RoleRadio";

interface OptionCardProps {
  role: PromoteRoleOption;
  icon: React.ReactNode;
  title: string;
  desc: string;
  tone: "yellow" | "indigo" | "amber" | "stone";
  isSelected: boolean;
  onSelect: (role: PromoteRoleOption) => void;
}

const OptionCard = React.memo(
  ({
    role,
    icon,
    title,
    desc,
    tone,
    isSelected,
    onSelect,
  }: OptionCardProps) => {
    const toneRing = {
      yellow: isSelected
        ? "border-yellow-400 bg-yellow-50 shadow-2xs"
        : "border-stone-200 hover:border-yellow-300 hover:bg-yellow-50/40",
      indigo: isSelected
        ? "border-indigo-400 bg-indigo-50/70 shadow-2xs"
        : "border-stone-200 hover:border-indigo-200 hover:bg-stone-50/80",
      amber: isSelected
        ? "border-amber-400 bg-amber-50 shadow-2xs"
        : "border-stone-200 hover:border-amber-400 hover:bg-amber-50/40",
      stone: isSelected
        ? "border-stone-400 bg-stone-100 shadow-2xs"
        : "border-stone-200 hover:border-stone-300 hover:bg-stone-50",
    }[tone];

    return (
      <button
        type="button"
        onClick={() => onSelect(role)}
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
  },
);
OptionCard.displayName = "OptionCard";

export const PromoteUserModal: React.FC<PromoteUserModalProps> = ({
  modal,
  onClose,
  onSelectRole,
  onConfirm,
}) => {
  const { t } = useTranslation();

  const isCurrentMusician = Boolean(modal?.isMusician);

  const handleSelectUser = useCallback(
    () => onSelectRole("user"),
    [onSelectRole],
  );
  const handleSelectMusician = useCallback(
    () => onSelectRole("musician"),
    [onSelectRole],
  );
  const handleSelectAdmin = useCallback(
    () => onSelectRole("admin"),
    [onSelectRole],
  );
  const handleSelectSuperAdmin = useCallback(
    () => onSelectRole("super_admin"),
    [onSelectRole],
  );

  const buttonLabel = useMemo(() => {
    if (!modal) return "";
    if (modal.role === "musician") {
      return isCurrentMusician
        ? "Revoke Musician Status"
        : "Grant Musician Status";
    }
    if (modal.role === "user") return "Set as User";
    if (modal.role === "admin")
      return t("admin.modals.promote.confirmButton", {
        defaultValue: "Confirm Promotion",
      });
    return t("admin.modals.promote.confirmButton", {
      defaultValue: "Confirm Promotion",
    });
  }, [modal, isCurrentMusician, t]);

  const buttonTone = useMemo(() => {
    if (!modal) return "";
    if (modal.role === "musician") {
      return isCurrentMusician
        ? "bg-rose-700 hover:bg-rose-800"
        : "bg-indigo-700 hover:bg-indigo-800";
    }
    return "bg-amber-800 hover:bg-amber-900";
  }, [modal, isCurrentMusician]);

  if (!modal) return null;

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
          <OptionCard
            role="user"
            icon={
              <span className="w-4 h-4 rounded-full bg-yellow-100 border border-yellow-300 shrink-0" />
            }
            title="User"
            desc="Remove musician status and return this member to the regular user role."
            tone="yellow"
            isSelected={modal.role === "user"}
            onSelect={handleSelectUser}
          />

          {/* Musician Status Option */}
          <OptionCard
            role="musician"
            icon={<Music2 className="w-4 h-4 text-indigo-700 shrink-0" />}
            title={
              isCurrentMusician
                ? "Revoke Musician Status"
                : "Grant Musician Status"
            }
            desc={
              isCurrentMusician
                ? "Remove musician status. The user returns to standard category-based requests."
                : "Enable direct viewing and booking of musician-only instruments on the calendar."
            }
            tone="indigo"
            isSelected={modal.role === "musician"}
            onSelect={handleSelectMusician}
          />

          {/* Admin Option */}
          <OptionCard
            role="admin"
            icon={<ShieldCheck className="w-4 h-4 text-amber-800 shrink-0" />}
            title={t("admin.modals.promote.adminTitle", {
              defaultValue: "Administrator",
            })}
            desc={t("admin.modals.promote.adminDesc", {
              defaultValue:
                "Can review, approve, assign instruments, and manage church reservations.",
            })}
            tone="amber"
            isSelected={modal.role === "admin"}
            onSelect={handleSelectAdmin}
          />

          {/* Super Admin Option */}
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
            tone="amber"
            isSelected={modal.role === "super_admin"}
            onSelect={handleSelectSuperAdmin}
          />
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
            className={`px-4 py-2 rounded-xl text-white font-bold cursor-pointer shadow-xs text-xs transition touch-manipulation active:scale-95 ${buttonTone}`}
          >
            {buttonLabel}
          </button>
        </div>
      </div>
    </div>
  );
};
