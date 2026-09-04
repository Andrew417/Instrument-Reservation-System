import i18n from "./i18n.ts";

/**
 * Date and Time utilities for consistent date/time handling across the app.
 */

export const APP_TIME_ZONE = "Africa/Cairo";

export function getCairoParts(date: Date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: APP_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const values = Object.fromEntries(
    parts
      .filter(({ type }) => type !== "literal")
      .map(({ type, value }) => [type, Number(value)]),
  );
  return {
    year: values.year,
    month: values.month,
    day: values.day,
    hour: values.hour,
    minute: values.minute,
    second: values.second,
  };
}

export function getCairoDateString(date: Date = new Date()): string {
  const parts = getCairoParts(date);
  return `${parts.year}-${String(parts.month).padStart(2, "0")}-${String(parts.day).padStart(2, "0")}`;
}

export function getCairoTimeString(date: Date = new Date()): string {
  const parts = getCairoParts(date);
  return `${String(parts.hour).padStart(2, "0")}:${String(parts.minute).padStart(2, "0")}`;
}

export function formatCairoDateTime(date: Date): string {
  return `${getCairoDateString(date)} ${getCairoTimeString(date)}`;
}

/** Convert a Cairo wall-clock date/time into an instant. */
export function cairoDateTimeToDate(dateStr: string, timeStr: string): Date {
  const [year, month, day] = dateStr.split("-").map(Number);
  const [hour, minute] = timeStr.split(":").map(Number);
  const wallClock = Date.UTC(year, month - 1, day, hour, minute, 0, 0);
  let instant = new Date(wallClock);

  for (let attempt = 0; attempt < 2; attempt += 1) {
    const parts = getCairoParts(instant);
    const cairoWallClock = Date.UTC(
      parts.year,
      parts.month - 1,
      parts.day,
      parts.hour,
      parts.minute,
      parts.second,
    );
    instant = new Date(wallClock - (cairoWallClock - instant.getTime()));
  }

  return instant;
}

/**
 * Returns YYYY-MM-DD in the user's local timezone
 */
export function getLocalDateString(d: Date = new Date()): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/**
 * Returns today's date string (YYYY-MM-DD) in local time
 */
export function getTodayDateString(): string {
  return getCairoDateString();
}

/**
 * Safely parse a YYYY-MM-DD string into a local Date object without timezone offset issues
 */
export function parseLocalDate(dateStr: string): Date {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(y, m - 1, d, 0, 0, 0, 0);
}

/**
 * Safely add or subtract days from a YYYY-MM-DD date string
 */
export function addDaysToDateString(dateStr: string, days: number): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const date = new Date(y, m - 1, d + days, 0, 0, 0, 0);
  return getLocalDateString(date);
}

/**
 * Format a YYYY-MM-DD string into human-readable display (e.g. "Monday, Aug 31, 2026")
 * Always ensures Western digits (0-9) are used.
 */
export function formatDisplayDate(dateStr: string, locale?: string): string {
  if (!dateStr) return "";
  const date = parseLocalDate(dateStr);
  const activeLang = locale || i18n.language;
  const isAr = activeLang === "ar";
  return date.toLocaleDateString(isAr ? "ar-u-nu-latn" : "en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

/**
 * Formats HH:mm string (24-hour) to 12-hour format (e.g. "09:00" -> "9:00 AM", "14:30" -> "2:30 PM")
 * Always preserves Western digits (0-9). In Arabic mode, uses "ص" and "م".
 */
export function formatHhmmTo12Hour(hhmm: string, locale?: string): string {
  if (!hhmm) return "";
  const [hStr, mStr] = hhmm.split(":");
  let h = parseInt(hStr, 10);
  const isPM = h >= 12;
  if (h === 0) h = 12;
  else if (h > 12) h -= 12;
  
  const activeLang = locale || i18n.language;
  const isAr = activeLang === "ar";
  const ampm = isAr ? (isPM ? "م" : "ص") : isPM ? "PM" : "AM";
  return `${h}:${mStr} ${ampm}`;
}

