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

export const SESSION_TOKEN_KEY = "church_session_token_v1";
export const LEGACY_ADMIN_TOKEN_KEY = "admin_session_token";
export const USER_PROFILE_KEY = "church_user_profile_v1";

/**
 * Retrieves the current session token with fallback from memory/prop -> sessionStorage -> localStorage.
 */
export function getAuthSessionToken(explicitToken?: string | null): string | null {
  if (explicitToken) return explicitToken;
  if (typeof window === "undefined") return null;
  try {
    const sessionTok = sessionStorage.getItem(SESSION_TOKEN_KEY);
    if (sessionTok) return sessionTok;
    const localTok = localStorage.getItem(SESSION_TOKEN_KEY);
    if (localTok) return localTok;
    const adminTok = localStorage.getItem(LEGACY_ADMIN_TOKEN_KEY);
    if (adminTok) return adminTok;
  } catch {
    // ignore storage access errors
  }
  return null;
}

/**
 * Standard authenticated fetch helper targeting /api/admin endpoints.
 */
export async function adminFetch(
  endpoint: string,
  options: RequestInit = {},
  explicitToken?: string | null,
): Promise<Response> {
  const token = getAuthSessionToken(explicitToken);
  const res = await fetch(`/api/admin${endpoint}`, {
    ...options,
    cache: "no-store",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token || ""}`,
      ...(options.headers || {}),
    },
  });
  return res;
}

