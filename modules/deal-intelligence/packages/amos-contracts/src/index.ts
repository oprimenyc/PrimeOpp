/**
 * @primeopp-deal-intelligence/amos-contracts
 *
 * AMOS content job contracts. Does NOT generate or publish actual videos.
 */
import type {
  AmosJob, AmosJobKind, AffiliateLink, ISO8601, Confidence, Evidence
} from '@primeopp-deal-intelligence/contracts';
import { nextId, nowIso } from '@primeopp-deal-intelligence/contracts';

export interface AmosJobInput {
  kind: AmosJobKind;
  title: string;
  hook: string;
  verifiedFacts: string[];
  sourceReferences: string[];
  affiliateLinks: AffiliateLink[];
  disclosures: string[];
  thumbnailConcepts: string[];
  shortFormScript: string;
  longFormOutline: string[];
  blogOutline: string[];
  socialCaptions: string[];
  expiration?: ISO8601;
  evidenceConfidence: Confidence;
  evidence?: Evidence[];
}

export function createAmosJob(input: AmosJobInput): AmosJob {
  if (!input.title) throw new Error('createAmosJob: title required');
  if (!input.hook) throw new Error('createAmosJob: hook required');
  if (input.verifiedFacts.length === 0) throw new Error('createAmosJob: verifiedFacts required (no unsupported claims)');
  // Prohibited claims are computed from the rules below.
  const prohibitedClaims = computeProhibitedClaims(input.verifiedFacts);
  const correctionRequirements = [
    'Issue correction within 24 hours if any verified fact is challenged.',
    'Expire job if any underlying deal expires.',
    'Never republish expired deal as current.'
  ];
  return {
    id: nextId('amos') as any,
    kind: input.kind,
    title: input.title,
    hook: input.hook,
    verifiedFacts: input.verifiedFacts,
    prohibitedClaims,
    sourceReferences: input.sourceReferences,
    affiliateLinks: input.affiliateLinks,
    disclosures: input.disclosures.length > 0 ? input.disclosures : ['This content contains affiliate links. PrimeOpp may earn a commission.'],
    thumbnailConcepts: input.thumbnailConcepts,
    shortFormScript: input.shortFormScript,
    longFormOutline: input.longFormOutline,
    blogOutline: input.blogOutline,
    socialCaptions: input.socialCaptions,
    expiration: input.expiration,
    correctionRequirements,
    evidenceConfidence: input.evidenceConfidence,
    createdAt: nowIso()
  };
}

/** Prohibited claims: any statement that fabricates scarcity, guarantees stock,
 *  guarantees resale profit, or claims "lowest ever" without evidence. */
export function computeProhibitedClaims(verifiedFacts: string[]): string[] {
  const prohibited: string[] = [
    'Do not claim "lowest price ever" without historical evidence.',
    'Do not guarantee resale profit.',
    'Do not guarantee stock availability.',
    'Do not fabricate scarcity.',
    'Do not claim authorization from retailer without evidence.'
  ];
  // Detect potentially overclaimed facts and add specific prohibitions.
  for (const f of verifiedFacts) {
    const lf = f.toLowerCase();
    if (lf.includes('guaranteed') || lf.includes('lowest') || lf.includes('best ever')) {
      prohibited.push(`Specifically do not assert unverified claim: "${f}"`);
    }
  }
  return prohibited;
}

export const ALL_AMOS_JOB_KINDS: AmosJobKind[] = [
  'daily-top-deals','store-clearance-roundup','flip-of-the-day',
  'sneaker-alert','tool-alert','electronics-alert',
  'holiday-arbitrage','regional-clearance','restock-alert',
  'hidden-markdown','comparison-video','weekly-deal-recap'
];
