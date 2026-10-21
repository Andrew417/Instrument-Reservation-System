import React from "react";
import { useTranslation } from "react-i18next";
import { Plus, Music2, Edit, Archive, Trash2, RefreshCw } from "lucide-react";
import { LoadingSpinner } from "../../shared/LoadingSpinner";

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

  return (
    <div className="bg-white border border-stone-200 rounded-2xl p-5 shadow-2xs space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-stone-100 pb-4">
        <div className="min-w-0">
          <h2 className="font-bold text-stone-900 text-sm">
            {t("admin.instruments.title")}
          </h2>
          <p className="text-xs text-stone-500 mt-0.5">
            {t("admin.instruments.subtitle")}
          </p>
        </div>
        <button
          id="btn-add-new-instrument"
          onClick={onOpenCreateInstrument}
          className="shrink-0 px-3.5 py-2 rounded-xl bg-amber-800 hover:bg-amber-900 text-white text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer shadow-xs"
        >
          <Plus className="w-3.5 h-3.5 shrink-0" />
          <span>{t("admin.instruments.addButton")}</span>
        </button>
      </div>

      {loadingInstruments ? (
        <LoadingSpinner centered label={t("admin.instruments.loading") || "Loading instruments..."} />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {instrumentsList.map((inst) => {
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
                className={`p-4 rounded-2xl border transition shadow-2xs flex flex-col justify-between ${
                  isDecommissioned
                    ? "bg-stone-50/60 border-stone-200 opacity-60"
                    : "bg-white border-stone-200 hover:border-amber-300"
                }`}
              >
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-12 h-12 rounded-xl bg-amber-50 border border-amber-200/70 text-amber-900 flex items-center justify-center font-bold overflow-hidden shrink-0 shadow-2xs">
                      {instPhoto ? (
                        <img
                          src={instPhoto}
                          alt={inst.name}
                          referrerPolicy="no-referrer"
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <Music2 className="w-5 h-5 text-amber-800" />
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
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold uppercase tracking-wider bg-red-100 text-red-900 border border-red-200">
                        {t("admin.instruments.retiredBadge")}
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold uppercase tracking-wider bg-emerald-100 text-emerald-900 border border-emerald-200">
                        {t("admin.instruments.activeBadge")}
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex items-center justify-between mt-2 gap-2 flex-wrap">
                  <div className="flex items-center gap-1.5 flex-wrap">
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
                    $
                    {inst.outsideFeePerDay ??
                      inst.outside_fee_per_day ??
                      "0.00"}
                    /day
                  </span>
                </div>

                <p className="text-xs text-stone-600 my-3 line-clamp-2">
                  {inst.description ||
                    t("admin.instruments.noDescription")}
                </p>

                <div className="pt-3 border-t border-stone-100 text-xs">
                  <div
                    className={`grid gap-1.5 ${!isDecommissioned ? "grid-cols-3" : "grid-cols-2"}`}
                  >
                    {!isDecommissioned ? (
                      <>
                        <button
                          id={`btn-edit-instrument-${inst.id}`}
                          onClick={() => onEditInstrument(inst)}
                          className="px-2 py-1.5 rounded-lg bg-stone-50 hover:bg-stone-100 text-stone-700 border border-stone-200 font-semibold flex items-center justify-center gap-1 cursor-pointer transition"
                          title={t("admin.instruments.editTooltip")}
                        >
                          <Edit className="w-3 h-3 shrink-0" />
                          <span className="truncate">
                            {t("admin.instruments.edit")}
                          </span>
                        </button>
                        <button
                          id={`btn-mark-unavailable-instrument-${inst.id}`}
                          onClick={() => onRetireInstrument(inst)}
                          className="px-2 py-1.5 rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 font-semibold flex items-center justify-center gap-1 cursor-pointer transition"
                          title={t("admin.instruments.retireTooltip")}
                        >
                          <Archive className="w-3 h-3 shrink-0" />
                          <span className="truncate">
                            {t("admin.instruments.retire")}
                          </span>
                        </button>
                        <button
                          id={`btn-delete-instrument-${inst.id}`}
                          onClick={() => onDeleteInstrument(inst)}
                          className="px-2 py-1.5 rounded-lg bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 font-semibold flex items-center justify-center gap-1 cursor-pointer transition"
                          title={t("admin.instruments.deleteTooltip")}
                        >
                          <Trash2 className="w-3 h-3 shrink-0" />
                          <span className="truncate">
                            {t("admin.instruments.delete")}
                          </span>
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          id={`btn-restore-instrument-${inst.id}`}
                          onClick={() => onRestoreInstrument(inst)}
                          className="px-2 py-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 font-semibold flex items-center justify-center gap-1 cursor-pointer transition"
                          title={t("admin.instruments.restoreTooltip")}
                        >
                          <RefreshCw className="w-3 h-3 shrink-0" />
                          <span className="truncate">
                            {t("admin.instruments.restore")}
                          </span>
                        </button>
                        <button
                          id={`btn-delete-instrument-${inst.id}`}
                          onClick={() => onDeleteInstrument(inst)}
                          className="px-2 py-1.5 rounded-lg bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 font-semibold flex items-center justify-center gap-1 cursor-pointer transition"
                          title={t("admin.instruments.deleteTooltip")}
                        >
                          <Trash2 className="w-3 h-3 shrink-0" />
                          <span className="truncate">
                            {t("admin.instruments.delete")}
                          </span>
                        </button>
                      </>
                    )}
                  </div>

                  {!isDecommissioned && (
                    <p className="text-[10px] text-stone-400 mt-1.5 text-center">
                      {t("admin.instruments.footerNote")}
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
