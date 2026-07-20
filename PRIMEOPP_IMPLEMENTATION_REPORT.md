# PrimeOpp Implementation Report

## Summary

Completed the Canonical Product Catalog Ingestion workflow: intake → enrichment →
identity resolution → canonical catalog creation, as a real, persisted, operator-usable
CLI command (`primeopp catalog ingest` / `primeopp catalog list`). See
`PRIMEOPP_REVENUE_WORKFLOW_SELECTION.md` for why this workflow was chosen and
`PRIMEOPP_CURRENT_TRUTH.md` for the full before-state classification.

In the course of wiring the pipeline end-to-end for the first time, found and fixed a
real, silent defect: the commerce-core SDK's identity resolver was wired to a
`TEST-ONLY` adapter that never checked the real catalog, so identity-based duplicate
detection never worked. See `PRIMEOPP_SECURITY_REPORT.md` for details and proof of the
fix.

## What changed

### New package: `modules/commerce-core/packages/pipeline` (`@primeopp/pipeline`)

- `src/orchestrator.ts` — `ingestProduct()`, the end-to-end orchestrator. Calls real
  instances of `ProductIntakeService` (from `primeopp-product-intake`),
  `ProductEnrichmentService` (from `primeopp-product-enrichment`), `ProductIdentityResolver`
  and `createCanonicalProductFromResolutionResult` (from `@primeopp/product-identity` /
  `@primeopp/canonical-catalog`) — using each stage's own already-built, already-tested
  handoff adapter (`toEnrichmentInput`, `buildResolutionInputFromEnrichedProfile`). No
  stage's business logic is reimplemented.
- `src/storage/file-catalog-storage.ts` — `FileCatalogStorage`, a `CatalogStorageAdapter`
  backed by an atomically-written JSON file, so canonical products survive across CLI
  invocations (the shipped `InMemoryCatalogStorage` does not).
- `src/storage/file-intake-store.ts` — `FileIntakeStore`, a file-backed
  `IntakeDeduplicationStore` + `IntakeRecordRepository`, same rationale.
- `src/storage/json-file.ts` — shared atomic read/write helper (temp file + rename;
  throws loudly on corrupt JSON rather than silently discarding).
- `src/identity/catalog-backed-adapter.ts` — `CatalogBackedIdentityAdapter`, replacing
  the disconnected `LocalTestProductIdentityAdapter` for this workflow: queries the real,
  persisted catalog for barcode-exact and title/brand/model matches.
- `src/enrichment-providers.ts` — `createLocalEnrichmentProviders()`: `ManualInputProvider`
  + `FixtureProductProvider` seeded with a small local demo fixture set. Deliberately
  excludes `GenericHttpProductProvider` (real network) — no paid provider, no production
  API calls, per mission constraint.
- `tests/pipeline.test.ts` — 12 tests (success, failure, empty, invalid, duplicate at
  both intake and catalog level, audit log, intake repo, file persistence across separate
  instances).

### Edited: `modules/commerce-core/packages/cli`

- `package.json` — added `@primeopp/pipeline` and `@primeopp/canonical-catalog`
  dependencies.
