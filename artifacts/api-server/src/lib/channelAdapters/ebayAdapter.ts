// ebayAdapter.ts — eBay Sell Inventory API adapter.
//
// Every request here targets eBay's documented Sell Inventory API:
//   https://developer.ebay.com/api-docs/sell/inventory/overview.html
// No undocumented or guessed endpoint is used. All calls require a caller-
// supplied, already-decrypted access token -- this module never reads
// encrypted token columns or the encryption key itself (see lib/oauth.ts for
// that boundary).
//
// isConfigured() only reports whether EBAY_CLIENT_ID/EBAY_CLIENT_SECRET exist
// (the same requirement lib/oauth.ts already uses for the eBay OAuth flow).
// It does NOT mean publish is authorized -- routes/listings.ts additionally
// requires the connection's publish_authorized flag before ever calling
// createListing/updateListing/endListing here. That second gate is
// deliberate and is not this adapter's job to enforce.

import type {
  ChannelAdapter,
  ChannelCapabilities,
  ChannelEndInput,
  ChannelPublishInput,
  ChannelPublishResult,
  ChannelRetrieveInput,
  ChannelRetrieveResult,
  PreflightResult,
} from "../channelAdapter.js";
import {
  buildInventoryItemPayload,
  buildOfferPayload,
  preflightEbayListing,
  type EbayChannelPayload,
} from "./ebayMapping.js";

const REQUEST_TIMEOUT_MS = 20_000;

function ebayApiBase(): string {
  // EBAY_ENVIRONMENT unset or "production" -> production API. Any other
  // value (e.g. "sandbox") -> eBay's sandbox host, for safe end-to-end
  // testing against a real (non-production) eBay environment before this is
  // ever pointed at api.ebay.com.
  return process.env["EBAY_ENVIRONMENT"] === "sandbox"
    ? "https://api.sandbox.ebay.com"
    : "https://api.ebay.com";
}

function isConfigured(): boolean {
  return Boolean(process.env["EBAY_CLIENT_ID"] && process.env["EBAY_CLIENT_SECRET"]);
}

type EbayErrorDetail = { errorId?: number; message?: string; longMessage?: string };
type EbayErrorBody = { errors?: EbayErrorDetail[] };

async function ebayFetch(
  path: string,
  accessToken: string,
  init: { method: string; body?: unknown; extraHeaders?: Record<string, string> },
): Promise<{ ok: true; status: number; json: unknown } | { ok: false; kind: "TIMEOUT" | "NETWORK" | "HTTP"; status?: number; errorCode: string; errorMessage: string }> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const res = await fetch(`${ebayApiBase()}${path}`, {
      method: init.method,
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
        "Content-Language": "en-US",
        ...(init.extraHeaders ?? {}),
      },
      body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
    });

    let json: unknown = null;
    try {
      json = res.status === 204 ? null : await res.json();
    } catch {
      json = null;
    }

    if (!res.ok) {
      const body = json as EbayErrorBody | null;
      const detail = body?.errors?.[0];
      return {
        ok: false,
        kind: "HTTP",
        status: res.status,
        // eBay's own errorId when present is the most specific mapping we can
        // surface; falling back to the HTTP status keeps this deterministic
        // even for error shapes we haven't seen.
        errorCode: detail?.errorId ? `EBAY_${detail.errorId}` : `HTTP_${res.status}`,
        errorMessage: detail?.longMessage ?? detail?.message ?? `eBay API returned HTTP ${res.status}`,
      };
    }

    return { ok: true, status: res.status, json };
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") {
      // A timeout is explicitly NOT a failure -- eBay may have received and
      // processed the request. The caller must treat this as SUBMITTING and
      // reconcile on the next attempt, never as FAILED and never as LIVE.
      return { ok: false, kind: "TIMEOUT", errorCode: "TIMEOUT", errorMessage: "eBay API request timed out before a response was received" };
    }
    return {
      ok: false,
      kind: "NETWORK",
      errorCode: "NETWORK_ERROR",
      errorMessage: err instanceof Error ? err.message : "Network error calling eBay API",
    };
  } finally {
    clearTimeout(timeout);
  }
}

function ambiguousResult(errorCode: string, errorMessage: string): ChannelPublishResult {
  // TIMEOUT/NETWORK failures are unresolved, not failed -- status stays
  // SUBMITTING so a retry reconciles against eBay's actual state instead of
  // silently reporting FAILED for a request eBay may have accepted.
  return { status: "SUBMITTING", externalListingId: null, externalOfferId: null, externalStatus: null, errorCode, errorMessage };
}

