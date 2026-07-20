# PrimeOpp Security Report

Scope: the new `@primeopp/pipeline` package, the `catalog` CLI commands added to
`@primeopp/cli`, and the two donor modules (`primeopp-product-intake`,
`primeopp-product-enrichment`) built and wired in for the first time this session.
Not a re-audit of `artifacts/api-server`/`artifacts/primeopp` — see `AUDIT.md` /
`AUDIT_PHASE2.md` for that, unchanged this session.

## Secret scan

Grepped all new/changed files for API keys, tokens, passwords, AWS key patterns, and
PEM private-key headers (`(api[_-]?key|secret|password|token|AKIA[0-9A-Z]{16}|-----BEGIN
(RSA|EC|OPENSSH|PGP) PRIVATE KEY-----|Bearer ...)`). **No matches.** No `.env` files were
created or touched.

## No paid provider dependency, no production API calls (mission constraint)

Verified by construction: `createLocalEnrichmentProviders()` registers exactly two
providers — `ManualInputProvider` (pure function over operator-entered fields) and
`FixtureProductProvider` (lookup against a small hardcoded local fixture list). Neither
makes a network call. `primeopp-product-enrichment` also ships
`GenericHttpProductProvider` (real HTTP) and a configurable `IsbnProductProvider` —
**neither is registered or reachable from this pipeline.** No API key, Stripe key, or
any other credential is read or required by any code path added this session.

## Tenant isolation

`FileCatalogStorage` and `CatalogBackedIdentityAdapter` both scope every read/write by
`tenantId`, mirroring `InMemoryCatalogStorage`'s existing, already-tested isolation
(`canonical-catalog`'s pre-existing "catalog enforces tenant isolation" test). Verified
by the new `pipeline` tests using distinct tenant IDs implicitly through `scope.tenantId`
threaded end-to-end from the CLI's `--tenant` flag through every stage.

## Input handling

- The CLI parses operator-supplied JSON with `JSON.parse` (no `eval`, no dynamic
  `require`/`import` of user content, no shell interpolation of file paths).
- File paths (`<file>`, `--data-dir`) come directly from the local operator's own command
  line, exactly like the pre-existing `products resolve <file>` command. This is a local,
  single-operator CLI tool, not a network-facing service — the trust model is "whoever
  can run this CLI already has that filesystem access," so path-traversal hardening
  (which would matter for a remote/multi-tenant HTTP surface) is not applicable here.
- Malformed JSON and missing files are rejected loudly with exit code 2 (pre-existing
  `readJson()` behavior, reused as-is) — never silently treated as empty input.

## Data integrity

- All file writes go through `writeJsonFileAtomic()` (write to a sibling temp file, then
  `rename`) so a crash mid-write can never leave a half-written, corrupted store.
- Reads that encounter a malformed (corrupt) file throw a loud
  `PIPELINE_STORE_CORRUPT` error rather than silently falling back to an empty store —
  data corruption surfaces immediately instead of quietly discarding prior state.

## Finding: identity-based deduplication was silently non-functional (found and fixed this session)

**This is the most significant finding.** `PrimeOppSdk` (pre-existing code, not written
this session) wired `ProductIdentityResolver` with `LocalTestProductIdentityAdapter` — a
class explicitly documented in its own source as `TEST-ONLY`, constructed with an empty
internal `Map` that is never populated from the SDK's actual catalog storage. The
practical effect: **every identity resolution always returned `NO_MATCH`, regardless of
what already existed in the catalog.** Combined with in-memory-only storage, this meant
duplicate-prevention had no real backing.

Impact if this had reached a real ingestion path unnoticed: duplicate canonical product
records for the same physical item, each independently listed/priced/inventoried — a
data-integrity defect with direct business consequences (double-counted inventory,
inconsistent pricing across "duplicate" listings of the same item, confusing audit
trails), not merely a cosmetic bug.

**Fix (this session):** `CatalogBackedIdentityAdapter` (new,
`modules/commerce-core/packages/pipeline/src/identity/catalog-backed-adapter.ts`) queries
the real, persisted `CatalogStorageAdapter` instead of a private, disconnected Map.
Proven fixed by a dedicated test and a live two-process CLI reproduction — see
`PRIMEOPP_RUNTIME_PROOF.md` section 9.

A related, secondary defect was found and fixed during implementation: the resolver's
own `detectState()` has a documented fallthrough where a low-confidence match
(`score < 0.5`, no OCR input) is labeled `NO_MATCH` even though it carries real
candidates. The orchestrator now defensively checks `candidates.length > 0` /
`selectedCandidateId` in addition to the state label — mirroring
`@primeopp/canonical-catalog`'s own `assertNoMatchResolution` guard exactly — so this
resolver quirk cannot slip a duplicate past the pipeline.

## Dependency surface

`primeopp-product-intake` and `primeopp-product-enrichment` were added as local `file:`
dependencies (same-repo donor modules, not new third-party packages — no new supply-chain
surface). Building them required `npm install` of their own already-declared
devDependencies (`typescript`, `jest`, `ts-jest`, `@types/*`, `ts-node`) — standard
open-source dev/build tooling, not invoked at runtime, `npm audit` reported **0
vulnerabilities** for both installs.

## Not in scope / not re-audited

- `artifacts/api-server` / `artifacts/primeopp` (Stripe checkout, auth, sessions) —
  untouched this session; see `AUDIT.md` / `AUDIT_PHASE2.md` for their standing findings.
- `modules/deal-intelligence`, `modules/marketplace-platform`,
  `modules/affiliate-backlink-engine` — untouched this session.

## Verdict

**PASS WITH FINDINGS.** One significant pre-existing correctness/integrity defect was
found and fixed (identity-based catalog deduplication). No new secrets, no new network
surface, no paid-provider or production-API dependency introduced, tenant isolation
preserved, and all file persistence is atomic and fails loudly on corruption.
