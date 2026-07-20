// A production-appropriate ProductIdentityAdapter backed by the real,
// persisted canonical catalog -- replacing @primeopp/product-identity's
// LocalTestProductIdentityAdapter, which is explicitly TEST-ONLY and holds
// its own private, never-populated-from-the-catalog Map. Using that adapter
// in the SDK meant identity resolution always returned NO_MATCH regardless
// of what was already in the catalog, so re-ingesting the same product could
// never be detected as a duplicate.
//
// Matching logic (barcode-exact, then title/brand/model scoring) mirrors
// LocalTestProductIdentityAdapter's own tested logic; only the data source
// changes (persisted CatalogStorageAdapter instead of a private in-memory Map).

import type { CatalogStorageAdapter } from '@primeopp/canonical-catalog';
import { clamp01 } from '@primeopp/contracts';
import type { TenantScoped } from '@primeopp/contracts';
import type { ProductIdentityAdapter, ResolutionCandidate, ResolutionInput } from '@primeopp/product-identity';

export class CatalogBackedIdentityAdapter implements ProductIdentityAdapter {
  readonly adapterId = 'catalog.persisted.product-identity';
  readonly version = '1.0.0';

  private readonly storage: CatalogStorageAdapter;

  constructor(storage: CatalogStorageAdapter) {
    this.storage = storage;
  }

  async resolve(
    input: ResolutionInput,
    scope: TenantScoped
  ): Promise<{ candidates: ResolutionCandidate[]; warnings: string[] }> {
    const candidates: ResolutionCandidate[] = [];
    const warnings: string[] = [];

    if (input.barcode) {
      const matches = await this.storage.search(scope.tenantId, { identifier: input.barcode.normalizedValue });
      for (const p of matches) {
        const matchedIdentifier = p.identifiers.find((i) => i.value === input.barcode!.normalizedValue);
        // Confidence here reflects match CERTAINTY (an exact identifier-value
        // equality lookup), not the matched product's own historical identity
        // confidence -- those are unrelated concepts. A product created from a
        // genuine NO_MATCH resolution carries identity confidence 0 by
        // definition; inheriting that value here would misreport a certain
        // exact-value match as a near-zero-confidence one.
        candidates.push({
          productId: p.id,
          confidence: 1,
          matchedFields: ['barcode'],
          conflictingFields: [],
          missingFields: [],
          evidenceRefs: matchedIdentifier ? [matchedIdentifier.source] : [],
          source: this.adapterId,
        });
      }
    }

    if (input.title || input.brand || input.model) {
      const all = await this.storage.list(scope.tenantId);
      for (const p of all) {
        const matched: string[] = [];
        let score = 0;
        if (input.title && p.title.toLowerCase().includes(input.title.toLowerCase())) {
          matched.push('title');
          score += 0.4;
        }
        if (input.brand && p.brand && p.brand.normalized === input.brand.toUpperCase()) {
          matched.push('brand');
          score += 0.3;
        }
        if (input.model && p.model && p.model.normalized === input.model.toUpperCase()) {
          matched.push('model');
          score += 0.3;
        }
        if (score > 0 && !candidates.some((c) => c.productId === p.id)) {
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
