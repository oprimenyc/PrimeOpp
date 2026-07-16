# Shipping Estimator

The shipping estimator lives in `packages/shipping-estimator/src/index.ts`.

## Inputs

- weight + weightUnit (G, KG, OZ, LB)
- length, width, height + dimensionUnit (CM, IN)
- origin/destination zones (optional)
- carrier class (ECONOMY, STANDARD, EXPEDITED, FREIGHT)
- insurance (Money)
- signatureRequired, hazardous, localPickup, international, returnShipping flags

## Outputs

- billableWeight (max of actual weight and dimensional weight)
- packagingCost (varies by recommended package kind)
- labelCost (varies by carrier class)
- estimatedRange (MoneyRange low/midpoint/high)
- confidence
- missingDataWarnings
- recommendedPackageKind

## Dimensional Weight

DIM factor: 139 in³/lb (US carriers). The estimator converts all dimensions to inches and weight to pounds before computing.

## Carrier Rate Model

The estimator uses a simple deterministic model: `base rate per lb × weight × zone multiplier × international multiplier × hazmat multiplier`. This is NOT a real carrier rate; it is an estimate.

## Future Carrier Adapter Seam

The estimator exposes `ShippingRateAdapter` (in contracts) as a future seam. Real carrier adapters will plug into this interface to provide live rate quotes.
