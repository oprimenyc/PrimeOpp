
// @primeopp-marketplace/negotiation-engine
import type { NegotiationPolicy, NegotiationDecision, Offer, Money, Identifier, TenantId, EvidenceStore } from '@primeopp-marketplace/contracts';

let counter = 0;
function newId(prefix: string): Identifier {
  counter += 1;
  return `${prefix}_${Date.now().toString(36)}_${counter.toString(36)}`;
}

// Deterministic auto-accept / auto-decline based on policy thresholds.
export function evaluateOffer(params: {
  readonly offer: Offer;
  readonly policy: NegotiationPolicy;
  readonly listingPrice: Money;
  readonly evidence?: EvidenceStore;
  readonly tenantId: TenantId;
}): NegotiationDecision {
  const { offer, policy, listingPrice } = params;
  const offerAmt = parseFloat(offer.offerAmount.amount);
  const listAmt = parseFloat(listingPrice.amount);

  let action: NegotiationDecision['action'] = 'manual_review';
  let reason = 'no auto thresholds configured';

  if (policy.autoAcceptThreshold) {
    const threshold = parseFloat(policy.autoAcceptThreshold.amount);
    if (offerAmt >= threshold) {
      action = 'accept';
      reason = `offer meets auto-accept threshold ${policy.autoAcceptThreshold.amount}`;
    }
  }
  if (action !== 'accept' && policy.autoDeclineFloor) {
    const floor = parseFloat(policy.autoDeclineFloor.amount);
    if (offerAmt < floor) {
      action = 'decline';
      reason = `offer below auto-decline floor ${policy.autoDeclineFloor.amount}`;
    }
  }
  if (action === 'manual_review' && policy.minimumPrice) {
    const min = parseFloat(policy.minimumPrice.amount);
    if (offerAmt < min) {
      action = 'decline';
      reason = `offer below minimum ${policy.minimumPrice.amount}`;
    }
  }
  if (action === 'manual_review' && policy.targetPrice) {
    const target = parseFloat(policy.targetPrice.amount);
    if (offerAmt >= target * 0.95) {
      action = 'accept';
      reason = `offer near target ${policy.targetPrice.amount}`;
    }
  }
  if (offer.rounds >= policy.maxRounds && action === 'manual_review') {
    action = 'decline';
    reason = `max rounds (${policy.maxRounds}) reached`;
  }

  const expectedProfit = { amount: String(offerAmt * 0.9), currency: listingPrice.currency };
  const commission = { amount: String(offerAmt * 0.1), currency: listingPrice.currency };
  void listAmt;

  const decision: NegotiationDecision = {
    decisionId: newId('dec'),
    offerId: offer.offerId,
    action,
    reason,
    expectedProfit,
    commission,
    sellerRule: action === 'accept' ? 'auto_accept_threshold' : action === 'decline' ? 'auto_decline_floor' : undefined,
    confidence: action === 'manual_review' ? 0.5 : 0.9,
    authority: action === 'manual_review' ? 'manual' : 'auto',
    at: new Date().toISOString(),
    evidence: {
      evidenceId: newId('ev'),
      hash: 'auto',
      timestamp: new Date().toISOString(),
      tenantId: params.tenantId,
      kind: 'offer',
      description: reason,
      actor: { actorType: 'system', actorId: 'negotiation-engine', tenantId: params.tenantId },
      subject: { type: 'offer', id: offer.offerId },
      payload: { action, offerAmount: offer.offerAmount.amount, listingPrice: listingPrice.amount }
    } as any
  };
  if (params.evidence) {
    params.evidence.record({
      tenantId: params.tenantId, kind: 'negotiation_decision', description: reason,
      actor: { actorType: 'system', actorId: 'negotiation-engine', tenantId: params.tenantId },
      subject: { type: 'offer', id: offer.offerId },
      payload: { action, offerAmount: offer.offerAmount.amount, listingPrice: listingPrice.amount }
    });
  }
  return decision;
}

