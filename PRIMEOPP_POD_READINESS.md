# PrimeOpp POD / Customer-Facing Readiness

No-code discovery only. Nothing below was executed against a live environment — all
claims are grounded in source reads listed in `PRIMEOPP_DOMAIN_POD_PROOF.md`.

## Core public pages/routes

All routes are wired in `artifacts/primeopp/src/App.tsx` and backed by real component
files (none are 404 stubs):

| Route | Page | Status |
|---|---|---|
| `/` | `home.tsx` | Real — hero, POD grid, affiliate grid, footer |
| `/product/:id` | `product.tsx` | Real — size/color picker |
| `/cart` | `cart.tsx` | Real |
| `/order-success` | `order-success.tsx` | Real |
| `/collections`, `/category/:category`, `/search` | `catalog.tsx` | Real — fetches live products, derives categories client-side |
| `/account` | `customer.tsx` (`AccountPage`) | Real — hits `GET /api/loyalty/:email` |
| `/orders` | `customer.tsx` (`CustomerOrdersPage`) | **Placeholder** — static text directing customers to email support; no order-lookup UI |
| `/wishlist` | `customer.tsx` (`WishlistPage`) | **Local-only** — no persistence beyond a page-load fetch; explicitly labeled "local to your browser" in the UI copy itself |
| `/recently-viewed` | `customer.tsx` (`RecentlyViewedPage`) | **Local-only** — reads `localStorage["primeopp_recent_products"]`; nothing writes to that key was found in the files read this session |
| `/terms`, `/privacy`, `/refund-policy`, `/shipping-policy`, `/about`, `/contact`, `/faq` | `terms.tsx`, `privacy.tsx`, `static-pages.tsx` | Real, static content |
| `/maintenance`, `/500` | `static-pages.tsx` | Real static pages; not verified whether anything routes to them automatically on an actual 500 |
| `/admin/login`, `/admin`, `/admin/dashboard`, `/admin/orders` | `admin-*.tsx` | Real, cookie-session gated |

## Catalog/product surface

- `GET /api/products`, `GET /api/products/:id` — public, real, backed by Postgres
  (`artifacts/api-server/src/routes/products.ts`)
- `POST/PUT/DELETE /api/products*` — real, gated by `requirePermission("products:write"/"products:delete")`
- Reviews: `GET/POST /api/products/:id/reviews`, `POST /api/reviews/:id/helpful` — real,
  public read/write except `GET /api/admin/reviews` (admin-only) — all in `revenue.ts`
- Recommendations: `GET /api/products/:id/recommendations` — real, public
- Both `pod` and `affiliate` product types are handled end-to-end in the storefront per
  `README.md`'s description, corroborated by `ProductCard.tsx` being referenced from
  every product-listing page read this session.

## Purchase/order flow status

- **Real, end-to-end in code:** cart → `POST /api/checkout/session` (server-side price
  lookup) → Stripe-hosted Checkout → `POST /api/webhook` (signature-verified) → order
  persisted → fulfillment attempted → confirmation email attempted → `/order-success`.
- **Abandoned cart:** `POST /api/abandoned-cart` capture + `POST /api/admin/abandoned-carts/process-due`
  processing exist (`revenue.ts`) — not verified this session whether anything schedules
  the "process-due" call automatically (no cron/scheduler config was located for it).
- **Discounts:** `POST /api/discounts/quote` exists; not verified whether checkout
  actually applies a quoted discount (would require reading `checkoutSessionSchema` and
  the checkout handler body in full, which was only grep-scanned this session, not fully
  read).
- **Fulfillment retry:** `POST /api/orders/:id/retry-fulfillment` and
  `POST /api/orders/fulfillment-jobs/process-due` exist, admin-gated.

## Admin/operator surface

- `/admin` (product CRUD + image upload per README), `/admin/dashboard`
  (`requirePermission("orders:read")`), `/admin/orders`, `/admin/audit-log`
  (`requirePermission("audit:read")`) — all real, cookie+CSRF gated, backed by an
  `admin_sessions` table with idle + absolute timeout and audit logging
  (`createAuditLog`).
- Initial owner account is seeded from `ADMIN_EMAIL`/`ADMIN_PASSWORD` env vars via
  `seedInitialAdminUser()` — this only runs if something calls it at boot; the boot
  wiring itself (`index.ts`) was not read this session, so **whether seeding actually
  happens automatically on first deploy is unconfirmed**, not "verified real."

