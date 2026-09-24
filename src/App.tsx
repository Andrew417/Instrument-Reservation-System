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
  Menu,
  LayoutDashboard,
  CalendarCheck,
  MessageSquare as MessageSquareIcon,
  ShieldCheck,
  Sliders,
  CreditCard,
  Users as UsersIcon,
  UserCheck,
  Clock,
  Music2,
  DollarSign,
  User,
  Shield,
  X,
  Plus,
  BookmarkCheck,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Search,
  ArrowLeft,
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

// Simple event bus so AdminPortal can publish its tab list to the App
// for the left sidebar. No external state library required.
const ADMIN_TABS_EVENT = "admin-tabs:update";
interface AdminTabInfo {
  id: string;
  label: string;
  Icon: React.ComponentType<{ className?: string }>;
  count?: number;
  section: "operations" | "super_admin";
}

const UserPortalMain: React.FC = () => {
  // Admin tab list (published by AdminPortal via event bus)
  const [adminTabs, setAdminTabs] = useState<AdminTabInfo[]>([]);
  const [activeAdminTabId, setActiveAdminTabId] = useState<string>("dashboard");

  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail as {
        tabs: AdminTabInfo[];
        activeTabId: string;
      };
      if (detail?.tabs) setAdminTabs(detail.tabs);
      if (detail?.activeTabId) setActiveAdminTabId(detail.activeTabId);
    };
    window.addEventListener(ADMIN_TABS_EVENT, handler);
    return () => window.removeEventListener(ADMIN_TABS_EVENT, handler);
  }, []);
  const { profile, logout, sessionToken } = useAuth();
  const { t, i18n } = useTranslation();
  const isRTL = i18n.language === "ar";
  const isAdminOrSuperAdmin =
    profile?.role === "admin" ||
    profile?.role === "super_admin" ||
    profile?.isSuperAdmin;
  const [policyExplainerEnabled, setPolicyExplainerEnabled] = useState(true);
  // Auto-open policy explainer modal after auth only for regular users (not for admins or superadmins)
  const [isPolicyModalOpen, setIsPolicyModalOpen] = useState(false);

  useEffect(() => {
    // Only automatically pop up for regular users, never for admins or superadmins
    if (profile && !isAdminOrSuperAdmin) {
      setIsPolicyModalOpen(true);
    } else {
      setIsPolicyModalOpen(false);
    }
  }, [profile?.id, profile?.role, isAdminOrSuperAdmin]);
  // Navigation View: 'calendar' (Screen 2) | 'my_reservations' (Screen 5) | 'admin_portal'
  const [currentView, setCurrentView] = useState<
    "calendar" | "my_reservations" | "admin_portal" | "notifications"
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
  // Admin sidebar (left menu) — opens as drawer on mobile, fixed on desktop
  const [isAdminSidebarOpen, setIsAdminSidebarOpen] = useState<boolean>(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState<boolean>(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("church_admin_sidebar_collapsed") === "true";
    }
    return false;
  });
  const [sidebarSearchTerm, setSidebarSearchTerm] = useState<string>("");

  const toggleSidebarCollapsed = () => {
    setIsSidebarCollapsed((prev) => {
      const next = !prev;
      if (typeof window !== "undefined") {
        localStorage.setItem("church_admin_sidebar_collapsed", String(next));
      }
      return next;
    });
  };
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
          <div className="flex items-center gap-3 min-w-0">
            {/* ✅ Admin menu trigger — only in Admin Portal view (mobile) */}
            {isAdminOrSuperAdmin && currentView === "admin_portal" && (
              <button
                type="button"
                onClick={() => setIsAdminSidebarOpen(true)}
                className="lg:hidden p-2 -ml-1 rounded-xl text-stone-700 hover:text-amber-900 hover:bg-amber-50 active:bg-amber-100 transition cursor-pointer shrink-0"
                title="Open admin menu"
                aria-label="Open admin menu"
              >
                <Menu className="w-5 h-5" />
              </button>
            )}

            <img
              src="/logo.png"
              alt="Church logo"
              className="w-10 h-10 rounded-2xl object-cover shadow-sm border border-amber-900/30 shrink-0"
            />
            <div className="min-w-0">
              <div className="font-bold text-stone-900 text-xs lg:text-xs xl:text-base leading-tight truncate">
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
              onClick={() => setCurrentView("notifications")}
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
      <main
        className={`flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-6 sm:py-8 pb-24 lg:pb-8 transition-[padding] duration-200 ${
          isAdminOrSuperAdmin && currentView === "admin_portal"
            ? isRTL
              ? isSidebarCollapsed
                ? "lg:pr-20 lg:pl-0"
                : "lg:pr-72 lg:pl-0"
              : isSidebarCollapsed
                ? "lg:pl-20 lg:pr-0"
                : "lg:pl-72 lg:pr-0"
            : ""
        }`}
      >
        {currentView === "calendar" && (
          <AvailabilityCalendar
            onSelectSlot={handleSelectSlot}
            onSelectInstrument={handleSelectInstrument}
            refreshTrigger={refreshTrigger}
            onLoadedInstruments={(insts) => setAllInstruments(insts)}
          />
        )}
        {currentView === "notifications" && (
          <NotificationsModal
            isOpen={true}
            onClose={() => setCurrentView("calendar")}
            onUnreadCountChange={(cnt) => setUnreadCount(cnt)}
            onSelectReservation={(reservationId, initialTab) => {
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
        className="lg:hidden fixed bottom-0 left-0 right-0 z-[75] bg-white/95 backdrop-blur-md border-t border-stone-200/80 shadow-[0_-4px_20px_rgba(28,25,23,0.06)] pb-[env(safe-area-inset-bottom)]"
        style={{ transform: "translateZ(0)" }}
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
              setCurrentView("notifications");
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

      {/* ✅ Admin Sidebar — desktop collapsible & RTL aware; mobile drawer */}
      {isAdminOrSuperAdmin && currentView === "admin_portal" && (
        <>
          {/* Backdrop (mobile only) */}
          {isAdminSidebarOpen && (
            <div
              className="fixed inset-0 z-[60] bg-black/50 backdrop-blur-xs lg:hidden animate-in fade-in duration-150"
              onClick={() => setIsAdminSidebarOpen(false)}
              aria-hidden="true"
            />
          )}

          {/* Sidebar panel */}
          <aside
            dir={isRTL ? "rtl" : "ltr"}
            className={`fixed top-0 z-[80] bg-white border-stone-200 shadow-2xl flex-col h-[100dvh] pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)] transition-all duration-200 lg:flex ${
              isRTL
                ? "right-0 border-l lg:border-l"
                : "left-0 border-r lg:border-r"
            } ${
              isSidebarCollapsed
                ? "lg:w-20 w-72 max-w-[85vw]"
                : "lg:w-72 w-72 max-w-[85vw]"
            } ${
              isAdminSidebarOpen
                ? "flex translate-x-0"
                : `hidden lg:flex ${
                    isRTL
                      ? "translate-x-full lg:translate-x-0"
                      : "-translate-x-full lg:translate-x-0"
                  }`
            }`}
            aria-label="Admin navigation"
          >
            {/* Header inside sidebar */}
            <div
              className={`flex items-center justify-between px-3.5 py-3 border-b border-stone-200 shrink-0 ${
                isSidebarCollapsed ? "lg:px-2.5 lg:justify-center" : ""
              }`}
            >
              <div
                className={`flex items-center gap-2.5 min-w-0 ${
                  isSidebarCollapsed ? "lg:hidden" : ""
                }`}
              >
                <div className="w-9 h-9 rounded-2xl bg-amber-800 text-white flex items-center justify-center shrink-0 shadow-2xs">
                  <LayoutDashboard className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <div className="text-sm font-bold text-stone-900 truncate">
                    {profile?.role === "super_admin"
                      ? t("admin.consoleTitle")
                      : t("admin.adminTitle")}
                  </div>
                  <div className="text-[10px] text-stone-500 truncate">
                    {t("admin.consoleSubtitle")}
                  </div>
                </div>
              </div>

              {/* Collapsed view top icon (desktop only) */}
              {isSidebarCollapsed && (
                <div
                  className="hidden lg:flex w-9 h-9 rounded-2xl bg-amber-800 text-white items-center justify-center shrink-0 shadow-2xs cursor-pointer"
                  onClick={toggleSidebarCollapsed}
                  title={t("admin.sidebar.expandSidebar")}
                >
                  <LayoutDashboard className="w-4 h-4" />
                </div>
              )}

              {/* Mobile Close Button */}
              <button
                type="button"
                onClick={() => setIsAdminSidebarOpen(false)}
                className="lg:hidden shrink-0 p-2 -mr-1 rounded-lg text-stone-400 hover:text-stone-700 hover:bg-stone-100 transition cursor-pointer"
                aria-label="Close admin menu"
              >
                <X className="w-4 h-4" />
              </button>

              {/* Desktop Collapse / Expand Toggle Button */}
              <button
                type="button"
                id="btn-desktop-toggle-admin-sidebar"
                onClick={toggleSidebarCollapsed}
                className={`hidden lg:flex p-1.5 rounded-xl text-stone-400 hover:text-stone-700 hover:bg-stone-100 transition cursor-pointer shrink-0 ${
                  isSidebarCollapsed ? "mt-2" : ""
                }`}
                title={
                  isSidebarCollapsed
                    ? t("admin.sidebar.expandSidebar")
                    : t("admin.sidebar.collapseSidebar")
                }
                aria-label={
                  isSidebarCollapsed
                    ? t("admin.sidebar.expandSidebar")
                    : t("admin.sidebar.collapseSidebar")
                }
              >
                {isRTL ? (
                  isSidebarCollapsed ? (
                    <ChevronLeft className="w-4 h-4" />
                  ) : (
                    <ChevronRight className="w-4 h-4" />
                  )
                ) : isSidebarCollapsed ? (
                  <ChevronRight className="w-4 h-4" />
                ) : (
                  <ChevronLeft className="w-4 h-4" />
                )}
              </button>
            </div>

            {/* Quick search input (only when expanded) */}
            {!isSidebarCollapsed && (
              <div className="px-3 pt-3 pb-1 shrink-0">
                <div className="relative">
                  <Search
                    className={`w-3.5 h-3.5 text-stone-400 absolute top-1/2 -translate-y-1/2 ${
                      isRTL ? "right-2.5" : "left-2.5"
                    }`}
                  />
                  <input
                    type="text"
                    value={sidebarSearchTerm}
                    onChange={(e) => setSidebarSearchTerm(e.target.value)}
                    placeholder={t("admin.sidebar.searchTabs")}
                    className={`w-full text-xs rounded-xl bg-stone-50 border border-stone-200 py-1.5 text-stone-800 placeholder-stone-400 focus:outline-none focus:border-amber-700 focus:bg-white transition ${
                      isRTL ? "pr-8 pl-6" : "pl-8 pr-6"
                    }`}
                  />
                  {sidebarSearchTerm && (
                    <button
                      type="button"
                      onClick={() => setSidebarSearchTerm("")}
                      className={`absolute top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600 ${
                        isRTL ? "left-2" : "right-2"
                      }`}
                    >
                      <X className="w-3 h-3" />
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* Tabs List */}
            <div className="flex-1 overflow-y-auto py-2 px-2 space-y-3">
              {/* Operations section */}
              {(() => {
                const filteredOps = adminTabs
                  .filter((tab) => tab.section === "operations")
                  .filter(
                    (tab) =>
                      !sidebarSearchTerm ||
                      tab.label
                        .toLowerCase()
                        .includes(sidebarSearchTerm.toLowerCase()),
                  );

                if (filteredOps.length === 0 && sidebarSearchTerm) return null;

                return (
                  <div>
                    {!isSidebarCollapsed && (
                      <div className="px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-stone-400">
                        {t("admin.sidebar.operationsSection")}
                      </div>
                    )}
                    <nav className="space-y-1">
                      {filteredOps.map((tab) => {
                        const isActive =
                          currentView === "admin_portal" &&
                          activeAdminTabId === tab.id;
                        return (
                          <button
                            key={tab.id}
                            type="button"
                            onClick={() => {
                              window.dispatchEvent(
                                new CustomEvent(ADMIN_TABS_EVENT + ":select", {
                                  detail: { id: tab.id },
                                }),
                              );
                              setActiveAdminTabId(tab.id);
                              setCurrentView("admin_portal");
                              setActiveMobileTab("admin_portal");
                              setIsNotificationsOpen(false);
                              setIsAdminSidebarOpen(false);
                            }}
                            title={isSidebarCollapsed ? tab.label : undefined}
                            className={`w-full flex items-center ${
                              isSidebarCollapsed
                                ? "lg:justify-center px-2 py-2.5"
                                : "justify-between px-3 py-2"
                            } rounded-xl text-xs font-bold transition-all cursor-pointer relative group ${
                              isActive
                                ? "bg-amber-50 text-amber-950 border border-amber-200/80 shadow-2xs font-extrabold"
                                : "text-stone-600 hover:text-stone-900 hover:bg-stone-50 border border-transparent"
                            }`}
                          >
                            {/* Active border bar indicator */}
                            {isActive && (
                              <span
                                className={`hidden lg:block absolute top-1.5 bottom-1.5 w-1 bg-amber-800 rounded-full ${
                                  isRTL ? "right-0.5" : "left-0.5"
                                }`}
                              />
                            )}

                            <div
                              className={`flex items-center gap-2.5 min-w-0 ${
                                isSidebarCollapsed ? "lg:justify-center" : ""
                              }`}
                            >
                              <tab.Icon
                                className={`w-4 h-4 shrink-0 transition-colors ${
                                  isActive
                                    ? "text-amber-800"
                                    : "text-stone-500 group-hover:text-amber-800"
                                }`}
                              />
                              <span
                                className={`truncate ${
                                  isSidebarCollapsed ? "lg:hidden" : ""
                                }`}
                              >
                                {tab.label}
                              </span>
                            </div>

                            {/* Badge count */}
                            {typeof tab.count === "number" &&
                              tab.count > 0 &&
                              (isSidebarCollapsed ? (
                                <span className="absolute -top-1 -right-1 lg:flex hidden px-1 min-w-[16px] h-4 rounded-full text-[9px] font-extrabold bg-amber-700 text-white items-center justify-center ring-2 ring-white">
                                  {tab.count > 9 ? "9+" : tab.count}
                                </span>
                              ) : (
                                <span className="shrink-0 px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-amber-100 text-amber-900 border border-amber-200">
                                  {tab.count > 9 ? "9+" : tab.count}
                                </span>
                              ))}
                          </button>
                        );
                      })}
                    </nav>
                  </div>
                );
              })()}

              {/* Super Admin section */}
              {profile?.role === "super_admin" &&
                (() => {
                  const filteredSuper = adminTabs
                    .filter((tab) => tab.section === "super_admin")
                    .filter(
                      (tab) =>
                        !sidebarSearchTerm ||
                        tab.label
                          .toLowerCase()
                          .includes(sidebarSearchTerm.toLowerCase()),
                    );

                  if (filteredSuper.length === 0 && sidebarSearchTerm)
                    return null;

                  return (
                    <div className="pt-1">
                      {!isSidebarCollapsed && (
                        <div className="px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-amber-900 flex items-center gap-1.5">
                          <Sparkles className="w-3 h-3 text-amber-700 shrink-0" />
                          <span>{t("admin.sidebar.superAdminSection")}</span>
                        </div>
                      )}
                      <nav className="space-y-1">
                        {filteredSuper.map((tab) => {
                          const isActive =
                            currentView === "admin_portal" &&
                            activeAdminTabId === tab.id;
                          return (
                            <button
                              key={tab.id}
                              type="button"
                              onClick={() => {
                                window.dispatchEvent(
                                  new CustomEvent(
                                    ADMIN_TABS_EVENT + ":select",
                                    {
                                      detail: { id: tab.id },
                                    },
                                  ),
                                );
                                setActiveAdminTabId(tab.id);
                                setCurrentView("admin_portal");
                                setActiveMobileTab("admin_portal");
                                setIsNotificationsOpen(false);
                                setIsAdminSidebarOpen(false);
                              }}
                              title={isSidebarCollapsed ? tab.label : undefined}
                              className={`w-full flex items-center ${
                                isSidebarCollapsed
                                  ? "lg:justify-center px-2 py-2.5"
                                  : "justify-between px-3 py-2"
                              } rounded-xl text-xs font-bold transition-all cursor-pointer relative group ${
                                isActive
                                  ? "bg-amber-100 text-amber-950 border border-amber-300 shadow-2xs font-extrabold"
                                  : "text-stone-600 hover:text-amber-950 hover:bg-amber-50/60 border border-transparent"
                              }`}
                            >
                              {/* Active border bar indicator */}
                              {isActive && (
                                <span
                                  className={`hidden lg:block absolute top-1.5 bottom-1.5 w-1 bg-amber-800 rounded-full ${
                                    isRTL ? "right-0.5" : "left-0.5"
                                  }`}
                                />
                              )}

                              <div
                                className={`flex items-center gap-2.5 min-w-0 ${
                                  isSidebarCollapsed ? "lg:justify-center" : ""
                                }`}
                              >
                                <tab.Icon
                                  className={`w-4 h-4 shrink-0 transition-colors ${
                                    isActive
                                      ? "text-amber-800"
                                      : "text-stone-500 group-hover:text-amber-800"
                                  }`}
                                />
                                <span
                                  className={`truncate ${
                                    isSidebarCollapsed ? "lg:hidden" : ""
                                  }`}
                                >
                                  {tab.label}
                                </span>
                              </div>

                              {typeof tab.count === "number" &&
                                tab.count > 0 &&
                                (isSidebarCollapsed ? (
                                  <span className="absolute -top-1 -right-1 lg:flex hidden px-1 min-w-[16px] h-4 rounded-full text-[9px] font-extrabold bg-amber-700 text-white items-center justify-center ring-2 ring-white">
                                    {tab.count > 9 ? "9+" : tab.count}
                                  </span>
                                ) : (
                                  <span className="shrink-0 px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-amber-200/60 text-amber-950 border border-amber-300/60">
                                    {tab.count > 9 ? "9+" : tab.count}
                                  </span>
                                ))}
                            </button>
                          );
                        })}
                      </nav>
                    </div>
                  );
                })()}

              {/* No search results fallback */}
              {sidebarSearchTerm &&
                adminTabs.filter((t) =>
                  t.label
                    .toLowerCase()
                    .includes(sidebarSearchTerm.toLowerCase()),
                ).length === 0 && (
                  <div className="py-6 text-center text-xs text-stone-400">
                    {t("admin.sidebar.noMatchingTabs")}
                  </div>
                )}
            </div>

            {/* Bottom Return to Member View quick link */}
            <div className="p-2 border-t border-stone-200 shrink-0">
              <button
                type="button"
                onClick={() => {
                  setCurrentView("calendar");
                  setActiveMobileTab("calendar");
                }}
                title={t("admin.returnToCalendar")}
                className={`w-full flex items-center ${
                  isSidebarCollapsed ? "justify-center p-2.5" : "gap-2 px-3 py-2"
                } rounded-xl text-xs font-semibold text-stone-500 hover:text-stone-800 hover:bg-stone-100 transition cursor-pointer`}
              >
                <ArrowLeft
                  className={`w-4 h-4 shrink-0 ${isRTL ? "rotate-180" : ""}`}
                />
                {!isSidebarCollapsed && (
                  <span className="truncate">{t("admin.returnToCalendar")}</span>
                )}
              </button>
            </div>
          </aside>
        </>
      )}
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
