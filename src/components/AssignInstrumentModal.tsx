import React, { useState, useEffect, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useAuth } from "../contexts/AuthContext.tsx";
import { formatHhmmTo12Hour } from "../lib/date-utils";
import {
  Music2,
  Calendar,
  Clock,
  Church,
  AlertTriangle,
  CheckCircle2,
  X,
  Search,
  Sparkles,
  ShieldAlert,
  Archive,
  RefreshCw,
  Repeat,
  Layers,
  Info,
} from "lucide-react";

export interface CandidateItem {
  instrument: {
    id: string;
    name: string;
    type: string;
    photoUrl?: string | null;
    photo_url?: string | null;
    description?: string | null;
    visibilityLevel?: "public" | "musician" | "room_stock";
    visibility_level?: "public" | "musician" | "room_stock";
    isOutOfService?: boolean;
    is_out_of_service?: boolean;
    outsideFeePerDay?: string;
  };
  status: "free" | "busy" | "out_of_service";
  statusReason?: string | null;
  conflictReservation?: any;
}

export interface SeriesAggregateCandidate {
  instrument: {
    id: string;
    name: string;
    type: string;
    photoUrl?: string | null;
    photo_url?: string | null;
    description?: string | null;
    visibilityLevel?: "public" | "musician" | "room_stock";
    visibility_level?: "public" | "musician" | "room_stock";
    isOutOfService?: boolean;
    is_out_of_service?: boolean;
    outsideFeePerDay?: string;
  };
  freeOnAllDates: boolean;
  conflictDatesCount: number;
  isOutOfService: boolean;
  occStatuses: Array<{
    reservationId: string;
    status: string;
    statusReason?: string;
  }>;
}

export interface AssignInstrumentModalProps {
  isOpen: boolean;
  reservation: any;
  isSeries?: boolean;
  isReassign?: boolean;
  onClose: () => void;
  onSuccess: (updatedReservation?: any) => void;
}

