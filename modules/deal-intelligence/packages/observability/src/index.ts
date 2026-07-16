/**
 * @primeopp-deal-intelligence/observability
 *
 * Structured events and metric hooks. Does not build a competing
 * observability platform; exposes integration contracts only.
 */
import type { ObservabilityEvent, ObservabilityEventKind, TenantId, ISO8601 } from '@primeopp-deal-intelligence/contracts';
import { nowIso } from '@primeopp-deal-intelligence/contracts';

export class ObservabilityBus {
  private sinks: ((e: ObservabilityEvent) => void)[] = [];
  private events: ObservabilityEvent[] = [];
  private counters = new Map<string, number>();
  private gauges = new Map<string, number>();

  subscribe(fn: (e: ObservabilityEvent) => void): void { this.sinks.push(fn); }

  emit(kind: ObservabilityEventKind, payload: Record<string, unknown> = {}, level: ObservabilityEvent['level'] = 'info', tenantId?: TenantId, fallback?: { executed: boolean; reason: string }): void {
    const e: ObservabilityEvent = { kind, payload, level, tenantId, at: nowIso(), fallback };
    this.events.push(e);
    for (const s of this.sinks) { try { s(e); } catch { /* sink failure must not crash emitter */ } }
    this.counters.set(kind, (this.counters.get(kind) ?? 0) + 1);
  }

  incrementCounter(name: string, by = 1): void {
    this.counters.set(name, (this.counters.get(name) ?? 0) + by);
  }
  setGauge(name: string, value: number): void { this.gauges.set(name, value); }
  getCounter(name: string): number { return this.counters.get(name) ?? 0; }
  getGauge(name: string): number | undefined { return this.gauges.get(name); }

  listEvents(): ObservabilityEvent[] { return this.events.slice(); }
  clear(): void { this.events = []; this.counters.clear(); this.gauges.clear(); }

  /** No silent failures: every event with fallback must declare executed and reason. */
  assertNoSilentFailures(): { ok: boolean; failures: ObservabilityEvent[] } {
    const failures = this.events.filter(e => e.fallback && !e.fallback.executed);
    return { ok: failures.length === 0, failures };
  }
}

export const ALL_OBSERVABILITY_EVENT_KINDS: ObservabilityEventKind[] = [
  'source-check-started','source-check-completed','source-check-failed',
  'product-normalized','offer-normalized',
  'promotion-detected','coupon-validated',
  'price-history-updated',
  'deal-discovered','deal-validated','deal-rejected','deal-scored',
  'resale-opportunity-scored',
  'affiliate-link-created',
  'alert-queued','alert-delivered',
  'deal-rechecked','deal-corrected','deal-expired','dead-deal-detected',
  'community-submission-received','moderation-completed',
  'amos-job-created',
  'runtime-failed'
];

/** Required metric hooks. Implementations register gauges/counters under these names. */
export const REQUIRED_METRICS = [
  'deals-discovered','verified-deal-rate','rejected-deal-rate',
  'false-positive-rate','stale-deal-rate','dead-deal-latency',
  'retailer-health','source-success','crawl-cost',
  'browser-requirement-rate','affiliate-eligibility',
  'alert-delivery','premium-alert-latency',
  'community-accuracy','resale-opportunity-rate',
  'amos-job-creation'
];
