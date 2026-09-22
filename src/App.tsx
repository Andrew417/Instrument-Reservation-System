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
import { UserDetailModal } from "./components/UserDetailModal.tsx";
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
  musicianName: string;
  date: string;
  startTime: string;
  duration: number;
  reservationType: "in_church" | "outside_church";
  note?: string;
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
  const [
    reservationDetailFromUserProfile,
    setReservationDetailFromUserProfile,
  ] = useState<boolean>(false);
  const [modalStackOrder, setModalStackOrder] = useState<
    "reservation_over_user" | "user_over_reservation"
  >("user_over_reservation");
  const [editingReservation, setEditingReservation] = useState<any | null>(
    null,
  );

  // Screen 7: Notifications
  const [isNotificationsOpen, setIsNotificationsOpen] =
    useState<boolean>(false);
  const [unreadCount, setUnreadCount] = useState<number>(0);
  // Bottom nav — which tab is visually active
  const [activeMobileTab, setActiveMobileTab] = useState<
    "calendar" | "my_reservations" | "notifications" | "admin_portal"
  >("calendar");
  const [allInstruments, setAllInstruments] = useState<Instrument[]>([]);
  const [refreshTrigger, setRefreshTrigger] = useState<number>(0);

  // User Profile Modal with URL query param sync (?userId=<id>)
  const [selectedUserId, setSelectedUserId] = useState<string | null>(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      return params.get("userId") || null;
    }
    return null;
  });

  const handleOpenUserProfile = (userId: string) => {
    setSelectedUserId(userId);
    setModalStackOrder("user_over_reservation");
    if (typeof window !== "undefined") {
      const url = new URL(window.location.href);
      url.searchParams.set("userId", userId);
      window.history.pushState({}, "", url.toString());
    }
  };

  const handleCloseUserProfile = () => {
    setSelectedUserId(null);
    setReservationDetailFromUserProfile(false);
    setModalStackOrder("reservation_over_user");
    if (typeof window !== "undefined") {
      const url = new URL(window.location.href);
      url.searchParams.delete("userId");
      window.history.pushState({}, "", url.toString());
    }
  };

  useEffect(() => {
    const handlePopState = () => {
      const params = new URLSearchParams(window.location.search);
      setSelectedUserId(params.get("userId") || null);
    };
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

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
              onClick={() => {
                setIsNotificationsOpen(false);
                setCurrentView("calendar");
              }}
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
              onClick={() => {
                setIsNotificationsOpen(false);
                setCurrentView("my_reservations");
              }}
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
                onClick={() => {
                  setIsNotificationsOpen(false);
                  setCurrentView("admin_portal");
                }}
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
              className={`hidden lg:flex relative p-2 sm:px-3 sm:py-1.5 rounded-xl border text-xs font-bold transition items-center gap-2 cursor-pointer ${
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
      </header>

      {/* Main Content Area — extra bottom padding on mobile to clear the bottom nav */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-6 sm:py-8 pb-24 lg:pb-8">
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
                musicianName: "",
                date: getTodayDateString(),
                startTime: "10:00",
                duration: 2,
                reservationType: "in_church",
              });
            }}
            onSelectReservationDetail={(id) => {
              setSelectedReservationDetailId(id);
              setReservationDetailFromNotifications(false);
              setReservationDetailFromUserProfile(false);
              setModalStackOrder("reservation_over_user");
            }}
            onEditReservation={(res) => {
              setEditingReservation(res);
              setReservationDetailFromNotifications(false);
              setReservationDetailFromUserProfile(false);
            }}
          />
        )}
        {currentView === "admin_portal" && isAdminOrSuperAdmin && (
          <AdminPortal
            onBackToMemberView={() => setCurrentView("calendar")}
            onOpenReservationDetail={(id) => {
              setSelectedReservationDetailId(id);
              setReservationDetailFromNotifications(false);
              setReservationDetailFromUserProfile(false);
              setModalStackOrder("reservation_over_user");
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
          initialMusicianName={seriesPrefill.musicianName}
          initialDate={seriesPrefill.date}
          initialTimeHhmm={seriesPrefill.startTime}
          initialDuration={seriesPrefill.duration}
          initialReservationType={seriesPrefill.reservationType}
          initialNote={seriesPrefill.note}
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
          zIndexClass={
            modalStackOrder === "reservation_over_user" ? "z-[60]" : "z-50"
          }
          backButtonTitle={
            reservationDetailFromNotifications
              ? t("reservationDetail.backToNotifications")
              : reservationDetailFromUserProfile
                ? t("reservationDetail.backToProfile") ||
                  "Back to Member Profile"
                : undefined
          }
          onClose={() => {
            setSelectedReservationDetailId(null);
            setReservationDetailInitialTab("details");
            setReservationDetailFromNotifications(false);
            setReservationDetailFromUserProfile(false);
            setModalStackOrder("user_over_reservation");
          }}
          onBack={
            reservationDetailFromNotifications
              ? () => {
                  setSelectedReservationDetailId(null);
                  setReservationDetailInitialTab("details");
                  setReservationDetailFromNotifications(false);
                  setIsNotificationsOpen(true);
                }
              : reservationDetailFromUserProfile
                ? () => {
                    setSelectedReservationDetailId(null);
                    setReservationDetailInitialTab("details");
                    setReservationDetailFromUserProfile(false);
                    setModalStackOrder("user_over_reservation");
                  }
                : undefined
          }
          onEdit={(res) => {
            setSelectedReservationDetailId(null);
            setReservationDetailInitialTab("details");
            setReservationDetailFromNotifications(false);
            setReservationDetailFromUserProfile(false);
            setEditingReservation(res);
          }}
          onCancelled={() => {
            setRefreshTrigger((prev) => prev + 1);
          }}
          onNavigateToReservation={(id) => {
            setSelectedReservationDetailId(id);
          }}
          onOpenUserProfile={
            isAdminOrSuperAdmin ? handleOpenUserProfile : undefined
          }
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
          setReservationDetailFromUserProfile(false);
          setModalStackOrder("reservation_over_user");
        }}
        onOpenUserProfile={
          isAdminOrSuperAdmin ? handleOpenUserProfile : undefined
        }
      />

      {/* User Profile Modal (Admin / Super Admin) */}
      {selectedUserId && isAdminOrSuperAdmin && (
        <UserDetailModal
          userId={selectedUserId}
          isOpen={Boolean(selectedUserId)}
          onClose={handleCloseUserProfile}
          zIndexClass={
            modalStackOrder === "user_over_reservation" ? "z-[60]" : "z-50"
          }
          onSelectReservation={(resId) => {
            setSelectedReservationDetailId(resId);
            setReservationDetailInitialTab("details");
            setReservationDetailFromNotifications(false);
            setReservationDetailFromUserProfile(true);
            setModalStackOrder("reservation_over_user");
          }}
          isSuperAdmin={Boolean(
            profile?.role === "super_admin" || profile?.isSuperAdmin,
          )}
          sessionToken={sessionToken}
          onUserUpdated={() => setRefreshTrigger((prev) => prev + 1)}
        />
      )}

      {/* ✅ Mobile Bottom Navigation Bar — polished */}
      <nav
        id="mobile-bottom-nav"
        className="lg:hidden fixed bottom-0 left-0 right-0 z-[70] bg-white/95 backdrop-blur-md border-t border-stone-200/80 shadow-[0_-4px_20px_rgba(28,25,23,0.06)] pb-[env(safe-area-inset-bottom)]"
        dir="ltr"
      >
        <div className="flex items-stretch justify-around max-w-lg mx-auto px-1">
          {/* Calendar */}
          <button
            type="button"
            id="bottom-nav-calendar"
            onClick={() => {
              setIsNotificationsOpen(false);
              setActiveMobileTab("calendar");
              setCurrentView("calendar");
            }}
            aria-current={activeMobileTab === "calendar" ? "page" : undefined}
            className="relative flex-1 flex flex-col items-center justify-center gap-0.5 pt-2 pb-1.5 px-1 transition-all duration-200 cursor-pointer touch-manipulation active:scale-95 group"
          >
            {/* Active pill background behind icon */}
            <div
              className={`relative flex items-center justify-center w-12 h-7 rounded-full transition-all duration-200 ${
                activeMobileTab === "calendar"
                  ? "bg-amber-800 shadow-sm"
                  : "bg-transparent group-hover:bg-stone-100"
              }`}
            >
              <CalendarDays
                className={`w-[18px] h-[18px] transition-colors ${
                  activeMobileTab === "calendar"
                    ? "text-white"
                    : "text-stone-500 group-hover:text-stone-700"
                }`}
              />
            </div>
            <span
              className={`text-[10px] font-semibold leading-none mt-0.5 transition-colors ${
                activeMobileTab === "calendar"
                  ? "text-amber-900"
                  : "text-stone-500 group-hover:text-stone-700"
              }`}
            >
              {t("nav.calendarShort")}
            </span>
          </button>

          {/* My Bookings */}
          <button
            type="button"
            id="bottom-nav-bookings"
            onClick={() => {
              setIsNotificationsOpen(false);
              setActiveMobileTab("my_reservations");
              setCurrentView("my_reservations");
            }}
            aria-current={
              activeMobileTab === "my_reservations" ? "page" : undefined
            }
            className="relative flex-1 flex flex-col items-center justify-center gap-0.5 pt-2 pb-1.5 px-1 transition-all duration-200 cursor-pointer touch-manipulation active:scale-95 group"
          >
            <div
              className={`relative flex items-center justify-center w-12 h-7 rounded-full transition-all duration-200 ${
                activeMobileTab === "my_reservations"
                  ? "bg-amber-800 shadow-sm"
                  : "bg-transparent group-hover:bg-stone-100"
              }`}
            >
              <BookmarkCheck
                className={`w-[18px] h-[18px] transition-colors ${
                  activeMobileTab === "my_reservations"
                    ? "text-white"
                    : "text-stone-500 group-hover:text-stone-700"
                }`}
              />
            </div>
            <span
              className={`text-[10px] font-semibold leading-none mt-0.5 transition-colors ${
                activeMobileTab === "my_reservations"
                  ? "text-amber-900"
                  : "text-stone-500 group-hover:text-stone-700"
              }`}
            >
              {t("nav.bookingsShort")}
            </span>
          </button>

          {/* Notifications */}
          <button
            type="button"
            id="bottom-nav-notifications"
            onClick={() => {
              setActiveMobileTab("notifications");
              setIsNotificationsOpen(true);
            }}
            aria-current={
              activeMobileTab === "notifications" ? "page" : undefined
            }
            className="relative flex-1 flex flex-col items-center justify-center gap-0.5 pt-2 pb-1.5 px-1 transition-all duration-200 cursor-pointer touch-manipulation active:scale-95 group"
          >
            <div
              className={`relative flex items-center justify-center w-12 h-7 rounded-full transition-all duration-200 ${
                activeMobileTab === "notifications"
                  ? "bg-amber-800 shadow-sm"
                  : "bg-transparent group-hover:bg-stone-100"
              }`}
            >
              <Bell
                className={`w-[18px] h-[18px] transition-colors ${
                  activeMobileTab === "notifications"
                    ? "text-white"
                    : "text-stone-500 group-hover:text-stone-700"
                }`}
              />
              {unreadCount > 0 && (
                <span
                  className={`absolute -top-1 -right-0.5 min-w-[16px] h-[16px] px-1 text-white font-bold text-[9px] rounded-full flex items-center justify-center ring-2 transition-colors ${
                    activeMobileTab === "notifications"
                      ? "bg-amber-600 ring-amber-800"
                      : "bg-amber-600 ring-white"
                  }`}
                >
                  {unreadCount > 9 ? "9+" : unreadCount}
                </span>
              )}
            </div>
            <span
              className={`text-[10px] font-semibold leading-none mt-0.5 transition-colors ${
                activeMobileTab === "notifications"
                  ? "text-amber-900"
                  : "text-stone-500 group-hover:text-stone-700"
              }`}
            >
              {t("nav.alerts")}
            </span>
          </button>

          {/* Admin Portal — admins only */}
          {isAdminOrSuperAdmin && (
            <button
              type="button"
              id="bottom-nav-admin"
              onClick={() => {
                setIsNotificationsOpen(false);
                setActiveMobileTab("admin_portal");
                setCurrentView("admin_portal");
              }}
              aria-current={
                activeMobileTab === "admin_portal" ? "page" : undefined
              }
              className="relative flex-1 flex flex-col items-center justify-center gap-0.5 pt-2 pb-1.5 px-1 transition-all duration-200 cursor-pointer touch-manipulation active:scale-95 group"
            >
              <div
                className={`relative flex items-center justify-center w-12 h-7 rounded-full transition-all duration-200 ${
                  activeMobileTab === "admin_portal"
                    ? "bg-amber-800 shadow-sm"
                    : "bg-transparent group-hover:bg-stone-100"
                }`}
              >
                <Shield
                  className={`w-[18px] h-[18px] transition-colors ${
                    activeMobileTab === "admin_portal"
                      ? "text-white"
                      : "text-stone-500 group-hover:text-stone-700"
                  }`}
                />
              </div>
              <span
                className={`text-[10px] font-semibold leading-none mt-0.5 transition-colors ${
                  activeMobileTab === "admin_portal"
                    ? "text-amber-900"
                    : "text-stone-500 group-hover:text-stone-700"
                }`}
              >
                {t("nav.adminShort")}
              </span>
            </button>
          )}
        </div>
      </nav>
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
