/**
 * Profile builder.
 *
 * Consumes:
 *   - The original input.
 *   - The orchestrator's collected provider results.
 *
 * Produces:
 *   - A candidate pool.
 *   - Resolved fields (per-field winner + confidence + conflicts).
 *   - A fully-populated `EnrichedProductProfile`.
 *
 * Also handles:
 *   - Normalization of every candidate before resolution.
 *   - Image deduplication + primary selection.
 *   - Identifier deduplication.
 *   - Status determination (ENRICHED / PARTIAL / AMBIGUOUS / NOT_FOUND / FAILED).
 */

import type { ProductEnrichmentInput } from "../contracts/input";
import type {
  EnrichedProductProfile,
  EnrichedIdentifiers,
  EnrichedIdentity,
  EnrichedClassification,
} from "../contracts/output";
import type { ProviderEnrichmentResult, FieldCandidate, ImageCandidate } from "../contracts/provider";
import type { EnrichmentSourceRecord } from "../contracts/source-record";
import type { NormalizedAttribute } from "../contracts/attribute";
import type { ProductImage } from "../contracts/image";
import type { EnrichmentConflict } from "../conflicts/types";
import type { EnrichmentOptions } from "./options";

import { CandidatePool } from "../merging/candidate-pool";
import { resolveField } from "../resolution/engine";
import {
  normalizeBrand,
  normalizeTitle,
  normalizeModel,
  normalizeManufacturer,
  normalizeCategory,
  normalizeColor,
  normalizeSize,
  normalizeDimensions,
  normalizeWeight,
  normalizeBullets,
  normalizeWhitespace,
  dedupeIdentifiers,
  dedupeImages,
  selectPrimaryImage,
  boundString,
  isValidUrl,
} from "../normalization";
import { computeCompleteness, DEFAULT_IMPORTANT_FIELDS } from "../confidence/completeness";
import { computeOverallConfidence, shouldMarkAmbiguous } from "../confidence/engine";
import { isBarcodeIdentifier, isIsbnIdentifier } from "../domain/identifier";

const MAX_STRING_LEN = 4096;
const MAX_ATTRIBUTE_COUNT = 100;
const MAX_IMAGE_COUNT = 50;
const MAX_BULLET_COUNT = 50;
const MAX_SOURCE_COUNT = 50;
const MAX_RAW_REF_LEN = 256;

export interface ProfileBuilderInput {
  input: ProductEnrichmentInput;
  providerResults: Array<{ providerId: string; result: ProviderEnrichmentResult; failed: boolean }>;
  options: EnrichmentOptions;
}

export interface ProfileBuilderOutput {
  profile: EnrichedProductProfile;
  pool: CandidatePool;
  conflicts: EnrichmentConflict[];
  exactIdentifierMatchProviders: number;
}

