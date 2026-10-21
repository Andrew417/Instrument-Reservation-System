import React from "react";
import { useTranslation } from "react-i18next";
import {
  Search,
  RefreshCw,
  ExternalLink,
  MessageCircle,
  Clock,
  X,
  Sparkles,
  Check,
  Plus,
} from "lucide-react";
import { getStatusColor } from "../../../lib/status-colors";
import { LoadingSpinner } from "../../shared/LoadingSpinner";

export interface UsersTabProps {
  usersList: any[];
  loadingUsers: boolean;
  userSearch: string;
  setUserSearch: (val: string) => void;
  fetchUsers: () => void;
  openUserProfile: (userId: string) => void;
  handleApproveRegistration: (userId: string, userName: string) => void;
  triggerRejectUser: (user: any) => void;
  setBookOnBehalfUser: (user: any) => void;
}

export const UsersTab: React.FC<UsersTabProps> = ({
  usersList,
  loadingUsers,
  userSearch,
  setUserSearch,
  fetchUsers,
  openUserProfile,
  handleApproveRegistration,
  triggerRejectUser,
  setBookOnBehalfUser,
}) => {
  const { t } = useTranslation();

  return (
    <div className="bg-white border border-stone-200 rounded-2xl p-5 shadow-2xs space-y-4">
      <div className="flex flex-col gap-2 pb-3">
        <div className="min-w-0">
          <h2 className="font-bold text-stone-900 text-sm whitespace-nowrap">
            {t("admin.users.title")}
          </h2>
          <p className="text-xs text-stone-500 mt-0.5">
            {t("admin.users.subtitle")}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <div className="relative flex-1 min-w-0">
            <Search className="w-3.5 h-3.5 text-stone-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder={t("admin.users.searchPlaceholder")}
              value={userSearch}
              onChange={(e) => setUserSearch(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 bg-stone-50 border border-stone-200 rounded-xl text-xs text-stone-900 focus:outline-none focus:border-amber-700"
            />
          </div>
          <button
            onClick={fetchUsers}
            className="shrink-0 p-2 rounded-xl bg-stone-50 hover:bg-stone-100 text-stone-600 border border-stone-200 transition cursor-pointer"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {loadingUsers ? (
        <LoadingSpinner centered label={t("admin.users.loading") || "Loading users..."} />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-stone-200 bg-stone-50/80 text-[11px] font-bold text-stone-600">
                <th className="py-2.5 px-3 whitespace-nowrap w-[220px]">
                  {t("admin.users.colMember")}
                </th>
                <th className="py-2.5 px-3 whitespace-nowrap w-[140px]">
                  {t("admin.users.colPhone")}
                </th>
                <th className="py-2.5 px-3 whitespace-nowrap w-[110px]">
                  {t("admin.users.colStatus")}
                </th>
                <th className="py-2.5 px-3 whitespace-nowrap w-[130px]">
                  {t("admin.users.colTrusted")}
                </th>
                <th className="py-2.5 px-3 text-right whitespace-nowrap w-[180px]">
                  {t("admin.users.colActions")}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {usersList.map((u) => {
                const rawPhone = u.phoneNumber || u.phone_number || "";
                const whatsappNumber = rawPhone
                  .replace(/[^\d]/g, "")
                  .replace(/^0/, "20");

                return (
                  <tr
                    key={u.id}
                    className="hover:bg-stone-50/60 transition"
                  >
                    {/* Member */}
                    <td className="py-3 px-3">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          openUserProfile(u.id);
                        }}
                        className="font-semibold text-stone-900 hover:text-amber-900 hover:underline text-left cursor-pointer transition flex items-center gap-1.5 group whitespace-nowrap"
                        title={
                          t("admin.userDetail.viewProfile") ||
                          "View Member Profile"
                        }
                      >
                        <span className="truncate max-w-[220px]">
                          {u.name}
                        </span>
                        <ExternalLink className="w-3 h-3 text-stone-400 group-hover:text-amber-800 transition shrink-0" />
                      </button>
                    </td>

                    {/* Phone (WhatsApp clickable) */}
                    <td className="py-3 px-3 font-mono text-stone-600">
                      {whatsappNumber ? (
                        <a
                          href={`https://wa.me/${whatsappNumber}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 text-emerald-700 hover:text-emerald-900 hover:underline transition"
                          title={`Chat with ${u.name} on WhatsApp`}
                          onClick={(e) => e.stopPropagation()}
                        >
                          <MessageCircle className="w-3.5 h-3.5" />
                          <span>{rawPhone}</span>
                        </a>
                      ) : (
                        "—"
                      )}
                    </td>

                    {/* Status */}
                    <td className="py-3 px-3">
                      {u.approval_status === "pending" ||
                      u.approvalStatus === "pending" ? (
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${getStatusColor(
                            "pending",
                          )}`}
                        >
                          <Clock className="w-2.5 h-2.5" />
                          {t("admin.users.pendingApproval")}
                        </span>
                      ) : u.approval_status === "rejected" ||
                        u.approvalStatus === "rejected" ? (
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${getStatusColor(
                            "rejected",
                          )}`}
                        >
                          <X className="w-2.5 h-2.5" />
                          {t("admin.users.rejected")}
                        </span>
                      ) : (
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            u.isActive
                              ? "bg-emerald-50 text-emerald-800 border border-emerald-200"
                              : "bg-stone-100 text-stone-600 border border-stone-200"
                          }`}
                        >
                          {u.isActive
                            ? t("admin.users.active")
                            : t("admin.users.deactivated")}
                        </span>
                      )}
                    </td>

                    {/* Trusted */}
                    <td className="py-3 px-3">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {u.isTrusted ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-100 text-amber-900 border border-amber-200">
                            <Sparkles className="w-2.5 h-2.5 text-amber-700" />
                            {t("admin.users.trustedMember")}
                          </span>
                        ) : (
                          <span className="text-[10px] text-stone-400 font-medium">
                            {t("admin.users.standard")}
                          </span>
                        )}
                        {Number(u.noShowCount || 0) > 0 && (
                          <span
                            className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-rose-50 text-rose-800 border border-rose-200"
                            title={`${u.noShowCount} no-show reservation(s)`}
                          >
                            {u.noShowCount} {t("common.noShow")}
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Actions */}
                    <td className="py-3 px-3 text-right">
                      <div className="flex items-center justify-end gap-1.5 flex-nowrap">
                        {(u.approval_status === "pending" ||
                          u.approvalStatus === "pending") && (
                          <>
                            <button
                              type="button"
                              onClick={() =>
                                handleApproveRegistration(u.id, u.name)
                              }
                              className="px-2.5 py-1 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold flex items-center gap-1 cursor-pointer shadow-2xs whitespace-nowrap shrink-0"
                              title={t("admin.users.approveTooltip")}
                            >
                              <Check className="w-3 h-3 shrink-0" />
                              <span>{t("admin.users.approve")}</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => triggerRejectUser(u)}
                              className="px-2.5 py-1 rounded-lg bg-stone-100 hover:bg-rose-50 text-rose-700 border border-stone-200 hover:border-rose-200 text-xs font-bold flex items-center gap-1 cursor-pointer whitespace-nowrap shrink-0"
                              title="Reject registration (account preserved in audit database)"
                            >
                              <X className="w-3 h-3 shrink-0" />
                              <span>
                                {t("admin.approvals.rejectBtn")}
                              </span>
                            </button>
                          </>
                        )}

                        <button
                          onClick={() => setBookOnBehalfUser(u)}
                          className="px-2.5 py-1 rounded-lg bg-stone-50 hover:bg-stone-100 text-stone-700 border border-stone-200 text-xs font-semibold flex items-center gap-1 cursor-pointer whitespace-nowrap shrink-0"
                          title={t("admin.users.bookForTooltip")}
                        >
                          <Plus className="w-3 h-3 text-amber-800 shrink-0" />
                          <span>{t("admin.users.bookFor")}</span>
                        </button>
                      </div>
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
