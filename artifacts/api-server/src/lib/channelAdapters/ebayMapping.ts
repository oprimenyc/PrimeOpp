// ebayMapping.ts — canonical listing package -> eBay Sell Inventory API
// InventoryItem + Offer payloads, plus the deterministic preflight check that
// runs before any provider call.
//
// Field shapes follow eBay's documented Sell Inventory API:
//   https://developer.ebay.com/api-docs/sell/inventory/resources/inventory_item/methods/createOrReplaceInventoryItem
//   https://developer.ebay.com/api-docs/sell/inventory/resources/offer/methods/createOffer
// This module never invents a category ID, business policy ID, or aspect
// value PrimeOpp doesn't actually have -- missing required eBay-side
// configuration is a preflight failure, not a fabricated default.

import type { CanonicalListingPackageRow, PreflightIssue, PreflightResult } from "../channelAdapter.js";

// eBay's documented numeric condition IDs (stable across most categories).
// UNKNOWN/unspecified conditions have no safe mapping -- listing with a
// guessed condition is exactly the kind of fabrication this system refuses
// to do, so they preflight-block instead of defaulting to something.
const CONDITION_TO_EBAY: Record<string, number> = {
  NEW: 1000,
  OPEN_BOX: 1500,
  REFURBISHED: 2500,
  USED: 3000,
};

export function mapConditionToEbay(condition: string | null | undefined): number | null {
  if (!condition) return null;
  const key = condition.trim().toUpperCase();
  return CONDITION_TO_EBAY[key] ?? null;
}

// Operator-supplied, eBay-account-specific configuration that PrimeOpp has no
// way to derive on its own -- category and business policies live in the
// seller's eBay account, not in PrimeOpp's data model. Carried on the
// channel draft's channel_payload.
export type EbayChannelPayload = {
  categoryId?: string | null;
  fulfillmentPolicyId?: string | null;
  paymentPolicyId?: string | null;
  returnPolicyId?: string | null;
  merchantLocationKey?: string | null;
  quantity?: number | null;
  marketplaceId?: string | null;
};

export type EbayInventoryItemPayload = {
  sku: string;
  product: {
    title: string;
    description: string;
    imageUrls: string[];
  };
  condition: string;
  conditionId?: number;
  availability: {
    shipToLocationAvailability: { quantity: number };
  };
};

export type EbayOfferPayload = {
  sku: string;
  marketplaceId: string;
  format: "FIXED_PRICE";
  availableQuantity: number;
  categoryId: string;
  listingDescription: string;
  pricingSummary: { price: { value: string; currency: string } };
  listingPolicies: {
    fulfillmentPolicyId: string;
    paymentPolicyId: string;
    returnPolicyId: string;
  };
  merchantLocationKey?: string;
};

function toNumber(value: string | number | null | undefined): number | null {
  if (value === null || value === undefined) return null;
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : null;
}

// eBay SKUs are seller-scoped and must be stable/unique per listing across
// retries -- the canonical package id is already that (one package per
// listing; create-listing's own idempotency guarantee means it never
// duplicates for the same sourcing item).
export function ebaySku(listingPackage: CanonicalListingPackageRow): string {
  return `primeopp-${listingPackage.id}`;
}

export function buildInventoryItemPayload(
  listingPackage: CanonicalListingPackageRow,
  channelPayload: EbayChannelPayload,
): EbayInventoryItemPayload {
  const images = Array.isArray(listingPackage.images)
    ? (listingPackage.images as unknown[]).filter((v): v is string => typeof v === "string")
    : [];
  const conditionId = mapConditionToEbay(listingPackage.condition);

  return {
    sku: ebaySku(listingPackage),
    product: {
      title: listingPackage.title.slice(0, 80),
      description: listingPackage.description || listingPackage.title,
      imageUrls: images,
    },
    condition: listingPackage.condition?.trim().toUpperCase() ?? "USED",
    ...(conditionId !== null ? { conditionId } : {}),
    availability: {
      shipToLocationAvailability: { quantity: channelPayload.quantity ?? 1 },
    },
  };
}

