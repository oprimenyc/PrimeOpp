# PrimeOpp Marketplace / Crosslisting Status

Date: 2026-07-22
Repo: `C:\Users\jp718\Documents\GitHub\PrimeOpp`

## Direct Answers

| Question | Answer | Evidence |
| --- | --- | --- |
| marketplace UI exists | NO | No marketplace/seller route/page in `artifacts/primeopp`; prior audit `PRIMEOPP_MARKETPLACE_LISTING_AUDIT.md` found live app is single-owner storefront. |
| crosslisting UI exists | NO | No listing channel/channel selection/crosslisting page in live app. |
| listing draft model exists | YES | `modules/marketplace-platform/packages/canonical-listing/src/index.ts`; `modules/commerce-core/docs/LISTING_CONTRACTS.md`. |
| marketplace channel model exists | YES | `modules/marketplace-platform/packages/channel-registry/src/index.ts`; `modules/marketplace-platform/docs/CHANNEL_REGISTRY.md`; `modules/commerce-core/docs/CHANNEL_ADAPTERS.md`. |
| provider adapters exist | PARTIAL | Local PrimeOpp Marketplace adapter exists; external adapters are test-only. No live eBay/Amazon/etc adapters. |
| dry-run publisher exists | YES | `modules/marketplace-platform/packages/listing-publisher/src/index.ts` works with local/test-only adapters; untracked `artifacts/commerce-worker` is also dry-run for canonical-product-to-live-products import. |
| approval gate exists | PARTIAL | Listing states and acceptance evidence exist locally; no live UI/owner approval surface. |
| live publish is enabled | NO | No provider credentials/live marketplace APIs are wired; test adapters explicitly have no live connectivity. |
| safe to claim marketplace | NO | Not safe as a live product claim. Safe only to claim local marketplace/crosslisting infrastructure exists. |
| safe to claim crosslisting | NO | Not safe as a live product claim. Safe only to claim local/test-only crosslisting workflows exist. |

## What Exists Locally

Marketplace/crosslisting code exists in `modules/marketplace-platform`:

- Canonical listing factory and state machine.
- Destination selection with PrimeOpp Marketplace visible by default.
- Channel registry.
- Listing transformation.
- Multi-channel publisher.
- Functional local in-memory PrimeOpp Marketplace adapter.
- Test-only external adapters.
- Workflow tests for visible default, opt-out, multi-channel publishing, browser-assisted outcomes, external order ingestion, inventory allocation, and adapter conformance.

Commerce-core also contributes:

- Canonical listing contracts.
- Channel adapter contracts.
- Fee engine.
- Pricing and profit engines.
- PrimeOpp Marketplace default acceptance/opt-out helper logic.

## What Does Not Exist Live

- Marketplace UI.
- Seller dashboard.
- Seller accounts connected to live auth.
- Listing draft UI.
- Channel selection UI.
- Approval queue for listing publication.
- Live external marketplace credentials.
- Live eBay/Amazon/Walmart/Etsy/etc API publish.
- Live browser-assisted posting flow.
- Live inventory sync to channels.
- Live external order ingestion.
- Live commission/settlement surface.

## Exact Missing Pieces

1. A live intake entry point: manual barcode/identifier first, camera later.
2. A live product lookup/enrichment provider configuration.
3. A durable draft listing table/model connected to the live app.
4. UI for title/description/images/category/condition/price/inventory/shipping review.
5. A channel destination selector.
6. Owner/seller acceptance and approval evidence UI.
7. A safe dry-run publish action exposed in admin/operator UI.
8. Durable publication receipt storage.
9. Real provider credential storage and runtime secret references.
10. Real external marketplace adapters, built only after dry-run and approval gates are working.
11. External order ingestion and inventory sync persistence.
12. Claim-safe live smoke tests.

## Provider Adapter Truth

PrimeOpp Marketplace adapter:

- `modules/marketplace-platform/adapters/primeopp-marketplace/src/index.ts`
- Functional local in-memory runtime.
- Not the same as a deployed public marketplace UI.
- Limitations include local in-memory storage, no real payment processing, no real shipping label purchase.

External adapters:

- `adapters/test-*`
- Explicitly test-only.
- No live connectivity.
- Some channels require browser/human-assisted outcomes in manifests.

## Claim Boundary

Safe internal statement:

- "PrimeOpp has source-proven local marketplace/crosslisting infrastructure and test-only workflows."

Not safe:

- "PrimeOpp live app has marketplace."
- "PrimeOpp can crosslist to eBay/Amazon/Walmart/etc."
- "PrimeOpp has live external marketplace adapters."
- "PrimeOpp sellers can publish listings today."

