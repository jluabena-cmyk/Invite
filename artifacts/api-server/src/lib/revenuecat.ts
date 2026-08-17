const REVENUECAT_API_KEY =
  process.env.EXPO_PUBLIC_REVENUECAT_IOS_API_KEY ||
  process.env.EXPO_PUBLIC_REVENUECAT_TEST_API_KEY ||
  "";

export async function fetchRcEntitlement(
  appUserId: string
): Promise<{ isPremium: boolean; expiresAt: Date | null } | null> {
  if (!REVENUECAT_API_KEY) return null;

  try {
    const url = `https://api.revenuecat.com/v1/subscribers/${encodeURIComponent(appUserId)}`;
    const resp = await fetch(url, {
      headers: {
        Authorization: `Bearer ${REVENUECAT_API_KEY}`,
        "Content-Type": "application/json",
      },
    });
    if (!resp.ok) return null;

    const data: any = await resp.json();
    const entitlements = data?.subscriber?.entitlements ?? {};
    const premiumEntitlement = entitlements["premium"];

    if (!premiumEntitlement) return { isPremium: false, expiresAt: null };

    const expiresAtStr: string | null = premiumEntitlement.expires_date ?? null;
    const expiresAt = expiresAtStr ? new Date(expiresAtStr) : null;
    const isPremium = expiresAt === null || expiresAt > new Date();

    return { isPremium, expiresAt };
  } catch {
    return null;
  }
}
