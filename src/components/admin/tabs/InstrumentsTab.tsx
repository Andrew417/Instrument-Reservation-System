import React, { useState, useEffect, useMemo } from "react";
import { useTranslation } from "react-i18next";
import {
  Plus,
  Music2,
  Edit,
  Archive,
  Trash2,
  RefreshCw,
  Sliders,
} from "lucide-react";
import { LoadingSpinner } from "../../shared/LoadingSpinner";
import { useAuth } from "../../../contexts/AuthContext.tsx";
import {
  EMPTY_FILTER_STATE,
  ActiveFiltersBar,
  ReservationFiltersPopover,
  type FilterOptions,
  type ReservationFilterState,
} from "../../ReservationFiltersPopover";

export interface InstrumentsTabProps {
  instrumentsList: any[];
  loadingInstruments: boolean;
  onOpenCreateInstrument: () => void;
  onEditInstrument: (inst: any) => void;
  onRetireInstrument: (inst: any) => void;
  onDeleteInstrument: (inst: any) => void;
  onRestoreInstrument: (inst: any) => void;
}

export const InstrumentsTab: React.FC<InstrumentsTabProps> = ({
  instrumentsList,
  loadingInstruments,
  onOpenCreateInstrument,
  onEditInstrument,
  onRetireInstrument,
  onDeleteInstrument,
  onRestoreInstrument,
}) => {
  const { t } = useTranslation();
  const { sessionToken } = useAuth();
  const [typesSettings, setTypesSettings] = useState<any[]>([]);
  const [loadingTypes, setLoadingTypes] = useState<boolean>(false);
  const [savingType, setSavingType] = useState<string | null>(null);
  const [showInstrumentFilters, setShowInstrumentFilters] = useState(false);
  const [inventorySubTab, setInventorySubTab] = useState<
    "instruments" | "categories"
  >("instruments");
  const [instrumentFilters, setInstrumentFilters] =
    useState<ReservationFilterState>({
      ...EMPTY_FILTER_STATE,
    });

  const instrumentFilterOptions = useMemo<FilterOptions>(() => {
    const unique = (values: unknown[]) =>
      Array.from(
        new Set(values.filter((value): value is string => Boolean(value))),
      ).sort();
    return {
      users: [],
      instruments: [],
      categories: unique(instrumentsList.map((instrument) => instrument.type)),
      statuses: [],
      instrumentStatuses: ["active", "retired"],
      visibilities: unique(
        instrumentsList.map(
          (instrument) =>
            instrument.visibilityLevel ||
            instrument.visibility_level ||
            "public",
        ),
      ),
      bookingModes: unique(
        instrumentsList.map(
          (instrument) =>
            instrument.bookingMode || instrument.booking_mode || "instant",
        ),
      ),
    };
  }, [instrumentsList]);

  const filteredInstruments = useMemo(
    () =>
      instrumentsList
        .filter((instrument) => {
          const isRetired = Boolean(
            instrument.isRemoved ?? instrument.is_removed,
          );
          const status = isRetired ? "retired" : "active";
          const visibility =
            instrument.visibilityLevel ||
            instrument.visibility_level ||
            "public";
          const bookingMode =
            instrument.bookingMode || instrument.booking_mode || "instant";
          const matchesStatus =
            !instrumentFilters.instrumentStatuses.length ||
            instrumentFilters.instrumentStatuses.includes(status);
          const matchesType =
            !instrumentFilters.categories.length ||
            instrumentFilters.categories.includes(instrument.type);
          const matchesVisibility =
            !instrumentFilters.visibilities.length ||
            instrumentFilters.visibilities.includes(visibility);
          const matchesBookingMode =
            !instrumentFilters.bookingModes.length ||
            instrumentFilters.bookingModes.includes(bookingMode);
          return (
            matchesStatus &&
            matchesType &&
            matchesVisibility &&
            matchesBookingMode
          );
        })
        .sort((a, b) => {
          const aIsRetired = Boolean(a.isRemoved ?? a.is_removed);
          const bIsRetired = Boolean(b.isRemoved ?? b.is_removed);
          return Number(aIsRetired) - Number(bIsRetired);
        }),
    [instrumentFilters, instrumentsList],
  );

  const fetchTypes = async () => {
    try {
      setLoadingTypes(true);
      const res = await fetch("/api/admin/types", {
        headers: { Authorization: `Bearer ${sessionToken}` },
      });
      const data = await res.json();
      if (data.success) {
        setTypesSettings(data.types || []);
      }
    } catch (e) {
      console.error("Failed to load type settings", e);
    } finally {
      setLoadingTypes(false);
    }
  };

  useEffect(() => {
    fetchTypes();
  }, [sessionToken]);

  const handleUpdateTypeSetting = async (
    type: string,
    canBeRequested: boolean,
    flatFeeOutside: string,
  ) => {
    try {
      setSavingType(type);
      const res = await fetch(`/api/admin/types/${encodeURIComponent(type)}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${sessionToken}`,
        },
        body: JSON.stringify({ canBeRequested, flatFeeOutside }),
      });
      const data = await res.json();
      if (data.success) {
        fetchTypes();
      }
    } catch (e) {
      console.error("Failed to update type settings", e);
    } finally {
      setSavingType(null);
    }
  };

  const requestableCount = typesSettings.filter((ts) =>
    Boolean(ts.can_be_requested),
  ).length;

  return (
    <div className="bg-white border border-stone-200 rounded-2xl p-3 sm:p-4 shadow-2xs space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between gap-2 border-b border-stone-100 pb-3 flex-wrap">
        {/* Sub-tab switcher (left) */}
        <div className="flex items-center gap-1.5 bg-stone-100 p-1 rounded-2xl border border-stone-200 shrink-0">
          <button
            type="button"
            onClick={() => setInventorySubTab("instruments")}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer whitespace-nowrap ${
              inventorySubTab === "instruments"
                ? "bg-amber-800 text-white shadow-2xs"
                : "text-stone-600 hover:text-stone-900"
            }`}
          >
            {t("admin.instruments.tabInstruments", {
              defaultValue: "Instruments",
            })}
          </button>
          <button
            type="button"
            onClick={() => setInventorySubTab("categories")}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer whitespace-nowrap ${
              inventorySubTab === "categories"
                ? "bg-amber-800 text-white shadow-2xs"
                : "text-stone-600 hover:text-stone-900"
            }`}
          >
            {t("admin.instruments.tabCategories", {
              defaultValue: "Category Settings",
            })}
          </button>
        </div>

        {inventorySubTab === "instruments" && (
          <div className="flex items-center justify-between gap-2 flex-1 min-w-[260px]">
            {/* Filter (left) - Standard icon-only button */}
            <ReservationFiltersPopover
              open={showInstrumentFilters}
              onToggle={() => setShowInstrumentFilters((open) => !open)}
              filters={instrumentFilters}
              onChange={setInstrumentFilters}
              options={instrumentFilterOptions}
              getOwnerName={() => ""}
              isAr={false}
              context="instrument"
            />

            {/* Add Instrument (right) */}
            <button
              id="btn-add-new-instrument"
              onClick={onOpenCreateInstrument}
              className="h-8 px-3 rounded-lg bg-amber-800 hover:bg-amber-900 text-white text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer shadow-xs shrink-0"
            >
              <Plus className="w-3.5 h-3.5 shrink-0" />
              <span>{t("admin.instruments.addButton")}</span>
            </button>
          </div>
        )}
      </div>

      {inventorySubTab === "instruments" && (
        <>
          <ActiveFiltersBar
            filters={instrumentFilters}
            onChange={setInstrumentFilters}
            context="instrument"
          />

          {loadingInstruments ? (
            <LoadingSpinner
              centered
              label={t("admin.instruments.loading") || "Loading instruments..."}
            />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {filteredInstruments.map((inst) => {
                const currentMode =
                  inst.bookingMode || inst.booking_mode || "instant";
                const isInstant = currentMode === "instant";
                const isDecommissioned = Boolean(
                  inst.isRemoved ?? inst.is_removed,
                );
                const instPhoto = inst.photoUrl || inst.photo_url;

                return (
                  <div
                    key={inst.id}
                    className={`p-3 rounded-xl border transition shadow-2xs flex flex-col justify-between ${
                      isDecommissioned
                        ? "bg-stone-50/60 border-stone-200 opacity-60"
                        : "bg-white border-stone-200 hover:border-amber-300"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2 flex-wrap">
                      <div className="flex items-center gap-2 min-w-0">
                        <div className="w-10 h-10 rounded-lg bg-amber-50 border border-amber-200/70 text-amber-900 flex items-center justify-center font-bold overflow-hidden shrink-0 shadow-2xs">
                          {instPhoto ? (
                            <img
                              src={instPhoto}
                              alt={inst.name}
                              referrerPolicy="no-referrer"
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <Music2 className="w-4 h-4 text-amber-800" />
                          )}
                        </div>
                        <div className="min-w-0">
                          <div className="font-bold text-stone-900 text-sm flex items-center gap-2 flex-wrap">
                            <span className="truncate">{inst.name}</span>
                          </div>
                          <div className="text-xs text-stone-500 font-medium flex items-center gap-1.5 flex-wrap">
                            <span>{inst.type}</span>
                            <span className="text-stone-300">•</span>
                            <span>
                              {t("admin.instruments.bookingsCount", {
                                count:
                                  inst.totalReservations ??
                                  inst.total_reservations ??
                                  0,
                              })}
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="shrink-0">
                        {isDecommissioned ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-red-100 text-red-900 border border-red-200">
                            {t("admin.instruments.retiredBadge")}
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-emerald-100 text-emerald-900 border border-emerald-200">
                            {t("admin.instruments.activeBadge")}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center justify-between mt-1.5 gap-1.5 flex-wrap">
                      <div className="flex items-center gap-1 flex-wrap">
                        {Boolean(
                          inst.isOutOfService ?? inst.is_out_of_service,
                        ) && (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold whitespace-nowrap bg-red-100 text-red-900 border border-red-300">
                            {t("admin.instruments.outOfServiceBadge", {
                              defaultValue: "Out of Service",
                            })}
                          </span>
                        )}
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold whitespace-nowrap ${
                            (inst.visibilityLevel || inst.visibility_level) ===
                            "musician"
                              ? "bg-indigo-50 text-indigo-800 border border-indigo-200"
                              : (inst.visibilityLevel ||
                                    inst.visibility_level) === "room_stock"
                                ? "bg-purple-50 text-purple-800 border border-purple-200"
                                : "bg-blue-50 text-blue-800 border border-blue-200"
                          }`}
                        >
                          {(inst.visibilityLevel || inst.visibility_level) ===
                          "musician"
                            ? t("admin.instruments.visMusician", {
                                defaultValue: "Musicians Only",
                              })
                            : (inst.visibilityLevel ||
                                  inst.visibility_level) === "room_stock"
                              ? t("admin.instruments.visRoomStock", {
                                  defaultValue: "Room Stock",
                                })
                              : t("admin.instruments.visPublic", {
                                  defaultValue: "Public",
                                })}
                        </span>
                        <span
                          id={`admin-instrument-mode-badge-${inst.id}`}
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold whitespace-nowrap ${
                            isInstant
                              ? "bg-emerald-50 text-emerald-800 border border-emerald-200"
                              : "bg-amber-50 text-amber-800 border border-amber-200"
                          }`}
                        >
                          {isInstant
                            ? t("admin.instruments.instantBooking")
                            : t("admin.instruments.manualReview")}
                        </span>
                      </div>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold whitespace-nowrap bg-purple-50 text-purple-800 border border-purple-200">
                        {inst.outsideFeePerDay ??
                          inst.outside_fee_per_day ??
                          "0.00"}{" "}
                        EGP/day
                      </span>
                    </div>

                    <p className="text-xs text-stone-600 my-2 line-clamp-2">
                      {inst.description || t("admin.instruments.noDescription")}
                    </p>

                    <div className="pt-2 border-t border-stone-100 text-xs">
                      <div
                        className={`grid gap-1 ${
                          !isDecommissioned ? "grid-cols-3" : "grid-cols-2"
                        }`}
                      >
                        {!isDecommissioned ? (
                          <>
                            <button
                              id={`btn-edit-instrument-${inst.id}`}
                              onClick={() => onEditInstrument(inst)}
                              className="h-7 px-1.5 rounded-lg bg-stone-50 hover:bg-stone-100 text-stone-700 border border-stone-200 font-semibold text-[11px] flex items-center justify-center gap-1 cursor-pointer transition touch-manipulation active:scale-[0.98]"
                              title={t("admin.instruments.editTooltip")}
                            >
                              <Edit className="w-3 h-3 shrink-0" />
                              <span className="sr-only sm:not-sr-only truncate">
                                {t("admin.instruments.edit")}
                              </span>
                            </button>
                            <button
                              id={`btn-mark-unavailable-instrument-${inst.id}`}
                              onClick={() => onRetireInstrument(inst)}
                              className="h-7 px-1.5 rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 font-semibold text-[11px] flex items-center justify-center gap-1 cursor-pointer transition touch-manipulation active:scale-[0.98]"
                              title={t("admin.instruments.retireTooltip")}
                            >
                              <Archive className="w-3 h-3 shrink-0" />
                              <span className="sr-only sm:not-sr-only truncate">
                                {t("admin.instruments.retire")}
                              </span>
                            </button>
                            <button
                              id={`btn-delete-instrument-${inst.id}`}
                              onClick={() => onDeleteInstrument(inst)}
                              className="h-7 px-1.5 rounded-lg bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 font-semibold text-[11px] flex items-center justify-center gap-1 cursor-pointer transition touch-manipulation active:scale-[0.98]"
                              title={t("admin.instruments.deleteTooltip")}
                            >
                              <Trash2 className="w-3 h-3 shrink-0" />
                              <span className="sr-only sm:not-sr-only truncate">
                                {t("admin.instruments.delete")}
                              </span>
                            </button>
                          </>
                        ) : (
                          <>
                            <button
                              id={`btn-restore-instrument-${inst.id}`}
                              onClick={() => onRestoreInstrument(inst)}
                              className="h-7 px-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 font-semibold text-[11px] flex items-center justify-center gap-1 cursor-pointer transition"
                              title={t("admin.instruments.restoreTooltip")}
                            >
                              <RefreshCw className="w-3 h-3 shrink-0" />
                              <span className="sr-only sm:not-sr-only truncate">
                                {t("admin.instruments.restore")}
                              </span>
                            </button>
                            <button
                              id={`btn-delete-instrument-${inst.id}`}
                              onClick={() => onDeleteInstrument(inst)}
                              className="h-7 px-1.5 rounded-lg bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 font-semibold text-[11px] flex items-center justify-center gap-1 cursor-pointer transition"
                              title={t("admin.instruments.deleteTooltip")}
                            >
                              <Trash2 className="w-3 h-3 shrink-0" />
                              <span className="sr-only sm:not-sr-only truncate">
                                {t("admin.instruments.delete")}
                              </span>
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
              {filteredInstruments.length === 0 && (
                <div className="md:col-span-2 py-8 text-center text-xs text-stone-500">
                  {t("admin.instruments.noMatchingInstruments", {
                    defaultValue: "No instruments match these filters.",
                  })}
                </div>
              )}
            </div>
          )}
        </>
      )}

      {/* Category / Type Request Settings */}
      {inventorySubTab === "categories" && (
        <div className="rounded-xl border border-stone-200 overflow-hidden">
          <div className="flex items-start justify-between gap-3 px-3 py-2.5 bg-stone-50 border-b border-stone-200">
            <div className="flex items-start gap-2 min-w-0 flex-1">
              <div className="w-6 h-6 rounded-md bg-purple-50 border border-purple-200 flex items-center justify-center shrink-0 mt-0.5">
                <Sliders className="w-3 h-3 text-purple-700" />
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="font-bold text-stone-900 text-xs sm:text-sm leading-tight">
                  {t("admin.instruments.typeSettingsTitle", {
                    defaultValue: "Category / Type Request Settings",
                  })}
                </h3>
                <p className="text-[10px] sm:text-[11px] text-stone-500 leading-snug mt-0.5 whitespace-normal wrap-break-word">
                  {t("admin.instruments.typeSettingsDesc", {
                    defaultValue:
                      "Toggle which categories members can request, and set the flat fee charged for outside use.",
                  })}
                </p>
              </div>
            </div>
            {!loadingTypes && typesSettings.length > 0 && (
              <span className="shrink-0 px-2 py-0.5 rounded-full bg-purple-50 text-purple-800 border border-purple-200 text-[10px] font-bold tabular-nums">
                {requestableCount}/{typesSettings.length}
              </span>
            )}
          </div>

          {loadingTypes ? (
            <div className="text-xs text-stone-500 py-6 text-center">
              {t("common.loading", { defaultValue: "Loading..." })}
            </div>
          ) : typesSettings.length === 0 ? (
            <div className="text-xs text-stone-500 py-6 text-center">
              {t("admin.instruments.noTypes", {
                defaultValue: "No category settings available.",
              })}
            </div>
          ) : (
            <div className="divide-y divide-stone-100">
              {typesSettings.map((ts) => {
                const isSaving = savingType === ts.type;
                const isRequestable = Boolean(ts.can_be_requested);
                return (
                  <div
                    key={ts.type}
                    className={`grid grid-cols-[1fr_auto_auto] items-center gap-3 px-3 py-2 transition ${
                      isSaving
                        ? "bg-purple-50/50"
                        : "bg-white hover:bg-stone-50/80"
                    }`}
                  >
                    <div className="min-w-0 flex items-center gap-2">
                      <span
                        className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                          isRequestable ? "bg-emerald-500" : "bg-stone-300"
                        }`}
                        aria-hidden
                      />
                      <div className="min-w-0 flex items-baseline gap-1.5 flex-wrap">
                        <span className="font-bold text-stone-900 text-xs truncate">
                          {ts.type}
                        </span>
                        <span className="text-[10px] text-stone-400 font-medium tabular-nums whitespace-nowrap">
                          · {ts.active_instruments_count}{" "}
                          {t("admin.instruments.activeUnitsShort", {
                            defaultValue: "units",
                          })}
                        </span>
                      </div>
                    </div>

                    <button
                      type="button"
                      role="switch"
                      aria-checked={isRequestable}
                      disabled={isSaving}
                      onClick={() =>
                        handleUpdateTypeSetting(
                          ts.type,
                          !isRequestable,
                          ts.flat_fee_outside,
                        )
                      }
                      title={t("admin.instruments.requestableToggle", {
                        defaultValue: "Requestable",
                      })}
                      className={`relative inline-flex items-center h-4 w-7 rounded-full transition-colors shrink-0 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${
                        isRequestable ? "bg-purple-600" : "bg-stone-300"
                      }`}
                    >
                      <span
                        className={`inline-block w-3 h-3 rounded-full bg-white shadow transform transition-transform ${
                          isRequestable ? "translate-x-3.5" : "translate-x-0.5"
                        }`}
                      />
                    </button>

                    {/* Fee: number left-aligned, EGP suffix pinned right */}
                    <div className="flex items-center gap-1.5 justify-end">
                      <div className="relative">
                        <input
                          type="number"
                          min="0"
                          step="1"
                          disabled={isSaving}
                          defaultValue={Number(ts.flat_fee_outside) || 0}
                          onBlur={(e) => {
                            if (e.target.value !== ts.flat_fee_outside) {
                              handleUpdateTypeSetting(
                                ts.type,
                                isRequestable,
                                e.target.value,
                              );
                            }
                          }}
                          aria-label={t("admin.instruments.outsideFlatFee", {
                            defaultValue: "Outside Fee",
                          })}
                          className="w-20 pl-2 pr-7 py-1 bg-white border border-stone-200 rounded-md text-[11px] font-semibold text-stone-900 tabular-nums text-left focus:outline-none focus:border-purple-600 focus:ring-2 focus:ring-purple-100 disabled:opacity-60"
                        />
                        <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[9px] font-bold text-stone-400 pointer-events-none">
                          EGP
                        </span>
                      </div>
                      {isSaving && (
                        <span
                          className="w-1.5 h-1.5 rounded-full bg-purple-500 animate-pulse shrink-0"
                          aria-label={t("common.saving", {
                            defaultValue: "Saving...",
                          })}
                        />
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
