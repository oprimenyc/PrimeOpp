# PrimeOpp Full Feature Inventory (Source-Verified)

Method: grep across the entire repo for every term the mission listed, then
read the actual matching source files (not just the match line) to confirm
what's real vs. a false-positive substring match vs. copy text vs. a
disconnected library. Every claim below cites the file(s) it's grounded in.

**Headline finding**: grepping `barcode|UPC|EAN|GTIN|ISBN` and
`marketplace|seller|vendor|merchant|supplier` across `artifacts/` (the
entire live, deployable app) returns **zero genuine matches** — every hit
was a false positive (`"boolean"` contains the substring `"ean"`, etc.).
PrimeOpp's live app is a single-owner print-on-demand + affiliate-link
storefront with an admin dashboard — not a marketplace, and it has no
barcode-scanning surface anywhere.

---

## Live App Surface (`artifacts/primeopp` + `artifacts/api-server`)

| Feature | Source files | UI route | API route | DB tables | Tests | Status | Claim allowed |
|---|---|---|---|---|---|---|---|
| Customer storefront (browse/filter) | `pages/catalog.tsx`, `pages/home.tsx` | `/`, `/catalog` | `GET /api/products` | `products` | none frontend; API covered by manual smoke test only | LIVE | YES |
| Product detail page | `pages/product.tsx` | `/product/:id` | `GET /api/products/:id` | `products` | none | LIVE | YES |
| Cart | `pages/cart.tsx`, local cart logic | `/cart` | n/a (client-side until checkout) | — | none | LIVE | YES |
| Checkout (Stripe) | `routes/orders.ts` (`POST /checkout/session`) | `/cart` → redirect | `POST /api/checkout/session` | `orders` | 6 vitest tests (fail-closed path only) | **LIVE, but fail-closed** — Stripe keys not configured, so real checkout is currently impossible | WITH QUALIFIER ("checkout exists, payment provider not yet configured") |
| Order success / webhook fulfillment | `routes/orders.ts` (`POST /webhook`) | `/order-success` | `POST /api/webhook` | `orders`, `fulfillment_jobs`, `notification_jobs` | 6 vitest tests (fail-closed path) | LIVE, fail-closed (no Stripe) | WITH QUALIFIER |
| Order lookup (guest, by id+email) | `routes/orders.ts` | `pages/customer.tsx` | `POST /api/orders/lookup` | `orders` | manual smoke test (404 for unknown order) | LIVE | YES |
| Wishlist | `lib/wishlist.ts` | product/customer pages | none (client-only) | none | none | LIVE, honestly `localStorage`-only | WITH QUALIFIER ("wishlist is per-browser, not an account feature") |
| Contact form | `routes/contact.ts` | (form on static pages) | `POST /api/contact` | `contact_messages` | manual smoke test (201) | LIVE | YES |
| Product reviews (submit + list) | `routes/revenue.ts` | not found in primeopp pages (no review UI component located) | `GET/POST /api/products/:id/reviews`, `POST /api/reviews/:id/helpful` | `product_reviews`, `product_review_votes` | none | **API exists, no confirmed frontend UI** | WITH QUALIFIER ("review API is live; no review form was found in the storefront pages") |
| Product recommendations | `routes/revenue.ts` | not confirmed in pages | `GET /api/products/:id/recommendations` | `product_recommendations` | none | API exists, frontend usage unconfirmed | WITH QUALIFIER |
| Abandoned cart capture | `routes/revenue.ts` | not confirmed (no client call site found) | `POST /api/abandoned-cart`, admin `GET/POST /api/admin/abandoned-carts*` | `abandoned_carts` | none | **API + admin view exist; no confirmed client trigger** | WITH QUALIFIER |
| Discount codes | `routes/revenue.ts` (`POST /discounts/quote`), `routes/orders.ts` (applied at checkout) | cart/checkout UI (discount code field presence not confirmed in `cart.tsx` read) | `POST /api/discounts/quote` | `discounts` | none | LIVE at the API/checkout level | WITH QUALIFIER |
| Loyalty points lookup | `routes/revenue.ts` | `pages/customer.tsx` (account/loyalty lookup by email) | `GET /api/loyalty/:email` | `loyalty_accounts`, `loyalty_points_history` | none | LIVE | WITH QUALIFIER ("email-lookup only, no real customer accounts") |
| Email notifications (order confirmation) | `lib/email.ts`, `lib/notificationQueue.ts` | n/a (backend) | n/a (triggered by webhook) | `notification_jobs` | none | **Requires `RESEND_API_KEY`, unset** — code path exists but unproven live | WITH QUALIFIER ("email code exists; no email provider key is configured") |
| Fulfillment (Printful/Tapstitch) | `lib/fulfillment.ts`, `lib/fulfillmentQueue.ts` | admin retry button (`pages/admin-orders.tsx`) | `POST /api/orders/fulfillment-jobs/process-due`, `POST /api/orders/:id/retry-fulfillment` | `fulfillment_jobs` | none | **Requires `PRINTFUL_API_KEY`/`TAPSTITCH_API_KEY`, unset** — code exists, unproven live | WITH QUALIFIER |
| Admin auth (login/logout/session) | `lib/auth.ts`, `routes/auth.ts` | `/admin/login` | `POST /api/auth/login`, `/logout`, `GET /verify`, `POST /password-reset` | `admin_users`, `admin_sessions` | manual smoke test (401 paths only) | LIVE | YES |
| Admin product CRUD | `routes/products.ts` | `/admin` (`pages/admin.tsx`) | `GET/POST/DELETE /api/products*` | `products` | none | LIVE | YES |
| Admin order management | `routes/orders.ts` | `/admin/orders` | `GET /api/orders`, `PATCH /:id/status` | `orders` | none | LIVE | YES |
| Admin dashboard (counts/revenue) | `routes/admin.ts`, `routes/revenue.ts` | `/admin/dashboard` | `GET /api/admin/dashboard`, `GET /api/admin/revenue` | `orders`, `products`, `fulfillment_jobs` | none | LIVE | YES |
| Admin audit log | `routes/admin.ts`, `lib/audit.ts` | not confirmed as a page (audit log viewer UI not located in `pages/`) | `GET /api/admin/audit-log` | `audit_log` | none | **API exists, no confirmed UI page** | WITH QUALIFIER |
| Admin review moderation | `routes/revenue.ts` | not confirmed in pages | `GET /api/admin/reviews`, `PATCH /:id` | `product_reviews` | none | API exists, no confirmed UI | WITH QUALIFIER |

