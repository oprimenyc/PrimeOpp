# PrimeOpp Marketplace / Listing Flow Audit (Source-Verified)

## Answer: Marketplace Exists — **NO.** PrimeOpp Is a Single-Owner Storefront, Not a Marketplace.

Zero matches for `marketplace`, `seller`, `vendor`, `merchant`, or `supplier`
anywhere in `artifacts/` (the live app) — verified by grep across the whole
directory. `modules/marketplace-platform` uses this vocabulary extensively
but is fully disconnected (0 tests written, not imported anywhere — see
`PRIMEOPP_FULL_PLATFORM_SURFACE_MAP.md`).

## The Actual Flow That Exists (Admin-Only Product Creation)

1. **Create product** — `POST /api/products` (`artifacts/api-server/src/routes/products.ts`), guarded by `requirePermission("products:write")`. Admin-only; there is no separate "seller" role or account type — the only roles are `owner, super_admin, admin, support, marketing, finance, fulfillment` (`lib/auth.ts`), all internal operator roles.
2. **No enrichment step** — the admin form (`pages/admin.tsx`) is 100% manual entry (title, category, price, colors, sizes, stock, shipping info, thumbnail/image upload, external link, POD provider). Nothing calls `product-enrichment` or `commerce-core`.
3. **No pricing step** — price is a single form field the admin types in. No pricing engine, no comps, no margin calculation.
4. **No publish/approval step** — the live `products` table (`lib/db/migrations/0001_base_schema.sql`) has **no `status`/`draft`/`published` column at all**. A product exists the instant `POST /api/products` succeeds; there is no draft state, no review queue, no approval gate. Compare this to `commerce-core`'s canonical `Product.listingState` (`UNLISTED, DRAFT, READY, LISTED, PARTIALLY_LISTED, SOLD, ...`) — that richer lifecycle exists only in the disconnected library, never in the live schema.
5. **Inventory state** — a flat `stock_level INTEGER` column, no reservation/hold logic beyond what's implied by order creation. No separate inventory system.
6. **Customer browsing** — real and live: `GET /api/products`, `GET /api/products/:id`, rendered by `pages/catalog.tsx`/`pages/product.tsx`.
7. **Order flow** — real and live (see feature inventory): checkout session creation is fail-closed (no Stripe keys), but order lookup, admin order management, and fulfillment-retry are all live.
8. **Wishlist** — real, live, `localStorage`-only (no server state).
9. **Contact / order lookup** — both real and live.

## Direct Answers

- **Marketplace exists**: NO
- **Seller onboarding exists**: NO — no seller concept, no onboarding flow, no seller-facing routes or pages of any kind
- **Product listing creation exists**: YES, but as a single admin-only manual form, not a "listing" concept with its own lifecycle
- **Product enrichment exists**: NO (in the live flow) — the enrichment module is real but disconnected (see feature inventory / surface map)
- **Publishing flow exists**: NO — there's no draft/review/publish state machine; creation = live instantly
- **Customer storefront exists**: YES, live
- **Admin/operator approval exists**: NO — the only "approval"-shaped feature found is admin **review moderation** (`PATCH /api/admin/reviews/:id`, approve/reject a customer product review), which is unrelated to product-listing approval
- **Live routes**: `/`, `/catalog`, `/product/:id`, `/cart`, `/order-success`, `/customer`, `/admin`, `/admin/login`, `/admin/dashboard`, `/admin/orders`
- **Local routes**: none beyond the above (no dev-only marketplace/seller pages found)
- **API routes**: `GET/POST/DELETE /api/products*`, `GET/POST/PATCH /api/orders*`, `GET /api/admin/dashboard`, `GET /api/admin/audit-log`, `GET/PATCH /api/admin/reviews*`, `GET /api/admin/revenue`, `GET/POST /api/admin/abandoned-carts*`
- **DB tables**: `products`, `orders`, `fulfillment_jobs`, `notification_jobs`, `admin_users`, `admin_sessions`, `audit_log`, `product_reviews`, `product_review_votes`, `discounts`, `loyalty_accounts`, `loyalty_points_history`, `abandoned_carts`, `contact_messages`, `email_workflows`, `product_recommendations`
- **Tests**: NONE at the storefront/admin-flow level (no test files found for `artifacts/primeopp` or for `products.ts`/`admin.ts` routes specifically — only the new Stripe-fail-closed and 404-fallback tests added this session, plus module-level tests for the disconnected intelligence libraries)

## Blocker List (Why This Isn't a Marketplace Today)

1. No seller/vendor account model exists in the schema or auth roles at all — would require new tables and a new role type, not a small change.
2. No listing lifecycle (draft/review/publish) exists in the live schema — `commerce-core`'s richer model exists but isn't wired in.
3. No enrichment/pricing pipeline is connected to product creation — everything is typed in by hand today.
4. This is architecturally consistent with what the product actually is right now: a single-operator POD + affiliate storefront, not a multi-seller platform — turning it into one is a significant, deliberate scope expansion, not a bug fix.
