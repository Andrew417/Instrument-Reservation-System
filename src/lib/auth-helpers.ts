/**
 * Converts a raw phone number into the required internal pseudo-email format:
 * {phone_number}@internal.church-app
 */
export function normalizePhoneNumber(rawPhone: string): string {
  // Remove any whitespace, dashes, parentheses, or unwanted symbols
  // Keep digits (and optional leading country code)
  return rawPhone.replace(/[^\d+]/g, '').trim();
}

export function phoneToPseudoEmail(rawPhone: string): string {
  const normalized = normalizePhoneNumber(rawPhone);
  // Remove leading '+' if present for email username compliance
  const safePhone = normalized.startsWith('+') ? normalized.slice(1) : normalized;
  return `${safePhone.toLowerCase()}@internal.church-app`;
}
