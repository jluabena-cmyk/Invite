/**
 * Masks a Zelle identifier for display in public-facing contexts
 * such as push notification bodies (visible on lock screen).
 * - Phone numbers (digits only after stripping formatting): shows ••••••XXXX (last 4 digits)
 * - Emails: shows first character + ••••@domain.com
 * The real value must be kept in the deep-link data payload for in-app use only.
 */
export function maskZelle(value: string): string {
  const stripped = value.replace(/[\s\-().+]/g, "");
  if (/^\d+$/.test(stripped)) {
    const last4 = stripped.slice(-4);
    return `••••••${last4}`;
  }
  const atIdx = value.indexOf("@");
  if (atIdx > 0) {
    const local = value.slice(0, atIdx);
    const domain = value.slice(atIdx);
    return `${local[0]}${"•".repeat(Math.max(local.length - 1, 4))}${domain}`;
  }
  return value;
}
