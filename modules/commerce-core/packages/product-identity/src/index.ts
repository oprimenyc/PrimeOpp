// Product identity resolver — Phase 3.
// Deterministic product identity resolver with conflict detection and
// explainable matching.

import type {
  Confidence,
  Identified,
  Product,
  ProductIdentifier,
  TenantScoped,
  Timestamped,
} from '@primeopp/contracts';
import { clamp01, hashString, nowUtc, uuid } from '@primeopp/contracts';
import type { BarcodeFormat, BarcodePayload, BarcodeLookupResult } from '@primeopp/contracts';
import type { OCRResult, ImageMatchResult } from '@primeopp/contracts';
import { detectFormat, toBarcodePayload } from '@primeopp/barcode';

// ---------------------------------------------------------------------------
// Resolution states
// ---------------------------------------------------------------------------

export type ResolutionState =
  | 'EXACT_MATCH'
  | 'HIGH_CONFIDENCE_MATCH'
  | 'POSSIBLE_MATCH'
  | 'MULTIPLE_CANDIDATES'
  | 'VARIANT_AMBIGUITY'
  | 'CONFLICTED'
  | 'NO_MATCH'
  | 'REQUIRES_HUMAN_REVIEW';

export interface ResolutionCandidate {
  productId: string;
  confidence: Confidence;
  matchedFields: string[];
  conflictingFields: Array<{ field: string; expected: string; actual: string }>;
  missingFields: string[];
  evidenceRefs: string[];
  source: string;
}

export interface ResolutionResult extends Identified, Timestamped {
  tenantId: string;
  input: ResolutionInput;
  state: ResolutionState;
  candidates: ResolutionCandidate[];
  selectedCandidateId?: string;
  explanation: string[];
  warnings: string[];
  recommendedNextAction: string;
  confidence: Confidence;
  evidenceRefs: string[];
}

// ---------------------------------------------------------------------------
// Input
// ---------------------------------------------------------------------------

export interface ResolutionInput {
  barcode?: BarcodePayload;
  ocr?: OCRResult;
  imageMatch?: ImageMatchResult;
  text?: string;
  title?: string;
  brand?: string;
  model?: string;
  category?: string;
  color?: string;
  size?: string;
  serialNumber?: string;
  existingCatalogRecordId?: string;
}

// ---------------------------------------------------------------------------
// Resolver
// ---------------------------------------------------------------------------

export interface ProductIdentityAdapter {
  readonly adapterId: string;
  readonly version: string;
  resolve(input: ResolutionInput, scope: TenantScoped): Promise<{ candidates: ResolutionCandidate[]; warnings: string[] }>;
}

export interface ProductIdentityResolverOptions {
  adapters: ProductIdentityAdapter[];
  /** Confidence threshold for HIGH_CONFIDENCE_MATCH. */
  highConfidenceThreshold?: number;
  /** Confidence threshold for EXACT_MATCH (typically ≥ 0.97). */
  exactMatchThreshold?: number;
  /** Minimum delta between top-2 candidates to avoid MULTIPLE_CANDIDATES. */
  multipleCandidateDelta?: number;
}

export class ProductIdentityResolver {
  private readonly opts: ProductIdentityResolverOptions;
  constructor(opts: ProductIdentityResolverOptions) {
    this.opts = opts;
  }

  async resolve(input: ResolutionInput, scope: TenantScoped): Promise<ResolutionResult> {
    const now = nowUtc();
    const explanation: string[] = [];
    const warnings: string[] = [];
    const allCandidates: ResolutionCandidate[] = [];

    // 1. Normalize input.
    explanation.push('normalized input');
    if (input.barcode) explanation.push(`barcode format=${input.barcode.format} valid=${input.barcode.checkDigitValid}`);
    if (input.ocr) explanation.push(`ocr fields=${input.ocr.fields.length}`);
    if (input.imageMatch) explanation.push(`imageMatch candidates=${input.imageMatch.candidates.length}`);

    // 2. Query registered adapters.
    for (const adapter of this.opts.adapters) {
      try {
        const r = await adapter.resolve(input, scope);
        allCandidates.push(...r.candidates);
        warnings.push(...r.warnings);
        explanation.push(`adapter ${adapter.adapterId} returned ${r.candidates.length} candidate(s)`);
      } catch (e) {
        warnings.push(`adapter ${adapter.adapterId} failed: ${(e as Error).message}`);
      }
    }

    // 3. Merge candidates (dedupe by productId, keep highest confidence).
    const byProduct = new Map<string, ResolutionCandidate>();
    for (const c of allCandidates) {
      const prev = byProduct.get(c.productId);
      if (!prev || c.confidence > prev.confidence) {
        byProduct.set(c.productId, c);
      }
    }
    const candidates = Array.from(byProduct.values()).sort((a, b) => b.confidence - a.confidence);

    // 4. Detect state.
    const state = this.detectState(candidates, input);
    explanation.push(`state=${state}`);

    // 5. Select top candidate if state permits.
    let selectedCandidateId: string | undefined;
    if (state === 'EXACT_MATCH' || state === 'HIGH_CONFIDENCE_MATCH' || state === 'POSSIBLE_MATCH') {
      selectedCandidateId = candidates[0]?.productId;
    }

    const confidence = candidates.length > 0 ? candidates[0].confidence : 0;

    return {
      id: uuid(),
      tenantId: scope.tenantId,
      ...(scope.organizationId ? { organizationId: scope.organizationId } : {}),
      input,
      state,
      candidates,
      ...(selectedCandidateId ? { selectedCandidateId } : {}),
      explanation,
      warnings,
      recommendedNextAction: this.recommendNextAction(state, candidates),
      confidence,
      evidenceRefs: candidates.flatMap((c) => c.evidenceRefs),
      createdAt: now,
      updatedAt: now,
    };
  }

