import { describe, expect, it } from "vitest";
import {
  buildInventoryItemPayload,
  buildOfferPayload,
  ebaySku,
  mapConditionToEbay,
  preflightEbayListing,
  type EbayChannelPayload,
} from "../src/lib/channelAdapters/ebayMapping.js";
import type { CanonicalListingPackageRow } from "../src/lib/channelAdapter.js";

function pkg(overrides: Partial<CanonicalListingPackageRow> = {}): CanonicalListingPackageRow {
  return {
    id: 42,
    product_id: null,
    source_identifier: "SKU-1",
    identifier_type: "SKU",
    title: "Nice Jacket",
    description: "A nice jacket.",
    images: ["https://example.com/a.jpg"],
    category: "apparel",
    condition: "USED",
    size_variant: null,
    cost_basis: "20",
    target_price: "65",
    shipping_profile: null,
    ...overrides,
  };
}

const fullPolicies: EbayChannelPayload = {
  categoryId: "11450",
  fulfillmentPolicyId: "fp-1",
  paymentPolicyId: "pp-1",
  returnPolicyId: "rp-1",
};

describe("eBay condition mapping", () => {
  it("maps known conditions to eBay's documented numeric condition IDs", () => {
    expect(mapConditionToEbay("NEW")).toBe(1000);
    expect(mapConditionToEbay("OPEN_BOX")).toBe(1500);
    expect(mapConditionToEbay("REFURBISHED")).toBe(2500);
    expect(mapConditionToEbay("used")).toBe(3000); // case-insensitive
  });

  it("never guesses a condition ID for unknown/unspecified conditions", () => {
    expect(mapConditionToEbay("unspecified")).toBeNull();
    expect(mapConditionToEbay("UNKNOWN")).toBeNull();
    expect(mapConditionToEbay(null)).toBeNull();
    expect(mapConditionToEbay(undefined)).toBeNull();
  });
});

describe("eBay SKU derivation", () => {
  it("is deterministic and stable across repeated calls for the same package", () => {
    const p = pkg();
    expect(ebaySku(p)).toBe(ebaySku(p));
    expect(ebaySku(p)).toBe("primeopp-42");
  });
});

describe("eBay inventory item payload mapping", () => {
  it("maps canonical package fields to the InventoryItem shape, truncating an over-long title", () => {
    const p = pkg({ title: "x".repeat(120) });
    const payload = buildInventoryItemPayload(p, {});
    expect(payload.sku).toBe("primeopp-42");
    expect(payload.product.title.length).toBe(80);
    expect(payload.availability.shipToLocationAvailability.quantity).toBe(1);
    expect(payload.conditionId).toBe(3000);
  });

  it("omits conditionId rather than fabricating one when condition is unmapped", () => {
    const payload = buildInventoryItemPayload(pkg({ condition: "unspecified" }), {});
    expect(payload.conditionId).toBeUndefined();
  });
});

describe("eBay offer payload mapping", () => {
  it("builds a complete offer payload when price and all required policies are present", () => {
    const offer = buildOfferPayload(pkg(), fullPolicies);
    expect(offer).not.toBeNull();
    expect(offer?.pricingSummary.price.value).toBe("65.00");
    expect(offer?.categoryId).toBe("11450");
    expect(offer?.listingPolicies.fulfillmentPolicyId).toBe("fp-1");
  });

  it("returns null instead of a fabricated offer when required eBay-account config is missing", () => {
    expect(buildOfferPayload(pkg(), {})).toBeNull();
    expect(buildOfferPayload(pkg(), { categoryId: "11450" })).toBeNull();
    expect(buildOfferPayload(pkg({ target_price: null }), fullPolicies)).toBeNull();
  });
});

describe("eBay preflight validation", () => {
  it("passes a fully-specified, fully-configured listing", () => {
    const result = preflightEbayListing(pkg(), fullPolicies);
    expect(result.canPublish).toBe(true);
    expect(result.issues).toHaveLength(0);
  });

  it("blocks with a specific, actionable issue per missing requirement -- never a silent success", () => {
    const result = preflightEbayListing(
      pkg({ title: "", description: "", images: [], target_price: null, condition: "unspecified" }),
      {},
    );
    expect(result.canPublish).toBe(false);
    const codes = result.issues.map((i) => i.code);
    expect(codes).toContain("TITLE_REQUIRED");
    expect(codes).toContain("DESCRIPTION_REQUIRED");
    expect(codes).toContain("IMAGE_REQUIRED");
    expect(codes).toContain("PRICE_REQUIRED");
    expect(codes).toContain("CONDITION_UNMAPPED");
    expect(codes).toContain("CATEGORY_REQUIRED");
    expect(codes).toContain("FULFILLMENT_POLICY_REQUIRED");
    expect(codes).toContain("PAYMENT_POLICY_REQUIRED");
    expect(codes).toContain("RETURN_POLICY_REQUIRED");
  });

  it("blocks a title over eBay's 80-character limit", () => {
    const result = preflightEbayListing(pkg({ title: "x".repeat(81) }), fullPolicies);
    expect(result.canPublish).toBe(false);
    expect(result.issues.map((i) => i.code)).toContain("TITLE_TOO_LONG");
  });
});
