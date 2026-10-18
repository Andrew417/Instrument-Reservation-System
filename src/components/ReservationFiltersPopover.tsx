import React, { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Filter, X, Search, ChevronDown, Check } from "lucide-react";

export type ReservationFilterState = {
  users: string[];
  musician: string;
  instruments: string[];
  categories: string[];
  weekdays: string[]; // "Sunday", ... (legacy, kept for compatibility)
  statuses: string[];
  dateMode: "any" | "day" | "range" | "weekday";
  dateSingle: string; // YYYY-MM-DD
  dateFrom: string; // YYYY-MM-DD
  dateTo: string; // YYYY-MM-DD
};

export const EMPTY_FILTER_STATE: ReservationFilterState = {
  users: [],
  musician: "",
  instruments: [],
  categories: [],
  weekdays: [],
  statuses: [],
  dateMode: "any",
  dateSingle: "",
  dateFrom: "",
  dateTo: "",
};

export interface FilterOptions {
  users: string[];
  instruments: string[];
  categories: string[];
  statuses: string[];
}

const WEEKDAYS = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

const STATUS_KEYS: Record<string, string> = {
  pending: "common.pending",
  approved: "common.approved",
  rejected: "common.rejected",
  cancelled: "common.cancelled",
  ongoing: "common.ongoing",
  completed: "common.completed",
  expired: "common.expired",
};

export const countActiveFilters = (f: ReservationFilterState): number => {
  let n = 0;
  if (f.users.length) n++;
  if (f.musician.trim()) n++;
  if (f.instruments.length) n++;
  if (f.categories.length) n++;
  if (f.statuses.length) n++;
  if (f.dateMode !== "any") n++;
  if (f.weekdays.length && f.dateMode === "any") n++;
  return n;
};

export const hasActiveFilters = (f: ReservationFilterState): boolean =>
  countActiveFilters(f) > 0;

/** Shared matcher. Works for both Dashboard and Review lists. */
export const matchesFilters = (
  row: any,
  f: ReservationFilterState,
  getOwnerName: (r: any) => string,
): boolean => {
  if (f.users.length) {
    const owner = getOwnerName(row);
    if (!f.users.includes(owner)) return false;
  }
  if (f.musician.trim()) {
    const m = String(row.musician_name || row.musicianName || "");
    if (!m.toLowerCase().includes(f.musician.trim().toLowerCase())) {
      return false;
    }
  }
  if (f.instruments.length && !f.instruments.includes(row.instrument_name)) {
    return false;
  }
  if (f.categories.length && !f.categories.includes(row.instrument_type)) {
    return false;
  }
  if (f.statuses.length && !f.statuses.includes(row.status)) {
    return false;
  }

  const startISO = row.reservation_date
    ? String(row.reservation_date)
    : row.start_time
      ? String(row.start_time)
      : null;

  const weekdayOf = () => {
    try {
      const d = new Date(row.start_time || row.startTime);
      return new Intl.DateTimeFormat("en-US", {
        weekday: "long",
        timeZone: "Africa/Cairo",
      }).format(d);
    } catch {
      return "";
    }
  };

  if (f.dateMode === "weekday" && f.weekdays.length) {
    const wd = weekdayOf();
    if (!f.weekdays.includes(wd)) return false;
  }

  if (f.dateMode === "day" && f.dateSingle) {
    const rowDate = startISO ? startISO.substring(0, 10) : "";
    if (rowDate !== f.dateSingle) return false;
  }

  if (f.dateMode === "range" && (f.dateFrom || f.dateTo)) {
    const rowDate = startISO ? startISO.substring(0, 10) : "";
    if (f.dateFrom && rowDate < f.dateFrom) return false;
    if (f.dateTo && rowDate > f.dateTo) return false;
  }

  if (f.dateMode === "any" && f.weekdays.length) {
    const wd = weekdayOf();
    if (!f.weekdays.includes(wd)) return false;
  }

  return true;
};

