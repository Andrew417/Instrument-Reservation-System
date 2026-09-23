/**
 * Key-Holder Handover Sheet — WhatsApp & Print templates
 *
 * Design goals:
 * - WhatsApp-safe: no tabs, no markdown tables (WhatsApp collapses them).
 *   Uses stacked per-reservation blocks grouped by date.
 * - Arabic labels by default (RTL-friendly), but times remain 12h AM/PM English.
 * - Full list, no truncation.
 */

import { HandoverReservationItem } from "./handover-export";
import { formatHhmmTo12Hour } from "./date-utils";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

export type HandoverLocale = "ar" | "en";

export interface HandoverTemplateOptions {
  locale?: HandoverLocale;
  /** Optional header title override. */
  title?: string;
}

/* ------------------------------------------------------------------ */
/*  Static labels (AR default / EN fallback)                           */
/* ------------------------------------------------------------------ */

const LABELS = {
  ar: {
    title: "حجوزات غرفة الآلات الموسيقية",
    totalLine: (n: number) => `إجمالي الحجوزات: ${n}`,
    dateHeader: (d: string) => `${d}`,
    separator: "━━━━━━━━━━━━━━━━━━",
    fieldService: "الخدمة",
    fieldTime: "الوقت",
    fieldInstrument: "الآلة",
    fieldMusician: "العازف",
    fieldReservedBy: "الحاجز",
    fieldPhone: "الهاتف",
    fieldUsage: "النوع",
    fieldNotes: "ملاحظات",
    usageOutside: "خارج الكنيسة",
    usageInChurch: "داخل الكنيسة",
    generalService: "خدمة عامة",
    unknownMember: "عضو غير معروف",
    empty: "لا توجد حجوزات في هذه الفترة.",
  },
  en: {
    title: "🎼 Instrument Room Handover Sheet",
    totalLine: (n: number) => `🔢 Total reservations: ${n}`,
    dateHeader: (d: string) => `📅 ${d}`,
    separator: "━━━━━━━━━━━━━━━━━━",
    fieldService: "Service",
    fieldTime: "Time",
    fieldInstrument: "Instrument",
    fieldMusician: "Musician",
    fieldReservedBy: "Reserved By",
    fieldPhone: "Phone",
    fieldUsage: "Usage",
    fieldNotes: "Notes",
    usageOutside: "Outside Church",
    usageInChurch: "In-Church",
    generalService: "General Service",
    unknownMember: "Unknown Member",
    empty: "No reservations in this period.",
  },
} as const;

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

/** "2026-10-03" -> "2026-10-03" (kept ISO, WhatsApp-safe & locale-neutral). */
function formatDateForWhatsApp(iso: string): string {
  if (!iso) return "";
  // If you later want "السبت 3 أكتوبر 2026", swap this line.
  return iso;
}

/** Build "9:00 AM - 10:00 PM" using existing 12-hour formatter. */
function formatTimeRange(startHhmm: string, endHhmm: string): string {
  const s = startHhmm ? formatHhmmTo12Hour(startHhmm) : "";
  const e = endHhmm ? formatHhmmTo12Hour(endHhmm) : "";
  if (s && e) return `${s} - ${e}`;
  return s || e || "";
}

/** Group reservations by reservation_date, preserving sort order. */
function groupByDate(
  items: HandoverReservationItem[],
): Array<{ date: string; rows: HandoverReservationItem[] }> {
  const map = new Map<string, HandoverReservationItem[]>();
  for (const item of items) {
    const key = item.reservation_date || "";
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(item);
  }
  // Sort dates ascending; rows inside each date already sorted by caller
  return Array.from(map.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([date, rows]) => ({ date, rows }));
}

/** Collapse whitespace + trim, so WhatsApp doesn't render ragged gaps. */
function clean(v: string | null | undefined): string {
  if (!v) return "";
  return String(v).replace(/\s+/g, " ").trim();
}

/* ------------------------------------------------------------------ */
/*  WhatsApp message builder                                           */
/* ------------------------------------------------------------------ */

