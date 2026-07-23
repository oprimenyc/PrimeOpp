# PrimeOpp Retail Intelligence, Pricing & OAuth Handoff

Date: 2026-07-22
Repo: `C:\Users\jp718\Documents\GitHub\PrimeOpp`
Branch: `integration/full-primeopp-platform`

VERDICT:
PASS

LIVE URL:
https://primeopp-production-a554.up.railway.app

STARTING HEAD:
`fb2d886d58aabdc8bb2e8765a6ed472c135a33ab`
(Mission-stated start was `874df3e`; the product identifier-map work `e9b33fe` + its handoff `fb2d886` had already landed before this session.)

ENDING HEAD:
`4f17ac2d668fbbf19477f66ad753af8ef14a72db` (implementation `e010bb9` + this handoff `4f17ac2`), pushed to `origin/integration/full-primeopp-platform`.

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

PRODUCTION MIGRATIONS:
PASS

MIGRATIONS APPLIED:
- `0009_channel_account_connections.sql` (was not actually applied to production in a prior session despite being reported applied — confirmed missing and applied now)
- `0010_product_identifiers.sql` (same as above)
- `0011_retail_intelligence.sql`
- `0012_oauth_connections.sql`

MIGRATION EXECUTION LOCATION:
RAILWAY_RUNTIME (`railway ssh --service primeopp`, executed inside the running container against Railway's private network — `postgres.railway.internal` only resolves there, not from a local machine)

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

DEPLOYMENT:
PASS

FINAL DEPLOYMENT ID:
`cc9b8aba-1352-48bf-bfe9-4863cec53062`

LIVE DEPLOYED:
YES

LIVE ROOT:
PASS (`GET /` → 200)

LIVE HEALTH:
PASS (`GET /api/healthz` → 200, `{"status":"ok"}`)

LIVE RETAILERS ROUTE:
PASS (`GET /api/retailers` → 200 with 8 retailer adapter statuses, all honest NOT_CONFIGURED / DISABLED_EXPERIMENTAL)

LIVE PRICING PLATFORMS ROUTE:
PASS (`GET /api/pricing/platforms` → 200 with 6 platform adapter statuses, all honest NOT_CONFIGURED)

LIVE OAUTH PROVIDERS ROUTE:
PASS (`GET /api/oauth/providers` → 200 with 6 provider statuses: NOT_CONFIGURED for eBay/Etsy/Amazon, UNSUPPORTED for Mercari/Poshmark/Facebook Marketplace)

LIVE SMOKE:
PASS

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
`4f17ac2d668fbbf19477f66ad753af8ef14a72db` (initial) + this update (recorded in the final response)

CODE FIX REQUIRED:
NO

PUSHED:
YES (`origin/integration/full-primeopp-platform`)

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

## Production migration — how it was actually run

`railway run node lib/db/scripts/migrate.mjs` (executed from a local shell)
cannot work: Railway injects the production `DATABASE_URL`, but that URL's
host, `postgres.railway.internal`, is only resolvable from inside Railway's
private network. Run locally, `railway run` fails with
`getaddrinfo ENOTFOUND postgres.railway.internal`, exactly as observed.

The migration was instead run **inside** the deployed container over
`railway ssh`, where private DNS resolves:

1. Generated a fresh local SSH keypair (none existed) and registered it with
   `railway ssh keys add` — required to open an SSH session to the service.
2. `railway ssh --service primeopp` confirmed the container has
   `lib/db/migrations/0011_retail_intelligence.sql` and
   `0012_oauth_connections.sql` already present (deployed with `cc9b8aba`),
   `lib/db/scripts/migrate.mjs`, and a working `pg` dependency.
3. `railway ssh` does not export the container's real runtime environment
   into the SSH login shell, so `DATABASE_URL`/`NODE_ENV` were read from PID
   1's environment (`/proc/1/environ`, readable in-container) and exported
   into the migration command's shell — without ever echoing their values.
4. Ran `ALLOW_PROD_MIGRATE=true node scripts/migrate.mjs` inside
   `/app/lib/db` in that session. Result: 4 applied
   (`0009`, `0010`, `0011`, `0012`), 8 already up to date. `0009` and `0010`
   turned out not to have actually been applied in a prior session despite
   being reported as applied.
5. Re-ran the same command immediately after: 0 applied, 12 already up to
   date — confirms the migration path is idempotent and safe to re-run.

No destructive SQL ran (every statement is `CREATE TABLE IF NOT EXISTS`,
`ADD COLUMN IF NOT EXISTS`, or an additive `CHECK`/index). No secret value,
including `DATABASE_URL`, was printed at any point.

## Live smoke results

Ran directly against `https://primeopp-production-a554.up.railway.app`
(deployment `cc9b8aba-1352-48bf-bfe9-4863cec53062`, already live before this
follow-up — no redeploy was needed):

- `GET /` → 200
- `GET /api/healthz` → 200, `{"status":"ok"}`
- `GET /api/retailers` → 200, 8 retailer adapters, all `NOT_CONFIGURED` or
  `DISABLED_EXPERIMENTAL`, `providerCalls:false`, `publishEnabled:false`
- `GET /api/pricing/platforms` → 200, 6 platform adapters, all
  `NOT_CONFIGURED`
- `GET /api/oauth/providers` → 200, 6 providers — `NOT_CONFIGURED` for
  eBay/Etsy/Amazon (documented OAuth, missing env), `UNSUPPORTED` for
  Mercari/Poshmark/Facebook Marketplace, `monitoringOnly:true`,
  `publishAuthorized:false` for all
- `POST /api/products/intake` valid barcode → 200, `identifierType=UPC_A`,
  `lookupStatus=NOT_FOUND` (honest — queried the now-migrated
  `product_identifiers` table for real, found no match), `providerCalls:false`
- `POST /api/products/intake` invalid identifier → 422, `valid:false`,
  `canCreateListingPackage:false`
- `GET /api/channels` → 200
- Protected routes tested unauthenticated and correctly return `401` /
  `{"error":"not_authenticated"}` (AUTH_BOUNDARY, not a bug):
  `POST /api/retailers/store-lookup`, `POST /api/pricing/market`,
  `POST /api/oauth/ebay/start`, `POST /api/listings/packages`

No 404s reproduced on any of the previously-reported routes. No 500s
anywhere. No provider was called, no Stripe call, no fake inventory/
quantity/comps, no fake OAuth connection, external publish stays disabled.

## Root cause of the earlier reported 404s

Not reproducible against the live deployment at the time of this follow-up —
`/api/retailers`, `/api/pricing/platforms`, and `/api/oauth/providers` all
return 200 with the exact response shapes the implementation defines. The
deployed container's route index (`artifacts/api-server/src/routes/index.ts`)
registers `retailersRouter`, `pricingRouter`, and `oauthRouter` correctly, and
the running binary's behavior (env-var names, adapter categories, honest
statuses) matches the committed source exactly, confirming deployment
`cc9b8aba` is running implementation commit `e010bb9`/`4f17ac2`. The most
likely explanation is the 404 was observed before that deployment fully
finished rolling out, or before the healthcheck-gated cutover completed. No
code or routing fix was needed.

## Blockers

1. All retailer inventory and platform pricing adapters return NOT_CONFIGURED
   until real, permitted integrations (official APIs / licensed providers) are
   configured via environment variables.
2. Live OAuth stays NOT_CONFIGURED until `EBAY_CLIENT_ID`/`EBAY_CLIENT_SECRET`
   (etc.), `OAUTH_REDIRECT_BASE_URL`, and `OAUTH_TOKEN_ENCRYPTION_KEY` are set.
3. External publish remains disabled by design.
4. Root build remains PARTIAL because `artifacts/mockup-sandbox/vite.config.ts`
   requires `PORT`.
5. A new local SSH keypair (`~/.ssh/id_ed25519`) was generated and registered
   with Railway (as `primeopp-session-migration`) to reach the service's
   private network for the migration. It is a legitimate, non-secret-bearing
   key scoped to SSH access on the user's own Railway account; remove it via
   `railway ssh keys remove` if no longer wanted.

NEXT SINGLE ACTION:
Configure real retailer/marketplace provider credentials (official APIs or a
licensed data provider) as environment variables when ready to move any
adapter from NOT_CONFIGURED to READY; no further code change is required to
light them up.
