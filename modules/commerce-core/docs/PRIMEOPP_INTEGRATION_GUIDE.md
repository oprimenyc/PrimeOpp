# PrimeOpp Integration Guide

This package is the shared commerce foundation for PrimeOpp. Future PrimeOpp application code will depend on this package.

## Integration Seams

### Application Layer

PrimeOpp applications should depend on:

- `@primeopp/sdk` — high-level facade
- `@primeopp/cli` — for command-line tools

### Engine Layer

For finer control, applications can depend on individual engine packages:

- `@primeopp/product-identity` — product resolution
- `@primeopp/canonical-catalog` — product storage
- `@primeopp/inventory` — inventory operations
- `@primeopp/pricing` — pricing
- `@primeopp/profit-engine` — profit calculations
- `@primeopp/opportunity-engine` — opportunity scoring
- `@primeopp/listing-contracts` — listing management
- `@primeopp/channel-contracts` — channel adapters

### Adapter Layer

Real marketplace adapters (eBay, Amazon, etc.) should be implemented as separate packages that depend on `@primeopp/channel-contracts` and `@primeopp/adapter-sdk`.

## Migration Path

1. Pin to a specific version of `@primeopp/*` packages.
2. Use `createSdk()` to bootstrap.
3. Replace test adapters with real adapters as they become available.
4. Swap in-memory storage adapters with persistent (SQLite, Postgres) adapters.
5. Subscribe to `CommerceEventSink` events for telemetry.

## Critical Rules

- Do NOT modify this package's source from within PrimeOpp application code. File issues for needed changes.
- Do NOT bypass tenant isolation guards. They exist for security.
- Do NOT hardcode fee schedules in application code. Use the fee-engine's versioned schedule registry.
