# PrimeOpp Domain / POD — Next Session Handoff

This was a no-code discovery pass. Nothing was implemented, deployed, or provisioned.
See `PRIMEOPP_DOMAIN_POD_CURRENT_TRUTH.md`, `PRIMEOPP_DOMAIN_READINESS.md`, and
`PRIMEOPP_POD_READINESS.md` for the full findings this summarizes.

## What is ready

- Storefront, checkout, webhook, fulfillment (Printful/Tapstitch), email (Resend), admin
  panel (cookie+CSRF sessions, audit log), reviews, recommendations, abandoned-cart,
  discounts, and loyalty are all **real, wired code** — not stubs, not mockups. This is
  substantially more complete than `README.md`'s own "Project Structure" section
  describes (it's stale — missing `revenue.ts`, `catalog.tsx`, `customer.tsx`,
  `static-pages.tsx`, and several routes entirely).
- Required legal/footer pages (`/terms`, `/privacy`, `/refund-policy`, `/shipping-policy`,
  `/about`, `/contact`, `/faq`) exist with real content.
- Env-var enforcement is strict and fails loudly (Zod schema, hard boot failure) rather
  than silently running in a broken state.
- Fulfillment and email both degrade gracefully (log + skip) rather than crash when their
  optional API keys are absent — orders are still saved.

## What is blocked

1. **No applied database schema, no migration runner.** 6 raw-SQL files exist in
   `lib/db/migrations/`; nothing in the repo applies them. This blocks everything else —
   the app cannot serve real data without a database first being provisioned and migrated.
2. **No `.env.example` for `artifacts/api-server` or `artifacts/primeopp`.** An operator
   has no template to copy; the required-var list currently only exists by reading
   `env.ts` source (reconstructed in `PRIMEOPP_POD_READINESS.md`).
3. **Domain is an unregistered placeholder** (`primeopp.com`), hardcoded in ~6 files with
   no single source of truth (`FROM_EMAIL` default, `support@primeopp.com` contact links,
   social handles, `README.md`'s `ALLOWED_ORIGINS` example).
4. **No live credentials** for Stripe, Printful/Tapstitch, or Resend confirmed present —
   checkout/fulfillment/email cannot complete a real transaction until these are set.
5. **No deploy provider config beyond `.replit`** — if the plan is to deploy anywhere
   other than Replit's own autoscale target, that config doesn't exist yet.
6. **`seedInitialAdminUser()`'s boot-time invocation was not confirmed** — worth a direct
   read of `artifacts/api-server/src/index.ts` before assuming the first-owner-account
   flow works unattended.

## Safest next implementation prompt

> "Write and wire a Postgres migration runner for `lib/db/migrations/*.sql` (a plain
> ordered-apply script is sufficient — no need for a new ORM), add `.env.example` files
> for `artifacts/api-server` and `artifacts/primeopp` listing every var documented in
> `PRIMEOPP_POD_READINESS.md`, and confirm (read, don't assume) whether
> `seedInitialAdminUser()` is actually invoked at API boot in
> `artifacts/api-server/src/index.ts`. No domain purchase, no provider signup, no secret
> values — this is groundwork only."

This is deliberately scoped to remove blockers #1, #2, and #6 above without touching
anything requiring money, DNS, or a provider account — it's the highest-leverage, lowest-risk
next step.

## What must wait for domain purchase

- Registering `https://<domain>/api/webhook` in the Stripe Dashboard
- Verifying the sending domain in Resend (SPF/DKIM)
- Setting `ALLOWED_ORIGINS` to the real production origin
- Attaching a custom domain at the approved production host once one is selected (deployment target is currently UNDECIDED — see `PRIMEOPP_REPLIT_CLASSIFICATION_CURRENT_TRUTH.md`; Replit is PrimeOpp's current dev-stack host only, not an approved deploy target)
- Any find-and-replace of the `primeopp.com` placeholder strings, if the final domain
  differs

## What must wait for Foundry email QA harness integration

Per the prior session's `PRIMEOPP_NEXT_SESSION_HANDOFF.md`: running the completed PrimeOpp
revenue workflow through VERIDIAN admission and Foundry governance is gated on a paused
VERIDIAN integration being committed elsewhere — not on anything in this repo. That
gating is unchanged by this session; VERIDIAN, Foundry, and PrimeOS were not touched here
either (read-only, per standing instructions).
