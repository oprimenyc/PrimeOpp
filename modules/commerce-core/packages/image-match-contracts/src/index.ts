// Image match contracts — Phase 5.
// Provider-agnostic contracts for image similarity and visual recognition.
// Includes a local deterministic test adapter clearly labeled TEST-ONLY.

import type {
  ImageMatchAdapter,
  ImageMatchRequest,
  ImageMatchResult,
  TenantScoped,
} from '@primeopp/contracts';
import { clamp01, hashString, nowUtc, uuid } from '@primeopp/contracts';

/**
 * A deterministic local image-match adapter for tests.
 *
 * TEST-ONLY. Do NOT use in production.
 *
 * The adapter computes a deterministic pseudo-similarity from a hash of
 * the imageEvidenceRef + candidate productId, then returns up to N
 * candidates whose similarity exceeds a threshold. This makes tests
 * reproducible without any external image provider.
 */
export class LocalTestImageMatchAdapter implements ImageMatchAdapter {
  readonly adapterId = 'local.test.image-match';
  readonly version = '1.0.0';
  readonly capabilities = ['VISUAL_MATCH', 'LOGO_DETECTION', 'QUALITY_SCORING', 'DUPLICATE_DETECTION'];

  private readonly catalog = new Map<string, string[]>(); // productId -> imageEvidenceRefs
  private readonly duplicateMap = new Map<string, string>(); // imageRef -> canonicalImageRef

  constructor(initial: { productId: string; imageEvidenceRefs: string[] }[] = []) {
    for (const e of initial) {
      this.catalog.set(e.productId, e.imageEvidenceRefs);
    }
  }

  registerProduct(productId: string, imageEvidenceRefs: string[]): void {
    this.catalog.set(productId, imageEvidenceRefs);
  }

  registerDuplicate(imageRef: string, canonicalImageRef: string): void {
    this.duplicateMap.set(imageRef, canonicalImageRef);
  }

  async match(request: ImageMatchRequest): Promise<ImageMatchResult> {
    const candidates: ImageMatchResult['candidates'] = [];
    for (const [productId, refs] of this.catalog.entries()) {
      let best = 0;
      for (const ref of refs) {
        const sim = pseudoSimilarity(request.imageEvidenceRef, ref);
        if (sim > best) best = sim;
      }
      if (best > 0.3) {
        candidates.push({ productId, similarity: best, source: this.adapterId });
      }
    }
    candidates.sort((a, b) => b.similarity - a.similarity);

    const quality = pseudoQuality(request.imageEvidenceRef);
    const duplicateOf = this.duplicateMap.get(request.imageEvidenceRef);

    return {
      providerRef: this.adapterId,
      observedAt: nowUtc(),
      candidates: candidates.slice(0, 10),
      detectedLogos: [],
      imageQualityScore: quality,
      ...(duplicateOf ? { duplicateOf } : {}),
      lowQuality: quality < 0.4,
      warnings: quality < 0.4 ? ['low image quality'] : [],
      evidenceRef: `evidence/image-match/${uuid()}`,
    };
  }
}

/**
 * Deterministic pseudo-similarity in [0, 1] derived from a hash of the
 * two image refs. NOT a real perceptual hash — only suitable for tests.
 */
export function pseudoSimilarity(a: string, b: string): number {
  if (a === b) return 1;
  const ha = hashString(a);
  const hb = hashString(b);
  // XOR-ish: count matching nibbles / 16.
  let match = 0;
  for (let i = 0; i < Math.min(ha.length, hb.length); i++) {
    if (ha[i] === hb[i]) match++;
  }
  return clamp01(match / 16);
}

/**
 * Deterministic pseudo-quality in [0, 1].
 */
export function pseudoQuality(imageRef: string): number {
  const h = hashString(imageRef);
  // Take first 4 hex chars as a quality value.
  const v = parseInt(h.slice(0, 4), 16) / 0xffff;
  return clamp01(v);
}

/**
 * Compute a perceptual-hash-style signature for an image ref.
 * Returns a 16-char hex string.
 */
export function perceptualHash(imageRef: string): string {
  return hashString(imageRef);
}

/**
 * Compare two perceptual hashes via Hamming distance.
 * Returns similarity in [0, 1].
 */
export function hammingSimilarity(a: string, b: string): number {
  if (a.length !== b.length) return 0;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    const xa = parseInt(a[i], 16);
    const xb = parseInt(b[i], 16);
    diff += bitCount(xa ^ xb);
  }
  return clamp01(1 - diff / (a.length * 4));
}

/**
 * Count the number of 1 bits in a number (Hamming weight).
 */
function bitCount(n: number): number {
  let count = 0;
  let x = n >>> 0;
  while (x) {
    count += x & 1;
    x >>>= 1;
  }
  return count;
}

export function createImageMatchRequest(
  imageEvidenceRef: string,
  scope: TenantScoped,
  catalogRef?: string,
): ImageMatchRequest {
  return { imageEvidenceRef, scope, ...(catalogRef ? { catalogRef } : {}) };
}
