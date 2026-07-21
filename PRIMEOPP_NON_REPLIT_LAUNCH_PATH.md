# PrimeOpp Non-Replit Launch Path Classification

## Statement

- **Replit is dev/provenance only.** It is the current development workspace (`.replit`, `replit.md`, `@replit/vite-plugin-*` dev plugins) and nothing more.
- **The actual staging/production deployment target is undecided.** No target has been selected, configured, or implied by this session's work.
- **Deployment target selection requires separate approval.** This session did not select one, and does not recommend one over another — that decision belongs to a dedicated deploy-planning session with the user's explicit sign-off.
- **DNS/domain mutation requires separate approval.** Not touched this session.
- **Provider env mutation requires separate approval.** Not touched this session — no live credentials were set, viewed as plaintext, or transmitted anywhere.
- **Launch cannot be declared complete from Replit workspace origin.** Replit having a working dev preview is not evidence of production readiness on any other host.

## What this session changed to make a non-Replit path more viable (repo-local only)

- `artifacts/primeopp/vite.config.ts` no longer hard-requires Replit-shaped `PORT`/`BASE_PATH` env vars just to run `vite build` — a plain `vite build` now produces a portable, root-relative (`base: "/"`) static bundle usable by any static host or reverse proxy, not just a Replit-flavored runtime. Verified: `pnpm --filter ./artifacts/primeopp run build` succeeds with a clean environment (no `PORT`/`BASE_PATH` set).
- `artifacts/api-server/.env.example` now documents every env var the server needs to boot, independent of Replit's env auto-injection.
- `replit.md` no longer implies Replit auto-provides `DATABASE_URL` or handles production migrations — corrected to state plainly that no migration runner exists yet, on Replit or elsewhere.

None of this selects, configures, or contacts an actual deployment provider.

## Recommended neutral categories (not a decision)

Deferred to a separate deploy mission. Listed as categories only, no live comparison or config for any of them was performed:

- Railway
- Fly.io
- Vercel
- A custom VPS
- Some other approved target the user names later

## What that future deploy mission will need (repo-local prerequisites, tracked in [PRIMEOPP_LAUNCH_BLOCKERS.md](PRIMEOPP_LAUNCH_BLOCKERS.md))

1. A real DB migration runner (none exists — schema is unrun raw SQL).
2. Live values for the 6 required env vars in `artifacts/api-server/.env.example`, sourced from whichever provider is chosen.
3. `.replit`'s `[[artifacts]]` list currently omits `artifacts/primeopp` entirely — worth resolving (either by fixing `.replit` for continued dev use, or by simply not depending on it once a real deploy target exists). Not touched this session (deployment config).
4. A decision on `primeopp.com` domain purchase/DNS, independent of hosting choice.
