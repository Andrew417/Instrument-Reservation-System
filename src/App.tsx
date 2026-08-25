import React, { useState } from 'react';
import { AuthProvider, useAuth } from './contexts/AuthContext.tsx';
import { AuthScreen } from './components/AuthScreen.tsx';
import { AvailabilityCalendar, Instrument } from './components/AvailabilityCalendar.tsx';
import { ReservationFormModal } from './components/ReservationFormModal.tsx';
import {
  LogOut,
  Sparkles,
  Phone,
  Church,
  Calendar,
  CheckCircle2,
  Bell,
  Clock,
  Music2,
  DollarSign,
  User,
  Shield,
  X,
  Plus,
} from 'lucide-react';

interface SelectedSlotInfo {
  instrument: Instrument;
  date: string;
  timeHhmm: string;
  duration: number;
}

const UserPortalMain: React.FC = () => {
  const { profile, logout } = useAuth();
  const [selectedSlot, setSelectedSlot] = useState<SelectedSlotInfo | null>(null);
  const [selectedInstrument, setSelectedInstrument] = useState<Instrument | null>(null);
  const [allInstruments, setAllInstruments] = useState<Instrument[]>([]);
  const [refreshTrigger, setRefreshTrigger] = useState<number>(0);
  const [isManualModalOpen, setIsManualModalOpen] = useState<boolean>(false);

  // Callback from Screen 2 when tapping a free slot
  const handleSelectSlot = (
    instrument: Instrument,
    date: string,
    timeHhmm: string,
    durationHours: number
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
    <div id="user-portal-root" className="min-h-screen bg-stone-100 text-stone-900 font-sans flex flex-col">
      {/* Top Application Header */}
      <header className="bg-white border-b border-stone-200 sticky top-0 z-30 shadow-2xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-800 text-white flex items-center justify-center font-bold text-lg shadow-sm border border-amber-900/30">
              <Church className="w-5 h-5" />
            </div>
            <div>
              <div className="font-bold text-stone-900 text-sm sm:text-base leading-tight">
                Church Instrument Schedule
              </div>
              <div className="text-[11px] text-stone-500 font-medium flex items-center gap-1.5">
                <span>St. Mark Coptic Community</span>
                <span>•</span>
                <span className="text-emerald-700 font-semibold flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 animate-pulse" />
                  Live Sync
                </span>
              </div>
            </div>
          </div>

          {/* User Profile & Actions */}
          <div className="flex items-center gap-2 sm:gap-3">
            {/* Quick New Reservation Button */}
            {allInstruments.length > 0 && (
              <button
                id="btn-quick-new-reservation"
                onClick={() => {
                  setSelectedSlot({
                    instrument: allInstruments[0],
                    date: new Date().toISOString().split('T')[0],
                    timeHhmm: '10:00',
                    duration: 2,
                  });
                }}
                className="hidden md:inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-amber-800 hover:bg-amber-900 text-white text-xs font-bold transition shadow-xs cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Reserve Instrument</span>
              </button>
            )}

            <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 bg-stone-50 border border-stone-200 rounded-xl text-xs">
              <div className="w-6 h-6 rounded-lg bg-amber-100 text-amber-900 font-bold flex items-center justify-center text-xs">
                {profile?.name ? profile.name.charAt(0).toUpperCase() : 'M'}
              </div>
              <div className="flex flex-col text-left">
                <span className="font-semibold text-stone-900 leading-none">{profile?.name}</span>
                <span className="text-[10px] text-stone-500">{profile?.phoneNumber}</span>
              </div>
              {profile?.isTrusted && (
                <span className="ml-1 inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md text-[10px] font-bold bg-amber-100 text-amber-900 border border-amber-200">
                  <Sparkles className="w-2.5 h-2.5" />
                  Trusted
                </span>
              )}
            </div>

            <button
              id="header-signout-btn"
              onClick={logout}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-stone-200 text-stone-700 text-xs font-semibold hover:bg-stone-50 active:bg-stone-100 transition cursor-pointer"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Sign Out</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Content Area: Screen 2 Availability Calendar */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-6 sm:py-8">
        <AvailabilityCalendar
          onSelectSlot={handleSelectSlot}
          onSelectInstrument={handleSelectInstrument}
          refreshTrigger={refreshTrigger}
          onLoadedInstruments={(insts) => setAllInstruments(insts)}
        />
      </main>

      {/* Screen 3: Reservation Form Modal */}
      {selectedSlot && (
        <ReservationFormModal
          initialInstrument={selectedSlot.instrument}
          allInstruments={allInstruments.length > 0 ? allInstruments : [selectedSlot.instrument]}
          initialDate={selectedSlot.date}
          initialTimeHhmm={selectedSlot.timeHhmm}
          initialDuration={selectedSlot.duration}
          onClose={() => setSelectedSlot(null)}
          onSuccess={handleReservationSuccess}
          onOpenSeriesBuilder={(prefill) => {
            // Screen 3b bridge callback
            alert(`Opening Screen 3b Series Builder for ${prefill.instrument.name} on ${prefill.date} at ${prefill.startTime}`);
          }}
        />
      )}

      {/* Screen 4 Header Tap Indicator Modal */}
      {selectedInstrument && (
        <div
          id="instrument-header-modal-backdrop"
          className="fixed inset-0 z-50 bg-stone-900/40 backdrop-blur-xs flex items-center justify-center p-4"
        >
          <div
            id="instrument-header-modal"
            className="bg-white rounded-2xl border border-stone-200 shadow-2xl max-w-md w-full p-6 animate-in fade-in zoom-in duration-150"
          >
            <div className="flex items-start justify-between mb-4">
              <div className="w-10 h-10 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 flex items-center justify-center">
                <Music2 className="w-5 h-5" />
              </div>
              <button
                id="btn-close-inst-modal"
                onClick={() => setSelectedInstrument(null)}
                className="text-stone-400 hover:text-stone-700 p-1 rounded-lg hover:bg-stone-100 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <h3 className="text-base font-bold text-stone-900 mb-1">
              {selectedInstrument.name}
            </h3>
            <p className="text-xs text-stone-500 mb-4">
              Instrument Details & Dedicated Schedule (Screen 4)
            </p>

            <div className="bg-stone-50 border border-stone-200 rounded-xl p-4 space-y-2 text-xs mb-6">
              <div className="flex justify-between">
                <span className="text-stone-500 font-medium">Category:</span>
                <span className="font-bold text-stone-800">{selectedInstrument.type}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-stone-500 font-medium">Booking Mode:</span>
                <span className="font-bold text-stone-800 capitalize">
                  {selectedInstrument.bookingMode}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-stone-500 font-medium">Outside Church Fee:</span>
                <span className="font-bold text-purple-700">
                  EGP {selectedInstrument.outsideFeePerDay} / day
                </span>
              </div>
              {selectedInstrument.description && (
                <div className="pt-2 border-t border-stone-200">
                  <span className="text-stone-500 font-medium block mb-1">Description:</span>
                  <p className="text-stone-700 leading-relaxed text-[11px]">
                    {selectedInstrument.description}
                  </p>
                </div>
              )}
            </div>

            <button
              id="btn-dismiss-inst-modal"
              onClick={() => setSelectedInstrument(null)}
              className="w-full py-2.5 bg-stone-900 hover:bg-stone-800 text-white text-xs font-bold rounded-xl transition cursor-pointer"
            >
              Close
            </button>
          </div>
        </div>
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
          <div className="text-xs font-semibold text-stone-600">Loading Church Portal...</div>
        </div>
      </div>
    );
  }

  if (!firebaseUser) {
    return <AuthScreen />;
  }

  return <UserPortalMain />;
};

