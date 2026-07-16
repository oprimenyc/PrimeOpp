
// @primeopp-marketplace/commission-engine
import type { CommissionPolicy, CommissionCalculation, Money, Identifier, TenantId, EvidenceStore } from '@primeopp-marketplace/contracts';

let counter = 0;
function newId(prefix: string): Identifier {
  counter += 1;
  return `${prefix}_${Date.now().toString(36)}_${counter.toString(36)}`;
}

function money(amt: number, currency: string): Money {
  return { amount: amt.toFixed(2), currency };
}

export function calculateCommission(params: {
  readonly policy: CommissionPolicy;
  readonly grossAmount: Money;
  readonly excludedAmounts?: readonly Money[];
  readonly feeBasis?: CommissionCalculation['feeBasis'];
  readonly orderId: Identifier;
  readonly tenantId: TenantId;
  readonly category?: string;
  readonly affiliateAttributionAdjustment?: number;
  readonly evidence?: EvidenceStore;
}): CommissionCalculation {
  const { policy, grossAmount, excludedAmounts = [], feeBasis = 'gross', orderId, tenantId } = params;
  const gross = parseFloat(grossAmount.amount);
  const excluded = excludedAmounts.reduce((s, m) => s + parseFloat(m.amount), 0);
  const basis = feeBasis === 'gross' ? gross : feeBasis === 'net_of_shipping' ? gross - excluded : gross - excluded;

  // Determine rate / fixed fee
  let rate = policy.feeRatePercent ?? 0;
  let fixed = policy.fixedFee ? parseFloat(policy.fixedFee.amount) : 0;

  // Category override
  if (params.category && policy.categoryOverrides) {
    const o = policy.categoryOverrides[params.category];
    if (o) {
      if (o.feeRatePercent !== undefined) rate = o.feeRatePercent;
      if (o.fixedFee) fixed = parseFloat(o.fixedFee.amount);
    }
  }

  const baseFee = (basis * rate / 100) + fixed;
  let discount = 0;
  if (policy.discountPercent) discount = baseFee * policy.discountPercent / 100;
  if (params.affiliateAttributionAdjustment) discount += baseFee * params.affiliateAttributionAdjustment / 100;

  const final = Math.max(0, baseFee - discount);
  const finalCommission = money(final, grossAmount.currency);

  const calc: CommissionCalculation = {
    commissionId: newId('comm'),
    tenantId,
    orderId,
    policyId: policy.policyId,
    policyVersion: policy.version,
    effectiveDate: policy.effectiveFrom,
    grossAmount,
    excludedAmounts,
    feeBasis,
    feeRatePercent: rate,
    fixedFee: money(fixed, grossAmount.currency),
    discount: money(discount, grossAmount.currency),
    promotion: policy.promotionName,
    finalCommission,
    currency: grossAmount.currency,
    evidence: [],
    calculatedAt: new Date().toISOString()
  };

  if (params.evidence) {
    params.evidence.record({
      tenantId, kind: 'commission_calculated', description: `commission ${finalCommission.amount} ${finalCommission.currency} via policy ${policy.version}`,
      actor: { actorType: 'system', actorId: 'commission-engine', tenantId },
      subject: { type: 'order', id: orderId },
      payload: { commissionId: calc.commissionId, gross, excluded, rate, fixed, discount, final }
    });
  }
  return calc;
}

// Standard policies
export const LAUNCH_PROMO_ZERO_FEE_POLICY: CommissionPolicy = {
  policyId: 'policy_launch_promo_zero',
  tenantId: 'tenant_demo',
  kind: 'zero_fee_period',
  version: '2026.01.launch',
  effectiveFrom: '2026-01-01T00:00:00.000Z',
  effectiveUntil: '2026-12-31T23:59:59.000Z',
  feeRatePercent: 0,
  fixedFee: money(0, 'USD'),
  promotionName: 'PrimeOpp Grand Opening — Zero Marketplace Fee',
  active: true,
  description: 'Launch promotion: 0% marketplace commission during grand opening period'
};

export const STANDARD_FEE_POLICY: CommissionPolicy = {
  policyId: 'policy_standard_10',
  tenantId: 'tenant_demo',
  kind: 'percentage',
  version: '2026.01.standard',
  effectiveFrom: '2026-01-01T00:00:00.000Z',
  feeRatePercent: 10,
  fixedFee: money(0, 'USD'),
  active: true,
  description: 'Standard 10% marketplace commission'
};

export const GRAND_OPENING_DISCOUNTED_POLICY: CommissionPolicy = {
  policyId: 'policy_grand_opening_discounted',
  tenantId: 'tenant_demo',
  kind: 'grand_opening',
  version: '2026.01.grand',
  effectiveFrom: '2026-01-01T00:00:00.000Z',
  effectiveUntil: '2026-06-30T23:59:59.000Z',
  feeRatePercent: 10,
  fixedFee: money(0, 'USD'),
  discountPercent: 50,
  promotionName: 'Grand Opening 50% Discount',
  active: true,
  description: 'Grand opening: 50% off standard commission rate'
};

export const ENTERPRISE_CONTRACT_POLICY: CommissionPolicy = {
  policyId: 'policy_enterprise_contract',
  tenantId: 'tenant_enterprise',
  kind: 'enterprise_contract',
  version: '2026.01.enterprise',
  effectiveFrom: '2026-01-01T00:00:00.000Z',
  feeRatePercent: 5,
  fixedFee: money(0, 'USD'),
  active: true,
  description: 'Enterprise contract rate: 5% commission'
};

export const POLICY_CATALOG: readonly CommissionPolicy[] = [
  LAUNCH_PROMO_ZERO_FEE_POLICY,
  STANDARD_FEE_POLICY,
  GRAND_OPENING_DISCOUNTED_POLICY,
  ENTERPRISE_CONTRACT_POLICY
];

export function findPolicy(tenantId: TenantId, kind: CommissionPolicy['kind']): CommissionPolicy | undefined {
  return POLICY_CATALOG.find(p => p.tenantId === tenantId && p.kind === kind && p.active);
}

