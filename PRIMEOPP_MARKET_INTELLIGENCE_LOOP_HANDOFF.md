# PrimeOpp Market Intelligence Loop Handoff

Date: 2026-08-08 (continuation of the Sourcing Finalization session)
Repo: `oprimenyc/PrimeOpp`
Branch: `integration/full-primeopp-platform`
Base commit for this session: `c578232`

VERDICT:
PASS -- the actual product-defining gap identified last session is closed
end to end, verified against a real Postgres database, not a mock.

## What this session did

The previous session's finding was: `platform_price_observations` is tied
to the operator's own product catalog, and nothing populates it -- meaning
BUY/PASS/WATCH could never work for the real scenario PrimeOpp exists for
(scan something arbitrary at Ross, decide later). This session closed that
gap: identity -> evidence -> economics -> decision -> list, using real
Postgres the whole way through.

### 1. Migration `0014_normalized_market_evidence.sql`

Extends `platform_price_observations` (additive only -- no drops):
- `product_id` is now nullable (`ALTER COLUMN ... DROP NOT NULL`).
- Added `normalized_identifier`, `identifier_type`, `source_url` columns.
- Added `CHECK (product_id IS NOT NULL OR normalized_identifier IS NOT NULL)`
  so a row is always scoped to something -- the operator's own catalog
  product, an arbitrary scanned item's identifier, or both.
- Applied and verified against a real local Postgres 16 instance in this
  sandbox (see Validation below) -- not just reviewed as SQL text.

### 2. Evidence lookup now works for items that were never in PrimeOpp's own catalog

`routes/sourcing.ts`'s `loadPricingEvidence()` now queries
`WHERE (product_id = $1 OR normalized_identifier = $2)` instead of
requiring `product_id`. This is the actual fix: a barcode scanned at Ross
gets a real `normalized_identifier` from the existing product-intake
classifier the moment it's scanned (no provider call needed for that part
-- `classifyProductIntake`/`applyIdentifierMapLookup` already did this
work), and evidence can now attach to that identifier even when
`matched_product_id` is (correctly) null.

Added `loadEvidenceSummary()` -- the concise, provider-agnostic "eBay $60
sold, StockX $75 active" summary the product spec asked for, returned as
`evidenceSummary` on every item. It shows every platform with real
evidence for this item's identity, never blended or averaged across
platforms; the decision engine still uses only whichever single platform
is selected as the sell-through venue (`targetPlatform`), since fees are
venue-specific and mixing them would be dishonest math.

### 3. BYOD: `POST /api/pricing/observations/manual`

The actual "bring your own data" path: the operator types in a real price
they observed themselves (checked eBay/StockX directly, read it off a
Helium10/Keepa/SellerAmp export) and it's stored as one real data point --
never expanded into a synthesized low/high range, never blended with
other platforms. This is currently the **only** writer into
`platform_price_observations` anywhere in the app (`/pricing/market`
queries adapter shells live and never persists -- confirmed again this
session). Validated with a zod schema (`manualPriceObservationSchema`)
that rejects a submission scoped to nothing (no `productId`, no
`normalizedIdentifier`) with a 400, backed by the DB's own CHECK
constraint as a second line of defense.

### 4. Marketplace-agnostic platform registry extended (still all honest shells)

`lib/platformPricing.ts`'s `PLATFORM_PRICING_ADAPTERS` now also lists
StockX, GOAT, Alias, Flight Club, Stadium Goods, Depop, Grailed, Walmart,
OfferUp, Whatnot alongside the existing eBay/Amazon/Mercari/Poshmark/
Facebook Marketplace/Etsy -- all `NotConfiguredPricingAdapter` shells,
exactly like the ones already there. This single list now backs both the
Review Queue's target-platform selector and the manual-evidence-entry
platform field, so the product is marketplace-agnostic without needing a
live adapter for any of them yet, and a real one plugs in later by
changing only this file. **None of these call `Math.random()` or
`modules/marketplace-platform`'s test-only stubs** -- see last session's
handoff for why those must never be wired in.

### 5. Review Queue UX: evidence summary + inline BYOD entry

`pages/sourcing.tsx`'s `ReviewQueueRow` now shows the cross-platform
evidence summary next to the decision (decision first, evidence second,
per spec), and a collapsed-by-default "+ Evidence" control that expands
into a three-field inline form (platform, sold/active, price) -- kept
collapsed so the row stays dense for someone moving fast through a queue
of 40 items, not a dashboard.

## Validation -- against a real Postgres, not a mock

This sandbox already had `postgresql-16` installed but not running.
Started it, created the `test`/`primeopp_test` role+database the existing
test files already referenced (`postgres://test:test@127.0.0.1:5432/primeopp_test`
-- 4 test files set this exact `DATABASE_URL` before this session, but no
prior session had a live Postgres to actually connect to), and ran the
real migration runner:

```
DATABASE_URL=postgres://test:test@127.0.0.1:5432/primeopp_test node lib/db/scripts/migrate.mjs
-> 14 applied, 0 already up to date.
```

