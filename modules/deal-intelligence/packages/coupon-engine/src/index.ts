/**
 * @primeopp-deal-intelligence/coupon-engine
 *
 * Deterministic coupon and stack evaluation. NEVER claims coupon
 * compatibility without evidence. Stack status is one of:
 *   'valid'     — all coupons explicitly stackable, no conflicts
 *   'invalid'   — at least one conflict or non-stackable coupon
 *   'uncertain' — at least one 'unknown' stackability, no conflicts
 */
import type {
  OfferCoupon, OfferPromotion, OfferRebate, OfferStack, Money, Evidence, OfferPrice
} from '@primeopp-deal-intelligence/contracts';
import { money, add, subtract, multiply, isZero, compare, min as moneyMin } from '@primeopp-deal-intelligence/contracts';

export interface StackInput {
  basePrice: Money;
  promotions?: OfferPromotion[];
  coupons?: OfferCoupon[];
  rebates?: OfferRebate[];
  evidence?: Evidence[];
}

export interface CouponStackResult {
  status: 'valid' | 'invalid' | 'uncertain';
  reasons: string[];
  effectivePrice: Money;
  requiredSteps: string[];
  risks: string[];
  missingConfirmations: string[];
  evidence: Evidence[];
  stack: OfferStack;
}

export function evaluateStack(input: StackInput): CouponStackResult {
  const reasons: string[] = [];
  const requiredSteps: string[] = [];
  const risks: string[] = [];
  const missingConfirmations: string[] = [];
  const evidence: Evidence[] = input.evidence ?? [];

  let effective = input.basePrice;
  let hasConflict = false;
  let hasUnknown = false;
  const seenTypes = new Set<string>();

  // Apply promotions first (automatic).
  for (const p of input.promotions ?? []) {
    if (p.stackable === 'no') {
      hasConflict = true;
      reasons.push(`promotion ${p.id} marked non-stackable`);
    } else if (p.stackable === 'unknown') {
      hasUnknown = true;
      missingConfirmations.push(`promotion ${p.id} stackability unknown`);
    }
    if (p.effectiveDiscount) {
      effective = subtract(effective, p.effectiveDiscount);
      if (compare(effective, money(0)) < 0) {
        effective = money(0, input.basePrice.currency);
        risks.push('promotions exceeded base price; clamped to zero');
      }
    }
    if (p.expiration) risks.push(`promotion ${p.id} expires ${p.expiration}`);
    if (p.membershipRequired) requiredSteps.push(`promotion ${p.id} requires membership`);
    if (p.minSpend && compare(input.basePrice, p.minSpend) < 0) {
      hasConflict = true;
      reasons.push(`promotion ${p.id} minSpend not met`);
    }
    evidence.push(...p.evidence);
    seenTypes.add(p.type);
  }

  // Apply coupons next. Only one of each "primary type" can apply unless stackable=yes.
  const appliedCoupons: OfferCoupon[] = [];
  for (const c of input.coupons ?? []) {
    if (c.stackable === 'no' && appliedCoupons.length > 0) {
      hasConflict = true;
      reasons.push(`coupon ${c.code} marked non-stackable but other coupons already applied`);
      continue;
    }
    if (c.stackable === 'unknown') {
      hasUnknown = true;
      missingConfirmations.push(`coupon ${c.code} stackability unknown`);
    }
    if (c.minSpend && compare(input.basePrice, c.minSpend) < 0) {
      hasConflict = true;
      reasons.push(`coupon ${c.code} minSpend not met`);
      continue;
    }
    if (c.discountType === 'percentage' && typeof c.discountValue === 'number') {
      const discount = multiply(input.basePrice, c.discountValue / 100);
      let d = discount;
      if (c.maxDiscount && compare(discount, c.maxDiscount) > 0) d = c.maxDiscount;
      effective = subtract(effective, d);
      if (compare(effective, money(0, input.basePrice.currency)) < 0) {
        effective = money(0, input.basePrice.currency);
        risks.push(`coupon ${c.code} caused effective price to go negative; clamped to zero`);
      }
    } else if (c.discountType === 'fixed') {
      // fixed discount specified via minSpend vs maxDiscount hack? No: use maxDiscount as fixed value.
      // For determinism, treat fixed as: subtract maxDiscount if present, else nothing.
      if (c.maxDiscount) effective = subtract(effective, c.maxDiscount);
      if (compare(effective, money(0, input.basePrice.currency)) < 0) {
        effective = money(0, input.basePrice.currency);
        risks.push(`coupon ${c.code} caused effective price to go negative; clamped to zero`);
      }
    } else if (c.discountType === 'shipping') {
      requiredSteps.push(`coupon ${c.code} applies to shipping`);
    } else if (c.discountType === 'gift') {
      requiredSteps.push(`coupon ${c.code} provides gift card value (not effective price reduction)`);
    }
    if (c.expiration) risks.push(`coupon ${c.code} expires ${c.expiration}`);
    if (c.membershipRequired) requiredSteps.push(`coupon ${c.code} requires membership`);
    evidence.push(...c.evidence);
    appliedCoupons.push(c);
  }

  // Apply rebates (post-purchase).
  let rebateTotal = money(0, input.basePrice.currency);
  for (const r of input.rebates ?? []) {
    rebateTotal = add(rebateTotal, r.amount);
    if (r.submissionRequired) requiredSteps.push(`rebate ${r.id} requires submission`);
    evidence.push(...r.evidence);
  }
  // Net effective after rebate.
  const netAfterRebate = subtract(effective, rebateTotal);
  const finalEffective = compare(netAfterRebate, money(0, input.basePrice.currency)) < 0
    ? money(0, input.basePrice.currency) : netAfterRebate;

  const status: 'valid' | 'invalid' | 'uncertain' = hasConflict
    ? 'invalid'
    : (hasUnknown ? 'uncertain' : 'valid');

  const stack: OfferStack = {
    promotions: input.promotions ?? [],
    coupons: appliedCoupons,
    rebates: input.rebates ?? [],
    status,
    reasons,
    effectivePrice: finalEffective,
    requiredSteps,
    risks,
    missingConfirmations,
    evidence
  };

  return { status, reasons, effectivePrice: finalEffective, requiredSteps, risks, missingConfirmations, evidence, stack };
}

/** Validate a single coupon's structure (not its real-world applicability). */
export function validateCoupon(c: OfferCoupon): string[] {
  const issues: string[] = [];
  if (!c.code) issues.push('coupon: code required');
  if (c.discountType === 'percentage') {
    if (typeof c.discountValue !== 'number' || c.discountValue < 0 || c.discountValue > 100) {
      issues.push('coupon: percentage discountValue must be 0..100');
    }
  }
  if (c.stackable !== 'yes' && c.stackable !== 'no' && c.stackable !== 'unknown') {
    issues.push('coupon: stackable must be yes | no | unknown');
  }
  return issues;
}
