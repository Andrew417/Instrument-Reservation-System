import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import { RefreshCw, Info } from "lucide-react";

export interface HardLimitsFormState {
  maxActiveReservations: number | "";
  maxReservationsPerDay: number | "";
  maxDurationHours: number | "";
  maxConcurrentPerType: number | "";
  maxSeriesOccurrences: number | "";
  maxSubmissionsPerHour: number | "";
  bypassHardLimits: boolean;
}

interface HardLimitsTabProps {
  hardLimitsState: HardLimitsFormState;
  setHardLimitsState: React.Dispatch<React.SetStateAction<HardLimitsFormState>>;
  loadingLimits: boolean;
  savingLimits: boolean;
  onSave: (e: React.FormEvent) => void;
}

const HARD_LIMIT_HELP = {
  activeReservations: {
    title: "Active reservations",
    text: "Keeps one member from holding too many Pending or Approved bookings at once. When reached, a new request needs admin approval.",
  },
  reservationsPerDay: {
    title: "Reservations per day",
    text: "Spreads new booking requests across members each day. When reached, reserve on another day or review the request manually.",
  },
  durationHours: {
    title: "Booking duration",
    text: "Keeps individual sessions reasonably short so others can use the instrument. Longer requests need to be shortened or reviewed.",
  },
  concurrentPerType: {
    title: "Same-category bookings",
    text: "Prevents one member from holding too many instruments in the same category at the same time. A different category or admin review may help.",
  },
  seriesOccurrences: {
    title: "Recurring occurrences",
    text: "Keeps one recurring series from reserving too many dates. Reduce the dates or create another series later.",
  },
  submissionsPerHour: {
    title: "Submission rate",
    text: "Prevents rapid repeat submissions and accidental overbooking. This limit blocks submission temporarily; wait and try again later.",
  },
} as const;

type LimitHelpKey = keyof typeof HARD_LIMIT_HELP;

