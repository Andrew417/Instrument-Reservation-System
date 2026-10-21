import React from "react";
import { useTranslation } from "react-i18next";
import { UserPlus, RefreshCw, Shield, ExternalLink } from "lucide-react";

export interface AdminAccountItem {
  id: string;
  name: string;
  email?: string;
  phoneNumber?: string;
  isSuperAdmin: boolean;
  createdAt: string;
}

interface AdminAccountsTabProps {
  adminAccountsList: AdminAccountItem[];
  loadingAdmins: boolean;
  currentProfile: {
    id?: string;
    email?: string;
    phoneNumber?: string;
  } | null;
  onOpenUserProfile: (userId: string, entityType: "user" | "admin") => void;
  onOpenCreateAdminModal: () => void;
  onDemoteAdmin: (adminId: string, adminName: string) => void;
  onRemoveAdmin: (adminId: string, adminName: string) => void;
}

export const AdminAccountsTab: React.FC<AdminAccountsTabProps> = ({
  adminAccountsList,
  loadingAdmins,
  currentProfile,
  onOpenUserProfile,
  onOpenCreateAdminModal,
  onDemoteAdmin,
  onRemoveAdmin,
}) => {
  const { t } = useTranslation();

  return (
    <div className="bg-white border border-stone-200 rounded-2xl p-5 shadow-2xs space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-stone-100 pb-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="font-bold text-stone-900 text-sm whitespace-nowrap">
              {t("admin.adminAccounts.title")}
            </h2>
            <span className="px-2 py-0.5 rounded bg-amber-100 text-amber-900 text-[10px] font-extrabold border border-amber-200 whitespace-nowrap">
              {t("admin.adminAccounts.badge")}
            </span>
          </div>
          <p className="text-xs text-stone-500 mt-0.5">
            {t("admin.adminAccounts.subtitle")}
          </p>
        </div>

        <button
          id="btn-open-create-admin-modal"
          onClick={onOpenCreateAdminModal}
          className="self-start sm:self-auto shrink-0 px-3.5 py-2 rounded-xl bg-amber-800 hover:bg-amber-900 text-white text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer shadow-xs whitespace-nowrap"
        >
          <UserPlus className="w-3.5 h-3.5 shrink-0" />
          <span>{t("admin.adminAccounts.addButton")}</span>
        </button>
      </div>

      {loadingAdmins ? (
        <div className="py-12 flex flex-col items-center gap-2 text-stone-500">
          <RefreshCw className="w-4 h-4 animate-spin text-amber-700" />
          <div className="text-xs">{t("admin.adminAccounts.loading")}</div>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-stone-200 bg-stone-50/80 text-[11px] font-bold text-stone-600">
                <th className="py-2.5 px-3">
                  {t("admin.adminAccounts.colAdministrator")}
                </th>
                <th className="py-2.5 px-3">
                  {t("admin.adminAccounts.colRole")}
                </th>
                <th className="py-2.5 px-3">
                  {t("admin.adminAccounts.colCreated")}
                </th>
                <th className="py-2.5 px-3 text-right">
                  {t("admin.adminAccounts.colActions")}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {adminAccountsList.map((adm) => {
                const isCurrentAdmin =
                  (adm.email &&
                    currentProfile?.email &&
                    adm.email.toLowerCase() ===
                      currentProfile.email.toLowerCase()) ||
                  adm.id === currentProfile?.id ||
                  adm.phoneNumber === currentProfile?.phoneNumber;
                const isHardcodedSuperAdmin =
                  adm.email?.toLowerCase() === "andrewehab417@gmail.com";
                return (
                  <tr
                    key={adm.id}
                    className="hover:bg-stone-50/60 transition"
                  >
                    <td className="py-3 px-3 align-middle">
                      <button
                        type="button"
                        onClick={() => onOpenUserProfile(adm.id, "admin")}
                        className="font-semibold text-stone-900 hover:text-amber-900 hover:underline text-left cursor-pointer transition flex items-center gap-1.5 group"
                        title="View Administrator Profile"
                      >
                        <Shield className="w-3.5 h-3.5 text-amber-800 shrink-0" />
                        <span className="truncate">{adm.name}</span>
                        <ExternalLink className="w-2.5 h-2.5 text-stone-400 group-hover:text-amber-800 transition shrink-0" />
                      </button>
                    </td>
                    <td className="py-3 px-3">
                      <span
                        className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold whitespace-nowrap ${
                          adm.isSuperAdmin
                            ? "bg-amber-100 text-amber-950 border border-amber-300"
                            : "bg-stone-100 text-stone-700 border border-stone-200"
                        }`}
                      >
                        {adm.isSuperAdmin
                          ? t("admin.adminAccounts.superAdminBadge")
                          : t("admin.adminAccounts.adminBadge")}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-stone-500">
                      {new Date(adm.createdAt).toLocaleDateString()}
                    </td>
                    <td className="py-3 px-3 text-right">
                      {!isCurrentAdmin && !isHardcodedSuperAdmin ? (
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => onDemoteAdmin(adm.id, adm.name)}
                            className="px-2.5 py-1 rounded-lg bg-stone-50 hover:bg-stone-100 text-stone-700 border border-stone-200 text-xs font-semibold cursor-pointer"
                          >
                            {t("admin.adminAccounts.demote")}
                          </button>
                          <button
                            onClick={() => onRemoveAdmin(adm.id, adm.name)}
                            className="px-2.5 py-1 rounded-lg bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 text-xs font-semibold cursor-pointer"
                          >
                            {t("admin.adminAccounts.delete")}
                          </button>
                        </div>
                      ) : (
                        <span className="text-[10px] text-stone-400 italic">
                          {isHardcodedSuperAdmin
                            ? t("admin.adminAccounts.protectedAccount")
                            : t("admin.adminAccounts.currentSession")}
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
