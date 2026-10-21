import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import { Archive, Info } from "lucide-react";

export interface RetireInstrumentItem {
  id: string;
  name: string;
}

interface RetireInstrumentModalProps {
  instrument: RetireInstrumentItem | null;
  onClose: () => void;
  onConfirm: (instrument: RetireInstrumentItem) => void;
}

import { ModalShell } from "../shared/ModalShell";

export const RetireInstrumentModal: React.FC<RetireInstrumentModalProps> = ({
  instrument,
  onClose,
  onConfirm,
}) => {
  const { t } = useTranslation();
  const [removeConfirmForce, setRemoveConfirmForce] = useState(false);

  if (!instrument) return null;

  return (
    <ModalShell
      isOpen={!!instrument}
      onClose={onClose}
      size="md"
      zIndex="z-[130]"
      titleClassName="text-sm"
      icon={
        <div className="w-9 h-9 rounded-xl bg-amber-100 text-amber-800 flex items-center justify-center shrink-0">
          <Archive className="w-5 h-5" />
        </div>
      }
      title={t("admin.modals.retireInstrument.title", {
        name: instrument.name,
      })}
      subtitle={
        <span className="text-[10px] uppercase tracking-wider font-extrabold text-amber-800 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">
          {t("admin.modals.retireInstrument.badge")}
        </span>
      }
    >

        <p className="text-xs text-stone-600 leading-relaxed">
          {t("admin.modals.retireInstrument.description")}
        </p>

        <div className="p-2.5 rounded-xl bg-stone-50 border border-stone-200 text-stone-600 text-[11px] leading-normal flex items-start gap-2">
          <Info className="w-4 h-4 text-stone-500 shrink-0 mt-0.5" />
          <div>{t("admin.modals.retireInstrument.deleteHint")}</div>
        </div>

        <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs flex items-center gap-2 text-amber-900">
          <input
            type="checkbox"
            id="check-force-remove"
            checked={removeConfirmForce}
            onChange={(e) => setRemoveConfirmForce(e.target.checked)}
            className="w-4 h-4 accent-amber-700 rounded cursor-pointer shrink-0"
          />
          <label
            htmlFor="check-force-remove"
            className="cursor-pointer font-semibold select-none"
          >
            {t("admin.modals.retireInstrument.confirmCheckbox")}
          </label>
        </div>

        <div className="pt-2 flex items-center justify-end gap-2 text-xs">
          <button
            type="button"
            onClick={onClose}
            className="px-3.5 py-2 rounded-xl bg-stone-50 hover:bg-stone-100 text-stone-700 font-semibold cursor-pointer border border-stone-200"
          >
            {t("admin.modals.retireInstrument.cancel")}
          </button>
          <button
            type="button"
            id="btn-confirm-mark-unavailable"
            disabled={!removeConfirmForce}
            onClick={() => onConfirm(instrument)}
            className="px-4 py-2 rounded-xl bg-amber-800 hover:bg-amber-900 disabled:opacity-50 text-white font-bold cursor-pointer shadow-xs"
          >
            {t("admin.modals.retireInstrument.confirm")}
          </button>
      </div>
    </ModalShell>
  );
};
