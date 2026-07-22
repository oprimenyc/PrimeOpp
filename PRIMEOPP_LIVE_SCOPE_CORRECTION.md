# PrimeOpp Live Deploy — Scope Correction

## The Correction

The Railway deployment at `https://primeopp-production-a554.up.railway.app`
proves **one surface**: the ecommerce customer storefront + its admin
dashboard + the API server backing both, on a shared Railway Postgres. It
does **not** prove the full PrimeOpp platform is live, because most of the
repo is not part of that deployment at all. See
[`PRIMEOPP_FULL_PLATFORM_SURFACE_MAP.md`](PRIMEOPP_FULL_PLATFORM_SURFACE_MAP.md)
for the full inventory.

**What "PASS" from the previous session actually meant**: the ecommerce
storefront + API + Postgres boot, deploy, and serve real traffic without
crashing and without granting fake payment access. It did **not** mean
"PrimeOpp is fully live" in the sense of every module in the repo being a
running, reachable service.

## What Is Currently Live (at the Railway URL)

- `GET /` — customer storefront homepage (React SPA).
- `GET /catalog`, `/product/:id`, `/cart`, `/order-success` — customer shopping flow pages.
- `GET /customer` — account/loyalty email-lookup page (no real accounts — guest-only by design).
- `GET /admin`, `/admin/login`, `/admin/dashboard`, `/admin/orders` — admin SPA pages (client-side; API-side auth confirmed enforced).
- `GET /api/healthz` — health check.
- `POST /api/orders/lookup`, `POST /api/contact` — public order-lookup and contact-form APIs.
- `POST /api/checkout/session`, `POST /api/webhook` — Stripe checkout/webhook, currently fail-closed (503) since Stripe isn't configured.
- `GET /api/orders`, `GET /api/admin/dashboard`, `GET /api/admin/audit-log`, order status/fulfillment-retry mutations — admin-only API routes (auth-enforced, 401 without a session).

## What Is NOT Represented by This Deployment

- **`modules/commerce-core`** — the canonical product-identity/pricing/inventory/profitability engine. Not imported by the live app. Its `demo`/`doctor` CLI has never been run against this deployment's database.
- **`modules/marketplace-platform`** — cross-listing/marketplace engine (offers, negotiation, disputes, commission, order engine). Entirely disconnected; no service exists to deploy.
- **`modules/deal-intelligence`** — deal scoring/pricing-history/restock engine. Entirely disconnected.
- **`modules/affiliate-backlink-engine`** — SEO/backlink CLI tool, and notably **shared with other products** (PantiCandy, "Vital") per its own example workflows — not PrimeOpp-exclusive infrastructure.
- **`modules/product-enrichment`** and **`modules/product-intake`** — the product-data pipeline that's supposed to feed `commerce-core`'s canonical catalog. Wired to each other (per recent commit history) but not to the live storefront's `products` table.
- **`artifacts/mockup-sandbox`** — a design/mockup preview tool, not a product surface, and not live.

## Workflows That Remain Unproven

- **Any operator/back-office workflow that depends on `commerce-core`, `marketplace-platform`, or `deal-intelligence`** — pricing intelligence, cross-listing to other marketplaces, deal scoring, profitability analysis. None of this logic runs against the live database; the live `products` table is populated/managed only through the admin API's direct product CRUD, not through the enrichment/intake pipeline.
- **Product intake → enrichment → canonical catalog → live storefront**, end to end. The pipeline exists as code and passes its own module-level tests, but has never been run against, or connected to, the live Postgres database or the live storefront's `products` table.
- **Full authenticated admin session workflow** (login → dashboard → order management) — API-level auth boundaries were verified (401 for unauthenticated/wrong-credential requests), but a real login with the actual generated `ADMIN_PASSWORD` was not performed by this session (the password was intentionally never disclosed to it).

## What Should Not Be Called PASS Yet

- "PrimeOpp platform is live" — **not accurate**. Only the ecommerce/API-server slice is live.
- "Product intelligence pipeline is live" — **not accurate**. It's real, tested code, but it has zero live deployment and zero connection to the live database.
- "Marketplace cross-listing is live" — **not accurate**. No service exists for this yet; it's a library with no host.
- "Deal intelligence is live" — **not accurate**. Same as above.

## What Can Correctly Be Called PASS

- The ecommerce storefront + admin dashboard UI + API server + Postgres, deployed live on Railway, with Stripe correctly fail-closed and no fake payment success — this is real and verified (see `PRIMEOPP_LIVE_SMOKE_TEST.md`).
