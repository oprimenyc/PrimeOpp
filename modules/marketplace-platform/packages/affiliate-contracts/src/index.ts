
// @primeopp-marketplace/affiliate-contracts
import type { AffiliateOffer, Identifier, TenantId, Money, EvidenceStore } from '@primeopp-marketplace/contracts';

let counter = 0;
function newId(prefix: string): Identifier {
  counter += 1;
  return `${prefix}_${Date.now().toString(36)}_${counter.toString(36)}`;
}

export function createAffiliateOffer(params: {
  readonly tenantId: TenantId;
  readonly externalRetailer: string;
  readonly externalProductId: string;
  readonly externalUrl: string;
  readonly title: string;
  readonly description?: string;
  readonly imageUrl?: string;
  readonly price: Money;
  readonly commissionRate?: number;
  readonly attributionRef?: Identifier;
  readonly evidence?: EvidenceStore;
}): AffiliateOffer {
  const o: AffiliateOffer = {
    affiliateOfferId: newId('aff'),
    tenantId: params.tenantId,
    kind: 'external_affiliate_offer',
    externalRetailer: params.externalRetailer,
    externalProductId: params.externalProductId,
    externalUrl: params.externalUrl,
    title: params.title,
    description: params.description,
    imageUrl: params.imageUrl,
    price: params.price,
    commissionRate: params.commissionRate,
    attributionRef: params.attributionRef,
    disclosureRequired: true,
    disclosureText: `Affiliate link — PrimeOpp may earn a commission on purchases from ${params.externalRetailer}.`,
    evidence: [],
    createdAt: new Date().toISOString()
  };
  if (params.evidence) {
    params.evidence.record({
      tenantId: params.tenantId, kind: 'affiliate_offer_created', description: `affiliate offer ${params.title}`,
      actor: { actorType: 'system', actorId: 'affiliate-contracts', tenantId: params.tenantId },
      subject: { type: 'affiliate_offer', id: o.affiliateOfferId },
      payload: { retailer: params.externalRetailer, productId: params.externalProductId }
    });
  }
  return o;
}

// Affiliate offers MUST NOT enter inventory or order workflows
export function assertNotInventory(o: AffiliateOffer): void {
  if (o.kind === 'marketplace_listing') {
    throw new Error('affiliate offer incorrectly classified as marketplace listing');
  }
}

