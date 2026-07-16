# SDK Reference

**Package:** primeopp-marketplace-platform

**Last updated:** 2026-01-01

## Top-Level API

createPrimeOppRuntime() returns { evidence, events, metrics, adapters, inventory, reservations, allocations, locks, search }. The PrimeOpp Marketplace adapter is auto-registered.

## Registering Adapters

registerAdapter(runtime, adapter) registers any MarketplaceChannelAdapter.
