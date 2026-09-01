/**
 * Normalizes email address to lowercase and trimmed string
 */
export function normalizeEmail(email: string): string {
  if (!email) return '';
  return email.trim().toLowerCase();
}

/**
 * Validates basic email address format
 */
export function isValidEmail(email: string): boolean {
  if (!email || typeof email !== 'string') return false;
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return re.test(email.trim());
}

/**
 * Normalizes a raw phone number by removing spaces, dashes, parens
 */
export function normalizePhoneNumber(rawPhone: string): string {
  if (!rawPhone) return '';
  return rawPhone.replace(/[^\d+]/g, '').trim();
}

export function phoneToPseudoEmail(rawPhone: string): string {
  const normalized = normalizePhoneNumber(rawPhone);
  const safePhone = normalized.startsWith('+') ? normalized.slice(1) : normalized;
  return `${safePhone.toLowerCase()}@internal.church-app`;
}
