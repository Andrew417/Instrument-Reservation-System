import React, { useState, useEffect, useRef } from "react";
import { useAuth } from "../contexts/AuthContext.tsx";
import { Instrument } from "./AvailabilityCalendar.tsx";
import { getTodayDateString } from "../lib/date-utils.ts";
import {
  Shield,
  LayoutDashboard,
  CalendarCheck,
  Music2,
  Users,
  MessageSquare,
  ShieldCheck,
  Sliders,
  CreditCard,
  CheckCircle2,
  XCircle,
  Clock,
  Search,
  Filter,
  Plus,
  Trash2,
  Edit,
  AlertTriangle,
  Sparkles,
  ChevronRight,
  UserCheck,
  UserX,
  UserPlus,
  RefreshCw,
  Send,
  Lock,
  ArrowRight,
  History,
  Check,
  X,
  Info,
  CalendarDays,
  Coins,
  ShieldAlert,
  SlidersHorizontal,
  ChevronDown,
  Repeat,
  Upload,
  Archive,
} from "lucide-react";

interface AdminPortalProps {
  onBackToMemberView?: () => void;
  onOpenReservationDetail?: (reservationId: string) => void;
  onInstrumentsChanged?: () => void;
}

type AdminTab =
  | "dashboard"
  | "review"
  | "approvals"
  | "instruments"
  | "users"
  | "messaging"
  // Super Admin Exclusive Tabs
  | "admin_accounts"
  | "trusted_status"
  | "hard_limits"
  | "payment_settings";

