/**
 * Standard reservation working bounds and time slots.
 * Strict Cairo working bounds: 09:00 to 22:00 (13 hours).
 */

export const WORKING_HOURS = {
  start: "09:00",
  end: "22:00",
} as const;

export const FULL_DAY_START = "09:00";
export const FULL_DAY_END = "22:00";

/**
 * 30-minute intervals from 09:00 to 22:00 (27 slots inclusive: 09:00, 09:30, ..., 22:00).
 */
export const TIME_SLOTS: string[] = (() => {
  const slots: string[] = [];
  for (let hour = 9; hour <= 21; hour++) {
    const hStr = hour < 10 ? `0${hour}` : `${hour}`;
    slots.push(`${hStr}:00`);
    slots.push(`${hStr}:30`);
  }
  slots.push("22:00");
  return slots;
})();

/**
 * 30-minute start-time slots from 09:00 to 21:30 (26 slots).
 */
export const START_TIME_SLOTS: string[] = TIME_SLOTS.slice(0, -1);

