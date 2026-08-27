import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../contexts/AuthContext.tsx';
import { Instrument } from './AvailabilityCalendar.tsx';
import {
  Calendar,
  Clock,
  Music2,
  DollarSign,
  Shield,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  X,
  Repeat,
  Sparkles,
  ArrowRight,
  Info,
  CalendarRange,
  Layers,
  ChevronDown,
  ChevronUp,
  Edit,
  Trash2,
  RefreshCw,
  Plus,
} from 'lucide-react';

export interface MyReservationsProps {
  allInstruments: Instrument[];
  onOpenNewReservation: () => void;
  onOpenSeriesBuilder: () => void;
  onSelectReservationDetail: (reservationId: string) => void;
  onEditReservation: (reservation: any) => void;
  refreshTrigger?: number;
}

interface GroupedSeries {
  seriesId: string;
  instrumentName: string;
  instrumentType: string;
  bookingMode: string;
  serviceName: string;
  patternType: string;
  reservationType: string;
  feeSnapshot: string | null;
  occurrences: any[];
  earliestStart: Date;
  latestEnd: Date;
}

export const MyReservations: React.FC<MyReservationsProps> = ({
  allInstruments,
  onOpenNewReservation,
  onOpenSeriesBuilder,
  onSelectReservationDetail,
  onEditReservation,
  refreshTrigger = 0,
}) => {
  const { profile, sessionToken } = useAuth();

  // Tab: 'upcoming' | 'pending' | 'past'
  const [activeTab, setActiveTab] = useState<'upcoming' | 'pending' | 'past'>('upcoming');

  // Expanded series IDs map
  const [expandedSeries, setExpandedSeries] = useState<Record<string, boolean>>({});

  // Cancellation confirm dialog state
  const [cancellingItem, setCancellingItem] = useState<{
    id: string;
    mode: 'single' | 'series';
    title: string;
  } | null>(null);
  const [isCancelling, setIsCancelling] = useState<boolean>(false);
  const [cancelError, setCancelError] = useState<string | null>(null);

  // Data fetching
  const [reservations, setReservations] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [fetchError, setFetchError] = useState<string | null>(null);

  const fetchMyReservations = async () => {
    if (!profile) return;
    setLoading(true);
    setFetchError(null);
    try {
      const res = await fetch(`/api/reservations?userId=${profile.id}`);
      const data = await res.json();
      if (!res.ok || !data.success) {
        setFetchError(data.error || 'Failed to fetch reservations.');
        setLoading(false);
        return;
      }
      setReservations(data.reservations || []);
    } catch (err: any) {
      setFetchError(err.message || 'Network error fetching reservations.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMyReservations();
  }, [profile?.id, refreshTrigger]);

  const toggleSeriesExpansion = (seriesId: string) => {
    setExpandedSeries((prev) => ({
      ...prev,
      [seriesId]: !prev[seriesId],
    }));
  };

  // Handle Cancellation Action
  const executeCancellation = async () => {
    if (!cancellingItem || !profile) return;
    setIsCancelling(true);
    setCancelError(null);
    try {
      const res = await fetch(`/api/reservations/${cancellingItem.id}/cancel`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${sessionToken}`,
        },
        body: JSON.stringify({
          userId: profile.id,
          cancelMode: cancellingItem.mode,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        setCancelError(data.error || 'Cancellation failed.');
        setIsCancelling(false);
        return;
      }

      setIsCancelling(false);
      setCancellingItem(null);
      fetchMyReservations();
    } catch (err: any) {
      setCancelError(err.message || 'Error occurred while processing cancellation.');
      setIsCancelling(false);
    }
  };

  // Group and categorize user reservations into: Upcoming, Pending, Past
  const categorizedData = useMemo(() => {
    const now = new Date();

    const upcomingList: any[] = [];
    const pendingList: any[] = [];
    const pastList: any[] = [];

    // Grouping by series vs single
    const seriesMap: Record<string, any[]> = {};
    const standaloneList: any[] = [];

    reservations.forEach((r) => {
      if (r.series_id) {
        if (!seriesMap[r.series_id]) {
          seriesMap[r.series_id] = [];
        }
        seriesMap[r.series_id].push(r);
      } else {
        standaloneList.push(r);
      }
    });

    // Build series group objects
    const seriesGroups: GroupedSeries[] = Object.entries(seriesMap).map(([seriesId, occs]) => {
      const sorted = [...occs].sort(
        (a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime()
      );
      const first = sorted[0];
      const last = sorted[sorted.length - 1];

      return {
        seriesId,
        instrumentName: first.instrument_name || 'Instrument',
        instrumentType: first.instrument_type || 'General',
        bookingMode: first.booking_mode || 'manual',
        serviceName: first.service_name || 'Recurring Service',
        patternType: first.series_pattern_type || 'weekly',
        reservationType: first.reservation_type || 'in_church',
        feeSnapshot: first.fee_snapshot,
        occurrences: sorted,
        earliestStart: new Date(first.start_time),
        latestEnd: new Date(last.end_time),
      };
    });

    // 1. Process Standalone Items
    standaloneList.forEach((r) => {
      const start = new Date(r.start_time);
      const end = new Date(r.end_time);

      if (r.status === 'pending') {
        pendingList.push({ type: 'single', data: r, time: start });
      } else if (r.status === 'approved' || r.status === 'ongoing') {
        if (end > now) {
          upcomingList.push({ type: 'single', data: r, time: start });
        } else {
          pastList.push({ type: 'single', data: r, time: start });
        }
      } else {
        // cancelled, rejected, completed
        pastList.push({ type: 'single', data: r, time: start });
      }
    });

    // 2. Process Series Groups
    seriesGroups.forEach((sg) => {
      const hasPending = sg.occurrences.some((o) => o.status === 'pending');
      const hasUpcomingApproved = sg.occurrences.some(
        (o) => (o.status === 'approved' || o.status === 'ongoing') && new Date(o.end_time) > now
      );
      const allPastOrInactive = sg.occurrences.every(
        (o) =>
          new Date(o.end_time) <= now ||
          o.status === 'cancelled' ||
          o.status === 'rejected' ||
          o.status === 'completed'
      );

      if (hasPending) {
        pendingList.push({ type: 'series', data: sg, time: sg.earliestStart });
      } else if (hasUpcomingApproved) {
        upcomingList.push({ type: 'series', data: sg, time: sg.earliestStart });
      } else if (allPastOrInactive) {
        pastList.push({ type: 'series', data: sg, time: sg.earliestStart });
      } else {
        upcomingList.push({ type: 'series', data: sg, time: sg.earliestStart });
      }
    });

    // Sort all arrays chronologically
    upcomingList.sort((a, b) => a.time.getTime() - b.time.getTime());
    pendingList.sort((a, b) => a.time.getTime() - b.time.getTime());
    pastList.sort((a, b) => b.time.getTime() - a.time.getTime()); // reverse for past

    return { upcomingList, pendingList, pastList };
  }, [reservations]);

  const currentList =
    activeTab === 'upcoming'
      ? categorizedData.upcomingList
      : activeTab === 'pending'
      ? categorizedData.pendingList
      : categorizedData.pastList;

  return (
    <div id="screen-5-my-reservations" className="space-y-6">
      {/* Top Banner / Header */}
      <div className="bg-white rounded-3xl p-5 sm:p-6 border border-stone-200 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-2xl bg-amber-800 text-white flex items-center justify-center font-bold shadow-xs">
              <Calendar className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-stone-900 leading-tight">My Reservations</h1>
              <p className="text-xs text-stone-500">
                Track your active, pending, and recurring church bookings (Screen 5)
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={fetchMyReservations}
            className="p-2.5 rounded-xl border border-stone-200 text-stone-600 hover:text-stone-900 hover:bg-stone-50 transition cursor-pointer"
            title="Refresh list"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>

          <button
            type="button"
            onClick={onOpenSeriesBuilder}
            className="px-3.5 py-2.5 rounded-xl border border-amber-800/30 bg-amber-50 hover:bg-amber-100/80 text-amber-950 text-xs font-bold transition flex items-center gap-1.5 cursor-pointer"
          >
            <Repeat className="w-3.5 h-3.5 text-amber-800" />
            <span>Recurring Series</span>
          </button>

          <button
            type="button"
            onClick={onOpenNewReservation}
            className="px-4 py-2.5 rounded-xl bg-amber-800 hover:bg-amber-900 text-white text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-xs"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>New Reservation</span>
          </button>
        </div>
      </div>

      {/* Tabs Bar: Upcoming / Pending / Past */}
      <div className="flex items-center justify-between border-b border-stone-200">
        <div className="flex items-center gap-2">
          <button
            type="button"
            id="tab-upcoming-reservations"
            onClick={() => setActiveTab('upcoming')}
            className={`px-4 py-3 text-xs font-bold border-b-2 transition flex items-center gap-2 cursor-pointer ${
              activeTab === 'upcoming'
                ? 'border-amber-800 text-amber-900'
                : 'border-transparent text-stone-500 hover:text-stone-800'
            }`}
          >
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            <span>Upcoming</span>
            <span
              className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                activeTab === 'upcoming'
                  ? 'bg-amber-100 text-amber-900'
                  : 'bg-stone-100 text-stone-600'
              }`}
            >
              {categorizedData.upcomingList.length}
            </span>
          </button>

          <button
            type="button"
            id="tab-pending-reservations"
            onClick={() => setActiveTab('pending')}
            className={`px-4 py-3 text-xs font-bold border-b-2 transition flex items-center gap-2 cursor-pointer ${
              activeTab === 'pending'
                ? 'border-amber-800 text-amber-900'
                : 'border-transparent text-stone-500 hover:text-stone-800'
            }`}
          >
            <Clock className="w-4 h-4 text-amber-600" />
            <span>Pending Review</span>
            <span
              className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                activeTab === 'pending'
                  ? 'bg-amber-100 text-amber-900'
                  : 'bg-stone-100 text-stone-600'
              }`}
            >
              {categorizedData.pendingList.length}
            </span>
          </button>

          <button
            type="button"
            id="tab-past-reservations"
            onClick={() => setActiveTab('past')}
            className={`px-4 py-3 text-xs font-bold border-b-2 transition flex items-center gap-2 cursor-pointer ${
              activeTab === 'past'
                ? 'border-amber-800 text-amber-900'
                : 'border-transparent text-stone-500 hover:text-stone-800'
            }`}
          >
            <CalendarRange className="w-4 h-4 text-stone-400" />
            <span>Past / Inactive</span>
            <span
              className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                activeTab === 'past'
                  ? 'bg-amber-100 text-amber-900'
                  : 'bg-stone-100 text-stone-600'
              }`}
            >
              {categorizedData.pastList.length}
            </span>
          </button>
        </div>
      </div>

      {/* Cancellation Modal Confirmation Overlay */}
      {cancellingItem && (
        <div className="fixed inset-0 z-50 bg-stone-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 max-w-md w-full border border-stone-200 shadow-2xl space-y-4 animate-in fade-in zoom-in-95">
            <div className="flex items-center gap-3 text-red-900">
              <div className="w-10 h-10 rounded-2xl bg-red-100 flex items-center justify-center text-red-700 font-bold shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-sm text-stone-900">
                  {cancellingItem.mode === 'series'
                    ? 'Cancel Entire Recurring Series?'
                    : 'Cancel Reservation?'}
                </h3>
                <p className="text-xs text-stone-500">{cancellingItem.title}</p>
              </div>
            </div>

            {cancelError && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-900">
                {cancelError}
              </div>
            )}

            <p className="text-xs text-stone-600 leading-relaxed">
              {cancellingItem.mode === 'series'
                ? 'This will cancel all upcoming occurrences of this recurring series. This action cannot be undone.'
                : 'This time slot will immediately become available for other church services in the master calendar.'}
            </p>

            <div className="flex items-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => {
                  setCancellingItem(null);
                  setCancelError(null);
                }}
                className="flex-1 py-2.5 bg-stone-100 hover:bg-stone-200 text-stone-800 text-xs font-bold rounded-xl transition cursor-pointer"
              >
                Keep Booking
              </button>

              <button
                type="button"
                disabled={isCancelling}
                onClick={executeCancellation}
                className="flex-1 py-2.5 bg-red-600 hover:bg-red-700 text-white text-xs font-bold rounded-xl transition cursor-pointer shadow-xs"
              >
                {isCancelling ? 'Cancelling...' : 'Yes, Cancel'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Main List Rendering */}
      {loading ? (
        <div className="bg-white rounded-3xl p-12 text-center border border-stone-200 shadow-2xs space-y-3">
          <div className="w-8 h-8 border-3 border-amber-800 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-xs font-bold text-stone-600">Loading your reservations...</p>
        </div>
      ) : fetchError ? (
        <div className="bg-red-50 border border-red-200 rounded-3xl p-6 text-red-900 space-y-2">
          <div className="font-bold text-sm">Failed to Load Reservations</div>
          <p className="text-xs">{fetchError}</p>
          <button
            onClick={fetchMyReservations}
            className="px-4 py-2 bg-red-800 text-white rounded-xl text-xs font-bold"
          >
            Retry
          </button>
        </div>
      ) : currentList.length === 0 ? (
        <div className="bg-white rounded-3xl p-12 text-center border border-stone-200 shadow-2xs space-y-3">
          <div className="w-12 h-12 rounded-2xl bg-stone-100 text-stone-400 flex items-center justify-center mx-auto">
            <Calendar className="w-6 h-6" />
          </div>
          <div className="text-sm font-bold text-stone-800">
            No {activeTab} reservations found
          </div>
          <p className="text-xs text-stone-500 max-w-sm mx-auto">
            {activeTab === 'upcoming'
              ? 'You do not have any upcoming church instrument reservations scheduled.'
              : activeTab === 'pending'
              ? 'You do not have any reservations pending administrative review.'
              : 'No past reservation history.'}
          </p>
          {activeTab !== 'past' && (
            <div className="pt-2 flex items-center justify-center gap-2">
              <button
                type="button"
                onClick={onOpenNewReservation}
                className="px-4 py-2 bg-amber-800 hover:bg-amber-900 text-white text-xs font-bold rounded-xl transition cursor-pointer"
              >
                Create Reservation
              </button>
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {currentList.map((item, idx) => {
            if (item.type === 'single') {
              const res = item.data;
              const startUtc = new Date(res.start_time || res.startTime);
              const endUtc = new Date(res.end_time || res.endTime);
              const dateStr = startUtc.toISOString().split('T')[0];
              const timeStr = `${startUtc.toISOString().substring(11, 16)} – ${endUtc.toISOString().substring(11, 16)} UTC`;
              const isApproved = res.status === 'approved' || res.status === 'ongoing';
              const isPending = res.status === 'pending';
              const isPast = endUtc < new Date();
              const isCancelled = res.status === 'cancelled' || res.status === 'rejected';

              return (
                <div
                  key={res.id}
                  className="bg-white rounded-2xl border border-stone-200 shadow-2xs hover:shadow-xs transition p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                >
                  {/* Left: Instrument & Purpose (Tappable to Screen 6) */}
                  <div
                    onClick={() => onSelectReservationDetail(res.id)}
                    className="flex items-start gap-3.5 cursor-pointer flex-1 group"
                  >
                    <div className="w-10 h-10 rounded-2xl bg-amber-50 border border-amber-200 text-amber-900 flex items-center justify-center font-bold shrink-0 mt-0.5 group-hover:bg-amber-100 transition">
                      <Music2 className="w-5 h-5" />
                    </div>

                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-bold text-stone-900 text-sm group-hover:text-amber-900 transition">
                          {res.service_name || res.serviceName || 'Church Service'}
                        </span>

                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                            isApproved
                              ? 'bg-emerald-100 text-emerald-900 border border-emerald-200'
                              : isPending
                              ? 'bg-amber-100 text-amber-900 border border-amber-200'
                              : 'bg-stone-100 text-stone-600 border border-stone-200'
                          }`}
                        >
                          {isApproved ? (
                            <>
                              <CheckCircle2 className="w-3 h-3 text-emerald-700" />
                              Approved
                            </>
                          ) : isPending ? (
                            <>
                              <Clock className="w-3 h-3 text-amber-700" />
                              Pending Review
                            </>
                          ) : (
                            res.status
                          )}
                        </span>

                        {res.reservation_type === 'outside_church' && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-purple-100 text-purple-900 border border-purple-200">
                            <DollarSign className="w-3 h-3" />
                            Outside Use
                          </span>
                        )}
                      </div>

                      <div className="text-xs text-stone-600 flex flex-wrap items-center gap-3">
                        <span className="font-semibold text-stone-800">{res.instrument_name}</span>
                        <span>•</span>
                        <span className="text-stone-500 font-medium">
                          {dateStr} ({timeStr})
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Right: Actions (Edit, Cancel, Details) */}
                  <div className="flex items-center gap-2 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-stone-100">
                    {!isPast && !isCancelled && (
                      <>
                        <button
                          type="button"
                          onClick={() => onEditReservation(res)}
                          className="px-3 py-1.5 bg-stone-50 hover:bg-stone-100 text-stone-700 border border-stone-200 text-xs font-bold rounded-xl transition flex items-center gap-1.5 cursor-pointer"
                          title="Edit this reservation"
                        >
                          <Edit className="w-3.5 h-3.5 text-stone-500" />
                          <span>Edit</span>
                        </button>

                        <button
                          type="button"
                          onClick={() =>
                            setCancellingItem({
                              id: res.id,
                              mode: 'single',
                              title: `${res.instrument_name} on ${dateStr}`,
                            })
                          }
                          className="px-3 py-1.5 bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 text-xs font-bold rounded-xl transition flex items-center gap-1.5 cursor-pointer"
                          title="Cancel reservation"
                        >
                          <Trash2 className="w-3.5 h-3.5 text-red-500" />
                          <span>Cancel</span>
                        </button>
                      </>
                    )}

                    <button
                      type="button"
                      onClick={() => onSelectReservationDetail(res.id)}
                      className="px-3 py-1.5 bg-stone-900 hover:bg-stone-800 text-white text-xs font-bold rounded-xl transition cursor-pointer"
                    >
                      View Details
                    </button>
                  </div>
                </div>
              );
            } else {
              // ---------------------------------------------------------
              // RECURRING SERIES GROUPED CARD (Expandable)
              // ---------------------------------------------------------
              const sg: GroupedSeries = item.data;
              const isExpanded = Boolean(expandedSeries[sg.seriesId]);
              const approvedCount = sg.occurrences.filter((o) => o.status === 'approved').length;
              const pendingCount = sg.occurrences.filter((o) => o.status === 'pending').length;
              const firstOcc = sg.occurrences[0];

              return (
                <div
                  key={sg.seriesId}
                  className="bg-white rounded-3xl border border-amber-900/20 shadow-2xs hover:shadow-xs transition overflow-hidden"
                >
                  {/* Series Header Card */}
                  <div className="p-5 bg-linear-to-r from-amber-50/60 to-white flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div
                      onClick={() => toggleSeriesExpansion(sg.seriesId)}
                      className="flex items-start gap-3.5 cursor-pointer flex-1 select-none"
                    >
                      <div className="w-10 h-10 rounded-2xl bg-amber-800 text-white flex items-center justify-center font-bold shrink-0 mt-0.5 shadow-2xs">
                        <Repeat className="w-5 h-5" />
                      </div>

                      <div className="space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-bold text-stone-900 text-sm">
                            {sg.serviceName}
                          </span>

                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-950 border border-amber-300 uppercase tracking-wider">
                            <Layers className="w-3 h-3" />
                            {sg.occurrences.length} Sessions Series
                          </span>

                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-stone-100 text-stone-700 capitalize">
                            {sg.patternType} pattern
                          </span>
                        </div>

                        <div className="text-xs text-stone-600 flex flex-wrap items-center gap-3">
                          <span className="font-semibold text-stone-800">{sg.instrumentName}</span>
                          <span>•</span>
                          <span className="text-stone-500">
                            {approvedCount} Approved, {pendingCount} Pending Review
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Series Header Actions */}
                    <div className="flex items-center gap-2 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-stone-100">
                      {/* Cancel Entire Series */}
                      <button
                        type="button"
                        onClick={() =>
                          setCancellingItem({
                            id: firstOcc?.id,
                            mode: 'series',
                            title: `Entire Recurring Series: ${sg.serviceName} (${sg.occurrences.length} occurrences)`,
                          })
                        }
                        className="px-3 py-1.5 bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 text-xs font-bold rounded-xl transition flex items-center gap-1.5 cursor-pointer"
                        title="Cancel entire series"
                      >
                        <Trash2 className="w-3.5 h-3.5 text-red-500" />
                        <span>Cancel Entire Series</span>
                      </button>

                      {/* Expand / Collapse Button */}
                      <button
                        type="button"
                        onClick={() => toggleSeriesExpansion(sg.seriesId)}
                        className="px-3.5 py-1.5 bg-stone-900 hover:bg-stone-800 text-white text-xs font-bold rounded-xl transition flex items-center gap-1.5 cursor-pointer"
                      >
                        <span>{isExpanded ? 'Collapse' : 'View Occurrences'}</span>
                        {isExpanded ? (
                          <ChevronUp className="w-3.5 h-3.5" />
                        ) : (
                          <ChevronDown className="w-3.5 h-3.5" />
                        )}
                      </button>
                    </div>
                  </div>

                  {/* Expandable Individual Occurrences List */}
                  {isExpanded && (
                    <div className="border-t border-stone-200 bg-stone-50/50 p-4 space-y-2 animate-in fade-in duration-150">
                      <div className="text-[11px] font-bold text-stone-600 px-1 flex items-center justify-between">
                        <span>Individual Sessions in this Series:</span>
                        <span className="text-stone-400">
                          Tap any occurrence to open Screen 6 Detail
                        </span>
                      </div>

                      <div className="border border-stone-200 rounded-2xl overflow-hidden divide-y divide-stone-100 bg-white">
                        {sg.occurrences.map((occ, occIdx) => {
                          const occStart = new Date(occ.start_time || occ.startTime);
                          const occEnd = new Date(occ.end_time || occ.endTime);
                          const occDateStr = occStart.toISOString().split('T')[0];
                          const occTimeStr = `${occStart.toISOString().substring(11, 16)} – ${occEnd.toISOString().substring(11, 16)} UTC`;
                          const isOccApproved = occ.status === 'approved' || occ.status === 'ongoing';
                          const isOccPast = occEnd < new Date();
                          const isOccCancelled = occ.status === 'cancelled' || occ.status === 'rejected';

                          return (
                            <div
                              key={occ.id}
                              className="p-3 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2 hover:bg-stone-50/80 transition"
                            >
                              <div
                                onClick={() => onSelectReservationDetail(occ.id)}
                                className="flex items-center gap-3 cursor-pointer flex-1"
                              >
                                <span className="w-6 h-6 rounded-lg bg-stone-100 text-stone-700 font-bold flex items-center justify-center text-[10px]">
                                  {occIdx + 1}
                                </span>
                                <div>
                                  <div className="font-bold text-stone-900">{occDateStr}</div>
                                  <div className="text-[11px] text-stone-500">{occTimeStr}</div>
                                </div>
                              </div>

                              <div className="flex items-center gap-2">
                                <span
                                  className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                                    isOccApproved
                                      ? 'bg-emerald-100 text-emerald-900 border border-emerald-200'
                                      : occ.status === 'pending'
                                      ? 'bg-amber-100 text-amber-900 border border-amber-200'
                                      : 'bg-stone-100 text-stone-600'
                                  }`}
                                >
                                  {occ.status}
                                </span>

                                {!isOccPast && !isOccCancelled && (
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setCancellingItem({
                                        id: occ.id,
                                        mode: 'single',
                                        title: `Session #${occIdx + 1} on ${occDateStr}`,
                                      })
                                    }
                                    className="px-2.5 py-1 bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 text-[11px] font-bold rounded-lg transition cursor-pointer"
                                    title="Cancel this single occurrence"
                                  >
                                    Cancel Slot
                                  </button>
                                )}

                                <button
                                  type="button"
                                  onClick={() => onSelectReservationDetail(occ.id)}
                                  className="px-2.5 py-1 bg-stone-100 hover:bg-stone-200 text-stone-800 text-[11px] font-bold rounded-lg transition cursor-pointer"
                                >
                                  Details
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              );
            }
          })}
        </div>
      )}
    </div>
  );
};
