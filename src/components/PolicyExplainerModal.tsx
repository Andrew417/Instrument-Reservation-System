import React from "react";
import {
  Info,
  X,
  Zap,
  ClipboardCheck,
  CheckCircle2,
  Clock,
  Layers,
  CalendarDays,
  Timer,
  Repeat,
  Gauge,
  Phone,
  DollarSign,
  Upload,
  ShieldCheck,
  AlertTriangle,
} from "lucide-react";

interface HardLimitExplainer {
  icon: React.ReactNode;
  title: string;
  description: string;
}

const HARD_LIMIT_EXPLAINERS: HardLimitExplainer[] = [
  {
    icon: <Layers className="w-4 h-4 text-amber-800" />,
    title: "Active Reservations",
    description:
      "There's a cap on how many Pending + Approved reservations you can hold at once. A recurring series counts as a single reservation toward this cap, no matter how many dates it covers.",
  },
  {
    icon: <CalendarDays className="w-4 h-4 text-amber-800" />,
    title: "Reservations per Day",
    description:
      "There's a cap on how many new reservations you can submit in a single day.",
  },
  {
    icon: <Timer className="w-4 h-4 text-amber-800" />,
    title: "Duration per Reservation",
    description:
      "Each individual reservation has a maximum length. Longer sessions need to be split into multiple bookings.",
  },
  {
    icon: <Repeat className="w-4 h-4 text-amber-800" />,
    title: "Same-Type Instrument Limit",
    description:
      "There's a cap on how many instruments of the same type (e.g. Drums) you can hold at the same time. Unlike the active-reservations cap, a recurring series counts every date individually here.",
  },
  {
    icon: <Gauge className="w-4 h-4 text-amber-800" />,
    title: "Submission Rate",
    description:
      "There's a cap on how many reservation submissions you can make within a short rolling window, to prevent spam. Going over this blocks the submission outright.",
  },
];

