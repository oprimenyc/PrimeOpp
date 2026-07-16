// Variant engine — Phase 6.
// Variant resolution and conflict detection.

import type { ProductVariant, VariantAttribute, VariantAxis } from '@primeopp/contracts';
import { hashString } from '@primeopp/contracts';

/**
 * Normalize a variant attribute value.
 * Trims, uppercases, collapses internal whitespace, and lowercases size units.
 */
export function normalizeVariantValue(axis: VariantAxis, value: string): string {
  const trimmed = value.trim().toUpperCase().replace(/\s+/g, ' ');
  switch (axis) {
    case 'SHOE_SIZE':
    case 'APPAREL_SIZE':
    case 'SIZE': {
      // Normalize US/EU/UK prefixes; preserve numeric size and units.
      return trimmed.replace(/\s+/g, '');
    }
    case 'COLOR': {
      // Map common color synonyms to canonical names.
      const synonyms: Record<string, string> = {
        BLK: 'BLACK',
        WHT: 'WHITE',
        GRN: 'GREEN',
        BLU: 'BLUE',
        RED: 'RED',
        GRY: 'GRAY',
        GREY: 'GRAY',
        SIL: 'SILVER',
        GLD: 'GOLD',
      };
      return synonyms[trimmed] ?? trimmed;
    }
    case 'STORAGE':
    case 'CAPACITY': {
      // Normalize GB/TB suffixes.
      return trimmed.replace(/\s+/g, '').replace('GIGABYTES', 'GB').replace('TERABYTES', 'TB');
    }
    case 'PLATFORM': {
      return trimmed.replace('NINTENDO SWITCH', 'SWITCH').replace('PLAYSTATION', 'PS').replace('XBOX', 'XBOX');
    }
    default:
      return trimmed;
  }
}

/**
 * Normalize a full VariantAttribute.
 */
export function normalizeVariantAttribute(attr: VariantAttribute): VariantAttribute {
  return {
    ...attr,
    normalized: normalizeVariantValue(attr.axis, attr.value),
  };
}

/**
 * Compute a deterministic hash of a variant's normalized attributes.
 * Two variants with the same normalized attributes will have the same hash.
 */
export function computeVariantHash(attributes: VariantAttribute[]): string {
  const normalized = attributes
    .map((a) => normalizeVariantAttribute(a))
    .sort((a, b) => a.axis.localeCompare(b.axis))
    .map((a) => `${a.axis}:${a.normalized ?? a.value}`)
    .join('|');
  return hashString(normalized);
}

/**
 * Build a ProductVariant from raw attributes.
 */
export function buildVariant(productId: string, attributes: VariantAttribute[], opts: { id?: string; displayName?: string; sku?: string } = {}): ProductVariant {
  return {
    id: opts.id ?? hashString(productId + '|' + computeVariantHash(attributes)),
    productId,
    attributes: attributes.map(normalizeVariantAttribute),
    attributeHash: computeVariantHash(attributes),
    ...(opts.displayName ? { displayName: opts.displayName } : {}),
    ...(opts.sku ? { sku: opts.sku } : {}),
  };
}

// ---------------------------------------------------------------------------
// Conflict detection
// ---------------------------------------------------------------------------

export type VariantConflictKind =
  | 'SIZE_MISMATCH'
  | 'COLOR_MISMATCH'
  | 'STORAGE_MISMATCH'
  | 'EDITION_MISMATCH'
  | 'MULTIPACK_MISMATCH'
  | 'CONDITION_MISMATCH'
  | 'REGION_MISMATCH'
  | 'MODEL_REVISION_MISMATCH'
  | 'MISSING_DISTINGUISHING_AXIS'
  | 'CONFLICTING_SAME_AXIS'
  | 'CUSTOM';

export interface VariantConflict {
  kind: VariantConflictKind;
  axis: VariantAxis;
  leftValue: string;
  rightValue: string;
  message: string;
}

/**
 * Compare two variants and report conflicts.
 * Returns an empty array if the variants are compatible (same distinguishing axes).
 */
