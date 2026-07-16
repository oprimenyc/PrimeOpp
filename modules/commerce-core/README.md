# PrimeOpp Commerce Core

> Production-oriented, channel-neutral, business-model-neutral TypeScript commerce foundation.

PrimeOpp Commerce Core is the shared commerce foundation for reseller scanning, product identification, pricing intelligence, profit analysis, inventory management, cross-listing, the PrimeOpp Marketplace, POD, dropshipping, affiliate commerce and enterprise resale operations.

This package is part of the **VERIDIAN** ecosystem. It is independently buildable, provider-agnostic, tenant-aware and ships with a complete self-verification suite.

## What This Is

- A reusable commerce core library
- A multi-package TypeScript monorepo (npm workspaces)
- A deterministic pricing, profit, inventory and opportunity engine
- A canonical product model that does not assume physical ownership
- A CLI and SDK for integration
- A reference implementation with runnable workflows

## What This Is Not

- Not a prototype or mock-only scaffold
- Not a live marketplace connector (adapters are contracts + local test adapters only)
- Not an identity provider or authorization platform
- Not a Foundry, E.V.E., Prime Vault, PrimeOS, AMOS or Browser Operator implementation
- Not a competing event bus or observability platform

## Quick Start

```bash
npm install
npm run build
npm run verify
```

The `npm run verify` command executes a 24-point runtime proof (see `scripts/verify.js`). It exits non-zero if any required proof fails.

## CLI

```bash
node packages/cli/src/index.js <command> [args]
```

Commands include `products resolve`, `barcode validate`, `condition assess`, `pricing calculate`, `profit calculate`, `opportunity score`, `inventory reserve`, `listing create`, `adapters check`, `doctor`, `demo`, `verify`. See `docs/CLI_REFERENCE.md`.

## Packages

| Package | Purpose |
|---|---|
| `@primeopp/contracts` | Canonical TypeScript types — Product, Variant, Condition, Listing, etc. |
| `@primeopp/schemas` | JSON Schemas + runtime validators |
| `@primeopp/barcode` | UPC/EAN/GTIN/ISBN validation, scan events, sessions |
| `@primeopp/ocr-contracts` | Provider-agnostic OCR extraction contracts |
| `@primeopp/image-match-contracts` | Image similarity and visual recognition contracts |
| `@primeopp/product-identity` | Deterministic product identity resolver |
| `@primeopp/canonical-catalog` | Tenant-aware canonical product catalog |
| `@primeopp/variant-engine` | Variant normalization and conflict detection |
| `@primeopp/condition-engine` | Configurable condition assessment |
| `@primeopp/inventory` | Inventory engine with concurrency protection |
| `@primeopp/pricing` | Pricing observations and pricing engine |
| `@primeopp/fee-engine` | Versioned fee schedules |
| `@primeopp/shipping-estimator` | Dimensional weight, zone, packaging |
| `@primeopp/profit-engine` | Profit and ROI calculations |
| `@primeopp/opportunity-engine` | BUY/PASS decision engine |
| `@primeopp/listing-contracts` | Canonical listing model |
| `@primeopp/channel-contracts` | Channel adapter interfaces |
| `@primeopp/commerce-events` | Structured commerce events |
| `@primeopp/tenant-config` | Multi-tenant and enterprise configuration |
| `@primeopp/evidence` | Evidence capture and integrity |
| `@primeopp/adapter-sdk` | Adapter SDK and conformance tests |
| `@primeopp/adapter-testkit` | Local deterministic test adapters |
| `@primeopp/sdk` | High-level SDK |
| `@primeopp/cli` | Command-line interface |

## VERIDIAN Integration Seams

This package exposes stable seams (no implementation) for:
- **Foundry** — canonical execution runtime (via `adapter-sdk` executor contract)
- **E.V.E.** — independent verification (via `evidence` and `verify` command output)
- **Prime Vault** — secret references (via `tenant-config` SecretRef type)
- **PrimeOS / AMOS** — OS/runtime integration (via `commerce-events` and observability contracts)

See `docs/FOUNDRY_INTEGRATION_GUIDE.md`, `docs/EVE_VERIFICATION_GUIDE.md`, `docs/AMOS_INTEGRATION_GUIDE.md`.

## License

Apache-2.0. See `LICENSE`.
