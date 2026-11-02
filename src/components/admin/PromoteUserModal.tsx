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
          <div className="font-bold text-stone-900 text-xs flex items-center gap-1.5 truncate">
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

const ROLE_RANKS: Record<PromoteRoleOption, number> = {
  user: 0,
  musician: 1,
  admin: 2,
  super_admin: 3,
};

export const PromoteUserModal: React.FC<PromoteUserModalProps> = ({
  modal,
  onClose,
  onSelectRole,
  onConfirm,
}) => {
  const { t } = useTranslation();

  const isCurrentSuperAdmin = Boolean(modal?.isCurrentlySuperAdmin);
  const isCurrentAdmin = Boolean(modal?.isCurrentlyAdmin);
  const isCurrentMusician = Boolean(modal?.isMusician);

  const currentRole: PromoteRoleOption = isCurrentSuperAdmin
    ? "super_admin"
    : isCurrentAdmin
      ? "admin"
      : isCurrentMusician
        ? "musician"
        : "user";

  const isSameRole = modal?.role === currentRole;

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

  const getRoleTitle = useCallback(
    (role: PromoteRoleOption) => {
      switch (role) {
        case "super_admin":
          return t("admin.modals.promote.superAdminTitle", {
            defaultValue: "Super Administrator",
          });
        case "admin":
          return t("admin.modals.promote.adminTitle", {
            defaultValue: "Administrator",
          });
        case "musician":
          return t("admin.modals.promote.musicianTitle", {
            defaultValue: "Musician",
          });
        case "user":
        default:
          return t("admin.modals.promote.userTitle", {
            defaultValue: "Member",
          });
      }
    },
    [t],
  );

  const buttonLabel = useMemo(() => {
    if (!modal) return "";
    if (isSameRole) {
      return t("admin.modals.promote.confirmButton", {
        defaultValue: "Confirm Role Change",
      });
    }

    const currentRank = ROLE_RANKS[currentRole];
    const targetRank = ROLE_RANKS[modal.role];
    const targetTitle = getRoleTitle(modal.role);

    if (targetRank > currentRank) {
      return t("admin.modals.promote.promoteTo", {
        role: targetTitle,
        defaultValue: `Promote to ${targetTitle}`,
      });
    }

    if (targetRank < currentRank) {
      return t("admin.modals.promote.demoteTo", {
        role: targetTitle,
        defaultValue: `Demote to ${targetTitle}`,
      });
    }

    return t("admin.modals.promote.confirmButton", {
      defaultValue: "Confirm Role Change",
    });
  }, [modal, isSameRole, currentRole, getRoleTitle, t]);

  const buttonTone = useMemo(() => {
    if (!modal) return "";
    if (isSameRole) {
      return "bg-stone-300 text-stone-500 cursor-not-allowed";
    }
    const currentRank = ROLE_RANKS[currentRole];
    const targetRank = ROLE_RANKS[modal.role];
    if (targetRank < currentRank) {
      return "bg-rose-700 hover:bg-rose-800";
    }
    return "bg-amber-800 hover:bg-amber-900";
  }, [modal, isSameRole, currentRole]);

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
                defaultValue: `Change Role for ${modal.userName}`,
              })}
            </h3>
            <p className="text-xs text-stone-500 truncate">
              {t("admin.modals.promote.subtitle", {
                defaultValue: "Select role or privileges to apply",
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
          {/* Regular Member Option */}
          <OptionCard
            role="user"
            icon={
              <span className="w-4 h-4 rounded-full bg-yellow-100 border border-yellow-300 shrink-0" />
            }
            title={t("admin.modals.promote.userTitle", {
              defaultValue: "Member",
            })}
            desc={t("admin.modals.promote.userDesc", {
              defaultValue:
                "Standard church member with basic instrument reservation capabilities.",
            })}
            tone="yellow"
            isSelected={modal.role === "user"}
            onSelect={handleSelectUser}
          />

          {/* Musician Status Option */}
          <OptionCard
            role="musician"
            icon={<Music2 className="w-4 h-4 text-indigo-700 shrink-0" />}
            title={t("admin.modals.promote.musicianTitle", {
              defaultValue: "Musician",
            })}
            desc={t("admin.modals.promote.musicianDesc", {
              defaultValue:
                "Can directly view and book musician-only instruments and equipment on the calendar.",
            })}
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
                "Manages instruments, reviews reservations, and messages members. Cannot manage other admins, hard limits, or payment settings.",
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
                "Full Administrator access, plus managing other admins, Trusted status, system hard limits, and payment settings.",
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
            disabled={isSameRole}
            onClick={() => onConfirm(modal.role)}
            className={`px-4 py-2 rounded-xl text-white font-bold shadow-xs text-xs transition touch-manipulation active:scale-95 cursor-pointer ${buttonTone}`}
          >
            {buttonLabel}
          </button>
        </div>
      </div>
    </div>
  );
};
