export const RESERVATION_STATUS_COLORS: Record<string, string> = {
  approved: "bg-emerald-50 text-emerald-800 border border-emerald-200",
  ongoing: "bg-sky-50 text-sky-800 border border-sky-200",
  pending: "bg-amber-50 text-amber-800 border border-amber-200",
  rejected: "bg-red-50 text-red-800 border border-red-200",
  auto_rejected: "bg-orange-50 text-orange-800 border border-orange-200",
  expired: "bg-stone-100 text-stone-500 border border-stone-300",
  cancelled: "bg-purple-50 text-purple-700 border border-purple-200",
  completed: "bg-blue-50 text-blue-800 border border-blue-200",
};

export const getStatusColor = (status: string) =>
  RESERVATION_STATUS_COLORS[status] ||
  "bg-stone-100 text-stone-700 border border-stone-200";
