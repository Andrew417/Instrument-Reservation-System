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
  ChevronUp,
} from "lucide-react";
import { getStatusColor, getReservationTypeColor } from "../../../lib/status-colors";
import {
  ReservationFiltersPopover,
  ActiveFiltersBar,
  type ReservationFilterState,
} from "../../ReservationFiltersPopover";
import { isNoShowWindowOpen } from "../../../lib/date-utils";
import { LoadingSpinner } from "../../shared/LoadingSpinner";
import { EmptyStateCard } from "../../shared/EmptyStateCard";

export interface ReviewTabProps {
  reservations: any[];
  loadingReservations: boolean;
  filterQuickTab: "all" | "today" | "pending";
  setFilterQuickTab: (tab: "all" | "today" | "pending") => void;
  reviewFilters: ReservationFilterState;
  setReviewFilters: React.Dispatch<React.SetStateAction<ReservationFilterState>>;
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
  openRejectModal: (r: any) => void;
  handleMarkNoShow: (id: string) => void;
  handleUnmarkNoShow: (id: string) => void;
  noShowWindowNow: number;
  isReservationAdminBooked: (r: any) => boolean;
  getAdminDisplayName: (r: any) => string;
  openCancelModal?: (r: any) => void;
  expandedSeriesIds?: string[];
  setExpandedSeriesIds?: React.Dispatch<React.SetStateAction<string[]>>;
}

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
  openRejectModal,
  handleMarkNoShow,
  handleUnmarkNoShow,
  noShowWindowNow,
  isReservationAdminBooked,
  getAdminDisplayName,
}) => {
  const { t } = useTranslation();
  const [expandedSeries, setExpandedSeries] = React.useState<string[]>([]);

  const toggleSeriesExpansion = (seriesId: string) => {
    setExpandedSeries((prev) =>
      prev.includes(seriesId)
        ? prev.filter((id) => id !== seriesId)
        : [...prev, seriesId],
    );
  };

  // Group standalone and series reservations
  const { seriesGroups, standaloneRows } = React.useMemo(() => {
    const sMap: Record<string, any[]> = {};
    const singles: any[] = [];

    for (const r of reservations) {
      if (r.series_id) {
        if (!sMap[r.series_id]) sMap[r.series_id] = [];
        sMap[r.series_id].push(r);
      } else {
        singles.push(r);
      }
    }
    return { seriesGroups: sMap, standaloneRows: singles };
  }, [reservations]);

  return (
    <div className="bg-white border border-stone-200 rounded-2xl p-5 shadow-2xs space-y-4">
      <div className="flex items-center justify-between gap-2 border-b border-stone-100 pb-3 flex-wrap">
        <div className="flex items-center gap-2 overflow-x-auto -mx-1 px-1">
          <button
            onClick={() => {
              setFilterQuickTab("pending");
              setReviewFilters((prev) => ({
                ...prev,
                statuses: ["pending"],
              }));
            }}
            className={`shrink-0 whitespace-nowrap px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
              filterQuickTab === "pending"
                ? "bg-amber-800 text-white shadow-xs"
                : "bg-stone-100 text-stone-600 hover:text-stone-900"
            }`}
          >
            {t("admin.review.pendingTab", {
              count: stats.pendingRequests,
            })}
          </button>
          <button
            onClick={() => {
              setFilterQuickTab("all");
              setReviewFilters((prev) => ({ ...prev, statuses: [] }));
            }}
            className={`shrink-0 whitespace-nowrap px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
              filterQuickTab === "all"
                ? "bg-amber-800 text-white shadow-xs"
                : "bg-stone-100 text-stone-600 hover:text-stone-900"
            }`}
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

      {/* Desktop-only selection toolbar */}
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
                checked={
                  reservations.length > 0 &&
                  reservations.every((r) =>
                    selectedReservationIds.includes(r.id),
                  )
                }
                onChange={(e) => {
                  if (e.target.checked) {
                    setSelectedReservationIds(reservations.map((r) => r.id));
                  } else {
                    setSelectedReservationIds([]);
                  }
                }}
                className="w-4 h-4 rounded text-amber-800 focus:ring-amber-700 cursor-pointer"
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

          <div className="flex items-center gap-2">
            <button
              id="btn-bulk-cancel-selected-desktop"
              type="button"
              disabled={selectedReservationIds.length === 0}
              onClick={handleTriggerBulkCancel}
              className="px-3 py-1.5 rounded-xl bg-amber-700 hover:bg-amber-800 disabled:opacity-50 text-white text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-xs"
            >
              <XCircle className="w-3.5 h-3.5" />
              <span>{t("admin.review.cancelSelected")}</span>
            </button>

            {isSuperAdmin && (
              <button
                id="btn-bulk-delete-selected-desktop"
                type="button"
                disabled={selectedReservationIds.length === 0}
                onClick={handleTriggerBulkDelete}
                className="px-3 py-1.5 rounded-xl bg-red-700 hover:bg-red-800 disabled:opacity-50 text-white text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-xs"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>{t("admin.review.deleteSelected")}</span>
              </button>
            )}

            <button
              type="button"
              onClick={exitSelectionMode}
              className="px-3 py-1.5 rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-700 text-xs font-bold transition cursor-pointer"
            >
              {t("admin.review.exitSelection")}
            </button>
          </div>
        </div>
      )}

      {/* Active filters summary bar */}
      <ActiveFiltersBar
        filters={reviewFilters}
        onChange={setReviewFilters}
        translateStatus={translateStatus}
      />

      {loadingReservations ? (
        <LoadingSpinner centered label={t("admin.review.loading") || "Loading review requests..."} />
      ) : reservations.length === 0 ? (
        <EmptyStateCard
          description={
            filterQuickTab === "pending"
              ? t("admin.review.emptyPending")
              : t("admin.review.emptyAll")
          }
        />
      ) : (
        <div className="space-y-4">
          {/* Recurring series cards */}
          {Object.entries(seriesGroups).map(([seriesId, occs]) => {
            const primary = occs[0];
            const isExpanded = expandedSeries.includes(seriesId);
            const hasPending = occs.some((o) => o.status === "pending");

            return (
              <div
                key={seriesId}
                className="border border-stone-200 rounded-2xl bg-white overflow-hidden shadow-2xs space-y-0"
              >
                <div
                  className="p-4 bg-amber-50/40 border-b border-stone-200/80 flex items-center justify-between gap-3 cursor-pointer hover:bg-amber-50/70 transition flex-wrap"
                  onClick={() => toggleSeriesExpansion(seriesId)}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-8 h-8 rounded-xl bg-amber-100 border border-amber-300 text-amber-900 flex items-center justify-center font-bold shrink-0">
                      <Repeat className="w-4 h-4 text-amber-800" />
                    </div>
                    <div className="min-w-0">
                      <div className="font-bold text-stone-900 text-sm truncate">
                        {primary.service_name} ({occs.length} dates)
                      </div>
                      <div className="text-xs text-stone-500 truncate">
                        {primary.user_name} • {primary.instrument_name}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {hasPending && (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-amber-100 text-amber-900 border border-amber-300">
                        {t("common.pending")}
                      </span>
                    )}
                    <button
                      type="button"
                      className="text-stone-400 hover:text-stone-700 p-1 rounded-lg"
                      aria-label="Toggle series"
                    >
                      {isExpanded ? (
                        <ChevronUp className="w-4 h-4" />
                      ) : (
                        <ChevronDown className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                </div>

                {isExpanded && (
                  <div className="p-3 space-y-2 bg-stone-50/40">
                    {occs.map((r) => (
                      <div
                        key={r.id}
                        className="p-3 bg-white rounded-xl border border-stone-200 flex items-center justify-between gap-2 text-xs"
                      >
                        <div>
                          <div className="font-semibold text-stone-900">
                            {new Date(r.start_time).toLocaleDateString()}
                          </div>
                          <div className="text-[11px] text-stone-500">
                            {new Date(r.start_time).toLocaleTimeString([], {
                              hour: "2-digit",
                              minute: "2-digit",
                            })}{" "}
                            –{" "}
                            {new Date(r.end_time).toLocaleTimeString([], {
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${getStatusColor(
                              r.status,
                            )}`}
                          >
                            {translateStatus(r.status)}
                          </span>

                          {r.status === "pending" && (
                            <button
                              type="button"
                              onClick={() => handleApprove(r.id)}
                              className="px-2.5 py-1 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs"
                            >
                              {t("admin.review.approveBtn")}
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}

          {/* Standalone reservation cards */}
          {standaloneRows.map((r) => {
            const isPending = r.status === "pending";

            return (
              <div
                key={r.id}
                className="border border-stone-200 rounded-2xl bg-white overflow-hidden shadow-2xs hover:border-amber-300 transition"
              >
                <div className="p-4 space-y-2.5">
                  <div className="flex items-start justify-between gap-2 flex-wrap">
                    <div className="min-w-0">
                      <div className="font-bold text-stone-900 text-sm truncate">
                        {r.service_name}
                      </div>
                      <div className="text-xs text-stone-500 flex items-center gap-1.5 flex-wrap">
                        {isReservationAdminBooked(r) ? (
                          <span className="inline-flex items-center gap-1 font-bold text-amber-800">
                            <Shield className="w-3 h-3 text-amber-700 shrink-0" />
                            <span>{getAdminDisplayName(r)}</span>
                          </span>
                        ) : (
                          <button
                            type="button"
                            onClick={() => r.user_id && openUserProfile(r.user_id)}
                            className="font-semibold text-stone-700 hover:text-amber-800 hover:underline flex items-center gap-1 cursor-pointer"
                          >
                            <span>{r.user_name || "Member"}</span>
                            <ExternalLink className="w-3 h-3 text-stone-400" />
                          </button>
                        )}
                        <span className="text-stone-300">•</span>
                        <span className="font-medium text-stone-800">
                          {r.instrument_name}
                        </span>
                      </div>
                    </div>

                    <span
                      className={`shrink-0 px-2.5 py-0.5 rounded-full text-[10px] font-bold ${getStatusColor(
                        r.status,
                      )}`}
                    >
                      {translateStatus(r.status)}
                    </span>
                  </div>

                  <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs text-stone-600 bg-stone-50/70 rounded-xl px-2.5 py-1.5 border border-stone-100">
                    <span className="flex items-center gap-1">
                      <CalendarDays className="w-3.5 h-3.5 text-stone-400 shrink-0" />
                      <span>{new Date(r.start_time).toLocaleDateString()}</span>
                    </span>
                    <span className="text-stone-300">•</span>
                    <span>
                      {new Date(r.start_time).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}{" "}
                      –{" "}
                      {new Date(r.end_time).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                    {r.service_location && (
                      <>
                        <span className="text-stone-300">•</span>
                        <span className="inline-flex items-center gap-1 font-semibold text-amber-950">
                          <Church className="w-3 h-3 text-amber-800 shrink-0" />
                          <span>{r.service_location}</span>
                        </span>
                      </>
                    )}
                  </div>

                  <div className="flex items-center justify-between gap-2 pt-1 flex-wrap">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {(r.is_full_day ||
                        (r.start_hhmm === "09:00" && r.end_hhmm === "22:00")) && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-amber-100 text-amber-900 border border-amber-300 text-[10px] font-bold">
                          <Sun className="w-3 h-3 text-amber-700 shrink-0" />
                          <span>{t("common.fullDay")}</span>
                        </span>
                      )}
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
                      {r.is_no_show && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-bold bg-rose-100 text-rose-800 border border-rose-200">
                          <AlertTriangle className="w-3 h-3 text-rose-600 shrink-0" />
                          <span>{t("common.noShow")}</span>
                        </span>
                      )}
                    </div>

                    {!isSelectionMode && onOpenReservationDetail && (
                      <button
                        type="button"
                        onClick={() => onOpenReservationDetail(r.id)}
                        className="px-3 py-1.5 rounded-xl bg-stone-900 hover:bg-stone-800 text-white text-xs font-bold transition cursor-pointer"
                      >
                        {t("admin.review.detailsChatBtn")}
                      </button>
                    )}
                  </div>
                </div>

                {/* Actions bottom bar */}
                {!isSelectionMode &&
                  (isPending ||
                    (r.status === "completed" &&
                      (r.is_no_show ||
                        isNoShowWindowOpen(r, noShowWindowNow)))) && (
                    <div className="px-4 py-2.5 bg-stone-50 border-t border-stone-200 flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        {isPending && (
                          <>
                            <button
                              type="button"
                              onClick={() => handleApprove(r.id)}
                              className="px-3 py-1.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold flex items-center gap-1 cursor-pointer"
                            >
                              <Check className="w-4 h-4" />
                              <span>{t("admin.review.approveBtn")}</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => openRejectModal(r)}
                              className="px-3 py-1.5 rounded-xl bg-white hover:bg-red-50 text-red-700 border border-stone-300 text-xs font-bold flex items-center gap-1 cursor-pointer"
                            >
                              <X className="w-4 h-4" />
                              <span>{t("admin.review.rejectBtn")}</span>
                            </button>
                          </>
                        )}
                        {r.status === "completed" &&
                          (r.is_no_show ? (
                            <button
                              type="button"
                              onClick={() => handleUnmarkNoShow(r.id)}
                              className="px-3 py-1.5 rounded-xl bg-white hover:bg-stone-100 text-stone-700 border border-stone-300 text-xs font-bold flex items-center gap-1 cursor-pointer"
                            >
                              <UserCheck className="w-4 h-4" />
                              <span>{t("common.unmarkNoShow")}</span>
                            </button>
                          ) : isNoShowWindowOpen(r, noShowWindowNow) ? (
                            <button
                              type="button"
                              onClick={() => handleMarkNoShow(r.id)}
                              className="px-3 py-1.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-800 border border-rose-300 text-xs font-bold flex items-center gap-1 cursor-pointer"
                            >
                              <UserX className="w-4 h-4" />
                              <span>{t("common.markNoShow")}</span>
                            </button>
                          ) : null)}
                      </div>
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
