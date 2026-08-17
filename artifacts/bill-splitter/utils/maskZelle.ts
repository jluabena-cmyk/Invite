/**
 * Validates and masks a Zelle identifier for display in public-facing views.
 *
 * Returns `null` when the value is not a recognisable phone number or email
 * address — callers should hide the Zelle panel or show a fallback in that case.
 *
 * Valid inputs:
 *   - Phone numbers: digits (with optional spaces, dashes, parens, +), ≥10 digits
 *   - Emails: local@domain where domain contains at least one dot
 *
 * Masking:
 *   - Phone: ••••••XXXX (last 4 digits shown)
 *   - Email: first char + ••••@domain.tld
 */
export function maskZelle(value: string): string | null {
  if (!value || !value.trim()) return null;

  const stripped = value.replace(/[\s\-().+]/g, "");

  if (/^\d+$/.test(stripped)) {
    if (stripped.length < 10) return null;
    const last4 = stripped.slice(-4);
    return `••••••${last4}`;
  }

  const atIdx = value.indexOf("@");
  if (atIdx > 0) {
    const local = value.slice(0, atIdx);
    const domain = value.slice(atIdx + 1);
    if (!domain || !domain.includes(".")) return null;
    const masked = `${local[0]}${"•".repeat(Math.max(local.length - 1, 4))}@${domain}`;
    return masked;
  }

  return null;
}

/**
 * Returns true when the value looks like a valid Zelle identifier
 * (phone number or email address).
 */
export function isValidZelleInfo(value: string | null | undefined): boolean {
  if (!value) return false;
  return maskZelle(value) !== null;
}

/**
 * Returns true when the value is a valid Cash App cashtag.
 *
 * Mirrors the guest-side payment link builder which strips a leading `$` and
 * constructs `cash.app/$<cashtag>`. A valid cashtag is 1–20 alphanumeric
 * characters or underscores with no spaces or other special characters.
 */
export function isValidCashAppHandle(value: string | null | undefined): boolean {
  if (!value || !value.trim()) return false;
  const cashtag = value.trim().replace(/^\$+/, "");
  return /^[a-zA-Z0-9_]{1,20}$/.test(cashtag);
}

/**
 * Returns true when the value is a valid Venmo username.
 *
 * Mirrors the guest-side payment link builder which passes the handle directly
 * to the Venmo deep-link URL. A valid Venmo username is 5–30 characters
 * consisting of letters, numbers, underscores, or hyphens with no spaces.
 */
export function isValidVenmoHandle(value: string | null | undefined): boolean {
  if (!value || !value.trim()) return false;
  const username = value.trim().replace(/^@+/, "");
  return /^[a-zA-Z0-9_-]{5,30}$/.test(username);
}
