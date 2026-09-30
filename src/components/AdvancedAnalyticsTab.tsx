import React, { useState, useEffect, useMemo } from "react";
import { useTranslation } from "react-i18next";
import {
  BarChart3,
  TrendingUp,
  Flame,
  Clock,
  Sparkles,
  AlertTriangle,
  Music2,
  Users,
  DollarSign,
  Download,
  RefreshCw,
  Search,
  Filter,
  CheckCircle2,
  Calendar,
  Layers,
  ArrowUpRight,
  Info,
  ChevronRight,
  ShieldAlert,
  UserCheck,
} from "lucide-react";

interface SlotData {
  dayOfWeek: number;
  hour: number;
  bookingCount: number;
  totalHours: number;
  intensity: number;
  isPeakHour: boolean;
  peakLabel?: string;
  topInstruments: { name: string; count: number }[];
}

interface InstrumentDemandStat {
  id: string;
  name: string;
  type: string;
  photoUrl: string | null;
  isReservePool: boolean;
  outsideFeePerDay: string;
  bookingCount: number;
  totalHours: number;
  inChurchCount: number;
  outsideChurchCount: number;
  peakBookingsCount: number;
  rejectedRequestsCount: number;
  demandScore: number;
  demandTier:
    | "critical_bottleneck"
    | "high_demand"
    | "steady_usage"
    | "under_utilized"
    | "zero_usage";
  budgetPriority: "High" | "Medium" | "Low" | "Audit";
  budgetRecommendation: string;
}

interface UserAnalysisStat {
  userId: string;
  name: string;
  email: string;
  phoneNumber: string;
  isTrusted: boolean;
  totalBookings: number;
  approvedBookings: number;
  cancelledBookings: number;
  noShowCount: number;
  totalHours: number;
  favoriteInstrument: string;
  services: string[];
  reliabilityRate: number;
  engagementTier:
    | "Pillar Musician"
    | "Regular Musician"
    | "Occasional Member"
    | "Inactive";
}

interface AnalyticsData {
  timeframe: string;
  kpis: {
    totalInstrumentsCount: number;
    totalBookingsCount: number;
    totalHoursBooked: number;
    fleetUtilizationScore: number;
    activeMembersCount: number;
    underUtilizedCount: number;
    peakContentionWindows: {
      label: string;
      time: string;
      dayIndex: number;
    }[];
  };
  heatmap: {
    days: {
      index: number;
      nameEn: string;
      nameAr: string;
      isPeakDay: boolean;
    }[];
    hoursRange: { start: number; end: number };
    maxSlotCount: number;
    matrix: SlotData[][];
  };
  instrumentDemand: {
    allInstruments: InstrumentDemandStat[];
    topDemanded: InstrumentDemandStat[];
    underUtilized: InstrumentDemandStat[];
    budgetRecommendations: {
      instrumentId: string;
      instrumentName: string;
      instrumentType: string;
      priority: "High" | "Medium" | "Low" | "Audit";
      demandScore: number;
      peakHoursBooked: number;
      totalHours: number;
      recommendation: string;
    }[];
    categoryBreakdown: {
      category: string;
      bookingCount: number;
      totalHours: number;
      instrumentsCount: number;
      percentageOfTotal: number;
    }[];
  };
  userAnalysis: {
    users: UserAnalysisStat[];
    topMusicians: UserAnalysisStat[];
    topServices: {
      serviceName: string;
      bookingCount: number;
      totalHours: number;
    }[];
  };
}

interface AdvancedAnalyticsTabProps {
  sessionToken: string | null;
  onOpenUserProfile?: (userId: string) => void;
  allInstrumentsList?: { id: string; name: string }[];
}