All 14 migrations, including the new `0014`, applied cleanly to a real
database. Then added `tests/sourcing-evidence-integration.test.ts` -- five
tests that log in as a real seeded admin, get a real session cookie + CSRF
token, and hit the real HTTP routes against that real database:

1. **Golden path**: scan an item with no catalog match -> `INSUFFICIENT_DATA`
   (no cost yet, honest) -> set cost/shipping/platform -> `WATCH` (identity
   resolved, zero evidence yet, honest) -> submit one real manual eBay sold
   observation -> re-fetch -> **BUY**, `estimatedProfit` ~$25, ROI ~139% --
   the mission's own worked example, produced from real math, not asserted
   by fiat -> `create-listing` -> a real `ListingPackageResponse` with
   non-empty `channelDrafts`/`exports` (proving the previous session's
   BUY->LIST fix persists the full package, not a truncated one).
2. **Multi-platform, no cross-contamination**: two observations (eBay SOLD
   $59.99, StockX ACTIVE $75) for the same identifier both appear in
   `evidenceSummary` distinctly, and switching `targetPlatform` between
   them changes which single number drives the decision -- never blended.
3. **Rejects evidence scoped to nothing** (400, not a 500 or a silent
   partial insert).
4. **Zero evidence anywhere stays WATCH**, `recommendedListPrice` and
   `estimatedProfit` both `null` -- never guessed.
5. **Backward compatible**: an item linked to the operator's own catalog
   product (`matched_product_id`, no `normalized_identifier`) still
   resolves evidence correctly -- the identifier-based fix is additive to
   the existing path, not a replacement of it.

Full suite result: `pnpm --filter @workspace/api-server run test` --
**92/92 passing** (81 prior + 5 new integration tests + 6 new static/
regression-guard tests). `typecheck` clean on both packages. `vite build`
clean (1775 modules).

Note for whoever runs this suite next: these 5 integration tests need a
reachable Postgres at the URL above with migrations applied. They fail
loudly (not skipped) if it's not running -- that's intentional, so a
missing database is never mistaken for a passing test.

## What real market-data path now works

`SCAN -> IDENTIFY (existing product-intake classifier, no provider needed)
-> BYOD MANUAL EVIDENCE ENTRY (real, working today) -> NORMALIZED EVIDENCE
(platform_price_observations, keyed by identifier or catalog product) ->
DECISION ENGINE (existing, unchanged math) -> BUY/PASS/WATCH -> LIST
(existing Listing Workspace, full package persisted)`. Every step is real
code, exercised end to end against a real database this session.

## What happens when no evidence exists

Exactly what it always should: `WATCH`, with `recommendedListPrice` and
`estimatedProfit` both `null` and a reason string naming the gap
("Insufficient supported evidence..."). Verified against a real query
returning zero rows, not a mocked empty response.

## What BYOD capability exists

`POST /api/pricing/observations/manual` (batch-capable, 1-50 observations
per call) plus the Review Queue's inline entry form. Not built: a CSV/
spreadsheet bulk-upload UI. The endpoint already accepts an array, so a
future CSV importer is "parse rows client-side, POST the same array" --
no backend change needed. Flagging that as the natural next BYOD step
rather than building it speculatively this session.

## What remains blocked solely by external credentials/access

1. **Railway**: unchanged from last session -- this sandbox's network
   egress proxy returns 403 on `railway.app`/`backboard.railway.com`,
   confirmed via direct `curl`, independent of any token. Migration `0014`
   (and `0013`) are not applied to the production database; nothing is
   redeployed. This is a network-policy fact about this sandbox, not a
   code gap.
2. Every live marketplace adapter (eBay, Amazon, StockX, etc.) still
   reports `NOT_CONFIGURED` -- correct and honest. BYOD is the real
   evidence path today; a live adapter is a future credential-gated
   addition that plugs into the same normalized evidence table without
   further schema changes.

## Test/build results

- `pnpm --filter @workspace/api-server run typecheck` -- PASS.
- `pnpm --filter @workspace/api-server run test` -- **92/92 passing**
  (5 of them real Postgres integration tests, run and passing in this
  session against a live database).
- `pnpm --filter @workspace/primeopp run typecheck` -- PASS.
- `pnpm --filter @workspace/primeopp run build` -- PASS (real `vite build`,
  1775 modules).
- Confirmed no unrelated systems touched: `git diff --stat` shows exactly
  8 modified files (all sourcing/pricing-related) + 2 new files (migration
  + integration test). Storefront, Stripe, orders, fulfillment untouched.

## Single highest-value remaining task

Build the CSV/spreadsheet bulk-import UI on top of the now-existing
`POST /api/pricing/observations/manual` endpoint, so an operator who
already has a Helium10/Keepa/SellerAmp export can paste/upload many real
observations at once instead of one at a time. The backend already
accepts a batch; this is a frontend-only addition (parse rows, map to
`ManualPriceObservationInput[]`, submit). Second priority, once Railway
access exists from an environment that can reach it: apply `0013` and
`0014`, redeploy, and live-smoke the exact golden path this session
already proved locally.
