import React, { useState, useEffect, useMemo } from "react";
import { useTranslation } from "react-i18next";
import {
  Plus,
  Search,
  Archive,
  RotateCcw,
  Trash2,
  Edit2,
  RefreshCw,
  Users,
  Music2,
  AlertTriangle,
  X,
  CheckCircle2,
} from "lucide-react";
import { adminFetch } from "../../../lib/auth-helpers";
import { LoadingSpinner } from "../../shared/LoadingSpinner";
import { EmptyStateCard } from "../../shared/EmptyStateCard";
import { ServiceUsersModal } from "../ServiceUsersModal";

export interface ServiceItem {
  id: string;
  name: string;
  isArchived: boolean;
  createdAt: string;
  membersCount: number;
  instrumentsCount: number;
}

export interface ServicesTabProps {
  onServiceUpdated?: () => void;
  onOpenUserProfile: (userId: string) => void;
}

export const ServicesTab: React.FC<ServicesTabProps> = ({
  onServiceUpdated,
  onOpenUserProfile,
}) => {
  const { t } = useTranslation();

  const [services, setServices] = useState<ServiceItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [search, setSearch] = useState<string>("");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "archived">("all");

  // Create Service Modal
  const [showCreateModal, setShowCreateModal] = useState<boolean>(false);
  const [newServiceName, setNewServiceName] = useState<string>("");
  const [creating, setCreating] = useState<boolean>(false);
  const [createError, setCreateError] = useState<string | null>(null);

  // Rename Service Modal
  const [editingService, setEditingService] = useState<ServiceItem | null>(null);
  const [editName, setEditName] = useState<string>("");
  const [renaming, setRenaming] = useState<boolean>(false);
  const [renameError, setRenameError] = useState<string | null>(null);

  // Confirmation Modal (for Archive, Restore, Delete)
  const [confirmAction, setConfirmAction] = useState<{
    type: "archive" | "restore" | "delete";
    service: ServiceItem;
  } | null>(null);
  const [actionLoading, setActionLoading] = useState<boolean>(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  // Service Users Assignment Modal
  const [selectedServiceForUsers, setSelectedServiceForUsers] =
    useState<ServiceItem | null>(null);

  const fetchServices = async () => {
    setLoading(true);
    try {
      const res = await adminFetch("/services");
      const data = await res.json();
      if (data.success && Array.isArray(data.services)) {
        setServices(data.services);
      }
    } catch (err: any) {
      console.error("Failed to load services:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchServices();
  }, []);

  const filteredServices = useMemo(() => {
    return services.filter((srv) => {
      if (statusFilter === "active" && srv.isArchived) return false;
      if (statusFilter === "archived" && !srv.isArchived) return false;
      if (search.trim()) {
        const term = search.trim().toLowerCase();
        return srv.name.toLowerCase().includes(term);
      }
      return true;
    });
  }, [services, search, statusFilter]);

  const handleCreateService = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newServiceName.trim()) return;
    setCreating(true);
    setCreateError(null);
    try {
      const res = await adminFetch("/services", {
        method: "POST",
        body: JSON.stringify({ name: newServiceName.trim() }),
      });
      const data = await res.json();
      if (data.success) {
        setShowCreateModal(false);
        setNewServiceName("");
        fetchServices();
        if (onServiceUpdated) onServiceUpdated();
      } else {
        setCreateError(data.error || t("admin.services.createError", { defaultValue: "Failed to create service" }));
      }
    } catch (err: any) {
      setCreateError(err.message || t("admin.services.createError", { defaultValue: "Failed to create service" }));
    } finally {
      setCreating(false);
    }
  };

  const handleRenameService = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingService || !editName.trim()) return;
    setRenaming(true);
    setRenameError(null);
    try {
      const res = await adminFetch(`/services/${editingService.id}`, {
        method: "PUT",
        body: JSON.stringify({ name: editName.trim() }),
      });
      const data = await res.json();
      if (data.success) {
        setEditingService(null);
        fetchServices();
        if (onServiceUpdated) onServiceUpdated();
      } else {
        setRenameError(data.error || t("admin.services.renameError", { defaultValue: "Failed to rename service" }));
      }
    } catch (err: any) {
      setRenameError(err.message || t("admin.services.renameError", { defaultValue: "Failed to rename service" }));
    } finally {
      setRenaming(false);
    }
  };

  const handleExecuteAction = async () => {
    if (!confirmAction) return;
    setActionLoading(true);
    setActionError(null);
    setActionSuccess(null);
    const { type, service } = confirmAction;

    try {
      let endpoint = "";
      let method = "POST";

      if (type === "archive") {
        endpoint = `/services/${service.id}/archive`;
      } else if (type === "restore") {
        endpoint = `/services/${service.id}/restore`;
      } else if (type === "delete") {
        endpoint = `/services/${service.id}`;
        method = "DELETE";
      }

      const res = await adminFetch(endpoint, { method });
      const data = await res.json();

      if (data.success) {
        setConfirmAction(null);
        fetchServices();
        if (onServiceUpdated) onServiceUpdated();
      } else {
        setActionError(data.error || "Operation failed.");
      }
    } catch (err: any) {
      setActionError(err.message || "Operation failed.");
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <div className="bg-white border border-stone-200 rounded-2xl p-4 sm:p-5 shadow-2xs space-y-4">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-stone-100 pb-4">
        <div>
          <h2 className="text-base font-bold text-stone-900">
            {t("admin.services.title", { defaultValue: "Services Management" })}
          </h2>
          <p className="text-xs text-stone-500 mt-0.5">
            {t("admin.services.subtitle", {
              defaultValue: "Manage ministry services and control visibility for service-specific instruments.",
            })}
          </p>
        </div>

        <button
          type="button"
          onClick={() => {
            setNewServiceName("");
            setCreateError(null);
            setShowCreateModal(true);
          }}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-amber-800 hover:bg-amber-900 text-white rounded-xl text-xs font-bold transition shadow-xs cursor-pointer self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" />
          <span>{t("admin.services.newServiceBtn", { defaultValue: "New Service" })}</span>
        </button>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="w-4 h-4 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2 rtl:left-auto rtl:right-3" />
          <input
            type="text"
            placeholder={t("admin.services.searchPlaceholder", { defaultValue: "Search services..." })}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 rtl:pl-3 rtl:pr-9 py-2 bg-stone-50 border border-stone-200 rounded-xl text-xs text-stone-800 placeholder-stone-400 focus:outline-none focus:border-amber-700 transition"
          />
          {search && (
            <button
              onClick={() => setSearch("")}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600 rtl:right-auto rtl:left-2.5 cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Status filter pills */}
        <div className="flex p-1 bg-stone-100 rounded-xl text-xs font-semibold gap-1 self-start sm:self-auto shrink-0">
          <button
            type="button"
            onClick={() => setStatusFilter("all")}
            className={`py-1.5 px-3 rounded-lg transition cursor-pointer ${
              statusFilter === "all"
                ? "bg-white text-stone-900 shadow-2xs font-bold"
                : "text-stone-500 hover:text-stone-900"
            }`}
          >
            {t("common.all", { defaultValue: "All" })} ({services.length})
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter("active")}
            className={`py-1.5 px-3 rounded-lg transition cursor-pointer ${
              statusFilter === "active"
                ? "bg-white text-emerald-900 shadow-2xs font-bold"
                : "text-stone-500 hover:text-stone-900"
            }`}
          >
            {t("admin.services.statusActive", { defaultValue: "Active" })} (
            {services.filter((s) => !s.isArchived).length})
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter("archived")}
            className={`py-1.5 px-3 rounded-lg transition cursor-pointer ${
              statusFilter === "archived"
                ? "bg-white text-stone-900 shadow-2xs font-bold"
                : "text-stone-500 hover:text-stone-900"
            }`}
          >
            {t("admin.services.statusArchived", { defaultValue: "Archived" })} (
            {services.filter((s) => s.isArchived).length})
          </button>
        </div>
      </div>

      {/* Services Table or Empty */}
      {loading ? (
        <div className="py-16 flex flex-col items-center justify-center">
          <LoadingSpinner />
        </div>
      ) : filteredServices.length === 0 ? (
        <EmptyStateCard
          title={t("admin.services.noServicesTitle", { defaultValue: "No services found" })}
          description={
            search || statusFilter !== "all"
              ? t("admin.services.noMatchingServices", { defaultValue: "No services match the selected filter." })
              : t("admin.services.emptyDescription", {
                  defaultValue: "Create your first church service to assign dedicated instruments and members.",
                })
          }
        />
      ) : (
        <div className="overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0">
          <table className="w-full text-left text-xs border-collapse min-w-[600px]">
            <thead>
              <tr className="border-b border-stone-200 bg-stone-50/80 text-[11px] font-bold text-stone-600">
                <th className="py-2.5 px-3">{t("admin.services.colName", { defaultValue: "Service Name" })}</th>
                <th className="py-2.5 px-3">{t("admin.services.colStatus", { defaultValue: "Status" })}</th>
                <th className="py-2.5 px-3">{t("admin.services.colMembers", { defaultValue: "Assigned Members" })}</th>
                <th className="py-2.5 px-3">{t("admin.services.colInstruments", { defaultValue: "Instruments" })}</th>
                <th className="py-2.5 px-3 text-right rtl:text-left">
                  {t("common.actions", { defaultValue: "Actions" })}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {filteredServices.map((srv) => (
                <tr key={srv.id} className="hover:bg-stone-50/60 transition">
                  <td className="py-3 px-3">
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setSelectedServiceForUsers(srv)}
                        className="font-bold text-stone-900 hover:text-amber-900 hover:underline text-xs sm:text-sm cursor-pointer flex items-center gap-1.5 group text-left rtl:text-right"
                        title={t("admin.services.manageUsersTooltip", {
                          defaultValue: "Click to choose users to assign to this service",
                        })}
                      >
                        <span>{srv.name}</span>
                        <Users className="w-3.5 h-3.5 text-stone-400 group-hover:text-amber-800 transition shrink-0" />
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setEditingService(srv);
                          setEditName(srv.name);
                          setRenameError(null);
                        }}
                        className="text-stone-400 hover:text-amber-800 transition p-1 cursor-pointer"
                        title={t("admin.services.renameBtn", { defaultValue: "Rename Service" })}
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>

                  <td className="py-3 px-3">
                    {srv.isArchived ? (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-stone-100 text-stone-600 border border-stone-200">
                        <Archive className="w-3 h-3" />
                        {t("admin.services.archivedBadge", { defaultValue: "Archived" })}
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-emerald-100 text-emerald-900 border border-emerald-200">
                        <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                        {t("admin.services.activeBadge", { defaultValue: "Active" })}
                      </span>
                    )}
                  </td>

                  <td className="py-3 px-3">
                    <button
                      type="button"
                      onClick={() => setSelectedServiceForUsers(srv)}
                      className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-lg text-stone-700 hover:text-teal-900 hover:bg-teal-50 font-semibold cursor-pointer transition border border-transparent hover:border-teal-200"
                      title={t("admin.services.manageUsersTooltip", {
                        defaultValue: "Click to choose users to assign to this service",
                      })}
                    >
                      <Users className="w-3.5 h-3.5 text-stone-400 group-hover:text-teal-600" />
                      <span>{srv.membersCount}</span>
                    </button>
                  </td>

                  <td className="py-3 px-3">
                    <span className="inline-flex items-center gap-1.5 text-stone-700 font-semibold">
                      <Music2 className="w-3.5 h-3.5 text-stone-400" />
                      <span>{srv.instrumentsCount}</span>
                    </span>
                  </td>

                  <td className="py-3 px-3 text-right rtl:text-left">
                    <div className="inline-flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => setSelectedServiceForUsers(srv)}
                        className="px-2.5 py-1 rounded-lg bg-teal-50 hover:bg-teal-100 text-teal-800 font-semibold text-[11px] border border-teal-200 transition inline-flex items-center gap-1 cursor-pointer"
                        title={t("admin.services.manageUsersTooltip", {
                          defaultValue: "Click to choose users to assign to this service",
                        })}
                      >
                        <Users className="w-3 h-3" />
                        <span>{t("admin.services.manageMembersBtn", { defaultValue: "Members" })}</span>
                      </button>

                      {srv.isArchived ? (
                        <button
                          type="button"
                          onClick={() => {
                            setActionError(null);
                            setConfirmAction({ type: "restore", service: srv });
                          }}
                          className="px-2.5 py-1 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-800 font-semibold text-[11px] border border-emerald-200 transition inline-flex items-center gap-1 cursor-pointer"
                        >
                          <RotateCcw className="w-3 h-3" />
                          <span>{t("admin.services.restoreBtn", { defaultValue: "Restore" })}</span>
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => {
                            setActionError(null);
                            setConfirmAction({ type: "archive", service: srv });
                          }}
                          className="px-2.5 py-1 rounded-lg bg-stone-100 hover:bg-stone-200 text-stone-700 font-semibold text-[11px] border border-stone-200 transition inline-flex items-center gap-1 cursor-pointer"
                        >
                          <Archive className="w-3 h-3" />
                          <span>{t("admin.services.archiveBtn", { defaultValue: "Archive" })}</span>
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={() => {
                          setActionError(null);
                          setConfirmAction({ type: "delete", service: srv });
                        }}
                        className="px-2.5 py-1 rounded-lg bg-red-50 hover:bg-red-100 text-red-700 font-semibold text-[11px] border border-red-200 transition inline-flex items-center gap-1 cursor-pointer"
                        title={t("admin.services.deleteBtn", { defaultValue: "Delete Service" })}
                      >
                        <Trash2 className="w-3 h-3" />
                        <span>{t("common.delete", { defaultValue: "Delete" })}</span>
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal 1: Create Service */}
      {showCreateModal && (
        <div className="fixed inset-0 z-[120] bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-stone-200 rounded-2xl max-w-md w-full p-5 space-y-4 shadow-xl">
            <div className="flex items-center justify-between border-b border-stone-100 pb-3">
              <h3 className="font-bold text-stone-900 text-sm">
                {t("admin.services.createTitle", { defaultValue: "Create New Service" })}
              </h3>
              <button
                onClick={() => setShowCreateModal(false)}
                className="text-stone-400 hover:text-stone-600 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateService} className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-stone-700 mb-1">
                  {t("admin.services.nameLabel", { defaultValue: "Service Name" })}
                </label>
                <input
                  type="text"
                  required
                  placeholder={t("admin.services.namePlaceholder", { defaultValue: "e.g. Youth Ministry, Choir, Sunday School" })}
                  value={newServiceName}
                  onChange={(e) => setNewServiceName(e.target.value)}
                  className="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-xl text-xs text-stone-900 focus:outline-none focus:border-amber-700"
                  autoFocus
                />
              </div>

              {createError && (
                <div className="p-2.5 rounded-xl bg-red-50 border border-red-200 text-red-800 text-xs flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0 text-red-600" />
                  <span>{createError}</span>
                </div>
              )}

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-3.5 py-2 rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-700 text-xs font-semibold cursor-pointer"
                >
                  {t("common.cancel", { defaultValue: "Cancel" })}
                </button>
                <button
                  type="submit"
                  disabled={creating || !newServiceName.trim()}
                  className="px-4 py-2 rounded-xl bg-amber-800 hover:bg-amber-900 disabled:opacity-50 text-white text-xs font-bold cursor-pointer inline-flex items-center gap-1.5"
                >
                  {creating && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                  <span>{t("common.create", { defaultValue: "Create" })}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal 2: Rename Service */}
      {editingService && (
        <div className="fixed inset-0 z-[120] bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-stone-200 rounded-2xl max-w-md w-full p-5 space-y-4 shadow-xl">
            <div className="flex items-center justify-between border-b border-stone-100 pb-3">
              <h3 className="font-bold text-stone-900 text-sm">
                {t("admin.services.renameTitle", { defaultValue: "Rename Service" })}
              </h3>
              <button
                onClick={() => setEditingService(null)}
                className="text-stone-400 hover:text-stone-600 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleRenameService} className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-stone-700 mb-1">
                  {t("admin.services.nameLabel", { defaultValue: "Service Name" })}
                </label>
                <input
                  type="text"
                  required
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-xl text-xs text-stone-900 focus:outline-none focus:border-amber-700"
                  autoFocus
                />
              </div>

              {renameError && (
                <div className="p-2.5 rounded-xl bg-red-50 border border-red-200 text-red-800 text-xs flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0 text-red-600" />
                  <span>{renameError}</span>
                </div>
              )}

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setEditingService(null)}
                  className="px-3.5 py-2 rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-700 text-xs font-semibold cursor-pointer"
                >
                  {t("common.cancel", { defaultValue: "Cancel" })}
                </button>
                <button
                  type="submit"
                  disabled={renaming || !editName.trim()}
                  className="px-4 py-2 rounded-xl bg-amber-800 hover:bg-amber-900 disabled:opacity-50 text-white text-xs font-bold cursor-pointer inline-flex items-center gap-1.5"
                >
                  {renaming && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                  <span>{t("common.save", { defaultValue: "Save" })}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal 3: Confirm Action Modal (Archive / Restore / Delete) */}
      {confirmAction && (
        <div className="fixed inset-0 z-[120] bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-stone-200 rounded-2xl max-w-md w-full p-5 space-y-4 shadow-xl">
            <div className="flex items-center gap-3">
              <div
                className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                  confirmAction.type === "delete"
                    ? "bg-red-100 text-red-700"
                    : confirmAction.type === "archive"
                      ? "bg-amber-100 text-amber-800"
                      : "bg-emerald-100 text-emerald-800"
                }`}
              >
                {confirmAction.type === "delete" ? (
                  <Trash2 className="w-5 h-5" />
                ) : confirmAction.type === "archive" ? (
                  <Archive className="w-5 h-5" />
                ) : (
                  <RotateCcw className="w-5 h-5" />
                )}
              </div>
              <div>
                <h3 className="font-bold text-stone-900 text-sm">
                  {confirmAction.type === "delete"
                    ? t("admin.services.confirmDeleteTitle", { defaultValue: "Delete Service" })
                    : confirmAction.type === "archive"
                      ? t("admin.services.confirmArchiveTitle", { defaultValue: "Archive Service" })
                      : t("admin.services.confirmRestoreTitle", { defaultValue: "Restore Service" })}
                </h3>
                <p className="text-xs text-stone-500 font-medium">{confirmAction.service.name}</p>
              </div>
            </div>

            <div className="text-xs text-stone-600 space-y-2 leading-relaxed">
              {confirmAction.type === "delete" && (
                <p>
                  {t("admin.services.deleteWarning", {
                    defaultValue:
                      "A service can only be deleted if it has 0 assigned members and 0 linked instruments. If any exist, deletion will be blocked.",
                  })}
                </p>
              )}
              {confirmAction.type === "archive" && (
                <p>
                  {t("admin.services.archiveWarning", {
                    defaultValue:
                      "Archiving this service will block new user assignments and hide its instruments from booking. Existing reservations remain valid.",
                  })}
                </p>
              )}
              {confirmAction.type === "restore" && (
                <p>
                  {t("admin.services.restoreNotice", {
                    defaultValue:
                      "Restoring this service will re-enable bookings on its instruments for assigned members.",
                  })}
                </p>
              )}
            </div>

            {actionError && (
              <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-800 text-xs flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0 text-red-600 mt-0.5" />
                <span className="leading-snug">{actionError}</span>
              </div>
            )}

            <div className="pt-2 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setConfirmAction(null)}
                className="px-3.5 py-2 rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-700 text-xs font-semibold cursor-pointer"
              >
                {t("common.cancel", { defaultValue: "Cancel" })}
              </button>
              <button
                type="button"
                disabled={actionLoading}
                onClick={handleExecuteAction}
                className={`px-4 py-2 rounded-xl text-white text-xs font-bold cursor-pointer inline-flex items-center gap-1.5 ${
                  confirmAction.type === "delete"
                    ? "bg-red-600 hover:bg-red-700"
                    : confirmAction.type === "archive"
                      ? "bg-stone-800 hover:bg-stone-900"
                      : "bg-emerald-700 hover:bg-emerald-800"
                }`}
              >
                {actionLoading && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                <span>
                  {confirmAction.type === "delete"
                    ? t("common.delete", { defaultValue: "Delete" })
                    : confirmAction.type === "archive"
                      ? t("admin.services.archiveBtn", { defaultValue: "Archive" })
                      : t("admin.services.restoreBtn", { defaultValue: "Restore" })}
                </span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal 4: Manage Service Users Assignment */}
      <ServiceUsersModal
        isOpen={Boolean(selectedServiceForUsers)}
        service={selectedServiceForUsers}
        onClose={() => setSelectedServiceForUsers(null)}
        onOpenUserProfile={onOpenUserProfile}
        onUpdated={() => {
          fetchServices();
          if (onServiceUpdated) onServiceUpdated();
        }}
      />
    </div>
  );
};
