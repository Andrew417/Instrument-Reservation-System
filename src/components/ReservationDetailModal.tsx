import React, { useState, useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { useAuth } from "../contexts/AuthContext.tsx";
import { Instrument } from "./AvailabilityCalendar.tsx";
import { REJECTION_REASON_PRESETS } from "../constants/reservationPresets.ts";
import { PolicyExplainerModal } from "./PolicyExplainerModal.tsx";
import {
  formatDisplayDate,
  formatHhmmTo12Hour,
  getLocalDateString,
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
  Sparkles,
  ArrowRight,
  ArrowLeft,
  Info,
  CalendarRange,
  Layers,
  User,
  Phone,
  FileText,
  Trash2,
  Edit,
  ChevronRight,
  CornerDownRight,
  Upload,
  Copy,
  ExternalLink,
  MessageSquare,
  Image as ImageIcon,
  Check,
  Send,
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
    if (initialTab) {
      setActiveTab(initialTab);
    }
  }, [initialTab]);

  const [reservation, setReservation] = useState<any | null>(null);
  const [showPolicyExplainer, setShowPolicyExplainer] =
    useState<boolean>(false);
  const [seriesOccurrences, setSeriesOccurrences] = useState<any[]>([]);
  const [adminMessages, setAdminMessages] = useState<any[]>([]);
  const [paymentSettings, setPaymentSettings] = useState<{
    instapayNumber: string;
    instapayLink: string;
  } | null>(null);

  const [loading, setLoading] = useState<boolean>(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [actionNotice, setActionNotice] = useState<{
    message: string;
    type: "success" | "error";
  } | null>(null);

  // Admin inline approval & rejection state
  const [isApproving, setIsApproving] = useState<boolean>(false);
  const [approvingMode, setApprovingMode] = useState<
    "single" | "series" | null
  >(null);
  const [isRejectOpen, setIsRejectOpen] = useState<boolean>(false);
  const [rejectMode, setRejectMode] = useState<"single" | "series">("single");
  const [rejectReason, setRejectReason] = useState<string>("");
  const [rejectError, setRejectError] = useState<string | null>(null);
  const [isRejecting, setIsRejecting] = useState<boolean>(false);
  const [isTransformingFullDay, setIsTransformingFullDay] =
    useState<boolean>(false);
  const [fullDayConfirmOpen, setFullDayConfirmOpen] = useState<boolean>(false);

  // Instapay copy feedback
  const [copiedNumber, setCopiedNumber] = useState<boolean>(false);

  // No-Show action state
  const [isNoShowProcessing, setIsNoShowProcessing] = useState<boolean>(false);

  // Payment Screenshot Upload State
  const [uploadingScreenshot, setUploadingScreenshot] =
    useState<boolean>(false);
  const [screenshotSuccess, setScreenshotSuccess] = useState<boolean>(false);
  const [dragActive, setDragActive] = useState<boolean>(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Cancellation State
  const [isCancelling, setIsCancelling] = useState<boolean>(false);
  const [cancelPrompt, setCancelPrompt] = useState<"single" | "series" | null>(
    null,
  );
  const [cancelReasonPreset, setCancelReasonPreset] = useState<string>(
    "Instrument in maintenance",
  );
  const [cancelReasonCustom, setCancelReasonCustom] = useState<string>("");

  const CANCELLATION_REASON_PRESETS = [
    "Instrument in maintenance",
    "Schedule conflict",
    "Duplicate reservation",
    "Policy violation",
    "Urgent event — no other instrument available",
    "Other",
  ];

  // Chat / Message reply state
  const [replyContent, setReplyContent] = useState<string>("");
  const [sendingReply, setSendingReply] = useState<boolean>(false);
  const [replyError, setReplyError] = useState<string | null>(null);
  const chatInputRef = useRef<HTMLTextAreaElement>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (activeTab === "chat") {
      setTimeout(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
      }, 120);
    }
  }, [activeTab, adminMessages.length]);

  // Send message or reply in conversation
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

  // Fetch full details of the reservation
  const loadReservationData = async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      // 1. Fetch Reservation Detail
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

      // 2. Fetch Messages scoped to this reservation
      const msgRes = await fetch(`/api/reservations/${reservationId}/messages`);
      const msgData = await msgRes.json();
      if (msgData.success && Array.isArray(msgData.messages)) {
        setAdminMessages(msgData.messages);
      }

      // 3. Fetch Payment Settings (Instapay) if outside church
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

      // 4. If part of a series, fetch all series occurrences
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

  const handleCopyInstapay = () => {
    if (!paymentSettings?.instapayNumber) return;
    navigator.clipboard.writeText(paymentSettings.instapayNumber);
    setCopiedNumber(true);
    setTimeout(() => setCopiedNumber(false), 2500);
  };

  // Upload Payment Screenshot handler (File -> Base64 data URL -> API)
  const processScreenshotFile = async (file: File) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setErrorMsg(t("reservationDetail.invalidImageType"));
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setErrorMsg(t("reservationDetail.imageTooLarge"));
      return;
    }

    setUploadingScreenshot(true);
    setErrorMsg(null);
    setScreenshotSuccess(false);

    try {
      const reader = new FileReader();
      reader.onload = async (e) => {
        const base64Url = e.target?.result as string;
        if (!base64Url) {
          setErrorMsg(t("reservationDetail.processImageError"));
          setUploadingScreenshot(false);
          return;
        }

        const res = await fetch(
          `/api/reservations/${reservationId}/payment-screenshot`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${sessionToken}`,
            },
            body: JSON.stringify({
              screenshotUrl: base64Url,
            }),
          },
        );

        const data = await res.json();
        if (!res.ok || !data.success) {
          setErrorMsg(data.error || t("reservationDetail.uploadError"));
          setUploadingScreenshot(false);
          return;
        }

        setReservation((prev: any) => ({
          ...prev,
          payment_screenshot_url: base64Url,
        }));
        setUploadingScreenshot(false);
        setScreenshotSuccess(true);
        setTimeout(() => setScreenshotSuccess(false), 4000);
      };

      reader.readAsDataURL(file);
    } catch (err: any) {
      setErrorMsg(err.message || t("reservationDetail.readFileError"));
      setUploadingScreenshot(false);
    }
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processScreenshotFile(e.dataTransfer.files[0]);
    }
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
    setApprovingMode(mode);
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
        body: JSON.stringify({
          adminId: profile?.id,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        setErrorMsg(data.error || t("reservationDetail.approveFailed"));
        setIsApproving(false);
        setApprovingMode(null);
        return;
      }

      // Update in-place
      setReservation((prev: any) => ({
        ...prev,
        status: "approved",
      }));

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
      setApprovingMode(null);
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

      // Update in-place
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

  // ---------- Loading & Not-Found Views (full-screen on mobile) ----------
  if (loading) {
    return (
      <div
        id="reservation-detail-modal-backdrop"
        className={`fixed inset-0 ${zIndexClass} bg-stone-900/60 backdrop-blur-xs flex items-center justify-center p-4 pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]`}
      >
        <div className="bg-white rounded-3xl p-8 max-w-md w-full text-center space-y-4 shadow-2xl border border-stone-200">
          <div className="w-10 h-10 border-3 border-amber-800 border-t-transparent rounded-full animate-spin mx-auto" />
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
        id="reservation-detail-modal-backdrop"
        className={`fixed inset-0 ${zIndexClass} bg-stone-900/60 backdrop-blur-xs flex items-center justify-center p-4 pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]`}
      >
        <div className="bg-white rounded-3xl p-6 max-w-md w-full space-y-4 shadow-2xl border border-stone-200">
          <div className="flex items-center gap-3 text-red-700">
            <AlertCircle className="w-6 h-6" />
            <h3 className="font-bold text-sm">
              {t("reservationDetail.notFound")}
            </h3>
          </div>
          <p className="text-xs text-stone-600 leading-relaxed">
            {errorMsg || t("reservationDetail.notFoundDesc")}
          </p>
          <div className="flex items-center gap-2">
            {onBack ? (
              <button
                id="reservation-detail-notfound-back-btn"
                onClick={onBack}
                className="flex-1 py-3 bg-stone-100 hover:bg-stone-200 text-stone-700 rounded-xl text-sm font-bold flex items-center justify-center gap-1.5 cursor-pointer transition touch-manipulation"
              >
                <ArrowIcon className="w-4 h-4" />
                <span>
                  {backButtonTitle ||
                    t("reservationDetail.backToNotifications")}
                </span>
              </button>
            ) : null}
            <button
              onClick={onClose}
              className="flex-1 py-3 bg-stone-900 hover:bg-stone-800 text-white rounded-xl text-sm font-bold cursor-pointer transition touch-manipulation"
            >
              {t("reservationDetail.close")}
            </button>
          </div>
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

  return (
    <div
      id="reservation-detail-modal-backdrop"
      className={`fixed inset-0 ${zIndexClass} bg-stone-900/60 backdrop-blur-xs flex items-stretch sm:items-center justify-center p-0 sm:p-4`}
      dir={isRTL ? "rtl" : "ltr"}
    >
      <div
        id="reservation-detail-modal"
        className="bg-white sm:rounded-3xl sm:border sm:border-stone-200 shadow-2xl w-full sm:max-w-2xl z-10 flex flex-col h-full sm:h-auto sm:max-h-[92vh] overflow-hidden animate-in fade-in zoom-in-95 duration-150 pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]"
      >
        {/* Header */}
        <div className="bg-stone-900 text-white px-4 sm:px-6 py-3 sm:py-4 flex items-center justify-between border-b border-stone-800 shrink-0">
          <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
            {onBack && (
              <button
                type="button"
                id="reservation-detail-back-btn"
                onClick={onBack}
                className="w-11 h-11 -ml-2 rounded-full text-stone-300 hover:text-white hover:bg-stone-700 active:bg-stone-600 flex items-center justify-center transition cursor-pointer shrink-0 touch-manipulation"
                title={
                  backButtonTitle || t("reservationDetail.backToNotifications")
                }
                aria-label={
                  backButtonTitle || t("reservationDetail.backToNotifications")
                }
              >
                <ArrowIcon className="w-5 h-5" />
              </button>
            )}
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-2xl bg-amber-800 text-amber-100 flex items-center justify-center font-bold shadow-xs shrink-0">
              <FileText className="w-4 h-4 sm:w-5 sm:h-5" />
            </div>
            <div className="min-w-0">
              <h2 className="text-sm sm:text-base font-bold text-white leading-tight truncate">
                {t("reservationDetail.title")}
              </h2>
              <p className="text-[11px] text-stone-400 font-mono truncate">
                #{reservation.id.substring(0, 8)} •{" "}
                {reservation.instrument_name || "Instrument"}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-11 h-11 -mr-2 rounded-full text-stone-300 hover:text-white hover:bg-stone-700 active:bg-stone-600 flex items-center justify-center transition cursor-pointer shrink-0 ml-2 touch-manipulation"
            aria-label={t("reservationDetail.close")}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="bg-stone-900 border-b border-stone-800 px-2 sm:px-6 flex items-center justify-between shrink-0 select-none">
          <div className="flex items-center gap-1 sm:gap-2">
            <button
              type="button"
              id="tab-btn-details"
              onClick={() => setActiveTab("details")}
              className={`px-3.5 sm:px-5 py-2.5 text-xs font-bold rounded-t-xl transition cursor-pointer flex items-center gap-1.5 sm:gap-2 border-b-2 touch-manipulation ${
                activeTab === "details"
                  ? "bg-white text-stone-900 border-amber-700 shadow-xs"
                  : "text-stone-400 hover:text-stone-200 border-transparent hover:bg-stone-800/60"
              }`}
            >
              <FileText className="w-3.5 h-3.5" />
              <span>{t("reservationDetail.detailsTab")}</span>
            </button>

            <button
              type="button"
              id="tab-btn-chat"
              onClick={() => {
                setActiveTab("chat");
                setTimeout(() => {
                  messagesEndRef.current?.scrollIntoView({
                    behavior: "smooth",
                  });
                  chatInputRef.current?.focus();
                }, 80);
              }}
              className={`px-3.5 sm:px-5 py-2.5 text-xs font-bold rounded-t-xl transition cursor-pointer flex items-center gap-1.5 sm:gap-2 border-b-2 touch-manipulation ${
                activeTab === "chat"
                  ? "bg-white text-stone-900 border-amber-700 shadow-xs"
                  : "text-stone-400 hover:text-stone-200 border-transparent hover:bg-stone-800/60"
              }`}
            >
              <MessageSquare className="w-3.5 h-3.5" />
              <span>{t("reservationDetail.chatTab")}</span>
              {adminMessages.length > 0 && (
                <span
                  className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
                    activeTab === "chat"
                      ? "bg-amber-100 text-amber-900 border border-amber-300"
                      : "bg-stone-800 text-stone-300 border border-stone-700"
                  }`}
                >
                  {adminMessages.length}
                </span>
              )}
            </button>
          </div>

          <div className="hidden sm:flex items-center gap-2 pb-1">
            {reservation.rejection_reason && activeTab === "details" && (
              <button
                type="button"
                onClick={() => {
                  setActiveTab("chat");
                  setTimeout(() => {
                    messagesEndRef.current?.scrollIntoView({
                      behavior: "smooth",
                    });
                    chatInputRef.current?.focus();
                  }, 80);
                }}
                className="text-[10px] sm:text-[11px] font-semibold text-red-300 hover:text-red-200 bg-red-950/70 border border-red-800 px-2 py-1 rounded-lg flex items-center gap-1 transition cursor-pointer"
                title={t("reservationDetail.viewRejectionAndReply")}
              >
                <AlertCircle className="w-3 h-3 text-red-400" />
                <span>{t("reservationDetail.reply")}</span>
              </button>
            )}

            <span
              className={`inline-flex px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase whitespace-nowrap ${
                isApproved
                  ? "bg-emerald-950/80 text-emerald-300 border border-emerald-800"
                  : isPending
                    ? "bg-amber-950/80 text-amber-300 border border-amber-800"
                    : isExpired
                      ? "bg-stone-800 text-stone-400 border border-stone-700"
                      : "bg-stone-800 text-stone-300 border border-stone-700"
              }`}
            >
              {reservation.status === "approved" &&
                t("reservationDetail.approved")}
              {reservation.status === "pending" &&
                t("reservationDetail.pending")}
              {reservation.status === "rejected" &&
                t("reservationDetail.rejected")}
              {reservation.status === "cancelled" &&
                t("reservationDetail.cancelled")}
              {reservation.status === "ongoing" &&
                t("reservationDetail.ongoing")}
              {reservation.status === "completed" &&
                t("reservationDetail.completed")}
              {reservation.status === "expired" &&
                (t("reservationDetail.expired") || "Expired")}
            </span>
            {isNoShow && (
              <span className="inline-flex px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase bg-rose-950/80 text-rose-300 border border-rose-800 whitespace-nowrap">
                {t("common.noShow")}
              </span>
            )}
          </div>
        </div>

        {/* Scrollable Content */}
        {activeTab === "details" ? (
          <div className="p-4 sm:p-6 overflow-y-auto overscroll-contain space-y-4 sm:space-y-5 flex-1 min-h-0">
            {actionNotice && (
              <div
                id="admin-action-notice"
                className={`p-3.5 rounded-2xl border text-xs font-semibold flex items-center justify-between gap-2 animate-in fade-in ${
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
                  className="text-stone-400 hover:text-stone-600 p-1 cursor-pointer transition shrink-0 touch-manipulation"
                  aria-label={t("reservationDetail.dismiss")}
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            )}

            {errorMsg && (
              <div className="bg-red-50 border border-red-200 rounded-2xl p-4 text-red-900 flex items-start gap-3 animate-in fade-in">
                <AlertCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
                <div className="text-xs space-y-1 min-w-0">
                  <div className="font-bold text-red-950">
                    {t("reservationDetail.notice")}
                  </div>
                  <div className="text-red-800 break-words">{errorMsg}</div>
                </div>
              </div>
            )}

            {/* Inline Reject Panel for Admin */}
            {isAdminViewer && isPending && isRejectOpen && (
              <div
                id="admin-inline-reject-panel"
                className="bg-red-50/70 border-2 border-red-300 rounded-2xl p-4 sm:p-5 space-y-4 animate-in fade-in slide-in-from-top-2 duration-150"
              >
                <div className="flex items-start justify-between gap-2 border-b border-red-200/80 pb-3">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-8 h-8 rounded-xl bg-red-600 text-white flex items-center justify-center font-bold shadow-xs shrink-0">
                      <XCircle className="w-4 h-4" />
                    </div>
                    <div className="min-w-0">
                      <h3 className="text-sm font-bold text-red-950">
                        {t("reservationDetail.rejectRequest")}
                      </h3>
                      <p className="text-[11px] text-red-700 truncate">
                        {t("reservationDetail.rejectSubtitle")}
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      setIsRejectOpen(false);
                      setRejectError(null);
                    }}
                    className="shrink-0 w-9 h-9 flex items-center justify-center text-stone-400 hover:text-stone-600 rounded-lg hover:bg-stone-200/50 transition cursor-pointer touch-manipulation"
                    aria-label={t("reservationDetail.cancelReject")}
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                {/* Summary recap */}
                <div className="bg-white border border-red-200 rounded-2xl p-3.5 text-xs space-y-2.5">
                  <span className="text-[10px] font-bold text-stone-500 uppercase tracking-wider block">
                    {t("reservationDetail.requestSummary")}
                  </span>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                    <div className="min-w-0">
                      <span className="text-stone-500 text-[11px] block">
                        {t("reservationDetail.member")}
                      </span>
                      <span className="font-bold text-stone-900 truncate block">
                        {reservation.user_name ||
                          reservation.admin_name ||
                          t("reservationDetail.churchMember")}
                      </span>
                    </div>
                    <div className="min-w-0">
                      <span className="text-stone-500 text-[11px] block">
                        {t("reservationDetail.instrument")}
                      </span>
                      <span className="font-bold text-stone-900 truncate block">
                        {reservation.instrument_name ||
                          t("reservationDetail.instrument")}
                      </span>
                    </div>
                    <div className="min-w-0">
                      <span className="text-stone-500 text-[11px] block">
                        {t("reservationDetail.slotTime")}
                      </span>
                      <span className="font-bold text-stone-900">
                        {dateStr} • {timeStr}
                      </span>
                    </div>
                  </div>

                  {reservation.series_id && (
                    <div className="pt-2 border-t border-stone-100 flex flex-col gap-2 text-xs">
                      <span className="text-stone-600 font-medium">
                        {t("reservationDetail.rejectionScope")}:
                      </span>
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          type="button"
                          onClick={() => setRejectMode("single")}
                          className={`min-h-[44px] px-3 rounded-xl text-xs font-bold transition cursor-pointer touch-manipulation ${
                            rejectMode === "single"
                              ? "bg-red-700 text-white shadow-2xs"
                              : "bg-stone-100 text-stone-600 hover:bg-stone-200"
                          }`}
                        >
                          {t("reservationDetail.thisOccurrenceOnly")}
                        </button>
                        <button
                          type="button"
                          onClick={() => setRejectMode("series")}
                          className={`min-h-[44px] px-3 rounded-xl text-xs font-bold transition cursor-pointer touch-manipulation ${
                            rejectMode === "series"
                              ? "bg-red-700 text-white shadow-2xs"
                              : "bg-stone-100 text-stone-600 hover:bg-stone-200"
                          }`}
                        >
                          {t("reservationDetail.entireSeries")} (
                          {seriesOccurrences.length ||
                            t("reservationDetail.all")}
                          )
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                {/* Quick Reason Presets */}
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-stone-800">
                    {t("reservationDetail.quickReasonPresets")}:
                  </label>
                  <div className="flex flex-wrap gap-1.5">
                    {REJECTION_REASON_PRESETS.map((preset) => (
                      <button
                        key={preset}
                        type="button"
                        onClick={() => {
                          setRejectReason(preset);
                          setRejectError(null);
                        }}
                        className={`text-xs px-2.5 py-1.5 rounded-xl transition cursor-pointer border text-left active:scale-[0.97] touch-manipulation ${
                          rejectReason === preset
                            ? "bg-red-700 text-white border-red-700 font-bold shadow-2xs"
                            : "bg-white hover:bg-red-100/60 text-stone-700 border-red-200 hover:border-red-300 font-medium"
                        }`}
                      >
                        {preset}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Message to Member Textarea */}
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-stone-800">
                    {t("reservationDetail.messageToMember")}{" "}
                    <span className="text-red-600">*</span>:
                  </label>
                  <textarea
                    id="admin-reject-reason-textarea"
                    value={rejectReason}
                    onChange={(e) => {
                      setRejectReason(e.target.value);
                      if (e.target.value.trim()) setRejectError(null);
                    }}
                    placeholder={t("reservationDetail.rejectPlaceholder")}
                    rows={3}
                    className={`w-full text-sm p-3 rounded-xl border focus:outline-none focus:ring-2 focus:ring-red-500/20 bg-white text-stone-900 resize-none ${
                      rejectError
                        ? "border-red-500 bg-red-50/30"
                        : "border-stone-300 focus:border-red-600"
                    }`}
                    autoFocus
                  />
                  {rejectError && (
                    <p className="text-[11px] font-bold text-red-700 flex items-center gap-1 animate-in fade-in">
                      <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                      <span>{rejectError}</span>
                    </p>
                  )}
                </div>

                {/* Confirm / Cancel Controls */}
                <div className="flex items-center gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => {
                      setIsRejectOpen(false);
                      setRejectError(null);
                    }}
                    disabled={isRejecting}
                    className="flex-1 min-h-[48px] px-3.5 py-2 bg-stone-200 hover:bg-stone-300 text-stone-800 rounded-xl text-sm font-bold transition cursor-pointer touch-manipulation"
                  >
                    {t("reservationDetail.cancel")}
                  </button>

                  <button
                    id="btn-confirm-admin-reject"
                    type="button"
                    onClick={handleAdminReject}
                    disabled={isRejecting}
                    className="flex-1 min-h-[48px] px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl text-sm font-bold transition cursor-pointer flex items-center justify-center gap-1.5 shadow-xs disabled:opacity-50 touch-manipulation"
                  >
                    {isRejecting ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        <span>
                          {t("reservationDetail.processingRejection")}
                        </span>
                      </>
                    ) : (
                      <>
                        <XCircle className="w-4 h-4" />
                        <span>
                          {t("reservationDetail.confirmReject")}
                          {rejectMode === "series"
                            ? ` ${t("reservationDetail.entireSeries")}`
                            : ""}
                        </span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}

            {/* 1. Status & Service Purpose + Requester Identity */}
            {isAdminViewer || reservation.user_name ? (
              <div
                id="reservation-summary-card"
                className="p-4 sm:p-4.5 bg-stone-50 border border-stone-200 rounded-2xl space-y-3.5"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <span className="text-[11px] text-stone-500 font-semibold uppercase tracking-wider block">
                      {t("reservationDetail.reservationPurpose")}
                    </span>
                    <span className="text-base font-bold text-stone-900 truncate block">
                      {reservation.service_name ||
                        reservation.serviceName ||
                        t("reservationDetail.churchService")}
                    </span>
                    {isAdminBooked && (
                      <span className="inline-flex items-center gap-1 text-[11px] text-amber-800 font-semibold mt-0.5 max-w-full">
                        <Shield className="w-3 h-3 shrink-0" />
                        <span className="truncate">
                          {t("common.adminBooked")}
                        </span>
                      </span>
                    )}
                    <span className="text-xs text-stone-600 truncate block">
                      {t("reservationDetail.musicianName")}:{" "}
                      {reservation.musician_name || reservation.musicianName}
                    </span>
                  </div>

                  <span
                    className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider shrink-0 whitespace-nowrap ${getStatusColor(reservation.status)}`}
                  >
                    {reservation.status === "approved" ||
                    reservation.status === "ongoing" ? (
                      <>
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-700" />
                        {t("reservationDetail.approved")}
                      </>
                    ) : isPending ? (
                      <>
                        <Clock className="w-3.5 h-3.5 text-amber-700" />
                        {t("reservationDetail.pendingReview")}
                      </>
                    ) : reservation.status === "completed" ? (
                      <>
                        <CheckCircle2 className="w-3.5 h-3.5 text-blue-700" />
                        {t("reservationDetail.completed")}
                      </>
                    ) : (
                      <>
                        <X className="w-3.5 h-3.5 text-stone-500" />
                        {reservation.status === "rejected" &&
                          t("reservationDetail.rejected")}
                        {reservation.status === "cancelled" &&
                          t("reservationDetail.cancelled")}
                        {reservation.status === "completed" &&
                          t("reservationDetail.completed")}
                        {reservation.status === "expired" &&
                          (t("reservationDetail.expired") || "Expired")}
                      </>
                    )}
                  </span>
                </div>

                {isPending && (
                  <button
                    type="button"
                    onClick={() => setShowPolicyExplainer(true)}
                    className="inline-flex items-center gap-1.5 text-[11px] text-amber-800 hover:text-amber-900 font-semibold cursor-pointer touch-manipulation"
                  >
                    <Info className="w-3.5 h-3.5" />
                    {t("reservationDetail.learnMore")}
                  </button>
                )}

                <div className="border-t border-stone-200 pt-3 space-y-2.5">
                  <div className="flex items-center justify-between gap-2 flex-nowrap text-xs font-bold text-stone-800">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <User className="w-4 h-4 text-amber-800 shrink-0" />
                      <span className="truncate">
                        {t("reservationDetail.requester")}
                      </span>
                    </div>
                    {reservation.user_is_trusted ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-100 text-amber-900 border border-amber-300 shrink-0 whitespace-nowrap">
                        <Shield className="w-3 h-3 text-amber-800" />
                        {t("reservationDetail.trusted")}
                      </span>
                    ) : (
                      <span className="text-[10px] text-stone-500 font-normal shrink-0 whitespace-nowrap">
                        {t("reservationDetail.standardMember")}
                      </span>
                    )}
                  </div>

                  <div className="flex flex-wrap items-start justify-between gap-3 text-xs">
                    <div className="min-w-0">
                      {reservation.user_id && onOpenUserProfile ? (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onOpenUserProfile(reservation.user_id);
                          }}
                          className="font-bold text-stone-900 text-sm hover:text-amber-800 hover:underline text-left cursor-pointer transition flex items-center gap-1.5 group touch-manipulation"
                          title={
                            t("admin.userDetail.viewProfile") ||
                            "View Member Profile"
                          }
                        >
                          <span className="truncate">
                            {reservation.user_name ||
                              t("reservationDetail.churchMember")}
                          </span>
                          <ExternalLink className="w-3.5 h-3.5 text-stone-400 group-hover:text-amber-800 transition shrink-0" />
                        </button>
                      ) : (
                        <div className="font-bold text-stone-900 text-sm truncate">
                          {reservation.user_name ||
                            reservation.admin_name ||
                            t("reservationDetail.churchMember")}
                        </div>
                      )}
                      {(reservation.user_phone || reservation.admin_phone) && (
                        <a
                          href={`https://wa.me/${String(
                            reservation.user_phone || reservation.admin_phone,
                          )
                            .replace(/[^\d]/g, "")
                            .replace(/^0/, "20")}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 text-emerald-700 hover:text-emerald-900 text-xs mt-1 font-mono touch-manipulation"
                        >
                          <Phone className="w-3.5 h-3.5 shrink-0" />
                          <span>
                            {reservation.user_phone || reservation.admin_phone}
                          </span>
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
              </div>
            ) : null}

            {/* Requester Note */}
            {reservation.note && (
              <div className="bg-stone-50/80 border border-stone-200 rounded-2xl p-4 flex items-start gap-3">
                <FileText className="w-5 h-5 text-stone-500 shrink-0 mt-0.5" />
                <div className="text-xs space-y-1 min-w-0 flex-1">
                  <div className="font-bold text-stone-900">
                    {t("reservationForm.leaveANoteLabel") || "Note"}
                  </div>
                  <p className="text-stone-700 leading-relaxed font-medium whitespace-pre-wrap break-words">
                    {reservation.note}
                  </p>
                </div>
              </div>
            )}

            {/* Rejection Reason notice */}
            {reservation.rejection_reason && (
              <div className="bg-red-50 border border-red-200 rounded-2xl p-4 flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
                <div className="text-xs space-y-2 flex-1 min-w-0">
                  <span className="font-bold text-red-950 block">
                    {t("reservationDetail.adminRejectionReason")}
                  </span>
                  <div className="text-red-800 leading-relaxed font-medium break-words">
                    {reservation.rejection_reason}
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setActiveTab("chat");
                      setTimeout(() => {
                        chatInputRef.current?.focus();
                        messagesEndRef.current?.scrollIntoView({
                          behavior: "smooth",
                        });
                      }, 80);
                    }}
                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-red-100 hover:bg-red-200 text-red-900 font-bold text-xs transition cursor-pointer touch-manipulation"
                  >
                    <MessageSquare className="w-3.5 h-3.5" />
                    {t("reservationDetail.replyToAdmin")}
                  </button>
                </div>
              </div>
            )}

            {/* Cancellation Reason notice */}
            {reservation.status === "cancelled" &&
              reservation.cancellation_reason && (
                <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex items-start gap-3">
                  <XCircle className="w-5 h-5 text-amber-700 shrink-0 mt-0.5" />
                  <div className="text-xs space-y-1 min-w-0">
                    <div className="font-bold text-amber-950">
                      {t("reservationDetail.cancellationReason")}
                    </div>
                    <div className="text-amber-900 leading-relaxed break-words">
                      {reservation.cancellation_reason}
                    </div>
                  </div>
                </div>
              )}

            {/* No-Show Accountability Callout */}
            {isNoShow && (
              <div className="bg-rose-50 border border-rose-200 rounded-2xl p-4 flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-rose-700 shrink-0 mt-0.5" />
                <div className="text-xs space-y-1 min-w-0">
                  <div className="font-bold text-rose-950">
                    {t("common.noShow")}
                  </div>
                  <div className="text-rose-900 leading-relaxed font-medium">
                    {t("common.markedNoShowBy")}{" "}
                    <strong>
                      {reservation.no_show_admin_name ||
                        (reservation as any).noShowAdminName ||
                        "Administrator"}
                    </strong>
                    {(reservation.no_show_marked_at ||
                      (reservation as any).noShowMarkedAt) && (
                      <>
                        {" "}
                        (
                        {new Date(
                          reservation.no_show_marked_at ||
                            (reservation as any).noShowMarkedAt,
                        ).toLocaleString()}
                        )
                      </>
                    )}
                    .
                  </div>
                </div>
              </div>
            )}

            {/* Expired Callout */}
            {isExpired && (
              <div className="bg-stone-100 border border-stone-300 rounded-2xl p-4 flex items-start gap-3">
                <Clock className="w-5 h-5 text-stone-600 shrink-0 mt-0.5" />
                <div className="text-xs space-y-1 min-w-0">
                  <div className="font-bold text-stone-900">
                    {t("common.expired")}
                  </div>
                  <div className="text-stone-600 leading-relaxed font-medium">
                    This reservation was pending review and expired because its
                    scheduled start time has passed.
                  </div>
                </div>
              </div>
            )}

            {/* 2. Full Info Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Instrument Info Card */}
              <div className="p-4 bg-stone-50 border border-stone-200 rounded-2xl space-y-2.5">
                <div className="flex items-center gap-2 text-xs font-bold text-stone-800">
                  <Music2 className="w-4 h-4 text-amber-800" />
                  <span>{t("reservationDetail.instrumentSpecifications")}</span>
                </div>
                <div className="flex items-start gap-3">
                  <div className="w-14 h-14 rounded-xl bg-amber-100/70 border border-amber-200 text-amber-800 flex items-center justify-center shrink-0 overflow-hidden shadow-2xs">
                    {reservation.instrument_photo_url ||
                    reservation.photoUrl ||
                    (reservation as any).photo_url ? (
                      <img
                        src={
                          reservation.instrument_photo_url ||
                          reservation.photoUrl ||
                          (reservation as any).photo_url
                        }
                        alt={reservation.instrument_name || "Instrument"}
                        referrerPolicy="no-referrer"
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <Music2 className="w-6 h-6 text-amber-800" />
                    )}
                  </div>
                  <div className="space-y-1 text-xs flex-1 min-w-0">
                    <div className="font-bold text-stone-900 text-sm truncate">
                      {reservation.instrument_name ||
                        t("reservationDetail.instrument")}
                    </div>
                    <div className="text-stone-500 truncate">
                      <span className="font-semibold text-stone-700">
                        {t("reservationDetail.type")}
                      </span>{" "}
                      {reservation.instrument_type || "General"}
                    </div>
                    <div className="text-stone-500 truncate">
                      <span className="font-semibold text-stone-700">
                        {t("reservationDetail.bookingMode")}
                      </span>{" "}
                      <span className="capitalize">
                        {reservation.booking_mode || "Manual"}
                      </span>
                    </div>
                    {reservation.instrument_description && (
                      <div className="text-stone-500 text-[11px] pt-1 italic line-clamp-2">
                        {reservation.instrument_description}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Date & Time Slot Card */}
              <div className="p-4 bg-stone-50 border border-stone-200 rounded-2xl space-y-2.5">
                <div className="flex items-center gap-2 text-xs font-bold text-stone-800">
                  <Calendar className="w-4 h-4 text-amber-800" />
                  <span>{t("reservationDetail.dateTimeSlot")}</span>
                </div>
                <div className="space-y-1 text-xs">
                  <div className="font-bold text-stone-900 text-sm">
                    {dateStr}
                  </div>
                  <div className="text-stone-700 font-semibold flex items-center gap-1.5 flex-wrap">
                    <span>{timeStr}</span>
                    <span className="text-stone-400">•</span>
                    {isFullDay ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-100 text-amber-900 border border-amber-300 font-bold text-[11px] whitespace-nowrap">
                        <Sun className="w-3 h-3 text-amber-700 shrink-0" />
                        <span>{t("common.fullDay")} (13h)</span>
                      </span>
                    ) : (
                      <span className="text-stone-500 text-[11px] font-normal whitespace-nowrap">
                        {durationHours} {t("reservationDetail.hour")}
                        {Number(durationHours) > 1 ? "s" : ""}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* 3. Unified Payment Block */}
            <div
              className={`rounded-2xl border p-4 space-y-3 ${
                isOutsideChurch
                  ? "bg-purple-50/60 border-purple-200"
                  : "bg-stone-50 border-stone-200"
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <div
                    className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
                      isOutsideChurch
                        ? "bg-purple-700 text-white"
                        : "bg-emerald-100 text-emerald-800"
                    }`}
                  >
                    <DollarSign className="w-3.5 h-3.5" />
                  </div>
                  <span className="text-xs font-bold text-stone-800 truncate">
                    {t("reservationDetail.usageAndFee")}
                  </span>
                </div>

                <span
                  className={`px-2 py-0.5 rounded-md text-[10px] font-bold shrink-0 whitespace-nowrap ${
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

              {!isOutsideChurch ? (
                <div className="flex items-center gap-2 text-xs text-emerald-900 bg-emerald-50 border border-emerald-200 rounded-xl px-3 py-2.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0" />
                  <span className="font-medium">
                    {t("reservationDetail.noFeeInChurch")}
                  </span>
                </div>
              ) : (
                <>
                  <div className="flex items-center justify-between gap-3 bg-white border border-purple-200 rounded-xl px-3 py-2.5">
                    <div className="min-w-0">
                      <div className="text-[11px] font-semibold text-purple-800 leading-tight">
                        {t("reservationDetail.requiredOutsideFee")}
                      </div>
                      <div className="text-[10px] text-purple-600 leading-tight mt-0.5">
                        {t("reservationDetail.paymentNotice")}
                      </div>
                    </div>
                    <div className="text-lg font-bold text-purple-950 whitespace-nowrap">
                      {t("reservationDetail.egp")}{" "}
                      {reservation.fee_snapshot ||
                        reservation.outside_fee_per_day ||
                        0}
                    </div>
                  </div>

                  {!isAdminViewer &&
                    (isApprovedOutsideChurch &&
                    paymentSettings?.instapayLink ? (
                      <a
                        href={paymentSettings.instapayLink}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center justify-between gap-2 w-full min-h-[48px] px-4 py-3 bg-purple-700 hover:bg-purple-800 active:bg-purple-900 text-white text-sm font-bold rounded-xl transition cursor-pointer shadow-xs touch-manipulation"
                      >
                        <span>{t("reservationDetail.openInstapay")}</span>
                        <ExternalLink className="w-4 h-4 shrink-0" />
                      </a>
                    ) : (
                      <div className="flex items-center gap-2 text-[11px] text-purple-800 bg-purple-100/70 border border-purple-200 rounded-xl px-3 py-2">
                        <Info className="w-3.5 h-3.5 shrink-0" />
                        <span className="font-medium">
                          {t("reservationDetail.paymentAfterApproval")}
                        </span>
                      </div>
                    ))}

                  {isAdminViewer && (
                    <div className="flex items-center gap-2 text-[11px] text-stone-600 bg-stone-100 border border-stone-200 rounded-xl px-3 py-2">
                      <Info className="w-3.5 h-3.5 shrink-0 text-stone-500" />
                      <span className="font-medium">
                        {t("reservationDetail.memberPaysViaInstapay")}
                      </span>
                    </div>
                  )}
                </>
              )}
            </div>

            {/* 5. Conversation Preview */}
            <div className="p-4 bg-stone-50 border border-stone-200 rounded-2xl space-y-3.5">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <MessageSquare className="w-4 h-4 text-amber-800 shrink-0" />
                  <span className="text-xs font-bold text-stone-900 truncate">
                    {t("reservationDetail.conversationNotes")}
                  </span>
                  <span className="text-[11px] bg-stone-200 text-stone-700 font-semibold px-2 py-0.5 rounded-full shrink-0">
                    {adminMessages.length}
                  </span>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setActiveTab("chat");
                    setTimeout(() => {
                      messagesEndRef.current?.scrollIntoView({
                        behavior: "smooth",
                      });
                      chatInputRef.current?.focus();
                    }, 80);
                  }}
                  className="text-xs font-bold text-amber-900 hover:text-amber-950 flex items-center gap-1 cursor-pointer shrink-0 touch-manipulation"
                >
                  <span className="hidden sm:inline">
                    {t("reservationDetail.openFullChat")}
                  </span>
                  <ArrowIcon className="w-3.5 h-3.5" />
                </button>
              </div>

              {adminMessages.length === 0 ? (
                <div className="p-3.5 bg-white rounded-xl border border-stone-200 text-center space-y-2">
                  <p className="text-xs text-stone-500 italic">
                    {t("reservationDetail.noMessages")}
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      setActiveTab("chat");
                      setTimeout(() => chatInputRef.current?.focus(), 80);
                    }}
                    className="min-h-[44px] px-3.5 py-2 bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-200 rounded-xl text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer transition touch-manipulation"
                  >
                    <MessageSquare className="w-3.5 h-3.5 text-amber-800 shrink-0" />
                    <span>{t("reservationDetail.sendMessage")}</span>
                  </button>
                </div>
              ) : (
                <div className="space-y-2">
                  {(() => {
                    const lastMsg = adminMessages[adminMessages.length - 1];
                    const isUser = lastMsg.sender_role === "user";
                    return (
                      <div className="bg-white p-3 rounded-xl border border-stone-200 text-xs space-y-1">
                        <div className="flex items-center justify-between gap-2 text-[11px]">
                          <span className="font-bold flex items-center gap-1.5 min-w-0">
                            {isUser ? (
                              <>
                                <User className="w-3 h-3 text-stone-500 shrink-0" />
                                <span className="text-stone-800 truncate">
                                  {lastMsg.sender_name ||
                                    t("reservationDetail.member")}
                                </span>
                              </>
                            ) : (
                              <>
                                <Shield className="w-3 h-3 text-amber-800 shrink-0" />
                                <span className="text-amber-900 truncate">
                                  {lastMsg.sender_name ||
                                    t("reservationDetail.churchAdministration")}
                                </span>
                              </>
                            )}
                          </span>
                          <span className="text-[10px] text-stone-400 shrink-0">
                            {formatMessageTime(
                              lastMsg.created_at || lastMsg.createdAt,
                            )}
                          </span>
                        </div>
                        <p className="text-stone-700 line-clamp-2 italic font-normal">
                          "{lastMsg.content}"
                        </p>
                      </div>
                    );
                  })()}

                  <button
                    type="button"
                    onClick={() => {
                      setActiveTab("chat");
                      setTimeout(() => {
                        messagesEndRef.current?.scrollIntoView({
                          behavior: "smooth",
                        });
                        chatInputRef.current?.focus();
                      }, 80);
                    }}
                    className="w-full min-h-[44px] py-2.5 bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-200/80 text-xs font-bold rounded-xl transition flex items-center justify-center gap-1.5 cursor-pointer touch-manipulation"
                  >
                    <MessageSquare className="w-3.5 h-3.5 shrink-0" />
                    <span>
                      {isAdminViewer
                        ? t("reservationDetail.openChatReplyMember")
                        : t("reservationDetail.openChatReplyAdmin")}
                    </span>
                  </button>
                </div>
              )}
            </div>

            {/* 6. Recurring Series Occurrence Breakdown */}
            {reservation.series_id && (
              <div className="space-y-2.5">
                <div className="flex items-center justify-between gap-2 text-xs font-bold text-stone-800">
                  <div className="flex items-center gap-2 min-w-0">
                    <Repeat className="w-4 h-4 text-amber-800 shrink-0" />
                    <span className="truncate">
                      {t("reservationDetail.partOfRecurringSeries")}
                    </span>
                  </div>
                  <span className="text-[11px] text-stone-500 font-normal shrink-0 whitespace-nowrap">
                    {t("reservationDetail.occurrencesTotal", {
                      count: seriesOccurrences.length,
                    })}
                  </span>
                </div>

                <div className="border border-stone-200 rounded-2xl divide-y divide-stone-100 max-h-48 overflow-y-auto overscroll-contain bg-stone-50/50">
                  {seriesOccurrences.map((occ, idx) => {
                    const occStart = new Date(occ.start_time || occ.startTime);
                    const occDateStr = getCairoDateString(occStart);
                    const occTimeStr = getCairoTimeString(occStart);
                    const isCurrent = occ.id === reservation.id;

                    return (
                      <div
                        key={occ.id}
                        onClick={() => {
                          if (!isCurrent && onNavigateToReservation) {
                            onNavigateToReservation(occ.id);
                          }
                        }}
                        className={`p-3 text-xs flex items-center justify-between gap-2 transition ${
                          isCurrent
                            ? "bg-amber-100/50 font-bold border-l-4 border-l-amber-800"
                            : "hover:bg-stone-100 cursor-pointer touch-manipulation"
                        }`}
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <span className="w-5 h-5 rounded-md bg-stone-200 text-stone-700 flex items-center justify-center text-[10px] font-bold shrink-0">
                            {idx + 1}
                          </span>
                          <div className="min-w-0">
                            <span className="text-stone-900 font-semibold">
                              {occDateStr}
                            </span>
                            <span className="text-stone-500 ml-2 text-[11px]">
                              {t("reservationDetail.at")} {occTimeStr}
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase whitespace-nowrap ${getStatusColor(
                              occ.status,
                            )}`}
                          >
                            {occ.status === "approved" &&
                              t("reservationDetail.approved")}
                            {occ.status === "pending" &&
                              t("reservationDetail.pending")}
                            {occ.status === "rejected" &&
                              t("reservationDetail.rejected")}
                            {occ.status === "cancelled" &&
                              t("reservationDetail.cancelled")}
                          </span>
                          {isCurrent && (
                            <span className="text-[10px] text-amber-900 bg-amber-200 px-1.5 py-0.5 rounded font-bold whitespace-nowrap">
                              {t("reservationDetail.viewing")}
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Full Day Transformation Confirmation Box */}
            {fullDayConfirmOpen && (
              <div className="bg-amber-50 border border-amber-300 rounded-2xl p-4 space-y-3 animate-in fade-in">
                <div className="flex items-center gap-2 text-amber-950 font-bold text-xs">
                  <Sun className="w-4 h-4 text-amber-600 shrink-0" />
                  <span>
                    {t("reservationDetail.transformToFullDayConfirm")}
                  </span>
                </div>
                <p className="text-xs text-amber-900 leading-relaxed">
                  {t("reservationDetail.transformToFullDayDesc")}
                </p>
                <div className="flex items-center gap-2 pt-1">
                  <button
                    type="button"
                    id="btn-confirm-transform-fullday"
                    onClick={handleAdminTransformFullDay}
                    disabled={isTransformingFullDay}
                    className="flex-1 min-h-[48px] px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white text-sm font-bold rounded-xl transition flex items-center justify-center gap-1.5 cursor-pointer shadow-xs disabled:opacity-50 touch-manipulation"
                  >
                    {isTransformingFullDay ? (
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <Sun className="w-4 h-4" />
                    )}
                    <span>{t("reservationDetail.transformToFullDay")}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setFullDayConfirmOpen(false)}
                    disabled={isTransformingFullDay}
                    className="min-h-[48px] px-4 py-2 bg-white hover:bg-stone-50 text-stone-700 border border-stone-300 text-sm font-bold rounded-xl transition cursor-pointer touch-manipulation"
                  >
                    {t("common.cancel")}
                  </button>
                </div>
              </div>
            )}

            {/* Cancellation Confirmation Box */}
            {cancelPrompt && (
              <div className="bg-red-50 border border-red-200 rounded-2xl p-4 space-y-3 animate-in fade-in">
                <div className="flex items-center gap-2 text-red-950 font-bold text-xs">
                  <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
                  <span>
                    {cancelPrompt === "series"
                      ? t("reservationDetail.confirmCancelSeries")
                      : t("reservationDetail.confirmCancelSingle")}
                  </span>
                </div>
                <p className="text-xs text-red-800 leading-relaxed">
                  {cancelPrompt === "series"
                    ? t("reservationDetail.cancelSeriesDesc")
                    : t("reservationDetail.cancelSingleDesc")}
                </p>

                {isAdminViewer && (
                  <div className="space-y-2 pt-1">
                    <label className="block text-[11px] font-bold uppercase text-red-800">
                      {t("reservationDetail.reasonOptional")}
                    </label>
                    <select
                      value={cancelReasonPreset}
                      onChange={(e) => setCancelReasonPreset(e.target.value)}
                      className="w-full px-3 py-2.5 bg-white border border-red-200 rounded-xl text-sm text-stone-900 focus:outline-none focus:border-red-500"
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
                        className="w-full px-3 py-2.5 bg-white border border-red-200 rounded-xl text-sm text-stone-900 focus:outline-none focus:border-red-500 resize-none"
                      />
                    )}
                  </div>
                )}

                <div className="flex items-center gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => setCancelPrompt(null)}
                    className="flex-1 min-h-[48px] bg-stone-200 hover:bg-stone-300 text-stone-800 text-sm font-bold rounded-xl transition cursor-pointer touch-manipulation"
                  >
                    {t("reservationDetail.keepReservation")}
                  </button>
                  <button
                    type="button"
                    disabled={isCancelling}
                    onClick={() => handleCancelExecution(cancelPrompt)}
                    className="flex-1 min-h-[48px] bg-red-600 hover:bg-red-700 text-white text-sm font-bold rounded-xl transition cursor-pointer flex items-center justify-center gap-1.5 disabled:opacity-50 touch-manipulation"
                  >
                    {isCancelling ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        <span>{t("reservationDetail.cancelling")}</span>
                      </>
                    ) : (
                      t("reservationDetail.yesCancelNow")
                    )}
                  </button>
                </div>
              </div>
            )}
          </div>
        ) : (
          /* DEDICATED CHAT SCREEN */
          <div className="flex-1 min-h-0 flex flex-col bg-stone-50/50">
            <div className="bg-white px-3.5 py-2.5 sm:px-5 sm:py-3 border-b border-stone-200 shrink-0 flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-8 h-8 rounded-xl bg-amber-100 text-amber-900 flex items-center justify-center shrink-0">
                  <Music2 className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <div className="font-bold text-xs text-stone-900 truncate">
                    {reservation.service_name ||
                      t("reservationDetail.reservation")}{" "}
                    • {reservation.instrument_name}
                  </div>
                  <div className="text-[11px] text-stone-500 font-medium truncate">
                    {dateStr} ({timeStr})
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <span
                  className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase whitespace-nowrap ${getStatusColor(reservation.status)}`}
                >
                  {reservation.status === "approved" &&
                    t("reservationDetail.approved")}
                  {reservation.status === "pending" &&
                    t("reservationDetail.pending")}
                  {reservation.status === "rejected" &&
                    t("reservationDetail.rejected")}
                  {reservation.status === "cancelled" &&
                    t("reservationDetail.cancelled")}
                  {reservation.status === "ongoing" &&
                    t("reservationDetail.ongoing")}
                  {reservation.status === "completed" &&
                    t("reservationDetail.completed")}
                </span>

                <button
                  type="button"
                  onClick={() => setActiveTab("details")}
                  className="text-[11px] font-semibold text-stone-700 hover:text-stone-900 bg-stone-100 hover:bg-stone-200 px-2.5 py-1.5 rounded-lg border border-stone-200 transition cursor-pointer flex items-center gap-1 touch-manipulation"
                >
                  <span>{t("reservationDetail.details")}</span>
                  <ArrowIcon className="w-3 h-3" />
                </button>
              </div>
            </div>

            {reservation.rejection_reason && (
              <div className="mx-3 mt-3 sm:mx-5 sm:mt-3.5 p-3 rounded-xl bg-red-50 border border-red-200 flex items-start gap-2.5 shrink-0 animate-in fade-in">
                <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                <div className="text-xs space-y-0.5 min-w-0 flex-1">
                  <div className="font-bold text-red-950">
                    {t("reservationDetail.adminRejectionReason")}
                  </div>
                  <p className="text-red-900 leading-relaxed font-medium text-[11px] sm:text-xs break-words">
                    {reservation.rejection_reason}
                  </p>
                </div>
              </div>
            )}

            <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain p-3 sm:p-5 space-y-3">
              {adminMessages.length === 0 ? (
                <div className="h-full min-h-55 flex flex-col items-center justify-center text-center p-6 space-y-2.5">
                  <div className="w-12 h-12 rounded-2xl bg-amber-50 border border-amber-200 text-amber-800 flex items-center justify-center shadow-2xs">
                    <MessageSquare className="w-6 h-6" />
                  </div>
                  <div className="space-y-1 max-w-xs">
                    <h4 className="text-xs font-bold text-stone-800">
                      {t("reservationDetail.noMessagesTitle")}
                    </h4>
                    <p className="text-[11px] text-stone-500 leading-relaxed">
                      {isAdminViewer
                        ? t("reservationDetail.noMessagesAdmin")
                        : t("reservationDetail.noMessagesUser")}
                    </p>
                  </div>
                </div>
              ) : (
                <>
                  {adminMessages.map((msg) => {
                    const isUserMsg = msg.sender_role === "user";
                    const isMe = isAdminViewer ? !isUserMsg : isUserMsg;
                    const timeFormatted = formatMessageTime(
                      msg.created_at || msg.createdAt,
                    );

                    return (
                      <div
                        key={msg.id}
                        className={`flex flex-col ${
                          isMe ? "items-end" : "items-start"
                        }`}
                      >
                        <div
                          className={`rounded-2xl p-3 sm:p-3.5 text-xs space-y-1.5 shadow-2xs max-w-[88%] sm:max-w-[78%] ${
                            isMe
                              ? "bg-amber-900 text-white rounded-tr-xs"
                              : "bg-white border border-stone-200 text-stone-800 rounded-tl-xs"
                          }`}
                        >
                          <div className="flex items-center justify-between gap-3 text-[10px]">
                            <span
                              className={`font-bold flex items-center gap-1.5 ${
                                isMe
                                  ? "text-amber-200"
                                  : isUserMsg
                                    ? "text-stone-700"
                                    : "text-amber-900"
                              }`}
                            >
                              {isMe ? (
                                <span>{t("reservationDetail.you")}</span>
                              ) : isUserMsg ? (
                                <>
                                  <User className="w-3 h-3 text-stone-500 shrink-0" />
                                  <span>
                                    {msg.sender_name ||
                                      msg.user_name ||
                                      t("reservationDetail.member")}
                                  </span>
                                </>
                              ) : (
                                <>
                                  <Shield className="w-3 h-3 text-amber-800 shrink-0" />
                                  <span>
                                    {msg.sender_name ||
                                      msg.admin_name ||
                                      t(
                                        "reservationDetail.churchAdministration",
                                      )}
                                  </span>
                                </>
                              )}
                            </span>
                            <span
                              className={
                                isMe
                                  ? "text-amber-300/80 font-mono text-[9px] shrink-0"
                                  : "text-stone-400 font-mono text-[9px] shrink-0"
                              }
                            >
                              {timeFormatted}
                            </span>
                          </div>

                          <p
                            className={`leading-relaxed whitespace-pre-wrap break-words ${
                              isMe
                                ? "text-amber-50 font-normal"
                                : "text-stone-800 font-medium"
                            }`}
                          >
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

            {!isAdminViewer && reservation.rejection_reason && (
              <div className="px-3 pt-2 pb-0 flex items-center gap-1.5 overflow-x-auto no-scrollbar shrink-0">
                <span className="text-[10px] text-stone-400 font-medium shrink-0">
                  {t("reservationDetail.suggestions")}
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setReplyContent(t("reservationDetail.canReschedule"));
                    chatInputRef.current?.focus();
                  }}
                  className="text-[11px] px-2.5 py-1.5 bg-white border border-stone-200 text-stone-700 rounded-full hover:border-amber-400 hover:text-amber-900 transition whitespace-nowrap shrink-0 cursor-pointer touch-manipulation"
                >
                  {t("reservationDetail.canReschedule")}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setReplyContent(t("reservationDetail.alternateInstrument"));
                    chatInputRef.current?.focus();
                  }}
                  className="text-[11px] px-2.5 py-1.5 bg-white border border-stone-200 text-stone-700 rounded-full hover:border-amber-400 hover:text-amber-900 transition whitespace-nowrap shrink-0 cursor-pointer touch-manipulation"
                >
                  {t("reservationDetail.alternateInstrument")}
                </button>
              </div>
            )}

            <form
              onSubmit={handleSendMessage}
              className="p-3 sm:p-4 bg-white border-t border-stone-200 shrink-0 space-y-2 shadow-xs"
            >
              <div className="relative">
                <textarea
                  ref={chatInputRef}
                  id="reservation-chat-input-full"
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
                  className="w-full px-3.5 py-2.5 text-sm bg-stone-50 focus:bg-white border border-stone-300 rounded-xl text-stone-900 placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-amber-700/30 focus:border-amber-700 transition resize-none"
                  disabled={sendingReply}
                />
              </div>

              {replyError && (
                <div className="text-[11px] text-red-600 font-medium flex items-center gap-1">
                  <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                  <span>{replyError}</span>
                </div>
              )}

              <div className="flex items-center justify-between gap-2">
                <span className="text-[10px] text-stone-400 hidden sm:inline">
                  {t("reservationDetail.enterHint")}
                </span>
                <span className="text-[10px] text-stone-400 sm:hidden">
                  {t("reservationDetail.replyHint")}
                </span>

                <button
                  type="submit"
                  id="btn-send-chat-tab"
                  disabled={!replyContent.trim() || sendingReply}
                  className="min-h-[48px] px-5 py-2.5 bg-amber-800 hover:bg-amber-900 active:bg-amber-950 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-bold rounded-xl transition shadow-2xs flex items-center justify-center gap-2 cursor-pointer ml-auto touch-manipulation"
                >
                  {sendingReply ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      <span>{t("reservationDetail.sending")}</span>
                    </>
                  ) : (
                    <>
                      <Send className="w-4 h-4" />
                      <span className="hidden xs:inline">
                        {t("reservationDetail.sendMessageButton")}
                      </span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Modal Actions Footer - Shown on Details Tab */}
        {activeTab === "details" && (
          <div className="p-3 sm:p-4 bg-stone-50 border-t border-stone-200 shrink-0 overflow-x-auto overscroll-contain">
            <div className="flex items-center gap-2 min-w-max sm:min-w-0 sm:flex-wrap">
              <button
                type="button"
                onClick={onClose}
                className="min-h-[48px] px-4 py-2 bg-stone-200 hover:bg-stone-300 active:bg-stone-400 text-stone-800 text-sm font-bold rounded-xl transition cursor-pointer shrink-0 touch-manipulation"
              >
                {t("reservationDetail.close")}
              </button>

              {/* Admin Pending Action Controls */}
              {isAdminViewer && isPending && !cancelPrompt ? (
                <div className="flex flex-nowrap items-center gap-2 shrink-0">
                  <button
                    id="btn-footer-admin-reject"
                    type="button"
                    onClick={() => {
                      setIsRejectOpen(!isRejectOpen);
                      setRejectError(null);
                    }}
                    disabled={isApproving || isRejecting}
                    className={`min-h-[48px] px-3.5 py-2 rounded-xl text-sm font-bold transition flex items-center gap-1.5 cursor-pointer border whitespace-nowrap shrink-0 touch-manipulation ${
                      isRejectOpen
                        ? "bg-stone-200 text-stone-800 border-stone-300"
                        : "bg-red-50 hover:bg-red-100 text-red-700 border-red-200"
                    }`}
                  >
                    <XCircle className="w-4 h-4 text-red-600 shrink-0" />
                    <span>
                      {isRejectOpen
                        ? t("reservationDetail.closeRejectForm")
                        : t("reservationDetail.reject")}
                    </span>
                  </button>

                  {reservation.series_id ? (
                    <>
                      <button
                        id="btn-footer-admin-approve-single"
                        type="button"
                        onClick={() => handleAdminApprove("single")}
                        disabled={isApproving || isRejecting}
                        className="min-h-[48px] px-3.5 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 text-sm font-bold rounded-xl transition flex items-center gap-1.5 cursor-pointer shadow-2xs disabled:opacity-50 whitespace-nowrap shrink-0 touch-manipulation"
                      >
                        {isApproving && approvingMode === "single" ? (
                          <div className="w-4 h-4 border-2 border-emerald-800 border-t-transparent rounded-full animate-spin" />
                        ) : (
                          <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0" />
                        )}
                        <span>{t("reservationDetail.approveOccurrence")}</span>
                      </button>

                      <button
                        id="btn-footer-admin-approve-series"
                        type="button"
                        onClick={() => handleAdminApprove("series")}
                        disabled={isApproving || isRejecting}
                        className="min-h-[48px] px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white text-sm font-bold rounded-xl transition flex items-center gap-1.5 cursor-pointer shadow-xs disabled:opacity-50 whitespace-nowrap shrink-0 touch-manipulation"
                      >
                        {isApproving && approvingMode === "series" ? (
                          <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        ) : (
                          <CheckCircle2 className="w-4 h-4 shrink-0" />
                        )}
                        <span>
                          {t("reservationDetail.approveEntireSeries", {
                            count:
                              seriesOccurrences.length ||
                              t("reservationDetail.all"),
                          })}
                        </span>
                      </button>
                    </>
                  ) : (
                    <button
                      id="btn-footer-admin-approve-single"
                      type="button"
                      onClick={() => handleAdminApprove("single")}
                      disabled={isApproving || isRejecting}
                      className="min-h-[48px] px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white text-sm font-bold rounded-xl transition flex items-center gap-1.5 cursor-pointer shadow-xs disabled:opacity-50 whitespace-nowrap shrink-0 touch-manipulation"
                    >
                      {isApproving ? (
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      ) : (
                        <CheckCircle2 className="w-4 h-4 shrink-0" />
                      )}
                      <span>{t("reservationDetail.approve")}</span>
                    </button>
                  )}

                  {!isFullDay && (
                    <button
                      id="btn-footer-admin-transform-fullday"
                      type="button"
                      onClick={() => setFullDayConfirmOpen(true)}
                      disabled={
                        isApproving || isRejecting || isTransformingFullDay
                      }
                      className="min-h-[48px] px-3.5 py-2 bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300 text-sm font-bold rounded-xl transition flex items-center gap-1.5 cursor-pointer shadow-2xs disabled:opacity-50 whitespace-nowrap shrink-0 touch-manipulation"
                      title={t("reservationDetail.transformToFullDayTooltip")}
                    >
                      <Sun className="w-4 h-4 text-amber-600 shrink-0" />
                      <span className="hidden sm:inline">
                        {t("reservationDetail.transformToFullDay")}
                      </span>
                    </button>
                  )}
                </div>
              ) : (
                !isPast &&
                !isCancelled &&
                !cancelPrompt && (
                  <div className="flex flex-nowrap items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => {
                        onClose();
                        onEdit(reservation);
                      }}
                      className="min-h-[48px] px-3.5 py-2 bg-stone-100 hover:bg-stone-200 text-stone-800 border border-stone-300 text-sm font-bold rounded-xl transition flex items-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0 touch-manipulation"
                    >
                      <Edit className="w-4 h-4 shrink-0" />
                      <span className="hidden sm:inline">
                        {t("reservationDetail.editSlot")}
                      </span>
                    </button>

                    {isAdminViewer && !isFullDay && (
                      <button
                        id="btn-admin-transform-fullday-approved"
                        type="button"
                        onClick={() => setFullDayConfirmOpen(true)}
                        disabled={isTransformingFullDay}
                        className="min-h-[48px] px-3.5 py-2 bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300 text-sm font-bold rounded-xl transition flex items-center gap-1.5 cursor-pointer shadow-2xs disabled:opacity-50 whitespace-nowrap shrink-0 touch-manipulation"
                        title={t("reservationDetail.transformToFullDayTooltip")}
                      >
                        <Sun className="w-4 h-4 text-amber-600 shrink-0" />
                        <span className="hidden sm:inline">
                          {t("reservationDetail.transformToFullDay")}
                        </span>
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() => setCancelPrompt("single")}
                      className="min-h-[48px] px-3.5 py-2 bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 text-sm font-bold rounded-xl transition flex items-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0 touch-manipulation"
                    >
                      <Trash2 className="w-4 h-4 shrink-0" />
                      <span>
                        {reservation.series_id
                          ? t("reservationDetail.cancelThisOccurrence")
                          : t("reservationDetail.cancelReservation")}
                      </span>
                    </button>

                    {reservation.series_id && (
                      <button
                        type="button"
                        onClick={() => setCancelPrompt("series")}
                        className="min-h-[48px] px-3.5 py-2 bg-red-600 hover:bg-red-700 text-white text-sm font-bold rounded-xl transition flex items-center gap-1.5 cursor-pointer shadow-xs whitespace-nowrap shrink-0 touch-manipulation"
                      >
                        <Repeat className="w-4 h-4 shrink-0" />
                        <span>{t("reservationDetail.cancelEntireSeries")}</span>
                      </button>
                    )}
                  </div>
                )
              )}

              {isAdminViewer && isCompleted && (
                <div className="flex items-center gap-2 shrink-0">
                  {canUnmarkNoShow ? (
                    <button
                      type="button"
                      onClick={handleUnmarkNoShow}
                      disabled={isNoShowProcessing}
                      className="min-h-[48px] px-3.5 py-2 bg-stone-100 hover:bg-stone-200 text-stone-800 border border-stone-300 text-sm font-bold rounded-xl transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50 whitespace-nowrap shrink-0 touch-manipulation"
                    >
                      {isNoShowProcessing ? (
                        <div className="w-4 h-4 border-2 border-stone-800 border-t-transparent rounded-full animate-spin" />
                      ) : (
                        <Check className="w-4 h-4 text-stone-700 shrink-0" />
                      )}
                      <span>{t("common.unmarkNoShow")}</span>
                    </button>
                  ) : canMarkNoShow ? (
                    <button
                      type="button"
                      onClick={handleMarkNoShow}
                      disabled={isNoShowProcessing}
                      className="min-h-[48px] px-3.5 py-2 bg-rose-50 hover:bg-rose-100 text-rose-800 border border-rose-200 text-sm font-bold rounded-xl transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50 shadow-2xs whitespace-nowrap shrink-0 touch-manipulation"
                    >
                      {isNoShowProcessing ? (
                        <div className="w-4 h-4 border-2 border-rose-800 border-t-transparent rounded-full animate-spin" />
                      ) : (
                        <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                      )}
                      <span>{t("common.markNoShow")}</span>
                    </button>
                  ) : null}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
      {showPolicyExplainer && (
        <PolicyExplainerModal
          isOpen={showPolicyExplainer}
          onClose={() => setShowPolicyExplainer(false)}
        />
      )}
    </div>
  );
};