export function buildHandoverWhatsAppMessage(
  reservations: HandoverReservationItem[],
  options: HandoverTemplateOptions = {},
): string {
  const locale: HandoverLocale = options.locale ?? "ar";
  const L = LABELS[locale];
  const title = options.title ?? L.title;

  const lines: string[] = [];
  lines.push(`*${title}*`);
  lines.push(`*${L.totalLine(reservations.length)}*`);
  lines.push("");

  if (reservations.length === 0) {
    lines.push(L.empty);
    return lines.join("\n");
  }

  const groups = groupByDate(reservations);

  groups.forEach((group, gIdx) => {
    lines.push(L.separator);
    lines.push(`*${L.dateHeader(formatDateForWhatsApp(group.date))}*`);
    lines.push(L.separator);

    group.rows.forEach((r, rIdx) => {
      const index = rIdx + 1;
      const service = clean(r.service_name) || L.generalService;
      const time = formatTimeRange(r.start_hhmm, r.end_hhmm);
      const instrument = [clean(r.instrument_name), clean(r.instrument_type)]
        .filter(Boolean)
        .join(" · ");
      const musician = clean(r.musician_name);
      const reservedBy = clean(r.user_name) || L.unknownMember;
      const phone = clean(r.user_phone) || "N/A";
      const usage =
        r.reservation_type === "outside_church"
          ? L.usageOutside
          : L.usageInChurch;
      const note = clean(r.note);

      lines.push(`*${index}. ${service}*`);
      if (time) lines.push(`${L.fieldTime}: \u2066${time}\u2069`);
      if (instrument) lines.push(`${L.fieldInstrument}: ${instrument}`);
      if (musician) lines.push(`${L.fieldMusician}: ${musician}`);
      lines.push(`${L.fieldReservedBy}: ${reservedBy}`);
      lines.push(`${L.fieldPhone}: ${phone}`);
      lines.push(`${L.fieldUsage}: ${usage}`);
      if (note) lines.push(`${L.fieldNotes}: ${note}`);

      // Blank line between reservations, but not after the last one in a group
      if (rIdx < group.rows.length - 1) lines.push("");
    });

    // Blank line between date groups
    if (gIdx < groups.length - 1) lines.push("");
  });

  return lines.join("\n");
}

/* ------------------------------------------------------------------ */
/*  WhatsApp deep-link helper (optional)                               */
/* ------------------------------------------------------------------ */

/**
 * Returns a wa.me URL with the message prefilled. Opens WhatsApp and lets the
 * admin pick the recipient (key-holder). If you prefer clipboard-only, ignore
 * this and keep using navigator.clipboard.writeText(...).
 */

/**
 * Share the handover message via the best available channel:
 * 1. Native OS share sheet (Web Share API) — mobile + modern desktop
 * 2. WhatsApp deep-link (wa.me) — universal fallback
 * 3. Clipboard — last resort
 *
 * Returns which channel was used so the caller can show the right toast.
 */
/**
 * Share the handover message via the best available channel:
 * - Mobile / tablet (touch): native OS share sheet, WhatsApp is one target
 * - Desktop: WhatsApp Web deep-link (wa.me) — matches the previous behavior
 * - Popup blocked: clipboard fallback
 */
export async function shareHandoverMessage(
  reservations: HandoverReservationItem[],
  options: HandoverTemplateOptions = {},
): Promise<"native" | "whatsapp" | "clipboard"> {
  const message = buildHandoverWhatsAppMessage(reservations, options);

  // 1. Native share sheet — MOBILE / TOUCH ONLY.
  //    On desktop we intentionally skip this so the admin goes straight to
  //    WhatsApp Web, matching the previous behavior.
  const isTouchDevice =
    typeof window !== "undefined" &&
    ("ontouchstart" in window ||
      (typeof navigator !== "undefined" && navigator.maxTouchPoints > 0));

  if (
    isTouchDevice &&
    typeof navigator !== "undefined" &&
    typeof navigator.share === "function"
  ) {
    try {
      await navigator.share({
        title: options.title ?? "Instrument Room Handover",
        text: message,
      });
      return "native";
    } catch (err: any) {
      if (err && err.name === "AbortError") return "native";
      // Fall through to wa.me on any other error
    }
  }

  // 2. WhatsApp deep-link (desktop + mobile fallback)
  const url = `https://wa.me/?text=${encodeURIComponent(message)}`;
  const win = window.open(url, "_blank", "noopener,noreferrer");

  // 3. Popup blocked → clipboard
  if (!win) {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(message);
      return "clipboard";
    }
  }

  return "whatsapp";
}

export function buildHandoverWhatsAppUrl(
  reservations: HandoverReservationItem[],
  options: HandoverTemplateOptions = {},
): string {
  const text = buildHandoverWhatsAppMessage(reservations, options);
  return `https://wa.me/?text=${encodeURIComponent(text)}`;
}

/* ------------------------------------------------------------------ */
/*  Print HTML builder (real <table>, unlike WhatsApp)                 */
/* ------------------------------------------------------------------ */