function failedResult(errorCode: string, errorMessage: string): ChannelPublishResult {
  return { status: "FAILED", externalListingId: null, externalOfferId: null, externalStatus: null, errorCode, errorMessage };
}

// Looks up an existing offer for this SKU before creating a new one -- the
// reconciliation step that makes retries idempotent at the eBay boundary
// itself, on top of PrimeOpp's own idempotency_key uniqueness.
async function findExistingOfferBySku(
  sku: string,
  marketplaceId: string,
  accessToken: string,
): Promise<{ offerId: string; status: string | null; listingId: string | null } | null> {
  const result = await ebayFetch(
    `/sell/inventory/v1/offer?sku=${encodeURIComponent(sku)}&marketplace_id=${encodeURIComponent(marketplaceId)}`,
    accessToken,
    { method: "GET" },
  );
  if (!result.ok) return null;
  const body = result.json as { offers?: Array<{ offerId?: string; status?: string; listing?: { listingId?: string } }> } | null;
  const offer = body?.offers?.[0];
  if (!offer?.offerId) return null;
  return { offerId: offer.offerId, status: offer.status ?? null, listingId: offer.listing?.listingId ?? null };
}

async function createOrReplaceInventoryItem(
  input: ChannelPublishInput,
  channelPayload: EbayChannelPayload,
): Promise<{ ok: true } | { ok: false; result: ChannelPublishResult }> {
  const payload = buildInventoryItemPayload(input.listingPackage, channelPayload);
  const res = await ebayFetch(`/sell/inventory/v1/inventory_item/${encodeURIComponent(payload.sku)}`, input.accessToken, {
    method: "PUT",
    body: payload,
  });
  if (res.ok) return { ok: true };
  if (res.kind === "TIMEOUT" || res.kind === "NETWORK") return { ok: false, result: ambiguousResult(res.errorCode, res.errorMessage) };
  return { ok: false, result: failedResult(res.errorCode, res.errorMessage) };
}

async function publishFlow(input: ChannelPublishInput): Promise<ChannelPublishResult> {
  const channelPayload = input.draft.channel_payload as EbayChannelPayload;
  const preflight = preflightEbayListing(input.listingPackage, channelPayload);
  if (!preflight.canPublish) {
    return failedResult(
      "PREFLIGHT_FAILED",
      `Listing failed eBay preflight validation: ${preflight.issues.map((i) => i.message).join(" ")}`,
    );
  }

  const offerPayload = buildOfferPayload(input.listingPackage, channelPayload);
  if (!offerPayload) {
    // Cannot happen when preflight passed, but never fabricate a payload from
    // incomplete data -- fail explicitly if it somehow does.
    return failedResult("OFFER_PAYLOAD_INCOMPLETE", "eBay offer payload could not be built from the current listing configuration.");
  }

  const itemResult = await createOrReplaceInventoryItem(input, channelPayload);
  if (!itemResult.ok) return itemResult.result;

  // Reconcile before creating: an existing offer for this SKU (e.g. from a
  // prior attempt whose response was lost to a timeout) is reused rather
  // than creating a second one.
  const existing = await findExistingOfferBySku(offerPayload.sku, offerPayload.marketplaceId, input.accessToken);
  let offerId = existing?.offerId ?? null;

  if (!offerId) {
    const createRes = await ebayFetch(`/sell/inventory/v1/offer`, input.accessToken, { method: "POST", body: offerPayload });
    if (!createRes.ok) {
      if (createRes.kind === "TIMEOUT" || createRes.kind === "NETWORK") return ambiguousResult(createRes.errorCode, createRes.errorMessage);
      return failedResult(createRes.errorCode, createRes.errorMessage);
    }
    const body = createRes.json as { offerId?: string } | null;
    offerId = body?.offerId ?? null;
    if (!offerId) return failedResult("OFFER_ID_MISSING", "eBay accepted the offer request but returned no offerId.");
  } else if (existing?.listingId) {
    // Already published from a prior attempt -- confirmed LIVE by eBay, not
    // assumed.
    return {
      status: "LIVE",
      externalListingId: existing.listingId,
      externalOfferId: offerId,
      externalStatus: existing.status,
      errorCode: null,
      errorMessage: null,
    };
  }

  const publishRes = await ebayFetch(`/sell/inventory/v1/offer/${encodeURIComponent(offerId)}/publish`, input.accessToken, { method: "POST" });
  if (!publishRes.ok) {
    if (publishRes.kind === "TIMEOUT" || publishRes.kind === "NETWORK") {
      // The offer exists either way -- record its id so a reconciled retry
      // has it even if this attempt never learns whether publish succeeded.
      return { ...ambiguousResult(publishRes.errorCode, publishRes.errorMessage), externalOfferId: offerId };
    }
    return { ...failedResult(publishRes.errorCode, publishRes.errorMessage), externalOfferId: offerId };
  }

  const publishBody = publishRes.json as { listingId?: string } | null;
  const listingId = publishBody?.listingId ?? null;
  if (!listingId) {
    // eBay returned 200 without a listingId -- an unknown-but-not-error
    // state. Never claim LIVE without eBay affirmatively confirming a
    // listing ID; leave it SUBMITTING for a status sync to resolve.
    return { status: "SUBMITTING", externalListingId: null, externalOfferId: offerId, externalStatus: "PUBLISH_ACKNOWLEDGED_NO_LISTING_ID", errorCode: null, errorMessage: null };
  }

  return { status: "LIVE", externalListingId: listingId, externalOfferId: offerId, externalStatus: "PUBLISHED", errorCode: null, errorMessage: null };
}

