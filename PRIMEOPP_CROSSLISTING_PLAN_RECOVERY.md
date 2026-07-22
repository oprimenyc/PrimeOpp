# PrimeOpp Crosslisting Plan Recovery

Date: 2026-07-22
Repo: `C:\Users\jp718\Documents\GitHub\PrimeOpp`
Scope: PrimeOpp only

## Recovery Verdict

Prior plan found: PARTIAL

Fable references found: NO

Fable required for implementation: NO, based on repo evidence. No source file, doc, artifact, transcript, package, or code path in this repo references Fable. If Fable existed in an external conversation, it is not recoverable from this checkout and should be treated as historical planning context only.

## Search Coverage

Searched the full repo for:

- Fable/fable
- marketplace/crosslist/cross-list/crosslisting/cross-listing
- eBay/Etsy/Amazon/Shopify/Facebook Marketplace/Mercari/Poshmark/Depop/TikTok Shop/Walmart
- listing channel/publish listing/listing draft/channel adapter/marketplace adapter/syndication/product listing/scan to listing
- barcode/UPC/EAN/GTIN
- pricing model/seller/vendor/merchant/catalog/product intelligence

The strongest evidence was in root handoffs/audits plus disconnected modules:

- `PRIMEOPP_FULL_PRODUCT_TRUTH_HANDOFF.md`
- `PRIMEOPP_FULL_PLATFORM_MAP_HANDOFF.md`
- `PRIMEOPP_BARCODE_SCANNER_AUDIT.md`
- `PRIMEOPP_MARKETPLACE_LISTING_AUDIT.md`
- `PRIMEOPP_PRICING_SCHEME_AUDIT.md`
- `PRIMEOPP_NEXT_PRODUCT_BUILD_PLAN.md`
- `PRIMEOPP_NEXT_SURFACE_DEPLOY_DECISION.md`
- `PRIMEOPP_COMMERCE_CORE_ADAPTER_CONTRACT.md`
- `modules/product-intake/primeopp-product-intake/README.md`
- `modules/product-intake/primeopp-product-intake/VERIFICATION.md`
- `modules/product-intake/primeopp-product-intake/src/domain/identifier-detector.ts`
- `modules/product-intake/primeopp-product-intake/src/adapters/scanner-adapters.ts`
- `modules/product-enrichment/primeopp-product-enrichment/README.md`
- `modules/product-enrichment/primeopp-product-enrichment/VERIFICATION.md`
- `modules/product-enrichment/primeopp-product-enrichment/src/adapters/intake-handoff.ts`
- `modules/product-enrichment/primeopp-product-enrichment/src/providers/http-provider.ts`
- `modules/product-enrichment/primeopp-product-enrichment/examples/downstream-handoff.ts`
- `modules/commerce-core/README.md`
- `modules/commerce-core/docs/PRIMEOPP_INTEGRATION_GUIDE.md`
- `modules/commerce-core/docs/BARCODE_FRAMEWORK.md`
- `modules/commerce-core/docs/PRODUCT_IDENTITY.md`
- `modules/commerce-core/docs/PRICING_ENGINE.md`
- `modules/commerce-core/docs/FEE_ENGINE.md`
- `modules/commerce-core/docs/PROFIT_ENGINE.md`
- `modules/commerce-core/docs/LISTING_CONTRACTS.md`
- `modules/commerce-core/docs/CHANNEL_ADAPTERS.md`
- `modules/commerce-core/docs/PRIMEOPP_MARKETPLACE_DEFAULT.md`
- `modules/commerce-core/examples/barcode-scan/index.ts`
- `modules/commerce-core/examples/cross-listing-ready-product/index.ts`
- `modules/marketplace-platform/README.md`
- `modules/marketplace-platform/docs/ARCHITECTURE.md`
- `modules/marketplace-platform/docs/CANONICAL_LISTING.md`
- `modules/marketplace-platform/docs/CHANNEL_REGISTRY.md`
- `modules/marketplace-platform/docs/CHANNEL_ADAPTERS.md`
- `modules/marketplace-platform/docs/PUBLICATION.md`
- `modules/marketplace-platform/docs/LISTING_TRANSFORMATION.md`
- `modules/marketplace-platform/docs/LISTING_SYNCHRONIZATION.md`
- `modules/marketplace-platform/docs/PRIMEOPP_VISIBLE_DEFAULT.md`
- `modules/marketplace-platform/docs/COMMISSION_ENGINE.md`
- `modules/marketplace-platform/docs/ORDER_ENGINE.md`
- `modules/marketplace-platform/packages/canonical-listing/src/index.ts`
- `modules/marketplace-platform/packages/listing-publisher/src/index.ts`
- `modules/marketplace-platform/packages/channel-registry/src/index.ts`
- `modules/marketplace-platform/packages/adapter-sdk/src/index.ts`
- `modules/marketplace-platform/adapters/primeopp-marketplace/src/index.ts`
- `modules/marketplace-platform/adapters/test-ebay/src/index.ts`
- `modules/marketplace-platform/packages/sdk/test/workflows.test.ts`
- `modules/deal-intelligence/README.md`
- `modules/deal-intelligence/docs/HISTORICAL_PRICING.md`
- `modules/deal-intelligence/docs/PUBLISHING_CONTRACTS.md`
- `artifacts/commerce-worker/*` (untracked, read-only context only)