export const AdminPortal: React.FC<AdminPortalProps> = ({
  onBackToMemberView,
  onOpenReservationDetail,
  onInstrumentsChanged,
}) => {
  const { profile, sessionToken } = useAuth();
  const isSuperAdmin = profile?.role === "super_admin" || profile?.isSuperAdmin;

  // Active Tab
  const [activeTab, setActiveTab] = useState<AdminTab>("dashboard");

  // Stats
  const [stats, setStats] = useState<{
    totalInstruments: number;
    pendingRequests: number;
    todayReservations: number;
    activeUsers: number;
    pendingUserApprovals?: number;
  }>({
    totalInstruments: 0,
    pendingRequests: 0,
    todayReservations: 0,
    activeUsers: 0,
    pendingUserApprovals: 0,
  });

  // Reservations state & filters
  const [reservations, setReservations] = useState<any[]>([]);
  const [loadingReservations, setLoadingReservations] =
    useState<boolean>(false);

  const [filterQuickTab, setFilterQuickTab] = useState<
    "all" | "today" | "pending"
  >("pending");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [filterInstrument, setFilterInstrument] = useState<string>("all");
  const [filterSearch, setFilterSearch] = useState<string>("");
  const [filterStartDate, setFilterStartDate] = useState<string>("");
  const [filterEndDate, setFilterEndDate] = useState<string>("");

  // Instruments
  const [instrumentsList, setInstrumentsList] = useState<any[]>([]);
  const [loadingInstruments, setLoadingInstruments] = useState<boolean>(false);
  const [showInstrumentModal, setShowInstrumentModal] =
    useState<boolean>(false);
  const [editingInstrument, setEditingInstrument] = useState<any | null>(null);
  const [instrumentForm, setInstrumentForm] = useState({
    name: "",
    type: "Keyboards",
    photoUrl: "",
    description: "",
    outsideFeePerDay: "0.00",
    bookingMode: "instant",
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

  // Instrument Photo Upload States
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDraggingPhoto, setIsDraggingPhoto] = useState<boolean>(false);
  const [isProcessingPhoto, setIsProcessingPhoto] = useState<boolean>(false);
  const [showUrlInput, setShowUrlInput] = useState<boolean>(false);
  const [photoUploadError, setPhotoUploadError] = useState<string | null>(null);

  // Client-side image processor: compresses large images with Canvas to keep payloads optimal
  const processImageFile = (file: File) => {
    if (!file.type.startsWith("image/")) {
      setPhotoUploadError(
        "Please select a valid image file (PNG, JPG, WEBP, GIF).",
      );
      return;
    }
    setPhotoUploadError(null);
    setIsProcessingPhoto(true);

    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new window.Image();
      img.onload = () => {
        const maxDim = 1200;
        let width = img.width;
        let height = img.height;

        if (width > maxDim || height > maxDim) {
          if (width > height) {
            height = Math.round((height * maxDim) / width);
            width = maxDim;
          } else {
            width = Math.round((width * maxDim) / height);
            height = maxDim;
          }
        }

        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        if (ctx) {
          ctx.drawImage(img, 0, 0, width, height);
          const dataUrl = canvas.toDataURL("image/jpeg", 0.86);
          setInstrumentForm((prev) => ({ ...prev, photoUrl: dataUrl }));
        } else {
          setInstrumentForm((prev) => ({
            ...prev,
            photoUrl: String(e.target?.result || ""),
          }));
        }
        setIsProcessingPhoto(false);
      };
      img.onerror = () => {
        setIsProcessingPhoto(false);
        setPhotoUploadError("Failed to decode image file.");
      };
      img.src = String(e.target?.result || "");
    };
    reader.onerror = () => {
      setIsProcessingPhoto(false);
      setPhotoUploadError("Failed to read file from disk.");
    };
    reader.readAsDataURL(file);
  };

  const handlePhotoDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingPhoto(false);

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      processImageFile(e.dataTransfer.files[0]);
    }
  };

  const handlePhotoDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingPhoto(true);
  };

  const handlePhotoDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingPhoto(false);
  };

  const handlePhotoFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      processImageFile(e.target.files[0]);
    }
  };

  const handleRemovePhoto = () => {
    setInstrumentForm((prev) => ({ ...prev, photoUrl: "" }));
    setPhotoUploadError(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  // Users
  const [usersList, setUsersList] = useState<any[]>([]);
  const [loadingUsers, setLoadingUsers] = useState<boolean>(false);
  const [userSearch, setUserSearch] = useState<string>("");
  const [userFilterStatus, setUserFilterStatus] = useState<string>("all");

  // Account Approvals
  const [approvalsList, setApprovalsList] = useState<any[]>([]);
  const [loadingApprovals, setLoadingApprovals] = useState<boolean>(false);
  const [approvalFilterStatus, setApprovalFilterStatus] = useState<
    "pending" | "rejected" | "approved" | "all"
  >("pending");
  const [approvalSearch, setApprovalSearch] = useState<string>("");
  const [approvalCounts, setApprovalCounts] = useState<{
    pending: number;
    approved: number;
    rejected: number;
    total: number;
  }>({ pending: 0, approved: 0, rejected: 0, total: 0 });
  const [approvalActionId, setApprovalActionId] = useState<string | null>(null);

  // Impersonation / Book on behalf
  const [bookOnBehalfUser, setBookOnBehalfUser] = useState<any | null>(null);
  const [behalfForm, setBehalfForm] = useState({
    instrumentId: "",
    serviceName: "",
    date: getTodayDateString(),
    startTime: "10:00",
    duration: 2,
    reservationType: "in_church",
  });

  // Messaging (Scoped to reservation)
  const [selectedMsgReservation, setSelectedMsgReservation] = useState<
    any | null
  >(null);
  const [messageText, setMessageText] = useState<string>("");
  const [sendingMessage, setSendingMessage] = useState<boolean>(false);

  // Super Admin: Admin Accounts
  const [adminAccountsList, setAdminAccountsList] = useState<any[]>([]);
  const [loadingAdmins, setLoadingAdmins] = useState<boolean>(false);
  const [showNewAdminModal, setShowNewAdminModal] = useState<boolean>(false);
  const [newAdminForm, setNewAdminForm] = useState({
    name: "",
    email: "",
    phoneNumber: "",
    password: "",
    isSuperAdmin: false,
  });

  // Super Admin: Trusted Status Audit Logs
  const [trustedAuditLogs, setTrustedAuditLogs] = useState<any[]>([]);
  const [loadingAuditLogs, setLoadingAuditLogs] = useState<boolean>(false);

  // Super Admin: Hard Limits
  const [hardLimitsState, setHardLimitsState] = useState<any>({
    maxActiveReservations: 5,
    maxReservationsPerDay: 5,
    maxDurationHours: 5,
    maxConcurrentPerType: 2,
    maxSeriesOccurrences: 8,
    maxSubmissionsPerHour: 10,
  });
  const [savingLimits, setSavingLimits] = useState<boolean>(false);

  // Super Admin: Payment Settings
  const [paymentSettingsState, setPaymentSettingsState] = useState<{
    instapayNumber: string;
    instapayLink: string;
  }>({
    instapayNumber: "",
    instapayLink: "",
  });
  const [savingPayment, setSavingPayment] = useState<boolean>(false);

  // In-App Rejection Modal State (Replaces blocked window.prompt)
  const [rejectModal, setRejectModal] = useState<{
    isOpen: boolean;
    reservationId?: string;
    seriesId?: string | null;
    isSeriesReject: boolean;
    isBulk?: boolean;
    bulkIds?: string[];
    seriesOccurrencesCount?: number;
    memberName: string;
    instrumentName: string;
    dateFormatted: string;
    timeFormatted: string;
    reason: string;
    submitting: boolean;
  } | null>(null);

  // Selected reservations for multi-select bulk actions
  const [selectedReservationIds, setSelectedReservationIds] = useState<
    string[]
  >([]);

  // In-App Confirmation Modal State (Replaces blocked window.confirm)
  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    title: string;
    description: string;
    confirmLabel: string;
    isDestructive?: boolean;
    onConfirm: () => Promise<void> | void;
  } | null>(null);

  const [promoteModal, setPromoteModal] = useState<{
    userId: string;
    userName: string;
  } | null>(null);

  // Feedback banner
  const [feedback, setFeedback] = useState<{
    type: "success" | "error" | "info";
    message: string;
  } | null>(null);

  const showNotice = (
    message: string,
    type: "success" | "error" | "info" = "success",
  ) => {
    setFeedback({ type, message });
    setTimeout(() => setFeedback(null), 5000);
  };

  // Helper fetch with session token
  const adminFetch = async (endpoint: string, options: RequestInit = {}) => {
    const res = await fetch(`/api/admin${endpoint}`, {
      ...options,
      cache: "no-store",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${sessionToken || ""}`,
        ...(options.headers || {}),
      },
    });
    return res;
  };

  // Fetch Dashboard Stats
  const fetchStats = async () => {
    try {
      const res = await adminFetch("/dashboard-stats");
      const data = await res.json();
      if (data.success) {
        setStats(data.stats);
      }
    } catch {
      // silent
    }
  };

  // Fetch Reservations
  const fetchReservations = async () => {
    setLoadingReservations(true);
    try {
      const params = new URLSearchParams();
      if (filterQuickTab !== "all") params.append("quickTab", filterQuickTab);
      if (filterStatus !== "all") params.append("status", filterStatus);
      if (filterInstrument !== "all")
        params.append("instrumentId", filterInstrument);
      if (filterSearch) params.append("search", filterSearch);
      if (filterStartDate) params.append("startDate", filterStartDate);
      if (filterEndDate) params.append("endDate", filterEndDate);

      const res = await adminFetch(`/reservations?${params.toString()}`);
      const data = await res.json();
      if (data.success) {
        setReservations(data.reservations);
      }
    } catch {
      showNotice("Failed to load reservations", "error");
    } finally {
      setLoadingReservations(false);
    }
  };

  // Fetch Instruments
  const fetchInstruments = async () => {
    setLoadingInstruments(true);
    try {
      const res = await adminFetch("/instruments?includeRemoved=true");
      const data = await res.json();
      if (data.success) {
        setInstrumentsList(data.instruments);
        if (data.instruments.length > 0 && !behalfForm.instrumentId) {
          setBehalfForm((prev) => ({
            ...prev,
            instrumentId: data.instruments[0].id,
          }));
        }
      }
    } catch {
      showNotice("Failed to load instruments", "error");
    } finally {
      setLoadingInstruments(false);
    }
  };

  // Fetch Users
  const fetchUsers = async () => {
    setLoadingUsers(true);
    try {
      const params = new URLSearchParams();
      if (userFilterStatus !== "all") params.append("status", userFilterStatus);
      if (userSearch) params.append("search", userSearch);

      const res = await adminFetch(`/users?${params.toString()}`);
      const data = await res.json();
      if (data.success) {
        setUsersList(data.users);
      }
    } catch {
      showNotice("Failed to load church users", "error");
    } finally {
      setLoadingUsers(false);
    }
  };

  // Fetch Account Approvals
  const fetchApprovals = async () => {
    setLoadingApprovals(true);
    try {
      const params = new URLSearchParams();
      if (approvalFilterStatus !== "all")
        params.append("status", approvalFilterStatus);
      if (approvalSearch) params.append("search", approvalSearch);

      const res = await adminFetch(`/approvals?${params.toString()}`);
      const data = await res.json();
      if (data.success) {
        setApprovalsList(data.users || []);
        if (data.counts) {
          setApprovalCounts(data.counts);
          setStats((prev) => ({
            ...prev,
            pendingUserApprovals: data.counts.pending,
          }));
        }
      }
    } catch {
      showNotice("Failed to load registration approvals", "error");
    } finally {
      setLoadingApprovals(false);
    }
  };

  // Approve User Registration
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
        showNotice(
          `Account for ${userName} approved! They can now log in normally.`,
          "success",
        );
        await fetchApprovals();
        await fetchStats();
        if (activeTab === "users") await fetchUsers();
      } else {
        showNotice(data.error || "Failed to approve registration", "error");
      }
    } catch {
      showNotice("Network error while approving registration", "error");
    } finally {
      setApprovalActionId(null);
    }
  };

  // Reject User Registration (Preserves with approvalStatus = 'rejected' per Option B)
  const handleRejectRegistration = async (userId: string, userName: string) => {
    setApprovalActionId(userId);
    try {
      const res = await adminFetch(`/approvals/${userId}/reject`, {
        method: "POST",
      });
      const data = await res.json();
      if (data.success) {
        showNotice(
          `Registration for ${userName} marked as rejected. Record preserved in audit log.`,
          "info",
        );
        await fetchApprovals();
        await fetchStats();
        if (activeTab === "users") await fetchUsers();
      } else {
        showNotice(data.error || "Failed to reject registration", "error");
      }
    } catch {
      showNotice("Network error while rejecting registration", "error");
    } finally {
      setApprovalActionId(null);
    }
  };

  const triggerRejectUser = (user: any) => {
    setConfirmModal({
      isOpen: true,
      title: `Reject Registration: ${user.name}?`,
      description: `This application will be marked as Rejected. Per church audit policy, this record remains in the database to prevent unauthorized access and maintain an audit log. ${user.name} will not be able to log in.`,
      confirmLabel: "Reject Application",
      isDestructive: true,
      onConfirm: async () => {
        setConfirmModal(null);
        await handleRejectRegistration(user.id, user.name);
      },
    });
  };

  // Delete User permanently (for correcting mistaken entries)
  const handleDeleteUserPermanently = async (
    userId: string,
    userName: string,
  ) => {
    setApprovalActionId(userId);
    try {
      const res = await adminFetch(`/users/${userId}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (data.success) {
        showNotice(
          `Account entry for ${userName} permanently removed from database.`,
          "info",
        );
        await fetchApprovals();
        await fetchUsers();
        await fetchStats();
      } else {
        showNotice(data.error || "Failed to delete user entry", "error");
      }
    } catch {
      showNotice("Network error deleting user", "error");
    } finally {
      setApprovalActionId(null);
    }
  };

  const triggerDeleteUserPermanently = (user: any) => {
    setConfirmModal({
      isOpen: true,
      title: `Permanently Delete ${user.name}?`,
      description: `This will permanently remove ${user.name} (${user.phoneNumber || user.phone_number}) from the database. Use this ONLY for correcting mistaken entries or typos. This action cannot be undone.`,
      confirmLabel: "Delete Permanently",
      isDestructive: true,
      onConfirm: async () => {
        setConfirmModal(null);
        await handleDeleteUserPermanently(user.id, user.name);
      },
    });
  };

  // Fetch Admin Accounts (Super Admin)
  const fetchAdmins = async () => {
    if (!isSuperAdmin) return;
    setLoadingAdmins(true);
    try {
      const res = await adminFetch("/admins");
      const data = await res.json();
      if (data.success) {
        setAdminAccountsList(
          data.admins.map((a: any) => ({
            ...a,
            isSuperAdmin: a.is_super_admin,
            phoneNumber: a.phone_number,
            createdAt: a.created_at,
          })),
        );
      }
    } catch {
      // silent
    } finally {
      setLoadingAdmins(false);
    }
  };

  // Fetch Audit Logs (Super Admin)
  const fetchAuditLogs = async () => {
    if (!isSuperAdmin) return;
    setLoadingAuditLogs(true);
    try {
      const res = await adminFetch("/trusted-audit-logs");
      const data = await res.json();
      if (data.success) {
        setTrustedAuditLogs(data.auditLogs);
      }
    } catch {
      // silent
    } finally {
      setLoadingAuditLogs(false);
    }
  };

  const normalizeLimits = (limits: any) => {
    if (!limits) {
      return {
        maxActiveReservations: 5,
        maxReservationsPerDay: 5,
        maxDurationHours: 5,
        maxConcurrentPerType: 2,
        maxSeriesOccurrences: 8,
        maxSubmissionsPerHour: 10,
      };
    }
    return {
      id: limits.id,
      maxActiveReservations: Number(
        limits.maxActiveReservations ?? limits.max_active_reservations ?? 5,
      ),
      maxReservationsPerDay: Number(
        limits.maxReservationsPerDay ?? limits.max_reservations_per_day ?? 5,
      ),
      maxDurationHours: Number(
        limits.maxDurationHours ?? limits.max_duration_hours ?? 5,
      ),
      maxConcurrentPerType: Number(
        limits.maxConcurrentPerType ?? limits.max_concurrent_per_type ?? 2,
      ),
      maxSeriesOccurrences: Number(
        limits.maxSeriesOccurrences ?? limits.max_series_occurrences ?? 8,
      ),
      maxSubmissionsPerHour: Number(
        limits.maxSubmissionsPerHour ?? limits.max_submissions_per_hour ?? 10,
      ),
    };
  };

  // Fetch Hard Limits (Super Admin)
  const fetchHardLimits = async () => {
    if (!isSuperAdmin) return;
    try {
      const res = await adminFetch("/hard-limits");
      const data = await res.json();
      if (data.success && data.limits) {
        setHardLimitsState(normalizeLimits(data.limits));
      }
    } catch {
      // silent
    }
  };

  // Fetch Payment Settings (Super Admin)
  const fetchPaymentSettings = async () => {
    if (!isSuperAdmin) return;
    try {
      const res = await adminFetch("/payment-settings");
      const data = await res.json();
      if (data.success && data.settings) {
        setPaymentSettingsState({
          instapayNumber: data.settings.instapay_number || "",
          instapayLink: data.settings.instapay_link || "",
        });
      }
    } catch {
      // silent
    }
  };

  // Trigger loads on tab switch
  useEffect(() => {
    fetchStats();
    if (activeTab === "dashboard" || activeTab === "review") {
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
    } else if (activeTab === "messaging") {
      fetchReservations();
    }
  }, [activeTab, filterQuickTab, filterStatus, filterInstrument]);

  // Refetch approvals when filters or search query change
  useEffect(() => {
    if (activeTab === "approvals") {
      fetchApprovals();
    }
  }, [approvalFilterStatus, approvalSearch]);

  // Actions: Approve / Reject Reservation
  const handleApprove = async (reservationId: string) => {
    try {
      const res = await adminFetch(`/reservations/${reservationId}/approve`, {
        method: "POST",
      });
      const data = await res.json();
      if (data.success) {
        showNotice(
          "Reservation approved. Conflicting pending slots auto-rejected.",
        );
        fetchReservations();
        fetchStats();
      } else {
        showNotice(data.error || "Failed to approve", "error");
      }
    } catch (err: any) {
      showNotice(err.message, "error");
    }
  };

  const openRejectModal = (r: any) => {
    const startDate = new Date(r.start_time).toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
    });
    const timeRange = `${new Date(r.start_time).toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    })} - ${new Date(r.end_time).toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    })}`;

    setRejectModal({
      isOpen: true,
      reservationId: r.id,
      seriesId: r.series_id || null,
      isSeriesReject: false,
      memberName: r.user_name || "Member",
      instrumentName: r.instrument_name || "Instrument",
      dateFormatted: startDate,
      timeFormatted: timeRange,
      reason: "Slot unavailable due to scheduling conflict",
      submitting: false,
    });
  };

  const handleConfirmReject = async () => {
    if (!rejectModal) return;
    const { reservationId, seriesId, isSeriesReject, reason } = rejectModal;
    if (!reason.trim()) {
      showNotice("Please specify a rejection reason for the member.", "error");
      return;
    }

    setRejectModal((prev) => (prev ? { ...prev, submitting: true } : null));

    try {
      if (isSeriesReject && seriesId) {
        const res = await adminFetch(`/series/${seriesId}/reject-all`, {
          method: "POST",
          body: JSON.stringify({ reason: reason.trim() }),
        });
        const data = await res.json();
        if (data.success) {
          showNotice(
            "Entire future recurring series rejected and member notified.",
          );
          setRejectModal(null);
          fetchReservations();
          fetchStats();
        } else {
          showNotice(data.error || "Failed to reject series", "error");
          setRejectModal((prev) =>
            prev ? { ...prev, submitting: false } : null,
          );
        }
      } else {
        const res = await adminFetch(`/reservations/${reservationId}/reject`, {
          method: "POST",
          body: JSON.stringify({ reason: reason.trim() }),
        });
        const data = await res.json();
        if (data.success) {
          showNotice("Reservation request rejected and member notified.");
          setRejectModal(null);
          fetchReservations();
          fetchStats();
        } else {
          showNotice(data.error || "Failed to reject reservation", "error");
          setRejectModal((prev) =>
            prev ? { ...prev, submitting: false } : null,
          );
        }
      }
    } catch (err: any) {
      showNotice(err.message || "Error rejecting reservation", "error");
      setRejectModal((prev) => (prev ? { ...prev, submitting: false } : null));
    }
  };

  // Series Approve / Reject All
  const handleApproveSeries = (seriesId: string) => {
    setConfirmModal({
      isOpen: true,
      title: "Approve Recurring Series",
      description:
        "Approve all future pending occurrences in this recurring series?",
      confirmLabel: "Approve All Occurrences",
      isDestructive: false,
      onConfirm: async () => {
        try {
          const res = await adminFetch(`/series/${seriesId}/approve-all`, {
            method: "POST",
          });
          const data = await res.json();
          if (data.success) {
            showNotice("All future recurring occurrences approved.");
            fetchReservations();
            fetchStats();
          } else {
            showNotice(data.error, "error");
          }
        } catch (err: any) {
          showNotice(err.message, "error");
        } finally {
          setConfirmModal(null);
        }
      },
    });
  };

  const handleRejectSeries = (r: any) => {
    openRejectModal({ ...r, isSeriesReject: true });
  };

  // Instrument CRUD
  const handleSaveInstrument = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingInstrument) {
        const res = await adminFetch(`/instruments/${editingInstrument.id}`, {
          method: "PUT",
          body: JSON.stringify(instrumentForm),
        });
        const data = await res.json();
        if (data.success) {
          showNotice("Instrument updated successfully.");
          setShowInstrumentModal(false);
          setEditingInstrument(null);
          fetchInstruments();
          onInstrumentsChanged?.();
        } else {
          showNotice(data.error, "error");
        }
      } else {
        const res = await adminFetch("/instruments", {
          method: "POST",
          body: JSON.stringify(instrumentForm),
        });
        const data = await res.json();
        if (data.success) {
          showNotice("Instrument added to inventory.");
          setShowInstrumentModal(false);
          fetchInstruments();
          onInstrumentsChanged?.();
        } else {
          showNotice(data.error, "error");
        }
      }
    } catch (err: any) {
      showNotice(err.message, "error");
    }
  };

  // Force Remove Instrument
  const handleExecuteRemoveInstrument = async () => {
    if (!removingInstrument) return;
    try {
      const res = await adminFetch(
        `/instruments/${removingInstrument.id}/remove`,
        {
          method: "POST",
          body: JSON.stringify({ confirmForce: removeConfirmForce }),
        },
      );
      const data = await res.json();
      if (data.success) {
        showNotice(
          `Instrument removed. ${data.cancelledCount || 0} future reservations were cancelled and members notified.`,
        );
        setRemovingInstrument(null);
        setRemoveConfirmForce(false);
        fetchInstruments();
        fetchStats();
      } else {
        showNotice(data.error || "Cannot remove instrument", "error");
      }
    } catch (err: any) {
      showNotice(err.message, "error");
    }
  };

  // Permanently Delete Mistaken Instrument Entry (Direct DB Row Removal)
  const handleExecuteDeleteInstrument = async () => {
    if (!deletingInstrument) return;
    setIsDeletingInstrument(true);
    try {
      const res = await adminFetch(`/instruments/${deletingInstrument.id}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (data.success) {
        showNotice(
          data.message ||
            `Instrument "${deletingInstrument.name}" permanently deleted from database.`,
        );
        setDeletingInstrument(null);
        setDeleteConfirmChecked(false);
        fetchInstruments();
        fetchStats();
        onInstrumentsChanged?.();
      } else {
        showNotice(
          data.error || "Cannot delete instrument from database.",
          "error",
        );
      }
    } catch (err: any) {
      showNotice(err.message, "error");
    } finally {
      setIsDeletingInstrument(false);
    }
  };

  // User Actions: Toggle Active Status
  const handleToggleUserActive = (
    userId: string,
    currentActive: boolean,
    userName: string,
  ) => {
    const targetStatus = !currentActive;
    setConfirmModal({
      isOpen: true,
      title: targetStatus
        ? "Reactivate Member Account"
        : "Deactivate Member Account",
      description: targetStatus
        ? `Reactivate account for "${userName}"? They will regain access to reserving instruments.`
        : `Deactivate account for "${userName}"? They will temporarily lose access to reserve instruments.`,
      confirmLabel: targetStatus ? "Reactivate Account" : "Deactivate Account",
      isDestructive: !targetStatus,
      onConfirm: async () => {
        try {
          const res = await adminFetch(`/users/${userId}/toggle-status`, {
            method: "POST",
            body: JSON.stringify({ isActive: targetStatus }),
          });
          const data = await res.json();
          if (data.success) {
            showNotice(data.message);
            fetchUsers();
          } else {
            showNotice(data.error, "error");
          }
        } catch (err: any) {
          showNotice(err.message, "error");
        } finally {
          setConfirmModal(null);
        }
      },
    });
  };

  // User Actions: Delete Account
  const handleDeleteUser = (userId: string, userName: string) => {
    setConfirmModal({
      isOpen: true,
      title: "Permanently Delete Member Account",
      description: `Permanently delete account for "${userName}"? This cannot be undone.`,
      confirmLabel: "Delete Account",
      isDestructive: true,
      onConfirm: async () => {
        try {
          const res = await adminFetch(`/users/${userId}`, {
            method: "DELETE",
          });
          const data = await res.json();
          if (data.success) {
            showNotice(data.message);
            fetchUsers();
          } else {
            showNotice(data.error, "error");
          }
        } catch (err: any) {
          showNotice(err.message, "error");
        } finally {
          setConfirmModal(null);
        }
      },
    });
  };

  // Book on Behalf of User
  const handleBookOnBehalf = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!bookOnBehalfUser) return;
    try {
      const res = await adminFetch(
        `/users/${bookOnBehalfUser.id}/book-on-behalf`,
        {
          method: "POST",
          body: JSON.stringify(behalfForm),
        },
      );
      const data = await res.json();
      if (data.success) {
        showNotice(
          `Reservation created & auto-approved on behalf of ${bookOnBehalfUser.name}.`,
        );
        setBookOnBehalfUser(null);
        fetchStats();
      } else {
        showNotice(data.error, "error");
      }
    } catch (err: any) {
      showNotice(err.message, "error");
    }
  };

  // Messaging: Send scoped message
  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedMsgReservation || !messageText.trim()) return;
    setSendingMessage(true);
    try {
      const res = await adminFetch(
        `/reservations/${selectedMsgReservation.id}/message`,
        {
          method: "POST",
          body: JSON.stringify({ content: messageText }),
        },
      );
      const data = await res.json();
      if (data.success) {
        showNotice("Message sent to member and recorded on reservation.");
        setMessageText("");
        setSelectedMsgReservation(null);
      } else {
        showNotice(data.error, "error");
      }
    } catch (err: any) {
      showNotice(err.message, "error");
    } finally {
      setSendingMessage(false);
    }
  };

  const handleOpenPromoteModal = (userId: string, userName: string) => {
    setPromoteModal({ userId, userName });
  };

  const executePromoteUser = async (role: "admin" | "super_admin") => {
    if (!promoteModal) return;
    const { userId, userName } = promoteModal;
    try {
      const res = await adminFetch(`/users/${userId}/promote`, {
        method: "POST",
        body: JSON.stringify({ role }),
      });
      const data = await res.json();
      if (data.success) {
        showNotice(data.message);
        fetchUsers();
        fetchAdmins();
      } else {
        showNotice(data.error, "error");
      }
    } catch (err: any) {
      showNotice(err.message, "error");
    } finally {
      setPromoteModal(null);
    }
  };
  // Super Admin: Toggle Trusted Status (with audit log)
  const handleToggleTrusted = (
    userId: string,
    currentTrusted: boolean,
    userName: string,
  ) => {
    const targetStatus = !currentTrusted;
    setConfirmModal({
      isOpen: true,
      title: targetStatus
        ? "Grant Trusted Member Status"
        : "Revoke Trusted Member Status",
      description: targetStatus
        ? `Grant Trusted Member status to "${userName}"? Trusted members can make extended bookings and reserve recurring slots without friction. This will be recorded in the Super Admin audit log.`
        : `Revoke Trusted Member status from "${userName}"? Standard reservation policies will apply. This will be recorded in the Super Admin audit log.`,
      confirmLabel: targetStatus
        ? "Grant Trusted Status"
        : "Revoke Trusted Status",
      isDestructive: !targetStatus,
      onConfirm: async () => {
        try {
          const res = await adminFetch(`/users/${userId}/trusted-status`, {
            method: "POST",
            body: JSON.stringify({ isTrusted: targetStatus }),
          });
          const data = await res.json();
          if (data.success) {
            showNotice(data.message);
            fetchUsers();
            fetchAuditLogs();
          } else {
            showNotice(data.error, "error");
          }
        } catch (err: any) {
          showNotice(err.message, "error");
        } finally {
          setConfirmModal(null);
        }
      },
    });
  };

  // Super Admin: Create Admin Account
  const handleCreateAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await adminFetch("/admins", {
        method: "POST",
        body: JSON.stringify(newAdminForm),
      });
      const data = await res.json();
      if (data.success) {
        showNotice("Administrator account created successfully.");
        setShowNewAdminModal(false);
        setNewAdminForm({
          name: "",
          email: "",
          phoneNumber: "",
          password: "",
          isSuperAdmin: false,
        });
        fetchAdmins();
      } else {
        showNotice(data.error || "Failed to create admin", "error");
      }
    } catch (err: any) {
      showNotice(err.message, "error");
    }
  };

  // Super Admin: Remove Admin Account
  const handleRemoveAdmin = (adminId: string, adminName: string) => {
    setConfirmModal({
      isOpen: true,
      title: "Remove Administrator Account",
      description: `Delete administrator account for "${adminName}"?`,
      confirmLabel: "Delete Administrator",
      isDestructive: true,
      onConfirm: async () => {
        try {
          const res = await adminFetch(`/admins/${adminId}`, {
            method: "DELETE",
          });
          const data = await res.json();
          if (data.success) {
            showNotice(data.message);
            fetchAdmins();
          } else {
            showNotice(data.error, "error");
          }
        } catch (err: any) {
          showNotice(err.message, "error");
        } finally {
          setConfirmModal(null);
        }
      },
    });
  };

  const handleDemoteAdmin = (adminId: string, adminName: string) => {
    setConfirmModal({
      isOpen: true,
      title: "Demote to Regular Member",
      description: `Demote "${adminName}" back to a regular church member? Their admin access will be revoked.`,
      confirmLabel: "Demote",
      isDestructive: true,
      onConfirm: async () => {
        try {
          const res = await adminFetch(`/admins/${adminId}/demote`, {
            method: "POST",
          });
          const data = await res.json();
          if (data.success) {
            showNotice(data.message);
            fetchAdmins();
          } else {
            showNotice(data.error, "error");
          }
        } catch (err: any) {
          showNotice(err.message, "error");
        } finally {
          setConfirmModal(null);
        }
      },
    });
  };

  const triggerRestoreInstrument = (inst: any) => {
    setConfirmModal({
      isOpen: true,
      title: `Mark "${inst.name}" as Available?`,
      description:
        "This instrument reappears in the booking calendar and becomes bookable again. Reservations cancelled while it was Not Available will not be restored.",
      confirmLabel: "Mark Available",
      isDestructive: false,
      onConfirm: async () => {
        try {
          const res = await adminFetch(`/instruments/${inst.id}/restore`, {
            method: "POST",
          });
          const data = await res.json();
          if (data.success) {
            showNotice(data.message);
            fetchInstruments();
            fetchStats();
            onInstrumentsChanged?.();
          } else {
            showNotice(data.error, "error");
          }
        } catch (err: any) {
          showNotice(err.message, "error");
        } finally {
          setConfirmModal(null);
        }
      },
    });
  };

  // Super Admin: Save Hard Limits
  const handleSaveHardLimits = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingLimits(true);
    try {
      const payload = {
        maxActiveReservations:
          Number(hardLimitsState.maxActiveReservations) || 1,
        maxReservationsPerDay:
          Number(hardLimitsState.maxReservationsPerDay) || 1,
        maxDurationHours: Number(hardLimitsState.maxDurationHours) || 1,
        maxConcurrentPerType: Number(hardLimitsState.maxConcurrentPerType) || 1,
        maxSeriesOccurrences: Number(hardLimitsState.maxSeriesOccurrences) || 2,
        maxSubmissionsPerHour:
          Number(hardLimitsState.maxSubmissionsPerHour) || 5,
        max_active_reservations:
          Number(hardLimitsState.maxActiveReservations) || 1,
        max_reservations_per_day:
          Number(hardLimitsState.maxReservationsPerDay) || 1,
        max_duration_hours: Number(hardLimitsState.maxDurationHours) || 1,
        max_concurrent_per_type:
          Number(hardLimitsState.maxConcurrentPerType) || 1,
        max_series_occurrences:
          Number(hardLimitsState.maxSeriesOccurrences) || 2,
        max_submissions_per_hour:
          Number(hardLimitsState.maxSubmissionsPerHour) || 5,
      };
      const res = await adminFetch("/hard-limits", {
        method: "PUT",
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (data.success) {
        if (data.limits) {
          setHardLimitsState(normalizeLimits(data.limits));
        } else {
          await fetchHardLimits();
        }
        showNotice("System reservation hard limits updated successfully.");
      } else {
        showNotice(data.error || "Failed to update hard limits", "error");
      }
    } catch (err: any) {
      showNotice(err.message, "error");
    } finally {
      setSavingLimits(false);
    }
  };

  // Super Admin: Save Payment Settings
  const handleSavePaymentSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingPayment(true);
    try {
      const res = await adminFetch("/payment-settings", {
        method: "PUT",
        body: JSON.stringify(paymentSettingsState),
      });
      const data = await res.json();
      if (data.success) {
        showNotice("Instapay settings updated.");
      } else {
        showNotice(data.error, "error");
      }
    } catch (err: any) {
      showNotice(err.message, "error");
    } finally {
      setSavingPayment(false);
    }
  };

  return (
    <div id="admin-portal-root" className="space-y-6">
      {/* Feedback Banner */}
      {feedback && (
        <div
          className={`p-3.5 rounded-2xl text-xs font-semibold flex items-center justify-between shadow-2xs border transition ${
            feedback.type === "success"
              ? "bg-emerald-50 border-emerald-200 text-emerald-900"
              : feedback.type === "info"
                ? "bg-amber-50 border-amber-200 text-amber-950"
                : "bg-red-50 border-red-200 text-red-900"
          }`}
        >
          <div className="flex items-center gap-2">
            {feedback.type === "success" ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-700" />
            ) : feedback.type === "info" ? (
              <Info className="w-4 h-4 text-amber-800" />
            ) : (
              <AlertTriangle className="w-4 h-4 text-red-700" />
            )}
            <span>{feedback.message}</span>
          </div>
          <button
            onClick={() => setFeedback(null)}
            className="text-stone-400 hover:text-stone-600 cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Top Section Header Card */}
      <div className="bg-white border border-stone-200 rounded-2xl p-5 shadow-2xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-lg sm:text-xl font-bold text-stone-900 leading-tight whitespace-nowrap">
              {isSuperAdmin ? "Super Admin Console" : "Administration"}
            </h1>
            <span
              className={`px-2 py-0.5 rounded-md text-[10px] font-extrabold uppercase tracking-wider whitespace-nowrap ${
                isSuperAdmin
                  ? "bg-amber-100 text-amber-900 border border-amber-200"
                  : "bg-stone-100 text-stone-700 border border-stone-200"
              }`}
            >
              {isSuperAdmin ? "Super Admin" : "Admin"}
            </span>
          </div>
          <p className="text-xs text-stone-500 mt-1">
            Manage church instruments, review requests, oversee members, and
            configure scheduling.
          </p>
        </div>

        {onBackToMemberView && (
          <button
            id="btn-return-member-view"
            type="button"
            onClick={onBackToMemberView}
            className="self-start md:self-auto px-3.5 py-2 rounded-xl bg-stone-50 hover:bg-stone-100 text-stone-700 text-xs font-semibold border border-stone-200 transition flex items-center gap-2 cursor-pointer shadow-2xs"
          >
            <CalendarDays className="w-3.5 h-3.5 text-amber-800" />
            <span>Return to Availability Calendar</span>
          </button>
        )}
      </div>

      {/* Overview Stat Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3.5">
        <div className="bg-white border border-stone-200 p-4 rounded-2xl shadow-2xs">
          <div className="text-stone-500 text-xs font-semibold mb-1">
            Pending Requests
          </div>
          <div className="text-2xl font-extrabold text-amber-900 flex items-center justify-between">
            <span>{stats.pendingRequests}</span>
            <Clock className="w-5 h-5 text-amber-600/40" />
          </div>
          <div className="text-[11px] text-stone-400 mt-2">
            Requires booking review
          </div>
        </div>

        <button
          id="stat-card-approvals"
          type="button"
          onClick={() => setActiveTab("approvals")}
          className="bg-white border border-stone-200 p-4 rounded-2xl shadow-2xs text-left hover:border-amber-400 hover:shadow-xs transition cursor-pointer group"
        >
          <div className="text-stone-500 text-xs font-semibold mb-1 group-hover:text-amber-900 flex items-center justify-between">
            <span>Account Approvals</span>
            {Number(stats.pendingUserApprovals || 0) > 0 && (
              <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
            )}
          </div>
          <div className="text-2xl font-extrabold text-amber-900 flex items-center justify-between">
            <span>{stats.pendingUserApprovals || 0}</span>
            <UserCheck className="w-5 h-5 text-amber-600/40 group-hover:text-amber-700 transition" />
          </div>
          <div className="text-[11px] text-stone-400 group-hover:text-stone-600 mt-2">
            {Number(stats.pendingUserApprovals || 0) > 0
              ? "Pending admin approval"
              : "All accounts approved"}
          </div>
        </button>

        <div className="bg-white border border-stone-200 p-4 rounded-2xl shadow-2xs">
          <div className="text-stone-500 text-xs font-semibold mb-1">
            Today's Bookings
          </div>
          <div className="text-2xl font-extrabold text-emerald-900 flex items-center justify-between">
            <span>{stats.todayReservations}</span>
            <CalendarCheck className="w-5 h-5 text-emerald-600/40" />
          </div>
          <div className="text-[11px] text-stone-400 mt-2">
            Approved & active today
          </div>
        </div>

        <div className="bg-white border border-stone-200 p-4 rounded-2xl shadow-2xs">
          <div className="text-stone-500 text-xs font-semibold mb-1">
            Total Instruments
          </div>
          <div className="text-2xl font-extrabold text-stone-900 flex items-center justify-between">
            <span>{stats.totalInstruments}</span>
            <Music2 className="w-5 h-5 text-stone-400" />
          </div>
          <div className="text-[11px] text-stone-400 mt-2">
            In church inventory
          </div>
        </div>

        <div className="bg-white border border-stone-200 p-4 rounded-2xl shadow-2xs col-span-2 sm:col-span-1">
          <div className="text-stone-500 text-xs font-semibold mb-1">
            Active Church Users
          </div>
          <div className="text-2xl font-extrabold text-stone-900 flex items-center justify-between">
            <span>{stats.activeUsers}</span>
            <Users className="w-5 h-5 text-stone-400" />
          </div>
          <div className="text-[11px] text-stone-400 mt-2">
            Approved accounts
          </div>
        </div>
      </div>

      {/* Main Admin Layout: Navigation & Content */}
      <div className="flex flex-col md:flex-row gap-6">
        {/* Navigation Sidebar */}
        <aside className="w-full md:w-64 shrink-0 space-y-4">
          <div className="bg-white border border-stone-200 rounded-2xl p-3 shadow-2xs">
            <div className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-stone-400">
              Operations & Management
            </div>
            <nav className="space-y-1 mt-1">
              <button
                id="admin-tab-dashboard"
                onClick={() => setActiveTab("dashboard")}
                className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-bold transition cursor-pointer ${
                  activeTab === "dashboard"
                    ? "bg-amber-50 text-amber-950 border border-amber-200/80 shadow-2xs"
                    : "text-stone-600 hover:text-stone-900 hover:bg-stone-50"
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <LayoutDashboard className="w-4 h-4 text-amber-800" />
                  <span>Dashboard Overview</span>
                </div>
                {stats.pendingRequests > 0 && (
                  <span className="px-2 py-0.5 rounded-full text-[10px] bg-amber-100 text-amber-900 font-extrabold border border-amber-200">
                    {stats.pendingRequests}
                  </span>
                )}
              </button>

              <button
                id="admin-tab-review"
                onClick={() => setActiveTab("review")}
                className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-bold transition cursor-pointer ${
                  activeTab === "review"
                    ? "bg-amber-50 text-amber-950 border border-amber-200/80 shadow-2xs"
                    : "text-stone-600 hover:text-stone-900 hover:bg-stone-50"
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <CalendarCheck className="w-4 h-4 text-amber-800" />
                  <span>Review Requests</span>
                </div>
              </button>

              <button
                id="admin-tab-approvals"
                onClick={() => setActiveTab("approvals")}
                className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-bold transition cursor-pointer ${
                  activeTab === "approvals"
                    ? "bg-amber-50 text-amber-950 border border-amber-200/80 shadow-2xs"
                    : "text-stone-600 hover:text-stone-900 hover:bg-stone-50"
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <UserCheck className="w-4 h-4 text-amber-800" />
                  <span>Account Approvals</span>
                </div>
                {Number(stats.pendingUserApprovals || 0) > 0 && (
                  <span className="px-2 py-0.5 rounded-full text-[10px] bg-amber-100 text-amber-900 font-extrabold border border-amber-300">
                    {stats.pendingUserApprovals}
                  </span>
                )}
              </button>

              <button
                id="admin-tab-instruments"
                onClick={() => setActiveTab("instruments")}
                className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-bold transition cursor-pointer ${
                  activeTab === "instruments"
                    ? "bg-amber-50 text-amber-950 border border-amber-200/80 shadow-2xs"
                    : "text-stone-600 hover:text-stone-900 hover:bg-stone-50"
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <Music2 className="w-4 h-4 text-amber-800" />
                  <span>Instruments Inventory</span>
                </div>
                <span className="text-[10px] text-stone-400 font-semibold">
                  {stats.totalInstruments}
                </span>
              </button>

              <button
                id="admin-tab-users"
                onClick={() => setActiveTab("users")}
                className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-bold transition cursor-pointer ${
                  activeTab === "users"
                    ? "bg-amber-50 text-amber-950 border border-amber-200/80 shadow-2xs"
                    : "text-stone-600 hover:text-stone-900 hover:bg-stone-50"
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <Users className="w-4 h-4 text-amber-800" />
                  <span>User Directory</span>
                </div>
                <span className="text-[10px] text-stone-400 font-semibold">
                  {stats.activeUsers}
                </span>
              </button>

              <button
                id="admin-tab-messaging"
                onClick={() => setActiveTab("messaging")}
                className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-bold transition cursor-pointer ${
                  activeTab === "messaging"
                    ? "bg-amber-50 text-amber-950 border border-amber-200/80 shadow-2xs"
                    : "text-stone-600 hover:text-stone-900 hover:bg-stone-50"
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <MessageSquare className="w-4 h-4 text-amber-800" />
                  <span>Reservation Chat</span>
                </div>
              </button>
            </nav>

            {/* Super Admin Section */}
            {isSuperAdmin && (
              <div className="mt-4 pt-4 border-t border-stone-200">
                <div className="px-3 py-1 text-[10px] font-extrabold uppercase tracking-wider text-amber-900 flex items-center gap-1.5">
                  <Sparkles className="w-3 h-3 text-amber-700" />
                  <span>Super Admin Tools</span>
                </div>
                <nav className="space-y-1 mt-1">
                  <button
                    id="admin-tab-admin-accounts"
                    onClick={() => setActiveTab("admin_accounts")}
                    className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-bold transition cursor-pointer ${
                      activeTab === "admin_accounts"
                        ? "bg-amber-100 text-amber-950 border border-amber-300 shadow-2xs"
                        : "text-stone-600 hover:text-amber-950 hover:bg-amber-50/60"
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <ShieldCheck className="w-4 h-4 text-amber-800" />
                      <span>Admin Accounts</span>
                    </div>
                    <span className="text-[10px] bg-amber-200/60 text-amber-950 px-1.5 py-0.5 rounded font-mono">
                      {adminAccountsList.length}
                    </span>
                  </button>

                  <button
                    id="admin-tab-trusted-status"
                    onClick={() => setActiveTab("trusted_status")}
                    className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-bold transition cursor-pointer ${
                      activeTab === "trusted_status"
                        ? "bg-amber-100 text-amber-950 border border-amber-300 shadow-2xs"
                        : "text-stone-600 hover:text-amber-950 hover:bg-amber-50/60"
                    }`}
                  >
                    <UserCheck className="w-4 h-4 text-amber-800" />
                    <span>Trusted & Audit Trail</span>
                  </button>

                  <button
                    id="admin-tab-hard-limits"
                    onClick={() => setActiveTab("hard_limits")}
                    className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-bold transition cursor-pointer ${
                      activeTab === "hard_limits"
                        ? "bg-amber-100 text-amber-950 border border-amber-300 shadow-2xs"
                        : "text-stone-600 hover:text-amber-950 hover:bg-amber-50/60"
                    }`}
                  >
                    <Sliders className="w-4 h-4 text-amber-800" />
                    <span>Hard Limits Config</span>
                  </button>

                  <button
                    id="admin-tab-payment-settings"
                    onClick={() => setActiveTab("payment_settings")}
                    className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-bold transition cursor-pointer ${
                      activeTab === "payment_settings"
                        ? "bg-amber-100 text-amber-950 border border-amber-300 shadow-2xs"
                        : "text-stone-600 hover:text-amber-950 hover:bg-amber-50/60"
                    }`}
                  >
                    <CreditCard className="w-4 h-4 text-amber-800" />
                    <span>Payment Settings</span>
                  </button>
                </nav>
              </div>
            )}
          </div>
        </aside>

        {/* Content Area for active tab */}
        <main className="flex-1 min-w-0 space-y-6">
          {/* =============================================================
              TAB 1 & 2: DASHBOARD & REVIEW REQUESTS
             ============================================================= */}
          {(activeTab === "dashboard" || activeTab === "review") && (
            <div className="bg-white border border-stone-200 rounded-2xl p-5 shadow-2xs space-y-4">
              <div className="flex items-center justify-between gap-2 border-b border-stone-100 pb-3">
                <div className="flex items-center gap-2 overflow-x-auto -mx-1 px-1 no-scrollbar">
                  <button
                    onClick={() => setFilterQuickTab("pending")}
                    className={`shrink-0 whitespace-nowrap px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                      filterQuickTab === "pending"
                        ? "bg-amber-800 text-white shadow-xs"
                        : "bg-stone-100 text-stone-600 hover:text-stone-900"
                    }`}
                  >
                    Pending ({stats.pendingRequests})
                  </button>
                  <button
                    onClick={() => setFilterQuickTab("today")}
                    className={`shrink-0 whitespace-nowrap px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                      filterQuickTab === "today"
                        ? "bg-amber-800 text-white shadow-xs"
                        : "bg-stone-100 text-stone-600 hover:text-stone-900"
                    }`}
                  >
                    Today
                  </button>
                  <button
                    onClick={() => setFilterQuickTab("all")}
                    className={`shrink-0 whitespace-nowrap px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                      filterQuickTab === "all"
                        ? "bg-amber-800 text-white shadow-xs"
                        : "bg-stone-100 text-stone-600 hover:text-stone-900"
                    }`}
                  >
                    All
                  </button>
                </div>

                <button
                  onClick={fetchReservations}
                  className="shrink-0 p-2 rounded-xl bg-stone-50 hover:bg-stone-100 text-stone-600 border border-stone-200 transition cursor-pointer"
                  title="Refresh reservations"
                >
                  <RefreshCw className="w-4 h-4" />
                </button>
              </div>

              {/* Filters */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                <div>
                  <label className="block text-[10px] font-bold uppercase text-stone-500 mb-1">
                    Search Member / Service
                  </label>
                  <div className="relative">
                    <Search className="w-3.5 h-3.5 text-stone-400 absolute left-3 top-2.5" />
                    <input
                      type="text"
                      placeholder="Search name or service..."
                      value={filterSearch}
                      onChange={(e) => setFilterSearch(e.target.value)}
                      className="w-full pl-8 pr-3 py-2 bg-stone-50 border border-stone-200 rounded-xl text-stone-900 placeholder:text-stone-400 focus:outline-none focus:border-amber-700"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-bold uppercase text-stone-500 mb-1">
                    Instrument
                  </label>
                  <select
                    value={filterInstrument}
                    onChange={(e) => setFilterInstrument(e.target.value)}
                    className="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-xl text-stone-900 focus:outline-none focus:border-amber-700"
                  >
                    <option value="all">All Instruments</option>
                    {instrumentsList.map((i) => (
                      <option key={i.id} value={i.id}>
                        {i.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-bold uppercase text-stone-500 mb-1">
                    Status
                  </label>
                  <select
                    value={filterStatus}
                    onChange={(e) => setFilterStatus(e.target.value)}
                    className="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-xl text-stone-900 focus:outline-none focus:border-amber-700"
                  >
                    <option value="all">All Statuses</option>
                    <option value="pending">Pending</option>
                    <option value="approved">Approved</option>
                    <option value="ongoing">Ongoing</option>
                    <option value="completed">Completed</option>
                    <option value="rejected">Rejected</option>
                    <option value="cancelled">Cancelled</option>
                  </select>
                </div>
              </div>

              {/* Table */}
              <div className="overflow-x-auto mt-2">
                {loadingReservations ? (
                  <div className="py-12 text-center text-stone-500 text-xs">
                    Loading reservations...
                  </div>
                ) : reservations.length === 0 ? (
                  <div className="py-12 text-center text-stone-400 text-xs">
                    No reservations match your filters.
                  </div>
                ) : (
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="border-b border-stone-200 bg-stone-50/80 text-[11px] font-bold text-stone-600">
                        <th className="py-2.5 px-3">Date & Slot</th>
                        <th className="py-2.5 px-3">Instrument</th>
                        <th className="py-2.5 px-3">Member & Service</th>
                        <th className="py-2.5 px-3">Type / Mode</th>
                        <th className="py-2.5 px-3">Status</th>
                        <th className="py-2.5 px-3 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-stone-100">
                      {reservations.map((r) => {
                        const isPending = r.status === "pending";
                        const isApproved = r.status === "approved";
                        return (
                          <tr
                            key={r.id}
                            className="hover:bg-stone-50/60 transition"
                          >
                            <td className="py-3 px-3">
                              <div className="font-semibold text-stone-900">
                                {new Date(r.start_time).toLocaleDateString(
                                  "en-US",
                                  {
                                    month: "short",
                                    day: "numeric",
                                  },
                                )}
                              </div>
                              <div className="text-[11px] text-stone-500">
                                {new Date(r.start_time).toLocaleTimeString([], {
                                  hour: "2-digit",
                                  minute: "2-digit",
                                })}{" "}
                                -{" "}
                                {new Date(r.end_time).toLocaleTimeString([], {
                                  hour: "2-digit",
                                  minute: "2-digit",
                                })}
                              </div>
                            </td>

                            <td className="py-3 px-3">
                              <div className="font-medium text-stone-900">
                                {r.instrument_name}
                              </div>
                              <div className="text-[10px] text-stone-400">
                                {r.instrument_type}
                              </div>
                            </td>

                            <td className="py-3 px-3">
                              <div className="font-medium text-stone-900">
                                {r.user_name || "Member"}
                              </div>
                              <div className="text-[11px] text-stone-500 font-medium">
                                {r.service_name}
                              </div>
                              {r.user_phone && (
                                <div className="text-[10px] text-stone-400">
                                  {r.user_phone}
                                </div>
                              )}
                            </td>

                            <td className="py-3 px-3">
                              <span
                                className={`inline-block px-2 py-0.5 rounded text-[10px] font-semibold ${
                                  r.reservation_type === "outside_church"
                                    ? "bg-amber-50 text-amber-800 border border-amber-200"
                                    : "bg-stone-100 text-stone-700"
                                }`}
                              >
                                {r.reservation_type === "outside_church"
                                  ? "Outside"
                                  : "In Church"}
                              </span>
                              {r.series_id && (
                                <span className="ml-1 inline-flex items-center gap-0.5 text-[10px] text-amber-800 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200">
                                  <Repeat className="w-2.5 h-2.5" /> Series
                                </span>
                              )}
                            </td>

                            <td className="py-3 px-3">
                              <span
                                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                  r.status === "approved"
                                    ? "bg-emerald-50 text-emerald-800 border border-emerald-200"
                                    : r.status === "pending"
                                      ? "bg-amber-50 text-amber-800 border border-amber-200"
                                      : r.status === "rejected"
                                        ? "bg-red-50 text-red-800 border border-red-200"
                                        : "bg-stone-100 text-stone-700"
                                }`}
                              >
                                {r.status}
                              </span>
                            </td>

                            <td className="py-3 px-3 text-right">
                              <div className="flex items-center justify-end gap-1.5">
                                {isPending && (
                                  <>
                                    <button
                                      onClick={() => handleApprove(r.id)}
                                      className="px-2.5 py-1 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold transition cursor-pointer shadow-2xs flex items-center gap-1"
                                      title="Approve request"
                                    >
                                      <Check className="w-3 h-3" />
                                      <span>Approve</span>
                                    </button>
                                    <button
                                      onClick={() => openRejectModal(r)}
                                      className="px-2.5 py-1 rounded-lg bg-stone-100 hover:bg-red-50 text-red-700 border border-stone-200 hover:border-red-200 text-xs font-bold transition cursor-pointer flex items-center gap-1"
                                      title="Reject request"
                                    >
                                      <X className="w-3 h-3" />
                                      <span>Reject</span>
                                    </button>
                                  </>
                                )}

                                {onOpenReservationDetail && (
                                  <button
                                    onClick={() =>
                                      onOpenReservationDetail(r.id)
                                    }
                                    className="p-1.5 rounded-lg bg-stone-50 hover:bg-stone-100 text-stone-600 border border-stone-200 transition cursor-pointer"
                                    title="View full details"
                                  >
                                    <Info className="w-3.5 h-3.5" />
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          )}

          {/* =============================================================
              TAB: ACCOUNT APPROVALS (New Member Registrations)
             ============================================================= */}
          {activeTab === "approvals" && (
            <div
              id="admin-section-approvals"
              className="bg-white border border-stone-200 rounded-2xl p-5 shadow-2xs space-y-4"
            >
              <div className="flex flex-col gap-2 pb-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="font-bold text-stone-900 text-sm whitespace-nowrap">
                      Account Approvals
                    </h2>
                    {approvalCounts.pending > 0 && (
                      <span className="px-2.5 py-0.5 rounded-full text-[11px] font-extrabold bg-amber-100 text-amber-900 border border-amber-300 whitespace-nowrap">
                        {approvalCounts.pending} Pending
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-stone-500 mt-1">
                    Review new member registrations. Approved accounts can log
                    in; rejected accounts stay in the audit log.
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <div className="relative flex-1 min-w-0">
                    <Search className="w-3.5 h-3.5 text-stone-400 absolute left-3 top-2.5" />
                    <input
                      id="approvals-search-input"
                      type="text"
                      placeholder="Search name, email, phone..."
                      value={approvalSearch}
                      onChange={(e) => setApprovalSearch(e.target.value)}
                      className="w-full pl-8 pr-3 py-1.5 bg-stone-50 border border-stone-200 rounded-xl text-xs text-stone-900 focus:outline-none focus:border-amber-700"
                    />
                  </div>
                  <button
                    id="btn-refresh-approvals"
                    type="button"
                    onClick={fetchApprovals}
                    className="shrink-0 p-2 rounded-xl bg-stone-50 hover:bg-stone-100 text-stone-600 border border-stone-200 transition cursor-pointer"
                    title="Refresh registrations"
                  >
                    <RefreshCw className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Filter status pills */}
              <div className="flex flex-wrap items-center gap-2 pt-1">
                <button
                  id="filter-approvals-pending"
                  type="button"
                  onClick={() => setApprovalFilterStatus("pending")}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${
                    approvalFilterStatus === "pending"
                      ? "bg-amber-800 text-white shadow-xs"
                      : "bg-stone-100 text-stone-600 hover:text-stone-900 hover:bg-stone-200/70"
                  }`}
                >
                  <Clock className="w-3.5 h-3.5" />
                  <span>Pending</span>
                  <span
                    className={`px-1.5 py-0.2 rounded-full text-[10px] ${
                      approvalFilterStatus === "pending"
                        ? "bg-amber-900 text-amber-100"
                        : "bg-stone-200 text-stone-700 font-extrabold"
                    }`}
                  >
                    {approvalCounts.pending}
                  </span>
                </button>

                <button
                  id="filter-approvals-approved"
                  type="button"
                  onClick={() => setApprovalFilterStatus("approved")}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${
                    approvalFilterStatus === "approved"
                      ? "bg-amber-800 text-white shadow-xs"
                      : "bg-stone-100 text-stone-600 hover:text-stone-900 hover:bg-stone-200/70"
                  }`}
                >
                  <Check className="w-3.5 h-3.5" />
                  <span>Approved</span>
                  <span
                    className={`px-1.5 py-0.2 rounded-full text-[10px] ${
                      approvalFilterStatus === "approved"
                        ? "bg-amber-900 text-amber-100"
                        : "bg-stone-200 text-stone-700 font-extrabold"
                    }`}
                  >
                    {approvalCounts.approved}
                  </span>
                </button>

                <button
                  id="filter-approvals-rejected"
                  type="button"
                  onClick={() => setApprovalFilterStatus("rejected")}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${
                    approvalFilterStatus === "rejected"
                      ? "bg-amber-800 text-white shadow-xs"
                      : "bg-stone-100 text-stone-600 hover:text-stone-900 hover:bg-stone-200/70"
                  }`}
                >
                  <X className="w-3.5 h-3.5" />
                  <span>Rejected</span>
                  <span
                    className={`px-1.5 py-0.2 rounded-full text-[10px] ${
                      approvalFilterStatus === "rejected"
                        ? "bg-amber-900 text-amber-100"
                        : "bg-stone-200 text-stone-700 font-extrabold"
                    }`}
                  >
                    {approvalCounts.rejected}
                  </span>
                </button>

                <button
                  id="filter-approvals-all"
                  type="button"
                  onClick={() => setApprovalFilterStatus("all")}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${
                    approvalFilterStatus === "all"
                      ? "bg-amber-800 text-white shadow-xs"
                      : "bg-stone-100 text-stone-600 hover:text-stone-900 hover:bg-stone-200/70"
                  }`}
                >
                  <span>All</span>
                  <span
                    className={`px-1.5 py-0.2 rounded-full text-[10px] ${
                      approvalFilterStatus === "all"
                        ? "bg-amber-900 text-amber-100"
                        : "bg-stone-200 text-stone-700 font-extrabold"
                    }`}
                  >
                    {approvalCounts.total}
                  </span>
                </button>
              </div>

              {/* Table / List */}
              {loadingApprovals ? (
                <div className="py-12 text-center text-stone-500 text-xs">
                  Loading registration approvals...
                </div>
              ) : approvalsList.length === 0 ? (
                <div className="py-12 text-center border border-dashed border-stone-200 rounded-xl bg-stone-50/50">
                  <UserCheck className="w-8 h-8 text-stone-300 mx-auto mb-2" />
                  <div className="font-bold text-stone-700 text-xs">
                    {approvalFilterStatus === "pending"
                      ? "No registrations awaiting approval"
                      : "No registrations match the selected filter"}
                  </div>
                  <p className="text-[11px] text-stone-400 mt-1 max-w-sm mx-auto">
                    {approvalFilterStatus === "pending"
                      ? "All member registration requests have been reviewed."
                      : "Try switching filters or adjusting your search keyword."}
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="border-b border-stone-200 bg-stone-50/80 text-[11px] font-bold text-stone-600">
                        <th className="py-2.5 px-3">Applicant Name</th>
                        <th className="py-2.5 px-3">Email</th>
                        <th className="py-2.5 px-3">Phone Number</th>
                        <th className="py-2.5 px-3">Registration Date</th>
                        <th className="py-2.5 px-3">Approval Status</th>
                        <th className="py-2.5 px-3 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-stone-100">
                      {approvalsList.map((u) => {
                        const status =
                          u.approvalStatus ||
                          u.approval_status ||
                          (u.isActive ? "approved" : "pending");
                        const isActioning = approvalActionId === u.id;

                        return (
                          <tr
                            key={u.id}
                            className="hover:bg-stone-50/60 transition"
                          >
                            <td className="py-3 px-3">
                              <div className="font-semibold text-stone-900 flex items-center gap-1.5">
                                <span>{u.name}</span>
                                {u.isTrusted && (
                                  <span className="inline-flex items-center gap-0.5 px-1.5 py-0.2 rounded text-[9px] font-bold bg-amber-100 text-amber-900 border border-amber-200">
                                    <Sparkles className="w-2.5 h-2.5 text-amber-700" />
                                    Trusted
                                  </span>
                                )}
                              </div>
                            </td>

                            <td className="py-3 px-3 font-mono text-stone-800">
                              {u.email || "—"}
                            </td>

                            <td className="py-3 px-3 font-mono text-stone-600">
                              {u.phoneNumber || u.phone_number || "—"}
                            </td>

                            <td className="py-3 px-3 text-stone-500 text-[11px]">
                              {new Date(
                                u.createdAt || u.created_at,
                              ).toLocaleString()}
                            </td>

                            <td className="py-3 px-3">
                              {status === "pending" && (
                                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-amber-50 text-amber-900 border border-amber-200">
                                  <Clock className="w-3 h-3 text-amber-700" />
                                  Awaiting Admin Approval
                                </span>
                              )}
                              {status === "approved" && (
                                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
                                  <Check className="w-3 h-3 text-emerald-700" />
                                  Approved & Active
                                </span>
                              )}
                              {status === "rejected" && (
                                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-rose-50 text-rose-800 border border-rose-200">
                                  <X className="w-3 h-3 text-rose-700" />
                                  Rejected (Preserved in Audit)
                                </span>
                              )}
                            </td>

                            <td className="py-3 px-3 text-right">
                              <div className="flex items-center justify-end gap-2">
                                {status === "pending" && (
                                  <>
                                    <button
                                      id={`btn-approve-user-${u.id}`}
                                      type="button"
                                      disabled={isActioning}
                                      onClick={() =>
                                        handleApproveRegistration(u.id, u.name)
                                      }
                                      className="px-3 py-1.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs flex items-center gap-1.5 shadow-2xs transition cursor-pointer disabled:opacity-50"
                                      title="Approve registration and allow member to log in"
                                    >
                                      <Check className="w-3.5 h-3.5" />
                                      <span>Approve</span>
                                    </button>

                                    <button
                                      id={`btn-reject-user-${u.id}`}
                                      type="button"
                                      disabled={isActioning}
                                      onClick={() => triggerRejectUser(u)}
                                      className="px-3 py-1.5 rounded-xl bg-stone-100 hover:bg-rose-50 text-rose-700 border border-stone-200 hover:border-rose-200 font-bold text-xs flex items-center gap-1.5 transition cursor-pointer disabled:opacity-50"
                                      title="Reject registration (account preserved in audit database)"
                                    >
                                      <X className="w-3.5 h-3.5" />
                                      <span>Reject</span>
                                    </button>
                                  </>
                                )}

                                {status === "rejected" && (
                                  <>
                                    <button
                                      id={`btn-reapprove-user-${u.id}`}
                                      type="button"
                                      disabled={isActioning}
                                      onClick={() =>
                                        handleApproveRegistration(u.id, u.name)
                                      }
                                      className="px-2.5 py-1.5 rounded-xl bg-stone-50 hover:bg-emerald-50 text-emerald-800 border border-stone-200 hover:border-emerald-200 font-semibold text-xs flex items-center gap-1 transition cursor-pointer"
                                      title="Re-approve this rejected registration"
                                    >
                                      <Check className="w-3 h-3 text-emerald-700" />
                                      <span>Re-Approve</span>
                                    </button>

                                    <button
                                      id={`btn-delete-mistaken-user-${u.id}`}
                                      type="button"
                                      disabled={isActioning}
                                      onClick={() =>
                                        triggerDeleteUserPermanently(u)
                                      }
                                      className="p-1.5 rounded-xl bg-stone-50 hover:bg-rose-50 text-stone-500 hover:text-rose-700 border border-stone-200 hover:border-rose-200 transition cursor-pointer"
                                      title="Delete mistaken entry permanently from database"
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                  </>
                                )}

                                {status === "approved" && (
                                  <div className="flex items-center gap-1.5">
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setUserSearch(u.name);
                                        setActiveTab("users");
                                      }}
                                      className="px-2.5 py-1.5 rounded-xl bg-stone-50 hover:bg-stone-100 text-stone-700 border border-stone-200 font-semibold text-xs flex items-center gap-1 cursor-pointer"
                                      title="View member in church directory"
                                    >
                                      <Users className="w-3 h-3 text-amber-800" />
                                      <span>View in Directory</span>
                                    </button>
                                  </div>
                                )}
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
          )}

          {/* =============================================================
              TAB 3: INSTRUMENTS INVENTORY
             ============================================================= */}
          {activeTab === "instruments" && (
            <div className="bg-white border border-stone-200 rounded-2xl p-5 shadow-2xs space-y-4">
              <div className="flex items-center justify-between border-b border-stone-100 pb-4">
                <div>
                  <h2 className="font-bold text-stone-900 text-sm">
                    Church Instruments Inventory
                  </h2>
                  <p className="text-xs text-stone-500">
                    Add, edit specifications, change booking mode, mark retired
                    instruments unavailable, or delete accidental mistaken
                    entries.{" "}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    id="btn-refresh-instruments"
                    type="button"
                    onClick={() => fetchInstruments()}
                    disabled={loadingInstruments}
                    className="px-3 py-2 rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-700 text-xs font-semibold transition flex items-center gap-1.5 cursor-pointer border border-stone-200"
                    title="Refresh instrument list from database"
                  >
                    <RefreshCw
                      className={`w-3.5 h-3.5 ${loadingInstruments ? "animate-spin" : ""}`}
                    />
                    <span>Refresh</span>
                  </button>
                  <button
                    id="btn-add-new-instrument"
                    onClick={() => {
                      setEditingInstrument(null);
                      setInstrumentForm({
                        name: "",
                        type: "Keyboards",
                        photoUrl: "",
                        description: "",
                        outsideFeePerDay: "0.00",
                        bookingMode: "instant",
                      });
                      setPhotoUploadError(null);
                      setShowUrlInput(false);
                      setShowInstrumentModal(true);
                    }}
                    className="px-3.5 py-2 rounded-xl bg-amber-800 hover:bg-amber-900 text-white text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-xs"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add Instrument</span>
                  </button>
                </div>
              </div>

              {loadingInstruments ? (
                <div className="py-12 text-center text-stone-500 text-xs">
                  Loading instruments...
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {instrumentsList.map((inst) => {
                    const currentMode =
                      inst.bookingMode || inst.booking_mode || "instant";
                    const isInstant = currentMode === "instant";
                    const isDecommissioned = Boolean(
                      inst.isRemoved ?? inst.is_removed,
                    );
                    const instPhoto = inst.photoUrl || inst.photo_url;

                    return (
                      <div
                        key={inst.id}
                        className={`p-4 rounded-2xl border transition shadow-2xs flex flex-col justify-between ${
                          isDecommissioned
                            ? "bg-stone-50/60 border-stone-200 opacity-60"
                            : "bg-white border-stone-200 hover:border-amber-300"
                        }`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-center gap-3">
                            <div className="w-12 h-12 rounded-xl bg-amber-50 border border-amber-200/70 text-amber-900 flex items-center justify-center font-bold overflow-hidden shrink-0 shadow-2xs">
                              {instPhoto ? (
                                <img
                                  src={instPhoto}
                                  alt={inst.name}
                                  referrerPolicy="no-referrer"
                                  className="w-full h-full object-cover"
                                />
                              ) : (
                                <Music2 className="w-5 h-5 text-amber-800" />
                              )}
                            </div>
                            <div>
                              <div className="font-bold text-stone-900 text-sm flex items-center gap-2">
                                <span>{inst.name}</span>
                                {isDecommissioned && (
                                  <span className="text-[10px] bg-red-100 text-red-800 px-1.5 py-0.2 rounded font-semibold">
                                    Not Available
                                  </span>
                                )}
                              </div>
                              <div className="text-xs text-stone-500 font-medium flex items-center gap-1.5">
                                <span>{inst.type}</span>
                                <span className="text-stone-300">•</span>
                                <span>
                                  {inst.totalReservations ??
                                    inst.total_reservations ??
                                    0}{" "}
                                  bookings
                                </span>
                              </div>
                            </div>
                          </div>

                          <span
                            id={`admin-instrument-mode-badge-${inst.id}`}
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              isInstant
                                ? "bg-emerald-50 text-emerald-800 border border-emerald-200"
                                : "bg-amber-50 text-amber-800 border border-amber-200"
                            }`}
                          >
                            {isInstant
                              ? "⚡ Instant Booking"
                              : "🛡️ Manual Review"}
                          </span>
                        </div>

                        <p className="text-xs text-stone-600 my-3 line-clamp-2">
                          {inst.description ||
                            "No specific description provided."}
                        </p>

                        <div className="pt-3 border-t border-stone-100 flex items-center justify-between text-xs">
                          <div className="text-stone-500 font-medium">
                            Outside Fee:{" "}
                            <span className="font-bold text-stone-900">
                              $
                              {inst.outsideFeePerDay ??
                                inst.outside_fee_per_day ??
                                "0.00"}
                            </span>{" "}
                            / day
                          </div>

                          <div className="flex items-center gap-1.5">
                            {!isDecommissioned ? (
                              <>
                                <button
                                  id={`btn-edit-instrument-${inst.id}`}
                                  onClick={() => {
                                    setEditingInstrument(inst);
                                    setInstrumentForm({
                                      name: inst.name,
                                      type: inst.type,
                                      photoUrl: instPhoto || "",
                                      description: inst.description || "",
                                      outsideFeePerDay:
                                        inst.outsideFeePerDay ??
                                        inst.outside_fee_per_day ??
                                        "0.00",
                                      bookingMode: currentMode as
                                        | "instant"
                                        | "manual",
                                    });
                                    setPhotoUploadError(null);
                                    setShowUrlInput(false);
                                    setShowInstrumentModal(true);
                                  }}
                                  className="px-2.5 py-1 rounded-lg bg-stone-50 hover:bg-stone-100 text-stone-700 border border-stone-200 font-semibold flex items-center gap-1 cursor-pointer transition"
                                  title="Edit instrument details"
                                >
                                  <Edit className="w-3 h-3" />
                                  <span>Edit</span>
                                </button>
                                <button
                                  id={`btn-mark-unavailable-instrument-${inst.id}`}
                                  onClick={() => {
                                    setRemovingInstrument(inst);
                                    setRemoveConfirmForce(false);
                                  }}
                                  className="px-2.5 py-1 rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 font-semibold flex items-center gap-1 cursor-pointer transition"
                                  title="Retire instrument from service (preserves past history)"
                                >
                                  <Archive className="w-3 h-3" />
                                  <span>Mark Unavailable</span>
                                </button>
                                <button
                                  id={`btn-delete-instrument-${inst.id}`}
                                  onClick={() => {
                                    setDeletingInstrument(inst);
                                    setDeleteConfirmChecked(false);
                                  }}
                                  className="px-2.5 py-1 rounded-lg bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 font-semibold flex items-center gap-1 cursor-pointer transition"
                                  title="Delete mistaken entry permanently from database"
                                >
                                  <Trash2 className="w-3 h-3" />
                                  <span>Delete</span>
                                </button>
                              </>
                            ) : (
                              <>
                                <button
                                  id={`btn-restore-instrument-${inst.id}`}
                                  onClick={() => triggerRestoreInstrument(inst)}
                                  className="px-2.5 py-1 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 font-semibold flex items-center gap-1 cursor-pointer transition"
                                  title="Restore instrument to available status"
                                >
                                  <RefreshCw className="w-3 h-3" />
                                  <span>Mark Available</span>
                                </button>
                                <button
                                  id={`btn-delete-instrument-${inst.id}`}
                                  onClick={() => {
                                    setDeletingInstrument(inst);
                                    setDeleteConfirmChecked(false);
                                  }}
                                  className="px-2.5 py-1 rounded-lg bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 font-semibold flex items-center gap-1 cursor-pointer transition"
                                  title="Delete mistaken entry permanently from database"
                                >
                                  <Trash2 className="w-3 h-3" />
                                  <span>Delete</span>
                                </button>
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* =============================================================
              TAB 4: USER MANAGEMENT
             ============================================================= */}
          {activeTab === "users" && (
            <div className="bg-white border border-stone-200 rounded-2xl p-5 shadow-2xs space-y-4">
              <div className="flex flex-col gap-2 pb-3">
                <div className="min-w-0">
                  <h2 className="font-bold text-stone-900 text-sm whitespace-nowrap">
                    Member Directory
                  </h2>
                  <p className="text-xs text-stone-500 mt-0.5">
                    Search members, toggle account status, grant Trusted status,
                    or book on their behalf.
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <div className="relative flex-1 min-w-0">
                    <Search className="w-3.5 h-3.5 text-stone-400 absolute left-3 top-2.5" />
                    <input
                      type="text"
                      placeholder="Search name, email, phone..."
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
                <div className="py-12 text-center text-stone-500 text-xs">
                  Loading members...
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse min-w-[600px]">
                    <thead>
                      <tr className="border-b border-stone-200 bg-stone-50/80 text-[11px] font-bold text-stone-600">
                        <th className="py-2.5 px-3 whitespace-nowrap">
                          Member
                        </th>
                        <th className="py-2.5 px-3 whitespace-nowrap">Email</th>
                        <th className="py-2.5 px-3 whitespace-nowrap">Phone</th>
                        <th className="py-2.5 px-3 whitespace-nowrap">
                          Status
                        </th>
                        <th className="py-2.5 px-3 whitespace-nowrap">
                          Trusted
                        </th>
                        <th className="py-2.5 px-3 text-right whitespace-nowrap">
                          Actions
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-stone-100">
                      {usersList.map((u) => (
                        <tr
                          key={u.id}
                          className="hover:bg-stone-50/60 transition"
                        >
                          <td className="py-3 px-3">
                            <div className="font-semibold text-stone-900">
                              {u.name}
                            </div>
                            <div className="text-[10px] text-stone-400">
                              Joined{" "}
                              {new Date(u.createdAt).toLocaleDateString()}
                            </div>
                          </td>

                          <td className="py-3 px-3 font-mono text-stone-800">
                            {u.email || "—"}
                          </td>

                          <td className="py-3 px-3 font-mono text-stone-600">
                            {u.phoneNumber || u.phone_number || "—"}
                          </td>

                          <td className="py-3 px-3">
                            {u.approval_status === "pending" ||
                            u.approvalStatus === "pending" ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-900 border border-amber-200">
                                <Clock className="w-2.5 h-2.5 text-amber-700" />
                                Pending Approval
                              </span>
                            ) : u.approval_status === "rejected" ||
                              u.approvalStatus === "rejected" ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-50 text-rose-800 border border-rose-200">
                                <X className="w-2.5 h-2.5 text-rose-700" />
                                Rejected
                              </span>
                            ) : (
                              <span
                                className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                  u.isActive
                                    ? "bg-emerald-50 text-emerald-800 border border-emerald-200"
                                    : "bg-stone-100 text-stone-600 border border-stone-200"
                                }`}
                              >
                                {u.isActive ? "Active" : "Deactivated"}
                              </span>
                            )}
                          </td>

                          <td className="py-3 px-3">
                            {u.isTrusted ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-100 text-amber-900 border border-amber-200">
                                <Sparkles className="w-2.5 h-2.5 text-amber-700" />
                                Trusted Member
                              </span>
                            ) : (
                              <span className="text-[10px] text-stone-400 font-medium">
                                Standard
                              </span>
                            )}
                          </td>

                          <td className="py-3 px-3 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              {/* Quick Approve if pending */}
                              {(u.approval_status === "pending" ||
                                u.approvalStatus === "pending") && (
                                <button
                                  type="button"
                                  onClick={() =>
                                    handleApproveRegistration(u.id, u.name)
                                  }
                                  className="px-2.5 py-1 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold flex items-center gap-1 cursor-pointer shadow-2xs"
                                  title="Approve registration"
                                >
                                  <Check className="w-3 h-3" />
                                  <span>Approve</span>
                                </button>
                              )}

                              {/* Book on Behalf */}
                              <button
                                onClick={() => setBookOnBehalfUser(u)}
                                className="px-2.5 py-1 rounded-lg bg-stone-50 hover:bg-stone-100 text-stone-700 border border-stone-200 text-xs font-semibold flex items-center gap-1 cursor-pointer"
                                title="Book on behalf"
                              >
                                <Plus className="w-3 h-3 text-amber-800" />
                                <span>Book For</span>
                              </button>
                              {isSuperAdmin && (
                                <button
                                  onClick={() =>
                                    handleOpenPromoteModal(u.id, u.name)
                                  }
                                  className="px-2 py-1 rounded-lg text-xs font-semibold border cursor-pointer bg-stone-50 hover:bg-amber-50 text-amber-900 border-stone-200"
                                  title="Promote to Administrator"
                                >
                                  Promote To...
                                </button>
                              )}

                              {/* Super Admin Trusted Status Toggle */}
                              {isSuperAdmin && (
                                <button
                                  onClick={() =>
                                    handleToggleTrusted(
                                      u.id,
                                      u.isTrusted,
                                      u.name,
                                    )
                                  }
                                  className={`px-2 py-1 rounded-lg text-xs font-semibold border cursor-pointer ${
                                    u.isTrusted
                                      ? "bg-stone-50 hover:bg-amber-50 text-amber-900 border-amber-200"
                                      : "bg-stone-50 hover:bg-stone-100 text-stone-600 border-stone-200"
                                  }`}
                                  title={
                                    u.isTrusted
                                      ? "Revoke trusted status"
                                      : "Grant trusted status"
                                  }
                                >
                                  {u.isTrusted
                                    ? "Revoke Trust"
                                    : "Make Trusted"}
                                </button>
                              )}

                              {/* Toggle Active Status */}
                              <button
                                onClick={() =>
                                  handleToggleUserActive(
                                    u.id,
                                    u.isActive,
                                    u.name,
                                  )
                                }
                                className="p-1.5 rounded-lg bg-stone-50 hover:bg-stone-100 text-stone-600 border border-stone-200 transition cursor-pointer"
                                title={
                                  u.isActive
                                    ? "Deactivate account"
                                    : "Reactivate account"
                                }
                              >
                                {u.isActive ? (
                                  <UserX className="w-3.5 h-3.5" />
                                ) : (
                                  <UserCheck className="w-3.5 h-3.5" />
                                )}
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* =============================================================
              TAB 5: RESERVATION MESSAGING
             ============================================================= */}
          {activeTab === "messaging" && (
            <div className="bg-white border border-stone-200 rounded-2xl p-5 shadow-2xs space-y-4">
              <div className="border-b border-stone-100 pb-3">
                <h2 className="font-bold text-stone-900 text-sm">
                  Direct Reservation Messaging
                </h2>
                <p className="text-xs text-stone-500">
                  Send official notifications and notes to members regarding
                  their pending or active bookings.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="border border-stone-200 rounded-xl p-3 bg-stone-50/50 space-y-2 max-h-96 overflow-y-auto">
                  <div className="text-[11px] font-bold uppercase text-stone-500">
                    Select Reservation
                  </div>
                  {reservations.slice(0, 15).map((r) => (
                    <button
                      key={r.id}
                      onClick={() => setSelectedMsgReservation(r)}
                      className={`w-full text-left p-2.5 rounded-xl border text-xs transition cursor-pointer ${
                        selectedMsgReservation?.id === r.id
                          ? "bg-amber-50 border-amber-300 text-amber-950 shadow-2xs font-semibold"
                          : "bg-white border-stone-200 text-stone-700 hover:bg-stone-50"
                      }`}
                    >
                      <div className="font-bold text-stone-900">
                        {r.service_name}
                      </div>
                      <div className="text-[11px] text-stone-500">
                        {r.user_name} • {r.instrument_name}
                      </div>
                    </button>
                  ))}
                </div>

                <div className="md:col-span-2 border border-stone-200 rounded-xl p-4 bg-white space-y-3">
                  {selectedMsgReservation ? (
                    <form onSubmit={handleSendMessage} className="space-y-3">
                      <div className="p-3 bg-stone-50 rounded-xl border border-stone-200 text-xs space-y-1">
                        <div className="font-bold text-stone-900">
                          Recipient: {selectedMsgReservation.user_name} (
                          {selectedMsgReservation.user_phone})
                        </div>
                        <div className="text-stone-500">
                          Booking: {selectedMsgReservation.service_name} (
                          {selectedMsgReservation.instrument_name})
                        </div>
                      </div>

                      <div>
                        <label className="block text-[10px] font-bold uppercase text-stone-500 mb-1">
                          Message Content
                        </label>
                        <textarea
                          rows={4}
                          required
                          value={messageText}
                          onChange={(e) => setMessageText(e.target.value)}
                          placeholder="Type your message or special instruction for the member..."
                          className="w-full p-3 bg-stone-50 border border-stone-200 rounded-xl text-xs text-stone-900 focus:outline-none focus:border-amber-700"
                        />
                      </div>

                      <button
                        type="submit"
                        disabled={sendingMessage || !messageText.trim()}
                        className="px-4 py-2 rounded-xl bg-amber-800 hover:bg-amber-900 disabled:opacity-50 text-white font-bold text-xs transition flex items-center gap-1.5 cursor-pointer shadow-xs"
                      >
                        <Send className="w-3.5 h-3.5" />
                        <span>Send Official Notice</span>
                      </button>
                    </form>
                  ) : (
                    <div className="py-16 text-center text-stone-400 text-xs">
                      Select a reservation on the left to write and dispatch a
                      message.
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* =============================================================
              SUPER ADMIN TAB 6: ADMIN ACCOUNTS (Add/Manage Admins)
             ============================================================= */}
          {activeTab === "admin_accounts" && isSuperAdmin && (
            <div className="bg-white border border-stone-200 rounded-2xl p-5 shadow-2xs space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-stone-100 pb-4">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="font-bold text-stone-900 text-sm whitespace-nowrap">
                      Admin Accounts
                    </h2>
                    <span className="px-2 py-0.5 rounded bg-amber-100 text-amber-900 text-[10px] font-extrabold border border-amber-200 whitespace-nowrap">
                      Super Admin Only
                    </span>
                  </div>
                  <p className="text-xs text-stone-500 mt-0.5">
                    Provision new administrative staff accounts or remove
                    administrative credentials.
                  </p>
                </div>

                <button
                  id="btn-open-create-admin-modal"
                  onClick={() => {
                    setNewAdminForm({
                      name: "",
                      email: "",
                      phoneNumber: "",
                      password: "",
                      isSuperAdmin: false,
                    });
                    setShowNewAdminModal(true);
                  }}
                  className="self-start sm:self-auto shrink-0 px-3.5 py-2 rounded-xl bg-amber-800 hover:bg-amber-900 text-white text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer shadow-xs whitespace-nowrap"
                >
                  <UserPlus className="w-3.5 h-3.5 shrink-0" />
                  <span>Add Administrator</span>
                </button>
              </div>

              {loadingAdmins ? (
                <div className="py-12 text-center text-stone-500 text-xs">
                  Loading administrators...
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="border-b border-stone-200 bg-stone-50/80 text-[11px] font-bold text-stone-600">
                        <th className="py-2.5 px-3">Administrator</th>
                        <th className="py-2.5 px-3">Email</th>
                        <th className="py-2.5 px-3">Phone Number</th>
                        <th className="py-2.5 px-3">Role Authority</th>
                        <th className="py-2.5 px-3">Created</th>
                        <th className="py-2.5 px-3 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-stone-100">
                      {adminAccountsList.map((adm) => {
                        const isCurrentAdmin =
                          (adm.email &&
                            profile?.email &&
                            adm.email.toLowerCase() ===
                              profile.email.toLowerCase()) ||
                          adm.id === profile?.id ||
                          adm.phoneNumber === profile?.phoneNumber;
                        const isHardcodedSuperAdmin =
                          adm.email?.toLowerCase() ===
                          "andrewehab417@gmail.com";
                        return (
                          <tr
                            key={adm.id}
                            className="hover:bg-stone-50/60 transition"
                          >
                            <td className="py-3 px-3">
                              <div className="font-semibold text-stone-900 flex items-center gap-1.5">
                                <Shield className="w-3.5 h-3.5 text-amber-800" />
                                <span>{adm.name}</span>
                              </div>
                            </td>

                            <td className="py-3 px-3 font-mono text-stone-800">
                              {adm.email || "—"}
                            </td>

                            <td className="py-3 px-3 font-mono text-stone-600">
                              {adm.phoneNumber || adm.phone_number || "—"}
                            </td>

                            <td className="py-3 px-3">
                              <span
                                className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold whitespace-nowrap ${
                                  adm.isSuperAdmin
                                    ? "bg-amber-100 text-amber-950 border border-amber-300"
                                    : "bg-stone-100 text-stone-700 border border-stone-200"
                                }`}
                              >
                                {adm.isSuperAdmin
                                  ? "👑 Super Admin"
                                  : "🛡️ Admin"}
                              </span>
                            </td>

                            <td className="py-3 px-3 text-stone-500">
                              {new Date(adm.createdAt).toLocaleDateString()}
                            </td>

                            <td className="py-3 px-3 text-right">
                              {!isCurrentAdmin && !isHardcodedSuperAdmin ? (
                                <div className="flex items-center justify-end gap-1.5">
                                  <button
                                    onClick={() =>
                                      handleDemoteAdmin(adm.id, adm.name)
                                    }
                                    className="px-2.5 py-1 rounded-lg bg-stone-50 hover:bg-stone-100 text-stone-700 border border-stone-200 text-xs font-semibold cursor-pointer"
                                  >
                                    Demote
                                  </button>
                                  <button
                                    onClick={() =>
                                      handleRemoveAdmin(adm.id, adm.name)
                                    }
                                    className="px-2.5 py-1 rounded-lg bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 text-xs font-semibold cursor-pointer"
                                  >
                                    Delete
                                  </button>
                                </div>
                              ) : (
                                <span className="text-[10px] text-stone-400 italic">
                                  {isHardcodedSuperAdmin
                                    ? "Protected Account"
                                    : "Current Session"}
                                </span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* =============================================================
              SUPER ADMIN TAB 7: TRUSTED STATUS AUDIT LOG
             ============================================================= */}
          {activeTab === "trusted_status" && isSuperAdmin && (
            <div className="bg-white border border-stone-200 rounded-2xl p-5 shadow-2xs space-y-4">
              <div className="border-b border-stone-100 pb-3">
                <h2 className="font-bold text-stone-900 text-sm">
                  Trusted Member Status & Audit Trail
                </h2>
                <p className="text-xs text-stone-500">
                  Full immutable history of trusted member grants and
                  revocations with administrator timestamps.
                </p>
              </div>

              {loadingAuditLogs ? (
                <div className="py-12 text-center text-stone-500 text-xs">
                  Loading audit logs...
                </div>
              ) : trustedAuditLogs.length === 0 ? (
                <div className="py-12 text-center text-stone-400 text-xs">
                  No trusted status changes recorded yet.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="border-b border-stone-200 bg-stone-50/80 text-[11px] font-bold text-stone-600">
                        <th className="py-2.5 px-3">Date & Time</th>
                        <th className="py-2.5 px-3">Action</th>
                        <th className="py-2.5 px-3">Target Member</th>
                        <th className="py-2.5 px-3">Authorized By Admin</th>
                        <th className="py-2.5 px-3">Note / Reason</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-stone-100">
                      {trustedAuditLogs.map((log) => (
                        <tr
                          key={log.id}
                          className="hover:bg-stone-50/60 transition"
                        >
                          <td className="py-3 px-3 text-stone-600 font-mono text-[11px]">
                            {new Date(log.created_at).toLocaleString()}
                          </td>
                          <td className="py-3 px-3">
                            <span
                              className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                log.action === "granted"
                                  ? "bg-emerald-50 text-emerald-800 border border-emerald-200"
                                  : "bg-red-50 text-red-800 border border-red-200"
                              }`}
                            >
                              {log.action.toUpperCase()}
                            </span>
                          </td>
                          <td className="py-3 px-3 font-medium text-stone-900">
                            {log.target_user_name || "Member"}
                          </td>
                          <td className="py-3 px-3 text-stone-700">
                            {log.granted_by_admin_name || "Administrator"}
                          </td>
                          <td className="py-3 px-3 text-stone-500">
                            {log.reason || "Manual Super Admin Action"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* =============================================================
              SUPER ADMIN TAB 8: HARD LIMITS CONFIG
             ============================================================= */}
          {activeTab === "hard_limits" && isSuperAdmin && (
            <div className="bg-white border border-stone-200 rounded-2xl p-5 shadow-2xs space-y-4">
              <div className="border-b border-stone-100 pb-3">
                <h2 className="font-bold text-stone-900 text-sm">
                  System Hard Limits & Abuse Prevention
                </h2>
                <p className="text-xs text-stone-500">
                  Global quota thresholds enforced automatically across all
                  booking requests.
                </p>
              </div>

              <form onSubmit={handleSaveHardLimits} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                  <div>
                    <label
                      htmlFor="input-max-active-reservations"
                      className="block font-bold text-stone-700 mb-1"
                    >
                      Max Active Reservations Per User
                    </label>
                    <input
                      id="input-max-active-reservations"
                      type="number"
                      min="1"
                      max="20"
                      value={hardLimitsState.maxActiveReservations ?? ""}
                      onChange={(e) =>
                        setHardLimitsState({
                          ...hardLimitsState,
                          maxActiveReservations:
                            e.target.value === ""
                              ? ""
                              : parseInt(e.target.value, 10),
                        })
                      }
                      className="w-full p-2.5 bg-stone-50 border border-stone-200 rounded-xl text-stone-900"
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="input-max-reservations-per-day"
                      className="block font-bold text-stone-700 mb-1"
                    >
                      Max Reservations Per Day
                    </label>
                    <input
                      id="input-max-reservations-per-day"
                      type="number"
                      min="1"
                      max="10"
                      value={hardLimitsState.maxReservationsPerDay ?? ""}
                      onChange={(e) =>
                        setHardLimitsState({
                          ...hardLimitsState,
                          maxReservationsPerDay:
                            e.target.value === ""
                              ? ""
                              : parseInt(e.target.value, 10),
                        })
                      }
                      className="w-full p-2.5 bg-stone-50 border border-stone-200 rounded-xl text-stone-900"
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="input-max-duration-hours"
                      className="block font-bold text-stone-700 mb-1"
                    >
                      Max Single Booking Duration (Hours)
                    </label>
                    <input
                      id="input-max-duration-hours"
                      type="number"
                      min="1"
                      max="12"
                      value={hardLimitsState.maxDurationHours ?? ""}
                      onChange={(e) =>
                        setHardLimitsState({
                          ...hardLimitsState,
                          maxDurationHours:
                            e.target.value === ""
                              ? ""
                              : parseInt(e.target.value, 10),
                        })
                      }
                      className="w-full p-2.5 bg-stone-50 border border-stone-200 rounded-xl text-stone-900"
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="input-max-concurrent-per-type"
                      className="block font-bold text-stone-700 mb-1"
                    >
                      Max Concurrent Slots in Same Category
                    </label>
                    <input
                      id="input-max-concurrent-per-type"
                      type="number"
                      min="1"
                      max="5"
                      value={hardLimitsState.maxConcurrentPerType ?? ""}
                      onChange={(e) =>
                        setHardLimitsState({
                          ...hardLimitsState,
                          maxConcurrentPerType:
                            e.target.value === ""
                              ? ""
                              : parseInt(e.target.value, 10),
                        })
                      }
                      className="w-full p-2.5 bg-stone-50 border border-stone-200 rounded-xl text-stone-900"
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="input-max-series-occurrences"
                      className="block font-bold text-stone-700 mb-1"
                    >
                      Max Recurring Occurrences Per Series
                    </label>
                    <input
                      id="input-max-series-occurrences"
                      type="number"
                      min="2"
                      max="20"
                      value={hardLimitsState.maxSeriesOccurrences ?? ""}
                      onChange={(e) =>
                        setHardLimitsState({
                          ...hardLimitsState,
                          maxSeriesOccurrences:
                            e.target.value === ""
                              ? ""
                              : parseInt(e.target.value, 10),
                        })
                      }
                      className="w-full p-2.5 bg-stone-50 border border-stone-200 rounded-xl text-stone-900"
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="input-max-submissions-per-hour"
                      className="block font-bold text-stone-700 mb-1"
                    >
                      Rate Limit (Requests / Hour)
                    </label>
                    <input
                      id="input-max-submissions-per-hour"
                      type="number"
                      min="5"
                      max="50"
                      value={hardLimitsState.maxSubmissionsPerHour ?? ""}
                      onChange={(e) =>
                        setHardLimitsState({
                          ...hardLimitsState,
                          maxSubmissionsPerHour:
                            e.target.value === ""
                              ? ""
                              : parseInt(e.target.value, 10),
                        })
                      }
                      className="w-full p-2.5 bg-stone-50 border border-stone-200 rounded-xl text-stone-900"
                    />
                  </div>
                </div>

                <div className="pt-3 border-t border-stone-100 flex justify-end">
                  <button
                    type="submit"
                    disabled={savingLimits}
                    className="px-4 py-2 rounded-xl bg-amber-800 hover:bg-amber-900 disabled:opacity-50 text-white font-bold text-xs transition cursor-pointer shadow-xs"
                  >
                    {savingLimits ? "Saving..." : "Save Hard Limits"}
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* =============================================================
              SUPER ADMIN TAB 9: PAYMENT SETTINGS
             ============================================================= */}
          {activeTab === "payment_settings" && isSuperAdmin && (
            <div className="bg-white border border-stone-200 rounded-2xl p-5 shadow-2xs space-y-4">
              <div className="border-b border-stone-100 pb-3">
                <h2 className="font-bold text-stone-900 text-sm">
                  Payment & Instapay Configuration
                </h2>
                <p className="text-xs text-stone-500">
                  Configure official church Instapay mobile number and payment
                  link shown for outside reservations.
                </p>
              </div>

              <form
                onSubmit={handleSavePaymentSettings}
                className="space-y-4 text-xs"
              >
                <div>
                  <label className="block font-bold text-stone-700 mb-1">
                    Instapay Phone Number / Alias
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. 01012345678 or church@instapay"
                    value={paymentSettingsState.instapayNumber}
                    onChange={(e) =>
                      setPaymentSettingsState({
                        ...paymentSettingsState,
                        instapayNumber: e.target.value,
                      })
                    }
                    className="w-full p-2.5 bg-stone-50 border border-stone-200 rounded-xl text-stone-900 focus:outline-none focus:border-amber-700"
                  />
                </div>

                <div>
                  <label className="block font-bold text-stone-700 mb-1">
                    Instapay Direct Web Link (Optional)
                  </label>
                  <input
                    type="url"
                    placeholder="https://instapay.eg/..."
                    value={paymentSettingsState.instapayLink}
                    onChange={(e) =>
                      setPaymentSettingsState({
                        ...paymentSettingsState,
                        instapayLink: e.target.value,
                      })
                    }
                    className="w-full p-2.5 bg-stone-50 border border-stone-200 rounded-xl text-stone-900 focus:outline-none focus:border-amber-700"
                  />
                </div>

                <div className="pt-3 border-t border-stone-100 flex justify-end">
                  <button
                    type="submit"
                    disabled={savingPayment}
                    className="px-4 py-2 rounded-xl bg-amber-800 hover:bg-amber-900 disabled:opacity-50 text-white font-bold text-xs transition cursor-pointer shadow-xs"
                  >
                    {savingPayment ? "Saving..." : "Save Payment Settings"}
                  </button>
                </div>
              </form>
            </div>
          )}
        </main>
      </div>

      {/* =============================================================
          MODAL 1: Add / Edit Instrument
         ============================================================= */}
      {showInstrumentModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white border border-stone-200 rounded-2xl max-w-lg w-full p-6 space-y-4 shadow-xl my-auto max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-stone-100 pb-3">
              <h3 className="font-bold text-stone-900 text-sm">
                {editingInstrument ? "Edit Instrument" : "Add New Instrument"}
              </h3>
              <button
                onClick={() => setShowInstrumentModal(false)}
                className="text-stone-400 hover:text-stone-600 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveInstrument} className="space-y-3 text-xs">
              <div>
                <label className="block font-bold text-stone-700 mb-1">
                  Instrument Name
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Yamaha Motif XF8"
                  value={instrumentForm.name}
                  onChange={(e) =>
                    setInstrumentForm({
                      ...instrumentForm,
                      name: e.target.value,
                    })
                  }
                  className="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-xl text-stone-900 focus:outline-none focus:border-amber-700"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-stone-700 mb-1">
                    Category / Type
                  </label>
                  <select
                    value={instrumentForm.type}
                    onChange={(e) =>
                      setInstrumentForm({
                        ...instrumentForm,
                        type: e.target.value,
                      })
                    }
                    className="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-xl text-stone-900 focus:outline-none focus:border-amber-700"
                  >
                    <option value="Keyboards">Keyboards</option>
                    <option value="Drums">Drums</option>
                    <option value="Acoustic Guitars">Acoustic Guitars</option>
                    <option value="Electric Guitars">Electric Guitars</option>
                    <option value="Bass Guitars">Bass Guitars</option>
                    <option value="Wind & Brass">Wind & Brass</option>
                    <option value="Strings">Strings</option>
                    <option value="Audio Equipment">Audio Equipment</option>
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-stone-700 mb-1">
                    Booking Mode
                  </label>
                  <select
                    value={instrumentForm.bookingMode}
                    onChange={(e) =>
                      setInstrumentForm({
                        ...instrumentForm,
                        bookingMode: e.target.value,
                      })
                    }
                    className="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-xl text-stone-900 focus:outline-none focus:border-amber-700"
                  >
                    <option value="instant">⚡ Instant Booking</option>
                    <option value="manual">🛡️ Manual Review</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-bold text-stone-700 mb-1">
                  Outside Fee / Day ($)
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={instrumentForm.outsideFeePerDay}
                  onChange={(e) =>
                    setInstrumentForm({
                      ...instrumentForm,
                      outsideFeePerDay: e.target.value,
                    })
                  }
                  className="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-xl text-stone-900 focus:outline-none focus:border-amber-700"
                />
              </div>

              <div>
                <label className="block font-bold text-stone-700 mb-1">
                  Description
                </label>
                <textarea
                  rows={2}
                  placeholder="Notes on usage, accessories included..."
                  value={instrumentForm.description}
                  onChange={(e) =>
                    setInstrumentForm({
                      ...instrumentForm,
                      description: e.target.value,
                    })
                  }
                  className="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-xl text-stone-900 focus:outline-none focus:border-amber-700"
                />
              </div>

              {/* Instrument Photo Upload (Drag & Drop + File Selection) */}
              <div className="space-y-1.5 pt-1">
                <div className="flex items-center justify-between">
                  <label className="block font-bold text-stone-700">
                    Instrument Photo
                  </label>
                  {instrumentForm.photoUrl ? (
                    <button
                      type="button"
                      onClick={handleRemovePhoto}
                      className="text-[11px] font-semibold text-red-600 hover:text-red-800 transition flex items-center gap-1 cursor-pointer"
                    >
                      <Trash2 className="w-3 h-3" />
                      <span>Remove photo</span>
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setShowUrlInput(!showUrlInput)}
                      className="text-[11px] font-semibold text-amber-800 hover:text-amber-900 transition cursor-pointer"
                    >
                      {showUrlInput
                        ? "Switch to file upload"
                        : "Or paste web URL"}
                    </button>
                  )}
                </div>

                {/* Hidden native file input */}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/png, image/jpeg, image/webp, image/gif"
                  onChange={handlePhotoFileChange}
                  className="hidden"
                  id="instrument-photo-file-input"
                />

                {instrumentForm.photoUrl ? (
                  /* Photo Attached Preview */
                  <div className="relative rounded-2xl overflow-hidden border border-stone-300 bg-stone-900 group shadow-2xs">
                    <div className="h-44 w-full flex items-center justify-center bg-stone-950/20">
                      <img
                        src={instrumentForm.photoUrl}
                        alt="Instrument preview"
                        referrerPolicy="no-referrer"
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <div className="absolute inset-0 bg-stone-900/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2 backdrop-blur-2xs">
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="px-3 py-1.5 rounded-xl bg-white/95 hover:bg-white text-stone-900 text-xs font-bold shadow-md transition flex items-center gap-1.5 cursor-pointer"
                      >
                        <Upload className="w-3.5 h-3.5" />
                        <span>Change Photo</span>
                      </button>
                      <button
                        type="button"
                        onClick={handleRemovePhoto}
                        className="px-3 py-1.5 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-bold shadow-md transition flex items-center gap-1.5 cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>Remove</span>
                      </button>
                    </div>
                    <div className="absolute bottom-2 left-2 px-2.5 py-0.5 rounded-lg bg-stone-900/80 text-white text-[10px] font-semibold flex items-center gap-1.5 backdrop-blur-xs">
                      <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                      <span>Photo Attached</span>
                    </div>
                  </div>
                ) : showUrlInput ? (
                  /* Web Image URL Alternative */
                  <div className="space-y-1.5">
                    <input
                      type="url"
                      placeholder="https://images.unsplash.com/... or image web address"
                      value={instrumentForm.photoUrl}
                      onChange={(e) =>
                        setInstrumentForm({
                          ...instrumentForm,
                          photoUrl: e.target.value,
                        })
                      }
                      className="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-xl text-stone-900 focus:outline-none focus:border-amber-700"
                    />
                    <p className="text-[10px] text-stone-400">
                      Paste a direct image web link or switch to uploading a
                      photo file from your device.
                    </p>
                  </div>
                ) : (
                  /* Drag & Drop Zone */
                  <div
                    id="instrument-photo-dropzone"
                    onClick={() => fileInputRef.current?.click()}
                    onDragOver={handlePhotoDragOver}
                    onDragEnter={handlePhotoDragOver}
                    onDragLeave={handlePhotoDragLeave}
                    onDrop={handlePhotoDrop}
                    className={`border-2 border-dashed rounded-2xl p-5 text-center cursor-pointer transition-all duration-150 flex flex-col items-center justify-center gap-2 select-none ${
                      isDraggingPhoto
                        ? "border-amber-600 bg-amber-50/90 scale-[1.01]"
                        : "border-stone-300 hover:border-amber-700 hover:bg-stone-50/80 bg-stone-50/50"
                    }`}
                  >
                    <div
                      className={`w-11 h-11 rounded-xl flex items-center justify-center transition-colors ${
                        isDraggingPhoto
                          ? "bg-amber-600 text-white shadow-xs"
                          : "bg-amber-50 border border-amber-200 text-amber-800"
                      }`}
                    >
                      {isProcessingPhoto ? (
                        <RefreshCw className="w-5 h-5 animate-spin" />
                      ) : (
                        <Upload className="w-5 h-5" />
                      )}
                    </div>
                    <div>
                      <p className="font-bold text-stone-800 text-xs">
                        {isDraggingPhoto
                          ? "Drop photo to upload"
                          : isProcessingPhoto
                            ? "Processing photo..."
                            : "Click to choose file or drag & drop here"}
                      </p>
                      <p className="text-[10px] text-stone-400 mt-0.5">
                        Supports PNG, JPG, WEBP or GIF (automatically optimized)
                      </p>
                    </div>
                  </div>
                )}

                {photoUploadError && (
                  <div className="text-[11px] text-red-600 font-medium flex items-center gap-1 mt-1">
                    <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                    <span>{photoUploadError}</span>
                  </div>
                )}
              </div>

              <div className="pt-3 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowInstrumentModal(false)}
                  className="px-3.5 py-2 rounded-xl bg-stone-50 hover:bg-stone-100 text-stone-700 font-semibold cursor-pointer border border-stone-200"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-amber-800 hover:bg-amber-900 text-white font-bold cursor-pointer shadow-xs"
                >
                  {editingInstrument
                    ? "Update Instrument"
                    : "Create Instrument"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* =============================================================
          MODAL 2: Mark Unavailable Confirmation (Retire from Service)
         ============================================================= */}
      {removingInstrument && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-stone-200 rounded-2xl max-w-md w-full p-6 space-y-4 shadow-xl">
            <div className="flex items-start justify-between gap-3 border-b border-stone-100 pb-3">
              <div className="flex items-center gap-2.5 text-amber-800">
                <div className="w-9 h-9 rounded-xl bg-amber-100 text-amber-800 flex items-center justify-center shrink-0">
                  <Archive className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-stone-900 text-sm">
                    Mark "{removingInstrument.name}" as Not Available?
                  </h3>
                  <span className="text-[10px] uppercase tracking-wider font-extrabold text-amber-800 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">
                    Retire from Active Service
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setRemovingInstrument(null)}
                className="p-1 rounded-lg text-stone-400 hover:text-stone-600 hover:bg-stone-100 transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-stone-600 leading-relaxed">
              Marking this instrument as Not Available cancels upcoming active
              reservations automatically. Past reservation history and audit
              records remain <strong>preserved</strong> in the database.
            </p>

            <div className="p-2.5 rounded-xl bg-stone-50 border border-stone-200 text-stone-600 text-[11px] leading-normal flex items-start gap-2">
              <Info className="w-4 h-4 text-stone-500 shrink-0 mt-0.5" />
              <div>
                <strong>
                  Need to remove a mistaken or typo entry instead?
                </strong>{" "}
                Close this modal and click <strong>Delete</strong> instead to
                completely erase the row from the database.
              </div>
            </div>

            <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs flex items-center gap-2 text-amber-900">
              <input
                type="checkbox"
                id="check-force-remove"
                checked={removeConfirmForce}
                onChange={(e) => setRemoveConfirmForce(e.target.checked)}
                className="w-4 h-4 accent-amber-700 rounded cursor-pointer shrink-0"
              />
              <label
                htmlFor="check-force-remove"
                className="cursor-pointer font-semibold select-none"
              >
                I understand and confirm marking this instrument Not Available.
              </label>
            </div>

            <div className="pt-2 flex items-center justify-end gap-2 text-xs">
              <button
                type="button"
                onClick={() => setRemovingInstrument(null)}
                className="px-3.5 py-2 rounded-xl bg-stone-50 hover:bg-stone-100 text-stone-700 font-semibold cursor-pointer border border-stone-200"
              >
                Cancel
              </button>
              <button
                type="button"
                id="btn-confirm-mark-unavailable"
                disabled={!removeConfirmForce}
                onClick={handleExecuteRemoveInstrument}
                className="px-4 py-2 rounded-xl bg-amber-800 hover:bg-amber-900 disabled:opacity-50 text-white font-bold cursor-pointer shadow-xs"
              >
                Confirm Mark Unavailable
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =============================================================
          MODAL 2B: Permanent Delete Confirmation (Mistaken Entries Only)
         ============================================================= */}
      {deletingInstrument && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-stone-200 rounded-2xl max-w-md w-full p-6 space-y-4 shadow-xl">
            <div className="flex items-start justify-between gap-3 border-b border-stone-100 pb-3">
              <div className="flex items-center gap-2.5 text-red-700">
                <div className="w-9 h-9 rounded-xl bg-red-100 text-red-700 flex items-center justify-center shrink-0">
                  <Trash2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-stone-900 text-sm">
                    Delete Instrument from Database
                  </h3>
                  <span className="text-[10px] uppercase tracking-wider font-extrabold text-red-700 bg-red-50 px-2 py-0.5 rounded-full border border-red-200">
                    For Correcting Mistaken Entries Only
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setDeletingInstrument(null);
                  setDeleteConfirmChecked(false);
                }}
                className="p-1 rounded-lg text-stone-400 hover:text-stone-600 hover:bg-stone-100 transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-3 bg-stone-50 border border-stone-200 rounded-xl space-y-1.5 text-xs">
              <div className="flex justify-between">
                <span className="text-stone-500 font-medium">
                  Instrument Name:
                </span>
                <span className="font-bold text-stone-900">
                  {deletingInstrument.name}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-stone-500 font-medium">Category:</span>
                <span className="font-semibold text-stone-800">
                  {deletingInstrument.type}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-stone-500 font-medium">
                  Current Status:
                </span>
                <span className="font-semibold text-stone-800">
                  {deletingInstrument.isRemoved || deletingInstrument.is_removed
                    ? "Not Available"
                    : "Available"}
                </span>
              </div>
              {(deletingInstrument.totalReservations !== undefined ||
                deletingInstrument.total_reservations !== undefined) && (
                <div className="flex justify-between">
                  <span className="text-stone-500 font-medium">
                    Associated Bookings:
                  </span>
                  <span className="font-bold text-stone-900">
                    {deletingInstrument.totalReservations ??
                      deletingInstrument.total_reservations ??
                      0}
                  </span>
                </div>
              )}
            </div>

            <div className="space-y-2 text-xs text-stone-600 leading-relaxed">
              <p>
                This action will{" "}
                <strong className="text-red-700">
                  permanently remove this row from the database
                </strong>
                . Use this strictly to correct accidental additions, typos, or
                duplicate records.
              </p>
              <div className="p-2.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-[11px] leading-normal flex items-start gap-2">
                <Info className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
                <div>
                  <strong>Need to retire a legitimate instrument?</strong> Do
                  not delete it. Use <strong>Mark Unavailable</strong> instead
                  to preserve member reservation histories and financial
                  records.{" "}
                </div>
              </div>
              {Number(
                deletingInstrument.totalReservations ??
                  deletingInstrument.total_reservations ??
                  0,
              ) > 0 && (
                <div className="p-2.5 rounded-xl bg-red-50 border border-red-200 text-red-900 text-[11px] leading-normal flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 text-red-700 shrink-0 mt-0.5" />
                  <div>
                    <strong>Warning:</strong> This row has{" "}
                    {deletingInstrument.totalReservations ??
                      deletingInstrument.total_reservations}{" "}
                    associated booking(s). Removing the row will also remove all
                    associated reservations.
                  </div>
                </div>
              )}
            </div>

            <div className="p-3 bg-red-50/80 border border-red-200 rounded-xl text-xs flex items-start gap-2 text-red-950">
              <input
                type="checkbox"
                id="check-permanent-delete-instrument"
                checked={deleteConfirmChecked}
                onChange={(e) => setDeleteConfirmChecked(e.target.checked)}
                className="w-4 h-4 accent-red-700 rounded cursor-pointer mt-0.5 shrink-0"
              />
              <label
                htmlFor="check-permanent-delete-instrument"
                className="cursor-pointer font-medium select-none"
              >
                I confirm this is an accidental or mistaken entry and want to
                permanently remove this row from the database.
              </label>
            </div>

            <div className="pt-2 flex items-center justify-end gap-2 text-xs">
              <button
                type="button"
                onClick={() => {
                  setDeletingInstrument(null);
                  setDeleteConfirmChecked(false);
                }}
                disabled={isDeletingInstrument}
                className="px-3.5 py-2 rounded-xl bg-stone-50 hover:bg-stone-100 text-stone-700 font-semibold cursor-pointer border border-stone-200 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                id="btn-confirm-delete-instrument"
                disabled={!deleteConfirmChecked || isDeletingInstrument}
                onClick={handleExecuteDeleteInstrument}
                className="px-4 py-2 rounded-xl bg-red-700 hover:bg-red-800 disabled:opacity-50 text-white font-bold cursor-pointer shadow-xs flex items-center gap-1.5"
              >
                {isDeletingInstrument ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Deleting Row...</span>
                  </>
                ) : (
                  <>
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Permanently Remove from Database</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =============================================================
          MODAL 3: Book on Behalf of User
         ============================================================= */}
      {bookOnBehalfUser && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-stone-200 rounded-2xl max-w-md w-full p-6 space-y-4 shadow-xl">
            <div className="flex items-center justify-between border-b border-stone-100 pb-3">
              <div>
                <h3 className="font-bold text-stone-900 text-sm">
                  Book on Behalf of {bookOnBehalfUser.name}
                </h3>
                <p className="text-xs text-amber-800 font-semibold">
                  Auto-Approved via Administrator Privilege
                </p>
              </div>
              <button
                onClick={() => setBookOnBehalfUser(null)}
                className="text-stone-400 hover:text-stone-600 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleBookOnBehalf} className="space-y-3 text-xs">
              <div>
                <label className="block font-bold text-stone-700 mb-1">
                  Instrument
                </label>
                <select
                  value={behalfForm.instrumentId}
                  onChange={(e) =>
                    setBehalfForm({
                      ...behalfForm,
                      instrumentId: e.target.value,
                    })
                  }
                  className="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-xl text-stone-900 focus:outline-none focus:border-amber-700"
                >
                  {instrumentsList
                    .filter((i) => !(i.isRemoved ?? i.is_removed))
                    .map((i) => (
                      <option key={i.id} value={i.id}>
                        {i.name} ({i.type})
                      </option>
                    ))}
                </select>
              </div>

              <div>
                <label className="block font-bold text-stone-700 mb-1">
                  Service / Event Name
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Special Feast Rehearsal"
                  value={behalfForm.serviceName}
                  onChange={(e) =>
                    setBehalfForm({
                      ...behalfForm,
                      serviceName: e.target.value,
                    })
                  }
                  className="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-xl text-stone-900 focus:outline-none focus:border-amber-700"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-stone-700 mb-1">
                    Date
                  </label>
                  <input
                    type="date"
                    required
                    value={behalfForm.date}
                    onChange={(e) =>
                      setBehalfForm({ ...behalfForm, date: e.target.value })
                    }
                    className="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-xl text-stone-900 focus:outline-none focus:border-amber-700"
                  />
                </div>

                <div>
                  <label className="block font-bold text-stone-700 mb-1">
                    Start Time
                  </label>
                  <select
                    value={behalfForm.startTime}
                    onChange={(e) =>
                      setBehalfForm({
                        ...behalfForm,
                        startTime: e.target.value,
                      })
                    }
                    className="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-xl text-stone-900 focus:outline-none focus:border-amber-700"
                  >
                    {[
                      "09:00",
                      "10:00",
                      "11:00",
                      "12:00",
                      "13:00",
                      "14:00",
                      "15:00",
                      "16:00",
                      "17:00",
                      "18:00",
                      "19:00",
                      "20:00",
                      "21:00",
                    ].map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-stone-700 mb-1">
                    Duration (Hours)
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="6"
                    value={behalfForm.duration}
                    onChange={(e) =>
                      setBehalfForm({
                        ...behalfForm,
                        duration: parseInt(e.target.value) || 1,
                      })
                    }
                    className="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-xl text-stone-900 focus:outline-none focus:border-amber-700"
                  />
                </div>

                <div>
                  <label className="block font-bold text-stone-700 mb-1">
                    Type
                  </label>
                  <select
                    value={behalfForm.reservationType}
                    onChange={(e) =>
                      setBehalfForm({
                        ...behalfForm,
                        reservationType: e.target.value as any,
                      })
                    }
                    className="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-xl text-stone-900 focus:outline-none focus:border-amber-700"
                  >
                    <option value="in_church">In Church</option>
                    <option value="outside_church">Outside Church</option>
                  </select>
                </div>
              </div>

              <div className="pt-3 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setBookOnBehalfUser(null)}
                  className="px-3 py-2 rounded-xl bg-stone-50 hover:bg-stone-100 text-stone-700 font-semibold cursor-pointer border border-stone-200"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-amber-800 hover:bg-amber-900 text-white font-bold cursor-pointer shadow-xs"
                >
                  Create & Auto-Approve
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* =============================================================
          MODAL 4: Provision Administrator Account (Super Admin)
         ============================================================= */}
      {showNewAdminModal && isSuperAdmin && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-stone-200 rounded-2xl max-w-md w-full p-6 space-y-4 shadow-xl">
            <div className="flex items-center justify-between border-b border-stone-100 pb-3">
              <div>
                <h3 className="font-bold text-stone-900 text-sm">
                  Provision Administrator Account
                </h3>
                <p className="text-xs text-stone-500">
                  Create new login credentials for church leadership
                </p>
              </div>
              <button
                onClick={() => setShowNewAdminModal(false)}
                className="text-stone-400 hover:text-stone-600 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateAdmin} className="space-y-3 text-xs">
              <div>
                <label className="block font-bold text-stone-700 mb-1">
                  Full Name
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Deacon Mark"
                  value={newAdminForm.name}
                  onChange={(e) =>
                    setNewAdminForm({ ...newAdminForm, name: e.target.value })
                  }
                  className="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-xl text-stone-900 focus:outline-none focus:border-amber-700"
                />
              </div>

              <div>
                <label className="block font-bold text-stone-700 mb-1">
                  Email Address
                </label>
                <input
                  type="email"
                  required
                  placeholder="e.g. deacon@church.org"
                  value={newAdminForm.email}
                  onChange={(e) =>
                    setNewAdminForm({ ...newAdminForm, email: e.target.value })
                  }
                  className="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-xl text-stone-900 focus:outline-none focus:border-amber-700"
                />
              </div>

              <div>
                <label className="block font-bold text-stone-700 mb-1">
                  Phone Number (Optional)
                </label>
                <input
                  type="tel"
                  placeholder="e.g. 01012345678"
                  value={newAdminForm.phoneNumber}
                  onChange={(e) =>
                    setNewAdminForm({
                      ...newAdminForm,
                      phoneNumber: e.target.value,
                    })
                  }
                  className="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-xl text-stone-900 focus:outline-none focus:border-amber-700"
                />
              </div>

              <div>
                <label className="block font-bold text-stone-700 mb-1">
                  Password (Minimum 6 Characters)
                </label>
                <input
                  type="password"
                  required
                  placeholder="••••••••"
                  value={newAdminForm.password}
                  onChange={(e) =>
                    setNewAdminForm({
                      ...newAdminForm,
                      password: e.target.value,
                    })
                  }
                  className="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-xl text-stone-900 focus:outline-none focus:border-amber-700"
                />
              </div>

              <div className="p-3 bg-amber-50 border border-amber-200/80 rounded-xl flex items-center gap-2">
                <input
                  type="checkbox"
                  id="check-is-super-admin"
                  checked={newAdminForm.isSuperAdmin}
                  onChange={(e) =>
                    setNewAdminForm({
                      ...newAdminForm,
                      isSuperAdmin: e.target.checked,
                    })
                  }
                  className="w-4 h-4 accent-amber-800 rounded cursor-pointer"
                />
                <label
                  htmlFor="check-is-super-admin"
                  className="text-amber-950 cursor-pointer text-xs"
                >
                  Grant <strong>Super Admin</strong> role (System hard limits &
                  admin team management)
                </label>
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowNewAdminModal(false)}
                  className="px-3.5 py-2 rounded-xl bg-stone-50 hover:bg-stone-100 text-stone-700 font-semibold cursor-pointer border border-stone-200"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-amber-800 hover:bg-amber-900 text-white font-bold cursor-pointer shadow-xs"
                >
                  Create Administrator
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* =============================================================
          MODAL 5: In-App Rejection Dialog (Reliable, Beautiful, No iframe prompt blocks)
         ============================================================= */}
      {rejectModal && rejectModal.isOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-stone-200 rounded-2xl max-w-lg w-full p-6 space-y-4 shadow-xl animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-stone-100 pb-3">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-red-50 text-red-700 border border-red-200">
                  <XCircle className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-stone-900 text-sm">
                    {rejectModal.isSeriesReject
                      ? "Reject Recurring Series"
                      : "Reject Reservation Request"}
                  </h3>
                  <p className="text-xs text-stone-500">
                    Provide an explanation for the member
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setRejectModal(null)}
                disabled={rejectModal.submitting}
                className="text-stone-400 hover:text-stone-600 cursor-pointer disabled:opacity-50"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Target Reservation Summary */}
            <div className="bg-stone-50 border border-stone-200/80 rounded-xl p-3.5 space-y-1.5 text-xs">
              <div className="flex justify-between items-center">
                <span className="text-stone-500 font-medium">Member:</span>
                <span className="font-bold text-stone-900">
                  {rejectModal.memberName}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-stone-500 font-medium">Instrument:</span>
                <span className="font-bold text-amber-900">
                  {rejectModal.instrumentName}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-stone-500 font-medium">Slot:</span>
                <span className="text-stone-800 font-medium">
                  {rejectModal.dateFormatted} ({rejectModal.timeFormatted})
                </span>
              </div>
            </div>

            {/* Series rejection scope option if recurring */}
            {rejectModal.seriesId && (
              <div className="p-3 bg-amber-50/70 border border-amber-200/80 rounded-xl space-y-2 text-xs">
                <div className="font-bold text-amber-950 flex items-center gap-1.5">
                  <Repeat className="w-3.5 h-3.5 text-amber-800" />
                  <span>This reservation is part of a recurring series</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() =>
                      setRejectModal({ ...rejectModal, isSeriesReject: false })
                    }
                    className={`px-3 py-2 rounded-lg text-left text-xs font-semibold border transition cursor-pointer ${
                      !rejectModal.isSeriesReject
                        ? "bg-amber-800 text-white border-amber-900 shadow-2xs"
                        : "bg-white text-stone-700 border-stone-200 hover:bg-stone-50"
                    }`}
                  >
                    Reject this occurrence only
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setRejectModal({ ...rejectModal, isSeriesReject: true })
                    }
                    className={`px-3 py-2 rounded-lg text-left text-xs font-semibold border transition cursor-pointer ${
                      rejectModal.isSeriesReject
                        ? "bg-amber-800 text-white border-amber-900 shadow-2xs"
                        : "bg-white text-stone-700 border-stone-200 hover:bg-stone-50"
                    }`}
                  >
                    Reject all future occurrences
                  </button>
                </div>
              </div>
            )}

            {/* Reason Presets */}
            <div className="space-y-1.5">
              <label className="block text-[11px] font-bold uppercase text-stone-500">
                Quick Reason Presets
              </label>
              <div className="flex flex-wrap gap-1.5">
                {[
                  "Slot unavailable due to scheduling conflict",
                  "Church liturgy / official service priority",
                  "Instrument maintenance / repair required",
                  "Exceeds allowed reservation duration / limits",
                ].map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() =>
                      setRejectModal({ ...rejectModal, reason: preset })
                    }
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-medium border transition cursor-pointer ${
                      rejectModal.reason === preset
                        ? "bg-amber-100 text-amber-950 border-amber-300"
                        : "bg-stone-50 text-stone-600 border-stone-200 hover:bg-stone-100"
                    }`}
                  >
                    {preset}
                  </button>
                ))}
              </div>
            </div>

            {/* Editable Rejection Reason */}
            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-stone-700">
                Message to Member <span className="text-red-600">*</span>
              </label>
              <textarea
                rows={3}
                required
                value={rejectModal.reason}
                onChange={(e) =>
                  setRejectModal({ ...rejectModal, reason: e.target.value })
                }
                placeholder="Explain why this request is being rejected..."
                className="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-xl text-xs text-stone-900 focus:outline-none focus:border-amber-700"
              />
            </div>

            <div className="pt-2 flex items-center justify-end gap-2">
              <button
                type="button"
                disabled={rejectModal.submitting}
                onClick={() => setRejectModal(null)}
                className="px-3.5 py-2 rounded-xl bg-stone-50 hover:bg-stone-100 text-stone-700 text-xs font-semibold cursor-pointer border border-stone-200 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={rejectModal.submitting || !rejectModal.reason.trim()}
                onClick={handleConfirmReject}
                className="px-4 py-2 rounded-xl bg-red-700 hover:bg-red-800 text-white text-xs font-bold cursor-pointer shadow-xs disabled:opacity-50 flex items-center gap-1.5"
              >
                {rejectModal.submitting ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Rejecting...</span>
                  </>
                ) : (
                  <>
                    <XCircle className="w-3.5 h-3.5" />
                    <span>Confirm Rejection</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =============================================================
          MODAL 6: In-App Confirmation Dialog
         ============================================================= */}
      {confirmModal && confirmModal.isOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-stone-200 rounded-2xl max-w-md w-full p-6 space-y-4 shadow-xl animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center gap-3">
              <div
                className={`p-2.5 rounded-xl border ${
                  confirmModal.isDestructive
                    ? "bg-red-50 text-red-700 border-red-200"
                    : "bg-amber-50 text-amber-900 border-amber-200"
                }`}
              >
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-stone-900 text-sm">
                  {confirmModal.title}
                </h3>
                <p className="text-xs text-stone-500 mt-0.5">
                  {confirmModal.description}
                </p>
              </div>
            </div>

            <div className="pt-3 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setConfirmModal(null)}
                className="px-3.5 py-2 rounded-xl bg-stone-50 hover:bg-stone-100 text-stone-700 text-xs font-semibold cursor-pointer border border-stone-200"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => confirmModal.onConfirm()}
                className={`px-4 py-2 rounded-xl text-white text-xs font-bold cursor-pointer shadow-xs ${
                  confirmModal.isDestructive
                    ? "bg-red-700 hover:bg-red-800"
                    : "bg-amber-800 hover:bg-amber-900"
                }`}
              >
                {confirmModal.confirmLabel}
              </button>
            </div>
          </div>
        </div>
      )}
      {/* =============================================================
    MODAL: Promote User — Choose Role
   ============================================================= */}
      {promoteModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-stone-200 rounded-2xl max-w-md w-full p-6 space-y-4 shadow-xl">
            <div className="flex items-center justify-between border-b border-stone-100 pb-3">
              <div>
                <h3 className="font-bold text-stone-900 text-sm">
                  Promote {promoteModal.userName}
                </h3>
                <p className="text-xs text-stone-500">
                  Choose the role to grant this member
                </p>
              </div>
              <button
                onClick={() => setPromoteModal(null)}
                className="text-stone-400 hover:text-stone-600 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-2.5">
              <button
                onClick={() => executePromoteUser("admin")}
                className="w-full text-left p-3.5 rounded-xl border border-stone-200 hover:border-amber-300 hover:bg-amber-50/50 transition cursor-pointer"
              >
                <div className="font-bold text-stone-900 text-xs flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-amber-800" />
                  <span>Administrator</span>
                </div>
                <p className="text-[11px] text-stone-500 mt-1">
                  Manages instruments, reviews reservations, and messages
                  members. Cannot manage other admins, hard limits, or payment
                  settings.
                </p>
              </button>

              <button
                onClick={() => executePromoteUser("super_admin")}
                className="w-full text-left p-3.5 rounded-xl border border-amber-200 hover:border-amber-400 hover:bg-amber-50 transition cursor-pointer"
              >
                <div className="font-bold text-stone-900 text-xs flex items-center gap-1.5">
                  <Sparkles className="w-4 h-4 text-amber-700" />
                  <span>Super Administrator</span>
                </div>
                <p className="text-[11px] text-stone-500 mt-1">
                  Full Administrator access, plus managing other admins, Trusted
                  status, system hard limits, and payment settings.
                </p>
              </button>
            </div>

            <div className="pt-1 flex justify-end">
              <button
                onClick={() => setPromoteModal(null)}
                className="px-3.5 py-2 rounded-xl bg-stone-50 hover:bg-stone-100 text-stone-700 font-semibold cursor-pointer border border-stone-200 text-xs"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
