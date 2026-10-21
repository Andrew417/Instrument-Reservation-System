import React from "react";
import { useTranslation } from "react-i18next";
import {
  Search,
  RefreshCw,
  UserCheck,
  ExternalLink,
  Sparkles,
  MessageCircle,
  Clock,
  Check,
  X,
  Trash2,
  Users,
} from "lucide-react";
import { getStatusColor } from "../../../lib/status-colors";
import { LoadingSpinner } from "../../shared/LoadingSpinner";

export interface ApprovalsTabProps {
  approvalsList: any[];
  loadingApprovals: boolean;
  approvalCounts: {
    pending: number;
    approved: number;
    rejected: number;
    total: number;
  };
  approvalFilterStatus: "pending" | "approved" | "rejected" | "all";
  setApprovalFilterStatus: (val: "pending" | "approved" | "rejected" | "all") => void;
  approvalSearch: string;
  setApprovalSearch: (val: string) => void;
  approvalActionId: string | null;
  fetchApprovals: (filter?: "pending" | "approved" | "rejected" | "all") => void;
  openUserProfile: (userId: string) => void;
  handleApproveRegistration: (userId: string, userName: string) => void;
  triggerRejectUser: (user: any) => void;
  triggerDeleteUserPermanently: (user: any) => void;
  onNavigateToUsersWithSearch: (name: string) => void;
}

