/**
 * Helper utility for consistent reservant color assignment.
 * Each distinct reservant (by ID or name) receives a consistent assigned color
 * across all their bookings and views for Admin & Super Admin users.
 */

export interface ReservantColorTheme {
  id: string;
  name: string;
  bgClass: string;
  borderClass: string;
  nameClass: string;
  serviceClass: string;
  bgHex: string;
  borderHex: string;
  nameHex: string;
  serviceHex: string;
  dotHex: string;
}

export const RESERVANT_COLOR_PALETTES: ReservantColorTheme[] = [
  {
    id: 'indigo',
    name: 'Royal Indigo',
    bgClass: 'bg-indigo-950',
    borderClass: 'border-indigo-600',
    nameClass: 'text-indigo-200',
    serviceClass: 'text-indigo-300',
    bgHex: '#1e1b4b',
    borderHex: '#4f46e5',
    nameHex: '#c7d2fe',
    serviceHex: '#e0e7ff',
    dotHex: '#818cf8',
  },
  {
    id: 'emerald',
    name: 'Forest Emerald',
    bgClass: 'bg-emerald-950',
    borderClass: 'border-emerald-600',
    nameClass: 'text-emerald-200',
    serviceClass: 'text-emerald-300',
    bgHex: '#022c22',
    borderHex: '#059669',
    nameHex: '#a7f3d0',
    serviceHex: '#d1fae5',
    dotHex: '#34d399',
  },
  {
    id: 'blue',
    name: 'Cobalt Blue',
    bgClass: 'bg-blue-950',
    borderClass: 'border-blue-600',
    nameClass: 'text-blue-200',
    serviceClass: 'text-blue-300',
    bgHex: '#172554',
    borderHex: '#2563eb',
    nameHex: '#bfdbfe',
    serviceHex: '#dbeafe',
    dotHex: '#60a5fa',
  },
  {
    id: 'purple',
    name: 'Deep Purple',
    bgClass: 'bg-purple-950',
    borderClass: 'border-purple-600',
    nameClass: 'text-purple-200',
    serviceClass: 'text-purple-300',
    bgHex: '#3b0764',
    borderHex: '#9333ea',
    nameHex: '#e9d5ff',
    serviceHex: '#f3e8ff',
    dotHex: '#c084fc',
  },
  {
    id: 'rose',
    name: 'Crimson Rose',
    bgClass: 'bg-rose-950',
    borderClass: 'border-rose-600',
    nameClass: 'text-rose-200',
    serviceClass: 'text-rose-300',
    bgHex: '#4c0519',
    borderHex: '#e11d48',
    nameHex: '#fecdd3',
    serviceHex: '#ffe4e6',
    dotHex: '#fb7185',
  },
  {
    id: 'teal',
    name: 'Deep Teal',
    bgClass: 'bg-teal-950',
    borderClass: 'border-teal-600',
    nameClass: 'text-teal-200',
    serviceClass: 'text-teal-300',
    bgHex: '#042f2e',
    borderHex: '#0d9488',
    nameHex: '#99f6e4',
    serviceHex: '#ccfbf1',
    dotHex: '#2dd4bf',
  },
  {
    id: 'amber',
    name: 'Rich Amber',
    bgClass: 'bg-amber-950',
    borderClass: 'border-amber-600',
    nameClass: 'text-amber-200',
    serviceClass: 'text-amber-300',
    bgHex: '#451a03',
    borderHex: '#d97706',
    nameHex: '#fde68a',
    serviceHex: '#fef3c7',
    dotHex: '#fbbf24',
  },
  {
    id: 'cyan',
    name: 'Ocean Cyan',
    bgClass: 'bg-cyan-950',
    borderClass: 'border-cyan-600',
    nameClass: 'text-cyan-200',
    serviceClass: 'text-cyan-300',
    bgHex: '#083344',
    borderHex: '#0891b2',
    nameHex: '#a5f3fc',
    serviceHex: '#cffafe',
    dotHex: '#22d3ee',
  },
  {
    id: 'fuchsia',
    name: 'Fuchsia Plum',
    bgClass: 'bg-fuchsia-950',
    borderClass: 'border-fuchsia-600',
    nameClass: 'text-fuchsia-200',
    serviceClass: 'text-fuchsia-300',
    bgHex: '#4a044e',
    borderHex: '#c026d3',
    nameHex: '#f5d0fe',
    serviceHex: '#fae8ff',
    dotHex: '#e879f9',
  },
  {
    id: 'slate',
    name: 'Steel Slate',
    bgClass: 'bg-slate-900',
    borderClass: 'border-slate-500',
    nameClass: 'text-slate-200',
    serviceClass: 'text-slate-300',
    bgHex: '#0f172a',
    borderHex: '#64748b',
    nameHex: '#e2e8f0',
    serviceHex: '#cbd5e1',
    dotHex: '#94a3b8',
  },
  {
    id: 'orange',
    name: 'Burnt Orange',
    bgClass: 'bg-orange-950',
    borderClass: 'border-orange-600',
    nameClass: 'text-orange-200',
    serviceClass: 'text-orange-300',
    bgHex: '#431407',
    borderHex: '#ea580c',
    nameHex: '#fed7aa',
    serviceHex: '#ffedd5',
    dotHex: '#fb923c',
  },
  {
    id: 'violet',
    name: 'Electric Violet',
    bgClass: 'bg-violet-950',
    borderClass: 'border-violet-600',
    nameClass: 'text-violet-200',
    serviceClass: 'text-violet-300',
    bgHex: '#2e1065',
    borderHex: '#7c3aed',
    nameHex: '#ddd6fe',
    serviceHex: '#ede9fe',
    dotHex: '#a78bfa',
  },
];

/**
 * Deterministically maps any reservant identifier (userId, adminId, or name)
 * to a consistent assigned color theme.
 * Same user = same color across all their bookings and views.
 */
export function getReservantColorTheme(reservantKey?: string | null): ReservantColorTheme {
  if (!reservantKey || !reservantKey.trim()) {
    return RESERVANT_COLOR_PALETTES[0];
  }

  const cleanKey = reservantKey.trim().toLowerCase();
  let hash = 0;
  for (let i = 0; i < cleanKey.length; i++) {
    hash = (hash << 5) - hash + cleanKey.charCodeAt(i);
    hash |= 0; // Convert to 32bit integer
  }

  const index = Math.abs(hash) % RESERVANT_COLOR_PALETTES.length;
  return RESERVANT_COLOR_PALETTES[index];
}