/* ============================================================================
   ActiveFiltersBar — identical UI to the Review Requests tab.
   Renders `null` when no filters are active.
   ============================================================================ */
export interface ActiveFiltersBarProps {
  filters: ReservationFilterState;
  onChange: (next: ReservationFilterState) => void;
  translateStatus?: (s: string) => string;
}

/** Compact a YYYY-MM-DD to a short MM-DD for pill display on mobile. */
const shortDate = (iso: string): string => {
  if (!iso || iso.length < 10) return "…";
  return iso.substring(5); // MM-DD
};

export const ActiveFiltersBar: React.FC<ActiveFiltersBarProps> = ({
  filters,
  onChange,
  translateStatus,
}) => {
  const { t } = useTranslation();

  if (!hasActiveFilters(filters)) return null;

  const statusLabel = (s: string) =>
    translateStatus ? translateStatus(s) : t(STATUS_KEYS[s] || s);

  const removeValue = (
    key: "users" | "instruments" | "categories" | "statuses" | "weekdays",
    value: string,
  ) => {
    onChange({
      ...filters,
      [key]: filters[key].filter((v) => v !== value),
    });
  };

  return (
    <div className="flex items-start sm:items-center justify-between gap-2 pt-1 border-t border-stone-200/60 text-[11px] text-stone-600 flex-wrap">
      <div className="flex items-center gap-1.5 flex-wrap min-w-0 flex-1">
        <span className="font-semibold text-stone-500 flex items-center gap-1 shrink-0">
          <Filter className="w-3 h-3 text-amber-700" />
          <span>
            {t("admin.review.activeFilters", {
              defaultValue: "Filters applied:",
            })}
          </span>
        </span>

        {filters.users.map((u) => (
          <span
            key={`u-${u}`}
            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-white border border-stone-200 text-stone-700 text-[10px]"
          >
            <span className="truncate max-w-[100px]">{u}</span>
            <button
              type="button"
              onClick={() => removeValue("users", u)}
              className="hover:text-stone-900 cursor-pointer shrink-0"
              aria-label={`Remove ${u}`}
            >
              <X className="w-2.5 h-2.5" />
            </button>
          </span>
        ))}

        {filters.musician.trim() && (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-white border border-stone-200 text-stone-700 text-[10px]">
            <span className="truncate max-w-[100px]">"{filters.musician}"</span>
            <button
              type="button"
              onClick={() => onChange({ ...filters, musician: "" })}
              className="hover:text-stone-900 cursor-pointer shrink-0"
              aria-label="Remove musician filter"
            >
              <X className="w-2.5 h-2.5" />
            </button>
          </span>
        )}

        {filters.instruments.map((i) => (
          <span
            key={`i-${i}`}
            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-white border border-amber-300 text-amber-900 text-[10px] font-medium"
          >
            <span className="truncate max-w-[100px]">{i}</span>
            <button
              type="button"
              onClick={() => removeValue("instruments", i)}
              className="hover:text-amber-950 cursor-pointer shrink-0"
              aria-label={`Remove ${i}`}
            >
              <X className="w-2.5 h-2.5" />
            </button>
          </span>
        ))}

        {filters.categories.map((c) => (
          <span
            key={`c-${c}`}
            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-white border border-amber-300 text-amber-900 text-[10px] font-medium"
          >
            <span className="truncate max-w-[100px]">{c}</span>
            <button
              type="button"
              onClick={() => removeValue("categories", c)}
              className="hover:text-amber-950 cursor-pointer shrink-0"
              aria-label={`Remove ${c}`}
            >
              <X className="w-2.5 h-2.5" />
            </button>
          </span>
        ))}

        {filters.statuses.map((s) => (
          <span
            key={`s-${s}`}
            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-white border border-amber-300 text-amber-900 text-[10px] font-medium"
          >
            <span>{statusLabel(s)}</span>
            <button
              type="button"
              onClick={() => removeValue("statuses", s)}
              className="hover:text-amber-950 cursor-pointer shrink-0"
              aria-label={`Remove ${s}`}
            >
              <X className="w-2.5 h-2.5" />
            </button>
          </span>
        ))}

        {filters.dateMode !== "any" && (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-white border border-amber-300 text-amber-900 text-[10px] font-medium">
            <span>
              {filters.dateMode === "day"
                ? shortDate(filters.dateSingle)
                : filters.dateMode === "range"
                  ? `${shortDate(filters.dateFrom)} → ${shortDate(filters.dateTo)}`
                  : filters.weekdays.join(", ")}
            </span>
            <button
              type="button"
              onClick={() =>
                onChange({
                  ...filters,
                  dateMode: "any",
                  dateSingle: "",
                  dateFrom: "",
                  dateTo: "",
                  weekdays: [],
                })
              }
              className="hover:text-amber-950 cursor-pointer shrink-0"
              aria-label="Remove date filter"
            >
              <X className="w-2.5 h-2.5" />
            </button>
          </span>
        )}
      </div>

      <button
        type="button"
        onClick={() => onChange({ ...EMPTY_FILTER_STATE })}
        className="shrink-0 text-amber-800 hover:text-amber-950 hover:underline font-bold text-[10px] cursor-pointer"
      >
        {t("admin.review.resetFilters", { defaultValue: "Reset Filters" })}
      </button>
    </div>
  );
};