export function buildProfile(args: ProfileBuilderInput): ProfileBuilderOutput {
  const { input, providerResults, options } = args;

  // 1. Build candidate pool with normalization applied.
  const pool = new CandidatePool();
  for (const { result } of providerResults) {
    if (!result.found) continue;
    const normalizedResult: ProviderEnrichmentResult = {
      ...result,
      candidates: result.candidates.map((c) => normalizeCandidate(c)),
      images: result.images,
    };
    pool.addProviderResult(normalizedResult);
  }

  // 2. Resolve every field that has candidates.
  const resolvedFields = new Map<string, {
    value: unknown;
    normalizedValue?: unknown;
    confidence: number;
    providers: string[];
  }>();
  const conflicts: EnrichmentConflict[] = [];
  for (const field of pool.getAllFields()) {
    const candidates = pool.getCandidates(field);
    const r = resolveField(field, candidates, {
      manualTrustLevel: options.manualTrustLevel ?? "evidence",
    });
    resolvedFields.set(field, {
      value: r.value,
      normalizedValue: r.normalizedValue,
      confidence: r.confidence,
      providers: r.contributingProviders,
    });
    if (r.conflict) conflicts.push(r.conflict);
  }

  // Sort conflicts deterministically: severity desc, then field asc.
  const severityOrder = { HIGH: 0, MEDIUM: 1, LOW: 2 } as const;
  conflicts.sort((a, b) => {
    const s = severityOrder[a.severity] - severityOrder[b.severity];
    if (s !== 0) return s;
    return a.field.localeCompare(b.field);
  });

  // 3. Extract identity fields.
  const identity: EnrichedIdentity = {};
  if (resolvedFields.has("identity.canonicalTitle")) {
    const v = resolvedFields.get("identity.canonicalTitle")!.value;
    identity.canonicalTitle = typeof v === "string" ? boundString(v, MAX_STRING_LEN) : undefined;
  }
  if (resolvedFields.has("identity.brand")) {
    const v = resolvedFields.get("identity.brand")!.value;
    identity.brand = typeof v === "string" ? boundString(v, MAX_STRING_LEN) : undefined;
  }
  if (resolvedFields.has("identity.manufacturer")) {
    const v = resolvedFields.get("identity.manufacturer")!.value;
    identity.manufacturer = typeof v === "string" ? boundString(v, MAX_STRING_LEN) : undefined;
  }
  if (resolvedFields.has("identity.model")) {
    const v = resolvedFields.get("identity.model")!.value;
    identity.model = typeof v === "string" ? boundString(v, MAX_STRING_LEN) : undefined;
  }

  // 4. Extract identifiers.
  const identifiers: EnrichedIdentifiers = {};
  const idLists: Record<string, string[]> = {
    upc: collectIdentifierValues(pool, "identifiers.upc"),
    ean: collectIdentifierValues(pool, "identifiers.ean"),
    gtin: collectIdentifierValues(pool, "identifiers.gtin"),
    isbn: collectIdentifierValues(pool, "identifiers.isbn"),
    sku: collectIdentifierValues(pool, "identifiers.sku"),
    mpn: collectIdentifierValues(pool, "identifiers.mpn"),
  };
  for (const k of Object.keys(idLists)) {
    const deduped = dedupeIdentifiers(idLists[k]);
    if (deduped.length > 0) {
      (identifiers as Record<string, string[]>)[k] = deduped;
    }
  }

  // 5. Extract classification.
  const classification: EnrichedClassification = {};
  if (resolvedFields.has("classification.category")) {
    classification.category = resolvedFields.get("classification.category")!.value as string;
  }
  if (resolvedFields.has("classification.subcategory")) {
    classification.subcategory = resolvedFields.get("classification.subcategory")!.value as string;
  }
  if (resolvedFields.has("classification.taxonomyPath")) {
    const path = resolvedFields.get("classification.taxonomyPath")!.value;
    if (Array.isArray(path)) {
      classification.taxonomyPath = (path as unknown[]).map((v) => String(v));
    }
  }

  // 6. Extract attributes (anything under "attributes.*").
  // For attribute values, prefer the post-normalization form when available
  // (e.g. dimensions/weight become structured objects).
  const attributes: Record<string, NormalizedAttribute> = {};
  let attributeCount = 0;
  for (const [field, resolved] of resolvedFields.entries()) {
    if (!field.startsWith("attributes.")) continue;
    if (attributeCount >= MAX_ATTRIBUTE_COUNT) break;
    const attrName = field.slice("attributes.".length);
    const rawValue = resolved.value;
    if (rawValue === undefined || rawValue === null) continue;
    const finalValue =
      resolved.normalizedValue !== undefined && resolved.normalizedValue !== null
        ? resolved.normalizedValue
        : rawValue;
    attributes[attrName] = {
      value: finalValue as NormalizedAttribute["value"],
      confidence: resolved.confidence,
      sources: resolved.providers,
    };
    attributeCount++;
  }

  // 7. Description + bullets.
  let description: string | undefined;
  if (resolvedFields.has("description")) {
    description = boundString(
      normalizeWhitespace(resolvedFields.get("description")!.value as string),
      MAX_STRING_LEN
    );
  }

  let bullets: string[] | undefined;
  const bulletCandidates = collectBulletLists(pool);
  if (bulletCandidates.length > 0) {
    bullets = normalizeBullets(bulletCandidates).slice(0, MAX_BULLET_COUNT);
  }

  // 8. Images.
  let images: ProductImage[] = [];
  if (options.includeImages !== false) {
    const allCandidates = pool.getAllImages();
    images = allCandidates
      .filter((c) => isValidUrl(c.url))
      .slice(0, MAX_IMAGE_COUNT)
      .map((c) => ({
        url: c.url,
        sourceProviderId: "", // filled below with provider from pool
        width: c.width,
        height: c.height,
        isPrimary: c.isPrimary,
        confidence: c.confidence,
      }));

    // We need sourceProviderId — re-walk the pool to attribute each image.
    const imageAttribution = new Map<string, string>();
    for (const source of pool.getAllSources()) {
      if (!source.images) continue;
      for (const img of source.images) {
        if (!imageAttribution.has(img.url)) {
          imageAttribution.set(img.url, source.providerId);
        }
      }
    }
    images = images.map((img) => ({
      ...img,
      sourceProviderId: imageAttribution.get(img.url) ?? "unknown",
    }));
    images = dedupeImages(images);
    // Primary selection.
    const primary = selectPrimaryImage(images);
    images = images.map((img) => ({
      ...img,
      isPrimary: img === primary ? true : false,
    }));
  }

  // 9. Sources.
  const sources: EnrichmentSourceRecord[] = [];
  for (const source of pool.getAllSources().slice(0, MAX_SOURCE_COUNT)) {
    const fieldsProvided: string[] = [];
    for (const c of source.candidates) {
      if (!fieldsProvided.includes(c.field)) fieldsProvided.push(c.field);
    }
    sources.push({
      providerId: source.providerId,
      retrievedAt: source.retrievedAt,
      confidence: source.confidence,
      externalReference: source.externalReference,
      fieldsProvided,
      rawReferenceId: boundString(source.rawReferenceId, MAX_RAW_REF_LEN),
    });
  }

  // 10. Compute exact-identifier-match provider count (for confidence bonus).
  let exactIdentifierMatchProviders = 0;
  if (input.identifier && (isBarcodeIdentifier(input.identifier.identifierType) || isIsbnIdentifier(input.identifier.identifierType))) {
    for (const source of pool.getAllSources()) {
      const hasExact = source.candidates.some(
        (c) => c.evidence?.exactMatch === true && c.field.startsWith("identifiers.")
      );
      if (hasExact) exactIdentifierMatchProviders++;
    }
  }

  // 11. Per-field confidence map.
  const fieldScores: Record<string, number> = {};
  for (const [field, resolved] of resolvedFields.entries()) {
    fieldScores[field] = resolved.confidence;
  }

  // 12. Determine status.
  const hasAnyField = resolvedFields.size > 0;
  const isAmbiguous = shouldMarkAmbiguous(conflicts);

  // Distinguish "all providers hard-failed" (FAILED) from "all providers
  // returned not-found" (NOT_FOUND). A not-found result is not a failure.
  const allHardFailed = providerResults.length > 0 && providerResults.every((r) => r.failed);
  const allNotFound =
    providerResults.length > 0 &&
    providerResults.every((r) => !r.result.found && !r.failed);

  let status: EnrichedProductProfile["status"];
  if (allHardFailed) {
    status = "FAILED";
  } else if (!hasAnyField && allNotFound) {
    status = "NOT_FOUND";
  } else if (!hasAnyField) {
    status = "NOT_FOUND";
  } else if (isAmbiguous) {
    status = "AMBIGUOUS";
  } else {
    // PARTIAL if any important field is missing, else ENRICHED.
    const completeness = computeCompleteness(
      {
        enrichmentId: "tmp",
        intakeId: input.intakeId,
        identifiers,
        identity,
        classification,
        attributes,
        description,
        bullets,
        media: { images },
        sources,
        conflicts,
        confidence: { overall: 0, fieldScores },
        completeness: { score: 0, missingFields: [] },
        status: "ENRICHED",
        createdAt: "",
      },
      options.importantFields ?? DEFAULT_IMPORTANT_FIELDS
    );
    status = completeness.missingFields.length > 0 ? "PARTIAL" : "ENRICHED";
  }

  // 13. Construct initial profile.
  const profile: EnrichedProductProfile = {
    enrichmentId: generateEnrichmentId(input),
    intakeId: input.intakeId,
    identifiers,
    identity,
    classification,
    attributes,
    description,
    bullets,
    media: { images },
    sources,
    conflicts,
    confidence: { overall: 0, fieldScores },
    completeness: { score: 0, missingFields: [] },
    status,
    createdAt: new Date().toISOString(),
  };

  // 14. Completeness.
  const completeness = computeCompleteness(
    profile,
    options.importantFields ?? DEFAULT_IMPORTANT_FIELDS
  );
  profile.completeness = completeness;

  // 15. Overall confidence.
  const overall = computeOverallConfidence({
    identifierType: input.identifier?.identifierType,
    identifierChecksumValid: input.identifier?.checksumValid,
    exactIdentifierMatchProviders,
    fieldScores,
    conflicts,
    completenessScore: completeness.score,
  });
  profile.confidence.overall = overall;

  // If overall confidence is 0 and status was ENRICHED/PARTIAL, downgrade to PARTIAL.
  if (overall === 0 && status === "ENRICHED") {
    profile.status = "PARTIAL";
  }

  return { profile, pool, conflicts, exactIdentifierMatchProviders };
}

