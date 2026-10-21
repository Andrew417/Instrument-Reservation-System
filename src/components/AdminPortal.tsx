import React, { useEffect } from "react";
import { useTranslation } from "react-i18next";
import {
  LayoutDashboard,
  CheckCircle2,
  Info,
  AlertTriangle,
  X,
  Download,
} from "lucide-react";

import { AnalyticsTab } from "./AnalyticsTab";
import { AdminStatCards } from "./admin/AdminStatCards";
import { BulkSelectionBottomBar } from "./admin/BulkSelectionBottomBar";
import { AdminModalsHost } from "./admin/AdminModalsHost";

import { DashboardTab } from "./admin/tabs/DashboardTab";
import { ReviewTab } from "./admin/tabs/ReviewTab";
import { ApprovalsTab } from "./admin/tabs/ApprovalsTab";
import { InstrumentsTab } from "./admin/tabs/InstrumentsTab";
import { UsersTab } from "./admin/tabs/UsersTab";
import { MessagingTab } from "./admin/tabs/MessagingTab";

import { HardLimitsTab } from "./admin/HardLimitsTab";
import { PaymentSettingsTab } from "./admin/PaymentSettingsTab";
import { NotificationSettingsTab } from "./admin/NotificationSettingsTab";
import { AdminAccountsTab } from "./admin/AdminAccountsTab";
import { TrustedStatusTab } from "./admin/TrustedStatusTab";

import {
  useAdminPortalData,
  AdminTab,
  ADMIN_TABS_EVENT,
  UseAdminPortalDataProps,
} from "./admin/useAdminPortalData";
import { DEFAULT_INSTRUMENT_TYPE } from "../constants/instruments";
import { getTodayDateString } from "../lib/date-utils";

export interface AdminPortalProps extends UseAdminPortalDataProps {}

