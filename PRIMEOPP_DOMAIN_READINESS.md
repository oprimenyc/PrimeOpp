# PrimeOpp Domain Readiness

No-code discovery only. No domain was purchased, no DNS was touched, no provider was
configured. This documents what the codebase assumes/needs before a domain purchase makes
sense.

## Likely public brand

- **Brand name in code:** "PrimeOpp" — used in the storefront footer (`© {year} PrimeOpp.
  All rights reserved.`), page titles/SEO (`home.tsx`), and `README.md`.
- **Aesthetic:** "Premium edgy streetwear e-commerce + affiliate marketing store,
  black/red brutalist" per `README.md` line 3 — consistent with the actual Tailwind theme
  referenced in code (`bg-black`, `text-red-600`-style classes seen in `catalog.tsx`,
  `home.tsx`).

## Domain candidates already referenced in code

- `primeopp.com` — the **only** domain string present anywhere in the codebase, and it is
  used as a placeholder/assumed value, not evidence of ownership:
  - `orders@primeopp.com` — default `FROM_EMAIL` fallback in `artifacts/api-server/src/lib/email.ts:123,148`
  - `support@primeopp.com` — hardcoded contact address in `terms.tsx`, `privacy.tsx`,
    `static-pages.tsx`, `home.tsx` (footer + mailto link)
  - `https://primeopp.com` — the example value for `ALLOWED_ORIGINS` in `README.md`'s
    Go-Live checklist
- Social handles assumed but unverified: `instagram.com/primeopp`, `tiktok.com/@primeopp`
  (`home.tsx:55,248-249`) — no code checks whether these accounts exist.

**No alternate domain candidates appear anywhere in the repo.** If `primeopp.com` is
unavailable or undesired, every one of the above locations needs a coordinated find-and-replace
before or immediately after picking a different domain — this is not currently
centralized into one config value (no `SITE_URL` / `PUBLIC_DOMAIN` env var was found
governing these strings).

## Required DNS / provider assumptions

- **Deployment target:** `.replit` configures Replit's own `autoscale` deployment
  (`[deployment] router = "application"`, `deploymentTarget = "autoscale"`). No Vercel,
  Railway, Fly.io, or Cloudflare config exists in the repo (confirmed by search — see
  `PRIMEOPP_DOMAIN_POD_CURRENT_TRUTH.md`). A custom domain would need to be attached via
  **Replit's own custom-domain feature**, or the app would need to be deployed to a
  different provider first — that is a provider-console action, not something this repo
  controls.
  **Classification (see `PRIMEOPP_REPLIT_CLASSIFICATION_CURRENT_TRUTH.md`): the above is a
  factual description of the current dev-stack host only, not a deployment
  recommendation. PrimeOpp's approved production/staging deployment target is
  UNDECIDED — Replit must not be treated as the launch target, and a real host (e.g.
  Railway, per this ecosystem's own `ecosystem-hosting-target-map.md`) needs an explicit
  founder decision before a domain is attached anywhere.**
- **Stripe webhook endpoint:** `README.md`'s Go-Live checklist calls for registering
  `https://your-domain/api/webhook` in the Stripe Dashboard once a domain exists — this
  is a manual Stripe-console step, not code.
- **CORS:** `artifacts/api-server/src/app.ts:35-39` reads `ALLOWED_ORIGINS` (comma-separated)
  and restricts CORS to it; currently unset in any committed env file (no `.env.example`
  exists for `artifacts/api-server` — see Task 2 for the full required-env-var list).

## Required email sender/domain needs

- `RESEND_API_KEY` and `FROM_EMAIL` are both optional at boot (fulfillment/email
  gracefully skip if unset — see Current Truth doc) but **required for order confirmation
  emails to actually send**.
- `FROM_EMAIL` must be an address on a domain verified inside Resend's dashboard (per
  `README.md`'s own instructions) — i.e., whatever domain is chosen needs its DNS
  (SPF/DKIM records) configured in Resend before `FROM_EMAIL` can be set to an address on
  that domain. This is a Resend-console + DNS-provider action, not code.
- Default fallback sender (`orders@primeopp.com`) will silently fail Resend delivery if
  the domain is never verified there — `email.ts` does not validate the domain is
  verified before attempting to send; a send failure there is only logged, not surfaced
  to the customer or order record (see `PRIMEOPP_POD_READINESS.md` for the fuller
  implication).

## Required legal/footer/contact pages

Already implemented in code (real, not stubs):
- `/terms` (`terms.tsx`) — includes a returns/refund clause referencing `support@primeopp.com`
- `/privacy` (`privacy.tsx`) — data retention (3 years) and rights-to-delete clauses,
  also referencing `support@primeopp.com`
- `/refund-policy`, `/shipping-policy` (`static-pages.tsx`)
- `/about`, `/contact`, `/faq` (`static-pages.tsx`)
- Footer social links + contact email (`home.tsx`)

**Not verified this session (would require legal review, out of scope for a no-code
discovery pass):** whether the Terms/Privacy content is legally sufficient for the actual
jurisdiction(s) PrimeOpp intends to sell into, or whether `support@primeopp.com` /
`orders@primeopp.com` are live, monitored inboxes.

## Deployment target candidates

1. **Replit autoscale (current, configured)** — lowest-friction path since `.replit` is
   already set up; custom domain attach is a Replit-console action.
2. **Alternative (Vercel/Railway/Fly/Cloudflare)** — would require writing new provider
   config from scratch (none exists today) and is explicitly out of scope for this repo
   per the write boundary on this mission.

No recommendation is made here between these — that is a product/infra decision for the
user, not something discoverable from the code.

## Blockers before buying the domain

1. **Decide the actual domain name.** `primeopp.com` is a placeholder used consistently
   in code but with no evidence it was checked for availability or reserved.
2. **Decide the deployment target** (Replit vs. elsewhere) — affects how DNS gets pointed
   and whether SSL/CDN setup is automatic (Replit) or manual (self-managed provider).
3. **Resend domain verification** must happen against whatever domain is chosen, before
   `FROM_EMAIL` on that domain will actually deliver.
4. **Stripe webhook re-registration** against the live domain's `/api/webhook` URL —
   cannot be done until the domain resolves to the deployed app.
5. **Database provisioning + migration application** is a hard prerequisite for the app
   to boot at all (see `PRIMEOPP_POD_READINESS.md`) — unrelated to DNS but blocks
   "does the domain even show a working site" once pointed.

None of the above were performed or attempted this session — they are documented as
blockers only.
