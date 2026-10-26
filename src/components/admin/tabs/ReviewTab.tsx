import React from "react";
import { useTranslation } from "react-i18next";
import {
  CheckSquare,
  RefreshCw,
  XCircle,
  Trash2,
  ExternalLink,
  Shield,
  CalendarDays,
  Church,
  Sun,
  DollarSign,
  Repeat,
  AlertTriangle,
  Check,
  X,
  UserCheck,
  UserX,
  ChevronDown,
  Sparkles,
} from "lucide-react";
import {
  getStatusColor,
  getReservationTypeColor,
} from "../../../lib/status-colors";
import {
  ReservationFiltersPopover,
  ActiveFiltersBar,
  type ReservationFilterState,
} from "../../ReservationFiltersPopover";
import { isNoShowWindowOpen } from "../../../lib/date-utils";

export interface ReviewTabProps {
  reservations: any[];
  loadingReservations: boolean;
  filterQuickTab: "all" | "today" | "pending";
  setFilterQuickTab: (tab: "all" | "today" | "pending") => void;
  reviewFilters: ReservationFilterState;
  setReviewFilters: React.Dispatch<
    React.SetStateAction<ReservationFilterState>
  >;
  showReviewFilters: boolean;
  setShowReviewFilters: React.Dispatch<React.SetStateAction<boolean>>;
  reviewFilterOptions: any;
  getRowOwnerName: (r: any) => string;
  isAr: boolean;
  stats: any;
  isSelectionMode: boolean;
  enterSelectionMode: () => void;
  exitSelectionMode: () => void;
  fetchReservations: () => void;
  selectedReservationIds: string[];
  setSelectedReservationIds: React.Dispatch<React.SetStateAction<string[]>>;
  handleTriggerBulkCancel: () => void;
  handleTriggerBulkDelete: () => void;
  isSuperAdmin: boolean;
  translateStatus: (status: string) => string;
  openUserProfile: (id: string) => void;
  onOpenReservationDetail?: (id: string) => void;
  handleApprove: (id: string) => void;
  handleApproveSeries: (seriesId: string) => void;
  openRejectModal: (r: any, isSeries?: boolean, count?: number) => void;
  handleMarkNoShow: (id: string) => void;
  handleUnmarkNoShow: (id: string) => void;
  noShowWindowNow: number;
  isReservationAdminBooked: (r: any) => boolean;
  getAdminDisplayName?: (r: any) => string;
  openCancelModal?: (r: any) => void;
  openAssignModal?: (r: any, isSeries?: boolean, isReassign?: boolean) => void;
  expandedSeriesIds?: any;
  setExpandedSeriesIds?: any;
}

type ReviewItem =
  | {
      type: "series";
      seriesId: string;
      primary: any;
      occurrences: any[];
      pendingCount: number;
      totalCount: number;
    }
  | { type: "single"; reservation: any };

const SHORT_TIME: Intl.DateTimeFormatOptions = {
  hour: "numeric",
  minute: "2-digit",
  hour12: true,
};

const formatCompactOccurrenceDate = (start: string, end: string): string => {
  const startDate = new Date(start);
  const day = startDate.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
  const from = startDate.toLocaleTimeString([], SHORT_TIME);
  const to = new Date(end).toLocaleTimeString([], SHORT_TIME);
  return `${day} • ${from} – ${to}`;
};

const groupReservations = (reservations: any[]): ReviewItem[] => {
  const items: ReviewItem[] = [];
  const seriesIndex = new Map<
    string,
    Extract<ReviewItem, { type: "series" }>
  >();

  for (const reservation of reservations) {
    if (!reservation.series_id) {
      items.push({ type: "single", reservation });
      continue;
    }
    let group = seriesIndex.get(reservation.series_id);
    if (!group) {
      group = {
        type: "series",
        seriesId: reservation.series_id,
        primary: reservation,
        occurrences: [],
        pendingCount: 0,
        totalCount: 0,
      };
      seriesIndex.set(reservation.series_id, group);
      items.push(group);
    }
    group.occurrences.push(reservation);
  }

  const newestCreated = (rows: any[]) =>
    Math.max(...rows.map((r) => new Date(r.created_at).getTime() || 0));

  items.sort((a, b) => {
    const rowsOf = (i: ReviewItem) =>
      i.type === "series" ? i.occurrences : [i.reservation];
    return newestCreated(rowsOf(b)) - newestCreated(rowsOf(a));
  });

  seriesIndex.forEach((group) => {
    group.occurrences.sort(
      (a, b) =>
        new Date(a.start_time).getTime() - new Date(b.start_time).getTime(),
    );
    group.primary = group.occurrences[0];
    group.totalCount = group.occurrences.length;
    group.pendingCount = group.occurrences.filter(
      (o) => o.status === "pending",
    ).length;
  });

  return items;
};

