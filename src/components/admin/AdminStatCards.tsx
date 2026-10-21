import React from "react";
import { useTranslation } from "react-i18next";
import {
  Clock,
  UserCheck,
  CalendarCheck,
  CalendarDays,
  Music2,
  Users,
} from "lucide-react";

export interface AdminStatCardsProps {
  stats: {
    pendingRequests: number;
    pendingUserApprovals?: number;
    todayReservations: number;
    upcomingApprovedCount?: number;
    totalInstruments: number;
    activeUsers: number;
  };
  onSelectTab: (tab: any) => void;
  onSelectDashboardSubTab: (sub: "today" | "upcoming") => void;
  onFilterPendingReview: () => void;
}

export const AdminStatCards: React.FC<AdminStatCardsProps> = ({
  stats,
  onSelectTab,
  onSelectDashboardSubTab,
  onFilterPendingReview,
}) => {
  const { t } = useTranslation();

  return (
    <div className="p-3 grid grid-cols-2 gap-2.5">
      {/* Pending Requests */}
      <button
        id="stat-card-pending"
        type="button"
        onClick={onFilterPendingReview}
        className="text-left rounded-xl border border-stone-200 bg-white hover:border-amber-400 hover:shadow-xs transition cursor-pointer p-2.5 flex items-start gap-2.5 group"
        title={t("admin.dashboard.pendingReviewNote")}
      >
        <div className="w-8 h-8 rounded-lg bg-amber-50 border border-amber-200/70 flex items-center justify-center shrink-0">
          <Clock className="w-4 h-4 text-amber-700" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-lg font-extrabold text-stone-900 leading-none">
            {stats.pendingRequests}
          </div>
          <div className="text-[11px] font-bold text-amber-900 mt-0.5 truncate group-hover:text-amber-950">
            {t("admin.pendingRequests")}
          </div>
          <div className="text-[10px] text-stone-400 mt-0.5 leading-tight line-clamp-2">
            {t("admin.dashboard.pendingReviewNote")}
          </div>
        </div>
      </button>

      {/* Account Approvals */}
      <button
        id="stat-card-approvals"
        type="button"
        onClick={() => onSelectTab("approvals")}
        className="text-left rounded-xl border border-stone-200 bg-white hover:border-amber-400 hover:shadow-xs transition cursor-pointer p-2.5 flex items-start gap-2.5 group relative"
        title={
          Number(stats.pendingUserApprovals || 0) > 0
            ? t("admin.dashboard.approvalsPendingNote")
            : t("admin.dashboard.approvalsAllDoneNote")
        }
      >
        <div className="w-8 h-8 rounded-lg bg-amber-50 border border-amber-200/70 flex items-center justify-center shrink-0 relative">
          <UserCheck className="w-4 h-4 text-amber-700" />
          {Number(stats.pendingUserApprovals || 0) > 0 && (
            <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-amber-500 animate-pulse ring-2 ring-white" />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-lg font-extrabold text-stone-900 leading-none">
            {stats.pendingUserApprovals || 0}
          </div>
          <div className="text-[11px] font-bold text-amber-900 mt-0.5 truncate group-hover:text-amber-950">
            {t("admin.accountApprovals")}
          </div>
          <div className="text-[10px] text-stone-400 mt-0.5 leading-tight line-clamp-2">
            {Number(stats.pendingUserApprovals || 0) > 0
              ? t("admin.dashboard.approvalsPendingNote")
              : t("admin.dashboard.approvalsAllDoneNote")}
          </div>
        </div>
      </button>

      {/* Today's Bookings */}
      <button
        id="stat-card-todays-bookings"
        type="button"
        onClick={() => {
          onSelectTab("dashboard");
          onSelectDashboardSubTab("today");
        }}
        className="text-left rounded-xl border border-stone-200 bg-white hover:border-emerald-400 hover:shadow-xs transition cursor-pointer p-2.5 flex items-start gap-2.5 group"
        title={t("admin.dashboard.todaysBookingsNote")}
      >
        <div className="w-8 h-8 rounded-lg bg-emerald-50 border border-emerald-200/70 flex items-center justify-center shrink-0">
          <CalendarCheck className="w-4 h-4 text-emerald-700" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-lg font-extrabold text-stone-900 leading-none">
            {stats.todayReservations}
          </div>
          <div className="text-[11px] font-bold text-emerald-900 mt-0.5 truncate group-hover:text-emerald-950">
            {t("admin.todaysBookings")}
          </div>
          <div className="text-[10px] text-stone-400 mt-0.5 leading-tight line-clamp-2">
            {t("admin.dashboard.todaysBookingsNote")}
          </div>
        </div>
      </button>

      {/* Upcoming Approved Bookings */}
      <button
        id="stat-card-upcoming-bookings"
        type="button"
        onClick={() => {
          onSelectTab("dashboard");
          onSelectDashboardSubTab("upcoming");
        }}
        className="text-left rounded-xl border border-stone-200 bg-white hover:border-emerald-400 hover:shadow-xs transition cursor-pointer p-2.5 flex items-start gap-2.5 group"
        title="Approved reservations scheduled in the future"
      >
        <div className="w-8 h-8 rounded-lg bg-emerald-50 border border-emerald-200/70 flex items-center justify-center shrink-0">
          <CalendarDays className="w-4 h-4 text-emerald-700" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-lg font-extrabold text-stone-900 leading-none">
            {stats.upcomingApprovedCount || 0}
          </div>
          <div className="text-[11px] font-bold text-emerald-900 mt-0.5 truncate group-hover:text-emerald-950">
            {t("admin.upcomingBookings")}
          </div>
          <div className="text-[10px] text-stone-400 mt-0.5 leading-tight line-clamp-2">
            Approved & upcoming
          </div>
        </div>
      </button>

      {/* Instruments */}
      <button
        id="stat-card-instruments"
        type="button"
        onClick={() => onSelectTab("instruments")}
        className="text-left rounded-xl border border-stone-200 bg-white hover:border-amber-400 hover:shadow-xs transition cursor-pointer p-2.5 flex items-start gap-2.5 group"
        title={t("admin.dashboard.totalInstrumentsNote")}
      >
        <div className="w-8 h-8 rounded-lg bg-stone-100 border border-stone-200 flex items-center justify-center shrink-0">
          <Music2 className="w-4 h-4 text-stone-700" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-lg font-extrabold text-stone-900 leading-none">
            {stats.totalInstruments}
          </div>
          <div className="text-[11px] font-bold text-stone-800 mt-0.5 truncate group-hover:text-stone-900">
            {t("admin.totalInstruments")}
          </div>
          <div className="text-[10px] text-stone-400 mt-0.5 leading-tight line-clamp-2">
            {t("admin.dashboard.totalInstrumentsNote")}
          </div>
        </div>
      </button>

      {/* Active Users */}
      <button
        id="stat-card-active-users"
        type="button"
        onClick={() => onSelectTab("users")}
        className="text-left rounded-xl border border-stone-200 bg-white hover:border-amber-400 hover:shadow-xs transition cursor-pointer p-2.5 flex items-start gap-2.5 group"
        title={t("admin.dashboard.activeUsersNote")}
      >
        <div className="w-8 h-8 rounded-lg bg-stone-100 border border-stone-200 flex items-center justify-center shrink-0">
          <Users className="w-4 h-4 text-stone-700" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-lg font-extrabold text-stone-900 leading-none">
            {stats.activeUsers}
          </div>
          <div className="text-[11px] font-bold text-stone-800 mt-0.5 truncate group-hover:text-stone-900">
            {t("admin.activeUsers")}
          </div>
          <div className="text-[10px] text-stone-400 mt-0.5 leading-tight line-clamp-2">
            {t("admin.dashboard.activeUsersNote")}
          </div>
        </div>
      </button>
    </div>
  );
};
