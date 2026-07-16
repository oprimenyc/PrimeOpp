/**
 * ManualInputProvider — converts trustworthy manual input fields into
 * provider-style evidence.
 *
 * The manual provider is always able to handle any input that has a
 * `manualProduct` block. It emits each populated manual field as a
 * `FieldCandidate` with:
 *   - providerId: "manual"
 *   - providerPriority: 5 (high priority, but see manualTrustLevel)
 *   - sourceConfidence: 0.6 (treated as evidence, not authoritative truth)
 *
 * When the caller sets `EnrichmentOptions.manualTrustLevel = "authoritative"`,
 * the resolution engine promotes manual candidates to win ties against
 * non-exact-match providers.
 */

import type { ProductEnrichmentInput, ManualProductEntry } from "../contracts/input";
import type {
  EnrichmentContext,
  EnrichmentProviderCapability,
  ProductEnrichmentProvider,
  ProviderEnrichmentResult,
  FieldCandidate,
} from "../contracts/provider";

const FIELD_MAP: Array<{ manualKey: keyof ManualProductEntry; fieldPath: string }> = [
  { manualKey: "title", fieldPath: "identity.canonicalTitle" },
  { manualKey: "brand", fieldPath: "identity.brand" },
  { manualKey: "model", fieldPath: "identity.model" },
  { manualKey: "category", fieldPath: "classification.category" },
  { manualKey: "description", fieldPath: "description" },
  { manualKey: "mpn", fieldPath: "identifiers.mpn" },
  { manualKey: "color", fieldPath: "attributes.color" },
  { manualKey: "size", fieldPath: "attributes.size" },
];

export class ManualInputProvider implements ProductEnrichmentProvider {
  readonly id = "manual";
  readonly capabilities: EnrichmentProviderCapability[] = [
    "TEXT_SEARCH",
    "BRAND_MODEL_SEARCH",
    "ATTRIBUTE_ENRICHMENT",
  ];

  async canHandle(input: ProductEnrichmentInput): Promise<boolean> {
    return Boolean(input.manualProduct);
  }

  async enrich(
    input: ProductEnrichmentInput,
    _context: EnrichmentContext
  ): Promise<ProviderEnrichmentResult> {
    const retrievedAt = new Date().toISOString();
    const mp = input.manualProduct;
    if (!mp) {
      return {
        providerId: this.id,
        found: false,
        confidence: 0,
        candidates: [],
        retrievedAt,
      };
    }

    const candidates: FieldCandidate[] = [];
    for (const { manualKey, fieldPath } of FIELD_MAP) {
      const v = mp[manualKey];
      if (v === undefined || v === null || String(v).trim() === "") continue;
      candidates.push({
        field: fieldPath,
        value: v,
        normalizedValue: v,
        providerId: this.id,
        sourceConfidence: 0.6,
        // Lower priority than real providers so providers win ties in
        // "evidence" mode. In "authoritative" mode, the resolution engine
        // explicitly promotes manual candidates over non-exact-match providers.
        providerPriority: 50,
        evidence: { source: "manual" },
      });
    }

    return {
      providerId: this.id,
      found: candidates.length > 0,
      confidence: candidates.length > 0 ? 0.6 : 0,
      candidates,
      retrievedAt,
      externalReference: input.intakeId,
    };
  }
}
