// platformPricing.ts — selected-platform price intelligence adapter contract.
//
// Every adapter here is a SHELL. None calls a marketplace, none fabricates
// active listings, sold comps, counts, or prices. Active (asking) prices and
// sold (comp) prices are modeled in separate fields and must never be presented
// as the same thing. Pricing is only ever retrieved for platforms the seller
// explicitly selected.

export const PLATFORM_SOURCE_STATUSES = [
  "FOUND",
  "NO_MATCH",
  "INSUFFICIENT_DATA",
  "NOT_CONFIGURED",
  "PROVIDER_REQUIRED",
  "UNSUPPORTED",
  "FAILED",
] as const;
export type PlatformSourceStatus = (typeof PLATFORM_SOURCE_STATUSES)[number];

export const PRICE_CONDITIONS = ["NEW", "USED", "REFURBISHED", "OPEN_BOX", "UNKNOWN"] as const;
export type PriceCondition = (typeof PRICE_CONDITIONS)[number];

export type PriceBand = {
  low: number | null;
  median: number | null;
  high: number | null;
  sampleCount: number | null;
};

export type PlatformPriceResult = {
  platform: string;
  configured: boolean;
  matchConfidence: "HIGH" | "MEDIUM" | "LOW" | "UNKNOWN";
  condition: PriceCondition;
  // Active asking prices and sold comps are kept strictly separate.
  active: PriceBand;
  sold: PriceBand;
  externalProductId: string | null;
  identifierUsed: string | null;
  observedAt: string | null;
  sourceType: string;
  sourceStatus: PlatformSourceStatus;
  adapterVersion: string;
  providerCalls: false;
  publishEnabled: false;
};

export interface PlatformPricingAdapter {
  readonly key: string;
  readonly label: string;
  readonly requiredEnv: string[];
  readonly version: string;
  isConfigured(): boolean;
  getPricing(input: {
    productId: number | null;
    normalizedIdentifier: string | null;
    identifierType: string | null;
    condition: PriceCondition;
  }): Promise<PlatformPriceResult>;
}

const EMPTY_BAND: PriceBand = { low: null, median: null, high: null, sampleCount: null };

class NotConfiguredPricingAdapter implements PlatformPricingAdapter {
  constructor(
    readonly key: string,
    readonly label: string,
    readonly requiredEnv: string[],
    readonly version = "0.0.0",
  ) {}

  isConfigured(): boolean {
    return this.requiredEnv.length > 0 && this.requiredEnv.every((name) => Boolean(process.env[name]));
  }

  async getPricing(input: {
    condition: PriceCondition;
    normalizedIdentifier: string | null;
  }): Promise<PlatformPriceResult> {
    const configured = this.isConfigured();
    return {
      platform: this.key,
      configured,
      matchConfidence: "UNKNOWN",
      condition: input.condition,
      active: { ...EMPTY_BAND },
      sold: { ...EMPTY_BAND },
      externalProductId: null,
      identifierUsed: input.normalizedIdentifier ?? null,
      observedAt: null,
      sourceType: configured ? "PROVIDER" : "NONE",
      // Honest state: configured-but-not-wired reports PROVIDER_REQUIRED;
      // otherwise NOT_CONFIGURED. Never FOUND with fabricated data.
      sourceStatus: configured ? "PROVIDER_REQUIRED" : "NOT_CONFIGURED",
      adapterVersion: this.version,
      providerCalls: false,
      publishEnabled: false,
    };
  }
}

export const PLATFORM_PRICING_ADAPTERS: PlatformPricingAdapter[] = [
  new NotConfiguredPricingAdapter("ebay", "eBay", ["EBAY_CLIENT_ID", "EBAY_CLIENT_SECRET"]),
  new NotConfiguredPricingAdapter("amazon", "Amazon", ["AMAZON_SP_API_CLIENT_ID", "AMAZON_SP_API_CLIENT_SECRET"]),
  new NotConfiguredPricingAdapter("mercari", "Mercari", ["MERCARI_API_KEY"]),
  new NotConfiguredPricingAdapter("poshmark", "Poshmark", ["POSHMARK_API_KEY"]),
  new NotConfiguredPricingAdapter("facebook-marketplace", "Facebook Marketplace", ["FACEBOOK_COMMERCE_TOKEN"]),
  new NotConfiguredPricingAdapter("etsy", "Etsy", ["ETSY_API_KEY"]),
];

export function getPricingAdapter(key: string): PlatformPricingAdapter | undefined {
  return PLATFORM_PRICING_ADAPTERS.find((adapter) => adapter.key === key);
}

export type PlatformPricingStatus = {
  key: string;
  label: string;
  configured: boolean;
  requiredEnv: string[];
  status: "READY" | "NOT_CONFIGURED";
};

export function platformPricingStatus(adapter: PlatformPricingAdapter): PlatformPricingStatus {
  const configured = adapter.isConfigured();
  return {
    key: adapter.key,
    label: adapter.label,
    configured,
    requiredEnv: adapter.requiredEnv,
    status: configured ? "READY" : "NOT_CONFIGURED",
  };
}
