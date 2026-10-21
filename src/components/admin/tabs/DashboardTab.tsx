import React from "react";
import { useTranslation } from "react-i18next";
import { RefreshCw, CalendarDays, Shield } from "lucide-react";
import { getStatusColor } from "../../../lib/status-colors";
import {
  ReservationFiltersPopover,
  ActiveFiltersBar,
  type ReservationFilterState,
} from "../../ReservationFiltersPopover";
import { LoadingSpinner } from "../../shared/LoadingSpinner";
import { EmptyStateCard } from "../../shared/EmptyStateCard";

export interface DashboardTabProps {
  dashboardSubTab: "today" | "upcoming";
  setDashboardSubTab: (sub: "today" | "upcoming") => void;
  fetchTodaysReservations: () => void;
  fetchUpcomingReservations: () => void;
  showDashboardFilters: boolean;
  setShowDashboardFilters: React.Dispatch<React.SetStateAction<boolean>>;
  dashboardFilters: ReservationFilterState;
  setDashboardFilters: React.Dispatch<React.SetStateAction<ReservationFilterState>>;
  dashboardFilterOptions: any;
  getRowOwnerName: (r: any) => string;
  isAr: boolean;
  translateStatus: (status: string) => string;
  loadingTodaysReservations: boolean;
  todaysReservations: any[];
  loadingUpcomingReservations: boolean;
  upcomingReservations: any[];
  filterDashboardReservations: (list: any[]) => any[];
  onOpenReservationDetail?: (id: string) => void;
  isReservationAdminBooked: (r: any) => boolean;
  getAdminDisplayName: (r: any) => string;
}

