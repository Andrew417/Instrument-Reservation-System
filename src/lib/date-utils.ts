/**
 * Date and Time utilities for consistent date/time handling across the app.
 */

/**
 * Returns YYYY-MM-DD in the user's local timezone
 */
export function getLocalDateString(d: Date = new Date()): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Returns today's date string (YYYY-MM-DD) in local time
 */
export function getTodayDateString(): string {
  return getLocalDateString(new Date());
}

/**
 * Safely parse a YYYY-MM-DD string into a local Date object without timezone offset issues
 */
export function parseLocalDate(dateStr: string): Date {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, m - 1, d, 0, 0, 0, 0);
}

/**
 * Safely add or subtract days from a YYYY-MM-DD date string
 */
export function addDaysToDateString(dateStr: string, days: number): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  const date = new Date(y, m - 1, d + days, 0, 0, 0, 0);
  return getLocalDateString(date);
}

/**
 * Format a YYYY-MM-DD string into human-readable display (e.g. "Monday, Aug 31, 2026")
 */
export function formatDisplayDate(dateStr: string): string {
  const date = parseLocalDate(dateStr);
  return date.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

/**
 * Formats HH:mm string (24-hour) to 12-hour AM/PM format (e.g. "09:00" -> "9:00 AM", "14:30" -> "2:30 PM")
 */
export function formatHhmmTo12Hour(hhmm: string): string {
  if (!hhmm) return '';
  const [hStr, mStr] = hhmm.split(':');
  let h = parseInt(hStr, 10);
  const ampm = h >= 12 ? 'PM' : 'AM';
  if (h === 0) h = 12;
  else if (h > 12) h -= 12;
  return `${h}:${mStr} ${ampm}`;
}
