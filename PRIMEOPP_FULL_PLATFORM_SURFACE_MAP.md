# PrimeOpp Full Platform Surface Map

Owner correction acknowledged: the live Railway deployment at
`https://primeopp-production-a554.up.railway.app` is **one surface**
(the ecommerce storefront + its API server), not the whole repo. This
document inventories everything else.

Repo root: `C:\Users\jp718\Documents\GitHub\PrimeOpp`. The pnpm workspace
(`pnpm-workspace.yaml`) only includes `artifacts/*`, `lib/*`, `scripts` —
everything under `modules/*` is **outside the pnpm workspace**, each with
its own separate npm ecosystem (own lockfile-less `node_modules`, own test
runner, own build). That split is itself a key finding: the repo is really
two things glued together — (1) a deployable pnpm monorepo app, and (2) a
collection of standalone commerce-intelligence libraries/CLIs that nothing
in (1) currently imports.

---

## 1. `artifacts/primeopp` — Customer + Admin Storefront (React SPA)

- **Role**: The customer-facing storefront and the admin dashboard UI, both in one SPA.
- **Framework/runtime**: Vite + React 19 + Wouter (routing) + TanStack Query.
- **Package manager**: pnpm (workspace member).
- **Build**: `vite build --config vite.config.ts` → `dist/public`.
- **Start**: served as static files by `artifacts/api-server` (no standalone server of its own).
- **Health route**: N/A (static assets; health lives on the API server).
- **Required env vars**: none at build/runtime for the SPA itself (it calls the API server via same-origin `/api/*`).
- **Pages found**: `home`, `catalog`, `product`, `cart`, `order-success`, `customer` (account/loyalty lookup), `static-pages`, `privacy`, `terms`, `not-found`, and **admin**: `admin`, `admin-login`, `admin-dashboard`, `admin-orders`.
- **Current status**: **LIVE** — this is exactly what's deployed and smoke-tested at the current Railway URL.
- **Deployability**: `DEPLOYABLE_NOW` (already deployed).
- **Relation to live deploy**: this IS the live deploy's frontend half.

## 2. `artifacts/api-server` — Express API

