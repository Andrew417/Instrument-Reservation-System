import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import { Trash2, Info, AlertTriangle, RefreshCw } from "lucide-react";

interface DeleteInstrumentModalProps {
  instrument: any | null;
  isDeleting: boolean;
  onClose: () => void;
  onConfirm: (instrument: any) => void;
}

import { ModalShell } from "../shared/ModalShell";

export const DeleteInstrumentModal: React.FC<DeleteInstrumentModalProps> = ({
  instrument,
  isDeleting,
  onClose,
  onConfirm,
}) => {
  const { t } = useTranslation();
  const [deleteConfirmChecked, setDeleteConfirmChecked] = useState(false);

  if (!instrument) return null;

  const totalBookings = Number(
    instrument.totalReservations ?? instrument.total_reservations ?? 0,
  );

  return (
    <ModalShell
      isOpen={!!instrument}
      onClose={onClose}
      size="md"
      zIndex="z-[130]"
      titleClassName="text-sm"
      icon={
        <div className="w-9 h-9 rounded-xl bg-red-100 text-red-700 flex items-center justify-center shrink-0">
          <Trash2 className="w-5 h-5" />
        </div>
      }
      title={t("admin.modals.deleteInstrument.title")}
      subtitle={
        <span className="text-[10px] uppercase tracking-wider font-extrabold text-red-700 bg-red-50 px-2 py-0.5 rounded-full border border-red-200">
          {t("admin.modals.deleteInstrument.badge")}
        </span>
      }
    >

        <div className="p-3 bg-stone-50 border border-stone-200 rounded-xl space-y-1.5 text-xs">
          <div className="flex justify-between">
            <span className="text-stone-500 font-medium">
              {t("admin.modals.deleteInstrument.nameLabel")}
            </span>
            <span className="font-bold text-stone-900">{instrument.name}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-stone-500 font-medium">
              {t("admin.modals.deleteInstrument.categoryLabel")}
            </span>
            <span className="font-semibold text-stone-800">
              {instrument.type}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-stone-500 font-medium">
              {t("admin.modals.deleteInstrument.statusLabel")}
            </span>
            <span className="font-semibold text-stone-800">
              {instrument.isRemoved || instrument.is_removed
                ? t("admin.modals.deleteInstrument.notAvailableStatus")
                : t("admin.modals.deleteInstrument.availableStatus")}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-stone-500 font-medium">
              {t("admin.modals.deleteInstrument.bookingsLabel")}
            </span>
            <span className="font-bold text-stone-900">{totalBookings}</span>
          </div>
        </div>

        <div className="space-y-2 text-xs text-stone-600 leading-relaxed">
          <p>{t("admin.modals.deleteInstrument.description")}</p>
          <div className="p-2.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-[11px] leading-normal flex items-start gap-2">
            <Info className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
            <div>{t("admin.modals.deleteInstrument.retireHint")}</div>
          </div>
          {totalBookings > 0 && (
            <div className="p-2.5 rounded-xl bg-red-50 border border-red-200 text-red-900 text-[11px] leading-normal flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-red-700 shrink-0 mt-0.5" />
              <div>
                {t("admin.modals.deleteInstrument.warningBookings", {
                  count: totalBookings,
                })}
              </div>
            </div>
          )}
        </div>

        <div className="p-3 bg-red-50/80 border border-red-200 rounded-xl text-xs flex items-start gap-2 text-red-950">
          <input
            type="checkbox"
            id="check-permanent-delete-instrument"
            checked={deleteConfirmChecked}
            onChange={(e) => setDeleteConfirmChecked(e.target.checked)}
            className="w-4 h-4 accent-red-700 rounded cursor-pointer mt-0.5 shrink-0"
          />
          <label
            htmlFor="check-permanent-delete-instrument"
            className="cursor-pointer font-medium select-none"
          >
            {t("admin.modals.deleteInstrument.confirmCheckbox")}
          </label>
        </div>

        <div className="pt-2 flex items-center justify-end gap-2 text-xs">
          <button
            type="button"
            onClick={onClose}
            disabled={isDeleting}
            className="px-3.5 py-2 rounded-xl bg-stone-50 hover:bg-stone-100 text-stone-700 font-semibold cursor-pointer border border-stone-200 disabled:opacity-50"
          >
            {t("admin.modals.deleteInstrument.cancel")}
          </button>
          <button
            type="button"
            id="btn-confirm-delete-instrument"
            disabled={!deleteConfirmChecked || isDeleting}
            onClick={() => onConfirm(instrument)}
            className="px-4 py-2 rounded-xl bg-red-700 hover:bg-red-800 disabled:opacity-50 text-white font-bold cursor-pointer shadow-xs flex items-center gap-1.5"
          >
            {isDeleting ? (
              <>
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                <span>{t("admin.modals.deleteInstrument.deleting")}</span>
              </>
            ) : (
              <>
                <Trash2 className="w-3.5 h-3.5" />
                <span>{t("admin.modals.deleteInstrument.confirmButton")}</span>
              </>
            )}
          </button>
      </div>
    </ModalShell>
  );
};