export const AssignInstrumentModal: React.FC<AssignInstrumentModalProps> = ({
  isOpen,
  reservation,
  isSeries = false,
  isReassign = false,
  onClose,
  onSuccess,
}) => {
  const { sessionToken } = useAuth();
  const { t, i18n } = useTranslation();
  const isAr = i18n.language === "ar";

  const [loading, setLoading] = useState<boolean>(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [candidates, setCandidates] = useState<CandidateItem[]>([]);
  const [seriesCandidates, setSeriesCandidates] = useState<SeriesAggregateCandidate[]>([]);
  const [requestedType, setRequestedType] = useState<string>("");
  const [selectedInstId, setSelectedInstId] = useState<string>("");
  const [rejectConflicting, setRejectConflicting] = useState<boolean>(false);
  const [rejectionReason, setRejectionReason] = useState<string>("");
  const [reassignReason, setReassignReason] = useState<string>("");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [submitting, setSubmitting] = useState<boolean>(false);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  const seriesId = reservation?.series_id || reservation?.seriesId;
  const effectiveIsSeries = Boolean(isSeries || (seriesId && reservation?.isSeriesAssign));

  useEffect(() => {
    if (!isOpen || !reservation?.id) return;

    setSelectedInstId(reservation.instrument_id || reservation.instrumentId || "");
    setErrorMsg(null);
    setSearchQuery("");
    setReassignReason("");
    setRejectConflicting(false);
    setRejectionReason(
      isAr
        ? "تعارض مع حجز معتمد آخر في هذا الموعد"
        : "Conflict with another approved booking in this slot",
    );
    setLoading(true);

    const fetchCandidates = async () => {
      try {
        const token =
          sessionToken || localStorage.getItem("church_session_token_v1") || "";
        const endpoint = effectiveIsSeries
          ? `/api/admin/series/${seriesId}/assignment-candidates`
          : `/api/admin/reservations/${reservation.id}/assignment-candidates`;

        const res = await fetch(endpoint, {
          headers: {
            "Content-Type": "application/json",
            Authorization: token ? `Bearer ${token}` : "",
          },
        });
        const data = await res.json();
        if (!res.ok || !data.success) {
          throw new Error(data.error || "Failed to load candidate instruments");
        }

        setRequestedType(data.requestedType || reservation.requested_type || reservation.requestedType || "");

        if (effectiveIsSeries) {
          const list: SeriesAggregateCandidate[] = data.aggregateCandidates || [];
          setSeriesCandidates(list);
          const firstFree = list.find((c) => c.freeOnAllDates && !c.isOutOfService);
          if (firstFree) {
            setSelectedInstId(firstFree.instrument.id);
          } else if (list.length > 0 && !list[0].isOutOfService) {
            setSelectedInstId(list[0].instrument.id);
          }
        } else {
          const list: CandidateItem[] = data.candidates || [];
          setCandidates(list);
          const firstFree = list.find((c) => c.status === "free");
          if (firstFree) {
            setSelectedInstId(firstFree.instrument.id);
          }
        }
      } catch (err: any) {
        setErrorMsg(err.message || "Failed to fetch candidate instruments");
      } finally {
        setLoading(false);
      }
    };

    fetchCandidates();
  }, [isOpen, reservation, sessionToken, effectiveIsSeries, seriesId, isAr]);

  const filteredCandidates = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    if (effectiveIsSeries) {
      return seriesCandidates.filter((c) => {
        if (!q) return true;
        return (
          c.instrument.name.toLowerCase().includes(q) ||
          c.instrument.type.toLowerCase().includes(q)
        );
      });
    }
    return candidates.filter((c) => {
      if (!q) return true;
      return (
        c.instrument.name.toLowerCase().includes(q) ||
        c.instrument.type.toLowerCase().includes(q)
      );
    });
  }, [candidates, seriesCandidates, effectiveIsSeries, searchQuery]);

  const selectedCandidate = useMemo(() => {
    if (effectiveIsSeries) {
      return seriesCandidates.find((c) => c.instrument.id === selectedInstId);
    }
    return candidates.find((c) => c.instrument.id === selectedInstId);
  }, [effectiveIsSeries, seriesCandidates, candidates, selectedInstId]);

  if (!isOpen || !reservation) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedInstId) {
      setErrorMsg(isAr ? "يرجى اختيار آلة للتخصيص." : "Please select an instrument to assign.");
      return;
    }

    if (!effectiveIsSeries) {
      const single = candidates.find((c) => c.instrument.id === selectedInstId);
      if (single?.status === "out_of_service") {
        setErrorMsg(isAr ? "لا يمكن تخصيص آلة خارج الخدمة." : "Cannot assign an out-of-service instrument.");
        return;
      }
      if (single?.status === "busy") {
        setErrorMsg(
          isAr
            ? `الآلة غير متاحة: ${single.statusReason || "يوجد تعارض في الموعد"}`
            : `Cannot assign: ${single.statusReason || "Instrument has a conflict in this slot."}`,
        );
        return;
      }
    } else {
      const sc = seriesCandidates.find((c) => c.instrument.id === selectedInstId);
      if (sc?.isOutOfService) {
        setErrorMsg(isAr ? "لا يمكن تخصيص آلة خارج الخدمة." : "Cannot assign an out-of-service instrument.");
        return;
      }
      if (!sc?.freeOnAllDates && !rejectConflicting) {
        setErrorMsg(
          isAr
            ? `الآلة بها تعارض في ${sc?.conflictDatesCount} مواعيد. يرجى تفعيل خيار استبعاد المواعيد المتعارضة للاستمرار.`
            : `Instrument has conflicts in ${sc?.conflictDatesCount} date(s). Please enable "Reject conflicting dates" to proceed.`,
        );
        return;
      }
    }

    setSubmitting(true);
    setErrorMsg(null);

    try {
      const token =
        sessionToken || localStorage.getItem("church_session_token_v1") || "";

      let endpoint = "";
      let payload: any = {};

      if (isReassign) {
        endpoint = `/api/admin/reservations/${reservation.id}/reassign`;
        payload = {
          newInstrumentId: selectedInstId,
          reason: reassignReason.trim() || undefined,
        };
      } else if (effectiveIsSeries) {
        endpoint = `/api/admin/series/${seriesId}/assign`;
        payload = {
          instrumentId: selectedInstId,
          rejectConflicting,
          conflictRejectionReason: rejectionReason.trim() || undefined,
        };
      } else {
        endpoint = `/api/admin/reservations/${reservation.id}/assign`;
        payload = {
          instrumentId: selectedInstId,
        };
      }

      const res = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: token ? `Bearer ${token}` : "",
        },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to complete assignment.");
      }

      onSuccess(data.reservation);
      onClose();
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to assign instrument.");
    } finally {
      setSubmitting(false);
    }
  };

  const getVisibilityBadge = (level?: string) => {
    switch (level) {
      case "room_stock":
        return (
          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-900 border border-amber-300">
            <Archive className="w-2.5 h-2.5 text-amber-700 shrink-0" />
            <span>{isAr ? "عهدة الغرفة (Room Stock)" : "Room Stock"}</span>
          </span>
        );
      case "musician":
        return (
          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-purple-100 text-purple-900 border border-purple-300">
            <Sparkles className="w-2.5 h-2.5 text-purple-700 shrink-0" />
            <span>{isAr ? "للعازفين (Musician)" : "Musician"}</span>
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-sky-50 text-sky-800 border border-sky-200">
            <span>{isAr ? "عامة (Public)" : "Public"}</span>
          </span>
        );
    }
  };

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
            <div className="w-10 h-10 rounded-2xl bg-amber-700 text-amber-100 flex items-center justify-center font-bold shadow-xs shrink-0">
              {effectiveIsSeries ? (
                <Repeat className="w-5 h-5" />
              ) : (
                <Sparkles className="w-5 h-5" />
              )}
            </div>
            <div className="min-w-0">
              <h2 className="text-sm sm:text-base font-bold text-white leading-tight truncate">
                {isReassign
                  ? isAr
                    ? "تغيير الآلة المخصصة"
                    : "Reassign Instrument"
                  : effectiveIsSeries
                    ? isAr
                      ? "تخصيص آلة للسلسلة المتكررة"
                      : "Assign Instrument to Recurring Series"
                    : isAr
                      ? "تخصيص آلة واعتماد الطلب"
                      : "Assign Instrument & Approve Request"}
              </h2>
              <p className="text-[11px] sm:text-xs text-stone-400 truncate">
                {isAr
                  ? `النوع المطلوب: ${requestedType || "كل الآلات"} • يتم عرض عهدة الغرفة أولاً، ثم عازفي الكنيسة، ثم العامة`
                  : `Requested type: ${requestedType || "All"} • Room stock listed first, then Musician, then Public`}
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
            <div className="bg-white rounded-2xl border border-stone-200 p-3.5 sm:p-4 shadow-2xs space-y-2 text-xs">
              <div className="flex items-start justify-between gap-2 border-b border-stone-100 pb-2">
                <div className="min-w-0">
                  <span className="text-[10px] text-stone-400 font-bold uppercase tracking-wider block">
                    {isAr ? "الخدمة المطلوبة" : "Requested Service"}
                  </span>
                  <span className="font-bold text-stone-900 text-sm block truncate">
                    {reservation.service_name || reservation.serviceName || "Church Service"}
                  </span>
                </div>
                <div className="text-end shrink-0">
                  <span className="text-[10px] text-stone-400 font-bold uppercase tracking-wider block">
                    {isAr ? "مقدم الطلب / العازف" : "Requester & Musician"}
                  </span>
                  <span className="font-semibold text-stone-800 text-xs block">
                    {reservation.user_name || reservation.userName || "Member"}
                    {reservation.musician_name || reservation.musicianName
                      ? ` (${reservation.musician_name || reservation.musicianName})`
                      : ""}
                  </span>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-stone-600">
                <span className="flex items-center gap-1 font-medium">
                  <Calendar className="w-3.5 h-3.5 text-stone-400 shrink-0" />
                  <span>
                    {reservation.reservation_date ||
                      (reservation.start_time
                        ? String(reservation.start_time).substring(0, 10)
                        : "")}
                  </span>
                </span>
                <span>•</span>
                <span className="flex items-center gap-1 font-bold text-stone-900">
                  <Clock className="w-3.5 h-3.5 text-amber-700 shrink-0" />
                  <span>
                    {reservation.start_hhmm && formatHhmmTo12Hour(reservation.start_hhmm)} –{" "}
                    {reservation.end_hhmm && formatHhmmTo12Hour(reservation.end_hhmm)}
                  </span>
                </span>
                {requestedType && (
                  <>
                    <span>•</span>
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-900 border border-amber-300">
                      {isAr ? `نوع الآلة: ${requestedType}` : `Type: ${requestedType}`}
                    </span>
                  </>
                )}
              </div>

              {/* Exceeded Limits Badge Notice */}
              {(() => {
                let limits: string[] = [];
                try {
                  if (Array.isArray(reservation.exceeded_limits)) {
                    limits = reservation.exceeded_limits;
                  } else if (typeof reservation.exceeded_limits === "string") {
                    limits = JSON.parse(reservation.exceeded_limits);
                  }
                } catch {
                  // ignore
                }

                if (limits && limits.length > 0) {
                  return (
                    <div className="bg-amber-50 border border-amber-200 rounded-xl p-2.5 text-[11px] text-amber-900 flex items-start gap-2">
                      <AlertTriangle className="w-3.5 h-3.5 text-amber-700 shrink-0 mt-0.5" />
                      <div>
                        <span className="font-bold block">
                          {isAr ? "ملاحظة: تجاوز هذا الطلب حدود الحجز التالية:" : "Notice: This request exceeded limits:"}
                        </span>
                        <ul className="list-disc list-inside space-y-0.5 mt-0.5 text-amber-800">
                          {limits.map((l, i) => (
                            <li key={i}>{l}</li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  );
                }
                return null;
              })()}
            </div>

            {/* Reassign Reason Field */}
            {isReassign && (
              <div className="bg-white rounded-2xl border border-stone-200 p-3.5 sm:p-4 shadow-2xs space-y-1.5">
                <label
                  htmlFor="reassign-reason"
                  className="block text-xs font-bold text-stone-800"
                >
                  {isAr ? "سبب إعادة التخصيص للمستخدم:" : "Reason for Reassignment (sent to user):"}
                </label>
                <input
                  id="reassign-reason"
                  type="text"
                  value={reassignReason}
                  onChange={(e) => setReassignReason(e.target.value)}
                  placeholder={
                    isAr
                      ? "مثال: صيانة مفاجئة للآلة السابقة، تم توفير بديل مكافئ..."
                      : "e.g. Previous instrument undergoing maintenance, assigned equivalent model..."
                  }
                  className="w-full bg-stone-50 border border-stone-300 rounded-xl px-3 py-2 text-xs font-medium text-stone-900 focus:outline-none focus:ring-2 focus:ring-amber-700/40"
                />
              </div>
            )}

            {/* Instrument Selection Section */}
            <div className="bg-white rounded-2xl border border-stone-200 p-3.5 sm:p-4 shadow-2xs space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-stone-100 pb-2.5">
                <span className="text-xs font-bold text-stone-800 flex items-center gap-1.5">
                  <Music2 className="w-4 h-4 text-amber-700" />
                  <span>
                    {isAr
                      ? `الآلات المتاحة من نوع (${requestedType || "الكل"}):`
                      : `Available Instruments (${requestedType || "All"}):`}
                  </span>
                </span>

                {/* Search */}
                <div className="relative min-w-[180px]">
                  <Search className="w-3.5 h-3.5 absolute inset-y-0 my-auto start-2.5 text-stone-400 pointer-events-none" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder={isAr ? "بحث بالاسم..." : "Search instruments..."}
                    className="w-full bg-stone-50 border border-stone-200 rounded-xl ps-8 pe-3 py-1.5 text-xs text-stone-800 placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-amber-700/30"
                  />
                </div>
              </div>

              {loading ? (
                <div className="py-12 text-center text-xs text-stone-500 space-y-2">
                  <RefreshCw className="w-5 h-5 animate-spin mx-auto text-amber-700" />
                  <span>
                    {isAr
                      ? "جارٍ فحص توفر الآلات وترتيب الأولويات..."
                      : "Checking inventory availability & ranking..."}
                  </span>
                </div>
              ) : filteredCandidates.length === 0 ? (
                <div className="py-8 text-center text-xs text-stone-500">
                  {isAr
                    ? "لا توجد آلات مطابقة من هذا النوع في قاعدة البيانات."
                    : "No matching instruments found for this type category."}
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 max-h-[320px] overflow-y-auto p-0.5">
                  {filteredCandidates.map((item: any) => {
                    const inst = item.instrument;
                    const isSelected = selectedInstId === inst.id;

                    const isOutOfService = Boolean(
                      item.isOutOfService ?? inst.isOutOfService ?? inst.is_out_of_service,
                    );
                    const isBusy = effectiveIsSeries
                      ? !item.freeOnAllDates
                      : item.status === "busy";
                    const isFree = !isOutOfService && !isBusy;

                    const photo = inst.photoUrl || inst.photo_url;
                    const level = inst.visibilityLevel || inst.visibility_level || "public";

                    return (
                      <button
                        key={inst.id}
                        type="button"
                        onClick={() => {
                          if (isOutOfService) return;
                          setSelectedInstId(inst.id);
                        }}
                        disabled={isOutOfService}
                        className={`text-start p-3 rounded-2xl border transition-all relative flex flex-col justify-between gap-2 touch-manipulation ${
                          isOutOfService
                            ? "bg-stone-100 border-stone-200 opacity-50 cursor-not-allowed"
                            : isSelected
                              ? isBusy
                                ? "bg-amber-50/90 border-amber-500 ring-2 ring-amber-400/40 shadow-xs cursor-pointer"
                                : "bg-emerald-50/90 border-emerald-600 ring-2 ring-emerald-500/40 shadow-xs cursor-pointer"
                              : isBusy
                                ? "bg-stone-50/80 border-stone-200 hover:border-amber-300 opacity-80 cursor-pointer"
                                : "bg-white border-stone-200 hover:border-amber-400 hover:bg-amber-50/20 cursor-pointer"
                        }`}
                      >
                        <div className="flex items-start gap-2.5 min-w-0">
                          <div className="w-10 h-10 rounded-xl bg-stone-100 border border-stone-200 text-stone-600 flex items-center justify-center shrink-0 overflow-hidden">
                            {photo ? (
                              <img
                                src={photo}
                                alt={inst.name}
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
                                {inst.name}
                              </span>
                              {isSelected && (
                                <CheckCircle2
                                  className={`w-4 h-4 shrink-0 ${
                                    isBusy ? "text-amber-600" : "text-emerald-700"
                                  }`}
                                />
                              )}
                            </div>

                            <div className="flex items-center gap-1 mt-1 flex-wrap">
                              {getVisibilityBadge(level)}
                            </div>
                          </div>
                        </div>

                        {/* Availability ribbon */}
                        <div className="pt-1.5 border-t border-stone-100 flex items-center justify-between gap-1 text-[10px]">
                          {isOutOfService ? (
                            <span className="text-red-700 font-bold flex items-center gap-1">
                              <ShieldAlert className="w-3 h-3 text-red-600 shrink-0" />
                              <span>{isAr ? "خارج الخدمة (معطلة)" : "Out of Service"}</span>
                            </span>
                          ) : isBusy ? (
                            <span className="text-amber-800 font-semibold truncate flex items-center gap-1">
                              <ShieldAlert className="w-3 h-3 text-amber-600 shrink-0" />
                              <span className="truncate">
                                {effectiveIsSeries
                                  ? isAr
                                    ? `تعارض في ${item.conflictDatesCount} مواعيد`
                                    : `Conflicts in ${item.conflictDatesCount} date(s)`
                                  : item.statusReason || (isAr ? "مشغولة في هذا الموعد" : "Busy in this slot")}
                              </span>
                            </span>
                          ) : (
                            <span className="text-emerald-700 font-bold flex items-center gap-1">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-600"></span>
                              <span>
                                {effectiveIsSeries
                                  ? isAr
                                    ? "متاحة في كل مواعيد السلسلة"
                                    : "Free on all series dates"
                                  : isAr
                                    ? "متاحة (جاهزة للتخصيص)"
                                    : "Free (Available)"}
                              </span>
                            </span>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}

              {/* Series conflict resolution toggle */}
              {effectiveIsSeries &&
                selectedCandidate &&
                !(selectedCandidate as SeriesAggregateCandidate).freeOnAllDates &&
                !(selectedCandidate as SeriesAggregateCandidate).isOutOfService && (
                  <div className="bg-amber-50 border border-amber-300 rounded-2xl p-3.5 text-xs text-amber-950 space-y-2 animate-in fade-in">
                    <div className="font-bold flex items-center gap-1.5 text-amber-900">
                      <AlertTriangle className="w-4 h-4 text-amber-700 shrink-0" />
                      <span>
                        {isAr
                          ? "يوجد تعارض في بعض مواعيد السلسلة على هذه الآلة"
                          : "Conflict in some series dates on this instrument"}
                      </span>
                    </div>
                    <p className="text-amber-800 text-[11px] leading-relaxed">
                      {isAr
                        ? `يمكنك اعتماد المواعيد المتاحة واستبعاد المواعيد المتعارضة تلقائياً (إجمالي المواعيد المتعارضة: ${(selectedCandidate as SeriesAggregateCandidate).conflictDatesCount}).`
                        : `You can approve the fitting dates and reject only the conflicting dates (conflicts: ${(selectedCandidate as SeriesAggregateCandidate).conflictDatesCount}).`}
                    </p>

                    <label className="flex items-center gap-2 cursor-pointer font-bold text-amber-900 pt-1">
                      <input
                        type="checkbox"
                        checked={rejectConflicting}
                        onChange={(e) => setRejectConflicting(e.target.checked)}
                        className="w-4 h-4 rounded text-amber-800 border-amber-300 focus:ring-amber-700/20"
                      />
                      <span>
                        {isAr
                          ? "اعتماد المواعيد المتاحة ورفض المواعيد المتعارضة مع إخطار العازف"
                          : "Approve fitting dates and reject conflicting dates with reason"}
                      </span>
                    </label>

                    {rejectConflicting && (
                      <input
                        type="text"
                        value={rejectionReason}
                        onChange={(e) => setRejectionReason(e.target.value)}
                        placeholder={
                          isAr
                            ? "سبب رفض المواعيد المتعارضة..."
                            : "Reason for rejecting conflicting dates..."
                        }
                        className="w-full bg-white border border-amber-300 rounded-xl px-2.5 py-1.5 text-xs text-amber-950 mt-1"
                      />
                    )}
                  </div>
                )}
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
              disabled={
                submitting ||
                !selectedInstId ||
                (!effectiveIsSeries &&
                  candidates.find((c) => c.instrument.id === selectedInstId)?.status !== "free") ||
                (effectiveIsSeries &&
                  seriesCandidates.find((c) => c.instrument.id === selectedInstId)?.isOutOfService) ||
                (effectiveIsSeries &&
                  !seriesCandidates.find((c) => c.instrument.id === selectedInstId)?.freeOnAllDates &&
                  !rejectConflicting)
              }
              className={`min-h-[42px] px-5 py-2.5 rounded-xl font-bold text-xs transition-all flex items-center justify-center gap-2 cursor-pointer shadow-xs active:scale-[0.98] touch-manipulation ${
                submitting ||
                !selectedInstId ||
                (!effectiveIsSeries &&
                  candidates.find((c) => c.instrument.id === selectedInstId)?.status !== "free") ||
                (effectiveIsSeries &&
                  seriesCandidates.find((c) => c.instrument.id === selectedInstId)?.isOutOfService) ||
                (effectiveIsSeries &&
                  !seriesCandidates.find((c) => c.instrument.id === selectedInstId)?.freeOnAllDates &&
                  !rejectConflicting)
                  ? "bg-stone-300 text-stone-500 cursor-not-allowed shadow-none"
                  : "bg-amber-800 hover:bg-amber-900 active:bg-amber-950 text-white shadow-md hover:shadow-lg"
              }`}
            >
              <Sparkles className="w-4 h-4 shrink-0" />
              <span>
                {submitting
                  ? isAr
                    ? "جارٍ التنفيذ..."
                    : "Processing..."
                  : isReassign
                    ? isAr
                      ? "تأكيد إعادة التخصيص"
                      : "Confirm Reassignment"
                    : isAr
                      ? "تخصيص واعتماد الحجز"
                      : "Confirm & Allocate Instrument"}
              </span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
