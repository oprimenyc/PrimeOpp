
// @primeopp-marketplace/settlement-contracts
import type { SettlementRecord, Money, Identifier, TenantId, ISO8601, EvidenceStore, CommissionCalculation } from '@primeopp-marketplace/contracts';

let counter = 0;
function newId(prefix: string): Identifier {
  counter += 1;
  return `${prefix}_${Date.now().toString(36)}_${counter.toString(36)}`;
}

function money(amt: number, currency: string): Money {
  return { amount: amt.toFixed(2), currency };
}

export function createSettlement(params: {
  readonly orderId: Identifier;
  readonly tenantId: TenantId;
  readonly grossSale: Money;
  readonly commission: CommissionCalculation;
  readonly paymentProcessingFee?: Money;
  readonly shippingCharge?: Money;
  readonly refundReserve?: Money;
  readonly disputeReserve?: Money;
  readonly affiliateAttributionRef?: Identifier;
  readonly settlementPeriod?: { start: ISO8601; end: ISO8601 };
  readonly evidence?: EvidenceStore;
}): SettlementRecord {
  const gross = parseFloat(params.grossSale.amount);
  const comm = parseFloat(params.commission.finalCommission.amount);
  const proc = params.paymentProcessingFee ? parseFloat(params.paymentProcessingFee.amount) : 0;
  const ship = params.shippingCharge ? parseFloat(params.shippingCharge.amount) : 0;
  const refund = params.refundReserve ? parseFloat(params.refundReserve.amount) : 0;
  const dispute = params.disputeReserve ? parseFloat(params.disputeReserve.amount) : 0;
  const proceeds = Math.max(0, gross - comm - proc - refund - dispute);

  const now = new Date();
  const period = params.settlementPeriod ?? { start: now.toISOString(), end: now.toISOString() };

  const settlement: SettlementRecord = {
    settlementId: newId('set'),
    tenantId: params.tenantId,
    orderId: params.orderId,
    grossSale: params.grossSale,
    marketplaceCommission: params.commission.finalCommission,
    paymentProcessingFee: params.paymentProcessingFee ?? money(0, params.grossSale.currency),
    shippingCharge: params.shippingCharge ?? money(0, params.grossSale.currency),
    refundReserve: params.refundReserve ?? money(0, params.grossSale.currency),
    disputeReserve: params.disputeReserve ?? money(0, params.grossSale.currency),
    sellerProceeds: money(proceeds, params.grossSale.currency),
    affiliateAttributionRef: params.affiliateAttributionRef,
    settlementPeriod: period,
    state: 'CALCULATED',
    evidence: [],
    createdAt: now.toISOString(),
    updatedAt: now.toISOString()
  };

  if (params.evidence) {
    params.evidence.record({
      tenantId: params.tenantId, kind: 'settlement_calculated', description: `seller proceeds ${proceeds.toFixed(2)}`,
      actor: { actorType: 'system', actorId: 'settlement-contracts', tenantId: params.tenantId },
      subject: { type: 'order', id: params.orderId },
      payload: { gross, commission: comm, processing: proc, shipping: ship, refund, dispute, proceeds }
    });
  }
  return settlement;
}

export function transitionSettlement(s: SettlementRecord, target: SettlementRecord['state'], reason?: string): SettlementRecord {
  return { ...s, state: target, updatedAt: new Date().toISOString() };
}

