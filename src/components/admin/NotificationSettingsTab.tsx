import React from "react";
import { useTranslation } from "react-i18next";
import {
  Smartphone,
  RefreshCw,
  Check,
  Bell,
  Send,
  CheckCircle2,
  Mail,
} from "lucide-react";

export interface AdminPushPreferences {
  notifyNewRequests: boolean;
  notifyNewRegistrations: boolean;
  notifyMemberMessages: boolean;
}

export interface NotificationSettingsState {
  muteAccountApprovalEmails: boolean;
  muteReservationRequestEmails: boolean;
}

interface NotificationSettingsTabProps {
  isSuperAdmin: boolean;
  adminDeviceSubscribed: boolean;
  savingPushPrefs: boolean;
  loadingPushPrefs: boolean;
  testPushSending: boolean;
  testPushStatus: string | null;
  adminPushPrefs: AdminPushPreferences;
  notificationSettingsState: NotificationSettingsState;
  savingNotificationSettings: boolean;
  onSubscribeDevice: () => void;
  onTestPush: () => void;
  onTogglePushPref: (
    key: "notifyNewRequests" | "notifyNewRegistrations" | "notifyMemberMessages",
  ) => void;
  onToggleEmailSetting: (
    key: "muteAccountApprovalEmails" | "muteReservationRequestEmails",
  ) => void;
}