## Required env vars (hard requirement, confirmed in `env.ts`)

The API process **will not boot** without all six:
- `DATABASE_URL`
- `SESSION_SECRET` (min 32 chars)
- `ADMIN_EMAIL`
- `ADMIN_PASSWORD` (min 12 chars)
- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`

Optional, but required for full functionality (each degrades gracefully to "skipped" +
log line if absent — confirmed in `fulfillment.ts`/`email.ts`):
- `PRINTFUL_API_KEY` and/or `TAPSTITCH_API_KEY` — no fulfillment without at least one
- `RESEND_API_KEY`, `FROM_EMAIL` — no confirmation emails without both
- `ALLOWED_ORIGINS` — defaults to open CORS if unset (fine for staging, unsafe as a
  permanent production setting — flagged, not fixed, per mission scope)

No `.env.example` file exists for `artifacts/api-server` or `artifacts/primeopp` — the
required-var list above had to be reconstructed from `env.ts` and grep, not read from a
template. This is itself a POD-readiness gap: there is nothing an operator can copy to
start filling in secrets.

## Database/storage assumptions

- **Hard blocker:** the real schema exists only as 6 unrun raw-SQL files in
  `lib/db/migrations/` (`0001_base_schema.sql` … `0006_revenue_engine.sql`). No migration
  runner, script, or reference to these files was found anywhere in the repo (search was
  repo-wide, excluding `node_modules`). **The API cannot function against a fresh
  database until these are applied manually** (e.g. `psql $DATABASE_URL -f
  lib/db/migrations/0001_base_schema.sql` etc., in order) — this is a manual DBA step,
  not automated by anything in this repo today.
- `lib/db` (the pnpm-workspace Drizzle package) is an unrelated stub (`export {}`) — do
  not confuse it with the real schema; the real API talks to Postgres directly via `pg`
  in `artifacts/api-server/src/lib/db.ts`, using the raw-SQL migrations above.
- Connection pooling is configured defensively (max 20, 5s connect timeout, 10s query
  timeout, pool errors logged not swallowed) — this part is production-reasonable as-is.

## Email/notification dependencies

- Resend (`RESEND_API_KEY`) for order confirmations — optional at boot, required for the
  feature to work; domain must be verified in Resend before `FROM_EMAIL` on that domain
  delivers (see `PRIMEOPP_DOMAIN_READINESS.md`).
- `notificationQueue.ts` and `fulfillmentQueue.ts` exist in `api-server/src/lib/` —
  present but not read in detail this session; their existence suggests queued/retryable
  processing, but whether anything drains these queues automatically (cron, worker
  process) was not confirmed.

## Payment dependencies

- Stripe only. `STRIPE_SECRET_KEY` + `STRIPE_WEBHOOK_SECRET` both hard-required at boot
  (not optional, unlike fulfillment/email). No other payment provider referenced anywhere.
- Webhook handler explicitly hard-fails unverified calls in production
  (`README.md` claim, corroborated by `webhookSecret` check in `orders.ts:295-302` — full
  branch not read line-by-line this session, treat as **PARTIAL** confirmation, not full).

## Launch blockers (ranked)

1. **Database has no applied schema and no runner.** Nothing works until the 6 migration
   files are applied to a real Postgres instance and `DATABASE_URL` points to it.
2. **No `.env.example` for either app** — operator has to reconstruct the required-var
   list from source (as this document just did) rather than from a template.
3. **Domain is a placeholder** (`primeopp.com`) baked into ~6 files with no central
   config — see `PRIMEOPP_DOMAIN_READINESS.md`.
4. **Stripe/Printful/Tapstitch/Resend credentials** are all currently unset (no evidence
   otherwise) — checkout, fulfillment, and email all need live keys before a real
   customer can complete a purchase end-to-end.
5. **Initial admin seeding path unconfirmed** — `seedInitialAdminUser()` exists but its
   invocation at boot was not verified this session.
6. **`/orders` customer self-service is a stub** (email-support-only) and
   `/wishlist`/`/recently-viewed` are local-only with no account system — acceptable for
   a v1 launch, but worth flagging as a scope decision rather than an oversight.
7. **`artifacts/mockup-sandbox` build failure** (pre-existing, documented in last
   session's `PRIMEOPP_IMPLEMENTATION_REPORT.md`) blocks a clean `pnpm run build` at the
   root — unrelated to POD/domain readiness directly, but would surface in any CI gate
   that runs the full recursive build.