export const HardLimitsTab: React.FC<HardLimitsTabProps> = ({
  hardLimitsState,
  setHardLimitsState,
  loadingLimits,
  savingLimits,
  onSave,
}) => {
  const { t } = useTranslation();
  const [activeLimitHelp, setActiveLimitHelp] = useState<LimitHelpKey | null>(null);

  const toggleLimitHelp = (key: LimitHelpKey) => {
    setActiveLimitHelp((prev) => (prev === key ? null : key));
  };

  const renderLimitHelpToggle = (key: LimitHelpKey) => {
    const isExpanded = activeLimitHelp === key;
    return (
      <button
        type="button"
        onClick={() => toggleLimitHelp(key)}
        aria-label={`Toggle help for ${HARD_LIMIT_HELP[key].title}`}
        aria-expanded={isExpanded}
        className="inline-flex items-center text-stone-400 hover:text-amber-800 transition-colors p-0.5 rounded cursor-pointer"
        title="More details"
      >
        <Info className="w-3.5 h-3.5" />
      </button>
    );
  };

  const renderLimitHelp = (key: LimitHelpKey) => {
    if (activeLimitHelp !== key) return null;
    return (
      <div className="mt-1.5 p-2 rounded-lg bg-stone-100 border border-stone-200 text-[11px] text-stone-600 leading-normal animate-in fade-in duration-150">
        {HARD_LIMIT_HELP[key].text}
      </div>
    );
  };

  return (
    <div className="bg-white border border-stone-200 rounded-2xl p-5 shadow-2xs space-y-4">
      <div className="border-b border-stone-100 pb-3">
        <h2 className="font-bold text-stone-900 text-sm">
          {t("admin.hardLimits.title")}
        </h2>
        <p className="text-xs text-stone-500">
          {t("admin.hardLimits.subtitle")}
        </p>
      </div>

      {loadingLimits ? (
        <div className="py-12 flex flex-col items-center gap-2 text-stone-500">
          <RefreshCw className="w-4 h-4 animate-spin text-amber-700" />
          <div className="text-xs">{t("admin.hardLimits.loading")}</div>
        </div>
      ) : (
        <form onSubmit={onSave} className="space-y-4">
          <div className="flex items-center justify-between rounded-xl border border-stone-200 bg-stone-50 px-3 py-2">
            <div>
              <div className="font-bold text-stone-800 text-xs">
                {t("admin.hardLimits.bypassTitle")}
              </div>
              <div className="text-[11px] text-stone-500">
                {hardLimitsState.bypassHardLimits
                  ? t("admin.hardLimits.bypassOffDesc")
                  : t("admin.hardLimits.bypassOnDesc")}
              </div>
            </div>
            <button
              type="button"
              aria-label="Toggle hard limit bypass"
              onClick={() =>
                setHardLimitsState({
                  ...hardLimitsState,
                  bypassHardLimits: !hardLimitsState.bypassHardLimits,
                })
              }
              className={`relative inline-flex h-7 w-12 items-center rounded-full transition-colors ${
                hardLimitsState.bypassHardLimits
                  ? "bg-stone-300"
                  : "bg-amber-700"
              }`}
            >
              <span
                className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${
                  hardLimitsState.bypassHardLimits
                    ? "translate-x-1"
                    : "translate-x-6"
                }`}
              />
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <div>
              <div className="flex items-center gap-1.5 mb-1">
                <label
                  htmlFor="input-max-active-reservations"
                  className="font-bold text-stone-700"
                >
                  {t("admin.hardLimits.maxActiveReservations")}
                </label>
                {renderLimitHelpToggle("activeReservations")}
              </div>
              <input
                id="input-max-active-reservations"
                type="number"
                min="1"
                max="20"
                value={hardLimitsState.maxActiveReservations ?? ""}
                onChange={(e) =>
                  setHardLimitsState({
                    ...hardLimitsState,
                    maxActiveReservations:
                      e.target.value === ""
                        ? ""
                        : parseInt(e.target.value, 10),
                  })
                }
                className="w-full p-2.5 bg-stone-50 border border-stone-200 rounded-xl text-stone-900"
              />
              {renderLimitHelp("activeReservations")}
            </div>

            <div>
              <div className="flex items-center gap-1.5 mb-1">
                <label
                  htmlFor="input-max-reservations-per-day"
                  className="font-bold text-stone-700"
                >
                  {t("admin.hardLimits.maxReservationsPerDay")}
                </label>
                {renderLimitHelpToggle("reservationsPerDay")}
              </div>
              <input
                id="input-max-reservations-per-day"
                type="number"
                min="1"
                max="10"
                value={hardLimitsState.maxReservationsPerDay ?? ""}
                onChange={(e) =>
                  setHardLimitsState({
                    ...hardLimitsState,
                    maxReservationsPerDay:
                      e.target.value === ""
                        ? ""
                        : parseInt(e.target.value, 10),
                  })
                }
                className="w-full p-2.5 bg-stone-50 border border-stone-200 rounded-xl text-stone-900"
              />
              {renderLimitHelp("reservationsPerDay")}
            </div>

            <div>
              <div className="flex items-center gap-1.5 mb-1">
                <label
                  htmlFor="input-max-duration-hours"
                  className="font-bold text-stone-700"
                >
                  {t("admin.hardLimits.maxDurationHours")}
                </label>
                {renderLimitHelpToggle("durationHours")}
              </div>
              <input
                id="input-max-duration-hours"
                type="number"
                min="1"
                max="12"
                value={hardLimitsState.maxDurationHours ?? ""}
                onChange={(e) =>
                  setHardLimitsState({
                    ...hardLimitsState,
                    maxDurationHours:
                      e.target.value === ""
                        ? ""
                        : parseInt(e.target.value, 10),
                  })
                }
                className="w-full p-2.5 bg-stone-50 border border-stone-200 rounded-xl text-stone-900"
              />
              {renderLimitHelp("durationHours")}
            </div>

            <div>
              <div className="flex items-center gap-1.5 mb-1">
                <label
                  htmlFor="input-max-concurrent-per-type"
                  className="font-bold text-stone-700"
                >
                  {t("admin.hardLimits.maxConcurrentPerType")}
                </label>
                {renderLimitHelpToggle("concurrentPerType")}
              </div>
              <input
                id="input-max-concurrent-per-type"
                type="number"
                min="1"
                max="5"
                value={hardLimitsState.maxConcurrentPerType ?? ""}
                onChange={(e) =>
                  setHardLimitsState({
                    ...hardLimitsState,
                    maxConcurrentPerType:
                      e.target.value === ""
                        ? ""
                        : parseInt(e.target.value, 10),
                  })
                }
                className="w-full p-2.5 bg-stone-50 border border-stone-200 rounded-xl text-stone-900"
              />
              {renderLimitHelp("concurrentPerType")}
            </div>

            <div>
              <div className="flex items-center gap-1.5 mb-1">
                <label
                  htmlFor="input-max-series-occurrences"
                  className="font-bold text-stone-700"
                >
                  {t("admin.hardLimits.maxSeriesOccurrences")}
                </label>
                {renderLimitHelpToggle("seriesOccurrences")}
              </div>
              <input
                id="input-max-series-occurrences"
                type="number"
                min="2"
                max="20"
                value={hardLimitsState.maxSeriesOccurrences ?? ""}
                onChange={(e) =>
                  setHardLimitsState({
                    ...hardLimitsState,
                    maxSeriesOccurrences:
                      e.target.value === ""
                        ? ""
                        : parseInt(e.target.value, 10),
                  })
                }
                className="w-full p-2.5 bg-stone-50 border border-stone-200 rounded-xl text-stone-900"
              />
              {renderLimitHelp("seriesOccurrences")}
            </div>

            <div>
              <div className="flex items-center gap-1.5 mb-1">
                <label
                  htmlFor="input-max-submissions-per-hour"
                  className="font-bold text-stone-700"
                >
                  {t("admin.hardLimits.maxSubmissionsPerHour")}
                </label>
                {renderLimitHelpToggle("submissionsPerHour")}
              </div>
              <input
                id="input-max-submissions-per-hour"
                type="number"
                min="5"
                max="50"
                value={hardLimitsState.maxSubmissionsPerHour ?? ""}
                onChange={(e) =>
                  setHardLimitsState({
                    ...hardLimitsState,
                    maxSubmissionsPerHour:
                      e.target.value === ""
                        ? ""
                        : parseInt(e.target.value, 10),
                  })
                }
                className="w-full p-2.5 bg-stone-50 border border-stone-200 rounded-xl text-stone-900"
              />
              {renderLimitHelp("submissionsPerHour")}
            </div>
          </div>

          <div className="pt-3 border-t border-stone-100 flex justify-end">
            <button
              type="submit"
              disabled={savingLimits}
              className="px-4 py-2 rounded-xl bg-amber-800 hover:bg-amber-900 disabled:opacity-50 text-white font-bold text-xs transition cursor-pointer shadow-xs"
            >
              {savingLimits
                ? t("admin.hardLimits.saving")
                : t("admin.hardLimits.saveButton")}
            </button>
          </div>
        </form>
      )}
    </div>
  );
};
