# PrimeOpp Current Truth

Date: 2026-07-20
Repo: `C:\Users\jp718\Documents\GitHub\PrimeOpp`
Branch: `integration/full-primeopp-platform`
Starting HEAD: `1cfde1835746c8cfd2324ad10f2704ecdee53710`
Working tree at session start: clean

## Repo shape

pnpm monorepo. `pnpm-workspace.yaml` only includes `artifacts/*`, `lib/*`, `lib/integrations/*`, `scripts`.
**`modules/*` is NOT part of the pnpm workspace** — each module directory is its own
independent npm (or npm-workspace) project with its own `package.json`, install, build,
and test tooling. This is deliberate: `PRIMEOPP_RECOVERY_MANIFEST.md` describes `modules/*`
as donor code "isolated for audit, normalization, integration, testing, and eventual
consolidation," while `artifacts/api-server` + `artifacts/primeopp` are "the recovered
product foundation."

## Classification by area

| Area | Classification | Evidence |
|---|---|---|
| `artifacts/api-server` + `artifacts/primeopp` (legacy ecommerce: Stripe checkout, fulfillment queue, reviews, discounts, loyalty, admin dashboard) | **REAL** | Full Express + React app, Postgres-backed, Stripe Checkout wired end-to-end. Requires live Stripe keys to boot (`validateEnv` hard-requires `STRIPE_SECRET_KEY`). `AUDIT.md`/`AUDIT_PHASE2.md` score it 36-63/100 across dimensions — real but with known gaps (no migration runner for its own raw-SQL schema, zero test files). |
| `modules/product-intake` (`primeopp-product-intake`) | **PARTIAL → now wired** | Real source + 134 passing Jest tests. Never `npm install`'d or built before this session (no `node_modules`, no `dist/`). In-memory-only storage; explicitly self-declared in `module.manifest.json` as having a "simulated database" and unsatisfied `integrationDependencies` (real DB, host framework). |
| `modules/product-enrichment` (`primeopp-product-enrichment`) | **PARTIAL → now wired** | Real source + 136 passing tests (`node --require ts-node/register`). Never built to `dist/` before this session. Ships a documented `intake-handoff.ts` adapter for consuming `product-intake` output via a structural mirror (no cross-import), added in commit `bd44218`. |
| `modules/commerce-core/packages/product-identity` | **PARTIAL** | Deterministic identity resolver, real tests. `buildResolutionInputFromEnrichedProfile()` (added in `36a6a02`) is the enrichment→identity handoff adapter, again a structural mirror with no cross-import. |
| `modules/commerce-core/packages/canonical-catalog` | **PARTIAL** | `createCanonicalProductFromResolutionResult()` (added in `0248e37`/`1cfde18`) safely refuses to create a duplicate canonical product. Only shipped storage was `InMemoryCatalogStorage` — a JS `Map`, wiped every process exit. |
| `modules/commerce-core/packages/sdk` | **PARTIAL, with a real defect found this session** | `PrimeOppSdk` wires `ProductIdentityResolver` + `CanonicalCatalog` together already, but its only identity adapter is `LocalTestProductIdentityAdapter` (explicitly marked TEST-ONLY in its own source), constructed empty and never populated from the SDK's own `catalogStorage`. **Net effect: `sdk.resolveProductIdentity()` always returns `NO_MATCH` regardless of what is already in the catalog — identity-based deduplication was non-functional.** |
| End-to-end reachability of intake → enrichment → identity → catalog | **ABSENT before this session** | No HTTP route, CLI command, or script anywhere in the repo invoked all four stages together. Each stage's adapter function existed and was unit-tested in isolation with hand-built fixtures, but nothing ever ran real `ProductIntakeService` → real `ProductEnrichmentService` → real `ProductIdentityResolver` → real `CanonicalCatalog.create` in one process. |
| `modules/deal-intelligence` (opportunity/deal scoring) | **STUB** | 30 packages, real code, `node_modules` never installed, no DB, no server, disconnected from everything else. |
| `modules/marketplace-platform` (channel listing/publish) | **STUB** | Real code + tests, standalone npm workspace, no wiring to `commerce-core`'s canonical products or the real storefront. |
| `modules/affiliate-backlink-engine` | **PARTIAL** | Working CLI + vitest suite, no persistence beyond fixtures, standalone. |
| Lead capture | **ABSENT** | No code anywhere. |
| Billing/subscription gate | **ABSENT** | No code anywhere. |
| `lib/db` (`@workspace/db`, Drizzle) | **STUB** | Schema is a literal `export {}` placeholder. Real app schema lives only as raw, unrun `.sql` migration files. |

## Build/test tooling as configured

- Root: `pnpm run build` (typecheck + recursive build), `pnpm run typecheck` (`tsc --build` for `lib/*` then `artifacts/**`/`scripts`). No root `test` or `lint` script. Enforces pnpm via `preinstall`.
- `modules/commerce-core`: its own npm workspace (`packages/*`), Node ≥22, ESM, TypeScript executed directly by Node (no build step for its own packages — `"main": "./src/index.ts"`, run via type-stripping). `npm run typecheck` auto-discovers every `packages/*/tsconfig.json`; `npm test` runs `node --test "packages/*/tests/**/*.test.ts"`. **Baseline confirmed passing this session: 257/257 tests.**
- `modules/product-intake/primeopp-product-intake`: `npm run build` (tsc → CommonJS `dist/`), `npm test` (Jest). **Built and baseline-tested this session: 134/134 passing.**
- `modules/product-enrichment/primeopp-product-enrichment`: `npm run build` (tsc → CommonJS `dist/`), custom ts-node test runner. **Built and baseline-tested this session: 136/136 passing** (note: its own `npm test` script uses Unix env-var syntax and fails under Windows `cmd.exe`; running the same command directly works — pre-existing cross-platform script issue, not touched this session).

## No occupied repos read or modified

VERIDIAN, fylr, dyln, NOCTUS, AMOS, Foundry, PrimeOS were not modified. `PrimeOS/CONSTITUTION.md` and `PrimeOS/LESSONS.md` were read only, per standing global instructions.
