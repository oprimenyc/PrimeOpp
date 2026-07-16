/**
 * Field candidate pool. Collects candidates from all providers and supports
 * efficient lookup by field path.
 */

import type { FieldCandidate, ImageCandidate } from "../contracts/provider";

export interface ProviderRunResult {
  providerId: string;
  result: import("../contracts/provider").ProviderEnrichmentResult;
  /** True if the result was an error or timeout. */
  failed: boolean;
}

export class CandidatePool {
  private readonly candidatesByField = new Map<string, FieldCandidate[]>();
  private readonly images: ImageCandidate[] = [];
  private readonly sources: import("../contracts/provider").ProviderEnrichmentResult[] = [];

  addProviderResult(result: import("../contracts/provider").ProviderEnrichmentResult): void {
    this.sources.push(result);
    for (const c of result.candidates) {
      const list = this.candidatesByField.get(c.field) ?? [];
      list.push(c);
      this.candidatesByField.set(c.field, list);
    }
    if (result.images) {
      for (const img of result.images) {
        this.images.push(img);
      }
    }
  }

  getCandidates(field: string): FieldCandidate[] {
    return this.candidatesByField.get(field) ?? [];
  }

  getAllFields(): string[] {
    return Array.from(this.candidatesByField.keys());
  }

  getAllImages(): ImageCandidate[] {
    return this.images;
  }

  getAllSources(): import("../contracts/provider").ProviderEnrichmentResult[] {
    return this.sources;
  }

  /**
   * Returns the set of provider IDs that contributed any candidate for the
   * given field. Used by the confidence engine to compute agreement.
   */
  getContributingProviders(field: string): string[] {
    const set = new Set<string>();
    for (const c of this.getCandidates(field)) {
      set.add(c.providerId);
    }
    return Array.from(set);
  }
}
