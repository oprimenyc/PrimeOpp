# PrimeOpp Identifier Map Handoff

Date: 2026-07-22
Repo: `C:\Users\jp718\Documents\GitHub\PrimeOpp`
Branch: `integration/full-primeopp-platform`

VERDICT:
PASS WITH BLOCKERS

LIVE URL:
https://primeopp-production-a554.up.railway.app

STARTING HEAD:
`874df3ebea38a79f0091891259c0e6d0e95998cf`

ENDING HEAD:
`e9b33fe246e942aad62c5f691924576186040abc`

PRODUCT IDENTIFIER MAP:
PASS

MIGRATION:
`lib/db/migrations/0010_product_identifiers.sql`

MIGRATION TYPE:
ADDITIVE

IDENTIFIER TYPES SUPPORTED:
UPC, EAN, GTIN, SKU, STYLE_CODE, ISBN, OTHER

POST /api/products/intake:
PASS

LOOKUP ORDER:
1. Classify and normalize identifier using the local product-intake contract.
2. For non-product-name identifiers, look up `product_identifiers.normalized_identifier` with compatible identifier types.
3. For product-name search queries only, fall back to existing `products.title` search.
4. Return `NOT_FOUND` with `lookupSource=NONE` if no identifier/title match exists.
5. Never create fake product data, fake images, fake prices, fake comps, or fake provider matches.

IDENTIFIER LOOKUP:
PASS

TITLE SEARCH FALLBACK:
PASS WITH BLOCKERS

LIVE FOUND SMOKE:
NOT_RUN

FAKE PRODUCTS ADDED TO PRODUCTION:
NO

FAKE ENRICHMENT INTRODUCED:
NO

FAKE MARKETPLACE PRICES INTRODUCED:
NO

CANONICAL LISTING PACKAGE:
PASS

CHANNEL DRAFTS / EXPORTS:
PASS

EXTERNAL PUBLISH:
DISABLED

LIVE OAUTH TOKEN EXCHANGE:
NOT_CONFIGURED

PROVIDER CALLS:
NO

STRIPE CALLED:
NO

PUBLIC MARKETPLACE:
NO

KYC REQUIRED FOR MVP:
NO

TESTS:
PASS

TYPECHECK:
PASS

RAILWAY SERVICE BUILD:
PASS

ROOT BUILD:
PARTIAL

SECRET SCAN:
PASS

LIVE DEPLOYED:
YES

LIVE DEPLOYMENT ID:
`ad0b0658-1299-417d-b201-ed4928fa9c4c`

LIVE SMOKE:
PASS WITH BLOCKERS

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

PROVIDER ACTIONS MUTATED:
NO

UNRELATED DIRTY FILES PRESERVED:
YES

COMMIT:
`e9b33fe246e942aad62c5f691924576186040abc`

PUSHED:
YES

## What Changed

Product identifier map:

- Added additive `product_identifiers` table.
- Added foreign key to existing `products(id)`.
- Added identifier types: `UPC`, `EAN`, `GTIN`, `SKU`, `STYLE_CODE`, `ISBN`, `OTHER`.
- Added source values: `MANUAL`, `IMPORT`, `LOCAL_CATALOG`, `GENERATED_REFERENCE`.
- Added confidence values: `HIGH`, `MEDIUM`, `LOW`.
- Added unique index on `normalized_identifier + identifier_type`.
- Added index on `normalized_identifier`.
- Existing products are not required to have identifiers.

Intake lookup:

- `POST /api/products/intake` now tries identifier-map lookup for barcode/SKU/style-code/ISBN identifiers.
- Response now includes `matchedIdentifier` and `matchedProductId`.
- `lookupSource` is now `PRODUCT_IDENTIFIER_MAP`, `LOCAL_CATALOG_TITLE_SEARCH`, or `NONE`.
- Product-name search still falls back to existing `products.title` search.
- No-match identifiers return `NOT_FOUND`, not fake enrichment.

Admin UI:

- `/admin/listings` now includes an Identifier Mapping panel.
- Operators can enter an existing local product ID and save a local identifier mapping.
- The UI shows identifier type, normalized value, source/confidence, mapped/unmapped state, and local-only safety copy.
- Unmapped identifiers can still create manual listing packages.
- Provider publish remains disabled.

## Validation

Focused tests:

- `pnpm --filter @workspace/api-server test -- product-intake listing-workspace`
- Result: PASS, 18 tests.

Full API tests:

- `pnpm --filter @workspace/api-server test`
- Result: PASS, 31 tests.

Typecheck:

- `pnpm run typecheck`
- Result: PASS.

Railway service build:

- `pnpm --filter @workspace/primeopp run build`
- `pnpm --filter @workspace/api-server run build`
- Result: PASS.

Root build:

- `pnpm run build`
- Result: PARTIAL.
- Exact blocker: `artifacts/mockup-sandbox/vite.config.ts` requires `PORT` during `vite build`; workspace typecheck, PrimeOpp frontend build, and API server build pass.

Secret scan:

- Changed mission files scanned for secret-like assigned values and private keys.
- Result: PASS.

## Migration

Applied to Railway production database:

- `lib/db/migrations/0010_product_identifiers.sql`

Migration was additive only. No destructive migration was run.

## Live Smoke

Live URL:

- `https://primeopp-production-a554.up.railway.app`

Results:

- `GET /`: 200
- `GET /api/healthz`: 200
- `GET /admin/listings`: 200
- `POST /api/products/intake` unmatched barcode: 200, `identifierType=UPC_A`, `lookupStatus=NOT_FOUND`, `lookupSource=NONE`, `matchedProductId=null`, `providerCalls=false`, `publishEnabled=false`
- `POST /api/products/intake` invalid identifier: 422, `valid=false`, `canCreateListingPackage=false`, `providerCalls=false`
- Product-name title search: NOT RUN because the live public product list returned no product rows.
- Identifier-map FOUND smoke: NOT RUN because no safe real production product mapping existed, and no fake public product/mapping was added.
- Authenticated `POST /api/listings/packages`: 201, one draft, one export, `externalPublishEnabled=false`, `approvalRequired=true`, `liabilityMode=seller_publishes_on_own_accounts`

Deployment logs:

- Server started on port 8080.
- Stripe remains not configured and payment routes fail closed.
- No provider crash found.

## Blockers

1. Live `FOUND` smoke is not run because no safe real product identifier mapping exists in production yet.
2. Product-name title fallback could not be live-smoked because the public live product list returned no product rows.
3. Identifier mapping requires an existing local product ID; the mission intentionally did not create fake public production products.
4. Product-enrichment providers beyond local catalog/title and identifier map are still not wired.
5. OAuth remains not configured and external publish remains disabled.
6. Root build remains partial because `artifacts/mockup-sandbox/vite.config.ts` requires `PORT`.

NEXT SINGLE ACTION:
Use an existing real local product or create a non-public admin-only product, save its real UPC/EAN/GTIN/SKU/style-code in `product_identifiers`, then live-smoke `POST /api/products/intake` returning `FOUND` from `PRODUCT_IDENTIFIER_MAP`.
