import React, { useState, useEffect } from "react";
import { useAuth } from "../contexts/AuthContext.tsx";
import { REJECTION_REASON_PRESETS } from "../constants/reservationPresets.ts";
import {
  Bell,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  MessageSquare,
  Wrench,
  CheckCheck,
  Check,
  ChevronRight,
  X,
  Clock,
  Music2,
  RefreshCw,
  Info,
} from "lucide-react";

export interface AppNotification {
  id: string;
  user_id?: string | null;
  admin_id?: string | null;
  type: string;
  message: string;
  is_read: boolean;
  reservation_id?: string | null;
  series_id?: string | null;
  created_at: string;
  reservation_status?: string | null;
  service_name?: string | null;
  rejection_reason?: string | null;
  instrument_name?: string | null;
}

export interface NotificationsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectReservation: (reservationId: string) => void;
  onUnreadCountChange?: (count: number) => void;
}

export const NotificationsModal: React.FC<NotificationsModalProps> = ({
  isOpen,
  onClose,
  onSelectReservation,
  onUnreadCountChange,
}) => {
  const { profile, sessionToken } = useAuth();
  const isAdminViewer = Boolean(
    profile?.role === "admin" ||
    profile?.role === "super_admin" ||
    profile?.isSuperAdmin,
  );

  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [filter, setFilter] = useState<
    "all" | "unread" | "requests" | "approvals" | "rejections" | "messages"
  >("all");
  const [actionNotice, setActionNotice] = useState<string | null>(null);

  // Inline action state for Admins
  const [actioningId, setActioningId] = useState<string | null>(null);
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState<string>("");

  const fetchNotifications = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/notifications", {
        headers: {
          Authorization: `Bearer ${sessionToken || ""}`,
        },
      });
      const data = await res.json();
      if (data.success && Array.isArray(data.notifications)) {
        setNotifications(data.notifications);
        if (onUnreadCountChange) {
          onUnreadCountChange(data.unreadCount || 0);
        }
      }
    } catch (e: any) {
      console.warn("Error fetching notifications:", e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchNotifications();
    }
  }, [isOpen]);

  // Polling unread count periodically
  useEffect(() => {
    const interval = setInterval(async () => {
      try {
        const res = await fetch("/api/notifications", {
          headers: {
            Authorization: `Bearer ${sessionToken || ""}`,
          },
        });
        const data = await res.json();
        if (data.success && onUnreadCountChange) {
          onUnreadCountChange(data.unreadCount || 0);
        }
      } catch (e) {
        // silent background check
      }
    }, 20000);

    return () => clearInterval(interval);
  }, [sessionToken]);

  const handleMarkAsRead = async (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    try {
      await fetch(`/api/notifications/${id}/read`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${sessionToken || ""}`,
        },
      });

      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, is_read: true } : n)),
      );

      const remainingUnread = notifications.filter(
        (n) => n.id !== id && !n.is_read,
      ).length;
      if (onUnreadCountChange) {
        onUnreadCountChange(remainingUnread);
      }
    } catch (e: any) {
      console.warn("Could not mark notification as read:", e.message);
    }
  };

  const handleMarkAllAsRead = async () => {
    try {
      await fetch("/api/notifications/mark-all-read", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${sessionToken || ""}`,
        },
      });

      setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
      if (onUnreadCountChange) {
        onUnreadCountChange(0);
      }
      setActionNotice("All notifications marked as read");
      setTimeout(() => setActionNotice(null), 3000);
    } catch (e: any) {
      console.warn("Could not mark all as read:", e.message);
    }
  };

  const handleNotificationClick = (notif: AppNotification) => {
    if (!notif.is_read) {
      handleMarkAsRead(notif.id);
    }
    if (notif.reservation_id) {
      onClose();
      onSelectReservation(notif.reservation_id);
    }
  };

  const handleApproveFromNotification = async (
    notif: AppNotification,
    e: React.MouseEvent,
  ) => {
    e.stopPropagation();
    if (!notif.reservation_id) return;

    setActioningId(notif.id);
    try {
      let url = `/api/reservations/admin/${notif.reservation_id}/approve`;
      if (notif.series_id) {
        url = `/api/reservations/admin/series/${notif.series_id}/approve-all`;
      }

      const res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${sessionToken || ""}`,
        },
        body: JSON.stringify({
          adminId: profile?.id,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        setActionNotice(data.error || "Failed to approve reservation.");
        setTimeout(() => setActionNotice(null), 4000);
        return;
      }

      // Mark local state as approved
      setNotifications((prev) =>
        prev.map((n) =>
          n.id === notif.id ||
          (notif.series_id && n.series_id === notif.series_id)
            ? { ...n, reservation_status: "approved" }
            : n,
        ),
      );

      setActionNotice(
        notif.series_id
          ? "Recurring series approved successfully."
          : "Reservation approved successfully.",
      );
      setTimeout(() => setActionNotice(null), 3000);
    } catch (err: any) {
      setActionNotice(err.message || "Network error approving reservation.");
      setTimeout(() => setActionNotice(null), 4000);
    } finally {
      setActioningId(null);
    }
  };

  const handleConfirmReject = async (
    notif: AppNotification,
    e: React.MouseEvent,
  ) => {
    e.stopPropagation();
    if (!notif.reservation_id || !rejectReason.trim()) return;

    setActioningId(notif.id);
    try {
      let url = `/api/reservations/admin/${notif.reservation_id}/reject`;
      if (notif.series_id) {
        url = `/api/reservations/admin/series/${notif.series_id}/reject-all`;
      }

      const res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${sessionToken || ""}`,
        },
        body: JSON.stringify({
          reason: rejectReason.trim(),
          adminId: profile?.id,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        setActionNotice(data.error || "Failed to reject reservation.");
        setTimeout(() => setActionNotice(null), 4000);
        return;
      }

      // Mark local state as rejected
      setNotifications((prev) =>
        prev.map((n) =>
          n.id === notif.id ||
          (notif.series_id && n.series_id === notif.series_id)
            ? {
                ...n,
                reservation_status: "rejected",
                rejection_reason: rejectReason.trim(),
              }
            : n,
        ),
      );

      setRejectingId(null);
      setRejectReason("");
      setActionNotice(
        notif.series_id
          ? "Recurring series rejected."
          : "Reservation rejected.",
      );
      setTimeout(() => setActionNotice(null), 3000);
    } catch (err: any) {
      setActionNotice(err.message || "Network error rejecting reservation.");
      setTimeout(() => setActionNotice(null), 4000);
    } finally {
      setActioningId(null);
    }
  };

  if (!isOpen) return null;

  const unreadCount = notifications.filter((n) => !n.is_read).length;

  const filteredNotifications = notifications.filter((n) => {
    if (filter === "unread") return !n.is_read;
    if (filter === "requests")
      return (
        n.type === "reservation_submitted" || n.type === "series_submitted"
      );
    if (filter === "approvals") return n.type === "reservation_approved";
    if (filter === "rejections")
      return (
        n.type === "reservation_rejected" ||
        n.type === "reservation_auto_rejected" ||
        n.type === "series_rejected" ||
        n.type === "instrument_removed_cancellation"
      );
    if (filter === "messages") return n.type === "admin_message";
    return true;
  });

  const getNotificationVisuals = (notif: AppNotification) => {
    switch (notif.type) {
      case "reservation_submitted":
      case "series_submitted":
        return {
          icon: <Clock className="w-5 h-5 text-amber-600 shrink-0" />,
          badgeBg: "bg-amber-50 border-amber-200 text-amber-900",
          typeLabel:
            notif.type === "series_submitted" || notif.series_id
              ? "Series Request"
              : "Reservation Request",
          accentBorder: "border-amber-500",
        };
      case "reservation_approved":
        return {
          icon: <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />,
          badgeBg: "bg-emerald-50 border-emerald-200 text-emerald-900",
          typeLabel: "Reservation Approved",
          accentBorder: "border-emerald-500",
        };
      case "reservation_rejected":
        return {
          icon: <XCircle className="w-5 h-5 text-red-600 shrink-0" />,
          badgeBg: "bg-red-50 border-red-200 text-red-900",
          typeLabel: "Reservation Rejected",
          accentBorder: "border-red-500",
        };
      case "reservation_auto_rejected":
        return {
          icon: <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0" />,
          badgeBg: "bg-amber-50 border-amber-200 text-amber-900",
          typeLabel: "Auto-Rejected (Conflict)",
          accentBorder: "border-amber-500",
        };
      case "series_rejected":
        return {
          icon: <XCircle className="w-5 h-5 text-red-600 shrink-0" />,
          badgeBg: "bg-red-50 border-red-200 text-red-900",
          typeLabel: "Series Rejected",
          accentBorder: "border-red-500",
        };
      case "instrument_removed_cancellation":
        return {
          icon: <Wrench className="w-5 h-5 text-stone-600 shrink-0" />,
          badgeBg: "bg-stone-100 border-stone-300 text-stone-900",
          typeLabel: "Instrument Removed",
          accentBorder: "border-stone-500",
        };
      case "admin_message":
        return {
          icon: <MessageSquare className="w-5 h-5 text-indigo-600 shrink-0" />,
          badgeBg: "bg-indigo-50 border-indigo-200 text-indigo-900",
          typeLabel: "Admin Message",
          accentBorder: "border-indigo-500",
        };
      default:
        return {
          icon: <Info className="w-5 h-5 text-stone-600 shrink-0" />,
          badgeBg: "bg-stone-50 border-stone-200 text-stone-900",
          typeLabel: "Notification",
          accentBorder: "border-stone-300",
        };
    }
  };

  const formatTimeAgo = (dateString: string) => {
    try {
      const d = new Date(dateString);
      const now = new Date();
      const diffSec = Math.floor((now.getTime() - d.getTime()) / 1000);

      if (diffSec < 60) return "Just now";
      if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`;
      if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h ago`;
      return d.toLocaleString("en-GB", {
        timeZone: "Africa/Cairo",
        dateStyle: "short",
        timeStyle: "short",
      });
    } catch {
      return dateString;
    }
  };

  return (
    <div
      id="notifications-modal-overlay"
      className="fixed inset-0 z-50 bg-stone-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto"
      onClick={onClose}
    >
      <div
        id="screen-7-notifications"
        className="bg-white rounded-3xl border border-stone-200 shadow-2xl max-w-2xl w-full my-auto overflow-hidden animate-in fade-in zoom-in-95 duration-150 max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="bg-stone-900 text-white px-6 py-4.5 flex items-center justify-between border-b border-stone-800 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-stone-800 border border-stone-700 text-white flex items-center justify-center relative">
              <Bell className="w-5 h-5 text-amber-400" />
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 w-4 h-4 bg-amber-500 text-stone-950 font-bold text-[10px] rounded-full flex items-center justify-center ring-2 ring-stone-900">
                  {unreadCount}
                </span>
              )}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-white">
                  Notifications
                </h2>
              </div>
              <p className="text-xs text-stone-400">
                {unreadCount > 0
                  ? `${unreadCount} unread notification${unreadCount === 1 ? "" : "s"}`
                  : "All caught up"}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {unreadCount > 0 && (
              <button
                type="button"
                onClick={handleMarkAllAsRead}
                className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-200 text-xs font-semibold transition cursor-pointer"
                title="Mark all as read"
              >
                <CheckCheck className="w-3.5 h-3.5" />
                <span>Mark All Read</span>
              </button>
            )}

            <button
              id="close-notifications-btn"
              onClick={onClose}
              className="w-8 h-8 rounded-full bg-stone-800 hover:bg-stone-700 text-stone-300 hover:text-white flex items-center justify-center transition cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Action Notice Bar */}
        {actionNotice && (
          <div className="bg-amber-50 border-b border-amber-200 px-6 py-2.5 text-xs text-amber-900 font-semibold flex items-center justify-between shrink-0 animate-in fade-in">
            <span>{actionNotice}</span>
            <Check className="w-4 h-4 text-amber-700" />
          </div>
        )}

        {/* Filter Bar */}
        <div className="px-6 py-3 bg-stone-50 border-b border-stone-200 flex flex-wrap items-center justify-between gap-2 shrink-0">
          <div className="flex items-center gap-1.5 overflow-x-auto py-0.5 max-w-full">
            <button
              type="button"
              onClick={() => setFilter("all")}
              className={`px-3 py-1 rounded-xl text-xs font-bold transition cursor-pointer whitespace-nowrap ${
                filter === "all"
                  ? "bg-stone-900 text-white shadow-2xs"
                  : "bg-white text-stone-600 border border-stone-200 hover:bg-stone-100"
              }`}
            >
              All ({notifications.length})
            </button>
            <button
              type="button"
              onClick={() => setFilter("unread")}
              className={`px-3 py-1 rounded-xl text-xs font-bold transition cursor-pointer whitespace-nowrap ${
                filter === "unread"
                  ? "bg-stone-900 text-white shadow-2xs"
                  : "bg-white text-stone-600 border border-stone-200 hover:bg-stone-100"
              }`}
            >
              Unread ({unreadCount})
            </button>
            <button
              type="button"
              onClick={() => setFilter("requests")}
              className={`px-3 py-1 rounded-xl text-xs font-bold transition cursor-pointer whitespace-nowrap ${
                filter === "requests"
                  ? "bg-stone-900 text-white shadow-2xs"
                  : "bg-white text-stone-600 border border-stone-200 hover:bg-stone-100"
              }`}
            >
              Requests
            </button>
            <button
              type="button"
              onClick={() => setFilter("approvals")}
              className={`px-3 py-1 rounded-xl text-xs font-bold transition cursor-pointer whitespace-nowrap ${
                filter === "approvals"
                  ? "bg-stone-900 text-white shadow-2xs"
                  : "bg-white text-stone-600 border border-stone-200 hover:bg-stone-100"
              }`}
            >
              Approvals
            </button>
            <button
              type="button"
              onClick={() => setFilter("rejections")}
              className={`px-3 py-1 rounded-xl text-xs font-bold transition cursor-pointer whitespace-nowrap ${
                filter === "rejections"
                  ? "bg-stone-900 text-white shadow-2xs"
                  : "bg-white text-stone-600 border border-stone-200 hover:bg-stone-100"
              }`}
            >
              Rejections & Cancellations
            </button>
            <button
              type="button"
              onClick={() => setFilter("messages")}
              className={`px-3 py-1 rounded-xl text-xs font-bold transition cursor-pointer whitespace-nowrap ${
                filter === "messages"
                  ? "bg-stone-900 text-white shadow-2xs"
                  : "bg-white text-stone-600 border border-stone-200 hover:bg-stone-100"
              }`}
            >
              Admin Messages
            </button>
          </div>

          <div className="flex items-center gap-2 ml-auto">
            <button
              type="button"
              onClick={fetchNotifications}
              className="p-1 text-stone-500 hover:text-stone-900 transition rounded-lg hover:bg-stone-200/60 cursor-pointer"
              title="Refresh"
            >
              <RefreshCw
                className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`}
              />
            </button>
          </div>
        </div>

        {/* Notifications List Body */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-3 flex-1 bg-stone-100/60">
          {loading && notifications.length === 0 ? (
            <div className="py-12 text-center text-xs text-stone-500 flex flex-col items-center justify-center gap-2">
              <div className="w-6 h-6 border-2 border-stone-400 border-t-amber-800 rounded-full animate-spin" />
              <span>Loading notifications...</span>
            </div>
          ) : filteredNotifications.length === 0 ? (
            <div className="bg-white rounded-2xl border border-stone-200 p-8 text-center space-y-3 shadow-2xs">
              <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-800 flex items-center justify-center mx-auto">
                <Bell className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-stone-900">
                  {filter === "unread"
                    ? "No unread notifications"
                    : "No notifications found"}
                </h3>
                <p className="text-xs text-stone-500 mt-1 max-w-sm mx-auto">
                  {filter === "unread"
                    ? "You've read all your notifications. Switch filter to 'All' to review past updates."
                    : "System alerts for approved requests, rejections, admin notes, and changes will appear here."}
                </p>
              </div>
            </div>
          ) : (
            filteredNotifications.map((notif) => {
              const visuals = getNotificationVisuals(notif);
              const timeAgo = formatTimeAgo(notif.created_at);

              return (
                <div
                  key={notif.id}
                  id={`notification-card-${notif.id}`}
                  onClick={() => handleNotificationClick(notif)}
                  className={`group relative rounded-2xl p-4 transition border shadow-2xs cursor-pointer ${
                    notif.is_read
                      ? "bg-white hover:bg-stone-50 border-stone-200"
                      : "bg-white hover:bg-amber-50/40 border-amber-300 ring-1 ring-amber-200/50"
                  }`}
                >
                  <div className="flex items-start gap-3.5">
                    {/* Visual Icon */}
                    <div className="mt-0.5">{visuals.icon}</div>

                    {/* Notification Content */}
                    <div className="flex-1 min-w-0 space-y-1.5">
                      <div className="flex flex-wrap items-center justify-between gap-1.5">
                        <div className="flex items-center gap-2">
                          <span
                            className={`px-2 py-0.5 rounded-md text-[10px] font-bold border uppercase tracking-wider ${visuals.badgeBg}`}
                          >
                            {visuals.typeLabel}
                          </span>

                          {!notif.is_read && (
                            <span className="w-2 h-2 rounded-full bg-amber-600 animate-pulse" />
                          )}
                        </div>

                        <span className="text-[11px] text-stone-400 font-mono flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {timeAgo}
                        </span>
                      </div>

                      {/* Primary Message */}
                      <p
                        className={`text-xs leading-relaxed ${
                          notif.is_read
                            ? "text-stone-700"
                            : "text-stone-900 font-medium"
                        }`}
                      >
                        {notif.message}
                      </p>

                      {/* Associated Reservation Card Preview if available */}
                      {notif.reservation_id && (
                        <div className="mt-2 bg-stone-50 group-hover:bg-amber-50/60 p-2.5 rounded-xl border border-stone-200/80 flex items-center justify-between gap-2 text-xs transition">
                          <div className="flex items-center gap-2 min-w-0">
                            <Music2 className="w-3.5 h-3.5 text-amber-800 shrink-0" />
                            <span className="font-semibold text-stone-900 truncate">
                              {notif.service_name || "Reservation"}
                            </span>
                            {notif.instrument_name && (
                              <span className="text-stone-500 text-[11px] truncate hidden sm:inline">
                                • {notif.instrument_name}
                              </span>
                            )}
                          </div>

                          <div className="flex items-center gap-1 text-amber-900 font-bold text-[11px] shrink-0">
                            <span>View Details</span>
                            <ChevronRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
                          </div>
                        </div>
                      )}

                      {/* Admin Inline Actions for Pending Requests */}
                      {isAdminViewer &&
                        notif.type === "reservation_submitted" &&
                        notif.reservation_status === "pending" && (
                          <div
                            className="mt-3 pt-2.5 border-t border-stone-200/80"
                            onClick={(e) => e.stopPropagation()}
                          >
                            {rejectingId === notif.id ? (
                              <div className="space-y-2 bg-stone-50 p-3 rounded-xl border border-stone-200 animate-in fade-in">
                                <div className="space-y-1">
                                  <label className="block text-[11px] font-bold text-stone-800">
                                    Reason for Rejection (Required):
                                  </label>
                                  <div className="flex flex-wrap gap-1 pt-0.5">
                                    {REJECTION_REASON_PRESETS.map((preset) => (
                                      <button
                                        key={preset}
                                        type="button"
                                        onClick={() => setRejectReason(preset)}
                                        className="text-[10px] px-2 py-0.5 rounded-md bg-stone-200 hover:bg-stone-300 text-stone-700 font-medium transition cursor-pointer text-left"
                                      >
                                        {preset}
                                      </button>
                                    ))}
                                  </div>
                                </div>
                                <textarea
                                  value={rejectReason}
                                  onChange={(e) =>
                                    setRejectReason(e.target.value)
                                  }
                                  placeholder="e.g. Schedule conflict with choir rehearsal"
                                  rows={2}
                                  className="w-full text-xs px-2.5 py-1.5 rounded-lg border border-stone-300 focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-600 bg-white text-stone-900 resize-none"
                                  autoFocus
                                />
                                <div className="flex items-center justify-end gap-2">
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setRejectingId(null);
                                      setRejectReason("");
                                    }}
                                    disabled={actioningId === notif.id}
                                    className="px-2.5 py-1 rounded-lg text-xs font-semibold text-stone-600 hover:bg-stone-200 transition cursor-pointer"
                                  >
                                    Cancel
                                  </button>
                                  <button
                                    type="button"
                                    onClick={(e) =>
                                      handleConfirmReject(notif, e)
                                    }
                                    disabled={
                                      !rejectReason.trim() ||
                                      actioningId === notif.id
                                    }
                                    className="px-3 py-1 rounded-lg text-xs font-bold bg-red-600 hover:bg-red-700 text-white disabled:opacity-50 transition cursor-pointer flex items-center gap-1.5"
                                  >
                                    {actioningId === notif.id ? (
                                      <>
                                        <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                        <span>Rejecting...</span>
                                      </>
                                    ) : (
                                      <span>
                                        Confirm Reject
                                        {notif.series_id ? " Series" : ""}
                                      </span>
                                    )}
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <div className="flex items-center gap-2">
                                <button
                                  type="button"
                                  onClick={(e) =>
                                    handleApproveFromNotification(notif, e)
                                  }
                                  disabled={actioningId === notif.id}
                                  className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs transition cursor-pointer flex items-center gap-1.5 shadow-2xs disabled:opacity-50"
                                >
                                  {actioningId === notif.id ? (
                                    <>
                                      <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                      <span>Approving...</span>
                                    </>
                                  ) : (
                                    <>
                                      <CheckCircle2 className="w-3.5 h-3.5" />
                                      <span>
                                        Approve
                                        {notif.series_id ? " Series" : ""}
                                      </span>
                                    </>
                                  )}
                                </button>
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setRejectingId(notif.id);
                                    setRejectReason("");
                                  }}
                                  disabled={actioningId === notif.id}
                                  className="px-3 py-1.5 rounded-xl bg-stone-100 hover:bg-red-50 text-stone-700 hover:text-red-700 border border-stone-200 hover:border-red-200 font-bold text-xs transition cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
                                >
                                  <XCircle className="w-3.5 h-3.5" />
                                  <span>
                                    Reject{notif.series_id ? " Series" : ""}
                                  </span>
                                </button>
                              </div>
                            )}
                          </div>
                        )}

                      {/* Status indicator if already resolved */}
                      {isAdminViewer &&
                        notif.type === "reservation_submitted" &&
                        notif.reservation_status &&
                        notif.reservation_status !== "pending" && (
                          <div className="mt-2.5 pt-2 border-t border-stone-100 flex items-center gap-1.5 text-xs">
                            {notif.reservation_status === "approved" ? (
                              <div className="flex items-center gap-1 text-emerald-700 font-semibold">
                                <CheckCircle2 className="w-3.5 h-3.5" />
                                <span>Approved</span>
                              </div>
                            ) : (
                              <div className="flex items-center gap-1 text-red-700 font-semibold">
                                <XCircle className="w-3.5 h-3.5" />
                                <span>
                                  Rejected
                                  {notif.rejection_reason
                                    ? `: ${notif.rejection_reason}`
                                    : ""}
                                </span>
                              </div>
                            )}
                          </div>
                        )}
                    </div>

                    {/* Mark As Read Button */}
                    {!notif.is_read && (
                      <button
                        type="button"
                        onClick={(e) => handleMarkAsRead(notif.id, e)}
                        className="p-1.5 text-stone-400 hover:text-emerald-700 hover:bg-emerald-50 rounded-xl transition cursor-pointer"
                        title="Mark as read"
                      >
                        <Check className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="p-4 bg-white border-t border-stone-200 flex items-center justify-between text-xs text-stone-500 shrink-0">
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
            <span>Real-time On-site Alerts Active</span>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-800 font-bold text-xs transition cursor-pointer"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