export function detectVariantConflicts(left: ProductVariant, right: ProductVariant): VariantConflict[] {
  const conflicts: VariantConflict[] = [];

  const leftByAxis = new Map(left.attributes.map((a) => [a.axis, a]));
  const rightByAxis = new Map(right.attributes.map((a) => [a.axis, a]));

  const allAxes = new Set([...leftByAxis.keys(), ...rightByAxis.keys()]);

  for (const axis of allAxes) {
    const l = leftByAxis.get(axis);
    const r = rightByAxis.get(axis);
    const lv = l?.normalized ?? l?.value;
    const rv = r?.normalized ?? r?.value;
    if (lv === rv) continue;

    // Different values on the same axis = conflict.
    if (l && r) {
      let kind: VariantConflictKind = 'CONFLICTING_SAME_AXIS';
      switch (axis) {
        case 'SIZE':
        case 'SHOE_SIZE':
        case 'APPAREL_SIZE':
        case 'WIDTH':
          kind = 'SIZE_MISMATCH'; break;
        case 'COLOR':
        case 'MATERIAL':
        case 'STYLE':
          kind = 'COLOR_MISMATCH'; break;
        case 'STORAGE':
        case 'CAPACITY':
          kind = 'STORAGE_MISMATCH'; break;
        case 'EDITION':
          kind = 'EDITION_MISMATCH'; break;
        case 'BUNDLE_QTY':
        case 'PACKAGE_COUNT':
          kind = 'MULTIPACK_MISMATCH'; break;
        case 'CONDITION':
          kind = 'CONDITION_MISMATCH'; break;
        case 'REGION':
          kind = 'REGION_MISMATCH'; break;
        case 'MODEL_REVISION':
          kind = 'MODEL_REVISION_MISMATCH'; break;
      }
      conflicts.push({
        kind,
        axis,
        leftValue: lv ?? '<missing>',
        rightValue: rv ?? '<missing>',
        message: `axis ${axis} differs: ${lv} vs ${rv}`,
      });
    }
  }

  // If one variant has a distinguishing axis the other lacks, flag it.
  const distinguishingAxes: VariantAxis[] = ['SIZE', 'SHOE_SIZE', 'APPAREL_SIZE', 'STORAGE', 'CAPACITY', 'EDITION', 'COLOR', 'BUNDLE_QTY', 'PACKAGE_COUNT', 'MODEL_REVISION'];
  for (const axis of distinguishingAxes) {
    if (leftByAxis.has(axis) && !rightByAxis.has(axis)) {
      conflicts.push({
        kind: 'MISSING_DISTINGUISHING_AXIS',
        axis,
        leftValue: leftByAxis.get(axis)!.value,
        rightValue: '<missing>',
        message: `right variant missing distinguishing axis ${axis}`,
      });
    } else if (!leftByAxis.has(axis) && rightByAxis.has(axis)) {
      conflicts.push({
        kind: 'MISSING_DISTINGUISHING_AXIS',
        axis,
        leftValue: '<missing>',
        rightValue: rightByAxis.get(axis)!.value,
        message: `left variant missing distinguishing axis ${axis}`,
      });
    }
  }

  return conflicts;
}

/**
 * Determine if two variants are mergeable (same hash, no conflicts).
 * Variants are mergeable if their attribute hashes are equal.
 */
export function areVariantsMergeable(left: ProductVariant, right: ProductVariant): boolean {
  return left.attributeHash === right.attributeHash && detectVariantConflicts(left, right).length === 0;
}

/**
 * Group variants by their attribute hash. Variants in the same group are mergeable.
 */
export function groupVariantsByHash(variants: ProductVariant[]): Map<string, ProductVariant[]> {
  const groups = new Map<string, ProductVariant[]>();
  for (const v of variants) {
    const list = groups.get(v.attributeHash) ?? [];
    list.push(v);
    groups.set(v.attributeHash, list);
  }
  return groups;
}

/**
 * Detect variants that conflict with each other within a single product.
 */
export function detectInternalVariantConflicts(variants: ProductVariant[]): VariantConflict[] {
  const conflicts: VariantConflict[] = [];
  for (let i = 0; i < variants.length; i++) {
    for (let j = i + 1; j < variants.length; j++) {
      const c = detectVariantConflicts(variants[i], variants[j]);
      // Only flag as internal conflict if hashes match but attributes differ (real conflict).
      if (variants[i].attributeHash === variants[j].attributeHash && c.length > 0) {
        conflicts.push(...c);
      }
    }
  }
  return conflicts;
}

/**
 * Validate that pricing/inventory comparisons across variants are safe.
 * Returns false if the variants have any conflict.
 */
export function canCompareAcrossVariants(left: ProductVariant, right: ProductVariant): boolean {
  return detectVariantConflicts(left, right).length === 0;
}
