# PrimeOpp Owner Product Map Corrected

Date: 2026-07-22
Repo: `C:\Users\jp718\Documents\GitHub\PrimeOpp`

## 1. What PrimeOpp Is Supposed To Be

PrimeOpp is supposed to be a scan-to-crosslist commerce product:

`scan product -> identify product -> enrich product -> price it -> create listing draft -> crosslist/publish to marketplaces -> manage listing/order/inventory flow`

The current live ecommerce site is not the whole product. It is one deployed slice.

## 2. The Scan-To-Crosslist Workflow

The intended workflow is:

1. Scan or manually enter a barcode/SKU/product identifier.
2. Classify the identifier as UPC/EAN/GTIN/ISBN/SKU or unknown.
3. Look up/enrich product details.
4. Resolve conflicts and confidence.
5. Estimate price using comps/fees/profit rules.
6. Create a listing draft.
7. Select destinations/channels.
8. Owner/seller approves final publication.
9. Dry-run publish first.
10. Only later, publish to real marketplace providers.
11. Manage listing status, inventory, and orders.

## 3. What Exists Live Today

Current live URL:

`https://primeopp-production-a554.up.railway.app`

Current live scope:

- Customer ecommerce storefront.
- Product browsing/product pages.
- Cart.
- Checkout code path with Stripe fail-closed if keys are absent.
- Order success/lookup surface.
- Contact form.
- Browser-local wishlist.
- Admin login/product CRUD/order management/revenue/review moderation surfaces.
- POD/fulfillment/email code paths, gated by configuration.

The live app is a single-operator ecommerce/API slice, not a marketplace or crosslisting product.

## 4. What Exists But Is Disconnected

Disconnected local modules:

- `modules/product-intake/primeopp-product-intake`: identifier intake/classification/checksum/dedupe.
- `modules/product-enrichment/primeopp-product-enrichment`: provider-neutral enrichment, confidence, conflicts, completeness, provider templates.
- `modules/commerce-core`: barcode framework, identity resolution, canonical catalog, pricing, fees, profit, inventory, listing contracts, channel contracts.
- `modules/marketplace-platform`: canonical listing, channel registry, listing transformer, publisher, local PrimeOpp Marketplace adapter, test-only external adapters, seller/order/inventory/commission flows.
- `modules/deal-intelligence`: retailer/deal intelligence, historical pricing, and publication contracts.
- `artifacts/commerce-worker`: untracked dry-run canonical-product-to-live-products adapter; not staged, not live, not a scan/crosslisting solution.

## 5. What Does Not Exist Yet

- Live camera barcode scanner.
- Live manual barcode/identifier entry.
- Live scan API endpoint.
- Live product lookup provider.
- Live enrichment endpoint.
- Live pricing/comps preview.
- Live listing draft UI.
- Live marketplace UI.
- Live crosslisting UI.
- Live seller onboarding.
- Live approval gate.
- Live external marketplace adapters.
- Live provider publication.

## 6. What Fable Contributed Or Planned

No Fable evidence was found in this repo.

If Fable was part of a prior conversation, that context is not recoverable from the source tree. Implementation should not depend on Fable unless the owner supplies external artifacts.

## 7. Marketplace / Crosslisting Truth

Marketplace/crosslisting exists locally as source code and tests, mainly in `modules/marketplace-platform`.

It does not exist in the deployed app.

PrimeOpp Marketplace adapter is local/in-memory and functional for local runtime tests. External adapters are test-only and explicitly have no live connectivity.

Safe to claim:

- "There is local marketplace/crosslisting infrastructure in the repo."

Not safe to claim:

- "PrimeOpp live app has marketplace."
- "PrimeOpp can live crosslist to eBay/Amazon/etc."

## 8. Pricing Truth

Live pricing:

- Admin-entered product price.
- Per-color price overrides.
- Real discount/promotion redemption engine.
- Hardcoded Stripe shipping rates.
- No live marketplace commission/profit/margin/comps pricing.

Intended/local pricing:

- `commerce-core` pricing engine estimates market value ranges and recommended prices from pricing observations.
- `commerce-core` fee/profit engines model marketplace fees, payment fees, shipping, labor, storage, promotion, return reserves, net profit, ROI, and break-even.
- `marketplace-platform` commission engine defines versioned marketplace commission policies.
- No real comps provider is currently wired to the live app.

## 9. What Should Be Built Next

Next product blocker:

Add manual barcode/identifier entry and classification to the live/admin surface.

Why:

- It is the first missing step in the product flow.
- Camera scanning can come later.
- Existing classification logic is already real and tested.
- Without a scan/manual identifier entry point, enrichment, pricing, listing drafts, and crosslisting have no live input.

## 10. What Should Not Be Claimed Yet

Do not claim:

- Live barcode scanning.
- Live product intelligence flow.
- Live marketplace.
- Live crosslisting.
- Live eBay/Amazon/Walmart/etc publication.
- Seller accounts/onboarding.
- Marketplace commission revenue.
- Real comps-based pricing.
- Fable is required for implementation.

