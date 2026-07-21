# PrimeOpp Launch Blocker Map

Repo-local view only. Nothing here required a provider call to determine — all found by reading code/config/tests.

## Domain / DNS blockers

- `primeopp.com` is an unverified placeholder baked into ~6 files, no central `SITE_URL` config (per `PRIMEOPP_DOMAIN_READINESS.md`, not re-verified line-by-line this session).
- **No DNS action taken or planned this session.** Domain purchase/DNS config requires separate approval per mission scope.

## Deployment target blockers

- No approved production/staging deployment target selected. See [PRIMEOPP_NON_REPLIT_LAUNCH_PATH.md](PRIMEOPP_NON_REPLIT_LAUNCH_PATH.md).
- `.replit` config exists and is real/functional (dev workspace), but only registers `artifacts/api-server` and `artifacts/mockup-sandbox` as `[[artifacts]]` — **`artifacts/primeopp`, the actual storefront, is not registered there.** Not fixed this session (`.replit` is deployment config — out of scope; flagged for whoever owns deployment-target selection).
- `artifacts/primeopp` and `artifacts/mockup-sandbox` `vite.config.ts` previously required `PORT`/`BASE_PATH` env vars even for a plain `vite build` (no server involved). **Fixed this session for `artifacts/primeopp`** (the real storefront) — build now only requires those vars when actually serving (dev/preview), and defaults `BASE_PATH` to `/` for a portable, non-Replit-shaped static build. Left `mockup-sandbox` as-is (attempted the same fix, hit an unrelated TS overload error from its custom plugin, reverted rather than debug an out-of-scope dev tool under time-box).

## Provider / env blockers

- No `.env.example` existed for the two apps that actually ship (`artifacts/api-server`, `artifacts/primeopp`) — only 3 existed, all inside unrelated `modules/` donor packages. **Fixed this session**: added `artifacts/api-server/.env.example` documenting all 6 required + 6 optional vars (no values, following the existing repo convention). `artifacts/primeopp` needs no env template — it has no custom `VITE_*`/`import.meta.env` vars beyond Vite's own `BASE_URL`.
- No live credentials exist anywhere in the repo (confirmed by secret scan this session — see [PRIMEOPP_LAUNCH_READINESS_TEST_REPORT.md](PRIMEOPP_LAUNCH_READINESS_TEST_REPORT.md)).

## Auth / account blockers

- Customers have no password-based account system by design (email-only loyalty lookup). This is a product decision, not a bug — flagged, not changed.
- `GET /api/loyalty/:email` requires no auth beyond knowing an email address — an enumeration/privacy concern for a public launch. Not fixed this session (would be a behavior/policy change requiring explicit approval per the mission's "ask first" boundary for anything touching auth behavior).

## Checkout / payment blockers

- None found in the code path itself — checkout is a real, working Stripe Checkout Session integration with server-authoritative pricing and idempotent webhook handling.
- **Operational blocker only**: requires live `STRIPE_SECRET_KEY`/`STRIPE_WEBHOOK_SECRET` to actually process a payment; none configured (correctly — no live secrets belong in this repo).

## Catalog / POD blockers

- `modules/commerce-core` catalog-ingestion pipeline is real and tested (269/269 tests passing, confirmed this session — see test report), but it is **not wired into `artifacts/api-server`/`artifacts/primeopp` at all**. It's a standalone CLI toolkit, not a running service the storefront calls. Integrating it is a real feature-scoped project, not a cleanup task — flagged, not attempted.

## Order / customer support blockers

- Order lookup and support/contact are static placeholders (see product surface audit). No ticketing, no self-serve lookup.
- Wishlist UI copy claims local persistence that isn't implemented (no `localStorage` write path exists for it).

## Email / notification blockers

- Transactional email (`RESEND_API_KEY`) and fulfillment (`PRINTFUL_API_KEY`, `TAPSTITCH_API_KEY`) are all optional-with-graceful-skip in code — orders won't fail if unset, but customers won't get confirmation emails or fulfillment either. No live keys present (expected/correct for a repo).

## Test / build blockers

- **`modules/commerce-core` evidence generator was silently under-reporting test results** — `scripts/verify.ts` proof #4 parsed `node --test` output with a regex matching only the TTY "spec" reporter format (`ℹ pass N`), but non-interactive spawns emit the "tap" reporter format (`# pass N`). Result: the evidence files claimed "0 passed, 0 failed" while 269 tests were actually passing, and the proof was still marked `[✓]` PASS. **Fixed this session** (regex now matches both formats), verified by direct re-run: 269/269 passing. See implementation/test reports for full trace.
- Separately, `commerce-core`'s `verify:proofs` npm script pointed at a nonexistent `scripts/run-proofs.ts` (the real file is `scripts/verify.ts`) — **fixed this session** (script alias corrected).
- `artifacts/mockup-sandbox` build still fails locally without `PORT` set — pre-existing, not fixed (non-customer-facing dev tool, out of scope).
- No root-level `test` script exists (root `package.json` only defines `build`/`typecheck`). Each workspace member has its own test runner (or none — `artifacts/api-server` and `artifacts/primeopp` have no test scripts at all). Not treated as a blocker to fix this session (adding a root aggregate test script with no actual frontend/API tests behind it would be cosmetic); flagged for a future session that adds real tests to those two packages.

## Secret / config blockers

- None found. `.gitignore` correctly excludes `.env`/`.env.*` (keeping `.env.example`). No hardcoded secret values found anywhere in the repo (only secret-detection *regex patterns* inside `modules/*/scripts/{lint,audit,cleanroom-verify}.js`, which are intentionally there to catch leaked keys).

## Replit scrub status

- Replit remains classified as dev/provenance only, consistent with `PRIMEOPP_REPLIT_CLASSIFICATION_CURRENT_TRUTH.md`. This session found and corrected two additional stale claims in `replit.md` that implied Replit was more central to production than it actually is (auth scheme description, and a claim that Replit "handles production migrations when publishing" — false, since no migration runner exists at all, on Replit or otherwise). `.replit` config itself was **not modified** (deployment config, out of scope for this session).

## Rules honored

- Replit is dev/provenance only — not a staging/production target.
- No new live deploy provider selected.
- No provider config added.
- No DNS config added.
