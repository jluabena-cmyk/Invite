import { ReplitConnectors } from "@replit/connectors-sdk";

export function getRevenueCatConnectors() {
  return new ReplitConnectors();
}

export async function revenueCatRequest<T = unknown>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const connectors = getRevenueCatConnectors();
  const response = await connectors.proxy("revenuecat", path, options);
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`RevenueCat API error ${response.status}: ${errorText}`);
  }
  return response.json() as Promise<T>;
}