export interface PolicyExplainerModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const PolicyExplainerModal: React.FC<PolicyExplainerModalProps> = ({
  isOpen,
  onClose,
}) => {
  if (!isOpen) return null;

  return (
    <div
      id="policy-explainer-modal-backdrop"
      className="fixed inset-0 z-50 bg-stone-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto"
    >
      <div
        id="policy-explainer-modal"
        className="bg-white rounded-3xl border border-stone-200 shadow-2xl max-w-2xl w-full my-auto overflow-hidden animate-in fade-in zoom-in-95 duration-150 max-h-[92vh] flex flex-col"
      >
        {/* Header */}
        <div className="bg-stone-900 text-white px-6 py-5 flex items-center justify-between border-b border-stone-800 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-800 text-amber-100 flex items-center justify-center font-bold shadow-xs">
              <Info className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white leading-tight">
                Booking Policy Guide
              </h2>
              <p className="text-xs text-stone-400">
                How reservations get approved
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-xl bg-stone-800 text-stone-400 hover:text-white hover:bg-stone-700 flex items-center justify-center transition cursor-pointer"
            aria-label="Close modal"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="p-6 sm:p-7 overflow-y-auto space-y-6 flex-1">
          {/* 1. Instant vs Manual */}
          <div className="space-y-2.5">
            <div className="flex items-center gap-2 text-xs font-bold text-stone-800">
              <ClipboardCheck className="w-4 h-4 text-amber-800" />
              <span>Booking Modes</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="p-4 bg-emerald-50/70 border border-emerald-200 rounded-2xl space-y-2">
                <div className="flex items-center gap-2 text-xs font-bold text-emerald-900">
                  <Zap className="w-4 h-4 text-emerald-700" />
                  <span>Instant Mode</span>
                </div>
                <p className="text-xs text-emerald-900/80 leading-relaxed">
                  If the slot is free and you're within your fair-usage limits,
                  your reservation is confirmed immediately — no admin review
                  needed.
                </p>
              </div>

              <div className="p-4 bg-amber-50/70 border border-amber-200 rounded-2xl space-y-2">
                <div className="flex items-center gap-2 text-xs font-bold text-amber-900">
                  <Clock className="w-4 h-4 text-amber-700" />
                  <span>Manual Mode</span>
                </div>
                <p className="text-xs text-amber-900/80 leading-relaxed">
                  Every request on this instrument goes to an admin for review
                  before it's confirmed, regardless of your usage limits.
                </p>
              </div>
            </div>

            <p className="text-[11px] text-stone-500 leading-relaxed pt-0.5">
              Booking mode is set per instrument, not app-wide — check the mode
              badge on each instrument before booking.
            </p>
          </div>

          {/* 2. Hard Limits */}
          <div className="space-y-2.5">
            <div className="flex items-center gap-2 text-xs font-bold text-stone-800">
              <ShieldCheck className="w-4 h-4 text-amber-800" />
              <span>Fair Usage Limits</span>
            </div>
            <p className="text-xs text-stone-600 leading-relaxed">
              To keep instruments available for everyone, a few limits apply to
              each member. Most of them don't block your request outright —
              going over just means an admin reviews it instead of it being
              confirmed automatically.
            </p>

            <div className="border border-stone-200 rounded-2xl divide-y divide-stone-100 bg-stone-50/50">
              {HARD_LIMIT_EXPLAINERS.map((limit) => (
                <div key={limit.title} className="p-3.5 flex items-start gap-3">
                  <div className="w-8 h-8 rounded-xl bg-amber-100/70 border border-amber-200 flex items-center justify-center shrink-0">
                    {limit.icon}
                  </div>
                  <div className="text-xs space-y-0.5">
                    <div className="font-bold text-stone-900">
                      {limit.title}
                    </div>
                    <div className="text-stone-600 leading-relaxed">
                      {limit.description}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="p-3.5 bg-red-50 border border-red-200 rounded-2xl flex items-start gap-2.5">
              <AlertTriangle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
              <p className="text-xs text-red-800 leading-relaxed">
                One thing is never bypassed: a slot that's already approved for
                someone else can't be booked, no matter your status or limits.
              </p>
            </div>
          </div>

          {/* 3. Outside-Church Fee & Payment Flow */}
          <div className="space-y-2.5">
            <div className="flex items-center gap-2 text-xs font-bold text-stone-800">
              <DollarSign className="w-4 h-4 text-amber-800" />
              <span>Outside-Church Fee & Payment</span>
            </div>
            <p className="text-xs text-stone-600 leading-relaxed">
              Using an instrument inside the church is free. Taking it to an
              outside performance carries a per-day fee, shown on the calendar
              before you open the reservation form.
            </p>

            <div className="border border-stone-200 rounded-2xl divide-y divide-stone-100 bg-stone-50/50">
              <div className="p-3.5 flex items-start gap-3">
                <div className="w-8 h-8 rounded-xl bg-amber-100/70 border border-amber-200 flex items-center justify-center shrink-0">
                  <CheckCircle2 className="w-4 h-4 text-amber-800" />
                </div>
                <div className="text-xs space-y-0.5">
                  <div className="font-bold text-stone-900">
                    1. Check Outside-Church & Acknowledge the Fee
                  </div>
                  <div className="text-stone-600 leading-relaxed">
                    When submitting, mark the reservation as outside-church and
                    confirm you agree to pay the fee shown.
                  </div>
                </div>
              </div>

              <div className="p-3.5 flex items-start gap-3">
                <div className="w-8 h-8 rounded-xl bg-amber-100/70 border border-amber-200 flex items-center justify-center shrink-0">
                  <Phone className="w-4 h-4 text-amber-800" />
                </div>
                <div className="text-xs space-y-0.5">
                  <div className="font-bold text-stone-900">
                    2. Admin Calls You on WhatsApp
                  </div>
                  <div className="text-stone-600 leading-relaxed">
                    Once your request is reviewed, an admin will contact you on
                    WhatsApp to confirm details and arrange payment.
                  </div>
                </div>
              </div>

              <div className="p-3.5 flex items-start gap-3">
                <div className="w-8 h-8 rounded-xl bg-amber-100/70 border border-amber-200 flex items-center justify-center shrink-0">
                  <ShieldCheck className="w-4 h-4 text-amber-800" />
                </div>
                <div className="text-xs space-y-0.5">
                  <div className="font-bold text-stone-900">
                    3. Fee Is Locked In
                  </div>
                  <div className="text-stone-600 leading-relaxed">
                    The fee you owe is locked in at the time you submitted, so
                    later price changes don't affect it.
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 bg-stone-50 border-t border-stone-200 flex items-center justify-end shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-stone-900 hover:bg-stone-800 text-white text-xs font-bold rounded-xl transition cursor-pointer"
          >
            Got It
          </button>
        </div>
      </div>
    </div>
  );
};