export const NotificationSettingsTab: React.FC<NotificationSettingsTabProps> = ({
  isSuperAdmin,
  adminDeviceSubscribed,
  savingPushPrefs,
  loadingPushPrefs,
  testPushSending,
  testPushStatus,
  adminPushPrefs,
  notificationSettingsState,
  savingNotificationSettings,
  onSubscribeDevice,
  onTestPush,
  onTogglePushPref,
  onToggleEmailSetting,
}) => {
  const { t } = useTranslation();

  return (
    <div
      className={`grid grid-cols-1 ${
        isSuperAdmin ? "lg:grid-cols-2" : "max-w-2xl"
      } gap-3 sm:gap-4`}
    >
      {/* Push Notifications Card */}
      <div className="bg-white border border-stone-200 rounded-2xl shadow-2xs overflow-hidden flex flex-col">
        {/* Card Header */}
        <div className="px-4 py-3 border-b border-stone-100 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-7 h-7 rounded-lg bg-amber-800 text-white flex items-center justify-center shrink-0">
              <Smartphone className="w-3.5 h-3.5" />
            </div>
            <span className="font-bold text-stone-900 text-sm truncate">
              {t("adminPush.title")}
            </span>
          </div>

          {savingPushPrefs || loadingPushPrefs ? (
            <span className="text-[11px] text-amber-700 flex items-center gap-1 font-medium shrink-0">
              <RefreshCw className="w-3 h-3 animate-spin" />
            </span>
          ) : (
            <span className="text-[11px] text-stone-400 inline-flex items-center gap-1 shrink-0">
              <Check className="w-3 h-3 text-emerald-600" />
              <span className="hidden sm:inline">
                {t("adminPush.autoSaved")}
              </span>
            </span>
          )}
        </div>

        {/* Device Status + Test Button */}
        <div className="p-3 sm:p-4 space-y-3">
          <div className="rounded-xl border border-amber-200/80 bg-amber-50/70 p-3 space-y-2.5">
            <div className="flex items-center gap-2.5">
              <span
                className={`w-2.5 h-2.5 rounded-full shrink-0 ${
                  adminDeviceSubscribed
                    ? "bg-emerald-500 ring-2 ring-emerald-200"
                    : "bg-amber-400"
                }`}
              />
              <span className="text-xs text-amber-950 font-semibold truncate">
                {adminDeviceSubscribed
                  ? t("adminPush.deviceActive")
                  : t("adminPush.deviceInactive")}
              </span>
            </div>

            {!adminDeviceSubscribed ? (
              <button
                type="button"
                onClick={onSubscribeDevice}
                disabled={savingPushPrefs}
                className="w-full sm:w-auto sm:min-w-[180px] h-9 px-4 rounded-xl bg-amber-800 hover:bg-amber-900 active:scale-[0.99] text-white text-xs font-bold transition shadow-2xs cursor-pointer disabled:opacity-50 flex items-center justify-center gap-1.5"
              >
                <Bell className="w-3.5 h-3.5" />
                <span>{t("adminPush.enableDeviceBtn")}</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={onTestPush}
                disabled={testPushSending}
                className="w-full sm:w-auto sm:min-w-[180px] h-9 px-4 rounded-xl bg-amber-800 hover:bg-amber-900 active:scale-[0.99] text-white text-xs font-bold transition shadow-2xs cursor-pointer flex items-center justify-center gap-1.5 disabled:opacity-50"
              >
                {testPushSending ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>{t("adminPush.sending")}</span>
                  </>
                ) : (
                  <>
                    <Send className="w-3.5 h-3.5" />
                    <span>{t("adminPush.sendTestBtn")}</span>
                  </>
                )}
              </button>
            )}

            <div className="text-[11px] text-amber-900/80 flex items-start gap-1.5 leading-snug">
              <Bell className="w-3 h-3 text-amber-700 shrink-0 mt-0.5" />
              <span>{t("adminPush.reassurance")}</span>
            </div>

            {testPushStatus && (
              <div className="p-2 rounded-lg bg-emerald-100 border border-emerald-300 text-emerald-950 text-xs flex items-start gap-1.5 animate-in fade-in leading-snug">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-700 shrink-0 mt-0.5" />
                <span>{testPushStatus}</span>
              </div>
            )}
          </div>
        </div>

        {/* Preference Switches */}
        <div className="border-t border-stone-100 divide-y divide-stone-100 mt-auto">
          {/* New Requests */}
          <div className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-stone-50/70 transition">
            <div className="min-w-0 flex-1">
              <div className="font-semibold text-stone-900 text-xs leading-snug">
                {t("adminPush.reqTitle")}
              </div>
              <div className="text-[11px] text-stone-500 leading-snug mt-0.5">
                {t("adminPush.reqDesc")}
              </div>
            </div>
            <button
              type="button"
              aria-label="Toggle new requests notifications"
              disabled={savingPushPrefs}
              onClick={() => onTogglePushPref("notifyNewRequests")}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors shrink-0 cursor-pointer disabled:opacity-50 ${
                adminPushPrefs.notifyNewRequests
                  ? "bg-amber-700"
                  : "bg-stone-300"
              }`}
            >
              <span
                className={`inline-block h-5 w-5 transform rounded-full bg-white shadow-sm transition-transform ${
                  adminPushPrefs.notifyNewRequests
                    ? "translate-x-5 rtl:-translate-x-5"
                    : "translate-x-0.5 rtl:-translate-x-0.5"
                }`}
              />
            </button>
          </div>

          {/* New Registrations */}
          <div className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-stone-50/70 transition">
            <div className="min-w-0 flex-1">
              <div className="font-semibold text-stone-900 text-xs leading-snug">
                {t("adminPush.regTitle")}
              </div>
              <div className="text-[11px] text-stone-500 leading-snug mt-0.5">
                {t("adminPush.regDesc")}
              </div>
            </div>
            <button
              type="button"
              aria-label="Toggle new registrations notifications"
              disabled={savingPushPrefs}
              onClick={() => onTogglePushPref("notifyNewRegistrations")}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors shrink-0 cursor-pointer disabled:opacity-50 ${
                adminPushPrefs.notifyNewRegistrations
                  ? "bg-amber-700"
                  : "bg-stone-300"
              }`}
            >
              <span
                className={`inline-block h-5 w-5 transform rounded-full bg-white shadow-sm transition-transform ${
                  adminPushPrefs.notifyNewRegistrations
                    ? "translate-x-5 rtl:-translate-x-5"
                    : "translate-x-0.5 rtl:-translate-x-0.5"
                }`}
              />
            </button>
          </div>

          {/* Member Messages */}
          <div className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-stone-50/70 transition">
            <div className="min-w-0 flex-1">
              <div className="font-semibold text-stone-900 text-xs leading-snug">
                {t("adminPush.chatTitle")}
              </div>
              <div className="text-[11px] text-stone-500 leading-snug mt-0.5">
                {t("adminPush.chatDesc")}
              </div>
            </div>
            <button
              type="button"
              aria-label="Toggle member messages notifications"
              disabled={savingPushPrefs}
              onClick={() => onTogglePushPref("notifyMemberMessages")}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors shrink-0 cursor-pointer disabled:opacity-50 ${
                adminPushPrefs.notifyMemberMessages
                  ? "bg-amber-700"
                  : "bg-stone-300"
              }`}
            >
              <span
                className={`inline-block h-5 w-5 transform rounded-full bg-white shadow-sm transition-transform ${
                  adminPushPrefs.notifyMemberMessages
                    ? "translate-x-5 rtl:-translate-x-5"
                    : "translate-x-0.5 rtl:-translate-x-0.5"
                }`}
              />
            </button>
          </div>
        </div>
      </div>

      {/* Email Notifications Card (Super Admin only) */}
      {isSuperAdmin && (
        <div className="bg-white border border-stone-200 rounded-2xl shadow-2xs overflow-hidden flex flex-col">
          <div className="px-4 py-3 border-b border-stone-100 flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-amber-800 text-white flex items-center justify-center shrink-0">
              <Mail className="w-3.5 h-3.5" />
            </div>
            <span className="font-bold text-stone-900 text-sm truncate">
              {t("admin.notificationSettings.title")}
            </span>
            {savingNotificationSettings && (
              <RefreshCw className="w-3 h-3 text-amber-700 animate-spin ms-auto shrink-0" />
            )}
          </div>

          <div className="divide-y divide-stone-100">
            {/* Approval Emails */}
            <div className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-stone-50/70 transition">
              <div className="min-w-0 flex-1">
                <div className="font-semibold text-stone-900 text-xs leading-snug">
                  {t("admin.notificationSettings.approvalEmailsTitle")}
                </div>
                <div className="text-[11px] text-stone-500 leading-snug mt-0.5">
                  {t("admin.notificationSettings.approvalEmailsDesc")}
                </div>
              </div>
              <button
                type="button"
                aria-label="Toggle account approval emails"
                disabled={savingNotificationSettings}
                onClick={() =>
                  onToggleEmailSetting("muteAccountApprovalEmails")
                }
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors shrink-0 cursor-pointer disabled:opacity-50 ${
                  notificationSettingsState.muteAccountApprovalEmails
                    ? "bg-stone-300"
                    : "bg-amber-700"
                }`}
              >
                <span
                  className={`inline-block h-5 w-5 transform rounded-full bg-white shadow-sm transition-transform ${
                    notificationSettingsState.muteAccountApprovalEmails
                      ? "translate-x-0.5 rtl:-translate-x-0.5"
                      : "translate-x-5 rtl:-translate-x-5"
                  }`}
                />
              </button>
            </div>

            {/* Request Emails */}
            <div className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-stone-50/70 transition">
              <div className="min-w-0 flex-1">
                <div className="font-semibold text-stone-900 text-xs leading-snug">
                  {t("admin.notificationSettings.requestEmailsTitle")}
                </div>
                <div className="text-[11px] text-stone-500 leading-snug mt-0.5">
                  {t("admin.notificationSettings.requestEmailsDesc")}
                </div>
              </div>
              <button
                type="button"
                aria-label="Toggle reservation request emails"
                disabled={savingNotificationSettings}
                onClick={() =>
                  onToggleEmailSetting("muteReservationRequestEmails")
                }
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors shrink-0 cursor-pointer disabled:opacity-50 ${
                  notificationSettingsState.muteReservationRequestEmails
                    ? "bg-stone-300"
                    : "bg-amber-700"
                }`}
              >
                <span
                  className={`inline-block h-5 w-5 transform rounded-full bg-white shadow-sm transition-transform ${
                    notificationSettingsState.muteReservationRequestEmails
                      ? "translate-x-0.5 rtl:-translate-x-0.5"
                      : "translate-x-5 rtl:-translate-x-5"
                  }`}
                />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
