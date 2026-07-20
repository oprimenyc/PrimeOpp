# Revenue Workflow Selection

## Selected workflow

**Canonical Product Catalog Ingestion** — the product-intake → product-enrichment →
identity-resolution → canonical-catalog pipeline, completed as a real, persisted,
operator-usable command (`primeopp catalog ingest`), replacing its previous
zero-reachability, in-memory-only state.

## Why it matters

You cannot sell what is not in your catalog. Of the candidate areas in scope, this is
the only one that is simultaneously:

1. **An existing partial workflow**, not new work. The last five commits on this branch
   (`bd44218` → `1cfde18`) built exactly this chain's adapter functions — intake→enrichment
   handoff, enrichment→identity handoff, identity→catalog creation with duplicate
   protection — one stage at a time. Finishing it is the direct, obvious next step, not
   a new initiative.
2. **Genuinely revenue-adjacent.** Canonical catalog population is the upstream
   prerequisite for every other commerce workflow in the repo (listing, pricing,
   inventory, opportunity scoring) — none of which have anything to operate on today
   because nothing ever populates the catalog outside of hand-written test fixtures.
3. **Safe to complete under this mission's constraints.** It requires no paid provider
   and no production API calls — the enrichment stage runs entirely against local
   manual-entry/fixture data, never a network provider. By contrast, the other genuinely
   *live* candidate (`artifacts/api-server`'s Stripe checkout) is already REAL, requires
   live Stripe keys to even boot, and touching payment logic falls under "ask first" in
   the constitution — the wrong choice for an unattended completion pass.
4. Other candidates (lead capture, billing gate, CRM/opportunity scoring, outreach) are
   either ABSENT (would be new work, explicitly discouraged) or STUB modules totally
   disconnected from everything else (deal-intelligence, marketplace-platform) — completing
   them would not move anything closer to revenue this session.

## Current state (before this session)

- All four pipeline stages exist as real, unit-tested library code.
- The `commerce-core` SDK already wires an identity resolver and a canonical catalog
  together, but the identity adapter (`LocalTestProductIdentityAdapter`) is explicitly
  TEST-ONLY, constructed empty, and never populated from the SDK's own catalog storage —
  so identity-based duplicate detection was silently non-functional.
- Catalog storage is `InMemoryCatalogStorage`, a JS `Map` — wiped on every process exit,
  so a CLI run could never build up a real catalog across invocations.
- Nothing anywhere invoked all four stages together; each stage's handoff adapter was
  exercised only by hand-built fixtures in unit tests, never by a real upstream service.

## Target state (after this session)

- A new `@primeopp/pipeline` package inside `modules/commerce-core`'s own npm workspace
  wires real instances of `ProductIntakeService` → `ProductEnrichmentService` →
  `ProductIdentityResolver` → `CanonicalCatalog.create`, using each stage's own
  already-built, already-tested handoff adapter — no reimplementation of existing logic.
- File-backed persistence (JSON, atomic write) for both the intake deduplication store
  and the canonical catalog, so state survives across CLI invocations — closing the
  "fake success" gap where created products vanished on exit.
- A real, catalog-backed identity adapter replacing the disconnected test-only one, so
  re-ingesting the same product is correctly detected and refused rather than silently
  creating a duplicate.
- A new operator-facing CLI command, `primeopp catalog ingest <file>`, with distinct exit
  codes and messages for: success (new canonical product created), intake rejection
  (insufficient/invalid input), intake duplicate, no enrichment data available, already
  in the catalog (idempotency), and needs-human-review.

## Files to touch

- New: `modules/commerce-core/packages/pipeline/**` (package.json, tsconfig.json,
  `src/`, `tests/`)
- Edit: `modules/commerce-core/packages/cli/package.json` (add dependency),
  `modules/commerce-core/packages/cli/src/index.ts` (add `catalog` command group)
- Build artifacts (not committed, gitignored): `modules/product-intake/primeopp-product-intake/dist/`,
  `modules/product-enrichment/primeopp-product-enrichment/dist/`, and their `node_modules/`
  (installed this session so they are consumable as real dependencies for the first time)

## Tests / proof required

- `pipeline.test.ts`: success path (new product created + persisted across a fresh
  storage load), intake-rejection failure path, intake-duplicate path, enrichment
  "no provider" failure path, identity duplicate/idempotency path (second ingestion of
  the same product is refused, not duplicated), empty/zero state (listing an empty
  catalog before any ingestion).
- Runtime proof: two real CLI invocations against a throwaway data directory — first
  ingest succeeds and persists, second identical ingest is correctly detected as already
  in the catalog.
