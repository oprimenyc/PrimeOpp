/**
 * @primeopp-deal-intelligence/product-normalization
 *
 * Normalizes raw product observations into a ProductCandidate. Detects
 * identifiers, brand, model, size, color, pack quantity and bundles.
 *
 * NEVER merges different sizes, colors, storage capacities, editions,
 * pack quantities, used/new inventory or bundles with single units
 * without explicit evidence.
 */
import type {
  ProductCandidate, ProductIdentifier, ProductIdentifierType,
  ProductVariant, ProductCondition, Evidence, ProductId, Confidence, ISO8601
} from '@primeopp-deal-intelligence/contracts';
import { nextId, nowIso } from '@primeopp-deal-intelligence/contracts';

export interface NormalizeInput {
  sourceTitle: string;
  brand?: string;
  modelNumber?: string;
  identifiers?: ProductIdentifier[];
  condition?: ProductCondition;
  category?: string;
  evidence?: Evidence[];
  observedAt?: ISO8601;
}

export interface NormalizeResult {
  candidate: ProductCandidate;
  warnings: string[];
  confidence: Confidence;
}

const SIZE_RE = /\b(size|sz)\s*[:#-]?\s*(\w+)/i;
const COLOR_RE = /\b(color|colour|clr)\s*[:#-]?\s*(\w+)/i;
const STORAGE_RE = /\b(\d+)\s*(gb|tb)\b/i;
const PACK_RE = /\b(\d+)\s*-?\s*pack\b|\bpack\s*of\s*(\d+)\b/i;
const BUNDLE_RE = /\bbundle\b|\bset of\s*\d+\b/i;
const EDITION_RE = /\b(special edition|collector's edition|deluxe|standard edition)\b/i;
const MPN_RE = /\bmodel\s*[:#-]?\s*([A-Z0-9-]{4,})\b/i;
const ASIN_RE = /\bB[0-9A-Z]{9}\b/;
const UPC_RE = /\b\d{12}\b/;
const ISBN_RE = /\b\d{10}|\d{13}\b/;
const GTIN_RE = /\b\d{8}|\d{12}|\d{13}|\d{14}\b/;

export function detectIdentifiers(title: string, existing: ProductIdentifier[] = []): ProductIdentifier[] {
  const out: ProductIdentifier[] = existing.slice();
  const seen = new Set(out.map(i => `${i.type}:${i.value}`));
  const add = (type: ProductIdentifierType, value: string, source: string) => {
    const k = `${type}:${value}`;
    if (seen.has(k)) return;
    seen.add(k);
    out.push({ type, value, source });
  };
  const asin = title.match(ASIN_RE);
  if (asin && asin[0]) add('ASIN', asin[0], 'title-detection');
  const upc = title.match(UPC_RE);
  if (upc && upc[0]) add('UPC', upc[0], 'title-detection');
  const isbn = title.match(ISBN_RE);
  if (isbn && isbn[0]) add('ISBN', isbn[0], 'title-detection');
  const gtin = title.match(GTIN_RE);
  if (gtin && gtin[0] && !isbn) add('GTIN', gtin[0], 'title-detection');
  const mpn = title.match(MPN_RE);
  if (mpn && mpn[1]) add('MPN', mpn[1], 'title-detection');
  return out;
}

export function detectVariants(title: string, existing: ProductVariant = {}): ProductVariant {
  const v: ProductVariant = { ...existing };
  const sz = title.match(SIZE_RE);
  if (sz && sz[2]) v.size = sz[2];
  const cl = title.match(COLOR_RE);
  if (cl && cl[2]) v.color = cl[2];
  const st = title.match(STORAGE_RE);
  if (st && st[1] && st[2]) v.storageCapacity = `${st[1]}${st[2]}`;
  const pk = title.match(PACK_RE);
  if (pk) v.packQuantity = parseInt(pk[1] ?? pk[2] ?? '1', 10);
  if (BUNDLE_RE.test(title)) v.bundle = true;
  const ed = title.match(EDITION_RE);
  if (ed && ed[1]) v.edition = ed[1];
  return v;
}

export function cleanTitle(s: string): string {
  return s
    .replace(/\s+/g, ' ')
    .replace(/[\u200B-\u200D\uFEFF]/g, '')
    .trim()
    .slice(0, 500);
}

export function normalizeBrand(s?: string): string | undefined {
  if (!s) return undefined;
  const trimmed = s.trim();
  if (!trimmed) return undefined;
  return trimmed.charAt(0).toUpperCase() + trimmed.slice(1).toLowerCase();
}

export function normalize(input: NormalizeInput): NormalizeResult {
  if (!input.sourceTitle || input.sourceTitle.trim().length === 0) {
    throw new Error('normalize: sourceTitle required');
  }
  const warnings: string[] = [];
  const canonical = cleanTitle(input.sourceTitle);
  const identifiers = detectIdentifiers(canonical, input.identifiers ?? []);
  const variants = detectVariants(canonical, {});
  const brand = normalizeBrand(input.brand);

  if (identifiers.length === 0) warnings.push('no identifiers detected');
  if (!brand) warnings.push('brand not specified');
  if (variants.bundle && !variants.packQuantity) warnings.push('bundle without explicit pack quantity');

  // Confidence is conservative: starts at 1.0 and is reduced for each warning.
  let confidence: Confidence = 1.0;
  confidence -= warnings.length * 0.15;
  if (confidence < 0.1) confidence = 0.1;

  const candidate: ProductCandidate = {
    id: nextId('prod') as ProductId,
    canonicalTitle: canonical,
    sourceTitle: input.sourceTitle,
    brand,
    modelNumber: input.modelNumber,
    identifiers,
    variants: [variants],
    condition: input.condition ?? 'new',
    category: input.category,
    confidence,
    evidence: input.evidence ?? [],
    createdAt: input.observedAt ?? nowIso()
  };
  return { candidate, warnings, confidence };
}

export function areCompatibleVariants(a: ProductVariant, b: ProductVariant): boolean {
  // Different sizes, colors, storage capacities, editions, pack quantities,
  // or bundle vs. non-bundle are NOT compatible without explicit evidence.
  if (a.size && b.size && a.size !== b.size) return false;
  if (a.color && b.color && a.color !== b.color) return false;
  if (a.storageCapacity && b.storageCapacity && a.storageCapacity !== b.storageCapacity) return false;
  if (a.edition && b.edition && a.edition !== b.edition) return false;
  if (a.packQuantity && b.packQuantity && a.packQuantity !== b.packQuantity) return false;
  if (!!a.bundle !== !!b.bundle) return false;
  return true;
}

export function rejectIncompatibleMatch(a: ProductCandidate, b: ProductCandidate): boolean {
  for (const va of a.variants) {
    for (const vb of b.variants) {
      if (!areCompatibleVariants(va, vb)) return true;
    }
  }
  if (a.condition !== b.condition) return true;
  return false;
}
