import React, { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { AuthProvider, useAuth } from "./contexts/AuthContext.tsx";
import { LanguageProfileDropdown } from "./components/LanguageProfileDropdown.tsx";
import { AuthScreen } from "./components/AuthScreen.tsx";
import {
  AvailabilityCalendar,
  Instrument,
} from "./components/AvailabilityCalendar.tsx";
import { ReservationFormModal } from "./components/ReservationFormModal.tsx";
import { SeriesBuilderModal } from "./components/SeriesBuilderModal.tsx";
import { InstrumentDetailModal } from "./components/InstrumentDetailModal.tsx";
import { MyReservations } from "./components/MyReservations.tsx";
import { ReservationDetailModal } from "./components/ReservationDetailModal.tsx";
import { EditReservationModal } from "./components/EditReservationModal.tsx";
import { NotificationsModal } from "./components/NotificationsModal.tsx";
import { AdminPortal } from "./components/AdminPortal.tsx";
import { getTodayDateString } from "./lib/date-utils";
import { PolicyExplainerModal } from "./components/PolicyExplainerModal.tsx";
import {
  LogOut,
  Sparkles,
  Phone,
  Church,
  Calendar,
  CheckCircle2,
  Bell,
  HelpCircle,
  Clock,
  Music2,
  DollarSign,
  User,
  Shield,
  X,
  Plus,
  BookmarkCheck,
  CalendarDays,
} from "lucide-react";

interface SelectedSlotInfo {
  instrument: Instrument;
  date: string;
  timeHhmm: string;
  duration: number;
}

interface SeriesPrefillInfo {
  instrument: Instrument;
  serviceName: string;
  date: string;
  startTime: string;
  duration: number;
  reservationType: "in_church" | "outside_church";
}

const UserPortalMain: React.FC = () => {
  const { profile, logout, sessionToken } = useAuth();
  const { t } = useTranslation();
  const isAdminOrSuperAdmin =
    profile?.role === "admin" ||
    profile?.role === "super_admin" ||
    profile?.isSuperAdmin;
  const [policyExplainerEnabled, setPolicyExplainerEnabled] = useState(true);
  const [isPolicyModalOpen, setIsPolicyModalOpen] = useState(false);
  // Navigation View: 'calendar' (Screen 2) | 'my_reservations' (Screen 5) | 'admin_portal'
  const [currentView, setCurrentView] = useState<
    "calendar" | "my_reservations" | "admin_portal"
  >("calendar");

  // Modals & Active Selections
  const [selectedSlot, setSelectedSlot] = useState<SelectedSlotInfo | null>(
    null,
  );
  const [seriesPrefill, setSeriesPrefill] = useState<SeriesPrefillInfo | null>(
    null,
  );
  const [selectedInstrument, setSelectedInstrument] =
    useState<Instrument | null>(null);

  // Screen 6 (Reservation Detail Modal) and Edit Modal
  const [selectedReservationDetailId, setSelectedReservationDetailId] =
    useState<string | null>(null);
  const [reservationDetailInitialTab, setReservationDetailInitialTab] =
    useState<"details" | "chat">("details");
  const [
    reservationDetailFromNotifications,
    setReservationDetailFromNotifications,
  ] = useState<boolean>(false);
  const [editingReservation, setEditingReservation] = useState<any | null>(
    null,
  );

  // Screen 7: Notifications
  const [isNotificationsOpen, setIsNotificationsOpen] =
    useState<boolean>(false);
  const [unreadCount, setUnreadCount] = useState<number>(0);

  const [allInstruments, setAllInstruments] = useState<Instrument[]>([]);
  const [refreshTrigger, setRefreshTrigger] = useState<number>(0);

  // Initial fetch for notifications count
  useEffect(() => {
    const checkUnread = async () => {
      try {
        const res = await fetch("/api/notifications", {
          headers: {
            Authorization: `Bearer ${sessionToken || ""}`,
          },
        });
        const data = await res.json();
        if (data.success) {
          setUnreadCount(data.unreadCount || 0);
        }
      } catch {
        // silent fail
      }
    };
    checkUnread();
  }, [sessionToken, refreshTrigger]);

  useEffect(() => {
    const fetchPolicyFlag = async () => {
      try {
        const res = await fetch("/api/reservations/limits");
        const data = await res.json();
        if (data.success && data.limits) {
          setPolicyExplainerEnabled(
            data.limits.showPolicyExplainerToUsers ??
              data.limits.show_policy_explainer_to_users ??
              true,
          );
        }
      } catch {
        // default stays true; non-fatal
      }
    };
    fetchPolicyFlag();
  }, []);

  // Callback from Screen 2 when tapping a free slot
  const handleSelectSlot = (
    instrument: Instrument,
    date: string,
    timeHhmm: string,
    durationHours: number,
  ) => {
    setSelectedSlot({
      instrument,
      date,
      timeHhmm,
      duration: durationHours,
    });
  };

  // Callback from Screen 2 when tapping a column header
  const handleSelectInstrument = (instrument: Instrument) => {
    setSelectedInstrument(instrument);
  };

  const handleReservationSuccess = () => {
    setRefreshTrigger((prev) => prev + 1);
  };

  return (
    <div
      id="user-portal-root"
      className="min-h-screen bg-stone-100 text-stone-900 font-sans flex flex-col"
    >
      {/* Top Application Header */}
      <header className="bg-white border-b border-stone-200 sticky top-0 z-30 shadow-2xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-2 lg:gap-1.5">
          <div className="flex items-center gap-3 min-w-0 shrink-0">
            <img
              src="/logo.png"
              alt="Church logo"
              className="w-10 h-10 rounded-2xl object-cover shadow-sm border border-amber-900/30 shrink-0"
            />
            <div className="min-w-0">
              <div className="font-bold text-stone-900 text-xs lg:text-xs xl:text-base leading-tight whitespace-nowrap">
                {t("common.appName")}
              </div>
              <div className="text-[10px] lg:text-[9px] xl:text-[11px] text-stone-500 font-medium whitespace-nowrap hidden lg:block">
                {t("common.appSubtitle")}
              </div>
            </div>
          </div>

          {/* Navigation View Switcher (Screen 2 vs Screen 5 vs Admin) */}
          <div className="hidden lg:flex items-center bg-stone-100 p-1 rounded-2xl border border-stone-200 shrink-0">
            <button
              id="nav-btn-calendar"
              type="button"
              onClick={() => setCurrentView("calendar")}
              className={`px-2.5 lg:px-2 xl:px-3.5 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1 lg:gap-1 xl:gap-1.5 cursor-pointer whitespace-nowrap ${
                currentView === "calendar"
                  ? "bg-white text-stone-900 shadow-2xs"
                  : "text-stone-600 hover:text-stone-900"
              }`}
            >
              <CalendarDays className="w-3.5 h-3.5 text-amber-800" />
              <span>{t("nav.availabilityCalendar")}</span>
            </button>

            <button
              id="nav-btn-my-reservations"
              type="button"
              onClick={() => setCurrentView("my_reservations")}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                currentView === "my_reservations"
                  ? "bg-white text-amber-950 shadow-2xs"
                  : "text-stone-600 hover:text-stone-900"
              }`}
            >
              <BookmarkCheck className="w-3.5 h-3.5 text-amber-800" />
              <span>{t("nav.myReservations")}</span>
            </button>

            {isAdminOrSuperAdmin && (
              <button
                id="nav-btn-admin-portal"
                type="button"
                onClick={() => setCurrentView("admin_portal")}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                  currentView === "admin_portal"
                    ? "bg-white text-amber-950 shadow-2xs"
                    : "text-stone-600 hover:text-amber-950 hover:bg-white/60"
                }`}
              >
                <Shield className="w-3.5 h-3.5 text-amber-800" />
                <span>{t("nav.adminPortal")}</span>
              </button>
            )}
          </div>

          {/* User Profile & Actions */}
          <div className="flex items-center gap-2 sm:gap-3">
            {policyExplainerEnabled && (
              <button
                id="header-policy-help-btn"
                type="button"
                onClick={() => setIsPolicyModalOpen(true)}
                className="p-2 sm:px-3 sm:py-1.5 rounded-xl border border-stone-200 text-stone-700 text-xs font-bold hover:bg-stone-50 transition flex items-center gap-2 cursor-pointer"
                title={t("nav.howBookingWorks")}
              >
                <HelpCircle className="w-4 h-4 text-stone-600" />
                <span className="hidden xl:inline">
                  {t("nav.howBookingWorks")}
                </span>
              </button>
            )}
            {/* Screen 7: Notifications Bell Button */}
            <button
              id="header-notifications-bell-btn"
              type="button"
              onClick={() => setIsNotificationsOpen(true)}
              className={`relative p-2 sm:px-3 sm:py-1.5 rounded-xl border text-xs font-bold transition flex items-center gap-2 cursor-pointer ${
                unreadCount > 0
                  ? "bg-amber-50 border-amber-300 text-amber-900 shadow-2xs hover:bg-amber-100"
                  : "border-stone-200 text-stone-700 hover:bg-stone-50"
              }`}
              title={t("nav.alerts")}
            >
              <div className="relative">
                <Bell
                  className={`w-4 h-4 ${unreadCount > 0 ? "text-amber-800" : "text-stone-600"}`}
                />
                {unreadCount > 0 && (
                  <span className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-amber-600 text-white font-bold text-[9px] rounded-full flex items-center justify-center ring-2 ring-white animate-pulse">
                    {unreadCount > 9 ? "9+" : unreadCount}
                  </span>
                )}
              </div>
              <span className="hidden xl:inline">
                {unreadCount > 0
                  ? `${unreadCount} ${t("nav.alerts")}`
                  : t("nav.alerts")}
              </span>
            </button>

            {/* Profile Dropdown with Arabic / English Language Toggle */}
            <LanguageProfileDropdown />
          </div>
        </div>

        {/* Mobile/Tablet View Switcher Tabs */}
        <div
          className={`lg:hidden grid ${isAdminOrSuperAdmin ? "grid-cols-3" : "grid-cols-2"} border-t border-stone-200 bg-stone-50`}
        >
          <button
            type="button"
            onClick={() => setCurrentView("calendar")}
            className={`py-2 text-xs font-bold text-center border-b-2 flex items-center justify-center gap-1.5 ${
              currentView === "calendar"
                ? "border-amber-800 text-amber-900 bg-white"
                : "border-transparent text-stone-600"
            }`}
          >
            <CalendarDays className="w-3.5 h-3.5" />
            <span>{t("nav.calendarShort")}</span>
          </button>
          <button
            type="button"
            onClick={() => setCurrentView("my_reservations")}
            className={`py-2 text-xs font-bold text-center border-b-2 flex items-center justify-center gap-1.5 ${
              currentView === "my_reservations"
                ? "border-amber-800 text-amber-900 bg-white"
                : "border-transparent text-stone-600"
            }`}
          >
            <BookmarkCheck className="w-3.5 h-3.5" />
            <span>{t("nav.bookingsShort")}</span>
          </button>
          {isAdminOrSuperAdmin && (
            <button
              type="button"
              onClick={() => setCurrentView("admin_portal")}
              className={`py-2 text-xs font-bold text-center border-b-2 flex items-center justify-center gap-1.5 ${
                currentView === "admin_portal"
                  ? "border-amber-800 text-amber-900 bg-white"
                  : "border-transparent text-stone-600"
              }`}
            >
              <Shield className="w-3.5 h-3.5" />
              <span>{t("nav.adminShort")}</span>
            </button>
          )}
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-6 sm:py-8">
        {currentView === "calendar" && (
          <AvailabilityCalendar
            onSelectSlot={handleSelectSlot}
            onSelectInstrument={handleSelectInstrument}
            refreshTrigger={refreshTrigger}
            onLoadedInstruments={(insts) => setAllInstruments(insts)}
          />
        )}
        {currentView === "my_reservations" && (
          <MyReservations
            allInstruments={allInstruments}
            refreshTrigger={refreshTrigger}
            onOpenNewReservation={() => {
              setSelectedSlot({
                instrument: allInstruments[0],
                date: getTodayDateString(),
                timeHhmm: "10:00",
                duration: 2,
              });
            }}
            onOpenSeriesBuilder={() => {
              setSeriesPrefill({
                instrument: allInstruments[0],
                serviceName: "",
                date: getTodayDateString(),
                startTime: "10:00",
                duration: 2,
                reservationType: "in_church",
              });
            }}
            onSelectReservationDetail={(id) => {
              setSelectedReservationDetailId(id);
              setReservationDetailFromNotifications(false);
            }}
            onEditReservation={(res) => {
              setEditingReservation(res);
              setReservationDetailFromNotifications(false);
            }}
          />
        )}
        {currentView === "admin_portal" && isAdminOrSuperAdmin && (
          <AdminPortal
            onBackToMemberView={() => setCurrentView("calendar")}
            onOpenReservationDetail={(id) => {
              setSelectedReservationDetailId(id);
              setReservationDetailFromNotifications(false);
            }}
            onInstrumentsChanged={() => {
              setRefreshTrigger((prev) => prev + 1);
            }}
          />
        )}
      </main>

      {/* Screen 3: Reservation Form Modal */}
      {selectedSlot && (
        <ReservationFormModal
          initialInstrument={selectedSlot.instrument}
          allInstruments={
            allInstruments.length > 0
              ? allInstruments
              : [selectedSlot.instrument]
          }
          initialDate={selectedSlot.date}
          initialTimeHhmm={selectedSlot.timeHhmm}
          initialDuration={selectedSlot.duration}
          onClose={() => setSelectedSlot(null)}
          onSuccess={handleReservationSuccess}
          onOpenSeriesBuilder={(prefill) => {
            setSelectedSlot(null);
            setSeriesPrefill(prefill);
          }}
        />
      )}

      {/* Screen 3b: Recurring Series Builder Modal */}
      {seriesPrefill && (
        <SeriesBuilderModal
          initialInstrument={seriesPrefill.instrument}
          allInstruments={
            allInstruments.length > 0
              ? allInstruments
              : [seriesPrefill.instrument]
          }
          initialServiceName={seriesPrefill.serviceName}
          initialDate={seriesPrefill.date}
          initialTimeHhmm={seriesPrefill.startTime}
          initialDuration={seriesPrefill.duration}
          initialReservationType={seriesPrefill.reservationType}
          onClose={() => setSeriesPrefill(null)}
          onSuccess={handleReservationSuccess}
        />
      )}

      {/* Screen 4: Instrument Detail Modal */}
      {selectedInstrument && (
        <InstrumentDetailModal
          instrument={selectedInstrument}
          allInstruments={allInstruments}
          onClose={() => setSelectedInstrument(null)}
          onSelectSlot={(inst, date, timeHhmm, durationHours) => {
            setSelectedInstrument(null);
            setSelectedSlot({
              instrument: inst,
              date,
              timeHhmm,
              duration: durationHours,
            });
          }}
          onInstrumentUpdated={(updatedInst) => {
            setSelectedInstrument(updatedInst);
            setAllInstruments((prev) =>
              prev.map((i) => (i.id === updatedInst.id ? updatedInst : i)),
            );
            setRefreshTrigger((prev) => prev + 1);
          }}
        />
      )}

      {/* Screen 6: Reservation Detail Modal */}
      {selectedReservationDetailId && (
        <ReservationDetailModal
          reservationId={selectedReservationDetailId}
          allInstruments={allInstruments}
          initialTab={reservationDetailInitialTab}
          onClose={() => {
            setSelectedReservationDetailId(null);
            setReservationDetailInitialTab("details");
            setReservationDetailFromNotifications(false);
          }}
          onBack={
            reservationDetailFromNotifications
              ? () => {
                  setSelectedReservationDetailId(null);
                  setReservationDetailInitialTab("details");
                  setReservationDetailFromNotifications(false);
                  setIsNotificationsOpen(true);
                }
              : undefined
          }
          onEdit={(res) => {
            setSelectedReservationDetailId(null);
            setReservationDetailInitialTab("details");
            setReservationDetailFromNotifications(false);
            setEditingReservation(res);
          }}
          onCancelled={() => {
            setRefreshTrigger((prev) => prev + 1);
          }}
          onNavigateToReservation={(id) => {
            setSelectedReservationDetailId(id);
          }}
        />
      )}

      {/* Edit Reservation Modal */}
      {editingReservation && (
        <EditReservationModal
          reservation={editingReservation}
          allInstruments={allInstruments}
          onClose={() => setEditingReservation(null)}
          onSuccess={() => {
            setEditingReservation(null);
            setRefreshTrigger((prev) => prev + 1);
          }}
        />
      )}

      <PolicyExplainerModal
        isOpen={isPolicyModalOpen}
        onClose={() => setIsPolicyModalOpen(false)}
      />

      {/* Screen 7: Notifications Modal */}
      <NotificationsModal
        isOpen={isNotificationsOpen}
        onClose={() => setIsNotificationsOpen(false)}
        onUnreadCountChange={(cnt) => setUnreadCount(cnt)}
        onSelectReservation={(reservationId, initialTab) => {
          setIsNotificationsOpen(false);
          setSelectedReservationDetailId(reservationId);
          setReservationDetailInitialTab(initialTab || "details");
          setReservationDetailFromNotifications(true);
        }}
      />
    </div>
  );
};

export default function App() {
  return (
    <AuthProvider>
      <AppRoot />
    </AuthProvider>
  );
}

const AppRoot: React.FC = () => {
  const { firebaseUser, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-stone-100 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-3 border-amber-800/20 border-t-amber-800 rounded-full animate-spin" />
          <div className="text-xs font-semibold text-stone-600">
            Loading Church Portal...
          </div>
        </div>
      </div>
    );
  }

  if (!firebaseUser) {
    return <AuthScreen />;
  }

  return <UserPortalMain />;
};