export const ReviewTab: React.FC<ReviewTabProps> = ({
  reservations,
  loadingReservations,
  filterQuickTab,
  setFilterQuickTab,
  reviewFilters,
  setReviewFilters,
  showReviewFilters,
  setShowReviewFilters,
  reviewFilterOptions,
  getRowOwnerName,
  isAr,
  stats,
  isSelectionMode,
  enterSelectionMode,
  exitSelectionMode,
  fetchReservations,
  selectedReservationIds,
  setSelectedReservationIds,
  handleTriggerBulkCancel,
  handleTriggerBulkDelete,
  isSuperAdmin,
  translateStatus,
  openUserProfile,
  onOpenReservationDetail,
  handleApprove,
  handleApproveSeries,
  openRejectModal,
  handleMarkNoShow,
  handleUnmarkNoShow,
  noShowWindowNow,
  isReservationAdminBooked,
  getAdminDisplayName,
  openAssignModal,
}) => {
  const { t } = useTranslation();
  const [expandedSeriesIds, setExpandedSeriesIds] = React.useState<Set<string>>(
    new Set(),
  );

  const groupedReservationItems = React.useMemo(
    () => groupReservations(reservations),
    [reservations],
  );

  const allVisibleIds = React.useMemo(
    () => reservations.map((r) => r.id),
    [reservations],
  );
  const allSelected =
    allVisibleIds.length > 0 &&
    allVisibleIds.every((id) => selectedReservationIds.includes(id));
  const someSelected =
    allVisibleIds.some((id) => selectedReservationIds.includes(id)) &&
    !allSelected;

  const toggleSeriesExpanded = (seriesId: string) => {
    setExpandedSeriesIds((prev) => {
      const next = new Set(prev);
      if (next.has(seriesId)) next.delete(seriesId);
      else next.add(seriesId);
      return next;
    });
  };

  const handleToggleSelectReservation = (id: string) => {
    setSelectedReservationIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  };

  const handleToggleSelectSeries = (occurrences: any[]) => {
    const ids = occurrences.map((o) => o.id);
    setSelectedReservationIds((prev) => {
      const everySelected = ids.every((id) => prev.includes(id));
      if (everySelected) return prev.filter((id) => !ids.includes(id));
      return Array.from(new Set([...prev, ...ids]));
    });
  };

  const handleToggleSelectAllReservations = () => {
    setSelectedReservationIds(allSelected ? [] : allVisibleIds);
  };

  const renderOwner = (r: any, onSelectionClick: () => void) => {
    if (isReservationAdminBooked(r)) {
      return (
        <div className="text-xs font-bold text-amber-800 py-0.5 inline-flex items-center gap-1">
          <Shield className="w-3 h-3 text-amber-700 shrink-0" />
          <span>{getAdminDisplayName(r)}</span>
        </div>
      );
    }
    if (r.user_id) {
      return (
        <button
          type="button"
          onClick={(e) => {
            if (isSelectionMode) {
              e.stopPropagation();
              onSelectionClick();
              return;
            }
            openUserProfile(r.user_id);
          }}
          className={`text-xs font-medium flex items-center gap-1 group py-0.5 ${
            isSelectionMode
              ? "text-stone-600 cursor-pointer"
              : "text-stone-600 hover:text-amber-900 hover:underline cursor-pointer"
          }`}
        >
          <span className="font-semibold text-stone-700">
            {r.user_name || "Member"}
          </span>
          {!isSelectionMode && (
            <ExternalLink className="w-3 h-3 text-stone-400 group-hover:text-amber-800 transition" />
          )}
        </button>
      );
    }
    return (
      <div className="text-xs font-semibold text-stone-700 py-0.5">
        {r.user_name || "Member"}
      </div>
    );
  };

  const renderTypeBadge = (r: any) => (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-bold ${getReservationTypeColor(
        r.reservation_type || "in_church",
      )}`}
    >
      {r.reservation_type === "outside_church" && (
        <DollarSign className="w-3 h-3 shrink-0" />
      )}
      {r.reservation_type === "outside_church"
        ? t("admin.review.outsideBadge")
        : t("admin.review.inChurchBadge")}
    </span>
  );

  const renderLocationBadge = (r: any) =>
    r.service_location && (
      <>
        <span className="text-stone-300">•</span>
        <span className="inline-flex items-center gap-1 font-semibold text-amber-950 bg-amber-50/90 border border-amber-200/80 px-2 py-0.5 rounded-lg text-[11px] truncate max-w-[200px]">
          <Church className="w-3 h-3 text-amber-800 shrink-0" />
          <span className="truncate">{r.service_location}</span>
        </span>
      </>
    );

  const renderMusician = (r: any) =>
    r.musician_name && (
      <>
        <span className="text-stone-300">•</span>
        <span className="truncate text-stone-700">
          <span className="text-stone-400 text-[10px] me-1">
            {t("admin.review.colMusicianName")}:
          </span>
          <span className="font-medium">{r.musician_name}</span>
        </span>
      </>
    );

  const renderDetailsButton = (id: string, title: string) =>
    !isSelectionMode &&
    onOpenReservationDetail && (
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onOpenReservationDetail(id);
        }}
        className="shrink-0 min-h-[32px] px-3 py-1.5 rounded-xl bg-stone-900 hover:bg-stone-800 active:bg-stone-950 text-white transition-all duration-150 cursor-pointer text-xs font-bold flex items-center justify-center gap-1.5 shadow-xs hover:shadow touch-manipulation active:scale-[0.98] whitespace-nowrap"
        title={title}
      >
        <span>{t("admin.review.detailsChatBtn")}</span>
      </button>
    );

  const renderSeriesCard = (item: Extract<ReviewItem, { type: "series" }>) => {
    const { seriesId, primary, occurrences, pendingCount, totalCount } = item;
    const isExpanded = expandedSeriesIds.has(seriesId);
    const hasPending = pendingCount > 0;
    const occIds = occurrences.map((o) => o.id);
    const allOccsSelected = occIds.every((id) =>
      selectedReservationIds.includes(id),
    );
    const someOccsSelected = occIds.some((id) =>
      selectedReservationIds.includes(id),
    );

    const firstOcc = occurrences[0];
    const lastOcc = occurrences[occurrences.length - 1];
    const sDate = new Date(firstOcc.start_time);
    const eDate = new Date(lastOcc.start_time);
    const startMonthDay = sDate.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    });
    const endMonthDay = eDate.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
    const timeFormatted = `${sDate.toLocaleTimeString([], SHORT_TIME)} – ${new Date(
      firstOcc.end_time,
    ).toLocaleTimeString([], SHORT_TIME)}`;
    const dateSpanText =
      occurrences.length === 1
        ? `${startMonthDay}, ${sDate.getFullYear()}`
        : `${startMonthDay} – ${endMonthDay}`;

    return (
      <div
        key={`series-${seriesId}`}
        className={`rounded-2xl border transition-all duration-200 overflow-hidden ${
          isSelectionMode ? "cursor-pointer" : ""
        } ${
          allOccsSelected
            ? "border-amber-500 bg-amber-50/50 ring-2 ring-amber-400/40 shadow-sm"
            : hasPending
              ? "border-amber-200/90 bg-white hover:border-amber-400 hover:shadow-xs"
              : "border-stone-200 bg-white hover:border-stone-300 hover:shadow-xs"
        }`}
        onClick={
          isSelectionMode
            ? () => handleToggleSelectSeries(occurrences)
            : undefined
        }
      >
        <div className="p-3.5 sm:p-4 flex items-start gap-3">
          {isSelectionMode && (
            <span
              onClick={(e) => e.stopPropagation()}
              className="mt-0.5 -ml-1 p-2 flex items-center justify-center shrink-0"
            >
              <input
                id={`select-series-${seriesId}`}
                type="checkbox"
                aria-label={`Select recurring series for ${primary.instrument_name || "Instrument"}`}
                checked={allOccsSelected}
                ref={(el) => {
                  if (el)
                    el.indeterminate = someOccsSelected && !allOccsSelected;
                }}
                onChange={() => handleToggleSelectSeries(occurrences)}
                className="w-5 h-5 sm:w-4 sm:h-4 rounded text-amber-800 border-stone-300 focus:ring-amber-700/20 cursor-pointer"
              />
            </span>
          )}

          <div className="min-w-0 flex-1 space-y-2.5">
            <div className="flex items-start justify-between gap-2.5 min-w-0">
              <div className="min-w-0 flex-1 space-y-0.5">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="font-bold text-stone-900 text-sm sm:text-base leading-snug truncate">
                    {primary.service_name || "Recurring Series"}
                  </h3>
                  <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-900 bg-amber-50 px-2 py-0.5 rounded-lg border border-amber-200 shrink-0">
                    <Repeat className="w-3 h-3 text-amber-700 shrink-0" />
                    <span>
                      {t("admin.review.datesCount", {
                        count: occurrences.length,
                        defaultValue: `${occurrences.length} dates`,
                      })}
                    </span>
                  </span>
                  {primary.is_type_request && (
                    <span className="inline-flex items-center gap-1 text-[10px] font-bold text-purple-900 bg-purple-50 px-2 py-0.5 rounded-lg border border-purple-200 shrink-0">
                      <Sparkles className="w-3 h-3 text-purple-700 shrink-0" />
                      <span>{isAr ? "طلب حسب النوع" : "Type request"}</span>
                    </span>
                  )}
                </div>
                {renderOwner(primary, () =>
                  handleToggleSelectSeries(occurrences),
                )}
              </div>

              <div className="shrink-0 flex flex-col items-end gap-1">
                <span
                  className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] sm:text-[11px] font-extrabold uppercase tracking-wide whitespace-nowrap shadow-2xs ${
                    hasPending
                      ? "bg-amber-100 text-amber-900 border border-amber-300"
                      : getStatusColor(primary.status)
                  }`}
                >
                  {hasPending
                    ? `${translateStatus("pending")} (${pendingCount}/${totalCount})`
                    : translateStatus(primary.status)}
                </span>
                {renderTypeBadge(primary)}
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1.5 text-xs text-stone-600 bg-stone-50/70 rounded-xl px-2.5 py-1.5 border border-stone-100">
              <span className="font-bold text-stone-900 flex items-center gap-1.5 truncate">
                <span className="w-2 h-2 rounded-full bg-amber-700 shrink-0"></span>
                <span>
                  {primary.instrument_name ||
                    (isAr
                      ? `نوع الآلة: ${primary.requested_type || "غير محدد"}`
                      : `Type: ${primary.requested_type || "Any"}`)}
                </span>
              </span>
              {renderMusician(primary)}
              <span className="text-stone-300">•</span>
              <span className="whitespace-nowrap font-medium text-stone-700 flex items-center gap-1">
                <CalendarDays className="w-3.5 h-3.5 text-stone-400 shrink-0" />
                <span>{dateSpanText}</span>
                <span className="text-stone-500 font-normal">
                  ({timeFormatted})
                </span>
              </span>
              {renderLocationBadge(primary)}
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 pt-0.5">
              {/* Left Side: Badges + Actions */}
              <div className="flex flex-wrap items-center gap-1.5 min-w-0">
                {primary.series_pattern_type && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-stone-100 text-stone-700 border border-stone-200 text-[10px] font-bold capitalize">
                    {primary.series_pattern_type}
                  </span>
                )}

                {/* Inline action buttons — same row as Details, left aligned */}
                {!isSelectionMode && hasPending && (
                  <>
                    {primary.is_type_request && !primary.instrument_id ? (
                      <button
                        type="button"
                        onClick={() =>
                          openAssignModal &&
                          openAssignModal(primary, true, false)
                        }
                        className="min-h-[32px] px-3 py-1.5 rounded-xl bg-purple-700 hover:bg-purple-800 active:bg-purple-900 text-white text-xs font-bold transition-all duration-150 cursor-pointer shadow-xs hover:shadow flex items-center justify-center gap-1.5 touch-manipulation active:scale-[0.98] whitespace-nowrap"
                        title="Assign instrument to this recurring series"
                      >
                        <Sparkles className="w-4 h-4 shrink-0 stroke-[2.5]" />
                        <span>
                          {isAr ? "تخصيص آلة للسلسلة" : "Assign Series"}
                        </span>
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => handleApproveSeries(seriesId)}
                        className="min-h-[32px] px-3 py-1.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 active:bg-emerald-900 text-white text-xs font-bold transition-all duration-150 cursor-pointer shadow-xs hover:shadow flex items-center justify-center gap-1.5 touch-manipulation active:scale-[0.98] whitespace-nowrap"
                        title="Approve all future pending occurrences in this recurring series"
                      >
                        <Check className="w-4 h-4 shrink-0 stroke-[2.5]" />
                        <span>
                          {t("admin.review.approveSeriesBtn", {
                            defaultValue: "Approve All",
                          })}
                        </span>
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() =>
                        openRejectModal(primary, true, occurrences.length)
                      }
                      className="min-h-[32px] px-3 py-1.5 rounded-xl bg-white hover:bg-red-50 active:bg-red-100 text-red-700 border border-stone-300 hover:border-red-300 text-xs font-bold transition-all duration-150 cursor-pointer shadow-2xs hover:shadow-sm flex items-center justify-center gap-1.5 touch-manipulation active:scale-[0.98] whitespace-nowrap"
                      title="Reject all occurrences in this recurring series"
                    >
                      <X className="w-4 h-4 shrink-0 stroke-[2.5]" />
                      <span>
                        {t("admin.review.rejectSeriesBtn", {
                          defaultValue: "Reject All",
                        })}
                      </span>
                    </button>
                  </>
                )}
              </div>{" "}
              {/* End Left Side */}
              <div className="shrink-0 ml-auto">
                {renderDetailsButton(
                  primary.id,
                  "View details and conversation for this series",
                )}
              </div>
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={() => toggleSeriesExpanded(seriesId)}
          className="w-full px-3.5 sm:px-4 py-2 bg-stone-50 hover:bg-stone-100 active:bg-stone-200/70 border-t border-stone-200/80 text-xs font-bold text-stone-700 flex items-center justify-between transition cursor-pointer"
        >
          <span className="flex items-center gap-2">
            <CalendarDays className="w-3.5 h-3.5 text-stone-500 shrink-0" />
            <span>
              {isExpanded
                ? t("admin.review.hideOccurrences", {
                    defaultValue: "Hide occurrences",
                  })
                : t("admin.review.showOccurrences", {
                    defaultValue: `Show occurrences (${occurrences.length})`,
                    count: occurrences.length,
                  })}
            </span>
          </span>
          <ChevronDown
            className={`w-4 h-4 text-stone-500 transition-transform duration-200 ${
              isExpanded ? "rotate-180" : ""
            }`}
          />
        </button>

        {isExpanded && (
          <div className="border-t border-stone-200/70 bg-stone-50/40 divide-y divide-stone-200/60">
            {occurrences.map((occ, idx) => {
              const isOccPending = occ.status === "pending";
              const isOccSelected = selectedReservationIds.includes(occ.id);
              return (
                <div
                  key={occ.id}
                  className={`p-2.5 sm:p-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 transition ${
                    isOccSelected ? "bg-amber-100/40" : "hover:bg-stone-100/50"
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0 flex-1">
                    {isSelectionMode && (
                      <input
                        id={`select-occ-${occ.id}`}
                        type="checkbox"
                        aria-label={`Select occurrence ${idx + 1}`}
                        checked={isOccSelected}
                        onChange={() => handleToggleSelectReservation(occ.id)}
                        className="w-4 h-4 rounded text-amber-800 border-stone-300 focus:ring-amber-700/20 cursor-pointer shrink-0"
                      />
                    )}
                    <span className="shrink-0 w-6 h-6 rounded-md bg-stone-200/80 text-stone-700 text-[11px] font-bold flex items-center justify-center">
                      #{idx + 1}
                    </span>
                    <div className="min-w-0 flex-1 flex flex-wrap items-center gap-x-2 gap-y-1">
                      <span className="text-xs font-semibold text-stone-900 whitespace-nowrap">
                        {formatCompactOccurrenceDate(
                          occ.start_time,
                          occ.end_time,
                        )}
                      </span>
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase whitespace-nowrap ${getStatusColor(
                          occ.status,
                        )}`}
                      >
                        {translateStatus(occ.status)}
                      </span>
                      {occ.is_no_show && (
                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-bold bg-rose-100 text-rose-800 border border-rose-200">
                          <AlertTriangle className="w-2.5 h-2.5 text-rose-600 shrink-0" />
                          <span>{t("common.noShow")}</span>
                        </span>
                      )}
                    </div>
                  </div>

                  {!isSelectionMode && isOccPending && (
                    <div className="flex items-center gap-1.5 shrink-0 self-end sm:self-center">
                      <button
                        type="button"
                        onClick={() =>
                          occ.is_type_request && !occ.instrument_id
                            ? openAssignModal?.(occ, false, false)
                            : handleApprove(occ.id)
                        }
                        className="min-h-[28px] px-2.5 py-1 rounded-lg bg-emerald-700 hover:bg-emerald-800 active:bg-emerald-900 text-white text-[11px] font-bold transition flex items-center gap-1 shadow-2xs cursor-pointer"
                        title={t("admin.review.approveDateOnly", {
                          defaultValue: "Approve this date only",
                        })}
                      >
                        <Check className="w-3.5 h-3.5 stroke-[2.5]" />
                        <span>
                          {occ.is_type_request && !occ.instrument_id
                            ? isAr
                              ? "تخصيص آلة"
                              : "Assign Instrument"
                            : t("admin.review.approveOccurrenceBtn", {
                                defaultValue: "Approve",
                              })}
                        </span>
                      </button>
                      <button
                        type="button"
                        onClick={() => openRejectModal(occ, false)}
                        className="min-h-[28px] px-2.5 py-1 rounded-lg bg-white hover:bg-red-50 text-red-700 border border-stone-300 hover:border-red-300 text-[11px] font-bold transition flex items-center gap-1 shadow-2xs cursor-pointer"
                        title={t("admin.review.rejectDateOnly", {
                          defaultValue: "Reject this date only",
                        })}
                      >
                        <X className="w-3.5 h-3.5 stroke-[2.5]" />
                        <span>
                          {t("admin.review.rejectOccurrenceBtn", {
                            defaultValue: "Reject",
                          })}
                        </span>
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  };

  const renderSingleCard = (r: any) => {
    const isPending = r.status === "pending";
    const isSelected = selectedReservationIds.includes(r.id);
    const showNoShowActions =
      r.status === "completed" &&
      (r.is_no_show || isNoShowWindowOpen(r, noShowWindowNow));

    return (
      <div
        key={r.id}
        onClick={
          isSelectionMode
            ? () => handleToggleSelectReservation(r.id)
            : undefined
        }
        className={`rounded-2xl border transition-all duration-200 overflow-hidden ${
          isSelectionMode ? "cursor-pointer" : ""
        } ${
          isSelected
            ? "border-amber-500 bg-amber-50/50 ring-2 ring-amber-400/40 shadow-sm"
            : isPending
              ? "border-amber-200/90 bg-white hover:border-amber-400 hover:shadow-xs"
              : "border-stone-200 bg-white hover:border-stone-300 hover:shadow-xs"
        }`}
      >
        <div className="p-3.5 sm:p-4 flex items-start gap-3">
          {isSelectionMode && (
            <span
              onClick={(e) => e.stopPropagation()}
              className="mt-0.5 -ml-1 p-2 flex items-center justify-center shrink-0"
            >
              <input
                id={`select-reservation-${r.id}`}
                type="checkbox"
                aria-label={`Select reservation for ${r.instrument_name || "Instrument"}`}
                checked={isSelected}
                onChange={() => handleToggleSelectReservation(r.id)}
                className="w-5 h-5 sm:w-4 sm:h-4 rounded text-amber-800 border-stone-300 focus:ring-amber-700/20 cursor-pointer"
              />
            </span>
          )}

          <div className="min-w-0 flex-1 space-y-2.5">
            <div className="flex items-start justify-between gap-2.5 min-w-0">
              <div className="min-w-0 flex-1 space-y-0.5">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="font-bold text-stone-900 text-sm sm:text-base leading-snug truncate">
                    {r.service_name || "Reservation"}
                  </h3>
                  {r.is_type_request && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-100 text-purple-900 border border-purple-200 shrink-0">
                      <Sparkles className="w-2.5 h-2.5 text-purple-700" />
                      <span>{isAr ? "طلب حسب النوع" : "Type request"}</span>
                    </span>
                  )}
                  {r.free_instruments_count !== undefined && isPending && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300 shrink-0">
                      <span>
                        {t("admin.review.freeCount", {
                          count: r.free_instruments_count,
                        })}
                      </span>
                    </span>
                  )}
                  {isPending && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-amber-100 text-amber-900 border border-amber-300 animate-pulse">
                      <span className="w-1.5 h-1.5 rounded-full bg-amber-600"></span>
                      <span>{t("admin.review.actionNeeded")}</span>
                    </span>
                  )}
                </div>
                {renderOwner(r, () => handleToggleSelectReservation(r.id))}
              </div>

              <div className="shrink-0 flex flex-col items-end gap-1">
                <span
                  className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] sm:text-[11px] font-extrabold uppercase tracking-wide whitespace-nowrap shadow-2xs ${getStatusColor(
                    r.status,
                  )}`}
                >
                  {translateStatus(r.status)}
                </span>
                {renderTypeBadge(r)}
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1.5 text-xs text-stone-600 bg-stone-50/70 rounded-xl px-2.5 py-1.5 border border-stone-100">
              <span className="font-bold text-stone-900 flex items-center gap-1.5 truncate">
                <span className="w-2 h-2 rounded-full bg-amber-700 shrink-0"></span>
                <span>
                  {r.instrument_name ||
                    (isAr
                      ? `في انتظار تخصيص (${r.requested_type || "آلة"})`
                      : `Awaiting assignment (${r.requested_type || "Instrument"})`)}
                </span>
              </span>
              {renderMusician(r)}
              <span className="text-stone-300">•</span>
              <span className="whitespace-nowrap font-medium text-stone-700 flex items-center gap-1">
                <CalendarDays className="w-3.5 h-3.5 text-stone-400 shrink-0" />
                <span>
                  {new Date(r.start_time).toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                  })}
                </span>
                <span className="text-stone-500 font-normal">
                  ({new Date(r.start_time).toLocaleTimeString([], SHORT_TIME)}
                  {" – "}
                  {new Date(r.end_time).toLocaleTimeString([], SHORT_TIME)})
                </span>
              </span>
              {renderLocationBadge(r)}
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 pt-0.5">
              {/* Left Side: Badges + Actions */}
              <div className="flex flex-wrap items-center gap-1.5 min-w-0">
                {(r.is_full_day ||
                  (r.start_hhmm === "09:00" && r.end_hhmm === "22:00")) && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-amber-100 text-amber-900 border border-amber-300 text-[10px] font-bold">
                    <Sun className="w-3 h-3 text-amber-700 shrink-0" />
                    <span>{t("common.fullDay")}</span>
                  </span>
                )}
                {(() => {
                  let limits: string[] = [];
                  try {
                    limits = Array.isArray(r.exceeded_limits)
                      ? r.exceeded_limits
                      : typeof r.exceeded_limits === "string"
                        ? JSON.parse(r.exceeded_limits)
                        : [];
                  } catch {
                    // ignore
                  }
                  if (limits && limits.length > 0) {
                    return (
                      <span
                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-bold bg-amber-100 text-amber-900 border border-amber-300"
                        title={limits.join(", ")}
                      >
                        <AlertTriangle className="w-3 h-3 text-amber-700 shrink-0" />
                        <span>
                          {isAr
                            ? `تجاوز ${limits.length} حدود`
                            : `${limits.length} limits exceeded`}
                        </span>
                      </span>
                    );
                  }
                  return null;
                })()}
                {r.is_no_show && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-bold bg-rose-100 text-rose-800 border border-rose-200">
                    <AlertTriangle className="w-3 h-3 text-rose-600 shrink-0" />
                    <span>{t("common.noShow")}</span>
                  </span>
                )}

                {/* Inline action buttons — same row as Details, left aligned */}
                {!isSelectionMode && (
                  <>
                    {isPending && (
                      <>
                        {r.is_type_request && !r.instrument_id ? (
                          <button
                            type="button"
                            onClick={() =>
                              openAssignModal &&
                              openAssignModal(r, false, false)
                            }
                            className="min-h-[32px] px-3 py-1.5 rounded-xl bg-purple-700 hover:bg-purple-800 active:bg-purple-900 text-white text-xs font-bold transition-all duration-150 cursor-pointer shadow-xs hover:shadow flex items-center justify-center gap-1.5 touch-manipulation active:scale-[0.98] whitespace-nowrap"
                            title="Allocate instrument & approve"
                          >
                            <Sparkles className="w-4 h-4 shrink-0 stroke-[2.5]" />
                            <span>
                              {isAr ? "تخصيص آلة واعتماد" : "Assign Instrument"}
                            </span>
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => handleApprove(r.id)}
                            className="min-h-[32px] px-3 py-1.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 active:bg-emerald-900 text-white text-xs font-bold transition-all duration-150 cursor-pointer shadow-xs hover:shadow flex items-center justify-center gap-1.5 touch-manipulation active:scale-[0.98] whitespace-nowrap"
                            title="Approve request"
                          >
                            <Check className="w-4 h-4 shrink-0 stroke-[2.5]" />
                            <span>{t("admin.review.approveBtn")}</span>
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => openRejectModal(r)}
                          className="min-h-[32px] px-3 py-1.5 rounded-xl bg-white hover:bg-red-50 active:bg-red-100 text-red-700 border border-stone-300 hover:border-red-300 text-xs font-bold transition-all duration-150 cursor-pointer shadow-2xs hover:shadow-xs flex items-center justify-center gap-1.5 touch-manipulation active:scale-[0.98] whitespace-nowrap"
                          title="Reject request"
                        >
                          <X className="w-4 h-4 shrink-0 stroke-[2.5]" />
                          <span>{t("admin.review.rejectBtn")}</span>
                        </button>
                      </>
                    )}

                    {r.status === "approved" && openAssignModal && (
                      <button
                        type="button"
                        onClick={() => openAssignModal(r, false, true)}
                        className="min-h-[32px] px-3 py-1.5 rounded-xl bg-stone-100 hover:bg-stone-200 active:bg-stone-300 text-stone-700 text-xs font-bold transition-all duration-150 cursor-pointer flex items-center justify-center gap-1.5 whitespace-nowrap"
                        title="Move approved booking to a different instrument"
                      >
                        <Sparkles className="w-3.5 h-3.5 text-amber-700 shrink-0" />
                        <span>{isAr ? "تغيير الآلة" : "Reassign"}</span>
                      </button>
                    )}

                    {r.status === "completed" &&
                      (r.is_no_show ? (
                        <button
                          type="button"
                          onClick={() => handleUnmarkNoShow(r.id)}
                          className="min-h-[32px] px-3 py-1.5 rounded-xl bg-white hover:bg-stone-100 active:bg-stone-200 text-stone-700 border border-stone-300 text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-2xs hover:shadow-xs touch-manipulation whitespace-nowrap"
                          title={t("common.unmarkNoShow")}
                        >
                          <UserCheck className="w-4 h-4 text-stone-600 shrink-0" />
                          <span>{t("common.unmarkNoShow")}</span>
                        </button>
                      ) : (
                        showNoShowActions && (
                          <button
                            type="button"
                            onClick={() => handleMarkNoShow(r.id)}
                            className="min-h-[32px] px-3 py-1.5 rounded-xl bg-rose-50 hover:bg-rose-100 active:bg-rose-200 text-rose-800 border border-rose-300 text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-2xs hover:shadow-xs touch-manipulation whitespace-nowrap"
                            title={t("common.markNoShow")}
                          >
                            <UserX className="w-4 h-4 text-rose-700 shrink-0" />
                            <span>{t("common.markNoShow")}</span>
                          </button>
                        )
                      ))}
                  </>
                )}
              </div>{" "}
              {/* End Left Side */}
              <div className="shrink-0 ml-auto">
                {renderDetailsButton(r.id, "View details and conversation")}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const quickTabClass = (active: boolean) =>
    `shrink-0 whitespace-nowrap px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
      active
        ? "bg-amber-800 text-white shadow-xs"
        : "bg-stone-100 text-stone-600 hover:text-stone-900"
    }`;

  return (
    <div className="bg-white border border-stone-200 rounded-2xl p-5 shadow-2xs space-y-4">
      <div className="flex items-center justify-between gap-2 border-b border-stone-100 pb-3">
        <div className="flex items-center gap-2 overflow-x-auto -mx-1 px-1">
          <button
            onClick={() => {
              setFilterQuickTab("pending");
              setReviewFilters((prev) => ({ ...prev, statuses: ["pending"] }));
            }}
            className={quickTabClass(filterQuickTab === "pending")}
          >
            {t("admin.review.pendingTab", { count: stats.pendingRequests })}
          </button>
          <button
            onClick={() => {
              setFilterQuickTab("all");
              setReviewFilters((prev) => ({ ...prev, statuses: [] }));
            }}
            className={quickTabClass(filterQuickTab === "all")}
          >
            {t("common.all")}
          </button>
        </div>

        <div className="flex items-center gap-2">
          <ReservationFiltersPopover
            open={showReviewFilters}
            onToggle={() => setShowReviewFilters((open) => !open)}
            filters={reviewFilters}
            onChange={setReviewFilters}
            options={reviewFilterOptions}
            getOwnerName={getRowOwnerName}
            isAr={isAr}
          />
          {!isSelectionMode &&
            !loadingReservations &&
            reservations.length > 0 && (
              <button
                type="button"
                onClick={enterSelectionMode}
                className="shrink-0 px-3 py-1.5 rounded-xl bg-amber-800 hover:bg-amber-900 text-white text-xs font-bold transition cursor-pointer flex items-center gap-1.5 shadow-xs"
                title={t("admin.review.selectModeTooltip")}
              >
                <CheckSquare className="w-3.5 h-3.5" />
                <span>{t("admin.review.selectModeBtn")}</span>
              </button>
            )}
          <button
            onClick={fetchReservations}
            className="shrink-0 p-2 rounded-xl bg-stone-50 hover:bg-stone-100 text-stone-600 border border-stone-200 transition cursor-pointer"
            title={t("admin.review.refreshTooltip")}
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {isSelectionMode && (
        <div
          id="bulk-selection-desktop-toolbar"
          role="toolbar"
          aria-label={t("admin.review.bulkActionsLabel")}
          className="hidden sm:flex items-center justify-between gap-3 rounded-2xl border border-amber-200 bg-amber-50/70 px-3 py-2.5"
        >
          <div className="flex items-center gap-3 min-w-0">
            <label
              htmlFor="select-all-reservations-checkbox-desktop"
              className="flex items-center gap-2 cursor-pointer min-w-0"
            >
              <input
                id="select-all-reservations-checkbox-desktop"
                type="checkbox"
                aria-label="Select all visible reservations"
                checked={allSelected}
                ref={(el) => {
                  if (el) el.indeterminate = someSelected;
                }}
                onChange={handleToggleSelectAllReservations}
                className="w-4 h-4 rounded accent-amber-800 text-amber-800 border-stone-300 focus:ring-amber-700/20 cursor-pointer shrink-0"
              />
              <span className="text-xs font-bold text-amber-950 truncate">
                {selectedReservationIds.length > 0
                  ? t("admin.review.selectedCount", {
                      count: selectedReservationIds.length,
                      total: reservations.length,
                    })
                  : t("admin.review.selectAllVisible", {
                      count: reservations.length,
                    })}
              </span>
            </label>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              id="btn-bulk-cancel-selected-desktop"
              type="button"
              disabled={selectedReservationIds.length === 0}
              onClick={handleTriggerBulkCancel}
              className="px-3 py-1.5 rounded-xl bg-amber-700 hover:bg-amber-800 disabled:bg-stone-200 disabled:text-stone-500 disabled:shadow-none disabled:cursor-not-allowed text-white text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-xs"
            >
              <XCircle className="w-3.5 h-3.5 shrink-0" />
              <span>{t("admin.review.cancelSelected")}</span>
            </button>

            {isSuperAdmin && (
              <button
                id="btn-bulk-delete-selected-desktop"
                type="button"
                disabled={selectedReservationIds.length === 0}
                onClick={handleTriggerBulkDelete}
                className="px-3 py-1.5 rounded-xl bg-red-700 hover:bg-red-800 disabled:bg-stone-200 disabled:text-stone-500 disabled:shadow-none disabled:cursor-not-allowed text-white text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-xs"
              >
                <Trash2 className="w-3.5 h-3.5 shrink-0" />
                <span>{t("admin.review.deleteSelected")}</span>
              </button>
            )}

            <div className="w-px h-5 bg-amber-200 mx-1" />

            <button
              type="button"
              onClick={exitSelectionMode}
              className="px-3 py-1.5 rounded-xl bg-white hover:bg-stone-50 text-stone-700 border border-stone-200 text-xs font-bold transition cursor-pointer"
            >
              {t("admin.review.exitSelection")}
            </button>
          </div>
        </div>
      )}

      <ActiveFiltersBar
        filters={reviewFilters}
        onChange={setReviewFilters}
        translateStatus={translateStatus}
      />

      <div className="mt-2">
        {loadingReservations ? (
          <div className="py-12 flex flex-col items-center gap-2 text-stone-500">
            <RefreshCw className="w-4 h-4 animate-spin text-amber-700" />
            <div className="text-xs">{t("admin.review.loading")}</div>
          </div>
        ) : reservations.length === 0 ? (
          <div className="py-12 text-center text-stone-400 text-xs">
            {t("admin.review.empty")}
          </div>
        ) : (
          <div className="space-y-3">
            {groupedReservationItems.map((item) =>
              item.type === "series"
                ? renderSeriesCard(item)
                : renderSingleCard(item.reservation),
            )}
          </div>
        )}
      </div>
    </div>
  );
};
