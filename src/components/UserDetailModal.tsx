import React, { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import {
  X,
  User,
  Phone,
  Calendar,
  Shield,
  Sparkles,
  AlertTriangle,
  Clock,
  Music2,
  ExternalLink,
  MessageSquare,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Layers,
  ChevronRight,
} from "lucide-react";
import {
  formatDisplayDate,
  formatHhmmTo12Hour,
  getCairoDateString,
  getCairoTimeString,
} from "../lib/date-utils";
import { ErrorBoundary } from "./ErrorBoundary";

export interface UserDetailModalProps {
  userId: string | null;
  isOpen: boolean;
  onClose: () => void;
  onSelectReservation: (reservationId: string) => void;
  isSuperAdmin?: boolean;
  sessionToken?: string | null;
  onUserUpdated?: () => void;
  zIndexClass?: string;
}

type StatTone = "default" | "danger" | "ok";

const UserDetailModalInner: React.FC<UserDetailModalProps> = ({
  userId,
  isOpen,
  onClose,
  onSelectReservation,
  isSuperAdmin = false,
  sessionToken,
  onUserUpdated,
  zIndexClass = "z-50",
}) => {
  const { t } = useTranslation();

  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [userData, setUserData] = useState<any | null>(null);
  const [standing, setStanding] = useState<any | null>(null);
  const [reservations, setReservations] = useState<any[]>([]);
  const [messages, setMessages] = useState<any[]>([]);
  const [isTogglingTrust, setIsTogglingTrust] = useState<boolean>(false);
  const [confirmToggleTrust, setConfirmToggleTrust] = useState<boolean>(false);

  useEffect(() => {
    if (!isOpen || !userId) {
      setUserData(null);
      setError(null);
      return;
    }

    const fetchUserProfile = async () => {
      setLoading(true);
      setError(null);
      try {
        const token =
          sessionToken ||
          localStorage.getItem("admin_session_token") ||
          localStorage.getItem("auth_token") ||
          "";

        const res = await fetch(`/api/admin/users/${userId}/profile`, {
          headers: {
            "Content-Type": "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
        });

        const data = await res.json();
        if (data.success) {
          setUserData(data.user);
          setStanding(data.standing);
          setReservations(data.reservations || []);
          setMessages(data.messages || []);
        } else {
          setError(data.error || t("admin.userDetail.notFound"));
        }
      } catch (err: any) {
        setError(err.message || "Failed to load user profile");
      } finally {
        setLoading(false);
      }
    };

    fetchUserProfile();
  }, [isOpen, userId, sessionToken]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen || !userId) return null;

  const handleToggleTrusted = async () => {
    if (!userData || !isSuperAdmin) return;
    setIsTogglingTrust(true);
    try {
      const token =
        sessionToken ||
        localStorage.getItem("admin_session_token") ||
        localStorage.getItem("auth_token") ||
        "";

      const targetStatus = !userData.isTrusted;
      const res = await fetch(
        `/api/admin/users/${userData.id}/trusted-status`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({ isTrusted: targetStatus }),
        },
      );

      const data = await res.json();
      if (data.success) {
        setUserData((prev: any) => ({
          ...prev,
          isTrusted: targetStatus,
        }));
        setConfirmToggleTrust(false);
        if (onUserUpdated) onUserUpdated();
      } else {
        alert(data.error || "Failed to update trusted status");
      }
    } catch (err: any) {
      alert(err.message || "Failed to update trusted status");
    } finally {
      setIsTogglingTrust(false);
    }
  };

  const safeReservations = Array.isArray(reservations) ? reservations : [];
  const safeMessages = Array.isArray(messages) ? messages : [];

  const timelineItems = [
    ...safeReservations.map((r) => {
      const rawDate = r.created_at || r.start_time;
      const ts = rawDate
        ? new Date(String(rawDate).replace(" ", "T")).getTime()
        : 0;
      return {
        itemType: "reservation" as const,
        id: r.id,
        timestamp: isNaN(ts) ? 0 : ts,
        data: r,
      };
    }),
    ...safeMessages.map((m) => {
      const ts = m.created_at
        ? new Date(String(m.created_at).replace(" ", "T")).getTime()
        : 0;
      return {
        itemType: "message" as const,
        id: m.id,
        timestamp: isNaN(ts) ? 0 : ts,
        data: m,
      };
    }),
  ].sort((a, b) => b.timestamp - a.timestamp);

  const getStatusBadge = (status: string, isNoShow?: boolean) => {
    if (isNoShow) {
      return (
        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800 border border-rose-200 flex items-center gap-1">
          <AlertCircle className="w-3 h-3 text-rose-700" />
          <span>{t("common.noShow") || "No-Show"}</span>
        </span>
      );
    }

    switch (status) {
      case "approved":
        return (
          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200 flex items-center gap-1">
            <CheckCircle2 className="w-3 h-3 text-emerald-700" />
            <span>{t("common.approved")}</span>
          </span>
        );
      case "pending":
        return (
          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-200 flex items-center gap-1">
            <Clock className="w-3 h-3 text-amber-700" />
            <span>{t("common.pending")}</span>
          </span>
        );
      case "completed":
        return (
          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-stone-100 text-stone-700 border border-stone-200">
            {t("common.completed") || "Completed"}
          </span>
        );
      case "ongoing":
        return (
          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-sky-100 text-sky-800 border border-sky-200">
            {t("common.ongoing") || "In Progress"}
          </span>
        );
      case "rejected":
        return (
          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200 flex items-center gap-1">
            <XCircle className="w-3 h-3 text-rose-600" />
            <span>{t("common.rejected")}</span>
          </span>
        );
      case "expired":
        return (
          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-stone-100 text-stone-500 border border-stone-200">
            {t("common.expired") || "Expired"}
          </span>
        );
      case "cancelled":
        return (
          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-stone-100 text-stone-500 border border-stone-200">
            {t("common.cancelled")}
          </span>
        );
      default:
        return (
          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-stone-100 text-stone-600 border border-stone-200">
            {status}
          </span>
        );
    }
  };

  const getAccountStatusBadge = (isActive: boolean, approvalStatus: string) => {
    if (approvalStatus === "pending") {
      return (
        <span className="px-2 py-0.5 rounded-md text-[11px] font-semibold bg-amber-50 text-amber-800 border border-amber-200">
          {t("admin.users.pendingApproval")}
        </span>
      );
    }
    if (approvalStatus === "rejected") {
      return (
        <span className="px-2 py-0.5 rounded-md text-[11px] font-semibold bg-rose-50 text-rose-700 border border-rose-200">
          {t("admin.users.rejected")}
        </span>
      );
    }
    if (!isActive) {
      return (
        <span className="px-2 py-0.5 rounded-md text-[11px] font-semibold bg-stone-100 text-stone-600 border border-stone-200">
          {t("admin.users.deactivated")}
        </span>
      );
    }
    return (
      <span className="px-2 py-0.5 rounded-md text-[11px] font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200">
        {t("admin.users.active")}
      </span>
    );
  };

  // Compact stat card — number carries the meaning, no repeated caption line.
  const renderStatCard = (
    label: string,
    current: number,
    max?: number,
    tone: StatTone = "default",
  ) => (
    <div
      key={label}
      className={`p-2.5 rounded-xl border ${
        tone === "danger"
          ? "bg-rose-50 border-rose-200"
          : "bg-white border-stone-200"
      }`}
    >
      <div className="text-[10px] font-semibold text-stone-500 truncate">
        {label}
      </div>
      <div
        className={`text-lg font-extrabold leading-tight ${
          tone === "danger"
            ? "text-rose-700"
            : tone === "ok"
              ? "text-emerald-700"
              : "text-stone-900"
        }`}
      >
        {current}
        {max !== undefined && (
          <span className="text-xs text-stone-400 font-normal">/{max}</span>
        )}
      </div>
    </div>
  );

  const noShowCount = Number(standing?.noShowCount || 0);

  return (
    <div
      className={`fixed inset-0 ${zIndexClass} flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs overflow-y-auto`}
      role="dialog"
      aria-modal="true"
      aria-labelledby="user-detail-title"
    >
      <div className="fixed inset-0" onClick={onClose} aria-hidden="true" />

      <div
        className="relative bg-white rounded-3xl shadow-2xl border border-stone-200 w-full max-w-2xl my-8 z-10 flex flex-col max-h-[90vh] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header Bar */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-stone-200 bg-stone-50/70">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-amber-100 text-amber-800 flex items-center justify-center font-bold shrink-0">
              <User className="w-4 h-4" />
            </div>
            <h2
              id="user-detail-title"
              className="text-base font-bold text-stone-900"
            >
              {t("admin.userDetail.title")}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl text-stone-400 hover:text-stone-700 hover:bg-stone-200/60 transition cursor-pointer"
            aria-label={t("admin.userDetail.close")}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-4 sm:p-5 overflow-y-auto space-y-4">
          {loading && (
            <div className="py-16 text-center text-stone-500">
              <div className="w-8 h-8 border-2 border-amber-800 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
              <p className="text-sm font-medium">
                {t("admin.userDetail.loading")}
              </p>
            </div>
          )}

          {error && !loading && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 shrink-0 text-rose-600" />
              <span className="text-sm font-medium">{error}</span>
            </div>
          )}

          {!loading && userData && (
            <>
              {/* Profile Card Header */}
              <div className="bg-stone-50/70 border border-stone-200 rounded-2xl p-3.5 space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <h3 className="text-base font-extrabold text-stone-900 truncate">
                      {userData.name}
                    </h3>
                    <div className="flex items-center gap-3 mt-0.5 text-[11px] text-stone-500 font-mono flex-wrap">
                      {userData.email && <span>{userData.email}</span>}
                      {userData.phoneNumber && (
                        <span className="flex items-center gap-1">
                          <Phone className="w-3 h-3 text-stone-400" />
                          {userData.phoneNumber}
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-stone-400 mt-1">
                      {t("admin.userDetail.memberSince", {
                        date: userData.createdAt
                          ? formatDisplayDate(
                              getCairoDateString(userData.createdAt),
                            )
                          : "",
                      })}
                    </p>
                  </div>
                  <div className="shrink-0">
                    {getAccountStatusBadge(
                      userData.isActive,
                      userData.approvalStatus,
                    )}
                  </div>
                </div>

                {/* Trusted Status Row */}
                <div className="flex items-center justify-between gap-2 bg-white p-2.5 rounded-xl border border-stone-200">
                  <div className="flex items-center gap-2">
                    {userData.isTrusted ? (
                      <Sparkles className="w-4 h-4 text-amber-800 shrink-0" />
                    ) : (
                      <Shield className="w-4 h-4 text-stone-400 shrink-0" />
                    )}
                    <span className="text-sm font-bold text-stone-900">
                      {userData.isTrusted
                        ? t("admin.userDetail.trustedBadge")
                        : t("admin.userDetail.standardBadge")}
                    </span>
                  </div>

                  {isSuperAdmin ? (
                    !confirmToggleTrust ? (
                      <button
                        type="button"
                        onClick={() => setConfirmToggleTrust(true)}
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition cursor-pointer shrink-0 ${
                          userData.isTrusted
                            ? "bg-stone-50 hover:bg-stone-100 text-stone-700 border-stone-300"
                            : "bg-amber-800 hover:bg-amber-900 text-white border-amber-800 shadow-2xs"
                        }`}
                      >
                        {userData.isTrusted
                          ? t("admin.userDetail.revokeTrusted")
                          : t("admin.userDetail.grantTrusted")}
                      </button>
                    ) : (
                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          type="button"
                          onClick={() => setConfirmToggleTrust(false)}
                          className="px-2 py-1 rounded-lg text-xs font-medium text-stone-600 hover:bg-stone-100 cursor-pointer"
                        >
                          {t("common.cancel")}
                        </button>
                        <button
                          type="button"
                          onClick={handleToggleTrusted}
                          disabled={isTogglingTrust}
                          className={`px-3 py-1 rounded-lg text-xs font-bold text-white transition cursor-pointer ${
                            userData.isTrusted
                              ? "bg-rose-700 hover:bg-rose-800"
                              : "bg-amber-800 hover:bg-amber-900"
                          }`}
                        >
                          {isTogglingTrust ? "..." : t("common.confirm")}
                        </button>
                      </div>
                    )
                  ) : (
                    <span className="text-xs text-stone-400 font-medium shrink-0">
                      {userData.isTrusted
                        ? t("admin.userDetail.trustedBadge")
                        : t("admin.userDetail.standardBadge")}
                    </span>
                  )}
                </div>
              </div>

              {/* Standing & Limits Summary */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-bold text-stone-900 flex items-center gap-1.5">
                    <Layers className="w-4 h-4 text-amber-800" />
                    <span>{t("admin.userDetail.standingTitle")}</span>
                  </h4>
                  {standing?.bypassHardLimits && (
                    <span className="text-[10px] font-medium text-amber-800 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                      {t("admin.userDetail.bypassedNote")}
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {renderStatCard(
                    t("admin.userDetail.noShows"),
                    noShowCount,
                    undefined,
                    noShowCount > 0 ? "danger" : "ok",
                  )}
                  {renderStatCard(
                    t("admin.userDetail.activeReservations"),
                    standing?.activeReservations?.current ?? 0,
                    standing?.activeReservations?.max ?? 5,
                  )}
                  {renderStatCard(
                    t("admin.userDetail.todayBookings"),
                    standing?.todayReservations?.current ?? 0,
                    standing?.todayReservations?.max ?? 5,
                  )}
                  {renderStatCard(
                    t("admin.userDetail.hourlySubmissions"),
                    standing?.hourlySubmissions?.current ?? 0,
                    standing?.hourlySubmissions?.max ?? 10,
                  )}
                </div>
              </div>

              {/* Merged Activity & History Timeline */}
              <div className="space-y-2 pt-1">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-bold text-stone-900 flex items-center gap-1.5">
                    <Clock className="w-4 h-4 text-amber-800" />
                    <span>{t("admin.userDetail.timelineTitle")}</span>
                  </h4>
                  <span className="text-xs text-stone-400 font-medium">
                    {timelineItems.length}{" "}
                    {timelineItems.length === 1 ? "item" : "items"}
                  </span>
                </div>

                {timelineItems.length === 0 ? (
                  <div className="p-6 text-center bg-stone-50/60 rounded-2xl border border-dashed border-stone-200 text-stone-500">
                    <Calendar className="w-7 h-7 text-stone-300 mx-auto mb-2" />
                    <p className="text-sm font-medium text-stone-600">
                      {t("admin.userDetail.emptyTimeline")}
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {timelineItems.map((item) => {
                      if (item.itemType === "reservation") {
                        const res = item.data;
                        return (
                          <div
                            key={`res-${res.id}`}
                            onClick={() => onSelectReservation(res.id)}
                            className="bg-white border border-stone-200 hover:border-amber-400 hover:shadow-xs hover:bg-amber-50/15 rounded-2xl p-3 transition cursor-pointer group text-left"
                            role="button"
                            tabIndex={0}
                            title={
                              t("admin.userDetail.clickToOpen") ||
                              "Click to view full reservation details"
                            }
                          >
                            <div className="flex items-start justify-between gap-2">
                              <div className="space-y-1 min-w-0">
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <span className="font-bold text-stone-900 group-hover:text-amber-900 transition text-sm truncate">
                                    {res.service_name}
                                  </span>
                                  <span className="px-1.5 py-0.5 rounded-full text-[9px] font-semibold bg-stone-100 text-stone-600">
                                    {res.reservation_type === "outside_church"
                                      ? t("common.outsideChurch")
                                      : t("common.inChurch")}
                                  </span>
                                  {res.series_id && (
                                    <span className="px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-amber-50 text-amber-800 border border-amber-200">
                                      Series
                                    </span>
                                  )}
                                </div>

                                <div className="flex items-center gap-1.5 text-xs text-stone-600">
                                  <Music2 className="w-3.5 h-3.5 text-stone-400 shrink-0" />
                                  <span className="truncate">
                                    {res.instrument_name}
                                  </span>
                                </div>

                                <div className="flex items-center gap-1.5 text-[11px] text-stone-500 font-mono">
                                  <Calendar className="w-3.5 h-3.5 text-stone-400 shrink-0" />
                                  <span>
                                    {formatDisplayDate(
                                      getCairoDateString(res.start_time),
                                    )}
                                    {res.start_time && (
                                      <span className="text-stone-400 ml-1">
                                        ·{" "}
                                        {formatHhmmTo12Hour(
                                          getCairoTimeString(res.start_time),
                                        )}
                                      </span>
                                    )}
                                  </span>
                                </div>
                              </div>

                              <div className="flex flex-col items-end gap-1.5 shrink-0">
                                {getStatusBadge(res.status, res.is_no_show)}
                                <span className="text-[10px] font-semibold text-amber-800 flex items-center gap-0.5 opacity-80 group-hover:opacity-100 group-hover:translate-x-0.5 transition">
                                  <span>
                                    {t("admin.userDetail.viewReservation")}
                                  </span>
                                  <ChevronRight className="w-3 h-3" />
                                </span>
                              </div>
                            </div>
                          </div>
                        );
                      }

                      const msg = item.data;
                      return (
                        <div
                          key={`msg-${msg.id}`}
                          className="bg-amber-50/40 border border-amber-200/70 rounded-2xl p-3 space-y-1.5 text-left"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-1.5 min-w-0">
                              <MessageSquare className="w-3.5 h-3.5 text-amber-800 shrink-0" />
                              <span className="text-xs font-bold text-amber-900">
                                {t("admin.userDetail.adminMessage")}
                              </span>
                              {msg.sender_name && (
                                <span className="text-[10px] text-stone-500 font-medium truncate">
                                  ({msg.sender_name})
                                </span>
                              )}
                            </div>
                            <span className="text-[10px] text-stone-400 font-mono shrink-0">
                              {formatDisplayDate(
                                getCairoDateString(msg.created_at),
                              )}
                              {msg.created_at && (
                                <span className="ml-1">
                                  ·{" "}
                                  {formatHhmmTo12Hour(
                                    getCairoTimeString(msg.created_at),
                                  )}
                                </span>
                              )}
                            </span>
                          </div>

                          <div className="text-xs text-stone-700 bg-white/80 p-2.5 rounded-xl border border-amber-100 italic">
                            "{msg.content}"
                          </div>

                          {msg.service_name && (
                            <div className="text-[10px] text-stone-500 flex items-center justify-between pt-0.5">
                              <span className="truncate">
                                {t("admin.userDetail.regarding", {
                                  service: msg.service_name,
                                })}
                                {msg.instrument_name &&
                                  ` (${msg.instrument_name})`}
                              </span>
                              {msg.reservation_id && (
                                <button
                                  type="button"
                                  onClick={() =>
                                    onSelectReservation(msg.reservation_id)
                                  }
                                  className="text-amber-800 hover:underline font-semibold cursor-pointer flex items-center gap-1 shrink-0"
                                >
                                  <ExternalLink className="w-3 h-3" />
                                </button>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-5 py-2.5 border-t border-stone-200 bg-stone-50/50 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-bold bg-stone-200 hover:bg-stone-300 text-stone-800 transition cursor-pointer"
          >
            {t("admin.userDetail.close")}
          </button>
        </div>
      </div>
    </div>
  );
};

export const UserDetailModal: React.FC<UserDetailModalProps> = (props) => {
  if (!props.isOpen || !props.userId) return null;
  return (
    <ErrorBoundary
      fallbackTitle="Error displaying member profile"
      onReset={props.onClose}
      isModal
      zIndexClass={props.zIndexClass || "z-50"}
    >
      <UserDetailModalInner {...props} />
    </ErrorBoundary>
  );
};
