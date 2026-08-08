# PrimeOpp Sourcing Session + Review Queue Handoff

Date: 2026-08-08
Repo: `C:\Users\jp718\Documents\GitHub\PrimeOpp`
Branch: `integration/full-primeopp-platform`

VERDICT:
PASS

## Why this, why now

The mission for this session was to reconcile the repo against PrimeOpp's
stated product (scan a product in-store, queue it, review it, get an honest
BUY/PASS/WATCH, move BUY items toward a sale) and finish the highest-value
missing piece. `PRIMEOPP_PRODUCT_REALITY_MATRIX.md` and
`PRIMEOPP_CURRENT_TRUTH.md` (both pre-existing) already established that:

- The **live, deployed app** (`artifacts/api-server` + `artifacts/primeopp`)
  is a real, working single-operator print-on-demand storefront (Stripe
  checkout, orders, fulfillment, discounts, loyalty, admin dashboard).
- A real, incrementally-built **Listing Workspace** already exists on top of
  it (`/admin/listings`): barcode camera scanning, a product-identifier map,
  retailer/platform pricing adapter shells (all honestly `NOT_CONFIGURED`),
  a real fee/profit engine, and a low-liability listing/channel-draft
  pipeline with external publish disabled.
- What did **not** exist anywhere in the live app: a **Sourcing Session**
  (a real store trip) or a **Review Queue** (BUY/PASS/WATCH triage across
  many scanned items with batch actions) -- items 5, 6, 10, and 11 of the
  mission's own P0 list. The scanner that existed did one item at a time and
  immediately forced a deep listing-workspace form; it did not support
  "scan many, decide later."
- `modules/*` (commerce-core, deal-intelligence, marketplace-platform,
  product-intake, product-enrichment) are separate, real, tested donor
  packages that are **not** part of the pnpm workspace and are not wired
  into the live app. They were left untouched this session -- wiring them in
  is a larger, separate integration project (see `PRIMEOPP_CURRENT_TRUTH.md`),
  not a same-session extension of the live Listing Workspace.

This session built the Sourcing Session + Review Queue directly on top of
the live app's existing, real infrastructure (auth, fee engine, product
identifier map, canonical listing packages) instead of inventing a parallel
system or touching `modules/*`.

## What Changed

Migration (additive only -- no dropped tables/columns, no deleted rows):

- `lib/db/migrations/0013_sourcing_sessions.sql` -- adds `sourcing_sessions`
  (one row per real store trip: label, location, status, notes) and
  `sourcing_session_items` (one row per scanned/entered item: intake
  source/identifier, lookup result, operator-entered acquisition cost and
  shipping estimate, status lifecycle `SCANNED -> IDENTIFYING -> QUEUED ->
  REVIEWING -> BUY/PASS/WATCH -> PURCHASED -> LISTED -> SOLD -> ARCHIVED`,
  same-session duplicate detection via `duplicate_of_item_id`, and an
  optional link to an existing `canonical_listing_packages` row once an item
  is moved to Sell).

API (`artifacts/api-server/src`):

- `lib/sourcingDecision.ts` -- the BUY/PASS/WATCH decision engine. Calls no
  provider. It only combines the operator's own acquisition cost/shipping
  estimate with real fee-schedule math (`feeEngine.calculateFees`) and
  whatever real supported pricing evidence exists. Missing acquisition cost,
  missing shipping, or missing market evidence each produce an honest
  `WATCH`/`INSUFFICIENT_DATA` with the exact gap named -- never a fabricated
  number. BUY requires both a configurable ROI threshold (30%) and a minimum
  absolute profit ($5), both named constants, not buried magic numbers.
- `routes/sourcing.ts` -- `POST/GET/PATCH /api/sourcing/sessions`,
  `POST/GET /api/sourcing/sessions/:id/items`,
  `PATCH /api/sourcing/sessions/:id/items/:itemId`,
  `POST /api/sourcing/sessions/:id/items/batch` (PASS/WATCH/ARCHIVE/QUEUE),
  `POST /api/sourcing/sessions/:id/items/:itemId/create-listing`. The last
  route reuses `generateListingWorkspace()` and inserts into the existing
  `canonical_listing_packages` table rather than duplicating listing logic.
  Item creation reuses `classifyProductIntake`/`applyIdentifierMapLookup`/
  `applyLocalCatalogLookup` from the existing product-intake module rather
  than reimplementing identifier classification.
- `lib/validation.ts` -- added zod schemas for session create/update, item
  create/update, and batch actions.
- `routes/index.ts` -- registered the new router.
- All new routes require the same `requirePermission("products:read"/"write")`
  admin-session auth as every other admin route; unauthenticated requests
  get `401` before any DB access.

Frontend (`artifacts/primeopp/src`):

- `pages/sourcing.tsx` -- new page with two views:
  - **Session list** (`/admin/sourcing`): start a session (label + optional
    location), see existing sessions with live scanned/reviewing/buy/watch/
    pass counts.
  - **Session detail** (`/admin/sourcing/:id`): a sticky **Source** panel
    (continuous `BarcodeDetector` camera loop -- decoding one barcode adds it
    to the queue and the camera keeps running, with a 4-second debounce so
    one physical item scanned continuously isn't added repeatedly; manual
    identifier/search fallback; per-scan acquisition cost) next to a
    **Review Queue** (status filter chips, checkbox multi-select with batch
    Watch/Pass/Archive, inline editable cost/shipping per row, BUY/PASS/WATCH
    badge with the underlying profit number always shown next to the label,
    and a "List It" action that calls `create-listing` for BUY items).
