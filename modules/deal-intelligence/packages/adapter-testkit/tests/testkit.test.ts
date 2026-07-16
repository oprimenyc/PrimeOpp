import { describe, it, expect } from 'vitest';
import { TestRetailerApiAdapter, TestAffiliateAdapter, TestAlertChannelAdapter, runConformance, assertAllTestOnly, TEST_ONLY_BANNER } from '../src/index.js';

describe('adapter-testkit', () => {
  it('every adapter is testOnly=true', () => {
    const ads = [new TestRetailerApiAdapter(), new TestAffiliateAdapter(), new TestAlertChannelAdapter()];
    expect(assertAllTestOnly(ads)).toHaveLength(0);
  });
  it('conformance passes for TestRetailerApiAdapter', () => {
    const r = runConformance(new TestRetailerApiAdapter());
    expect(r.ok).toBe(true);
    expect(r.issues).toHaveLength(0);
  });
  it('TEST_ONLY_BANNER mentions TEST-ONLY', () => {
    expect(TEST_ONLY_BANNER).toMatch(/TEST-ONLY/);
  });
  it('TestAlertChannelAdapter captures delivered alerts', async () => {
    const a = new TestAlertChannelAdapter();
    await a.deliver({ id: '1' });
    expect(a.captured).toHaveLength(1);
  });
});
