# PrimeOpp Pre-Deploy Validation — Phase 6

## Typecheck

`pnpm run typecheck` (full workspace, includes `artifacts/api-server`, `artifacts/mockup-sandbox`, `artifacts/primeopp`, `scripts`): **PASS**, all 4 projects clean.

## Tests

`pnpm --filter @workspace/api-server run test` (new vitest suite, `artifacts/api-server/tests/stripe-fail-closed.test.ts`): **PASS**, 6/6 tests.

Covers the Phase 4 requirements:
- App boots and serves `/api/healthz` (200) without `STRIPE_SECRET_KEY`/`STRIPE_WEBHOOK_SECRET` set.
- `validateEnv()` does not throw when only the Stripe vars are absent, but still throws when a genuinely required var (e.g. `SESSION_SECRET`) is missing.
- `POST /api/checkout/session` returns 503 with an explicit "Stripe not configured" error — no paid access granted.
- `GET /api/checkout/session/:id` returns 503.
- `POST /api/webhook` returns 503 (fails closed) rather than the previous silent 200 no-op.
- No real Stripe SDK call occurs in any of the above — `getStripe()` returns `null` before any Stripe API usage is reached.

No test framework existed for `@workspace/primeopp` or `@workspace/api-server` before this session. Added `vitest` (already present elsewhere in the monorepo lockfile, via `modules/deal-intelligence`) as a devDependency for `@workspace/api-server` rather than introducing a new tool. Frontend (`@workspace/primeopp`) still has no test suite — out of scope for this mission (no frontend behavior changed).

## Build

- `pnpm --filter @workspace/primeopp run build`: **PASS**
- `pnpm --filter @workspace/api-server run build`: **PASS**
- These are the exact two commands `railway.json`'s `buildCommand` runs, so the deploy-relevant build path is fully green.
- Full-workspace `pnpm run build` (`-r` across all 8 packages) additionally surfaced a **pre-existing, unrelated** failure in `artifacts/mockup-sandbox` (its `vite.config.ts` requires a local `PORT` env var that isn't set in this shell). Not touched by this mission, not part of the Railway build command, and not caused by any change in this session — noted for completeness, not treated as a blocker.

## Secret Scan

Scanned the diff of all tracked changes (`artifacts/api-server/src/**`, `package.json`) plus every new untracked file (3 phase docs + the new test file) for common secret patterns (`sk_live`, `sk_test_`, `pk_live`, `whsec_`, AWS keys, PEM headers, credentialed `postgres://` URLs).

**Result: clean.** One match in the new test file is a hardcoded dummy fixture (`postgres://test:test@127.0.0.1:5432/primeopp_test`) used only to satisfy `validateEnv()`'s schema shape in an isolated test process — not a real credential, never used to connect to anything.

No real secret values (Railway variable values, the Postgres connection string, `SESSION_SECRET`, `ADMIN_PASSWORD`) have been printed, logged, or committed at any point in this session.

## Summary

| Check | Result |
|---|---|
| Typecheck | PASS |
| Tests | PASS (6/6) |
| Build (deploy-relevant) | PASS |
| Build (full workspace) | PASS with 1 pre-existing, out-of-scope failure (mockup-sandbox) |
| Secret scan | PASS |
