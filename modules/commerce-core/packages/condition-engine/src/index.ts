// Condition engine — Phase 7.
// Configurable condition system with category-specific grading profiles.

import type {
  CanonicalCondition,
  ConditionAssessment,
  TenantScoped,
} from '@primeopp/contracts';
import { clamp01, nowUtc, uuid } from '@primeopp/contracts';

/**
 * Default condition ranking (lower index = better condition).
 * Used to compare conditions and detect impossible condition transitions.
 */
export const CONDITION_RANK: Record<CanonicalCondition, number> = {
  NEW: 0,
  NEW_WITH_TAGS: 1,
  NEW_WITHOUT_TAGS: 1,
  NEW_OPEN_BOX: 1,
  LIKE_NEW: 2,
  EXCELLENT: 3,
  VERY_GOOD: 4,
  GOOD: 5,
  FAIR: 6,
  POOR: 7,
  FOR_PARTS: 8,
  MANUFACTURER_REFURBISHED: 2, // equivalent to LIKE_NEW for ranking
  SELLER_REFURBISHED: 3,        // equivalent to EXCELLENT
  REFURBISHED: 3,
  DAMAGED: 9,
  CUSTOM: 99,
};

/**
 * Map an arbitrary marketplace condition label to a canonical condition.
 * Returns null if the label cannot be mapped.
 */
export function mapMarketplaceCondition(label: string): CanonicalCondition | null {
  const l = label.trim().toUpperCase().replace(/[\s-]+/g, '_');
  if (l in CONDITION_RANK) return l as CanonicalCondition;
  const aliases: Record<string, CanonicalCondition> = {
    BRAND_NEW: 'NEW',
    NWT: 'NEW_WITH_TAGS',
    NWOT: 'NEW_WITHOUT_TAGS',
    NOB: 'NEW_OPEN_BOX',
    LN: 'LIKE_NEW',
    LNIB: 'LIKE_NEW',
    MINT: 'LIKE_NEW',
    VG: 'VERY_GOOD',
    VGC: 'VERY_GOOD',
    PARTS: 'FOR_PARTS',
    PARTS_ONLY: 'FOR_PARTS',
    REFURB: 'REFURBISHED',
    CERTIFIED_REFURBISHED: 'MANUFACTURER_REFURBISHED',
    DAMAGED_: 'DAMAGED',
    BROKEN: 'DAMAGED',
    DEFECTIVE: 'DAMAGED',
    USED: 'GOOD',
    PRE_OWNED: 'GOOD',
    PREOWNED: 'GOOD',
  };
  return aliases[l] ?? null;
}

/**
 * Reverse map: canonical condition to a marketplace label.
 */
export function toMarketplaceCondition(condition: CanonicalCondition, marketplace: string): string {
  // Different marketplaces use different label conventions.
  // These are documented examples — real adapters MUST use their own mapping.
  const tables: Record<string, Partial<Record<CanonicalCondition, string>>> = {
    ebay: {
      NEW: 'New',
      NEW_WITH_TAGS: 'New with tags',
      NEW_WITHOUT_TAGS: 'New without tags',
      NEW_OPEN_BOX: 'New – Open box',
      MANUFACTURER_REFURBISHED: 'Manufacturer refurbished',
      SELLER_REFURBISHED: 'Seller refurbished',
      GOOD: 'Used',
      VERY_GOOD: 'Used',
      FAIR: 'Used',
      FOR_PARTS: 'For parts or not working',
    },
    amazon: {
      NEW: 'New',
      NEW_OPEN_BOX: 'Used - Like New',
      LIKE_NEW: 'Used - Like New',
      VERY_GOOD: 'Used - Very Good',
      GOOD: 'Used - Good',
      REFURBISHED: 'Used - Refurbished',
      MANUFACTURER_REFURBISHED: 'Used - Refurbished',
      DAMAGED: 'Used - Acceptable',
    },
    goat: {
      NEW: 'New',
      NEW_WITH_TAGS: 'New',
      LIKE_NEW: 'New',
      GOOD: 'Used',
      FAIR: 'Used',
      POOR: 'Used',
    },
  };
  const table = tables[marketplace.toLowerCase()];
  return table?.[condition] ?? condition;
}

