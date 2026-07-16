// Settlement contracts.
import type { Identifier, TenantId, ISO8601, Money, EvidenceRecord } from './common.js';

export type SettlementState =
  | 'PENDING'
  | 'CALCULATED'
  | 'HELD'
  | 'ELIGIBLE'
  | 'PAYOUT_REQUESTED'
  | 'PAID'
  | 'ADJUSTED'
  | 'REVERSED'
  | 'DISPUTED'
  | 'FAILED';

export interface SettlementRecord {
  readonly settlementId: Identifier;
  readonly tenantId: TenantId;
  readonly orderId: Identifier;
  readonly grossSale: Money;
  readonly marketplaceCommission: Money;
  readonly paymentProcessingFee: Money;
  readonly taxRef?: Identifier;
  readonly shippingCharge: Money;
  readonly refundReserve: Money;
  readonly disputeReserve: Money;
  readonly sellerProceeds: Money;
  readonly payoutRef?: Identifier;
  readonly affiliateAttributionRef?: Identifier;
  readonly adjustment?: Money;
  readonly settlementPeriod: { readonly start: ISO8601; readonly end: ISO8601 };
  readonly state: SettlementState;
  readonly evidence: readonly EvidenceRecord[];
  readonly createdAt: ISO8601;
  readonly updatedAt: ISO8601;
}
