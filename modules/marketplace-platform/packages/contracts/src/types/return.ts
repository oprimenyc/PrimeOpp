// Return contracts.
import type { Identifier, TenantId, ISO8601, Money, EvidenceRecord } from './common.js';

export type ReturnState =
  | 'REQUESTED'
  | 'ELIGIBILITY_REVIEW'
  | 'APPROVED'
  | 'DENIED'
  | 'LABEL_PENDING'
  | 'IN_TRANSIT'
  | 'RECEIVED'
  | 'INSPECTED'
  | 'REFUND_PENDING'
  | 'REFUNDED'
  | 'PARTIALLY_REFUNDED'
  | 'CLOSED'
  | 'ESCALATED';

export type ReturnReason =
  | 'not_as_described'
  | 'damaged'
  | 'wrong_item'
  | 'counterfeit_concern'
  | 'missing_parts'
  | 'changed_mind'
  | 'fit_issue'
  | 'late_delivery'
  | 'unauthorized_return'
  | 'other';

export interface ReturnRequest {
  readonly returnId: Identifier;
  readonly tenantId: TenantId;
  readonly orderId: Identifier;
  readonly buyerId: Identifier;
  readonly sellerId: Identifier;
  readonly reason: ReturnReason;
  readonly description: string;
  readonly photos?: readonly string[];
  readonly messageRefs?: readonly Identifier[];
  readonly shippingEvidence?: readonly string[];
  readonly listingStateAtRequest?: string;
  readonly conditionEvidence?: readonly string[];
  readonly policyVersion: string;
  readonly state: ReturnState;
  readonly refundAmount?: Money;
  readonly timeline: ReadonlyArray<{ readonly state: ReturnState; readonly at: ISO8601; readonly reason?: string }>;
  readonly evidence: readonly EvidenceRecord[];
  readonly createdAt: ISO8601;
  readonly updatedAt: ISO8601;
}
