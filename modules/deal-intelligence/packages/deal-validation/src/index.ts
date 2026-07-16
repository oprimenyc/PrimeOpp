/**
 * @primeopp-deal-intelligence/deal-validation
 *
 * Deal validation state machine. A deal must NOT be published as VERIFIED
 * without sufficient evidence.
 */
import type {
  RetailOffer, ProductCandidate, DealValidationResult, DealState, Evidence, ISO8601
} from '@primeopp-deal-intelligence/contracts';
import { nowIso } from '@primeopp-deal-intelligence/contracts';
import { isAvailableState } from '@primeopp-deal-intelligence/availability-engine';
import { effectivePrice } from '@primeopp-deal-intelligence/offer-normalization';

export interface ValidationContext {
  product?: ProductCandidate;
  offer: RetailOffer;
  /** Duplicate detection: existing deal IDs for the same product/retailer. */
  existingDealIds?: string[];
  /** Known exclusions (e.g. prohibited products). */
  knownExclusions?: string[];
  /** Required evidence kinds. Defaults to require at least one evidence. */
  requiredEvidenceKinds?: string[];
  /** Minimum confidence required to publish as VERIFIED. */
  minConfidence?: number;
  now?: ISO8601;
}

export function validateDeal(ctx: ValidationContext): DealValidationResult {
  const now = ctx.now ?? nowIso();
  const reasons: string[] = [];
  const missingEvidence: string[] = [];
  const evidence: Evidence[] = [...ctx.offer.evidence];
  let state: DealState = 'VALIDATING';

  // 1. Retailer identity
  if (!ctx.offer.retailerId) {
    reasons.push('retailerId missing');
    state = 'REJECTED';
  }
  // 2. Product identity
  if (!ctx.offer.productId) {
    reasons.push('productId missing');
    state = 'REJECTED';
  }
  if (ctx.product && ctx.product.identifiers.length === 0) {
    reasons.push('product has no identifiers');
    state = 'NEEDS_REVIEW';
  }
  // 3. Effective price
  const price = effectivePrice(ctx.offer);
  if (!price) {
    reasons.push('no effective price');
    state = 'NEEDS_REVIEW';
  }
  // 4. Availability
  if (!isAvailableState(ctx.offer.availability.state)) {
    reasons.push(`availability state ${ctx.offer.availability.state} is not available`);
    state = ctx.offer.availability.state === 'OUT_OF_STOCK' ? 'DEAD' : 'NEEDS_REVIEW';
  }
  // 5. Expiration
  if (ctx.offer.expiration.expiresAt && Date.parse(ctx.offer.expiration.expiresAt) < Date.parse(now)) {
    reasons.push('offer expired');
    state = 'EXPIRED';
  }
  // 6. Region/membership requirements → conditional
  if (ctx.offer.restrictions.membershipRequired || ctx.offer.restrictions.accountRequired) {
    reasons.push('membership or account required');
    if (state === 'VALIDATING') state = 'VERIFIED_WITH_CONDITIONS';
  }
  // 7. Affiliate eligibility
  // (Checked separately by affiliate-engine; here we only verify URL safety.)
  if (ctx.offer.source.sourceUrl && !isHttps(ctx.offer.source.sourceUrl)) {
    reasons.push('source URL not HTTPS');
    state = 'REJECTED';
  }
  // 8. Historical context — caller's responsibility (see deal-scoring).
  // 9. Evidence freshness
  if (!ctx.offer.evidence || ctx.offer.evidence.length === 0) {
    missingEvidence.push('at least one evidence of price observation');
    if (state === 'VALIDATING') state = 'NEEDS_REVIEW';
  }
  // 10. Duplicate state
  if (ctx.existingDealIds && ctx.existingDealIds.length > 0) {
    reasons.push(`duplicate of ${ctx.existingDealIds.length} existing deal(s)`);
    if (state === 'VALIDATING') state = 'NEEDS_REVIEW';
  }
  // 11. Known exclusions
  if (ctx.product?.category && ctx.knownExclusions?.includes(ctx.product.category)) {
    reasons.push(`category ${ctx.product.category} is excluded`);
    state = 'BLOCKED';
  }
  // 12. Confidence threshold
  const minConf = ctx.minConfidence ?? 0.7;
  if (state === 'VALIDATING' && ctx.offer.confidence.overall < minConf) {
    reasons.push(`confidence ${ctx.offer.confidence.overall} below required ${minConf}`);
    state = 'VERIFIED_WITH_CONDITIONS';
  }
  // 13. Final promotion
  if (state === 'VALIDATING') state = 'VERIFIED';

  return { state, reasons, missingEvidence, evidence, validatedAt: now };
}

function isHttps(url: string): boolean {
  try {
    return new URL(url).protocol === 'https:';
  } catch {
    return false;
  }
}

export function isTerminal(state: DealState): boolean {
  return ['PUBLISHED','REJECTED','DEAD','EXPIRED','FAILED','ARCHIVED','BLOCKED'].includes(state);
}

export function isPublishable(state: DealState): boolean {
  return ['VERIFIED','VERIFIED_WITH_CONDITIONS'].includes(state);
}