export const DashboardTab: React.FC<DashboardTabProps> = ({
  dashboardSubTab,
  setDashboardSubTab,
  fetchTodaysReservations,
  fetchUpcomingReservations,
  showDashboardFilters,
  setShowDashboardFilters,
  dashboardFilters,
  setDashboardFilters,
  dashboardFilterOptions,
  getRowOwnerName,
  isAr,
  translateStatus,
  loadingTodaysReservations,
  todaysReservations,
  loadingUpcomingReservations,
  upcomingReservations,
  filterDashboardReservations,
  onOpenReservationDetail,
  isReservationAdminBooked,
  getAdminDisplayName,
}) => {
  const { t } = useTranslation();

  return (
    <div>
      {/* Schedule Card with Today / Upcoming tabs */}
      <div className="bg-white border border-stone-200 rounded-2xl p-5 shadow-2xs space-y-4">
        <div className="flex items-center justify-between gap-2 border-b border-stone-100 pb-3 flex-wrap">
          <div className="flex items-center gap-1.5 bg-stone-100 p-1 rounded-2xl border border-stone-200">
            <button
              type="button"
              id="dashboard-subtab-today"
              onClick={() => {
                setDashboardSubTab("today");
                fetchTodaysReservations();
              }}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer whitespace-nowrap ${
                dashboardSubTab === "today"
                  ? "bg-amber-800 text-white shadow-2xs"
                  : "text-stone-600 hover:text-stone-900"
              }`}
            >
              {t("admin.dashboard.tabToday")}
            </button>
            <button
              type="button"
              id="dashboard-subtab-upcoming"
              onClick={() => {
                setDashboardSubTab("upcoming");
                fetchUpcomingReservations();
              }}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer whitespace-nowrap ${
                dashboardSubTab === "upcoming"
                  ? "bg-amber-800 text-white shadow-2xs"
                  : "text-stone-600 hover:text-stone-900"
              }`}
            >
              {t("admin.dashboard.tabUpcoming")}
            </button>
          </div>

          <div className="flex items-center gap-2 relative">
            <ReservationFiltersPopover
              open={showDashboardFilters}
              onToggle={() => setShowDashboardFilters((open) => !open)}
              filters={dashboardFilters}
              onChange={setDashboardFilters}
              options={dashboardFilterOptions}
              getOwnerName={getRowOwnerName}
              isAr={isAr}
            />

            <button
              type="button"
              onClick={() => {
                if (dashboardSubTab === "today") fetchTodaysReservations();
                else fetchUpcomingReservations();
              }}
              className="shrink-0 p-2 rounded-xl bg-stone-50 hover:bg-stone-100 text-stone-600 border border-stone-200 transition cursor-pointer"
              title={t("admin.dashboard.refreshTooltip")}
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Active filters summary bar — identical to Review tab */}
        <ActiveFiltersBar
          filters={dashboardFilters}
          onChange={setDashboardFilters}
          translateStatus={translateStatus}
        />

        {dashboardSubTab === "today" ? (
          loadingTodaysReservations ? (
            <LoadingSpinner centered label={t("admin.dashboard.loading") || "Loading today's schedule..."} />
          ) : (
            (() => {
              const todayApproved = filterDashboardReservations(
                todaysReservations,
              )
                .filter(
                  (r) =>
                    r.status === "approved" ||
                    r.status === "ongoing" ||
                    r.status === "completed",
                )
                .sort(
                  (a, b) =>
                    new Date(a.start_time).getTime() -
                    new Date(b.start_time).getTime(),
                );
              if (todayApproved.length === 0) {
                return (
                  <EmptyStateCard
                    description={t("admin.dashboard.empty")}
                  />
                );
              }
              return (
                <div className="space-y-2">
                  {todayApproved.map((r) => (
                    <div
                      key={r.id}
                      role={
                        onOpenReservationDetail ? "button" : undefined
                      }
                      tabIndex={onOpenReservationDetail ? 0 : undefined}
                      onClick={
                        onOpenReservationDetail
                          ? () => onOpenReservationDetail(r.id)
                          : undefined
                      }
                      onKeyDown={
                        onOpenReservationDetail
                          ? (e) => {
                              if (e.key === "Enter" || e.key === " ") {
                                e.preventDefault();
                                onOpenReservationDetail(r.id);
                              }
                            }
                          : undefined
                      }
                      className={`flex items-center justify-between gap-3 p-3 rounded-xl border border-stone-200 bg-stone-50/50 transition ${
                        onOpenReservationDetail
                          ? "cursor-pointer hover:border-amber-400 hover:bg-amber-50/40 hover:shadow-xs active:scale-[0.995] focus:outline-none focus:ring-2 focus:ring-amber-600/30"
                          : ""
                      }`}
                    >
                      <div className="min-w-0">
                        <div className="font-semibold text-stone-900 text-xs truncate">
                          {r.instrument_name} — {r.service_name}
                        </div>
                        <div className="text-[11px] text-stone-500 flex items-center gap-1.5 flex-wrap">
                          {isReservationAdminBooked(r) ? (
                            <span className="inline-flex items-center gap-1 font-bold text-amber-800">
                              <Shield className="w-3 h-3 text-amber-700 shrink-0" />
                              <span>{getAdminDisplayName(r)}</span>
                            </span>
                          ) : (
                            <span>{r.user_name || "Member"}</span>
                          )}
                          <span className="text-stone-300">·</span>
                          <span>
                            {new Date(r.start_time).toLocaleTimeString(
                              [],
                              {
                                hour: "2-digit",
                                minute: "2-digit",
                              },
                            )}{" "}
                            -{" "}
                            {new Date(r.end_time).toLocaleTimeString([], {
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </span>
                        </div>
                      </div>
                      <span
                        className={`shrink-0 px-2 py-0.5 rounded-full text-[10px] font-bold ${getStatusColor(
                          r.status,
                        )}`}
                      >
                        {translateStatus(r.status)}
                      </span>
                    </div>
                  ))}
                </div>
              );
            })()
          )
        ) : loadingUpcomingReservations ? (
          <LoadingSpinner centered label={t("admin.dashboard.loading") || "Loading upcoming schedule..."} />
        ) : (
          (() => {
            const sorted = [
              ...filterDashboardReservations(upcomingReservations),
            ].sort(
              (a, b) =>
                new Date(a.start_time).getTime() -
                new Date(b.start_time).getTime(),
            );
            if (sorted.length === 0) {
              return (
                <EmptyStateCard
                  description={t("admin.dashboard.emptyUpcoming")}
                />
              );
            }
            // Group by calendar day (Cairo time)
            const groups: Record<string, any[]> = {};
            for (const r of sorted) {
              const d = new Date(r.start_time);
              const key = `${d.getFullYear()}-${String(
                d.getMonth() + 1,
              ).padStart(2, "0")}-${String(d.getDate()).padStart(
                2,
                "0",
              )}`;
              if (!groups[key]) groups[key] = [];
              groups[key].push(r);
            }
            const dayKeys = Object.keys(groups).sort();
            return (
              <div className="space-y-5">
                {dayKeys.map((dayKey) => {
                  const dayRows = groups[dayKey];
                  const d = new Date(dayRows[0].start_time);
                  const weekday = d.toLocaleDateString(
                    isAr ? "ar-EG" : "en-US",
                    { weekday: "short" },
                  );
                  const dd = String(d.getDate()).padStart(2, "0");
                  const mm = String(d.getMonth() + 1).padStart(2, "0");
                  const yyyy = d.getFullYear();
                  const dayLabel = `${weekday} - ${dd}/${mm}/${yyyy}`;
                  return (
                    <div key={dayKey} className="space-y-2">
                      <div className="sticky top-0 z-10 bg-white/95 backdrop-blur-xs py-1.5 flex items-center gap-2.5">
                        <CalendarDays className="w-3.5 h-3.5 text-amber-800 shrink-0" />
                        <span className="text-xs font-extrabold text-amber-950 tracking-wide whitespace-nowrap">
                          {dayLabel}
                        </span>
                        <span className="text-[10px] font-bold text-amber-700 bg-amber-50 border border-amber-200 rounded-full px-2 py-0.5 shrink-0">
                          {dayRows.length}
                        </span>
                        {/* Primary-colored separator line beside the date */}
                        <span
                          className="flex-1 h-0.5 rounded-full bg-amber-700"
                          aria-hidden="true"
                        />
                      </div>
                      <div className="space-y-2">
                        {dayRows.map((r) => (
                          <div
                            key={r.id}
                            role={
                              onOpenReservationDetail
                                ? "button"
                                : undefined
                            }
                            tabIndex={
                              onOpenReservationDetail ? 0 : undefined
                            }
                            onClick={
                              onOpenReservationDetail
                                ? () => onOpenReservationDetail(r.id)
                                : undefined
                            }
                            onKeyDown={
                              onOpenReservationDetail
                                ? (e) => {
                                    if (
                                      e.key === "Enter" ||
                                      e.key === " "
                                    ) {
                                      e.preventDefault();
                                      onOpenReservationDetail(r.id);
                                    }
                                  }
                                : undefined
                            }
                            className={`flex items-center justify-between gap-3 p-3 rounded-xl border border-stone-200 bg-stone-50/50 transition ${
                              onOpenReservationDetail
                                ? "cursor-pointer hover:border-amber-400 hover:bg-amber-50/40 hover:shadow-xs active:scale-[0.995] focus:outline-none focus:ring-2 focus:ring-amber-600/30"
                                : ""
                            }`}
                          >
                            <div className="min-w-0">
                              <div className="font-semibold text-stone-900 text-xs truncate">
                                {r.instrument_name} — {r.service_name}
                              </div>
                              <div className="text-[11px] text-stone-500 flex items-center gap-1.5 flex-wrap">
                                {isReservationAdminBooked(r) ? (
                                  <span className="inline-flex items-center gap-1 font-bold text-amber-800">
                                    <Shield className="w-3 h-3 text-amber-700 shrink-0" />
                                    <span>{getAdminDisplayName(r)}</span>
                                  </span>
                                ) : (
                                  <span>{r.user_name || "Member"}</span>
                                )}
                                <span className="text-stone-300">·</span>
                                <span>
                                  {new Date(
                                    r.start_time,
                                  ).toLocaleTimeString([], {
                                    hour: "2-digit",
                                    minute: "2-digit",
                                  })}{" "}
                                  -{" "}
                                  {new Date(
                                    r.end_time,
                                  ).toLocaleTimeString([], {
                                    hour: "2-digit",
                                    minute: "2-digit",
                                  })}
                                </span>
                              </div>
                            </div>
                            <span
                              className={`shrink-0 px-2 py-0.5 rounded-full text-[10px] font-bold ${getStatusColor(
                                r.status,
                              )}`}
                            >
                              {translateStatus(r.status)}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          })()
        )}
      </div>
    </div>
  );
};
