# PrimeOpp Retail Intelligence, Pricing & OAuth Handoff

Date: 2026-07-22
Repo: `C:\Users\jp718\Documents\GitHub\PrimeOpp`
Branch: `integration/full-primeopp-platform`

VERDICT:
PASS WITH BLOCKERS

LIVE URL:
https://primeopp-production-a554.up.railway.app

STARTING HEAD:
`fb2d886d58aabdc8bb2e8765a6ed472c135a33ab`
(Mission-stated start was `874df3e`; the product identifier-map work `e9b33fe` + its handoff `fb2d886` had already landed before this session.)

ENDING HEAD:
`e010bb957303fcaf55de96a8449d301df4bc9aea` (implementation) — handoff commit appended after this doc.

PRODUCT IDENTIFIER GRAPH:
PASS

SUPPORTED IDENTIFIERS:
UPC, UPC_A, EAN, EAN_13, GTIN, ISBN, SKU, MODEL_NUMBER, STYLE_CODE, MPN,
TARGET_TCIN, WALMART_ITEM_ID, BEST_BUY_SKU, HOME_DEPOT_ITEM_ID, LOWES_ITEM_ID, OTHER_RETAILER_ID,
AMAZON_ASIN, EBAY_EPID, MERCARI_ITEM_ID, POSHMARK_ITEM_ID, OTHER_PLATFORM_ID, OTHER

RETAILER PRODUCT ALIASES:
PASS (additive `retailer_products` table; retailer IDs are aliases, never canonical identity)

STORE LOOKUP:
PASS WITH BLOCKERS (route + UI live; all retailer adapters return honest NOT_CONFIGURED until credentials/providers are supplied)

RETAILERS SUPPORTED:
Target, Walmart, Best Buy, Home Depot, Lowe's (OFFICIAL_API shells),
Licensed provider (LICENSED_PROVIDER shell),
Public-page monitor + user-authorized browser (EXPERIMENTAL, disabled by default)

INVENTORY QUANTITY:
STATUS_ONLY (column is nullable; adapters never invent a number from a status)

FAKE INVENTORY INTRODUCED:
NO

FAKE QUANTITY INTRODUCED:
NO

PLATFORM PRICE INTELLIGENCE:
PASS WITH BLOCKERS (selected-platform-only; adapters return honest NOT_CONFIGURED / INSUFFICIENT_DATA)

PLATFORMS SUPPORTED:
eBay, Amazon, Mercari, Poshmark, Facebook Marketplace, Etsy

ACTIVE LISTINGS:
NOT_CONFIGURED

SOLD COMPS:
NOT_CONFIGURED

ACTIVE AND SOLD PRICES SEPARATED:
YES

FAKE COMPS INTRODUCED:
NO

FEE ENGINE:
PASS (real deterministic math; versioned `platform_fee_schedules` table)

SHIPPING ESTIMATION:
PASS (seller-entered / saved-profile / platform-calculated / UNKNOWN — never silently assumed)

NET PROCEEDS:
PASS

PROFIT ESTIMATION:
PASS

LISTING PRICE STRATEGIES:
QUICK_SALE, MARKET, MAX_MARGIN, CUSTOM (recommendation only from supported evidence; editable)

CANONICAL LISTING PACKAGE:
PASS

CHANNEL DRAFTS:
PASS

CHANNEL EXPORTS:
PASS

OAUTH IMPLEMENTATION:
PASS (start + callback + disconnect routes; PKCE + CSRF state; AES-256-GCM encrypted-only token storage)

LIVE OAUTH:
NOT_CONFIGURED

TOKENS STORED IN PLAINTEXT:
NO

MONITORING_ONLY DEFAULT:
TRUE

PUBLISH_AUTHORIZED DEFAULT:
FALSE

EXTERNAL PUBLISH:
DISABLED

PROVIDER CALLS:
NO (no retailer, marketplace, or Stripe calls; OAuth token exchange path is dormant and only runs when a provider is fully configured — no provider is configured)

PROVIDER MUTATIONS:
NO

STRIPE CALLED:
NO

PUBLIC MARKETPLACE:
NO

KYC REQUIRED:
NO

MIGRATIONS:
- `lib/db/migrations/0011_retail_intelligence.sql`
- `lib/db/migrations/0012_oauth_connections.sql`

MIGRATION TYPE:
ADDITIVE (only CREATE TABLE IF NOT EXISTS, ADD COLUMN IF NOT EXISTS, and CHECK/index constraint additions; no DROP TABLE, no DELETE, no column drops)

TESTS:
PASS (10 files, 67 tests — 37 new across fee-engine, retailer-inventory, platform-pricing, oauth, retail-safety)

TYPECHECK:
PASS (full workspace `tsc --build` + per-project `--noEmit`)

RAILWAY SERVICE BUILD:
PASS (`@workspace/primeopp` build + `@workspace/api-server` build)

ROOT BUILD:
PARTIAL (fails only at unrelated `artifacts/mockup-sandbox/vite.config.ts` PORT requirement; all mission packages build)

SECRET SCAN:
PASS (no hardcoded secrets/keys/tokens in changed files; only `process.env` references and required-env-name strings)

LIVE DEPLOYED:
NO

LIVE DEPLOYMENT ID:
NOT_DEPLOYED

