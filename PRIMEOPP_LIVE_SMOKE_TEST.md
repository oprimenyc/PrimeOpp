# PrimeOpp Live Customer Surface Smoke Test — Phase 8

LIVE URL: `https://primeopp-production-a554.up.railway.app`

All checks performed with `curl` against the live Railway deployment. No payment was submitted, no Stripe customer/charge was created, no admin session was established, and no production order/customer records were mutated.

| Route | Method | Result | Status |
|---|---|---|---|
| `/` | GET | Homepage HTML served (SPA) | **200 — PASS** |
| `/api/healthz` | GET | `{"status":"ok"}` | **200 — PASS** |
| `/api/orders/lookup` | POST (nonexistent order) | `{"error":"No order found for that order number and email"}` — honest 404, not a 500 | **404 — PASS** |
| `/api/contact` | POST (valid smoke-test message) | `{"received":true}` — one row written to `contact_messages` (harmless support-inbox test entry, not order/customer/payment data) | **201 — PASS** |
| `/api/checkout/session` | POST (valid cart shape) | `{"error":"Stripe not configured - STRIPE_SECRET_KEY missing"}` — fails closed, no Stripe call, no order marked paid | **503 — PASS (fail-closed as designed)** |
| `/api/webhook` | POST (fake event body) | `{"error":"Stripe not configured - STRIPE_SECRET_KEY missing"}` — fails closed, no order mutation | **503 — PASS (fail-closed as designed)** |
| `/api/orders` | GET (no auth) | `{"error":"not_authenticated"}` — admin API properly protected | **401 — PASS** |
| `/api/auth/login` | POST (wrong credentials) | `{"error":"invalid_credentials"}` — no session issued, no user enumeration leak | **401 — PASS** |
| `/admin`, `/admin/login` | GET | SPA HTML renders (client-side admin login form) | **200 — PASS** |
| Wishlist | N/A | Confirmed by code review (Phase 1) — `localStorage`-only, no server route exists to test live | **LOCAL_ONLY — honest, as designed** |

## Not Done (by design)

- No real Stripe checkout was attempted — Stripe is intentionally unconfigured (`STRIPE_SECRET_KEY`/`STRIPE_WEBHOOK_SECRET` not set), and the routes above prove it fails closed rather than granting paid access.
- No admin login was completed with real credentials — `ADMIN_PASSWORD` was generated and set without ever being printed or retained by this session, so it is not available to test a successful login. The 401 checks above confirm the auth boundary itself (wrong-credential rejection, unauthenticated route protection) without needing the real password.
- No order/customer/provider records were altered — the one `contact_messages` row created by the smoke test is an additive, non-destructive row in a table designed to receive exactly this kind of message.

## Non-Blocking Observation (out of scope, flagged separately)

`GET /api/nonexistent` returned **200 with the SPA's `index.html`** instead of a JSON 404. Root cause: the Express catch-all SPA route (`app.get("/{*splat}", ...)` in `artifacts/api-server/src/app.ts`) is registered before the API-specific 404 handler, so any unmatched `/api/*` path falls through to the SPA instead of the JSON 404. This is pre-existing behavior (not introduced by this session's changes), doesn't affect any of the documented/real API routes above (all of which matched and behaved correctly), and isn't a security issue — it only affects typo'd or undocumented API paths. Flagged as a background task for a future session rather than fixed here, since it's unrelated to the Stripe/DB/deploy scope of this mission.
