import React, { useState, useEffect, useRef, useMemo } from "react";
import { useTranslation } from "react-i18next";
import {
  MessageSquare,
  Send,
  Search,
  X,
  Calendar,
  Music,
  Check,
  CheckCheck,
  Sparkles,
  ExternalLink,
  ArrowLeft,
  Shield,
  Clock,
  CalendarPlus,
  Repeat,
  User,
  Phone,
  Lock,
  ArrowDown,
  ChevronDown,
} from "lucide-react";
import { useAuth } from "../contexts/AuthContext.tsx";
import { LoadingSpinner } from "./shared/LoadingSpinner.tsx";
import { formatDisplayDate, formatHhmmTo12Hour } from "../lib/date-utils.js";
import { getStatusColor } from "../lib/status-colors.ts";
import { getReservationInstrumentDisplayName } from "../lib/instrument-display";

/**
 * Option A (Grace Period Lifecycle):
 * - pending, approved, ongoing: open
 * - completed: open for 48 hours after end_time, then closed
 * - rejected, auto_rejected: open for 48 hours after creation, then closed
 * - cancelled, expired: closed immediately
 */
export const getThreadClosureStatus = (
  r: any,
): { isClosed: boolean; inGracePeriod: boolean; reason?: string } => {
  if (!r) return { isClosed: false, inGracePeriod: false };
  const status = r.status;
  const now = Date.now();
  const GRACE_PERIOD_MS = 48 * 60 * 60 * 1000;

  if (status === "cancelled" || status === "expired") {
    return { isClosed: true, inGracePeriod: false, reason: status };
  }

  if (status === "completed") {
    const endStr = r.end_time || r.endTime;
    const endMs = endStr ? new Date(endStr).getTime() : 0;
    if (endMs && now - endMs > GRACE_PERIOD_MS) {
      return { isClosed: true, inGracePeriod: false, reason: "completed" };
    }
    return { isClosed: false, inGracePeriod: true, reason: "completed_grace" };
  }

  if (status === "rejected" || status === "auto_rejected") {
    const createdStr = r.created_at || r.createdAt || r.reservation_created_at;
    const createdMs = createdStr ? new Date(createdStr).getTime() : 0;
    if (createdMs && now - createdMs > GRACE_PERIOD_MS) {
      return { isClosed: true, inGracePeriod: false, reason: "rejected" };
    }
    return { isClosed: false, inGracePeriod: true, reason: "rejected_grace" };
  }

  return { isClosed: false, inGracePeriod: false };
};

export interface ReservationChatViewProps {
  mode?: "user" | "admin";
  onOpenReservationDetail?: (reservationId: string) => void;
  onNavigateToCalendar?: () => void;
  onUnreadChatCountChange?: (count: number) => void;
  onOpenUserProfile?: (userId: string) => void;
  preselectedReservationId?: string | null;

  // Optional controlled props from parent admin portal hook
  conversations?: any[];
  loadingConversations?: boolean;
  activeConversationMessages?: any[];
  loadingConversationMessages?: boolean;
  unreadMessageCount?: number;
  conversationFilter?: "all" | "unread" | "active" | "closed" | "has_messages";
  setConversationFilter?: (
    filter: "all" | "unread" | "active" | "closed" | "has_messages",
  ) => void;
  selectConversation?: (conv: any) => void;
  sendChatMessage?: (customText?: string) => Promise<void> | void;
  selectedMsgReservation?: any;
  setSelectedMsgReservation?: (r: any) => void;
  messageText?: string;
  setMessageText?: (text: string) => void;
  handleSendMessage?: (e: React.FormEvent) => void;
  sendingMessage?: boolean;

  // Backwards compatibility props
  reservations?: any[];
  messagingReservations?: any[];
  loadingMessagingReservations?: boolean;
  msgReservationSearch?: string;
  setMsgReservationSearch?: (val: string) => void;
  fetchMessagingReservations?: (term: string) => void;
}