/* ============================================================================
   ReservationFiltersPopover
   ============================================================================ */
export interface ReservationFiltersPopoverProps {
  open: boolean;
  onToggle: () => void;
  filters: ReservationFilterState;
  onChange: (next: ReservationFilterState) => void;
  options: FilterOptions;
  getOwnerName: (r: any) => string;
  isAr: boolean;
}

export const ReservationFiltersPopover: React.FC<
  ReservationFiltersPopoverProps
> = ({ open, onToggle, filters, onChange, options, getOwnerName, isAr }) => {
  const { t } = useTranslation();
  const ref = useRef<HTMLDivElement>(null);
  const [musicianDraft, setMusicianDraft] = useState(filters.musician);
  const [userQuery, setUserQuery] = useState("");
  const [openDropdown, setOpenDropdown] = useState<
    "instrument" | "category" | "status" | null
  >(null);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onToggle();
      }
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open, onToggle]);

  // Reset transient UI when the popover closes
  useEffect(() => {
    if (!open) {
      setOpenDropdown(null);
      setUserQuery("");
    }
  }, [open]);

  // Keep the local musician draft in sync with external changes
  // (e.g. reset from the ActiveFiltersBar) without losing user typing.
  useEffect(() => {
    setMusicianDraft(filters.musician);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters.musician]);

  // Push draft into parent filter state (guarded to avoid a mount-time fire).
  useEffect(() => {
    if (filters.musician === musicianDraft) return;
    onChange({ ...filters, musician: musicianDraft });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [musicianDraft]);

  const toggleValue = (
    key: "users" | "instruments" | "categories" | "statuses" | "weekdays",
    value: string,
  ) => {
    const current = filters[key];
    const next = current.includes(value)
      ? current.filter((v) => v !== value)
      : [...current, value];
    onChange({ ...filters, [key]: next });
  };

  const clearAll = () => {
    setMusicianDraft("");
    setUserQuery("");
    setOpenDropdown(null);
    onChange({ ...EMPTY_FILTER_STATE });
  };

  const filterList = (list: string[], q: string) => {
    if (!q.trim()) return list;
    const term = q.trim().toLowerCase();
    return list.filter((v) => v.toLowerCase().includes(term));
  };

  const activeCount = countActiveFilters(filters);

  /* ── Reusable chip (users + weekday) ── */
  const Chip = ({
    label,
    active,
    onClick,
  }: {
    label: string;
    active: boolean;
    onClick: () => void;
  }) => (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`px-2 py-0.5 rounded-full text-[10px] font-bold border transition cursor-pointer whitespace-nowrap ${
        active
          ? "bg-amber-800 text-white border-amber-900"
          : "bg-white text-stone-700 border-stone-200 hover:bg-stone-50"
      }`}
    >
      {label}
    </button>
  );

  const SectionLabel = ({ children }: { children: React.ReactNode }) => (
    <div className="text-[10px] font-bold uppercase tracking-wide text-stone-500">
      {children}
    </div>
  );

  /* ── Reusable search input with clear button ── */
  const SmallSearch = ({
    value,
    onChange: setV,
    placeholder,
  }: {
    value: string;
    onChange: (v: string) => void;
    placeholder: string;
  }) => (
    <div className="relative">
      <Search className="w-3 h-3 text-stone-400 absolute left-2 top-2 pointer-events-none" />
      <input
        type="text"
        value={value}
        onChange={(e) => setV(e.target.value)}
        placeholder={placeholder}
        className="w-full pl-7 pr-7 py-1.5 bg-white border border-stone-200 rounded-lg text-[11px] text-stone-900 placeholder:text-stone-400 focus:outline-none focus:border-amber-700"
      />
      {value && (
        <button
          type="button"
          onClick={() => setV("")}
          className="absolute right-1.5 top-1.5 p-0.5 rounded text-stone-400 hover:text-stone-700 cursor-pointer"
          aria-label="Clear search"
        >
          <X className="w-3 h-3" />
        </button>
      )}
    </div>
  );

  /* ── Reusable multi-select dropdown (inline expansion, no clipping) ── */
  const MultiSelectDropdown = ({
    id,
    values,
    options: opts,
    onToggle: onToggleValue,
    searchable = true,
    getOptionLabel,
    selectedLabelKey,
  }: {
    id: "instrument" | "category" | "status";
    values: string[];
    options: string[];
    onToggle: (v: string) => void;
    searchable?: boolean;
    getOptionLabel?: (v: string) => string;
    selectedLabelKey: string;
  }) => {
    const isOpen = openDropdown === id;
    const [query, setQuery] = useState("");
    const filtered = searchable ? filterList(opts, query) : opts;
    const labelFor = (v: string) => (getOptionLabel ? getOptionLabel(v) : v);

    const triggerLabel =
      values.length > 0
        ? t(selectedLabelKey, {
            count: values.length,
            defaultValue:
              values.length === 1
                ? `1 ${selectedLabelKey.split(".").pop()} selected`
                : `${values.length} ${selectedLabelKey.split(".").pop()}s selected`,
          })
        : t("common.select", { defaultValue: "Select…" });

    return (
      <div className="space-y-1.5">
        <button
          type="button"
          onClick={() => {
            setQuery("");
            setOpenDropdown(isOpen ? null : id);
          }}
          aria-expanded={isOpen}
          className={`w-full flex items-center justify-between gap-2 px-2 py-2 sm:py-1.5 rounded-lg border text-[11px] font-semibold transition cursor-pointer ${
            values.length > 0
              ? "bg-amber-50 border-amber-300 text-amber-900"
              : "bg-white border-stone-200 text-stone-700 hover:bg-stone-50"
          }`}
        >
          <span className="truncate">{triggerLabel}</span>
          <ChevronDown
            className={`w-3 h-3 shrink-0 transition-transform ${
              isOpen ? "rotate-180" : ""
            }`}
          />
        </button>

        {/* Inline (not absolute) so it never clips inside the popover's scroll container */}
        {isOpen && (
          <div className="rounded-xl border border-stone-200 bg-stone-50/60 p-1.5 space-y-1.5">
            {searchable && (
              <SmallSearch
                value={query}
                onChange={setQuery}
                placeholder={t("common.search", { defaultValue: "Search…" })}
              />
            )}
            <div className="max-h-40 overflow-y-auto flex flex-col gap-0.5">
              {filtered.length === 0 ? (
                <span className="text-[10px] text-stone-400 px-1 py-1">
                  {t("common.noResults", { defaultValue: "No matches" })}
                </span>
              ) : (
                filtered.map((opt) => {
                  const active = values.includes(opt);
                  return (
                    <button
                      key={opt}
                      type="button"
                      onClick={() => {
                        onToggleValue(opt);
                        setOpenDropdown(null);
                      }}
                      aria-pressed={active}
                      className={`w-full flex items-center justify-between gap-2 text-left px-2 py-1.5 sm:py-1 rounded-md text-[11px] font-medium transition cursor-pointer ${
                        active
                          ? "bg-amber-800 text-white"
                          : "text-stone-700 hover:bg-stone-100"
                      }`}
                    >
                      <span className="truncate">{labelFor(opt)}</span>
                      {active && <Check className="w-3 h-3 shrink-0" />}
                    </button>
                  );
                })
              )}
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={onToggle}
        className={`shrink-0 px-2.5 py-2 rounded-xl border transition cursor-pointer inline-flex items-center gap-1.5 text-xs font-semibold ${
          activeCount > 0
            ? "bg-amber-100 text-amber-900 border-amber-300"
            : "bg-stone-50 hover:bg-stone-100 text-stone-600 border-stone-200"
        }`}
        title={t("admin.dashboard.filters.button", {
          defaultValue: "Filter",
        })}
      >
        <Filter className="w-3.5 h-3.5" />
        <span className="hidden sm:inline">
          {t("admin.dashboard.filters.button", { defaultValue: "Filter" })}
        </span>
        {activeCount > 0 && (
          <span className="min-w-4 h-4 px-1 rounded-full bg-amber-800 text-white text-[10px] leading-4 text-center">
            {activeCount}
          </span>
        )}
      </button>

      {open && (
        <>
          {/* Mobile: full-width fixed panel — never overflows, no clipping */}
          <div className="sm:hidden fixed inset-x-2 top-16 bottom-2 z-[120] rounded-2xl border border-stone-200 bg-white shadow-2xl flex flex-col overflow-hidden">
            <div className="flex items-center justify-between gap-2 px-3.5 py-3 border-b border-stone-100 shrink-0">
              <h3 className="text-sm font-extrabold text-stone-900">
                {t("admin.dashboard.filters.title", {
                  defaultValue: "Filter reservations",
                })}
              </h3>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={clearAll}
                  className="text-[11px] font-semibold text-amber-800 hover:text-amber-950 cursor-pointer"
                >
                  {t("admin.dashboard.filters.clear", {
                    defaultValue: "Clear",
                  })}
                </button>
                <button
                  type="button"
                  onClick={onToggle}
                  className="p-1 rounded-lg text-stone-500 hover:bg-stone-100 cursor-pointer"
                  aria-label="Close filters"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-3.5">
              <PopoverBody
                isAr={isAr}
                filters={filters}
                onChange={onChange}
                options={options}
                userQuery={userQuery}
                setUserQuery={setUserQuery}
                musicianDraft={musicianDraft}
                setMusicianDraft={setMusicianDraft}
                toggleValue={toggleValue}
                filterList={filterList}
                Chip={Chip}
                SectionLabel={SectionLabel}
                SmallSearch={SmallSearch}
                MultiSelectDropdown={MultiSelectDropdown}
              />
            </div>
          </div>

          {/* Desktop: anchored popover (unchanged behaviour) */}
          <div
            className={`hidden sm:block absolute top-full mt-2 z-30 w-[min(94vw,360px)] max-h-[75vh] overflow-y-auto rounded-2xl border border-stone-200 bg-white p-3.5 shadow-xl ${
              isAr ? "left-0" : "right-0"
            }`}
          >
            <div className="flex items-center justify-between gap-2 mb-3">
              <h3 className="text-xs font-extrabold text-stone-900">
                {t("admin.dashboard.filters.title", {
                  defaultValue: "Filter reservations",
                })}
              </h3>
              <button
                type="button"
                onClick={clearAll}
                className="text-[11px] font-semibold text-amber-800 hover:text-amber-950 cursor-pointer"
              >
                {t("admin.dashboard.filters.clear", {
                  defaultValue: "Clear",
                })}
              </button>
            </div>
            <PopoverBody
              isAr={isAr}
              filters={filters}
              onChange={onChange}
              options={options}
              userQuery={userQuery}
              setUserQuery={setUserQuery}
              musicianDraft={musicianDraft}
              setMusicianDraft={setMusicianDraft}
              toggleValue={toggleValue}
              filterList={filterList}
              Chip={Chip}
              SectionLabel={SectionLabel}
              SmallSearch={SmallSearch}
              MultiSelectDropdown={MultiSelectDropdown}
            />
          </div>
        </>
      )}
    </div>
  );
};

/* Shared body — used by both mobile full-screen and desktop popover */
const PopoverBody = ({
  isAr,
  filters,
  onChange,
  options,
  userQuery,
  setUserQuery,
  musicianDraft,
  setMusicianDraft,
  toggleValue,
  filterList,
  Chip,
  SectionLabel,
  SmallSearch,
  MultiSelectDropdown,
}: any) => {
  const { t } = useTranslation();
  return (
    <div className="space-y-3">
      {/* USERS (multi) */}
      <div className="space-y-1.5">
        <SectionLabel>
          {t("admin.dashboard.filters.user", { defaultValue: "User" })}
        </SectionLabel>
        <SmallSearch
          value={userQuery}
          onChange={setUserQuery}
          placeholder={t("common.search", { defaultValue: "Search…" })}
        />
        <div className="flex flex-wrap gap-1 max-h-24 overflow-y-auto">
          {filterList(options.users, userQuery).map((u: string) => (
            <Chip
              key={u}
              label={u}
              active={filters.users.includes(u)}
              onClick={() => toggleValue("users", u)}
            />
          ))}
          {filterList(options.users, userQuery).length === 0 && (
            <span className="text-[10px] text-stone-400">
              {t("common.noResults", { defaultValue: "No matches" })}
            </span>
          )}
        </div>
      </div>

      {/* MUSICIAN (substring) */}
      <div className="space-y-1">
        <SectionLabel>
          {t("admin.dashboard.filters.musician", {
            defaultValue: "Musician name",
          })}
        </SectionLabel>
        <input
          type="text"
          value={musicianDraft}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
            setMusicianDraft(e.target.value)
          }
          placeholder={t("admin.dashboard.filters.musicianPlaceholder", {
            defaultValue: "Type musician name",
          })}
          className="w-full rounded-lg border border-stone-200 bg-white px-2 py-1.5 text-[11px] text-stone-900 placeholder:text-stone-400 focus:outline-none focus:border-amber-700"
        />
      </div>

      {/* INSTRUMENTS */}
      <div className="space-y-1.5">
        <SectionLabel>
          {t("admin.dashboard.filters.instrument", {
            defaultValue: "Instrument",
          })}
        </SectionLabel>
        <MultiSelectDropdown
          id="instrument"
          values={filters.instruments}
          options={options.instruments}
          onToggle={(v: string) => toggleValue("instruments", v)}
          selectedLabelKey="admin.dashboard.filters.instrumentsSelected"
        />
      </div>

      {/* CATEGORIES */}
      <div className="space-y-1.5">
        <SectionLabel>
          {t("admin.dashboard.filters.category", {
            defaultValue: "Category",
          })}
        </SectionLabel>
        <MultiSelectDropdown
          id="category"
          values={filters.categories}
          options={options.categories}
          onToggle={(v: string) => toggleValue("categories", v)}
          selectedLabelKey="admin.dashboard.filters.categoriesSelected"
        />
      </div>

      {/* STATUS (no search) */}
      <div className="space-y-1.5">
        <SectionLabel>
          {t("common.status", { defaultValue: "Status" })}
        </SectionLabel>
        <MultiSelectDropdown
          id="status"
          values={filters.statuses}
          options={options.statuses}
          onToggle={(v: string) => toggleValue("statuses", v)}
          searchable={false}
          getOptionLabel={(v: string) => t(STATUS_KEYS[v] || v)}
          selectedLabelKey="admin.dashboard.filters.statusesSelected"
        />
      </div>

      {/* DATE FILTER */}
      <div className="space-y-1.5 pt-1 border-t border-stone-100">
        <SectionLabel>
          {t("admin.dashboard.filters.dateFilter", { defaultValue: "Date" })}
        </SectionLabel>
        <div className="grid grid-cols-4 gap-1">
          {(
            [
              {
                id: "any",
                label: t("admin.dashboard.filters.dateAny", {
                  defaultValue: "Any",
                }),
              },
              {
                id: "day",
                label: t("admin.dashboard.filters.dateDay", {
                  defaultValue: "Day",
                }),
              },
              {
                id: "range",
                label: t("admin.dashboard.filters.dateRange", {
                  defaultValue: "Range",
                }),
              },
              {
                id: "weekday",
                label: t("admin.dashboard.filters.dateWeekday", {
                  defaultValue: "Weekday",
                }),
              },
            ] as const
          ).map((m) => (
            <button
              key={m.id}
              type="button"
              onClick={() => onChange({ ...filters, dateMode: m.id })}
              aria-pressed={filters.dateMode === m.id}
              className={`py-1.5 rounded-lg text-[10px] font-bold transition cursor-pointer text-center border ${
                filters.dateMode === m.id
                  ? "bg-amber-800 text-white border-amber-900"
                  : "bg-white text-stone-700 border-stone-200 hover:bg-stone-50"
              }`}
            >
              {m.label}
            </button>
          ))}
        </div>

        {filters.dateMode === "day" && (
          <input
            type="date"
            value={filters.dateSingle}
            onChange={(e) =>
              onChange({ ...filters, dateSingle: e.target.value })
            }
            className="w-full rounded-lg border border-stone-200 bg-white px-2 py-1.5 text-[11px] text-stone-900 focus:outline-none focus:border-amber-700"
          />
        )}

        {filters.dateMode === "range" && (
          <div className="grid grid-cols-2 gap-1.5">
            <div>
              <div className="text-[10px] text-stone-500 mb-0.5">
                {t("common.from", { defaultValue: "From" })}
              </div>
              <input
                type="date"
                value={filters.dateFrom}
                onChange={(e) =>
                  onChange({ ...filters, dateFrom: e.target.value })
                }
                className="w-full rounded-lg border border-stone-200 bg-white px-2 py-1.5 text-[11px] text-stone-900 focus:outline-none focus:border-amber-700"
              />
            </div>
            <div>
              <div className="text-[10px] text-stone-500 mb-0.5">
                {t("common.to", { defaultValue: "To" })}
              </div>
              <input
                type="date"
                value={filters.dateTo}
                onChange={(e) =>
                  onChange({ ...filters, dateTo: e.target.value })
                }
                className="w-full rounded-lg border border-stone-200 bg-white px-2 py-1.5 text-[11px] text-stone-900 focus:outline-none focus:border-amber-700"
              />
            </div>
          </div>
        )}

        {filters.dateMode === "weekday" && (
          <div className="flex flex-wrap gap-1">
            {WEEKDAYS.map((wd) => (
              <Chip
                key={wd}
                label={
                  isAr ? t(`analytics.weekday.${wd.toLowerCase()}`) || wd : wd
                }
                active={filters.weekdays.includes(wd)}
                onClick={() => toggleValue("weekdays", wd)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
