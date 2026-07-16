
// @primeopp-marketplace/returns
import type { ReturnRequest, ReturnState, ReturnReason, Identifier, TenantId, Money, EvidenceStore } from '@primeopp-marketplace/contracts';

let counter = 0;
function newId(prefix: string): Identifier {
  counter += 1;
  return `${prefix}_${Date.now().toString(36)}_${counter.toString(36)}`;
}

const VALID_RETURN_TRANSITIONS: Record<ReturnState, readonly ReturnState[]> = {
  REQUESTED: ['ELIGIBILITY_REVIEW', 'DENIED', 'CANCELLED' as ReturnState],
  ELIGIBILITY_REVIEW: ['APPROVED', 'DENIED', 'ESCALATED'],
  APPROVED: ['LABEL_PENDING'],
  DENIED: ['ESCALATED', 'CLOSED'],
  LABEL_PENDING: ['IN_TRANSIT'],
  IN_TRANSIT: ['RECEIVED'],
  RECEIVED: ['INSPECTED'],
  INSPECTED: ['REFUND_PENDING', 'PARTIALLY_REFUNDED' as ReturnState],
  REFUND_PENDING: ['REFUNDED', 'PARTIALLY_REFUNDED'],
  REFUNDED: ['CLOSED'],
  PARTIALLY_REFUNDED: ['CLOSED'],
  CLOSED: [],
  ESCALATED: ['APPROVED', 'DENIED', 'CLOSED']
};

const ESCALATED_STATES: ReturnState[] = ['ESCALATED'];
void ESCALATED_STATES;

export function createReturnRequest(params: {
  readonly tenantId: TenantId;
  readonly orderId: Identifier;
  readonly buyerId: Identifier;
  readonly sellerId: Identifier;
  readonly reason: ReturnReason;
  readonly description: string;
  readonly policyVersion: string;
  readonly photos?: readonly string[];
  readonly evidence?: EvidenceStore;
}): ReturnRequest {
  const now = new Date().toISOString();
  const r: ReturnRequest = {
    returnId: newId('ret'),
    tenantId: params.tenantId,
    orderId: params.orderId,
    buyerId: params.buyerId,
    sellerId: params.sellerId,
    reason: params.reason,
    description: params.description,
    photos: params.photos,
    policyVersion: params.policyVersion,
    state: 'REQUESTED',
    timeline: [{ state: 'REQUESTED', at: now, reason: 'return requested' }],
    evidence: [],
    createdAt: now,
    updatedAt: now
  };
  if (params.evidence) {
    params.evidence.record({
      tenantId: params.tenantId, kind: 'return_requested', description: `return for reason ${params.reason}`,
      actor: { actorType: 'buyer', actorId: params.buyerId, tenantId: params.tenantId },
      subject: { type: 'return', id: r.returnId },
      payload: { orderId: params.orderId, reason: params.reason }
    });
  }
  return r;
}

export function transitionReturn(r: ReturnRequest, target: ReturnState, reason?: string): { ok: true; ret: ReturnRequest } | { ok: false; code: string; message: string } {
  const allowed = VALID_RETURN_TRANSITIONS[r.state] ?? [];
  if (!allowed.includes(target)) {
    return { ok: false, code: 'INVALID_RETURN_TRANSITION', message: `cannot transition return from ${r.state} to ${target}` };
  }
  const now = new Date().toISOString();
  return { ok: true, ret: { ...r, state: target, timeline: [...r.timeline, { state: target, at: now, reason }], updatedAt: now } };
}

export function setRefundAmount(r: ReturnRequest, amount: Money): ReturnRequest {
  return { ...r, refundAmount: amount };
}

// High-risk returns require manual review
export function isHighRiskReturn(r: ReturnRequest): boolean {
  return r.reason === 'counterfeit_concern' || r.reason === 'not_as_described';
}

