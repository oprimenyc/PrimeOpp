export const LISTING_PACKAGE_STATUSES = [
  "DRAFT",
  "READY",
  "APPROVAL_REQUIRED",
  "EXPORTED",
  "DISABLED",
  "FAILED",
] as const;

export const LISTING_EXPORT_FORMATS = [
  "COPY_FIELDS",
  "CSV",
  "JSON",
  "API_DRAFT_DISABLED",
] as const;

export type ListingIntakeSource = "SCAN" | "SEARCH" | "MANUAL_FALLBACK";
export type ListingPackageStatus = typeof LISTING_PACKAGE_STATUSES[number];
export type ListingExportFormat = typeof LISTING_EXPORT_FORMATS[number];

export type ListingPackageInput = {
  source: ListingIntakeSource;
  identifier: string;
  identifierType?: string | null;
  productId?: number | null;
  product: {
    title?: string | null;
    description?: string | null;
    images?: string[] | null;
    category?: string | null;
    condition?: string | null;
    sizeVariant?: string | null;
    costBasis?: number | null;
    targetPrice?: number | null;
    shippingProfile?: string | null;
  };
  selectedChannels: string[];
  createExports: boolean;
};

export type GeneratedCanonicalListing = {
  product_id: number | null;
  source_identifier: string;
  identifier_type: string;
  intake_source: ListingIntakeSource;
  title: string;
  description: string;
  images: string[];
  category: string;
  condition: string;
  size_variant: string | null;
  cost_basis: number | null;
  target_price: number | null;
  margin: number | null;
  shipping_profile: string | null;
  status: ListingPackageStatus;
};

export type GeneratedChannelDraft = {
  channel: string;
  account_connection_id: number | null;
  channel_status: ListingPackageStatus;
  channel_payload: Record<string, unknown>;
  last_validation_error: string | null;
  publish_disabled_reason: string;
};

export type GeneratedListingExport = {
  channel: string;
  export_format: ListingExportFormat;
  export_payload: Record<string, unknown>;
};

export type GeneratedListingWorkspace = {
  canonical: GeneratedCanonicalListing;
  channelDrafts: GeneratedChannelDraft[];
  exports: GeneratedListingExport[];
  externalPublishEnabled: false;
  approvalRequired: true;
  liabilityMode: "seller_publishes_on_own_accounts";
};

const PUBLISH_DISABLED_REASON =
  "Seller publishes through their own marketplace account. Direct publish requires connected account and explicit approval.";

function normalizeChannel(channel: string): string {
  return channel.trim().toLowerCase().replace(/[^a-z0-9_-]+/g, "-").replace(/^-+|-+$/g, "");
}

export function normalizeSelectedChannels(selectedChannels: string[]): string[] {
  const seen = new Set<string>();
  const normalized: string[] = [];

  for (const channel of selectedChannels) {
    const key = normalizeChannel(channel);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    normalized.push(key);
  }

  return normalized;
}

export function classifyIdentifier(identifier: string, fallback?: string | null): string {
  const trimmed = identifier.trim();
  if (fallback?.trim()) return fallback.trim().toUpperCase();
  if (/^\d{12}$/.test(trimmed)) return "UPC";
  if (/^\d{13}$/.test(trimmed)) return "EAN";
  if (/^\d{8,14}$/.test(trimmed)) return "GTIN";
  if (/^[a-zA-Z0-9_-]{3,80}$/.test(trimmed)) return "SKU";
  return "UNKNOWN";
}

function toMoney(value: number | null | undefined): number | null {
  if (typeof value !== "number" || Number.isNaN(value) || value < 0) return null;
  return Math.round(value * 100) / 100;
}

function createDraftPayload(canonical: GeneratedCanonicalListing, channel: string): Record<string, unknown> {
  return {
    channel,
    title: canonical.title,
    description: canonical.description,
    images: canonical.images,
    category: canonical.category,
    condition: canonical.condition,
    sizeVariant: canonical.size_variant,
    targetPrice: canonical.target_price,
    shippingProfile: canonical.shipping_profile,
    publishEnabled: false,
    approvalRequired: true,
  };
}

export function generateListingWorkspace(input: ListingPackageInput): GeneratedListingWorkspace {
  const identifier = input.identifier.trim();
  const title = input.product.title?.trim() || `Listing package for ${identifier}`;
  const description = input.product.description?.trim() || "";
  const costBasis = toMoney(input.product.costBasis);
  const targetPrice = toMoney(input.product.targetPrice);
  const margin = costBasis !== null && targetPrice !== null ? Math.round((targetPrice - costBasis) * 100) / 100 : null;
  const channels = normalizeSelectedChannels(input.selectedChannels);

  const canonical: GeneratedCanonicalListing = {
    product_id: input.productId ?? null,
    source_identifier: identifier,
    identifier_type: classifyIdentifier(identifier, input.identifierType),
    intake_source: input.source,
    title,
    description,
    images: Array.isArray(input.product.images) ? input.product.images.filter(Boolean) : [],
    category: input.product.category?.trim() || "uncategorized",
    condition: input.product.condition?.trim() || "unspecified",
    size_variant: input.product.sizeVariant?.trim() || null,
    cost_basis: costBasis,
    target_price: targetPrice,
    margin,
    shipping_profile: input.product.shippingProfile?.trim() || null,
    status: "APPROVAL_REQUIRED",
  };

  const channelDrafts = channels.map((channel) => ({
    channel,
    account_connection_id: null,
    channel_status: "APPROVAL_REQUIRED" as const,
    channel_payload: createDraftPayload(canonical, channel),
    last_validation_error: null,
    publish_disabled_reason: PUBLISH_DISABLED_REASON,
  }));

  const exports = input.createExports
    ? channelDrafts.map((draft) => ({
        channel: draft.channel,
        export_format: "JSON" as const,
        export_payload: {
          ...draft.channel_payload,
          exportOnly: true,
          externalProviderMode: "DISABLED",
        },
      }))
    : [];

  return {
    canonical,
    channelDrafts,
    exports,
    externalPublishEnabled: false,
    approvalRequired: true,
    liabilityMode: "seller_publishes_on_own_accounts",
  };
}
