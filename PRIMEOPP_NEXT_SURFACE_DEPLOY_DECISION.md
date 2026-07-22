# PrimeOpp — Next Surface Deploy Decision

## What Is "The Rest of PrimeOpp"?

Working through the owner's stated decision order:

1. **Existing owner-facing/admin/operator UI** — already covered. `artifacts/primeopp`'s `/admin*` pages + the admin API are already live. There is no second, separate admin/operator UI hiding elsewhere in the repo.
2. **Customer-facing non-ecommerce surface** — none exists. No second customer-facing app was found.
3. **Platform/intelligence surface** — **this is the answer.** `modules/commerce-core` (product identity/pricing/inventory/profitability/canonical catalog), `modules/product-intake` (barcode/identifier normalization), and `modules/product-enrichment` (evidence-backed enrichment) form a real, tested, working pipeline that is currently 100% disconnected from the live storefront. This is "the rest of PrimeOpp" in the sense that matters: real product-intelligence logic with real test coverage, sitting unused.
4. **`mockup-sandbox`** — correctly skipped. It's a Replit-era mockup preview tool, not intended as product UI (confirmed by inspecting its actual contents — no app pages, just a mockup-component preview harness).
5. **Worker/CLI** — since the platform/intelligence surface (item 3) has no UI and was never meant to have one (it's provider-neutral backend logic), the right shape for making it live is a **worker/CLI process**, not a new website.

`modules/marketplace-platform` and `modules/deal-intelligence` are one tier further out — they're larger, more speculative platform libraries (cross-listing, negotiation, deal scoring) with `amos-contracts` references suggesting they're shared ecosystem infrastructure beyond just PrimeOpp, and (per the validation matrix) `marketplace-platform` has zero tests written yet. They are not the next deploy target — they're future work once the closer, already-tested `product-intake → product-enrichment → commerce-core` chain is proven live.

## Which Surface Should Be Made Live Next

**The `product-intake → product-enrichment → commerce-core` pipeline**, specifically the path that takes a barcode/identifier or manual product entry, normalizes it (`product-intake`), enriches it with evidence-backed data (`product-enrichment`), and produces a canonical product record (`commerce-core`'s `canonical-catalog`/`product-identity` packages) — the exact chain the recent commit history (`Wire product enrichment output into canonical product identity`, `Create canonical products from identity resolution`) already built and unit-tested.

## Why

- It's the closest of the three intelligence modules to being usable today: `product-intake` and `product-enrichment` both typecheck, build, and pass their full test suites (134/134 and clean, respectively) on this machine, and `commerce-core` passes all 269 of its own tests.
- It directly serves the live product: making this live means the admin can add a barcode/identifier and get a real enriched, priced product record instead of hand-typing every field into the existing bare product-CRUD admin form.
- `marketplace-platform` and `deal-intelligence` are further from ecommerce-relevant value for PrimeOpp specifically (cross-listing to other marketplaces, deal-scoring external listings) and have weaker test coverage (`marketplace-platform` has 0 tests).

## Exact Blocker

**Schema mismatch.** The live Postgres `products` table (`lib/db/migrations/0001_base_schema.sql`) is a simple flat table (`id, type, title, price, colors, sizes, pod_provider, ...`) built for the storefront's own admin CRUD. `commerce-core`'s canonical-catalog data model is a richer, provider-neutral schema (identity, evidence, condition, variants, pricing breakdown) that doesn't map 1:1 onto that table. Before this pipeline can write real data into the live storefront, someone has to decide and build the adapter between "canonical product" (commerce-core's shape) and "storefront product row" (the live `products` table's shape) — that mapping doesn't exist yet in either codebase.

## Exact Next Mission Prompt

> "Design and build a one-way adapter that takes a `commerce-core` canonical product (output of `product-intake` → `product-enrichment` → `commerce-core`'s `product-identity`/`canonical-catalog` packages) and writes it into the live PrimeOpp Postgres `products` table via a new admin-triggered endpoint or worker script — starting in dry-run mode (log the mapped row, don't write) before enabling real writes, and only for a single test product before running it at scale."

## Same Service or New Railway Service?

**New Railway service**, in the same `primeopp` project, not an expansion of the existing `primeopp` web service. Reasoning:
- The existing `primeopp` service is shaped for HTTP request/response (Express + SPA). The intelligence pipeline is batch/CLI-shaped (`commerce-core`'s own `packages/cli` already exposes `demo`/`doctor` as one-shot commands, not a listener).
- Mixing a long-running HTTP server with an on-demand/scheduled batch job in one process risks resource contention and unclear health-check semantics (Railway's healthcheck expects an HTTP server; a worker doesn't need one).
- A second service in the same project can still reach the same Postgres via an internal `DATABASE_URL` reference (exactly like `primeopp` → `Postgres` today), so no new database is needed — just a new deploy target for the worker/CLI code.

**Decision: `NEW_RAILWAY_SERVICE`** — e.g. `primeopp-catalog-worker`, triggered on-demand (via Railway's CLI/dashboard "run" or a cron schedule) rather than an always-on process, since the pipeline is a batch job, not a server.
