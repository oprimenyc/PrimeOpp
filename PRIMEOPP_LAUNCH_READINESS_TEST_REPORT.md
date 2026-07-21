# PrimeOpp Launch Readiness — Test Report

| Check | Scope | Result | Notes |
|---|---|---|---|
| Typecheck | root (`pnpm run typecheck`) — `artifacts/api-server`, `artifacts/primeopp`, `artifacts/mockup-sandbox`, `scripts` | **PASS** (4/4) | Clean both before and after this session's edits |
| Build | `artifacts/api-server` | **PASS** | esbuild bundle, 1.2mb, 511ms |
| Build | `artifacts/primeopp` (storefront) | **PASS** | Was previously blocked by a hard `PORT`/`BASE_PATH` requirement in `vite.config.ts` even for `build`; fixed this session; verified with no env vars set |
| Build | `artifacts/mockup-sandbox` | **FAIL (pre-existing, not fixed)** | Same `PORT` requirement; attempted the identical fix, it broke that package's typecheck (custom plugin type doesn't satisfy the async-config overload) — reverted rather than debug an out-of-scope internal dev tool under time-box |
| Lint | `modules/commerce-core` (`npm run lint`, via `verify:proofs` proof #03) | **PASS** | No lint issues |
| Lint | root / `artifacts/*` | **NOT CONFIGURED** | No `lint` script defined at root or in either shipping app's `package.json` |
| Unit tests | `modules/commerce-core` (`npm run test:unit`, direct) | **PASS** | 269/269, 0 failed |
| Unit tests | `artifacts/api-server`, `artifacts/primeopp` | **NOT CONFIGURED** | Neither package defines a `test` script |
| `commerce-core` 24-point runtime proof (`npm run verify:proofs`) | `modules/commerce-core` | **PASS** | 24/24 proofs, after fixing the script that generates this exact report (see implementation report) |
| Secret scan | full session diff + new `.env.example` | **PASS** | No live-secret patterns found; no `.env` files tracked/staged |

## Regression found and fixed (not a new regression introduced by this session — pre-existing, caught and corrected)

`modules/commerce-core`'s evidence generator (`scripts/verify.ts`) was silently reporting 0 passing tests (should have been 269) due to a reporter-format mismatch in its output-parsing regex, and its `verify:proofs` npm alias pointed at a file that doesn't exist (`scripts/run-proofs.ts`) — meaning this exact drift could never have been caught by running the documented command, only by running the test suite directly and comparing. Both fixed; see [PRIMEOPP_LAUNCH_READINESS_IMPLEMENTATION_REPORT.md](PRIMEOPP_LAUNCH_READINESS_IMPLEMENTATION_REPORT.md).

## Overall

TESTS: PASS (for everything that has tests configured)
TYPECHECK: PASS
LINT: PASS WHERE CONFIGURED / NOT CONFIGURED ELSEWHERE
BUILD: PASS for both customer-facing apps (`api-server`, `primeopp`); FAIL for the unrelated internal `mockup-sandbox` tool (pre-existing, undisturbed)
SECRET SCAN: PASS
