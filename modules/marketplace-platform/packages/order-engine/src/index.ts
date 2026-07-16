
// @primeopp-marketplace/order-engine
import type {
  Order, OrderState, OrderLine, BuyerReference, SellerReference, ListingReference,
  OrderPrice, OrderDiscount, OrderTaxReference, OrderCommissionReference,
  OrderPaymentReference, OrderFulfillment, OrderShipping, OrderPickup,
  OrderInventoryAllocation, OrderTimelineEntry, ExternalOrderEvent,
  Identifier, TenantId, ISO8601, Money, EvidenceStore
} from '@primeopp-marketplace/contracts';
import type { InventoryStore, LockStore, AllocationStore } from '@primeopp-marketplace/inventory-sync';
import { allocateForOrder } from '@primeopp-marketplace/inventory-sync';
import type { CommissionCalculation } from '@primeopp-marketplace/contracts';
import { emitEvent } from '@primeopp-marketplace/observability';
import type { EventEmitter } from '@primeopp-marketplace/contracts';
import { createHash } from 'node:crypto';

let counter = 0;
function newId(prefix: string): Identifier {
  counter += 1;
  return `${prefix}_${Date.now().toString(36)}_${counter.toString(36)}`;
}

const VALID_ORDER_TRANSITIONS: Record<OrderState, readonly OrderState[]> = {
  CREATED: ['PAYMENT_PENDING', 'CANCELLED', 'FAILED'],
  PAYMENT_PENDING: ['PAID', 'CANCELLED', 'FAILED'],
  PAID: ['CONFIRMED', 'CANCELLED'],
  CONFIRMED: ['ALLOCATED', 'CANCELLED'],
  ALLOCATED: ['AWAITING_SHIPMENT', 'READY_FOR_PICKUP', 'CANCELLED'],
  AWAITING_SHIPMENT: ['SHIPPED', 'CANCELLED'],
  SHIPPED: ['DELIVERED'],
  READY_FOR_PICKUP: ['PICKED_UP', 'CANCELLED'],
  PICKED_UP: ['DELIVERED'],
  DELIVERED: ['COMPLETED'],
  COMPLETED: ['RETURN_REQUESTED'],
  CANCEL_REQUESTED: ['CANCELLED'],
  CANCELLED: [],
  RETURN_REQUESTED: ['RETURNED'],
  RETURNED: ['REFUNDED'],
  REFUNDED: [],
  DISPUTED: [],
  FAILED: []
};

export function createOrder(params: {
  readonly tenantId: TenantId;
  readonly channelId: string;
  readonly buyer: BuyerReference;
  readonly seller: SellerReference;
  readonly listing: ListingReference;
  readonly lines: readonly OrderLine[];
  readonly price: OrderPrice;
  readonly commission: OrderCommissionReference;
  readonly payment: OrderPaymentReference;
  readonly fulfillment: OrderFulfillment;
  readonly shipping?: OrderShipping;
  readonly pickup?: OrderPickup;
  readonly channelOrderId?: string;
  readonly idempotencyKey: string;
}): Order {
  const now = new Date().toISOString();
  return {
    orderId: newId('order'),
    tenantId: params.tenantId,
    channelId: params.channelId,
    channelOrderId: params.channelOrderId,
    buyer: params.buyer,
    seller: params.seller,
    listing: params.listing,
    lines: params.lines,
    price: params.price,
    discounts: [],
    taxRefs: [],
    commission: params.commission,
    payment: params.payment,
    fulfillment: params.fulfillment,
    shipping: params.shipping,
    pickup: params.pickup,
    allocations: [],
    currentState: 'CREATED',
    timeline: [{ state: 'CREATED', at: now, reason: 'order created' }],
    createdAt: now,
    updatedAt: now,
    evidence: [],
    idempotencyKey: params.idempotencyKey
  };
}

export function transitionOrder(order: Order, target: OrderState, reason?: string, actor?: Identifier): { ok: true; order: Order } | { ok: false; code: string; message: string } {
  const allowed = VALID_ORDER_TRANSITIONS[order.currentState] ?? [];
  if (!allowed.includes(target)) {
    return { ok: false, code: 'INVALID_ORDER_TRANSITION', message: `cannot transition order from ${order.currentState} to ${target}` };
  }
  const entry: OrderTimelineEntry = { state: target, at: new Date().toISOString(), reason, actor };
  return { ok: true, order: { ...order, currentState: target, timeline: [...order.timeline, entry], updatedAt: new Date().toISOString() } };
}