// ---------------------------------------------------------------------------
// Category-specific grading profiles
// ---------------------------------------------------------------------------

export type Category = 'ELECTRONICS' | 'SNEAKERS' | 'APPAREL' | 'BOOKS' | 'COLLECTIBLES' | 'TOOLS' | 'TOYS' | 'FURNITURE' | 'APPLIANCES' | 'MEDIA' | 'GENERAL';

export interface ConditionGradingProfile {
  category: Category;
  /** Required assessment dimensions for this category. */
  requiredDimensions: string[];
  /** Category-specific defect severities. */
  defectSeverityMap: Record<string, 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'>;
  /** Default condition when no defects are observed (NEVER 'NEW' — that requires explicit evidence). */
  defaultConditionWhenNoDefects: CanonicalCondition;
  /** Whether authenticity verification is required for this category. */
  authenticityRequired: boolean;
}

export const DEFAULT_GRADING_PROFILES: Record<Category, ConditionGradingProfile> = {
  ELECTRONICS: {
    category: 'ELECTRONICS',
    requiredDimensions: ['functionalStatus', 'cosmeticStatus', 'packagingCondition'],
    defectSeverityMap: { screen_crack: 'CRITICAL', battery_swelling: 'CRITICAL', scratched_screen: 'MEDIUM', missing_charger: 'LOW' },
    defaultConditionWhenNoDefects: 'NEW_OPEN_BOX',
    authenticityRequired: false,
  },
  SNEAKERS: {
    category: 'SNEAKERS',
    requiredDimensions: ['cosmeticStatus', 'packagingCondition'],
    defectSeverityMap: { sole_separation: 'CRITICAL', creasing: 'LOW', scuff: 'LOW', yellowing: 'MEDIUM' },
    defaultConditionWhenNoDefects: 'NEW_WITHOUT_TAGS',
    authenticityRequired: true,
  },
  APPAREL: {
    category: 'APPAREL',
    requiredDimensions: ['cosmeticStatus', 'odorSmokeExposure'],
    defectSeverityMap: { stain: 'MEDIUM', tear: 'HIGH', smoke_odor: 'HIGH', missing_tag: 'LOW' },
    defaultConditionWhenNoDefects: 'NEW_WITHOUT_TAGS',
    authenticityRequired: false,
  },
  BOOKS: {
    category: 'BOOKS',
    requiredDimensions: ['cosmeticStatus'],
    defectSeverityMap: { torn_page: 'MEDIUM', water_damage: 'HIGH', highlighting: 'LOW', broken_spine: 'HIGH' },
    defaultConditionWhenNoDefects: 'LIKE_NEW',
    authenticityRequired: false,
  },
  COLLECTIBLES: {
    category: 'COLLECTIBLES',
    requiredDimensions: ['cosmeticStatus', 'packagingCondition'],
    defectSeverityMap: { chip: 'HIGH', crack: 'CRITICAL', fading: 'MEDIUM', original_packaging_missing: 'MEDIUM' },
    defaultConditionWhenNoDefects: 'LIKE_NEW',
    authenticityRequired: true,
  },
  TOOLS: {
    category: 'TOOLS',
    requiredDimensions: ['functionalStatus', 'cosmeticStatus'],
    defectSeverityMap: { rust: 'MEDIUM', battery_dead: 'HIGH', missing_accessory: 'MEDIUM' },
    defaultConditionWhenNoDefects: 'GOOD',
    authenticityRequired: false,
  },
  TOYS: {
    category: 'TOYS',
    requiredDimensions: ['cosmeticStatus', 'packagingCondition'],
    defectSeverityMap: { missing_part: 'HIGH', broken_mechanism: 'CRITICAL', discoloration: 'LOW' },
    defaultConditionWhenNoDefects: 'NEW_OPEN_BOX',
    authenticityRequired: false,
  },
  FURNITURE: {
    category: 'FURNITURE',
    requiredDimensions: ['functionalStatus', 'cosmeticStatus'],
    defectSeverityMap: { scratch: 'LOW', dent: 'MEDIUM', structural_damage: 'CRITICAL' },
    defaultConditionWhenNoDefects: 'LIKE_NEW',
    authenticityRequired: false,
  },
  APPLIANCES: {
    category: 'APPLIANCES',
    requiredDimensions: ['functionalStatus', 'cosmeticStatus'],
    defectSeverityMap: { non_functional: 'CRITICAL', dented: 'MEDIUM', missing_part: 'HIGH' },
    defaultConditionWhenNoDefects: 'NEW_OPEN_BOX',
    authenticityRequired: false,
  },
  MEDIA: {
    category: 'MEDIA',
    requiredDimensions: ['cosmeticStatus'],
    defectSeverityMap: { scratched_disc: 'HIGH', cracked_case: 'MEDIUM', missing_art: 'LOW' },
    defaultConditionWhenNoDefects: 'VERY_GOOD',
    authenticityRequired: false,
  },
  GENERAL: {
    category: 'GENERAL',
    requiredDimensions: ['cosmeticStatus'],
    defectSeverityMap: {},
    defaultConditionWhenNoDefects: 'GOOD',
    authenticityRequired: false,
  },
};

