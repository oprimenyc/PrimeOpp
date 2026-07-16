import { describe, it, expect } from 'vitest';
import { evaluatePromotion, applyPromotions, ALL_PROMOTION_TYPES } from '../src/index.js';
import { money } from '@primeopp-deal-intelligence/contracts';

const basePromo = (over: any): any => ({
  id: 'p1', type: 'percentage', description: '10% off',
  effectiveDiscount: money(1000), stackable: 'yes', evidence: [], ...over
});

describe('promotion-engine', () => {
  it('percentage applies when minSpend met', () => {
    const r = evaluatePromotion(basePromo({}), { basePrice: money(10000), quantity: 1 });
    expect(r.applies).toBe(true);
    expect(r.effectiveDiscount.amountMinor).toBe(1000);
  });
  it('member promotion requires member', () => {
    const r = evaluatePromotion(basePromo({ type: 'member' }), { basePrice: money(10000), quantity: 1, isMember: false });
    expect(r.applies).toBe(false);
  });
  it('BOGO computes discount for even quantity', () => {
    const r = evaluatePromotion(basePromo({ type: 'BOGO' }), { basePrice: money(5000), quantity: 4 });
    expect(r.applies).toBe(true);
    expect(r.effectiveDiscount.amountMinor).toBe(10000); // 2 free
  });
  it('first-order rejected for non-first-order', () => {
    const r = evaluatePromotion(basePromo({ type: 'first-order' }), { basePrice: money(10000), quantity: 1, isFirstOrder: false });
    expect(r.applies).toBe(false);
  });
  it('app-only rejected on web channel', () => {
    const r = evaluatePromotion(basePromo({ type: 'app-only' }), { basePrice: money(10000), quantity: 1, channel: 'web' });
    expect(r.applies).toBe(false);
  });
  it('maxDiscount caps discount', () => {
    const r = evaluatePromotion(basePromo({ effectiveDiscount: money(5000), maxDiscount: money(2000) }), { basePrice: money(10000), quantity: 1 });
    expect(r.effectiveDiscount.amountMinor).toBe(2000);
  });
  it('applyPromotions sums totalDiscount', () => {
    const r = applyPromotions([basePromo({ id: 'a' }), basePromo({ id: 'b' })], { basePrice: money(10000), quantity: 1 });
    expect(r.applied).toHaveLength(2);
    expect(r.totalDiscount.amountMinor).toBe(2000);
  });
  it('ALL_PROMOTION_TYPES contains every supported type', () => {
    expect(ALL_PROMOTION_TYPES.length).toBeGreaterThanOrEqual(18);
    expect(ALL_PROMOTION_TYPES).toContain('BOGO');
    expect(ALL_PROMOTION_TYPES).toContain('first-order');
  });
});
