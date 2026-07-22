# PrimeOpp Railway Surface Map

Date: 2026-07-22
Repo: `C:\Users\jp718\Documents\GitHub\PrimeOpp`

## Verdict

PrimeOpp has a real customer/admin fullstack service surface:

- Customer React storefront: `artifacts/primeopp`
- Express API/admin service: `artifacts/api-server`
- Fullstack Railway entrypoint: `@workspace/api-server` serving the built `@workspace/primeopp` assets

Overall classification: `BLOCKED_BY_SECRETS`

The code is structurally deployable as `DEPLOYABLE_FULLSTACK_SERVICE`, but live Railway deployment is blocked until required Railway variables and a migrated Postgres target exist.

## Deployable Surfaces

| Surface | Path | Classification | Notes |
| --- | --- | --- | --- |
| Customer web app | `artifacts/primeopp` | `DEPLOYABLE_WEB_SERVICE` | Vite React storefront with homepage, product, cart, order success, account, order lookup, wishlist, contact, policies, catalog/search routes. Built static assets are served by the API service in production. |
| API server | `artifacts/api-server` | `DEPLOYABLE_API_SERVICE` | Express 5 API with health, products, checkout, webhook, orders, admin, revenue, auth, and contact routes. Requires env at boot. |
| Fullstack service | `artifacts/api-server` + `artifacts/primeopp` | `DEPLOYABLE_FULLSTACK_SERVICE` | API serves `../primeopp/dist/public` and SPA fallback. Railway config added at `railway.json`. |
| Admin surface | `artifacts/primeopp/src/pages/admin*.tsx` + API admin/auth routes | `DEPLOYABLE_FULLSTACK_SERVICE` | Admin login, admin dashboard, admin orders, product CRUD, audit/revenue endpoints. Requires DB, seeded admin user, and session secret. |
| Worker/queue code | `artifacts/api-server/src/lib/fulfillmentQueue.ts`, `notificationQueue.ts` | `LOCAL_READY_ONLY` | Runs in the web process after boot; not separated as an independent Railway worker service. |
| DB migration runner | `lib/db/scripts/migrate.mjs` | `LOCAL_READY_ONLY` | Local/dev runner applies `lib/db/migrations/*.sql`; refuses `NODE_ENV=production` unless explicitly overridden. Not wired to Railway release/deploy. |
| Mockup/demo surface | `artifacts/mockup-sandbox` | `NOT_DEPLOYABLE` | Explicit mockup sandbox; not part of the real customer/admin Railway target. |
| Library modules | `modules/*`, `lib/*` | `LOCAL_READY_ONLY` | Package/library/test surfaces, not standalone customer/admin web services for this mission. |

## Required Env Var Names

Boot-required by `artifacts/api-server/src/lib/env.ts`:

- `DATABASE_URL`
- `SESSION_SECRET`
- `ADMIN_EMAIL`
- `ADMIN_PASSWORD`
- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`

Additional runtime/config names observed:

- `PORT`
- `NODE_ENV`
- `ALLOWED_ORIGINS`
- `PRINTFUL_API_KEY`
- `TAPSTITCH_API_KEY`
- `RESEND_API_KEY`
- `FROM_EMAIL`
- `FULFILLMENT_STALE_MINUTES`
- `BASE_PATH`
- `REPL_ID`
- `ALLOW_PROD_MIGRATE`

No env values were printed.

## DB And Migration Requirements

- API requires Postgres via `DATABASE_URL`.
- Migration files live in `lib/db/migrations`.
- Runner: `pnpm --filter @workspace/db run migrate`.
- Runner is idempotent by filename tracking, but it is local/dev oriented and blocks production unless `ALLOW_PROD_MIGRATE=true`.
- No migrations were run during this proof.

## Build And Start Commands

Railway config added:

- Build: `pnpm --filter @workspace/primeopp run build && pnpm --filter @workspace/api-server run build`
- Start: `pnpm --filter @workspace/api-server run start`
- Healthcheck path: `/api/healthz`