## Barcode / Scanner Terms

| Term | Real match found in live app? | Where it actually exists |
|---|---|---|
| barcode, UPC, EAN, GTIN, ISBN, SKU | **NO** (zero real matches in `artifacts/`) | Only in `modules/product-intake` and `modules/commerce-core` (disconnected libraries) — full detail in the dedicated barcode audit doc |
| scanner, scan | **NO** real camera/hardware scanner UI anywhere | `modules/product-intake/src/adapters/scanner-adapters.ts` defines *translation helpers* (`ScannerEvent -> RawProductInput`) — explicitly commented `"PROVIDER-DEPENDENT: the actual scanner hardware/browser API is provider-specific"`. No actual camera or hardware integration exists; these are pure functions waiting for a real scanner source. |

## Marketplace / Seller Terms

| Term | Real match found in live app? | Notes |
|---|---|---|
| marketplace, seller, vendor, merchant, supplier | **NO matches anywhere in `artifacts/`** | `modules/marketplace-platform` uses these terms extensively but is a fully disconnected library (see surface map) with 0 tests written. |
| storefront | Yes — describes the single-owner customer storefront, not a multi-seller concept | `artifacts/primeopp` |

## Pricing / Business Model Terms

| Term | Real match found | Where |
|---|---|---|
| commission | Copy text only: `"PrimeOpp may earn a commission on purchases made through these links"` (affiliate disclosure) and an admin form helper string — **not a computed marketplace commission engine** | `pages/terms.tsx:46`, `pages/admin.tsx:279` |
| subscription, plan (pricing tiers) | **NO matches** | — |
| margin, markup, profit (pricing logic) | **NO real matches** (only CSS `margin` properties in an email template) | `lib/email.ts` |
| fees | **NO matches** in `artifacts/` | `modules/commerce-core/packages/fee-engine` exists but is disconnected |
| discount codes | **YES, real, live** | `routes/revenue.ts`, `routes/orders.ts`, `discounts` table |
| Stripe | **YES, real, but fail-closed** (no live keys configured) | `routes/orders.ts`, `lib/env.ts` |
| POD / print-on-demand | **YES, real, live** — `products.type = 'pod'`, `pod_provider IN ('printful','tapstitch')` | `lib/db/migrations/0001_base_schema.sql`, `lib/fulfillment.ts` |

## Product Intelligence / Catalog / Domain Terms

| Term | Real match found | Where |
|---|---|---|
| product intake | Yes, real, tested, **disconnected** | `modules/product-intake` |
| enrichment | Yes, real, tested, **disconnected** | `modules/product-enrichment` |
| commerce-core, product-enrichment, product-intake (module names) | Yes — see the earlier surface map (`PRIMEOPP_FULL_PLATFORM_SURFACE_MAP.md`) for full detail | `modules/*` |
| inventory | Only a flat `stock_level INTEGER` column on `products` — no separate inventory system is wired in the live app; `modules/commerce-core/packages/inventory` exists but is disconnected | `lib/db/migrations/0001_base_schema.sql` |
| domain, discovery | No dedicated "domain discovery" feature found in the live app or any module (this term appears in prior handoff docs about *deployment domains*, e.g. Railway's own domain — not a product feature) | — |
| catalog ingestion | No live ingestion pipeline exists; product-intake/enrichment (disconnected) are the only real "ingestion" code | `modules/product-intake`, `modules/product-enrichment` |

## Summary

The live PrimeOpp product is: **a single-operator storefront selling print-on-demand apparel and affiliate-linked products**, with a working admin dashboard for manual product entry, order management, and revenue/loyalty/discount features — checkout is real code but fail-closed pending real Stripe keys. Everything "product-intelligence" shaped (barcode scanning, enrichment, canonical catalog, marketplace cross-listing) is real, tested code that has never been connected to this live app.