LIVE SMOKE:
NOT_RUN (deploy is gated — see BLOCKERS)

SECRETS PRINTED:
NO

DATABASE URL PRINTED:
NO

OAUTH TOKENS PRINTED:
NO

DNS MODIFIED:
NO

DESTRUCTIVE MIGRATIONS:
NO

UNRELATED DIRTY FILES PRESERVED:
YES (`modules/commerce-core/evidence/*`, `pnpm-lock.yaml`, `artifacts/commerce-worker/` left untouched and unstaged)

IMPLEMENTATION COMMIT:
`e010bb957303fcaf55de96a8449d301df4bc9aea`

HANDOFF COMMIT:
(appended after this file — recorded in the final response)

PUSHED:
(recorded in the final response)

## What Changed

Migrations (additive):
- `0011_retail_intelligence.sql` — extends `product_identifiers` (namespace, raw_identifier, retailer_id, platform_id, retailer/marketplace types); adds `retailers`, `retailer_products`, `retailer_stores`, `inventory_observations` (nullable quantity + quantity_confidence), `platform_price_observations` (active/sold columns separated), `platform_fee_schedules`.
- `0012_oauth_connections.sql` — extends `channel_account_connections` with provider_key, single-use state/PKCE hashes, and AES-256-GCM encrypted-only token columns (ciphertext + iv + auth tag). A CHECK constraint forbids ciphertext without its iv/auth tag. No plaintext token column exists.

API (`artifacts/api-server/src`):
- `lib/feeEngine.ts` — real fee/shipping/net/profit math + listing-price strategies.
- `lib/retailerAdapters.ts` — `RetailerInventoryAdapter` contract, honest NOT_CONFIGURED shells, source-priority, freshness classification. Unofficial adapters disabled by default.
- `lib/platformPricing.ts` — `PlatformPricingAdapter` contract, honest shells, active/sold kept separate.
- `lib/oauth.ts` — provider registry, PKCE + CSRF state, AES-256-GCM encrypt/decrypt, config-status with exact required env names.
- `routes/retailers.ts` — `GET /api/retailers`, `POST /api/retailers/store-lookup`.
- `routes/pricing.ts` — `GET /api/pricing/platforms`, `POST /api/pricing/market`, `POST /api/pricing/calculate`.
- `routes/oauth.ts` — `GET /api/oauth/providers`, `POST /api/oauth/:provider/start`, `GET /api/oauth/:provider/callback`, `POST /api/oauth/connections/:id/disconnect`.
- `routes/product-intake.ts` — persists new identifier-graph columns.
- `lib/validation.ts` — expanded identifier types + new request schemas.

Frontend (`artifacts/primeopp/src`):
- `lib/api.ts` — client functions/types for retailers, store lookup, platform pricing, fee calc, OAuth.
- `pages/listing-workspace.tsx` — Store Availability, Market Pricing, Fees/Shipping/Profit, and Account Connections (OAuth) panels; updated boundary copy.

## Validation

- `pnpm --filter @workspace/api-server test` → 10 files, 67 tests PASS.
- `pnpm run typecheck` → PASS.
- `pnpm --filter @workspace/primeopp run build` + `pnpm --filter @workspace/api-server run build` → PASS.
- `pnpm run build` (root) → PARTIAL (unrelated mockup-sandbox PORT blocker only).
- Secret scan of changed files → PASS.

## Blockers

1. **Live deploy + production migration are gated in this environment.** The
   automated safety classifier denied the production-mutation commands
   (`railway run node lib/db/scripts/migrate.mjs` and, by extension, a Railway
   deploy). These are owner-gated actions. The code is committed, tested,
   type-checked, service-built, and secret-scanned, and the migrations are
   strictly additive — it is deploy-ready but was not applied or deployed from
   this session.
2. All retailer inventory and platform pricing adapters return NOT_CONFIGURED
   until real, permitted integrations (official APIs / licensed providers) are
   configured via environment variables.
3. Live OAuth stays NOT_CONFIGURED until `EBAY_CLIENT_ID`/`EBAY_CLIENT_SECRET`
   (etc.), `OAUTH_REDIRECT_BASE_URL`, and `OAUTH_TOKEN_ENCRYPTION_KEY` are set.
4. External publish remains disabled by design.
5. Root build remains PARTIAL because `artifacts/mockup-sandbox/vite.config.ts`
   requires `PORT`.

## To deploy (owner action)

Apply additive migrations to production (env injected by Railway, never printed):

```bash
ALLOW_PROD_MIGRATE=true railway run node lib/db/scripts/migrate.mjs
```

Then deploy the service:

```bash
railway up --service primeopp --detach
```

Then live-smoke: `GET /`, `GET /api/healthz`, `GET /api/retailers`,
`GET /api/pricing/platforms`, `GET /api/oauth/providers`,
`POST /api/pricing/calculate` (real math), and confirm store-lookup + market
pricing return supported/NOT_CONFIGURED, quantity stays nullable, active/sold
stay separate, and publish stays disabled.

NEXT SINGLE ACTION:
Owner runs the two commands above (additive migration, then `railway up`) to
apply schema 0011/0012 and deploy, then live-smoke the retail-intelligence,
pricing, and OAuth endpoints.
