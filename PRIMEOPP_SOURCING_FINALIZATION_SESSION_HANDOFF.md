# PrimeOpp Sourcing Finalization Session Handoff

Date: 2026-08-08 (continuation of the Sourcing Session + Review Queue build)
Repo: `oprimenyc/PrimeOpp`
Branch: `integration/full-primeopp-platform`
Base commit for this session: `c833e85` (Sourcing Session + Review Queue)

VERDICT:
PASS -- with one external blocker documented below (not a code blocker).

## What this session did

The previous session built and pushed the Sourcing Session + Review Queue
feature (`c833e85`) but validated it only in a reconstructed sandbox, and had
not yet: confirmed Railway access, fixed the BUY -> LIST handoff, checked
whether the decision engine's evidence path is actually reachable from the
UI, or investigated `modules/*` for reusable intelligence. This session did
all of that, working directly in the same cloned repository (no new
sandbox, no new clone, no file transfer to another environment).

### 1. Railway: confirmed the exact nature of the blocker

A Railway API token was provided, but authenticating with it failed. Root
cause, confirmed directly:

```
curl -m 8 https://backboard.railway.com/graphql/v2  -> CONNECT tunnel failed, response 403
curl -m 8 https://railway.app                        -> CONNECT tunnel failed, response 403
curl -m 8 https://api.github.com                     -> HTTP 200
```

