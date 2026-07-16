/**
 * Completeness engine.
 *
 * Calculates what fraction of the configured "important fields" are present
 * on the enriched profile, and lists which are missing.
 *
 * The default important-fields list is:
 *   - identity.canonicalTitle
 *   - identity.brand
 *   - identity.model OR identifiers.mpn
 *   - classification.category
 *   - description
 *   - identifiers.* (at least one identifier)
 *   - media.images (at least one image)
 *
 * Hosts can override this list per-call via `EnrichmentOptions.importantFields`
 * or per-category via a host-supplied policy (see INTEGRATION.md).
 */

import type { EnrichedProductProfile } from "../contracts/output";

export const DEFAULT_IMPORTANT_FIELDS: string[] = [
  "identity.canonicalTitle",
  "identity.brand",
  "identity.modelOrMpn",
  "classification.category",
  "description",
  "identifiers.any",
  "media.images",
];

export interface CompletenessResult {
  score: number;
  missingFields: string[];
}

export function computeCompleteness(
  profile: EnrichedProductProfile,
  importantFields: string[] = DEFAULT_IMPORTANT_FIELDS
): CompletenessResult {
  const present = new Set<string>();
  const missing: string[] = [];

  const has = (path: string): boolean => {
    if (path === "identity.modelOrMpn") {
      return Boolean(profile.identity.model) || Boolean(profile.identifiers.mpn?.length);
    }
    if (path === "identifiers.any") {
      const ids = profile.identifiers;
      return Boolean(
        ids.upc?.length ||
          ids.ean?.length ||
          ids.gtin?.length ||
          ids.isbn?.length ||
          ids.sku?.length ||
          ids.mpn?.length
      );
    }
    if (path === "media.images") {
      return Array.isArray(profile.media.images) && profile.media.images.length > 0;
    }
    if (path === "description") {
      return Boolean(profile.description && profile.description.trim().length > 0);
    }
    if (path === "bullets") {
      return Array.isArray(profile.bullets) && profile.bullets.length > 0;
    }

    // Generic dotted-path lookup.
    const parts = path.split(".");
    let cur: unknown = profile;
    for (const p of parts) {
      if (cur == null || typeof cur !== "object") return false;
      cur = (cur as Record<string, unknown>)[p];
    }
    if (Array.isArray(cur)) return cur.length > 0;
    return cur != null && cur !== "";
  };

  for (const f of importantFields) {
    if (has(f)) {
      present.add(f);
    } else {
      missing.push(f);
    }
  }

  const score = importantFields.length === 0 ? 0 : present.size / importantFields.length;
  return { score: round3(score), missingFields: missing };
}

function round3(v: number): number {
  if (!Number.isFinite(v)) return 0;
  return Math.round(v * 1000) / 1000;
}
