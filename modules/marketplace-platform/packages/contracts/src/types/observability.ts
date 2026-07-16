// Observability contracts.
import type { Identifier, ISO8601 } from './common.js';

export type ObservabilityEventKind =
  | 'seller.created'
  | 'seller.verified'
  | 'buyer.created'
  | 'listing.created'
  | 'listing.validated'
  | 'listing.approved'
  | 'listing.publish.requested'
  | 'listing.published'
  | 'listing.publish.failed'
  | 'listing.updated'
  | 'listing.paused'
  | 'listing.ended'
  | 'inventory.sync.started'
  | 'inventory.sync.completed'
  | 'inventory.sync.failed'
  | 'oversell.prevented'
  | 'offer.created'
  | 'offer.countered'
  | 'offer.accepted'
  | 'order.created'
  | 'order.validated'
  | 'order.allocated'
  | 'order.shipped'
  | 'order.delivered'
  | 'order.cancelled'
  | 'return.requested'
  | 'return.completed'
  | 'dispute.created'
  | 'settlement.calculated'
  | 'moderation.flagged'
  | 'moderation.resolved'
  | 'commission.calculated'
  | 'runtime.failed';

export interface ObservabilityEvent {
  readonly eventId: Identifier;
  readonly tenantId: string;
  readonly kind: ObservabilityEventKind;
  readonly subjectType: string;
  readonly subjectId: Identifier;
  readonly timestamp: ISO8601;
  readonly payload: Readonly<Record<string, unknown>>;
  readonly correlationId?: Identifier;
  readonly evidenceId?: Identifier;
}

export interface MetricHook {
  readonly metricName: string;
  readonly tenantId: string;
  readonly value: number;
  readonly unit: string;
  readonly labels?: Readonly<Record<string, string>>;
  readonly timestamp: ISO8601;
}

export type MetricName =
  | 'active_sellers'
  | 'active_listings'
  | 'publication_success'
  | 'channel_failures'
  | 'inventory_sync_latency_ms'
  | 'oversell_prevention_count'
  | 'offer_conversion_rate'
  | 'order_conversion_rate'
  | 'commission_revenue'
  | 'return_rate'
  | 'dispute_rate'
  | 'fraud_rate'
  | 'primeopp_marketplace_listing_share'
  | 'seller_opt_out_rate'
  | 'seller_savings'
  | 'enterprise_volume'
  | 'channel_health';

export interface EventEmitter {
  emit(event: ObservabilityEvent): void;
  list(filter?: { readonly tenantId?: string; readonly kind?: ObservabilityEventKind; readonly since?: ISO8601 }): readonly ObservabilityEvent[];
}

export interface MetricReporter {
  record(metric: MetricHook): void;
  snapshot(): readonly MetricHook[];
}