- **Role**: REST API for the storefront + admin (auth, orders, products, checkout, revenue, contact, admin dashboard/audit).
- **Framework/runtime**: Node 22, Express 5.
- **Package manager**: pnpm (workspace member).
- **Build**: `tsx ./build.ts` → `dist/index.cjs`.
- **Start**: `node ./dist/index.cjs`.
- **Health route**: `GET /api/healthz`.
- **Required env vars (names only)**: `DATABASE_URL`, `SESSION_SECRET`, `ADMIN_EMAIL`, `ADMIN_PASSWORD`, `PORT`; optional `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `ALLOWED_ORIGINS`, `RESEND_API_KEY`, `FROM_EMAIL`, `PRINTFUL_API_KEY`, `TAPSTITCH_API_KEY`, `NODE_ENV`.
- **Current status**: **LIVE**.
- **Deployability**: `DEPLOYABLE_NOW` (already deployed; Stripe/email/POD-provider vars optional, routes fail closed without them).
- **Relation to live deploy**: this IS the live deploy's backend half.

## 3. `lib/db` — Shared Database Package

- **Role**: Drizzle-orm schema + raw-SQL migration runner (`scripts/migrate.mjs`), consumed by `api-server`.
- **Framework/runtime**: Node, `pg`, drizzle-orm.
- **Package manager**: pnpm (workspace member).
- **Build**: none needed for runtime use (consumed as TS source via workspace link); has its own `push`/`push-force`/`migrate` scripts.
- **Start**: N/A — library, not a service.
- **Health route**: N/A.
- **Required env vars**: `DATABASE_URL` (for the migration runner specifically).
- **Current status**: **LIVE** (as a dependency of the live api-server; migrations already applied to the live Postgres).
- **Deployability**: N/A — not independently deployable, it's a library.
- **Relation to live deploy**: schema source of truth for the live deploy's database.

## 4. `lib/api-zod`, `lib/api-client-react`, `lib/api-spec` — Shared API Contract Libraries

- **Role**: `api-zod` = shared Zod schemas; `api-client-react` = TanStack-Query React hooks wrapping the API; `api-spec` = Orval codegen config (generates a client from an OpenAPI spec — no committed generated output found beyond what's hand-written).
- **Framework/runtime**: TypeScript libraries, no runtime of their own.
- **Package manager**: pnpm (workspace members).
- **Build/start/health**: N/A — libraries only, consumed by `artifacts/primeopp` and `artifacts/api-server`.
- **Current status**: **LIVE** (as dependencies of the live deploy).
- **Deployability**: N/A.

## 5. `artifacts/mockup-sandbox` — Replit UI Mockup Preview Tool

- **Role**: A Vite app for previewing generated UI component mockups (`src/.generated/mockup-components.ts`, a custom `mockupPreviewPlugin`). Not a product surface — it's a design/prototyping tool, likely left over from Replit-based UI generation workflow.
- **Framework/runtime**: Vite + React, same UI-kit dependency set as `primeopp` (Radix, Tailwind) but no app pages of its own beyond `App.tsx`/`main.tsx`.
- **Package manager**: pnpm (workspace member).
- **Build**: `vite build` — **currently fails locally** because `vite.config.ts` unconditionally requires `PORT` and `BASE_PATH` env vars (a hard requirement inherited from its Replit dev-server assumptions), neither of which is set in this shell.
- **Start**: `vite preview`.
- **Health route**: none.
- **Required env vars**: `PORT`, `BASE_PATH` (both required just to load the Vite config, even for a build).
- **Current status**: **DEMO_ONLY** (mockup/prototyping tool, not customer- or admin-facing product surface).
- **Deployability**: `NOT_DEPLOYABLE` as a product surface — it isn't one. Could be made buildable by setting `PORT`/`BASE_PATH`, but there is no product reason to deploy it.
- **Relation to live deploy**: none — fully decoupled, not imported by or linked to the live app.

## 6. `modules/commerce-core` — Commerce Intelligence Library (standalone npm project)

- **Role**: "Channel-neutral, business-model-neutral commerce foundation" — product identity, inventory, pricing, profitability, canonical catalog, listing generation. 25 sub-packages (`packages/*`): `product-identity`, `canonical-catalog`, `pricing`, `profit-engine`, `fee-engine`, `inventory`, `condition-engine`, `variant-engine`, `opportunity-engine`, `shipping-estimator`, `barcode`, `evidence`, `pipeline`, `cli`, contracts/SDK packages, etc.
- **Framework/runtime**: Node ≥22, plain TypeScript, npm workspaces (own `packages/*`, not pnpm).
- **Package manager**: npm (**not** part of the root pnpm workspace).
- **Build**: `npm run typecheck` (its `build` script is literally an alias for typecheck — no bundling step).
- **Start**: `packages/cli` exposes `demo` and `doctor` CLI commands (`node packages/cli/src/index.ts demo|doctor`) — CLI only, no server/listener.
- **Health route**: none (not a service).
- **Required env vars**: none discovered at this level (provider-neutral by design — actual provider keys would live in adapters, none of which are wired to real providers here).
- **Current status**: **CLI_ONLY** — has its own recent commit history in this repo (canonical catalog creation, product identity resolution, enrichment wiring — see git log entries like "Create canonical products from identity resolution", "Wire product enrichment output into canonical product identity"), so it's actively developed, but it is **not imported anywhere by `artifacts/api-server` or `artifacts/primeopp`** (verified: no references found). It has its own `evidence/` directory with `PACKAGE_RESULTS.json`/`TEST_RESULTS.json`/`RUNTIME_VERIFICATION.md` (the files that showed as locally modified at session start, from a prior unrelated evidence-generation run).
- **Deployability**: `NOT_DEPLOYABLE` as a web service (it isn't one — it's a library/CLI). Its `demo`/`doctor` CLI commands are runnable locally; not something to put a Railway URL on.
- **Relation to live deploy**: **none currently** — fully disconnected. This is the clearest candidate for "the rest of PrimeOpp" the owner means, but it is pipeline/backend tooling, not a UI.

## 7. `modules/marketplace-platform` — Marketplace & Cross-Listing Library (standalone npm project)

- **Role**: Cross-listing/marketplace platform — listing publishing/sync, offers, negotiation, disputes, returns, commission engine, order engine, trust & safety, SEO, messaging. 32 sub-packages. References `amos-contracts` (ties to the separate `AMOS` Railway project in this account) — this module looks like shared ecosystem infrastructure, not PrimeOpp-exclusive.
- **Framework/runtime**: Node ≥18, plain TypeScript, npm workspaces.
- **Package manager**: npm (not part of root pnpm workspace).
- **Build**: `tsc -b tsconfig.build.json`.
- **Start**: no server entry point found — library/contracts only, no CLI even.
- **Health route**: none.
- **Required env vars**: none discovered.
- **Current status**: **CLI_ONLY** (really: library-only — even more so than commerce-core, no runnable CLI found in package.json scripts beyond build/test/lint/verify).
- **Deployability**: `NOT_DEPLOYABLE` — no service to deploy.
- **Relation to live deploy**: none.

## 8. `modules/deal-intelligence` — Deal/Price Intelligence Library (standalone npm project)

- **Role**: Deal scoring, historical pricing, restock/rarity/coupon engines, source ingestion, community submissions. 29 sub-packages. References `amos-contracts` and `browser-contracts`/`crawler-contracts` — again reads as shared ecosystem infrastructure.
- **Framework/runtime**: Node ≥18, TypeScript, npm workspaces, **vitest** for tests (only module of the three big platform libraries with a real test runner already wired: `vitest.config.ts` present, `test` script works).
- **Package manager**: npm.
- **Build**: `npm run build --workspaces --if-present`.
- **Start**: no service entry point found.
- **Health route**: none.
- **Required env vars**: none discovered.
- **Current status**: **CLI_ONLY** / library-only.
- **Deployability**: `NOT_DEPLOYABLE` — no service to deploy.
- **Relation to live deploy**: none.

## 9. `modules/affiliate-backlink-engine/affiliate-backlink-engine` — Backlink/SEO CLI Tool

- **Role**: "Provider-agnostic backlink intelligence and campaign-planning engine for SEO authority growth." Ships a real CLI (`bin: backlink-engine`) plus example workflows — notably `example:panticandy` and `example:vital`, meaning **this tool already serves other products in the ecosystem (PantiCandy, presumably "Vital"), not just PrimeOpp** — it lives in this repo but isn't PrimeOpp-exclusive.
- **Framework/runtime**: Node ≥18, TypeScript, vitest.
- **Package manager**: npm (standalone, own `tsx`/`vitest`/`typescript` devDependencies).
- **Build**: `tsc -p tsconfig.json`.
- **Start**: `tsx src/cli/index.ts` (CLI) or the built `bin/backlink-engine`.
- **Health route**: none — CLI tool, no server.
- **Required env vars**: none discovered at this level (provider keys would be adapter-specific, none configured here).
- **Current status**: **CLI_ONLY**.
- **Deployability**: `NOT_DEPLOYABLE` as a web service — it's correctly a CLI/library, nothing to "deploy" beyond publishing the package or running it as a scheduled job somewhere.
- **Relation to live deploy**: none.

## 10. `modules/product-enrichment/primeopp-product-enrichment` — Product Enrichment Library

- **Role**: "Provider-neutral product enrichment module... accepts normalized intake records and produces an evidence-backed, conflict-aware enriched product profile." Feeds `commerce-core`'s canonical catalog (per recent commit history: "Wire product enrichment output into canonical product identity").
- **Framework/runtime**: Node ≥18, TypeScript (CommonJS output).
- **Package manager**: npm (standalone).
- **Build**: `tsc -p tsconfig.json`.
- **Start**: N/A — library only (`main`/`types` exports), plus a set of `example:*` scripts (barcode, ISBN, brand/model, manual, multi-provider merge, conflict detection, cache, downstream handoff) runnable via `ts-node`.
- **Health route**: none.
- **Required env vars**: none discovered (provider-neutral by design; no live provider keys configured).
- **Current status**: **CLI_ONLY** / library-only, actively wired into `commerce-core` (per git history) but not into the live customer/admin app.
- **Deployability**: `NOT_DEPLOYABLE` as a web service.
- **Relation to live deploy**: none directly; one step upstream of `commerce-core`, which is itself disconnected from the live deploy.

## 11. `modules/product-intake/primeopp-product-intake` — Product Intake Normalization Library

- **Role**: "Normalize and validate product intake from barcode scans, identifiers, manual entry, and batch input." Upstream of product-enrichment.
- **Framework/runtime**: Node ≥18, TypeScript, Jest for tests.
- **Package manager**: npm (standalone).
- **Build**: `tsc`.
- **Start**: N/A — library only.
- **Health route**: none.
- **Required env vars**: none discovered.
- **Current status**: **CLI_ONLY** / library-only.
- **Deployability**: `NOT_DEPLOYABLE` as a web service.
- **Relation to live deploy**: none; upstream of product-enrichment → commerce-core, none of which reach the live app.

## 12. `scripts` — Workspace Dev Scripts

- **Role**: Trivial pnpm-workspace-member package with one `hello` script and a `typecheck` script. No real functionality found.
- **Framework/runtime**: tsx.
- **Package manager**: pnpm (workspace member).
- **Current status**: **STALE** (a placeholder — nothing else references it).
- **Deployability**: `NOT_DEPLOYABLE` — not a service.
- **Relation to live deploy**: none.

## 13. `_source-archives`, `attached_assets`, `.agents` — Non-Code / Misc

- `_source-archives`: empty directory. **STALE**.
- `attached_assets`: one pasted text file (`Pasted--Phase-2-Audit-Operations-Enterprise-Admin-Review-Perfo_1782343776952.txt`) — looks like a copy-pasted audit note, not code. **STALE**.
- `.agents`, `.claude`: tooling config directories (this assistant's own config), not product surfaces.

---

## Summary Table

| Surface | Path | Status | Deployability |
|---|---|---|---|
| Customer/Admin storefront (frontend) | `artifacts/primeopp` | LIVE | DEPLOYABLE_NOW (done) |
| API server | `artifacts/api-server` | LIVE | DEPLOYABLE_NOW (done) |
| DB schema/migrations | `lib/db` | LIVE (as dependency) | N/A (library) |
| Shared API contract libs | `lib/api-zod`, `lib/api-client-react`, `lib/api-spec` | LIVE (as dependency) | N/A (library) |
| Mockup/design preview tool | `artifacts/mockup-sandbox` | DEMO_ONLY | NOT_DEPLOYABLE |
| Commerce intelligence platform | `modules/commerce-core` | CLI_ONLY, disconnected | NOT_DEPLOYABLE (no service) |
| Marketplace/cross-listing platform | `modules/marketplace-platform` | CLI_ONLY (library-only), disconnected | NOT_DEPLOYABLE (no service) |
| Deal/price intelligence platform | `modules/deal-intelligence` | CLI_ONLY, disconnected | NOT_DEPLOYABLE (no service) |
| Backlink/SEO CLI (shared across products) | `modules/affiliate-backlink-engine` | CLI_ONLY | NOT_DEPLOYABLE (no service) |
| Product enrichment library | `modules/product-enrichment` | CLI_ONLY, disconnected | NOT_DEPLOYABLE (no service) |
| Product intake library | `modules/product-intake` | CLI_ONLY, disconnected | NOT_DEPLOYABLE (no service) |
| Dev scripts placeholder | `scripts` | STALE | NOT_DEPLOYABLE |

**No separate admin/operator web dashboard exists outside `artifacts/primeopp`'s own `/admin*` pages.** No separate customer-facing non-ecommerce UI exists. The "rest of PrimeOpp" is backend commerce-intelligence tooling (CLI/library), not a set of unbuilt websites.
