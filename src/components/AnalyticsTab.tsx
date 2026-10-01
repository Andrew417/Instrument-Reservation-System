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
  dateRange: { from: string; to: string };
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
  "#d97706",
  "#3d84bc",
  "#059669",
  "#96277f",
  "#e11d48",
  "#0284c7",
  "#7c3aed",
  "#475569",
];

export const AnalyticsTab: React.FC = () => {
  const { t, i18n } = useTranslation();
  const { sessionToken } = useAuth();
  const isRTL = i18n.language === "ar";

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

  const fetchAnalytics = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/admin/analytics?from=${dateRange.from}&to=${dateRange.to}`,
        {
          headers: { Authorization: `Bearer ${sessionToken || ""}` },
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

  const getTranslatedDayName = (dayKey: string) =>
    t(`analytics.weekday.${dayKey}`);

  const maxHeatmapCount =
    data?.weekdayHourHeatmap.reduce((max, c) => Math.max(max, c.count), 0) || 1;

  const getHeatmapColor = (count: number) => {
    if (count === 0)
      return "bg-stone-100/80 text-stone-300 border-stone-200/50";
    const intensity = count / maxHeatmapCount;
    if (intensity < 0.25) return "bg-amber-100 text-amber-900 border-amber-200";
    if (intensity < 0.5) return "bg-amber-200 text-amber-950 border-amber-300";
    if (intensity < 0.75) return "bg-amber-400 text-amber-950 border-amber-500";
    return "bg-amber-600 text-white border-amber-700";
  };

  return (
    <div className="space-y-2.5 sm:space-y-4" dir={isRTL ? "rtl" : "ltr"}>
      {/* ─────────── Header + Filter (single compact block) ─────────── */}
      <div className="bg-white rounded-2xl border border-stone-200/80 p-2.5 sm:p-4 shadow-xs space-y-2">
        {/* Row 1: title + refresh */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 min-w-0">
            <BarChart2 className="w-4 h-4 text-amber-700 shrink-0" />
            <h2 className="text-sm sm:text-base font-bold text-stone-900 truncate">
              {t("analytics.title")}
            </h2>
          </div>
          <button
            type="button"
            onClick={fetchAnalytics}
            disabled={loading}
            title={t("analytics.refresh")}
            className="shrink-0 w-8 h-8 flex items-center justify-center rounded-lg text-stone-600 bg-stone-100 hover:bg-stone-200 active:bg-stone-300 transition cursor-pointer disabled:opacity-50"
          >
            <RefreshCw
              className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`}
            />
          </button>
        </div>

        {/* Row 2: date pills + current range inline */}
        <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-hide -mx-1 px-1 pb-2">
          {(
            [
              ["7", t("analytics.dateRange.last7Days")],
              ["30", t("analytics.dateRange.last30Days")],
              ["90", t("analytics.dateRange.last90Days")],
              ["custom", t("analytics.dateRange.custom")],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => handlePresetChange(key)}
              className={`shrink-0 px-2.5 py-1 rounded-lg text-[11px] font-bold transition cursor-pointer whitespace-nowrap ${
                rangePreset === key
                  ? "bg-amber-800 text-white shadow-2xs"
                  : "bg-stone-100 text-stone-600 hover:bg-stone-200"
              }`}
            >
              {label}
            </button>
          ))}
          <span className="shrink-0 ms-auto font-mono text-[10px] text-stone-400 whitespace-nowrap ps-2">
            {dateRange.from} → {dateRange.to}
          </span>
        </div>

        {/* Custom range picker (compact) */}
        {rangePreset === "custom" && (
          <form
            onSubmit={handleApplyCustom}
            className="grid grid-cols-2 gap-1.5 pt-1 border-t border-stone-100"
          >
            <input
              type="date"
              value={customFrom}
              max={todayStr}
              onChange={(e) => setCustomFrom(e.target.value)}
              className="w-full px-2 py-1.5 bg-stone-50 border border-stone-200 rounded-lg text-[11px] font-medium text-stone-900 focus:ring-1 focus:ring-amber-500 min-w-0"
              required
            />
            <input
              type="date"
              value={customTo}
              max={todayStr}
              onChange={(e) => setCustomTo(e.target.value)}
              className="w-full px-2 py-1.5 bg-stone-50 border border-stone-200 rounded-lg text-[11px] font-medium text-stone-900 focus:ring-1 focus:ring-amber-500 min-w-0"
              required
            />
            <button
              type="submit"
              className="col-span-2 py-1.5 bg-amber-700 hover:bg-amber-800 text-white font-bold rounded-lg text-[11px] transition cursor-pointer"
            >
              {t("analytics.dateRange.apply")}
            </button>
          </form>
        )}
      </div>

      {/* ─────────── Error ─────────── */}
      {error && (
        <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-[11px] font-medium flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 min-w-0">
            <AlertCircle className="w-3.5 h-3.5 text-rose-600 shrink-0" />
            <span className="break-words truncate">{error}</span>
          </div>
          <button
            type="button"
            onClick={fetchAnalytics}
            className="px-2 py-0.5 rounded-md bg-rose-100 hover:bg-rose-200 text-rose-900 font-bold transition cursor-pointer shrink-0 text-[10px]"
          >
            {t("analytics.retry")}
          </button>
        </div>
      )}

      {/* ─────────── Loading ─────────── */}
      {loading && !data && (
        <div className="space-y-2.5 animate-pulse">
          <div className="h-20 bg-stone-200/70 rounded-2xl" />
          <div className="h-44 bg-stone-200/70 rounded-2xl" />
          <div className="h-44 bg-stone-200/70 rounded-2xl" />
        </div>
      )}

      {data && (
        <>
          {/* ─────────── Summary Cards — 2 cols mobile, 4 cols desktop ─────────── */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-4">
            {/* Card 1: Total Reservations */}
            <div className="bg-white rounded-2xl border border-stone-200/80 p-3 sm:p-4 shadow-xs">
              <div className="flex items-start justify-between gap-1">
                <span className="text-[10px] sm:text-xs font-semibold text-stone-500 leading-tight">
                  {t("analytics.summary.totalReservations")}
                </span>
                <span className="p-1.5 rounded-lg bg-amber-50 text-amber-700 border border-amber-200/60 shrink-0">
                  <CalendarCheck className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                </span>
              </div>
              <div className="mt-2 sm:mt-3">
                <div className="text-xl sm:text-3xl font-bold text-stone-900 font-mono leading-none">
                  {data.summary.totalReservations.toLocaleString()}
                </div>
                <div className="text-[10px] text-stone-500 mt-1 leading-tight line-clamp-2">
                  {t("analytics.summary.totalReservationsDesc")}
                </div>
              </div>
            </div>

            {/* Card 2: Total Hours */}
            <div className="bg-white rounded-2xl border border-stone-200/80 p-3 sm:p-4 shadow-xs">
              <div className="flex items-start justify-between gap-1">
                <span className="text-[10px] sm:text-xs font-semibold text-stone-500 leading-tight">
                  {t("analytics.summary.totalHours")}
                </span>
                <span className="p-1.5 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200/60 shrink-0">
                  <Clock className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                </span>
              </div>
              <div className="mt-2 sm:mt-3">
                <div className="text-xl sm:text-3xl font-bold text-stone-900 font-mono leading-none">
                  {data.summary.totalHours.toLocaleString()}
                  <span className="text-[10px] sm:text-xs font-sans text-stone-500 font-normal ms-1">
                    {t("analytics.topInstruments.hours")}
                  </span>
                </div>
                <div className="text-[10px] text-stone-500 mt-1 leading-tight line-clamp-2">
                  {t("analytics.summary.totalHoursDesc")}
                </div>
              </div>
            </div>

            {/* Card 3: Unique Users */}
            <div className="bg-white rounded-2xl border border-stone-200/80 p-3 sm:p-4 shadow-xs">
              <div className="flex items-start justify-between gap-1">
                <span className="text-[10px] sm:text-xs font-semibold text-stone-500 leading-tight">
                  {t("analytics.summary.uniqueUsers")}
                </span>
                <span className="p-1.5 rounded-lg bg-brand-50 text-brand-700 border border-brand-200/60 shrink-0">
                  <Users className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                </span>
              </div>
              <div className="mt-2 sm:mt-3">
                <div className="text-xl sm:text-3xl font-bold text-stone-900 font-mono leading-none">
                  {data.summary.uniqueUsers.toLocaleString()}
                </div>
                <div className="text-[10px] text-stone-500 mt-1 leading-tight line-clamp-2">
                  {t("analytics.summary.uniqueUsersDesc")}
                </div>
              </div>
            </div>

            {/* Card 4: Location Split */}
            <div className="bg-white rounded-2xl border border-stone-200/80 p-3 sm:p-4 shadow-xs">
              <div className="flex items-start justify-between gap-1">
                <span className="text-[10px] sm:text-xs font-semibold text-stone-500 leading-tight">
                  {t("analytics.summary.locationSplit")}
                </span>
                <span className="p-1.5 rounded-lg bg-purple-50 text-purple-700 border border-purple-200/60 shrink-0">
                  <Church className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                </span>
              </div>
              <div className="mt-2 sm:mt-3">
                <div className="text-xs sm:text-sm font-bold text-stone-900 leading-tight">
                  {t("analytics.summary.splitFormat", {
                    inChurch: data.summary.inChurchCount,
                    outside: data.summary.outsideChurchCount,
                  })}
                </div>
                <div className="w-full bg-stone-100 h-2 rounded-full mt-2 overflow-hidden flex">
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
                  />
                </div>
                <div className="flex items-center justify-between text-[10px] mt-1 font-medium">
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

          {/* ─────────── Top Instruments + Types side by side ─────────── */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 sm:gap-4">
            {/* Top Instruments */}
            <div className="bg-white rounded-2xl border border-stone-200/80 p-2.5 sm:p-4 shadow-xs">
              <div className="flex items-center justify-between gap-2 mb-2">
                <div className="flex items-center gap-1.5 min-w-0">
                  <Award className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                  <h3 className="text-xs font-bold text-stone-900 truncate">
                    {t("analytics.topInstruments.title")}
                  </h3>
                </div>
                <div className="inline-flex rounded-md bg-stone-100 p-0.5 border border-stone-200 shrink-0">
                  <button
                    type="button"
                    onClick={() => setInstrumentMetric("count")}
                    className={`px-1.5 py-0.5 rounded text-[10px] font-bold transition cursor-pointer ${
                      instrumentMetric === "count"
                        ? "bg-white text-stone-900 shadow-2xs"
                        : "text-stone-500"
                    }`}
                  >
                    {t("analytics.topInstruments.byCount")}
                  </button>
                  <button
                    type="button"
                    onClick={() => setInstrumentMetric("hours")}
                    className={`px-1.5 py-0.5 rounded text-[10px] font-bold transition cursor-pointer ${
                      instrumentMetric === "hours"
                        ? "bg-white text-stone-900 shadow-2xs"
                        : "text-stone-500"
                    }`}
                  >
                    {t("analytics.topInstruments.byHours")}
                  </button>
                </div>
              </div>

              {data.instrumentsByUsage.length === 0 ? (
                <div className="h-44 flex flex-col items-center justify-center text-center text-stone-400 text-[11px]">
                  <Layers className="w-6 h-6 text-stone-300 mb-1" />
                  <span>{t("analytics.topInstruments.empty")}</span>
                </div>
              ) : (
                <div className="w-full h-44 sm:h-60">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      layout="vertical"
                      data={data.instrumentsByUsage}
                      margin={{ top: 2, right: 8, left: 0, bottom: 2 }}
                    >
                      <CartesianGrid
                        strokeDasharray="3 3"
                        horizontal={false}
                        stroke="#f1f0ee"
                      />
                      <XAxis
                        type="number"
                        tick={{ fontSize: 9, fill: "#78716c" }}
                      />
                      <YAxis
                        type="category"
                        dataKey="name"
                        width={70}
                        tick={{ fontSize: 9, fill: "#44403c" }}
                        interval={0}
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
                          borderRadius: "0.5rem",
                          border: "1px solid #e7e5e4",
                          fontSize: "10px",
                          padding: "4px 8px",
                        }}
                      />
                      <Bar
                        dataKey={
                          instrumentMetric === "count"
                            ? "reservationCount"
                            : "totalHours"
                        }
                        fill="#d97706"
                        radius={isRTL ? [4, 0, 0, 4] : [0, 4, 4, 0]}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>

            {/* Types Donut */}
            <div className="bg-white rounded-2xl border border-stone-200/80 p-2.5 sm:p-4 shadow-xs">
              <div className="flex items-center gap-1.5 mb-2">
                <PieIcon className="w-3.5 h-3.5 text-brand-600 shrink-0" />
                <h3 className="text-xs font-bold text-stone-900 truncate">
                  {t("analytics.types.title")}
                </h3>
              </div>

              {data.typesByUsage.length === 0 ? (
                <div className="h-44 flex flex-col items-center justify-center text-center text-stone-400 text-[11px]">
                  <PieIcon className="w-6 h-6 text-stone-300 mb-1" />
                  <span>{t("analytics.types.empty")}</span>
                </div>
              ) : (
                <div className="w-full h-44 sm:h-60">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={data.typesByUsage}
                        dataKey="reservationCount"
                        nameKey="type"
                        cx="50%"
                        cy="50%"
                        innerRadius={35}
                        outerRadius={60}
                        paddingAngle={2}
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
                          borderRadius: "0.5rem",
                          border: "1px solid #e7e5e4",
                          fontSize: "10px",
                          padding: "4px 8px",
                        }}
                      />
                      <Legend
                        verticalAlign="bottom"
                        height={28}
                        iconType="circle"
                        iconSize={6}
                        wrapperStyle={{ fontSize: "9px", paddingTop: "0" }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>
          </div>

          {/* ─────────── Weekday + Hourly ─────────── */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 sm:gap-4">
            <div className="bg-white rounded-2xl border border-stone-200/80 p-2.5 sm:p-4 shadow-xs">
              <div className="flex items-center gap-1.5 mb-2">
                <Calendar className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                <h3 className="text-xs font-bold text-stone-900 truncate">
                  {t("analytics.weekday.title")}
                </h3>
              </div>
              <div className="w-full h-40 sm:h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={data.reservationsByWeekday.map((d) => ({
                      ...d,
                      displayName: getTranslatedDayName(d.dayKey),
                    }))}
                    margin={{ top: 2, right: 4, left: -28, bottom: 0 }}
                  >
                    <CartesianGrid
                      strokeDasharray="3 3"
                      vertical={false}
                      stroke="#f1f0ee"
                    />
                    <XAxis
                      dataKey="displayName"
                      tick={{ fontSize: 9, fill: "#78716c" }}
                    />
                    <YAxis
                      allowDecimals={false}
                      tick={{ fontSize: 9, fill: "#78716c" }}
                    />
                    <Tooltip
                      formatter={(value: any) => [
                        value,
                        t("analytics.topInstruments.bookings"),
                      ]}
                      contentStyle={{
                        backgroundColor: "#ffffff",
                        borderRadius: "0.5rem",
                        border: "1px solid #e7e5e4",
                        fontSize: "10px",
                        padding: "4px 8px",
                      }}
                    />
                    <Bar dataKey="count" fill="#059669" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="bg-white rounded-2xl border border-stone-200/80 p-2.5 sm:p-4 shadow-xs">
              <div className="flex items-center gap-1.5 mb-2">
                <Clock className="w-3.5 h-3.5 text-brand-600 shrink-0" />
                <h3 className="text-xs font-bold text-stone-900 truncate">
                  {t("analytics.hourly.title")}
                </h3>
              </div>
              <div className="w-full h-40 sm:h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={data.reservationsByHour}
                    margin={{ top: 2, right: 4, left: -28, bottom: 0 }}
                  >
                    <CartesianGrid
                      strokeDasharray="3 3"
                      vertical={false}
                      stroke="#f1f0ee"
                    />
                    <XAxis
                      dataKey="hourLabel"
                      tick={{ fontSize: 8, fill: "#78716c" }}
                      interval={2}
                    />
                    <YAxis
                      allowDecimals={false}
                      tick={{ fontSize: 9, fill: "#78716c" }}
                    />
                    <Tooltip
                      formatter={(value: any) => [
                        value,
                        t("analytics.topInstruments.bookings"),
                      ]}
                      labelFormatter={(label) =>
                        `${t("analytics.hourly.hour")} ${label}`
                      }
                      contentStyle={{
                        backgroundColor: "#ffffff",
                        borderRadius: "0.5rem",
                        border: "1px solid #e7e5e4",
                        fontSize: "10px",
                        padding: "4px 8px",
                      }}
                    />
                    <Bar dataKey="count" fill="#3d84bc" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          {/* ─────────── Daily Trend ─────────── */}
          <div className="bg-white rounded-2xl border border-stone-200/80 p-2.5 sm:p-4 shadow-xs">
            <div className="flex items-center gap-1.5 mb-2">
              <TrendingUp className="w-3.5 h-3.5 text-amber-600 shrink-0" />
              <h3 className="text-xs font-bold text-stone-900 truncate">
                {t("analytics.trend.title")}
              </h3>
            </div>
            {data.dailyTrend.length === 0 ? (
              <div className="h-36 flex items-center justify-center text-stone-400 text-[11px]">
                <span>{t("analytics.trend.empty")}</span>
              </div>
            ) : (
              <div className="w-full h-40 sm:h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart
                    data={data.dailyTrend}
                    margin={{ top: 2, right: 6, left: -28, bottom: 0 }}
                  >
                    <CartesianGrid
                      strokeDasharray="3 3"
                      stroke="#f1f0ee"
                      vertical={false}
                    />
                    <XAxis
                      dataKey="date"
                      tick={{ fontSize: 8, fill: "#78716c" }}
                      tickFormatter={(val) => {
                        const parts = val.split("-");
                        return parts.length === 3
                          ? `${parts[1]}/${parts[2]}`
                          : val;
                      }}
                      minTickGap={20}
                    />
                    <YAxis
                      allowDecimals={false}
                      tick={{ fontSize: 9, fill: "#78716c" }}
                    />
                    <Tooltip
                      formatter={(value: any) => [
                        value,
                        t("analytics.trend.reservations"),
                      ]}
                      labelFormatter={(label) =>
                        `${t("analytics.trend.date")}: ${label}`
                      }
                      contentStyle={{
                        backgroundColor: "#ffffff",
                        borderRadius: "0.5rem",
                        border: "1px solid #e7e5e4",
                        fontSize: "10px",
                        padding: "4px 8px",
                      }}
                    />
                    <Line
                      type="monotone"
                      dataKey="count"
                      stroke="#d97706"
                      strokeWidth={2}
                      dot={false}
                      activeDot={{ r: 3 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>

          {/* ─────────── Heatmap ─────────── */}
          <div className="bg-white rounded-2xl border border-stone-200/80 p-2.5 sm:p-4 shadow-xs">
            <div className="flex items-center justify-between gap-2 mb-2">
              <div className="flex items-center gap-1.5 min-w-0">
                <Flame className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                <h3 className="text-xs font-bold text-stone-900 truncate">
                  {t("analytics.heatmap.title")}
                </h3>
              </div>
              <div className="flex items-center gap-1 text-[9px] text-stone-400 font-bold shrink-0">
                <span>{t("analytics.heatmap.legendLow")}</span>
                <div className="flex items-center gap-0.5">
                  <div className="w-2.5 h-2.5 rounded bg-stone-100 border border-stone-200" />
                  <div className="w-2.5 h-2.5 rounded bg-amber-100 border border-amber-200" />
                  <div className="w-2.5 h-2.5 rounded bg-amber-200 border border-amber-300" />
                  <div className="w-2.5 h-2.5 rounded bg-amber-400 border border-amber-500" />
                  <div className="w-2.5 h-2.5 rounded bg-amber-600 border border-amber-700" />
                </div>
                <span>{t("analytics.heatmap.legendHigh")}</span>
              </div>
            </div>

            <div className="overflow-x-auto pb-0.5 -mx-0.5 px-0.5">
              <div className="min-w-[440px]">
                <div className="grid grid-cols-[56px_repeat(14,minmax(20px,1fr))] gap-[2px] text-[8px] font-mono text-stone-400 font-bold mb-[2px] text-center">
                  <div className="text-start text-stone-500"></div>
                  {Array.from({ length: 14 }, (_, i) => i + 9).map((h) => (
                    <div key={h}>{String(h).padStart(2, "0")}</div>
                  ))}
                </div>

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
                      className="grid grid-cols-[56px_repeat(14,minmax(20px,1fr))] gap-[2px] mb-[2px] items-center"
                    >
                      <div className="text-[10px] font-bold text-stone-700 truncate pe-1 sticky start-0 bg-white z-10">
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
                            className={`h-5 sm:h-6 rounded border flex items-center justify-center text-[8px] font-bold transition-all hover:scale-110 cursor-pointer ${getHeatmapColor(count)}`}
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

          {/* ─────────── Top Users — compact chips ─────────── */}
          <div className="bg-white rounded-2xl border border-stone-200/80 p-2.5 sm:p-4 shadow-xs">
            <div className="flex items-center gap-1.5 mb-2">
              <Users className="w-3.5 h-3.5 text-brand-600 shrink-0" />
              <h3 className="text-xs font-bold text-stone-900 truncate">
                {t("analytics.topUsers.title")}
              </h3>
            </div>

            {data.topUsers.length === 0 ? (
              <div className="h-24 flex items-center justify-center text-stone-400 text-[11px]">
                <span>{t("analytics.topUsers.empty")}</span>
              </div>
            ) : (
              <ol className="space-y-1">
                {data.topUsers.map((user, idx) => (
                  <li
                    key={idx}
                    className="flex items-center gap-2 px-2 py-1.5 rounded-lg bg-stone-50/70 border border-stone-100 min-h-8"
                  >
                    <span className="w-5 h-5 rounded-md bg-amber-100 text-amber-900 font-mono font-bold text-[10px] flex items-center justify-center shrink-0">
                      {idx + 1}
                    </span>
                    <span className="flex-1 min-w-0 font-semibold text-stone-900 text-xs truncate">
                      {user.name}
                    </span>
                    <span className="shrink-0 px-1.5 py-0.5 rounded-md bg-amber-50 text-amber-900 font-mono font-bold text-[10px] border border-amber-200/60">
                      {user.reservationCount}
                    </span>
                    <span className="shrink-0 font-mono text-[10px] text-stone-500 hidden xs:inline">
                      {user.totalHours}
                      <span className="text-[9px] ms-0.5">
                        {t("analytics.topInstruments.hours")}
                      </span>
                    </span>
                    {user.noShowCount > 0 && (
                      <span className="shrink-0 px-1.5 py-0.5 rounded-md bg-rose-50 text-rose-800 font-bold text-[10px] border border-rose-200">
                        {user.noShowCount}
                      </span>
                    )}
                  </li>
                ))}
              </ol>
            )}
          </div>
        </>
      )}
    </div>
  );
};

export default AnalyticsTab;
