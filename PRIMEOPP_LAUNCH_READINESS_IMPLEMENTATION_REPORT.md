# PrimeOpp Launch Readiness — Implementation Report

## Files read (non-exhaustive, primary sources)

- Root: `package.json`, `pnpm-workspace.yaml`, `.replit`, `replit.md`, `README.md`, `.gitignore`
- `artifacts/api-server/src/lib/env.ts`, `app.ts`, `routes/{products,orders,auth,admin,revenue,health}.ts`, `lib/{fulfillment,email,db}.ts`
- `artifacts/primeopp/src/{App.tsx,pages/*.tsx,lib/cart.ts}`, `vite.config.ts`
- `artifacts/mockup-sandbox/vite.config.ts`, `mockupPreviewPlugin.ts`
- `modules/commerce-core/{package.json,scripts/verify.ts}`, `evidence/{TEST_RESULTS.json,RUNTIME_VERIFICATION.md,PACKAGE_RESULTS.json,SECURITY_RESULTS.json,WORKFLOW_RESULTS.json}`
- Existing readiness docs: `AUDIT.md`, `AUDIT_PHASE2.md`, `PRIMEOPP_CURRENT_TRUTH.md`, `PRIMEOPP_DOMAIN_READINESS.md`, `PRIMEOPP_DOMAIN_POD_*.md`, `PRIMEOPP_POD_READINESS.md`, `PRIMEOPP_REPLIT_CLASSIFICATION_*.md`
- `modules/*/.env.example` (3 existing files, for convention reference)

## Files changed

| File | Change | Why |
|---|---|---|
| `modules/commerce-core/scripts/verify.ts` | Broadened test-count regex from `ℹ pass\s+(\d+)` / `ℹ fail\s+(\d+)` to also match `# pass\s+(\d+)` / `# fail\s+(\d+)` | Root cause of evidence claiming 0 passing tests when 269 actually pass — Node's `--test` non-TTY (piped) output uses the tap-style `#` prefix, not the spec-style `ℹ` prefix the regex expected |
| `modules/commerce-core/package.json` | `verify:proofs` script: `node scripts/run-proofs.ts` → `node scripts/verify.ts` | The referenced file doesn't exist; the real evidence generator is `scripts/verify.ts`. This is why the regression above was never caught — the documented command has never run successfully |
| `artifacts/primeopp/vite.config.ts` | `PORT`/`BASE_PATH` env vars are now only required for `command === "serve"` (dev/preview), not for `build`; `BASE_PATH` defaults to `"/"` | A plain `vite build` doesn't bind a port or need a non-root base path — the old code threw at config-eval time regardless of command, blocking any local/CI build without Replit-shaped env vars. This is also a real step toward a non-Replit launch path (see below) |
| `replit.md` | Corrected 3 stale claims: (1) auth described as "JWT stored in localStorage" → actual is httpOnly session cookie + rotating CSRF token; env var name corrected `ADMIN_USERNAME` → `ADMIN_EMAIL`; (2) "`DATABASE_URL`... automatically provided by Replit" → clarified it must be set manually outside the Replit dev workspace; (3) "Production migrations are handled by Replit when publishing" → removed (false — no migration runner exists anywhere in the repo, on Replit or otherwise) and replaced with an explicit note that Replit is dev/provenance only | Doc was asserting both an incorrect auth mechanism and, more importantly for this mission, implying Replit is a production deployment mechanism — directly contradicts the mission's Replit classification requirement |
| `artifacts/api-server/.env.example` (new) | Documents all 6 required + 6 optional env vars read by `src/lib/env.ts`, `app.ts`, `fulfillment.ts`, `email.ts` — no values, comments only | No env template existed for either shipping app; the convention already exists in 3 `modules/*` packages, extended to the app that actually needs it most |

## Files NOT changed (considered, rejected)

- `artifacts/mockup-sandbox/vite.config.ts` — attempted the identical `PORT`/`BASE_PATH` fix; it introduced a new TS overload-resolution failure (`No overload matches this call... has no properties in common with type 'UserConfig'`) traced to the async-config-function form not typechecking cleanly against this package's custom `mockupPreviewPlugin()` return type. Reverted to the original file content (confirmed byte-identical via `git diff` after restoring, then `git checkout --` to clear a line-ending-only diff). Not customer-facing, not worth debugging further under this mission's time-box.
- `.replit` — deployment config, explicitly out of scope regardless of the fact that it's missing an `[[artifacts]]` entry for the actual storefront. Flagged in the blocker map instead.
- Migration runner — genuinely missing, but building one is a real feature/infra project, not a "wiring fix." Flagged, not attempted.
- Wishlist / order-lookup / support-contact real implementations — product decisions requiring explicit scope approval, not cleanup. Flagged, not attempted.
- `GET /api/loyalty/:email` unauthenticated lookup — touches auth behavior, which the mission's own boundaries (and PrimeOS Constitution §3) require asking before changing. Flagged, not attempted.

## Commands run (see [PRIMEOPP_LAUNCH_READINESS_PROOF.md](PRIMEOPP_LAUNCH_READINESS_PROOF.md) for full output)

`pnpm run typecheck`, `pnpm --filter ./artifacts/api-server run build`, `pnpm --filter ./artifacts/primeopp run build`, `pnpm run build` (full, to observe the pre-existing mockup-sandbox failure), `npm run test:unit` and `npm run verify:proofs` inside `modules/commerce-core`, a direct reproduction of the evidence generator's `spawnSync` call to confirm the reporter-format hypothesis before editing anything, `git diff`/`git status` at each step, a secret-pattern grep over the full session diff.

## Exit codes

All fix-verification commands (typecheck, api-server build, primeopp build, commerce-core test:unit, commerce-core verify:proofs) exited 0. `pnpm run build` (full recursive) exited non-zero solely due to the pre-existing, unfixed `mockup-sandbox` PORT requirement.

## Blockers remaining

Full list in [PRIMEOPP_LAUNCH_BLOCKERS.md](PRIMEOPP_LAUNCH_BLOCKERS.md). Headline items: no DB migration runner, deployment target undecided, three customer-facing placeholder surfaces, unauthenticated loyalty-email lookup, `.replit` missing the storefront artifact entry.

## No provider mutation / no DNS / no deployment / no secrets exposed

Confirmed — see proof log. Replit was read for classification purposes only, never used as a deploy/test target this session.
