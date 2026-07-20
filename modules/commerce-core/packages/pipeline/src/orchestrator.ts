// End-to-end product ingestion pipeline: intake -> enrichment -> identity
// resolution -> canonical catalog creation.
//
// Every stage below is a REAL instance of the already-built, already-tested
// service from its own module -- this file's only job is wiring, using each
// stage's own documented handoff adapter (toEnrichmentInput,
// buildResolutionInputFromEnrichedProfile, createCanonicalProductFromResolutionResult).
// No stage's business logic is reimplemented here.

import {
  ProductIntakeService,
  type IntakeDeduplicationStore,
  type IntakeRecordRepository,
  type RawProductInput,
  type ProductIntakeRecord,
} from 'primeopp-product-intake';
import {
  toEnrichmentInput,
  ProductEnrichmentService,
  NoProviderError,
  type EnrichedProductProfile,
  type ProductEnrichmentProvider,
  type IntakeHandoffRecord,
} from 'primeopp-product-enrichment';
import {
  buildResolutionInputFromEnrichedProfile,
  ProductIdentityResolver,
  type EnrichmentHandoffProfile,
  type ResolutionResult,
} from '@primeopp/product-identity';
import {
  CanonicalCatalog,
  createCanonicalProductFromResolutionResult,
  type CatalogStorageAdapter,
  type CatalogAuditLog,
} from '@primeopp/canonical-catalog';
import { nowUtc } from '@primeopp/contracts';
import type {
  TenantScoped,
  Product,
  ProductKind,
  ProductListingState,
  ProductFulfillmentMode,
} from '@primeopp/contracts';
import { CatalogBackedIdentityAdapter } from './identity/catalog-backed-adapter.ts';
import { createLocalEnrichmentProviders } from './enrichment-providers.ts';

export interface IngestProductOptions {
  scope: TenantScoped;
  actor: string;
  catalogStorage: CatalogStorageAdapter;
  auditLog?: CatalogAuditLog;
  intakeDedupStore: IntakeDeduplicationStore;
  intakeRepo?: IntakeRecordRepository;
  /** Defaults to local, offline-only providers (manual entry + a small demo fixture set). */
  enrichmentProviders?: Array<{ provider: ProductEnrichmentProvider; priority?: number }>;
  productKind?: ProductKind;
  listingState?: ProductListingState;
  fulfillmentMode?: ProductFulfillmentMode;
  ownershipPrivate?: boolean;
}

export type IngestProductResult =
  | {
      outcome: 'CREATED';
      product: Product;
      intakeRecord: ProductIntakeRecord;
      enrichment: EnrichedProductProfile;
      resolution: ResolutionResult;
      warnings: string[];
    }
  | { outcome: 'INTAKE_REJECTED'; intakeRecord: ProductIntakeRecord; reason: string }
  | { outcome: 'INTAKE_DUPLICATE'; intakeRecord: ProductIntakeRecord; duplicateOf: string }
  | { outcome: 'NO_ENRICHMENT_DATA'; intakeRecord: ProductIntakeRecord; reason: string }
  | { outcome: 'ENRICHMENT_NOT_FOUND'; intakeRecord: ProductIntakeRecord; enrichment: EnrichedProductProfile }
  | {
      outcome: 'ALREADY_IN_CATALOG';
      intakeRecord: ProductIntakeRecord;
      enrichment: EnrichedProductProfile;
      resolution: ResolutionResult;
      reason: string;
    }
  | {
      outcome: 'NEEDS_HUMAN_REVIEW';
      intakeRecord: ProductIntakeRecord;
      enrichment: EnrichedProductProfile;
      resolution: ResolutionResult;
      reason: string;
    };

function toIntakeHandoffRecord(record: ProductIntakeRecord): IntakeHandoffRecord {
  return {
    intakeId: record.intakeId,
    status: record.status,
    ...(record.identifier
      ? {
          identifier: {
            rawValue: record.identifier.rawValue,
            normalizedValue: record.identifier.normalizedValue,
            identifierType: record.identifier.identifierType,
            isValidFormat: record.identifier.isValidFormat,
            ...(record.identifier.checksumValid !== undefined
              ? { checksumValid: record.identifier.checksumValid }
              : {}),
          },
        }
      : {}),
    ...(record.manualProduct ? { manualProduct: record.manualProduct } : {}),
    ...(record.sourceContext ? { sourceContext: record.sourceContext } : {}),
  };
}

function toEnrichmentHandoffProfile(profile: EnrichedProductProfile): EnrichmentHandoffProfile {
  return {
    enrichmentId: profile.enrichmentId,
    ...(profile.intakeId ? { intakeId: profile.intakeId } : {}),
    identifiers: profile.identifiers,
    identity: {
      ...(profile.identity.canonicalTitle ? { canonicalTitle: profile.identity.canonicalTitle } : {}),
      ...(profile.identity.brand ? { brand: profile.identity.brand } : {}),
      ...(profile.identity.model ? { model: profile.identity.model } : {}),
    },
    classification: {
      ...(profile.classification.category ? { category: profile.classification.category } : {}),
    },
    confidence: { overall: profile.confidence.overall },
    status: profile.status,
  };
}

