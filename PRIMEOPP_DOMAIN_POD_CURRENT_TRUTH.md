# PrimeOpp Domain / POD Readiness — Current Truth

Date: 2026-07-20
Repo: `C:\Users\jp718\Documents\GitHub\PrimeOpp`
Branch: `integration/full-primeopp-platform`
Starting HEAD: `a9dcdbc27a5b546e1ae4abb3b62ccaa9c6630d2e`
Working tree at session start: 3 unmodified-by-this-session files already dirty —
`modules/commerce-core/evidence/PACKAGE_RESULTS.json`, `RUNTIME_VERIFICATION.md`,
`TEST_RESULTS.json` (pre-existing, regenerated evidence output per
`PRIMEOPP_NEXT_SESSION_HANDOFF.md`; left untouched this session).

This is a **no-code discovery pass**. Nothing in this document is inferred from memory —
every claim below is grounded in a specific file read this session. See
`PRIMEOPP_DOMAIN_POD_PROOF.md` for the full list of files read and commands run.

## Repo shape (recap, still accurate)

- pnpm monorepo. `pnpm-workspace.yaml` covers `artifacts/*`, `lib/*`, `lib/integrations/*`,
  `scripts`. `modules/*` is separate donor code, not part of the pnpm workspace, and not
  wired into the public-facing storefront (see prior session's
  `PRIMEOPP_CURRENT_TRUTH.md` for the full module-by-module classification — unchanged
  this session).
- The **public-facing product** — the thing a domain purchase and a POD launch would
  point at — is `artifacts/primeopp` (React/Vite storefront) + `artifacts/api-server`
  (Express 5 API) + `lib/db` (mostly-stub Drizzle package; the real API uses raw SQL via
  `pg` directly, not Drizzle).

## What's real vs. placeholder, verified this session

| Area | Status | Evidence |
|---|---|---|
| Storefront routing | **Real, broader than README.md implies** | `artifacts/primeopp/src/App.tsx` wires 20 routes: `/`, `/product/:id`, `/cart`, `/order-success`, `/terms`, `/privacy`, `/about`, `/contact`, `/faq`, `/refund-policy`, `/shipping-policy`, `/collections`, `/category/:category`, `/search`, `/account`, `/orders`, `/wishlist`, `/recently-viewed`, `/maintenance`, `/500`, `/admin/login`, `/admin/dashboard`, `/admin/orders`, `/admin`. |
| Admin session auth | **Real, cookie+CSRF — not JWT/localStorage as `replit.md` still claims** | `artifacts/api-server/src/lib/auth.ts`: `__Host-primeopp_admin_session` httpOnly cookie, server-side `admin_sessions` table, hashed session + CSRF tokens, idle + absolute timeout, `seedInitialAdminUser()` seeds one owner from `ADMIN_EMAIL`/`ADMIN_PASSWORD` env vars. `replit.md` (not touched, appears stale) describes JWT+localStorage — do not trust `replit.md` for auth behavior. |
| Checkout / payment | **Real** | `artifacts/api-server/src/routes/orders.ts`: `POST /api/checkout/session` creates a real `stripe.checkout.sessions.create()` call; `POST /api/webhook` verifies `STRIPE_WEBHOOK_SECRET` signature before processing `checkout.session.completed`; price is looked up server-side, not trusted from client. |
| POD fulfillment | **Real, gracefully degrades without keys** | `artifacts/api-server/src/lib/fulfillment.ts`: Printful and Tapstitch each check for their API key; if absent, fulfillment is explicitly **skipped** (`status: "skipped"`, `order_id: "PENDING_API_KEY"`) and logged — order is still saved, not silently dropped. |
| Order confirmation email | **Real, gracefully degrades without keys** | `artifacts/api-server/src/lib/email.ts`: skips (with a console warning) if `RESEND_API_KEY` is unset; `FROM_EMAIL` defaults to `orders@primeopp.com` — an unregistered placeholder domain, not a live sender identity. |
| Env var enforcement | **Real, hard-fails without them** | `artifacts/api-server/src/lib/env.ts`: Zod schema hard-requires `DATABASE_URL`, `SESSION_SECRET` (min 32 chars), `ADMIN_EMAIL`, `ADMIN_PASSWORD` (min 12 chars), `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`. The API process will not boot without all six. |
| Database schema | **Real SQL exists, no runner wired** | `lib/db/migrations/` has 6 numbered raw-SQL migration files (`0001_base_schema.sql` through `0006_revenue_engine.sql`). No migration-runner script, no reference to these files, and no `CREATE TABLE` anywhere in application `.ts` code was found repo-wide. `lib/db/src/schema/index.ts` (the pnpm-workspace Drizzle package) is a literal `export {}` placeholder — the real schema lives only in the unrun `.sql` files. |
| Revenue features | **Real, more than README documents** | `artifacts/api-server/src/routes/revenue.ts` (not mentioned in README.md) implements product reviews, recommendations, abandoned-cart capture/processing, discount quoting, a loyalty lookup, and admin revenue/review endpoints — all behind `requirePermission(...)` where admin-only. |
| New/expanded pages beyond README | **Real** | `pages/catalog.tsx` (Collections/Category/Search), `pages/customer.tsx` (Account/Orders/Wishlist/Recently-Viewed), `pages/static-pages.tsx` (About/Contact/FAQ/Refund/Shipping/Maintenance/500) — none of these are mentioned in `README.md`'s "Project Structure" section, which is stale relative to current code. |
| Deploy provider config | **None beyond Replit** | No `vercel.json`, `railway.toml`, `fly.toml`, `wrangler.toml`, or `netlify.toml` anywhere in the repo. Only `.replit` exists, targeting Replit's own `autoscale` deployment with `nodejs-24` + `postgresql-16` modules. |
| Domain/brand references in code | **Placeholder, not a purchased domain** | `primeopp.com` appears only as an assumed value: `support@primeopp.com` / `orders@primeopp.com` (contact + default sender email), `https://instagram.com/primeopp`, `https://tiktok.com/@primeopp` (social links), and the Go-Live checklist in `README.md` treating `primeopp.com` as a to-be-set `ALLOWED_ORIGINS` value. No evidence the domain is registered. |

## Files read this session (mission-relevant)

- `README.md`, `replit.md`, `PRIMEOPP_CURRENT_TRUTH.md`, `PRIMEOPP_IMPLEMENTATION_REPORT.md`,
  `PRIMEOPP_NEXT_SESSION_HANDOFF.md`, `PRIMEOPP_RECOVERY_MANIFEST.md`
- `.replit`, `package.json`, `pnpm-workspace.yaml`
- `artifacts/primeopp/src/App.tsx`
- `artifacts/api-server/src/lib/env.ts`, `db.ts`, `auth.ts`, `fulfillment.ts`, `email.ts`
- `artifacts/api-server/src/routes/admin.ts`, `revenue.ts`, `products.ts`, `orders.ts`
- `artifacts/api-server/src/app.ts` (CORS/`ALLOWED_ORIGINS` check)
- `lib/db/src/schema/index.ts`, `lib/db/migrations/*.sql` (listing only)
- `artifacts/primeopp/src/pages/home.tsx`, `terms.tsx`, `privacy.tsx`, `static-pages.tsx`,
  `catalog.tsx`, `customer.tsx` (grep + partial reads)

No source files, package files, env files, provider configs, or database/schema files
were modified. See `PRIMEOPP_DOMAIN_POD_PROOF.md` for the complete file/command log.
