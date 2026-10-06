import React, { useState, useEffect, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useAuth } from "../contexts/AuthContext.tsx";
import { REJECTION_REASON_PRESETS } from "../constants/reservationPresets.ts";
import { getStatusColor } from "../lib/status-colors.ts";
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
  ChevronDown,
  Zap,
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
  reservation_date?: string | null;
  start_time_24?: string | null;
  end_time_24?: string | null;
  start_time_12?: string | null;
  end_time_12?: string | null;
  duration_hours?: number | null;
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
  onOpenAccountApprovals?: () => void;
}

export const NotificationsModal: React.FC<NotificationsModalProps> = ({
  isOpen,
  onClose,
  onSelectReservation,
  onUnreadCountChange,
  onOpenUserProfile,
  onOpenAccountApprovals,
}) => {
  const { t, i18n } = useTranslation();
  const isRTL = i18n.language === "ar";
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

  // Density switcher: default to compact for high information density on mobile screens
  const [density, setDensity] = useState<"compact" | "comfortable">(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("church_notifs_density");
      if (saved === "compact" || saved === "comfortable") return saved;
      return "compact";
    }
    return "compact";
  });

  // Expanded cards tracker for reading long notes in compact mode
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const toggleExpanded = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const [actioningId, setActioningId] = useState<string | null>(null);
  const [rejectingNotif, setRejectingNotif] = useState<AppNotification | null>(
    null,
  );
  const [rejectReason, setRejectReason] = useState<string>("");

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        if (rejectingNotif) {
          setRejectingNotif(null);
          setRejectReason("");
        } else {
          onClose();
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, rejectingNotif, onClose]);

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
    if (notif.type === "account_approval_submitted") {
      onOpenAccountApprovals?.();
      return;
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

      setRejectingNotif(null);
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
          icon: <Clock className="w-3.5 h-3.5 text-amber-700 shrink-0" />,
          iconBg: "bg-amber-100/90 text-amber-800",
          borderAccent: "border-s-amber-500",
          typeTextColor: "text-amber-900",
          typeLabel:
            notif.type === "series_submitted" || notif.series_id
              ? t("notifications.typeSeriesRequest")
              : t("notifications.typeReservationRequest"),
        };
      case "reservation_approved":
        return {
          icon: (
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-700 shrink-0" />
          ),
          iconBg: "bg-emerald-100/90 text-emerald-800",
          borderAccent: "border-s-emerald-500",
          typeTextColor: "text-emerald-950",
          typeLabel: t("notifications.typeReservationApproved"),
        };
      case "reservation_instant_approved":
        return {
          icon: (
            <Zap className="w-3.5 h-3.5 text-sky-700 shrink-0" />
          ),
          iconBg: "bg-sky-100/90 text-sky-800",
          borderAccent: "border-s-sky-500",
          typeTextColor: "text-sky-950",
          typeLabel: "Instant Reservation Created",
        };
      case "reservation_rejected":
        return {
          icon: <XCircle className="w-3.5 h-3.5 text-red-700 shrink-0" />,
          iconBg: "bg-red-100/90 text-red-800",
          borderAccent: "border-s-red-500",
          typeTextColor: "text-red-950",
          typeLabel: t("notifications.typeReservationRejected"),
        };
      case "reservation_auto_rejected":
        return {
          icon: (
            <AlertTriangle className="w-3.5 h-3.5 text-amber-700 shrink-0" />
          ),
          iconBg: "bg-amber-100/90 text-amber-800",
          borderAccent: "border-s-amber-500",
          typeTextColor: "text-amber-950",
          typeLabel: t("notifications.typeAutoRejected"),
        };
      case "series_rejected":
        return {
          icon: <XCircle className="w-3.5 h-3.5 text-red-700 shrink-0" />,
          iconBg: "bg-red-100/90 text-red-800",
          borderAccent: "border-s-red-500",
          typeTextColor: "text-red-950",
          typeLabel: t("notifications.typeSeriesRejected"),
        };
      case "instrument_removed_cancellation":
        return {
          icon: <Wrench className="w-3.5 h-3.5 text-stone-700 shrink-0" />,
          iconBg: "bg-stone-200 text-stone-800",
          borderAccent: "border-s-stone-500",
          typeTextColor: "text-stone-900",
          typeLabel: t("notifications.typeInstrumentRemoved"),
        };
      case "admin_message":
        return {
          icon: (
            <MessageSquare className="w-3.5 h-3.5 text-indigo-700 shrink-0" />
          ),
          iconBg: "bg-indigo-100/90 text-indigo-800",
          borderAccent: "border-s-indigo-500",
          typeTextColor: "text-indigo-950",
          typeLabel: t("notifications.typeAdminMessage"),
        };
      case "user_reply":
        return {
          icon: (
            <MessageSquare className="w-3.5 h-3.5 text-indigo-700 shrink-0" />
          ),
          iconBg: "bg-indigo-100/90 text-indigo-800",
          borderAccent: "border-s-indigo-500",
          typeTextColor: "text-indigo-950",
          typeLabel: t("notifications.typeUserReply"),
        };
      case "account_approval_submitted":
        return {
          icon: <Info className="w-3.5 h-3.5 text-indigo-700 shrink-0" />,
          iconBg: "bg-indigo-100/90 text-indigo-800",
          borderAccent: "border-s-indigo-500",
          typeTextColor: "text-indigo-950",
          typeLabel: t("notifications.typeAccountApproval"),
        };
      case "trusted_status_granted":
        return {
          icon: (
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-700 shrink-0" />
          ),
          iconBg: "bg-emerald-100/90 text-emerald-800",
          borderAccent: "border-s-emerald-500",
          typeTextColor: "text-emerald-950",
          typeLabel: t("notifications.typeTrustedGranted"),
        };
      case "trusted_status_revoked":
        return {
          icon: (
            <AlertTriangle className="w-3.5 h-3.5 text-amber-700 shrink-0" />
          ),
          iconBg: "bg-amber-100/90 text-amber-800",
          borderAccent: "border-s-amber-500",
          typeTextColor: "text-amber-950",
          typeLabel: t("notifications.typeTrustedRevoked"),
        };
      case "reservation_cancelled":
        return {
          icon: <XCircle className="w-3.5 h-3.5 text-stone-700 shrink-0" />,
          iconBg: "bg-stone-200 text-stone-800",
          borderAccent: "border-s-stone-500",
          typeTextColor: "text-stone-900",
          typeLabel: t("notifications.typeCancelled"),
        };
      default:
        return {
          icon: <Info className="w-3.5 h-3.5 text-stone-700 shrink-0" />,
          iconBg: "bg-stone-200 text-stone-800",
          borderAccent: "border-s-stone-400",
          typeTextColor: "text-stone-900",
          typeLabel: t("notifications.typeGeneric"),
        };
    }
  };

  const formatMinimalReservationSummary = (
    notif: AppNotification,
    fallbackInstrument?: string,
    fallbackDate?: string,
  ): string => {
    const instrument =
      notif.instrument_name ||
      fallbackInstrument ||
      (t("notifications.reservationFallback") as string) ||
      "Instrument";
    const rawDate = notif.reservation_date || fallbackDate || "";

    let dayName = "";
    let formattedDate = rawDate;

    try {
      const cleanDate = rawDate.includes("T") ? rawDate.split("T")[0] : rawDate;
      const parts = cleanDate.split("-").map(Number);
      if (parts.length === 3 && parts[0] && parts[1] && parts[2]) {
        const [y, m, d] = parts;
        const dateUtc = new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
        const daysEn = [
          "Sunday",
          "Monday",
          "Tuesday",
          "Wednesday",
          "Thursday",
          "Friday",
          "Saturday",
        ];
        const daysAr = [
          "الأحد",
          "الإثنين",
          "الثلاثاء",
          "الأربعاء",
          "الخميس",
          "الجمعة",
          "السبت",
        ];
        dayName = isRTL ? daysAr[dateUtc.getUTCDay()] : daysEn[dateUtc.getUTCDay()];
        formattedDate = `${d}-${m}-${y}`;
      }
    } catch {
      // fallback
    }

    const cleanTime = (tStr?: string | null): string => {
      if (!tStr) return "";
      const match = tStr.match(/^(\d{1,2}):(\d{2})/);
      if (!match) return tStr;
      let h = parseInt(match[1], 10);
      const min = match[2];
      if (h > 12) h -= 12;
      if (h === 0) h = 12;
      return `${h}:${min}`;
    };

    const sTime = cleanTime(notif.start_time_24 || notif.start_time_12);
    const eTime = cleanTime(notif.end_time_24 || notif.end_time_12);

    let timePart = "";
    if (sTime && eTime) {
      timePart = isRTL ? ` من ${sTime} إلى ${eTime}` : ` from ${sTime} to ${eTime}`;
    } else if (sTime) {
      timePart = isRTL ? ` الساعة ${sTime}` : ` at ${sTime}`;
    }

    let durPart = "";
    if (notif.duration_hours && notif.duration_hours > 0) {
      durPart = isRTL ? ` (${notif.duration_hours} س)` : ` (${notif.duration_hours}h)`;
    }

    const onWord = isRTL ? "يوم " : "on ";
    const dayPrefix = dayName ? `${dayName} ` : "";

    return `${instrument} ${onWord}${dayPrefix}${formattedDate}${timePart}${durPart}`.trim();
  };

  const LEGACY_MESSAGE_RULES: Array<{
    type: string;
    pattern: RegExp;
    translate: (m: RegExpMatchArray, notif: AppNotification) => string;
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
      pattern: /^New reservation request from (.+?) for (.+?) on (.+?)\.?$/,
      translate: (m, notif) => formatMinimalReservationSummary(notif, m[2], m[3]),
    },
    {
      type: "reservation_submitted",
      pattern:
        /^New recurring series request \((\d+) occurrences\) from (.+?) for (.+?) starting (.+?)\.?$/,
      translate: (m, notif) => {
        const base = formatMinimalReservationSummary(notif, m[3], m[4]);
        return `${base} (${m[1]} ${isRTL ? "مواعيد" : "sessions"})`;
      },
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
      if (match) return rule.translate(match, notif);
    }

    return notif.message;
  };

  const getReservationStatusLabel = (status?: string | null): string | null => {
    if (!status || status === "pending") return null;
    const labels: Record<string, string> = {
      approved: t("common.approved"),
      ongoing: t("common.ongoing"),
      completed: t("common.completed"),
      cancelled: t("common.cancelled"),
      rejected: t("common.rejected"),
      auto_rejected: t("common.rejected"),
    };
    return labels[status] || status;
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
      return d.toLocaleDateString(isRTL ? "ar-EG" : "en-GB", {
        day: "numeric",
        month: "short",
      });
    } catch {
      return dateString;
    }
  };

  // Grouping helper for chronological mobile scanning
  const getDateGroup = (
    dateString: string,
  ): "today" | "yesterday" | "this_week" | "older" => {
    try {
      const d = new Date(dateString);
      if (isNaN(d.getTime())) return "older";
      const now = new Date();
      const todayMidnight = new Date(
        now.getFullYear(),
        now.getMonth(),
        now.getDate(),
      ).getTime();
      const itemMidnight = new Date(
        d.getFullYear(),
        d.getMonth(),
        d.getDate(),
      ).getTime();
      const diffDays = Math.round(
        (todayMidnight - itemMidnight) / (1000 * 60 * 60 * 24),
      );

      if (diffDays <= 0) return "today";
      if (diffDays === 1) return "yesterday";
      if (diffDays <= 7) return "this_week";
      return "older";
    } catch {
      return "older";
    }
  };

  const groupedNotifications = useMemo(() => {
    const groups: Record<
      "today" | "yesterday" | "this_week" | "older",
      AppNotification[]
    > = {
      today: [],
      yesterday: [],
      this_week: [],
      older: [],
    };

    filteredNotifications.forEach((n) => {
      const groupKey = getDateGroup(n.created_at);
      groups[groupKey].push(n);
    });

    const result: Array<{
      groupKey: "today" | "yesterday" | "this_week" | "older";
      label: string;
      items: AppNotification[];
    }> = [];

    const order: Array<"today" | "yesterday" | "this_week" | "older"> = [
      "today",
      "yesterday",
      "this_week",
      "older",
    ];

    for (const key of order) {
      if (groups[key].length > 0) {
        let label = "";
        if (key === "today") label = t("notifications.groupToday", "Today");
        else if (key === "yesterday")
          label = t("notifications.groupYesterday", "Yesterday");
        else if (key === "this_week")
          label = t("notifications.groupThisWeek", "This Week");
        else label = t("notifications.groupOlder", "Earlier");

        result.push({
          groupKey: key,
          label,
          items: groups[key],
        });
      }
    }

    return result;
  }, [filteredNotifications, t]);

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
      className="space-y-3 pb-[env(safe-area-inset-bottom)]"
    >
      {/* ═════════ Compact Mobile-Optimized Control Card ═════════ */}
      <div className="bg-white rounded-2xl border border-stone-200/90 p-2.5 sm:p-3.5 shadow-2xs space-y-2.5 sticky top-14 sm:top-16 z-20 backdrop-blur-md bg-white/95">
        {/* Title row: Compact, clean, 1-line top zone */}
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0 flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-stone-900 text-amber-400 flex items-center justify-center relative shrink-0">
              <Bell className="w-4 h-4" />
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 min-w-[15px] h-[15px] px-0.5 bg-amber-600 text-white font-bold text-[8.5px] rounded-full flex items-center justify-center ring-2 ring-white">
                  {unreadCount > 9 ? "9+" : unreadCount}
                </span>
              )}
            </div>
            <div className="min-w-0">
              <h1 className="text-sm sm:text-base font-bold text-stone-900 tracking-tight leading-none truncate">
                {t("notifications.title")}
              </h1>
              <p className="text-[10px] sm:text-[11px] text-stone-500 font-medium truncate mt-0.5">
                {unreadCount > 0
                  ? t("notifications.unreadCount", { count: unreadCount })
                  : t("notifications.allCaughtUp")}
              </p>
            </div>
          </div>

          {/* Quick Actions (Mark All Read, Refresh) */}
          <div className="shrink-0 flex items-center gap-1">
            {unreadCount > 0 && (
              <button
                type="button"
                onClick={handleMarkAllAsRead}
                title={t("notifications.markAllReadTooltip")}
                aria-label={t("notifications.markAllRead")}
                className="flex items-center gap-1 px-2 py-1 rounded-lg text-emerald-800 bg-emerald-50 hover:bg-emerald-100 active:bg-emerald-200 border border-emerald-200/80 transition text-[10px] font-bold touch-manipulation cursor-pointer whitespace-nowrap"
              >
                <CheckCheck className="w-3 h-3 shrink-0 text-emerald-700" />
                <span className="hidden xs:inline">
                  {t("notifications.markAllRead")}
                </span>
              </button>
            )}

            <button
              type="button"
              onClick={fetchNotifications}
              disabled={loading}
              title={t("notifications.refreshTooltip")}
              aria-label={t("common.refresh")}
              className="w-7 h-7 flex items-center justify-center rounded-lg text-stone-500 hover:text-stone-800 hover:bg-stone-100 active:bg-stone-200 transition touch-manipulation cursor-pointer disabled:opacity-60"
            >
              <RefreshCw
                className={`w-3.5 h-3.5 ${loading ? "animate-spin text-amber-700" : ""}`}
              />
            </button>
          </div>
        </div>

        {/* Filter chips row — smooth edge-to-edge swipe on mobile */}
        <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none -mx-2.5 px-2.5 sm:mx-0 sm:px-0 py-0.5">
          {FILTERS.map((f) => {
            const isActive = filter === f.key;
            return (
              <button
                key={f.key}
                type="button"
                onClick={() => setFilter(f.key)}
                className={`shrink-0 flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all duration-150 cursor-pointer whitespace-nowrap touch-manipulation active:scale-95 ${
                  isActive
                    ? "bg-stone-900 text-white shadow-2xs"
                    : "bg-stone-100/80 text-stone-600 hover:bg-stone-200/80 active:bg-stone-200"
                }`}
              >
                <span>{f.label}</span>
                {typeof f.count === "number" && (
                  <span
                    className={`px-1 py-0.2 rounded text-[9.5px] font-bold tabular-nums leading-none ${
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

      {/* Action Notice toast */}
      {actionNotice && (
        <div className="bg-amber-50 border border-amber-200/90 rounded-xl px-3 py-2 text-xs text-amber-900 font-semibold flex items-center justify-between gap-2 shadow-2xs animate-in fade-in">
          <span className="break-words min-w-0 text-[11px] sm:text-xs">
            {actionNotice}
          </span>
          <Check className="w-3.5 h-3.5 text-amber-700 shrink-0" />
        </div>
      )}

      {/* ═════════ Notifications List ═════════ */}
      {loading && notifications.length === 0 ? (
        <div className="bg-white rounded-2xl border border-stone-200 p-8 text-center space-y-2.5 shadow-2xs">
          <div className="w-7 h-7 border-2.5 border-amber-800/20 border-t-amber-800 rounded-full animate-spin mx-auto" />
          <p className="text-xs font-semibold text-stone-600">
            {t("notifications.loading")}
          </p>
        </div>
      ) : filteredNotifications.length === 0 ? (
        <div className="bg-white rounded-2xl border border-stone-200 p-8 text-center space-y-2.5 shadow-2xs">
          <div className="w-11 h-11 rounded-xl bg-amber-50 text-amber-800 flex items-center justify-center mx-auto">
            <Inbox className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-xs sm:text-sm font-bold text-stone-900">
              {filter === "unread"
                ? t("notifications.emptyUnreadTitle")
                : t("notifications.emptyAllTitle")}
            </h3>
            <p className="text-[11px] sm:text-xs text-stone-500 mt-0.5 max-w-sm mx-auto">
              {filter === "unread"
                ? t("notifications.emptyUnreadDesc")
                : t("notifications.emptyAllDesc")}
            </p>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {groupedNotifications.map((group) => (
            <div key={group.groupKey} className="space-y-1.5">
              {/* Group sticky header */}
              <div className="flex items-center justify-between px-1 py-0.5 text-[10.5px] font-bold text-stone-400 uppercase tracking-wider">
                <span>{group.label}</span>
                <span className="tabular-nums font-mono text-[9.5px]">
                  {group.items.length}
                </span>
              </div>

              {/* Items stack */}
              <div className="space-y-1.5 sm:space-y-2">
                {group.items.map((notif) => {
                  const visuals = getNotificationVisuals(notif);
                  const timeAgo = formatTimeAgo(notif.created_at);
                  const isUnread = !notif.is_read;
                  const messageText = getNotificationMessage(notif);
                  const isExpanded = expandedIds.has(notif.id);
                  const isCompact = density === "compact";

                  // Extract member ID & Name for admins
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

                  return (
                    <div
                      key={notif.id}
                      id={`notification-card-${notif.id}`}
                      onClick={() => handleNotificationClick(notif)}
                      className={`group relative rounded-xl transition-all duration-150 border cursor-pointer active:scale-[0.995] touch-manipulation overflow-hidden ${
                        visuals.borderAccent
                      } border-s-[3.5px] ${
                        isUnread
                          ? "bg-white hover:bg-amber-50/30 border-amber-300/80 shadow-2xs ring-1 ring-amber-200/40"
                          : "bg-white hover:bg-stone-50 border-stone-200/90 shadow-2xs"
                      }`}
                    >
                      <div
                        className={`${
                          isCompact
                            ? "p-2 sm:p-2.5 flex items-start gap-2 sm:gap-2.5"
                            : "p-3 sm:p-3.5 flex items-start gap-3"
                        }`}
                      >
                        {/* Status Icon */}
                        <div
                          className={`shrink-0 rounded-lg flex items-center justify-center ${visuals.iconBg} ${
                            isCompact
                              ? "w-7 h-7 text-xs mt-0.5"
                              : "w-8 h-8 text-sm mt-0.5"
                          }`}
                        >
                          {visuals.icon}
                        </div>

                        {/* Content Body */}
                        <div className="flex-1 min-w-0 space-y-1">
                          {/* Row 1: Type label, separator, timestamp, unread dot */}
                          <div className="flex items-center justify-between gap-1.5 min-w-0">
                            <div className="flex items-center gap-1.5 min-w-0 flex-wrap">
                              <span
                                className={`text-[11px] sm:text-xs font-bold leading-none truncate ${visuals.typeTextColor}`}
                              >
                                {visuals.typeLabel}
                              </span>
                              {(notif.type === "reservation_submitted" ||
                                notif.type === "series_submitted") &&
                                getReservationStatusLabel(
                                  notif.reservation_status,
                                ) && (
                                  <>
                                    <span
                                      className="text-stone-300 text-[10px] leading-none"
                                      aria-hidden="true"
                                    >
                                      -
                                    </span>
                                    <span
                                      className={`inline-flex items-center px-1.5 py-0.5 rounded-md text-[10px] sm:text-[11px] font-bold leading-none ${getStatusColor(
                                        notif.reservation_status,
                                      )}`}
                                    >
                                      {getReservationStatusLabel(
                                        notif.reservation_status,
                                      )}
                                    </span>
                                  </>
                                )}
                              <span
                                className="text-stone-300 text-[10px] leading-none"
                                aria-hidden="true"
                              >
                                ·
                              </span>
                              <span className="text-[10px] text-stone-400 font-medium leading-none whitespace-nowrap tabular-nums">
                                {timeAgo}
                              </span>
                              {isUnread && (
                                <span className="w-1.5 h-1.5 rounded-full bg-amber-600 animate-pulse shrink-0" />
                              )}
                            </div>

                            {/* Mark as read trigger */}
                            {isUnread && (
                              <button
                                type="button"
                                onClick={(e) => handleMarkAsRead(notif.id, e)}
                                className="shrink-0 w-6 h-6 -my-1 -mr-1 flex items-center justify-center text-stone-400 hover:text-emerald-700 hover:bg-emerald-50 active:bg-emerald-100 rounded-full transition cursor-pointer touch-manipulation"
                                title={t("notifications.markAsReadTooltip")}
                                aria-label={t(
                                  "notifications.markAsReadTooltip",
                                )}
                              >
                                <Check className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>

                          {/* Row 2: Message preview */}
                          <div className="text-[11px] sm:text-xs text-stone-700 leading-snug break-words">
                            <p
                              className={`${
                                isCompact && !isExpanded
                                  ? "line-clamp-1 sm:line-clamp-2"
                                  : "line-clamp-none"
                              } ${isUnread ? "font-medium text-stone-900" : ""}`}
                            >
                              {messageText}
                            </p>
                            {messageText.length > 90 && isCompact && (
                              <button
                                type="button"
                                onClick={(e) => toggleExpanded(notif.id, e)}
                                className="text-[10px] text-amber-800 hover:text-amber-950 font-bold mt-0.5 inline-flex items-center gap-0.5 cursor-pointer touch-manipulation"
                              >
                                <span>
                                  {isExpanded
                                    ? t("notifications.collapse", "Less")
                                    : t("notifications.expand", "More")}
                                </span>
                                <ChevronDown
                                  className={`w-2.5 h-2.5 transition-transform ${isExpanded ? "rotate-180" : ""}`}
                                />
                              </button>
                            )}
                          </div>

                          {/* Row 3: Compact Metadata Chips & Actions strip */}
                          <div className="flex items-center gap-1.5 pt-0.5 flex-wrap">
                            {/* Instrument / Service Chip */}
                            {notif.reservation_id && (
                              <div className="inline-flex items-center gap-1 text-[10px] sm:text-[10.5px] font-semibold text-stone-700 bg-stone-100/90 group-hover:bg-amber-50 px-1.5 py-0.5 rounded-md border border-stone-200/60 max-w-[200px] truncate transition">
                                <Music2 className="w-2.5 h-2.5 text-stone-500 shrink-0" />
                                <span className="truncate">
                                  {notif.service_name ||
                                    notif.instrument_name ||
                                    t("notifications.reservationFallback")}
                                </span>
                              </div>
                            )}

                            {/* Member profile tag (Admins) */}
                            {isAdminViewer &&
                              onOpenUserProfile &&
                              notifUserId && (
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    onOpenUserProfile(notifUserId);
                                  }}
                                  className="inline-flex items-center gap-1 text-[10px] font-semibold text-amber-900 bg-amber-50 hover:bg-amber-100 active:bg-amber-200 px-1.5 py-0.5 rounded-md border border-amber-200/80 transition cursor-pointer touch-manipulation"
                                  title="View Member Profile"
                                >
                                  <User className="w-2.5 h-2.5 text-amber-800" />
                                  <span className="truncate max-w-[110px]">
                                    {notifUserName ||
                                      t(
                                        "notifications.memberLabel",
                                        "Member",
                                      )}
                                  </span>
                                  <ExternalLink className="w-2 h-2 text-amber-700/60" />
                                </button>
                              )}

                            {/* Admin Quick Action Buttons (Pending Requests) */}
                            {isAdminViewer &&
                              (notif.type === "reservation_submitted" ||
                                notif.type === "series_submitted") &&
                              notif.reservation_status === "pending" && (
                                <div
                                  className="flex items-center gap-1 ms-auto"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  <button
                                    type="button"
                                    onClick={(e) =>
                                      handleApproveFromNotification(notif, e)
                                    }
                                    disabled={actioningId === notif.id}
                                    className="h-6 px-2 text-[10px] font-bold rounded-md bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white flex items-center gap-1 active:scale-95 transition shadow-2xs cursor-pointer touch-manipulation disabled:opacity-50"
                                  >
                                    {actioningId === notif.id ? (
                                      <div className="w-2.5 h-2.5 border-1.5 border-white border-t-transparent rounded-full animate-spin" />
                                    ) : (
                                      <Check className="w-3 h-3" />
                                    )}
                                    <span>{t("notifications.approve")}</span>
                                  </button>

                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setRejectingNotif(notif);
                                      setRejectReason("");
                                    }}
                                    disabled={actioningId === notif.id}
                                    className="h-6 px-2 text-[10px] font-bold rounded-md bg-stone-100 hover:bg-red-50 text-stone-700 hover:text-red-700 border border-stone-200 hover:border-red-200 flex items-center gap-1 active:scale-95 transition cursor-pointer touch-manipulation disabled:opacity-50"
                                  >
                                    <X className="w-3 h-3" />
                                    <span>{t("notifications.reject")}</span>
                                  </button>
                                </div>
                              )}

                            {/* Chevron hint to open reservation (if no admin buttons on that line) */}
                            {notif.reservation_id &&
                              !(
                                isAdminViewer &&
                                (notif.type === "reservation_submitted" ||
                                  notif.type === "series_submitted") &&
                                notif.reservation_status === "pending"
                              ) && (
                                <div className="ms-auto flex items-center gap-0.5 text-stone-400 group-hover:text-amber-800 text-[10px] font-semibold transition">
                                  <span className="hidden xs:inline">
                                    {notif.type === "reservation_message"
                                      ? t("notifications.openChat")
                                      : t("notifications.viewDetails")}
                                  </span>
                                  <ChevronRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform rtl:rotate-180" />
                                </div>
                              )}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ═════════ Mobile Reject Reason Drawer / Sheet ═════════ */}
      {rejectingNotif && (
        <div
          className="fixed inset-0 z-[120] bg-black/60 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-150"
          onClick={() => {
            setRejectingNotif(null);
            setRejectReason("");
          }}
        >
          <div
            className="bg-white w-full sm:max-w-md rounded-t-3xl sm:rounded-2xl border border-stone-200 p-4 sm:p-5 shadow-2xl space-y-3.5 max-h-[85vh] overflow-y-auto animate-in slide-in-from-bottom duration-200"
            onClick={(e) => e.stopPropagation()}
            dir={isRTL ? "rtl" : "ltr"}
          >
            {/* Grab handle for touch ergonomics */}
            <div className="w-10 h-1 bg-stone-300 rounded-full mx-auto sm:hidden -mt-1 mb-2" />

            {/* Sheet Title */}
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-red-100 text-red-700 flex items-center justify-center shrink-0">
                  <XCircle className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <h3 className="text-sm font-bold text-stone-900 leading-tight">
                    {rejectingNotif.series_id
                      ? t("notifications.rejectSeries")
                      : t("notifications.reject")}
                  </h3>
                  <p className="text-[11px] text-stone-500 truncate max-w-[230px]">
                    {rejectingNotif.service_name ||
                      rejectingNotif.instrument_name ||
                      t("notifications.reservationFallback")}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setRejectingNotif(null);
                  setRejectReason("");
                }}
                className="w-8 h-8 rounded-full flex items-center justify-center text-stone-400 hover:text-stone-700 hover:bg-stone-100 transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Quick Reason Presets */}
            <div className="space-y-1.5">
              <label className="block text-[11px] font-bold text-stone-800">
                {t("notifications.rejectReasonRequired")}
              </label>
              <div className="flex flex-wrap gap-1">
                {REJECTION_REASON_PRESETS.map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => setRejectReason(preset)}
                    className={`text-[11px] px-2.5 py-1 rounded-lg border font-medium transition cursor-pointer touch-manipulation active:scale-95 ${
                      rejectReason === preset
                        ? "bg-stone-900 text-white border-stone-900 shadow-2xs"
                        : "bg-stone-50 text-stone-700 border-stone-200 hover:bg-stone-100"
                    }`}
                  >
                    {t(`presets.rejection.${preset}`, preset)}
                  </button>
                ))}
              </div>
            </div>

            {/* Textarea */}
            <div>
              <textarea
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                placeholder={t("notifications.rejectReasonPlaceholder")}
                rows={3}
                className="w-full text-xs px-3 py-2 rounded-xl border border-stone-300 focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-600 bg-white text-stone-900 resize-none"
                autoFocus
              />
            </div>

            {/* Actions */}
            <div className="flex items-center justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => {
                  setRejectingNotif(null);
                  setRejectReason("");
                }}
                disabled={actioningId === rejectingNotif.id}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-stone-600 hover:bg-stone-100 active:bg-stone-200 transition cursor-pointer touch-manipulation"
              >
                {t("common.cancel")}
              </button>
              <button
                type="button"
                onClick={(e) => handleConfirmReject(rejectingNotif, e)}
                disabled={
                  !rejectReason.trim() || actioningId === rejectingNotif.id
                }
                className="px-4 py-2 rounded-xl text-xs font-bold bg-red-600 hover:bg-red-700 active:bg-red-800 text-white disabled:opacity-50 transition cursor-pointer flex items-center gap-1.5 touch-manipulation shadow-2xs"
              >
                {actioningId === rejectingNotif.id ? (
                  <>
                    <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>{t("notifications.rejecting")}</span>
                  </>
                ) : (
                  <span>
                    {rejectingNotif.series_id
                      ? t("notifications.confirmRejectSeries")
                      : t("notifications.confirmReject")}
                  </span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default NotificationsModal;
