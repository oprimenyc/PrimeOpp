// Shipping estimator — Phase 14.
// Dimensional weight, zone, packaging recommendations.

import type {
  Money,
  MoneyRange,
  PackageSpec,
  ShippingEstimate,
  ShippingEstimateInput,
  TenantScoped,
} from '@primeopp/contracts';
import { clamp01 } from '@primeopp/contracts';

const LB_PER_KG = 2.20462262;
const KG_PER_LB = 0.45359237;
const CM3_PER_IN3 = 16.387064;

/**
 * Convert a weight to a target unit.
 */
export function convertWeight(weight: number, from: PackageSpec['weightUnit'], to: PackageSpec['weightUnit']): number {
  if (from === to) return weight;
  if (from === 'KG' && to === 'LB') return weight * LB_PER_KG;
  if (from === 'LB' && to === 'KG') return weight * KG_PER_LB;
  if (from === 'G' && to === 'KG') return weight / 1000;
  if (from === 'G' && to === 'LB') return (weight / 1000) * LB_PER_KG;
  if (from === 'OZ' && to === 'LB') return weight / 16;
  if (from === 'OZ' && to === 'KG') return (weight / 16) * KG_PER_LB;
  if (from === 'KG' && to === 'G') return weight * 1000;
  if (from === 'LB' && to === 'OZ') return weight * 16;
  if (from === 'G' && to === 'OZ') return (weight / 1000) * LB_PER_KG * 16;
  if (from === 'OZ' && to === 'G') return (weight / 16) * KG_PER_LB * 1000;
  return weight;
}

/**
 * Convert dimensions to a target unit.
 */
export function convertDimension(length: number, from: PackageSpec['dimensionUnit'], to: PackageSpec['dimensionUnit']): number {
  if (from === to) return length;
  if (from === 'CM' && to === 'IN') return length / 2.54;
  if (from === 'IN' && to === 'CM') return length * 2.54;
  return length;
}

/**
 * Compute dimensional weight (volumetric weight).
 * DIM factor: 139 in^3/lb (US carriers) or 5000 cm^3/kg (metric).
 */
export function dimensionalWeight(spec: PackageSpec, targetUnit: 'LB' | 'KG' = 'LB'): number {
  const lengthIn = convertDimension(spec.length, spec.dimensionUnit, 'IN');
  const widthIn = convertDimension(spec.width, spec.dimensionUnit, 'IN');
  const heightIn = convertDimension(spec.height, spec.dimensionUnit, 'IN');
  const volIn3 = lengthIn * widthIn * heightIn;
  const dimWeightLb = volIn3 / 139;
  if (targetUnit === 'LB') return dimWeightLb;
  return dimWeightLb * KG_PER_LB;
}

/**
 * Compute billable weight = max(actual weight, dimensional weight).
 */
export function billableWeight(spec: PackageSpec): { weight: number; unit: 'LB' | 'KG' } {
  const actualLb = convertWeight(spec.weight, spec.weightUnit, 'LB');
  const dimLb = dimensionalWeight(spec, 'LB');
  return { weight: Math.max(actualLb, dimLb), unit: 'LB' };
}

/**
 * Recommend a package kind based on dimensions and weight.
 */
export function recommendPackageKind(spec: PackageSpec): PackageSpec['kind'] {
  const billable = billableWeight(spec);
  if (billable.weight > 70) return 'FREIGHT';
  const longestSide = Math.max(
    convertDimension(spec.length, spec.dimensionUnit, 'IN'),
    convertDimension(spec.width, spec.dimensionUnit, 'IN'),
    convertDimension(spec.height, spec.dimensionUnit, 'IN'),
  );
  if (longestSide > 18) return 'LARGE';
  if (longestSide > 12) return 'MEDIUM';
  return 'SMALL';
}

/**
 * Estimated shipping cost based on billable weight and zone.
 * Uses a simple deterministic model (NOT real carrier rates).
 */
