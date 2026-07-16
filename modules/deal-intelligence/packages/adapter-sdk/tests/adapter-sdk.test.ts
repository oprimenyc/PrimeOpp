import { describe, it, expect } from 'vitest';
import { InMemoryAdapterRegistry, conformanceChecks } from '../src/index.js';

function mkAdapter(over: any = {}): any {
  return {
    id: 'adapter:test' as any, version: '1.0.0', capabilities: ['fetch'],
    supportedRetailers: [], regions: ['US'], authenticationRequired: false,
    termsRestrictions: [], retrySemantics: { maxRetries: 3, backoff: 'exponential' },
    confidence: 0.7, freshness: '2024-01-01T00:00:00Z', evidenceSupport: true,
    browserRequired: false, legalReviewStatus: 'pending', testOnly: true,
    type: 'retailer-api',
    async healthCheck() { return { status: 'healthy' }; },
    async fetchProduct(id: string) { return { id }; },
    ...over
  };
}

describe('adapter-sdk', () => {
  it('register and retrieve by id', () => {
    const r = new InMemoryAdapterRegistry();
    const a = mkAdapter();
    r.register(a);
    expect(r.byId('adapter:test')).toBeDefined();
    expect(r.byType('retailer-api')).toHaveLength(1);
  });
  it('register rejects duplicates', () => {
    const r = new InMemoryAdapterRegistry();
    r.register(mkAdapter());
    expect(() => r.register(mkAdapter())).toThrow();
  });
  it('conformanceChecks passes for valid adapter', () => {
    expect(conformanceChecks(mkAdapter())).toHaveLength(0);
  });
  it('conformanceChecks flags missing confidence', () => {
    const issues = conformanceChecks(mkAdapter({ confidence: undefined }));
    expect(issues.some(i => i.includes('confidence'))).toBe(true);
  });
  it('conformanceChecks flags missing healthCheck', () => {
    const issues = conformanceChecks(mkAdapter({ healthCheck: undefined }));
    expect(issues.some(i => i.includes('healthCheck'))).toBe(true);
  });
});
