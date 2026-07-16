
// @primeopp-marketplace/disputes
import type { DisputeRecord, DisputeState, DisputeKind, Identifier, TenantId, Money, EvidenceStore } from '@primeopp-marketplace/contracts';

let counter = 0;
function newId(prefix: string): Identifier {
  counter += 1;
  return `${prefix}_${Date.now().toString(36)}_${counter.toString(36)}`;
}

const VALID_DISPUTE_TRANSITIONS: Record<DisputeState, readonly DisputeState[]> = {
  opened: ['evidence_collection'],
  evidence_collection: ['provisional_hold', 'human_review'],
  provisional_hold: ['human_review', 'resolved'],
  human_review: ['resolved', 'appealed'],
  resolved: ['appealed', 'final'],
  appealed: ['resolved', 'final'],
  final: []
};

export function createDispute(params: {
  readonly tenantId: TenantId;
  readonly kind: DisputeKind;
  readonly openedBy: Identifier;
  readonly openedAgainst: Identifier;
  readonly orderId?: Identifier;
  readonly returnId?: Identifier;
  readonly provisionalHoldAmount?: Money;
  readonly evidence?: EvidenceStore;
}): DisputeRecord {
  const now = new Date().toISOString();
  const d: DisputeRecord = {
    disputeId: newId('disp'),
    tenantId: params.tenantId,
    orderId: params.orderId,
    returnId: params.returnId,
    kind: params.kind,
    openedBy: params.openedBy,
    openedAgainst: params.openedAgainst,
    state: 'opened',
    provisionalHoldAmount: params.provisionalHoldAmount,
    timeline: [{ state: 'opened', at: now, note: 'dispute opened' }],
    communications: [],
    appealable: true,
    evidence: [],
    createdAt: now,
    updatedAt: now
  };
  if (params.evidence) {
    params.evidence.record({
      tenantId: params.tenantId, kind: 'dispute_created', description: `dispute ${params.kind} opened`,
      actor: { actorType: 'human', actorId: params.openedBy, tenantId: params.tenantId },
      subject: { type: 'dispute', id: d.disputeId },
      payload: { kind: params.kind, orderId: params.orderId }
    });
  }
  return d;
}

export function transitionDispute(d: DisputeRecord, target: DisputeState, note?: string, reviewer?: Identifier): { ok: true; dispute: DisputeRecord } | { ok: false; code: string; message: string } {
  const allowed = VALID_DISPUTE_TRANSITIONS[d.state] ?? [];
  if (!allowed.includes(target)) {
    return { ok: false, code: 'INVALID_DISPUTE_TRANSITION', message: `cannot transition dispute from ${d.state} to ${target}` };
  }
  const now = new Date().toISOString();
  return {
    ok: true,
    dispute: {
      ...d,
      state: target,
      timeline: [...d.timeline, { state: target, at: now, note }],
      reviewer: reviewer ?? d.reviewer,
      updatedAt: now
    }
  };
}

export function isHighImpactDispute(d: DisputeRecord): boolean {
  return ['counterfeit_allegation', 'payment_dispute', 'seller_conduct'].includes(d.kind);
}

