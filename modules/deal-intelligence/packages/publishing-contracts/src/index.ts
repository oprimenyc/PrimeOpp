/**
 * @primeopp-deal-intelligence/publishing-contracts
 *
 * Channel-neutral publication contracts. Does NOT publish externally.
 */
import type {
  DealId, RetailerId, ProductId, Money, Evidence, ISO8601, DealScoreSet,
  AffiliateLink, RegionCode
} from '@primeopp-deal-intelligence/contracts';
import { nextId, nowIso } from '@primeopp-deal-intelligence/contracts';

export type PublicationTarget =
  | 'primeopp-website' | 'public-deal-feed' | 'premium-deal-feed' | 'category-page'
  | 'retailer-page' | 'regional-page' | 'product-page' | 'seo-landing-page'
  | 'newsletter' | 'discord' | 'social-post' | 'rss' | 'webhook' | 'amos-content-job';

export interface Publication {
  id: string;
  target: PublicationTarget;
  tenantId: string;
  dealId?: DealId;
  headline: string;
  product: { productId: ProductId; canonicalTitle: string };
  retailer: { retailerId: RetailerId; name: string };
  effectivePrice?: Money;
  requirements: string[];
  savings?: Money;
  historicalContext?: string;
  availability: string;
  expiration?: ISO8601;
  region?: RegionCode[];
  dealScore?: DealScoreSet;
  affiliateDisclosure: string;
  destinationLink?: AffiliateLink;
  evidenceFreshness: ISO8601;
  verificationLabel: 'verified' | 'verified-with-conditions' | 'community-reported' | 'needs-review';
  correctionPolicy: string;
  structuredSeoMetadata: Record<string, string>;
  createdAt: ISO8601;
}

export interface PublishingAdapter {
  target: PublicationTarget;
  testOnly: true;
  publish(pub: Publication): Promise<{ success: boolean; at: ISO8601; detail?: string }>;
}

export class InMemoryPublishingCaptureAdapter implements PublishingAdapter {
  readonly testOnly = true;
  captured: Publication[] = [];
  constructor(public readonly target: PublicationTarget) {}
  async publish(pub: Publication): Promise<{ success: boolean; at: ISO8601 }> {
    this.captured.push(pub);
    return { success: true, at: nowIso() };
  }
}

export function buildPublication(input: Omit<Publication, 'id' | 'createdAt'>): Publication {
  if (!input.headline) throw new Error('buildPublication: headline required');
  if (!input.affiliateDisclosure) throw new Error('buildPublication: affiliateDisclosure required (never conceal)');
  return { ...input, id: nextId('pub'), createdAt: nowIso() };
}

export function seoMetadataFor(p: Pick<Publication, 'headline' | 'product' | 'retailer' | 'effectivePrice'>): Record<string, string> {
  return {
    'og:title': p.headline,
    'og:type': 'article',
    'product:retailer': p.retailer.name,
    'product:title': p.product.canonicalTitle,
    ...(p.effectivePrice ? { 'product:price:amount': (p.effectivePrice.amountMinor / 100).toFixed(2) } : {}),
    ...(p.effectivePrice ? { 'product:price:currency': p.effectivePrice.currency } : {})
  };
}

export function correctionPolicyText(): string {
  return 'PrimeOpp will issue a correction or expiration notice if the deal becomes stale, dead, or differs from this publication. Last-updated timestamp is authoritative.';
}
