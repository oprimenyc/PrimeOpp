# PrimeOpp Launch Readiness — Next Session Handoff

## Where this leaves things

Storefront (`artifacts/primeopp`) and API (`artifacts/api-server`) typecheck and build cleanly with no Replit-specific env requirement forced at build time. `modules/commerce-core`'s own evidence pipeline was silently lying about its test count (0 instead of 269) due to a reporter-format regex bug and a broken npm-script alias; both are fixed and verified. Three customer-facing surfaces (order lookup, wishlist, support/contact) are honest static placeholders, not broken code — worth knowing before promising them to users. Deployment target remains genuinely undecided; nothing this session narrows that decision, by design.

## Read first

- [PRIMEOPP_LAUNCH_READINESS_CURRENT_TRUTH.md](PRIMEOPP_LAUNCH_READINESS_CURRENT_TRUTH.md) — session facts, starting state
- [PRIMEOPP_LAUNCH_BLOCKERS.md](PRIMEOPP_LAUNCH_BLOCKERS.md) — the full blocker map, organized by category
- [PRIMEOPP_PRODUCT_SURFACE_AUDIT.md](PRIMEOPP_PRODUCT_SURFACE_AUDIT.md) — surface-by-surface REAL/STUB classification

## Recommended next safe step

Pick **one** of these (each is independently scoped and doesn't require the others):

1. **Migration runner.** Nothing currently applies `lib/db/migrations/*.sql` to a database. Smallest safe version: a script that runs the numbered SQL files in order against `DATABASE_URL`, idempotently (track applied migrations in a table). Repo-local, no provider mutation, testable against a local/throwaway Postgres.
2. **Deploy-target decision session.** Explicit, separate, user-approved session to pick Railway/Fly/Vercel/VPS/other, register `artifacts/primeopp` in whatever config that target needs (and fix `.replit`'s missing `[[artifacts]]` entry for the storefront if Replit dev workspace continues to be used alongside it). Requires explicit approval per this mission's own boundary — do not do this autonomously.
3. **Close the three placeholder surfaces** (order lookup, wishlist, contact) — each is a real, scoped feature: order lookup needs an authenticated-by-order-token lookup endpoint, wishlist needs actual `localStorage` (or account-backed) persistence, contact needs a real form + destination (email or ticket queue). Each should get its own test coverage per PrimeOS Constitution §4 quality bar.

## Do not do without separate explicit approval

- Select or configure a live deployment target.
- Touch `.replit`, DNS, or any provider console/API.
- Change the `GET /api/loyalty/:email` auth requirement (touches auth behavior).
- Treat Replit as anything other than a dev/provenance workspace.

## Known non-blocking loose end

`artifacts/mockup-sandbox` still can't run `vite build` without `PORT` set. Low priority (internal tool, not customer-facing) — if someone wants it fixed, the pattern to copy is in `artifacts/primeopp/vite.config.ts`, but expect to also resolve a TS overload-resolution conflict with `mockupPreviewPlugin()`'s return type that this session hit and didn't chase down.

## Evidence files intentionally left uncommitted

`modules/commerce-core/evidence/{TEST_RESULTS.json,RUNTIME_VERIFICATION.md,PACKAGE_RESULTS.json}` were already modified before this session started, and remain modified now (this session's `verify:proofs` fix regenerated them with correct numbers — 269/269 — as part of verifying the code fix). Per mission git rules, regenerated evidence is not staged as part of this commit. Whoever owns `commerce-core` evidence sign-off should review and commit these separately if the 269/269 result is accepted as the new baseline.