export const ReservationChatView: React.FC<ReservationChatViewProps> = ({
  mode = "user",
  onOpenReservationDetail,
  onNavigateToCalendar,
  onUnreadChatCountChange,
  onOpenUserProfile,
  preselectedReservationId,

  // Controlled props (used if passed by admin portal)
  conversations: propConversations,
  loadingConversations: propLoadingConversations,
  activeConversationMessages: propActiveMessages,
  loadingConversationMessages: propLoadingMessages,
  unreadMessageCount: propUnreadCount,
  conversationFilter: propFilter,
  setConversationFilter: propSetFilter,
  selectConversation: propSelectConversation,
  sendChatMessage: propSendChatMessage,
  selectedMsgReservation: propSelectedReservation,
  setSelectedMsgReservation: propSetSelectedReservation,
  messageText: propMessageText,
  setMessageText: propSetMessageText,
  handleSendMessage: propHandleSendMessage,
  sendingMessage: propSendingMessage,
}) => {
  const { t, i18n } = useTranslation();
  const isRTL = i18n.language === "ar";
  const { sessionToken, profile } = useAuth();
  const isAdmin = mode === "admin";

  // Internal states (used as fallbacks or primary state for user mode)
  const [internalConversations, setInternalConversations] = useState<any[]>([]);
  const [internalLoadingConversations, setInternalLoadingConversations] =
    useState<boolean>(true);
  const [internalSelectedReservation, setInternalSelectedReservation] =
    useState<any | null>(null);

  const [internalActiveMessages, setInternalActiveMessages] = useState<any[]>(
    [],
  );
  const [internalLoadingMessages, setInternalLoadingMessages] =
    useState<boolean>(false);
  const [internalSendingMessage, setInternalSendingMessage] =
    useState<boolean>(false);
  const [internalMessageText, setInternalMessageText] = useState<string>("");

  const [searchTerm, setSearchTerm] = useState<string>("");
  const [internalFilter, setInternalFilter] = useState<
    "all" | "unread" | "active" | "closed" | "has_messages"
  >("all");

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [showScrollBottom, setShowScrollBottom] = useState<boolean>(false);

  const handleScrollToBottom = (smooth = true) => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({
        behavior: smooth ? "smooth" : "auto",
        block: "end",
      });
    }
  };

  const handleMessagesScroll = () => {
    const el = scrollContainerRef.current;
    if (!el) return;
    const distanceToBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    setShowScrollBottom(distanceToBottom > 160);
  };

  // Resolved reactive values (controlled if passed, else internal)
  const conversations = propConversations ?? internalConversations;
  const loadingConversations =
    propLoadingConversations ?? internalLoadingConversations;
  const selectedReservation =
    propSelectedReservation ?? internalSelectedReservation;
  const activeMessages = propActiveMessages ?? internalActiveMessages;
  const loadingMessages = propLoadingMessages ?? internalLoadingMessages;
  const sendingMessage = propSendingMessage ?? internalSendingMessage;
  const messageText = propMessageText ?? internalMessageText;
  const filter = propFilter ?? internalFilter;

  const setFilter = (
    nextFilter: "all" | "unread" | "active" | "closed" | "has_messages",
  ) => {
    if (propSetFilter) {
      propSetFilter(nextFilter);
    } else {
      setInternalFilter(nextFilter);
    }
  };

  const setMessageText = (val: string) => {
    if (propSetMessageText) {
      propSetMessageText(val);
    } else {
      setInternalMessageText(val);
    }
  };

  const setSelectedReservation = (conv: any) => {
    if (propSetSelectedReservation) {
      propSetSelectedReservation(conv);
    } else {
      setInternalSelectedReservation(conv);
    }
  };

  // Quick inquiry chips for church members
  const memberQuickReplies = [
    {
      key: "earlyPickup",
      text: t(
        "userChat.quickReplyEarlyPickup",
        "Can we pick up the instrument 30 mins early for rehearsal?",
      ),
    },
    {
      key: "keyPickup",
      text: t(
        "userChat.quickReplyKeyPickup",
        "Where should I collect the church room/equipment key?",
      ),
    },
    {
      key: "paymentReceipt",
      text: t(
        "userChat.quickReplyPaymentReceipt",
        "I have uploaded the outside booking payment receipt.",
      ),
    },
    {
      key: "scheduleChange",
      text: t(
        "userChat.quickReplyScheduleChange",
        "Can we adjust our rehearsal schedule slightly?",
      ),
    },
  ];

  // Quick reply presets for church administrators
  const adminQuickReplies = [
    {
      key: "approved",
      text: t(
        "admin.messaging.quickReplyApproved",
        "Your reservation has been approved. You can pick up the instrument on time.",
      ),
    },
    {
      key: "outsideFee",
      text: t(
        "admin.messaging.quickReplyOutsideFee",
        "Please upload the InstaPay transfer screenshot to confirm your outside booking.",
      ),
    },
    {
      key: "instructions",
      text: t(
        "admin.messaging.quickReplyInstructions",
        "Please collect the instrument key from the church equipment room and return it locked after usage.",
      ),
    },
    {
      key: "contactUs",
      text: t(
        "admin.messaging.quickReplyContactUs",
        "Please contact church administration for schedule adjustments.",
      ),
    },
  ];

  const quickReplies = isAdmin ? adminQuickReplies : memberQuickReplies;

  // Fetch conversations (internal if not controlled)
  const fetchConversations = async (silent = false) => {
    if (propConversations !== undefined) return;
    if (!sessionToken) return;
    if (!silent) setInternalLoadingConversations(true);

    const endpoint = isAdmin
      ? "/api/admin/conversations"
      : "/api/reservations/user-conversations";

    try {
      const res = await fetch(endpoint, {
        headers: { Authorization: `Bearer ${sessionToken}` },
      });
      const data = await res.json();
      if (data.success && Array.isArray(data.conversations)) {
        setInternalConversations(data.conversations);

        const unreadTotal = data.conversations.reduce(
          (sum: number, c: any) => sum + Number(c.unread_count || 0),
          0,
        );
        onUnreadChatCountChange?.(unreadTotal);

        if (preselectedReservationId && !selectedReservation) {
          const match = data.conversations.find(
            (c: any) => c.id === preselectedReservationId,
          );
          if (match) {
            handleSelectConversation(match);
          }
        }
      }
    } catch (err) {
      console.warn("Failed to load conversations:", err);
    } finally {
      if (!silent) setInternalLoadingConversations(false);
    }
  };

  // Fetch messages for active thread (internal if not controlled)
  const fetchMessages = async (reservationId: string, silent = false) => {
    if (propActiveMessages !== undefined && propSelectConversation) return;
    if (!reservationId || !sessionToken) return;
    if (!silent) setInternalLoadingMessages(true);
    try {
      const res = await fetch(`/api/reservations/${reservationId}/messages`, {
        headers: { Authorization: `Bearer ${sessionToken}` },
      });
      const data = await res.json();
      if (data.success && Array.isArray(data.messages)) {
        setInternalActiveMessages(data.messages);
      }
    } catch (err) {
      console.warn("Failed to load messages:", err);
    } finally {
      if (!silent) setInternalLoadingMessages(false);
    }
  };

  // Mark messages as read for active thread
  const markAsRead = async (reservationId: string) => {
    if (!reservationId || !sessionToken) return;
    try {
      const endpoint = isAdmin
        ? `/api/admin/conversations/${reservationId}/mark-read`
        : `/api/reservations/${reservationId}/mark-user-read`;

      await fetch(endpoint, {
        method: "POST",
        headers: { Authorization: `Bearer ${sessionToken}` },
      });

      // Optimistically update conversation unread badge
      if (propConversations === undefined) {
        setInternalConversations((prev) =>
          prev.map((c) =>
            c.id === reservationId ? { ...c, unread_count: 0 } : c,
          ),
        );
      }
    } catch {
      // non-fatal
    }
  };

  // Select a conversation item
  const handleSelectConversation = (conv: any) => {
    if (propSelectConversation) {
      propSelectConversation(conv);
    } else {
      setSelectedReservation(conv);
      if (conv?.id) {
        fetchMessages(conv.id);
        if (Number(conv.unread_count || 0) > 0) {
          markAsRead(conv.id);
        }
      }
    }
  };

  // Initial fetch and auto-selection of preselected reservation
  useEffect(() => {
    if (propConversations === undefined) {
      fetchConversations();
    }
  }, [sessionToken, isAdmin, propConversations]);

  // Handle dynamically changing preselectedReservationId
  useEffect(() => {
    if (preselectedReservationId && conversations.length > 0) {
      const match = conversations.find(
        (c: any) => c.id === preselectedReservationId,
      );
      if (match && selectedReservation?.id !== preselectedReservationId) {
        handleSelectConversation(match);
      }
    }
  }, [preselectedReservationId, conversations]);

  // Polling for conversations and unread status every 12 seconds
  useEffect(() => {
    if (propConversations !== undefined) return;
    const timer = setInterval(() => {
      fetchConversations(true);
    }, 12000);
    return () => clearInterval(timer);
  }, [sessionToken, isAdmin, propConversations]);

  // Polling for active thread messages every 8 seconds
  useEffect(() => {
    if (!selectedReservation?.id) return;
    if (propActiveMessages !== undefined) return;
    const msgTimer = setInterval(() => {
      fetchMessages(selectedReservation.id, true);
    }, 8000);
    return () => clearInterval(msgTimer);
  }, [selectedReservation?.id, sessionToken, propActiveMessages]);

  // Auto-scroll to latest message
  useEffect(() => {
    handleScrollToBottom(true);
  }, [activeMessages.length, loadingMessages]);

  // Dynamic auto-grow composer textarea height
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = `${Math.min(
        Math.max(textareaRef.current.scrollHeight, 40),
        120,
      )}px`;
    }
  }, [messageText, selectedReservation?.id]);

  // Send message
  const handleSendMessage = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (propSendChatMessage) {
      await propSendChatMessage();
      return;
    }
    if (propHandleSendMessage) {
      propHandleSendMessage(e || ({ preventDefault: () => {} } as any));
      return;
    }

    const content = messageText.trim();
    if (!content || !selectedReservation?.id || sendingMessage) return;

    setInternalSendingMessage(true);
    try {
      const res = await fetch(
        `/api/reservations/${selectedReservation.id}/messages`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${sessionToken || ""}`,
          },
          body: JSON.stringify({
            content,
            senderRole: isAdmin ? "admin" : "user",
            senderName:
              profile?.name ||
              (isAdmin ? "Church Administration" : "Church Member"),
          }),
        },
      );
      const data = await res.json();
      if (data.success && data.message) {
        setMessageText("");
        setInternalActiveMessages((prev) => [...prev, data.message]);

        // Optimistically update latest message snippet in conversations list
        setInternalConversations((prev) =>
          prev.map((c) =>
            c.id === selectedReservation.id
              ? {
                  ...c,
                  latest_message_content: data.message.content,
                  latest_sender_role: data.message.sender_role,
                  latest_sender_name: data.message.sender_name,
                  latest_message_at: data.message.created_at,
                  total_messages: Number(c.total_messages || 0) + 1,
                }
              : c,
          ),
        );
      }
    } catch (err) {
      console.warn("Failed to send message:", err);
    } finally {
      setInternalSendingMessage(false);
      setTimeout(() => {
        textareaRef.current?.focus();
      }, 50);
    }
  };

  // Quick reply chip click
  const handleQuickReply = (text: string) => {
    setMessageText(text);
    if (textareaRef.current) {
      textareaRef.current.focus();
    }
  };

  // Keyboard shortcut: Enter to send, Shift+Enter for newline
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  // Filtering conversations
  const filteredConversations = useMemo(() => {
    let list = [...conversations];

    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase().trim();
      list = list.filter((c) => {
        const sName = (c.service_name || "").toLowerCase();
        const iName = (c.instrument_name || c.requested_type || "").toLowerCase();
        const iAlias = (c.instrument_alias || "").toLowerCase();
        const mName = (c.musician_name || c.user_name || "").toLowerCase();
        const uPhone = (c.user_phone || "").toLowerCase();
        const uEmail = (c.user_email || "").toLowerCase();
        const content = (c.latest_message_content || "").toLowerCase();
        return (
          sName.includes(term) ||
          iName.includes(term) ||
          iAlias.includes(term) ||
          mName.includes(term) ||
          uPhone.includes(term) ||
          uEmail.includes(term) ||
          content.includes(term)
        );
      });
    }

    if (filter === "unread") {
      list = list.filter((c) => Number(c.unread_count || 0) > 0);
    } else if (filter === "active" || filter === "has_messages") {
      // An active reservation thread is open (lifecycle not ended)
      list = list.filter((c) => !getThreadClosureStatus(c).isClosed);
    } else if (filter === "closed") {
      // Closed reservation threads (lifecycle ended, read-only)
      list = list.filter((c) => getThreadClosureStatus(c).isClosed);
    }

    list.sort((a, b) => {
      const aUnread = Number(a.unread_count || 0) > 0 ? 1 : 0;
      const bUnread = Number(b.unread_count || 0) > 0 ? 1 : 0;
      if (aUnread !== bUnread) return bUnread - aUnread;

      const aTime = new Date(
        a.sort_time || a.latest_message_at || a.reservation_created_at || a.created_at || 0,
      ).getTime();
      const bTime = new Date(
        b.sort_time || b.latest_message_at || b.reservation_created_at || b.created_at || 0,
      ).getTime();
      return bTime - aTime;
    });

    return list;
  }, [conversations, searchTerm, filter]);

  // Overall counts for tabs
  const totalAllCount = conversations.length;
  const totalUnreadCount = useMemo(
    () =>
      conversations.reduce(
        (sum, c) => sum + (Number(c.unread_count || 0) > 0 ? 1 : 0),
        0,
      ),
    [conversations],
  );
  const totalActiveCount = useMemo(
    () =>
      conversations.reduce(
        (sum, c) => sum + (!getThreadClosureStatus(c).isClosed ? 1 : 0),
        0,
      ),
    [conversations],
  );
  const totalClosedCount = useMemo(
    () =>
      conversations.reduce(
        (sum, c) => sum + (getThreadClosureStatus(c).isClosed ? 1 : 0),
        0,
      ),
    [conversations],
  );

  // Time formatters
  const formatTimeAgo = (dateStr?: string | Date) => {
    if (!dateStr) return "";
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return "";

    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1)
      return t("notifications.justNow", { defaultValue: "Just now" });
    if (diffMins < 60)
      return t("notifications.minutesAgo", {
        count: diffMins,
        defaultValue: `${diffMins}m ago`,
      });
    if (diffHours < 24)
      return t("notifications.hoursAgo", {
        count: diffHours,
        defaultValue: `${diffHours}h ago`,
      });
    if (diffDays === 1)
      return t("notifications.groupYesterday", { defaultValue: "Yesterday" });
    if (diffDays < 7) return `${diffDays}d ago`;

    const dateOnly = typeof dateStr === "string" ? dateStr.split("T")[0] : "";
    if (dateOnly && /^\d{4}-\d{2}-\d{2}$/.test(dateOnly)) {
      return formatDisplayDate(dateOnly);
    }
    return date.toLocaleDateString(isRTL ? "ar-u-nu-latn" : "en-US", {
      month: "short",
      day: "numeric",
    });
  };

  const formatMessageTime = (dateStr?: string | Date) => {
    if (!dateStr) return "";
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return "";
    const now = new Date();
    const isToday =
      date.getFullYear() === now.getFullYear() &&
      date.getMonth() === now.getMonth() &&
      date.getDate() === now.getDate();

    try {
      const timePart = new Intl.DateTimeFormat(
        i18n.language === "ar" ? "ar-EG" : "en-US",
        {
          hour: "numeric",
          minute: "numeric",
          hour12: true,
        },
      ).format(date);

      if (isToday) return timePart;

      const datePart = new Intl.DateTimeFormat(
        i18n.language === "ar" ? "ar-EG" : "en-US",
        {
          month: "short",
          day: "numeric",
        },
      ).format(date);

      return `${datePart}, ${timePart}`;
    } catch {
      return date.toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      });
    }
  };

  const formatReservationSlot = (r: any) => {
    if (!r) return "";
    const startStr = r.start_time || r.startTime;
    const endStr = r.end_time || r.endTime;
    if (!startStr) return "";

    try {
      const startDate = new Date(startStr);
      const endDate = endStr ? new Date(endStr) : null;
      const datePart = formatDisplayDate(startStr.slice(0, 10));

      const startHhmm = `${String(startDate.getHours()).padStart(2, "0")}:${String(
        startDate.getMinutes(),
      ).padStart(2, "0")}`;
      const endHhmm = endDate
        ? `${String(endDate.getHours()).padStart(2, "0")}:${String(
            endDate.getMinutes(),
          ).padStart(2, "0")}`
        : "";

      const timeRange = endHhmm
        ? `${formatHhmmTo12Hour(startHhmm)} - ${formatHhmmTo12Hour(endHhmm)}`
        : formatHhmmTo12Hour(startHhmm);

      return `${datePart} • ${timeRange}`;
    } catch {
      return "";
    }
  };

  const formatReservationDateTime = (r: any) => {
    if (!r) return "";
    const startStr = r.start_time || r.startTime;
    const endStr = r.end_time || r.endTime;

    let dateFormatted = "";
    if (startStr) {
      dateFormatted = formatDisplayDate(startStr.slice(0, 10));
    } else if (r.reservation_date) {
      dateFormatted = formatDisplayDate(r.reservation_date);
    }

    let timeFormatted = "";
    if (startStr) {
      try {
        const s = new Date(startStr);
        const e = endStr ? new Date(endStr) : null;
        const sh = `${String(s.getHours()).padStart(2, "0")}:${String(
          s.getMinutes(),
        ).padStart(2, "0")}`;
        const eh = e
          ? `${String(e.getHours()).padStart(2, "0")}:${String(
              e.getMinutes(),
            ).padStart(2, "0")}`
          : "";
        timeFormatted = eh
          ? `${formatHhmmTo12Hour(sh)} - ${formatHhmmTo12Hour(eh)}`
          : formatHhmmTo12Hour(sh);
      } catch {
        timeFormatted = "";
      }
    }

    if (dateFormatted && timeFormatted) {
      return `${dateFormatted} - ${timeFormatted}`;
    }
    return dateFormatted || timeFormatted || formatReservationSlot(r);
  };

  const getStatusBadgeClass = (status?: string) => {
    return getStatusColor(status || "");
  };

  const activeId = selectedReservation?.id;
  const selectedThreadStatus = getThreadClosureStatus(selectedReservation);

  return (
    <div className="bg-white border border-stone-200 sm:rounded-2xl shadow-2xs overflow-hidden flex flex-col h-[calc(100dvh-130px)] sm:h-[calc(100dvh-150px)] min-h-[460px] sm:min-h-[520px] max-h-[920px] transition-all">
      {/* Top Header Bar */}
      <div className="px-3 sm:px-5 py-2 sm:py-3.5 border-b border-stone-100 bg-stone-50/70 flex items-center justify-between gap-2 shrink-0">
        <div className="flex items-center gap-2 sm:gap-2.5 min-w-0">
          {/* Mobile Back button in top Chat header so it never covers reservation user details */}
          {selectedReservation && (
            <button
              type="button"
              onClick={() => setSelectedReservation(null)}
              className="lg:hidden h-8 px-2.5 rounded-xl border border-stone-200 bg-white hover:bg-stone-100 active:bg-stone-200 text-stone-800 transition cursor-pointer flex items-center gap-1.5 shrink-0 touch-manipulation shadow-2xs"
              aria-label={t("common.back", "Back")}
              title={t("common.back", "Back")}
            >
              <ArrowLeft className="w-4 h-4 rtl:rotate-180 text-amber-900" />
              <span className="text-xs font-bold text-amber-900">
                {t("common.back", "Back")}
              </span>
            </button>
          )}

          <div className="w-7 h-7 sm:w-9 sm:h-9 rounded-xl bg-amber-800 text-white flex items-center justify-center shadow-2xs shrink-0">
            <MessageSquare className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 sm:gap-2">
              <h2 className="font-bold text-stone-900 text-xs sm:text-base leading-tight truncate">
                {t("nav.chat", "Chat")}
              </h2>
              {totalUnreadCount > 0 && (
                <span className="px-1.5 sm:px-2 py-0.2 sm:py-0.5 rounded-full text-[10px] sm:text-[11px] font-extrabold bg-yellow-400 text-yellow-950 border border-yellow-500/40 shadow-2xs animate-pulse shrink-0">
                  {t("admin.messaging.unreadBadge", {
                    count: totalUnreadCount,
                    defaultValue: `${totalUnreadCount} new`,
                  })}
                </span>
              )}
            </div>
            <p className="text-xs text-stone-500 mt-0.5 hidden sm:block truncate">
              {t(
                "userChat.subtitle",
                "Real-time coordination and messaging for instrument reservations.",
              )}
            </p>
          </div>
        </div>

        <div
          className={`${
            selectedReservation ? "hidden sm:flex" : "flex"
          } items-center gap-1.5 sm:gap-2 text-xs font-semibold text-stone-500 shrink-0`}
        >
          <span className="px-2 sm:px-2.5 py-0.5 sm:py-1 bg-stone-200/70 rounded-lg text-[10px] sm:text-[11px] font-bold text-stone-700">
            {isAdmin
              ? t("admin.messaging.totalChatsCount", {
                  count: totalAllCount,
                  defaultValue: `${totalAllCount} conversations`,
                })
              : t("userChat.totalBookingsCount", {
                  count: totalAllCount,
                  defaultValue: `${totalAllCount} Bookings`,
                })}
          </span>
        </div>
      </div>

      {/* Main Two-Pane Messenger Layout */}
      <div className="flex-1 min-h-0 overflow-hidden flex flex-col lg:grid lg:grid-cols-12 divide-y lg:divide-y-0 lg:divide-x divide-stone-200 rtl:lg:divide-x-reverse">
        {/* Left Pane: Conversations List (5 Cols ~ 1/3) */}
        <div
          className={`${
            selectedReservation ? "hidden lg:flex" : "flex"
          } lg:col-span-5 flex-col bg-stone-50/40 min-h-0 h-full overflow-hidden`}
        >
          {/* Search & Filter Controls */}
          <div className="p-3 border-b border-stone-200 bg-white space-y-2.5 shrink-0">
            {/* Search Input */}
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-stone-400 absolute left-3 top-2.5 rtl:left-auto rtl:right-3 pointer-events-none" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder={
                  isAdmin
                    ? t(
                        "admin.messaging.searchPlaceholder",
                        "Search member, phone, instrument, service...",
                      )
                    : t(
                        "userChat.searchPlaceholder",
                        "Search booking, instrument, service...",
                      )
                }
                className="w-full pl-8 pr-8 rtl:pl-8 rtl:pr-8 py-2 bg-stone-50 border border-stone-200 rounded-xl text-xs text-stone-900 placeholder:text-stone-400 focus:outline-none focus:border-amber-700 focus:bg-white transition"
              />
              {searchTerm && (
                <button
                  type="button"
                  onClick={() => setSearchTerm("")}
                  className="absolute right-2.5 top-2.5 rtl:right-auto rtl:left-2.5 text-stone-400 hover:text-stone-600 p-0.5 cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Filter Tabs: [ All ] [ Unread ] [ Active ] [ Closed ] */}
            <div className="flex items-center gap-1.5 pt-0.5 overflow-x-auto scrollbar-none touch-manipulation">
              <button
                type="button"
                onClick={() => setFilter("all")}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer flex items-center gap-1.5 shrink-0 touch-manipulation active:scale-95 ${
                  filter === "all"
                    ? "bg-amber-800 text-white shadow-2xs"
                    : "bg-stone-100 text-stone-700 hover:bg-stone-200/80"
                }`}
              >
                <span>{t("admin.messaging.allConversations", "All")}</span>
                <span
                  className={`text-[10px] px-1.5 py-0.2 rounded-full font-extrabold ${
                    filter === "all"
                      ? "bg-amber-900/60 text-white"
                      : "bg-stone-200 text-stone-600"
                  }`}
                >
                  {totalAllCount}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setFilter("unread")}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer flex items-center gap-1.5 shrink-0 touch-manipulation active:scale-95 ${
                  filter === "unread"
                    ? "bg-amber-800 text-white shadow-2xs"
                    : totalUnreadCount > 0
                      ? "bg-yellow-50 text-yellow-900 border border-yellow-300 hover:bg-yellow-100"
                      : "bg-stone-100 text-stone-700 hover:bg-stone-200/80"
                }`}
              >
                <span>{t("admin.messaging.unreadOnly", "Unread")}</span>
                <span
                  className={`text-[10px] px-1.5 py-0.2 rounded-full font-black ${
                    filter === "unread"
                      ? "bg-white text-amber-900"
                      : totalUnreadCount > 0
                        ? "bg-yellow-400 text-yellow-950"
                        : "bg-stone-200 text-stone-600"
                  }`}
                >
                  {totalUnreadCount}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setFilter("active")}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer flex items-center gap-1.5 shrink-0 touch-manipulation active:scale-95 ${
                  filter === "active" || filter === "has_messages"
                    ? "bg-amber-800 text-white shadow-2xs"
                    : "bg-stone-100 text-stone-700 hover:bg-stone-200/80"
                }`}
              >
                <span>{t("admin.messaging.withMessages", "Active")}</span>
                <span
                  className={`text-[10px] px-1.5 py-0.2 rounded-full font-extrabold ${
                    filter === "active" || filter === "has_messages"
                      ? "bg-amber-900/60 text-white"
                      : "bg-stone-200 text-stone-600"
                  }`}
                >
                  {totalActiveCount}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setFilter("closed")}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer flex items-center gap-1.5 shrink-0 touch-manipulation active:scale-95 ${
                  filter === "closed"
                    ? "bg-amber-800 text-white shadow-2xs"
                    : "bg-stone-100 text-stone-700 hover:bg-stone-200/80"
                }`}
              >
                <Lock className="w-3 h-3 text-stone-400" />
                <span>{t("admin.messaging.closedOnly", "Closed")}</span>
                <span
                  className={`text-[10px] px-1.5 py-0.2 rounded-full font-extrabold ${
                    filter === "closed"
                      ? "bg-amber-900/60 text-white"
                      : "bg-stone-200 text-stone-600"
                  }`}
                >
                  {totalClosedCount}
                </span>
              </button>

              {loadingConversations && (
                <div className="ms-auto shrink-0">
                  <LoadingSpinner size="xs" color="amber" />
                </div>
              )}
            </div>
          </div>

          {/* Conversations Scrollable List */}
          <div className="flex-1 overflow-y-auto p-2 space-y-1.5">
            {conversations.length === 0 && !loadingConversations ? (
              <div className="py-10 px-4 text-center">
                <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-800 flex items-center justify-center mx-auto mb-3 border border-amber-200 shadow-2xs">
                  <Shield className="w-6 h-6" />
                </div>
                <h3 className="text-xs sm:text-sm font-bold text-stone-800">
                  {isAdmin
                    ? t("admin.messaging.noConversations", "No conversations yet")
                    : t("userChat.noReservationsTitle", "No Reservations Yet")}
                </h3>
                <p className="text-[11px] text-stone-500 mt-1 max-w-xs mx-auto leading-relaxed">
                  {isAdmin
                    ? t(
                        "admin.messaging.emptyState",
                        "When church members submit bookings or inquiries, conversations will appear here.",
                      )
                    : t(
                        "userChat.policyExplanation",
                        "Direct chatting with Church Administration is tied to your instrument reservations. Once you submit a booking, you can coordinate pickup, access, or outside usage here.",
                      )}
                </p>
                {!isAdmin && onNavigateToCalendar && (
                  <button
                    type="button"
                    onClick={onNavigateToCalendar}
                    className="mt-4 px-4 py-2 rounded-xl bg-amber-800 hover:bg-amber-900 text-white text-xs font-bold transition inline-flex items-center gap-1.5 cursor-pointer shadow-xs"
                  >
                    <CalendarPlus className="w-3.5 h-3.5" />
                    <span>
                      {t("userChat.bookInstrumentBtn", "Book an Instrument")}
                    </span>
                  </button>
                )}
              </div>
            ) : filteredConversations.length === 0 ? (
              <div className="py-12 px-4 text-center">
                <div className="w-12 h-12 rounded-2xl bg-stone-100 text-stone-400 flex items-center justify-center mx-auto mb-3">
                  <MessageSquare className="w-6 h-6 stroke-[1.5]" />
                </div>
                <p className="text-xs font-bold text-stone-700">
                  {filter === "unread"
                    ? t(
                        "admin.messaging.noUnreadConversations",
                        "All caught up! No unread messages.",
                      )
                    : t(
                        "admin.messaging.noConversations",
                        "No matching bookings found",
                      )}
                </p>
                <p className="text-[11px] text-stone-400 mt-1 max-w-xs mx-auto">
                  {searchTerm
                    ? t(
                        "admin.approvals.emptyFilteredDesc",
                        "Try adjusting your search keyword.",
                      )
                    : t(
                        "userChat.emptyFilteredHelp",
                        "Switch filters to view all bookings.",
                      )}
                </p>
              </div>
            ) : (
              filteredConversations.map((conv) => {
                const isSelected = activeId === conv.id;
                const unread = Number(conv.unread_count || 0);
                const hasUnread = unread > 0;
                const latestSnippet = conv.latest_message_content || "";
                const isLatestFromAdmin = conv.latest_sender_role === "admin";
                const sortDate =
                  conv.sort_time ||
                  conv.latest_message_at ||
                  conv.reservation_created_at;
                const isRecurring = Boolean(
                  conv.series_id ||
                    conv.seriesId ||
                    (conv.reservation_type &&
                      String(conv.reservation_type).includes("recurring")),
                );
                const serviceName =
                  conv.service_name ||
                  t(
                    "myReservations.churchServiceFallback",
                    "Church Service",
                  );
                const instrumentName =
                  getReservationInstrumentDisplayName(conv, isAdmin) ||
                  conv.requested_type ||
                  "Instrument";
                const dateTimeText = formatReservationDateTime(conv);
                const memberName =
                  conv.user_name || conv.musician_name || "Member";

                const latestMessageTimestamp = conv.latest_message_at || null;

                return (
                  <button
                    key={conv.id}
                    type="button"
                    onClick={() => handleSelectConversation(conv)}
                    className={`w-full text-left rtl:text-right p-2.5 sm:p-3 rounded-xl border transition cursor-pointer relative group flex items-start gap-2.5 sm:gap-3 touch-manipulation active:scale-[0.99] ${
                      isSelected
                        ? "bg-amber-50/90 border-amber-300 ring-1 ring-amber-300 shadow-xs"
                        : hasUnread
                          ? "bg-amber-50/40 border-amber-300/80 hover:border-amber-400 shadow-2xs"
                          : "bg-white border-stone-200/90 hover:bg-stone-50 hover:border-stone-300"
                    }`}
                  >
                    {/* Status Dot / Indicator (Music icon for single, Repeat icon for recurring) */}
                    <div className="relative shrink-0 mt-0.5">
                      <div
                        className={`w-9 h-9 sm:w-10 sm:h-10 rounded-xl flex items-center justify-center font-bold text-xs shadow-2xs transition-colors ${
                          isSelected
                            ? "bg-amber-800 text-white"
                            : hasUnread
                              ? "bg-yellow-100 text-yellow-900 border border-yellow-300"
                              : isRecurring
                                ? "bg-amber-100/90 text-amber-900 border border-amber-300"
                                : "bg-stone-100 text-stone-700 border border-stone-200"
                        }`}
                        title={
                          isRecurring
                            ? t(
                                "myReservations.recurringSeries",
                                "Recurring Booking",
                              )
                            : t(
                                "myReservations.singleBooking",
                                "Single Booking",
                              )
                        }
                      >
                        {isRecurring ? (
                          <Repeat className="w-4 h-4" />
                        ) : (
                          <Music className="w-4 h-4" />
                        )}
                      </div>
                      <span
                        className={`absolute -top-1 -right-1 rtl:-right-auto rtl:-left-1 w-2.5 h-2.5 rounded-full border-2 border-white ${
                          hasUnread
                            ? "bg-yellow-400 animate-pulse ring-1 ring-yellow-500/50"
                            : "bg-emerald-500"
                        }`}
                      />
                    </div>

                    {/* Conversation Body */}
                    <div className="flex-1 min-w-0">
                      {/* Row 1 (Above): Service Name - Instrument Name on Left, Reservation Status Badge at Top Right */}
                      <div className="flex items-start justify-between gap-2">
                        <div className="font-bold text-xs text-stone-900 truncate flex-1 min-w-0 flex items-center">
                          <span className="truncate">{serviceName}</span>
                          <span className="mx-1.5 text-stone-400 font-normal shrink-0">
                            -
                          </span>
                          <span className="truncate text-stone-700 font-semibold">
                            {instrumentName}
                          </span>
                          {isAdmin && conv.instrument_alias && (
                            <span className="ms-1.5 inline-flex items-center px-1.5 py-0.2 rounded text-[10px] font-semibold bg-violet-50 text-violet-800 border border-violet-200 shrink-0">
                              {conv.instrument_alias}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          {getThreadClosureStatus(conv).isClosed && (
                            <span
                              className="p-1 rounded font-bold bg-stone-100 text-stone-500 border border-stone-200 flex items-center justify-center shrink-0"
                              title={t("userChat.threadClosedBadge", "Closed")}
                              aria-label={t("userChat.threadClosedBadge", "Closed")}
                            >
                              <Lock className="w-2.5 h-2.5 text-stone-500" />
                            </span>
                          )}
                          {conv.status && (
                            <span
                              className={`text-[9px] px-1.5 py-0.5 rounded font-extrabold uppercase border shrink-0 ${getStatusBadgeClass(
                                conv.status,
                              )}`}
                            >
                              {String(
                                t(`common.${conv.status}`, {
                                  defaultValue: conv.status,
                                }),
                              )}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Extra Row for Admin (Between Row 1 & Row 2): Reservant Name only (without label and without phone) */}
                      {isAdmin && (
                        <div className="flex items-center gap-1.5 mt-1 text-[11px] text-stone-700 truncate">
                          <User className="w-3.5 h-3.5 text-amber-800 shrink-0" />
                          <span className="font-bold text-stone-900 truncate">
                            {memberName}
                          </span>
                        </div>
                      )}

                      {/* Row 2: Date - Time & Last Message Sent Recency Timestamp */}
                      <div className="flex items-center justify-between gap-1.5 mt-1 text-[11px] text-stone-500">
                        <div className="flex items-center gap-1 min-w-0 truncate">
                          <Calendar className="w-3 h-3 text-stone-400 shrink-0" />
                          <span className="font-medium truncate">
                            {dateTimeText}
                          </span>
                        </div>
                        {latestMessageTimestamp && (
                          <span className="text-[10px] font-semibold text-stone-400 shrink-0">
                            {formatTimeAgo(latestMessageTimestamp)}
                          </span>
                        )}
                      </div>

                      {/* Row 3: Snippet Preview & Unread Pill Badge (completely omitted if no messages exchanged) */}
                      {(latestSnippet || hasUnread) && (
                        <div className="flex items-center justify-between gap-2 mt-1.5">
                          <div className="text-[11px] text-stone-600 truncate flex-1 min-w-0">
                            {latestSnippet ? (
                              <span className="truncate">
                                {isAdmin ? (
                                  isLatestFromAdmin ? (
                                    <span className="font-bold text-stone-700">
                                      {t("admin.messaging.youPrefix", "You: ")}
                                    </span>
                                  ) : (
                                    <span className="font-bold text-amber-900">
                                      {memberName}:{" "}
                                    </span>
                                  )
                                ) : isLatestFromAdmin ? (
                                  <span className="font-bold text-amber-900">
                                    {t("userChat.adminPrefix", "Admin: ")}
                                  </span>
                                ) : (
                                  <span className="font-bold text-stone-700">
                                    {t("admin.messaging.youPrefix", "You: ")}
                                  </span>
                                )}
                                &ldquo;{latestSnippet}&rdquo;
                              </span>
                            ) : null}
                          </div>

                          {hasUnread && (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-yellow-400 text-yellow-950 border border-yellow-500/40 shrink-0 shadow-2xs">
                              {unread}{" "}
                              {t("admin.messaging.unreadStatus", "New")}
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* Right Pane: Active Chat Window (7 Cols ~ 2/3) */}
        <div
          className={`${
            selectedReservation ? "flex" : "hidden lg:flex"
          } lg:col-span-7 flex-col bg-white min-h-0 h-full overflow-hidden`}
        >
          {selectedReservation ? (
            <div className="flex flex-col h-full min-h-0">
              {/* Chat Header */}
              <div className="px-2.5 sm:px-4 py-2 sm:py-2.5 border-b border-stone-200 bg-white sm:bg-stone-50/70 shrink-0 space-y-1.5 shadow-2xs sm:shadow-none z-10">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 sm:gap-2.5 min-w-0 flex-1">
                    <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-amber-800 text-white flex items-center justify-center font-bold text-xs shrink-0 shadow-2xs">
                      {isAdmin ? (
                        <User className="w-4 h-4" />
                      ) : (
                        <Shield className="w-4 h-4" />
                      )}
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="font-bold text-xs sm:text-sm text-stone-900 truncate">
                          {isAdmin
                            ? selectedReservation.user_name ||
                              selectedReservation.musician_name ||
                              "Member"
                            : t("userChat.churchAdmin", "Church Administration")}
                        </span>
                        {selectedThreadStatus.isClosed && (
                          <span
                            className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-stone-100 text-stone-600 border border-stone-200 flex items-center gap-0.5 shrink-0"
                            title={t("userChat.threadClosedBadge", "Closed")}
                          >
                            <Lock className="w-2.5 h-2.5 text-stone-500" />
                            <span>{t("userChat.threadClosedBadge", "Closed")}</span>
                          </span>
                        )}
                        {selectedReservation.status && (
                          <span
                            className={`px-1.5 py-0.2 rounded text-[9px] font-extrabold uppercase border ${getStatusBadgeClass(
                              selectedReservation.status,
                            )}`}
                          >
                            {String(
                              t(`common.${selectedReservation.status}`, {
                                defaultValue: selectedReservation.status,
                              }),
                            )}
                          </span>
                        )}
                      </div>
                      <div className="text-[10.5px] sm:text-xs text-stone-500 truncate flex items-center gap-1 font-medium mt-0.5">
                        <span className="text-stone-800 font-semibold truncate">
                          {getReservationInstrumentDisplayName(
                            selectedReservation,
                            isAdmin,
                          ) || selectedReservation.requested_type}
                        </span>
                        {isAdmin && selectedReservation.instrument_alias && (
                          <span className="inline-flex items-center px-1.5 py-0.2 rounded text-[10px] font-semibold bg-violet-50 text-violet-800 border border-violet-200 shrink-0">
                            {selectedReservation.instrument_alias}
                          </span>
                        )}
                        <span>•</span>
                        <span className="truncate">
                          {selectedReservation.service_name}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Header Actions (Call, User Profile, View Reservation) */}
                  <div className="flex items-center gap-1 shrink-0">
                    {isAdmin && selectedReservation.user_phone && (
                      <a
                        href={`tel:${selectedReservation.user_phone}`}
                        className="h-8 px-2 rounded-xl bg-emerald-50 border border-emerald-200 hover:bg-emerald-100 active:bg-emerald-200 text-emerald-900 font-bold text-xs transition flex items-center gap-1 shadow-2xs touch-manipulation"
                        title={t("admin.messaging.callMember", "Call")}
                        aria-label={t("admin.messaging.callMember", "Call")}
                      >
                        <Phone className="w-3.5 h-3.5 text-emerald-700" />
                        <span className="hidden md:inline">
                          {t("admin.messaging.callMember", "Call")}
                        </span>
                      </a>
                    )}

                    {isAdmin &&
                      onOpenUserProfile &&
                      selectedReservation.user_id && (
                        <button
                          type="button"
                          onClick={() =>
                            onOpenUserProfile(selectedReservation.user_id)
                          }
                          className="h-8 px-2 rounded-xl bg-stone-50 border border-stone-200 hover:bg-amber-50 hover:border-amber-300 text-stone-800 font-bold text-xs transition flex items-center gap-1 cursor-pointer shadow-2xs touch-manipulation"
                          title={t("admin.users.viewProfile", "Profile")}
                          aria-label={t("admin.users.viewProfile", "Profile")}
                        >
                          <User className="w-3.5 h-3.5 text-amber-800" />
                          <span className="hidden md:inline">
                            {t("admin.users.viewProfile", "Profile")}
                          </span>
                        </button>
                      )}

                    {onOpenReservationDetail && (
                      <button
                        type="button"
                        onClick={() =>
                          onOpenReservationDetail(selectedReservation.id)
                        }
                        className="h-8 px-2 sm:px-2.5 rounded-xl bg-amber-50 border border-amber-200/80 hover:bg-amber-100 active:bg-amber-200 text-amber-950 font-bold text-xs transition flex items-center gap-1 cursor-pointer shadow-2xs touch-manipulation"
                        title={t("admin.messaging.viewReservation", "View details")}
                      >
                        <ExternalLink className="w-3.5 h-3.5 text-amber-800" />
                        <span className="hidden sm:inline">
                          {t("admin.messaging.viewReservation", "Details")}
                        </span>
                      </button>
                    )}
                  </div>
                </div>

                {/* Row 2: Booking Slot Pill Info */}
                <div className="flex items-center gap-1.5 text-stone-600 text-[10.5px] sm:text-xs pt-1 border-t border-stone-200/50">
                  <Calendar className="w-3 h-3 text-amber-700 shrink-0" />
                  <span className="font-semibold text-stone-700 truncate">
                    {formatReservationSlot(selectedReservation) ||
                      t("common.active", "Active")}
                  </span>
                </div>
              </div>

              {/* Messages History Area with Scroll-To-Bottom Floating Button */}
              <div className="relative flex-1 min-h-0">
                <div
                  ref={scrollContainerRef}
                  onScroll={handleMessagesScroll}
                  className="h-full overflow-y-auto px-3 sm:px-4 py-3 sm:py-4 space-y-2.5 sm:space-y-3 bg-stone-50/40 overscroll-contain"
                >
                  {loadingMessages ? (
                    <div className="py-16 flex flex-col items-center justify-center gap-2 text-stone-400">
                      <LoadingSpinner size="md" color="amber" />
                      <span className="text-xs font-semibold">
                        {t("notifications.loading", "Loading messages...")}
                      </span>
                    </div>
                  ) : activeMessages.length === 0 ? (
                    <div className="py-10 sm:py-16 text-center px-4 max-w-sm mx-auto">
                      <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-800 flex items-center justify-center mx-auto mb-3 border border-amber-200 shadow-2xs">
                        <Sparkles className="w-5 h-5" />
                      </div>
                      <p className="text-xs sm:text-sm font-bold text-stone-800">
                        {isAdmin
                          ? t(
                              "admin.messaging.noMessagesYet",
                              "No messages exchanged yet in this thread",
                            )
                          : t(
                              "userChat.noMessagesYetTitle",
                              "Chat with Church Administration",
                            )}
                      </p>
                      <p className="text-[11px] text-stone-500 mt-1 leading-relaxed">
                        {isAdmin
                          ? t(
                              "admin.messaging.startConversation",
                              "Send a message or special instructions regarding this reservation.",
                              {
                                name:
                                  selectedReservation.user_name ||
                                  selectedReservation.musician_name ||
                                  "the member",
                              },
                            )
                          : t(
                              "userChat.startFirstMessage",
                              "Have a question about room keys, rehearsal pickup, or outside usage for this booking? Send a message to church administration below.",
                            )}
                      </p>
                    </div>
                  ) : (
                    activeMessages.map((msg: any) => {
                      const isSenderUser = msg.sender_role === "user";
                      const isMe = isAdmin ? !isSenderUser : isSenderUser;

                      const roleLabel = isMe
                        ? t("admin.messaging.youPrefix", "You").replace(":", "")
                        : isAdmin
                          ? msg.sender_name ||
                            selectedReservation.user_name ||
                            t("admin.messaging.memberBadge", "Member")
                          : t("userChat.churchAdmin", "Church Administration");

                      return (
                        <div
                          key={msg.id}
                          className={`flex flex-col ${
                            isMe ? "items-end" : "items-start"
                          }`}
                        >
                          {/* Header: [Author] • Time */}
                          <div className="flex items-center gap-1.5 text-[10px] text-stone-400 mb-0.5 px-1.5">
                            <span
                              className={`font-bold ${
                                isMe ? "text-amber-900" : "text-stone-700"
                              }`}
                            >
                              {roleLabel}
                            </span>
                            <span>•</span>
                            <span>{formatMessageTime(msg.created_at)}</span>
                          </div>

                          {/* Message Bubble: optimized rounded geometry and text size */}
                          <div
                            className={`px-3.5 py-2.5 sm:px-4 sm:py-3 text-[12.5px] sm:text-xs max-w-[88%] sm:max-w-[75%] whitespace-pre-wrap leading-relaxed shadow-xs break-words ${
                              isMe
                                ? "bg-amber-800 text-white rounded-2xl rounded-tr-xs"
                                : "bg-white text-stone-900 border border-stone-200/90 rounded-2xl rounded-tl-xs shadow-2xs"
                            }`}
                          >
                            {msg.content}
                          </div>

                          {/* Read receipt */}
                          {isMe && (
                            <div className="flex items-center gap-1 text-[10px] text-stone-400 mt-0.5 px-1.5">
                              {msg.is_read ? (
                                <span className="flex items-center gap-0.5 text-emerald-700 font-semibold text-[9.5px]">
                                  <CheckCheck className="w-3 h-3" />
                                  <span>
                                    {isAdmin
                                      ? t(
                                          "admin.messaging.readStatus",
                                          "Read by Member",
                                        )
                                      : t(
                                          "admin.messaging.readStatus",
                                          "Read by Admin",
                                        )}
                                  </span>
                                </span>
                              ) : (
                                <span className="flex items-center gap-0.5 text-stone-400 text-[9.5px]">
                                  <Check className="w-3 h-3" />
                                  <span>
                                    {t("admin.messaging.unreadStatus", "Sent")}
                                  </span>
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })
                  )}
                  <div ref={messagesEndRef} />
                </div>

                {/* Floating "Scroll to bottom" button when user scrolls up */}
                {showScrollBottom && (
                  <button
                    type="button"
                    onClick={() => handleScrollToBottom(true)}
                    className="absolute bottom-3 right-4 rtl:right-auto rtl:left-4 z-10 w-8 h-8 rounded-full bg-white/95 border border-stone-200 text-amber-900 shadow-md hover:bg-stone-50 active:scale-95 flex items-center justify-center transition cursor-pointer backdrop-blur-xs animate-in fade-in zoom-in-90"
                    title={t("userChat.scrollToLatest", "Scroll to latest")}
                    aria-label={t("userChat.scrollToLatest", "Scroll to latest")}
                  >
                    <ArrowDown className="w-4 h-4 text-amber-800 animate-bounce" />
                  </button>
                )}
              </div>

              {/* Quick Suggestion Chips (only when thread is open) */}
              {!selectedThreadStatus.isClosed && quickReplies.length > 0 && (
                <div className="px-2.5 sm:px-3 py-1.5 sm:py-2 bg-stone-50/90 border-t border-stone-200/70 overflow-x-auto scrollbar-none flex items-center gap-1.5 shrink-0 touch-manipulation">
                  <span className="text-[9.5px] sm:text-[10px] font-bold text-stone-500 uppercase tracking-wider shrink-0 me-0.5">
                    {isAdmin
                      ? t(
                          "admin.messaging.quickReplies",
                          "Templates",
                        ) + ":"
                      : t("userChat.suggestionsLabel", "Quick Inquiries") + ":"}
                  </span>
                  {quickReplies.map((reply) => (
                    <button
                      key={reply.key}
                      type="button"
                      onClick={() => handleQuickReply(reply.text)}
                      className="px-2.5 py-1 rounded-xl bg-white border border-stone-200 hover:border-amber-400 hover:bg-amber-50/70 active:scale-95 text-[11px] font-medium text-stone-700 transition shrink-0 cursor-pointer shadow-2xs leading-snug touch-manipulation whitespace-nowrap"
                    >
                      {reply.text.length > 36
                        ? reply.text.substring(0, 34) + "..."
                        : reply.text}
                    </button>
                  ))}
                </div>
              )}

              {/* Message Composer or Closed Banner */}
              {selectedThreadStatus.isClosed ? (
                <div className="p-3 sm:p-4 bg-stone-50/95 border-t border-stone-200 shrink-0 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
                  <div className="p-3 sm:p-3.5 bg-white border border-stone-200/90 rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-2.5 sm:gap-3 shadow-2xs">
                    <div className="flex items-center gap-2.5 min-w-0 text-center sm:text-left rtl:sm:text-right w-full sm:w-auto">
                      <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-xl bg-stone-100 text-stone-600 border border-stone-200 flex items-center justify-center shrink-0">
                        <Lock className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-stone-500" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <h4 className="text-xs font-bold text-stone-800">
                          {t("userChat.threadClosedTitle", "This conversation is closed")}
                        </h4>
                        <p className="text-[10.5px] sm:text-[11px] text-stone-500 mt-0.5 leading-snug">
                          {t(
                            "userChat.threadClosedDesc",
                            "This booking has concluded. New messages can no longer be sent for this reservation.",
                          )}
                        </p>
                      </div>
                    </div>

                    {!isAdmin && onNavigateToCalendar && (
                      <button
                        type="button"
                        onClick={onNavigateToCalendar}
                        className="w-full sm:w-auto px-3.5 py-2 sm:py-1.5 rounded-xl bg-amber-800 hover:bg-amber-900 active:scale-95 text-white text-xs font-bold transition flex items-center justify-center gap-1.5 shadow-2xs shrink-0 cursor-pointer touch-manipulation"
                      >
                        <CalendarPlus className="w-3.5 h-3.5" />
                        <span>{t("userChat.goToCalendarBtn", "Book an Instrument")}</span>
                      </button>
                    )}
                  </div>
                </div>
              ) : (
                <div className="shrink-0 bg-white border-t border-stone-200/90 pb-[env(safe-area-inset-bottom)]">
                  {/* Subtle grace period notice if applicable */}
                  {selectedThreadStatus.inGracePeriod && (
                    <div className="px-3 py-1 bg-amber-50/70 border-b border-amber-200/50 flex items-center gap-1.5 text-[10.5px] text-amber-900">
                      <Clock className="w-3 h-3 text-amber-700 shrink-0" />
                      <span className="truncate">{t("userChat.gracePeriodNotice", "This thread is in a grace period and will automatically close soon.")}</span>
                    </div>
                  )}

                  <form
                    onSubmit={handleSendMessage}
                    className="p-2 sm:p-3"
                  >
                    <div className="flex items-end gap-1.5 sm:gap-2">
                      <div className="flex-1 relative">
                        <textarea
                          ref={textareaRef}
                          value={messageText}
                          onChange={(e) => setMessageText(e.target.value)}
                          onKeyDown={handleKeyDown}
                          rows={1}
                          placeholder={
                            isAdmin
                              ? t(
                                  "admin.messaging.typeMessagePlaceholder",
                                  "Type your message to the member...",
                                  {
                                    name:
                                      selectedReservation.user_name ||
                                      selectedReservation.musician_name ||
                                      "Member",
                                  },
                                )
                              : t(
                                  "userChat.typeMessagePlaceholder",
                                  "Type message to Church Administration...",
                                )
                          }
                          className="w-full min-h-[40px] max-h-[120px] px-3.5 py-2 sm:py-2.5 bg-stone-50 border border-stone-200 rounded-2xl text-sm sm:text-xs text-stone-900 placeholder:text-stone-400 focus:outline-none focus:border-amber-700 focus:bg-white resize-none transition leading-relaxed"
                          disabled={sendingMessage}
                        />
                      </div>

                      <button
                        type="submit"
                        disabled={!messageText.trim() || sendingMessage}
                        aria-label={t("admin.messaging.send", "Send")}
                        title={t("admin.messaging.send", "Send")}
                        className="h-10 w-10 sm:w-auto sm:px-4 rounded-xl bg-amber-800 hover:bg-amber-900 active:scale-95 disabled:opacity-40 disabled:hover:bg-amber-800 disabled:active:scale-100 text-white text-xs font-bold transition flex items-center justify-center gap-1.5 shadow-2xs cursor-pointer shrink-0 touch-manipulation"
                      >
                        {sendingMessage ? (
                          <LoadingSpinner size="xs" color="white" />
                        ) : (
                          <Send className="w-4 h-4 sm:w-3.5 sm:h-3.5 rtl:rotate-180" />
                        )}
                        <span className="hidden sm:inline">
                          {t("admin.messaging.send", "Send")}
                        </span>
                      </button>
                    </div>
                  </form>
                </div>
              )}
            </div>
          ) : (
            /* Empty State when no conversation is selected (Desktop view) */
            <div className="h-full flex flex-col items-center justify-center text-center p-8 text-stone-400">
              <div className="w-14 h-14 rounded-3xl bg-amber-50 text-amber-800 flex items-center justify-center mx-auto mb-3 border border-amber-200/80 shadow-2xs">
                <MessageSquare className="w-7 h-7 stroke-[1.6]" />
              </div>
              <h3 className="text-sm font-bold text-stone-800">
                {isAdmin
                  ? t("admin.messaging.selectReservation", "Select a Reservation")
                  : t(
                      "userChat.selectBookingPrompt",
                      "Select a Booking to View Chat",
                    )}
              </h3>
              <p className="text-xs text-stone-500 mt-1 max-w-sm mx-auto leading-relaxed">
                {isAdmin
                  ? t(
                      "admin.messaging.emptyState",
                      "Select a reservation on the left to view message history, coordinate instrument pickup, and send replies.",
                    )
                  : t(
                      "userChat.selectBookingDesc",
                      "Choose an instrument booking from the list to communicate with Church Administration regarding keys, rehearsal access, or payment.",
                    )}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