export const AdminPortal: React.FC<AdminPortalProps> = (props) => {
  const admin = useAdminPortalData(props);
  const { t, i18n } = useTranslation();

  const translateStatus = (status: string) => t(`common.${status}`, status);

  return (
    <div
      id="admin-portal-root"
      className={`space-y-4 ${
        admin.activeTab === "review" && admin.isSelectionMode
          ? "pb-[calc(12rem+env(safe-area-inset-bottom,0px))] sm:pb-0"
          : ""
      }`}
    >
      {/* Feedback Banner */}
      {admin.feedback && (
        <div
          className={`p-3.5 rounded-2xl text-xs font-semibold flex items-center justify-between shadow-2xs border transition ${
            admin.feedback.type === "success"
              ? "bg-emerald-50 border-emerald-200 text-emerald-900"
              : admin.feedback.type === "info"
                ? "bg-amber-50 border-amber-200 text-amber-950"
                : "bg-red-50 border-red-200 text-red-900"
          }`}
        >
          <div className="flex items-center gap-2">
            {admin.feedback.type === "success" ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-700" />
            ) : admin.feedback.type === "info" ? (
              <Info className="w-4 h-4 text-amber-800" />
            ) : (
              <AlertTriangle className="w-4 h-4 text-red-700" />
            )}
            <span>{admin.feedback.message}</span>
          </div>
          <button
            onClick={() => admin.setFeedback(null)}
            className="text-stone-400 hover:text-stone-600 cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Admin Console Header Card */}
      <div className="bg-white border border-stone-200 rounded-2xl shadow-2xs overflow-hidden">
        {/* Row 1 — title + role + export button */}
        <div className="px-4 sm:px-5 py-3 flex items-center justify-between gap-3 border-b border-stone-100">
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-8 h-8 rounded-xl bg-amber-800 text-white flex items-center justify-center shrink-0 shadow-2xs">
              <LayoutDashboard className="w-4 h-4" />
            </div>
            <h1 className="text-sm sm:text-base font-bold text-stone-900 leading-tight whitespace-nowrap">
              {admin.isSuperAdmin
                ? t("admin.consoleTitle")
                : t("admin.adminTitle")}
            </h1>
            <span
              className={`px-2 py-0.5 rounded-md text-[10px] font-extrabold uppercase tracking-wider whitespace-nowrap ${
                admin.isSuperAdmin
                  ? "bg-amber-100 text-amber-900 border border-amber-200"
                  : "bg-stone-100 text-stone-700 border border-stone-200"
              }`}
            >
              {admin.isSuperAdmin ? t("common.superAdmin") : t("common.admin")}
            </span>
          </div>

          <button
            id="btn-admin-export-handover"
            type="button"
            onClick={() => {
              admin.setHandoverDefaultMode("day");
              admin.setHandoverDefaultDate(getTodayDateString());
              admin.setHandoverDefaultFormat("xlsx");
              admin.setShowHandoverModal(true);
            }}
            className="shrink-0 px-3 py-1.5 rounded-xl bg-amber-800 hover:bg-amber-900 text-white text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-xs"
            title="Export confirmed bookings handover sheet for key-holder (XLSX or CSV)"
          >
            <Download className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">
              {t("admin.exportHandover")}
            </span>
          </button>
        </div>

        {/* Row 2 — 5 stat cards */}
        <AdminStatCards
          stats={admin.stats}
          onSelectTab={admin.setActiveTab}
          onSelectDashboardSubTab={(sub) => {
            admin.setActiveTab("dashboard");
            admin.setDashboardSubTab(sub);
            if (sub === "upcoming") admin.fetchUpcomingReservations();
          }}
          onFilterPendingReview={() => {
            admin.setActiveTab("review");
            admin.setFilterQuickTab("pending");
            admin.setReviewFilters((prev) => ({
              ...prev,
              statuses: ["pending"],
            }));
          }}
        />
      </div>

      {/* Content Area for active tab */}
      <main className="flex-1 min-w-0 space-y-4">
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-[11px]">
          <span className="font-bold uppercase tracking-wider text-stone-400">
            {admin.isSuperAdmin ? t("common.superAdmin") : t("common.admin")}
          </span>
          <span className="text-stone-300">/</span>
          <span className="font-bold text-stone-700">
            {admin.activeTabTitle}
          </span>
        </div>

        {admin.activeTab === "dashboard" && (
          <DashboardTab
            dashboardSubTab={admin.dashboardSubTab}
            setDashboardSubTab={admin.setDashboardSubTab}
            fetchTodaysReservations={admin.fetchTodaysReservations}
            fetchUpcomingReservations={admin.fetchUpcomingReservations}
            showDashboardFilters={admin.showDashboardFilters}
            setShowDashboardFilters={admin.setShowDashboardFilters}
            dashboardFilters={admin.dashboardFilters}
            setDashboardFilters={admin.setDashboardFilters}
            dashboardFilterOptions={admin.dashboardFilterOptions}
            getRowOwnerName={admin.getRowOwnerName}
            isAr={admin.isAr}
            translateStatus={translateStatus}
            loadingTodaysReservations={admin.loadingTodaysReservations}
            todaysReservations={admin.todaysReservations}
            loadingUpcomingReservations={admin.loadingUpcomingReservations}
            upcomingReservations={admin.upcomingReservations}
            filterDashboardReservations={admin.filterDashboardReservations}
            onOpenReservationDetail={props.onOpenReservationDetail}
            isReservationAdminBooked={admin.isReservationAdminBooked}
            getAdminDisplayName={admin.getAdminDisplayName}
          />
        )}

        {admin.activeTab === "review" && (
          <ReviewTab
            reservations={admin.reservations}
            loadingReservations={admin.loadingReservations}
            filterQuickTab={admin.filterQuickTab}
            setFilterQuickTab={admin.setFilterQuickTab}
            reviewFilters={admin.reviewFilters}
            setReviewFilters={admin.setReviewFilters}
            showReviewFilters={admin.showReviewFilters}
            setShowReviewFilters={admin.setShowReviewFilters}
            reviewFilterOptions={admin.reviewFilterOptions}
            getRowOwnerName={admin.getRowOwnerName}
            isAr={admin.isAr}
            stats={admin.stats}
            isSelectionMode={admin.isSelectionMode}
            enterSelectionMode={admin.enterSelectionMode}
            exitSelectionMode={admin.exitSelectionMode}
            fetchReservations={admin.fetchReservations}
            selectedReservationIds={admin.selectedReservationIds}
            setSelectedReservationIds={admin.setSelectedReservationIds}
            handleTriggerBulkCancel={admin.handleTriggerBulkCancel}
            handleTriggerBulkDelete={admin.handleTriggerBulkDelete}
            isSuperAdmin={Boolean(admin.isSuperAdmin)}
            translateStatus={translateStatus}
            openUserProfile={admin.openUserProfile}
            onOpenReservationDetail={props.onOpenReservationDetail}
            handleApprove={admin.handleApprove}
            handleApproveSeries={admin.handleApproveSeries}
            openRejectModal={admin.openRejectModal}
            handleMarkNoShow={admin.handleMarkNoShow}
            handleUnmarkNoShow={admin.handleUnmarkNoShow}
            noShowWindowNow={admin.noShowWindowNow}
            isReservationAdminBooked={admin.isReservationAdminBooked}
            getAdminDisplayName={admin.getAdminDisplayName}
            openCancelModal={(r) => {
              admin.setCancelReasonModal({
                isOpen: true,
                ids: [r.id],
                preset: "Instrument in maintenance",
                customText: "",
                submitting: false,
              });
            }}
            expandedSeriesIds={admin.expandedSeriesIds}
            setExpandedSeriesIds={admin.setExpandedSeriesIds}
          />
        )}

        {admin.activeTab === "approvals" && (
          <ApprovalsTab
            approvalsList={admin.approvalsList}
            loadingApprovals={admin.loadingApprovals}
            approvalCounts={admin.approvalCounts}
            approvalFilterStatus={admin.approvalFilterStatus}
            setApprovalFilterStatus={admin.setApprovalFilterStatus}
            approvalSearch={admin.approvalSearch}
            setApprovalSearch={admin.setApprovalSearch}
            approvalActionId={admin.approvalActionId}
            fetchApprovals={admin.fetchApprovals}
            openUserProfile={admin.openUserProfile}
            handleApproveRegistration={admin.handleApproveRegistration}
            triggerRejectUser={admin.triggerRejectUser}
            triggerDeleteUserPermanently={admin.triggerDeleteUserPermanently}
            onNavigateToUsersWithSearch={(name) => {
              admin.setActiveTab("users");
              admin.setUserSearch(name);
            }}
          />
        )}

        {admin.activeTab === "instruments" && (
          <InstrumentsTab
            instrumentsList={admin.instrumentsList}
            loadingInstruments={admin.loadingInstruments}
            onOpenCreateInstrument={() => {
              admin.setEditingInstrument(null);
              admin.setInstrumentForm({
                name: "",
                type: DEFAULT_INSTRUMENT_TYPE,
                photoUrl: "",
                description: "",
                outsideFeePerDay: "0",
                bookingMode: "manual",
              });
              admin.setShowInstrumentModal(true);
            }}
            onEditInstrument={(inst) => {
              admin.setEditingInstrument(inst);
              admin.setInstrumentForm({
                name: inst.name,
                type: inst.type,
                photoUrl: inst.photoUrl || inst.photo_url || "",
                description: inst.description || "",
                outsideFeePerDay: String(
                  inst.outsideFeePerDay ?? inst.outside_fee_per_day ?? "0",
                ),
                bookingMode:
                  (inst.bookingMode ?? inst.booking_mode) || "manual",
              });
              admin.setShowInstrumentModal(true);
            }}
            onRetireInstrument={(inst) => admin.setRemovingInstrument(inst)}
            onDeleteInstrument={(inst) => {
              admin.setDeletingInstrument(inst);
              admin.setDeleteConfirmChecked(false);
            }}
            onRestoreInstrument={admin.handleRestoreInstrument}
          />
        )}

        {admin.activeTab === "users" && (
          <UsersTab
            usersList={admin.usersList}
            loadingUsers={admin.loadingUsers}
            userSearch={admin.userSearch}
            setUserSearch={admin.setUserSearch}
            fetchUsers={admin.fetchUsers}
            openUserProfile={admin.openUserProfile}
            handleApproveRegistration={admin.handleApproveRegistration}
            triggerRejectUser={admin.triggerRejectUser}
            setBookOnBehalfUser={admin.setBookOnBehalfUser}
          />
        )}

        {admin.activeTab === "messaging" && (
          <MessagingTab
            reservations={admin.reservations}
            messagingReservations={admin.messagingReservations}
            loadingMessagingReservations={admin.loadingMessagingReservations}
            msgReservationSearch={admin.msgReservationSearch}
            setMsgReservationSearch={admin.setMsgReservationSearch}
            fetchMessagingReservations={admin.fetchMessagingReservations}
            selectedMsgReservation={admin.selectedMsgReservation}
            setSelectedMsgReservation={admin.setSelectedMsgReservation}
            messageText={admin.messageText}
            setMessageText={admin.setMessageText}
            handleSendMessage={admin.handleSendMessage}
            sendingMessage={admin.sendingMessage}
          />
        )}

        {admin.activeTab === "analytics" && <AnalyticsTab />}

        {admin.activeTab === "admin_accounts" && admin.isSuperAdmin && (
          <AdminAccountsTab
            adminAccountsList={admin.adminAccountsList}
            loadingAdmins={admin.loadingAdmins}
            currentProfile={admin.profile}
            onOpenUserProfile={admin.openUserProfile}
            onOpenCreateAdminModal={() => {
              admin.setNewAdminForm({
                name: "",
                email: "",
                phoneNumber: "",
                password: "",
                isSuperAdmin: false,
              });
              admin.setShowNewAdminModal(true);
            }}
            onDemoteAdmin={admin.handleDemoteAdmin}
            onRemoveAdmin={admin.handleRemoveAdmin}
          />
        )}

        {admin.activeTab === "trusted_status" && admin.isSuperAdmin && (
          <TrustedStatusTab
            trustedAuditLogs={admin.trustedAuditLogs}
            loadingAuditLogs={admin.loadingAuditLogs}
          />
        )}

        {admin.activeTab === "hard_limits" && admin.isSuperAdmin && (
          <HardLimitsTab
            hardLimitsState={admin.hardLimitsState}
            setHardLimitsState={admin.setHardLimitsState}
            loadingLimits={admin.loadingLimits}
            savingLimits={admin.savingLimits}
            onSave={admin.handleSaveHardLimits}
          />
        )}

        {admin.activeTab === "payment_settings" && admin.isSuperAdmin && (
          <PaymentSettingsTab
            paymentSettingsState={admin.paymentSettingsState}
            setPaymentSettingsState={admin.setPaymentSettingsState}
            savingPayment={admin.savingPayment}
            onSave={admin.handleSavePaymentSettings}
          />
        )}

        {(admin.activeTab === "notification_settings" ||
          admin.activeTab === "push_notifications") && (
          <NotificationSettingsTab
            isSuperAdmin={Boolean(admin.isSuperAdmin)}
            adminDeviceSubscribed={admin.adminDeviceSubscribed}
            savingPushPrefs={admin.savingPushPrefs}
            loadingPushPrefs={admin.loadingPushPrefs}
            testPushSending={admin.testPushSending}
            testPushStatus={admin.testPushStatus}
            adminPushPrefs={admin.adminPushPrefs}
            notificationSettingsState={admin.notificationSettingsState}
            savingNotificationSettings={admin.savingNotificationSettings}
            onSubscribeDevice={admin.handleAdminSubscribeDevice}
            onTestPush={admin.handleAdminTestPush}
            onTogglePushPref={admin.handleTogglePushPref}
            onToggleEmailSetting={admin.handleToggleEmailNotificationSetting}
          />
        )}
      </main>

      {/* STICKY BOTTOM BAR — Bulk selection (mobile-first) */}
      <BulkSelectionBottomBar
        isOpen={admin.activeTab === "review" && admin.isSelectionMode}
        reservations={admin.reservations}
        selectedReservationIds={admin.selectedReservationIds}
        isSuperAdmin={Boolean(admin.isSuperAdmin)}
        onToggleSelectAll={admin.handleToggleSelectAllReservations}
        onExitSelection={admin.exitSelectionMode}
        onBulkCancel={admin.handleTriggerBulkCancel}
        onBulkDelete={admin.handleTriggerBulkDelete}
      />

      {/* Admin Modals Host */}
      <AdminModalsHost
        admin={admin}
        onOpenReservationDetail={props.onOpenReservationDetail}
      />
    </div>
  );
};
