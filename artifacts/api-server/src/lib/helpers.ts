export function resolveDisplayName(
  displayName: string | null | undefined,
  handle: string | null | undefined,
): string {
  const trimmed = displayName?.trim();
  if (trimmed) return trimmed;
  const h = handle?.trim();
  if (h) return h;
  return "User";
}
