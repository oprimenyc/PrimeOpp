// retailerAdapters.ts — replaceable retailer inventory adapter contract.
//
// Every adapter here is a SHELL. None calls a retailer, none fabricates a
// store, quantity, availability, or price. Each returns an honest UNAVAILABLE /
// NOT_CONFIGURED result until a real integration (official API, licensed
// provider, user-authorized browser session, or permitted public-page monitor)
// is wired in behind the same contract. Unofficial adapters are disabled by
// default, isolated from core logic, and fail safe.
//
// Prohibited by design and never implemented here: anti-bot bypass, CAPTCHA
// bypass, proxy evasion, stolen/copied cookies, hidden API-key extraction, or
// undocumented access-control circumvention.

export const INTEGRATION_CATEGORIES = [
  "OFFICIAL_API",
  "LICENSED_PROVIDER",
  "USER_AUTHORIZED_BROWSER",
  "PUBLIC_PAGE_MONITOR",
  "UNAVAILABLE",
] as const;
export type IntegrationCategory = (typeof INTEGRATION_CATEGORIES)[number];

// Source priority: lower number = preferred when configured.
export const SOURCE_PRIORITY: Record<IntegrationCategory, number> = {
  OFFICIAL_API: 1,
  LICENSED_PROVIDER: 2,
  USER_AUTHORIZED_BROWSER: 3,
  PUBLIC_PAGE_MONITOR: 4,
  UNAVAILABLE: 99,
};

export const AVAILABILITY_STATUSES = [
  "IN_STOCK",
  "LOW_STOCK",
  "OUT_OF_STOCK",
  "LIMITED_AVAILABILITY",
  "UNKNOWN",
  "NOT_SUPPORTED",
  "PROVIDER_REQUIRED",
  "FAILED",
] as const;
export type AvailabilityStatus = (typeof AVAILABILITY_STATUSES)[number];

export const QUANTITY_CONFIDENCE = ["EXACT", "ESTIMATED", "STATUS_ONLY", "UNKNOWN"] as const;
export type QuantityConfidence = (typeof QUANTITY_CONFIDENCE)[number];

export type RetailerProductMatch = {
  retailerItemId: string;
  retailerSku: string | null;
  productUrl: string | null;
  matchConfidence: "HIGH" | "MEDIUM" | "LOW" | "UNKNOWN";
};

export type RetailerStore = {
  externalStoreId: string;
  name: string;
  city: string | null;
  region: string | null;
  postalCode: string | null;
  distanceMiles: number | null;
};

export type InventoryObservation = {
  availabilityStatus: AvailabilityStatus;
  // quantity is ALWAYS nullable. A status like "in stock" is never converted
  // into an invented number.
  quantity: number | null;
  quantityConfidence: QuantityConfidence;
  price: number | null;
  currency: string | null;
  observedAt: string | null;
  sourceType: IntegrationCategory;
  sourceStatus: string;
  adapterVersion: string;
};

export type StoreLocation = {
  postalCode?: string | null;
  city?: string | null;
  region?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  radiusMiles?: number | null;
};

export interface RetailerInventoryAdapter {
  readonly key: string;
  readonly label: string;
  readonly category: IntegrationCategory;
  readonly version: string;
  readonly enabled: boolean;
  readonly experimental: boolean;
  // Exact environment variable names a real integration would require.
  readonly requiredEnv: string[];
  isConfigured(): boolean;
  searchProduct(input: { normalizedIdentifier: string; identifierType: string }): Promise<RetailerProductMatch[]>;
  findStores(location: StoreLocation): Promise<RetailerStore[]>;
  getInventory(input: { retailerItemId: string; externalStoreId: string }): Promise<InventoryObservation[]>;
}

// A shell that fails safe: reports UNAVAILABLE/NOT_CONFIGURED and returns no
// data. Concrete adapters replace the three async methods when a real,
// permitted integration exists.
class NotConfiguredRetailerAdapter implements RetailerInventoryAdapter {
  constructor(
    readonly key: string,
    readonly label: string,
    readonly category: IntegrationCategory,
    readonly requiredEnv: string[],
    readonly experimental = false,
    readonly version = "0.0.0",
  ) {}

  get enabled(): boolean {
    // Unofficial categories are disabled by default even if env is present,
    // until explicitly enabled by a separate, approved change.
    if (this.experimental) return false;
    return this.isConfigured();
  }

  isConfigured(): boolean {
    return this.requiredEnv.length > 0 && this.requiredEnv.every((name) => Boolean(process.env[name]));
  }

  async searchProduct(): Promise<RetailerProductMatch[]> {
    return [];
  }

