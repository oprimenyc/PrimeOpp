// MOCKED EXTERNAL API (eBay) -- every test in this file stubs global fetch
// so no real request ever leaves the process. Nothing here calls
// api.ebay.com or api.sandbox.ebay.com. See ebay-mapping.test.ts for the
// pure payload/preflight logic and channel-publish.test.ts for the
// idempotency/state-machine layer that sits above this adapter.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ebayAdapter } from "../src/lib/channelAdapters/ebayAdapter.js";
import type { CanonicalListingPackageRow } from "../src/lib/channelAdapter.js";

function pkg(): CanonicalListingPackageRow {
  return {
    id: 7,
    product_id: null,
    source_identifier: "SKU-7",
    identifier_type: "SKU",
    title: "Test Item",
    description: "A test item.",
    images: ["https://example.com/a.jpg"],
    category: "apparel",
    condition: "USED",
    size_variant: null,
    cost_basis: "10",
    target_price: "50",
    shipping_profile: null,
  };
}

const fullChannelPayload = {
  categoryId: "11450",
  fulfillmentPolicyId: "fp-1",
  paymentPolicyId: "pp-1",
  returnPolicyId: "rp-1",
};

function jsonResponse(status: number, body: unknown): Response {
  // 204 (eBay's real response for a successful PUT inventory_item) has no
  // body per the Fetch spec's Response constructor.
  if (status === 204) return new Response(null, { status: 204 });
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

describe("eBay adapter capabilities and configuration", () => {
  const savedEnv = { ...process.env };
  afterEach(() => {
    process.env = { ...savedEnv };
  });

  it("declares exactly the capabilities it implements", () => {
    expect(ebayAdapter.capabilities).toEqual({
      connect: true,
      createListing: true,
      updateListing: true,
      endListing: true,
      retrieveListing: true,
      syncStatus: true,
    });
  });

  it("reports NOT configured without EBAY_CLIENT_ID/SECRET", () => {
    delete process.env["EBAY_CLIENT_ID"];
    delete process.env["EBAY_CLIENT_SECRET"];
    expect(ebayAdapter.isConfigured()).toBe(false);
  });

  it("reports configured once both required env vars are present", () => {
    process.env["EBAY_CLIENT_ID"] = "id";
    process.env["EBAY_CLIENT_SECRET"] = "secret";
    expect(ebayAdapter.isConfigured()).toBe(true);
  });
});

describe("eBay adapter createListing (mocked external API)", () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("goes PUT inventory_item -> GET offer?sku (none found) -> POST offer -> POST publish -> LIVE with a real listingId", async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse(204, null)) // PUT inventory_item
      .mockResolvedValueOnce(jsonResponse(200, { offers: [] })) // GET offer?sku
      .mockResolvedValueOnce(jsonResponse(201, { offerId: "offer-123" })) // POST offer
      .mockResolvedValueOnce(jsonResponse(200, { listingId: "listing-999" })); // POST publish

    const result = await ebayAdapter.createListing!({
      listingPackage: pkg(),
      draft: { id: 1, channel_payload: fullChannelPayload },
      accessToken: "tok",
      idempotencyKey: "key-1",
    });

    expect(result.status).toBe("LIVE");
    expect(result.externalListingId).toBe("listing-999");
    expect(result.externalOfferId).toBe("offer-123");
    expect(fetchMock).toHaveBeenCalledTimes(4);
    // The access token must never appear in a logged/returned raw payload.
    expect(JSON.stringify(result)).not.toContain("tok");
  });

  it("fails FAST with PREFLIGHT_FAILED and never calls the network when required fields are missing", async () => {
    const result = await ebayAdapter.createListing!({
      listingPackage: pkg(),
      draft: { id: 1, channel_payload: {} }, // no category/policies
      accessToken: "tok",
      idempotencyKey: "key-2",
    });
    expect(result.status).toBe("FAILED");
    expect(result.errorCode).toBe("PREFLIGHT_FAILED");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("reuses an existing offer discovered by SKU instead of creating a duplicate", async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse(204, null)) // PUT inventory_item
      .mockResolvedValueOnce(jsonResponse(200, { offers: [{ offerId: "offer-existing", status: "UNPUBLISHED", listing: null }] })); // GET offer?sku finds one, not yet published

    const result = await ebayAdapter.createListing!({
      listingPackage: pkg(),
      draft: { id: 1, channel_payload: fullChannelPayload },
      accessToken: "tok",
      idempotencyKey: "key-3",
    });

    // Should proceed straight to publish on the discovered offer, never a
    // second POST /offer.
    const calledPaths = fetchMock.mock.calls.map((c) => String(c[0]));
    expect(calledPaths.some((p) => p.endsWith("/sell/inventory/v1/offer"))).toBe(false);
    expect(calledPaths.some((p) => p.includes("offer-existing/publish"))).toBe(true);
    void result;
  });

  it("reports an already-listed offer as LIVE (confirmed by eBay) without re-publishing", async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse(204, null)) // PUT inventory_item
      .mockResolvedValueOnce(jsonResponse(200, { offers: [{ offerId: "offer-live", status: "PUBLISHED", listing: { listingId: "listing-live-1" } }] }));

    const result = await ebayAdapter.createListing!({
      listingPackage: pkg(),
      draft: { id: 1, channel_payload: fullChannelPayload },
      accessToken: "tok",
      idempotencyKey: "key-4",
    });

    expect(result.status).toBe("LIVE");
    expect(result.externalListingId).toBe("listing-live-1");
    expect(fetchMock).toHaveBeenCalledTimes(2); // no POST offer, no POST publish
  });

  it("maps a 4xx (e.g. invalid category) to FAILED with eBay's own error detail, never to LIVE", async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ errors: [{ errorId: 25002, message: "Invalid category ID" }] }), {
        status: 400,
        headers: { "content-type": "application/json" },
      }),
    );

    const result = await ebayAdapter.createListing!({
      listingPackage: pkg(),
      draft: { id: 1, channel_payload: fullChannelPayload },
      accessToken: "tok",
      idempotencyKey: "key-5",
    });

    expect(result.status).toBe("FAILED");
    expect(result.errorCode).toBe("EBAY_25002");
    expect(result.errorMessage).toContain("Invalid category ID");
  });

  it("treats a network timeout as SUBMITTING (ambiguous), never as FAILED or LIVE", async () => {
    fetchMock.mockImplementationOnce(() => {
      const err = new Error("aborted");
      err.name = "AbortError";
      return Promise.reject(err);
    });

    const result = await ebayAdapter.createListing!({
      listingPackage: pkg(),
      draft: { id: 1, channel_payload: fullChannelPayload },
      accessToken: "tok",
      idempotencyKey: "key-6",
    });

    expect(result.status).toBe("SUBMITTING");
    expect(result.errorCode).toBe("TIMEOUT");
  });
});

describe("eBay adapter endListing (mocked external API)", () => {
  let fetchMock: ReturnType<typeof vi.fn>;
  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("withdraws the offer and reports the eBay-confirmed ENDED status", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(200, {}));
    const result = await ebayAdapter.endListing!({
      externalListingId: "listing-999",
      externalOfferId: "offer-123",
      accessToken: "tok",
      idempotencyKey: "end-key-1",
    });
    expect(result.externalStatus).toBe("ENDED");
    expect(result.errorCode).toBeNull();
  });

  it("refuses to end a listing with no stored offer ID rather than guessing one", async () => {
    const result = await ebayAdapter.endListing!({
      externalListingId: "listing-999",
      externalOfferId: null as unknown as string,
      accessToken: "tok",
      idempotencyKey: "end-key-2",
    });
    expect(result.status).toBe("FAILED");
    expect(result.errorCode).toBe("MISSING_OFFER_ID");
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