## What The Prior Plan Said

Source-recovered intended PrimeOpp product:

`scan/input -> identify/classify -> enrich -> price/profit -> create listing draft -> select channels -> crosslist/publish -> manage listing/order/inventory`

The repo does not recover a single Fable-branded plan document. Instead, the plan is spread across implemented local modules:

- `product-intake` defines the first stage: scanner/manual/API/batch input, barcode/SKU classification, normalization, checksum validation, duplicate detection, and `ProductIntakeRecord` output.
- `product-enrichment` defines the second stage: convert sparse identifiers or manual fields into an evidence-backed `EnrichedProductProfile`, with provider-neutral adapters, confidence, completeness, and conflict handling.
- `commerce-core` defines product identity, canonical catalog/product models, barcode scan events, pricing observations, pricing strategies, fee schedules, profit/ROI, inventory, listing contracts, channel contracts, and local test adapters.
- `marketplace-platform` defines the multi-seller/crosslisting layer: canonical listing state machine, destination selection, channel registry, listing transformation, publisher, local PrimeOpp Marketplace adapter, test-only external adapters, seller/offer/order/inventory/commission flows.
- `deal-intelligence` defines retailer/deal intelligence, historical pricing, and publication contracts, but it is adjacent to the scan-to-crosslist owner flow rather than the live product path.

## What Is Implemented

Implemented locally and source-proven:

- Identifier classification and checksum validation for UPC/EAN/GTIN/ISBN/SKU in `product-intake`.
- Scanner event translation helpers for already-decoded camera/hardware/API values in `product-intake`.
- Intake-to-enrichment handoff adapter in `product-enrichment`.
- Fixture/manual/generic HTTP template/ISBN provider interfaces in `product-enrichment`.
- Enrichment profile, confidence, conflict, completeness, cache, provider orchestration in `product-enrichment`.
- Barcode scan event/session framework and local test barcode adapter in `commerce-core`.
- Product identity resolution states and resolver inputs in `commerce-core`.
- Pricing engine, fee engine, profit engine, canonical listing contracts, channel adapter contracts in `commerce-core`.
- Canonical listing model/state machine/destination selection in `marketplace-platform`.
- Channel registry with PrimeOpp Marketplace plus external marketplace test manifests in `marketplace-platform`.
- Listing transformer and multi-channel publisher in `marketplace-platform`.
- Functional local in-memory PrimeOpp Marketplace adapter in `marketplace-platform`.
- Test-only external adapters for eBay, Amazon, Walmart, Facebook Marketplace, OfferUp, Depop, Poshmark, Mercari, Etsy, GOAT, StockX, Alias, Flight Club, Stadium Goods, Grailed, Whatnot, Craigslist in `marketplace-platform`.
- Workflow tests proving visible default, seller opt-out, multi-channel test publication, external order ingestion, oversell prevention, and adapter conformance in `modules/marketplace-platform/packages/sdk/test/workflows.test.ts`.
- Untracked dry-run `artifacts/commerce-worker` maps canonical products to the live `products` row shape and refuses writes unless two explicit env gates are set. This is workspace context only and was not staged.

## What Is Missing

Missing from the live app:

- Camera barcode scanner UI.
- Manual barcode/identifier input in the deployed admin UI.
- API route that accepts scan/identifier payloads.
- Live product lookup provider for UPC/EAN/GTIN.
- Live enrichment provider configuration.
- Connected intake -> enrichment -> pricing -> listing draft workflow.
- Listing draft UI.
- Marketplace/crosslisting UI.
- Seller onboarding/account model in the deployed app.
- Approval gate UI for listing publication.
- Live external marketplace provider credentials/adapters.
- Safe dry-run publisher exposed through the deployed app.
- Any live claim that eBay/Amazon/etc publication works.

## What Recent Audits Incorrectly Omitted

Recent live-surface audits were correct about the deployed ecommerce/API slice, but incomplete as product maps:

- They treated `artifacts/primeopp` + `artifacts/api-server` as the active product, which is true for Railway live proof but not the full intended PrimeOpp.
- They correctly reported barcode scanner and marketplace as missing from the live app, but did not preserve the disconnected local plan/code in `product-intake`, `product-enrichment`, `commerce-core`, and `marketplace-platform`.
- They underweighted `marketplace-platform`: it is not live, but it is not merely a name. It contains real local contracts, state machines, publisher orchestration, a local PrimeOpp Marketplace adapter, test-only channel adapters, and workflow tests.
- They did not distinguish "safe to claim live marketplace" from "source-proven local marketplace/crosslisting infrastructure exists."

## Fable Conclusion

Fable references found: NO

Fable is not required by any source-proven implementation in this repo. The recovered implementation path should use the repo's actual modules, not an unrecovered external Fable plan.

