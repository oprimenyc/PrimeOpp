import { describe, it, expect } from 'vitest';
import { ObservabilityBus, ALL_OBSERVABILITY_EVENT_KINDS, REQUIRED_METRICS } from '../src/index.js';

describe('observability', () => {
  it('emit records event and increments counter', () => {
    const b = new ObservabilityBus();
    b.emit('deal-discovered', { id: 'd1' });
    expect(b.listEvents()).toHaveLength(1);
    expect(b.getCounter('deal-discovered')).toBe(1);
  });
  it('subscribe receives events', () => {
    const b = new ObservabilityBus();
    let seen = 0;
    b.subscribe(() => { seen++; });
    b.emit('alert-queued');
    b.emit('alert-delivered');
    expect(seen).toBe(2);
  });
  it('sink failure does not crash emitter', () => {
    const b = new ObservabilityBus();
    b.subscribe(() => { throw new Error('boom'); });
    expect(() => b.emit('runtime-failed')).not.toThrow();
  });
  it('assertNoSilentFailures flags unexecuted fallbacks', () => {
    const b = new ObservabilityBus();
    b.emit('source-check-failed', {}, 'warn', undefined, { executed: false, reason: 'fixture missing' });
    const r = b.assertNoSilentFailures();
    expect(r.ok).toBe(false);
    expect(r.failures).toHaveLength(1);
  });
  it('ALL_OBSERVABILITY_EVENT_KINDS covers all required kinds', () => {
    expect(ALL_OBSERVABILITY_EVENT_KINDS.length).toBeGreaterThanOrEqual(20);
    expect(ALL_OBSERVABILITY_EVENT_KINDS).toContain('deal-discovered');
    expect(ALL_OBSERVABILITY_EVENT_KINDS).toContain('runtime-failed');
  });
  it('REQUIRED_METRICS includes the canonical list', () => {
    expect(REQUIRED_METRICS).toContain('verified-deal-rate');
    expect(REQUIRED_METRICS).toContain('dead-deal-latency');
  });
});