export function estimateShippingCost(opts: {
  billableWeightLb: number;
  carrierClass?: ShippingEstimateInput['carrierClass'];
  originZone?: string;
  destinationZone?: string;
  insurance?: Money;
  signatureRequired?: boolean;
  international?: boolean;
  hazardous?: boolean;
}): MoneyRange {
  const basePerLb = opts.carrierClass === 'EXPEDITED' ? 4.5 : opts.carrierClass === 'FREIGHT' ? 1.5 : 2.0;
  const zoneMultiplier = opts.originZone && opts.destinationZone && opts.originZone !== opts.destinationZone ? 1.5 : 1.0;
  const intlMultiplier = opts.international ? 2.2 : 1.0;
  const hazMultiplier = opts.hazardous ? 1.35 : 1.0;

  const mid = opts.billableWeightLb * basePerLb * zoneMultiplier * intlMultiplier * hazMultiplier;
  const insuranceAmount = opts.insurance?.amount ?? 0;
  const signatureAmount = opts.signatureRequired ? 3.5 : 0;

  const total = mid + insuranceAmount + signatureAmount;
  // ±15% range to express uncertainty.
  return {
    low: { amount: total * 0.85, currency: opts.insurance?.currency ?? 'USD', precise: false, status: 'ESTIMATED' },
    high: { amount: total * 1.15, currency: opts.insurance?.currency ?? 'USD', precise: false, status: 'ESTIMATED' },
    midpoint: { amount: total, currency: opts.insurance?.currency ?? 'USD', precise: false, status: 'ESTIMATED' },
    status: 'ESTIMATED',
  };
}

/**
 * Estimate packaging cost by package kind.
 */
export function packagingCostEstimate(kind: PackageSpec['kind'], currency = 'USD'): Money {
  const table: Record<PackageSpec['kind'], number> = {
    SMALL: 0.5,
    MEDIUM: 1.0,
    LARGE: 2.0,
    FLAT: 0.75,
    TUBE: 1.25,
    FREIGHT: 15.0,
    CUSTOM: 1.5,
  };
  return { amount: table[kind], currency, precise: false, status: 'ESTIMATED' };
}

/**
 * Estimate label cost by carrier class.
 */
export function labelCostEstimate(carrierClass: ShippingEstimateInput['carrierClass'] = 'STANDARD', currency = 'USD'): Money {
  const table: Record<string, number> = {
    ECONOMY: 0.25,
    STANDARD: 0.40,
    EXPEDITED: 0.65,
    FREIGHT: 2.50,
  };
  return { amount: table[carrierClass] ?? 0.40, currency, precise: false, status: 'ESTIMATED' };
}

/**
 * Full shipping estimate.
 */
export function estimateShipping(input: ShippingEstimateInput): ShippingEstimate {
  const missingDataWarnings: string[] = [];
  if (!input.originZone) missingDataWarnings.push('originZone missing; using default zone multiplier');
  if (!input.destinationZone) missingDataWarnings.push('destinationZone missing; using default zone multiplier');

  const billable = billableWeight(input.packageSpec);
  const recommendedKind = recommendPackageKind(input.packageSpec);

  const range = estimateShippingCost({
    billableWeightLb: billable.weight,
    carrierClass: input.carrierClass,
    originZone: input.originZone,
    destinationZone: input.destinationZone,
    insurance: input.insurance,
    signatureRequired: input.signatureRequired,
    international: input.international,
    hazardous: input.hazardous,
  });

  const packCost = packagingCostEstimate(recommendedKind, range.midpoint.currency);
  const labelCost = labelCostEstimate(input.carrierClass, range.midpoint.currency);

  // Confidence: 1.0 minus penalty per missing field.
  let confidence = 1.0;
  confidence -= 0.15 * missingDataWarnings.length;
  if (input.hazardous) confidence -= 0.1;
  if (input.international) confidence -= 0.1;
  confidence = clamp01(confidence);

  return {
    billableWeight: billable.weight,
    billableWeightUnit: billable.unit,
    packagingCost: packCost,
    labelCost: labelCost,
    estimatedRange: range,
    confidence,
    missingDataWarnings,
    recommendedPackageKind: recommendedKind,
  };
}

/**
 * Helper to build a PackageSpec.
 */
export function buildPackageSpec(opts: {
  kind?: PackageSpec['kind'];
  weight: number;
  weightUnit: PackageSpec['weightUnit'];
  length: number;
  width: number;
  height: number;
  dimensionUnit: PackageSpec['dimensionUnit'];
}): PackageSpec {
  return {
    kind: opts.kind ?? 'SMALL',
    weight: opts.weight,
    weightUnit: opts.weightUnit,
    length: opts.length,
    width: opts.width,
    height: opts.height,
    dimensionUnit: opts.dimensionUnit,
  };
}

export function createShippingEstimateInput(
  packageSpec: PackageSpec,
  scope: TenantScoped,
  overrides: Partial<ShippingEstimateInput> = {},
): ShippingEstimateInput {
  return { packageSpec, scope, ...overrides };
}
