# PrimeOpp Railway DB Bootstrap — Phase 5

TARGET: Railway Postgres service `Postgres` (`958f29d8-e998-4fb0-b3f5-f7d2eb776536`) in project `primeopp`.

## Migration Run

- Runner: `lib/db/scripts/migrate.mjs` (existing, unmodified — idempotent, tracks applied files in `schema_migrations`).
- Connection: the runner's `postgres.railway.internal` hostname (from the app's wired `DATABASE_URL` reference) only resolves from inside Railway's private network, not from this local machine. For this one-time bootstrap run, the Postgres service's own `DATABASE_PUBLIC_URL` (TCP proxy) was used instead via `railway run --service Postgres`, which injects the value directly into the child process's environment — never displayed, echoed, or logged by this session.
- Explicitly set `NODE_ENV=production` and `ALLOW_PROD_MIGRATE=true` for this invocation, acknowledging the runner's built-in guard against accidental production runs (this is the intentional, owner-approved production migration, not an accident).
- Result: **7 applied, 0 already up to date, 0 failed.**

```
[migrate] applying: 0001_base_schema.sql
[migrate] applying: 0002_order_pipeline_hardening.sql
[migrate] applying: 0003_notifications.sql
[migrate] applying: 0004_admin_security.sql
[migrate] applying: 0005_audit_log_immutability.sql
[migrate] applying: 0006_revenue_engine.sql
[migrate] applying: 0007_contact_messages.sql
[migrate] done. 7 applied, 0 already up to date.
```

No `DROP`/`TRUNCATE`/`DELETE` statements exist in any migration file (verified by grep in Phase 1) — all changes are additive (`CREATE TABLE IF NOT EXISTS`, `CREATE OR REPLACE FUNCTION`, etc.).

## Verification

Ran a one-off read-only verification script (same pattern: public proxy URL injected via `railway run`, connection string never printed):

- **17 tables present**: `abandoned_carts, admin_sessions, admin_users, audit_log, contact_messages, discounts, email_workflows, fulfillment_jobs, loyalty_accounts, loyalty_points_history, notification_jobs, orders, product_recommendations, product_review_votes, product_reviews, products, schema_migrations`
- **All 7 migration filenames** recorded in `schema_migrations`.
- Connectivity confirmed (`connect()` + query + `end()` succeeded).

## Health Route vs. DB Reachability

`GET /api/healthz` (`artifacts/api-server/src/routes/health.ts`) remains an unchanged liveness check (`{status:"ok"}`) — it does **not** query the database. This was a deliberate choice, not an oversight: coupling the health check to DB status would make Railway's health-check-driven restart policy (`ON_FAILURE`, max 3 retries) trigger service restarts on transient DB blips rather than just app crashes, which is a bigger behavior change than this mission asked for. DB reachability is instead verified directly (above) and will be re-confirmed against the live deployed app in Phase 8 via an actual authenticated/DB-backed route (e.g. order lookup or contact submission), not by modifying the health endpoint's contract.

## Seed Data

No fake/manual seed data was inserted. The only automatic bootstrap row is the initial owner admin user, created by `seedInitialAdminUser()` in `artifacts/api-server/src/lib/auth.ts` on first server boot using `ADMIN_EMAIL`/`ADMIN_PASSWORD` from the environment (already set in Phase 3) — this is existing application behavior, not a migration-time seed, and only fires if `admin_users` is empty (it is, post-migration).
