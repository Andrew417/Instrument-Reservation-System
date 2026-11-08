/**
 * Helper functions to format instrument names consistently across the app.
 *
 * Rules:
 * - Admin users: Always see normal instrument name (e.g. "Yamaha E-09").
 *   Admins do NOT see alias beside the instrument name (no "Yamaha E09 - red piano").
 *   (In the Availability Calendar and in Admin management tools, admins see the alias as a badge).
 * - Regular users: Everywhere else in the app (outside the Availability Calendar header),
 *   if an instrument has an alias, they see: "{name} - {alias}" (e.g. "Yamaha E09 - red piano").
 *   If no alias is set, they see "{name}".
 * - Availability Calendar:
 *   Both users and admins see the instrument name, with the alias shown as a badge under it.
 */

export function getInstrumentDisplayName(
  instrument: { name?: string | null; alias?: string | null } | null | undefined,
  isAdmin: boolean = false,
): string {
  if (!instrument || !instrument.name) return "";
  const name = instrument.name.trim();
  const alias = instrument.alias?.trim();
  if (isAdmin || !alias) {
    return name;
  }
  // Prevent duplicate concatenation if string already contains the alias
  if (name.toLowerCase().endsWith(` - ${alias.toLowerCase()}`)) {
    return name;
  }
  return `${name} - ${alias}`;
}

export function getReservationInstrumentDisplayName(
  reservation: {
    instrument_name?: string | null;
    instrumentName?: string | null;
    instrument_alias?: string | null;
    instrumentAlias?: string | null;
    alias?: string | null;
    instrument?: { name?: string | null; alias?: string | null } | null;
    requested_type?: string | null;
    requestedType?: string | null;
    is_type_request?: boolean;
    instrument_id?: string | null;
  } | null | undefined,
  isAdmin: boolean = false,
): string {
  if (!reservation) return "";
  const rawName = (
    reservation.instrument_name ||
    reservation.instrumentName ||
    reservation.instrument?.name ||
    reservation.requested_type ||
    reservation.requestedType ||
    ""
  ).trim();

  const alias = (
    reservation.instrument_alias ||
    reservation.instrumentAlias ||
    reservation.alias ||
    reservation.instrument?.alias ||
    ""
  ).trim();

  if (!rawName) return "";
  if (isAdmin || !alias) {
    return rawName;
  }
  if (rawName.toLowerCase().endsWith(` - ${alias.toLowerCase()}`)) {
    return rawName;
  }
  return `${rawName} - ${alias}`;
}

/**
 * Formats instrument option labels for dropdown selects (e.g. ReservationFormModal, SeriesBuilderModal, EditReservationModal).
 *
 * Follows exact required format:
 * - Acoustic Guitar #1 (Strings)
 * - Acoustic Guitar #1 (Strings) - [Alias Name]
 * - Grand Piano (Sanctuary) (Keyboard) — [Youth Fellowship]
 * - Grand Piano (Sanctuary) (Keyboard) — [Youth Fellowship] - [Alias Name]
 */
export function formatInstrumentOptionLabel(
  instrument: {
    name?: string | null;
    type?: string | null;
    alias?: string | null;
    serviceName?: string | null;
    service_name?: string | null;
    visibilityLevel?: string | null;
    visibility_level?: string | null;
    isOutOfService?: boolean | null;
    is_out_of_service?: boolean | null;
    bookingMode?: string | null;
  } | null | undefined,
  options?: {
    showType?: boolean;
    showTag?: boolean;
    showBookingMode?: boolean;
    bookingModeLabel?: string;
  },
): string {
  if (!instrument || !instrument.name) return "";
  const name = instrument.name.trim();
  const shouldShowType = options?.showType ?? true;
  const type =
    shouldShowType && instrument.type ? ` (${instrument.type.trim()})` : "";

  const vis = instrument.visibilityLevel || (instrument as any).visibility_level;
  const isOOS =
    instrument.isOutOfService || (instrument as any).is_out_of_service;
  let tag = "";
  if (options?.showTag) {
    if (isOOS) {
      tag = " — [Out of Service]";
    } else if (vis === "room_stock") {
      tag = " — [Room Stock]";
    } else if (vis === "musician") {
      tag = " — [Musicians Only]";
    }
  }

  const serviceName = (
    instrument.serviceName ||
    (instrument as any).service_name ||
    ""
  ).trim();
  const serviceTag = serviceName ? ` — [${serviceName}]` : "";

  const alias = instrument.alias?.trim();
  const aliasTag = alias ? ` - [${alias}]` : "";

  const modeTag =
    options?.showBookingMode && options?.bookingModeLabel
      ? ` — ${options.bookingModeLabel}`
      : "";

  return `${name}${type}${tag}${serviceTag}${aliasTag}${modeTag}`;
}

