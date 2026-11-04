import React, { useState, useEffect, useMemo, useCallback } from "react";
import { useTranslation } from "react-i18next";
import {
  X,
  Search,
  Church,
  Users,
  Check,
  Plus,
  Trash2,
  AlertTriangle,
  Music2,
  Sparkles,
  MessageCircle,
  CheckCircle2,
  Lock,
} from "lucide-react";
import { adminFetch } from "../../lib/auth-helpers";
import { LoadingSpinner } from "../shared/LoadingSpinner";
import type { ServiceItem } from "./tabs/ServicesTab";

export interface ServiceUser {
  id: string;
  name: string;
  email: string | null;
  phoneNumber: string | null;
  isMusician: boolean;
  isTrusted: boolean;
  isActive: boolean;
  approvalStatus: string;
  isAssigned: boolean;
}

export interface ServiceUsersModalProps {
  isOpen: boolean;
  service: ServiceItem | null;
  onClose: () => void;
  onUpdated: () => void;
}

export const ServiceUsersModal: React.FC<ServiceUsersModalProps> = ({
  isOpen,
  service,
  onClose,
  onUpdated,
}) => {
  const { t } = useTranslation();

  const [users, setUsers] = useState<ServiceUser[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState<string>("");
  const [filterTab, setFilterTab] = useState<"all" | "assigned" | "unassigned">(
    "all",
  );

  // Per-user action loading state
  const [actionUserId, setActionUserId] = useState<string | null>(null);
  const [statusNotice, setStatusNotice] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

  // Revoke confirmation modal state
  const [userToRevoke, setUserToRevoke] = useState<ServiceUser | null>(null);
  const [isRevoking, setIsRevoking] = useState<boolean>(false);

  // Multi-select for bulk assign
  const [selectedUnassignedIds, setSelectedUnassignedIds] = useState<Set<string>>(
    new Set(),
  );
  const [isBulkAssigning, setIsBulkAssigning] = useState<boolean>(false);

  const fetchServiceUsers = useCallback(async () => {
    if (!service) return;
    setLoading(true);
    setError(null);
    try {
      const res = await adminFetch(`/services/${service.id}/users`);
      const data = await res.json();
      if (data.success && Array.isArray(data.users)) {
        setUsers(data.users);
      } else {
        setError(data.error || "Failed to load members for this service.");
      }
    } catch (err: any) {
      setError(err.message || "Failed to load members for this service.");
    } finally {
      setLoading(false);
    }
  }, [service]);

  useEffect(() => {
    if (isOpen && service) {
      fetchServiceUsers();
      setSelectedUnassignedIds(new Set());
      setStatusNotice(null);
      setSearch("");
      setFilterTab("all");
    }
  }, [isOpen, service, fetchServiceUsers]);

  // Handle Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen && !userToRevoke) {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose, userToRevoke]);

  const assignedCount = useMemo(
    () => users.filter((u) => u.isAssigned).length,
    [users],
  );
  const unassignedCount = useMemo(
    () => users.filter((u) => !u.isAssigned).length,
    [users],
  );

  const filteredUsers = useMemo(() => {
    return users.filter((u) => {
      if (filterTab === "assigned" && !u.isAssigned) return false;
      if (filterTab === "unassigned" && u.isAssigned) return false;
      if (search.trim()) {
        const q = search.trim().toLowerCase();
        const matchesName = u.name.toLowerCase().includes(q);
        const matchesEmail = (u.email || "").toLowerCase().includes(q);
        const matchesPhone = (u.phoneNumber || "").includes(q);
        return matchesName || matchesEmail || matchesPhone;
      }
      return true;
    });
  }, [users, filterTab, search]);

  if (!isOpen || !service) return null;

  const handleAssignSingle = async (user: ServiceUser) => {
    if (service.isArchived) return;
    setActionUserId(user.id);
    setStatusNotice(null);
    try {
      const res = await adminFetch(`/users/${user.id}/services/assign`, {
        method: "POST",
        body: JSON.stringify({ serviceId: service.id }),
      });
      const data = await res.json();
      if (data.success) {
        setUsers((prev) =>
          prev.map((u) => (u.id === user.id ? { ...u, isAssigned: true } : u)),
        );
        setSelectedUnassignedIds((prev) => {
          const next = new Set(prev);
          next.delete(user.id);
          return next;
        });
        setStatusNotice({
          type: "success",
          message: t("admin.services.assignedSuccess", {
            name: user.name,
            service: service.name,
            defaultValue: `Assigned ${user.name} to ${service.name}`,
          }),
        });
        onUpdated();
      } else {
        setStatusNotice({
          type: "error",
          message: data.error || "Failed to assign service.",
        });
      }
    } catch (err: any) {
      setStatusNotice({
        type: "error",
        message: err.message || "Failed to assign service.",
      });
    } finally {
      setActionUserId(null);
    }
  };

  const handleConfirmRevoke = async () => {
    if (!userToRevoke || !service) return;
    setIsRevoking(true);
    setStatusNotice(null);
    try {
      const res = await adminFetch(`/users/${userToRevoke.id}/services/revoke`, {
        method: "POST",
        body: JSON.stringify({ serviceId: service.id }),
      });
      const data = await res.json();
      if (data.success) {
        setUsers((prev) =>
          prev.map((u) =>
            u.id === userToRevoke.id ? { ...u, isAssigned: false } : u,
          ),
        );
        const cancelledCount = data.cancelledCount || 0;
        setStatusNotice({
          type: "success",
          message:
            cancelledCount > 0
              ? t("admin.services.revokedWithCancellations", {
                  name: userToRevoke.name,
                  service: service.name,
                  count: cancelledCount,
                  defaultValue: `Removed ${userToRevoke.name} from ${service.name}. ${cancelledCount} future reservation(s) cancelled.`,
                })
              : t("admin.services.revokedSuccess", {
                  name: userToRevoke.name,
                  service: service.name,
                  defaultValue: `Removed ${userToRevoke.name} from ${service.name}`,
                }),
        });
        setUserToRevoke(null);
        onUpdated();
      } else {
        setStatusNotice({
          type: "error",
          message: data.error || "Failed to remove service.",
        });
      }
    } catch (err: any) {
      setStatusNotice({
        type: "error",
        message: err.message || "Failed to remove service.",
      });
    } finally {
      setIsRevoking(false);
    }
  };

  const toggleSelectUnassigned = (userId: string) => {
    setSelectedUnassignedIds((prev) => {
      const next = new Set(prev);
      if (next.has(userId)) {
        next.delete(userId);
      } else {
        next.add(userId);
      }
      return next;
    });
  };

  const handleBulkAssign = async () => {
    if (selectedUnassignedIds.size === 0 || service.isArchived) return;
    setIsBulkAssigning(true);
    setStatusNotice(null);

    const idsToAssign = Array.from(selectedUnassignedIds);
    let successCount = 0;
    let failedCount = 0;

    for (const userId of idsToAssign) {
      try {
        const res = await adminFetch(`/users/${userId}/services/assign`, {
          method: "POST",
          body: JSON.stringify({ serviceId: service.id }),
        });
        const data = await res.json();
        if (data.success) {
          successCount++;
          setUsers((prev) =>
            prev.map((u) => (u.id === userId ? { ...u, isAssigned: true } : u)),
          );
        } else {
          failedCount++;
        }
      } catch {
        failedCount++;
      }
    }

    setIsBulkAssigning(false);
    setSelectedUnassignedIds(new Set());
    onUpdated();

    if (failedCount === 0) {
      setStatusNotice({
        type: "success",
        message: t("admin.services.bulkAssignSuccess", {
          count: successCount,
          service: service.name,
          defaultValue: `Successfully assigned ${successCount} member(s) to ${service.name}.`,
        }),
      });
    } else {
      setStatusNotice({
        type: "error",
        message: `Assigned ${successCount} member(s). ${failedCount} failed.`,
      });
    }
  };

  return (
    <div className="fixed inset-0 z-[120] bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5">
      <div className="bg-white border border-stone-200 rounded-2xl max-w-2xl w-full max-h-[90vh] flex flex-col shadow-2xl overflow-hidden animate-in fade-in-50 zoom-in-95 duration-150">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-stone-100 flex items-start justify-between gap-3 bg-stone-50/80">
          <div className="min-w-0 flex items-start gap-3">
            <div className="p-2.5 rounded-xl bg-teal-50 border border-teal-200 text-teal-800 shrink-0 mt-0.5">
              <Church className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="font-bold text-stone-900 text-base sm:text-lg truncate">
                  {service.name}
                </h3>
                {service.isArchived ? (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-stone-100 text-stone-600 border border-stone-200">
                    <Lock className="w-2.5 h-2.5" />
                    {t("admin.services.archivedBadge", { defaultValue: "Archived" })}
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-teal-50 text-teal-800 border border-teal-200">
                    <CheckCircle2 className="w-2.5 h-2.5 text-teal-600" />
                    {t("admin.services.activeBadge", { defaultValue: "Active" })}
                  </span>
                )}
              </div>
              <p className="text-xs text-stone-500 mt-1">
                {t("admin.services.manageMembersSubtitle", {
                  defaultValue:
                    "Choose members who belong to this service. Assigned members can see and reserve dedicated instruments.",
                })}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-stone-400 hover:text-stone-700 hover:bg-stone-200/50 transition cursor-pointer shrink-0"
            title={t("common.close", { defaultValue: "Close" })}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Archived Warning Banner */}
        {service.isArchived && (
          <div className="mx-4 sm:mx-5 mt-4 p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0 text-amber-700" />
            <span>
              {t("admin.services.archivedWarning", {
                defaultValue:
                  "This service is archived. Restore it before assigning new members.",
              })}
            </span>
          </div>
        )}

        {/* Notice Toast */}
        {statusNotice && (
          <div
            className={`mx-4 sm:mx-5 mt-3 p-3 rounded-xl text-xs flex items-center justify-between gap-2 border ${
              statusNotice.type === "success"
                ? "bg-emerald-50 border-emerald-200 text-emerald-900"
                : "bg-rose-50 border-rose-200 text-rose-900"
            }`}
          >
            <div className="flex items-center gap-2 min-w-0">
              {statusNotice.type === "success" ? (
                <Check className="w-4 h-4 shrink-0 text-emerald-600" />
              ) : (
                <AlertTriangle className="w-4 h-4 shrink-0 text-rose-600" />
              )}
              <span className="truncate">{statusNotice.message}</span>
            </div>
            <button
              type="button"
              onClick={() => setStatusNotice(null)}
              className="text-stone-400 hover:text-stone-600 cursor-pointer p-0.5"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Search, Filter Pills, and Bulk Actions */}
        <div className="p-4 sm:p-5 border-b border-stone-100 space-y-3">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5">
            <div className="relative flex-1">
              <Search className="w-3.5 h-3.5 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2 rtl:left-auto rtl:right-3" />
              <input
                type="text"
                placeholder={t("admin.services.searchMembersPlaceholder", {
                  defaultValue: "Search members by name, email, phone...",
                })}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-8 pr-3 rtl:pl-3 rtl:pr-8 py-1.5 bg-stone-50 border border-stone-200 rounded-xl text-xs text-stone-900 placeholder-stone-400 focus:outline-none focus:border-amber-700 transition"
              />
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch("")}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600 rtl:right-auto rtl:left-2.5 cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Filter Tabs */}
            <div className="flex p-0.5 bg-stone-100 rounded-xl text-xs font-semibold gap-0.5 self-start sm:self-auto shrink-0">
              <button
                type="button"
                onClick={() => setFilterTab("all")}
                className={`py-1 px-2.5 rounded-lg transition cursor-pointer text-[11px] ${
                  filterTab === "all"
                    ? "bg-white text-stone-900 shadow-2xs font-bold"
                    : "text-stone-500 hover:text-stone-900"
                }`}
              >
                {t("admin.services.filterAll", { defaultValue: "All" })} ({users.length})
              </button>
              <button
                type="button"
                onClick={() => setFilterTab("assigned")}
                className={`py-1 px-2.5 rounded-lg transition cursor-pointer text-[11px] ${
                  filterTab === "assigned"
                    ? "bg-white text-teal-900 shadow-2xs font-bold"
                    : "text-stone-500 hover:text-stone-900"
                }`}
              >
                {t("admin.services.filterAssigned", { defaultValue: "Assigned" })} (
                {assignedCount})
              </button>
              <button
                type="button"
                onClick={() => setFilterTab("unassigned")}
                className={`py-1 px-2.5 rounded-lg transition cursor-pointer text-[11px] ${
                  filterTab === "unassigned"
                    ? "bg-white text-stone-900 shadow-2xs font-bold"
                    : "text-stone-500 hover:text-stone-900"
                }`}
              >
                {t("admin.services.filterUnassigned", { defaultValue: "Unassigned" })} (
                {unassignedCount})
              </button>
            </div>
          </div>

          {/* Bulk Assign Bar (when unassigned users are selected) */}
          {selectedUnassignedIds.size > 0 && !service.isArchived && (
            <div className="flex items-center justify-between p-2.5 bg-teal-50 border border-teal-200 rounded-xl animate-in fade-in-50">
              <span className="text-xs font-bold text-teal-900">
                {selectedUnassignedIds.size}{" "}
                {t("admin.services.selectedMembers", {
                  defaultValue: "member(s) selected",
                })}
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setSelectedUnassignedIds(new Set())}
                  className="px-2.5 py-1 text-xs text-stone-600 hover:text-stone-900 cursor-pointer"
                >
                  {t("common.cancel", { defaultValue: "Cancel" })}
                </button>
                <button
                  type="button"
                  onClick={handleBulkAssign}
                  disabled={isBulkAssigning}
                  className="px-3 py-1 bg-teal-800 hover:bg-teal-900 text-white rounded-lg text-xs font-bold transition shadow-xs cursor-pointer inline-flex items-center gap-1.5"
                >
                  {isBulkAssigning ? (
                    <LoadingSpinner />
                  ) : (
                    <>
                      <Plus className="w-3.5 h-3.5" />
                      <span>
                        {t("admin.services.assignSelectedBtn", {
                          defaultValue: "Assign Selected",
                        })}
                      </span>
                    </>
                  )}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Member List */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 divide-y divide-stone-100">
          {loading ? (
            <div className="py-12 flex flex-col items-center justify-center">
              <LoadingSpinner />
            </div>
          ) : error ? (
            <div className="py-8 text-center text-rose-700 text-xs">
              <AlertTriangle className="w-6 h-6 mx-auto mb-2 text-rose-600" />
              <p>{error}</p>
            </div>
          ) : filteredUsers.length === 0 ? (
            <div className="py-12 text-center text-stone-400 text-xs">
              <Users className="w-8 h-8 mx-auto mb-2 opacity-40" />
              <p>
                {search
                  ? t("admin.services.noMatchingMembers", {
                      defaultValue: "No members match your search.",
                    })
                  : filterTab === "assigned"
                    ? t("admin.services.noAssignedYet", {
                        defaultValue:
                          "No members are currently assigned to this service.",
                      })
                    : t("admin.services.allAssigned", {
                        defaultValue: "All active members are already assigned.",
                      })}
              </p>
            </div>
          ) : (
            filteredUsers.map((u) => {
              const rawPhone = u.phoneNumber || "";
              const whatsappNumber = rawPhone
                .replace(/[^\d]/g, "")
                .replace(/^0/, "20");
              const isBusy = actionUserId === u.id;
              const isSelected = selectedUnassignedIds.has(u.id);

              return (
                <div
                  key={u.id}
                  className={`py-3 flex items-center justify-between gap-3 transition ${
                    u.isAssigned
                      ? "bg-white"
                      : isSelected
                        ? "bg-teal-50/50 rounded-xl px-2"
                        : "hover:bg-stone-50/70 rounded-xl px-2"
                  }`}
                >
                  {/* Left: Avatar + Details */}
                  <div className="flex items-center gap-3 min-w-0">
                    {!u.isAssigned && !service.isArchived && (
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleSelectUnassigned(u.id)}
                        className="rounded border-stone-300 text-teal-700 focus:ring-teal-600 w-3.5 h-3.5 cursor-pointer shrink-0"
                      />
                    )}

                    <div
                      className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs shrink-0 ${
                        u.isAssigned
                          ? "bg-teal-100 text-teal-800 border border-teal-200"
                          : "bg-stone-100 text-stone-600 border border-stone-200"
                      }`}
                    >
                      {u.name.charAt(0).toUpperCase()}
                    </div>

                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="font-bold text-xs text-stone-900 truncate">
                          {u.name}
                        </span>
                        {u.isMusician && (
                          <span
                            className="inline-flex items-center gap-0.5 px-1.5 py-0.2 rounded text-[9px] font-bold bg-purple-50 text-purple-800 border border-purple-200 shrink-0"
                            title="Musician"
                          >
                            <Music2 className="w-2.5 h-2.5" />
                            <span>{t("admin.users.musicianRole")}</span>
                          </span>
                        )}
                        {u.isTrusted && (
                          <span
                            className="inline-flex items-center gap-0.5 px-1.5 py-0.2 rounded text-[9px] font-bold bg-amber-50 text-amber-900 border border-amber-200 shrink-0"
                            title="Trusted Member"
                          >
                            <Sparkles className="w-2.5 h-2.5 text-amber-700" />
                            <span>{t("admin.users.trustedMember")}</span>
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-2 text-[11px] text-stone-500 mt-0.5 truncate">
                        {u.email && <span className="truncate">{u.email}</span>}
                        {u.email && rawPhone && <span>•</span>}
                        {rawPhone && (
                          <a
                            href={`https://wa.me/${whatsappNumber}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-emerald-700 hover:underline"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <MessageCircle className="w-3 h-3" />
                            <span>{rawPhone}</span>
                          </a>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Right: Assignment Toggle / Action Button */}
                  <div className="flex items-center gap-2 shrink-0">
                    {u.isAssigned ? (
                      <div className="flex items-center gap-1.5">
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold bg-teal-50 text-teal-800 border border-teal-200">
                          <Check className="w-3.5 h-3.5 text-teal-600" />
                          <span>
                            {t("admin.services.assignedBadge", {
                              defaultValue: "Assigned",
                            })}
                          </span>
                        </span>

                        <button
                          type="button"
                          onClick={() => setUserToRevoke(u)}
                          disabled={isBusy}
                          className="p-1.5 rounded-lg text-stone-400 hover:text-rose-700 hover:bg-rose-50 transition cursor-pointer border border-transparent hover:border-rose-200"
                          title={t("admin.services.revokeBtn", {
                            defaultValue: "Remove member from service",
                          })}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => handleAssignSingle(u)}
                        disabled={isBusy || service.isArchived}
                        className="px-3 py-1 rounded-lg text-xs font-bold transition inline-flex items-center gap-1.5 cursor-pointer bg-stone-100 hover:bg-teal-50 text-stone-700 hover:text-teal-900 border border-stone-200 hover:border-teal-300 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {isBusy ? (
                          <LoadingSpinner />
                        ) : (
                          <>
                            <Plus className="w-3.5 h-3.5 text-stone-500" />
                            <span>
                              {t("admin.services.assignBtn", {
                                defaultValue: "Assign",
                              })}
                            </span>
                          </>
                        )}
                      </button>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="p-3.5 sm:p-4 border-t border-stone-100 bg-stone-50/80 flex items-center justify-between text-xs text-stone-600">
          <div className="flex items-center gap-2 font-semibold">
            <Users className="w-4 h-4 text-stone-500" />
            <span>
              {t("admin.services.membersCountLabel", {
                count: assignedCount,
                defaultValue: `${assignedCount} Assigned`,
              })}
            </span>
            <span className="text-stone-400">•</span>
            <span className="text-stone-500">
              {users.length} {t("admin.services.totalMembers", { defaultValue: "Total Registered" })}
            </span>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 rounded-xl bg-stone-200 hover:bg-stone-300 text-stone-800 text-xs font-bold transition cursor-pointer"
          >
            {t("common.done", { defaultValue: "Done" })}
          </button>
        </div>
      </div>

      {/* Confirmation Modal for Revoking Service */}
      {userToRevoke && (
        <div className="fixed inset-0 z-[130] bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-stone-200 rounded-2xl max-w-md w-full p-5 space-y-4 shadow-2xl animate-in fade-in-50 zoom-in-95">
            <div className="flex items-start gap-3">
              <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 shrink-0">
                <AlertTriangle className="w-5 h-5 text-rose-600" />
              </div>
              <div>
                <h4 className="font-bold text-stone-900 text-sm">
                  {t("admin.services.confirmRevokeTitle", {
                    defaultValue: "Remove Member from Service?",
                  })}
                </h4>
                <p className="text-xs text-stone-600 mt-1.5 leading-relaxed">
                  {t("admin.services.confirmRevokeDesc", {
                    name: userToRevoke.name,
                    defaultValue: `Removing ${userToRevoke.name} will immediately revoke their access to instruments belonging to ${service.name} and cancel any of their future pending or approved reservations on those instruments.`,
                  })}
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-stone-100">
              <button
                type="button"
                onClick={() => setUserToRevoke(null)}
                disabled={isRevoking}
                className="px-3.5 py-1.5 rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-700 text-xs font-semibold cursor-pointer"
              >
                {t("common.cancel", { defaultValue: "Cancel" })}
              </button>
              <button
                type="button"
                onClick={handleConfirmRevoke}
                disabled={isRevoking}
                className="px-4 py-1.5 rounded-xl bg-rose-700 hover:bg-rose-800 disabled:opacity-50 text-white text-xs font-bold cursor-pointer inline-flex items-center gap-1.5 shadow-2xs"
              >
                {isRevoking ? (
                  <LoadingSpinner />
                ) : (
                  <>
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>
                      {t("admin.services.revokeBtn", {
                        defaultValue: "Remove Member",
                      })}
                    </span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
