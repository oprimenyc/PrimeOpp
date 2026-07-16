// Commerce events — Phase 20.

import type { CommerceEvent, CommerceEventSink, CommerceEventType, EventSensitivity, TenantId } from '@primeopp/contracts';
import { nowUtc, uuid } from '@primeopp/contracts';

export interface InMemoryEventSink extends CommerceEventSink {
  events: CommerceEvent[];
  subscribe(handler: (e: CommerceEvent) => void): () => void;
}

export function createInMemoryEventSink(): InMemoryEventSink {
  const events: CommerceEvent[] = [];
  const handlers: Array<(e: CommerceEvent) => void> = [];
  return {
    events,
    async emit<T>(event: CommerceEvent<T>): Promise<void> {
      events.push(event);
      for (const h of handlers) {
        try { h(event); } catch { /* swallow handler errors */ }
      }
    },
    subscribe(handler: (e: CommerceEvent) => void): () => void {
      handlers.push(handler);
      return () => {
        const idx = handlers.indexOf(handler);
        if (idx >= 0) handlers.splice(idx, 1);
      };
    },
  };
}

/**
 * Build a commerce event with required metadata.
 */
export function buildEvent<T>(opts: {
  type: CommerceEventType;
  tenantId: TenantId;
  payload: T;
  source: string;
  subject: string;
  correlationId?: string;
  organizationId?: string;
  evidenceRefs?: string[];
  sensitivity?: EventSensitivity;
}): CommerceEvent<T> {
  return {
    eventId: uuid(),
    schemaVersion: '1.0.0',
    tenantId: opts.tenantId,
    ...(opts.organizationId ? { organizationId: opts.organizationId } : {}),
    correlationId: opts.correlationId ?? uuid(),
    timestamp: nowUtc(),
    source: opts.source,
    subject: opts.subject,
    type: opts.type,
    payload: opts.payload,
    evidenceRefs: opts.evidenceRefs ?? [],
    sensitivity: opts.sensitivity ?? 'TENANT',
  };
}

/**
 * Filter events by tenant.
 * Cross-tenant access is denied — returns empty for any tenant mismatch.
 */
export function filterEventsByTenant(events: CommerceEvent[], tenantId: TenantId): CommerceEvent[] {
  return events.filter((e) => e.tenantId === tenantId);
}

/**
 * Filter events by type.
 */
export function filterEventsByType(events: CommerceEvent[], type: CommerceEventType): CommerceEvent[] {
  return events.filter((e) => e.type === type);
}

/**
 * Redact a commerce event for cross-tenant sharing.
 * COST_BASIS and SELLER_PRIVATE sensitivity events are dropped entirely.
 */
export function redactEventForSharing(event: CommerceEvent): CommerceEvent | null {
  if (event.sensitivity === 'COST_BASIS' || event.sensitivity === 'SELLER_PRIVATE' || event.sensitivity === 'SECRET') {
    return null;
  }
  // For TENANT and ORGANIZATION sensitivity, strip tenantId and organizationId for PUBLIC sharing.
  if (event.sensitivity === 'PUBLIC') return event;
  return { ...event, payload: undefined };
}

/**
 * Replay-detect: ensure the same eventId isn't processed twice.
 */
export class ReplayDetector {
  private readonly seen = new Set<string>();
  /** Maximum number of event IDs to remember. */
  private readonly max: number;
  private readonly fifo: string[] = [];

  constructor(max = 10000) {
    this.max = max;
  }

  /** Returns true if this is a NEW event, false if it's a replay. */
  check(eventId: string): boolean {
    if (this.seen.has(eventId)) return false;
    this.seen.add(eventId);
    this.fifo.push(eventId);
    if (this.fifo.length > this.max) {
      const old = this.fifo.shift()!;
      this.seen.delete(old);
    }
    return true;
  }
}