export const AdvancedAnalyticsTab: React.FC<AdvancedAnalyticsTabProps> = ({
  sessionToken,
  onOpenUserProfile,
  allInstrumentsList = [],
}) => {
  const { t, i18n } = useTranslation();
  const isAr = i18n.language === "ar";

  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);

  // Filters
  const [timeframe, setTimeframe] = useState<string>("all");
  const [selectedInstrumentId, setSelectedInstrumentId] =
    useState<string>("all");
  const [heatmapMetric, setHeatmapMetric] = useState<"count" | "hours">(
    "count",
  );
  const [gearFilterTab, setGearFilterTab] = useState<
    "all" | "high_demand" | "under_utilized"
  >("high_demand");
  const [userSearchTerm, setUserSearchTerm] = useState<string>("");
  const [userTierFilter, setUserTierFilter] = useState<string>("all");

  // Selected cell for detailed popover
  const [selectedCell, setSelectedCell] = useState<{
    dayName: string;
    hour: number;
    slot: SlotData;
  } | null>(null);

  // Fetch analytics data
  const fetchAnalytics = async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (timeframe) params.append("timeframe", timeframe);
      if (selectedInstrumentId && selectedInstrumentId !== "all") {
        params.append("instrumentId", selectedInstrumentId);
      }

      const res = await fetch(`/api/admin/analytics?${params.toString()}`, {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${sessionToken || ""}`,
        },
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to load analytics");
      }

      setAnalytics(data.analytics);
    } catch (err: any) {
      console.error("Error fetching analytics:", err);
      setError(err.message || "Failed to load analytics");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAnalytics();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timeframe, selectedInstrumentId]);

  // Export Analytics Summary CSV
  const handleExportCSV = () => {
    if (!analytics) return;

    let csvContent = "data:text/csv;charset=utf-8,";

    // 1. KPI Summary
    csvContent += "=== CHURCH EQUIPMENT ANALYTICS SUMMARY ===\r\n";
    csvContent += `Generated,${new Date().toISOString()}\r\n`;
    csvContent += `Timeframe,${timeframe}\r\n`;
    csvContent += `Total Instruments,${analytics.kpis.totalInstrumentsCount}\r\n`;
    csvContent += `Total Bookings,${analytics.kpis.totalBookingsCount}\r\n`;
    csvContent += `Total Hours Booked,${analytics.kpis.totalHoursBooked}\r\n`;
    csvContent += `Active Musician Members,${analytics.kpis.activeMembersCount}\r\n`;
    csvContent += `Under-utilized Instruments,${analytics.kpis.underUtilizedCount}\r\n\r\n`;

    // 2. Budget Recommendations
    csvContent += "=== EQUIPMENT BUDGET & PROCUREMENT RECOMMENDATIONS ===\r\n";
    csvContent +=
      "Instrument,Type,Priority,Demand Score,Peak Hours Booked,Total Hours,Budget Recommendation\r\n";
    for (const item of analytics.instrumentDemand.budgetRecommendations) {
      csvContent += `"${item.instrumentName}","${item.instrumentType}","${item.priority}",${item.demandScore},${item.peakHoursBooked},${item.totalHours},"${item.recommendation.replace(/"/g, '""')}"\r\n`;
    }
    csvContent += "\r\n";

    // 3. All Instruments Utilization
    csvContent += "=== ALL INSTRUMENTS UTILIZATION ===\r\n";
    csvContent +=
      "Instrument,Category,Bookings Count,Total Hours,Peak Contention Bookings,Unmet Demand,Demand Tier,Action\r\n";
    for (const inst of analytics.instrumentDemand.allInstruments) {
      csvContent += `"${inst.name}","${inst.type}",${inst.bookingCount},${inst.totalHours},${inst.peakBookingsCount},${inst.rejectedRequestsCount},"${inst.demandTier}","${inst.budgetRecommendation.replace(/"/g, '""')}"\r\n`;
    }
    csvContent += "\r\n";

    // 4. User Analysis
    csvContent += "=== USER ACTIVITY & MINISTRY MUSICIANS ===\r\n";
    csvContent +=
      "Musician Name,Email,Phone,Trusted,Total Bookings,Approved,Cancelled,No Shows,Total Hours,Favorite Instrument,Reliability Rate %,Tier\r\n";
    for (const u of analytics.userAnalysis.users) {
      csvContent += `"${u.name}","${u.email}","${u.phoneNumber}",${u.isTrusted},${u.totalBookings},${u.approvedBookings},${u.cancelledBookings},${u.noShowCount},${u.totalHours},"${u.favoriteInstrument}",${u.reliabilityRate},"${u.engagementTier}"\r\n`;
    }

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute(
      "download",
      `church-instrument-analytics-${timeframe}-${new Date().toISOString().slice(0, 10)}.csv`,
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Filtered gear list
  const filteredGearList = useMemo(() => {
    if (!analytics) return [];
    if (gearFilterTab === "high_demand") {
      return analytics.instrumentDemand.allInstruments.filter(
        (i) =>
          i.demandTier === "critical_bottleneck" ||
          i.demandTier === "high_demand",
      );
    }
    if (gearFilterTab === "under_utilized") {
      return analytics.instrumentDemand.underUtilized;
    }
    return analytics.instrumentDemand.allInstruments;
  }, [analytics, gearFilterTab]);

  // Filtered users list
  const filteredUsersList = useMemo(() => {
    if (!analytics) return [];
    return analytics.userAnalysis.users.filter((u) => {
      const matchesSearch =
        !userSearchTerm ||
        u.name.toLowerCase().includes(userSearchTerm.toLowerCase()) ||
        u.email.toLowerCase().includes(userSearchTerm.toLowerCase()) ||
        u.phoneNumber.includes(userSearchTerm);

      const matchesTier =
        userTierFilter === "all" ||
        (userTierFilter === "pillar" && u.engagementTier === "Pillar Musician") ||
        (userTierFilter === "regular" &&
          u.engagementTier === "Regular Musician") ||
        (userTierFilter === "occasional" &&
          u.engagementTier === "Occasional Member");

      return matchesSearch && matchesTier;
    });
  }, [analytics, userSearchTerm, userTierFilter]);

  // Helper for 12-hour format
  const formatHour = (hour: number) => {
    const period = hour >= 12 ? (isAr ? "م" : "PM") : (isAr ? "ص" : "AM");
    const h = hour % 12 === 0 ? 12 : hour % 12;
    return `${h}:00 ${period}`;
  };

  // Intensity color mapper
  const getCellColor = (intensity: number, isPeakHour: boolean) => {
    if (intensity === 0) {
      return "bg-stone-50/80 hover:bg-stone-100 text-stone-300 border-stone-200/60";
    }
    if (intensity < 0.25) {
      return "bg-amber-50 hover:bg-amber-100 text-amber-900 border-amber-200/70";
    }
    if (intensity < 0.5) {
      return "bg-amber-200 hover:bg-amber-300 text-amber-950 font-bold border-amber-300";
    }
    if (intensity < 0.75) {
      return "bg-amber-600 hover:bg-amber-700 text-white font-bold border-amber-700 shadow-2xs";
    }
    return "bg-amber-800 hover:bg-amber-900 text-white font-extrabold border-amber-950 shadow-xs ring-1 ring-amber-900/30";
  };

  return (
    <div className="space-y-5">
      {/* Top Banner & Control Ribbon */}
      <div className="bg-white border border-stone-200 rounded-2xl p-4 sm:p-5 shadow-2xs">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-amber-700 to-amber-900 text-white flex items-center justify-center shrink-0 shadow-xs">
              <BarChart3 className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-base sm:text-lg font-extrabold text-stone-900">
                  {isAr
                    ? "التحليلات والرؤى المتقدمة للخدمة"
                    : "Advanced Analytics & Ministry Insights"}
                </h2>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-amber-100 text-amber-900 border border-amber-200 uppercase tracking-wider">
                  {isAr ? "الادمن العام" : "Super Admin"}
                </span>
              </div>
              <p className="text-xs text-stone-500 mt-0.5">
                {isAr
                  ? "خرائط حرارية لاستخدام الآلات، تحديد ساعات الذروة (أمسيات الجمعة وصباح الآحاد)، تخطيط ميزانية الشراء القادمة، وتحليل نشاط العازفين."
                  : "Equipment utilization heatmaps, peak church hours (e.g. Friday evenings & Sunday mornings), next gear budget planning, and active musician analytics."}
              </p>
            </div>
          </div>

          {/* Action buttons: Timeframe + Export + Refresh */}
          <div className="flex items-center gap-2 flex-wrap">
            {/* Timeframe selector */}
            <div className="flex items-center bg-stone-100 p-1 rounded-xl border border-stone-200">
              <button
                type="button"
                onClick={() => setTimeframe("all")}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition cursor-pointer whitespace-nowrap ${
                  timeframe === "all"
                    ? "bg-amber-800 text-white shadow-2xs"
                    : "text-stone-600 hover:text-stone-900"
                }`}
              >
                {isAr ? "كل الأوقات" : "All Time"}
              </button>
              <button
                type="button"
                onClick={() => setTimeframe("30d")}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition cursor-pointer whitespace-nowrap ${
                  timeframe === "30d"
                    ? "bg-amber-800 text-white shadow-2xs"
                    : "text-stone-600 hover:text-stone-900"
                }`}
              >
                {isAr ? "30 يوم" : "30 Days"}
              </button>
              <button
                type="button"
                onClick={() => setTimeframe("90d")}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition cursor-pointer whitespace-nowrap ${
                  timeframe === "90d"
                    ? "bg-amber-800 text-white shadow-2xs"
                    : "text-stone-600 hover:text-stone-900"
                }`}
              >
                {isAr ? "90 يوم" : "90 Days"}
              </button>
              <button
                type="button"
                onClick={() => setTimeframe("year")}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition cursor-pointer whitespace-nowrap ${
                  timeframe === "year"
                    ? "bg-amber-800 text-white shadow-2xs"
                    : "text-stone-600 hover:text-stone-900"
                }`}
              >
                {isAr ? "سنة" : "1 Year"}
              </button>
            </div>

            {/* Instrument Filter Dropdown */}
            <select
              value={selectedInstrumentId}
              onChange={(e) => setSelectedInstrumentId(e.target.value)}
              className="px-2.5 py-1.5 rounded-xl border border-stone-200 bg-stone-50 text-xs font-bold text-stone-800 focus:outline-none focus:border-amber-700 cursor-pointer"
            >
              <option value="all">
                {isAr ? "جميع الآلات والمعدات" : "All Equipment"}
              </option>
              {allInstrumentsList.map((inst) => (
                <option key={inst.id} value={inst.id}>
                  {inst.name}
                </option>
              ))}
            </select>

            {/* Export CSV button */}
            <button
              type="button"
              onClick={handleExportCSV}
              disabled={!analytics}
              className="px-3 py-1.5 rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-800 text-xs font-bold transition flex items-center gap-1.5 cursor-pointer border border-stone-200 disabled:opacity-50"
              title={
                isAr
                  ? "تصدير تقرير التحليلات وتوصيات الميزانية"
                  : "Export analytics & budget recommendations report"
              }
            >
              <Download className="w-3.5 h-3.5 text-stone-600" />
              <span className="hidden sm:inline">
                {isAr ? "تصدير التقرير" : "Export Report"}
              </span>
            </button>

            {/* Refresh button */}
            <button
              type="button"
              onClick={fetchAnalytics}
              disabled={loading}
              className="p-1.5 rounded-xl bg-stone-50 hover:bg-stone-100 text-stone-600 border border-stone-200 transition cursor-pointer disabled:opacity-50"
              title={isAr ? "تحديث التحليلات" : "Refresh Analytics"}
            >
              <RefreshCw
                className={`w-4 h-4 ${loading ? "animate-spin text-amber-700" : ""}`}
              />
            </button>
          </div>
        </div>
      </div>

      {loading && !analytics && (
        <div className="py-20 flex flex-col items-center justify-center gap-3 text-stone-500 bg-white border border-stone-200 rounded-2xl">
          <RefreshCw className="w-6 h-6 animate-spin text-amber-800" />
          <div className="text-sm font-bold text-stone-700">
            {isAr
              ? "جارٍ استخراج خرائط الاستخدام وتحليلات الخدمة..."
              : "Compiling equipment heatmaps and ministry analytics..."}
          </div>
          <p className="text-xs text-stone-400">
            {isAr
              ? "تحليل ساعات الذروة ومعدلات الطلب وميزانية الشراء"
              : "Aggregating peak hour contention, utilization scores, and procurement recommendations."}
          </p>
        </div>
      )}

      {error && !loading && (
        <div className="p-4 rounded-2xl bg-red-50 border border-red-200 text-red-900 text-xs flex items-center justify-between">
          <div className="flex items-center gap-2 font-medium">
            <AlertTriangle className="w-4 h-4 text-red-700 shrink-0" />
            <span>{error}</span>
          </div>
          <button
            type="button"
            onClick={fetchAnalytics}
            className="px-3 py-1 rounded-xl bg-red-100 hover:bg-red-200 font-bold transition cursor-pointer"
          >
            {isAr ? "إعادة المحاولة" : "Try Again"}
          </button>
        </div>
      )}

      {analytics && (
        <>
          {/* =============================================================
              1. EXECUTIVE KPIS RIBBON
             ============================================================= */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {/* Total Hours Booked */}
            <div className="p-4 rounded-2xl bg-white border border-stone-200 shadow-2xs flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-stone-500">
                  {isAr ? "إجمالي ساعات العزف" : "Total Ministry Hours"}
                </span>
                <div className="w-7 h-7 rounded-lg bg-amber-50 border border-amber-200 text-amber-800 flex items-center justify-center">
                  <Clock className="w-3.5 h-3.5" />
                </div>
              </div>
              <div className="mt-2">
                <div className="text-2xl font-extrabold text-stone-900 leading-none">
                  {analytics.kpis.totalHoursBooked}{" "}
                  <span className="text-xs font-normal text-stone-400">
                    {isAr ? "ساعة" : "hrs"}
                  </span>
                </div>
                <div className="text-[11px] text-stone-500 mt-1">
                  {analytics.kpis.totalBookingsCount}{" "}
                  {isAr ? "حجز معتمد ومكتمل" : "approved sessions logged"}
                </div>
              </div>
            </div>

            {/* Peak Contention Focus (Friday & Sunday) */}
            <div className="p-4 rounded-2xl bg-amber-50/70 border border-amber-200 shadow-2xs flex flex-col justify-between relative overflow-hidden">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-amber-950 flex items-center gap-1">
                  <Flame className="w-3.5 h-3.5 text-amber-700 fill-amber-700 animate-pulse" />
                  <span>{isAr ? "ساعات الذروة القصوى" : "Peak Church Hours"}</span>
                </span>
                <span className="px-2 py-0.5 rounded-md text-[10px] font-extrabold bg-amber-200/80 text-amber-900 uppercase">
                  {isAr ? "الجمعة والآحاد" : "Fri & Sun"}
                </span>
              </div>
              <div className="mt-2">
                <div className="text-xs font-bold text-amber-950">
                  {isAr
                    ? "صباح الأحد (8-1 ظ) & مساء الجمعة (5-9 م)"
                    : "Sun Morning (8a-1p) & Fri Eve (5p-9p)"}
                </div>
                <div className="text-[11px] text-amber-800 mt-1">
                  {isAr
                    ? "أعلى معدل تنافس على الآلات والخدمات"
                    : "Highest gear contention & overlapping requests"}
                </div>
              </div>
            </div>

            {/* Active Musicians */}
            <div className="p-4 rounded-2xl bg-white border border-stone-200 shadow-2xs flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-stone-500">
                  {isAr ? "العازفون النشطون" : "Active Musicians"}
                </span>
                <div className="w-7 h-7 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 flex items-center justify-center">
                  <Users className="w-3.5 h-3.5" />
                </div>
              </div>
              <div className="mt-2">
                <div className="text-2xl font-extrabold text-stone-900 leading-none">
                  {analytics.kpis.activeMembersCount}
                </div>
                <div className="text-[11px] text-stone-500 mt-1">
                  {isAr
                    ? "عازف مسجل يخدم في الصلوات والباند"
                    : "musicians serving across church services"}
                </div>
              </div>
            </div>

            {/* Under-utilized Instruments Alert */}
            <div className="p-4 rounded-2xl bg-white border border-stone-200 shadow-2xs flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-stone-500">
                  {isAr ? "آلات غير مستغلة كافياً" : "Under-Utilized Gear"}
                </span>
                <div
                  className={`w-7 h-7 rounded-lg flex items-center justify-center ${
                    analytics.kpis.underUtilizedCount > 0
                      ? "bg-amber-100 text-amber-900 border border-amber-200"
                      : "bg-stone-100 text-stone-600 border border-stone-200"
                  }`}
                >
                  <Music2 className="w-3.5 h-3.5" />
                </div>
              </div>
              <div className="mt-2">
                <div className="text-2xl font-extrabold text-stone-900 leading-none">
                  {analytics.kpis.underUtilizedCount}{" "}
                  <span className="text-xs font-normal text-stone-400">
                    / {analytics.kpis.totalInstrumentsCount}
                  </span>
                </div>
                <div className="text-[11px] text-stone-500 mt-1">
                  {isAr
                    ? "آلات بحاجة لإعادة توجيه أو تدريب"
                    : "candidates for training or youth hall"}
                </div>
              </div>
            </div>
          </div>

          {/* =============================================================
              2. EQUIPMENT UTILIZATION HEATMAPS (PEAK HOURS)
             ============================================================= */}
          <div className="bg-white border border-stone-200 rounded-2xl p-4 sm:p-5 shadow-2xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-stone-100 pb-3">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-extrabold text-stone-900 text-sm sm:text-base flex items-center gap-1.5">
                    <Layers className="w-4 h-4 text-amber-800" />
                    <span>
                      {isAr
                        ? "خريطة الكثافة واستخدام الآلات (أيام الأسبوع × الساعات)"
                        : "Equipment Utilization Heatmap (Day × Hour Matrix)"}
                    </span>
                  </h3>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-900 border border-amber-200">
                    {isAr ? "ساعات الذروة" : "Peak Hours Visual"}
                  </span>
                </div>
                <p className="text-xs text-stone-500 mt-0.5">
                  {isAr
                    ? "يوضح الرسم البياني أوقات الذروة الكنسية (خاصة أمسيات الجمعة وصباح الآحاد). انقر على أي خانة لعرض تفاصيل الآلات."
                    : "Visual matrix highlighting church peak hours (specifically Friday evenings and Sunday mornings). Click any cell to inspect booked gear."}
                </p>
              </div>

              {/* Toggle metric */}
              <div className="flex items-center bg-stone-100 p-1 rounded-xl border border-stone-200 self-start sm:self-auto shrink-0">
                <button
                  type="button"
                  onClick={() => setHeatmapMetric("count")}
                  className={`px-3 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
                    heatmapMetric === "count"
                      ? "bg-white text-stone-900 shadow-2xs"
                      : "text-stone-600 hover:text-stone-900"
                  }`}
                >
                  {isAr ? "عدد الحجوزات" : "Booking Count"}
                </button>
                <button
                  type="button"
                  onClick={() => setHeatmapMetric("hours")}
                  className={`px-3 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
                    heatmapMetric === "hours"
                      ? "bg-white text-stone-900 shadow-2xs"
                      : "text-stone-600 hover:text-stone-900"
                  }`}
                >
                  {isAr ? "ساعات العزف" : "Total Hours"}
                </button>
              </div>
            </div>

            {/* Peak Highlights Callout Banner */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5 p-3 rounded-xl bg-amber-50/60 border border-amber-200/80 text-xs">
              <div className="flex items-start gap-2">
                <div className="w-6 h-6 rounded-lg bg-amber-200 text-amber-900 flex items-center justify-center shrink-0 font-bold text-xs mt-0.5">
                  1
                </div>
                <div>
                  <div className="font-bold text-amber-950 flex items-center gap-1.5">
                    <span>
                      {isAr
                        ? "ذروة قداسات ومدارس الأحد (الأحد 08:00 - 13:00)"
                        : "Sunday Morning Liturgy & School Peak (08:00 – 13:00)"}
                    </span>
                    <span className="w-2 h-2 rounded-full bg-amber-600 animate-pulse" />
                  </div>
                  <p className="text-[11px] text-amber-900/80 mt-0.5">
                    {isAr
                      ? "أعلى طلب أسبوعي على البيانو والكي بورد وميكروفونات الشمامسة والكورال."
                      : "Highest weekly demand for Stage Pianos, Synthesizers, and Choir Mics."}
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-2">
                <div className="w-6 h-6 rounded-lg bg-amber-200 text-amber-900 flex items-center justify-center shrink-0 font-bold text-xs mt-0.5">
                  2
                </div>
                <div>
                  <div className="font-bold text-amber-950 flex items-center gap-1.5">
                    <span>
                      {isAr
                        ? "ذروة اجتماع الشباب والتسبيح (الجمعة 17:00 - 21:00)"
                        : "Friday Evening Youth & Praise Peak (17:00 – 21:00)"}
                    </span>
                    <span className="w-2 h-2 rounded-full bg-amber-600 animate-pulse" />
                  </div>
                  <p className="text-[11px] text-amber-900/80 mt-0.5">
                    {isAr
                      ? "كثافة عالية في استخدام درامز الباند، جيتارات البيس، ومكبرات الصوت الخارجية."
                      : "Intensive demand for Acoustic Drum Kits, Bass/Electric Guitars, and Band PA."}
                  </p>
                </div>
              </div>
            </div>

            {/* Heatmap Grid Component */}
            <div className="overflow-x-auto pb-2">
              <div className="min-w-[760px]">
                {/* Hours Header Row (07:00 to 22:00) */}
                <div className="grid grid-cols-[100px_repeat(16,1fr)] gap-1 text-[10px] font-bold text-stone-500 mb-1.5">
                  <div className="px-1 text-stone-400">
                    {isAr ? "اليوم / الساعة" : "Day / Hour"}
                  </div>
                  {Array.from({ length: 16 }, (_, i) => i + 7).map((h) => (
                    <div
                      key={h}
                      className={`text-center py-1 rounded ${
                        (h >= 8 && h <= 13) || (h >= 17 && h <= 21)
                          ? "bg-amber-100/60 font-extrabold text-amber-900"
                          : ""
                      }`}
                    >
                      {h % 12 === 0 ? 12 : h % 12}
                      <span className="text-[9px] font-normal text-stone-400 block -mt-0.5">
                        {h >= 12 ? (isAr ? "م" : "p") : isAr ? "ص" : "a"}
                      </span>
                    </div>
                  ))}
                </div>

                {/* Day Rows */}
                {analytics.heatmap.days.map((day) => {
                  const daySlots = analytics.heatmap.matrix[day.index] || [];
                  return (
                    <div
                      key={day.index}
                      className="grid grid-cols-[100px_repeat(16,1fr)] gap-1 mb-1 items-center"
                    >
                      {/* Day Label */}
                      <div className="flex items-center gap-1.5 px-2 py-2 rounded-lg bg-stone-50 border border-stone-200/80 text-xs font-bold text-stone-800">
                        {day.isPeakDay && (
                          <Flame className="w-3 h-3 text-amber-700 fill-amber-700 shrink-0" />
                        )}
                        <span className="truncate">
                          {isAr ? day.nameAr : day.nameEn}
                        </span>
                      </div>

                      {/* 16 Hour Cells (07:00 to 22:00) */}
                      {Array.from({ length: 16 }, (_, i) => i + 7).map((h) => {
                        const slot = daySlots[h] || {
                          dayOfWeek: day.index,
                          hour: h,
                          bookingCount: 0,
                          totalHours: 0,
                          intensity: 0,
                          isPeakHour: false,
                          topInstruments: [],
                        };

                        const displayValue =
                          heatmapMetric === "count"
                            ? slot.bookingCount
                            : slot.totalHours > 0
                              ? slot.totalHours
                              : 0;

                        // Is this one of the highlighted church peak slots?
                        const isSundayPeakSlot =
                          day.index === 0 && h >= 8 && h <= 13;
                        const isFridayPeakSlot =
                          day.index === 5 && h >= 17 && h <= 21;
                        const isSpecialChurchPeak =
                          isSundayPeakSlot || isFridayPeakSlot;

                        const isSelected =
                          selectedCell?.slot.dayOfWeek === day.index &&
                          selectedCell?.hour === h;

                        return (
                          <button
                            key={h}
                            type="button"
                            onClick={() =>
                              setSelectedCell({
                                dayName: isAr ? day.nameAr : day.nameEn,
                                hour: h,
                                slot,
                              })
                            }
                            className={`h-9 rounded-lg border text-center flex flex-col items-center justify-center transition-all cursor-pointer relative group ${getCellColor(
                              slot.intensity,
                              slot.isPeakHour,
                            )} ${
                              isSelected
                                ? "ring-2 ring-amber-600 scale-105 z-10"
                                : ""
                            } ${
                              isSpecialChurchPeak && slot.bookingCount === 0
                                ? "border-amber-300/60 bg-amber-50/40"
                                : ""
                            }`}
                            title={`${isAr ? day.nameAr : day.nameEn} ${formatHour(h)}: ${slot.bookingCount} bookings (${slot.totalHours} hrs)`}
                          >
                            <span className="text-[11px] leading-none">
                              {displayValue > 0 ? displayValue : "—"}
                            </span>

                            {/* Small dot indicator for special church peak window */}
                            {isSpecialChurchPeak && (
                              <span className="absolute top-0.5 right-0.5 w-1.5 h-1.5 rounded-full bg-amber-500" />
                            )}
                          </button>
                        );
                      })}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Heatmap Legend */}
            <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-stone-100 text-xs">
              <div className="flex items-center gap-2">
                <span className="text-stone-400 font-medium">
                  {isAr ? "كثافة الاستخدام:" : "Utilization Density:"}
                </span>
                <div className="flex items-center gap-1.5">
                  <div className="flex items-center gap-1">
                    <span className="w-3.5 h-3.5 rounded bg-stone-50 border border-stone-200 inline-block" />
                    <span className="text-[10px] text-stone-500">
                      {isAr ? "فارغ" : "Idle"}
                    </span>
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="w-3.5 h-3.5 rounded bg-amber-100 border border-amber-200 inline-block" />
                    <span className="text-[10px] text-stone-500">
                      {isAr ? "خفيف" : "Light"}
                    </span>
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="w-3.5 h-3.5 rounded bg-amber-300 border border-amber-400 inline-block" />
                    <span className="text-[10px] text-stone-500">
                      {isAr ? "متوسط" : "Moderate"}
                    </span>
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="w-3.5 h-3.5 rounded bg-amber-600 inline-block" />
                    <span className="text-[10px] text-stone-500">
                      {isAr ? "عالي" : "Heavy"}
                    </span>
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="w-3.5 h-3.5 rounded bg-amber-800 inline-block" />
                    <span className="text-[10px] text-stone-500">
                      {isAr ? "ذروة قصوى" : "Peak Contention"}
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-1.5 text-[11px] text-amber-900 bg-amber-50 px-2.5 py-1 rounded-lg border border-amber-200/80">
                <span className="w-2 h-2 rounded-full bg-amber-500" />
                <span>
                  {isAr
                    ? "النقاط المضيئة = نوافذ الذروة الكنسية المحددة"
                    : "Dot badge indicates Friday evening & Sunday morning peak windows"}
                </span>
              </div>
            </div>

            {/* Selected Cell Popover Details */}
            {selectedCell && (
              <div className="p-4 rounded-xl bg-stone-50 border border-stone-200 space-y-2 animate-in fade-in duration-150">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Clock className="w-4 h-4 text-amber-800" />
                    <span className="font-bold text-stone-900 text-xs sm:text-sm">
                      {selectedCell.dayName} · {formatHour(selectedCell.hour)} –{" "}
                      {formatHour(selectedCell.hour + 1)}
                    </span>
                    {selectedCell.slot.peakLabel && (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-amber-100 text-amber-900 border border-amber-200">
                        {selectedCell.slot.peakLabel}
                      </span>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => setSelectedCell(null)}
                    className="text-stone-400 hover:text-stone-600 text-xs cursor-pointer"
                  >
                    {isAr ? "إغلاق" : "Close"}
                  </button>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 text-xs">
                  <div className="p-2.5 rounded-lg bg-white border border-stone-200">
                    <div className="text-[10px] text-stone-500 font-bold uppercase">
                      {isAr ? "الحجوزات المتزامنة" : "Overlapping Bookings"}
                    </div>
                    <div className="text-base font-extrabold text-stone-900 mt-0.5">
                      {selectedCell.slot.bookingCount}
                    </div>
                  </div>
                  <div className="p-2.5 rounded-lg bg-white border border-stone-200">
                    <div className="text-[10px] text-stone-500 font-bold uppercase">
                      {isAr ? "إجمالي الساعات" : "Logged Hours"}
                    </div>
                    <div className="text-base font-extrabold text-amber-900 mt-0.5">
                      {selectedCell.slot.totalHours} hrs
                    </div>
                  </div>
                  <div className="p-2.5 rounded-lg bg-white border border-stone-200 col-span-2">
                    <div className="text-[10px] text-stone-500 font-bold uppercase">
                      {isAr ? "أبرز الآلات المستخدمة" : "Top Instruments In This Window"}
                    </div>
                    <div className="text-xs font-semibold text-stone-800 mt-0.5">
                      {selectedCell.slot.topInstruments.length > 0
                        ? selectedCell.slot.topInstruments
                            .map((i) => `${i.name} (${i.count})`)
                            .join(" · ")
                        : isAr
                          ? "لا توجد آلات محجوزة في هذه الساعة"
                          : "No equipment reserved in this slot"}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* =============================================================
              3. GEAR DEMAND & PROCUREMENT BUDGET PLANNING ("WHAT TO BUDGET FOR NEXT")
             ============================================================= */}
          <div className="bg-white border border-stone-200 rounded-2xl p-4 sm:p-5 shadow-2xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-stone-100 pb-3">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-extrabold text-stone-900 text-sm sm:text-base flex items-center gap-1.5">
                    <DollarSign className="w-4 h-4 text-emerald-700" />
                    <span>
                      {isAr
                        ? "تحليل الطلب وتوصيات ميزانية شراء الآلات القادمة"
                        : "Gear Demand & Next Budget Recommendations"}
                    </span>
                  </h3>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-100 text-emerald-900 border border-emerald-200">
                    {isAr ? "أولويات الشراء" : "Procurement Priority"}
                  </span>
                </div>
                <p className="text-xs text-stone-500 mt-0.5">
                  {isAr
                    ? "يحدد الآلات ذات أعلى معدل طلب وتنافس لمساعدة لجنة الكنيسة في تخصيص الميزانية القادمة للآلات الأكثر احتياجاً."
                    : "Identifies which gear is in highest demand so church leadership knows exactly what equipment to budget for next."}
                </p>
              </div>

              {/* Sub-filter tabs */}
              <div className="flex items-center bg-stone-100 p-1 rounded-xl border border-stone-200 self-start sm:self-auto shrink-0">
                <button
                  type="button"
                  onClick={() => setGearFilterTab("high_demand")}
                  className={`px-3 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
                    gearFilterTab === "high_demand"
                      ? "bg-amber-800 text-white shadow-2xs"
                      : "text-stone-600 hover:text-stone-900"
                  }`}
                >
                  {isAr ? "🔥 الأعلى طلباً (ميزانية)" : "🔥 Highest Demand"}
                </button>
                <button
                  type="button"
                  onClick={() => setGearFilterTab("under_utilized")}
                  className={`px-3 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
                    gearFilterTab === "under_utilized"
                      ? "bg-amber-800 text-white shadow-2xs"
                      : "text-stone-600 hover:text-stone-900"
                  }`}
                >
                  {isAr ? "⚠️ غير مستغلة كافياً" : "⚠️ Under-Utilized"}
                </button>
                <button
                  type="button"
                  onClick={() => setGearFilterTab("all")}
                  className={`px-3 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
                    gearFilterTab === "all"
                      ? "bg-amber-800 text-white shadow-2xs"
                      : "text-stone-600 hover:text-stone-900"
                  }`}
                >
                  {isAr ? "كل المعدات" : "All Equipment"}
                </button>
              </div>
            </div>

            {/* Top Budget Action Highlight Cards */}
            {analytics.instrumentDemand.budgetRecommendations.length > 0 &&
              gearFilterTab !== "under_utilized" && (
                <div className="space-y-3">
                  <div className="text-xs font-extrabold uppercase tracking-wider text-amber-950 flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-amber-700" />
                    <span>
                      {isAr
                        ? "أولويات الميزانية المقترحة للشراء القادم"
                        : "Key Equipment Procurement Recommendations"}
                    </span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {analytics.instrumentDemand.budgetRecommendations
                      .slice(0, 4)
                      .map((rec, idx) => (
                        <div
                          key={rec.instrumentId}
                          className="p-3.5 rounded-xl border border-amber-200/90 bg-amber-50/50 hover:bg-amber-50 transition space-y-2"
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <span className="w-5 h-5 rounded-full bg-amber-800 text-white text-[10px] font-extrabold flex items-center justify-center shrink-0">
                                {idx + 1}
                              </span>
                              <span className="font-extrabold text-stone-900 text-xs">
                                {rec.instrumentName}
                              </span>
                              <span className="text-[10px] text-stone-400">
                                ({rec.instrumentType})
                              </span>
                            </div>
                            <span
                              className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider ${
                                rec.priority === "High"
                                  ? "bg-red-100 text-red-900 border border-red-200"
                                  : "bg-amber-200 text-amber-950 border border-amber-300"
                              }`}
                            >
                              {rec.priority === "High"
                                ? isAr
                                  ? "أولوية ميزانية عاجلة"
                                  : "High Budget Priority"
                                : isAr
                                  ? "أولوية ميزانية متوسطة"
                                  : "Medium Priority"}
                            </span>
                          </div>

                          <p className="text-xs text-stone-700 leading-relaxed font-medium">
                            {rec.recommendation}
                          </p>

                          <div className="flex items-center gap-3 pt-1 text-[11px] text-stone-500 border-t border-amber-200/60">
                            <div>
                              <span className="font-bold text-amber-950">
                                {rec.demandScore}/100
                              </span>{" "}
                              {isAr ? "درجة الطلب" : "demand score"}
                            </div>
                            <div>
                              <span className="font-bold text-amber-950">
                                {rec.peakHoursBooked}
                              </span>{" "}
                              {isAr ? "جلسة ذروة" : "peak sessions"}
                            </div>
                            <div>
                              <span className="font-bold text-amber-950">
                                {rec.totalHours}
                              </span>{" "}
                              {isAr ? "ساعة" : "hrs logged"}
                            </div>
                          </div>
                        </div>
                      ))}
                  </div>
                </div>
              )}

            {/* Detailed Gear Table */}
            <div className="overflow-x-auto border border-stone-200 rounded-xl">
              <table className="w-full text-left text-xs">
                <thead className="bg-stone-50 border-b border-stone-200 text-[10px] font-extrabold uppercase text-stone-500 tracking-wider">
                  <tr>
                    <th className="py-2.5 px-3">
                      {isAr ? "الآلة والمواصفات" : "Instrument & Specs"}
                    </th>
                    <th className="py-2.5 px-3 text-center">
                      {isAr ? "مؤشر الطلب" : "Demand Score"}
                    </th>
                    <th className="py-2.5 px-3 text-center">
                      {isAr ? "الحجوزات والساعات" : "Bookings & Hours"}
                    </th>
                    <th className="py-2.5 px-3 text-center">
                      {isAr ? "تنافس الذروة (جمعة/أحد)" : "Peak Contention"}
                    </th>
                    <th className="py-2.5 px-3">
                      {isAr ? "توصية الميزانية والإجراء" : "Budget Action & Advice"}
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100">
                  {filteredGearList.map((inst) => (
                    <tr
                      key={inst.id}
                      className="hover:bg-stone-50/70 transition"
                    >
                      {/* Name & Photo */}
                      <td className="py-3 px-3">
                        <div className="flex items-center gap-2.5">
                          {inst.photoUrl ? (
                            <img
                              src={inst.photoUrl}
                              alt={inst.name}
                              referrerPolicy="no-referrer"
                              className="w-9 h-9 rounded-lg object-cover border border-stone-200 shrink-0"
                            />
                          ) : (
                            <div className="w-9 h-9 rounded-lg bg-stone-100 border border-stone-200 flex items-center justify-center shrink-0 text-stone-500">
                              <Music2 className="w-4 h-4" />
                            </div>
                          )}
                          <div className="min-w-0">
                            <div className="font-bold text-stone-900 truncate">
                              {inst.name}
                            </div>
                            <div className="text-[11px] text-stone-400 flex items-center gap-1.5 mt-0.5">
                              <span>{inst.type}</span>
                              {inst.isReservePool && (
                                <span className="px-1.5 py-0.2 rounded text-[9px] font-extrabold bg-stone-200 text-stone-700">
                                  {isAr ? "خزينة الاحتياط" : "Reserve Vault"}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Demand Score Bar */}
                      <td className="py-3 px-3 text-center">
                        <div className="inline-flex flex-col items-center">
                          <span className="font-extrabold text-stone-900 text-xs">
                            {inst.demandScore}%
                          </span>
                          <div className="w-16 h-1.5 rounded-full bg-stone-200 overflow-hidden mt-1">
                            <div
                              className={`h-full rounded-full ${
                                inst.demandScore >= 60
                                  ? "bg-red-600"
                                  : inst.demandScore >= 35
                                    ? "bg-amber-600"
                                    : "bg-stone-400"
                              }`}
                              style={{ width: `${inst.demandScore}%` }}
                            />
                          </div>
                        </div>
                      </td>

                      {/* Bookings & Hours */}
                      <td className="py-3 px-3 text-center">
                        <div className="font-bold text-stone-900">
                          {inst.bookingCount} {isAr ? "حجز" : "bookings"}
                        </div>
                        <div className="text-[11px] text-stone-500 mt-0.5">
                          {inst.totalHours} {isAr ? "ساعة" : "hrs"}
                        </div>
                      </td>

                      {/* Peak Contention */}
                      <td className="py-3 px-3 text-center">
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-extrabold ${
                            inst.peakBookingsCount >= 4
                              ? "bg-red-100 text-red-900 border border-red-200"
                              : inst.peakBookingsCount >= 1
                                ? "bg-amber-100 text-amber-900 border border-amber-200"
                                : "bg-stone-100 text-stone-500 border border-stone-200"
                          }`}
                        >
                          {inst.peakBookingsCount > 0 && (
                            <Flame className="w-3 h-3 text-amber-700" />
                          )}
                          <span>
                            {inst.peakBookingsCount}{" "}
                            {isAr ? "في الذروة" : "peak"}
                          </span>
                        </span>
                      </td>

                      {/* Budget Action & Recommendation */}
                      <td className="py-3 px-3 max-w-xs">
                        <div className="text-[11px] text-stone-700 leading-normal line-clamp-2">
                          {inst.budgetRecommendation}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* =============================================================
              4. USER ACTIVITY & MINISTRY MUSICIANS ANALYSIS
             ============================================================= */}
          <div className="bg-white border border-stone-200 rounded-2xl p-4 sm:p-5 shadow-2xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-stone-100 pb-3">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-extrabold text-stone-900 text-sm sm:text-base flex items-center gap-1.5">
                    <Users className="w-4 h-4 text-amber-800" />
                    <span>
                      {isAr
                        ? "تحليل نشاط العازفين والمستخدمين"
                        : "User Activity & Ministry Musician Analytics"}
                    </span>
                  </h3>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-amber-100 text-amber-900 border border-amber-200">
                    {analytics.userAnalysis.users.length}{" "}
                    {isAr ? "عضو مسجل" : "Registered"}
                  </span>
                </div>
                <p className="text-xs text-stone-500 mt-0.5">
                  {isAr
                    ? "تحليل تفصيلي لأكثر العازفين استخداماً للآلات، توزيع الخدمات الكنسية، ونسب الالتزام والاعتمادية."
                    : "Breakdown of church musicians, most booked instruments, attended services, and reliability rates."}
                </p>
              </div>

              {/* User search & filter */}
              <div className="flex items-center gap-2 flex-wrap">
                <div className="relative">
                  <Search className="w-3.5 h-3.5 text-stone-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={userSearchTerm}
                    onChange={(e) => setUserSearchTerm(e.target.value)}
                    placeholder={
                      isAr ? "بحث بالاسم أو الهاتف..." : "Search musician..."
                    }
                    className="pl-8 pr-3 py-1.5 rounded-xl border border-stone-200 bg-stone-50 text-xs text-stone-800 focus:outline-none focus:border-amber-700 w-44"
                  />
                </div>

                <select
                  value={userTierFilter}
                  onChange={(e) => setUserTierFilter(e.target.value)}
                  className="px-2.5 py-1.5 rounded-xl border border-stone-200 bg-stone-50 text-xs font-bold text-stone-800 focus:outline-none focus:border-amber-700 cursor-pointer"
                >
                  <option value="all">
                    {isAr ? "كل المستويات" : "All Tiers"}
                  </option>
                  <option value="pillar">
                    {isAr ? "عازف ركيزة (Pillar)" : "Pillar Musicians"}
                  </option>
                  <option value="regular">
                    {isAr ? "عازف منتظم (Regular)" : "Regular Musician"}
                  </option>
                  <option value="occasional">
                    {isAr ? "عازف مناسبات (Occasional)" : "Occasional"}
                  </option>
                </select>
              </div>
            </div>

            {/* Top Musician Leaderboard Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {analytics.userAnalysis.topMusicians.slice(0, 4).map((musician, idx) => (
                <div
                  key={musician.userId || idx}
                  className="p-3.5 rounded-xl border border-stone-200 bg-stone-50/50 hover:bg-stone-50 transition space-y-2 flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-center justify-between">
                      <span className="w-5 h-5 rounded-full bg-stone-200 text-stone-800 text-[10px] font-extrabold flex items-center justify-center shrink-0">
                        #{idx + 1}
                      </span>
                      {musician.isTrusted && (
                        <span className="px-2 py-0.5 rounded-full text-[9px] font-extrabold bg-amber-100 text-amber-900 border border-amber-200 flex items-center gap-1">
                          <UserCheck className="w-3 h-3 text-amber-700" />
                          <span>{isAr ? "موثوق" : "Trusted"}</span>
                        </span>
                      )}
                    </div>
                    <div className="font-extrabold text-stone-900 text-xs mt-1.5 truncate">
                      {musician.name}
                    </div>
                    <div className="text-[11px] text-stone-500 truncate">
                      {musician.email}
                    </div>
                  </div>

                  <div className="pt-2 border-t border-stone-200/60 space-y-1 text-[11px]">
                    <div className="flex justify-between items-center text-stone-600">
                      <span>{isAr ? "الآلة المفضلة:" : "Top Gear:"}</span>
                      <span className="font-bold text-amber-950 truncate max-w-[110px]">
                        {musician.favoriteInstrument}
                      </span>
                    </div>
                    <div className="flex justify-between items-center text-stone-600">
                      <span>{isAr ? "الحجوزات والساعات:" : "Stats:"}</span>
                      <span className="font-bold text-stone-900">
                        {musician.approvedBookings} ({musician.totalHours} hrs)
                      </span>
                    </div>
                  </div>

                  {onOpenUserProfile && musician.userId && (
                    <button
                      type="button"
                      onClick={() => onOpenUserProfile(musician.userId)}
                      className="w-full mt-1 py-1 rounded-lg bg-white border border-stone-200 hover:bg-stone-100 text-[10px] font-bold text-stone-700 transition cursor-pointer flex items-center justify-center gap-1"
                    >
                      <span>{isAr ? "عرض الملف" : "View Profile"}</span>
                      <ChevronRight className="w-3 h-3" />
                    </button>
                  )}
                </div>
              ))}
            </div>

            {/* Detailed User Table */}
            <div className="overflow-x-auto border border-stone-200 rounded-xl">
              <table className="w-full text-left text-xs">
                <thead className="bg-stone-50 border-b border-stone-200 text-[10px] font-extrabold uppercase text-stone-500 tracking-wider">
                  <tr>
                    <th className="py-2.5 px-3">
                      {isAr ? "اسم العازف / العضو" : "Musician / Member"}
                    </th>
                    <th className="py-2.5 px-3 text-center">
                      {isAr ? "المستوى الكنسي" : "Ministry Tier"}
                    </th>
                    <th className="py-2.5 px-3 text-center">
                      {isAr ? "الحجوزات والساعات" : "Bookings & Hours"}
                    </th>
                    <th className="py-2.5 px-3">
                      {isAr ? "الآلة المفضلة" : "Favorite Instrument"}
                    </th>
                    <th className="py-2.5 px-3">
                      {isAr ? "الخدمات المشارك بها" : "Services Served"}
                    </th>
                    <th className="py-2.5 px-3 text-center">
                      {isAr ? "نسبة الالتزام" : "Reliability"}
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100">
                  {filteredUsersList.map((u, i) => (
                    <tr key={u.userId || i} className="hover:bg-stone-50/70 transition">
                      {/* Name & Phone */}
                      <td className="py-2.5 px-3">
                        <div className="font-bold text-stone-900 flex items-center gap-1.5">
                          <span>{u.name}</span>
                          {u.isTrusted && (
                            <UserCheck className="w-3.5 h-3.5 text-amber-700" />
                          )}
                        </div>
                        <div className="text-[11px] text-stone-400">
                          {u.phoneNumber || u.email}
                        </div>
                      </td>

                      {/* Tier badge */}
                      <td className="py-2.5 px-3 text-center">
                        <span
                          className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-extrabold ${
                            u.engagementTier === "Pillar Musician"
                              ? "bg-amber-100 text-amber-900 border border-amber-200"
                              : u.engagementTier === "Regular Musician"
                                ? "bg-emerald-50 text-emerald-800 border border-emerald-200"
                                : "bg-stone-100 text-stone-600 border border-stone-200"
                          }`}
                        >
                          {u.engagementTier}
                        </span>
                      </td>

                      {/* Bookings & Hours */}
                      <td className="py-2.5 px-3 text-center">
                        <div className="font-bold text-stone-900">
                          {u.approvedBookings} {isAr ? "حجز" : "bookings"}
                        </div>
                        <div className="text-[10px] text-stone-500">
                          {u.totalHours} hrs logged
                        </div>
                      </td>

                      {/* Favorite Instrument */}
                      <td className="py-2.5 px-3 font-semibold text-stone-800">
                        {u.favoriteInstrument}
                      </td>

                      {/* Services */}
                      <td className="py-2.5 px-3">
                        <div className="flex flex-wrap gap-1 max-w-xs">
                          {u.services.length > 0 ? (
                            u.services.map((srv, idx) => (
                              <span
                                key={idx}
                                className="px-1.5 py-0.5 rounded bg-stone-100 text-stone-600 text-[10px] font-medium"
                              >
                                {srv}
                              </span>
                            ))
                          ) : (
                            <span className="text-stone-400 text-[11px]">
                              {isAr ? "خدمة عامة" : "General Service"}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Reliability */}
                      <td className="py-2.5 px-3 text-center">
                        <div className="font-extrabold text-stone-900 text-xs">
                          {u.reliabilityRate}%
                        </div>
                        {u.noShowCount > 0 && (
                          <div className="text-[10px] text-red-600 font-bold">
                            {u.noShowCount} {isAr ? "غياب" : "no-show"}
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* =============================================================
              5. TOP INSTRUMENTS & CATEGORY BREAKDOWN
             ============================================================= */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Category Breakdown Card */}
            <div className="bg-white border border-stone-200 rounded-2xl p-4 sm:p-5 shadow-2xs space-y-3">
              <div className="flex items-center justify-between border-b border-stone-100 pb-2.5">
                <h4 className="font-extrabold text-stone-900 text-xs sm:text-sm flex items-center gap-1.5">
                  <Layers className="w-4 h-4 text-amber-800" />
                  <span>
                    {isAr
                      ? "توزيع الاستخدام حسب فئة الآلة"
                      : "Fleet Usage by Category"}
                  </span>
                </h4>
                <span className="text-[11px] text-stone-400">
                  {analytics.instrumentDemand.categoryBreakdown.length}{" "}
                  {isAr ? "فئات" : "Categories"}
                </span>
              </div>

              <div className="space-y-3 pt-1">
                {analytics.instrumentDemand.categoryBreakdown.map((cat) => (
                  <div key={cat.category} className="space-y-1">
                    <div className="flex justify-between items-center text-xs">
                      <span className="font-bold text-stone-800">
                        {cat.category}
                      </span>
                      <span className="text-stone-500 font-semibold">
                        {cat.bookingCount} {isAr ? "حجز" : "bookings"} ·{" "}
                        {cat.totalHours} hrs ({cat.percentageOfTotal}%)
                      </span>
                    </div>
                    <div className="w-full h-2 rounded-full bg-stone-100 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-amber-600 to-amber-800"
                        style={{ width: `${Math.min(100, cat.percentageOfTotal)}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Top Church Services Card */}
            <div className="bg-white border border-stone-200 rounded-2xl p-4 sm:p-5 shadow-2xs space-y-3">
              <div className="flex items-center justify-between border-b border-stone-100 pb-2.5">
                <h4 className="font-extrabold text-stone-900 text-xs sm:text-sm flex items-center gap-1.5">
                  <TrendingUp className="w-4 h-4 text-amber-800" />
                  <span>
                    {isAr
                      ? "أكثر الخدمات الكنسية استهلاكاً للمعدات"
                      : "Top Church Services by Gear Demand"}
                  </span>
                </h4>
                <span className="text-[11px] text-stone-400">
                  {isAr ? "ترتيب الكثافة" : "Ranked"}
                </span>
              </div>

              <div className="space-y-2.5 pt-1">
                {analytics.userAnalysis.topServices.length > 0 ? (
                  analytics.userAnalysis.topServices.map((srv, idx) => (
                    <div
                      key={srv.serviceName}
                      className="p-2.5 rounded-xl bg-stone-50 border border-stone-200/80 flex items-center justify-between gap-3 text-xs"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="w-5 h-5 rounded-full bg-amber-100 text-amber-900 text-[10px] font-extrabold flex items-center justify-center shrink-0">
                          {idx + 1}
                        </span>
                        <span className="font-bold text-stone-900 truncate">
                          {srv.serviceName}
                        </span>
                      </div>
                      <div className="text-right shrink-0">
                        <span className="font-extrabold text-amber-950">
                          {srv.bookingCount}
                        </span>{" "}
                        <span className="text-[10px] text-stone-500">
                          {isAr ? "حجز" : "sessions"} ({srv.totalHours} hrs)
                        </span>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="py-6 text-center text-stone-400 text-xs">
                    {isAr
                      ? "لا توجد خدمات كنسية مسجلة بعد"
                      : "No services recorded yet."}
                  </div>
                )}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
};
