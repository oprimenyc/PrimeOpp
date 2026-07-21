# PrimeOpp Launch Readiness — Current Truth

Repo-local, provider-free launch readiness pass. No provider mutation, no DNS, no deployment.

## Session facts

- **Repo path**: `C:\Users\jp718\Documents\GitHub\PrimeOpp`
- **Branch**: `integration/full-primeopp-platform`
- **Starting HEAD**: `13a405fbe5f3ef24aea2df42f26e787b42c2159f` ("remove replit deployment assumption")
- 10 commits ahead of `origin/integration/full-primeopp-platform`, not pushed this session.

## Dirty tree at session start

```
M modules/commerce-core/evidence/PACKAGE_RESULTS.json
M modules/commerce-core/evidence/RUNTIME_VERIFICATION.md
M modules/commerce-core/evidence/TEST_RESULTS.json
```

These three files were already modified (uncommitted) when this session began — carried over from a prior `commerce-core` verify run. They are **preserved, not staged, and not discarded** by this session, per mission instructions. See [PRIMEOPP_LAUNCH_READINESS_IMPLEMENTATION_REPORT.md](PRIMEOPP_LAUNCH_READINESS_IMPLEMENTATION_REPORT.md) for what this session found inside them (a real evidence-generation bug, now fixed at the source) and why they were left unstaged rather than committed as part of this mission's diff.

## Existing completed work (prior sessions, read not redone)

- Catalog ingestion pipeline (intake → enrichment → identity → canonical catalog) — `PRIMEOPP_IMPLEMENTATION_REPORT.md`, `PRIMEOPP_RUNTIME_PROOF.md`, `PRIMEOPP_TEST_REPORT.md` (commit `a9dcdbc`).
- Domain/POD discovery pass — `PRIMEOPP_DOMAIN_POD_CURRENT_TRUTH.md`, `PRIMEOPP_DOMAIN_POD_NEXT_SESSION_HANDOFF.md`, `PRIMEOPP_POD_READINESS.md` (commit `6118b86`).
- Replit classification — `PRIMEOPP_REPLIT_CLASSIFICATION_CURRENT_TRUTH.md`, `PRIMEOPP_REPLIT_CLASSIFICATION_PROOF.md` (commit `13a405f`).
- Two independent product/ops audits — `AUDIT.md` (storefront/API, 2026-06-24, D+ overall) and `AUDIT_PHASE2.md` (ops/enterprise-admin, all F).

This session builds on that work rather than repeating it — see individual docs below for what's new.

## Repo shape (confirmed by direct inspection, not docs)

- `artifacts/` is the actual shippable product: `artifacts/primeopp` (React/Vite storefront), `artifacts/api-server` (Express 5 API), `artifacts/mockup-sandbox` (internal design-mockup tool, not customer-facing).
- `lib/` is shared pnpm-workspace packages (`db`, `api-spec`, `api-zod`, `api-client-react`).
- `modules/` is donor/staging code (6 packages including `commerce-core`) — confirmed **not** part of the root `pnpm-workspace.yaml` and not imported by anything under `artifacts/`. It is a separate, independently-tooled toolkit, not a running service.
- Root pnpm workspace covers `artifacts/*`, `lib/*`, `lib/integrations/*`, `scripts` only.

## Current blockers (see [PRIMEOPP_LAUNCH_BLOCKERS.md](PRIMEOPP_LAUNCH_BLOCKERS.md) for the full map)

Top of the list: no DB migration runner exists anywhere in the repo (schema is unrun raw SQL), no `.env.example` existed for the two apps that actually ship (fixed this session), deployment target is explicitly undecided, and `mockup-sandbox`/dev-only builds still hard-require Replit-style `PORT`/`BASE_PATH` env vars even to run `vite build`.

## Customer-facing surfaces found

Full detail in [PRIMEOPP_PRODUCT_SURFACE_AUDIT.md](PRIMEOPP_PRODUCT_SURFACE_AUDIT.md). Short version: catalog, product detail, cart, checkout (real Stripe integration, not a placeholder), order confirmation via webhook, admin panel with cookie+CSRF auth, and loyalty/recently-viewed are **real and working**. Customer order lookup, wishlist, and support/contact are **placeholders** with static "contact support" copy standing in for real functionality.

## Deployment target status

**Undecided.** No change made this session. See [PRIMEOPP_NON_REPLIT_LAUNCH_PATH.md](PRIMEOPP_NON_REPLIT_LAUNCH_PATH.md).

## Replit classification status

Unchanged from `PRIMEOPP_REPLIT_CLASSIFICATION_CURRENT_TRUTH.md`: dev/provenance workspace only, not an approved staging/production target. This session found and fixed two places where docs (`replit.md`) implied otherwise (stale JWT/localStorage auth claim, and a claim that Replit "automatically provides" `DATABASE_URL` and "handles production migrations") — both corrected to state the true, more restrictive picture.

## Confirmed before edits

- No live provider action was required or taken (no Stripe/DB/DNS/hosting calls made).
- No deployment target was selected or configured.
