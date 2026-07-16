// Moderation contracts.
import type { Identifier, TenantId, ISO8601, EvidenceRecord } from './common.js';

export type ModerationKind =
  | 'listing_review'
  | 'image_review'
  | 'title_review'
  | 'description_review'
  | 'prohibited_claims'
  | 'keyword_abuse'
  | 'counterfeit_signals'
  | 'unsafe_product'
  | 'inappropriate_content'
  | 'duplicate_listing'
  | 'spam'
  | 'fraud'
  | 'seller_conduct'
  | 'buyer_conduct';

export type ModerationDecision =
  | 'approved'
  | 'rejected'
  | 'flagged_for_human'
  | 'ai_recommended_review'
  | 'removed'
  | 'restored';

export interface ModerationPolicy {
  readonly policyId: Identifier;
  readonly tenantId: TenantId;
  readonly version: string;
  readonly prohibitedKeywords: readonly string[];
  readonly prohibitedClaims: readonly string[];
  readonly requiresHumanReviewFor: readonly ModerationKind[];
  readonly effectiveFrom: ISO8601;
}

export interface ModerationResult {
  readonly moderationId: Identifier;
  readonly tenantId: TenantId;
  readonly kind: ModerationKind;
  readonly subjectType: 'listing' | 'message' | 'image' | 'review' | 'seller' | 'buyer';
  readonly subjectId: Identifier;
  readonly policyVersion: string;
  readonly ruleResult: 'pass' | 'warn' | 'fail';
  readonly aiRecommendation?: ModerationDecision;
  readonly humanDecision?: ModerationDecision;
  readonly finalDecision: ModerationDecision;
  readonly reason: string;
  readonly evidence: readonly EvidenceRecord[];
  readonly appealable: boolean;
  readonly reviewedBy?: Identifier;
  readonly createdAt: ISO8601;
  readonly resolvedAt?: ISO8601;
}
