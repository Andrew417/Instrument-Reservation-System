import React, { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
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
  User,
  ExternalLink,
  Inbox,
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
  reservation_user_id?: string | null;
  user_name?: string | null;
  target_user_id?: string | null;
}

export interface NotificationsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectReservation: (
    reservationId: string,
    initialTab?: "details" | "chat",
  ) => void;
  onUnreadCountChange?: (count: number) => void;
  onOpenUserProfile?: (userId: string) => void;
}

export const NotificationsModal: React.FC<NotificationsModalProps> = ({
  isOpen,
  onClose,
  onSelectReservation,
  onUnreadCountChange,
  onOpenUserProfile,
}) => {
  const { t } = useTranslation();
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
        onUnreadCountChange?.(data.unreadCount || 0);
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  useEffect(() => {
    const interval = setInterval(async () => {
      try {
        const res = await fetch("/api/notifications", {
          headers: {
            Authorization: `Bearer ${sessionToken || ""}`,
          },
        });
        const data = await res.json();
        if (data.success) {
          onUnreadCountChange?.(data.unreadCount || 0);
        }
      } catch {
        // silent
      }
    }, 20000);

    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
      onUnreadCountChange?.(remainingUnread);
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
      onUnreadCountChange?.(0);
      setActionNotice(t("notifications.allCaughtUp"));
      setTimeout(() => setActionNotice(null), 3000);
    } catch (e: any) {
      console.warn("Could not mark all as read:", e.message);
    }
  };

  const handleNotificationClick = (
    notif: AppNotification,
    preferredTab?: "details" | "chat",
  ) => {
    if (!notif.is_read) {
      handleMarkAsRead(notif.id);
    }
    if (notif.reservation_id) {
      const tab =
        preferredTab ||
        (notif.type === "reservation_message" ? "chat" : "details");
      onSelectReservation(notif.reservation_id, tab);
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
      let url = `/api/admin/reservations/${notif.reservation_id}/approve`;
      if (notif.series_id) {
        url = `/api/admin/reservations/series/${notif.series_id}/approve`;
      }

      const res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${sessionToken || ""}`,
        },
        body: JSON.stringify({ adminId: profile?.id }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        setActionNotice(data.error || "Failed to approve reservation.");
        setTimeout(() => setActionNotice(null), 4000);
        return;
      }

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
      let url = `/api/admin/reservations/${notif.reservation_id}/reject`;
      if (notif.series_id) {
        url = `/api/admin/reservations/series/${notif.series_id}/reject`;
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
          icon: <Clock className="w-4 h-4 text-amber-600 shrink-0" />,
          iconBg: "bg-amber-100",
          badgeBg: "bg-amber-50 border-amber-200 text-amber-900",
          typeLabel:
            notif.type === "series_submitted" || notif.series_id
              ? t("notifications.typeSeriesRequest")
              : t("notifications.typeReservationRequest"),
        };
      case "reservation_approved":
        return {
          icon: <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />,
          iconBg: "bg-emerald-100",
          badgeBg: "bg-emerald-50 border-emerald-200 text-emerald-900",
          typeLabel: t("notifications.typeReservationApproved"),
        };
      case "reservation_rejected":
        return {
          icon: <XCircle className="w-4 h-4 text-red-600 shrink-0" />,
          iconBg: "bg-red-100",
          badgeBg: "bg-red-50 border-red-200 text-red-900",
          typeLabel: t("notifications.typeReservationRejected"),
        };
      case "reservation_auto_rejected":
        return {
          icon: <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />,
          iconBg: "bg-amber-100",
          badgeBg: "bg-amber-50 border-amber-200 text-amber-900",
          typeLabel: t("notifications.typeAutoRejected"),
        };
      case "series_rejected":
        return {
          icon: <XCircle className="w-4 h-4 text-red-600 shrink-0" />,
          iconBg: "bg-red-100",
          badgeBg: "bg-red-50 border-red-200 text-red-900",
          typeLabel: t("notifications.typeSeriesRejected"),
        };
      case "instrument_removed_cancellation":
        return {
          icon: <Wrench className="w-4 h-4 text-stone-600 shrink-0" />,
          iconBg: "bg-stone-200",
          badgeBg: "bg-stone-100 border-stone-300 text-stone-900",
          typeLabel: t("notifications.typeInstrumentRemoved"),
        };
      case "admin_message":
        return {
          icon: <MessageSquare className="w-4 h-4 text-indigo-600 shrink-0" />,
          iconBg: "bg-indigo-100",
          badgeBg: "bg-indigo-50 border-indigo-200 text-indigo-900",
          typeLabel: t("notifications.typeAdminMessage"),
        };
      case "user_reply":
        return {
          icon: <MessageSquare className="w-4 h-4 text-indigo-600 shrink-0" />,
          iconBg: "bg-indigo-100",
          badgeBg: "bg-indigo-50 border-indigo-200 text-indigo-900",
          typeLabel: t("notifications.typeUserReply"),
        };
      case "account_approval_submitted":
        return {
          icon: <Info className="w-4 h-4 text-indigo-600 shrink-0" />,
          iconBg: "bg-indigo-100",
          badgeBg: "bg-indigo-50 border-indigo-200 text-indigo-900",
          typeLabel: t("notifications.typeAccountApproval"),
        };
      case "trusted_status_granted":
        return {
          icon: <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />,
          iconBg: "bg-emerald-100",
          badgeBg: "bg-emerald-50 border-emerald-200 text-emerald-900",
          typeLabel: t("notifications.typeTrustedGranted"),
        };
      case "trusted_status_revoked":
        return {
          icon: <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />,
          iconBg: "bg-amber-100",
          badgeBg: "bg-amber-50 border-amber-200 text-amber-900",
          typeLabel: t("notifications.typeTrustedRevoked"),
        };
      case "reservation_cancelled":
        return {
          icon: <XCircle className="w-4 h-4 text-stone-600 shrink-0" />,
          iconBg: "bg-stone-200",
          badgeBg: "bg-stone-100 border-stone-300 text-stone-900",
          typeLabel: t("notifications.typeCancelled"),
        };
      default:
        return {
          icon: <Info className="w-4 h-4 text-stone-600 shrink-0" />,
          iconBg: "bg-stone-200",
          badgeBg: "bg-stone-50 border-stone-200 text-stone-900",
          typeLabel: t("notifications.typeGeneric"),
        };
    }
  };

  const LEGACY_MESSAGE_RULES: Array<{
    type: string;
    pattern: RegExp;
    translate: (m: RegExpMatchArray) => string;
  }> = [
    {
      type: "account_approval_submitted",
      pattern: /^New member registration from (.+) awaiting approval\.$/,
      translate: (m) =>
        t("notifications.msgAccountApproval", { name: m[1] }) as string,
    },
    {
      type: "user_reply",
      pattern: /^(.+?) replied on reservation "(.+)": "([\s\S]*)"$/,
      translate: (m) =>
        t("notifications.msgUserReply", {
          name: m[1],
          service: m[2],
          content: m[3],
        }) as string,
    },
    {
      type: "admin_message",
      pattern:
        /^New message from administration regarding "(.+)": "([\s\S]*)"$/,
      translate: (m) =>
        t("notifications.msgAdminMessage", {
          service: m[1],
          content: m[2],
        }) as string,
    },
    {
      type: "reservation_approved",
      pattern:
        /^Church Administration created and approved an instrument reservation for you: "(.+)" on (.+) at (.+)\.$/,
      translate: (m) =>
        t("notifications.msgBookOnBehalf", {
          service: m[1],
          date: m[2],
          time: m[3],
        }) as string,
    },
    {
      type: "trusted_status_granted",
      pattern:
        /^Congratulations! You have been granted "Trusted Member" status by church administration\. Your reservations are now automatically approved\.$/,
      translate: () => t("notifications.msgTrustedGranted") as string,
    },
    {
      type: "trusted_status_revoked",
      pattern:
        /^Notice: Your "Trusted Member" status has been adjusted by church administration\.$/,
      translate: () => t("notifications.msgTrustedRevoked") as string,
    },
    {
      type: "reservation_approved",
      pattern: /^Your reservation on (.+) \((.+) - (.+)\) has been approved\.$/,
      translate: (m) =>
        t("notifications.msgReservationApproved", {
          date: m[1],
          startTime: m[2],
          endTime: m[3],
        }) as string,
    },
    {
      type: "reservation_approved",
      pattern: /^Your reservation has been approved by an administrator\.$/,
      translate: () =>
        t("notifications.msgReservationApprovedByAdmin") as string,
    },
    {
      type: "reservation_submitted",
      pattern:
        /^Your outside-church reservation request has been submitted\. If approved, an administrator will contact you on WhatsApp to confirm details and arrange payment\.$/,
      translate: () => t("notifications.msgOutsideSubmitted") as string,
    },
    {
      type: "reservation_submitted",
      pattern:
        /^Your reservation request on (.+) \((.+)\) has been submitted and is pending administrator review\.$/,
      translate: (m) =>
        t("notifications.msgReservationSubmittedUser", {
          date: m[1],
          startTime: m[2],
        }) as string,
    },
    {
      type: "reservation_submitted",
      pattern: /^New reservation request from (.+) for (.+) on (.+)\.$/,
      translate: (m) =>
        t("notifications.msgReservationSubmittedAdmin", {
          name: m[1],
          instrument: m[2],
          date: m[3],
        }) as string,
    },
    {
      type: "reservation_submitted",
      pattern:
        /^New recurring series request \((\d+) occurrences\) from (.+) for (.+) starting (.+)\.$/,
      translate: (m) =>
        t("notifications.msgSeriesSubmittedAdmin", {
          count: m[1],
          name: m[2],
          instrument: m[3],
          date: m[4],
        }) as string,
    },
    {
      type: "series_submitted",
      pattern:
        /^Your recurring series \((\d+) occurrences\) has been created \((\d+) approved, (\d+) pending review\)\.$/,
      translate: (m) =>
        t("notifications.msgSeriesSubmittedUser", {
          count: m[1],
          approved: m[2],
          pending: m[3],
        }) as string,
    },
    {
      type: "reservation_rejected",
      pattern:
        /^Your reservation request was rejected by an administrator\. Reason: ([\s\S]+)$/,
      translate: (m) =>
        t("notifications.msgReservationRejectedSingle", {
          reason: m[1],
        }) as string,
    },
    {
      type: "reservation_rejected",
      pattern:
        /^Your reservation request\(s\) were rejected by an administrator\. Reason: ([\s\S]+)$/,
      translate: (m) =>
        t("notifications.msgReservationRejectedBulk", {
          reason: m[1],
        }) as string,
    },
    {
      type: "series_rejected",
      pattern:
        /^Your recurring series was rejected by an administrator\. Reason: ([\s\S]+)$/,
      translate: (m) =>
        t("notifications.msgSeriesRejected", { reason: m[1] }) as string,
    },
    {
      type: "reservation_cancelled",
      pattern: /^Reservation cancelled — ([\s\S]+)$/,
      translate: (m) =>
        t("notifications.msgCancelledWithReason", { reason: m[1] }) as string,
    },
    {
      type: "reservation_cancelled",
      pattern: /^Reservation cancelled$/,
      translate: () => t("notifications.msgCancelledPlain") as string,
    },
    {
      type: "instrument_removed_cancellation",
      pattern:
        /^Your reservation was cancelled because the instrument was removed from the inventory by administration\.$/,
      translate: () => t("notifications.msgInstrumentRemoved") as string,
    },
    {
      type: "reservation_auto_rejected",
      pattern:
        /^Your pending reservation was auto-rejected due to a conflict with an approved reservation for this time slot\.$/,
      translate: () => t("notifications.msgAutoRejected") as string,
    },
  ];

  const getNotificationMessage = (notif: AppNotification): string => {
    try {
      const parsed = JSON.parse(notif.message);
      if (parsed && typeof parsed === "object" && parsed.key) {
        return t(parsed.key, parsed.params || {}) as string;
      }
    } catch {
      // not JSON
    }

    for (const rule of LEGACY_MESSAGE_RULES) {
      if (rule.type !== notif.type) continue;
      const match = notif.message.match(rule.pattern);
      if (match) return rule.translate(match);
    }

    return notif.message;
  };

  const formatTimeAgo = (dateString: string) => {
    try {
      const d = new Date(dateString);
      const now = new Date();
      const diffSec = Math.floor((now.getTime() - d.getTime()) / 1000);

      if (diffSec < 60) return t("notifications.justNow");
      if (diffSec < 3600)
        return t("notifications.minutesAgo", {
          count: Math.floor(diffSec / 60),
        });
      if (diffSec < 86400)
        return t("notifications.hoursAgo", {
          count: Math.floor(diffSec / 3600),
        });
      return d.toLocaleString("en-GB", {
        timeZone: "Africa/Cairo",
        dateStyle: "short",
        timeStyle: "short",
        hour12: true,
      });
    } catch {
      return dateString;
    }
  };

  const FILTERS: {
    key: typeof filter;
    label: string;
    count?: number;
  }[] = [
    {
      key: "all",
      label: t("notifications.tabAll"),
      count: notifications.length,
    },
    { key: "unread", label: t("notifications.tabUnread"), count: unreadCount },
    { key: "requests", label: t("notifications.tabRequests") },
    { key: "approvals", label: t("notifications.tabApprovals") },
    { key: "rejections", label: t("notifications.tabRejections") },
    { key: "messages", label: t("notifications.tabMessages") },
  ];

  return (
    <div
      id="screen-7-notifications"
      className="space-y-4 sm:space-y-6 pb-[env(safe-area-inset-bottom)]"
    >
      {/* ═════════ Header Card — matches AvailabilityCalendar & MyReservations ═════════ */}
      <div className="bg-white rounded-2xl border border-stone-200 p-3 sm:p-4 shadow-xs space-y-3">
        {/* Title row */}
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex items-center gap-2 flex-wrap">
            <div className="w-9 h-9 rounded-2xl bg-stone-900 text-amber-400 flex items-center justify-center relative shrink-0">
              <Bell className="w-5 h-5" />
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 w-4 h-4 bg-amber-600 text-white font-bold text-[9px] rounded-full flex items-center justify-center ring-2 ring-white">
                  {unreadCount > 9 ? "9+" : unreadCount}
                </span>
              )}
            </div>
            <div className="min-w-0">
              <h1 className="text-base sm:text-xl font-bold text-stone-900 tracking-tight leading-none">
                {t("notifications.title")}
              </h1>
              <p className="text-[11px] sm:text-xs text-stone-500 truncate mt-0.5">
                {unreadCount > 0
                  ? t("notifications.unreadCount", { count: unreadCount })
                  : t("notifications.allCaughtUp")}
              </p>
            </div>
          </div>

          <div className="shrink-0 flex items-center gap-1">
            {unreadCount > 0 && (
              <button
                type="button"
                onClick={handleMarkAllAsRead}
                title={t("notifications.markAllReadTooltip")}
                aria-label={t("notifications.markAllRead")}
                className="flex items-center gap-1 px-2 py-1 rounded-full text-emerald-700 hover:text-emerald-900 hover:bg-emerald-50 active:bg-emerald-100 transition text-[10px] font-semibold touch-manipulation whitespace-nowrap"
              >
                <CheckCheck className="w-3.5 h-3.5 shrink-0" />
                <span>{t("notifications.markAllRead")}</span>
              </button>
            )}

            <button
              type="button"
              onClick={fetchNotifications}
              disabled={loading}
              title={t("notifications.refreshTooltip")}
              className="flex items-center gap-1 px-2 py-1 rounded-full text-stone-400 hover:text-stone-600 hover:bg-stone-100 active:bg-stone-200 transition text-[10px] font-semibold touch-manipulation disabled:opacity-60"
            >
              <RefreshCw
                className={`w-3.5 h-3.5 ${loading ? "animate-spin text-amber-700" : ""}`}
              />
              <span className="hidden sm:inline">{t("common.refresh")}</span>
            </button>
          </div>
        </div>

        {/* Filter chips row — horizontally scrollable on mobile */}
        <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-hide -mx-1 px-1 pb-2">
          {FILTERS.map((f) => {
            const isActive = filter === f.key;
            return (
              <button
                key={f.key}
                type="button"
                onClick={() => setFilter(f.key)}
                className={`shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all duration-150 cursor-pointer whitespace-nowrap touch-manipulation active:scale-95 ${
                  isActive
                    ? "bg-stone-900 text-white shadow-2xs"
                    : "bg-stone-50 text-stone-600 border border-stone-200 hover:bg-stone-100 active:bg-stone-200"
                }`}
              >
                <span>{f.label}</span>
                {typeof f.count === "number" && (
                  <span
                    className={`px-1.5 py-0.5 rounded-md text-[10px] font-bold tabular-nums leading-none ${
                      isActive
                        ? "bg-white/20 text-white"
                        : "bg-stone-200 text-stone-600"
                    }`}
                  >
                    {f.count}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Action notice */}
      {actionNotice && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl px-4 py-2.5 text-xs text-amber-900 font-semibold flex items-center justify-between gap-2 animate-in fade-in">
          <span className="break-words min-w-0">{actionNotice}</span>
          <Check className="w-4 h-4 text-amber-700 shrink-0" />
        </div>
      )}

      {/* ═════════ Notifications List ═════════ */}
      {loading && notifications.length === 0 ? (
        <div className="bg-white rounded-2xl border border-stone-200 p-12 text-center space-y-3 shadow-xs">
          <div className="w-8 h-8 border-3 border-amber-800/20 border-t-amber-800 rounded-full animate-spin mx-auto" />
          <p className="text-xs font-bold text-stone-600">
            {t("notifications.loading")}
          </p>
        </div>
      ) : filteredNotifications.length === 0 ? (
        <div className="bg-white rounded-2xl border border-stone-200 p-10 text-center space-y-3 shadow-xs">
          <div className="w-14 h-14 rounded-2xl bg-amber-50 text-amber-800 flex items-center justify-center mx-auto">
            <Inbox className="w-7 h-7" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-stone-900">
              {filter === "unread"
                ? t("notifications.emptyUnreadTitle")
                : t("notifications.emptyAllTitle")}
            </h3>
            <p className="text-xs text-stone-500 mt-1 max-w-sm mx-auto">
              {filter === "unread"
                ? t("notifications.emptyUnreadDesc")
                : t("notifications.emptyAllDesc")}
            </p>
          </div>
        </div>
      ) : (
        <div className="space-y-2.5">
          {filteredNotifications.map((notif) => {
            const visuals = getNotificationVisuals(notif);
            const timeAgo = formatTimeAgo(notif.created_at);
            const isUnread = !notif.is_read;

            return (
              <div
                key={notif.id}
                id={`notification-card-${notif.id}`}
                onClick={() => handleNotificationClick(notif)}
                className={`group relative rounded-2xl transition border shadow-2xs cursor-pointer active:scale-[0.998] touch-manipulation ${
                  isUnread
                    ? "bg-white hover:bg-amber-50/40 border-amber-300 ring-1 ring-amber-200/50"
                    : "bg-white hover:bg-stone-50 border-stone-200"
                }`}
              >
                <div className="p-3 sm:p-4 flex items-start gap-3">
                  {/* Left icon */}
                  <div
                    className={`shrink-0 w-9 h-9 rounded-xl flex items-center justify-center ${visuals.iconBg}`}
                  >
                    {visuals.icon}
                  </div>

                  {/* Middle content */}
                  <div className="flex-1 min-w-0 space-y-1.5">
                    {/* Top row: type badge + time + unread dot */}
                    <div className="flex flex-wrap items-center justify-between gap-1.5">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <span
                          className={`px-2 py-0.5 rounded-md text-[10px] font-bold border uppercase tracking-wider whitespace-nowrap ${visuals.badgeBg}`}
                        >
                          {visuals.typeLabel}
                        </span>
                        {isUnread && (
                          <span className="w-2 h-2 rounded-full bg-amber-600 animate-pulse shrink-0" />
                        )}
                      </div>

                      <span className="text-[10px] text-stone-400 font-mono flex items-center gap-1 shrink-0">
                        <Clock className="w-3 h-3" />
                        {timeAgo}
                      </span>
                    </div>

                    {/* Message */}
                    <p
                      className={`text-xs leading-relaxed break-words ${
                        isUnread
                          ? "text-stone-900 font-medium"
                          : "text-stone-700"
                      }`}
                    >
                      {getNotificationMessage(notif)}
                    </p>

                    {/* Member profile shortcut (admins only) */}
                    {isAdminViewer &&
                      onOpenUserProfile &&
                      (() => {
                        const notifUserId =
                          notif.reservation_user_id ||
                          notif.target_user_id ||
                          (() => {
                            try {
                              const p = JSON.parse(notif.message);
                              return p?.params?.userId || null;
                            } catch {
                              return null;
                            }
                          })();
                        const notifUserName =
                          notif.user_name ||
                          (() => {
                            try {
                              const p = JSON.parse(notif.message);
                              return p?.params?.name || null;
                            } catch {
                              return null;
                            }
                          })();

                        if (!notifUserId) return null;

                        return (
                          <div className="pt-0.5">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                onOpenUserProfile(notifUserId);
                              }}
                              className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-amber-900 hover:text-amber-950 bg-amber-50 hover:bg-amber-100 active:bg-amber-200 px-2 py-1 rounded-lg border border-amber-200 transition cursor-pointer touch-manipulation"
                            >
                              <User className="w-3 h-3 text-amber-800" />
                              <span className="truncate max-w-[140px]">
                                {notifUserName ||
                                  t("common.member") ||
                                  "Member"}
                              </span>
                              <ExternalLink className="w-2.5 h-2.5 text-stone-400 shrink-0" />
                            </button>
                          </div>
                        );
                      })()}

                    {/* Reservation context strip */}
                    {notif.reservation_id && (
                      <div className="mt-1 bg-stone-50 group-hover:bg-amber-50/60 p-2 rounded-lg border border-stone-200/80 flex items-center justify-between gap-2 text-[11px] transition">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <Music2 className="w-3 h-3 text-amber-800 shrink-0" />
                          <span className="font-semibold text-stone-900 truncate">
                            {notif.service_name ||
                              t("notifications.reservationFallback")}
                          </span>
                        </div>
                        <div className="flex items-center gap-0.5 text-amber-900 font-bold shrink-0">
                          <span className="hidden sm:inline">
                            {notif.type === "reservation_message"
                              ? t("notifications.openChat")
                              : t("myReservations.viewDetails")}
                          </span>
                          <ChevronRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform rtl:rotate-180" />
                        </div>
                      </div>
                    )}

                    {/* Admin inline approve/reject for pending requests */}
                    {isAdminViewer &&
                      notif.type === "reservation_submitted" &&
                      notif.reservation_status === "pending" && (
                        <div
                          className="mt-2 pt-2.5 border-t border-stone-200/80"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {rejectingId === notif.id ? (
                            <div className="space-y-2 bg-stone-50 p-2.5 rounded-xl border border-stone-200 animate-in fade-in">
                              <label className="block text-[11px] font-bold text-stone-800">
                                {t("notifications.rejectReasonRequired")}
                              </label>
                              <div className="flex flex-wrap gap-1">
                                {REJECTION_REASON_PRESETS.map((preset) => (
                                  <button
                                    key={preset}
                                    type="button"
                                    onClick={() => setRejectReason(preset)}
                                    className="text-[10px] px-2 py-0.5 rounded-md bg-stone-200 hover:bg-stone-300 active:bg-stone-400 text-stone-700 font-medium transition cursor-pointer text-start touch-manipulation"
                                  >
                                    {t(`presets.rejection.${preset}`, preset)}
                                  </button>
                                ))}
                              </div>
                              <textarea
                                value={rejectReason}
                                onChange={(e) =>
                                  setRejectReason(e.target.value)
                                }
                                placeholder={t(
                                  "notifications.rejectReasonPlaceholder",
                                )}
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
                                  className="px-2.5 py-1.5 rounded-lg text-xs font-semibold text-stone-600 hover:bg-stone-200 active:bg-stone-300 transition cursor-pointer touch-manipulation"
                                >
                                  {t("common.cancel")}
                                </button>
                                <button
                                  type="button"
                                  onClick={(e) => handleConfirmReject(notif, e)}
                                  disabled={
                                    !rejectReason.trim() ||
                                    actioningId === notif.id
                                  }
                                  className="px-3 py-1.5 rounded-lg text-xs font-bold bg-red-600 hover:bg-red-700 active:bg-red-800 text-white disabled:opacity-50 transition cursor-pointer flex items-center gap-1.5 touch-manipulation"
                                >
                                  {actioningId === notif.id ? (
                                    <>
                                      <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                      <span>
                                        {t("notifications.rejecting")}
                                      </span>
                                    </>
                                  ) : (
                                    <span>
                                      {notif.series_id
                                        ? t("notifications.confirmRejectSeries")
                                        : t("notifications.confirmReject")}
                                    </span>
                                  )}
                                </button>
                              </div>
                            </div>
                          ) : (
                            <div className="flex items-center gap-2 flex-wrap">
                              <button
                                type="button"
                                onClick={(e) =>
                                  handleApproveFromNotification(notif, e)
                                }
                                disabled={actioningId === notif.id}
                                className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white font-bold text-xs transition cursor-pointer flex items-center gap-1.5 shadow-2xs disabled:opacity-50 touch-manipulation"
                              >
                                {actioningId === notif.id ? (
                                  <>
                                    <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                    <span>{t("notifications.approving")}</span>
                                  </>
                                ) : (
                                  <>
                                    <CheckCircle2 className="w-3.5 h-3.5" />
                                    <span>
                                      {notif.series_id
                                        ? t("notifications.approveSeries")
                                        : t("notifications.approve")}
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
                                className="px-3 py-1.5 rounded-xl bg-stone-100 hover:bg-red-50 active:bg-red-100 text-stone-700 hover:text-red-700 border border-stone-200 hover:border-red-200 font-bold text-xs transition cursor-pointer flex items-center gap-1.5 disabled:opacity-50 touch-manipulation"
                              >
                                <XCircle className="w-3.5 h-3.5" />
                                <span>
                                  {notif.series_id
                                    ? t("notifications.rejectSeries")
                                    : t("notifications.reject")}
                                </span>
                              </button>
                            </div>
                          )}
                        </div>
                      )}

                    {/* Resolved status strip for admins */}
                    {isAdminViewer &&
                      notif.type === "reservation_submitted" &&
                      notif.reservation_status &&
                      notif.reservation_status !== "pending" && (
                        <div className="mt-1.5 pt-1.5 border-t border-stone-100 flex items-center gap-1.5 text-[11px]">
                          {notif.reservation_status === "approved" ? (
                            <div className="flex items-center gap-1 text-emerald-700 font-semibold">
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              <span>{t("common.approved")}</span>
                            </div>
                          ) : (
                            <div className="flex items-center gap-1 text-red-700 font-semibold">
                              <XCircle className="w-3.5 h-3.5" />
                              <span className="break-words">
                                {notif.rejection_reason
                                  ? t(
                                      "notifications.statusRejectedWithReason",
                                      {
                                        reason: notif.rejection_reason,
                                      },
                                    )
                                  : t("common.rejected")}
                              </span>
                            </div>
                          )}
                        </div>
                      )}
                  </div>

                  {/* Right column: mark-as-read button */}
                  {isUnread && (
                    <button
                      type="button"
                      onClick={(e) => handleMarkAsRead(notif.id, e)}
                      className="shrink-0 w-8 h-8 flex items-center justify-center text-stone-400 hover:text-emerald-700 hover:bg-emerald-50 active:bg-emerald-100 rounded-full transition cursor-pointer touch-manipulation"
                      title={t("notifications.markAsReadTooltip")}
                    >
                      <Check className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default NotificationsModal;
