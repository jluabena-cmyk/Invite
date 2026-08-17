import { ReplitConnectors } from "@replit/connectors-sdk";

const PROJECT_NAME = "invite (Bill Splitter)";
const MONTHLY_PRODUCT_IDENTIFIER = "invite_premium_monthly";
const YEARLY_PRODUCT_IDENTIFIER = "invite_premium_yearly";
const APP_STORE_BUNDLE_ID = "com.owmo.app";
const ENTITLEMENT_IDENTIFIER = "premium";
const ENTITLEMENT_DISPLAY_NAME = "Premium Hosting";
const OFFERING_IDENTIFIER = "default";
const OFFERING_DISPLAY_NAME = "Default Offering";

const connectors = new ReplitConnectors();

async function rcGet<T>(path: string): Promise<T> {
  const res = await connectors.proxy("revenuecat", path, { method: "GET" });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`GET ${path} → ${res.status}: ${t}`);
  }
  return res.json() as Promise<T>;
}

async function rcPost<T>(path: string, body: unknown): Promise<T> {
  const res = await connectors.proxy("revenuecat", path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const json = await res.json() as any;
  if (!res.ok) {
    if (json?.code === 7000 || json?.message?.includes("already exists")) {
      return json as T;
    }
    throw new Error(`POST ${path} → ${res.status}: ${JSON.stringify(json)}`);
  }
  return json as T;
}

type ListResponse<T> = { items: T[]; next_page?: string };
type ProjectItem = { id: string; name: string };
type AppItem = { id: string; name: string; type: string };
type ProductItem = { id: string; store_identifier: string; app_id: string };
type EntitlementItem = { id: string; lookup_key: string };
type OfferingItem = { id: string; lookup_key: string; is_current: boolean };
type PackageItem = { id: string; lookup_key: string };

async function ensureProject(): Promise<ProjectItem> {
  const data = await rcGet<ListResponse<ProjectItem>>("/v2/projects?limit=20");
  const existing = data.items.find((p) => p.name === PROJECT_NAME);
  if (existing) { console.log("Project exists:", existing.id); return existing; }
  const created = await rcPost<ProjectItem>("/v2/projects", { name: PROJECT_NAME });
  console.log("Created project:", created.id);
  return created;
}

async function ensureApp(projectId: string, apps: AppItem[]): Promise<{ testApp: AppItem; iosApp: AppItem }> {
  let testApp = apps.find((a) => a.type === "test_store");
  let iosApp = apps.find((a) => a.type === "app_store");

  if (!testApp) throw new Error("No test_store app found — expected RevenueCat to create one by default");
  console.log("Test app:", testApp.id);

  if (!iosApp) {
    iosApp = await rcPost<AppItem>(`/v2/projects/${projectId}/apps`, {
      name: "invite iOS",
      type: "app_store",
      app_store: { bundle_id: APP_STORE_BUNDLE_ID },
    });
    console.log("Created iOS app:", iosApp.id);
  } else {
    console.log("iOS app:", iosApp.id);
  }

  return { testApp, iosApp };
}

async function ensureProduct(
  projectId: string,
  products: ProductItem[],
  appId: string,
  storeIdentifier: string,
  displayName: string,
  duration?: string,
  isTestStore = false,
): Promise<ProductItem> {
  const existing = products.find((p) => p.store_identifier === storeIdentifier && p.app_id === appId);
  if (existing) { console.log(`Product exists (${storeIdentifier}):`, existing.id); return existing; }

  const body: Record<string, unknown> = {
    store_identifier: storeIdentifier,
    app_id: appId,
    type: "subscription",
    display_name: displayName,
  };
  if (isTestStore && duration) {
    body.subscription = { duration };
    body.title = displayName;
  }

  const created = await rcPost<ProductItem>(`/v2/projects/${projectId}/products`, body);
  console.log(`Created product (${storeIdentifier}):`, created.id);
  return created;
}

async function seedRevenueCat() {
  const project = await ensureProject();
  const projectId = project.id;

  const appsData = await rcGet<ListResponse<AppItem>>(`/v2/projects/${projectId}/apps?limit=20`);
  const { testApp, iosApp } = await ensureApp(projectId, appsData.items);

  const productsData = await rcGet<ListResponse<ProductItem>>(`/v2/projects/${projectId}/products?limit=100`);
  const products = productsData.items;

  const testMonthly = await ensureProduct(projectId, products, testApp.id, MONTHLY_PRODUCT_IDENTIFIER, "Premium Monthly ($4.99)", "P1M", true);
  const testYearly = await ensureProduct(projectId, products, testApp.id, YEARLY_PRODUCT_IDENTIFIER, "Premium Yearly ($29.99)", "P1Y", true);
  const iosMonthly = await ensureProduct(projectId, products, iosApp.id, MONTHLY_PRODUCT_IDENTIFIER, "Premium Monthly", undefined, false);
  const iosYearly = await ensureProduct(projectId, products, iosApp.id, YEARLY_PRODUCT_IDENTIFIER, "Premium Yearly", undefined, false);

  // Set test store prices
  for (const [product, priceMicros] of [[testMonthly, 4990000], [testYearly, 29990000]] as const) {
    try {
      await rcPost(`/v2/projects/${projectId}/products/${product.id}/test_store_prices`, {
        prices: [{ amount_micros: priceMicros, currency: "USD" }],
      });
      console.log("Set test price for", product.id);
    } catch (e: any) {
      if (e.message?.includes("already exists") || e.message?.includes("7000")) {
        console.log("Test price already set for", product.id);
      } else {
        console.warn("Could not set test price:", e.message);
      }
    }
  }

  // Entitlement
  const entitlementsData = await rcGet<ListResponse<EntitlementItem>>(`/v2/projects/${projectId}/entitlements?limit=20`);
  let entitlement = entitlementsData.items.find((e) => e.lookup_key === ENTITLEMENT_IDENTIFIER);
  if (!entitlement) {
    entitlement = await rcPost<EntitlementItem>(`/v2/projects/${projectId}/entitlements`, {
      lookup_key: ENTITLEMENT_IDENTIFIER,
      display_name: ENTITLEMENT_DISPLAY_NAME,
    });
    console.log("Created entitlement:", entitlement.id);
  } else {
    console.log("Entitlement exists:", entitlement.id);
  }

  // Attach products to entitlement
  try {
    await rcPost(`/v2/projects/${projectId}/entitlements/${entitlement.id}/products/attach`, {
      product_ids: [testMonthly.id, testYearly.id, iosMonthly.id, iosYearly.id],
    });
    console.log("Attached products to entitlement");
  } catch (e: any) {
    console.warn("Entitlement attach (may already be attached):", e.message?.slice(0, 80));
  }

  // Offering
  const offeringsData = await rcGet<ListResponse<OfferingItem>>(`/v2/projects/${projectId}/offerings?limit=20`);
  let offering = offeringsData.items.find((o) => o.lookup_key === OFFERING_IDENTIFIER);
  if (!offering) {
    offering = await rcPost<OfferingItem>(`/v2/projects/${projectId}/offerings`, {
      lookup_key: OFFERING_IDENTIFIER,
      display_name: OFFERING_DISPLAY_NAME,
    });
    console.log("Created offering:", offering.id);
  } else {
    console.log("Offering exists:", offering.id);
  }

  if (!offering.is_current) {
    await connectors.proxy("revenuecat", `/v2/projects/${projectId}/offerings/${offering.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ is_current: true }),
    });
    console.log("Set offering as current");
  }

  // Packages
  const packagesData = await rcGet<ListResponse<PackageItem>>(`/v2/projects/${projectId}/offerings/${offering.id}/packages?limit=20`);
  const existingPackages = packagesData.items;

  const packageDefs = [
    { lookupKey: "$rc_monthly", displayName: "Monthly", products: [testMonthly, iosMonthly] },
    { lookupKey: "$rc_annual", displayName: "Annual", products: [testYearly, iosYearly] },
  ];

  for (const pkgDef of packageDefs) {
    let pkg = existingPackages.find((p) => p.lookup_key === pkgDef.lookupKey);
    if (!pkg) {
      pkg = await rcPost<PackageItem>(`/v2/projects/${projectId}/offerings/${offering.id}/packages`, {
        lookup_key: pkgDef.lookupKey,
        display_name: pkgDef.displayName,
      });
      console.log("Created package:", pkg.id, pkgDef.lookupKey);
    } else {
      console.log("Package exists:", pkg.id, pkgDef.lookupKey);
    }

    try {
      await rcPost(`/v2/projects/${projectId}/packages/${pkg.id}/products/attach`, {
        products: pkgDef.products.map((p) => ({
          product_id: p.id,
          eligibility_criteria: "all",
        })),
      });
      console.log("Attached products to package", pkgDef.lookupKey);
    } catch (e: any) {
      console.warn("Package attach (may already be attached):", e.message?.slice(0, 80));
    }
  }

  // Fetch API keys
  const testKeysData = await rcGet<ListResponse<{ key: string }>>(`/v2/projects/${projectId}/apps/${testApp.id}/api_keys?limit=10`).catch(() => ({ items: [] as { key: string }[] }));
  const iosKeysData = await rcGet<ListResponse<{ key: string }>>(`/v2/projects/${projectId}/apps/${iosApp.id}/api_keys?limit=10`).catch(() => ({ items: [] as { key: string }[] }));

  console.log("\n====================");
  console.log("RevenueCat setup COMPLETE!");
  console.log("Project ID:", projectId);
  console.log("Entitlement:", ENTITLEMENT_IDENTIFIER);
  console.log("Offering:", OFFERING_IDENTIFIER);
  console.log("");
  console.log("Set these environment variables:");
  console.log("EXPO_PUBLIC_REVENUECAT_TEST_API_KEY=" + (testKeysData.items[0]?.key ?? "— check RevenueCat dashboard"));
  console.log("EXPO_PUBLIC_REVENUECAT_IOS_API_KEY=" + (iosKeysData.items[0]?.key ?? "— check RevenueCat dashboard"));
  console.log("REVENUECAT_PROJECT_ID=" + projectId);
  console.log("REVENUECAT_WEBHOOK_AUTH_HEADER=<choose-a-secret-string>");
  console.log("====================\n");
}

seedRevenueCat().catch((e) => { console.error("Seed failed:", e); process.exit(1); });
