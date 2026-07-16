// Dispute contracts.
import type { Identifier, TenantId, ISO8601, Money, EvidenceRecord } from './common.js';

export type DisputeKind =
  | 'item_not_received'
  | 'item_not_as_described'
  | 'counterfeit_allegation'
  | 'payment_dispute'
  | 'return_dispute'
  | 'shipping_damage'
  | 'local_pickup_dispute'
  | 'seller_conduct'
  | 'buyer_conduct'
  | 'fee_dispute';

export type DisputeState =
  | 'opened'
  | 'evidence_collection'
  | 'provisional_hold'
  | 'human_review'
  | 'resolved'
  | 'appealed'
  | 'final';

export interface DisputeRecord {
  readonly disputeId: Identifier;
  readonly tenantId: TenantId;
  readonly orderId?: Identifier;
  readonly returnId?: Identifier;
  readonly kind: DisputeKind;
  readonly openedBy: Identifier;
  readonly openedAgainst: Identifier;
  readonly state: DisputeState;
  readonly provisionalHoldAmount?: Money;
  readonly timeline: ReadonlyArray<{ readonly state: DisputeState; readonly at: ISO8601; readonly note?: string }>;
  readonly communications: readonly Identifier[];
  readonly reviewer?: Identifier;
  readonly resolution?: string;
  readonly resolutionAt?: ISO8601;
  readonly appealable: boolean;
  readonly evidence: readonly EvidenceRecord[];
  readonly createdAt: ISO8601;
  readonly updatedAt: ISO8601;
}
