# POD Migration Guide

This package supports Print-on-Demand (POD) products as a first-class `ProductKind`.

## POD Product Model

A POD product carries:

- `kind: 'POD'`
- `fulfillmentMode: 'POD_FULFILLED'`
- `locations` with a VIRTUAL location carrying `podPartnerRef`
- `costBasis` with production cost as `purchasePrice` (typically ESTIMATED)
- Inventory records with `virtual: true` and `podPartnerRef`

## Migration from Existing POD Codebase

When migrating from an existing POD system:

1. Map each POD product to a `Product` with `kind: 'POD'`.
2. Map each POD variant to a `ProductVariant` with axes (COLOR, SIZE, MATERIAL, etc.).
3. Map each POD partner to a `ProductLocation` with `kind: 'VIRTUAL'` and `podPartnerRef`.
4. Map production cost to `ProductCostBasis.purchasePrice` with status `ESTIMATED`.
5. Replace POD-specific listing logic with `CanonicalListing` + channel adapter.

## Inventory

POD inventory uses virtual records:

```typescript
{
  virtual: true,
  podPartnerRef: 'printify',
  quantities: { available: Infinity, /* or a large number */, ... },
}
```

## Pricing

POD pricing uses the same `PricingEngine` as physical products. The strategy is typically `MAX_MARGIN` or `CUSTOM`.

## Critical Rule

Never claim a POD item is "in stock" in a physical location. POD inventory is always virtual.