// ---------------------------------------------------------------------------
// Condition assessment
// ---------------------------------------------------------------------------

export interface AssessConditionInput {
  category: Category;
  observedDefects: string[];
  missingAccessories: string[];
  packagingCondition?: string;
  functionalStatus?: string;
  cosmeticStatus?: string;
  odorSmokeExposure?: string;
  repairHistory?: string;
  authenticityStatus?: 'AUTHENTIC' | 'SUSPECT' | 'COUNTERFEIT' | 'UNVERIFIED';
  photoRefs: string[];
  sellerNotes?: string;
  reviewer?: string;
  evidenceRefs: string[];
  /** Optional override of the auto-derived condition. */
  overrideCondition?: CanonicalCondition;
  scope: TenantScoped;
  /** Optional custom grading profile (overrides default). */
  profile?: ConditionGradingProfile;
}

export interface AssessConditionResult {
  assessment: ConditionAssessment;
  /** Confidence in the derived condition. */
  confidence: number;
  /** Missing required dimensions for the category. */
  missingDimensions: string[];
  /** Whether the category requires authenticity verification that is missing. */
  authenticityMissing: boolean;
  warnings: string[];
}

/**
 * Derive a canonical condition from observed defects using the grading profile.
 * NEVER returns 'NEW' unless explicitly overridden — appearance alone is insufficient evidence.
 */
export function deriveCondition(defects: string[], profile: ConditionGradingProfile): CanonicalCondition {
  if (defects.length === 0) {
    return profile.defaultConditionWhenNoDefects;
  }
  // Find the most severe defect.
  let maxSeverity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' = 'LOW';
  for (const d of defects) {
    const sev = profile.defectSeverityMap[d] ?? 'MEDIUM';
    const order = { LOW: 0, MEDIUM: 1, HIGH: 2, CRITICAL: 3 };
    if (order[sev] > order[maxSeverity]) maxSeverity = sev;
  }
  switch (maxSeverity) {
    case 'CRITICAL': return 'DAMAGED';
    case 'HIGH': return 'FAIR';
    case 'MEDIUM': return 'GOOD';
    case 'LOW': return 'VERY_GOOD';
  }
}

