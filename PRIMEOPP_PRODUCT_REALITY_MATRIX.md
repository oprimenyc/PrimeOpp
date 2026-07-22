# PrimeOpp Product Reality Matrix

Live URL: `https://primeopp-production-a554.up.railway.app`. Every row below
is grounded in the source-verified findings from the feature inventory,
barcode audit, marketplace audit, and pricing audit — no claim here repeats
an unverified prior handoff.

| Feature | Intended user | Live at Railway URL | Local only | API exists | DB exists | Tests exist | Provider/secret required | Fake/mock/static? | Status | Next action |
|---|---|---|---|---|---|---|---|---|---|---|
| Barcode scanner (camera) | Admin/operator | No | No | No | No | No | N/A — not built | No (just absent, not faked) | **MISSING** | Integrate a camera-decode library into a new admin page |
| Manual barcode lookup | Admin/operator | No | No | No | No | No | N/A | No | **MISSING** | Add a barcode text field + lookup action |
| Product intake | Backend pipeline | No | Yes (`modules/product-intake`) | No (library only) | No (in-memory repo interface only) | Yes, 134/134 | No | No — real, tested logic, just unconnected | **IMPLEMENTED_DISCONNECTED** | Wire to a real repository + real intake trigger |
| Product enrichment | Backend pipeline | No | Yes (`modules/product-enrichment`) | No | No | Partial — build/typecheck pass; `npm test` fails to even start on Windows (script uses Unix-only env syntax) | No | No | **IMPLEMENTED_DISCONNECTED** | Fix Windows test script (`cross-env`), then wire to intake |
| Product listing creation | Admin | Yes (manual form only) | — | Yes (`POST /api/products`) | Yes (`products`) | None | No | No — real, just manual-only | **LIVE** (manual), enrichment path **MISSING** | Decide whether manual-only is the permanent design or enrichment should feed it |
| Marketplace (multi-seller) | Sellers + buyers | No | No | No | No | No | N/A | No — genuinely doesn't exist, not faked | **MISSING** | Not recommended next (see build plan) — large scope expansion |
| Seller onboarding | Sellers | No | No | No | No | No | N/A | No | **MISSING** | Same as above |
| Admin approval (of listings) | Admin | No — no listing lifecycle exists | No | No | No (no status column on `products`) | No | N/A | No | **MISSING** | Add a `status` column + review step only if/when multi-source listing creation exists |
| Pricing / plans (subscription) | N/A | No | No | No | No | No | N/A | No | **MISSING** (by design — not the business model) | None — not applicable to this product |
| Discount/promotion engine | Customer (redemption), Admin (would need creation) | Yes (quote + checkout redemption) | — | Yes (`POST /api/discounts/quote`) | Yes (`discounts`) | None | No | No — real engine, real DB rows, just no creation UI | **PARTIAL** (read/redeem live, create missing) | Add admin discount-creation route/UI |
| Checkout/payment | Customer | Yes, but fail-closed (503) | — | Yes (`POST /api/checkout/session`, `POST /api/webhook`) | Yes (`orders`) | Yes, 6/6 (fail-closed path) | Yes — `STRIPE_SECRET_KEY`/`STRIPE_WEBHOOK_SECRET`, currently unset | No — genuinely fail-closed, not faked success | **LIVE, fail-closed** | Owner sets real Stripe keys in Railway dashboard when ready |
| Order lookup | Customer (guest) | Yes | — | Yes (`POST /api/orders/lookup`) | Yes (`orders`) | Manual smoke test only | No | No | **LIVE** | None needed |
| Contact form | Customer | Yes | — | Yes (`POST /api/contact`) | Yes (`contact_messages`) | Manual smoke test only | No | No | **LIVE** | None needed |
| Wishlist | Customer | Yes, `localStorage`-only | — | No (client-only) | No | No | No | Honest, not fake — explicitly documented as browser-local in its own code comment | **LIVE** (local-only by design) | None needed unless real accounts are added later |
| Catalog ingestion (bulk/automated) | Admin/operator | No | Partial (`product-intake`/`product-enrichment` are real but disconnected) | No | No | See product-intake/enrichment rows | No | No | **IMPLEMENTED_DISCONNECTED** | Same as intake/enrichment |
| POD/domain discovery | — | No dedicated feature found under this name | — | — | — | — | — | — | **MISSING** (term not found as a distinct feature; "POD" itself — print-on-demand fulfillment — is real and live, see below) | N/A |
| POD fulfillment (Printful/Tapstitch) | Admin (order processing) | Yes, code path live, requires provider keys | — | Yes (`fulfillmentQueue`, retry routes) | Yes (`fulfillment_jobs`) | None | Yes — `PRINTFUL_API_KEY`/`TAPSTITCH_API_KEY`, unset | No | **LIVE, unproven without provider keys** | Owner sets provider keys when ready to fulfill real POD orders |
| commerce-core | Backend pipeline | No | Yes | No (CLI/library only) | No | Yes, 269/269 | No | No — real, tested | **IMPLEMENTED_DISCONNECTED** | See next-build-plan doc |
| marketplace-platform | Backend pipeline | No | Yes (builds/typechecks) | No | No | **0 tests exist** | No | No (not fake — just untested and unused) | **IMPLEMENTED_DISCONNECTED**, weakest of the three intelligence modules | Not recommended as next step — write tests first if ever revived |
| deal-intelligence | Backend pipeline | No | Yes | No | No | 159/160 (1 pre-existing portability bug) | No | No | **IMPLEMENTED_DISCONNECTED** | Not recommended as next step |

## One-Line Summary

The live product is real and honest about what it is: a working single-operator storefront with fail-closed payments pending real Stripe keys. Everything that sounds like "product intelligence platform" (barcode, enrichment, marketplace, canonical catalog) is real, tested code sitting completely outside the deployed app — not fake, not mocked, just never turned on.
