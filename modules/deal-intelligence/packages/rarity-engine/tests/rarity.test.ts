import { describe, it, expect } from 'vitest';
import { computeRarity, detectScarcityManipulation } from '../src/index.js';

describe('rarity-engine', () => {
  it('common product has low rarity', () => {
    const r = computeRarity({
      observationCount: 100, inStockDurationMs: 30 * 24 * 3600 * 1000,
      retailerCount: 10, regionCount: 5, demandProxy: 0.1, resalePremiumPct: 0,
      releaseCadencePerYear: 50, productLifecycle: 'mature', communityInterestScore: 0.1
    });
    expect(r.rarityScore).toBeLessThan(50);
    expect(r.urgency).toBe('low');
  });
  it('rare limited release has high rarity', () => {
    const r = computeRarity({
      observationCount: 1, inStockDurationMs: 30 * 60 * 1000,
      retailerCount: 1, regionCount: 1, demandProxy: 0.95, resalePremiumPct: 200,
      releaseCadencePerYear: 1, productLifecycle: 'limited', communityInterestScore: 0.9
    });
    expect(r.rarityScore).toBeGreaterThan(70);
    expect(r.recommendedAlertPriority).toMatch(/critical|high/);
  });
  it('flags missing data without fabricating score', () => {
    const r = computeRarity({ observationCount: 5, inStockDurationMs: 1000, retailerCount: 1, regionCount: 1 });
    expect(r.missing.length).toBeGreaterThan(0);
  });
  it('detectScarcityManipulation flags suspicious high rarity + low obs + no resale premium', () => {
    const inputs: any = { observationCount: 1, inStockDurationMs: 1000, retailerCount: 1, regionCount: 1, resalePremiumPct: 5 };
    const r = computeRarity(inputs);
    expect(detectScarcityManipulation(r, inputs)).toBe(true);
  });
});
