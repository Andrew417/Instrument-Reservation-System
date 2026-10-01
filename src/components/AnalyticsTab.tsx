import React, { useState, useEffect, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { useAuth } from "../contexts/AuthContext";
import { getCairoDateString, addDaysToDateString } from "../lib/date-utils";
import {
  CalendarCheck,
  Clock,
  Users,
  Church,
  RefreshCw,
  AlertCircle,
  Calendar,
  Layers,
  ArrowRight,
  TrendingUp,
  BarChart2,
  PieChart as PieIcon,
  Flame,
  Award,
} from "lucide-react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  CartesianGrid,
  Area,
} from "recharts";

interface AnalyticsSummary {
  totalReservations: number;
  totalHours: number;
  uniqueUsers: number;
  inChurchCount: number;
  outsideChurchCount: number;
}

interface InstrumentUsage {
  name: string;
  type: string;
  reservationCount: number;
  totalHours: number;
}

interface TypeUsage {
  type: string;
  reservationCount: number;
  totalHours: number;
}

interface WeekdayUsage {
  dayIndex: number;
  dayName: string;
  dayKey: string;
  count: number;
}

interface HourlyUsage {
  hour: number;
  hourLabel: string;
  count: number;
}

interface HeatmapCell {
  weekday: number;
  dayName: string;
  dayKey: string;
  hour: number;
  hourLabel: string;
  count: number;
}

interface DailyTrendItem {
  date: string;
  count: number;
  totalHours: number;
}

interface TopUserItem {
  name: string;
  reservationCount: number;
  totalHours: number;
  noShowCount: number;
}

interface AnalyticsData {
  dateRange: {
    from: string;
    to: string;
  };
  summary: AnalyticsSummary;
  instrumentsByUsage: InstrumentUsage[];
  typesByUsage: TypeUsage[];
  reservationsByWeekday: WeekdayUsage[];
  reservationsByHour: HourlyUsage[];
  weekdayHourHeatmap: HeatmapCell[];
  dailyTrend: DailyTrendItem[];
  topUsers: TopUserItem[];
}

const TYPE_PALETTE = [
  "#d97706", // amber-600
  "#3d84bc", // brand-600
  "#059669", // emerald-600
  "#96277f", // purple-600
  "#e11d48", // rose-600
  "#0284c7", // sky-600
  "#7c3aed", // violet-600
  "#475569", // slate-600
];

