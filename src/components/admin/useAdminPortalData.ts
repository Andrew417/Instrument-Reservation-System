import React, { useState, useEffect, useMemo, useRef } from "react";
import { useTranslation } from "react-i18next";
import { useAuth } from "../../contexts/AuthContext.tsx";
import {
  getTodayDateString,
  formatHhmmTo12Hour,
  addDaysToDateString,
  formatDisplayDate,
  isNoShowWindowOpen,
} from "../../lib/date-utils";
import { REJECTION_REASON_PRESETS } from "../../constants/reservationPresets.ts";
import { DEFAULT_INSTRUMENT_TYPE } from "../../constants/instruments";
import {
  buildHardLimitsPayload,
  normalizeHardLimitsState,
} from "../../lib/hard-limits";
import { HandoverExportFormat } from "../../lib/handover-export";
import {
  EMPTY_FILTER_STATE,
  matchesFilters,
  type ReservationFilterState,
} from "../ReservationFiltersPopover";
import {
  getCurrentSubscription,
  subscribeToPush,
  sendTestNotification,
} from "../../lib/push-client";
import { adminFetch as baseAdminFetch } from "../../lib/auth-helpers";
import type { AdminPushPreferences } from "./NotificationSettingsTab";

export type AdminTab =
  | "dashboard"
  | "review"
  | "approvals"
  | "instruments"
  | "users"
  | "analytics"
  | "messaging"
  | "push_notifications"
  | "admin_accounts"
  | "trusted_status"
  | "hard_limits"
  | "payment_settings"
  | "notification_settings";

export interface UseAdminPortalDataProps {
  onBackToMemberView?: () => void;
  onOpenReservationDetail?: (reservationId: string) => void;
  onEditReservation?: (res: any) => void;
  onInstrumentsChanged?: () => void;
  onOpenUserProfile?: (userId: string) => void;
  initialTab?: AdminTab;
}

export const ADMIN_TABS_EVENT = "admin-tabs:update";

