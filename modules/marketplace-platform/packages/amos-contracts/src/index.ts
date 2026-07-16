
// @primeopp-marketplace/amos-contracts
import type { AmosJob, AmosCampaignKind, Identifier, TenantId, EvidenceStore } from '@primeopp-marketplace/contracts';

let counter = 0;
function newId(prefix: string): Identifier {
  counter += 1;
  return `${prefix}_${Date.now().toString(36)}_${counter.toString(36)}`;
}

export function createAmosJob(params: {
  readonly tenantId: TenantId;
  readonly kind: AmosCampaignKind;
  readonly listingRefs: readonly Identifier[];
  readonly sellerConsentId: Identifier;
  readonly verifiedFacts: ReadonlyArray<{ fact: string; evidenceId: Identifier }>;
  readonly publicUrls: readonly string[];
  readonly prohibitedClaims?: readonly string[];
  readonly disclosures: readonly string[];
  readonly expiresAt: string;
  readonly thumbnailConcepts: readonly string[];
  readonly shortScript?: string;
  readonly longFormOutline?: readonly string[];
  readonly captions?: readonly string[];
  readonly seoMetadata?: Readonly<Record<string, unknown>>;
  readonly evidence?: EvidenceStore;
}): AmosJob {
  const job: AmosJob = {
    amosJobId: newId('amos'),
    tenantId: params.tenantId,
    kind: params.kind,
    listingRefs: params.listingRefs,
    sellerConsentId: params.sellerConsentId,
    verifiedFacts: params.verifiedFacts,
    publicUrls: params.publicUrls,
    prohibitedClaims: params.prohibitedClaims ?? [],
    disclosures: params.disclosures,
    expiresAt: params.expiresAt,
    thumbnailConcepts: params.thumbnailConcepts,
    shortScript: params.shortScript,
    longFormOutline: params.longFormOutline,
    captions: params.captions,
    seoMetadata: params.seoMetadata,
    status: 'draft',
    evidence: [],
    createdAt: new Date().toISOString()
  };
  if (params.evidence) {
    params.evidence.record({
      tenantId: params.tenantId, kind: 'amos_job_created', description: `amos job ${params.kind}`,
      actor: { actorType: 'system', actorId: 'amos-contracts', tenantId: params.tenantId },
      subject: { type: 'amos_job', id: job.amosJobId },
      payload: { kind: params.kind, listingCount: params.listingRefs.length, consent: params.sellerConsentId }
    });
  }
  return job;
}

export function approveAmosJob(job: AmosJob): AmosJob {
  return { ...job, status: 'approved' };
}

export function isExpired(job: AmosJob): boolean {
  return new Date(job.expiresAt) < new Date();
}