  private detectState(candidates: ResolutionCandidate[], input: ResolutionInput): ResolutionState {
    if (candidates.length === 0) {
      // NO_MATCH if we had any input; REQUIRES_HUMAN_REVIEW if input is also empty.
      return 'NO_MATCH';
    }
    const top = candidates[0];
    const exact = this.opts.exactMatchThreshold ?? 0.97;
    const high = this.opts.highConfidenceThreshold ?? 0.85;
    const delta = this.opts.multipleCandidateDelta ?? 0.1;

    if (candidates.length > 1 && top.confidence - candidates[1].confidence < delta) {
      return 'MULTIPLE_CANDIDATES';
    }
    if (top.conflictingFields.length > 0) return 'CONFLICTED';
    if (top.confidence >= exact) return 'EXACT_MATCH';
    if (top.confidence >= high) return 'HIGH_CONFIDENCE_MATCH';
    if (top.confidence >= 0.5) return 'POSSIBLE_MATCH';
    if (input.ocr && candidates.length > 0 && top.confidence < 0.5) return 'REQUIRES_HUMAN_REVIEW';
    return 'NO_MATCH';
  }

  private recommendNextAction(state: ResolutionState, candidates: ResolutionCandidate[]): string {
    switch (state) {
      case 'EXACT_MATCH':
      case 'HIGH_CONFIDENCE_MATCH':
        return 'use selected candidate as canonical product';
      case 'POSSIBLE_MATCH':
        return 'use selected candidate but flag for human verification';
      case 'MULTIPLE_CANDIDATES':
        return 'present top candidates to user for selection';
      case 'VARIANT_AMBIGUITY':
        return 'request distinguishing variant attributes (size, color, storage, etc.)';
      case 'CONFLICTED':
        return `resolve conflicts in: ${candidates[0]?.conflictingFields.map((c) => c.field).join(', ')}`;
      case 'NO_MATCH':
        return 'create a new canonical product record';
      case 'REQUIRES_HUMAN_REVIEW':
        return 'submit for human review before creating product record';
    }
  }
}

// ---------------------------------------------------------------------------
// Local test identity adapter (TEST-ONLY)
// ---------------------------------------------------------------------------

/**
 * Local test identity adapter.
 * TEST-ONLY. Returns deterministic candidates from a fixture map.
 */
export class LocalTestProductIdentityAdapter implements ProductIdentityAdapter {
  readonly adapterId = 'local.test.product-identity';
  readonly version = '1.0.0';

  private readonly catalog = new Map<string, Product>();

  constructor(initial: Product[] = []) {
    for (const p of initial) this.catalog.set(p.id, p);
  }

  register(product: Product): void {
    this.catalog.set(product.id, product);
  }