- `lib/api.ts` -- added typed client functions for all six sourcing
  endpoints, following the existing `adminHeaders()`/CSRF pattern.
- `App.tsx` -- registered `/admin/sourcing` and `/admin/sourcing/:id`.
- `pages/admin.tsx`, `admin-dashboard.tsx`, `admin-orders.tsx`,
  `listing-workspace.tsx` -- added a "Sourcing" nav link alongside the
  existing Products/Listings/Orders/Dashboard links (each of these four
  pages previously linked a different subset of the others; none linked
  the others exhaustively -- not changed further this session beyond adding
  Sourcing, to keep the diff focused).

## Design decisions worth flagging

- **BUY/PASS/WATCH is computed at read time, not stored.** Storing a
  computed decision would risk it going stale or being mistaken for a real
  market fact. The item's `status` column is the operator's own decision
  (which can be set manually at any time); `decision` in the API response is
  always a fresh recommendation from current inputs.
- **Most items will currently show WATCH or INSUFFICIENT_DATA**, because no
  platform pricing adapter is configured yet (same honest state as the rest
  of the app -- see `PRIMEOPP_RETAIL_INTELLIGENCE_PRICING_OAUTH_HANDOFF.md`).
  This is correct behavior, not a bug: the moment a real pricing provider is
  configured, `sourcing.ts`'s `loadPricingEvidence()` will start finding real
  `platform_price_observations` rows and decisions will resolve to BUY/PASS
  as real evidence arrives. No code change is required for that to happen.
- **Fee schedule fallback**: if no `platform_fee_schedules` row exists for
  an item's `target_platform` (none do yet -- that table is currently
  unpopulated in this repo), a named `DEFAULT_SOURCING_FEE_SCHEDULE`
  (13% + $0.30, matching a typical marketplace final-value fee) is used and
  marked `source: "DEFAULT_ESTIMATE"` in the fee breakdown so the UI/operator
  can tell it isn't a verified platform-specific schedule.
- **Duplicate detection** is same-session, by normalized identifier, and
  informational only (`duplicate_of_item_id` is set but the duplicate item
  is still kept and queued) -- consistent with the mission's "duplicate
  detection where practical," not silent deduplication.

## Validation

All of the following were run against a real (freshly `pnpm install`ed,
network-fetched) standalone workspace containing the actual
`artifacts/api-server`, `artifacts/primeopp`, `lib/db`, `lib/api-zod`, and a
stub `lib/api-client-react` -- not simulated:

- `pnpm --filter @workspace/api-server run typecheck` -- PASS (0 errors,
  including all pre-existing files).
- `pnpm --filter @workspace/api-server test` -- **80/80 passing** (67
  pre-existing baseline tests unchanged and still green + 13 new tests in
  `tests/sourcing.test.ts` covering: the decision engine's honesty under
  missing cost/shipping/evidence, a real BUY case, a real PASS case, a
  marginal-ROI WATCH case, migration-content assertions (additive-only,
  full status lifecycle present, nullable cost/shipping, reuses
  `canonical_listing_packages`), no Stripe/marketplace-claim strings in the
  new route file, and a 401-before-DB auth-boundary check on every new
  session/item/batch route).
- `pnpm --filter @workspace/primeopp run typecheck` -- PASS (0 errors).
- `pnpm --filter @workspace/primeopp run build` -- PASS (real `vite build`,
  1776 modules, produced `dist/public/index.html` + bundled JS/CSS).
- Root-equivalent `tsc --build` (lib/db, lib/api-zod, lib/api-client-react)
  followed by `--filter "./artifacts/**" run typecheck` -- PASS for both
  packages, mirroring the root `pnpm run build` sequence used by every prior
  handoff in this repo.

Not run this session (would require credentials/infra this environment
does not have): a live Railway deploy, a real Postgres migration apply, or
an end-to-end browser test of the camera scanner (BarcodeDetector requires a
real camera + HTTPS context). The migration SQL was reviewed for syntax and
additive-only shape but not applied to any database -- **apply
`0013_sourcing_sessions.sql` the same way `0009`-`0012` were applied**
(`railway ssh --service primeopp` then
`ALLOW_PROD_MIGRATE=true node scripts/migrate.mjs` from `lib/db`, per
`PRIMEOPP_RETAIL_INTELLIGENCE_PRICING_OAUTH_HANDOFF.md`) before this feature
can work against production data.

## Blockers

1. Migration `0013` is not yet applied to any real database (local or
   Railway) -- required before the new routes will return real data instead
   of `FAILED`/500 (they fail closed on a DB error, they do not fabricate a
   response for this feature the way `product-intake` does).
2. All BUY/PASS/WATCH recommendations stay `WATCH`/`INSUFFICIENT_DATA` until
   a real platform pricing provider is configured (same pre-existing
   blocker as the rest of the retail-intelligence surface).
3. `platform_fee_schedules` has no seeded rows for any real platform yet, so
   every decision currently uses the named default estimate schedule.
4. Not live-deployed. No Railway deploy was attempted or requested this
   session.

NEXT SINGLE ACTION:
Apply `lib/db/migrations/0013_sourcing_sessions.sql` to the target database,
then live-smoke `POST /api/sourcing/sessions` -> `POST .../items` (barcode)
-> `GET .../items` end to end.