  async findStores(): Promise<RetailerStore[]> {
    return [];
  }

  async getInventory(): Promise<InventoryObservation[]> {
    return [
      {
        availabilityStatus: this.isConfigured() ? "PROVIDER_REQUIRED" : "NOT_SUPPORTED",
        quantity: null,
        quantityConfidence: "UNKNOWN",
        price: null,
        currency: null,
        observedAt: null,
        sourceType: this.category,
        sourceStatus: this.isConfigured() ? "PROVIDER_REQUIRED" : "NOT_CONFIGURED",
        adapterVersion: this.version,
      },
    ];
  }
}

// Registry of retailer adapter shells. Each names the exact env vars a real
// official-API or licensed-provider integration would need. Missing env → the
// route reports NOT_CONFIGURED honestly.
export const RETAILER_ADAPTERS: RetailerInventoryAdapter[] = [
  new NotConfiguredRetailerAdapter("target", "Target", "OFFICIAL_API", ["TARGET_API_KEY"]),
  new NotConfiguredRetailerAdapter("walmart", "Walmart", "OFFICIAL_API", ["WALMART_CLIENT_ID", "WALMART_CLIENT_SECRET"]),
  new NotConfiguredRetailerAdapter("best-buy", "Best Buy", "OFFICIAL_API", ["BEST_BUY_API_KEY"]),
  new NotConfiguredRetailerAdapter("home-depot", "Home Depot", "OFFICIAL_API", ["HOME_DEPOT_API_KEY"]),
  new NotConfiguredRetailerAdapter("lowes", "Lowe's", "OFFICIAL_API", ["LOWES_API_KEY"]),
  new NotConfiguredRetailerAdapter("licensed-provider", "Licensed inventory provider", "LICENSED_PROVIDER", ["RETAIL_DATA_PROVIDER_KEY"]),
  new NotConfiguredRetailerAdapter("public-monitor", "Public product-page monitor", "PUBLIC_PAGE_MONITOR", ["PUBLIC_PAGE_MONITOR_ENABLED"], true),
  new NotConfiguredRetailerAdapter("user-browser", "User-authorized browser session", "USER_AUTHORIZED_BROWSER", ["USER_BROWSER_ADAPTER_ENABLED"], true),
];

export function getRetailerAdapter(key: string): RetailerInventoryAdapter | undefined {
  return RETAILER_ADAPTERS.find((adapter) => adapter.key === key);
}

export type RetailerAdapterStatus = {
  key: string;
  label: string;
  category: IntegrationCategory;
  priority: number;
  enabled: boolean;
  experimental: boolean;
  configured: boolean;
  requiredEnv: string[];
  status: "READY" | "NOT_CONFIGURED" | "DISABLED_EXPERIMENTAL";
};

export function retailerAdapterStatus(adapter: RetailerInventoryAdapter): RetailerAdapterStatus {
  const configured = adapter.isConfigured();
  let status: RetailerAdapterStatus["status"];
  if (adapter.experimental) status = "DISABLED_EXPERIMENTAL";
  else if (configured) status = "READY";
  else status = "NOT_CONFIGURED";

  return {
    key: adapter.key,
    label: adapter.label,
    category: adapter.category,
    priority: SOURCE_PRIORITY[adapter.category],
    enabled: adapter.enabled,
    experimental: adapter.experimental,
    configured,
    requiredEnv: adapter.requiredEnv,
    status,
  };
}

// ── Freshness ────────────────────────────────────────────────────────────────
export const FRESHNESS_STATUSES = ["LIVE", "RECENT", "STALE", "EXPIRED", "UNKNOWN"] as const;
export type FreshnessStatus = (typeof FRESHNESS_STATUSES)[number];

// Pure freshness classification. Never hides staleness: if there is no
// timestamp, freshness is UNKNOWN, and the caller must still show that.
export function classifyFreshness(
  observedAt: string | Date | null | undefined,
  now: number,
  expiresAt?: string | Date | null,
): FreshnessStatus {
  if (!observedAt) return "UNKNOWN";
  const observedMs = new Date(observedAt).getTime();
  if (Number.isNaN(observedMs)) return "UNKNOWN";

  if (expiresAt) {
    const expiresMs = new Date(expiresAt).getTime();
    if (!Number.isNaN(expiresMs) && now > expiresMs) return "EXPIRED";
  }

  const ageMs = now - observedMs;
  const minute = 60 * 1000;
  if (ageMs <= 15 * minute) return "LIVE";
  if (ageMs <= 6 * 60 * minute) return "RECENT";
  return "STALE";
}