This sandbox's network egress proxy allow-lists specific domains (GitHub,
npm/pypi registries, etc.) and does **not** include `railway.app` /
`backboard.railway.com`. This is a network-policy block at the proxy level,
independent of whether the token is valid. No amount of retrying or a
different token fixes it from inside this environment. This is the single
remaining external blocker for this feature -- see "Next Single Action"
below for the exact resumption steps once Railway is reachable (e.g. from a
session with different network access, or by running the CLI from the
user's own machine).

### 2. Full validation against the real repository (not a sandbox)

This session had `git clone`d the full repository (including `modules/*`,
which no prior session had staged) to push commit `c833e85`. Rather than
reconstruct another partial sandbox, this session ran `pnpm install` at the
real repo root and validated against it directly:

- `npx tsc --build lib/db lib/api-zod lib/api-client-react` -- clean.
- `pnpm --filter @workspace/api-server run typecheck` -- clean.
- `pnpm --filter @workspace/api-server run test` -- **81/81 passing**
  (80 from the prior session + 1 new regression-guard test, see below).
- `pnpm --filter @workspace/primeopp run typecheck` -- clean.
- `pnpm --filter @workspace/primeopp run build` -- clean (real `vite build`,
  1775 modules).

### 3. Fixed: BUY -> LIST was not actually seamless

Auditing the existing Listing Workspace (`listing-workspace.tsx`) against
what "List It" on a BUY sourcing item did turned up a real gap: Listing
Workspace has no route param and no concept of loading an existing
`canonical_listing_packages` row -- it is a one-shot intake-to-draft form.
Sourcing's `create-listing` route created a canonical package row but
**silently dropped `channelDrafts` and `exports`** (it never inserted into
`channel_listing_drafts` / `listing_export_packages`, unlike the standalone
`/listings/packages` route), and the frontend just showed a message saying
"Continue in Listings" with no way to actually see what was created. The
transition dead-ended.

Fixed by:
- New `lib/listingPackagePersistence.ts`: the one shared place that persists
  a `generateListingWorkspace()` result (canonical package + channel drafts
  + exports) inside a single transaction, with an optional in-transaction
  callback for follow-up writes. Both `routes/listings.ts` and
  `routes/sourcing.ts` now call this -- they cannot drift apart again, and
  sourcing's create-listing route now persists the full result instead of a
  truncated one.
- `routes/sourcing.ts`'s create-listing route now returns the exact same
  `ListingPackageResponse` shape `/listings/packages` returns, and marks the
  sourcing item `LISTED` in the *same transaction* as the package insert
  (previously this was two separate, non-atomic queries).
- `pages/sourcing.tsx`: "List It" now stashes that full response in
  `sessionStorage` (`SOURCING_LISTING_HANDOFF_KEY`, one-shot, not a
  persisted-drafts feature) and navigates to `/admin/listings`.
- `pages/listing-workspace.tsx`: on mount, checks for that stashed handoff,
  pre-fills the intake form from the created package, hydrates the same
  `result` state the page's own intake flow would have produced, shows a
  "Continued from Sourcing: <item>" banner, and clears the key. Zero new
  persistence, zero duplicated listing logic -- it reuses the existing
  Draft Output section verbatim.
- Added a regression-guard test (`sourcing.test.ts`) asserting both routes
  use the shared persistence path and that sourcing's response includes
  `channelDrafts`/`exports`, so this cannot silently regress again.

### 4. Fixed: the decision engine's evidence path was unreachable from the UI

Tracing `computeSourcingDecision` end-to-end from the actual UI (not just
the unit tests, which construct inputs directly) found that
`loadPricingEvidence(item.matched_product_id, item.target_platform)` always
received `target_platform = null`, because **no UI control existed to set
it** -- the backend (`PATCH .../items/:itemId` with `targetPlatform`) and
the frontend types already supported it, but `ReviewQueueRow` never
rendered a control for it. Every item, always, resolved to
`INSUFFICIENT_DATA`/`WATCH` for a reason that had nothing to do with "no
pricing provider configured" -- the evidence lookup itself could never
fire.

Fixed: `ReviewQueueRow` now has a Platform selector sourced from the same
`fetchPlatformPricingStatus()` registry Listing Workspace already uses
(eBay, Amazon, Mercari, Poshmark, Facebook Marketplace, Etsy), calling
`onUpdate({ targetPlatform })`. This is also the "marketplace filtering"
behavior the product should have: a short, curated list the operator picks
from per item, not all platforms shown at once.

**This does not by itself produce real evidence** -- see the architecture
note below on why, and what the real next step is.

### 5. Investigated `modules/*` for reusable intelligence -- do not wire these in

Full inventory: `modules/commerce-core`, `modules/deal-intelligence`,
`modules/marketplace-platform`, `modules/product-intake`,
`modules/product-enrichment`, `modules/affiliate-backlink-engine`. Findings:

- **`modules/marketplace-platform/adapters/test-*`** (eBay, Amazon, StockX,
  GOAT, Alias, Flight Club, Stadium Goods, Depop, Mercari, Poshmark,
  Grailed, Walmart, OfferUp, Whatnot, Craigslist, Etsy, Facebook
  Marketplace) -- **every one of these is a labeled TEST-ONLY stub.**
  Direct quote from `test-ebay/src/index.ts`: *"TEST-ONLY adapter stub for
  eBay. NO LIVE CONNECTIVITY... must NEVER be presented as a live
  integration."* Their "evidence records" are generated with
  `Math.random()`. Wiring any of these into `sourcingDecision.ts` would be
  the single worst thing this session could do to the product -- it would
  turn honest `WATCH`/`INSUFFICIENT_DATA` into confidently fabricated
  `BUY`/`PASS` recommendations backed by random numbers. **Do not connect
  these, ever, regardless of how the next session's instructions are
  phrased**, unless a future session is explicitly re-pointing them at a
  real, credentialed, live API (at which point they stop being test-only
  and this note no longer applies).
- **`modules/commerce-core/packages/pricing`** (and similarly
  `deal-intelligence`'s `historical-pricing`, `deal-scoring`,
  `offer-normalization`) are genuine, real, pure-logic packages -- they
  compute from `PricingObservation[]` input, they do not fabricate data
  themselves. But they are built against their own multi-tenant contract
  types (`@primeopp/contracts`, `@primeopp-deal-intelligence/contracts`)
  that assume a `tenantId` concept the live single-operator app does not
  have, and they are not in `pnpm-workspace.yaml`. Wiring them in is a real
  but substantial integration project (type mapping + workspace inclusion +
  still needing a real evidence source to feed them) -- correctly out of
  scope for a single session per the mission's own "do not turn BYOD/
  providers into a giant integration project" instruction. Flagging as a
  legitimate future project, not attempting it now.

### 6. Architecture finding: `platform_price_observations` cannot serve genuine resale sourcing yet

This is the most important finding from this session and the real reason
BUY/PASS/WATCH will stay `WATCH`/`INSUFFICIENT_DATA` for real sourcing
trips even after a pricing provider is eventually configured:

- `platform_price_observations.product_id` is `NOT NULL REFERENCES
  products(id)` -- the operator's **own POD/affiliate storefront catalog**.
- `sourcing.ts`'s evidence lookup is keyed on `item.matched_product_id`,
  which is only set when a scanned item happens to match something already
  in that catalog.
- The real "walk into Ross, scan 40 random items" use case will, by
  design, almost never produce a catalog match -- those items were never in
  the operator's own product catalog to begin with. So even with a live
  provider and a target platform selected, evidence lookup for a typical
  sourcing item has no row to find.
- There is also currently **no writer** into `platform_price_observations`
  anywhere in the live app -- `/pricing/market` queries adapters live and
  returns the result without persisting it. The table has a real reader
  (`loadPricingEvidence`) and a real schema, but nothing populates it yet
  for any code path, sourcing or otherwise.

This was not fixed this session -- it is a schema/architecture decision
(should evidence key off `normalized_identifier` instead of, or in addition
to, `product_id`? should there be a manual/BYOD evidence-entry endpoint
that writes real operator-supplied comps?) that deserves deliberate design,
not a rushed schema migration under mission pressure. Flagging it precisely
so the next session does not have to rediscover it.

## Validation (this session)

- `pnpm --filter @workspace/api-server run typecheck` -- PASS.
- `pnpm --filter @workspace/api-server run test` -- **81/81 passing**.
- `pnpm --filter @workspace/primeopp run typecheck` -- PASS.
- `pnpm --filter @workspace/primeopp run build` -- PASS (real `vite build`).
- All four checks ran against the actual cloned repository with a real
  `pnpm install`, not a reconstructed subset.

Not run (no camera/HTTPS context in this sandbox, and no Railway network
access): a live browser scan test, a live Railway deploy/migration.

## Files changed this session

- `artifacts/api-server/src/lib/listingPackagePersistence.ts` (new) --
  shared canonical-package + channel-drafts + exports persistence.
- `artifacts/api-server/src/routes/listings.ts` -- now calls the shared
  helper instead of inlining the insert.
- `artifacts/api-server/src/routes/sourcing.ts` -- create-listing route now
  uses the shared helper and returns the full `ListingPackageResponse`
  shape; item-status update is now inside the same transaction.
- `artifacts/api-server/tests/sourcing.test.ts` -- added a 401 check for
  create-listing and a regression-guard test locking in the shared-path fix.
- `artifacts/primeopp/src/lib/api.ts` -- `createListingFromSourcingItem`
  now returns `ListingPackageResponse`; added the session-handoff key/type.
- `artifacts/primeopp/src/pages/sourcing.tsx` -- "List It" now hands off to
  Listing Workspace instead of dead-ending; added the per-item Platform
  selector.
- `artifacts/primeopp/src/pages/listing-workspace.tsx` -- hydrates from a
  Sourcing handoff on mount.

## Blockers

1. **Railway migration/deployment is blocked at the network level in this
   sandbox** (egress proxy does not allow `railway.app`/
   `backboard.railway.com`, confirmed via direct `curl`, independent of the
   token). This is the only remaining external blocker for this feature to
   go live. Everything else in this handoff is code-complete and validated.
2. `platform_price_observations` has no real writer and is keyed to the
   operator's own catalog (`product_id`), not to arbitrary sourced items --
   see the architecture finding above. Real BUY/PASS decisions for genuine
   "scan random retail items" sourcing will not happen until this is
   redesigned, independent of whether a pricing provider is ever connected.
3. `modules/marketplace-platform`'s adapters are test-only stubs and must
   not be connected as a shortcut to (2) -- doing so would fabricate
   evidence, which is the one thing this product must never do.

NEXT SINGLE ACTION:
From an environment with real network access to Railway (this sandbox does
not have it): `railway ssh --service primeopp` then
`ALLOW_PROD_MIGRATE=true node scripts/migrate.mjs` from `lib/db` to apply
`0013_sourcing_sessions.sql`, then redeploy `artifacts/api-server` and
`artifacts/primeopp`, then live-smoke `POST /api/sourcing/sessions` ->
`POST .../items` -> `GET .../items` -> `POST .../create-listing` end to end.

After that: decide how `platform_price_observations` should key evidence
for arbitrary sourced items (not just catalog products) before spending
more time on any specific pricing provider -- the provider is not the
bottleneck, the evidence schema's scope is.