export const ApprovalsTab: React.FC<ApprovalsTabProps> = ({
  approvalsList,
  loadingApprovals,
  approvalCounts,
  approvalFilterStatus,
  setApprovalFilterStatus,
  approvalSearch,
  setApprovalSearch,
  approvalActionId,
  fetchApprovals,
  openUserProfile,
  handleApproveRegistration,
  triggerRejectUser,
  triggerDeleteUserPermanently,
  onNavigateToUsersWithSearch,
}) => {
  const { t } = useTranslation();

  return (
    <div
      id="admin-section-approvals"
      className="bg-white border border-stone-200 rounded-2xl shadow-2xs overflow-hidden"
    >
      <div className="p-3 sm:p-4 border-b border-stone-100">
        <div className="flex items-center justify-between gap-2 mb-2">
          <div className="flex items-center gap-2 min-w-0">
            <h2 className="font-bold text-stone-900 text-sm whitespace-nowrap">
              {t("admin.accountApprovals")}
            </h2>
            {approvalCounts.pending > 0 && (
              <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-amber-100 text-amber-900 border border-amber-300 whitespace-nowrap">
                {approvalCounts.pending} new
              </span>
            )}
          </div>

          <button
            id="btn-refresh-approvals"
            type="button"
            onClick={() => fetchApprovals()}
            className="shrink-0 p-2 rounded-xl bg-stone-50 hover:bg-stone-100 text-stone-600 border border-stone-200 transition cursor-pointer"
            title={t("admin.approvals.refreshTooltip")}
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>

        <div className="relative">
          <Search className="w-3.5 h-3.5 text-stone-400 absolute left-3 top-2.5" />
          <input
            id="approvals-search-input"
            type="text"
            placeholder={t("admin.approvals.searchPlaceholder")}
            value={approvalSearch}
            onChange={(e) => setApprovalSearch(e.target.value)}
            className="w-full pl-8 pr-8 py-2 bg-stone-50 border border-stone-200 rounded-xl text-xs text-stone-900 focus:outline-none focus:border-amber-700"
          />
          {approvalSearch && (
            <button
              type="button"
              onClick={() => setApprovalSearch("")}
              className="absolute right-2.5 top-2.5 text-stone-400 hover:text-stone-600 cursor-pointer p-0.5"
              title="Clear search"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        <div className="flex items-center gap-1.5 mt-2.5 overflow-x-auto -mx-1 px-1 pb-2 scrollbar-hide">
          {(
            [
              {
                key: "pending" as const,
                label: t("common.pending"),
                count: approvalCounts.pending,
                Icon: Clock,
              },
              {
                key: "approved" as const,
                label: t("common.approved"),
                count: approvalCounts.approved,
                Icon: Check,
              },
              {
                key: "rejected" as const,
                label: t("common.rejected"),
                count: approvalCounts.rejected,
                Icon: X,
              },
              {
                key: "all" as const,
                label: t("common.all"),
                count: approvalCounts.total,
                Icon: null,
              },
            ] as const
          ).map((tab) => {
            const isActive = approvalFilterStatus === tab.key;
            return (
              <button
                key={tab.key}
                type="button"
                onClick={() => {
                  if (approvalFilterStatus === tab.key) {
                    fetchApprovals(tab.key);
                  } else {
                    setApprovalFilterStatus(tab.key);
                  }
                }}
                className={`shrink-0 flex items-center gap-1.5 px-2.5 py-1.5 rounded-full text-[11px] font-bold transition cursor-pointer whitespace-nowrap ${
                  isActive
                    ? "bg-amber-800 text-white shadow-xs"
                    : "bg-stone-100 text-stone-600 hover:bg-stone-200/70"
                }`}
              >
                {tab.Icon && <tab.Icon className="w-3 h-3" />}
                <span>{tab.label}</span>
                <span
                  className={`px-1.5 rounded-full text-[10px] font-extrabold ${
                    isActive
                      ? "bg-amber-900 text-amber-100"
                      : "bg-stone-200 text-stone-700"
                  }`}
                >
                  {tab.count}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Table / List */}
      <div className="p-3 sm:p-4 pt-0">
        {loadingApprovals ? (
          <LoadingSpinner centered label={t("admin.approvals.loading") || "Loading approvals..."} />
        ) : approvalsList.length === 0 ? (
          <div className="py-12 text-center border border-dashed border-stone-200 rounded-xl bg-stone-50/50">
            <UserCheck className="w-8 h-8 text-stone-300 mx-auto mb-2" />
            <div className="font-bold text-stone-700 text-xs">
              {approvalFilterStatus === "pending"
                ? t("admin.approvals.emptyPendingTitle")
                : t("admin.approvals.emptyFilteredTitle")}
            </div>
            <p className="text-[11px] text-stone-400 mt-1 max-w-sm mx-auto">
              {approvalFilterStatus === "pending"
                ? t("admin.approvals.emptyPendingDesc")
                : t("admin.approvals.emptyFilteredDesc")}
            </p>
          </div>
        ) : (
          <>
            {/* Mobile card list (< sm) */}
            <div className="sm:hidden space-y-2">
              {approvalsList.map((u) => {
                const status =
                  u.approvalStatus ||
                  u.approval_status ||
                  (u.isActive ? "approved" : "pending");
                const isActioning = approvalActionId === u.id;
                const rawPhone = u.phoneNumber || u.phone_number || "";
                const whatsappNumber = rawPhone
                  .replace(/[^\d]/g, "")
                  .replace(/^0/, "20");

                return (
                  <div
                    key={u.id}
                    className="border border-stone-200 rounded-xl p-3 bg-white space-y-2"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <button
                        type="button"
                        onClick={() => openUserProfile(u.id)}
                        className="font-bold text-stone-900 hover:text-amber-900 text-left text-[13px] cursor-pointer truncate flex items-center gap-1 group min-w-0"
                      >
                        <span className="truncate">{u.name}</span>
                        <ExternalLink className="w-2.5 h-2.5 text-stone-400 group-hover:text-amber-800 transition shrink-0" />
                      </button>

                      {status === "pending" && (
                        <span
                          className={`shrink-0 inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${getStatusColor(
                            "pending",
                          )}`}
                        >
                          <Clock className="w-2.5 h-2.5" />
                          {t("common.pending")}
                        </span>
                      )}
                      {status === "approved" && (
                        <span
                          className={`shrink-0 inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${getStatusColor(
                            "approved",
                          )}`}
                        >
                          <Check className="w-2.5 h-2.5" />
                          {t("common.approved")}
                        </span>
                      )}
                      {status === "rejected" && (
                        <span
                          className={`shrink-0 inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${getStatusColor(
                            "rejected",
                          )}`}
                        >
                          <X className="w-2.5 h-2.5" />
                          {t("common.rejected")}
                        </span>
                      )}
                    </div>

                    <div className="flex items-center justify-between gap-2 text-[11px] text-stone-500">
                      {whatsappNumber ? (
                        <a
                          href={`https://wa.me/${whatsappNumber}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-emerald-700 hover:text-emerald-900 font-mono truncate"
                        >
                          <MessageCircle className="w-3 h-3 shrink-0" />
                          {rawPhone}
                        </a>
                      ) : (
                        <span className="text-stone-300">—</span>
                      )}
                      <span className="shrink-0 font-mono text-stone-400">
                        {new Date(
                          u.createdAt || u.created_at,
                        ).toLocaleDateString()}
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5 pt-1">
                      {status === "pending" && (
                        <>
                          <button
                            type="button"
                            disabled={isActioning}
                            onClick={() =>
                              handleApproveRegistration(u.id, u.name)
                            }
                            className="flex-1 px-3 py-2 rounded-lg bg-emerald-700 hover:bg-emerald-800 disabled:opacity-50 text-white text-xs font-bold flex items-center justify-center gap-1 cursor-pointer whitespace-nowrap"
                          >
                            <Check className="w-3.5 h-3.5 shrink-0" />
                            <span>{t("admin.approvals.approveBtn")}</span>
                          </button>
                          <button
                            type="button"
                            disabled={isActioning}
                            onClick={() => triggerRejectUser(u)}
                            className="flex-1 px-3 py-2 rounded-lg bg-stone-100 hover:bg-rose-50 text-rose-700 border border-stone-200 hover:border-rose-200 disabled:opacity-50 text-xs font-bold flex items-center justify-center gap-1 cursor-pointer whitespace-nowrap"
                          >
                            <X className="w-3.5 h-3.5 shrink-0" />
                            <span>{t("admin.approvals.rejectBtn")}</span>
                          </button>
                        </>
                      )}

                      {status === "rejected" && (
                        <>
                          <button
                            type="button"
                            disabled={isActioning}
                            onClick={() =>
                              handleApproveRegistration(u.id, u.name)
                            }
                            className="flex-1 px-3 py-2 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 disabled:opacity-50 text-xs font-bold flex items-center justify-center gap-1 cursor-pointer whitespace-nowrap"
                          >
                            <Check className="w-3.5 h-3.5 shrink-0" />
                            <span>
                              {t("admin.approvals.reApproveBtn")}
                            </span>
                          </button>
                          <button
                            type="button"
                            disabled={isActioning}
                            onClick={() =>
                              triggerDeleteUserPermanently(u)
                            }
                            className="px-3 py-2 rounded-lg bg-stone-50 hover:bg-rose-50 text-stone-500 hover:text-rose-700 border border-stone-200 hover:border-rose-200 disabled:opacity-50 cursor-pointer"
                            title="Delete permanently"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </>
                      )}

                      {status === "approved" && (
                        <button
                          type="button"
                          onClick={() => onNavigateToUsersWithSearch(u.name)}
                          className="w-full px-3 py-2 rounded-lg bg-stone-50 hover:bg-stone-100 text-stone-700 border border-stone-200 text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer whitespace-nowrap"
                        >
                          <Users className="w-3.5 h-3.5 text-amber-800 shrink-0" />
                          <span>
                            {t("admin.approvals.viewInDirectoryBtn")}
                          </span>
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Desktop table (≥ sm) */}
            <div className="hidden sm:block overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-stone-200 bg-stone-50/80 text-[11px] font-bold text-stone-600">
                    <th className="py-2.5 px-3">
                      {t("admin.approvals.colApplicantName")}
                    </th>
                    <th className="py-2.5 px-3 w-[140px]">
                      {t("admin.approvals.colPhoneNumber")}
                    </th>
                    <th className="py-2.5 px-3 w-[110px]">
                      {t("admin.approvals.colRegistrationDate")}
                    </th>
                    <th className="py-2.5 px-3 w-[110px]">
                      {t("admin.approvals.colApprovalStatus")}
                    </th>
                    <th className="py-2.5 px-3 text-right w-[200px]">
                      {t("common.actions")}
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100">
                  {approvalsList.map((u) => {
                    const status =
                      u.approvalStatus ||
                      u.approval_status ||
                      (u.isActive ? "approved" : "pending");
                    const isActioning = approvalActionId === u.id;
                    const rawPhone =
                      u.phoneNumber || u.phone_number || "";
                    const whatsappNumber = rawPhone
                      .replace(/[^\d]/g, "")
                      .replace(/^0/, "20");

                    return (
                      <tr
                        key={u.id}
                        className="hover:bg-stone-50/60 transition"
                      >
                        <td className="py-3 px-3">
                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                openUserProfile(u.id);
                              }}
                              className="font-semibold text-stone-900 hover:text-amber-900 hover:underline text-left cursor-pointer transition flex items-center gap-1 group whitespace-nowrap"
                            >
                              <span className="truncate max-w-[200px]">
                                {u.name}
                              </span>
                              <ExternalLink className="w-2.5 h-2.5 text-stone-400 group-hover:text-amber-800 transition shrink-0" />
                            </button>
                            {u.isTrusted && (
                              <span className="inline-flex items-center gap-0.5 px-1.5 py-0.2 rounded text-[9px] font-bold bg-amber-100 text-amber-900 border border-amber-200">
                                <Sparkles className="w-2.5 h-2.5 text-amber-700" />
                                {t("common.trusted")}
                              </span>
                            )}
                          </div>
                        </td>

                        <td className="py-3 px-3 font-mono text-stone-600 whitespace-nowrap">
                          {whatsappNumber ? (
                            <a
                              href={`https://wa.me/${whatsappNumber}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1.5 text-emerald-700 hover:text-emerald-900 hover:underline transition"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <MessageCircle className="w-3.5 h-3.5 shrink-0" />
                              <span className="truncate max-w-[110px]">
                                {rawPhone}
                              </span>
                            </a>
                          ) : (
                            "—"
                          )}
                        </td>

                        <td className="py-3 px-3 text-stone-500 text-[11px] whitespace-nowrap">
                          {new Date(
                            u.createdAt || u.created_at,
                          ).toLocaleDateString()}
                        </td>

                        <td className="py-3 px-3">
                          {status === "pending" && (
                            <span
                              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold whitespace-nowrap ${getStatusColor(
                                "pending",
                              )}`}
                            >
                              <Clock className="w-3 h-3" />
                              {t("common.pending")}
                            </span>
                          )}
                          {status === "approved" && (
                            <span
                              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold whitespace-nowrap ${getStatusColor(
                                "approved",
                              )}`}
                            >
                              <Check className="w-3 h-3" />
                              {t("common.approved")}
                            </span>
                          )}
                          {status === "rejected" && (
                            <span
                              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold whitespace-nowrap ${getStatusColor(
                                "rejected",
                              )}`}
                            >
                              <X className="w-3 h-3" />
                              {t("common.rejected")}
                            </span>
                          )}
                        </td>

                        <td className="py-3 px-3 text-right">
                          <div className="flex items-center justify-end gap-1.5 flex-nowrap">
                            {status === "pending" && (
                              <>
                                <button
                                  type="button"
                                  disabled={isActioning}
                                  onClick={() =>
                                    handleApproveRegistration(
                                      u.id,
                                      u.name,
                                    )
                                  }
                                  className="px-2.5 py-1 rounded-lg bg-emerald-700 hover:bg-emerald-800 disabled:opacity-50 text-white text-xs font-bold flex items-center gap-1 cursor-pointer shadow-2xs whitespace-nowrap shrink-0"
                                >
                                  <Check className="w-3 h-3 shrink-0" />
                                  <span>
                                    {t("admin.approvals.approveBtn")}
                                  </span>
                                </button>
                                <button
                                  type="button"
                                  disabled={isActioning}
                                  onClick={() => triggerRejectUser(u)}
                                  className="px-2.5 py-1 rounded-lg bg-stone-100 hover:bg-rose-50 text-rose-700 border border-stone-200 hover:border-rose-200 disabled:opacity-50 text-xs font-bold flex items-center gap-1 cursor-pointer whitespace-nowrap shrink-0"
                                >
                                  <X className="w-3 h-3 shrink-0" />
                                  <span>
                                    {t("admin.approvals.rejectBtn")}
                                  </span>
                                </button>
                              </>
                            )}

                            {status === "rejected" && (
                              <>
                                <button
                                  type="button"
                                  disabled={isActioning}
                                  onClick={() =>
                                    handleApproveRegistration(
                                      u.id,
                                      u.name,
                                    )
                                  }
                                  className="px-2.5 py-1 rounded-lg bg-stone-50 hover:bg-emerald-50 text-emerald-800 border border-stone-200 hover:border-emerald-200 disabled:opacity-50 text-xs font-semibold flex items-center gap-1 cursor-pointer whitespace-nowrap shrink-0"
                                >
                                  <Check className="w-3 h-3 text-emerald-700 shrink-0" />
                                  <span>
                                    {t("admin.approvals.reApproveBtn")}
                                  </span>
                                </button>
                                <button
                                  type="button"
                                  disabled={isActioning}
                                  onClick={() =>
                                    triggerDeleteUserPermanently(u)
                                  }
                                  className="p-1.5 rounded-lg bg-stone-50 hover:bg-rose-50 text-stone-500 hover:text-rose-700 border border-stone-200 hover:border-rose-200 transition cursor-pointer shrink-0"
                                  title="Delete permanently"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </>
                            )}

                            {status === "approved" && (
                              <button
                                type="button"
                                onClick={() => onNavigateToUsersWithSearch(u.name)}
                                className="px-2.5 py-1 rounded-lg bg-stone-50 hover:bg-stone-100 text-stone-700 border border-stone-200 text-xs font-semibold flex items-center gap-1 cursor-pointer whitespace-nowrap shrink-0"
                              >
                                <Users className="w-3.5 h-3.5 text-amber-800 shrink-0" />
                                <span>
                                  {t(
                                    "admin.approvals.viewInDirectoryBtn",
                                  )}
                                </span>
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </div>
  );
};
