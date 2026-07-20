# PrimeOpp Next Session Handoff

## What you're picking up

The product catalog ingestion pipeline (intake → enrichment → identity resolution →
canonical catalog) is now real, tested, and persisted. It runs via:

```
cd modules/commerce-core
node packages/cli/src/index.ts catalog ingest <input.json> [--data-dir <dir>] [--tenant <id>] [--json]
node packages/cli/src/index.ts catalog list [--data-dir <dir>] [--tenant <id>] [--json]
```

`<input.json>` is a `primeopp-product-intake` `RawProductInput`: either
`{ "rawValue": "<barcode>", "inputMethod": "HARDWARE_SCANNER" | "CAMERA_SCAN" | "MANUAL_IDENTIFIER" | "BATCH_IMPORT" | "API" }`
or `{ "inputMethod": "MANUAL_PRODUCT", "manualProduct": { "title": "...", "brand": "...", "model": "..." } }`.

Read `PRIMEOPP_IMPLEMENTATION_REPORT.md` for the full file list and
`PRIMEOPP_RUNTIME_PROOF.md` for worked examples of every outcome (success, rejected,
duplicate at both intake and catalog level, not-found, malformed input).

## How to verify it still works

```
cd modules/commerce-core
node --test "packages/pipeline/tests/**/*.test.ts"   # should be 12/12
node --test "packages/*/tests/**/*.test.ts"          # full suite, should be 269/269
node scripts/typecheck-all.ts                        # should be 25/25
node scripts/verify.ts                               # should be 24/24
```

## What was found and fixed this session (read before touching `@primeopp/sdk`)

`PrimeOppSdk.identityResolver` (pre-existing, in
`modules/commerce-core/packages/sdk/src/index.ts:56-58`) still uses
`LocalTestProductIdentityAdapter` — an empty, never-populated, `TEST-ONLY` adapter. It was
**not** changed this session, because the SDK is used by `demo`, `doctor`, and
`products resolve/inspect` — none of which were in scope, and changing the SDK's own
storage/resolver wiring risked destabilizing those paths without a matching test pass
over them. Instead, the new `catalog ingest` command bypasses the SDK's identity
resolver entirely and uses `CatalogBackedIdentityAdapter`
(`packages/pipeline/src/identity/catalog-backed-adapter.ts`), which actually queries the
persisted catalog.

**If you touch the SDK next:** `sdk.resolveProductIdentity()` will still always return
`NO_MATCH` today. If a future task wires the SDK itself into a real catalog, consider
whether `PrimeOppSdk` should use `CatalogBackedIdentityAdapter` instead of
`LocalTestProductIdentityAdapter` — but re-run the SDK's own tests and `doctor`/`demo`
commands before assuming that's safe, since nothing currently pins down what those
commands expect from `resolveProductIdentity()`'s return value.

## Immediate next safe step (per mission directive)

> Run the completed PrimeOpp workflow through VERIDIAN admission and Foundry governance
> after the paused VERIDIAN integration is committed.

This session did not touch VERIDIAN or Foundry (both are on the do-not-modify list for
this repo). That admission/governance step is gated on work in those other systems, not
on anything left undone here.

## Logical next workflow (if not gated elsewhere)

Canonical products created by `catalog ingest` are not yet exposed anywhere downstream —
no storefront listing, no marketplace publish, no pricing/inventory attached. The next
highest-leverage step toward revenue is almost certainly: take a canonical product from
this pipeline and run it through `commerce-core`'s existing (but equally disconnected)
`pricing` → `profit` → `opportunity` → `listing` chain (all already real, unit-tested
library code in `packages/pricing`, `packages/profit-engine`, `packages/opportunity-engine`,
`packages/listing-contracts` — same "real code, zero end-to-end wiring" pattern this
session just closed for the intake side).

## Known, deliberately-unfixed gaps

See `PRIMEOPP_IMPLEMENTATION_REPORT.md` → "Remaining blockers" for the full list
(unrelated `artifacts/mockup-sandbox` build gap, a Windows-shell-incompatible pre-existing
test script, the resolver's `detectState()` fallthrough, and the CLI's intentionally
local-only default enrichment providers).

## Working tree note

`modules/commerce-core/evidence/*` shows as modified in `git status` — this is
regenerated, timestamped output from running `npm run verify` during this session's gate
checks. It was deliberately left uncommitted. Either commit it if you want a snapshot, or
ignore/regenerate it; it has no bearing on correctness.
