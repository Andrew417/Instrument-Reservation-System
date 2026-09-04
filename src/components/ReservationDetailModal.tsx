import React, { useState, useEffect, useRef } from "react";
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
  onEdit: (reservation: any) => void;
  onCancelled: () => void;
  onNavigateToReservation?: (id: string) => void;
  initialTab?: "details" | "chat";
}

export const ReservationDetailModal: React.FC<ReservationDetailModalProps> = ({
  reservationId,
  allInstruments,
  onClose,
  onBack,
  onEdit,
  onCancelled,
  onNavigateToReservation,
  initialTab = "details",
}) => {
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

  // Instapay copy feedback
  const [copiedNumber, setCopiedNumber] = useState<boolean>(false);

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
            (isAdminViewer ? "Church Administrator" : "Member"),
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
        setReplyError(data.error || "Failed to send message. Please try again.");
      }
    } catch (err: any) {
      setReplyError(err.message || "Failed to send message. Please try again.");
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
        setErrorMsg(data.error || "Failed to load reservation details.");
        setLoading(false);
        return;
      }
      setReservation(data.reservation);

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
      setErrorMsg(err.message || "Network error fetching reservation details.");
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
      setErrorMsg("Please select a valid image file (PNG, JPG, JPEG, WEBP).");
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setErrorMsg("Image size should be less than 5MB.");
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
          setErrorMsg("Failed to process image file.");
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
          setErrorMsg(data.error || "Failed to upload screenshot.");
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
      setErrorMsg(err.message || "Failed to read image file.");
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
        setErrorMsg(data.error || "Failed to cancel reservation.");
        setIsCancelling(false);
        setCancelPrompt(null);
        return;
      }

      setIsCancelling(false);
      setCancelPrompt(null);
      onCancelled();
      onClose();
    } catch (err: any) {
      setErrorMsg(
        err.message || "Error occurred while processing cancellation.",
      );
      setIsCancelling(false);
      setCancelPrompt(null);
    }
  };

  const handleAdminApprove = async (mode: "single" | "series" = "single") => {
    if (!isAdminViewer || isApproving) return;
    setIsApproving(true);
    setApprovingMode(mode);
    setErrorMsg(null);
    try {
      let url = `/api/reservations/admin/${reservationId}/approve`;
      if (mode === "series" && reservation?.series_id) {
        url = `/api/reservations/admin/series/${reservation.series_id}/approve-all`;
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
        setErrorMsg(data.error || "Failed to approve reservation.");
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
            ? "All occurrences in recurring series approved successfully."
            : "Reservation request approved successfully.",
        type: "success",
      });

      setIsRejectOpen(false);
      onCancelled(); // Refresh parent view / master calendar
    } catch (err: any) {
      setErrorMsg(err.message || "Network error approving reservation.");
    } finally {
      setIsApproving(false);
      setApprovingMode(null);
    }
  };

  const handleAdminReject = async () => {
    if (!isAdminViewer || isRejecting) return;
    if (!rejectReason.trim()) {
      setRejectError(
        "Please provide an explanation for the member before submitting.",
      );
      return;
    }

    setRejectError(null);
    setIsRejecting(true);
    setErrorMsg(null);

    try {
      let url = `/api/reservations/admin/${reservationId}/reject`;
      if (rejectMode === "series" && reservation?.series_id) {
        url = `/api/reservations/admin/series/${reservation.series_id}/reject-all`;
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
        setErrorMsg(data.error || "Failed to reject reservation.");
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
            ? "All occurrences in recurring series rejected."
            : "Reservation request rejected.",
        type: "success",
      });

      onCancelled(); // Refresh parent view / master calendar
    } catch (err: any) {
      setErrorMsg(err.message || "Network error rejecting reservation.");
    } finally {
      setIsRejecting(false);
    }
  };

  if (loading) {
    return (
      <div
        id="reservation-detail-modal-backdrop"
        className="fixed inset-0 z-50 bg-stone-900/60 backdrop-blur-xs flex items-center justify-center p-4"
      >
        <div className="bg-white rounded-3xl p-8 max-w-md w-full text-center space-y-4 shadow-2xl border border-stone-200">
          <div className="w-10 h-10 border-3 border-amber-800 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-xs font-bold text-stone-600">
            Loading Reservation Details...
          </p>
        </div>
      </div>
    );
  }

  if (!reservation) {
    return (
      <div
        id="reservation-detail-modal-backdrop"
        className="fixed inset-0 z-50 bg-stone-900/60 backdrop-blur-xs flex items-center justify-center p-4"
      >
        <div className="bg-white rounded-3xl p-6 max-w-md w-full space-y-4 shadow-2xl border border-stone-200">
          <div className="flex items-center gap-3 text-red-700">
            <AlertCircle className="w-6 h-6" />
            <h3 className="font-bold text-sm">Reservation Not Found</h3>
          </div>
          <p className="text-xs text-stone-600 leading-relaxed">
            {errorMsg || "The requested reservation could not be loaded."}
          </p>
          <div className="flex items-center gap-2">
            {onBack ? (
              <button
                id="reservation-detail-notfound-back-btn"
                onClick={onBack}
                className="flex-1 py-2.5 bg-stone-100 hover:bg-stone-200 text-stone-700 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer transition"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Back to Notifications</span>
              </button>
            ) : null}
            <button
              onClick={onClose}
              className="flex-1 py-2.5 bg-stone-900 hover:bg-stone-800 text-white rounded-xl text-xs font-bold cursor-pointer transition"
            >
              Close
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
  const isOutsideChurch = reservation.reservation_type === "outside_church";
  const isApprovedOutsideChurch = isApproved && isOutsideChurch;

  return (
    <div
      id="reservation-detail-modal-backdrop"
      className="fixed inset-0 z-50 bg-stone-900/60 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 overflow-y-auto"
    >
      <div
        id="reservation-detail-modal"
        className="bg-white rounded-2xl sm:rounded-3xl border border-stone-200 shadow-2xl max-w-2xl w-full my-auto overflow-hidden animate-in fade-in zoom-in-95 duration-150 h-[92vh] max-h-[92vh] flex flex-col"
      >
        {/* Header */}
        <div className="bg-stone-900 text-white px-4 sm:px-6 py-3 sm:py-4 flex items-center justify-between border-b border-stone-800 shrink-0">
          <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
            {onBack && (
              <button
                type="button"
                id="reservation-detail-back-btn"
                onClick={onBack}
                className="w-8 h-8 rounded-xl bg-stone-800 text-stone-300 hover:text-white hover:bg-stone-700 flex items-center justify-center transition cursor-pointer shrink-0"
                title="Back to notifications"
                aria-label="Back to notifications"
              >
                <ArrowLeft className="w-4 h-4" />
              </button>
            )}
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-2xl bg-amber-800 text-amber-100 flex items-center justify-center font-bold shadow-xs shrink-0">
              <FileText className="w-4 h-4 sm:w-5 sm:h-5" />
            </div>
            <div className="min-w-0">
              <h2 className="text-sm sm:text-base font-bold text-white leading-tight truncate">
                Reservation Detail
              </h2>
              <p className="text-[11px] text-stone-400 font-mono truncate">
                #{reservation.id.substring(0, 8)} • {reservation.instrument_name || "Instrument"}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-8 h-8 rounded-xl bg-stone-800 text-stone-400 hover:text-white hover:bg-stone-700 flex items-center justify-center transition cursor-pointer shrink-0 ml-2"
            aria-label="Close modal"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tab Navigation (Mobile-first Segmented Control) */}
        <div className="bg-stone-900 border-b border-stone-800 px-3 sm:px-6 pt-1 flex items-center justify-between shrink-0 select-none">
          <div className="flex items-center gap-1.5 sm:gap-2">
            <button
              type="button"
              id="tab-btn-details"
              onClick={() => setActiveTab("details")}
              className={`px-3.5 sm:px-5 py-2 text-xs font-bold rounded-t-xl transition cursor-pointer flex items-center gap-1.5 sm:gap-2 border-b-2 ${
                activeTab === "details"
                  ? "bg-white text-stone-900 border-amber-700 shadow-xs"
                  : "text-stone-400 hover:text-stone-200 border-transparent hover:bg-stone-800/60"
              }`}
            >
              <FileText className="w-3.5 h-3.5" />
              <span>Details</span>
            </button>

            <button
              type="button"
              id="tab-btn-chat"
              onClick={() => {
                setActiveTab("chat");
                setTimeout(() => {
                  messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
                  chatInputRef.current?.focus();
                }, 80);
              }}
              className={`px-3.5 sm:px-5 py-2 text-xs font-bold rounded-t-xl transition cursor-pointer flex items-center gap-1.5 sm:gap-2 border-b-2 ${
                activeTab === "chat"
                  ? "bg-white text-stone-900 border-amber-700 shadow-xs"
                  : "text-stone-400 hover:text-stone-200 border-transparent hover:bg-stone-800/60"
              }`}
            >
              <MessageSquare className="w-3.5 h-3.5" />
              <span>Chat & Notes</span>
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

          <div className="flex items-center gap-2 pb-1">
            {reservation.rejection_reason && activeTab === "details" && (
              <button
                type="button"
                onClick={() => {
                  setActiveTab("chat");
                  setTimeout(() => {
                    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
                    chatInputRef.current?.focus();
                  }, 80);
                }}
                className="text-[10px] sm:text-[11px] font-semibold text-red-300 hover:text-red-200 bg-red-950/70 border border-red-800 px-2 py-1 rounded-lg flex items-center gap-1 transition cursor-pointer"
                title="View rejection reason and reply in chat"
              >
                <AlertCircle className="w-3 h-3 text-red-400" />
                <span className="hidden xs:inline">Rejected •</span>
                <span>Reply</span>
              </button>
            )}

            <span
              className={`hidden sm:inline-flex px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                isApproved
                  ? "bg-emerald-950/80 text-emerald-300 border border-emerald-800"
                  : isPending
                    ? "bg-amber-950/80 text-amber-300 border border-amber-800"
                    : "bg-stone-800 text-stone-300 border border-stone-700"
              }`}
            >
              {reservation.status}
            </span>
          </div>
        </div>

        {/* Scrollable Content */}
        {activeTab === "details" ? (
        <div className="p-4 sm:p-6 overflow-y-auto space-y-5 flex-1">
          {actionNotice && (
            <div
              id="admin-action-notice"
              className={`p-3.5 rounded-2xl border text-xs font-semibold flex items-center justify-between animate-in fade-in ${
                actionNotice.type === "success"
                  ? "bg-emerald-50 border-emerald-200 text-emerald-900"
                  : "bg-red-50 border-red-200 text-red-900"
              }`}
            >
              <div className="flex items-center gap-2">
                {actionNotice.type === "success" ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                ) : (
                  <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
                )}
                <span>{actionNotice.message}</span>
              </div>
              <button
                type="button"
                onClick={() => setActionNotice(null)}
                className="text-stone-400 hover:text-stone-600 p-1 cursor-pointer transition"
                aria-label="Dismiss notice"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {errorMsg && (
            <div className="bg-red-50 border border-red-200 rounded-2xl p-4 text-red-900 flex items-start gap-3 animate-in fade-in">
              <AlertCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
              <div className="text-xs space-y-1">
                <div className="font-bold text-red-950">Notice</div>
                <div className="text-red-800">{errorMsg}</div>
              </div>
            </div>
          )}

          {/* Inline Reject Panel for Admin */}
          {isAdminViewer && isPending && isRejectOpen && (
            <div
              id="admin-inline-reject-panel"
              className="bg-red-50/70 border-2 border-red-300 rounded-3xl p-5 space-y-4 animate-in fade-in slide-in-from-top-2 duration-150"
            >
              <div className="flex items-start justify-between gap-2 border-b border-red-200/80 pb-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-red-600 text-white flex items-center justify-center font-bold shadow-xs">
                    <XCircle className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-red-950">
                      Reject Reservation Request
                    </h3>
                    <p className="text-xs text-red-700">
                      Provide an explanation for the member
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setIsRejectOpen(false);
                    setRejectError(null);
                  }}
                  className="text-stone-400 hover:text-stone-600 p-1 rounded-lg hover:bg-stone-200/50 transition cursor-pointer"
                  aria-label="Cancel reject panel"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Summary recap reusing loaded data */}
              <div className="bg-white border border-red-200 rounded-2xl p-3.5 text-xs space-y-2.5">
                <span className="text-[10px] font-bold text-stone-500 uppercase tracking-wider block">
                  Request Summary Recap
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  <div>
                    <span className="text-stone-500 text-[11px] block">
                      Member
                    </span>
                    <span className="font-bold text-stone-900">
                      {reservation.user_name || "Church Member"}
                    </span>
                  </div>
                  <div>
                    <span className="text-stone-500 text-[11px] block">
                      Instrument
                    </span>
                    <span className="font-bold text-stone-900">
                      {reservation.instrument_name || "Instrument"}
                    </span>
                  </div>
                  <div>
                    <span className="text-stone-500 text-[11px] block">
                      Slot Time
                    </span>
                    <span className="font-bold text-stone-900">
                      {dateStr} • {timeStr}
                    </span>
                  </div>
                </div>

                {reservation.series_id && (
                  <div className="pt-2 border-t border-stone-100 flex flex-wrap items-center justify-between gap-2 text-xs">
                    <span className="text-stone-600 font-medium">
                      Rejection Scope:
                    </span>
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => setRejectMode("single")}
                        className={`px-2.5 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
                          rejectMode === "single"
                            ? "bg-red-700 text-white shadow-2xs"
                            : "bg-stone-100 text-stone-600 hover:bg-stone-200"
                        }`}
                      >
                        This Occurrence Only
                      </button>
                      <button
                        type="button"
                        onClick={() => setRejectMode("series")}
                        className={`px-2.5 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
                          rejectMode === "series"
                            ? "bg-red-700 text-white shadow-2xs"
                            : "bg-stone-100 text-stone-600 hover:bg-stone-200"
                        }`}
                      >
                        Entire Recurring Series (
                        {seriesOccurrences.length || "All"})
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Quick Reason Presets */}
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-stone-800">
                  Quick Reason Presets:
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
                      className={`text-xs px-2.5 py-1 rounded-xl transition cursor-pointer border text-left ${
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
                  Message to Member <span className="text-red-600">*</span>:
                </label>
                <textarea
                  id="admin-reject-reason-textarea"
                  value={rejectReason}
                  onChange={(e) => {
                    setRejectReason(e.target.value);
                    if (e.target.value.trim()) setRejectError(null);
                  }}
                  placeholder="Provide an explanation to the member regarding why this request cannot be fulfilled..."
                  rows={3}
                  className={`w-full text-xs p-3 rounded-xl border focus:outline-none focus:ring-2 focus:ring-red-500/20 bg-white text-stone-900 resize-none ${
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
              <div className="flex items-center justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => {
                    setIsRejectOpen(false);
                    setRejectError(null);
                  }}
                  disabled={isRejecting}
                  className="px-3.5 py-2 bg-stone-200 hover:bg-stone-300 text-stone-800 rounded-xl text-xs font-bold transition cursor-pointer"
                >
                  Cancel
                </button>

                <button
                  id="btn-confirm-admin-reject"
                  type="button"
                  onClick={handleAdminReject}
                  disabled={isRejecting}
                  className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-bold transition cursor-pointer flex items-center gap-1.5 shadow-xs disabled:opacity-50"
                >
                  {isRejecting ? (
                    <>
                      <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      <span>Processing Rejection...</span>
                    </>
                  ) : (
                    <>
                      <XCircle className="w-3.5 h-3.5" />
                      <span>
                        Confirm Reject
                        {rejectMode === "series" ? " Entire Series" : ""}
                      </span>
                    </>
                  )}
                </button>
              </div>
            </div>
          )}

          {/* 1. Status & Service Purpose + Requester Identity (merged) */}
          {isAdminViewer || reservation.user_name ? (
            <div
              id="reservation-summary-card"
              className="p-4.5 bg-stone-50 border border-stone-200 rounded-2xl space-y-3.5"
            >
              <div className="flex items-center justify-between gap-2 flex-nowrap">
                <div className="min-w-0 flex-1">
                  <span className="text-[11px] text-stone-500 font-semibold uppercase tracking-wider block">
                    Reservation Purpose
                  </span>
                  <span className="text-base font-bold text-stone-900 truncate block">
                    {reservation.service_name ||
                      reservation.serviceName ||
                      "Church Service"}
                  </span>
                </div>

                <span
                  className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider shrink-0 whitespace-nowrap ${
                    isApproved
                      ? "bg-emerald-100 text-emerald-900 border border-emerald-300"
                      : isPending
                        ? "bg-amber-100 text-amber-900 border border-amber-300"
                        : "bg-stone-200 text-stone-700 border border-stone-300"
                  }`}
                >
                  {isApproved ? (
                    <>
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-700" />
                      Approved
                    </>
                  ) : isPending ? (
                    <>
                      <Clock className="w-3.5 h-3.5 text-amber-700" />
                      Pending Review
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setShowPolicyExplainer(true);
                        }}
                        className="ml-0.5 text-amber-700 hover:text-amber-900 transition cursor-pointer"
                        title="Learn more about booking limits"
                      >
                        <Info className="w-3 h-3" />
                      </button>
                    </>
                  ) : (
                    <>
                      <X className="w-3.5 h-3.5 text-stone-500" />
                      {reservation.status}
                    </>
                  )}
                </span>
              </div>

              <div className="border-t border-stone-200 pt-3 space-y-2.5">
                <div className="flex items-center justify-between gap-2 flex-nowrap text-xs font-bold text-stone-800">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <User className="w-4 h-4 text-amber-800 shrink-0" />
                    <span className="truncate">Requester</span>
                  </div>
                  {reservation.user_is_trusted ? (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-100 text-amber-900 border border-amber-300 shrink-0 whitespace-nowrap">
                      <Shield className="w-3 h-3 text-amber-800" />
                      Trusted
                    </span>
                  ) : (
                    <span className="text-[10px] text-stone-500 font-normal shrink-0 whitespace-nowrap">
                      Standard Member
                    </span>
                  )}
                </div>

                <div className="flex flex-wrap items-center justify-between gap-3 text-xs">
                  <div>
                    <div className="font-bold text-stone-900 text-sm">
                      {reservation.user_name || "Church Member"}
                    </div>
                    {reservation.user_phone && (
                      <div className="flex items-center gap-1.5 text-stone-600 text-xs mt-0.5 font-mono">
                        <Phone className="w-3 h-3 text-stone-400" />
                        <span>{reservation.user_phone}</span>
                      </div>
                    )}
                  </div>

                  <div className="text-right text-[11px] text-stone-500">
                    <div>Request Submitted</div>
                    <div className="font-mono text-stone-700">
                      {new Date(
                        reservation.created_at || Date.now(),
                      ).toLocaleDateString("en-US", {
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

          {/* Rejection Reason notice if rejected */}
          {reservation.rejection_reason && (
            <div className="bg-red-50 border border-red-200 rounded-2xl p-4 flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
              <div className="text-xs space-y-1.5 flex-1">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-red-950">
                    Administrative Rejection Reason
                  </span>
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
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-red-100 hover:bg-red-200 text-red-900 font-bold text-xs transition cursor-pointer"
                  >
                    <MessageSquare className="w-3.5 h-3.5" />
                    Reply to Admin
                  </button>
                </div>
                <div className="text-red-800 leading-relaxed font-medium">
                  {reservation.rejection_reason}
                </div>
              </div>
            </div>
          )}

          {/* Cancellation Reason notice if admin-cancelled with a reason */}
          {reservation.status === "cancelled" &&
            reservation.cancellation_reason && (
              <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex items-start gap-3">
                <XCircle className="w-5 h-5 text-amber-700 shrink-0 mt-0.5" />
                <div className="text-xs space-y-1">
                  <div className="font-bold text-amber-950">
                    Cancellation Reason
                  </div>
                  <div className="text-amber-900 leading-relaxed">
                    {reservation.cancellation_reason}
                  </div>
                </div>
              </div>
            )}

          {/* 2. Full Info Grid: Instrument, Date/Time, Pricing & Financials */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Instrument Info Card */}
            <div className="p-4 bg-stone-50 border border-stone-200 rounded-2xl space-y-2.5">
              <div className="flex items-center gap-2 text-xs font-bold text-stone-800">
                <Music2 className="w-4 h-4 text-amber-800" />
                <span>Instrument Specifications</span>
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
                <div className="space-y-1 text-xs flex-1">
                  <div className="font-bold text-stone-900 text-sm">
                    {reservation.instrument_name || "Instrument"}
                  </div>
                  <div className="text-stone-500">
                    <span className="font-semibold text-stone-700">Type:</span>{" "}
                    {reservation.instrument_type || "General"}
                  </div>
                  <div className="text-stone-500">
                    <span className="font-semibold text-stone-700">
                      Booking Mode:
                    </span>{" "}
                    <span className="capitalize">
                      {reservation.booking_mode || "Manual"}
                    </span>
                  </div>
                  {reservation.instrument_description && (
                    <div className="text-stone-500 text-[11px] pt-1 italic">
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
                <span>Date & Time Slot</span>
              </div>
              <div className="space-y-1 text-xs">
                <div className="font-bold text-stone-900 text-sm">
                  {dateStr}
                </div>
                <div className="text-stone-700 font-semibold flex items-center gap-1.5 flex-wrap">
                  <span>{timeStr}</span>
                  <span className="text-stone-400">•</span>
                  <span className="text-stone-500 text-[11px] font-normal">
                    {durationHours} hr{Number(durationHours) > 1 ? "s" : ""}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* 3. Usage & Fee Breakdown */}
          <div className="p-4 bg-stone-50 border border-stone-200 rounded-2xl space-y-3">
            <div className="flex items-center justify-between gap-2 flex-nowrap text-xs font-bold text-stone-800">
              <span className="flex items-center gap-1.5 min-w-0">
                <DollarSign className="w-4 h-4 text-amber-800 shrink-0" />
                <span className="truncate">Usage & Fee</span>
              </span>
              <span
                className={`px-2 py-0.5 rounded-md text-[10px] font-bold shrink-0 whitespace-nowrap ${
                  isOutsideChurch
                    ? "bg-purple-100 text-purple-900 border border-purple-200"
                    : "bg-emerald-100 text-emerald-900 border border-emerald-200"
                }`}
              >
                {isOutsideChurch ? "Outside Church" : "In-Church Free"}
              </span>
            </div>

            {isOutsideChurch ? (
              <div className="text-xs text-purple-950 bg-purple-50/80 p-3 rounded-xl border border-purple-200/80 flex items-center justify-between">
                <div>
                  <div className="font-bold">Required Outside Usage Fee</div>
                  <div className="text-[11px] text-purple-800">
                    Calculated daily rate snapshot at submission time
                  </div>
                </div>
                <div className="text-right">
                  <span className="text-base font-bold text-purple-900">
                    EGP{" "}
                    {reservation.fee_snapshot ||
                      reservation.outside_fee_per_day ||
                      0}
                  </span>
                </div>
              </div>
            ) : (
              <p className="text-xs text-stone-500">
                In-church usage, choir reservations and prayer meetings are free
                of charge.
              </p>
            )}
          </div>

          {/* 4. If Approved and Outside-Church: Instapay & Payment Screenshot Upload */}
          {isApprovedOutsideChurch && (
            <div className="border-2 border-purple-200 bg-purple-50/50 rounded-3xl p-5 sm:p-6 space-y-5 animate-in fade-in">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-2xl bg-purple-700 text-white flex items-center justify-center font-bold shadow-xs">
                  <DollarSign className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-purple-950">
                    Outside Usage Payment (Instapay)
                  </h3>
                  <p className="text-xs text-purple-800">
                    Please transfer the fee of{" "}
                    <strong>EGP {reservation.fee_snapshot || 0}</strong> via
                    Instapay
                  </p>
                </div>
              </div>

              {/* Instapay Number & Link Box */}
              {paymentSettings && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-white p-4 rounded-2xl border border-purple-200 shadow-2xs">
                  <div className="space-y-1">
                    <span className="text-[10px] font-bold uppercase text-stone-500 tracking-wider">
                      Instapay Phone / Account
                    </span>
                    <div className="flex items-center justify-between bg-stone-50 border border-stone-200 rounded-xl px-3 py-1.5">
                      <span className="font-mono font-bold text-xs text-stone-900">
                        {paymentSettings.instapayNumber}
                      </span>
                      <button
                        type="button"
                        onClick={handleCopyInstapay}
                        className="text-stone-500 hover:text-stone-900 transition p-1 cursor-pointer"
                        title="Copy phone number"
                      >
                        {copiedNumber ? (
                          <Check className="w-3.5 h-3.5 text-emerald-600" />
                        ) : (
                          <Copy className="w-3.5 h-3.5" />
                        )}
                      </button>
                    </div>
                  </div>

                  <div className="space-y-1">
                    <span className="text-[10px] font-bold uppercase text-stone-500 tracking-wider">
                      Instapay Direct Payment Link
                    </span>
                    <a
                      href={paymentSettings.instapayLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center justify-between bg-purple-100/70 hover:bg-purple-100 text-purple-900 border border-purple-200 rounded-xl px-3 py-1.5 text-xs font-bold transition cursor-pointer"
                    >
                      <span>Open Instapay Link</span>
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  </div>
                </div>
              )}

              {/* Payment Screenshot Upload Control */}
              <div className="space-y-3">
                <div className="flex items-center justify-between text-xs font-bold text-purple-950">
                  <span className="flex items-center gap-1.5">
                    <Upload className="w-4 h-4 text-purple-700" />
                    <span>Upload Payment Screenshot</span>
                  </span>
                  {reservation.payment_screenshot_url && (
                    <span className="text-emerald-700 flex items-center gap-1 text-[11px]">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      Receipt on File
                    </span>
                  )}
                </div>

                {/* Upload Drag & Drop Area */}
                <div
                  onDragEnter={handleDrag}
                  onDragLeave={handleDrag}
                  onDragOver={handleDrag}
                  onDrop={handleDrop}
                  onClick={() => fileInputRef.current?.click()}
                  className={`border-2 border-dashed rounded-2xl p-4 sm:p-5 text-center cursor-pointer transition flex flex-col items-center justify-center gap-2 ${
                    dragActive
                      ? "border-purple-600 bg-purple-100/50"
                      : "border-purple-300 bg-white hover:bg-purple-50/50"
                  }`}
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={(e) => {
                      if (e.target.files && e.target.files[0]) {
                        processScreenshotFile(e.target.files[0]);
                      }
                    }}
                    className="hidden"
                  />

                  {uploadingScreenshot ? (
                    <div className="flex items-center gap-2 text-xs font-bold text-purple-900 py-3">
                      <div className="w-4 h-4 border-2 border-purple-600 border-t-transparent rounded-full animate-spin" />
                      <span>Processing & Uploading Screenshot...</span>
                    </div>
                  ) : (
                    <>
                      <div className="w-10 h-10 rounded-2xl bg-purple-100 text-purple-800 flex items-center justify-center">
                        <Upload className="w-5 h-5" />
                      </div>
                      <div>
                        <span className="text-xs font-bold text-purple-950">
                          {reservation.payment_screenshot_url
                            ? "Click or drag to replace payment screenshot"
                            : "Click to select or drag and drop transfer receipt screenshot"}
                        </span>
                        <p className="text-[11px] text-purple-700 mt-0.5">
                          Supports PNG, JPG, JPEG (Max 5MB)
                        </p>
                      </div>
                    </>
                  )}
                </div>

                {screenshotSuccess && (
                  <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs font-bold text-emerald-900 flex items-center gap-2 animate-in fade-in">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>Payment screenshot uploaded successfully!</span>
                  </div>
                )}

                {/* Screenshot Preview if available */}
                {reservation.payment_screenshot_url && (
                  <div className="bg-white p-3 rounded-2xl border border-purple-200 space-y-2">
                    <div className="text-[11px] font-bold text-stone-700 flex items-center gap-1.5">
                      <ImageIcon className="w-3.5 h-3.5 text-purple-700" />
                      <span>Uploaded Payment Receipt Preview:</span>
                    </div>
                    <div className="relative rounded-xl overflow-hidden border border-stone-200 max-h-56 bg-stone-900 flex items-center justify-center">
                      <img
                        src={reservation.payment_screenshot_url}
                        alt="Payment Receipt Screenshot"
                        className="max-h-56 w-auto object-contain rounded-lg"
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* 5. Conversation & Administration Chat Preview */}
          <div className="p-4 bg-stone-50 border border-stone-200 rounded-2xl space-y-3.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <MessageSquare className="w-4 h-4 text-amber-800" />
                <span className="text-xs font-bold text-stone-900">
                  Conversation & Administration Notes
                </span>
                <span className="text-[11px] bg-stone-200 text-stone-700 font-semibold px-2 py-0.5 rounded-full">
                  {adminMessages.length}
                </span>
              </div>

              <button
                type="button"
                onClick={() => {
                  setActiveTab("chat");
                  setTimeout(() => {
                    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
                    chatInputRef.current?.focus();
                  }, 80);
                }}
                className="text-xs font-bold text-amber-900 hover:text-amber-950 flex items-center gap-1 cursor-pointer"
              >
                <span>Open Full Chat</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>

            {adminMessages.length === 0 ? (
              <div className="p-3.5 bg-white rounded-xl border border-stone-200 text-center space-y-2">
                <p className="text-xs text-stone-500 italic">
                  No messages or notes in this reservation thread yet.
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setActiveTab("chat");
                    setTimeout(() => chatInputRef.current?.focus(), 80);
                  }}
                  className="px-3.5 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-200 rounded-xl text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer transition"
                >
                  <MessageSquare className="w-3.5 h-3.5 text-amber-800" />
                  <span>Send a Message</span>
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                {/* Most recent message snippet */}
                {(() => {
                  const lastMsg = adminMessages[adminMessages.length - 1];
                  const isUser = lastMsg.sender_role === "user";
                  return (
                    <div className="bg-white p-3 rounded-xl border border-stone-200 text-xs space-y-1">
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="font-bold flex items-center gap-1.5">
                          {isUser ? (
                            <>
                              <User className="w-3 h-3 text-stone-500" />
                              <span className="text-stone-800">
                                {lastMsg.sender_name || "Member"}
                              </span>
                            </>
                          ) : (
                            <>
                              <Shield className="w-3 h-3 text-amber-800" />
                              <span className="text-amber-900">
                                {lastMsg.sender_name || "Church Administration"}
                              </span>
                            </>
                          )}
                        </span>
                        <span className="text-[10px] text-stone-400">
                          {formatMessageTime(lastMsg.created_at || lastMsg.createdAt)}
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
                      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
                      chatInputRef.current?.focus();
                    }, 80);
                  }}
                  className="w-full py-2 bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-200/80 text-xs font-bold rounded-xl transition flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <MessageSquare className="w-3.5 h-3.5" />
                  <span>
                    {isAdminViewer
                      ? "Open Chat & Reply to Member"
                      : "Open Chat & Reply to Administration"}
                  </span>
                </button>
              </div>
            )}
          </div>

          {/* 6. Recurring Series Occurrence Breakdown if applicable */}
          {reservation.series_id && (
            <div className="space-y-2.5">
              <div className="flex items-center justify-between text-xs font-bold text-stone-800">
                <div className="flex items-center gap-2">
                  <Repeat className="w-4 h-4 text-amber-800" />
                  <span>Part of Recurring Series</span>
                </div>
                <span className="text-[11px] text-stone-500 font-normal">
                  {seriesOccurrences.length} Occurrences Total
                </span>
              </div>

              <div className="border border-stone-200 rounded-2xl divide-y divide-stone-100 max-h-48 overflow-y-auto bg-stone-50/50">
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
                      className={`p-3 text-xs flex items-center justify-between transition ${
                        isCurrent
                          ? "bg-amber-100/50 font-bold border-l-4 border-l-amber-800"
                          : "hover:bg-stone-100 cursor-pointer"
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <span className="w-5 h-5 rounded-md bg-stone-200 text-stone-700 flex items-center justify-center text-[10px] font-bold">
                          {idx + 1}
                        </span>
                        <div>
                          <span className="text-stone-900 font-semibold">
                            {occDateStr}
                          </span>
                          <span className="text-stone-500 ml-2 text-[11px]">
                            at {occTimeStr}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                            occ.status === "approved"
                              ? "bg-emerald-100 text-emerald-800"
                              : occ.status === "pending"
                                ? "bg-amber-100 text-amber-800"
                                : "bg-stone-200 text-stone-600"
                          }`}
                        >
                          {occ.status}
                        </span>
                        {isCurrent && (
                          <span className="text-[10px] text-amber-900 bg-amber-200 px-1.5 py-0.5 rounded font-bold">
                            Viewing
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
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
                    ? "Confirm Cancel Entire Recurring Series?"
                    : "Confirm Cancel This Reservation?"}
                </span>
              </div>
              <p className="text-xs text-red-800 leading-relaxed">
                {cancelPrompt === "series"
                  ? "This will cancel all future occurrences of this series. Past occurrences will remain intact."
                  : "This time slot will immediately be freed up in the master calendar for other church members."}
              </p>

              {isAdminViewer && (
                <div className="space-y-2 pt-1">
                  <label className="block text-[11px] font-bold uppercase text-red-800">
                    Reason (optional, shown to member)
                  </label>
                  <select
                    value={cancelReasonPreset}
                    onChange={(e) => setCancelReasonPreset(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-red-200 rounded-xl text-xs text-stone-900 focus:outline-none focus:border-red-500"
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
                      placeholder="Describe the reason..."
                      className="w-full px-3 py-2 bg-white border border-red-200 rounded-xl text-xs text-stone-900 focus:outline-none focus:border-red-500"
                    />
                  )}
                </div>
              )}

              <div className="flex items-center gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setCancelPrompt(null)}
                  className="px-3.5 py-1.5 bg-stone-200 hover:bg-stone-300 text-stone-800 text-xs font-bold rounded-xl transition cursor-pointer"
                >
                  Keep Reservation
                </button>
                <button
                  type="button"
                  disabled={isCancelling}
                  onClick={() => handleCancelExecution(cancelPrompt)}
                  className="px-4 py-1.5 bg-red-600 hover:bg-red-700 text-white text-xs font-bold rounded-xl transition cursor-pointer flex items-center gap-1.5"
                >
                  {isCancelling ? "Cancelling..." : "Yes, Cancel Now"}
                </button>
              </div>
            </div>
          )}
        </div>
        ) : (
          /* DEDICATED MOBILE & DESKTOP CHAT SCREEN */
          <div className="flex-1 min-h-0 flex flex-col bg-stone-50/50">
            {/* Top compact context summary banner */}
            <div className="bg-white px-3.5 py-2.5 sm:px-5 sm:py-3 border-b border-stone-200 shrink-0 flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-8 h-8 rounded-xl bg-amber-100 text-amber-900 flex items-center justify-center shrink-0">
                  <Music2 className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <div className="font-bold text-xs text-stone-900 truncate">
                    {reservation.service_name || "Reservation"} • {reservation.instrument_name}
                  </div>
                  <div className="text-[11px] text-stone-500 font-medium">
                    {dateStr} ({timeStr})
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <span
                  className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                    isApproved
                      ? "bg-emerald-100 text-emerald-800 border border-emerald-200"
                      : isPending
                        ? "bg-amber-100 text-amber-800 border border-amber-200"
                        : "bg-stone-100 text-stone-600 border border-stone-200"
                  }`}
                >
                  {reservation.status}
                </span>

                <button
                  type="button"
                  onClick={() => setActiveTab("details")}
                  className="text-[11px] font-semibold text-stone-700 hover:text-stone-900 bg-stone-100 hover:bg-stone-200 px-2.5 py-1 rounded-lg border border-stone-200 transition cursor-pointer flex items-center gap-1"
                >
                  <span>Details</span>
                  <ArrowRight className="w-3 h-3" />
                </button>
              </div>
            </div>

            {/* Administrative Rejection Callout in Chat (if applicable) */}
            {reservation.rejection_reason && (
              <div className="mx-3 mt-3 sm:mx-5 sm:mt-3.5 p-3 rounded-xl bg-red-50 border border-red-200 flex items-start gap-2.5 shrink-0 animate-in fade-in">
                <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                <div className="text-xs space-y-0.5 min-w-0 flex-1">
                  <div className="font-bold text-red-950">Administrative Rejection Reason</div>
                  <p className="text-red-900 leading-relaxed font-medium text-[11px] sm:text-xs">
                    {reservation.rejection_reason}
                  </p>
                </div>
              </div>
            )}

            {/* Messages conversation feed */}
            <div className="flex-1 min-h-0 overflow-y-auto p-3 sm:p-5 space-y-3">
              {adminMessages.length === 0 ? (
                <div className="h-full min-h-[220px] flex flex-col items-center justify-center text-center p-6 space-y-2.5">
                  <div className="w-12 h-12 rounded-2xl bg-amber-50 border border-amber-200 text-amber-800 flex items-center justify-center shadow-2xs">
                    <MessageSquare className="w-6 h-6" />
                  </div>
                  <div className="space-y-1 max-w-xs">
                    <h4 className="text-xs font-bold text-stone-800">
                      No Messages in this Thread Yet
                    </h4>
                    <p className="text-[11px] text-stone-500 leading-relaxed">
                      {isAdminViewer
                        ? "Send a message or inquiry to the requesting member below."
                        : "Have a question or request regarding your reservation? Send a message to church administration below."}
                    </p>
                  </div>
                </div>
              ) : (
                <>
                  {adminMessages.map((msg) => {
                    const isUserMsg = msg.sender_role === "user";
                    const isMe = isAdminViewer ? !isUserMsg : isUserMsg;
                    const timeFormatted = formatMessageTime(msg.created_at || msg.createdAt);

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
                                <span>You</span>
                              ) : isUserMsg ? (
                                <>
                                  <User className="w-3 h-3 text-stone-500" />
                                  <span>{msg.sender_name || msg.user_name || "Member"}</span>
                                </>
                              ) : (
                                <>
                                  <Shield className="w-3 h-3 text-amber-800" />
                                  <span>{msg.sender_name || msg.admin_name || "Church Administration"}</span>
                                </>
                              )}
                            </span>
                            <span className={isMe ? "text-amber-300/80 font-mono text-[9px]" : "text-stone-400 font-mono text-[9px]"}>
                              {timeFormatted}
                            </span>
                          </div>

                          <p
                            className={`leading-relaxed whitespace-pre-wrap ${
                              isMe ? "text-amber-50 font-normal" : "text-stone-800 font-medium"
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

            {/* Quick replies on mobile for members */}
            {!isAdminViewer && reservation.rejection_reason && (
              <div className="px-3 pt-2 pb-0 flex items-center gap-1.5 overflow-x-auto no-scrollbar shrink-0">
                <span className="text-[10px] text-stone-400 font-medium shrink-0">Suggestions:</span>
                <button
                  type="button"
                  onClick={() => {
                    setReplyContent("Can I reschedule this session for another available date or time?");
                    chatInputRef.current?.focus();
                  }}
                  className="text-[11px] px-2.5 py-1 bg-white border border-stone-200 text-stone-700 rounded-full hover:border-amber-400 hover:text-amber-900 transition whitespace-nowrap shrink-0 cursor-pointer"
                >
                  Can I reschedule?
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setReplyContent("Is there an alternate instrument available for this date?");
                    chatInputRef.current?.focus();
                  }}
                  className="text-[11px] px-2.5 py-1 bg-white border border-stone-200 text-stone-700 rounded-full hover:border-amber-400 hover:text-amber-900 transition whitespace-nowrap shrink-0 cursor-pointer"
                >
                  Alternate instrument?
                </button>
              </div>
            )}

            {/* Sticky Bottom Input Bar */}
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
                      ? "Write a note or response to the member... (Enter to send)"
                      : "Type your reply or question... (Enter to send)"
                  }
                  className="w-full px-3.5 py-2 text-sm sm:text-xs bg-stone-50 focus:bg-white border border-stone-300 rounded-xl text-stone-900 placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-amber-700/30 focus:border-amber-700 transition resize-none"
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
                  Press <kbd className="px-1 py-0.5 bg-stone-100 rounded border border-stone-200 text-[9px] text-stone-600">Enter</kbd> to send, <kbd className="px-1 py-0.5 bg-stone-100 rounded border border-stone-200 text-[9px] text-stone-600">Shift+Enter</kbd> for newline
                </span>
                <span className="text-[10px] text-stone-400 sm:hidden">
                  Replies visible to member & admins
                </span>

                <button
                  type="submit"
                  id="btn-send-chat-tab"
                  disabled={!replyContent.trim() || sendingReply}
                  className="min-h-[40px] px-4 py-2 bg-amber-800 hover:bg-amber-900 active:bg-amber-950 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-bold rounded-xl transition shadow-2xs flex items-center justify-center gap-2 cursor-pointer ml-auto"
                >
                  {sendingReply ? (
                    <>
                      <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      <span>Sending...</span>
                    </>
                  ) : (
                    <>
                      <Send className="w-3.5 h-3.5" />
                      <span>Send Message</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Modal Actions Footer - Shown on Details Tab */}
        {activeTab === "details" && (
          <div className="p-3 sm:p-4 bg-stone-50 border-t border-stone-200 flex items-center justify-between gap-2 shrink-0 overflow-x-auto">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-stone-200 hover:bg-stone-300 text-stone-800 text-xs font-bold rounded-xl transition cursor-pointer"
            >
              Close
            </button>

            {/* Admin Pending Action Controls */}
            {isAdminViewer && isPending && !cancelPrompt ? (
              <div className="flex flex-nowrap items-center gap-1.5 shrink-0">
                <button
                  id="btn-footer-admin-reject"
                  type="button"
                  onClick={() => {
                    setIsRejectOpen(!isRejectOpen);
                    setRejectError(null);
                  }}
                  disabled={isApproving || isRejecting}
                  className={`px-3.5 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer border ${
                    isRejectOpen
                      ? "bg-stone-200 text-stone-800 border-stone-300"
                      : "bg-red-50 hover:bg-red-100 text-red-700 border-red-200"
                  }`}
                >
                  <XCircle className="w-3.5 h-3.5 text-red-600" />
                  <span>{isRejectOpen ? "Close Reject Form" : "Reject"}</span>
                </button>

                {reservation.series_id ? (
                  <>
                    <button
                      id="btn-footer-admin-approve-single"
                      type="button"
                      onClick={() => handleAdminApprove("single")}
                      disabled={isApproving || isRejecting}
                      className="px-3.5 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 text-xs font-bold rounded-xl transition flex items-center gap-1.5 cursor-pointer shadow-2xs disabled:opacity-50"
                    >
                      {isApproving && approvingMode === "single" ? (
                        <div className="w-3.5 h-3.5 border-2 border-emerald-800 border-t-transparent rounded-full animate-spin" />
                      ) : (
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-700" />
                      )}
                      <span>Approve Occurrence</span>
                    </button>

                    <button
                      id="btn-footer-admin-approve-series"
                      type="button"
                      onClick={() => handleAdminApprove("series")}
                      disabled={isApproving || isRejecting}
                      className="px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold rounded-xl transition flex items-center gap-1.5 cursor-pointer shadow-xs disabled:opacity-50"
                    >
                      {isApproving && approvingMode === "series" ? (
                        <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      ) : (
                        <CheckCircle2 className="w-3.5 h-3.5" />
                      )}
                      <span>
                        Approve Entire Series ({seriesOccurrences.length || "All"}
                        )
                      </span>
                    </button>
                  </>
                ) : (
                  <button
                    id="btn-footer-admin-approve-single"
                    type="button"
                    onClick={() => handleAdminApprove("single")}
                    disabled={isApproving || isRejecting}
                    className="px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold rounded-xl transition flex items-center gap-1.5 cursor-pointer shadow-xs disabled:opacity-50"
                  >
                    {isApproving ? (
                      <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <CheckCircle2 className="w-3.5 h-3.5" />
                    )}
                    <span>Approve</span>
                  </button>
                )}
              </div>
            ) : (
              !isPast &&
              !isCancelled &&
              !cancelPrompt && (
                <div className="flex items-center gap-2">
                  {/* Edit Single */}
                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      onEdit(reservation);
                    }}
                    className="px-3.5 py-2 bg-stone-100 hover:bg-stone-200 text-stone-800 border border-stone-300 text-xs font-bold rounded-xl transition flex items-center gap-1.5 cursor-pointer"
                  >
                    <Edit className="w-3.5 h-3.5" />
                    <span>Edit Slot</span>
                  </button>

                  {/* Single Cancel */}
                  <button
                    type="button"
                    onClick={() => setCancelPrompt("single")}
                    className="px-3.5 py-2 bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 text-xs font-bold rounded-xl transition flex items-center gap-1.5 cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>
                      {reservation.series_id
                        ? "Cancel This Occurrence"
                        : "Cancel Reservation"}
                    </span>
                  </button>

                  {/* Series Cancel if applicable */}
                  {reservation.series_id && (
                    <button
                      type="button"
                      onClick={() => setCancelPrompt("series")}
                      className="px-3.5 py-2 bg-red-600 hover:bg-red-700 text-white text-xs font-bold rounded-xl transition flex items-center gap-1.5 cursor-pointer shadow-xs"
                    >
                      <Repeat className="w-3.5 h-3.5" />
                      <span>Cancel Entire Series</span>
                    </button>
                  )}
                </div>
              )
            )}
          </div>
        )}
      </div>
    </div>
  );
};