- `src/index.ts` — added `catalog ingest <file>` and `catalog list` commands, and a
  `--data-dir` global flag (default `.primeopp-data` under cwd). Distinct exit codes per
  outcome (0 = created, 1 = any other legitimate outcome, 2 = bad input file, matching
  the file's existing convention).

### Built (not previously built), for the first time this session

- `modules/product-intake/primeopp-product-intake` — `npm install && npm run build`.
  Their `package-lock.json` was already committed and matched exactly (no diff) — the
  install/build step had simply never been run before. Baseline test suite: 134/134
  passing, unmodified.
- `modules/product-enrichment/primeopp-product-enrichment` — same; already had
  `node_modules` for its own tests, but not a `dist/` build. Baseline test suite:
  136/136 passing, unmodified.

### `.gitignore`

Added `**/.primeopp-data/` — the CLI's default persisted-data directory is operator-local
runtime state, not source.

## Files touched (staged for commit)

```
.gitignore
modules/commerce-core/package-lock.json                                  (necessary consequence of new deps)
modules/commerce-core/packages/cli/package.json
modules/commerce-core/packages/cli/src/index.ts
modules/commerce-core/packages/pipeline/package.json                     (new)
modules/commerce-core/packages/pipeline/tsconfig.json                    (new)
modules/commerce-core/packages/pipeline/src/index.ts                     (new)
modules/commerce-core/packages/pipeline/src/orchestrator.ts              (new)
modules/commerce-core/packages/pipeline/src/enrichment-providers.ts      (new)
modules/commerce-core/packages/pipeline/src/identity/catalog-backed-adapter.ts (new)
modules/commerce-core/packages/pipeline/src/storage/json-file.ts         (new)
modules/commerce-core/packages/pipeline/src/storage/file-catalog-storage.ts (new)
modules/commerce-core/packages/pipeline/src/storage/file-intake-store.ts (new)
modules/commerce-core/packages/pipeline/tests/pipeline.test.ts           (new)
PRIMEOPP_CURRENT_TRUTH.md                                                 (new)
PRIMEOPP_REVENUE_WORKFLOW_SELECTION.md                                    (new)
PRIMEOPP_RUNTIME_PROOF.md                                                 (new)
PRIMEOPP_TEST_REPORT.md                                                   (new)
PRIMEOPP_SECURITY_REPORT.md                                               (new)
PRIMEOPP_IMPLEMENTATION_REPORT.md                                         (new, this file)
PRIMEOPP_NEXT_SESSION_HANDOFF.md                                          (new)
```

**Deliberately NOT staged:** `modules/commerce-core/evidence/*` (regenerated,
timestamped output from running the pre-existing `npm run verify` script during gate
checks — not source, left as local working-tree state; rerun `npm run verify` to
regenerate).

## Exact commands run, and their results

```
# Build the two donor modules for the first time
cd modules/product-intake/primeopp-product-intake && npm install && npm run build
  → exit 0. npm test → 134/134 passing.
cd modules/product-enrichment/primeopp-product-enrichment
  → node ./node_modules/typescript/bin/tsc -p tsconfig.json → exit 0.
  → TS_NODE_PROJECT=tsconfig.test.json node --require ts-node/register tests/run-all.ts → 136/136 passing.

# Install the new pipeline package's dependencies into commerce-core's workspace
cd modules/commerce-core && npm install → exit 0, 0 vulnerabilities.

# Gates
npx tsc --noEmit -p packages/pipeline/tsconfig.json  → exit 0 (clean)
node --test "packages/pipeline/tests/**/*.test.ts"   → 12/12 passing
node --test "packages/*/tests/**/*.test.ts"          → 269/269 passing (full suite)
node scripts/typecheck-all.ts                        → 25/25 packages clean
node scripts/lint.ts                                 → no issues
node scripts/verify.ts                                → 24/24 proofs passed

# Root workspace (unaffected sanity check)
pnpm run typecheck  → pass (4 workspace projects)
pnpm run build      → typecheck passes; recursive build fails at artifacts/mockup-sandbox
                       (pre-existing, unrelated: requires a PORT env var). Not fixed —
                       out of scope. See PRIMEOPP_TEST_REPORT.md.

# Runtime proof — see PRIMEOPP_RUNTIME_PROOF.md for full transcript
node packages/cli/src/index.ts catalog ingest <file> --data-dir <dir> --tenant demo-tenant
node packages/cli/src/index.ts catalog list --data-dir <dir> --tenant demo-tenant
```

## Remaining blockers / known gaps (not fixed, out of scope for this pass)

1. `artifacts/mockup-sandbox`'s build hard-requires a `PORT` env var even for a
   production build — pre-existing, unrelated to this workflow.
2. `primeopp-product-enrichment`'s own `npm test` script is not Windows-`cmd.exe`-safe
   (Unix inline env-var syntax) — pre-existing, cosmetic, does not block anything (the
   underlying test command runs fine directly).
3. The `catalog ingest` CLI command's default enrichment sources are intentionally
   local-only (manual entry + a small demo fixture list of 2 items) to satisfy the "no
   paid provider, no production API calls" constraint. A real deployment would register
   a real product-data provider (e.g. a licensed barcode/UPC database) via
   `IngestProductOptions.enrichmentProviders` — the orchestrator already accepts this as
   an override; only the CLI's *default* is local-only.
4. `ProductIdentityResolver.detectState()` (pre-existing, in `@primeopp/product-identity`,
   not touched) has a documented fallthrough where a low-confidence text match is
   mislabeled `NO_MATCH` despite carrying real candidates. The orchestrator defends
   against this (checks `candidates.length`/`selectedCandidateId` regardless of the state
   label — see `PRIMEOPP_SECURITY_REPORT.md`), but the resolver itself was not modified,
   since fixing its core state-detection logic was out of scope and risked destabilizing
   already-passing, already-relied-upon behavior elsewhere.
5. Canonical products created by this pipeline are not yet exposed anywhere downstream
   (no storefront listing, no marketplace publish) — that remains the next logical
   workflow to complete. See `PRIMEOPP_NEXT_SESSION_HANDOFF.md`.
