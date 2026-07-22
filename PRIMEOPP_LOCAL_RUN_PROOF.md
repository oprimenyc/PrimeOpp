# PrimeOpp Local Run Proof

Date: 2026-07-22
Repo: `C:\Users\jp718\Documents\GitHub\PrimeOpp`

## Scope

Validated only the real customer/admin Railway target:

- `@workspace/primeopp`
- `@workspace/api-server`

The mockup sandbox and unrelated package/module fleets were not treated as the Railway customer/admin service surface.

## Commands Run

| Check | Command | Result |
| --- | --- | --- |
| Customer typecheck | `pnpm --filter @workspace/primeopp run typecheck` | PASS |
| API typecheck | `pnpm --filter @workspace/api-server run typecheck` | PASS |
| Customer build | `pnpm --filter @workspace/primeopp run build` | PASS |
| API build | `pnpm --filter @workspace/api-server run build` | PASS |
| Customer tests | `pnpm --filter @workspace/primeopp run test` | NOT RUN - no test script is configured |
| API tests | `pnpm --filter @workspace/api-server run test` | NOT RUN - no test script is configured |
| API start without env | `pnpm --filter @workspace/api-server run start` | FAIL AS EXPECTED - required env names missing |

## Local Route Smoke

After fixing the Express 5 SPA fallback from `*` to `/{*splat}`, I imported `artifacts/api-server/src/app.ts` and listened on an ephemeral localhost port. This avoided boot-time env validation, admin seeding, DB writes, and external provider calls.

| Surface | Smoke | Result |
| --- | --- | --- |
| Homepage/customer surface | `GET /` | PASS - 200 |
| Health route | `GET /api/healthz` | PASS - 200 |
| Order lookup route | `POST /api/orders/lookup` with invalid empty body | PASS WITH BLOCKERS - 400 validation response, no 500; valid lookup requires DB |
| Contact route | `POST /api/contact` with invalid empty body | PASS WITH BLOCKERS - 400 validation response, no 500; valid submit requires DB write |
| Contact page | `GET /contact` | PASS - 200 |
| Wishlist page | `GET /wishlist` | PASS - 200 |
| Wishlist behavior | Browser-local localStorage implementation | LOCAL_ONLY - honestly disclosed in UI/code |

## Runtime Bug Fixed

Before the fix, importing the API app crashed with:

`PathError: Missing parameter name at index 1: *`

Cause: Express 5 / path-to-regexp no longer accepts `app.get("*")` as the SPA fallback path.

Fix: `artifacts/api-server/src/app.ts` now uses `app.get("/{*splat}", ...)`.

## Deployment Blockers Observed Locally

- Required env vars are absent in the local process: `DATABASE_URL`, `SESSION_SECRET`, `ADMIN_EMAIL`, `ADMIN_PASSWORD`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`.
- The API start command hard-fails without those env names.
- Valid order lookup and contact submission require a migrated Postgres database.
- No Railway project is linked in this checkout.
- No live Railway variables were inspected or printed.

## Safety Confirmations

- Secrets printed: NO
- DNS modified: NO
- Provider actions mutated: NO
- Test charges created: NO
- Production customer data mutated: NO
- Destructive migrations run: NO
- Fake web wrapper created: NO