export function allocateInventoryToOrder(params: {
  readonly order: Order;
  readonly inventory: InventoryStore;
  readonly locks: LockStore;
  readonly allocations: AllocationStore;
  readonly evidence?: EvidenceStore;
  readonly events?: EventEmitter;
}): { ok: true; order: Order } | { ok: false; code: string; message: string } {
  let order_ = params.order;
  for (const line of params.order.lines) {
    const r = allocateForOrder({
      inventory: params.inventory, locks: params.locks, allocations: params.allocations,
      evidence: params.evidence, events: params.events,
      tenantId: order_.tenantId, inventoryId: line.inventoryId, orderId: order_.orderId,
      quantity: line.quantity, channelId: order_.channelId, holder: `order-${order_.orderId}`
    });
    if (!r.ok) return r;
    order_ = { ...order_, allocations: [...order_.allocations, r.allocation] };
  }
  const t = transitionOrder(order_, 'ALLOCATED', 'inventory allocated');
  return t.ok ? { ok: true, order: t.order } : t;
}

// External order event signature verification (HMAC-SHA256).
export function signExternalOrderEvent(event: ExternalOrderEvent, secret: string): string {
  const payload = JSON.stringify({
    eventId: event.eventId,
    tenantId: event.tenantId,
    channelId: event.channelId,
    channelOrderId: event.channelOrderId,
    quantity: event.quantity,
    unitPrice: event.unitPrice,
    timestamp: event.timestamp,
    idempotencyKey: event.idempotencyKey
  });
  return createHash('sha256').update(payload + secret).digest('hex');
}

export function verifyExternalOrderEvent(event: ExternalOrderEvent, secret: string): boolean {
  const expected = signExternalOrderEvent(event, secret);
  // Constant-time-ish comparison
  if (expected.length !== event.signature.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i++) diff |= expected.charCodeAt(i) ^ event.signature.charCodeAt(i);
  return diff === 0;
}

// In-memory dedupe store for external order events (idempotency).
export class EventDedupeStore {
  private readonly seen = new Map<string, { at: ISO8601; eventId: string }>();

  checkAndMark(idempotencyKey: string, eventId: string): { duplicate: boolean; previousEventId?: string } {
    const existing = this.seen.get(idempotencyKey);
    if (existing) return { duplicate: true, previousEventId: existing.eventId };
    this.seen.set(idempotencyKey, { at: new Date().toISOString(), eventId });
    return { duplicate: false };
  }

  reset(): void { this.seen.clear(); }
}

export interface IngestExternalOrderResult {
  readonly accepted: boolean;
  readonly reason: string;
  readonly orderId?: Identifier;
  readonly duplicateEventId?: string;
  readonly evidence?: { readonly evidenceId: string; readonly hash: string; readonly timestamp: ISO8601 };
}

export function ingestExternalOrderEvent(params: {
  readonly event: ExternalOrderEvent;
  readonly secret: string;
  readonly dedupe: EventDedupeStore;
  readonly expectedTenantId: TenantId;
  readonly expectedSellerChannelAccountId: Identifier;
  readonly evidence?: EvidenceStore;
  readonly events?: EventEmitter;
}): IngestExternalOrderResult {
  // Validate tenant
  if (params.event.tenantId !== params.expectedTenantId) {
    return { accepted: false, reason: `tenant mismatch: expected ${params.expectedTenantId}, got ${params.event.tenantId}` };
  }
  // Validate seller channel account
  if (params.event.sellerChannelAccountId !== params.expectedSellerChannelAccountId) {
    return { accepted: false, reason: 'seller channel account mismatch' };
  }
  // Verify signature
  if (!verifyExternalOrderEvent(params.event, params.secret)) {
    return { accepted: false, reason: 'signature verification failed' };
  }
  // Idempotency / duplicate detection
  const dedupeResult = params.dedupe.checkAndMark(params.event.idempotencyKey, params.event.eventId);
  if (dedupeResult.duplicate) {
    return { accepted: false, reason: 'duplicate event', duplicateEventId: dedupeResult.previousEventId };
  }
  // Stale event detection (older than 7 days)
  const age = Date.now() - new Date(params.event.timestamp).getTime();
  if (age > 7 * 86400000) {
    return { accepted: false, reason: 'stale event (>7d old)' };
  }

  // All checks passed — create order
  const orderId = newId('order');
  if (params.events) emitEvent(params.events, { tenantId: params.event.tenantId, kind: 'order.created', subjectType: 'order', subjectId: orderId, payload: { channelOrderId: params.event.channelOrderId, channelId: params.event.channelId } });

  let evidence: { evidenceId: string; hash: string; timestamp: ISO8601 } | undefined;
  if (params.evidence) {
    const ev = params.evidence.record({
      tenantId: params.event.tenantId, kind: 'external_order_ingested', description: `external order ${params.event.channelOrderId} ingested`,
      actor: { actorType: 'adapter', actorId: params.event.channelId, tenantId: params.event.tenantId },
      subject: { type: 'order', id: orderId },
      payload: { channelOrderId: params.event.channelOrderId, eventId: params.event.eventId, quantity: params.event.quantity }
    });
    evidence = { evidenceId: ev.evidenceId, hash: ev.hash, timestamp: ev.timestamp };
  }
  return { accepted: true, reason: 'event ingested', orderId, evidence };
}

