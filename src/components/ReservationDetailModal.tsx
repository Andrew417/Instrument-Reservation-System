import React, { useState, useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { useAuth } from "../contexts/AuthContext.tsx";
import { Instrument } from "./AvailabilityCalendar.tsx";
import { REJECTION_REASON_PRESETS } from "../constants/reservationPresets.ts";
import { PolicyExplainerModal } from "./PolicyExplainerModal.tsx";
import {
  formatDisplayDate,
  formatHhmmTo12Hour,
  getCairoDateString,
  getCairoTimeString,
} from "../lib/date-utils";
import {
  Calendar,
  Clock,
  Music2,
  DollarSign,
  Shield,
  Sun,
  CheckCircle2,
  XCircle,
  AlertCircle,
  AlertTriangle,
  X,
  Repeat,
  ArrowRight,
  ArrowLeft,
  Info,
  User,
  Phone,
  FileText,
  Trash2,
  Edit,
  ChevronRight,
  Upload,
  ExternalLink,
  MessageSquare,
  Image as ImageIcon,
  Check,
  Send,
  Pencil,
  MoreHorizontal,
} from "lucide-react";
import { getStatusColor } from "../lib/status-colors.ts";

function formatMessageTime(dateInput: any): string {
  if (!dateInput) return "";
  const d = new Date(dateInput);
  if (isNaN(d.getTime())) return "";
  const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  const time = d.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  return `${formatDisplayDate(iso)} • ${formatHhmmTo12Hour(time)}`;
}

export interface ReservationDetailModalProps {
  reservationId: string;
  allInstruments: Instrument[];
  onClose: () => void;
  onBack?: () => void;
  backButtonTitle?: string;
  onEdit: (reservation: any) => void;
  onCancelled: () => void;
  onNavigateToReservation?: (id: string) => void;
  initialTab?: "details" | "chat";
  onOpenUserProfile?: (userId: string) => void;
  zIndexClass?: string;
}

export const ReservationDetailModal: React.FC<ReservationDetailModalProps> = ({
  reservationId,
  allInstruments,
  onClose,
  onBack,
  backButtonTitle,
  onEdit,
  onCancelled,
  onNavigateToReservation,
  initialTab = "details",
  onOpenUserProfile,
  zIndexClass = "z-50",
}) => {
  const { t, i18n } = useTranslation();
  const isRTL = i18n.language === "ar";
  const ArrowIcon = isRTL ? ArrowLeft : ArrowRight;
  const { profile, sessionToken } = useAuth();
  const isAdminViewer = Boolean(
    profile?.role === "admin" ||
    profile?.role === "super_admin" ||
    profile?.isSuperAdmin,
  );

  const [activeTab, setActiveTab] = useState<"details" | "chat">(
    initialTab || "details",
  );

  useEffect(() => {
    if (initialTab) setActiveTab(initialTab);
  }, [initialTab]);

  const [reservation, setReservation] = useState<any | null>(null);
  const [showPolicyExplainer, setShowPolicyExplainer] = useState(false);
  const [seriesOccurrences, setSeriesOccurrences] = useState<any[]>([]);
  const [adminMessages, setAdminMessages] = useState<any[]>([]);
  const [paymentSettings, setPaymentSettings] = useState<{
    instapayNumber: string;
    instapayLink: string;
  } | null>(null);

  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [actionNotice, setActionNotice] = useState<{
    message: string;
    type: "success" | "error";
  } | null>(null);

  // Admin approve / reject
  const [isApproving, setIsApproving] = useState(false);
  const [isRejectOpen, setIsRejectOpen] = useState(false);
  const [rejectMode, setRejectMode] = useState<"single" | "series">("single");
  const [rejectReason, setRejectReason] = useState("");
  const [rejectError, setRejectError] = useState<string | null>(null);
  const [isRejecting, setIsRejecting] = useState(false);

  // Full-day transform
  const [isTransformingFullDay, setIsTransformingFullDay] = useState(false);
  const [fullDayConfirmOpen, setFullDayConfirmOpen] = useState(false);

  // No-show
  const [isNoShowProcessing, setIsNoShowProcessing] = useState(false);

  // Payment screenshot
  const [uploadingScreenshot, setUploadingScreenshot] = useState(false);
  const [screenshotSuccess, setScreenshotSuccess] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [pendingScreenshot, setPendingScreenshot] = useState<{
    dataUrl: string;
    fileName: string;
    sizeBytes: number;
  } | null>(null);
  const [isDeletingScreenshot, setIsDeletingScreenshot] = useState(false);
  const [deleteScreenshotConfirmOpen, setDeleteScreenshotConfirmOpen] =
    useState(false);
  const [isConfirmingPaid, setIsConfirmingPaid] = useState(false);
  const [paidConfirmedThisSession, setPaidConfirmedThisSession] =
    useState(false);

  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const [showInstrumentDetails, setShowInstrumentDetails] = useState(false);

  // Cancellation
  const [isCancelling, setIsCancelling] = useState(false);
  const [cancelPrompt, setCancelPrompt] = useState<"single" | "series" | null>(
    null,
  );
  const [cancelReasonPreset, setCancelReasonPreset] = useState(
    "Instrument in maintenance",
  );
  const [cancelReasonCustom, setCancelReasonCustom] = useState("");

  const CANCELLATION_REASON_PRESETS = [
    "Instrument in maintenance",
    "Schedule conflict",
    "Duplicate reservation",
    "Policy violation",
    "Urgent event — no other instrument available",
    "Other",
  ];

  // Chat
  const [replyContent, setReplyContent] = useState("");
  const [sendingReply, setSendingReply] = useState(false);
  const [replyError, setReplyError] = useState<string | null>(null);
  const chatInputRef = useRef<HTMLTextAreaElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (activeTab === "chat") {
      setTimeout(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
      }, 120);
    }
  }, [activeTab, adminMessages.length]);

  const focusChat = () => {
    setActiveTab("chat");
    setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
      chatInputRef.current?.focus();
    }, 80);
  };

  const handleSendMessage = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const content = replyContent.trim();
    if (!content || sendingReply) return;

    setSendingReply(true);
    setReplyError(null);

    try {
      const res = await fetch(`/api/reservations/${reservationId}/messages`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(sessionToken ? { Authorization: `Bearer ${sessionToken}` } : {}),
        },
        body: JSON.stringify({
          content,
          senderRole: isAdminViewer ? "admin" : "user",
          senderName:
            profile?.name ||
            (isAdminViewer
              ? t("reservationDetail.churchAdministration")
              : t("reservationDetail.member")),
          userId: !isAdminViewer ? profile?.id : undefined,
          adminId: isAdminViewer ? profile?.id : undefined,
        }),
      });

      const data = await res.json();
      if (data.success && data.message) {
        setAdminMessages((prev) => [...prev, data.message]);
        setReplyContent("");
        setTimeout(() => {
          messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
        }, 80);
      } else {
        setReplyError(data.error || t("reservationDetail.sendError"));
      }
    } catch (err: any) {
      setReplyError(err.message || t("reservationDetail.sendError"));
    } finally {
      setSendingReply(false);
    }
  };

  const loadReservationData = async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const res = await fetch(`/api/reservations/${reservationId}`);
      const data = await res.json();
      if (!res.ok || !data.success || !data.reservation) {
        setErrorMsg(data.error || t("reservationDetail.loadError"));
        setLoading(false);
        return;
      }
      setReservation(data.reservation);

      if (data.reservation.admin_id) {
        try {
          const adminRes = await fetch(
            `/api/admin/admins/${data.reservation.admin_id}`,
            {
              headers: {
                Authorization: `Bearer ${sessionToken}`,
                "Content-Type": "application/json",
              },
            },
          );
          if (adminRes.ok) {
            const adminData = await adminRes.json();
            if (adminData.success && adminData.admin) {
              setReservation((prev: any) => ({
                ...prev,
                admin_name: adminData.admin.name,
                admin_phone: adminData.admin.phone_number,
              }));
            }
          }
        } catch (adminErr) {
          console.error("Failed to fetch admin:", adminErr);
        }
      }

      const msgRes = await fetch(`/api/reservations/${reservationId}/messages`);
      const msgData = await msgRes.json();
      if (msgData.success && Array.isArray(msgData.messages)) {
        setAdminMessages(msgData.messages);
      }

      if (data.reservation.reservation_type === "outside_church") {
        const payRes = await fetch("/api/reservations/payment-settings");
        const payData = await payRes.json();
        if (payData.success && payData.settings) {
          setPaymentSettings({
            instapayNumber: payData.settings.instapay_number || "0100 123 4567",
            instapayLink:
              payData.settings.instapay_link ||
              "https://ipn.eg/coptic-church-instruments",
          });
        }
      }

      if (data.reservation.series_id) {
        const seriesRes = await fetch(
          `/api/reservations?seriesId=${data.reservation.series_id}`,
        );
        const seriesData = await seriesRes.json();
        if (seriesData.success && Array.isArray(seriesData.reservations)) {
          setSeriesOccurrences(seriesData.reservations);
        }
      }
    } catch (err: any) {
      setErrorMsg(err.message || t("reservationDetail.networkError"));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadReservationData();
  }, [reservationId]);

  const processScreenshotFile = (file: File) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setErrorMsg(t("reservationDetail.invalidImageType"));
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setErrorMsg(t("reservationDetail.imageTooLarge"));
      return;
    }

    setErrorMsg(null);
    setScreenshotSuccess(false);

    const reader = new FileReader();
    reader.onload = (e) => {
      const base64Url = e.target?.result as string;
      if (!base64Url) {
        setErrorMsg(t("reservationDetail.processImageError"));
        return;
      }
      setPendingScreenshot({
        dataUrl: base64Url,
        fileName: file.name,
        sizeBytes: file.size,
      });
    };
    reader.onerror = () => setErrorMsg(t("reservationDetail.readFileError"));
    reader.readAsDataURL(file);
  };

  const handleDeleteScreenshot = async () => {
    if (isDeletingScreenshot) return;
    setIsDeletingScreenshot(true);
    setErrorMsg(null);

    try {
      const res = await fetch(
        `/api/reservations/${reservationId}/payment-screenshot`,
        {
          method: "DELETE",
          headers: {
            "Content-Type": "application/json",
            ...(sessionToken
              ? { Authorization: `Bearer ${sessionToken}` }
              : {}),
          },
        },
      );

      const data = await res.json();
      if (!res.ok || !data.success) {
        setErrorMsg(
          data.error ||
            t("reservationDetail.deleteScreenshotError") ||
            "Failed to delete payment screenshot.",
        );
        setIsDeletingScreenshot(false);
        setDeleteScreenshotConfirmOpen(false);
        return;
      }

      setReservation((prev: any) => ({
        ...prev,
        payment_screenshot_url: null,
      }));
      setPaidConfirmedThisSession(false);
      setIsDeletingScreenshot(false);
      setDeleteScreenshotConfirmOpen(false);
      setScreenshotSuccess(false);
      setActionNotice({
        message:
          t("reservationDetail.screenshotDeleted") ||
          "Payment screenshot deleted.",
        type: "success",
      });
      setTimeout(() => setActionNotice(null), 4000);
    } catch (err: any) {
      setErrorMsg(
        err.message ||
          t("reservationDetail.deleteScreenshotError") ||
          "Failed to delete payment screenshot.",
      );
      setIsDeletingScreenshot(false);
      setDeleteScreenshotConfirmOpen(false);
    }
  };

  const handleConfirmPaid = async () => {
    if (isConfirmingPaid) return;

    const hasSaved = Boolean(reservation?.payment_screenshot_url);
    const hasPending = Boolean(pendingScreenshot);

    if (!hasSaved && !hasPending) {
      setErrorMsg(
        t("reservationDetail.mustUploadBeforeSave") ||
          "Please upload a payment screenshot first.",
      );
      setTimeout(() => setErrorMsg(null), 4000);
      return;
    }

    setIsConfirmingPaid(true);
    setErrorMsg(null);

    try {
      if (pendingScreenshot) {
        setUploadingScreenshot(true);
        const uploadRes = await fetch(
          `/api/reservations/${reservationId}/payment-screenshot`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${sessionToken}`,
            },
            body: JSON.stringify({ screenshotUrl: pendingScreenshot.dataUrl }),
          },
        );
        const uploadData = await uploadRes.json();
        setUploadingScreenshot(false);

        if (!uploadRes.ok || !uploadData.success) {
          setErrorMsg(
            uploadData.error ||
              t("reservationDetail.uploadError") ||
              "Failed to upload screenshot.",
          );
          setIsConfirmingPaid(false);
          return;
        }

        setReservation((prev: any) => ({
          ...prev,
          payment_screenshot_url: pendingScreenshot.dataUrl,
        }));
        setPendingScreenshot(null);
        setScreenshotSuccess(true);
        setTimeout(() => setScreenshotSuccess(false), 4000);
      }

      const res = await fetch(
        `/api/reservations/${reservationId}/confirm-paid`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(sessionToken
              ? { Authorization: `Bearer ${sessionToken}` }
              : {}),
          },
        },
      );

      const data = await res.json();
      if (!res.ok || !data.success) {
        setErrorMsg(
          data.error ||
            t("reservationDetail.savePaidError") ||
            "Failed to confirm payment.",
        );
        setIsConfirmingPaid(false);
        return;
      }

      setPaidConfirmedThisSession(true);
      setIsConfirmingPaid(false);
      setActionNotice({
        message:
          t("reservationDetail.savePaidSuccess") ||
          "Payment confirmed. Church administration has been notified.",
        type: "success",
      });
      setTimeout(() => setActionNotice(null), 5000);
    } catch (err: any) {
      setErrorMsg(
        err.message ||
          t("reservationDetail.savePaidError") ||
          "Failed to confirm payment.",
      );
      setIsConfirmingPaid(false);
      setUploadingScreenshot(false);
    }
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") setDragActive(true);
    else if (e.type === "dragleave") setDragActive(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files?.[0])
      processScreenshotFile(e.dataTransfer.files[0]);
  };

  const handleCancelExecution = async (mode: "single" | "series") => {
    if (!profile) return;
    setIsCancelling(true);
    setErrorMsg(null);
    try {
      const cancellationReason = isAdminViewer
        ? cancelReasonPreset === "Other"
          ? cancelReasonCustom.trim() || undefined
          : cancelReasonPreset
        : undefined;

      const res = await fetch(`/api/reservations/${reservationId}/cancel`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${sessionToken}`,
        },
        body: JSON.stringify({
          userId: profile.id,
          cancelMode: mode,
          cancellationReason,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        setErrorMsg(data.error || t("reservationDetail.cancelFailed"));
        setIsCancelling(false);
        setCancelPrompt(null);
        return;
      }

      setIsCancelling(false);
      setCancelPrompt(null);
      onCancelled();
      onClose();
    } catch (err: any) {
      setErrorMsg(err.message || t("reservationDetail.cancelError"));
      setIsCancelling(false);
      setCancelPrompt(null);
    }
  };

  const handleAdminTransformFullDay = async () => {
    if (!isAdminViewer || isTransformingFullDay) return;
    setIsTransformingFullDay(true);
    setErrorMsg(null);
    try {
      const res = await fetch(
        `/api/admin/reservations/${reservationId}/transform-full-day`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${sessionToken || ""}`,
          },
        },
      );
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(
          data.error ||
            t("reservationDetail.transformToFullDayError") ||
            "Failed to transform reservation to full day.",
        );
      }
      setIsTransformingFullDay(false);
      setFullDayConfirmOpen(false);
      setActionNotice({
        message:
          t("reservationDetail.transformToFullDaySuccess") ||
          "Reservation successfully transformed to Full Day!",
        type: "success",
      });
      await loadReservationData();
    } catch (err: any) {
      setErrorMsg(
        err.message || "Failed to transform reservation to full day.",
      );
      setIsTransformingFullDay(false);
    }
  };

  const handleAdminApprove = async (mode: "single" | "series" = "single") => {
    if (!isAdminViewer || isApproving) return;
    setIsApproving(true);
    setErrorMsg(null);
    try {
      let url = `/api/admin/reservations/${reservationId}/approve`;
      if (mode === "series" && reservation?.series_id) {
        url = `/api/admin/reservations/series/${reservation.series_id}/approve`;
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
        setErrorMsg(data.error || t("reservationDetail.approveFailed"));
        setIsApproving(false);
        return;
      }

      setReservation((prev: any) => ({ ...prev, status: "approved" }));
      if (mode === "series" && reservation?.series_id) {
        setSeriesOccurrences((prev) =>
          prev.map((occ) => ({ ...occ, status: "approved" })),
        );
      }

      setActionNotice({
        message:
          mode === "series"
            ? t("reservationDetail.seriesApproved")
            : t("reservationDetail.singleApproved"),
        type: "success",
      });

      setIsRejectOpen(false);
      onCancelled();
    } catch (err: any) {
      setErrorMsg(err.message || t("reservationDetail.approveNetworkError"));
    } finally {
      setIsApproving(false);
    }
  };

  const handleAdminReject = async () => {
    if (!isAdminViewer || isRejecting) return;
    if (!rejectReason.trim()) {
      setRejectError(t("reservationDetail.rejectReasonRequired"));
      return;
    }

    setRejectError(null);
    setIsRejecting(true);
    setErrorMsg(null);

    try {
      let url = `/api/admin/reservations/${reservationId}/reject`;
      if (rejectMode === "series" && reservation?.series_id) {
        url = `/api/admin/reservations/series/${reservation.series_id}/reject`;
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
        setErrorMsg(data.error || t("reservationDetail.rejectFailed"));
        setIsRejecting(false);
        return;
      }

      setReservation((prev: any) => ({
        ...prev,
        status: "rejected",
        rejection_reason: rejectReason.trim(),
      }));

      if (rejectMode === "series" && reservation?.series_id) {
        setSeriesOccurrences((prev) =>
          prev.map((occ) => ({
            ...occ,
            status: "rejected",
            rejection_reason: rejectReason.trim(),
          })),
        );
      }

      setIsRejectOpen(false);
      setRejectReason("");
      setActionNotice({
        message:
          rejectMode === "series"
            ? t("reservationDetail.seriesRejected")
            : t("reservationDetail.singleRejected"),
        type: "success",
      });

      onCancelled();
    } catch (err: any) {
      setErrorMsg(err.message || t("reservationDetail.rejectNetworkError"));
    } finally {
      setIsRejecting(false);
    }
  };

  const handleMarkNoShow = async () => {
    if (!isAdminViewer || isNoShowProcessing) return;
    setIsNoShowProcessing(true);
    setErrorMsg(null);
    try {
      const res = await fetch(
        `/api/admin/reservations/${reservationId}/mark-no-show`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${sessionToken || ""}`,
          },
        },
      );
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to mark as no-show.");
      }
      setReservation((prev: any) => ({
        ...prev,
        is_no_show: true,
        no_show_marked_at:
          data.reservation?.noShowMarkedAt || new Date().toISOString(),
        no_show_admin_name:
          data.reservation?.noShowAdminName || profile?.name || "Administrator",
      }));
      setActionNotice({
        message:
          t("common.markNoShowSuccess") || "Reservation marked as No-Show.",
        type: "success",
      });
      onCancelled();
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to mark as no-show.");
    } finally {
      setIsNoShowProcessing(false);
    }
  };

  const handleUnmarkNoShow = async () => {
    if (!isAdminViewer || isNoShowProcessing) return;
    setIsNoShowProcessing(true);
    setErrorMsg(null);
    try {
      const res = await fetch(
        `/api/admin/reservations/${reservationId}/unmark-no-show`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${sessionToken || ""}`,
          },
        },
      );
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to unmark no-show.");
      }
      setReservation((prev: any) => ({
        ...prev,
        is_no_show: false,
        no_show_marked_at: null,
        no_show_admin_id: null,
        no_show_admin_name: null,
      }));
      setActionNotice({
        message: t("common.unmarkNoShowSuccess") || "No-Show status removed.",
        type: "success",
      });
      onCancelled();
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to unmark no-show.");
    } finally {
      setIsNoShowProcessing(false);
    }
  };

  // ---------- Loading & Not-Found ----------
  if (loading) {
    return (
      <div
        className={`fixed inset-0 ${zIndexClass} bg-stone-900/60 backdrop-blur-xs flex items-center justify-center p-4 pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]`}
      >
        <div className="bg-white rounded-2xl p-8 max-w-md w-full text-center space-y-4 shadow-2xl border border-stone-200">
          <div className="w-8 h-8 border-2 border-amber-800 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-xs font-bold text-stone-600">
            {t("reservationDetail.loadingDetails")}
          </p>
        </div>
      </div>
    );
  }

  if (!reservation) {
    return (
      <div
        className={`fixed inset-0 ${zIndexClass} bg-stone-900/60 backdrop-blur-xs flex items-center justify-center p-4 pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]`}
      >
        <div className="bg-white rounded-2xl p-6 max-w-md w-full space-y-4 shadow-2xl border border-stone-200">
          <div className="flex items-center gap-2 text-red-700">
            <AlertCircle className="w-5 h-5" />
            <h3 className="font-bold text-sm">
              {t("reservationDetail.notFound")}
            </h3>
          </div>
          <p className="text-xs text-stone-600 leading-relaxed">
            {errorMsg || t("reservationDetail.notFoundDesc")}
          </p>
          <button
            onClick={onClose}
            className="w-full h-10 bg-stone-900 hover:bg-stone-800 text-white rounded-xl text-sm font-bold cursor-pointer transition"
          >
            {t("reservationDetail.close")}
          </button>
        </div>
      </div>
    );
  }

  const startUtc = new Date(reservation.start_time || reservation.startTime);
  const endUtc = new Date(reservation.end_time || reservation.endTime);
  const rawDate =
    reservation.reservation_date ||
    (reservation.start_time
      ? String(reservation.start_time).substring(0, 10)
      : getCairoDateString(startUtc));
  const dateStr = formatDisplayDate(rawDate);
  const timeStr =
    reservation.start_hhmm && reservation.end_hhmm
      ? `${formatHhmmTo12Hour(reservation.start_hhmm)} – ${formatHhmmTo12Hour(reservation.end_hhmm)}`
      : `${formatHhmmTo12Hour(getCairoTimeString(startUtc))} – ${formatHhmmTo12Hour(getCairoTimeString(endUtc))}`;
  const durationHours = (
    (endUtc.getTime() - startUtc.getTime()) /
    (3600 * 1000)
  )
    .toFixed(1)
    .replace(".0", "");

  const isPast = endUtc < new Date();
  const isCancelled =
    reservation.status === "cancelled" || reservation.status === "rejected";
  const isApproved =
    reservation.status === "approved" ||
    reservation.status === "ongoing" ||
    reservation.status === "completed";
  const isPending = reservation.status === "pending";
  const isCompleted = reservation.status === "completed";
  const isExpired = reservation.status === "expired";
  const isNoShow = Boolean(reservation.is_no_show);
  const isFullDay = Boolean(
    reservation.is_full_day ||
    reservation.isFullDay ||
    (reservation.start_hhmm === "09:00" && reservation.end_hhmm === "22:00") ||
    Number(durationHours) >= 13,
  );
  const hoursSinceEnd =
    (new Date().getTime() - endUtc.getTime()) / (3600 * 1000);
  const canMarkNoShow =
    isAdminViewer &&
    isCompleted &&
    !isNoShow &&
    hoursSinceEnd >= 0 &&
    hoursSinceEnd <= 48;
  const canUnmarkNoShow = isAdminViewer && isNoShow;
  const isOutsideChurch = reservation.reservation_type === "outside_church";
  const isApprovedOutsideChurch = isApproved && isOutsideChurch;
  const isAdminBooked = Boolean(
    reservation.booked_by_admin || reservation.bookedByAdmin,
  );

  const previewScreenshotUrl =
    pendingScreenshot?.dataUrl || reservation.payment_screenshot_url || null;
  const hasAnyScreenshot = Boolean(previewScreenshotUrl);
  const isPendingOnly =
    Boolean(pendingScreenshot) && !reservation.payment_screenshot_url;

  const statusLabel = (status: string) =>
    ({
      approved: t("reservationDetail.approved"),
      pending: t("reservationDetail.pending"),
      rejected: t("reservationDetail.rejected"),
      cancelled: t("reservationDetail.cancelled"),
      ongoing: t("reservationDetail.ongoing"),
      completed: t("reservationDetail.completed"),
      expired: t("reservationDetail.expired") || "Expired",
    })[status] || status;

  const canCancelNow = !isPast && !isCancelled;
  const showApprove = isAdminViewer && isPending;
  const showReject = isAdminViewer && isPending;
  const showSavePayment =
    !isAdminViewer &&
    isOutsideChurch &&
    isApprovedOutsideChurch &&
    canCancelNow;
  const showCancel = canCancelNow && !showApprove; // admin pending uses Approve/Reject instead
  const showNoShowToggle =
    isAdminViewer && isCompleted && (canMarkNoShow || canUnmarkNoShow);
  const showMoreButton = reservation.status !== "cancelled" && !isPast;
  const showFooter =
    showApprove ||
    showReject ||
    showSavePayment ||
    showCancel ||
    showNoShowToggle;

  return (
    <div
      className={`fixed inset-0 ${zIndexClass} bg-stone-900/60 backdrop-blur-xs flex items-stretch sm:items-center justify-center p-0 sm:p-4`}
      dir={isRTL ? "rtl" : "ltr"}
    >
      <div className="bg-white sm:rounded-2xl sm:border sm:border-stone-200 shadow-2xl w-full sm:max-w-2xl z-10 flex flex-col h-full sm:h-auto sm:max-h-[92vh] overflow-hidden pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]">
        {/* Modal Top Header */}
        <div className="shrink-0 bg-stone-900 text-white px-4 sm:px-6 py-3 sm:py-5 flex items-center justify-between border-b border-stone-800">
          <div className="flex items-center gap-3 min-w-0">
            {/* Back button (if any) */}
            {onBack && (
              <button
                type="button"
                onClick={onBack}
                className="w-10 h-10 -ml-1 rounded-full bg-stone-800 text-stone-300 hover:text-white hover:bg-stone-700 active:bg-stone-600 flex items-center justify-center transition cursor-pointer shrink-0 touch-manipulation"
                aria-label={
                  backButtonTitle || t("reservationDetail.backToNotifications")
                }
              >
                <ArrowIcon className="w-5 h-5" />
              </button>
            )}

            <div className="w-10 h-10 rounded-2xl bg-amber-800 text-amber-100 flex items-center justify-center font-bold shadow-xs shrink-0">
              <Music2 className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h2 className="text-sm sm:text-base font-bold text-white leading-tight truncate">
                {t("reservationDetail.title")}
              </h2>
              <p className="text-[11px] sm:text-xs text-stone-400 truncate">
                {reservation.instrument_name || "Instrument"} · #
                {reservation.id.substring(0, 6)}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1 shrink-0">
            <span
              className={`hidden sm:inline-flex px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase whitespace-nowrap ${getStatusColor(reservation.status)}`}
            >
              {statusLabel(reservation.status)}
            </span>
            {!isPast && !isCancelled && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onEdit(reservation);
                }}
                aria-label={t("reservationDetail.editSlot")}
                className="shrink-0 w-11 h-11 flex items-center justify-center rounded-full bg-stone-800 text-stone-300 hover:text-white hover:bg-stone-700 active:bg-stone-600 transition cursor-pointer touch-manipulation"
              >
                <Edit className="w-5 h-5" />
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              aria-label={t("reservationDetail.close")}
              className="shrink-0 w-11 h-11 flex items-center justify-center rounded-full bg-stone-800 text-stone-300 hover:text-white hover:bg-stone-700 active:bg-stone-600 transition cursor-pointer touch-manipulation"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="px-3 py-2 bg-stone-900 border-b border-stone-800 shrink-0">
          <div className="flex items-center bg-stone-800 rounded-lg p-0.5">
            <button
              type="button"
              onClick={() => setActiveTab("details")}
              className={`flex-1 py-1.5 text-xs font-bold rounded-md transition cursor-pointer ${
                activeTab === "details"
                  ? "bg-white text-stone-900 shadow-sm"
                  : "text-stone-400"
              }`}
            >
              {t("reservationDetail.detailsTab")}
            </button>
            <button
              type="button"
              onClick={focusChat}
              className={`flex-1 py-1.5 text-xs font-bold rounded-md transition cursor-pointer flex items-center justify-center gap-1 ${
                activeTab === "chat"
                  ? "bg-white text-stone-900 shadow-sm"
                  : "text-stone-400"
              }`}
            >
              <span>{t("reservationDetail.chatTab")}</span>
              {adminMessages.length > 0 && (
                <span
                  className={`px-1.5 rounded-full text-[10px] font-bold ${
                    activeTab === "chat"
                      ? "bg-amber-100 text-amber-900"
                      : "bg-stone-700 text-stone-300"
                  }`}
                >
                  {adminMessages.length}
                </span>
              )}
            </button>
          </div>
        </div>

        {/* Content */}
        {activeTab === "details" ? (
          <div className="p-4 sm:p-6 pb-[calc(4.5rem+env(safe-area-inset-bottom))] lg:pb-6 overflow-y-auto overscroll-contain space-y-4 flex-1 min-h-0">
            {actionNotice && (
              <div
                className={`p-3 rounded-xl border text-xs font-semibold flex items-center justify-between gap-2 ${
                  actionNotice.type === "success"
                    ? "bg-emerald-50 border-emerald-200 text-emerald-900"
                    : "bg-red-50 border-red-200 text-red-900"
                }`}
              >
                <div className="flex items-center gap-2 min-w-0">
                  {actionNotice.type === "success" ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  ) : (
                    <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
                  )}
                  <span className="truncate">{actionNotice.message}</span>
                </div>
                <button
                  type="button"
                  onClick={() => setActionNotice(null)}
                  className="text-stone-400 hover:text-stone-600 p-1 cursor-pointer shrink-0"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            )}

            {errorMsg && (
              <div className="bg-red-50 border border-red-200 rounded-xl p-3.5 text-red-900 flex items-start gap-2.5">
                <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                <div className="text-xs break-words">{errorMsg}</div>
              </div>
            )}

            {/* Inline Reject Panel */}
            {isAdminViewer && isPending && isRejectOpen && (
              <div className="bg-red-50/70 border border-red-300 rounded-2xl p-4 space-y-3.5">
                <div className="flex items-start justify-between gap-2">
                  <h3 className="text-sm font-bold text-red-950">
                    {t("reservationDetail.rejectRequest")}
                  </h3>
                  <button
                    type="button"
                    onClick={() => {
                      setIsRejectOpen(false);
                      setRejectError(null);
                    }}
                    className="text-stone-400 hover:text-stone-600 cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                {reservation.series_id && (
                  <div className="flex gap-2 text-xs">
                    <button
                      type="button"
                      onClick={() => setRejectMode("single")}
                      className={`flex-1 h-9 rounded-lg font-bold transition cursor-pointer ${
                        rejectMode === "single"
                          ? "bg-red-700 text-white"
                          : "bg-stone-100 text-stone-600"
                      }`}
                    >
                      {t("reservationDetail.thisOccurrenceOnly")}
                    </button>
                    <button
                      type="button"
                      onClick={() => setRejectMode("series")}
                      className={`flex-1 h-9 rounded-lg font-bold transition cursor-pointer ${
                        rejectMode === "series"
                          ? "bg-red-700 text-white"
                          : "bg-stone-100 text-stone-600"
                      }`}
                    >
                      {t("reservationDetail.entireSeries")}
                    </button>
                  </div>
                )}

                <div className="flex flex-wrap gap-1.5">
                  {REJECTION_REASON_PRESETS.map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => {
                        setRejectReason(preset);
                        setRejectError(null);
                      }}
                      className={`text-xs px-2.5 py-1.5 rounded-lg border cursor-pointer ${
                        rejectReason === preset
                          ? "bg-red-700 text-white border-red-700 font-bold"
                          : "bg-white text-stone-700 border-red-200"
                      }`}
                    >
                      {preset}
                    </button>
                  ))}
                </div>

                <textarea
                  value={rejectReason}
                  onChange={(e) => {
                    setRejectReason(e.target.value);
                    if (e.target.value.trim()) setRejectError(null);
                  }}
                  placeholder={t("reservationDetail.rejectPlaceholder")}
                  rows={3}
                  className={`w-full text-sm p-3 rounded-xl border focus:outline-none bg-white resize-none ${
                    rejectError
                      ? "border-red-500"
                      : "border-stone-300 focus:border-red-600"
                  }`}
                />
                {rejectError && (
                  <p className="text-[11px] font-bold text-red-700">
                    {rejectError}
                  </p>
                )}

                <button
                  type="button"
                  onClick={handleAdminReject}
                  disabled={isRejecting}
                  className="w-full h-10 bg-red-600 hover:bg-red-700 text-white rounded-xl text-sm font-bold transition flex items-center justify-center gap-1.5 disabled:opacity-50 cursor-pointer"
                >
                  {isRejecting ? (
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <XCircle className="w-4 h-4" />
                  )}
                  {t("reservationDetail.confirmReject")}
                </button>
              </div>
            )}

            {/* Summary card */}
            {(isAdminViewer || reservation.user_name) && (
              <div className="p-4 bg-stone-50 border border-stone-200 rounded-2xl space-y-3">
                <div className="min-w-0">
                  <span className="text-[11px] text-stone-500 font-semibold uppercase tracking-wider block">
                    {t("reservationDetail.reservationPurpose")}
                  </span>
                  <span className="text-base font-bold text-stone-900 truncate block">
                    {reservation.service_name ||
                      reservation.serviceName ||
                      t("reservationDetail.churchService")}
                  </span>
                  {isAdminBooked && (
                    <span className="inline-flex items-center gap-1 text-[11px] text-amber-800 font-semibold mt-0.5">
                      <Shield className="w-3 h-3" />
                      {t("common.adminBooked")}
                    </span>
                  )}
                  <span className="text-xs text-stone-600 block">
                    {t("reservationDetail.musicianName")}:{" "}
                    {reservation.musician_name || reservation.musicianName}
                  </span>
                </div>

                {isPending && (
                  <button
                    type="button"
                    onClick={() => setShowPolicyExplainer(true)}
                    className="inline-flex items-center gap-1.5 text-[11px] text-amber-800 font-semibold cursor-pointer"
                  >
                    <Info className="w-3.5 h-3.5" />
                    {t("reservationDetail.learnMore")}
                  </button>
                )}

                <div className="border-t border-stone-200 pt-3 flex flex-wrap items-start justify-between gap-3 text-xs">
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5 mb-1">
                      {reservation.user_id && onOpenUserProfile ? (
                        <button
                          type="button"
                          onClick={() => onOpenUserProfile(reservation.user_id)}
                          className="font-bold text-stone-900 text-sm hover:text-amber-800 cursor-pointer flex items-center gap-1"
                        >
                          {reservation.user_name ||
                            t("reservationDetail.churchMember")}
                          <ExternalLink className="w-3.5 h-3.5 text-stone-400" />
                        </button>
                      ) : (
                        <div className="font-bold text-stone-900 text-sm">
                          {reservation.user_name ||
                            reservation.admin_name ||
                            t("reservationDetail.churchMember")}
                        </div>
                      )}
                      {reservation.user_is_trusted && (
                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-bold bg-amber-100 text-amber-900 border border-amber-300">
                          <Shield className="w-3 h-3" />
                          {t("reservationDetail.trusted")}
                        </span>
                      )}
                    </div>
                    {(reservation.user_phone || reservation.admin_phone) && (
                      <a
                        href={`https://wa.me/${String(
                          reservation.user_phone || reservation.admin_phone,
                        )
                          .replace(/[^\d]/g, "")
                          .replace(/^0/, "20")}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 text-emerald-700 text-xs font-mono"
                      >
                        <Phone className="w-3.5 h-3.5" />
                        {reservation.user_phone || reservation.admin_phone}
                      </a>
                    )}
                  </div>
                  <div className="text-right text-[11px] text-stone-500 shrink-0">
                    <div>{t("reservationDetail.requestSubmitted")}</div>
                    <div className="font-mono text-stone-700">
                      {new Date(
                        reservation.created_at || Date.now(),
                      ).toLocaleDateString(isRTL ? "ar-EG" : "en-US", {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      })}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {reservation.note && (
              <div className="bg-stone-50/80 border border-stone-200 rounded-2xl p-3.5 flex items-start gap-2.5">
                <FileText className="w-4 h-4 text-stone-500 shrink-0 mt-0.5" />
                <p className="text-xs text-stone-700 leading-relaxed whitespace-pre-wrap break-words">
                  {reservation.note}
                </p>
              </div>
            )}

            {reservation.rejection_reason && (
              <div className="bg-red-50 border border-red-200 rounded-2xl p-3.5 flex items-start gap-2.5">
                <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                <div className="text-xs space-y-2 flex-1 min-w-0">
                  <span className="font-bold text-red-950 block">
                    {t("reservationDetail.adminRejectionReason")}
                  </span>
                  <div className="text-red-800 leading-relaxed break-words">
                    {reservation.rejection_reason}
                  </div>
                  {!isAdminViewer && (
                    <button
                      type="button"
                      onClick={focusChat}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-red-100 text-red-900 font-bold text-xs cursor-pointer"
                    >
                      <MessageSquare className="w-3.5 h-3.5" />
                      {t("reservationDetail.replyToAdmin")}
                    </button>
                  )}
                </div>
              </div>
            )}

            {reservation.status === "cancelled" &&
              reservation.cancellation_reason && (
                <div className="bg-amber-50 border border-amber-200 rounded-2xl p-3.5 flex items-start gap-2.5">
                  <XCircle className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
                  <div className="text-xs">
                    <div className="font-bold text-amber-950">
                      {t("reservationDetail.cancellationReason")}
                    </div>
                    <div className="text-amber-900 leading-relaxed">
                      {reservation.cancellation_reason}
                    </div>
                  </div>
                </div>
              )}

            {isNoShow && (
              <div className="bg-rose-50 border border-rose-200 rounded-2xl p-3.5 flex items-start gap-2.5">
                <AlertTriangle className="w-4 h-4 text-rose-700 shrink-0 mt-0.5" />
                <div className="text-xs text-rose-900 leading-relaxed">
                  {t("common.markedNoShowBy")}{" "}
                  <strong>
                    {reservation.no_show_admin_name || "Administrator"}
                  </strong>
                </div>
              </div>
            )}

            {isExpired && (
              <div className="bg-stone-100 border border-stone-300 rounded-2xl p-3.5 flex items-start gap-2.5">
                <Clock className="w-4 h-4 text-stone-600 shrink-0 mt-0.5" />
                <div className="text-xs text-stone-600 leading-relaxed">
                  This reservation was pending review and expired because its
                  scheduled start time has passed.
                </div>
              </div>
            )}

            {/* Date & time */}
            <div className="p-3.5 bg-stone-50 border border-stone-200 rounded-2xl">
              <div className="flex items-center justify-between gap-2 mb-2">
                <div className="flex items-center gap-2 text-xs font-bold text-stone-800">
                  <Calendar className="w-4 h-4 text-amber-800" />
                  {t("reservationDetail.dateTimeSlot")}
                </div>

                {/* Top-right slot: Full Day badge takes priority, else Transform button */}
                {isFullDay ? (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-100 text-amber-900 border border-amber-300 font-bold text-[10px] whitespace-nowrap">
                    <Sun className="w-3 h-3" />
                    {t("common.fullDay")}
                  </span>
                ) : (
                  isAdminViewer &&
                  !isPast &&
                  !isCancelled && (
                    <button
                      type="button"
                      onClick={() => setFullDayConfirmOpen(true)}
                      title={t("reservationDetail.transformToFullDay")}
                      className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-800 bg-amber-100 hover:bg-amber-200 border border-amber-300 rounded-md px-2 py-0.5 transition cursor-pointer whitespace-nowrap"
                    >
                      <Sun className="w-3 h-3" />
                      <span className="hidden sm:inline">
                        {t("reservationDetail.transformToFullDay")}
                      </span>
                    </button>
                  )
                )}
              </div>

              <div className="font-bold text-stone-900 text-base">
                {dateStr}
              </div>
              <div className="text-sm text-stone-700 font-medium flex items-center gap-2 flex-wrap mt-1">
                <span>{timeStr}</span>
                <span className="text-stone-400">•</span>
                <span className="text-stone-500 text-xs">
                  {durationHours} {t("reservationDetail.hour")}
                  {Number(durationHours) > 1 ? "s" : ""}
                </span>
              </div>
            </div>

            {/* Full-day transform confirm — shown right below the trigger */}
            {fullDayConfirmOpen && (
              <div className="bg-amber-50 border border-amber-300 rounded-2xl p-4 space-y-3 animate-in fade-in slide-in-from-top-2 duration-150">
                <div className="flex items-start gap-2">
                  <Sun className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
                  <p className="text-xs text-amber-900 leading-relaxed">
                    {t("reservationDetail.transformToFullDayDesc")}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setFullDayConfirmOpen(false)}
                    disabled={isTransformingFullDay}
                    className="flex-1 h-10 bg-white border border-stone-300 text-stone-700 text-sm font-bold rounded-xl cursor-pointer disabled:opacity-50"
                  >
                    {t("common.cancel")}
                  </button>
                  <button
                    type="button"
                    onClick={handleAdminTransformFullDay}
                    disabled={isTransformingFullDay}
                    className="flex-1 h-10 bg-amber-600 hover:bg-amber-700 text-white text-sm font-bold rounded-xl flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                  >
                    {isTransformingFullDay ? (
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <Sun className="w-4 h-4" />
                    )}
                    {t("reservationDetail.transformToFullDay")}
                  </button>
                </div>
              </div>
            )}
            {/* Instrument (collapsible) */}
            <div className="bg-stone-50 border border-stone-200 rounded-2xl overflow-hidden">
              <button
                type="button"
                onClick={() => setShowInstrumentDetails(!showInstrumentDetails)}
                className="w-full p-3.5 flex items-center justify-between gap-2 cursor-pointer"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-9 h-9 rounded-xl bg-amber-100/70 border border-amber-200 text-amber-800 flex items-center justify-center shrink-0 overflow-hidden">
                    {reservation.instrument_photo_url ||
                    reservation.photoUrl ? (
                      <img
                        src={
                          reservation.instrument_photo_url ||
                          reservation.photoUrl
                        }
                        alt=""
                        referrerPolicy="no-referrer"
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <Music2 className="w-4 h-4" />
                    )}
                  </div>
                  <div className="min-w-0 text-left">
                    <div className="text-[10px] uppercase font-bold text-stone-500">
                      {t("reservationDetail.instrument")}
                    </div>
                    <div className="font-bold text-stone-900 text-sm truncate">
                      {reservation.instrument_name ||
                        t("reservationDetail.instrument")}
                    </div>
                  </div>
                </div>
                <ChevronRight
                  className={`w-4 h-4 text-stone-400 shrink-0 transition-transform ${
                    showInstrumentDetails ? "rotate-90" : ""
                  }`}
                />
              </button>

              {showInstrumentDetails && (
                <div className="px-3.5 pb-3.5 space-y-1.5 text-xs border-t border-stone-200 pt-3">
                  <div className="flex justify-between">
                    <span className="text-stone-500">
                      {t("reservationDetail.type")}
                    </span>
                    <span className="font-semibold text-stone-800">
                      {reservation.instrument_type || "General"}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-stone-500">
                      {t("reservationDetail.bookingMode")}
                    </span>
                    <span className="font-semibold text-stone-800 capitalize">
                      {reservation.booking_mode || "Manual"}
                    </span>
                  </div>
                  {reservation.instrument_description && (
                    <p className="text-stone-600 italic pt-1 leading-relaxed">
                      {reservation.instrument_description}
                    </p>
                  )}
                </div>
              )}
            </div>

            {/* Payment — compact single-line layout */}
            <div
              className={`rounded-2xl border px-3.5 py-3 ${
                isOutsideChurch
                  ? "bg-purple-50/60 border-purple-200"
                  : "bg-emerald-50/60 border-emerald-200"
              }`}
            >
              {/* Header row: label + type badge */}
              <div className="flex items-center justify-between gap-2 mb-2">
                <div className="flex items-center gap-2 min-w-0">
                  <DollarSign
                    className={`w-4 h-4 ${isOutsideChurch ? "text-purple-700" : "text-emerald-700"}`}
                  />
                  <span className="text-xs font-bold text-stone-800">
                    {t("reservationDetail.usageAndFee")}
                  </span>
                </div>
                <span
                  className={`px-2 py-0.5 rounded-md text-[10px] font-bold whitespace-nowrap ${
                    isOutsideChurch
                      ? "bg-purple-100 text-purple-900 border border-purple-200"
                      : "bg-emerald-100 text-emerald-900 border border-emerald-200"
                  }`}
                >
                  {isOutsideChurch
                    ? t("reservationDetail.outsideChurch")
                    : t("reservationDetail.inChurchFree")}
                </span>
              </div>

              {/* In-church: single line */}
              {!isOutsideChurch ? (
                <div className="flex items-center gap-1.5 text-[11px] text-emerald-800">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-700 shrink-0" />
                  {t("reservationDetail.noFeeInChurch")}
                </div>
              ) : (
                /* Outside-church: fee amount + action on one row */
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <div className="text-[10px] text-purple-700 font-semibold leading-tight">
                      {t("reservationDetail.requiredOutsideFee")}
                    </div>
                    <div className="text-base font-bold text-purple-950 leading-tight">
                      {t("reservationDetail.egp")}{" "}
                      {reservation.fee_snapshot ||
                        reservation.outside_fee_per_day ||
                        0}
                    </div>
                  </div>

                  {!isAdminViewer &&
                    isApprovedOutsideChurch &&
                    paymentSettings?.instapayLink && (
                      <a
                        href={paymentSettings.instapayLink}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="shrink-0 inline-flex items-center gap-1.5 h-9 px-3 bg-purple-700 hover:bg-purple-800 text-white text-xs font-bold rounded-lg transition cursor-pointer"
                      >
                        {t("reservationDetail.openInstapay")}
                        <ExternalLink className="w-3.5 h-3.5 shrink-0" />
                      </a>
                    )}
                </div>
              )}

              {/* Admin hint (only for outside-church admins) */}
              {isOutsideChurch && isAdminViewer && (
                <div className="flex items-center gap-1.5 text-[10px] text-stone-500 mt-1.5">
                  <Info className="w-3 h-3 shrink-0" />
                  {t("reservationDetail.memberPaysViaInstapay")}
                </div>
              )}
            </div>

            {/* Payment screenshot — compact */}
            {isOutsideChurch && (isAdminViewer || isApprovedOutsideChurch) && (
              <div className="rounded-2xl border border-purple-200 bg-purple-50/40 px-3.5 py-3 space-y-2.5">
                {/* Header row: title + status badge + (member) change/delete icon buttons */}
                <div className="flex items-center gap-2">
                  <ImageIcon className="w-4 h-4 text-purple-700 shrink-0" />
                  <span className="text-xs font-bold text-stone-800 flex-1 min-w-0 truncate">
                    {t("reservationDetail.paymentScreenshot") ||
                      "Payment Screenshot"}
                  </span>

                  <span
                    className={`px-2 py-0.5 rounded-md text-[10px] font-bold whitespace-nowrap shrink-0 ${
                      isPendingOnly
                        ? "bg-sky-100 text-sky-900 border border-sky-200"
                        : reservation.payment_screenshot_url
                          ? "bg-emerald-100 text-emerald-900 border border-emerald-200"
                          : "bg-amber-100 text-amber-900 border border-amber-200"
                    }`}
                  >
                    {isPendingOnly
                      ? t("reservationDetail.pendingSave") || "Pending Save"
                      : reservation.payment_screenshot_url
                        ? t("reservationDetail.uploaded") || "Uploaded"
                        : t("reservationDetail.pendingUpload") ||
                          "Pending Upload"}
                  </span>

                  {/* Member actions — small icon buttons in the header row */}
                  {!isAdminViewer && hasAnyScreenshot && (
                    <>
                      <label
                        htmlFor="payment-screenshot-input"
                        className="w-7 h-7 flex items-center justify-center rounded-md bg-white border border-stone-300 text-stone-600 hover:bg-stone-50 cursor-pointer shrink-0"
                        title={t("reservationDetail.replace") || "Change"}
                      >
                        {uploadingScreenshot ? (
                          <div className="w-3 h-3 border-2 border-stone-400 border-t-transparent rounded-full animate-spin" />
                        ) : (
                          <Pencil className="w-3.5 h-3.5" />
                        )}
                      </label>
                      <button
                        type="button"
                        onClick={() =>
                          isPendingOnly
                            ? setPendingScreenshot(null)
                            : setDeleteScreenshotConfirmOpen(true)
                        }
                        disabled={uploadingScreenshot || isDeletingScreenshot}
                        className="w-7 h-7 flex items-center justify-center rounded-md bg-red-50 border border-red-200 text-red-700 hover:bg-red-100 disabled:opacity-50 cursor-pointer shrink-0"
                        title={
                          t("reservationDetail.deleteScreenshot") || "Delete"
                        }
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </>
                  )}
                </div>

                {/* Body */}
                {hasAnyScreenshot ? (
                  <div className="space-y-1.5">
                    <a
                      href={previewScreenshotUrl!}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={`block relative rounded-lg overflow-hidden border bg-white ${
                        isPendingOnly ? "border-sky-300" : "border-purple-200"
                      }`}
                    >
                      <img
                        src={previewScreenshotUrl!}
                        alt=""
                        referrerPolicy="no-referrer"
                        className="w-full max-h-48 object-contain bg-stone-50"
                      />
                    </a>

                    {isPendingOnly && (
                      <div className="flex items-center gap-1.5 text-[10px] text-sky-800">
                        <Clock className="w-3 h-3 shrink-0" />
                        {t("reservationDetail.pendingSaveHint") ||
                          "Not saved yet — press Save below."}
                      </div>
                    )}
                  </div>
                ) : isAdminViewer ? (
                  <div className="text-[11px] text-stone-500 italic text-center py-1">
                    {t("reservationDetail.memberUploadsScreenshot") ||
                      "Member uploads the payment screenshot"}
                  </div>
                ) : (
                  <label
                    htmlFor="payment-screenshot-input"
                    onDragEnter={handleDrag}
                    onDragLeave={handleDrag}
                    onDragOver={handleDrag}
                    onDrop={handleDrop}
                    className={`flex items-center gap-2.5 rounded-lg border-2 border-dashed px-3 py-2.5 cursor-pointer transition ${
                      dragActive
                        ? "border-purple-600 bg-purple-100/60"
                        : "border-purple-300 bg-white hover:border-purple-500"
                    } ${uploadingScreenshot ? "opacity-60 pointer-events-none" : ""}`}
                  >
                    {uploadingScreenshot ? (
                      <div className="w-5 h-5 border-2 border-purple-700 border-t-transparent rounded-full animate-spin shrink-0" />
                    ) : (
                      <Upload className="w-5 h-5 text-purple-700 shrink-0" />
                    )}
                    <div className="min-w-0">
                      <div className="text-[11px] font-bold text-stone-800 leading-tight">
                        {t("reservationDetail.tapToUpload") ||
                          "Tap to upload payment screenshot"}
                      </div>
                      <div className="text-[10px] text-stone-500 leading-tight">
                        {t("reservationDetail.uploadHint") ||
                          "PNG, JPG — Max 5MB"}
                      </div>
                    </div>
                  </label>
                )}

                {screenshotSuccess && (
                  <div className="flex items-center gap-1.5 text-[10px] text-emerald-800">
                    <CheckCircle2 className="w-3 h-3 shrink-0" />
                    {t("reservationDetail.screenshotUploaded") ||
                      "Uploaded successfully."}
                  </div>
                )}

                {deleteScreenshotConfirmOpen && (
                  <div className="bg-red-50 border border-red-200 rounded-lg p-2.5 space-y-2">
                    <p className="text-[11px] font-bold text-red-950">
                      {t("reservationDetail.confirmDeleteScreenshot") ||
                        "Delete this payment screenshot?"}
                    </p>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setDeleteScreenshotConfirmOpen(false)}
                        disabled={isDeletingScreenshot}
                        className="flex-1 h-8 bg-white border border-stone-300 text-stone-700 text-[11px] font-bold rounded-md cursor-pointer disabled:opacity-50"
                      >
                        {t("common.cancel") || "Cancel"}
                      </button>
                      <button
                        type="button"
                        onClick={handleDeleteScreenshot}
                        disabled={isDeletingScreenshot}
                        className="flex-1 h-8 bg-red-600 hover:bg-red-700 text-white text-[11px] font-bold rounded-md flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                      >
                        {isDeletingScreenshot ? (
                          <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        ) : (
                          t("reservationDetail.yesDelete") || "Yes, delete"
                        )}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            <input
              id="payment-screenshot-input"
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) processScreenshotFile(file);
                if (fileInputRef.current) fileInputRef.current.value = "";
              }}
            />

            {/* Conversation preview */}
            <div className="p-4 bg-stone-50 border border-stone-200 rounded-2xl space-y-3">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <MessageSquare className="w-4 h-4 text-amber-800 shrink-0" />
                  <span className="text-xs font-bold text-stone-900">
                    {t("reservationDetail.conversationNotes")}
                  </span>
                  <span className="text-[11px] bg-stone-200 text-stone-700 font-semibold px-2 py-0.5 rounded-full">
                    {adminMessages.length}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={focusChat}
                  className="text-xs font-bold text-amber-900 flex items-center gap-1 cursor-pointer shrink-0"
                >
                  <span className="hidden sm:inline">
                    {t("reservationDetail.openFullChat")}
                  </span>
                  <ArrowIcon className="w-3.5 h-3.5" />
                </button>
              </div>

              {adminMessages.length === 0 ? (
                <button
                  type="button"
                  onClick={() => {
                    setActiveTab("chat");
                    setTimeout(() => chatInputRef.current?.focus(), 80);
                  }}
                  className="w-full p-3 bg-white rounded-xl border border-stone-200 text-xs text-stone-500 italic cursor-pointer"
                >
                  {t("reservationDetail.noMessages")}
                </button>
              ) : (
                (() => {
                  const lastMsg = adminMessages[adminMessages.length - 1];
                  const isUser = lastMsg.sender_role === "user";
                  return (
                    <button
                      type="button"
                      onClick={focusChat}
                      className="w-full text-left bg-white p-3 rounded-xl border border-stone-200 text-xs space-y-1 cursor-pointer"
                    >
                      <div className="flex items-center justify-between gap-2 text-[11px]">
                        <span className="font-bold flex items-center gap-1.5">
                          {isUser ? (
                            <User className="w-3 h-3 text-stone-500" />
                          ) : (
                            <Shield className="w-3 h-3 text-amber-800" />
                          )}
                          {lastMsg.sender_name ||
                            (isUser
                              ? t("reservationDetail.member")
                              : t("reservationDetail.churchAdministration"))}
                        </span>
                        <span className="text-[10px] text-stone-400">
                          {formatMessageTime(
                            lastMsg.created_at || lastMsg.createdAt,
                          )}
                        </span>
                      </div>
                      <p className="text-stone-700 line-clamp-2 italic">
                        "{lastMsg.content}"
                      </p>
                    </button>
                  );
                })()
              )}
            </div>

            {/* Series breakdown */}
            {reservation.series_id && (
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2 text-xs font-bold text-stone-800">
                  <div className="flex items-center gap-2">
                    <Repeat className="w-4 h-4 text-amber-800" />
                    {t("reservationDetail.partOfRecurringSeries")}
                  </div>
                  <span className="text-[11px] text-stone-500 font-normal">
                    {t("reservationDetail.occurrencesTotal", {
                      count: seriesOccurrences.length,
                    })}
                  </span>
                </div>

                <div className="border border-stone-200 rounded-2xl divide-y divide-stone-100 max-h-48 overflow-y-auto bg-stone-50/50">
                  {seriesOccurrences.map((occ, idx) => {
                    const occStart = new Date(occ.start_time || occ.startTime);
                    const isCurrent = occ.id === reservation.id;
                    return (
                      <div
                        key={occ.id}
                        onClick={() =>
                          !isCurrent && onNavigateToReservation?.(occ.id)
                        }
                        className={`p-3 text-xs flex items-center justify-between gap-2 ${
                          isCurrent
                            ? "bg-amber-100/50 font-bold border-l-4 border-l-amber-800"
                            : "hover:bg-stone-100 cursor-pointer"
                        }`}
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <span className="w-5 h-5 rounded-md bg-stone-200 text-stone-700 flex items-center justify-center text-[10px] font-bold shrink-0">
                            {idx + 1}
                          </span>
                          <span className="text-stone-900 font-semibold">
                            {getCairoDateString(occStart)}
                          </span>
                          <span className="text-stone-500 text-[11px]">
                            {t("reservationDetail.at")}{" "}
                            {getCairoTimeString(occStart)}
                          </span>
                        </div>
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase whitespace-nowrap ${getStatusColor(occ.status)}`}
                        >
                          {statusLabel(occ.status)}
                        </span>
                      </div>
                    );
                  })}
                </div>
                {!isPast && !isCancelled && (
                  <button
                    type="button"
                    onClick={() => setCancelPrompt("series")}
                    className="inline-flex items-center gap-1.5 text-[11px] text-red-700 font-semibold cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    {t("reservationDetail.cancelEntireSeries")}
                  </button>
                )}
              </div>
            )}
          </div>
        ) : (
          /* Chat */
          <div className="flex-1 min-h-0 flex flex-col bg-stone-50/50">
            <div className="bg-white px-3.5 py-2.5 border-b border-stone-200 shrink-0">
              <div className="font-bold text-xs text-stone-900 truncate">
                {reservation.service_name || t("reservationDetail.reservation")}{" "}
                • {reservation.instrument_name}
              </div>
              <div className="text-[11px] text-stone-500 truncate">
                {dateStr} ({timeStr})
              </div>
            </div>

            {reservation.rejection_reason && (
              <div className="mx-3 mt-3 p-3 rounded-xl bg-red-50 border border-red-200 flex items-start gap-2.5 shrink-0">
                <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                <p className="text-red-900 leading-relaxed text-xs break-words">
                  {reservation.rejection_reason}
                </p>
              </div>
            )}

            <div className="flex-1 min-h-0 overflow-y-auto p-3 sm:p-5 space-y-3">
              {adminMessages.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center p-6 space-y-2">
                  <MessageSquare className="w-8 h-8 text-amber-800" />
                  <p className="text-[11px] text-stone-500 max-w-xs">
                    {isAdminViewer
                      ? t("reservationDetail.noMessagesAdmin")
                      : t("reservationDetail.noMessagesUser")}
                  </p>
                </div>
              ) : (
                <>
                  {adminMessages.map((msg) => {
                    const isUserMsg = msg.sender_role === "user";
                    const isMe = isAdminViewer ? !isUserMsg : isUserMsg;
                    return (
                      <div
                        key={msg.id}
                        className={`flex flex-col ${isMe ? "items-end" : "items-start"}`}
                      >
                        <div
                          className={`rounded-2xl p-3 text-xs space-y-1 max-w-[85%] ${
                            isMe
                              ? "bg-amber-900 text-white rounded-tr-sm"
                              : "bg-white border border-stone-200 text-stone-800 rounded-tl-sm"
                          }`}
                        >
                          <div className="flex items-center justify-between gap-3 text-[10px]">
                            <span
                              className={`font-bold ${isMe ? "text-amber-200" : "text-stone-700"}`}
                            >
                              {isMe
                                ? t("reservationDetail.you")
                                : msg.sender_name ||
                                  (isUserMsg
                                    ? t("reservationDetail.member")
                                    : t(
                                        "reservationDetail.churchAdministration",
                                      ))}
                            </span>
                            <span
                              className={
                                isMe ? "text-amber-300/80" : "text-stone-400"
                              }
                            >
                              {formatMessageTime(
                                msg.created_at || msg.createdAt,
                              )}
                            </span>
                          </div>
                          <p className="leading-relaxed whitespace-pre-wrap break-words">
                            {msg.content}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                  <div ref={messagesEndRef} />
                </>
              )}
            </div>

            <form
              onSubmit={handleSendMessage}
              className="p-3 bg-white border-t border-stone-200 shrink-0 space-y-2"
            >
              <textarea
                ref={chatInputRef}
                rows={2}
                value={replyContent}
                onChange={(e) => setReplyContent(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleSendMessage();
                  }
                }}
                placeholder={
                  isAdminViewer
                    ? t("reservationDetail.adminPlaceholder")
                    : t("reservationDetail.userPlaceholder")
                }
                className="w-full px-3.5 py-2.5 text-sm bg-stone-50 border border-stone-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-700/30 resize-none"
                disabled={sendingReply}
              />
              {replyError && (
                <p className="text-[11px] text-red-600">{replyError}</p>
              )}
              <button
                type="submit"
                disabled={!replyContent.trim() || sendingReply}
                className="w-full h-10 bg-amber-800 hover:bg-amber-900 disabled:opacity-40 text-white text-sm font-bold rounded-lg flex items-center justify-center gap-2 cursor-pointer"
              >
                {sendingReply ? (
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <Send className="w-4 h-4" />
                )}
                {t("reservationDetail.sendMessageButton")}
              </button>
            </form>
          </div>
        )}

        {activeTab === "details" && showFooter && (
          <div className="shrink-0 flex items-center gap-2 sm:gap-3 px-4 sm:px-7 pt-3 pb-[max(12px,env(safe-area-inset-bottom))] border-t border-stone-200 bg-white">
            {/* Secondary: Cancel / Reject — neutral stone */}
            {showReject && (
              <button
                type="button"
                onClick={() => setIsRejectOpen(true)}
                disabled={isApproving || isRejecting}
                className="py-3 px-4 sm:px-5 bg-stone-100 hover:bg-stone-200 active:bg-stone-300 text-stone-700 text-sm font-bold rounded-2xl transition cursor-pointer touch-manipulation disabled:opacity-50 flex items-center justify-center gap-2 shrink-0"
              >
                <XCircle className="w-4 h-4 shrink-0" />
                <span className="hidden sm:inline">
                  {t("reservationDetail.reject")}
                </span>
              </button>
            )}

            {showCancel && (
              <button
                type="button"
                onClick={() => setCancelPrompt("single")}
                disabled={isCancelling}
                className="py-3 px-4 sm:px-5 bg-stone-100 hover:bg-stone-200 active:bg-stone-300 text-stone-700 text-sm font-bold rounded-2xl transition cursor-pointer touch-manipulation disabled:opacity-50 flex items-center justify-center gap-2 shrink-0"
              >
                <Trash2 className="w-4 h-4 shrink-0" />
                <span className="hidden sm:inline">
                  {t("reservationDetail.cancelReservation")}
                </span>
              </button>
            )}

            {/* Primary action — amber-800, matches Edit modal's submit button */}
            {showApprove && (
              <button
                type="button"
                onClick={() => handleAdminApprove("single")}
                disabled={isApproving || isRejecting}
                className={`flex-1 py-3 px-4 sm:px-6 rounded-2xl text-sm font-bold text-white transition flex items-center justify-center gap-2 cursor-pointer touch-manipulation ${
                  isApproving || isRejecting
                    ? "bg-stone-300 cursor-not-allowed text-stone-500 shadow-none"
                    : "bg-emerald-700 hover:bg-emerald-800 active:scale-[0.99] shadow-md"
                }`}
              >
                {isApproving ? (
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin shrink-0" />
                ) : (
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                )}
                <span className="truncate">
                  {reservation.series_id
                    ? t("reservationDetail.approveEntireSeries", {
                        count: seriesOccurrences.length,
                      })
                    : t("reservationDetail.approve")}
                </span>
              </button>
            )}

            {showSavePayment && (
              <button
                type="button"
                onClick={handleConfirmPaid}
                disabled={
                  isConfirmingPaid ||
                  isDeletingScreenshot ||
                  (!reservation.payment_screenshot_url && !pendingScreenshot)
                }
                className={`flex-1 py-3 px-4 sm:px-6 rounded-2xl text-sm font-bold text-white transition flex items-center justify-center gap-2 cursor-pointer touch-manipulation ${
                  isConfirmingPaid ||
                  isDeletingScreenshot ||
                  (!reservation.payment_screenshot_url && !pendingScreenshot)
                    ? "bg-stone-300 cursor-not-allowed text-stone-500 shadow-none"
                    : paidConfirmedThisSession
                      ? "bg-emerald-50 text-emerald-800 border border-emerald-200 hover:bg-emerald-100 shadow-none"
                      : "bg-amber-800 hover:bg-amber-900 active:scale-[0.99] shadow-md"
                }`}
              >
                {isConfirmingPaid ? (
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin shrink-0" />
                ) : paidConfirmedThisSession ? (
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                ) : (
                  <Check className="w-4 h-4 shrink-0" />
                )}
                <span className="truncate">
                  {paidConfirmedThisSession
                    ? t("reservationDetail.paidSaved") || "Saved"
                    : t("common.save") || "Save"}
                </span>
              </button>
            )}

            {showNoShowToggle && (
              <button
                type="button"
                onClick={
                  canUnmarkNoShow ? handleUnmarkNoShow : handleMarkNoShow
                }
                disabled={isNoShowProcessing}
                className={`flex-1 py-3 px-4 sm:px-6 rounded-2xl text-sm font-bold transition flex items-center justify-center gap-2 cursor-pointer touch-manipulation ${
                  isNoShowProcessing
                    ? "bg-stone-300 cursor-not-allowed text-stone-500 shadow-none"
                    : canUnmarkNoShow
                      ? "bg-stone-100 hover:bg-stone-200 active:bg-stone-300 text-stone-700"
                      : "bg-rose-600 hover:bg-rose-700 active:scale-[0.99] text-white shadow-md"
                }`}
              >
                {isNoShowProcessing ? (
                  <div className="w-4 h-4 border-2 border-stone-500 border-t-transparent rounded-full animate-spin shrink-0" />
                ) : (
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                )}
                <span className="truncate">
                  {canUnmarkNoShow
                    ? t("common.unmarkNoShow")
                    : t("common.markNoShow")}
                </span>
              </button>
            )}
          </div>
        )}
      </div>

      {/* More actions sheet */}
      {showMoreMenu && (
        <div
          className="absolute inset-0 z-30 bg-stone-900/50 flex items-end"
          onClick={() => setShowMoreMenu(false)}
        >
          <div
            className="w-full bg-white rounded-t-3xl p-4 pb-[max(16px,env(safe-area-inset-bottom))] space-y-1"
            onClick={(e) => e.stopPropagation()}
            dir={isRTL ? "rtl" : "ltr"}
          >
            <div className="w-10 h-1 rounded-full bg-stone-300 mx-auto mb-3" />

            {isAdminViewer && !isFullDay && !isPast && !isCancelled && (
              <button
                type="button"
                onClick={() => {
                  setShowMoreMenu(false);
                  setFullDayConfirmOpen(true);
                }}
                className="w-full h-12 px-3 rounded-xl hover:bg-stone-100 flex items-center gap-3 cursor-pointer"
              >
                <Sun className="w-4 h-4 text-amber-700" />
                <span className="text-sm font-semibold text-stone-900">
                  {t("reservationDetail.transformToFullDay")}
                </span>
              </button>
            )}

            {reservation.series_id && !isPast && !isCancelled && (
              <button
                type="button"
                onClick={() => {
                  setShowMoreMenu(false);
                  setCancelPrompt("series");
                }}
                className="w-full h-12 px-3 rounded-xl hover:bg-red-50 flex items-center gap-3 cursor-pointer"
              >
                <Repeat className="w-4 h-4 text-red-700" />
                <span className="text-sm font-semibold text-red-700">
                  {t("reservationDetail.cancelEntireSeries")}
                </span>
              </button>
            )}
          </div>
        </div>
      )}

      {/* Cancel Confirmation — centered modal */}
      {cancelPrompt && (
        <div
          className="absolute inset-0 z-40 bg-stone-900/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-150"
          onClick={() => !isCancelling && setCancelPrompt(null)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-sm bg-white rounded-2xl shadow-2xl border border-stone-200 overflow-hidden animate-in zoom-in-95 duration-150"
            dir={isRTL ? "rtl" : "ltr"}
          >
            {/* Header */}
            <div className="px-4 pt-4 pb-3 flex items-start gap-3">
              <div className="w-10 h-10 rounded-full bg-red-100 text-red-700 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="text-sm font-bold text-stone-900 leading-tight">
                  {cancelPrompt === "series"
                    ? t("reservationDetail.confirmCancelSeries")
                    : t("reservationDetail.confirmCancelSingle")}
                </h3>
                <p className="text-xs text-stone-600 leading-relaxed mt-1">
                  {cancelPrompt === "series"
                    ? t("reservationDetail.cancelSeriesDesc")
                    : t("reservationDetail.cancelSingleDesc")}
                </p>
              </div>
            </div>

            {/* Admin reason picker */}
            {isAdminViewer && (
              <div className="px-4 pb-3 space-y-2">
                <label className="block text-[11px] font-bold uppercase tracking-wide text-stone-500">
                  {t("reservationDetail.reasonOptional")}
                </label>
                <select
                  value={cancelReasonPreset}
                  onChange={(e) => setCancelReasonPreset(e.target.value)}
                  className="w-full h-10 px-3 bg-stone-50 border border-stone-300 rounded-xl text-sm text-stone-900 focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500"
                >
                  {CANCELLATION_REASON_PRESETS.map((preset) => (
                    <option key={preset} value={preset}>
                      {preset}
                    </option>
                  ))}
                </select>
                {cancelReasonPreset === "Other" && (
                  <textarea
                    rows={2}
                    value={cancelReasonCustom}
                    onChange={(e) => setCancelReasonCustom(e.target.value)}
                    placeholder={t("reservationDetail.describeReason")}
                    className="w-full px-3 py-2 bg-stone-50 border border-stone-300 rounded-xl text-sm resize-none focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500"
                  />
                )}
              </div>
            )}

            {/* Actions */}
            <div className="px-4 py-3 bg-stone-50 border-t border-stone-200 flex items-center gap-2">
              <button
                type="button"
                onClick={() => setCancelPrompt(null)}
                disabled={isCancelling}
                className="flex-1 h-11 bg-white hover:bg-stone-100 active:bg-stone-200 text-stone-700 border border-stone-300 text-sm font-bold rounded-xl transition cursor-pointer disabled:opacity-50 touch-manipulation"
              >
                {t("reservationDetail.keepReservation")}
              </button>
              <button
                type="button"
                disabled={isCancelling}
                onClick={() => handleCancelExecution(cancelPrompt)}
                className="flex-1 h-11 bg-red-600 hover:bg-red-700 active:bg-red-800 text-white text-sm font-bold rounded-xl transition flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50 shadow-xs touch-manipulation"
              >
                {isCancelling ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin shrink-0" />
                    <span>{t("reservationDetail.cancelling")}</span>
                  </>
                ) : (
                  t("reservationDetail.yesCancelNow")
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {showPolicyExplainer && (
        <PolicyExplainerModal
          isOpen={showPolicyExplainer}
          onClose={() => setShowPolicyExplainer(false)}
        />
      )}
    </div>
  );
};
