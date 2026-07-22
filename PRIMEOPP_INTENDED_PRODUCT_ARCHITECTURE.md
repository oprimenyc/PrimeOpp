# PrimeOpp Intended Product Architecture

Date: 2026-07-22
Repo: `C:\Users\jp718\Documents\GitHub\PrimeOpp`

## Intended Flow

`scan product -> identify/classify -> enrich -> price -> listing draft -> crosslist/publish -> manage`

Current live scope is narrower: the Railway app proves ecommerce/API storefront/admin only. The intended scan-to-crosslist product exists as disconnected local modules and plans.

## 1. Intake

Intended behavior:

- Camera barcode scanner.
- Manual identifier fallback.
- Hardware scanner/API/batch input support.
- SKU/UPC/EAN/GTIN/ISBN classification and validation.
- Produce a normalized intake record that can move downstream.

Current code status:

- `modules/product-intake/primeopp-product-intake` implements barcode/manual/batch/API intake contracts, identifier classification, checksum validation, scanner event translation, dedupe, and `ProductIntakeRecord`.
- `modules/commerce-core/packages/barcode` implements scan events, scan sessions, barcode validation, offline queue, and a local test lookup adapter.
- Camera decoding is not implemented. `cameraScanToEvent()` expects an already-decoded string.

Live status:

- MISSING from live app. No route, page, API endpoint, or admin form field accepts barcode/identifier input.

Next blocker:

- Add a manual barcode/identifier entry point first, then camera decoding.

## 2. Identification

Intended behavior:

- Normalize a scan/manual identifier.
- Classify identifier type.
- Validate checksum and ambiguity.
- Resolve identity against providers/catalogs.
- Never silently pick low-confidence matches.

Current code status:

- `product-intake/src/domain/identifier-detector.ts` classifies UPC_A, EAN_8, EAN_13, GTIN_14, ISBN_10, ISBN_13, SKU, UNKNOWN.
- `product-enrichment` accepts normalized identifiers/manual fields and can create an evidence-backed enriched profile.
- `commerce-core/docs/PRODUCT_IDENTITY.md` defines resolution states: EXACT_MATCH, HIGH_CONFIDENCE_MATCH, POSSIBLE_MATCH, MULTIPLE_CANDIDATES, VARIANT_AMBIGUITY, CONFLICTED, NO_MATCH, REQUIRES_HUMAN_REVIEW.
- No real UPC/EAN/GTIN lookup provider is configured. `GenericHttpProductProvider` is a template, disabled by default.

Live status:

- MISSING from live app.

Next blocker:

- Wire identifier classification into the admin/API, then add a real product-data provider or internal catalog lookup.

## 3. Enrichment

Intended behavior:

- Turn sparse input into title, brand, model, category, attributes, description, bullets, images, identifiers, confidence, completeness, conflicts, and evidence.
- Allow provider priority and conflict-aware resolution.

Current code status:

- `product-enrichment` implements fixture/manual providers, a generic HTTP provider template, ISBN provider contract, cache, confidence, completeness, conflicts, and output profile.
- `product-enrichment/src/adapters/intake-handoff.ts` maps eligible intake records into enrichment input.
- `examples/downstream-handoff.ts` defines a handoff shape to a hypothetical comps module.

Live status:

- MISSING from live app and not imported by `artifacts/api-server` or `artifacts/primeopp`.

Next blocker:

- Only meaningful after intake exists. Then wire `ProductEnrichmentService` behind a safe admin-only preview endpoint.

## 4. Listing Draft

Intended fields:

- title
- description
- images
- category
- condition
- price
- inventory
- shipping
- identifiers
- channel destinations
- seller disclosures/approval evidence

Current code status:

- `commerce-core/docs/LISTING_CONTRACTS.md` defines canonical listings with identity, classification, media, pricing, inventory, shipping, metadata, channels, and lifecycle.
- `marketplace-platform/packages/canonical-listing/src/index.ts` implements a canonical listing factory, destination selection, visible PrimeOpp default, and deterministic listing state transitions.
- `marketplace-platform/docs/CANONICAL_LISTING.md` defines DRAFT, INCOMPLETE, READY, NEEDS_REVIEW, APPROVAL_REQUIRED, APPROVED, PUBLISHING, PARTIALLY_PUBLISHED, ACTIVE, PAUSED, SOLD, PARTIALLY_SOLD, ENDED, EXPIRED, ERROR, NEEDS_ATTENTION, ARCHIVED.

Live status:

- The live app has admin product creation, but not a listing draft model/UI. Live products go directly into the ecommerce catalog.

Next blocker:

- Build listing draft data/UI after scan/intake can produce a candidate product. Do not skip straight to provider publishing.

## 5. Pricing

Intended behavior:

- Use market observations/comps.
- Estimate market value range.
- Choose pricing strategy.
- Include cost basis, platform fees, payment fees, shipping, labor, storage, promotion, return reserve.
- Compute target margin, ROI, break-even, minimum acceptable price, offer floor, and minimum profitable price.
- Preserve uncertainty rather than showing false precision.