async function endListing(input: ChannelEndInput): Promise<ChannelPublishResult> {
  if (!input.externalOfferId) {
    return failedResult("MISSING_OFFER_ID", "Cannot end an eBay listing without a stored offer ID.");
  }
  const res = await ebayFetch(`/sell/inventory/v1/offer/${encodeURIComponent(input.externalOfferId)}/withdraw`, input.accessToken, { method: "POST" });
  if (!res.ok) {
    if (res.kind === "TIMEOUT" || res.kind === "NETWORK") return ambiguousResult(res.errorCode, res.errorMessage);
    return failedResult(res.errorCode, res.errorMessage);
  }
  return {
    status: "LIVE", // caller (channelPublish.ts) maps ENDED explicitly on success; this adapter reports the eBay-confirmed outcome only
    externalListingId: input.externalListingId,
    externalOfferId: input.externalOfferId,
    externalStatus: "ENDED",
    errorCode: null,
    errorMessage: null,
  };
}

async function retrieveListing(input: ChannelRetrieveInput): Promise<ChannelRetrieveResult> {
  if (!input.externalOfferId) return { found: false, externalStatus: null };
  const res = await ebayFetch(`/sell/inventory/v1/offer/${encodeURIComponent(input.externalOfferId)}`, input.accessToken, { method: "GET" });
  if (!res.ok) return { found: false, externalStatus: null };
  const body = res.json as { status?: string } | null;
  return { found: true, externalStatus: body?.status ?? null, raw: body as Record<string, unknown> | undefined };
}

const CAPABILITIES: ChannelCapabilities = {
  connect: true,
  createListing: true,
  updateListing: true,
  endListing: true,
  retrieveListing: true,
  syncStatus: true,
};

export const ebayAdapter: ChannelAdapter = {
  key: "ebay",
  label: "eBay",
  capabilities: CAPABILITIES,
  requiredEnv: ["EBAY_CLIENT_ID", "EBAY_CLIENT_SECRET"],
  isConfigured,
  preflight(input): PreflightResult {
    return preflightEbayListing(input.listingPackage, input.draft.channel_payload as EbayChannelPayload);
  },
  async createListing(input: ChannelPublishInput): Promise<ChannelPublishResult> {
    return publishFlow(input);
  },
  async updateListing(input: ChannelPublishInput): Promise<ChannelPublishResult> {
    // eBay's createOrReplaceInventoryItem + updateOffer are the same PUT/PUT
    // shape as create for the fields this adapter maps, so an update reuses
    // the identical flow; findExistingOfferBySku means it revises the
    // existing offer instead of publishing a duplicate.
    return publishFlow(input);
  },
  async endListing(input: ChannelEndInput): Promise<ChannelPublishResult> {
    return endListing(input);
  },
  async retrieveListing(input: ChannelRetrieveInput): Promise<ChannelRetrieveResult> {
    return retrieveListing(input);
  },
};