  async resolve(input: ResolutionInput, scope: TenantScoped): Promise<{ candidates: ResolutionCandidate[]; warnings: string[] }> {
    const candidates: ResolutionCandidate[] = [];
    const warnings: string[] = [];

    if (input.barcode) {
      for (const p of this.catalog.values()) {
        if (p.tenantId !== scope.tenantId) continue;
        for (const id of p.identifiers) {
          if ((id.type === 'UPC' || id.type === 'EAN' || id.type === 'GTIN' || id.type === 'ISBN') && id.value === input.barcode.normalizedValue) {
            candidates.push({
              productId: p.id,
              confidence: clamp01(id.confidence),
              matchedFields: ['barcode'],
              conflictingFields: [],
              missingFields: [],
              evidenceRefs: id.evidenceRef ? [id.evidenceRef] : [],
              source: this.adapterId,
            });
          }
        }
      }
    }

    if (input.title || input.brand || input.model) {
      for (const p of this.catalog.values()) {
        if (p.tenantId !== scope.tenantId) continue;
        const matched: string[] = [];
        let score = 0;
        if (input.title && p.title.toLowerCase().includes(input.title.toLowerCase())) { matched.push('title'); score += 0.4; }
        if (input.brand && p.brand && p.brand.normalized === input.brand.toUpperCase()) { matched.push('brand'); score += 0.3; }
        if (input.model && p.model && p.model.normalized === input.model.toUpperCase()) { matched.push('model'); score += 0.3; }
        if (score > 0) {
          candidates.push({
            productId: p.id,
            confidence: clamp01(score),
            matchedFields: matched,
            conflictingFields: [],
            missingFields: [],
            evidenceRefs: [],
            source: this.adapterId,
          });
        }
      }
    }

    return { candidates, warnings };
  }
}

/**
 * Build a resolution input from a barcode payload.
 */
export function inputFromBarcode(payload: BarcodePayload): ResolutionInput {
  return { barcode: payload };
}

/**
 * Build a resolution input from OCR + image match.
 */
export function inputFromOcrAndImage(ocr: OCRResult, imageMatch?: ImageMatchResult): ResolutionInput {
  const fields = new Map<string, string>();
  for (const f of ocr.fields) fields.set(f.field, f.value);
  return {
    ocr,
    ...(imageMatch ? { imageMatch } : {}),
    title: fields.get('TITLE'),
    brand: fields.get('BRAND'),
    model: fields.get('MODEL_NUMBER'),
    category: fields.get('CATEGORY'),
    color: fields.get('COLOR'),
    size: fields.get('SIZE'),
    serialNumber: fields.get('SERIAL_NUMBER'),
  };
}

/**
 * Build a resolution input from a manual text query.
 */
export function inputFromText(text: string): ResolutionInput {
  return { text };
}

// ---------------------------------------------------------------------------
// Enrichment handoff (reconciliation with primeopp-product-enrichment)
// ---------------------------------------------------------------------------

/**
 * `primeopp-product-enrichment` is a separate clean-room module (see its own
 * INTEGRATION.md, section 9 "Downstream marketplace comps handoff", for the
 * precedent). This package does not depend on that module's source; the
 * types below are a local structural mirror of the minimum subset of its
 * `EnrichedProductProfile` output contract this bridge needs.
 */

/** Mirrors `EnrichedIdentifiers` from primeopp-product-enrichment. */
export interface EnrichmentHandoffIdentifiers {
  upc?: string[];
  ean?: string[];
  gtin?: string[];
  isbn?: string[];
  sku?: string[];
  mpn?: string[];
}

/** Mirrors `EnrichedIdentity` from primeopp-product-enrichment. */
export interface EnrichmentHandoffIdentity {
  canonicalTitle?: string;
  brand?: string;
  model?: string;
}

/** Mirrors `EnrichedClassification` from primeopp-product-enrichment. */
export interface EnrichmentHandoffClassification {
  category?: string;
}

/** Mirrors `EnrichedProductProfile.status` from primeopp-product-enrichment. */
export type EnrichmentHandoffStatus = 'ENRICHED' | 'PARTIAL' | 'AMBIGUOUS' | 'NOT_FOUND' | 'FAILED';

/** Mirrors the fields of `EnrichedProductProfile` this bridge needs. */
export interface EnrichmentHandoffProfile {
  enrichmentId: string;
  intakeId?: string;
  identifiers: EnrichmentHandoffIdentifiers;
  identity: EnrichmentHandoffIdentity;
  classification: EnrichmentHandoffClassification;
  confidence: { overall: number };
  status: EnrichmentHandoffStatus;
}

export interface ResolutionInputFromEnrichmentResult {
  input: ResolutionInput;
  warnings: string[];
  enrichmentId: string;
  intakeId?: string;
}

/**
 * True when the enriched profile's status permits identity resolution.
 * `NOT_FOUND` and `FAILED` profiles carry no usable signal for matching
 * against the canonical catalog.
 */
export function isResolutionEligible(profile: EnrichmentHandoffProfile): boolean {
  return profile.status === 'ENRICHED' || profile.status === 'PARTIAL' || profile.status === 'AMBIGUOUS';
}

