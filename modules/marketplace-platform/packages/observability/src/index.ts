// @primeopp-marketplace/observability
// In-memory event emitter + metric reporter implementing the contracts.

import type { EventEmitter, MetricReporter, MetricHook, ObservabilityEvent } from '@primeopp-marketplace/contracts';

let counter = 0;
function newId(prefix: string): string {
  counter += 1;
  return `${prefix}_${Date.now().toString(36)}_${counter.toString(36)}`;
}

export class InMemoryEventEmitter implements EventEmitter {
  private readonly events: ObservabilityEvent[] = [];

  emit(event: ObservabilityEvent): void {
    this.events.push(event);
  }

  list(filter?: { readonly tenantId?: string; readonly kind?: ObservabilityEvent['kind']; readonly since?: string }): readonly ObservabilityEvent[] {
    return this.events.filter(e =>
      (!filter?.tenantId || e.tenantId === filter.tenantId) &&
      (!filter?.kind || e.kind === filter.kind) &&
      (!filter?.since || e.timestamp >= filter.since)
    );
  }

  count(): number {
    return this.events.length;
  }
}

export class InMemoryMetricReporter implements MetricReporter {
  private readonly metrics: MetricHook[] = [];

  record(metric: MetricHook): void {
    this.metrics.push(metric);
  }

  snapshot(): readonly MetricHook[] {
    return Array.from(this.metrics);
  }

  sumByName(name: string): number {
    return this.metrics.filter(m => m.metricName === name).reduce((s, m) => s + m.value, 0);
  }
}

export function emitEvent(
  emitter: EventEmitter,
  params: {
    readonly tenantId: string;
    readonly kind: ObservabilityEvent['kind'];
    readonly subjectType: string;
    readonly subjectId: string;
    readonly payload?: Readonly<Record<string, unknown>>;
    readonly correlationId?: string;
    readonly evidenceId?: string;
  }
): ObservabilityEvent {
  const event: ObservabilityEvent = {
    eventId: newId('evt'),
    tenantId: params.tenantId,
    kind: params.kind,
    subjectType: params.subjectType,
    subjectId: params.subjectId,
    timestamp: new Date().toISOString(),
    payload: params.payload ?? {},
    correlationId: params.correlationId,
    evidenceId: params.evidenceId
  };
  emitter.emit(event);
  return event;
}

export function createInMemoryEventEmitter(): EventEmitter {
  return new InMemoryEventEmitter();
}

export function createInMemoryMetricReporter(): MetricReporter {
  return new InMemoryMetricReporter();
}
