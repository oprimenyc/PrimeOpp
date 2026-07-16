
// @primeopp-marketplace/moderation
import type { ModerationResult, ModerationKind, ModerationDecision, ModerationPolicy, Identifier, TenantId, EvidenceStore } from '@primeopp-marketplace/contracts';

let counter = 0;
function newId(prefix: string): Identifier {
  counter += 1;
  return `${prefix}_${Date.now().toString(36)}_${counter.toString(36)}`;
}

export const DEFAULT_MODERATION_POLICY: ModerationPolicy = {
  policyId: 'moderation_default',
  tenantId: 'tenant_demo',
  version: '2026.01',
  prohibitedKeywords: ['counterfeit', 'stolen', 'fake gucci', 'replica'],
  prohibitedClaims: ['100% authentic guaranteed', '1 of 1 without provenance'],
  requiresHumanReviewFor: ['counterfeit_signals', 'unsafe_product', 'fraud'],
  effectiveFrom: '2026-01-01T00:00:00.000Z'
};

export function moderateListing(params: {
  readonly policy: ModerationPolicy;
  readonly tenantId: TenantId;
  readonly listingId: Identifier;
  readonly title: string;
  readonly description: string;
  readonly category?: string;
  readonly prohibitedCategories?: readonly string[];
  readonly evidence?: EvidenceStore;
}): ModerationResult {
  const text = (params.title + ' ' + params.description).toLowerCase();
  let ruleResult: 'pass' | 'warn' | 'fail' = 'pass';
  let reason = 'no issues';
  let aiRec: ModerationDecision | undefined;
  let final: ModerationDecision = 'approved';

  // Counterfeit signal check FIRST — replicas/1:1 require human review (not auto-reject)
  if (text.includes('replica') || text.includes('1:1') || text.includes('mirror quality')) {
    ruleResult = 'warn';
    reason = 'potential counterfeit signal — flag for human review';
    aiRec = 'ai_recommended_review';
    final = 'flagged_for_human';
  }

  // Prohibited category check (e.g. firearms, counterfeit_goods, stolen_goods, controlled_substances)
  if (params.category && params.prohibitedCategories?.includes(params.category)) {
    ruleResult = 'fail';
    reason = `prohibited category: ${params.category}`;
    final = 'rejected';
  }

  // Prohibited keyword check (only those NOT already covered by counterfeit signal)
  if (ruleResult !== 'fail') {
    for (const kw of params.policy.prohibitedKeywords) {
      // Skip 'counterfeit'/'replica' here since they're handled by counterfeit signal check above
      if (kw === 'counterfeit' || kw === 'replica') continue;
      if (text.includes(kw.toLowerCase())) {
        ruleResult = 'fail';
        reason = `prohibited keyword detected: ${kw}`;
        final = 'rejected';
        break;
      }
    }
  }
  // Prohibited claim check
  if (ruleResult !== 'fail') {
    for (const claim of params.policy.prohibitedClaims) {
      if (text.includes(claim.toLowerCase())) {
        ruleResult = 'fail';
        reason = `prohibited claim: ${claim}`;
        final = 'rejected';
        break;
      }
    }
  }

  const result: ModerationResult = {
    moderationId: newId('mod'),
    tenantId: params.tenantId,
    kind: 'listing_review',
    subjectType: 'listing',
    subjectId: params.listingId,
    policyVersion: params.policy.version,
    ruleResult,
    aiRecommendation: aiRec,
    finalDecision: final,
    reason,
    evidence: [],
    appealable: final === 'rejected',
    createdAt: new Date().toISOString()
  };

  if (params.evidence) {
    params.evidence.record({
      tenantId: params.tenantId, kind: 'moderation_result', description: reason,
      actor: { actorType: 'system', actorId: 'moderation', tenantId: params.tenantId },
      subject: { type: 'listing', id: params.listingId },
      payload: { ruleResult, final, reason }
    });
  }
  return result;
}

export function requireHumanReviewFor(kind: ModerationKind, policy: ModerationPolicy): boolean {
  return policy.requiresHumanReviewFor.includes(kind);
}