/**
 * Run a single raw product input through the full ingestion pipeline.
 *
 * Every early return below is a legitimate, distinct outcome -- not an
 * error swallowed into a generic failure. Callers (the CLI) are expected to
 * map each outcome to its own exit code and operator-facing message.
 */
export async function ingestProduct(
  raw: RawProductInput,
  opts: IngestProductOptions
): Promise<IngestProductResult> {
  // --- Stage 1: intake ---
  const intakeService = new ProductIntakeService({
    deduplicationStore: opts.intakeDedupStore,
    ...(opts.intakeRepo ? { recordRepository: opts.intakeRepo } : {}),
  });
  const intakeRecord = await intakeService.intake(raw);

  if (intakeRecord.status === 'REJECTED') {
    const reason = intakeRecord.validationIssues
      .filter((i) => i.severity === 'ERROR')
      .map((i) => i.message)
      .join('; ') || 'Intake rejected the input.';
    return { outcome: 'INTAKE_REJECTED', intakeRecord, reason };
  }
  if (intakeRecord.status === 'DUPLICATE') {
    return { outcome: 'INTAKE_DUPLICATE', intakeRecord, duplicateOf: intakeRecord.duplicateOf! };
  }

  // --- Stage 2: enrichment ---
  const enrichmentInput = toEnrichmentInput(toIntakeHandoffRecord(intakeRecord));
  const enrichmentService = new ProductEnrichmentService({
    providers: opts.enrichmentProviders ?? createLocalEnrichmentProviders(),
  });

  let enrichedProfile: EnrichedProductProfile;
  try {
    enrichedProfile = await enrichmentService.enrich(enrichmentInput);
  } catch (err) {
    if (err instanceof NoProviderError) {
      return {
        outcome: 'NO_ENRICHMENT_DATA',
        intakeRecord,
        reason:
          'No enrichment provider could handle this input (unrecognized barcode with no manual product details). Provide manual title/brand/model or a recognized barcode.',
      };
    }
    throw err;
  }

  if (enrichedProfile.status === 'NOT_FOUND' || enrichedProfile.status === 'FAILED') {
    return { outcome: 'ENRICHMENT_NOT_FOUND', intakeRecord, enrichment: enrichedProfile };
  }

  // --- Stage 3: identity resolution ---
  const { input: resolutionInput } = buildResolutionInputFromEnrichedProfile(
    toEnrichmentHandoffProfile(enrichedProfile)
  );
  const identityResolver = new ProductIdentityResolver({
    adapters: [new CatalogBackedIdentityAdapter(opts.catalogStorage)],
  });
  const resolution = await identityResolver.resolve(resolutionInput, opts.scope);

  if (resolution.state === 'REQUIRES_HUMAN_REVIEW') {
    return {
      outcome: 'NEEDS_HUMAN_REVIEW',
      intakeRecord,
      enrichment: enrichedProfile,
      resolution,
      reason: resolution.recommendedNextAction,
    };
  }
  // Mirror @primeopp/canonical-catalog's own creation guard exactly
  // (assertNoMatchResolution): a resolution is only safe to create from when
  // state is NO_MATCH *and* it carries no candidates at all. The resolver's
  // detectState() has a documented fallthrough where a low-confidence match
  // (score < 0.5, no OCR input) is labeled NO_MATCH even though `candidates`
  // is non-empty -- treating that as "safe to create" would either produce a
  // duplicate canonical product or hit that guard's own thrown error instead
  // of a clean, reportable outcome.
  const hasExistingCandidates = resolution.candidates.length > 0 || Boolean(resolution.selectedCandidateId);
  if (resolution.state !== 'NO_MATCH' || hasExistingCandidates) {
    return {
      outcome: 'ALREADY_IN_CATALOG',
      intakeRecord,
      enrichment: enrichedProfile,
      resolution,
      reason:
        resolution.state === 'NO_MATCH'
          ? 'A lower-confidence potential match already exists in the catalog; flagged instead of risking a duplicate.'
          : resolution.recommendedNextAction,
    };
  }

  // --- Stage 4: canonical catalog creation ---
  const catalog = new CanonicalCatalog({ storage: opts.catalogStorage, ...(opts.auditLog ? { auditLog: opts.auditLog } : {}) });
  const { product, warnings } = await createCanonicalProductFromResolutionResult(catalog, resolution, {
    actor: opts.actor,
    ownership: { tenantId: opts.scope.tenantId, ...(opts.scope.organizationId ? { organizationId: opts.scope.organizationId } : {}), private: opts.ownershipPrivate ?? true },
    kind: opts.productKind ?? 'PHYSICAL',
    listingState: opts.listingState ?? 'UNLISTED',
    fulfillmentMode: opts.fulfillmentMode ?? 'SELLER_FULFILLED',
    source: {
      kind: 'AI_ENRICHMENT',
      ref: `enrichment:${enrichedProfile.enrichmentId}`,
      observedAt: nowUtc(),
      confidence: enrichedProfile.confidence.overall,
    },
  });

  return { outcome: 'CREATED', product, intakeRecord, enrichment: enrichedProfile, resolution, warnings };
}
