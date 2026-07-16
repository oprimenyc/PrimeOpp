# PrimeOpp Deal Intelligence Platform

Production-oriented, reusable TypeScript monorepo for retail deal discovery,
historical pricing, opportunity scoring, affiliate routing and automated alerts.

## Quick start

```bash
npm install
npm run verify
```

## What this is

A provider-agnostic, retailer-agnostic, tenant-aware deal intelligence platform
that continuously discovers, normalizes, evaluates and distributes deeply
discounted, hard-to-find, clearance, restock and resale opportunities.

## Package layout

30 workspace packages under `packages/`:
- `contracts` — canonical TypeScript types
- `schemas` — JSON Schema definitions
- `retailer-registry` — 20 starter retailers (Amazon, Walmart, Target, ...)
- `source-ingestion`, `crawler-contracts`, `browser-contracts`, `feed-contracts`
- `product-normalization`, `offer-normalization`
- `coupon-engine`, `promotion-engine`
- `historical-pricing`, `availability-engine`, `restock-engine`, `rarity-engine`
- `deal-validation`, `deal-scoring`, `resale-opportunity`
- `affiliate-engine`, `alert-engine`, `publishing-contracts`, `amos-contracts`
- `community-submissions`, `tenant-config`, `evidence`, `observability`
- `adapter-sdk`, `adapter-testkit`
- `sdk` — public facade
- `cli` — command-line interface

## Key principles

- No silent failures. Every fallback identifies that it executed and why.
- Every job terminates in an explicit state.
- Runtime evidence outweighs documentation claims.
- No retailer in the registry claims live scraping support.
- All test adapters are explicitly labeled `testOnly: true`.
- Affiliate relationships are always disclosed.
- Coupon stacking preserves uncertainty.
- Scarcity is never fabricated.

## CLI

```bash
npm run build
node packages/cli/dist/index.js demo
node packages/cli/dist/index.js retailers list
node packages/cli/dist/index.js --json doctor
```

## Verification

`npm run verify` runs: clean build, typecheck, lint, all tests, JSON schema
validation, package-export validation, and 19 runtime proofs (retailer
registry, source ingestion, product normalization, coupon stack, fake-discount
detection, historical pricing, availability, restock, deal validation, deal
scoring, resale opportunity, affiliate disclosure, alert, duplicate
suppression, dead-deal correction, community moderation, tenant isolation,
malicious-link rejection, AMOS job) plus documentation-link validation.

## Packaging

`npm run package` produces `primeopp-deal-intelligence.zip`.
`npm run cleanroom-verify` extracts the ZIP into a fresh directory, installs
from the lockfile, runs verify, and confirms no secrets / no .env files /
test-only adapters labeled / no live-retailer dependencies.

## License

Apache-2.0
