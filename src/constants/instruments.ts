/**
 * Instrument inventory constants and categories.
 */

export const INSTRUMENT_CATEGORIES: string[] = [
  "Piano",
  "Drums",
  "Percussion",
  "Violin",
  "Audio Equipment",
];

export const DEFAULT_INSTRUMENT_TYPE = "Piano";

export const BOOKING_MODES = {
  INSTANT: "instant",
  MANUAL: "manual",
} as const;

export type BookingMode = (typeof BOOKING_MODES)[keyof typeof BOOKING_MODES];
