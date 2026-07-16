# Observability

## Structured Telemetry

The package emits structured commerce events for every meaningful state change. See `packages/commerce-events/src/index.ts` for the full event type list.

## Terminal States

Every operation terminates as one of:

- SUCCEEDED
- PARTIALLY_SUCCEEDED
- REQUIRES_REVIEW
- FAILED
- CANCELLED

There is no silent "no result" state. The `OperationResult` wrapper requires an explicit terminal state.

## Telemetry Signals

The following signals are derivable from emitted events:

- scan count (count of `product.scanned`)
- resolution success rate (success / total `product.resolution.*` events)
- ambiguous match rate (`MULTIPLE_CANDIDATES` + `VARIANT_AMBIGUITY` / total resolutions)
- product creation (`product.created`)
- duplicate detection (`product.merged` count)
- pricing calculation (`pricing.calculated`)
- comp freshness (computed from `price.observed` events)
- condition confidence (from `condition.assessed` payload)
- opportunity decision (`opportunity.scored` payload)
- inventory adjustment (`inventory.adjusted`)
- reservation failure (FAILED `inventory.reserved`)
- oversell prevention (count of `OVERSELL_PREVENTED` errors)
- listing readiness (`listing.approved` count)
- channel-sync request (`listing.channel.updated`)
- fee data stale (count of stale fee warnings)
- shipping data incomplete (count of `missingDataWarnings`)
- profit-confidence level (from `profit.calculated` payload)
- tenant-level outcomes (filter events by tenantId)

## Critical Rule

**Do not build a competing observability platform.** This package emits structured events; downstream platforms (Foundry, PrimeOS observability, AMOS) consume them via the `CommerceEventSink` interface.
