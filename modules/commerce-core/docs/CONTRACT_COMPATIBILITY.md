# Contract Compatibility

**Status**: UNVERIFIED — no existing contracts supplied to compare against.

## Public Contract Surface

This package exposes the following stable contracts. Future versions will preserve backward compatibility with these names and shapes per SemVer.

### Canonical Types (`@primeopp/contracts`)

- `Product`, `ProductIdentifier`, `ProductVariant`, `VariantAttribute`
- `CanonicalCondition`, `ConditionAssessment`
- `BarcodePayload`, `ScanEvent`, `ScanSession`
- `OCRResult`, `OCRRequest`, `ImageMatchResult`
- `PricingObservation`, `PricingResult`, `PricingInput`
- `FeeSchedule`, `FeeAssessment`, `FeeLineItem`
- `ShippingEstimate`, `PackageSpec`
- `ProfitResult`, `ProfitInput`
- `OpportunityResult`, `OpportunityInput`, `OpportunityDecision`
- `CanonicalListing`, `ListingLifecycleState`
- `MarketplaceChannelAdapter`, `ChannelCapabilityManifest`
- `CommerceEvent`, `CommerceEventType`
- `TenantScoped`, `OperationResult`, `Money`, `MoneyRange`
- `EvidenceRecord`, `AdapterManifest`

### Adapter Interfaces

- `BarcodeAdapter`
- `OCRAdapter`
- `ImageMatchAdapter`
- `MarketplaceChannelAdapter`
- `InventoryStorageAdapter`
- `CatalogStorageAdapter`
- `FeeScheduleAdapter` (via `FeeScheduleRegistry`)
- `ShippingRateAdapter` (future seam)
- `EvidenceStore`
- `TenantConfigStore`

### SDK Entrypoints

- `createSdk(opts)` → `PrimeOppSdk`
- All engine functions are re-exported from their packages.

### CLI Commands

The CLI commands listed in `docs/CLI_REFERENCE.md` are stable. New commands may be added; existing commands will not be renamed or removed without a major version bump.

## Compatibility Promises

1. **Type additions are non-breaking**. New fields added to existing interfaces will be optional.
2. **Function signatures are stable**. New parameters will be added to option objects, not positional args.
3. **Event types are append-only**. New `CommerceEventType` values may be added; existing values will not be removed.
4. **Canonical conditions are stable**. The 16 canonical condition values will not change.
5. **Barcode formats are stable**. The 10 supported formats will not be removed.
6. **Terminal states are stable**. The 5 terminal states will not be removed.

## Compatibility Caveats

- The internal `hashString` function is NOT a cryptographic hash and may change implementation between versions. Use it only for content-addressed evidence IDs and dedup keys, never for security.
- The default PrimeOpp Marketplace fee schedule is illustrative and will be replaced by a configurable schedule when the real marketplace adapter is integrated.
- The local test adapters in `@primeopp/adapter-testkit` are TEST-ONLY. They may change behavior between versions to support new test scenarios.
