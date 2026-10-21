import React from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import { XCircle, Trash2 } from "lucide-react";

export interface BulkSelectionBottomBarProps {
  isOpen: boolean;
  reservations: any[];
  selectedReservationIds: string[];
  isSuperAdmin: boolean;
  onToggleSelectAll: () => void;
  onExitSelection: () => void;
  onBulkCancel: () => void;
  onBulkDelete: () => void;
}

export const BulkSelectionBottomBar: React.FC<BulkSelectionBottomBarProps> = ({
  isOpen,
  reservations,
  selectedReservationIds,
  isSuperAdmin,
  onToggleSelectAll,
  onExitSelection,
  onBulkCancel,
  onBulkDelete,
}) => {
  const { t } = useTranslation();

  if (!isOpen || typeof document === "undefined") return null;

  return createPortal(
    <div
      id="bulk-selection-bottom-bar"
      role="toolbar"
      data-selection-mode="true"
      aria-label={t("admin.review.bulkActionsLabel")}
      style={{
        bottom: "var(--mobile-bottom-nav-height, 0px)",
      }}
      className="sm:hidden fixed inset-x-0 z-[80] border-t border-stone-200 bg-white shadow-[0_-8px_24px_-8px_rgba(0,0,0,0.15)] px-3 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))]"
    >
      <div className="max-w-5xl mx-auto flex flex-col gap-2">
        <div className="flex items-center justify-between gap-3">
          <label
            htmlFor="select-all-reservations-checkbox"
            className="flex items-center gap-2.5 cursor-pointer min-h-[40px] pr-2 -my-1"
          >
            <input
              id="select-all-reservations-checkbox"
              type="checkbox"
              aria-label="Select all visible reservations"
              checked={
                reservations.length > 0 &&
                reservations.every((r) => selectedReservationIds.includes(r.id))
              }
              ref={(el) => {
                if (el) {
                  const someSelected =
                    reservations.some((r) =>
                      selectedReservationIds.includes(r.id),
                    ) &&
                    !reservations.every((r) =>
                      selectedReservationIds.includes(r.id),
                    );
                  el.indeterminate = someSelected;
                }
              }}
              onChange={onToggleSelectAll}
              className="w-5 h-5 rounded accent-amber-800 text-amber-800 border-stone-300 focus:ring-amber-700/20 cursor-pointer"
            />
            <span
              className={`text-xs font-bold ${
                selectedReservationIds.length > 0
                  ? "text-amber-900"
                  : "text-stone-700"
              }`}
            >
              {selectedReservationIds.length > 0
                ? t("admin.review.selectedCount", {
                    count: selectedReservationIds.length,
                    total: reservations.length,
                  })
                : t("admin.review.selectAllVisible", {
                    count: reservations.length,
                  })}
            </span>
          </label>

          {selectedReservationIds.length > 0 && (
            <span className="hidden sm:inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-100 text-amber-900 border border-amber-200 text-[10px] font-extrabold">
              {selectedReservationIds.length}
            </span>
          )}

          <button
            type="button"
            onClick={onExitSelection}
            className="shrink-0 px-3 py-2 rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-700 text-xs font-bold transition cursor-pointer min-h-[40px]"
            title={t("admin.review.exitSelection")}
          >
            {t("admin.review.exitSelection")}
          </button>
        </div>

        <div className="flex items-center gap-2">
          <button
            id="btn-bulk-cancel-selected"
            type="button"
            disabled={selectedReservationIds.length === 0}
            onClick={onBulkCancel}
            className="flex-1 sm:flex-none px-2.5 sm:px-3 py-2.5 rounded-xl bg-amber-700 hover:bg-amber-800 disabled:bg-stone-200 disabled:text-stone-500 disabled:shadow-none disabled:cursor-not-allowed text-white text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer shadow-xs min-h-[44px] min-w-0"
          >
            <XCircle className="w-3.5 h-3.5 shrink-0" />
            <span className="truncate">
              {t("admin.review.cancelSelected")}
            </span>
          </button>

          {isSuperAdmin && (
            <button
              id="btn-bulk-delete-selected"
              type="button"
              disabled={selectedReservationIds.length === 0}
              onClick={onBulkDelete}
              className="flex-1 sm:flex-none px-2.5 sm:px-3 py-2.5 rounded-xl bg-red-700 hover:bg-red-800 disabled:bg-stone-200 disabled:text-stone-500 disabled:shadow-none disabled:cursor-not-allowed text-white text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer shadow-xs min-h-[44px] min-w-0"
            >
              <Trash2 className="w-3.5 h-3.5 shrink-0" />
              <span className="truncate">
                {t("admin.review.deleteSelected")}
              </span>
            </button>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
};
