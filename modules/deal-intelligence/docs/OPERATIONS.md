# Operations

## Verify

```bash
npm run verify
```

Runs: clean build, typecheck, lint, all tests, JSON Schema validation,
package-export validation, 19 runtime proofs, documentation-link
validation. Produces evidence files under `evidence/`.

## Package

```bash
npm run package
```

Produces `primeopp-deal-intelligence.zip` (excludes `node_modules/`,
`dist/`, `.git/`, the zip itself, `cleanroom-verify/`, `*.tsbuildinfo`,
and `evidence/*.json`).

## Clean-room verify

```bash
npm run cleanroom-verify
```

Extracts the ZIP into `cleanroom-verify/`, runs `npm install` from the
lockfile, runs `npm run verify`, and confirms:
- All required files exist
- No secrets, `.env` files or private credentials
- All test adapters are labeled test-only
- No package requires a paid provider or live retailer to verify

## Clean

```bash
npm run clean
```

Removes `dist/` directories and `cleanroom-verify/`.
