import React, { useState, useEffect, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useAuth } from "../contexts/AuthContext.tsx";
import { formatHhmmTo12Hour } from "../lib/date-utils";
import {
  Music2,
  Calendar,
  Clock,
  User,
  Church,
  AlertTriangle,
  CheckCircle2,
  X,
  Search,
  Sparkles,
  ShieldAlert,
  Archive,
  ChevronRight,
  Info,
} from "lucide-react";

export interface AssignmentOption {
  id: string;
  name: string;
  type: string;
  photoUrl: string | null;
  description: string | null;
  bookingMode: string;
  isRemoved: boolean;
  isCurrent: boolean;
  hasConflict: boolean;
  conflictDetails: string | null;
  categoryBadge: string;
}

export interface AssignInstrumentModalProps {
  isOpen: boolean;
  reservation: any;
  onClose: () => void;
  onSuccess: (updatedReservation: any) => void;
}

export const AssignInstrumentModal: React.FC<AssignInstrumentModalProps> = ({
  isOpen,
  reservation,
  onClose,
  onSuccess,
}) => {
  const { sessionToken } = useAuth();
  const { t, i18n } = useTranslation();
  const isAr = i18n.language === "ar";

  const [loading, setLoading] = useState<boolean>(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [options, setOptions] = useState<AssignmentOption[]>([]);
  const [selectedInstId, setSelectedInstId] = useState<string>("");
  const [serviceLocation, setServiceLocation] = useState<string>("");
  const [allocationNote, setAllocationNote] = useState<string>("");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [submitting, setSubmitting] = useState<boolean>(false);

  useEffect(() => {
    if (!isOpen || !reservation?.id) return;

    setServiceLocation(
      reservation.service_location || reservation.serviceLocation || "",
    );
    setSelectedInstId(
      reservation.instrument_id || reservation.instrumentId || "",
    );
    setAllocationNote("");
    setSearchQuery("");
    setCategoryFilter("all");
    setErrorMsg(null);
    setLoading(true);

    const fetchOptions = async () => {
      try {
        const token =
          sessionToken || localStorage.getItem("church_session_token_v1");
        const res = await fetch(
          `/api/admin/reservations/${reservation.id}/assignment-options`,
          {
            headers: {
              "Content-Type": "application/json",
              Authorization: token ? `Bearer ${token}` : "",
            },
          },
        );
        const data = await res.json();
        if (!res.ok || !data.success) {
          throw new Error(data.error || "Failed to load gear options");
        }

        setOptions(data.options || []);

        // If the current reservation is on a Reserve Pool placeholder, preselect the first available real instrument if possible
        const initialSelected = (data.options || []).find(
          (opt: AssignmentOption) =>
            opt.id === (reservation.instrument_id || reservation.instrumentId),
        );

        if (initialSelected && !initialSelected.hasConflict) {
          setSelectedInstId(initialSelected.id);
        } else {
          // Preselect first non-conflicting instrument
          const firstAvailable = (data.options || []).find(
            (opt: AssignmentOption) => !opt.hasConflict,
          );
          if (firstAvailable) {
            setSelectedInstId(firstAvailable.id);
          }
        }
      } catch (err: any) {
        setErrorMsg(err.message || "Failed to fetch allocation options");
      } finally {
        setLoading(false);
      }
    };

    fetchOptions();
  }, [isOpen, reservation, sessionToken]);

  // Unique categories for filter bar
  const categories = useMemo(() => {
    const set = new Set<string>();
    options.forEach((opt) => {
      if (opt.type) set.add(opt.type);
    });
    return Array.from(set);
  }, [options]);

  // Filtered list
  const filteredOptions = useMemo(() => {
    return options.filter((opt) => {
      if (categoryFilter !== "all" && opt.type !== categoryFilter) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchesName = opt.name.toLowerCase().includes(q);
        const matchesType = opt.type.toLowerCase().includes(q);
        if (!matchesName && !matchesType) return false;
      }
      return true;
    });
  }, [options, categoryFilter, searchQuery]);

  const selectedOption = useMemo(() => {
    return options.find((opt) => opt.id === selectedInstId);
  }, [options, selectedInstId]);

  if (!isOpen || !reservation) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedInstId) {
      setErrorMsg("Please select an instrument to allocate.");
      return;
    }

    if (selectedOption?.hasConflict) {
      setErrorMsg(
        `Cannot allocate: "${selectedOption.name}" has an approved reservation during this time window.`,
      );
      return;
    }

    setSubmitting(true);
    setErrorMsg(null);

    try {
      const token =
        sessionToken || localStorage.getItem("church_session_token_v1");
      const res = await fetch(
        `/api/admin/reservations/${reservation.id}/assign-and-approve`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: token ? `Bearer ${token}` : "",
          },
          body: JSON.stringify({
            assignInstrumentId: selectedInstId,
            serviceLocation: serviceLocation.trim() || undefined,
            note: allocationNote.trim() || undefined,
          }),
        },
      );

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to assign instrument.");
      }

      onSuccess(data.reservation);
      onClose();
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to assign instrument.");
    } finally {
      setSubmitting(false);
    }
  };

  const startTimeHhmm = reservation.start_hhmm || "";
  const endTimeHhmm = reservation.end_hhmm || "";
  const dateFormatted = reservation.reservation_date || "";

  return (
    <div
      id="assign-instrument-modal-backdrop"
      className="fixed inset-0 z-[120] bg-stone-900/60 backdrop-blur-xs flex items-stretch sm:items-center justify-center p-0 sm:p-4"
    >
      <div
        id="assign-instrument-modal"
        className="bg-stone-50 sm:rounded-3xl sm:border sm:border-stone-200 shadow-2xl w-full sm:max-w-2xl z-10 flex flex-col h-full sm:h-auto sm:max-h-[92vh] overflow-hidden animate-in fade-in zoom-in-95 duration-150 pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]"
        dir={isAr ? "rtl" : "ltr"}
      >
        {/* Header */}
        <div className="shrink-0 bg-stone-900 text-white px-4 sm:px-6 py-3.5 sm:py-4 flex items-center justify-between border-b border-stone-800">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-2xl bg-purple-700 text-purple-100 flex items-center justify-center font-bold shadow-xs shrink-0">
              <Sparkles className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h2 className="text-sm sm:text-base font-bold text-white leading-tight truncate">
                {t("admin.review.assignModalTitle", "Allocate Gear & Approve Request")}
              </h2>
              <p className="text-[11px] sm:text-xs text-stone-400 truncate">
                {t(
                  "admin.review.assignModalSubtitle",
                  "Assign an instrument from church inventory (including reserve & vault gear) to this service.",
                )}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="shrink-0 w-9 h-9 sm:w-10 sm:h-10 flex items-center justify-center rounded-xl bg-stone-800 text-stone-300 hover:text-white hover:bg-stone-700 active:bg-stone-600 transition cursor-pointer touch-manipulation"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0">
          <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain p-4 sm:p-6 space-y-4">
            {/* Error banner */}
            {errorMsg && (
              <div className="bg-red-50 border border-red-200 rounded-2xl p-3.5 text-xs text-red-900 flex items-start gap-2.5 animate-in fade-in">
                <AlertTriangle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                <span className="leading-relaxed font-semibold">{errorMsg}</span>
              </div>
            )}

            {/* Request Summary Card */}
            <div className="bg-white rounded-2xl border border-stone-200 p-3.5 sm:p-4 shadow-2xs space-y-2.5 text-xs">
              <div className="flex items-start justify-between gap-2 border-b border-stone-100 pb-2">
                <div className="min-w-0">
                  <span className="text-[10px] text-stone-400 font-bold uppercase tracking-wider block">
                    {isAr ? "بيانات الخدمة المطلوبة" : "Requested Service"}
                  </span>
                  <span className="font-bold text-stone-900 text-sm block truncate">
                    {reservation.service_name || "Church Service"}
                  </span>
                </div>
                <div className="text-end shrink-0">
                  <span className="text-[10px] text-stone-400 font-bold uppercase tracking-wider block">
                    {isAr ? "مقدم الطلب / العازف" : "Requester & Musician"}
                  </span>
                  <span className="font-semibold text-stone-800 text-xs block">
                    {reservation.user_name || "Member"}
                    {reservation.musician_name ? ` (${reservation.musician_name})` : ""}
                  </span>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-stone-600">
                <span className="flex items-center gap-1 font-medium">
                  <Calendar className="w-3.5 h-3.5 text-stone-400 shrink-0" />
                  <span>{dateFormatted}</span>
                </span>
                <span>•</span>
                <span className="flex items-center gap-1 font-bold text-stone-900">
                  <Clock className="w-3.5 h-3.5 text-amber-700 shrink-0" />
                  <span>
                    {startTimeHhmm && formatHhmmTo12Hour(startTimeHhmm)} –{" "}
                    {endTimeHhmm && formatHhmmTo12Hour(endTimeHhmm)}
                  </span>
                </span>
              </div>

              {reservation.note && (
                <div className="bg-stone-50 border border-stone-200 rounded-xl p-2.5 text-stone-700 leading-snug">
                  <span className="font-bold text-[11px] text-stone-900 block mb-0.5">
                    {isAr ? "ملاحظات واحتياجات مقدم الطلب:" : "Musician Needs / Notes:"}
                  </span>
                  <span>{reservation.note}</span>
                </div>
              )}
            </div>

            {/* Service Location / Hall Field */}
            <div className="bg-white rounded-2xl border border-stone-200 p-3.5 sm:p-4 shadow-2xs space-y-1.5">
              <label
                htmlFor="assign-service-location"
                className="block text-xs font-bold text-stone-800 flex items-center gap-1.5"
              >
                <Church className="w-4 h-4 text-purple-700" />
                <span>
                  {t("admin.review.assignServiceLocation", "Service Location / Hall")}
                </span>
              </label>
              <input
                id="assign-service-location"
                type="text"
                value={serviceLocation}
                onChange={(e) => setServiceLocation(e.target.value)}
                placeholder={t(
                  "reservationForm.serviceLocationPlaceholder",
                  "e.g. Main Church Sanctuary, Ground Floor Youth Hall, St. George Chapel",
                )}
                className="w-full bg-stone-50 border border-stone-300 rounded-xl px-3 py-2 text-xs sm:text-sm font-medium text-stone-900 placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-purple-700/40 focus:border-purple-700 transition"
              />
              <span className="text-[11px] text-stone-500 block">
                {isAr
                  ? "تحديد مكان إقامة الخدمة يساعد خدام غرفة العهدة في تجهيز وتسليم الآلة في المكان الصحيح."
                  : "Specifying the hall helps gear room servants prepare and position the equipment."}
              </span>
            </div>

            {/* Instrument Selection Section */}
            <div className="bg-white rounded-2xl border border-stone-200 p-3.5 sm:p-4 shadow-2xs space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-stone-100 pb-2.5">
                <span className="text-xs font-bold text-stone-800 flex items-center gap-1.5">
                  <Music2 className="w-4 h-4 text-purple-700" />
                  <span>
                    {t(
                      "admin.review.assignSelectInstrument",
                      "Select Instrument to Allocate:",
                    )}
                  </span>
                </span>

                {/* Search */}
                <div className="relative min-w-[180px]">
                  <Search className="w-3.5 h-3.5 absolute inset-y-0 my-auto start-2.5 text-stone-400 pointer-events-none" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder={isAr ? "بحث بالاسم أو النوع..." : "Search gear..."}
                    className="w-full bg-stone-50 border border-stone-200 rounded-xl ps-8 pe-3 py-1.5 text-xs text-stone-800 placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-purple-700/30"
                  />
                </div>
              </div>

              {/* Category Filter Pills */}
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-hide">
                <button
                  type="button"
                  onClick={() => setCategoryFilter("all")}
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold transition whitespace-nowrap cursor-pointer touch-manipulation ${
                    categoryFilter === "all"
                      ? "bg-purple-700 text-white shadow-2xs"
                      : "bg-stone-100 text-stone-600 hover:bg-stone-200"
                  }`}
                >
                  {isAr ? "الكل" : "All Categories"} ({options.length})
                </button>
                {categories.map((cat) => {
                  const count = options.filter((o) => o.type === cat).length;
                  return (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => setCategoryFilter(cat)}
                      className={`px-2.5 py-1 rounded-lg text-xs font-bold transition whitespace-nowrap cursor-pointer touch-manipulation ${
                        categoryFilter === cat
                          ? "bg-purple-700 text-white shadow-2xs"
                          : "bg-stone-100 text-stone-600 hover:bg-stone-200"
                      }`}
                    >
                      {cat} ({count})
                    </button>
                  );
                })}
              </div>

              {/* Instruments List with Real-time Conflict Indicators */}
              {loading ? (
                <div className="py-12 text-center text-xs text-stone-500 space-y-2">
                  <div className="w-6 h-6 border-2 border-stone-300 border-t-purple-700 rounded-full animate-spin mx-auto" />
                  <span>Checking inventory availability & overlaps...</span>
                </div>
              ) : filteredOptions.length === 0 ? (
                <div className="py-8 text-center text-xs text-stone-500">
                  No gear matches the selected filter.
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 max-h-[300px] overflow-y-auto p-0.5">
                  {filteredOptions.map((opt) => {
                    const isSelected = selectedInstId === opt.id;
                    return (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => setSelectedInstId(opt.id)}
                        className={`text-start p-3 rounded-2xl border transition-all cursor-pointer relative touch-manipulation flex flex-col justify-between gap-2 ${
                          isSelected
                            ? opt.hasConflict
                              ? "bg-red-50/80 border-red-500 ring-2 ring-red-400/40 shadow-xs"
                              : "bg-purple-50/80 border-purple-600 ring-2 ring-purple-500/40 shadow-xs"
                            : opt.hasConflict
                              ? "bg-stone-50/70 border-stone-200 hover:border-red-300 opacity-80"
                              : "bg-white border-stone-200 hover:border-purple-300 hover:bg-purple-50/30"
                        }`}
                      >
                        <div className="flex items-start gap-2.5 min-w-0">
                          <div className="w-10 h-10 rounded-xl bg-stone-100 border border-stone-200 text-stone-600 flex items-center justify-center shrink-0 overflow-hidden">
                            {opt.photoUrl ? (
                              <img
                                src={opt.photoUrl}
                                alt={opt.name}
                                referrerPolicy="no-referrer"
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <Music2 className="w-5 h-5 text-stone-400" />
                            )}
                          </div>

                          <div className="min-w-0 flex-1">
                            <div className="flex items-center justify-between gap-1">
                              <span className="font-bold text-xs text-stone-900 truncate block">
                                {opt.name}
                              </span>
                              {isSelected && (
                                <CheckCircle2
                                  className={`w-4 h-4 shrink-0 ${
                                    opt.hasConflict ? "text-red-600" : "text-purple-700"
                                  }`}
                                />
                              )}
                            </div>

                            <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                              <span className="text-[10px] text-stone-500 font-medium">
                                {opt.type}
                              </span>

                              <span className="inline-flex items-center gap-0.5 px-1.5 py-0.2 rounded text-[9px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
                                <span>{isAr ? "أساسية" : "Standard"}</span>
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* Availability / Conflict Status Ribbon */}
                        <div className="pt-1.5 border-t border-stone-100 flex items-center justify-between gap-1 text-[10px]">
                          {opt.hasConflict ? (
                            <div className="flex items-center gap-1 text-red-700 font-semibold truncate">
                              <ShieldAlert className="w-3 h-3 text-red-600 shrink-0" />
                              <span className="truncate">{opt.conflictDetails}</span>
                            </div>
                          ) : (
                            <div className="flex items-center gap-1 text-emerald-700 font-bold">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-600"></span>
                              <span>{t("admin.review.assignAvailable", "Available (Free)")}</span>
                            </div>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}

              {/* Conflict Alert Warning Box */}
              {selectedOption?.hasConflict && (
                <div className="bg-red-50 border border-red-300 rounded-2xl p-3.5 text-xs text-red-900 space-y-1 animate-in fade-in">
                  <div className="font-bold flex items-center gap-1.5 text-red-950">
                    <ShieldAlert className="w-4 h-4 text-red-600 shrink-0" />
                    <span>{t("admin.review.assignConflictNotice", "Conflict Warning")}</span>
                  </div>
                  <p className="text-red-800 text-[11px] leading-relaxed">
                    {selectedOption.conflictDetails ||
                      "This instrument is already booked for another approved church service during this time window. Choosing it will create a double-booking."}
                  </p>
                </div>
              )}
            </div>

            {/* Optional Allocation Note for the Musician */}
            <div className="bg-white rounded-2xl border border-stone-200 p-3.5 sm:p-4 shadow-2xs space-y-1.5">
              <label
                htmlFor="assign-note"
                className="block text-xs font-bold text-stone-800 flex items-center justify-between"
              >
                <span>
                  {t(
                    "admin.review.assignNoteLabel",
                    "Allocation Note for Musician (Optional)",
                  )}
                </span>
                <span className="text-[10px] text-stone-400 font-medium">
                  {t("common.optional", "Optional")}
                </span>
              </label>
              <textarea
                id="assign-note"
                rows={2}
                value={allocationNote}
                onChange={(e) => setAllocationNote(e.target.value)}
                placeholder={t(
                  "admin.review.assignNotePlaceholder",
                  "e.g. Please collect the Roland GW-8 from the 2nd floor gear locker...",
                )}
                className="w-full bg-stone-50 border border-stone-300 rounded-xl px-3 py-2 text-xs font-medium text-stone-900 placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-purple-700/40 focus:border-purple-700 transition resize-none"
              />
            </div>
          </div>

          {/* Footer Actions */}
          <div className="shrink-0 bg-white border-t border-stone-200 px-4 sm:px-6 py-3.5 flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl border border-stone-300 text-stone-700 hover:bg-stone-100 font-bold text-xs transition cursor-pointer touch-manipulation"
            >
              {t("common.cancel", "Cancel")}
            </button>

            <button
              type="submit"
              disabled={submitting || !selectedInstId || selectedOption?.hasConflict}
              className={`min-h-[42px] px-5 py-2.5 rounded-xl font-bold text-xs transition-all flex items-center justify-center gap-2 cursor-pointer shadow-xs active:scale-[0.98] touch-manipulation ${
                submitting || !selectedInstId || selectedOption?.hasConflict
                  ? "bg-stone-300 text-stone-500 cursor-not-allowed shadow-none"
                  : "bg-purple-700 hover:bg-purple-800 active:bg-purple-900 text-white shadow-md hover:shadow-lg"
              }`}
            >
              <Sparkles className="w-4 h-4 shrink-0" />
              <span>
                {submitting
                  ? isAr
                    ? "جارٍ التخصيص..."
                    : "Allocating..."
                  : t("admin.review.assignConfirmBtn", "Confirm & Allocate Gear")}
              </span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