// Returns null when required eBay-account configuration is missing --
// callers must run preflightEbayListing() first and never call this without
// checking canPublish.
export function buildOfferPayload(
  listingPackage: CanonicalListingPackageRow,
  channelPayload: EbayChannelPayload,
): EbayOfferPayload | null {
  const price = toNumber(listingPackage.target_price);
  if (
    price === null ||
    !channelPayload.categoryId ||
    !channelPayload.fulfillmentPolicyId ||
    !channelPayload.paymentPolicyId ||
    !channelPayload.returnPolicyId
  ) {
    return null;
  }

  return {
    sku: ebaySku(listingPackage),
    marketplaceId: channelPayload.marketplaceId ?? "EBAY_US",
    format: "FIXED_PRICE",
    availableQuantity: channelPayload.quantity ?? 1,
    categoryId: channelPayload.categoryId,
    listingDescription: listingPackage.description || listingPackage.title,
    pricingSummary: { price: { value: price.toFixed(2), currency: "USD" } },
    listingPolicies: {
      fulfillmentPolicyId: channelPayload.fulfillmentPolicyId,
      paymentPolicyId: channelPayload.paymentPolicyId,
      returnPolicyId: channelPayload.returnPolicyId,
    },
    ...(channelPayload.merchantLocationKey ? { merchantLocationKey: channelPayload.merchantLocationKey } : {}),
  };
}

// Deterministic preflight -- answers "CAN THIS LISTING BE PUBLISHED TO EBAY?"
// with structured, field-level issues. Never calls the network. Every issue
// here corresponds to a real eBay Sell API requirement, not a guess.
export function preflightEbayListing(
  listingPackage: CanonicalListingPackageRow,
  channelPayload: EbayChannelPayload,
): PreflightResult {
  const issues: PreflightIssue[] = [];

  if (!listingPackage.title || listingPackage.title.trim().length === 0) {
    issues.push({ field: "title", code: "TITLE_REQUIRED", message: "eBay requires a non-empty listing title." });
  } else if (listingPackage.title.length > 80) {
    issues.push({ field: "title", code: "TITLE_TOO_LONG", message: "eBay titles must be 80 characters or fewer." });
  }

  if (!listingPackage.description || listingPackage.description.trim().length === 0) {
    issues.push({ field: "description", code: "DESCRIPTION_REQUIRED", message: "eBay requires a listing description." });
  }

  const images = Array.isArray(listingPackage.images) ? listingPackage.images : [];
  if (images.length === 0) {
    issues.push({ field: "images", code: "IMAGE_REQUIRED", message: "eBay requires at least one listing image." });
  }

  const price = toNumber(listingPackage.target_price);
  if (price === null || price <= 0) {
    issues.push({ field: "target_price", code: "PRICE_REQUIRED", message: "A positive target price is required to create an eBay offer." });
  }

  const conditionId = mapConditionToEbay(listingPackage.condition);
  if (conditionId === null) {
    issues.push({
      field: "condition",
      code: "CONDITION_UNMAPPED",
      message: `Condition "${listingPackage.condition ?? "unspecified"}" has no eBay condition mapping. Set condition to NEW, OPEN_BOX, REFURBISHED, or USED.`,
    });
  }

  if (!channelPayload.categoryId) {
    issues.push({
      field: "categoryId",
      code: "CATEGORY_REQUIRED",
      message: "eBay category is required. PrimeOpp does not auto-select a category -- set an eBay category ID for this listing.",
    });
  }

  if (!channelPayload.fulfillmentPolicyId) {
    issues.push({
      field: "fulfillmentPolicyId",
      code: "FULFILLMENT_POLICY_REQUIRED",
      message: "eBay requires a fulfillment (shipping) business policy from your eBay account.",
    });
  }

  if (!channelPayload.paymentPolicyId) {
    issues.push({
      field: "paymentPolicyId",
      code: "PAYMENT_POLICY_REQUIRED",
      message: "eBay requires a payment business policy from your eBay account.",
    });
  }

  if (!channelPayload.returnPolicyId) {
    issues.push({
      field: "returnPolicyId",
      code: "RETURN_POLICY_REQUIRED",
      message: "eBay requires a return business policy from your eBay account.",
    });
  }

  return { canPublish: issues.length === 0, issues };
}
