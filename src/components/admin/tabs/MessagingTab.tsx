import React from "react";
import { useTranslation } from "react-i18next";
import { Search, X, Send } from "lucide-react";
import { LoadingSpinner } from "../../shared/LoadingSpinner";
import { EmptyStateCard } from "../../shared/EmptyStateCard";

export interface MessagingTabProps {
  reservations: any[];
  messagingReservations: any[];
  loadingMessagingReservations: boolean;
  msgReservationSearch: string;
  setMsgReservationSearch: (val: string) => void;
  fetchMessagingReservations: (term: string) => void;
  selectedMsgReservation: any;
  setSelectedMsgReservation: (r: any) => void;
  messageText: string;
  setMessageText: (text: string) => void;
  handleSendMessage: (e: React.FormEvent) => void;
  sendingMessage: boolean;
}

export const MessagingTab: React.FC<MessagingTabProps> = ({
  reservations,
  messagingReservations,
  loadingMessagingReservations,
  msgReservationSearch,
  setMsgReservationSearch,
  fetchMessagingReservations,
  selectedMsgReservation,
  setSelectedMsgReservation,
  messageText,
  setMessageText,
  handleSendMessage,
  sendingMessage,
}) => {
  const { t } = useTranslation();

  return (
    <div className="bg-white border border-stone-200 rounded-2xl p-5 shadow-2xs space-y-4">
      <div className="border-b border-stone-100 pb-3">
        <h2 className="font-bold text-stone-900 text-sm">
          {t("admin.messaging.title")}
        </h2>
        <p className="text-xs text-stone-500">
          {t("admin.messaging.subtitle")}
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="border border-stone-200 rounded-xl p-3 bg-stone-50/50 space-y-2 flex flex-col max-h-[500px]">
          <div className="flex items-center justify-between gap-1">
            <div className="text-[11px] font-bold uppercase text-stone-500">
              {t("admin.messaging.selectReservation")}
            </div>
            <div className="flex items-center gap-1.5">
              {loadingMessagingReservations && (
                <LoadingSpinner size="xs" color="amber" />
              )}
              <span className="text-[10px] font-semibold text-stone-400">
                {(() => {
                  const source =
                    messagingReservations.length > 0
                      ? messagingReservations
                      : reservations;
                  const term = msgReservationSearch.toLowerCase().trim();
                  const list = term
                    ? source.filter(
                        (r) =>
                          r.service_name?.toLowerCase().includes(term) ||
                          r.user_name?.toLowerCase().includes(term) ||
                          r.instrument_name
                            ?.toLowerCase()
                            .includes(term) ||
                          r.user_phone?.includes(term),
                      )
                    : source;
                  return `${list.length} bookings`;
                })()}
              </span>
            </div>
          </div>

          {/* Search bar for reservations in messaging tab */}
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-stone-400 absolute left-2.5 top-2.5 rtl:left-auto rtl:right-2.5" />
            <input
              type="text"
              value={msgReservationSearch}
              onChange={(e) => {
                const val = e.target.value;
                setMsgReservationSearch(val);
                if (val.trim().length >= 2 || val.trim().length === 0) {
                  fetchMessagingReservations(val);
                }
              }}
              placeholder={
                t("admin.approvals.searchPlaceholder") ||
                "Search by member, service, instrument..."
              }
              className="w-full pl-8 pr-7 rtl:pl-7 rtl:pr-8 py-1.5 bg-white border border-stone-200 rounded-xl text-xs text-stone-900 placeholder:text-stone-400 focus:outline-none focus:border-amber-700"
            />
            {msgReservationSearch && (
              <button
                type="button"
                onClick={() => {
                  setMsgReservationSearch("");
                  fetchMessagingReservations("");
                }}
                className="absolute right-2 top-2 rtl:right-auto rtl:left-2 text-stone-400 hover:text-stone-600 p-0.5 cursor-pointer"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>

          <div className="flex-1 overflow-y-auto space-y-2 pr-0.5">
            {(() => {
              const source =
                messagingReservations.length > 0
                  ? messagingReservations
                  : reservations;
              const term = msgReservationSearch.toLowerCase().trim();
              const filtered = term
                ? source.filter(
                    (r) =>
                      r.service_name?.toLowerCase().includes(term) ||
                      r.user_name?.toLowerCase().includes(term) ||
                      r.instrument_name?.toLowerCase().includes(term) ||
                      r.user_phone?.includes(term),
                  )
                : source;

              if (filtered.length === 0) {
                return (
                  <div className="py-8 text-center text-xs text-stone-400">
                    {term
                      ? "No matching bookings found"
                      : "No reservations available"}
                  </div>
                );
              }

              return filtered.map((r) => (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => setSelectedMsgReservation(r)}
                  className={`w-full text-left rtl:text-right p-2.5 rounded-xl border text-xs transition cursor-pointer ${
                    selectedMsgReservation?.id === r.id
                      ? "bg-amber-50 border-amber-300 text-amber-950 shadow-2xs font-semibold"
                      : "bg-white border-stone-200 text-stone-700 hover:bg-stone-50"
                  }`}
                >
                  <div className="font-bold text-stone-900 truncate">
                    {r.service_name}
                  </div>
                  <div className="text-[11px] text-stone-500 truncate mt-0.5">
                    {r.user_name} • {r.instrument_name}
                  </div>
                </button>
              ));
            })()}
          </div>
        </div>

        <div className="md:col-span-2 border border-stone-200 rounded-xl p-4 bg-white space-y-3">
          {selectedMsgReservation ? (
            <form onSubmit={handleSendMessage} className="space-y-3">
              <div className="p-3 bg-stone-50 rounded-xl border border-stone-200 text-xs space-y-1">
                <div className="font-bold text-stone-900">
                  {t("admin.messaging.recipientLabel", {
                    name: selectedMsgReservation.user_name,
                    phone: selectedMsgReservation.user_phone,
                  })}
                </div>
                <div className="text-stone-500">
                  {t("admin.messaging.bookingLabel", {
                    service: selectedMsgReservation.service_name,
                    instrument: selectedMsgReservation.instrument_name,
                  })}
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase text-stone-500 mb-1">
                  {t("admin.messaging.messageContentLabel")}
                </label>
                <textarea
                  rows={4}
                  required
                  value={messageText}
                  onChange={(e) => setMessageText(e.target.value)}
                  placeholder={t("admin.messaging.messagePlaceholder")}
                  className="w-full p-3 bg-stone-50 border border-stone-200 rounded-xl text-xs text-stone-900 focus:outline-none focus:border-amber-700"
                />
              </div>

              <button
                type="submit"
                disabled={sendingMessage || !messageText.trim()}
                className="px-4 py-2 rounded-xl bg-amber-800 hover:bg-amber-900 disabled:opacity-50 text-white font-bold text-xs transition flex items-center gap-1.5 cursor-pointer shadow-xs"
              >
                <Send className="w-3.5 h-3.5" />
                <span>{t("admin.messaging.sendButton")}</span>
              </button>
            </form>
          ) : (
            <EmptyStateCard
              description={t("admin.messaging.emptyState")}
            />
          )}
        </div>
      </div>
    </div>
  );
};