/**
 * Pick the single primary barcode-family identifier value from an
 * enrichment identifier bucket, in GTIN > UPC > EAN > ISBN priority order
 * (same order used by primeopp-product-enrichment's own
 * `examples/downstream-handoff.ts`). Blank/whitespace-only values are
 * rejected rather than passed through. Only one identifier is selected —
 * resolution input carries exactly one barcode claim, never several
 * simultaneous ones for the same profile.
 */
function primaryBarcodeValue(identifiers: EnrichmentHandoffIdentifiers): string | undefined {
  const buckets = [identifiers.gtin, identifiers.upc, identifiers.ean, identifiers.isbn];
  for (const bucket of buckets) {
    const value = bucket?.find((v) => v.trim().length > 0);
    if (value) return value.trim();
  }
  return undefined;
}

function isGs1OrIsbnFormat(format: BarcodeFormat): boolean {
  return (
    format === 'UPC_A'
    || format === 'UPC_E'
    || format === 'EAN_8'
    || format === 'EAN_13'
    || format === 'GTIN_14'
    || format === 'ISBN_10'
    || format === 'ISBN_13'
  );
}

/**
 * Convert an enriched product profile into a `ResolutionInput` for
 * `ProductIdentityResolver`. This is the sole handoff point between
 * enrichment output and canonical identity resolution — it does not create
 * or mutate any canonical catalog record itself.
 *
 * Barcode-family identifiers (GTIN/UPC/EAN/ISBN) are converted into a real
 * `BarcodePayload` via `@primeopp/barcode`'s `detectFormat`/`toBarcodePayload`,
 * so `checkDigitValid` is a deterministic computation from the digits
 * themselves, never an invented value. SKU/MPN values have no check-digit
 * concept and are never coerced into a `BarcodePayload`; when no
 * barcode-family identifier is present, the best available SKU/MPN value is
 * carried as free-text (`ResolutionInput.text`) instead, with a warning.
 *
 * Throws for `NOT_FOUND` / `FAILED` profiles (see `isResolutionEligible`)
 * and for profiles with no identifier and no identity signal at all —
 * both are refusals, not silently-empty resolution attempts.
 */
export function buildResolutionInputFromEnrichedProfile(
  profile: EnrichmentHandoffProfile
): ResolutionInputFromEnrichmentResult {
  if (!isResolutionEligible(profile)) {
    throw new Error(
      `RESOLUTION_INELIGIBLE: enrichment profile ${profile.enrichmentId} has status ${profile.status}; only ENRICHED, PARTIAL, and AMBIGUOUS profiles are eligible for identity resolution`
    );
  }

  const warnings: string[] = [];
  const input: ResolutionInput = {};

  const barcodeValue = primaryBarcodeValue(profile.identifiers);
  if (barcodeValue) {
    const detectedFormat = detectFormat(barcodeValue);
    if (isGs1OrIsbnFormat(detectedFormat)) {
      input.barcode = toBarcodePayload(barcodeValue, detectedFormat);
    } else {
      input.text = barcodeValue;
      warnings.push(
        `profile ${profile.enrichmentId} has a GTIN/UPC/EAN/ISBN bucket value that detected as ${detectedFormat}; falling back to text search instead of emitting a barcode claim`
      );
    }
  } else {
    const fallbackText = profile.identifiers.mpn?.find((v) => v.trim().length > 0)
      ?? profile.identifiers.sku?.find((v) => v.trim().length > 0);
    if (fallbackText) {
      input.text = fallbackText.trim();
      warnings.push(
        `profile ${profile.enrichmentId} has no GTIN/UPC/EAN/ISBN identifier; falling back to SKU/MPN text search`
      );
    }
  }

  if (profile.identity.canonicalTitle) input.title = profile.identity.canonicalTitle;
  if (profile.identity.brand) input.brand = profile.identity.brand;
  if (profile.identity.model) input.model = profile.identity.model;
  if (profile.classification.category) input.category = profile.classification.category;

  if (!input.barcode && !input.text && !input.title && !input.brand && !input.model) {
    throw new Error(
      `RESOLUTION_NO_SIGNAL: enrichment profile ${profile.enrichmentId} has no identifier, title, brand, or model to resolve against the canonical catalog`
    );
  }

  if (profile.status === 'AMBIGUOUS') {
    warnings.push(
      `profile ${profile.enrichmentId} was AMBIGUOUS in enrichment; treat resolution candidates with extra caution`
    );
  }

  return {
    input,
    warnings,
    enrichmentId: profile.enrichmentId,
    ...(profile.intakeId ? { intakeId: profile.intakeId } : {}),
  };
}
