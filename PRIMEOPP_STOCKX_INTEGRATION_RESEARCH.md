# StockX Integration Research

Status: **research only — no adapter built**. This documents what is actually
known about StockX's official developer API, sourced from StockX's own
developer portal and public third-party reporting on it (searched
2026-08-10; see Sources at the bottom). It does not use scraping or any
undocumented endpoint, and none of it is fabricated to fill a gap in what's
publicly documented.

## Why no adapter exists yet

1. **No credentials.** The owner's StockX API application is pending
   (per the mission brief). Nothing here can be tested end-to-end without it.
2. **No verified request/response schemas.** StockX's reference docs live
   behind a JavaScript-rendered portal (`developer.stockx.com/portal/...`)
   that didn't yield machine-readable content to this research pass — only
   endpoint *names* were confirmed via search-indexed pages (e.g.
   `GetListingOperations`, `ActivateListing`, `GetVariantMarketData`,
   `GetVariant`), not their exact parameters or response bodies.
3. **Third-party reports of inconsistent availability.** At least one
   developer write-up (kicks.dev, Oct 2024) reported that only
   `/v2/catalog/search` worked reliably in practice and that market-data
   endpoints were non-functional for them at the time. That's a single
   secondhand data point, not confirmed by PrimeOpp directly — but it's
   reason enough not to build against assumed behavior.

Building a client against unverified shapes would mean guessing field names
— exactly the fabrication this project refuses to do. The eBay adapter
(`artifacts/api-server/src/lib/channelAdapters/ebayAdapter.ts`) could be
built now because eBay's Sell API schemas are fully public. StockX's are not,
in the same way, until an approved application also grants full reference
access.

## What is confirmed

**Access process:** Apply at `developer.stockx.com`. StockX's own review
takes on the order of 1–2 weeks and reportedly requires a public-facing
description of the application requesting access (not just a company name).

**Authentication — OAuth2 authorization-code flow, structurally similar to
eBay's but with two differences that matter for implementation:**
- Requested scopes are `offline_access` and `openid` (not a StockX-specific
  scope name).
- Every API request needs **two** credentials, not one: the `Authorization:
  Bearer <access_token>` header *and* a separate `x-api-key` header (issued
  alongside `client_id`/`client_secret` when an application is created in
  the portal's Keys page). eBay's Sell API only needs the bearer token.
- Access tokens are valid **12 hours**; refresh tokens are valid **30 days**
  (vs. eBay, whose token lifetimes are configured per-application in eBay's
  own developer console and aren't fixed constants like this).

**API surface — three categories, distinct from eBay's Inventory/Offer
model:**
- **Catalog API** — product and variant search, i.e. resolving a real-world
  item to StockX's internal product+variant IDs. This is the equivalent of
  PrimeOpp's own identity-resolution step, done against StockX's catalog
  instead of PrimeOpp's own.
- **Listing API** — endpoints named `GetListingOperations` and
  `ActivateListing` were confirmed to exist; a listing is created against a
  specific catalog **variant** (StockX sells specific size/condition
  variants, not freeform products) with an ask price, and has an
  activate/deactivate lifecycle rather than eBay's single publish/withdraw.
- **Order API** — active and historical sales.

## The structural difference that matters most for PrimeOpp's data model

StockX is a **consignment/authentication marketplace**, not a seller-direct
one:

- eBay: seller ships directly to the buyer. PrimeOpp's existing
  `externalPublishEnabled`/fulfillment-disabled model maps cleanly — the
  seller's own account handles shipping.
- StockX: when an ask is matched to a bid, the **seller ships to StockX**
  first. StockX authenticates the physical item, and only then pays out the
  seller and ships to the buyer. A "sale" on StockX is not the same event as
  a "sale" on eBay — it introduces an authentication step PrimeOpp's
  `orderState.ts` / fulfillment model has no concept of today.

This means a real StockX adapter cannot reuse
`lib/channelPublish.ts`'s `LIVE`/`ENDED` states as-is for anything past the
listing step — a StockX "sale" needs its own state (ship-to-StockX,
pending-authentication, authenticated, paid-out) that doesn't exist in
PrimeOpp's schema. That's out of scope until real API access makes it
possible to verify the exact status values StockX actually returns.

## What PrimeOpp is NOT doing about this today

- Not building a `stockxAdapter.ts`.
- Not adding StockX to `lib/oauth.ts`'s `OAUTH_PROVIDERS` (no verified
  `authorizeUrl`/`tokenUrl` to put there — putting in a guessed URL would be
  exactly the kind of fabrication this system refuses to do elsewhere).
- Not adding StockX to `channelAdapters/index.ts` (no `ChannelAdapter` to
  register).
- `lib/platformPricing.ts` already lists `stockx` as a market-pricing
  key, correctly reporting `NOT_CONFIGURED` — that entry is unaffected and
  stays as-is; it's a *pricing* placeholder, not a listing one, and this
  research doesn't change that boundary (see Phase 11's pricing-vs-listing
  separation — StockX being priced doesn't imply StockX being listable, and
  vice versa).

## The moment real access/documentation lands

The minimum needed to start a real `stockxAdapter.ts`, mirroring the eBay
build:

1. Confirmed `client_id`/`client_secret`/`x-api-key` and the actual
   authorize/token URLs (add a `stockx` entry to `OAUTH_PROVIDERS` in
   `lib/oauth.ts` — the existing OAuth machinery, including encrypted token
   storage, already supports a second provider with zero changes needed
   there beyond the registry entry, since `x-api-key` can be stored as a
   third encrypted "token" alongside access/refresh using the same
   `encryptToken`/`decryptToken` helpers).
2. Verified request/response JSON for: catalog variant search, create/get
   listing, activate/deactivate listing.
3. A decision on how (or whether) to represent StockX's authentication step
   in PrimeOpp's order/fulfillment model — a real product/schema decision,
   not just an API client.

Until then this stays `NOT_CONFIGURED` with a precise, honest boundary
(this document) rather than a guessed implementation.

## Sources

- [StockX Developer Portal](https://developer.stockx.com/)
- [StockX Public API (2.0.0) reference index](https://developer.stockx.com/portal/api-reference)
- [About the StockX Developers Portal — kicks.dev](https://kicks.dev/blog/2024-10-about-stockx-developers)
- [Get all listing operations — StockX OpenAPI reference](https://developer.stockx.com/openapi/reference/operation/GetListingOperations/)
- [Activate a listing — StockX OpenAPI reference](https://developer.stockx.com/openapi/reference/operation/ActivateListing/)
- [Get market data for a variant — StockX OpenAPI reference](https://developer.stockx.com/openapi/reference/operation/GetVariantMarketData/)
