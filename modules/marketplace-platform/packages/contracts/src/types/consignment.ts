// Consignment contracts.
import type { Identifier, TenantId, ISO8601, Money, EvidenceRecord } from './common.js';

export interface ConsignmentItem {
  readonly consignmentItemId: Identifier;
  readonly agreementId: Identifier;
  readonly inventoryId: Identifier;
  readonly consignorOrgId: Identifier;
  readonly consigneeOrgId: Identifier;
  readonly ownership: 'consignor' | 'consignee_possession';
  readonly commissionSplitPercent: number;
  readonly minimumSalePrice?: Money;
  readonly approvalPolicy: 'auto' | 'manual';
  readonly returnDate?: ISO8601;
  readonly unsoldHandling: 'return_to_consignor' | 'donate' | 'dispose';
  readonly evidence: readonly EvidenceRecord[];
  readonly createdAt: ISO8601;
}

export interface ConsignmentSettlement {
  readonly consignmentSettlementId: Identifier;
  readonly consignmentItemId: Identifier;
  readonly orderId: Identifier;
  readonly grossSale: Money;
  readonly consignorProceeds: Money;
  readonly consigneeCommission: Money;
  readonly platformFee: Money;
  readonly evidence: readonly EvidenceRecord[];
  readonly settledAt: ISO8601;
}
