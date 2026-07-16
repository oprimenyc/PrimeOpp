import { describe, it, expect } from 'vitest';
import { evaluateStack, validateCoupon } from '../src/index.js';
import { money } from '@primeopp-deal-intelligence/contracts';

const baseCoupon = (over: any): any => ({
  code: 'SAVE10', description: '10% off', discountType: 'percentage',
  discountValue: 10, stackable: 'yes', evidence: [], ...over
});

describe('coupon-engine', () => {
  it('valid stack: 10% coupon reduces base price', () => {
    const r = evaluateStack({ basePrice: money(10000), coupons: [baseCoupon({})] });
    expect(r.status).toBe('valid');
    expect(r.effectivePrice.amountMinor).toBe(9000);
  });
  it('invalid: non-stackable coupon after another', () => {
    const r = evaluateStack({
      basePrice: money(10000),
      coupons: [baseCoupon({ code: 'A' }), baseCoupon({ code: 'B', stackable: 'no' })]
    });
    expect(r.status).toBe('invalid');
    expect(r.reasons.some(x => x.includes('non-stackable'))).toBe(true);
  });
  it('uncertain: stackability unknown', () => {
    const r = evaluateStack({
      basePrice: money(10000),
      coupons: [baseCoupon({ stackable: 'unknown' })]
    });
    expect(r.status).toBe('uncertain');
    expect(r.missingConfirmations.length).toBeGreaterThan(0);
  });
  it('clamps effective to zero if discounts exceed base', () => {
    const r = evaluateStack({
      basePrice: money(1000),
      coupons: [baseCoupon({ discountValue: 90 })],
      promotions: [{ id: 'p1', type: 'fixed', description: 'big', effectiveDiscount: money(500), stackable: 'yes', evidence: [] }]
    });
    expect(r.effectivePrice.amountMinor).toBe(0);
    expect(r.risks.some(x => x.includes('clamped'))).toBe(true);
  });
  it('respects minSpend', () => {
    const r = evaluateStack({
      basePrice: money(500),
      coupons: [baseCoupon({ minSpend: money(1000) })]
    });
    expect(r.status).toBe('invalid');
  });
  it('validateCoupon catches bad percentage', () => {
    const issues = validateCoupon(baseCoupon({ discountValue: 150 }));
    expect(issues.some(x => x.includes('percentage'))).toBe(true);
  });
});
