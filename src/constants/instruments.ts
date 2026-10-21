/**
 * Instrument inventory constants and categories.
 */

export const INSTRUMENT_CATEGORIES: string[] = [
  "Keyboards",
  "Drums",
  "Acoustic Guitars",
  "Electric Guitars",
  "Bass Guitars",
  "Wind & Brass",
  "Strings",
  "Audio Equipment",
];

export const DEFAULT_INSTRUMENT_TYPE = "Keyboards";

export const BOOKING_MODES = {
  INSTANT: "instant",
  MANUAL: "manual",
} as const;

export type BookingMode = (typeof BOOKING_MODES)[keyof typeof BOOKING_MODES];
