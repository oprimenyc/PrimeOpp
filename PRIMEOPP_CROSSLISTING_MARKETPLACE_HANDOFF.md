# PrimeOpp Crosslisting Marketplace Handoff

VERDICT:
PASS WITH BLOCKERS

CURRENT LIVE URL:
https://primeopp-production-a554.up.railway.app

CURRENT LIVE SCOPE:
Single-operator ecommerce/API storefront and admin slice: customer browsing/product pages/cart/order lookup/contact/browser-local wishlist, admin product CRUD/order/revenue/review moderation surfaces, Stripe checkout code path fail-closed, POD/email code paths gated by configuration. It does not prove scan-to-crosslist, marketplace, seller, listing draft, or external channel publishing.

PRIOR FABLE/PLAN RECOVERED:
PARTIAL

FABLE REQUIRED TO IMPLEMENT:
NO

INTENDED PRIMEOPP FLOW:
scan -> identify -> enrich -> price -> listing draft -> crosslist/publish -> manage

BARCODE SCANNER:
PARTIAL

LISTING DRAFT:
LOCAL_READY

MARKETPLACE UI:
MISSING

CROSSLISTING:
LOCAL_READY

CHANNEL ADAPTERS:
PARTIAL

DRY-RUN PUBLISHER:
YES

PROVIDER LIVE PUBLISH:
DISABLED

PRICING MODEL:
Live model is PRODUCT_MARKUP: admin-entered product/per-color price plus discount redemption and hardcoded shipping. Intended local model is commerce-core pricing observations + pricing strategies + fee engine + profit engine + marketplace-platform commission policies. No live comps provider or live margin/pricing engine is connected.

SAFE TO CLAIM MARKETPLACE:
NO

SAFE TO CLAIM CROSSLISTING:
NO

NEXT PRODUCT BLOCKER:
Manual barcode/identifier entry and classification in the admin/API.

NEXT IMPLEMENTATION PROMPT:
`PRIMEOPP_NEXT_CROSSLISTING_BUILD_PLAN.md`

SECRETS PRINTED:
NO

PROVIDERS MUTATED:
NO

DNS MODIFIED:
NO

COMMIT:
a5493d1

PUSHED:
YES

## Summary

PrimeOpp is not only the live ecommerce/API slice. The repo contains a source-proven intended scan-to-crosslist product map across `product-intake`, `product-enrichment`, `commerce-core`, and `marketplace-platform`.

The prior plan is recovered partially: no Fable artifact exists, but the architecture and implementation seams are explicit in the modules and docs.

The live product remains narrower than the intended product. It is not safe to claim live marketplace or live crosslisting.

## Critical Evidence

- `modules/product-intake/primeopp-product-intake`: intake/classification/checksum/dedupe, but no live app wiring.
- `modules/product-enrichment/primeopp-product-enrichment`: enrichment/confidence/conflict/provider templates, but no live provider or app wiring.
- `modules/commerce-core`: barcode framework, identity, pricing, fees, profit, listing/channel contracts.
- `modules/marketplace-platform`: canonical listing, channel registry, listing publisher, local PrimeOpp Marketplace adapter, test-only external adapters, workflow tests.
- `artifacts/primeopp` and `artifacts/api-server`: deployed ecommerce/admin/API slice only.
- `artifacts/commerce-worker`: untracked dry-run product import bridge; preserved and not staged.

## Blockers

1. No live scan/manual identifier entry point.
2. No live product lookup provider.
3. No live enrichment route.
4. No live pricing/comps route.
5. No live listing draft UI/model.
6. No live marketplace/crosslisting UI.
7. No live approval gate.
8. No live external marketplace provider adapters.

## Next Single Action

Build the manual barcode/identifier classification endpoint and admin UI result display, with no DB writes and no provider calls.
