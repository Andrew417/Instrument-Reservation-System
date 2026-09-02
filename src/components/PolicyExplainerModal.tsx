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

            <div className="grid grid-cols-2 gap-2">
              <div className="p-3 bg-emerald-50/70 border border-emerald-200 rounded-xl space-y-1.5">
                <div className="flex items-center gap-1.5 text-[11px] font-bold text-emerald-900">
                  <Zap className="w-3.5 h-3.5 text-emerald-700" />
                  <span>Instant Mode</span>
                </div>
                <p className="text-[11px] text-emerald-900/80 leading-snug">
                  Free slot + within your limits = confirmed instantly.
                </p>
              </div>

              <div className="p-3 bg-amber-50/70 border border-amber-200 rounded-xl space-y-1.5">
                <div className="flex items-center gap-1.5 text-[11px] font-bold text-amber-900">
                  <Clock className="w-3.5 h-3.5 text-amber-700" />
                  <span>Manual Mode</span>
                </div>
                <p className="text-[11px] text-amber-900/80 leading-snug">
                  Always needs admin approval, regardless of limits.
                </p>
              </div>
            </div>

            <p className="text-[11px] text-stone-500 leading-relaxed pt-0.5">
              Set per instrument — check the badge before booking.
            </p>
          </div>

          {/* 2. Hard Limits */}
          <div className="space-y-2.5">
            <div className="space-y-2.5">
              <div className="flex items-center gap-2 text-xs font-bold text-stone-800">
                <ShieldCheck className="w-4 h-4 text-amber-800" />
                <span>Fair Usage Limits</span>
              </div>
              <p className="text-xs text-stone-600 leading-relaxed">
                A few limits apply per member to keep instruments available for
                everyone. If you go over one, your request isn't blocked — it
                just needs admin approval instead of being confirmed
                automatically. Only one limit (spam prevention) blocks
                submission outright.
              </p>

              <div className="p-3.5 bg-red-50 border border-red-200 rounded-2xl flex items-start gap-2.5">
                <AlertTriangle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                <p className="text-xs text-red-800 leading-relaxed">
                  Approved slots are never bookable by anyone else, no
                  exceptions.
                </p>
              </div>
            </div>
          </div>

          {/* 3. Outside-Church Fee & Payment Flow */}
          <div className="space-y-2.5">
            <div className="flex items-center gap-2 text-xs font-bold text-stone-800">
              <DollarSign className="w-4 h-4 text-amber-800" />
              <span>Outside-Church Fee & Payment</span>
            </div>
            <p className="text-xs text-stone-600 leading-relaxed">
              Free in-church. Outside performances cost a per-day fee, shown on
              the calendar before you book.
            </p>

            <div className="border border-stone-200 rounded-2xl divide-y divide-stone-100 bg-stone-50/50">
              <div className="p-3.5 flex items-start gap-3">
                <div className="w-8 h-8 rounded-xl bg-amber-100/70 border border-amber-200 flex items-center justify-center shrink-0">
                  <CheckCircle2 className="w-4 h-4 text-amber-800" />
                </div>
                <div className="text-xs space-y-0.5">
                  <div className="font-bold text-stone-900">1. Confirm Fee</div>
                  <div className="text-stone-600 leading-relaxed">
                    Mark the reservation as outside-church and agree to pay the
                    shown fee.
                  </div>
                </div>
              </div>

              <div className="p-3.5 flex items-start gap-3">
                <div className="w-8 h-8 rounded-xl bg-amber-100/70 border border-amber-200 flex items-center justify-center shrink-0">
                  <Phone className="w-4 h-4 text-amber-800" />
                </div>
                <div className="text-xs space-y-0.5">
                  <div className="font-bold text-stone-900">
                    2. WhatsApp Call
                  </div>
                  <div className="text-stone-600 leading-relaxed">
                    After admin review, you'll get a WhatsApp message to arrange
                    payment & approval.
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
