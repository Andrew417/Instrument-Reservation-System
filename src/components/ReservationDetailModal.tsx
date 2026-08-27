import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext.tsx';
import { Instrument } from './AvailabilityCalendar.tsx';
import {
  Calendar,
  Clock,
  Music2,
  DollarSign,
  Shield,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  X,
  Repeat,
  Sparkles,
  ArrowRight,
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
} from 'lucide-react';

export interface ReservationDetailModalProps {
  reservationId: string;
  allInstruments: Instrument[];
  onClose: () => void;
  onEdit: (reservation: any) => void;
  onCancelled: () => void;
  onNavigateToReservation?: (id: string) => void;
}

export const ReservationDetailModal: React.FC<ReservationDetailModalProps> = ({
  reservationId,
  allInstruments,
  onClose,
  onEdit,
  onCancelled,
  onNavigateToReservation,
}) => {
  const { profile, sessionToken } = useAuth();
  const [reservation, setReservation] = useState<any | null>(null);
  const [seriesOccurrences, setSeriesOccurrences] = useState<any[]>([]);
  const [adminMessages, setAdminMessages] = useState<any[]>([]);
  const [paymentSettings, setPaymentSettings] = useState<{
    instapayNumber: string;
    instapayLink: string;
  } | null>(null);

  const [loading, setLoading] = useState<boolean>(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Instapay copy feedback
  const [copiedNumber, setCopiedNumber] = useState<boolean>(false);

  // Payment Screenshot Upload State
  const [uploadingScreenshot, setUploadingScreenshot] = useState<boolean>(false);
  const [screenshotSuccess, setScreenshotSuccess] = useState<boolean>(false);
  const [dragActive, setDragActive] = useState<boolean>(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Cancellation State
  const [isCancelling, setIsCancelling] = useState<boolean>(false);
  const [cancelPrompt, setCancelPrompt] = useState<'single' | 'series' | null>(null);

  // Fetch full details of the reservation
  const loadReservationData = async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      // 1. Fetch Reservation Detail
      const res = await fetch(`/api/reservations/${reservationId}`);
      const data = await res.json();
      if (!res.ok || !data.success || !data.reservation) {
        setErrorMsg(data.error || 'Failed to load reservation details.');
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
      if (data.reservation.reservation_type === 'outside_church') {
        const payRes = await fetch('/api/reservations/payment-settings');
        const payData = await payRes.json();
        if (payData.success && payData.settings) {
          setPaymentSettings({
            instapayNumber: payData.settings.instapay_number || '0100 123 4567',
            instapayLink: payData.settings.instapay_link || 'https://ipn.eg/coptic-church-instruments',
          });
        }
      }

      // 4. If part of a series, fetch all series occurrences
      if (data.reservation.series_id) {
        const seriesRes = await fetch(`/api/reservations?seriesId=${data.reservation.series_id}`);
        const seriesData = await seriesRes.json();
        if (seriesData.success && Array.isArray(seriesData.reservations)) {
          setSeriesOccurrences(seriesData.reservations);
        }
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Network error fetching reservation details.');
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
    if (!file.type.startsWith('image/')) {
      setErrorMsg('Please select a valid image file (PNG, JPG, JPEG, WEBP).');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setErrorMsg('Image size should be less than 5MB.');
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
          setErrorMsg('Failed to process image file.');
          setUploadingScreenshot(false);
          return;
        }

        const res = await fetch(`/api/reservations/${reservationId}/payment-screenshot`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${sessionToken}`,
          },
          body: JSON.stringify({
            screenshotUrl: base64Url,
          }),
        });

        const data = await res.json();
        if (!res.ok || !data.success) {
          setErrorMsg(data.error || 'Failed to upload screenshot.');
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
      setErrorMsg(err.message || 'Failed to read image file.');
      setUploadingScreenshot(false);
    }
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
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

  const handleCancelExecution = async (mode: 'single' | 'series') => {
    if (!profile) return;
    setIsCancelling(true);
    setErrorMsg(null);
    try {
      const res = await fetch(`/api/reservations/${reservationId}/cancel`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${sessionToken}`,
        },
        body: JSON.stringify({
          userId: profile.id,
          cancelMode: mode,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        setErrorMsg(data.error || 'Failed to cancel reservation.');
        setIsCancelling(false);
        setCancelPrompt(null);
        return;
      }

      setIsCancelling(false);
      setCancelPrompt(null);
      onCancelled();
      onClose();
    } catch (err: any) {
      setErrorMsg(err.message || 'Error occurred while processing cancellation.');
      setIsCancelling(false);
      setCancelPrompt(null);
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
          <p className="text-xs font-bold text-stone-600">Loading Reservation Details...</p>
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
            {errorMsg || 'The requested reservation could not be loaded.'}
          </p>
          <button
            onClick={onClose}
            className="w-full py-2.5 bg-stone-900 text-white rounded-xl text-xs font-bold"
          >
            Close
          </button>
        </div>
      </div>
    );
  }

  const startUtc = new Date(reservation.start_time || reservation.startTime);
  const endUtc = new Date(reservation.end_time || reservation.endTime);
  const dateStr = startUtc.toISOString().split('T')[0];
  const timeStr = `${startUtc.toISOString().substring(11, 16)} – ${endUtc.toISOString().substring(11, 16)} UTC`;
  const durationHours = ((endUtc.getTime() - startUtc.getTime()) / (3600 * 1000)).toFixed(1).replace('.0', '');

  const isPast = endUtc < new Date();
  const isCancelled = reservation.status === 'cancelled' || reservation.status === 'rejected';
  const isApproved = reservation.status === 'approved' || reservation.status === 'ongoing' || reservation.status === 'completed';
  const isPending = reservation.status === 'pending';
  const isOutsideChurch = reservation.reservation_type === 'outside_church';
  const isApprovedOutsideChurch = isApproved && isOutsideChurch;

  return (
    <div
      id="reservation-detail-modal-backdrop"
      className="fixed inset-0 z-50 bg-stone-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto"
    >
      <div
        id="reservation-detail-modal"
        className="bg-white rounded-3xl border border-stone-200 shadow-2xl max-w-2xl w-full my-auto overflow-hidden animate-in fade-in zoom-in-95 duration-150 max-h-[92vh] flex flex-col"
      >
        {/* Header */}
        <div className="bg-stone-900 text-white px-6 py-5 flex items-center justify-between border-b border-stone-800 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-800 text-amber-100 flex items-center justify-center font-bold shadow-xs">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-white leading-tight">
                  Reservation Detail
                </h2>
                <span className="text-[11px] text-stone-400 font-mono">
                  (Screen 6)
                </span>
              </div>
              <p className="text-xs text-stone-400 font-mono">
                #{reservation.id.substring(0, 8)}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-8 h-8 rounded-xl bg-stone-800 text-stone-400 hover:text-white hover:bg-stone-700 flex items-center justify-center transition cursor-pointer"
            aria-label="Close modal"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="p-6 sm:p-7 overflow-y-auto space-y-6 flex-1">
          {errorMsg && (
            <div className="bg-red-50 border border-red-200 rounded-2xl p-4 text-red-900 flex items-start gap-3 animate-in fade-in">
              <AlertCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
              <div className="text-xs space-y-1">
                <div className="font-bold text-red-950">Notice</div>
                <div className="text-red-800">{errorMsg}</div>
              </div>
            </div>
          )}

          {/* 1. Status & Service Purpose Banner */}
          <div className="flex flex-wrap items-center justify-between gap-3 p-4.5 bg-stone-50 border border-stone-200 rounded-2xl">
            <div>
              <span className="text-[11px] text-stone-500 font-semibold uppercase tracking-wider block">
                Reservation Purpose
              </span>
              <span className="text-base font-bold text-stone-900">
                {reservation.service_name || reservation.serviceName || 'Church Service'}
              </span>
            </div>

            <div>
              <span
                className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider ${
                  isApproved
                    ? 'bg-emerald-100 text-emerald-900 border border-emerald-300'
                    : isPending
                    ? 'bg-amber-100 text-amber-900 border border-amber-300'
                    : 'bg-stone-200 text-stone-700 border border-stone-300'
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
                  </>
                ) : (
                  <>
                    <X className="w-3.5 h-3.5 text-stone-500" />
                    {reservation.status}
                  </>
                )}
              </span>
            </div>
          </div>

          {/* Rejection Reason notice if rejected */}
          {reservation.rejection_reason && (
            <div className="bg-red-50 border border-red-200 rounded-2xl p-4 flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
              <div className="text-xs space-y-1">
                <div className="font-bold text-red-950">Administrative Rejection Reason</div>
                <div className="text-red-800 leading-relaxed">{reservation.rejection_reason}</div>
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
              <div className="space-y-1 text-xs">
                <div className="font-bold text-stone-900 text-sm">
                  {reservation.instrument_name || 'Instrument'}
                </div>
                <div className="text-stone-500">
                  <span className="font-semibold text-stone-700">Type:</span> {reservation.instrument_type || 'General'}
                </div>
                <div className="text-stone-500">
                  <span className="font-semibold text-stone-700">Booking Mode:</span>{' '}
                  <span className="capitalize">{reservation.booking_mode || 'Manual'}</span>
                </div>
                {reservation.instrument_description && (
                  <div className="text-stone-500 text-[11px] pt-1 italic">
                    {reservation.instrument_description}
                  </div>
                )}
              </div>
            </div>

            {/* Date & Time Slot Card */}
            <div className="p-4 bg-stone-50 border border-stone-200 rounded-2xl space-y-2.5">
              <div className="flex items-center gap-2 text-xs font-bold text-stone-800">
                <Calendar className="w-4 h-4 text-amber-800" />
                <span>Date & Time Slot</span>
              </div>
              <div className="space-y-1 text-xs">
                <div className="font-bold text-stone-900 text-sm">{dateStr}</div>
                <div className="text-stone-700 font-semibold">{timeStr}</div>
                <div className="text-stone-500 text-[11px]">
                  Duration: {durationHours} hr{Number(durationHours) > 1 ? 's' : ''} (Working Hours: 09:00 - 22:00 UTC)
                </div>
              </div>
            </div>
          </div>

          {/* 3. Usage & Fee Breakdown */}
          <div className="p-4 bg-stone-50 border border-stone-200 rounded-2xl space-y-3">
            <div className="text-xs font-bold text-stone-800 flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <DollarSign className="w-4 h-4 text-amber-800" />
                <span>Usage Classification & Fee</span>
              </span>
              <span
                className={`px-2.5 py-0.5 rounded-md text-xs font-bold ${
                  isOutsideChurch
                    ? 'bg-purple-100 text-purple-900 border border-purple-200'
                    : 'bg-emerald-100 text-emerald-900 border border-emerald-200'
                }`}
              >
                {isOutsideChurch ? 'Outside Church Use' : 'In-Church Free Service'}
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
                    EGP {reservation.fee_snapshot || reservation.outside_fee_per_day || 0}
                  </span>
                </div>
              </div>
            ) : (
              <p className="text-xs text-stone-500">
                In-church liturgical and choir reservations are free of charge.
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
                    Please transfer the fee of <strong>EGP {reservation.fee_snapshot || 0}</strong> via Instapay
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
                      ? 'border-purple-600 bg-purple-100/50'
                      : 'border-purple-300 bg-white hover:bg-purple-50/50'
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
                            ? 'Click or drag to replace payment screenshot'
                            : 'Click to select or drag and drop transfer receipt screenshot'}
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

          {/* 5. Messages from Admin Section (Read-Only) */}
          <div className="p-4 bg-stone-50 border border-stone-200 rounded-2xl space-y-3">
            <div className="flex items-center justify-between text-xs font-bold text-stone-900">
              <div className="flex items-center gap-2">
                <MessageSquare className="w-4 h-4 text-amber-800" />
                <span>Messages from Admin</span>
              </div>
              <span className="text-[11px] text-stone-500 font-normal">
                {adminMessages.length} message{adminMessages.length === 1 ? '' : 's'}
              </span>
            </div>

            {adminMessages.length === 0 ? (
              <div className="p-4 bg-white rounded-xl border border-stone-200 text-center text-xs text-stone-500 italic">
                No administrative messages or notes for this reservation yet.
              </div>
            ) : (
              <div className="space-y-2.5 max-h-48 overflow-y-auto">
                {adminMessages.map((msg) => {
                  const msgDate = new Date(msg.created_at || msg.createdAt);
                  const msgDateFormatted = `${msgDate.toISOString().split('T')[0]} at ${msgDate.toISOString().substring(11, 16)} UTC`;

                  return (
                    <div
                      key={msg.id}
                      className="bg-white p-3.5 rounded-2xl border border-stone-200 text-xs space-y-1.5 shadow-2xs"
                    >
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="font-bold text-amber-900 flex items-center gap-1.5">
                          <Shield className="w-3.5 h-3.5 text-amber-800" />
                          {msg.admin_name || 'Church Administrator'}
                        </span>
                        <span className="text-stone-400 font-mono">{msgDateFormatted}</span>
                      </div>
                      <p className="text-stone-800 font-medium leading-relaxed">
                        {msg.content}
                      </p>
                    </div>
                  );
                })}
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
                  const occDateStr = occStart.toISOString().split('T')[0];
                  const occTimeStr = occStart.toISOString().substring(11, 16);
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
                          ? 'bg-amber-100/50 font-bold border-l-4 border-l-amber-800'
                          : 'hover:bg-stone-100 cursor-pointer'
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <span className="w-5 h-5 rounded-md bg-stone-200 text-stone-700 flex items-center justify-center text-[10px] font-bold">
                          {idx + 1}
                        </span>
                        <div>
                          <span className="text-stone-900 font-semibold">{occDateStr}</span>
                          <span className="text-stone-500 ml-2 text-[11px]">at {occTimeStr} UTC</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                            occ.status === 'approved'
                              ? 'bg-emerald-100 text-emerald-800'
                              : occ.status === 'pending'
                              ? 'bg-amber-100 text-amber-800'
                              : 'bg-stone-200 text-stone-600'
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
                  {cancelPrompt === 'series'
                    ? 'Confirm Cancel Entire Recurring Series?'
                    : 'Confirm Cancel This Reservation?'}
                </span>
              </div>
              <p className="text-xs text-red-800 leading-relaxed">
                {cancelPrompt === 'series'
                  ? 'This will cancel all future occurrences of this series. Past occurrences will remain intact.'
                  : 'This time slot will immediately be freed up in the master calendar for other church members.'}
              </p>

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
                  {isCancelling ? 'Cancelling...' : 'Yes, Cancel Now'}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Modal Actions Footer */}
        <div className="p-4 bg-stone-50 border-t border-stone-200 flex flex-wrap items-center justify-between gap-3 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2.5 bg-stone-200 hover:bg-stone-300 text-stone-800 text-xs font-bold rounded-xl transition cursor-pointer"
          >
            Close
          </button>

          {!isPast && !isCancelled && !cancelPrompt && (
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
                onClick={() => setCancelPrompt('single')}
                className="px-3.5 py-2 bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 text-xs font-bold rounded-xl transition flex items-center gap-1.5 cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>{reservation.series_id ? 'Cancel This Occurrence' : 'Cancel Reservation'}</span>
              </button>

              {/* Series Cancel if applicable */}
              {reservation.series_id && (
                <button
                  type="button"
                  onClick={() => setCancelPrompt('series')}
                  className="px-3.5 py-2 bg-red-600 hover:bg-red-700 text-white text-xs font-bold rounded-xl transition flex items-center gap-1.5 cursor-pointer shadow-xs"
                >
                  <Repeat className="w-3.5 h-3.5" />
                  <span>Cancel Entire Series</span>
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