Current code status:

- Live ecommerce pricing is `PRODUCT_MARKUP`: admin-entered per-product/per-color prices plus a real discount engine and hardcoded shipping rates.
- `commerce-core/docs/PRICING_ENGINE.md` defines strategies: QUICK_FLIP, BALANCED, MAX_MARGIN, MARKET_MATCH, CLEARANCE, AGED_INVENTORY, ENTERPRISE_POLICY, CUSTOM.
- `commerce-core/docs/FEE_ENGINE.md` defines fee types/models/versioned schedules.
- `commerce-core/docs/PROFIT_ENGINE.md` defines net profit, margin, ROI, break-even price, maximum buy price.
- `marketplace-platform/docs/COMMISSION_ENGINE.md` defines versioned commission policies and launch promotion/zero-fee style policies.
- `deal-intelligence/docs/HISTORICAL_PRICING.md` defines price observation/statistics, but storage is in-memory plus interface contracts.

Live status:

- Live only has admin-entered product pricing and discount redemption. No marketplace comps, target margin, platform-fee pricing, or profit engine is connected to the live app.

Next blocker:

- After enrichment, create a pricing preview using local/fake observations or explicit manual comps. Do not claim market pricing until real comps providers exist.

## 6. Crosslisting / Marketplace

Intended behavior:

- One canonical listing can publish to multiple destinations.
- PrimeOpp Marketplace appears visibly by default and can be disabled.
- External marketplace adapters are channel-specific and explicit.
- Publish states include DRAFT / READY / APPROVAL_REQUIRED / PUBLISHED-style terminal states, with source modules using richer exact states.
- Channel-specific required fields are checked through manifests/transformers.
- Provider credentials are required for real provider publishing.
- Safe dry-run/test mode must precede any live provider write.

Intended marketplace channels found:

- PrimeOpp Marketplace (local functional adapter, not live web marketplace)
- eBay (TEST)
- Amazon (TEST)
- Walmart (TEST)
- Facebook Marketplace (TEST, browser/human-assisted)
- OfferUp (TEST, browser/human-assisted)
- Depop (TEST, browser/human-assisted)
- Poshmark (TEST, browser/human-assisted)
- Mercari (TEST, browser/human-assisted)
- Etsy (TEST)
- GOAT (TEST)
- StockX (TEST)
- Alias (TEST)
- Flight Club (TEST)
- Stadium Goods (TEST)
- Grailed (TEST, browser/human-assisted)
- Whatnot (TEST, browser/human-assisted)
- Craigslist (TEST, browser/human-assisted)

Current code status:

- `marketplace-platform` has channel manifests, adapter SDK, listing transformer, listing publisher, local PrimeOpp Marketplace adapter, and test-only external adapters.
- `listing-publisher` validates, checks visible default, moderates, transitions READY -> APPROVED -> PUBLISHING, publishes to each enabled destination, and emits terminal states.
- `test-*` adapters clearly declare no live connectivity.

Live status:

- MISSING from live app. No marketplace UI, seller UI, crosslisting UI, live external publish, or provider credentials are connected.

Next blocker:

- Listing draft model/UI before channel publishing. Dry-run publisher after channel selection exists.

## 7. Management

Intended behavior:

- Listing status and channel status management.
- Order status and external order ingestion.
- Inventory sync and oversell prevention.
- Delist/unpublish/pause/resume/end.
- Owner/seller approvals and evidence.

Current code status:

- `marketplace-platform` implements listing states, external order engine, inventory sync, order idempotency, offers, settlement/commission docs, and adapter methods for pause/resume/end/syncInventory/syncPrice.
- Workflow tests cover seller opt-out, multi-channel crosslisting, external order ingestion, oversell prevention, and browser-assisted/human-assisted channel outcomes.

Live status:

- Live app manages ecommerce orders only. It has no channel listing state, seller channel accounts, external order ingestion, or marketplace inventory sync.

Next blocker:

- Management should wait until listing draft + dry-run publisher exist.

## Architecture Summary

| Area | Intended behavior | Current code status | Live status | Next blocker |
| --- | --- | --- | --- | --- |
| Intake | scan/manual/API/batch input | LOCAL_READY identifier math and scanner-event contracts | MISSING | Manual identifier endpoint/UI |
| Identification | classify + resolve identity | PARTIAL local modules; no real lookup provider | MISSING | Provider/internal catalog lookup |
| Enrichment | evidence-backed product profile | LOCAL_READY module; fixture/manual/HTTP template | MISSING | Admin preview endpoint after intake |
| Pricing | comps + fees + profit | LOCAL_READY engines; live only flat admin price | PARTIAL live ecommerce only | Pricing preview after enrichment |
| Listing draft | canonical listing lifecycle | LOCAL_READY models/state machines | MISSING | Draft model/UI |
| Crosslisting | destination selection + publish | LOCAL_READY/test-only publisher/adapters | MISSING | Safe dry-run exposed in app |
| Management | status/order/inventory sync | LOCAL_READY platform packages | MISSING | Channel state after dry-run |

