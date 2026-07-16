# PrimeOpp Marketplace & Cross-Listing Platform

A production-oriented, reusable, independently buildable TypeScript monorepo for multi-channel marketplace listing, PrimeOpp Marketplace, orders, offers, inventory sync, commissions, shipping handoffs, and seller operations.

## Quick Start

```bash
npm install
npm run build
npm test
npm run verify
```

## What This Is

PrimeOpp is an AI Commerce Operating System serving individual resellers, power sellers, consignment businesses, pawn shops, thrift stores, sneaker stores, collectible stores, estate-sale operators, liquidation businesses, nonprofits, and enterprise inventory operators.

The platform allows sellers to create one canonical listing and distribute it across:
- **PrimeOpp Marketplace** (first-class destination from day one)
- Supported external marketplace adapters
- Future marketplace providers
- Local selling channels
- Enterprise sales channels

## Key Principles

- No hidden publication
- No deceptive enrollment
- No dark patterns
- Every workflow terminates in an explicit state
- Every completion claim has evidence
- PrimeOpp Marketplace is visible by default, with simple opt-out

## Package Structure

- `packages/contracts` — canonical type contracts
- `packages/schemas` — JSON Schema definitions
- `packages/canonical-listing` — listing state machine
- `packages/channel-registry` — channel manifests
- `packages/listing-transformer` — canonical-to-channel transformation
- `packages/listing-publisher` — multi-channel publication orchestration
- `packages/inventory-sync` — oversell prevention + allocations
- `packages/order-engine` — order state machine + external ingestion
- `packages/commission-engine` — versioned commission policies
- `packages/sdk` — top-level SDK wiring everything together
- `packages/cli` — command-line interface
- `adapters/primeopp-marketplace` — functional local PrimeOpp Marketplace adapter
- `adapters/test-*` — 17 test-only external marketplace adapter stubs

## Channels Supported

1. PrimeOpp Marketplace (first-class, functional)
2. eBay (TEST)
3. Amazon (TEST)
4. Walmart (TEST)
5. Facebook Marketplace (TEST, browser-required)
6. OfferUp (TEST, browser-required)
7. Depop (TEST, browser-required)
8. Poshmark (TEST, browser-required)
9. Mercari (TEST, browser-required)
10. Etsy (TEST)
11. GOAT (TEST)
12. StockX (TEST)
13. Alias (TEST)
14. Flight Club (TEST)
15. Stadium Goods (TEST)
16. Grailed (TEST, browser-required)
17. Whatnot (TEST, browser-required)
18. Craigslist (TEST, browser-required)

## Production-Orientation

This is **not** a prototype. This is **not** a proof of concept. This is **not** a mock marketplace. This is **not** a fake cross-listing demo. This is **not** a README-only repository.

All test-* external adapters are clearly labeled TEST-ONLY and must NEVER be presented as live integrations. The PrimeOpp Marketplace adapter is a functional local runtime that actually publishes listings, accepts offers, and creates orders.

## License

Apache-2.0
