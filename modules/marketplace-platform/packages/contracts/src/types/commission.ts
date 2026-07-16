// Commission contracts.
import type { Identifier, TenantId, ISO8601, Money, EvidenceRecord } from './common.js';

export type CommissionPolicyKind =
  | 'percentage'
  | 'fixed'
  | 'category_fee'
  | 'seller_tier'
  | 'launch_promotion'
  | 'zero_fee_period'
  | 'grand_opening'
  | 'first_n_sales'
  | 'volume_tier'
  | 'verified_seller_discount'
  | 'enterprise_contract'
  | 'affiliate_adjustment'
  | 'shipping_margin'
  | 'custom_tenant';

export interface CommissionPolicy {
  readonly policyId: Identifier;
  readonly tenantId: TenantId;
  readonly kind: CommissionPolicyKind;
  readonly version: string;
  readonly effectiveFrom: ISO8601;
  readonly effectiveUntil?: ISO8601;
  readonly feeRatePercent?: number;
  readonly fixedFee?: Money;
  readonly discountPercent?: number;
  readonly promotionName?: string;
  readonly firstNSales?: number;
  readonly categoryOverrides?: Readonly<Record<string, { readonly feeRatePercent?: number; readonly fixedFee?: Money }>>;
  readonly description: string;
  readonly active: boolean;
}

export interface CommissionCalculation {
  readonly commissionId: Identifier;
  readonly tenantId: TenantId;
  readonly orderId: Identifier;
  readonly policyId: Identifier;
  readonly policyVersion: string;
  readonly effectiveDate: ISO8601;
  readonly grossAmount: Money;
  readonly excludedAmounts: readonly Money[];
  readonly feeBasis: 'gross' | 'net_of_shipping' | 'net_of_tax';
  readonly feeRatePercent: number;
  readonly fixedFee: Money;
  readonly discount: Money;
  readonly promotion?: string;
  readonly finalCommission: Money;
  readonly currency: string;
  readonly evidence: readonly EvidenceRecord[];
  readonly calculatedAt: ISO8601;
}