export const AnalyticsTab: React.FC = () => {
  const { t, i18n } = useTranslation();
  const { sessionToken } = useAuth();
  const isRTL = i18n.language === "ar";

  // Pre-set date options: 7, 30, 90 days, or custom
  const [rangePreset, setRangePreset] = useState<"7" | "30" | "90" | "custom">(
    "30",
  );
  const todayStr = getCairoDateString();
  const [customFrom, setCustomFrom] = useState<string>(
    addDaysToDateString(todayStr, -30),
  );
  const [customTo, setCustomTo] = useState<string>(todayStr);

  const [dateRange, setDateRange] = useState<{ from: string; to: string }>({
    from: addDaysToDateString(todayStr, -30),
    to: todayStr,
  });

  const [instrumentMetric, setInstrumentMetric] = useState<"count" | "hours">(
    "count",
  );

  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<AnalyticsData | null>(null);

  // Fetch analytics from backend
  const fetchAnalytics = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/admin/analytics?from=${dateRange.from}&to=${dateRange.to}`,
        {
          headers: {
            Authorization: `Bearer ${sessionToken || ""}`,
          },
          cache: "no-store",
        },
      );
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || t("analytics.error"));
      }
      setData(json.data);
    } catch (err: any) {
      setError(err.message || t("analytics.error"));
    } finally {
      setLoading(false);
    }
  }, [dateRange.from, dateRange.to, sessionToken, t]);

  useEffect(() => {
    fetchAnalytics();
  }, [fetchAnalytics]);

  // Handle Preset Changes
  const handlePresetChange = (preset: "7" | "30" | "90" | "custom") => {
    setRangePreset(preset);
    if (preset !== "custom") {
      const days = Number(preset);
      const from = addDaysToDateString(todayStr, -days);
      const to = todayStr;
      setCustomFrom(from);
      setCustomTo(to);
      setDateRange({ from, to });
    }
  };

  const handleApplyCustom = (e: React.FormEvent) => {
    e.preventDefault();
    if (customFrom > customTo) {
      setError(t("analytics.dateRange.invalidRange"));
      return;
    }
    setError(null);
    setDateRange({ from: customFrom, to: customTo });
  };

  // Translate weekday names for charts
  const getTranslatedDayName = (dayKey: string) => {
    return t(`analytics.weekday.${dayKey}`);
  };

  // Calculate heatmap color intensity
  const maxHeatmapCount =
    data?.weekdayHourHeatmap.reduce((max, c) => Math.max(max, c.count), 0) || 1;

  const getHeatmapColor = (count: number) => {
    if (count === 0) return "bg-stone-100/80 text-stone-400 border-stone-200/50";
    const intensity = count / maxHeatmapCount;
    if (intensity < 0.25)
      return "bg-amber-100 text-amber-900 border-amber-200 font-semibold";
    if (intensity < 0.5)
      return "bg-amber-200 text-amber-950 border-amber-300 font-bold";
    if (intensity < 0.75)
      return "bg-amber-400 text-amber-950 border-amber-500 font-bold shadow-2xs";
    return "bg-amber-600 text-white border-amber-700 font-bold shadow-xs";
  };

  return (
    <div className="space-y-6" dir={isRTL ? "rtl" : "ltr"}>
      {/* Header & Date Range Controls */}
      <div className="bg-white rounded-2xl border border-stone-200/80 p-5 shadow-xs transition">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-lg sm:text-xl font-bold text-stone-900 flex items-center gap-2">
              <span className="p-2 rounded-xl bg-amber-500/10 text-amber-800 border border-amber-200/60">
                <BarChart2 className="w-5 h-5 text-amber-700" />
              </span>
              <span>{t("analytics.title")}</span>
            </h2>
            <p className="text-xs sm:text-sm text-stone-500 mt-1">
              {t("analytics.subtitle")}
            </p>
          </div>

          <div className="flex items-center gap-2 self-start sm:self-auto">
            <button
              type="button"
              onClick={fetchAnalytics}
              disabled={loading}
              title={t("analytics.refresh")}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold text-stone-700 bg-stone-100 hover:bg-stone-200/80 active:bg-stone-300 transition cursor-pointer disabled:opacity-50"
            >
              <RefreshCw
                className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`}
              />
              <span className="hidden sm:inline">{t("analytics.refresh")}</span>
            </button>
          </div>
        </div>

        {/* Date Filter Bar */}
        <div className="mt-5 pt-4 border-t border-stone-100 flex flex-wrap items-center gap-2">
          <span className="text-xs font-semibold text-stone-500 flex items-center gap-1">
            <Calendar className="w-3.5 h-3.5 text-stone-400" />
            <span>{t("analytics.dateRange.label")}:</span>
          </span>

          <div className="inline-flex rounded-xl bg-stone-100/90 p-1 border border-stone-200/60 gap-1">
            <button
              type="button"
              onClick={() => handlePresetChange("7")}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
                rangePreset === "7"
                  ? "bg-white text-stone-900 shadow-2xs font-bold"
                  : "text-stone-600 hover:text-stone-900"
              }`}
            >
              {t("analytics.dateRange.last7Days")}
            </button>
            <button
              type="button"
              onClick={() => handlePresetChange("30")}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
                rangePreset === "30"
                  ? "bg-white text-stone-900 shadow-2xs font-bold"
                  : "text-stone-600 hover:text-stone-900"
              }`}
            >
              {t("analytics.dateRange.last30Days")}
            </button>
            <button
              type="button"
              onClick={() => handlePresetChange("90")}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
                rangePreset === "90"
                  ? "bg-white text-stone-900 shadow-2xs font-bold"
                  : "text-stone-600 hover:text-stone-900"
              }`}
            >
              {t("analytics.dateRange.last90Days")}
            </button>
            <button
              type="button"
              onClick={() => handlePresetChange("custom")}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
                rangePreset === "custom"
                  ? "bg-white text-stone-900 shadow-2xs font-bold"
                  : "text-stone-600 hover:text-stone-900"
              }`}
            >
              {t("analytics.dateRange.custom")}
            </button>
          </div>

          {/* Current Range Label Indicator */}
          <span className="text-[11px] font-mono font-medium text-stone-500 px-2.5 py-1 rounded-lg bg-stone-50 border border-stone-200/60">
            {dateRange.from} &rarr; {dateRange.to}
          </span>
        </div>

        {/* Custom Range Picker Drawer */}
        {rangePreset === "custom" && (
          <form
            onSubmit={handleApplyCustom}
            className="mt-3 p-3 rounded-xl bg-stone-50 border border-stone-200/80 flex flex-wrap items-center gap-3 text-xs"
          >
            <div className="flex items-center gap-1.5">
              <label className="font-semibold text-stone-600">
                {t("analytics.dateRange.from")}:
              </label>
              <input
                type="date"
                value={customFrom}
                max={todayStr}
                onChange={(e) => setCustomFrom(e.target.value)}
                className="px-2.5 py-1.5 bg-white border border-stone-300 rounded-lg text-xs font-medium text-stone-900 focus:ring-1 focus:ring-amber-500"
                required
              />
            </div>
            <div className="flex items-center gap-1.5">
              <label className="font-semibold text-stone-600">
                {t("analytics.dateRange.to")}:
              </label>
              <input
                type="date"
                value={customTo}
                max={todayStr}
                onChange={(e) => setCustomTo(e.target.value)}
                className="px-2.5 py-1.5 bg-white border border-stone-300 rounded-lg text-xs font-medium text-stone-900 focus:ring-1 focus:ring-amber-500"
                required
              />
            </div>
            <button
              type="submit"
              className="px-4 py-1.5 bg-amber-700 hover:bg-amber-800 text-white font-semibold rounded-lg text-xs transition cursor-pointer shadow-2xs"
            >
              {t("analytics.dateRange.apply")}
            </button>
          </form>
        )}
      </div>

      {/* Global Error Banner */}
      {error && (
        <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-medium flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>{error}</span>
          </div>
          <button
            type="button"
            onClick={fetchAnalytics}
            className="px-2.5 py-1 rounded-lg bg-rose-100 hover:bg-rose-200 text-rose-900 font-bold transition cursor-pointer"
          >
            {t("analytics.retry")}
          </button>
        </div>
      )}

      {/* Loading Skeleton */}
      {loading && !data && (
        <div className="space-y-6 animate-pulse">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <div
                key={i}
                className="h-28 bg-stone-200/70 rounded-2xl border border-stone-200"
              />
            ))}
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="h-80 bg-stone-200/70 rounded-2xl" />
            <div className="h-80 bg-stone-200/70 rounded-2xl" />
          </div>
          <div className="h-72 bg-stone-200/70 rounded-2xl" />
        </div>
      )}

      {data && (
        <>
          {/* Summary Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Card 1: Total Reservations */}
            <div className="bg-white rounded-2xl border border-stone-200/80 p-4 shadow-xs relative overflow-hidden">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-stone-500">
                  {t("analytics.summary.totalReservations")}
                </span>
                <span className="p-2 rounded-xl bg-amber-50 text-amber-700 border border-amber-200/60">
                  <CalendarCheck className="w-4 h-4" />
                </span>
              </div>
              <div className="mt-3">
                <div className="text-2xl sm:text-3xl font-bold text-stone-900 font-mono">
                  {data.summary.totalReservations.toLocaleString()}
                </div>
                <div className="text-[11px] text-stone-500 mt-1">
                  {t("analytics.summary.totalReservationsDesc")}
                </div>
              </div>
            </div>

            {/* Card 2: Total Hours */}
            <div className="bg-white rounded-2xl border border-stone-200/80 p-4 shadow-xs relative overflow-hidden">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-stone-500">
                  {t("analytics.summary.totalHours")}
                </span>
                <span className="p-2 rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-200/60">
                  <Clock className="w-4 h-4" />
                </span>
              </div>
              <div className="mt-3">
                <div className="text-2xl sm:text-3xl font-bold text-stone-900 font-mono">
                  {data.summary.totalHours.toLocaleString()}
                  <span className="text-xs font-sans text-stone-500 font-normal ms-1">
                    {t("analytics.topInstruments.hours")}
                  </span>
                </div>
                <div className="text-[11px] text-stone-500 mt-1">
                  {t("analytics.summary.totalHoursDesc")}
                </div>
              </div>
            </div>

            {/* Card 3: Unique Users */}
            <div className="bg-white rounded-2xl border border-stone-200/80 p-4 shadow-xs relative overflow-hidden">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-stone-500">
                  {t("analytics.summary.uniqueUsers")}
                </span>
                <span className="p-2 rounded-xl bg-brand-50 text-brand-700 border border-brand-200/60">
                  <Users className="w-4 h-4" />
                </span>
              </div>
              <div className="mt-3">
                <div className="text-2xl sm:text-3xl font-bold text-stone-900 font-mono">
                  {data.summary.uniqueUsers.toLocaleString()}
                </div>
                <div className="text-[11px] text-stone-500 mt-1">
                  {t("analytics.summary.uniqueUsersDesc")}
                </div>
              </div>
            </div>

            {/* Card 4: Location Split */}
            <div className="bg-white rounded-2xl border border-stone-200/80 p-4 shadow-xs relative overflow-hidden">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-stone-500">
                  {t("analytics.summary.locationSplit")}
                </span>
                <span className="p-2 rounded-xl bg-purple-50 text-purple-700 border border-purple-200/60">
                  <Church className="w-4 h-4" />
                </span>
              </div>
              <div className="mt-3">
                <div className="text-sm font-bold text-stone-900">
                  {t("analytics.summary.splitFormat", {
                    inChurch: data.summary.inChurchCount,
                    outside: data.summary.outsideChurchCount,
                  })}
                </div>
                {/* Visual Ratio Bar */}
                <div className="w-full bg-stone-100 h-2 rounded-full mt-2.5 overflow-hidden flex">
                  <div
                    style={{
                      width: `${
                        data.summary.totalReservations > 0
                          ? (data.summary.inChurchCount /
                              data.summary.totalReservations) *
                            100
                          : 100
                      }%`,
                    }}
                    className="bg-brand-600 h-full transition-all duration-500"
                    title={`${t("analytics.summary.inChurch")}: ${data.summary.inChurchCount}`}
                  />
                  <div
                    style={{
                      width: `${
                        data.summary.totalReservations > 0
                          ? (data.summary.outsideChurchCount /
                              data.summary.totalReservations) *
                            100
                          : 0
                      }%`,
                    }}
                    className="bg-purple-500 h-full transition-all duration-500"
                    title={`${t("analytics.summary.outsideChurch")}: ${data.summary.outsideChurchCount}`}
                  />
                </div>
                <div className="flex items-center justify-between text-[10px] text-stone-400 mt-1 font-medium">
                  <span className="text-brand-700">
                    {t("analytics.summary.inChurch")}
                  </span>
                  <span className="text-purple-700">
                    {t("analytics.summary.outsideChurch")}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Section 1: Top Instruments & Instrument Types */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Chart 1: Top Instruments (Horizontal Bar Chart) */}
            <div className="bg-white rounded-2xl border border-stone-200/80 p-5 shadow-xs flex flex-col justify-between">
              <div>
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
                  <div>
                    <h3 className="text-sm font-bold text-stone-900 flex items-center gap-1.5">
                      <Award className="w-4 h-4 text-amber-600" />
                      <span>{t("analytics.topInstruments.title")}</span>
                    </h3>
                    <p className="text-xs text-stone-500 mt-0.5">
                      {t("analytics.topInstruments.subtitle")}
                    </p>
                  </div>

                  {/* Toggle: Count vs Hours */}
                  <div className="inline-flex rounded-lg bg-stone-100 p-0.5 border border-stone-200 self-start sm:self-auto text-xs">
                    <button
                      type="button"
                      onClick={() => setInstrumentMetric("count")}
                      className={`px-2.5 py-1 rounded-md text-[11px] font-semibold transition cursor-pointer ${
                        instrumentMetric === "count"
                          ? "bg-white text-stone-900 shadow-2xs font-bold"
                          : "text-stone-600 hover:text-stone-900"
                      }`}
                    >
                      {t("analytics.topInstruments.byCount")}
                    </button>
                    <button
                      type="button"
                      onClick={() => setInstrumentMetric("hours")}
                      className={`px-2.5 py-1 rounded-md text-[11px] font-semibold transition cursor-pointer ${
                        instrumentMetric === "hours"
                          ? "bg-white text-stone-900 shadow-2xs font-bold"
                          : "text-stone-600 hover:text-stone-900"
                      }`}
                    >
                      {t("analytics.topInstruments.byHours")}
                    </button>
                  </div>
                </div>

                {data.instrumentsByUsage.length === 0 ? (
                  <div className="h-64 flex flex-col items-center justify-center text-center p-4 text-stone-400 text-xs">
                    <Layers className="w-8 h-8 text-stone-300 mb-2" />
                    <span>{t("analytics.topInstruments.empty")}</span>
                  </div>
                ) : (
                  <div className="w-full h-72">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        layout="vertical"
                        data={data.instrumentsByUsage}
                        margin={{ top: 5, right: 20, left: 35, bottom: 5 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f0ee" />
                        <XAxis
                          type="number"
                          tick={{ fontSize: 11, fill: "#78716c" }}
                        />
                        <YAxis
                          type="category"
                          dataKey="name"
                          width={100}
                          tick={{ fontSize: 11, fill: "#44403c" }}
                        />
                        <Tooltip
                          formatter={(value: any) => [
                            value,
                            instrumentMetric === "count"
                              ? t("analytics.topInstruments.bookings")
                              : t("analytics.topInstruments.hours"),
                          ]}
                          contentStyle={{
                            backgroundColor: "#ffffff",
                            borderRadius: "0.75rem",
                            border: "1px solid #e7e5e4",
                            fontSize: "12px",
                            boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.05)",
                          }}
                        />
                        <Bar
                          dataKey={
                            instrumentMetric === "count"
                              ? "reservationCount"
                              : "totalHours"
                          }
                          fill="#d97706"
                          radius={isRTL ? [6, 0, 0, 6] : [0, 6, 6, 0]}
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </div>
            </div>

            {/* Chart 2: Usage by Instrument Type (Donut) */}
            <div className="bg-white rounded-2xl border border-stone-200/80 p-5 shadow-xs flex flex-col justify-between">
              <div>
                <div className="mb-4">
                  <h3 className="text-sm font-bold text-stone-900 flex items-center gap-1.5">
                    <PieIcon className="w-4 h-4 text-brand-600" />
                    <span>{t("analytics.types.title")}</span>
                  </h3>
                  <p className="text-xs text-stone-500 mt-0.5">
                    {t("analytics.types.subtitle")}
                  </p>
                </div>

                {data.typesByUsage.length === 0 ? (
                  <div className="h-64 flex flex-col items-center justify-center text-center p-4 text-stone-400 text-xs">
                    <PieIcon className="w-8 h-8 text-stone-300 mb-2" />
                    <span>{t("analytics.types.empty")}</span>
                  </div>
                ) : (
                  <div className="w-full h-72">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={data.typesByUsage}
                          dataKey="reservationCount"
                          nameKey="type"
                          cx="50%"
                          cy="50%"
                          innerRadius={60}
                          outerRadius={95}
                          paddingAngle={3}
                        >
                          {data.typesByUsage.map((entry, index) => (
                            <Cell
                              key={`cell-${index}`}
                              fill={TYPE_PALETTE[index % TYPE_PALETTE.length]}
                            />
                          ))}
                        </Pie>
                        <Tooltip
                          formatter={(value: any, name: any) => [
                            `${value} ${t("analytics.topInstruments.bookings")}`,
                            name,
                          ]}
                          contentStyle={{
                            backgroundColor: "#ffffff",
                            borderRadius: "0.75rem",
                            border: "1px solid #e7e5e4",
                            fontSize: "12px",
                            boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.05)",
                          }}
                        />
                        <Legend
                          verticalAlign="bottom"
                          height={36}
                          iconType="circle"
                          wrapperStyle={{ fontSize: "11px", paddingTop: "8px" }}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Section 2: Weekday & Hourly Bar Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Chart 3: Reservations by Weekday */}
            <div className="bg-white rounded-2xl border border-stone-200/80 p-5 shadow-xs">
              <div className="mb-4">
                <h3 className="text-sm font-bold text-stone-900 flex items-center gap-1.5">
                  <Calendar className="w-4 h-4 text-emerald-600" />
                  <span>{t("analytics.weekday.title")}</span>
                </h3>
                <p className="text-xs text-stone-500 mt-0.5">
                  {t("analytics.weekday.subtitle")}
                </p>
              </div>

              <div className="w-full h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={data.reservationsByWeekday.map((d) => ({
                      ...d,
                      displayName: getTranslatedDayName(d.dayKey),
                    }))}
                    margin={{ top: 10, right: 10, left: -20, bottom: 5 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f0ee" />
                    <XAxis
                      dataKey="displayName"
                      tick={{ fontSize: 11, fill: "#78716c" }}
                    />
                    <YAxis
                      allowDecimals={false}
                      tick={{ fontSize: 11, fill: "#78716c" }}
                    />
                    <Tooltip
                      formatter={(value: any) => [
                        value,
                        t("analytics.topInstruments.bookings"),
                      ]}
                      labelFormatter={(label) => String(label)}
                      contentStyle={{
                        backgroundColor: "#ffffff",
                        borderRadius: "0.75rem",
                        border: "1px solid #e7e5e4",
                        fontSize: "12px",
                      }}
                    />
                    <Bar
                      dataKey="count"
                      fill="#059669"
                      radius={[6, 6, 0, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Chart 4: Reservations by Hour (9:00 - 22:00) */}
            <div className="bg-white rounded-2xl border border-stone-200/80 p-5 shadow-xs">
              <div className="mb-4">
                <h3 className="text-sm font-bold text-stone-900 flex items-center gap-1.5">
                  <Clock className="w-4 h-4 text-brand-600" />
                  <span>{t("analytics.hourly.title")}</span>
                </h3>
                <p className="text-xs text-stone-500 mt-0.5">
                  {t("analytics.hourly.subtitle")}
                </p>
              </div>

              <div className="w-full h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={data.reservationsByHour}
                    margin={{ top: 10, right: 10, left: -20, bottom: 5 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f0ee" />
                    <XAxis
                      dataKey="hourLabel"
                      tick={{ fontSize: 10, fill: "#78716c" }}
                      interval={1}
                    />
                    <YAxis
                      allowDecimals={false}
                      tick={{ fontSize: 11, fill: "#78716c" }}
                    />
                    <Tooltip
                      formatter={(value: any) => [
                        value,
                        t("analytics.topInstruments.bookings"),
                      ]}
                      labelFormatter={(label) => `${t("analytics.hourly.hour")} ${label}`}
                      contentStyle={{
                        backgroundColor: "#ffffff",
                        borderRadius: "0.75rem",
                        border: "1px solid #e7e5e4",
                        fontSize: "12px",
                      }}
                    />
                    <Bar
                      dataKey="count"
                      fill="#3d84bc"
                      radius={[6, 6, 0, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          {/* Section 3: Daily Trend Line Chart */}
          <div className="bg-white rounded-2xl border border-stone-200/80 p-5 shadow-xs">
            <div className="mb-4">
              <h3 className="text-sm font-bold text-stone-900 flex items-center gap-1.5">
                <TrendingUp className="w-4 h-4 text-amber-600" />
                <span>{t("analytics.trend.title")}</span>
              </h3>
              <p className="text-xs text-stone-500 mt-0.5">
                {t("analytics.trend.subtitle")}
              </p>
            </div>

            {data.dailyTrend.length === 0 ? (
              <div className="h-64 flex flex-col items-center justify-center text-center p-4 text-stone-400 text-xs">
                <span>{t("analytics.trend.empty")}</span>
              </div>
            ) : (
              <div className="w-full h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart
                    data={data.dailyTrend}
                    margin={{ top: 10, right: 15, left: -15, bottom: 5 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f0ee" vertical={false} />
                    <XAxis
                      dataKey="date"
                      tick={{ fontSize: 10, fill: "#78716c" }}
                      tickFormatter={(val) => {
                        const parts = val.split("-");
                        return parts.length === 3 ? `${parts[1]}/${parts[2]}` : val;
                      }}
                      minTickGap={20}
                    />
                    <YAxis
                      allowDecimals={false}
                      tick={{ fontSize: 11, fill: "#78716c" }}
                    />
                    <Tooltip
                      formatter={(value: any) => [
                        value,
                        t("analytics.trend.reservations"),
                      ]}
                      labelFormatter={(label) => `${t("analytics.trend.date")}: ${label}`}
                      contentStyle={{
                        backgroundColor: "#ffffff",
                        borderRadius: "0.75rem",
                        border: "1px solid #e7e5e4",
                        fontSize: "12px",
                      }}
                    />
                    <Line
                      type="monotone"
                      dataKey="count"
                      stroke="#d97706"
                      strokeWidth={2.5}
                      dot={data.dailyTrend.length < 35 ? { r: 3, fill: "#d97706" } : false}
                      activeDot={{ r: 5 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>

          {/* Section 4: Weekday x Hour Heatmap Grid */}
          <div className="bg-white rounded-2xl border border-stone-200/80 p-5 shadow-xs">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
              <div>
                <h3 className="text-sm font-bold text-stone-900 flex items-center gap-1.5">
                  <Flame className="w-4 h-4 text-amber-600" />
                  <span>{t("analytics.heatmap.title")}</span>
                </h3>
                <p className="text-xs text-stone-500 mt-0.5">
                  {t("analytics.heatmap.subtitle")}
                </p>
              </div>

              {/* Heatmap Legend */}
              <div className="flex items-center gap-2 text-[11px] text-stone-500 font-medium">
                <span>{t("analytics.heatmap.legendLow")}</span>
                <div className="flex items-center gap-1">
                  <div className="w-3.5 h-3.5 rounded bg-stone-100 border border-stone-200" />
                  <div className="w-3.5 h-3.5 rounded bg-amber-100 border border-amber-200" />
                  <div className="w-3.5 h-3.5 rounded bg-amber-200 border border-amber-300" />
                  <div className="w-3.5 h-3.5 rounded bg-amber-400 border border-amber-500" />
                  <div className="w-3.5 h-3.5 rounded bg-amber-600 border border-amber-700" />
                </div>
                <span>{t("analytics.heatmap.legendHigh")}</span>
              </div>
            </div>

            {/* Heatmap Matrix Table (Mobile Scrollable) */}
            <div className="overflow-x-auto pb-2">
              <div className="min-w-[640px]">
                {/* Header row with hours */}
                <div className="grid grid-cols-[90px_repeat(14,minmax(28px,1fr))] gap-1 text-[10px] font-mono text-stone-400 font-semibold mb-1 text-center">
                  <div className="text-start ps-1 text-stone-500">
                    {t("analytics.hourly.hour")}
                  </div>
                  {Array.from({ length: 14 }, (_, i) => i + 9).map((h) => (
                    <div key={h}>{String(h).padStart(2, "0")}</div>
                  ))}
                </div>

                {/* Day rows (0 to 6) */}
                {[0, 1, 2, 3, 4, 5, 6].map((dayIndex) => {
                  const dayObj = data.reservationsByWeekday.find(
                    (w) => w.dayIndex === dayIndex,
                  );
                  const dayName = dayObj
                    ? getTranslatedDayName(dayObj.dayKey)
                    : "";

                  return (
                    <div
                      key={dayIndex}
                      className="grid grid-cols-[90px_repeat(14,minmax(28px,1fr))] gap-1 mb-1 items-center"
                    >
                      <div className="text-xs font-semibold text-stone-700 truncate pe-2 text-start">
                        {dayName}
                      </div>

                      {Array.from({ length: 14 }, (_, i) => i + 9).map((h) => {
                        const cell = data.weekdayHourHeatmap.find(
                          (c) => c.weekday === dayIndex && c.hour === h,
                        );
                        const count = cell?.count || 0;
                        const tooltipText = t("analytics.heatmap.slotTooltip", {
                          count,
                          day: dayName,
                          hour: `${String(h).padStart(2, "0")}:00`,
                        });

                        return (
                          <div
                            key={h}
                            title={tooltipText}
                            className={`h-7 rounded-md border flex items-center justify-center text-[10px] transition-all hover:scale-105 cursor-pointer ${getHeatmapColor(
                              count,
                            )}`}
                          >
                            {count > 0 ? count : ""}
                          </div>
                        );
                      })}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Section 5: Top Requesters Table */}
          <div className="bg-white rounded-2xl border border-stone-200/80 p-5 shadow-xs">
            <div className="mb-4">
              <h3 className="text-sm font-bold text-stone-900 flex items-center gap-1.5">
                <Users className="w-4 h-4 text-brand-600" />
                <span>{t("analytics.topUsers.title")}</span>
              </h3>
              <p className="text-xs text-stone-500 mt-0.5">
                {t("analytics.topUsers.subtitle")}
              </p>
            </div>

            {data.topUsers.length === 0 ? (
              <div className="h-40 flex items-center justify-center text-center p-4 text-stone-400 text-xs">
                <span>{t("analytics.topUsers.empty")}</span>
              </div>
            ) : (
              <div className="overflow-x-auto rounded-xl border border-stone-200/60">
                <table className="w-full text-xs text-left rtl:text-right">
                  <thead className="bg-stone-50 border-b border-stone-200/80 text-stone-600 font-semibold uppercase text-[10px] tracking-wider">
                    <tr>
                      <th className="py-2.5 px-3">#</th>
                      <th className="py-2.5 px-3">
                        {t("analytics.topUsers.colName")}
                      </th>
                      <th className="py-2.5 px-3 text-center">
                        {t("analytics.topUsers.colCount")}
                      </th>
                      <th className="py-2.5 px-3 text-center">
                        {t("analytics.topUsers.colHours")}
                      </th>
                      <th className="py-2.5 px-3 text-center">
                        {t("analytics.topUsers.colNoShows")}
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-100">
                    {data.topUsers.map((user, idx) => (
                      <tr
                        key={idx}
                        className="hover:bg-stone-50/60 transition-colors"
                      >
                        <td className="py-2.5 px-3 font-mono text-stone-400 font-bold">
                          {idx + 1}
                        </td>
                        <td className="py-2.5 px-3 font-semibold text-stone-900">
                          {user.name}
                        </td>
                        <td className="py-2.5 px-3 text-center font-mono">
                          <span className="px-2 py-0.5 rounded-md bg-amber-50 text-amber-900 font-bold border border-amber-200/60">
                            {user.reservationCount}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-center font-mono font-medium text-stone-700">
                          {user.totalHours}{" "}
                          <span className="text-[10px] text-stone-400">
                            {t("analytics.topInstruments.hours")}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-center font-mono">
                          {user.noShowCount > 0 ? (
                            <span className="px-2 py-0.5 rounded-md bg-rose-50 text-rose-800 font-bold border border-rose-200">
                              {user.noShowCount}
                            </span>
                          ) : (
                            <span className="text-stone-300">-</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
};
