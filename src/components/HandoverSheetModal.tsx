import React, { useState, useEffect, useCallback, useRef } from "react";
import { useTranslation } from "react-i18next";
import { useAuth } from "../contexts/AuthContext.tsx";
import {
  getTodayDateString,
  addDaysToDateString,
  formatDisplayDate,
  formatHhmmTo12Hour,
} from "../lib/date-utils";
import {
  FileSpreadsheet,
  Download,
  Calendar,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Clock,
  Music2,
  Phone,
  User,
  X,
  CheckCircle2,
  AlertCircle,
  FileText,
  Tag,
  FileDown,
  Share2,
  Check,
} from "lucide-react";
import {
  HandoverReservationItem,
  HandoverExportFormat,
  getHandoverFileName,
  downloadHandoverExport,
} from "../lib/handover-export";

import {
  buildHandoverWhatsAppMessage,
  shareHandoverMessage,
} from "../lib/handover-templates";
export interface HandoverSheetModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultDate?: string;
  defaultMode?: "day" | "week";
  defaultFormat?: HandoverExportFormat;
}

export const HandoverSheetModal: React.FC<HandoverSheetModalProps> = ({
  isOpen,
  onClose,
  defaultDate,
  defaultMode = "day",
  defaultFormat = "xlsx",
}) => {
  const { sessionToken } = useAuth();
  const { t, i18n } = useTranslation();
  const isRTL = i18n.language === "ar";

  // Mode: "day" | "week"
  const [viewMode, setViewMode] = useState<"day" | "week">(defaultMode);

  // Format: "xlsx" | "csv"
  const [exportFormat, setExportFormat] =
    useState<HandoverExportFormat>(defaultFormat);

  // Anchor date (YYYY-MM-DD)
  const [anchorDate, setAnchorDate] = useState<string>(() => {
    return defaultDate || getTodayDateString();
  });

  // Reference to hidden date picker input
  const dateInputRef = useRef<HTMLInputElement>(null);

  // Data state
  const [loading, setLoading] = useState<boolean>(false);
  const [exporting, setExporting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [reservations, setReservations] = useState<HandoverReservationItem[]>(
    [],
  );
  const [exportNotice, setExportNotice] = useState<string | null>(null);
  const [isCopied, setIsCopied] = useState<boolean>(false);

  // Compute startDate and endDate based on viewMode and anchorDate
  const startDate = anchorDate;
  const endDate =
    viewMode === "day" ? anchorDate : addDaysToDateString(anchorDate, 6);

  // Compute current expected file name
  const expectedFileName = getHandoverFileName(
    viewMode,
    startDate,
    endDate,
    exportFormat,
  );

  // Fetch handover sheet data from backend
  const fetchHandoverData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const token =
        sessionToken || localStorage.getItem("church_session_token_v1");
      const res = await fetch(
        `/api/admin/reservations/handover-sheet?startDate=${startDate}&endDate=${endDate}`,
        {
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token || ""}`,
          },
        },
      );

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || t("handover.loadErrorFallback"));
      }

      // Sort rows chronologically: Date ASC, then start time ASC
      const sorted = (data.reservations || []).sort(
        (a: HandoverReservationItem, b: HandoverReservationItem) => {
          const dateComp = (a.reservation_date || "").localeCompare(
            b.reservation_date || "",
          );
          if (dateComp !== 0) return dateComp;
          return (a.start_hhmm || "").localeCompare(b.start_hhmm || "");
        },
      );

      setReservations(sorted);
    } catch (err: any) {
      setError(err.message || t("handover.reservationErrorFallback"));
    } finally {
      setLoading(false);
    }
  }, [startDate, endDate, sessionToken, t]);

  // Refetch whenever startDate, endDate, or modal open status changes
  useEffect(() => {
    if (isOpen) {
      fetchHandoverData();
    }
  }, [isOpen, fetchHandoverData]);

  if (!isOpen) return null;

  // Navigation handlers
  const handlePrev = () => {
    const delta = viewMode === "day" ? -1 : -7;
    setAnchorDate((prev) => addDaysToDateString(prev, delta));
  };

  const handleNext = () => {
    const delta = viewMode === "day" ? 1 : 7;
    setAnchorDate((prev) => addDaysToDateString(prev, delta));
  };

  const handleResetToday = () => {
    setAnchorDate(getTodayDateString());
  };

  const handleDateClick = () => {
    if (dateInputRef.current) {
      if (typeof dateInputRef.current.showPicker === "function") {
        dateInputRef.current.showPicker();
      } else {
        dateInputRef.current.focus();
        dateInputRef.current.click();
      }
    }
  };

  // Generate and download export
  const handleExport = async () => {
    setExporting(true);
    try {
      const result = await downloadHandoverExport(
        reservations,
        expectedFileName,
        exportFormat,
      );

      if (result.isHeaderOnly) {
        setExportNotice(
          t("handover.exportedHeadersOnly", { fileName: expectedFileName }),
        );
      } else {
        setExportNotice(
          t("handover.exportSuccess", {
            fileName: expectedFileName,
            count: result.recordCount,
          }),
        );
      }

      setTimeout(() => {
        setExportNotice(null);
      }, 5000);
    } catch (err: any) {
      setError(err.message || t("handover.exportErrorFallback"));
    } finally {
      setExporting(false);
    }
  };

  // Enhancement B: Share to WhatsApp (grouped by date, Arabic labels, 12h times)
  const handleWhatsAppShare = async () => {
    try {
      // handleWhatsAppShare
      const channel = await shareHandoverMessage(reservations, {
        locale: "ar",
      });

      // Only show the "Copied" toast when we actually fell back to clipboard
      if (channel === "clipboard") {
        setIsCopied(true);
        setTimeout(() => setIsCopied(false), 3000);
      }
    } catch (err) {
      // Last-ditch fallback: copy manually
      const message = buildHandoverWhatsAppMessage(reservations, {
        locale: isRTL ? "ar" : "en",
      });
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(message);
        setIsCopied(true);
        setTimeout(() => setIsCopied(false), 3000);
      }
    }
  };

  const isToday = anchorDate === getTodayDateString();

  return (
    <div
      id="handover-sheet-modal-backdrop"
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 overflow-y-auto"
      onClick={onClose}
    >
      <div
        id="handover-sheet-modal-container"
        className="bg-white rounded-2xl sm:rounded-3xl border border-stone-200 shadow-2xl w-full max-w-5xl overflow-hidden flex flex-col max-h-[95vh] sm:max-h-[92vh] animate-in fade-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
        dir={isRTL ? "rtl" : "ltr"}
      >
        {/* 1. Title */}
        <div className="bg-stone-900 text-white px-5 py-4 sm:px-6 sm:py-5 flex items-center justify-between gap-4 shrink-0">
          {isRTL && (
            <button
              id="btn-close-handover-modal"
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-xl text-stone-400 hover:text-white hover:bg-stone-800 transition cursor-pointer"
              title={t("handover.close")}
            >
              <X className="w-5 h-5" />
            </button>
          )}

          <h2 className="text-base sm:text-lg font-bold text-white tracking-tight">
            {t("handover.title")}
          </h2>

          {!isRTL && (
            <button
              id="btn-close-handover-modal"
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-xl text-stone-400 hover:text-white hover:bg-stone-800 transition cursor-pointer"
              title={t("handover.close")}
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>

        {/* Notice Banner */}
        {exportNotice && (
          <div className="bg-emerald-50 border-b border-emerald-200 px-5 py-2.5 text-xs text-emerald-800 flex items-center justify-between gap-2 animate-in fade-in">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span className="font-semibold">{exportNotice}</span>
            </div>
            <button
              onClick={() => setExportNotice(null)}
              className="text-emerald-700 hover:text-emerald-900 font-bold text-xs"
            >
              {t("handover.dismiss")}
            </button>
          </div>
        )}

        {/* Controls Bar: 2. Control row + 3. Date display */}
        <div className="p-3 sm:p-5 bg-stone-50 border-b border-stone-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 sm:gap-3 shrink-0">
          {/* 2. Control row: [Day | Week] toggle — [XLSX | CSV | PDF] toggle — single row always */}
          <div className="flex flex-row items-center gap-1.5 sm:gap-2.5 w-full sm:w-auto min-w-0">
            {/* Day / Week Mode Toggle — narrow, fixed width on mobile */}
            <div className="inline-flex rounded-xl p-1 bg-stone-200/80 border border-stone-300/80 shrink-0 sm:flex-none">
              <button
                id="btn-toggle-day-view"
                type="button"
                onClick={() => setViewMode("day")}
                className={`flex-1 justify-center px-1.5 sm:px-3 py-1.5 rounded-lg text-[11px] sm:text-xs font-bold transition cursor-pointer flex items-center gap-1 min-w-0 ${
                  viewMode === "day"
                    ? "bg-white text-stone-900 shadow-xs"
                    : "text-stone-600 hover:text-stone-900"
                }`}
              >
                <Calendar className="w-3.5 h-3.5 text-amber-700 shrink-0" />
                <span className="whitespace-nowrap">{t("handover.day")}</span>
              </button>
              <button
                id="btn-toggle-week-view"
                type="button"
                onClick={() => setViewMode("week")}
                className={`flex-1 justify-center px-1.5 sm:px-3 py-1.5 rounded-lg text-[11px] sm:text-xs font-bold transition cursor-pointer flex items-center gap-1 min-w-0 ${
                  viewMode === "week"
                    ? "bg-white text-stone-900 shadow-xs"
                    : "text-stone-600 hover:text-stone-900"
                }`}
              >
                <CalendarDays className="w-3.5 h-3.5 text-amber-700 shrink-0" />
                <span className="whitespace-nowrap">{t("handover.week")}</span>
              </button>
            </div>

            {/* Export Format Selector: XLSX / CSV / PDF */}
            <div className="inline-flex rounded-xl p-1 bg-stone-200/80 border border-stone-300/80 flex-1 sm:flex-none min-w-0">
              <button
                id="btn-format-xlsx"
                type="button"
                onClick={() => setExportFormat("xlsx")}
                className={`flex-1 justify-center px-1.5 sm:px-3 py-1.5 rounded-lg text-[11px] sm:text-xs font-bold transition cursor-pointer flex items-center gap-1 min-w-0 ${
                  exportFormat === "xlsx"
                    ? "bg-amber-800 text-white shadow-xs"
                    : "text-stone-600 hover:text-stone-900"
                }`}
              >
                <FileSpreadsheet className="w-3.5 h-3.5 shrink-0" />
                <span className="whitespace-nowrap">XLSX</span>
              </button>
              <button
                id="btn-format-csv"
                type="button"
                onClick={() => setExportFormat("csv")}
                className={`flex-1 justify-center px-1.5 sm:px-3 py-1.5 rounded-lg text-[11px] sm:text-xs font-bold transition cursor-pointer flex items-center gap-1 min-w-0 ${
                  exportFormat === "csv"
                    ? "bg-amber-800 text-white shadow-xs"
                    : "text-stone-600 hover:text-stone-900"
                }`}
              >
                <FileText className="w-3.5 h-3.5 shrink-0" />
                <span className="whitespace-nowrap">CSV</span>
              </button>
              <button
                id="btn-format-pdf"
                type="button"
                onClick={() => setExportFormat("pdf")}
                className={`flex-1 justify-center px-1.5 sm:px-3 py-1.5 rounded-lg text-[11px] sm:text-xs font-bold transition cursor-pointer flex items-center gap-1 min-w-0 ${
                  exportFormat === "pdf"
                    ? "bg-amber-800 text-white shadow-xs"
                    : "text-stone-600 hover:text-stone-900"
                }`}
              >
                <FileDown className="w-3.5 h-3.5 shrink-0" />
                <span className="whitespace-nowrap">PDF</span>
              </button>
            </div>
          </div>

          {/* 3. Date display (clickable to open picker) + Today shortcut */}
          <div className="flex items-center justify-between sm:justify-start gap-1.5 flex-wrap w-full sm:w-auto">
            <button
              id="btn-nav-prev-range"
              type="button"
              onClick={handlePrev}
              disabled={loading}
              className="p-2 rounded-xl bg-white border border-stone-200 hover:bg-stone-100 text-stone-700 font-semibold transition cursor-pointer shadow-2xs disabled:opacity-50"
              title={t(
                viewMode === "day"
                  ? "handover.previousDay"
                  : "handover.previousWeek",
              )}
            >
              {isRTL ? (
                <ChevronRight className="w-4 h-4" />
              ) : (
                <ChevronLeft className="w-4 h-4" />
              )}
            </button>

            {/* Clickable Date Display */}
            <div className="relative inline-flex">
              <button
                id="btn-date-display-trigger"
                type="button"
                onClick={handleDateClick}
                className="flex-1 sm:flex-none justify-center px-3.5 py-1.5 bg-white hover:bg-stone-100/80 border border-stone-200 rounded-xl shadow-2xs flex items-center gap-2 text-xs font-bold text-stone-900 cursor-pointer transition"
                title={t("handover.datePicker")}
              >
                <Clock className="w-3.5 h-3.5 text-amber-700 shrink-0" />
                <span className="truncate">
                  {viewMode === "day" ? (
                    <span>
                      {formatDisplayDate(anchorDate)}
                      {isToday && (
                        <span className="ml-1.5 text-[10px] bg-amber-100 text-amber-900 font-extrabold px-1.5 py-0.5 rounded-md">
                          {t("handover.today")}
                        </span>
                      )}
                    </span>
                  ) : (
                    <span>
                      {isRTL ? (
                        <>
                          {formatDisplayDate(endDate)} –{" "}
                          {formatDisplayDate(startDate)}
                        </>
                      ) : (
                        <>
                          {formatDisplayDate(startDate)} –{" "}
                          {formatDisplayDate(endDate)}
                        </>
                      )}
                    </span>
                  )}
                </span>
              </button>
              <input
                ref={dateInputRef}
                type="date"
                value={anchorDate}
                onChange={(e) => {
                  if (e.target.value) {
                    setAnchorDate(e.target.value);
                  }
                }}
                className="sr-only"
                tabIndex={-1}
                aria-hidden="true"
              />
            </div>

            <button
              id="btn-nav-next-range"
              type="button"
              onClick={handleNext}
              disabled={loading}
              className="p-2 rounded-xl bg-white border border-stone-200 hover:bg-stone-100 text-stone-700 font-semibold transition cursor-pointer shadow-2xs disabled:opacity-50"
              title={t(
                viewMode === "day" ? "handover.nextDay" : "handover.nextWeek",
              )}
            >
              {isRTL ? (
                <ChevronLeft className="w-4 h-4" />
              ) : (
                <ChevronRight className="w-4 h-4" />
              )}
            </button>

            {/* Today shortcut */}
            {!isToday && (
              <button
                id="btn-jump-today"
                type="button"
                onClick={handleResetToday}
                className="px-2.5 py-1.5 text-xs font-bold text-amber-800 bg-amber-50 hover:bg-amber-100 border border-amber-200 rounded-xl transition cursor-pointer"
              >
                {t("handover.today")}
              </button>
            )}
          </div>
        </div>

        {/* Content Area */}
        <div className="p-3 sm:p-6 overflow-y-auto flex-1 space-y-3 sm:space-y-4 bg-stone-100/50">
          {/* 4. Row count summary: N booking(s) · 9 columns */}
          <div className="flex items-center justify-between text-xs text-stone-600 font-medium px-1">
            <span>
              {t("handover.bookingCount", { count: reservations.length })} · 9{" "}
              {t("handover.columns")}
            </span>
          </div>

          {/* 5. Table preview */}
          {error ? (
            <div className="p-6 bg-red-50 border border-red-200 rounded-2xl text-center space-y-2">
              <AlertCircle className="w-8 h-8 text-red-600 mx-auto" />
              <div className="text-xs font-bold text-red-800">
                {t("handover.errorLoading")}
              </div>
              <p className="text-xs text-red-700">{error}</p>
              <button
                onClick={fetchHandoverData}
                className="mt-2 px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-bold transition"
              >
                {t("handover.retry")}
              </button>
            </div>
          ) : loading ? (
            <div className="py-16 text-center space-y-3">
              <div className="w-8 h-8 border-3 border-stone-300 border-t-amber-800 rounded-full animate-spin mx-auto" />
              <div className="text-xs text-stone-500 font-medium">
                {t("handover.fetching")}
              </div>
            </div>
          ) : reservations.length === 0 ? (
            <div className="bg-white rounded-2xl border border-stone-200 p-8 text-center space-y-2 shadow-2xs">
              <h3 className="text-sm font-bold text-stone-900">
                {t("handover.noReservationsTitle")}
              </h3>
              <p className="text-xs text-stone-500 max-w-md mx-auto leading-relaxed">
                {t("handover.noReservationsDescription")}
              </p>
            </div>
          ) : (
            <div className="relative bg-white rounded-2xl border border-stone-200 shadow-2xs overflow-hidden">
              <div className="overflow-x-auto">
                <table
                  className={`w-full text-xs ${isRTL ? "text-right" : "text-left"}`}
                >
                  <thead className="bg-slate-900 text-white border-b border-slate-800 font-bold">
                    <tr>
                      <th className="py-3 px-3 text-slate-300 font-mono text-[11px] text-center w-8">
                        #
                      </th>
                      <th className="py-3 px-3 text-center">
                        {t("handover.date")}
                      </th>
                      <th className="py-3 px-3 text-center">
                        {t("handover.startTime")}
                      </th>
                      <th className="py-3 px-3 text-center">
                        {t("handover.endTime")}
                      </th>
                      <th className="py-3 px-3">{t("handover.instrument")}</th>
                      <th className="py-3 px-3">{t("handover.category")}</th>
                      <th className="py-3 px-3">{t("handover.serviceName")}</th>
                      <th className="py-3 px-3">
                        {t("handover.musicianName")}
                      </th>
                      <th className="py-3 px-3">{t("handover.reservedBy")}</th>
                      <th className="py-3 px-3">{t("handover.phoneNumber")}</th>
                      <th className="py-3 px-3 text-center">
                        {t("handover.usageType")}
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-100">
                    {reservations.map((r, idx) => {
                      const startTime12 = r.start_hhmm
                        ? formatHhmmTo12Hour(r.start_hhmm)
                        : "";
                      const endTime12 = r.end_hhmm
                        ? formatHhmmTo12Hour(r.end_hhmm)
                        : "";
                      const isOutside = r.reservation_type === "outside_church";
                      const isEven = idx % 2 === 0;

                      return (
                        <tr
                          key={r.id || idx}
                          className={`transition ${isEven ? "bg-white" : "bg-slate-50/60"} hover:bg-amber-50/40`}
                        >
                          <td className="py-2.5 px-3 text-stone-400 font-mono text-[11px] text-center">
                            {idx + 1}
                          </td>
                          <td className="py-2.5 px-3 font-semibold text-stone-900 whitespace-nowrap text-center">
                            {r.reservation_date}
                          </td>
                          <td className="py-2.5 px-3 whitespace-nowrap text-center font-bold text-stone-800">
                            {startTime12}
                          </td>
                          <td className="py-2.5 px-3 whitespace-nowrap text-center text-stone-700">
                            {endTime12}
                          </td>
                          <td className="py-2.5 px-3">
                            <div className="font-bold text-stone-900 flex items-center gap-1.5">
                              <Music2 className="w-3.5 h-3.5 text-amber-800 shrink-0" />
                              <span className="truncate max-w-[130px]">
                                {r.instrument_name}
                              </span>
                            </div>
                          </td>
                          <td className="py-2.5 px-3 text-stone-600 whitespace-nowrap">
                            {r.instrument_type}
                          </td>
                          <td className="py-2.5 px-3 whitespace-nowrap">
                            <span className="inline-flex items-center gap-1 text-stone-700 font-medium">
                              <Tag className="w-3 h-3 text-stone-400 shrink-0" />
                              <span className="truncate max-w-[120px]">
                                {r.service_name || t("handover.generalService")}
                              </span>
                            </span>
                          </td>
                          <td className="py-2.5 px-3 font-semibold text-stone-800 whitespace-nowrap">
                            {r.musician_name}
                          </td>
                          <td className="py-2.5 px-3">
                            <div className="font-semibold text-stone-900 flex items-center gap-1">
                              <User className="w-3.5 h-3.5 text-stone-400 shrink-0" />
                              <span className="truncate max-w-[120px]">
                                {r.user_name}
                              </span>
                            </div>
                          </td>
                          <td className="py-2.5 px-3 font-mono text-stone-700 whitespace-nowrap">
                            <div className="flex items-center gap-1">
                              <Phone className="w-3 h-3 text-stone-400" />
                              <span>{r.user_phone}</span>
                            </div>
                          </td>
                          <td className="py-2.5 px-3 whitespace-nowrap text-center">
                            <span
                              className={`inline-block px-2.5 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider border ${
                                isOutside
                                  ? "bg-amber-100 text-amber-900 border-amber-300 font-bold"
                                  : "bg-emerald-100 text-emerald-900 border-emerald-300 font-bold"
                              }`}
                            >
                              {isOutside
                                ? t("handover.outside")
                                : t("handover.inChurch")}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              {/* Mobile scroll hint: right-edge fade so users know they can swipe */}
              <div className="pointer-events-none absolute inset-y-0 end-0 w-8 bg-gradient-to-l from-white to-transparent sm:hidden" />
            </div>
          )}
        </div>

        {/* Footer: 6. Filename display (desktop) + 7. Action buttons */}
        <div className="p-3 sm:p-5 bg-white border-t border-stone-200 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2.5 sm:gap-3 shrink-0">
          {/* 6. Filename display — desktop only */}
          <div className="hidden sm:flex text-xs text-stone-500 font-mono items-center gap-2">
            <span className="text-stone-400 font-sans">
              {t("handover.filename")}
            </span>
            <span className="font-bold text-stone-800 bg-stone-100 px-2 py-1 rounded-lg border border-stone-200">
              {expectedFileName}
            </span>
          </div>

          {/* 7. Action buttons — one row on mobile: Close → (gap) → WhatsApp → Export */}
          <div
            className={`flex items-center gap-2 w-full sm:w-auto ${isRTL ? "flex-row-reverse" : ""}`}
          >
            {/* Close — tight, natural width */}
            <button
              type="button"
              onClick={onClose}
              className="flex-none px-3 sm:px-4 py-2.5 rounded-xl text-xs font-semibold text-stone-700 bg-stone-100 hover:bg-stone-200 border border-stone-200 sm:border-0 sm:bg-transparent transition cursor-pointer whitespace-nowrap"
            >
              {t("handover.close")}
            </button>

            {/* Flexible spacer — pushes WhatsApp + Export to the end on mobile */}
            <div className="flex-1 sm:hidden" aria-hidden="true" />

            {/* WhatsApp Share Button — natural width, no stretching */}
            <button
              id="btn-handover-whatsapp"
              type="button"
              onClick={handleWhatsAppShare}
              disabled={loading}
              title={t("handover.shareWhatsAppSummary")}
              className="flex-none px-3 sm:px-3.5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-xs hover:shadow-sm transition flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              {isCopied ? (
                <>
                  <Check className="w-4 h-4 text-emerald-100 shrink-0" />
                  <span className="whitespace-nowrap">
                    {t("handover.copiedMessage")}
                  </span>
                </>
              ) : (
                <>
                  <Share2 className="w-4 h-4 shrink-0" />
                  <span>WhatsApp</span>
                </>
              )}
            </button>

            {/* Export — natural width, no stretching */}
            <button
              id="btn-export-confirm"
              type="button"
              onClick={handleExport}
              disabled={loading || exporting}
              className="flex-none px-3 sm:px-5 py-2.5 rounded-xl bg-amber-800 hover:bg-amber-900 text-white font-bold text-xs shadow-xs hover:shadow-sm transition flex items-center justify-center gap-1.5 sm:gap-2 cursor-pointer disabled:opacity-50"
            >
              <Download
                className={`w-4 h-4 shrink-0 ${exporting ? "animate-bounce" : ""}`}
              />
              <span className="whitespace-nowrap">
                {exporting
                  ? t("handover.generating")
                  : exportFormat.toUpperCase()}
              </span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