export function assessCondition(input: AssessConditionInput): AssessConditionResult {
  const profile = input.profile ?? DEFAULT_GRADING_PROFILES[input.category];
  const missingDimensions: string[] = [];
  for (const dim of profile.requiredDimensions) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const v = (input as any)[dim];
    if (v === undefined || v === null || v === '') {
      missingDimensions.push(dim);
    }
  }

  const authenticityMissing = profile.authenticityRequired && (!input.authenticityStatus || input.authenticityStatus === 'UNVERIFIED');

  const warnings: string[] = [];
  if (missingDimensions.length > 0) warnings.push(`missing required dimensions: ${missingDimensions.join(', ')}`);
  if (authenticityMissing) warnings.push(`category ${input.category} requires authenticity verification`);
  if (input.observedDefects.length === 0 && !input.overrideCondition) {
    warnings.push('no defects observed — condition defaulted; "NEW" requires explicit packaging/seal evidence');
  }

  const condition = input.overrideCondition ?? deriveCondition(input.observedDefects, profile);

  // Confidence: 1.0 if no missing dimensions and no authenticity gap, scaled down otherwise.
  let confidence = 1.0;
  confidence -= 0.15 * missingDimensions.length;
  if (authenticityMissing) confidence -= 0.25;
  if (input.observedDefects.length === 0 && !input.overrideCondition) confidence -= 0.1;
  if (input.photoRefs.length === 0) confidence -= 0.15;
  confidence = clamp01(confidence);

  const assessment: ConditionAssessment = {
    condition,
    confidence,
    observedDefects: input.observedDefects,
    missingAccessories: input.missingAccessories,
    ...(input.packagingCondition !== undefined ? { packagingCondition: input.packagingCondition } : {}),
    ...(input.functionalStatus !== undefined ? { functionalStatus: input.functionalStatus } : {}),
    ...(input.cosmeticStatus !== undefined ? { cosmeticStatus: input.cosmeticStatus } : {}),
    ...(input.odorSmokeExposure !== undefined ? { odorSmokeExposure: input.odorSmokeExposure } : {}),
    ...(input.repairHistory !== undefined ? { repairHistory: input.repairHistory } : {}),
    ...(input.authenticityStatus !== undefined ? { authenticityStatus: input.authenticityStatus } : {}),
    photoRefs: input.photoRefs,
    ...(input.sellerNotes !== undefined ? { sellerNotes: input.sellerNotes } : {}),
    ...(input.reviewer !== undefined ? { reviewer: input.reviewer } : {}),
    evidenceRefs: input.evidenceRefs,
    assessedAt: nowUtc(),
  };

  return {
    assessment,
    confidence,
    missingDimensions,
    authenticityMissing,
    warnings,
  };
}

/**
 * Create a default condition assessment for a brand-new item.
 * The caller MUST supply packaging/seal evidence; this function will not
 * infer "NEW" from appearance alone.
 */
export function createNewConditionAssessment(opts: {
  packagingCondition: string;
  sealEvidenceRef: string;
  photoRefs: string[];
  scope: TenantScoped;
  reviewer?: string;
}): ConditionAssessment {
  return {
    condition: 'NEW',
    confidence: 0.95,
    observedDefects: [],
    missingAccessories: [],
    packagingCondition: opts.packagingCondition,
    functionalStatus: 'UNTESTED',
    cosmeticStatus: 'PRISTINE',
    authenticityStatus: 'UNVERIFIED',
    photoRefs: opts.photoRefs,
    reviewer: opts.reviewer ?? 'system',
    evidenceRefs: [opts.sealEvidenceRef],
    assessedAt: nowUtc(),
  };
}

/**
 * Two conditions are incompatible for pricing comparison if their rank
 * differs by more than 1 (e.g. NEW vs DAMAGED).
 */
export function areConditionsComparable(a: CanonicalCondition, b: CanonicalCondition): boolean {
  return Math.abs(CONDITION_RANK[a] - CONDITION_RANK[b]) <= 1;
}