export function buildHandoverPrintHtml(
  reservations: HandoverReservationItem[],
  options: HandoverTemplateOptions = {},
): string {
  const locale: HandoverLocale = options.locale ?? "ar";
  const L = LABELS[locale];
  const title = options.title ?? L.title;
  const dir = locale === "ar" ? "rtl" : "ltr";

  const groups = groupByDate(reservations);

  const sectionsHtml = groups
    .map((group) => {
      const rowsHtml = group.rows
        .map((r) => {
          const time = formatTimeRange(r.start_hhmm, r.end_hhmm);
          const instrument = [
            clean(r.instrument_name),
            clean(r.instrument_type),
          ]
            .filter(Boolean)
            .join(" · ");
          const usage =
            r.reservation_type === "outside_church"
              ? L.usageOutside
              : L.usageInChurch;
          return `
            <tr>
              <td>${escapeHtml(clean(r.service_name) || L.generalService)}</td>
              <td>${escapeHtml(time)}</td>
              <td>${escapeHtml(instrument)}</td>
              <td>${escapeHtml(clean(r.musician_name))}</td>
              <td>${escapeHtml(clean(r.user_name) || L.unknownMember)}</td>
              <td>${escapeHtml(clean(r.user_phone) || "N/A")}</td>
              <td>${escapeHtml(usage)}</td>
              <td>${escapeHtml(clean(r.note))}</td>
            </tr>`;
        })
        .join("");

      return `
        <section class="date-group">
          <h2>${escapeHtml(L.dateHeader(formatDateForWhatsApp(group.date)))}</h2>
          <table>
            <thead>
              <tr>
                <th>${escapeHtml(L.fieldService)}</th>
                <th>${escapeHtml(L.fieldTime)}</th>
                <th>${escapeHtml(L.fieldInstrument)}</th>
                <th>${escapeHtml(L.fieldMusician)}</th>
                <th>${escapeHtml(L.fieldReservedBy)}</th>
                <th>${escapeHtml(L.fieldPhone)}</th>
                <th>${escapeHtml(L.fieldUsage)}</th>
                <th>${escapeHtml(L.fieldNotes)}</th>
              </tr>
            </thead>
            <tbody>${rowsHtml}</tbody>
          </table>
        </section>`;
    })
    .join("");

  return `<!doctype html>
<html dir="${dir}" lang="${locale}">
<head>
<meta charset="utf-8" />
<title>${escapeHtml(title)}</title>
<style>
  * { box-sizing: border-box; }
  body {
    font-family: "Segoe UI", Tahoma, Arial, sans-serif;
    margin: 24px;
    color: #1e293b;
  }
  h1 { font-size: 20px; margin: 0 0 4px; }
  .meta { color: #475569; font-size: 13px; margin-bottom: 20px; }
  .date-group { margin-bottom: 24px; page-break-inside: avoid; }
  h2 {
    font-size: 15px;
    margin: 0 0 8px;
    padding: 6px 10px;
    background: #1e293b;
    color: #fff;
    border-radius: 6px;
  }
  table {
    width: 100%;
    border-collapse: collapse;
    font-size: 12px;
  }
  th, td {
    border: 1px solid #e2e8f0;
    padding: 6px 8px;
    text-align: start;
    vertical-align: middle;
  }
  th { background: #f1f5f9; font-weight: 600; }
  tbody tr:nth-child(even) { background: #f8fafc; }
  @media print {
    body { margin: 12px; }
    .date-group { page-break-inside: avoid; }
  }
</style>
</head>
<body>
  <h1>${escapeHtml(title)}</h1>
  <div class="meta">${escapeHtml(L.totalLine(reservations.length))}</div>
  ${reservations.length === 0 ? `<p>${escapeHtml(L.empty)}</p>` : sectionsHtml}
</body>
</html>`;
}

/** Open the print HTML in a new window and trigger the print dialog. */
export function printHandoverSheet(
  reservations: HandoverReservationItem[],
  options: HandoverTemplateOptions = {},
): void {
  const html = buildHandoverPrintHtml(reservations, options);
  const win = window.open("", "_blank", "noopener,noreferrer");
  if (!win) return;
  win.document.open();
  win.document.write(html);
  win.document.close();
  win.focus();
  // Give the browser a tick to lay out styles before printing
  setTimeout(() => win.print(), 250);
}

/* ------------------------------------------------------------------ */
/*  Internal utils                                                     */
/* ------------------------------------------------------------------ */

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
