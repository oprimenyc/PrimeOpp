# PrimeOpp Create + Deploy — Phase 1 Baseline

REPO: `C:\Users\jp718\Documents\GitHub\PrimeOpp`

BRANCH: `integration/full-primeopp-platform`

STARTING HEAD: `353cd2be4c6945b411bfdb1bd24d0b41422a7837`

DIRTY TREE: Yes, but out of scope for this mission —
`modules/commerce-core/evidence/{PACKAGE_RESULTS.json,RUNTIME_VERIFICATION.md,TEST_RESULTS.json}`
are modified from a prior unrelated evidence-generation run. Not touched by this session.

PREVIOUS PROOF COMMITS PRESENT:
- `77b7227` Add PrimeOpp Railway deployability proof — present in history
- `353cd2b` Record PrimeOpp Railway proof git status — present in history (current HEAD)

PREVIOUS CLASSIFICATION: `BLOCKED_BY_SECRETS` (per `PRIMEOPP_RAILWAY_LIVE_PROOF_HANDOFF.md`) — no Railway project linked, no boot secrets set, no migrated database.

## App / Service Layout

- Monorepo, pnpm workspaces, Railpack builder.
- Frontend: `artifacts/primeopp` (Vite + React SPA), builds to `artifacts/primeopp/dist/public`.
- Backend: `artifacts/api-server` (Express 5), serves API under `/api` and the built SPA as static files + catch-all fallback.
- Shared DB package: `lib/db` (drizzle-orm schema + raw-SQL migration runner at `lib/db/scripts/migrate.mjs`, migrations in `lib/db/migrations/*.sql`).

## railway.json (current)

```json
{
  "build": { "builder": "RAILPACK", "buildCommand": "pnpm --filter @workspace/primeopp run build && pnpm --filter @workspace/api-server run build" },
  "deploy": {
    "startCommand": "pnpm --filter @workspace/api-server run start",
    "healthcheckPath": "/api/healthz",
    "healthcheckTimeout": 300,
    "restartPolicyType": "ON_FAILURE",
    "restartPolicyMaxRetries": 3
  }
}
```

- Build command: `pnpm --filter @workspace/primeopp run build && pnpm --filter @workspace/api-server run build`
- Start command: `pnpm --filter @workspace/api-server run start` → `node ./dist/index.cjs`
- Health route: `GET /api/healthz` → `artifacts/api-server/src/routes/health.ts` (currently a static `{status:"ok"}`, does not check DB reachability yet — Phase 5 will address).

## Required Boot Env Vars (from `artifacts/api-server/src/lib/env.ts`)

| Var | Currently required at boot (zod schema) | Notes |
|---|---|---|
| `DATABASE_URL` | yes | consumed in `src/lib/db.ts` |
| `SESSION_SECRET` | yes (min 32 chars) | not currently read anywhere else in code — reserved/future use, but boot-validated |
| `ADMIN_EMAIL` | yes (email format) | used by `seedInitialAdminUser()` in `src/lib/auth.ts` to bootstrap the first owner admin row |
| `ADMIN_PASSWORD` | yes (min 12 chars) | same, hashed via `src/lib/password.ts` |
| `STRIPE_SECRET_KEY` | yes | **blocker** — route-level code (`src/routes/orders.ts`) already handles a missing key gracefully (503), but `validateEnv()` in `src/lib/env.ts` currently hard-requires it, crashing boot if absent |
| `STRIPE_WEBHOOK_SECRET` | yes | same **blocker** as above |

`PORT` is required separately in `src/index.ts` (Railway sets this automatically).

**Phase 4 will loosen `envSchema` so the two Stripe vars are optional**, since route code is already fail-closed-ready (`getStripe()` returns `null` → 503 on checkout endpoints when `STRIPE_SECRET_KEY` is absent; webhook route no-ops safely when absent).

## Migrations

- 7 migration files, `0001`–`0007`, all additive (`CREATE TABLE IF NOT EXISTS`, `CREATE OR REPLACE FUNCTION`, etc.) — no `DROP`/`TRUNCATE`/`DELETE` statements found (verified by grep).
- Runner (`lib/db/scripts/migrate.mjs`) tracks applied files in a `schema_migrations` table, is idempotent, and refuses `NODE_ENV=production` unless `ALLOW_PROD_MIGRATE=true` is set (safety guard against accidental prod runs — will need this override to migrate the real Railway Postgres, which is an intentional owner-approved action here, not accidental).

## Wishlist

- Client-only, `localStorage`-backed (`artifacts/primeopp/src/lib/wishlist.ts`). Honest — no server wishlist API exists. Expected status: `LOCAL_ONLY`.

## Not Redone From Prior Session

Typecheck and build were previously verified PASS (commit `77b7227`). Will re-verify in Phase 6 rather than trusting stale state, since code changes are planned in Phase 4.
