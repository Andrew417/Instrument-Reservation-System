import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import { X } from "lucide-react";
import { formatHhmmTo12Hour, getTodayDateString } from "../../lib/date-utils";

export interface BookOnBehalfUserState {
  id: string;
  name: string;
}

export interface BehalfFormState {
  instrumentId: string;
  serviceName: string;
  musicianName: string;
  date: string;
  startTime: string;
  duration: number;
  reservationType: "in_church" | "outside_church";
}

interface BookOnBehalfModalProps {
  user: BookOnBehalfUserState | null;
  instrumentsList: any[];
  onClose: () => void;
  onSubmit: (formData: BehalfFormState) => void;
}

const TIME_OPTIONS = [
  "09:00",
  "10:00",
  "11:00",
  "12:00",
  "13:00",
  "14:00",
  "15:00",
  "16:00",
  "17:00",
  "18:00",
  "19:00",
  "20:00",
  "21:00",
];

export const BookOnBehalfModal: React.FC<BookOnBehalfModalProps> = ({
  user,
  instrumentsList,
  onClose,
  onSubmit,
}) => {
  const { t } = useTranslation();

  const availableInstruments = instrumentsList.filter(
    (i) => !(i.isRemoved ?? i.is_removed),
  );

  const [form, setForm] = useState<BehalfFormState>({
    instrumentId: availableInstruments[0]?.id || "",
    serviceName: "",
    musicianName: user?.name || "",
    date: getTodayDateString(),
    startTime: "18:00",
    duration: 2,
    reservationType: "in_church",
  });

  if (!user) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(form);
  };

  return (
    <div className="fixed inset-0 z-[110] bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white border border-stone-200 rounded-2xl max-w-md w-full p-6 space-y-4 shadow-xl">
        <div className="flex items-center justify-between border-b border-stone-100 pb-3">
          <div>
            <h3 className="font-bold text-stone-900 text-sm">
              {t("admin.modals.bookOnBehalf.title", {
                name: user.name,
              })}
            </h3>
            <p className="text-xs text-amber-800 font-semibold">
              {t("admin.modals.bookOnBehalf.subtitle")}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-stone-400 hover:text-stone-600 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3 text-xs">
          <div>
            <label className="block font-bold text-stone-700 mb-1">
              {t("admin.modals.bookOnBehalf.instrumentLabel")}
            </label>
            <select
              value={form.instrumentId}
              onChange={(e) =>
                setForm({
                  ...form,
                  instrumentId: e.target.value,
                })
              }
              className="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-xl text-stone-900 focus:outline-none focus:border-amber-700"
            >
              {availableInstruments.map((i) => (
                <option key={i.id} value={i.id}>
                  {i.name} ({i.type})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block font-bold text-stone-700 mb-1">
              {t("admin.modals.bookOnBehalf.serviceLabel")}
            </label>
            <input
              type="text"
              required
              placeholder={t("admin.modals.bookOnBehalf.servicePlaceholder")}
              value={form.serviceName}
              onChange={(e) =>
                setForm({
                  ...form,
                  serviceName: e.target.value,
                })
              }
              className="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-xl text-stone-900 focus:outline-none focus:border-amber-700"
            />
          </div>

          <div>
            <label className="block font-bold text-stone-700 mb-1">
              {t("reservationForm.musicianNameLabel")} *
            </label>
            <input
              type="text"
              required
              placeholder={t("reservationForm.musicianNamePlaceholder")}
              value={form.musicianName}
              onChange={(e) =>
                setForm({
                  ...form,
                  musicianName: e.target.value,
                })
              }
              className="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-xl text-stone-900 focus:outline-none focus:border-amber-700"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-bold text-stone-700 mb-1">
                {t("admin.modals.bookOnBehalf.dateLabel")}
              </label>
              <input
                type="date"
                required
                value={form.date}
                onChange={(e) =>
                  setForm({ ...form, date: e.target.value })
                }
                className="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-xl text-stone-900 focus:outline-none focus:border-amber-700"
              />
            </div>

            <div>
              <label className="block font-bold text-stone-700 mb-1">
                {t("admin.modals.bookOnBehalf.startTimeLabel")}
              </label>
              <select
                value={form.startTime}
                onChange={(e) =>
                  setForm({
                    ...form,
                    startTime: e.target.value,
                  })
                }
                className="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-xl text-stone-900 focus:outline-none focus:border-amber-700"
              >
                {TIME_OPTIONS.map((tm) => (
                  <option key={tm} value={tm}>
                    {formatHhmmTo12Hour(tm)}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-bold text-stone-700 mb-1">
                {t("admin.modals.bookOnBehalf.durationLabel")}
              </label>
              <input
                type="number"
                min="1"
                max="6"
                value={form.duration}
                onChange={(e) =>
                  setForm({
                    ...form,
                    duration: parseInt(e.target.value, 10) || 1,
                  })
                }
                className="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-xl text-stone-900 focus:outline-none focus:border-amber-700"
              />
            </div>

            <div>
              <label className="block font-bold text-stone-700 mb-1">
                {t("admin.modals.bookOnBehalf.typeLabel")}
              </label>
              <select
                value={form.reservationType}
                onChange={(e) =>
                  setForm({
                    ...form,
                    reservationType: e.target.value as any,
                  })
                }
                className="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-xl text-stone-900 focus:outline-none focus:border-amber-700"
              >
                <option value="in_church">
                  {t("admin.modals.bookOnBehalf.inChurch")}
                </option>
                <option value="outside_church">
                  {t("admin.modals.bookOnBehalf.outsideChurch")}
                </option>
              </select>
            </div>
          </div>

          <div className="pt-3 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-2 rounded-xl bg-stone-50 hover:bg-stone-100 text-stone-700 font-semibold cursor-pointer border border-stone-200"
            >
              {t("admin.modals.bookOnBehalf.cancel")}
            </button>
            <button
              type="submit"
              className="px-4 py-2 rounded-xl bg-amber-800 hover:bg-amber-900 text-white font-bold cursor-pointer shadow-xs"
            >
              {t("admin.modals.bookOnBehalf.submit")}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
