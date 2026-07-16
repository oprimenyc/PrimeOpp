
// @primeopp-marketplace/offer-engine
import type {
  Offer, OfferState, Identifier, TenantId, ISO8601, Money, EvidenceStore, EvidenceRecord
} from '@primeopp-marketplace/contracts';

let counter = 0;
function newId(prefix: string): Identifier {
  counter += 1;
  return `${prefix}_${Date.now().toString(36)}_${counter.toString(36)}`;
}

const VALID_OFFER_TRANSITIONS: Record<OfferState, readonly OfferState[]> = {
  CREATED: ['SENT', 'CANCELLED', 'WITHDRAWN'],
  SENT: ['RECEIVED', 'CANCELLED'],
  RECEIVED: ['VIEWED', 'COUNTERED', 'ACCEPTED', 'DECLINED', 'EXPIRED'],
  VIEWED: ['COUNTERED', 'ACCEPTED', 'DECLINED', 'EXPIRED'],
  COUNTERED: ['ACCEPTED', 'DECLINED', 'WITHDRAWN', 'EXPIRED'],
  ACCEPTED: ['CONVERTED_TO_ORDER', 'CANCELLED'],
  DECLINED: [],
  WITHDRAWN: [],
  EXPIRED: [],
  CANCELLED: [],
  CONVERTED_TO_ORDER: []
};

export function createOffer(params: {
  readonly tenantId: TenantId;
  readonly listingId: Identifier;
  readonly buyerId: Identifier;
  readonly sellerId: Identifier;
  readonly channelId: string;
  readonly offerAmount: Money;
  readonly quantity: number;
  readonly minimumOfferFloor?: Money;
  readonly expirationHours?: number;
  readonly evidence?: EvidenceStore;
}): { ok: true; offer: Offer } | { ok: false; code: string; message: string } {
  // Floor enforcement
  if (params.minimumOfferFloor && parseFloat(params.offerAmount.amount) < parseFloat(params.minimumOfferFloor.amount)) {
    return { ok: false, code: 'OFFER_BELOW_FLOOR', message: `offer ${params.offerAmount.amount} below floor ${params.minimumOfferFloor.amount}` };
  }
  const now = new Date();
  const expires = new Date(now.getTime() + (params.expirationHours ?? 72) * 60 * 60 * 1000);
  const offer: Offer = {
    offerId: newId('offer'),
    tenantId: params.tenantId,
    listingId: params.listingId,
    buyerId: params.buyerId,
    sellerId: params.sellerId,
    channelId: params.channelId,
    offerAmount: params.offerAmount,
    quantity: params.quantity,
    state: 'CREATED',
    rounds: 0,
    expiresAt: expires.toISOString(),
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
    evidence: []
  };
  if (params.evidence) {
    const ev = params.evidence.record({
      tenantId: params.tenantId,
      kind: 'offer_created',
      description: `offer created for ${params.offerAmount.amount} ${params.offerAmount.currency}`,
      actor: { actorType: 'buyer', actorId: params.buyerId, tenantId: params.tenantId },
      subject: { type: 'offer', id: offer.offerId },
      payload: { amount: params.offerAmount.amount, currency: params.offerAmount.currency, quantity: params.quantity }
    });
    return { ok: true, offer: { ...offer, evidence: [{ evidenceId: ev.evidenceId, hash: ev.hash, timestamp: ev.timestamp, kind: 'offer_created', description: '', actor: { actorType: 'buyer', actorId: params.buyerId, tenantId: params.tenantId }, subject: { type: 'offer', id: offer.offerId }, payload: {} } as unknown as EvidenceRecord] } };
  }
  return { ok: true, offer };
}

export function transitionOffer(offer: Offer, target: OfferState, reason?: string): { ok: true; offer: Offer } | { ok: false; code: string; message: string } {
  const allowed = VALID_OFFER_TRANSITIONS[offer.state] ?? [];
  if (!allowed.includes(target)) {
    return { ok: false, code: 'INVALID_OFFER_TRANSITION', message: `cannot transition offer from ${offer.state} to ${target}` };
  }
  const now = new Date().toISOString();
  return { ok: true, offer: { ...offer, state: target, updatedAt: now, rounds: target === 'COUNTERED' ? offer.rounds + 1 : offer.rounds } };
}

export function isExpired(offer: Offer): boolean {
  return new Date(offer.expiresAt) < new Date();
}

export function canAccept(offer: Offer): boolean {
  return ['RECEIVED', 'VIEWED', 'COUNTERED'].includes(offer.state) && !isExpired(offer);
}