function normalizeCandidate(c: FieldCandidate): FieldCandidate {
  let normalizedValue: unknown = c.value;
  switch (c.field) {
    case "identity.brand":
      normalizedValue = normalizeBrand(c.value as string);
      break;
    case "identity.canonicalTitle":
      normalizedValue = normalizeTitle(c.value as string);
      break;
    case "identity.model":
      normalizedValue = normalizeModel(c.value as string);
      break;
    case "identity.manufacturer":
      normalizedValue = normalizeManufacturer(c.value as string);
      break;
    case "classification.category":
    case "classification.subcategory":
      normalizedValue = normalizeCategory(c.value as string);
      break;
    case "attributes.color":
      normalizedValue = normalizeColor(c.value as string);
      break;
    case "attributes.size":
      normalizedValue = normalizeSize(c.value as string);
      break;
    case "attributes.dimensions":
      normalizedValue = normalizeDimensions(c.value as string);
      break;
    case "attributes.weight":
      normalizedValue = normalizeWeight(c.value as string | number);
      break;
    case "description":
      normalizedValue = normalizeWhitespace(c.value as string);
      break;
    default:
      if (typeof c.value === "string") {
        normalizedValue = normalizeWhitespace(c.value);
      } else if (Array.isArray(c.value)) {
        normalizedValue = (c.value as unknown[]).map((v) =>
          typeof v === "string" ? normalizeWhitespace(v) : v
        );
      }
  }
  return { ...c, normalizedValue };
}

