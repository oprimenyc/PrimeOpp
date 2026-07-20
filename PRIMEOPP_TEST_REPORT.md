# PrimeOpp Test Report

## New tests (this session)

`modules/commerce-core/packages/pipeline/tests/pipeline.test.ts` — 12 tests, **12/12 passing**.

Command: `node --test "packages/pipeline/tests/**/*.test.ts"` (from `modules/commerce-core`)

Coverage:
- Empty/zero state (fresh catalog has no products)
- Success path — manual product entry
- Success path — recognized barcode via local fixture provider
- Failure path — insufficient manual data (rejected at intake, before enrichment ever runs)
- Failure path — checksum-invalid identifier with no manual data (no eligible enrichment provider)
- Failure path — valid but unrecognized barcode (enrichment resolves to NOT_FOUND)
- Duplicate/idempotency — same identifier resubmitted, caught at intake stage
- Duplicate/idempotency — **fresh intake session against the same persisted catalog, caught by identity resolution** (this is the regression test for the SDK identity-adapter defect found and fixed this session)
- Audit log records canonical product creation when supplied
- Intake record repository persists the intake record when supplied
- File-backed storage persists real state across separate instances pointed at the same path (simulates separate CLI invocations)
- File-backed catalog storage starts empty when no file exists yet (fresh install)

## Full commerce-core suite (new + pre-existing)

Command: `node --test "packages/*/tests/**/*.test.ts"` (from `modules/commerce-core`)

**269/269 passing** (257 pre-existing baseline + 12 new). Zero regressions.

## Baseline suites confirmed this session (untouched by this session's changes)

These modules were built for the first time this session (never had `node_modules`/`dist`
before) so their own test suites could run at all, but no source files in them were
modified.

- `modules/product-intake/primeopp-product-intake`: `npm test` (Jest) — **134/134 passing**.
- `modules/product-enrichment/primeopp-product-enrichment`: its own test runner
  (`TS_NODE_PROJECT=tsconfig.test.json node --require ts-node/register tests/run-all.ts`)
  — **136/136 passing**. Note: the module's own `npm test` script fails under Windows
  `cmd.exe` because it uses Unix-style inline env-var assignment
  (`TS_NODE_PROJECT=... node ...`), which is not valid `cmd.exe` syntax. This is a
  pre-existing, cross-platform script bug, unrelated to this session's work, not touched.
  Running the identical command via a POSIX-compatible shell works and is what was used
  to obtain the 136/136 result above.

## Typecheck

- `modules/commerce-core`: `node scripts/typecheck-all.ts` — **25/25 packages typechecked
  cleanly**, including the new `pipeline` package and the edited `cli` package.
- Root workspace: `pnpm run typecheck` — **passes** (4 workspace projects: `scripts`,
  `artifacts/api-server`, `artifacts/primeopp`, `artifacts/mockup-sandbox`). Unaffected by
  this session's changes (`modules/*` is not part of the pnpm workspace).

## Lint

- `modules/commerce-core`: `node scripts/lint.ts` — **no lint issues found** (scans all of
  `packages/`, including the new `pipeline` package, for forbidden patterns: swallowed
  `|| true`, TODO/FIXME, placeholder/not-implemented comments, empty catch blocks).

## Build

- `modules/commerce-core`: `build` = `typecheck` (no separate bundling step for this
  package's own packages) — **pass**, see typecheck above.
- Root workspace: `pnpm run build` = `typecheck` + recursive `build` across `artifacts/**`.
  Typecheck portion **passes**. The recursive build portion **fails at
  `artifacts/mockup-sandbox`** with `Error: PORT environment variable is required but was
  not provided` — a pre-existing, unrelated gap (a Vite dev-sandbox package that hard-requires
  a `PORT` env var even for a production build) with zero connection to this session's
  work. Not touched, not fixed — out of scope for the selected revenue workflow. Because
  pnpm's recursive runner stops at the first failure, `artifacts/api-server` and
  `artifacts/primeopp`'s own `build` scripts were not reached in this run, but both
  already passed their `typecheck` step above, and neither was modified this session.

## commerce-core's own 24-point verify suite

Command: `node scripts/verify.ts` (from `modules/commerce-core`) — **24/24 proofs passed**,
including proof [06] "package-export validation — 25/25 packages export from
`src/index.ts`", which automatically picked up and validated the new `pipeline` package.

## Pre-existing failures observed and separated (not introduced this session)

1. `artifacts/mockup-sandbox` build requires a `PORT` env var — see "Build" above.
2. `primeopp-product-enrichment`'s own `npm test` script uses Unix env-var syntax,
   incompatible with Windows `cmd.exe` — see "Baseline suites" above.

Neither blocks the selected revenue workflow, which was tested and proven independently
of both.
