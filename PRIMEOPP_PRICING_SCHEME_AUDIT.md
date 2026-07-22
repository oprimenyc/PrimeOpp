# PrimeOpp Pricing / Business Model Audit (Source-Verified)

## Pricing Model Found: **PRODUCT_MARKUP** (simple retail pricing) + a real, wired discount/promotion engine. No subscription, no commission engine, no listing fees.

## Evidence

**No subscription/plan pricing.** Zero matches for "subscription" or pricing-tier "plan" anywhere in the repo's live app. There is no billing-plan concept, no recurring charge, no tiered account pricing.

**No marketplace commission engine.** The only "commission" hits in the entire live app are copy text: the terms page discloses `"PrimeOpp may earn a commission on purchases made through these [affiliate] links"` (`pages/terms.tsx:46`) and an admin form helper string describing the same thing (`pages/admin.tsx:279`). Neither is a computed commission — there's no rate, no calculation, no ledger. `modules/commerce-core/packages/fee-engine` and `modules/marketplace-platform/packages/commission-engine` exist as real code but are fully disconnected (see surface map).

**Product pricing = a single admin-entered number.** Each product has one `price NUMERIC` field (`lib/db/migrations/0001_base_schema.sql`), set by hand in the admin form (`pages/admin.tsx:314`). Per-color price overrides exist (`colors: [{name, hex, price}]`), used at checkout to price the specific variant chosen (`routes/orders.ts` `validateAndPriceItems`). No margin/markup/cost-basis calculation exists anywhere in the live code — the admin simply decides and types in a sale price.

**A real, wired discount/promotion engine exists** (`discounts` table, `lib/db/migrations/0006_revenue_engine.sql`):
- 8 discount types: `coupon, automatic, bogo, free_shipping, tiered, volume, first_order, referral`
- 3 value types: `percent, fixed, shipping`
- Eligibility logic (active window, minimum subtotal, per-code or automatic) is real and applied both at a standalone quote endpoint (`POST /api/discounts/quote`) and at actual checkout session creation (`routes/orders.ts`, `discount_code` field).
- **Gap found**: there is no admin route or UI to *create* a discount (`grep` across `routes/` and `admin.tsx` found only read/quote usages — `SELECT`, never an `INSERT`/`POST /api/discounts`). Discount rows can only enter the system via direct database access, not through any part of the live product.

**Shipping pricing**: two hardcoded flat rates at Stripe checkout-session creation — Standard ($4.99, 5–10 business days) and Express ($9.99, 2–4 business days) (`routes/orders.ts` lines ~210–235). Not configurable through any admin UI; a code change is required to alter them.

**Stripe**: `STRIPE_SECRET_KEY`/`STRIPE_WEBHOOK_SECRET` — code fully supports them (`routes/orders.ts`, `lib/env.ts`), but as of the last deploy session neither is set on the live Railway service. **Classification: FAIL_CLOSED** — checkout/webhook routes return 503 rather than crashing or faking success (verified live: `PRIMEOPP_LIVE_SMOKE_TEST.md`). No Stripe products/prices are configured anywhere (this app uses Stripe Checkout's dynamic `price_data` per line item, not pre-created Stripe Price objects, so "Stripe products/prices: LIVE_CONFIGURED/TEST_CONFIGURED" doesn't apply in the usual sense — there's nothing to pre-configure in Stripe's dashboard for this integration pattern, only the two secret keys).

**POD fulfillment cost**: no cost-basis/profit calculation found between the admin-entered sale price and what Printful/Tapstitch would charge to fulfill it — `lib/fulfillment.ts` only handles order submission to the provider, not cost/margin math. `modules/commerce-core/packages/profit-engine` exists for this purpose but is disconnected.

## What Is Implemented in Code

- Flat per-product/per-color pricing.
- A real, multi-type discount/promotion engine, wired into checkout — but with no way to create discounts except direct DB writes.
- Two hardcoded flat shipping rates.
- Stripe Checkout integration (fail-closed without real keys).

## What Is Only Copy/Docs

- "Commission" language on the terms page and in the admin affiliate-link helper text — describes real-world affiliate economics, not something PrimeOpp's code computes or tracks.

## What Is Safe to Claim Publicly

- "Discount codes and promotions are supported at checkout."
- "Products can have per-variant pricing."
- "Standard and express shipping options are available."

## What Is Not Safe to Claim

- "PrimeOpp is a subscription product" — no such feature exists.
- "PrimeOpp takes a marketplace commission" — no marketplace, no commission engine, only affiliate-link disclosure copy.
- "Sellers can set their own pricing/margins" — there are no sellers; only the operator's own admin form.
- "Discount codes can be created from the admin dashboard" — they can't; only read/quoted, never created through the app.

## Blocked by Stripe Secrets

Real checkout completion, real webhook-driven order fulfillment triggering, and any live revenue at all — all gated behind setting real `STRIPE_SECRET_KEY`/`STRIPE_WEBHOOK_SECRET` in the Railway dashboard (owner-only action, never to be pasted into chat).