export function useAdminPortalData({
  onOpenReservationDetail,
  onInstrumentsChanged,
  onOpenUserProfile,
  initialTab,
}: UseAdminPortalDataProps) {
  const { profile, sessionToken } = useAuth();
  const { t, i18n } = useTranslation();
  const isAr = i18n.language === "ar";
  const isRTL = isAr;
  const isSuperAdmin = profile?.role === "super_admin" || profile?.isSuperAdmin;

  const [internalSelectedUserId, setInternalSelectedUserId] = useState<
    string | null
  >(null);
  const [internalSelectedEntityType, setInternalSelectedEntityType] = useState<
    "user" | "admin"
  >("user");

  const openUserProfile = (
    userId: string,
    entityType: "user" | "admin" = "user",
  ) => {
    if (onOpenUserProfile) {
      onOpenUserProfile(userId);
    } else {
      setInternalSelectedEntityType(entityType);
      setInternalSelectedUserId(userId);
    }
  };

  const [activeTab, setActiveTab] = useState<AdminTab>(
    initialTab || "dashboard",
  );

  useEffect(() => {
    if (initialTab) {
      setActiveTab(initialTab);
    }
  }, [initialTab]);

  useEffect(() => {
    const superAdminOnlyTabs: AdminTab[] = [
      "admin_accounts",
      "trusted_status",
      "hard_limits",
      "payment_settings",
    ];
    if (!isSuperAdmin && superAdminOnlyTabs.includes(activeTab)) {
      setActiveTab("dashboard");
    }
  }, [activeTab, isSuperAdmin]);

  const [stats, setStats] = useState<{
    totalInstruments: number;
    pendingRequests: number;
    todayReservations: number;
    activeUsers: number;
    pendingUserApprovals?: number;
    upcomingApprovedCount?: number;
  }>({
    totalInstruments: 0,
    pendingRequests: 0,
    todayReservations: 0,
    activeUsers: 0,
    pendingUserApprovals: 0,
    upcomingApprovedCount: 0,
  });

  const [reservations, setReservations] = useState<any[]>([]);
  const [loadingReservations, setLoadingReservations] =
    useState<boolean>(false);
  const [noShowWindowNow, setNoShowWindowNow] = useState(() => Date.now());
  const [todaysReservations, setTodaysReservations] = useState<any[]>([]);
  const [loadingTodaysReservations, setLoadingTodaysReservations] =
    useState<boolean>(false);
  const [dashboardSubTab, setDashboardSubTab] = useState<"today" | "upcoming">(
    "today",
  );
  const [upcomingReservations, setUpcomingReservations] = useState<any[]>([]);
  const [loadingUpcomingReservations, setLoadingUpcomingReservations] =
    useState<boolean>(false);
  const [showDashboardFilters, setShowDashboardFilters] =
    useState<boolean>(false);
  const [showReviewFilters, setShowReviewFilters] = useState<boolean>(false);

  const [dashboardFilters, setDashboardFilters] =
    useState<ReservationFilterState>({
      ...EMPTY_FILTER_STATE,
    });
  const [reviewFilters, setReviewFilters] = useState<ReservationFilterState>({
    ...EMPTY_FILTER_STATE,
  });

  const [filterQuickTab, setFilterQuickTab] = useState<
    "all" | "today" | "pending"
  >("all");

  const [adminAccountsList, setAdminAccountsList] = useState<any[]>([]);
  const [loadingAdmins, setLoadingAdmins] = useState<boolean>(false);

  const getAdminDisplayName = (r: any): string => {
    if (
      r?.admin_name &&
      typeof r.admin_name === "string" &&
      r.admin_name.trim()
    ) {
      return r.admin_name.trim();
    }
    if (r?.admin_id) {
      const match = adminAccountsList.find((a) => a.id === r.admin_id);
      if (match?.name) return match.name;
    }
    if (profile?.name) return profile.name;
    return "Admin";
  };

  const isReservationAdminBooked = (r: any): boolean => {
    if (!r) return false;
    if (r.booked_by_admin || r.bookedByAdmin) return true;
    if (!r.user_id) return true;
    if (!r.user_name) return true;
    const lowerName =
      typeof r.user_name === "string" ? r.user_name.trim().toLowerCase() : "";
    if (lowerName === "unknown" || lowerName === "member") {
      return true;
    }
    return false;
  };

  const getRowOwnerName = (r: any): string => {
    if (!r) return "";
    if (isReservationAdminBooked(r)) return getAdminDisplayName(r);
    return r.user_name || r.userName || "Member";
  };

  const dashboardFilterOptions = useMemo(() => {
    const source = [...todaysReservations, ...upcomingReservations];
    const unique = (key: string) =>
      Array.from(
        new Set(
          source
            .map((reservation) => reservation[key])
            .filter((value): value is string => Boolean(value)),
        ),
      ).sort((a, b) => a.localeCompare(b));

    const userNames = Array.from(
      new Set(
        source
          .map((r) => getRowOwnerName(r))
          .filter((value): value is string => Boolean(value)),
      ),
    ).sort((a, b) => a.localeCompare(b));

    return {
      users: userNames,
      instruments: unique("instrument_name"),
      categories: unique("instrument_type"),
      statuses: unique("status"),
    };
  }, [todaysReservations, upcomingReservations, getRowOwnerName]);

  const reviewFilterOptions = useMemo(() => {
    const unique = (key: string) =>
      Array.from(
        new Set(
          reservations
            .map((reservation) => reservation[key])
            .filter((value): value is string => Boolean(value)),
        ),
      ).sort((a, b) => a.localeCompare(b));
    const users = Array.from(
      new Set(
        reservations
          .map((r) => getRowOwnerName(r))
          .filter((value): value is string => Boolean(value)),
      ),
    ).sort((a, b) => a.localeCompare(b));

    return {
      users,
      instruments: unique("instrument_name"),
      categories: unique("instrument_type"),
      statuses: unique("status"),
    };
  }, [reservations, getRowOwnerName]);

  const filterDashboardReservations = (rows: any[]) =>
    rows.filter((r) => matchesFilters(r, dashboardFilters, getRowOwnerName));

  const filteredReviewReservations = useMemo(
    () =>
      reservations.filter((r) =>
        matchesFilters(r, reviewFilters, getRowOwnerName),
      ),
    [reservations, reviewFilters, getRowOwnerName],
  );

  const clearDashboardFilters = () =>
    setDashboardFilters({ ...EMPTY_FILTER_STATE });
  const clearReviewFilters = () => setReviewFilters({ ...EMPTY_FILTER_STATE });

  const [showHandoverModal, setShowHandoverModal] = useState<boolean>(false);
  const [handoverDefaultDate, setHandoverDefaultDate] =
    useState<string>(getTodayDateString());
  const [handoverDefaultMode, setHandoverDefaultMode] = useState<
    "day" | "week"
  >("day");
  const [handoverDefaultFormat, setHandoverDefaultFormat] =
    useState<HandoverExportFormat>("xlsx");

  const [instrumentsList, setInstrumentsList] = useState<any[]>([]);
  const [loadingInstruments, setLoadingInstruments] = useState<boolean>(false);
  const [showInstrumentModal, setShowInstrumentModal] =
    useState<boolean>(false);
  const [editingInstrument, setEditingInstrument] = useState<any | null>(null);
  const [instrumentForm, setInstrumentForm] = useState({
    name: "",
    type: DEFAULT_INSTRUMENT_TYPE,
    photoUrl: "",
    description: "",
    outsideFeePerDay: "0.00",
    bookingMode: "instant" as "instant" | "manual",
    visibilityLevel: "public" as "public" | "musician" | "room_stock",
    isOutOfService: false,
  });
  const [removingInstrument, setRemovingInstrument] = useState<any | null>(
    null,
  );
  const [removeConfirmForce, setRemoveConfirmForce] = useState<boolean>(false);
  const [deletingInstrument, setDeletingInstrument] = useState<any | null>(
    null,
  );
  const [deleteConfirmChecked, setDeleteConfirmChecked] =
    useState<boolean>(false);
  const [isDeletingInstrument, setIsDeletingInstrument] =
    useState<boolean>(false);

  const [usersList, setUsersList] = useState<any[]>([]);
  const [loadingUsers, setLoadingUsers] = useState<boolean>(false);
  const [userSearch, setUserSearch] = useState<string>("");
  const [userFilterStatus, setUserFilterStatus] = useState<
    "all" | "active" | "deactivated"
  >("all");
  const [bookOnBehalfUser, setBookOnBehalfUser] = useState<any | null>(null);

  const [approvalsList, setApprovalsList] = useState<any[]>([]);
  const [loadingApprovals, setLoadingApprovals] = useState<boolean>(false);
  const [approvalSearch, setApprovalSearch] = useState<string>("");
  const [approvalFilterStatus, setApprovalFilterStatus] = useState<
    "pending" | "approved" | "rejected" | "all"
  >("pending");
  const [approvalActionId, setApprovalActionId] = useState<string | null>(null);

  const approvalCounts = useMemo(() => {
    let pending = 0;
    let approved = 0;
    let rejected = 0;
    approvalsList.forEach((user) => {
      const status =
        user.approvalStatus || (user.isActive ? "approved" : "pending");
      if (status === "pending") pending++;
      else if (status === "approved") approved++;
      else if (status === "rejected") rejected++;
    });
    return { pending, approved, rejected, total: approvalsList.length };
  }, [approvalsList]);

  const [trustedAuditLogs, setTrustedAuditLogs] = useState<any[]>([]);
  const [musicianAuditLogs, setMusicianAuditLogs] = useState<any[]>([]);
  const [loadingAuditLogs, setLoadingAuditLogs] = useState<boolean>(false);

  const [messagingReservations, setMessagingReservations] = useState<any[]>([]);
  const [loadingMessagingReservations, setLoadingMessagingReservations] =
    useState<boolean>(false);
  const [selectedMsgReservation, setSelectedMsgReservation] = useState<
    any | null
  >(null);
  const [messageText, setMessageText] = useState("");
  const [sendingMessage, setSendingMessage] = useState(false);
  const [msgReservationSearch, setMsgReservationSearch] = useState("");

  const [hardLimitsState, setHardLimitsState] = useState(() =>
    normalizeHardLimitsState(null),
  );
  const [loadingLimits, setLoadingLimits] = useState<boolean>(false);
  const [savingLimits, setSavingLimits] = useState<boolean>(false);

  const [notificationSettingsState, setNotificationSettingsState] = useState(
    {
      muteAccountApprovalEmails: false,
      muteReservationRequestEmails: false,
    },
  );
  const [savingNotificationSettings, setSavingNotificationSettings] =
    useState<boolean>(false);

  const [paymentSettingsState, setPaymentSettingsState] = useState({
    instapayNumber: "",
    instapayLink: "",
  });
  const [savingPayment, setSavingPayment] = useState<boolean>(false);

  const [adminPushPrefs, setAdminPushPrefs] = useState<AdminPushPreferences>({
    notifyNewRequests: true,
    notifyNewRegistrations: true,
    notifyMemberMessages: true,
  });
  const [loadingPushPrefs, setLoadingPushPrefs] = useState<boolean>(false);
  const [savingPushPrefs, setSavingPushPrefs] = useState<boolean>(false);
  const [adminDeviceSubscribed, setAdminDeviceSubscribed] =
    useState<boolean>(false);
  const [testPushSending, setTestPushSending] = useState<boolean>(false);
  const [testPushStatus, setTestPushStatus] = useState<string | null>(null);

  const [feedback, setFeedback] = useState<{
    type: "success" | "error" | "info";
    message: string;
  } | null>(null);

  const [rejectModal, setRejectModal] = useState<{
    isOpen: boolean;
    reservationId?: string;
    seriesId?: string | null;
    instrumentName: string;
    memberName: string;
    dateFormatted: string;
    timeFormatted: string;
    isSeriesReject: boolean;
    reason: string;
    submitting: boolean;
  } | null>(null);

  const [cancelReasonModal, setCancelReasonModal] = useState<{
    isOpen: boolean;
    ids: string[];
    preset: string;
    customText: string;
    submitting: boolean;
  } | null>(null);

  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    title: string;
    description: string;
    confirmLabel: string;
    isDestructive?: boolean;
    onConfirm: () => Promise<void> | void;
  } | null>(null);

  const [showNewAdminModal, setShowNewAdminModal] = useState(false);
  const [newAdminForm, setNewAdminForm] = useState({
    name: "",
    email: "",
    phoneNumber: "",
    password: "",
    isSuperAdmin: false,
  });

  const [promoteModal, setPromoteModal] = useState<{
    isOpen: boolean;
    userId: string;
    userName: string;
    role: "user" | "admin" | "super_admin" | "musician";
    isMusician?: boolean;
  } | null>(null);

  const [assignModal, setAssignModal] = useState<{
    isOpen: boolean;
    reservation: any | null;
    isSeries?: boolean;
    isReassign?: boolean;
  } | null>(null);

  const [isSelectionMode, setIsSelectionMode] = useState<boolean>(false);
  const [selectedReservationIds, setSelectedReservationIds] = useState<
    string[]
  >([]);
  const [expandedSeriesIds, setExpandedSeriesIds] = useState<string[]>([]);

  const firstLoadRef = useRef(true);

  const showNotice = (
    message: string,
    type: "success" | "error" | "info" = "success",
  ) => {
    setFeedback({ type, message });
    setTimeout(() => setFeedback(null), 5000);
  };

  const adminFetch = (endpoint: string, options: RequestInit = {}) =>
    baseAdminFetch(endpoint, options, sessionToken);

  const refreshAllStats = () => {
    fetchStats();
    if (activeTab === "dashboard") {
      fetchTodaysReservations();
      fetchUpcomingReservations();
    }
  };

  const fetchStats = async () => {
    try {
      const res = await adminFetch("/dashboard-stats");
      const data = await res.json();
      if (data.success) {
        setStats((prev) => ({ ...prev, ...data.stats }));
      }
    } catch {
      // silent
    }
  };

  const fetchReservations = async () => {
    setLoadingReservations(true);
    try {
      const params = new URLSearchParams();
      params.append("sort", "created");
      if (filterQuickTab !== "all") params.append("quickTab", filterQuickTab);
      if (reviewFilters.statuses.length === 1) {
        params.append("status", reviewFilters.statuses[0]);
      }
      const res = await adminFetch(`/reservations?${params.toString()}`);
      const data = await res.json();
      if (data.success) {
        setReservations(data.reservations || []);
      }
    } catch {
      showNotice("Failed to load reservations", "error");
    } finally {
      setLoadingReservations(false);
    }
  };

  const fetchTodaysReservations = async () => {
    setLoadingTodaysReservations(true);
    try {
      const res = await adminFetch("/reservations?quickTab=today");
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to load today's schedule");
      }
      setTodaysReservations(data.reservations || []);
    } catch (err: any) {
      showNotice(err.message || "Failed to load today's schedule", "error");
    } finally {
      setLoadingTodaysReservations(false);
    }
  };

  const fetchUpcomingReservations = async () => {
    setLoadingUpcomingReservations(true);
    try {
      const res = await adminFetch(
        "/reservations?status=approved&upcoming=true",
      );
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to load upcoming schedule");
      }
      const now = Date.now();
      const upcoming = (data.reservations || []).filter((r: any) => {
        const start = new Date(r.start_time || r.startTime).getTime();
        return !isNaN(start) && start > now;
      });
      setUpcomingReservations(upcoming);
      setStats((prev) => ({ ...prev, upcomingApprovedCount: upcoming.length }));
    } catch (err: any) {
      showNotice(err.message || "Failed to load upcoming schedule", "error");
    } finally {
      setLoadingUpcomingReservations(false);
    }
  };

  const fetchInstruments = async () => {
    setLoadingInstruments(true);
    try {
      const res = await adminFetch("/instruments?includeRemoved=true");
      const data = await res.json();
      if (data.success) {
        setInstrumentsList(data.instruments || []);
      }
    } catch {
      showNotice("Failed to load instruments", "error");
    } finally {
      setLoadingInstruments(false);
    }
  };

  const fetchUsers = async () => {
    setLoadingUsers(true);
    try {
      const params = new URLSearchParams();
      if (userFilterStatus !== "all") params.append("status", userFilterStatus);
      if (userSearch.trim()) params.append("search", userSearch.trim());
      const res = await adminFetch(`/users?${params.toString()}`);
      const data = await res.json();
      if (data.success) {
        setUsersList(data.users || []);
        if (data.activeUsersCount !== undefined) {
          setStats((prev) => ({ ...prev, activeUsers: data.activeUsersCount }));
        }
      }
    } catch {
      showNotice("Failed to load users", "error");
    } finally {
      setLoadingUsers(false);
    }
  };

  const fetchApprovals = async (
    filter: "pending" | "approved" | "rejected" | "all" = approvalFilterStatus,
  ) => {
    setLoadingApprovals(true);
    try {
      const params = new URLSearchParams();
      if (filter !== "all") params.append("status", filter);
      if (approvalSearch.trim()) params.append("search", approvalSearch.trim());
      const res = await adminFetch(`/approvals?${params.toString()}`);
      const data = await res.json();
      if (data.success) {
        setApprovalsList(data.approvals || []);
        if (data.pendingCount !== undefined) {
          setStats((prev) => ({
            ...prev,
            pendingUserApprovals: data.pendingCount,
          }));
        }
      }
    } catch {
      showNotice("Failed to load approvals", "error");
    } finally {
      setLoadingApprovals(false);
    }
  };

  const fetchAdmins = async () => {
    setLoadingAdmins(true);
    try {
      const res = await adminFetch("/admins");
      const data = await res.json();
      if (data.success) {
        setAdminAccountsList(data.admins || []);
      }
    } catch {
      showNotice("Failed to load admin accounts", "error");
    } finally {
      setLoadingAdmins(false);
    }
  };

  const fetchAuditLogs = async () => {
    setLoadingAuditLogs(true);
    try {
      const [trustedRes, musicianRes] = await Promise.all([
        adminFetch("/trusted-audit-logs"),
        adminFetch("/musician-audit-logs"),
      ]);
      const [trustedData, musicianData] = await Promise.all([
        trustedRes.json(),
        musicianRes.json(),
      ]);
      if (trustedData.success) {
        setTrustedAuditLogs(trustedData.auditLogs || trustedData.logs || []);
      }
      if (musicianData.success) {
        setMusicianAuditLogs(musicianData.auditLogs || musicianData.logs || []);
      }
    } catch {
      showNotice("Failed to load audit logs", "error");
    } finally {
      setLoadingAuditLogs(false);
    }
  };

  const fetchHardLimits = async () => {
    setLoadingLimits(true);
    try {
      const res = await adminFetch("/hard-limits");
      const data = await res.json();
      if (data.success && (data.limits || data.hardLimits)) {
        setHardLimitsState(
          normalizeHardLimitsState(data.limits || data.hardLimits),
        );
      }
    } catch {
      showNotice("Failed to load reservation limits", "error");
    } finally {
      setLoadingLimits(false);
    }
  };

  const fetchNotificationSettings = async () => {
    try {
      const res = await adminFetch("/notification-settings");
      const data = await res.json();
      if (data.success && data.settings) {
        setNotificationSettingsState(data.settings);
      }
    } catch {
      showNotice("Failed to load notification settings", "error");
    }
  };

  const fetchPaymentSettings = async () => {
    try {
      const res = await adminFetch("/payment-settings");
      const data = await res.json();
      const settings = data.settings || data.paymentSettings;
      if (data.success && settings) {
        setPaymentSettingsState({
          instapayNumber:
            settings.instapayNumber || settings.instapay_number || "",
          instapayLink: settings.instapayLink || settings.instapay_link || "",
        });
      }
    } catch {
      showNotice("Failed to load payment settings", "error");
    }
  };

  const fetchPushPreferences = async () => {
    setLoadingPushPrefs(true);
    try {
      const res = await adminFetch("/push-preferences");
      const data = await res.json();
      if (data.success && data.preferences) {
        setAdminPushPrefs(data.preferences);
      }
    } catch {
      // silent
    } finally {
      setLoadingPushPrefs(false);
    }
  };

  const fetchMessagingReservations = async (term: string = "") => {
    setLoadingMessagingReservations(true);
    try {
      const params = new URLSearchParams();
      if (term.trim()) params.append("search", term.trim());
      const res = await fetch(`/api/reservations?${params.toString()}`, {
        headers: { Authorization: `Bearer ${sessionToken || ""}` },
      });
      const data = await res.json();
      if (data.success) {
        setMessagingReservations(data.reservations || []);
      }
    } catch {
      // silent
    } finally {
      setLoadingMessagingReservations(false);
    }
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!messageText.trim() || !selectedMsgReservation) return;
    setSendingMessage(true);
    try {
      const res = await fetch(
        `/api/reservations/${selectedMsgReservation.id}/messages`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${sessionToken || ""}`,
          },
          body: JSON.stringify({ content: messageText.trim() }),
        },
      );
      const data = await res.json();
      if (data.success) {
        setMessageText("");
        showNotice("Message sent successfully!");
      } else {
        showNotice(data.error || "Failed to send message", "error");
      }
    } catch {
      showNotice("Failed to send message", "error");
    } finally {
      setSendingMessage(false);
    }
  };

  const handleApprove = async (reservationId: string) => {
    try {
      const res = await adminFetch(`/reservations/${reservationId}/approve`, {
        method: "POST",
      });
      const data = await res.json();
      if (data.success) {
        showNotice(t("admin.review.approveSuccess"));
        fetchReservations();
        refreshAllStats();
      } else {
        showNotice(data.error || t("admin.review.approveError"), "error");
      }
    } catch {
      showNotice(t("admin.review.approveError"), "error");
    }
  };

  const handleApproveSeries = async (seriesId: string) => {
    try {
      const res = await adminFetch(`/series/${seriesId}/approve`, {
        method: "POST",
      });
      const data = await res.json();
      if (data.success) {
        showNotice(t("admin.review.approveSuccess"));
        fetchReservations();
        refreshAllStats();
      } else {
        showNotice(data.error || t("admin.review.approveError"), "error");
      }
    } catch {
      showNotice(t("admin.review.approveError"), "error");
    }
  };

  const openRejectModal = (
    res: any,
    wholeSeries: boolean = true,
    _occurrenceCount?: number,
  ) => {
    const hasSeries = Boolean(res.series_id || res.seriesId);
    const reservationDate =
      res.reservation_date ||
      res.reservationDate ||
      (res.start_time || res.startTime
        ? new Date(res.start_time || res.startTime).toISOString().slice(0, 10)
        : "");
    const startTime = res.start_hhmm || res.startHhmm || "";
    const endTime = res.end_hhmm || res.endHhmm || "";

    setRejectModal({
      isOpen: true,
      reservationId: res.id,
      seriesId: res.series_id || res.seriesId,
      instrumentName:
        res.instrument_name || res.instrumentName || "Instrument",
      memberName:
        res.user_name || res.userName || res.musician_name || "Member",
      dateFormatted: formatDisplayDate(reservationDate),
      timeFormatted:
        startTime && endTime
          ? `${formatHhmmTo12Hour(startTime)} - ${formatHhmmTo12Hour(endTime)}`
          : "",
      isSeriesReject: hasSeries && wholeSeries,
      reason: REJECTION_REASON_PRESETS[0],
      submitting: false,
    });
  };

  const handleConfirmReject = async () => {
    if (!rejectModal) return;
    setRejectModal((prev) => (prev ? { ...prev, submitting: true } : null));
    const reason = rejectModal.reason.trim();
    try {
      let res;
      if (rejectModal.isSeriesReject && rejectModal.seriesId) {
        res = await adminFetch(`/series/${rejectModal.seriesId}/reject`, {
          method: "POST",
          body: JSON.stringify({ reason }),
        });
      } else {
        res = await adminFetch(
          `/reservations/${rejectModal.reservationId}/reject`,
          {
            method: "POST",
            body: JSON.stringify({ reason }),
          },
        );
      }
      const data = await res.json();
      if (data.success) {
        showNotice(t("admin.review.rejectSuccess"));
        setRejectModal(null);
        fetchReservations();
        refreshAllStats();
      } else {
        showNotice(data.error || t("admin.review.rejectError"), "error");
        setRejectModal((prev) =>
          prev ? { ...prev, submitting: false } : null,
        );
      }
    } catch {
      showNotice(t("admin.review.rejectError"), "error");
      setRejectModal((prev) => (prev ? { ...prev, submitting: false } : null));
    }
  };

  const handleMarkNoShow = async (reservationId: string) => {
    try {
      const res = await adminFetch(
        `/reservations/${reservationId}/mark-no-show`,
        {
          method: "POST",
        },
      );
      const data = await res.json();
      if (data.success) {
        showNotice(t("admin.review.noShowMarked"));
        fetchReservations();
      } else {
        showNotice(data.error || "Failed to mark no-show", "error");
      }
    } catch {
      showNotice("Failed to mark no-show", "error");
    }
  };

  const handleUnmarkNoShow = async (reservationId: string) => {
    try {
      const res = await adminFetch(
        `/reservations/${reservationId}/unmark-no-show`,
        {
          method: "POST",
        },
      );
      const data = await res.json();
      if (data.success) {
        showNotice(t("admin.review.noShowUnmarked"));
        fetchReservations();
      } else {
        showNotice(data.error || "Failed to unmark no-show", "error");
      }
    } catch {
      showNotice("Failed to unmark no-show", "error");
    }
  };

  const handleTriggerBulkCancel = () => {
    if (selectedReservationIds.length === 0) return;
    setCancelReasonModal({
      isOpen: true,
      ids: selectedReservationIds,
      preset: "Instrument in maintenance",
      customText: "",
      submitting: false,
    });
  };

  const handleConfirmBulkCancel = async () => {
    if (!cancelReasonModal) return;
    setCancelReasonModal((prev) =>
      prev ? { ...prev, submitting: true } : null,
    );
    const reason =
      cancelReasonModal.customText.trim() || cancelReasonModal.preset;
    try {
      const res = await adminFetch("/reservations/bulk-cancel", {
        method: "POST",
        body: JSON.stringify({
          ids: cancelReasonModal.ids,
          cancellationReason: reason,
        }),
      });
      const data = await res.json();
      if (data.success) {
        showNotice(
          t("admin.review.bulkCancelSuccess", {
            count: data.cancelledCount || cancelReasonModal.ids.length,
          }),
        );
        setCancelReasonModal(null);
        setSelectedReservationIds([]);
        setIsSelectionMode(false);
        fetchReservations();
        refreshAllStats();
      } else {
        showNotice(data.error || t("admin.review.bulkCancelError"), "error");
        setCancelReasonModal((prev) =>
          prev ? { ...prev, submitting: false } : null,
        );
      }
    } catch {
      showNotice(t("admin.review.bulkCancelError"), "error");
      setCancelReasonModal((prev) =>
        prev ? { ...prev, submitting: false } : null,
      );
    }
  };

  const handleTriggerBulkDelete = () => {
    if (selectedReservationIds.length === 0) return;
    setConfirmModal({
      isOpen: true,
      title: t("admin.review.bulkDeleteTitle"),
      description: t("admin.review.bulkDeleteConfirm", {
        count: selectedReservationIds.length,
      }),
      confirmLabel: t("admin.review.bulkDeleteButton"),
      isDestructive: true,
      onConfirm: async () => {
        try {
          const res = await adminFetch("/reservations/bulk-delete", {
            method: "POST",
            body: JSON.stringify({ ids: selectedReservationIds }),
          });
          const data = await res.json();
          if (data.success) {
            showNotice(
              t("admin.review.bulkDeleteSuccess", {
                count: data.deletedCount || selectedReservationIds.length,
              }),
            );
            setConfirmModal(null);
            setSelectedReservationIds([]);
            setIsSelectionMode(false);
            fetchReservations();
            refreshAllStats();
          } else {
            showNotice(
              data.error || t("admin.review.bulkDeleteError"),
              "error",
            );
          }
        } catch {
          showNotice(t("admin.review.bulkDeleteError"), "error");
        }
      },
    });
  };

  const handleOpenCreateInstrument = () => {
    setEditingInstrument(null);
    setInstrumentForm({
      name: "",
      type: DEFAULT_INSTRUMENT_TYPE,
      photoUrl: "",
      description: "",
      outsideFeePerDay: "0",
      bookingMode: "manual",
      visibilityLevel: "public",
      isOutOfService: false,
    });
    setShowInstrumentModal(true);
  };

  const handleOpenEditInstrument = (inst: any) => {
    setEditingInstrument(inst);
    setInstrumentForm({
      name: inst.name,
      type: inst.type,
      photoUrl: inst.photoUrl || inst.photo_url || "",
      description: inst.description || "",
      outsideFeePerDay: String(
        inst.outsideFeePerDay ?? inst.outside_fee_per_day ?? "0",
      ),
      bookingMode: (inst.bookingMode ?? inst.booking_mode) || "manual",
      visibilityLevel: (inst.visibilityLevel ?? inst.visibility_level) || "public",
      isOutOfService: Boolean(inst.isOutOfService ?? inst.is_out_of_service),
    });
    setShowInstrumentModal(true);
  };

  const handleSaveInstrument = async (form: any) => {
    try {
      let res;
      if (editingInstrument) {
        res = await adminFetch(`/instruments/${editingInstrument.id}`, {
          method: "PUT",
          body: JSON.stringify(form),
        });
      } else {
        res = await adminFetch("/instruments", {
          method: "POST",
          body: JSON.stringify(form),
        });
      }
      const data = await res.json();
      if (data.success) {
        showNotice(
          editingInstrument
            ? "Instrument updated successfully"
            : "Instrument created successfully",
        );
        setShowInstrumentModal(false);
        setEditingInstrument(null);
        fetchInstruments();
        refreshAllStats();
        if (onInstrumentsChanged) onInstrumentsChanged();
      } else {
        showNotice(data.error || "Failed to save instrument", "error");
      }
    } catch {
      showNotice("Failed to save instrument", "error");
    }
  };

  const handleExecuteRemoveInstrument = async (inst: any) => {
    try {
      const res = await adminFetch(`/instruments/${inst.id}/retire`, {
        method: "POST",
        body: JSON.stringify({ force: true }),
      });
      const data = await res.json();
      if (data.success) {
        showNotice(
          t("admin.modals.retireInstrument.retireSuccess", { name: inst.name }),
        );
        setRemovingInstrument(null);
        fetchInstruments();
        refreshAllStats();
        if (onInstrumentsChanged) onInstrumentsChanged();
      } else {
        showNotice(data.error || "Failed to retire instrument", "error");
      }
    } catch {
      showNotice("Failed to retire instrument", "error");
    }
  };

  const handleExecuteDeleteInstrument = async (inst: any) => {
    setIsDeletingInstrument(true);
    try {
      const res = await adminFetch(`/instruments/${inst.id}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (data.success) {
        showNotice(
          t("admin.modals.deleteInstrument.deleteSuccess", { name: inst.name }),
        );
        setDeletingInstrument(null);
        fetchInstruments();
        refreshAllStats();
        if (onInstrumentsChanged) onInstrumentsChanged();
      } else {
        showNotice(data.error || "Failed to delete instrument", "error");
      }
    } catch {
      showNotice("Failed to delete instrument", "error");
    } finally {
      setIsDeletingInstrument(false);
    }
  };

  const handleRestoreInstrument = async (inst: any) => {
    try {
      const res = await adminFetch(`/instruments/${inst.id}/restore`, {
        method: "POST",
      });
      const data = await res.json();
      if (data.success) {
        showNotice(t("admin.instruments.restoreSuccess", { name: inst.name }));
        fetchInstruments();
        refreshAllStats();
        if (onInstrumentsChanged) onInstrumentsChanged();
      } else {
        showNotice(data.error || "Failed to restore instrument", "error");
      }
    } catch {
      showNotice("Failed to restore instrument", "error");
    }
  };

  const handleApproveRegistration = async (
    userId: string,
    userName: string,
  ) => {
    setApprovalActionId(userId);
    try {
      const res = await adminFetch(`/approvals/${userId}/approve`, {
        method: "POST",
      });
      const data = await res.json();
      if (data.success) {
        showNotice(t("admin.approvals.approveSuccess", { name: userName }));
        fetchApprovals();
        fetchUsers();
        refreshAllStats();
      } else {
        showNotice(data.error || "Failed to approve registration", "error");
      }
    } catch {
      showNotice("Failed to approve registration", "error");
    } finally {
      setApprovalActionId(null);
    }
  };

  const triggerRejectUser = (user: any) => {
    setConfirmModal({
      isOpen: true,
      title: t("admin.approvals.rejectTitle"),
      description: t("admin.approvals.rejectConfirm", { name: user.name }),
      confirmLabel: t("admin.approvals.rejectButton"),
      isDestructive: true,
      onConfirm: async () => {
        try {
          const res = await adminFetch(`/approvals/${user.id}/reject`, {
            method: "POST",
          });
          const data = await res.json();
          if (data.success) {
            showNotice(t("admin.approvals.rejectSuccess", { name: user.name }));
            setConfirmModal(null);
            fetchApprovals();
            fetchUsers();
            refreshAllStats();
          } else {
            showNotice(data.error || "Failed to reject registration", "error");
          }
        } catch {
          showNotice("Failed to reject registration", "error");
        }
      },
    });
  };

  const triggerDeleteUserPermanently = (user: any) => {
    setConfirmModal({
      isOpen: true,
      title: t("admin.approvals.deletePermanentlyTitle"),
      description: t("admin.approvals.deletePermanentlyConfirm", {
        name: user.name,
      }),
      confirmLabel: t("admin.approvals.deletePermanentlyButton"),
      isDestructive: true,
      onConfirm: async () => {
        try {
          const res = await adminFetch(`/users/${user.id}`, {
            method: "DELETE",
          });
          const data = await res.json();
          if (data.success) {
            showNotice(
              t("admin.approvals.deletePermanentlySuccess", {
                name: user.name,
              }),
            );
            setConfirmModal(null);
            fetchApprovals();
            fetchUsers();
            refreshAllStats();
          } else {
            showNotice(data.error || "Failed to delete user", "error");
          }
        } catch {
          showNotice("Failed to delete user", "error");
        }
      },
    });
  };

  const handleCreateAdmin = async (form: any) => {
    try {
      const res = await adminFetch("/admins", {
        method: "POST",
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (data.success) {
        showNotice("Admin account provisioned successfully!");
        setShowNewAdminModal(false);
        fetchAdmins();
      } else {
        showNotice(data.error || "Failed to create administrator", "error");
      }
    } catch {
      showNotice("Failed to create administrator", "error");
    }
  };

  const handleDemoteAdmin = (admin: any) => {
    setConfirmModal({
      isOpen: true,
      title: "Demote Super Admin",
      description: `Demote ${admin.name} to regular Admin? They will lose access to system configuration and admin management.`,
      confirmLabel: "Demote to Admin",
      onConfirm: async () => {
        try {
          const res = await adminFetch(`/admins/${admin.id}/demote`, {
            method: "POST",
          });
          const data = await res.json();
          if (data.success) {
            showNotice(`${admin.name} demoted to regular Admin`);
            setConfirmModal(null);
            fetchAdmins();
          } else {
            showNotice(data.error || "Failed to demote admin", "error");
          }
        } catch {
          showNotice("Failed to demote admin", "error");
        }
      },
    });
  };

  const handleRemoveAdmin = (admin: any) => {
    setConfirmModal({
      isOpen: true,
      title: "Remove Admin Account",
      description: `Permanently delete administrator account for ${admin.name}? This action cannot be undone.`,
      confirmLabel: "Delete Account",
      isDestructive: true,
      onConfirm: async () => {
        try {
          const res = await adminFetch(`/admins/${admin.id}`, {
            method: "DELETE",
          });
          const data = await res.json();
          if (data.success) {
            showNotice(`Administrator ${admin.name} removed`);
            setConfirmModal(null);
            fetchAdmins();
          } else {
            showNotice(data.error || "Failed to remove admin", "error");
          }
        } catch {
          showNotice("Failed to remove admin", "error");
        }
      },
    });
  };

  const handleOpenPromoteModal = (
    userId: string,
    userName: string,
    isMusician?: boolean,
  ) => {
    setPromoteModal({
      isOpen: true,
      userId,
      userName,
      role: "musician",
      isMusician: Boolean(isMusician),
    });
  };

  const executePromoteUser = async (
    targetRole: "user" | "admin" | "super_admin" | "musician",
  ) => {
    if (!promoteModal) return;
    try {
      if (targetRole === "musician" || targetRole === "user") {
        const nextMusician =
          targetRole === "musician" ? !promoteModal.isMusician : false;
        const res = await adminFetch(
          `/users/${promoteModal.userId}/musician-status`,
          {
            method: "POST",
            body: JSON.stringify({ isMusician: nextMusician }),
          },
        );
        const data = await res.json();
        if (data.success) {
          showNotice(
            nextMusician
              ? `Granted Church Musician role to ${promoteModal.userName} 🎵`
              : `Returned ${promoteModal.userName} to the regular user role`,
          );
          setPromoteModal(null);
          fetchUsers();
          setInternalSelectedUserId(null);
        } else {
          showNotice(data.error || "Failed to update musician status", "error");
        }
        return;
      }

      const res = await adminFetch(`/users/${promoteModal.userId}/promote`, {
        method: "POST",
        body: JSON.stringify({ role: targetRole }),
      });
      const data = await res.json();
      if (data.success) {
        showNotice(
          `Promoted ${promoteModal.userName} to ${targetRole === "super_admin" ? "Super Admin" : "Admin"}`,
        );
        setPromoteModal(null);
        fetchUsers();
        fetchAdmins();
        setInternalSelectedUserId(null);
      } else {
        showNotice(data.error || "Promotion failed", "error");
      }
    } catch {
      showNotice("Promotion failed", "error");
    }
  };

  const handleDeleteUser = async (userId: string) => {
    try {
      const res = await adminFetch(`/users/${userId}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (data.success) {
        showNotice("User account deleted successfully");
        setInternalSelectedUserId(null);
        fetchUsers();
        fetchApprovals();
        refreshAllStats();
      } else {
        showNotice(data.error || "Failed to delete user", "error");
      }
    } catch {
      showNotice("Failed to delete user", "error");
    }
  };

  const handleSaveHardLimits = async () => {
    if (!hardLimitsState) return;
    setSavingLimits(true);
    try {
      const payload = buildHardLimitsPayload(hardLimitsState);
      const res = await adminFetch("/hard-limits", {
        method: "PUT",
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (data.success) {
        showNotice("Fair usage limits updated successfully!");
        setHardLimitsState(
          normalizeHardLimitsState(data.limits || data.hardLimits),
        );
      } else {
        showNotice(data.error || "Failed to save limits", "error");
      }
    } catch {
      showNotice("Failed to save limits", "error");
    } finally {
      setSavingLimits(false);
    }
  };

  const handleSavePaymentSettings = async () => {
    setSavingPayment(true);
    try {
      const res = await adminFetch("/payment-settings", {
        method: "PUT",
        body: JSON.stringify(paymentSettingsState),
      });
      const data = await res.json();
      if (data.success) {
        showNotice("Payment settings saved successfully!");
      } else {
        showNotice(data.error || "Failed to save payment settings", "error");
      }
    } catch {
      showNotice("Failed to save payment settings", "error");
    } finally {
      setSavingPayment(false);
    }
  };

  const handleAdminSubscribeDevice = async () => {
    try {
      const sub = await subscribeToPush(sessionToken || undefined);
      if (sub) {
        setAdminDeviceSubscribed(true);
        showNotice(t("adminPush.subscribedSuccess"));
      } else {
        showNotice(t("adminPush.subscribeFailed"), "error");
      }
    } catch {
      showNotice(t("adminPush.subscribeFailed"), "error");
    }
  };

  const handleAdminTestPush = async () => {
    setTestPushSending(true);
    setTestPushStatus(null);
    const res = await sendTestNotification(sessionToken || undefined);
    setTestPushSending(false);
    if (res.success) {
      setTestPushStatus(t("adminPush.testDelivered"));
    } else {
      showNotice(res.error || t("adminPush.testFailed"), "error");
    }
  };

  const handleTogglePushPref = async (
    key:
      | "notifyNewRequests"
      | "notifyNewRegistrations"
      | "notifyMemberMessages",
    explicitValue?: boolean,
  ) => {
    const value =
      explicitValue !== undefined ? explicitValue : !adminPushPrefs[key];
    const updated: AdminPushPreferences = { ...adminPushPrefs, [key]: value };
    setAdminPushPrefs(updated);
    setSavingPushPrefs(true);
    try {
      await adminFetch("/push-preferences", {
        method: "PUT",
        body: JSON.stringify(updated),
      });
    } catch {
      // rollback on network fail
      setAdminPushPrefs(adminPushPrefs);
      showNotice(t("adminPush.prefSaveFailed"), "error");
    } finally {
      setSavingPushPrefs(false);
    }
  };

  const handleToggleEmailNotificationSetting = async (
    key: "muteAccountApprovalEmails" | "muteReservationRequestEmails",
    explicitValue?: boolean,
  ) => {
    if (!notificationSettingsState) return;
    const value =
      explicitValue !== undefined
        ? explicitValue
        : !notificationSettingsState[key];
    const updated = { ...notificationSettingsState, [key]: value };
    setNotificationSettingsState(updated);
    setSavingNotificationSettings(true);
    try {
      const res = await adminFetch("/notification-settings", {
        method: "PUT",
        body: JSON.stringify(updated),
      });
      const data = await res.json();
      if (!data.success) {
        setNotificationSettingsState(notificationSettingsState);
        showNotice("Failed to update notification setting", "error");
      }
    } catch {
      setNotificationSettingsState(notificationSettingsState);
      showNotice("Failed to update notification setting", "error");
    } finally {
      setSavingNotificationSettings(false);
    }
  };

  const handleBookOnBehalf = async (payload: any) => {
    try {
      const targetUserId = bookOnBehalfUser?.id || payload?.userId;
      const endpoint = payload?.occurrences
        ? targetUserId
          ? `/users/${targetUserId}/book-series-on-behalf`
          : "/reservations/book-series-on-behalf"
        : targetUserId
          ? `/users/${targetUserId}/book-on-behalf`
          : "/reservations/book-on-behalf";
      const res = await adminFetch(endpoint, {
        method: "POST",
        body: JSON.stringify({ ...payload, userId: targetUserId }),
      });
      const data = await res.json();
      if (data.success) {
        showNotice(
          payload?.occurrences
            ? "Recurring series booked and approved on behalf of member!"
            : "Reservation booked and approved on behalf of member!",
        );
        setBookOnBehalfUser(null);
        fetchReservations();
        refreshAllStats();
        return data;
      } else {
        showNotice(data.error || "Failed to book on behalf", "error");
        return null;
      }
    } catch (err: any) {
      showNotice(err?.message || "Failed to book on behalf", "error");
      return null;
    }
  };

  const enterSelectionMode = () => setIsSelectionMode(true);
  const exitSelectionMode = () => {
    setIsSelectionMode(false);
    setSelectedReservationIds([]);
  };

  const handleToggleSelectReservation = (id: string) => {
    setSelectedReservationIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id],
    );
  };

  const handleToggleSelectAllReservations = () => {
    if (reservations.length === 0) return;
    const allVisibleSelected = reservations.every((r) =>
      selectedReservationIds.includes(r.id),
    );
    if (allVisibleSelected) {
      const visibleIds = new Set(reservations.map((r) => r.id));
      setSelectedReservationIds((prev) =>
        prev.filter((id) => !visibleIds.has(id)),
      );
    } else {
      const combined = new Set([
        ...selectedReservationIds,
        ...reservations.map((r) => r.id),
      ]);
      setSelectedReservationIds(Array.from(combined));
    }
  };

  // Tab switch effect
  useEffect(() => {
    if (activeTab !== "review" && isSelectionMode) {
      setIsSelectionMode(false);
    }
    firstLoadRef.current = false;
    fetchStats();
    if (activeTab === "dashboard") {
      if (dashboardSubTab === "today") {
        fetchTodaysReservations();
      } else {
        fetchUpcomingReservations();
      }
    } else if (activeTab === "review") {
      fetchReservations();
      fetchInstruments();
    } else if (activeTab === "approvals") {
      fetchApprovals();
    } else if (activeTab === "instruments") {
      fetchInstruments();
    } else if (activeTab === "users") {
      fetchUsers();
      fetchInstruments();
    } else if (activeTab === "admin_accounts") {
      fetchAdmins();
    } else if (activeTab === "trusted_status") {
      fetchUsers();
      fetchAuditLogs();
    } else if (activeTab === "hard_limits") {
      fetchHardLimits();
    } else if (activeTab === "payment_settings") {
      fetchPaymentSettings();
    } else if (
      activeTab === "notification_settings" ||
      activeTab === "push_notifications"
    ) {
      fetchNotificationSettings();
    } else if (activeTab === "messaging") {
      fetchMessagingReservations();
    }
  }, [
    activeTab,
    filterQuickTab,
    reviewFilters.statuses.join(","),
    approvalFilterStatus,
    approvalSearch,
    userFilterStatus,
    userSearch,
    dashboardSubTab,
  ]);

  // Push prefs on entering push tab
  useEffect(() => {
    if (
      activeTab === "notification_settings" ||
      activeTab === "push_notifications"
    ) {
      fetchPushPreferences();
      getCurrentSubscription().then((sub) => {
        setAdminDeviceSubscribed(Boolean(sub));
      });
      if (isSuperAdmin) {
        fetchNotificationSettings();
      }
    }
  }, [activeTab, sessionToken, isSuperAdmin]);

  // ESC key for modals
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      e.stopPropagation();
      if (confirmModal) setConfirmModal(null);
      else if (promoteModal) setPromoteModal(null);
      else if (rejectModal) setRejectModal(null);
      else if (cancelReasonModal) setCancelReasonModal(null);
      else if (deletingInstrument) setDeletingInstrument(null);
      else if (removingInstrument) setRemovingInstrument(null);
      else if (showInstrumentModal) {
        setShowInstrumentModal(false);
        setEditingInstrument(null);
      } else if (showNewAdminModal) setShowNewAdminModal(false);
      else if (showHandoverModal) setShowHandoverModal(false);
      else if (internalSelectedUserId) setInternalSelectedUserId(null);
      else if (assignModal) setAssignModal(null);
      else if (bookOnBehalfUser) setBookOnBehalfUser(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [
    confirmModal,
    promoteModal,
    rejectModal,
    cancelReasonModal,
    deletingInstrument,
    removingInstrument,
    showInstrumentModal,
    showNewAdminModal,
    showHandoverModal,
    internalSelectedUserId,
    assignModal,
    bookOnBehalfUser,
  ]);

  const operationsTabs = useMemo(
    () => [
      { id: "dashboard" as const, label: t("admin.tabDashboard"), count: 0 },
      {
        id: "review" as const,
        label: t("admin.tabReview"),
        count: stats.pendingRequests,
      },
      {
        id: "approvals" as const,
        label: t("admin.tabApprovals"),
        count: stats.pendingUserApprovals || 0,
      },
      {
        id: "instruments" as const,
        label: t("admin.tabInstruments"),
        count: stats.totalInstruments,
      },
      {
        id: "users" as const,
        label: t("admin.tabUsers"),
        count: stats.activeUsers,
      },
      { id: "analytics" as const, label: t("admin.tabAnalytics"), count: 0 },
      { id: "messaging" as const, label: t("admin.tabMessaging"), count: 0 },
      {
        id: "notification_settings" as const,
        label: t("admin.tabNotificationSettings"),
        count: 0,
      },
    ],
    [t, stats],
  );

  const superAdminTabs = useMemo(
    () => [
      {
        id: "admin_accounts" as const,
        label: t("admin.tabAdminAccounts"),
        count: adminAccountsList.length,
      },
      {
        id: "trusted_status" as const,
        label: t("admin.tabTrustedStatus"),
        count: 0,
      },
      { id: "hard_limits" as const, label: t("admin.tabHardLimits"), count: 0 },
      {
        id: "payment_settings" as const,
        label: t("admin.tabPaymentSettings"),
        count: 0,
      },
    ],
    [t, adminAccountsList.length],
  );

  useEffect(() => {
    const allTabs = [
      ...operationsTabs.map((tb) => ({
        id: tb.id,
        label: tb.label,
        count: tb.count,
        section: "operations" as const,
      })),
      ...superAdminTabs.map((tb) => ({
        id: tb.id,
        label: tb.label,
        count: tb.count,
        section: "super_admin" as const,
      })),
    ];
    window.dispatchEvent(
      new CustomEvent(ADMIN_TABS_EVENT, {
        detail: { tabs: allTabs, activeTabId: activeTab },
      }),
    );
  }, [activeTab, operationsTabs, superAdminTabs]);

  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail as { id: string };
      if (detail?.id) setActiveTab(detail.id as AdminTab);
    };
    window.addEventListener(ADMIN_TABS_EVENT + ":select", handler);
    return () =>
      window.removeEventListener(ADMIN_TABS_EVENT + ":select", handler);
  }, []);

  const activeTabTitle = useMemo(() => {
    return (
      operationsTabs.find((tb) => tb.id === activeTab)?.label ||
      superAdminTabs.find((tb) => tb.id === activeTab)?.label ||
      t("admin.tabDashboard")
    );
  }, [operationsTabs, superAdminTabs, activeTab, t]);

  return {
    profile,
    sessionToken,
    t,
    isAr,
    isRTL,
    isSuperAdmin,
    internalSelectedUserId,
    setInternalSelectedUserId,
    internalSelectedEntityType,
    openUserProfile,
    activeTab,
    setActiveTab,
    operationsTabs,
    superAdminTabs,
    activeTabTitle,
    stats,
    reservations,
    loadingReservations,
    noShowWindowNow,
    todaysReservations,
    loadingTodaysReservations,
    dashboardSubTab,
    setDashboardSubTab,
    upcomingReservations,
    loadingUpcomingReservations,
    showDashboardFilters,
    setShowDashboardFilters,
    showReviewFilters,
    setShowReviewFilters,
    dashboardFilters,
    setDashboardFilters,
    reviewFilters,
    setReviewFilters,
    filterQuickTab,
    setFilterQuickTab,
    adminAccountsList,
    loadingAdmins,
    getAdminDisplayName,
    isReservationAdminBooked,
    getRowOwnerName,
    dashboardFilterOptions,
    reviewFilterOptions,
    filterDashboardReservations,
    filteredReviewReservations,
    clearDashboardFilters,
    clearReviewFilters,
    showHandoverModal,
    setShowHandoverModal,
    handoverDefaultDate,
    setHandoverDefaultDate,
    handoverDefaultMode,
    setHandoverDefaultMode,
    handoverDefaultFormat,
    setHandoverDefaultFormat,
    instrumentsList,
    loadingInstruments,
    showInstrumentModal,
    setShowInstrumentModal,
    editingInstrument,
    setEditingInstrument,
    instrumentForm,
    setInstrumentForm,
    removingInstrument,
    setRemovingInstrument,
    removeConfirmForce,
    setRemoveConfirmForce,
    deletingInstrument,
    setDeletingInstrument,
    deleteConfirmChecked,
    setDeleteConfirmChecked,
    isDeletingInstrument,
    usersList,
    loadingUsers,
    userSearch,
    setUserSearch,
    userFilterStatus,
    setUserFilterStatus,
    bookOnBehalfUser,
    setBookOnBehalfUser,
    approvalsList,
    loadingApprovals,
    approvalSearch,
    setApprovalSearch,
    approvalFilterStatus,
    setApprovalFilterStatus,
    approvalActionId,
    approvalCounts,
    trustedAuditLogs,
    musicianAuditLogs,
    loadingAuditLogs,
    messagingReservations,
    loadingMessagingReservations,
    selectedMsgReservation,
    setSelectedMsgReservation,
    messageText,
    setMessageText,
    sendingMessage,
    msgReservationSearch,
    setMsgReservationSearch,
    hardLimitsState,
    setHardLimitsState,
    loadingLimits,
    savingLimits,
    notificationSettingsState,
    savingNotificationSettings,
    paymentSettingsState,
    setPaymentSettingsState,
    savingPayment,
    adminPushPrefs,
    loadingPushPrefs,
    savingPushPrefs,
    adminDeviceSubscribed,
    testPushSending,
    testPushStatus,
    feedback,
    setFeedback,
    rejectModal,
    setRejectModal,
    cancelReasonModal,
    setCancelReasonModal,
    confirmModal,
    setConfirmModal,
    showNewAdminModal,
    setShowNewAdminModal,
    newAdminForm,
    setNewAdminForm,
    promoteModal,
    setPromoteModal,
    assignModal,
    setAssignModal,
    isSelectionMode,
    setIsSelectionMode,
    selectedReservationIds,
    setSelectedReservationIds,
    expandedSeriesIds,
    setExpandedSeriesIds,
    showNotice,
    adminFetch,
    refreshAllStats,
    fetchStats,
    fetchReservations,
    fetchTodaysReservations,
    fetchUpcomingReservations,
    fetchInstruments,
    fetchUsers,
    fetchApprovals,
    fetchAdmins,
    fetchAuditLogs,
    fetchHardLimits,
    fetchNotificationSettings,
    fetchPaymentSettings,
    fetchPushPreferences,
    fetchMessagingReservations,
    handleSendMessage,
    handleApprove,
    handleApproveSeries,
    openRejectModal,
    handleConfirmReject,
    handleMarkNoShow,
    handleUnmarkNoShow,
    handleTriggerBulkCancel,
    handleConfirmBulkCancel,
    handleTriggerBulkDelete,
    handleSaveInstrument,
    handleExecuteRemoveInstrument,
    handleExecuteDeleteInstrument,
    handleRestoreInstrument,
    handleApproveRegistration,
    triggerRejectUser,
    triggerDeleteUserPermanently,
    handleCreateAdmin,
    handleDemoteAdmin,
    handleRemoveAdmin,
    handleOpenPromoteModal,
    executePromoteUser,
    handleDeleteUser,
    handleSaveHardLimits,
    handleSavePaymentSettings,
    handleAdminSubscribeDevice,
    handleAdminTestPush,
    handleTogglePushPref,
    handleToggleEmailNotificationSetting,
    handleBookOnBehalf,
    enterSelectionMode,
    exitSelectionMode,
    handleToggleSelectReservation,
    handleToggleSelectAllReservations,
  };
}