function collectIdentifierValues(pool: CandidatePool, field: string): string[] {
  const out: string[] = [];
  for (const c of pool.getCandidates(field)) {
    if (Array.isArray(c.value)) {
      for (const v of c.value as unknown[]) {
        if (typeof v === "string" && v.trim()) out.push(v.trim());
      }
    } else if (typeof c.value === "string" && c.value.trim()) {
      out.push(c.value.trim());
    }
  }
  return out;
}

function collectBulletLists(pool: CandidatePool): string[] {
  const out: string[] = [];
  for (const c of pool.getCandidates("bullets")) {
    if (Array.isArray(c.value)) {
      for (const v of c.value as unknown[]) {
        if (typeof v === "string") out.push(v);
      }
    } else if (typeof c.value === "string") {
      out.push(c.value);
    }
  }
  return out;
}

function generateEnrichmentId(input: ProductEnrichmentInput): string {
  // Deterministic-ish: prefix + timestamp + identifier-or-manual hash.
  const seed = input.identifier?.normalizedValue ?? JSON.stringify(input.manualProduct ?? {});
  const hash = simpleHash(seed);
  return `enr_${Date.now().toString(36)}_${hash}`;
}

function simpleHash(s: string): string {
  let h = 5381;
  for (let i = 0; i < s.length; i++) {
    h = ((h << 5) + h) ^ s.charCodeAt(i);
  }
  return (h >>> 0).toString(36);
}
