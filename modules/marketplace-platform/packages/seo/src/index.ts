// @primeopp-marketplace/seo
// Deterministic SEO candidate generator (no AI calls — local template adapter).
// Honors "no keyword stuffing / no false claims / no fabricated specs" rules.

import type { CanonicalListing, ListingSEO } from '@primeopp-marketplace/contracts';

export interface SeoCandidate {
  readonly title: string;
  readonly subtitle?: string;
  readonly description: string;
  readonly bullets: readonly string[];
  readonly keywords: readonly string[];
  readonly searchTags: readonly string[];
  readonly productFacts: readonly string[];
  readonly conditionSummary: string;
  readonly shippingSummary: string;
  readonly authenticityNotes: string;
  readonly localPickupSummary?: string;
  readonly primeOppMarketplaceMetadata?: Readonly<Record<string, unknown>>;
  readonly structuredData?: Readonly<Record<string, unknown>>;
}

export interface SeoViolation {
  readonly rule: string;
  readonly detail: string;
  readonly severity: 'error' | 'warning';
}

const PROHIBITED_KEYWORDS = [
  'authentic guaranteed', '100% authentic', 'rare rare', 'limited edition guaranteed',
  'celebrity owned', 'as worn by', 'perfect condition', 'flawless'
];

const TRADEMARK_BLACKLIST = [
  'nike air jordan official', 'rolex authorized dealer'
];

export function generateSeoCandidate(listing: CanonicalListing): SeoCandidate {
  const title = sanitizeText(listing.title).slice(0, 80);
  const subtitle = listing.subtitle ? sanitizeText(listing.subtitle).slice(0, 120) : undefined;
  const description = sanitizeText(listing.description).slice(0, 5000);
  const bullets = listing.bulletPoints.map((b: string) => sanitizeText(b).slice(0, 200)).slice(0, 10);

  const keywords = deriveKeywords(listing).slice(0, 15);
  const searchTags = deriveTags(listing).slice(0, 20);
  const productFacts = deriveFacts(listing);
  const conditionSummary = `Condition: ${listing.condition}${listing.conditionNotes ? ` — ${listing.conditionNotes}` : ''}`;
  const shippingSummary = listing.shippingPolicy.freeShipping
    ? `Free shipping, ${listing.shippingPolicy.handlingTimeDays}-day handling`
    : `Shipping available, ${listing.shippingPolicy.handlingTimeDays}-day handling`;
  const authenticityNotes = listing.authenticity.verifiedAuthentic
    ? `Authenticity verified via ${listing.authenticity.verificationMethod ?? 'platform review'}`
    : 'Seller attests to authenticity; platform verification not performed';
  const localPickupSummary = listing.shippingPolicy.localPickup
    ? 'Local pickup available at designated safe location'
    : undefined;
  const primeOppMarketplaceMetadata = {
    marketplace: 'primeopp-marketplace',
    listingId: listing.listingId,
    condition: listing.condition,
    price: listing.price
  };
  const structuredData = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: title,
    description,
    offers: {
      '@type': 'Offer',
      price: listing.price.amount,
      priceCurrency: listing.price.currency,
      availability: listing.quantity > 0 ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock',
      itemCondition: `https://schema.org/${listing.condition === 'new' ? 'NewCondition' : 'UsedCondition'}`
    }
  };

  return {
    title, subtitle, description, bullets, keywords, searchTags,
    productFacts, conditionSummary, shippingSummary, authenticityNotes,
    localPickupSummary, primeOppMarketplaceMetadata, structuredData
  };
}

export function lintSeo(listing: CanonicalListing, candidate: SeoCandidate): readonly SeoViolation[] {
  const violations: SeoViolation[] = [];
  const text = `${candidate.title} ${candidate.description} ${candidate.bullets.join(' ')} ${candidate.keywords.join(' ')} ${candidate.searchTags.join(' ')}`.toLowerCase();
  for (const kw of PROHIBITED_KEYWORDS) {
    if (text.includes(kw)) violations.push({ rule: 'no_prohibited_keyword', detail: `prohibited phrase: ${kw}`, severity: 'error' });
  }
  for (const tm of TRADEMARK_BLACKLIST) {
    if (text.includes(tm)) violations.push({ rule: 'no_trademark_misuse', detail: `trademark misuse: ${tm}`, severity: 'error' });
  }
  // Keyword stuffing detection: any single keyword repeated > 5 times in title.
  const titleLower = candidate.title.toLowerCase();
  for (const kw of candidate.keywords) {
    const k = kw.toLowerCase();
    const occurrences = titleLower.split(k).length - 1;
    if (occurrences > 2) violations.push({ rule: 'no_keyword_stuffing', detail: `keyword "${kw}" appears ${occurrences}x in title`, severity: 'warning' });
  }
  // False claim detection: candidate mentions "new" but listing condition is used.
  if (candidate.title.toLowerCase().includes('brand new') && !listing.condition.startsWith('new')) {
    violations.push({ rule: 'no_false_condition_claim', detail: 'title claims "brand new" but condition is not new', severity: 'error' });
  }
  // Fabricated rarity
  if (text.includes('1 of 1') && !listing.sellerDisclosures.some(d => d.kind === 'provenance')) {
    violations.push({ rule: 'no_fabricated_rarity', detail: 'claims "1 of 1" without provenance disclosure', severity: 'error' });
  }
  return violations;
}

function sanitizeText(s: string): string {
  // Strip HTML, control chars, and excess whitespace.
  return s
    .replace(/<[^>]*>/g, '')
    .replace(/[\u0000-\u001F\u007F]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function deriveKeywords(listing: CanonicalListing): string[] {
  const set = new Set<string>();
  set.add(listing.condition);
  if (listing.category) set.add(listing.category);
  for (const attr of listing.attributes) set.add(`${attr.name} ${attr.value}`.trim());
  for (const id of listing.identifiers) set.add(id.value);
  for (const tag of listing.seo.searchTags) set.add(tag);
  return Array.from(set).filter(s => s.length > 0 && s.length < 80);
}

function deriveTags(listing: CanonicalListing): string[] {
  const tags = new Set<string>(listing.seo.searchTags);
  if (listing.shippingPolicy.localPickup) tags.add('local-pickup');
  if (listing.shippingPolicy.freeShipping) tags.add('free-shipping');
  if (listing.authenticity.verifiedAuthentic) tags.add('verified-authentic');
  tags.add(listing.condition);
  return Array.from(tags);
}

function deriveFacts(listing: CanonicalListing): string[] {
  const facts: string[] = [];
  facts.push(`Price: ${listing.price.amount} ${listing.price.currency}`);
  facts.push(`Quantity: ${listing.quantity}`);
  facts.push(`Condition: ${listing.condition}`);
  if (listing.shippingPolicy.handlingTimeDays > 0) facts.push(`Handling time: ${listing.shippingPolicy.handlingTimeDays} days`);
  if (listing.returnPolicy.returnsAccepted) facts.push(`Returns accepted within ${listing.returnPolicy.returnWindowDays} days`);
  for (const d of listing.sellerDisclosures) facts.push(`Disclosure (${(d as { kind: string }).kind}): ${(d as { description: string }).description}`);
  return facts;
}

export function mergeSeoWithListing(listing: CanonicalListing, candidate: SeoCandidate): CanonicalListing {
  const seo: ListingSEO = {
    title: candidate.title,
    subtitle: candidate.subtitle,
    description: candidate.description,
    keywords: candidate.keywords,
    searchTags: candidate.searchTags,
    structuredData: candidate.structuredData
  };
  return { ...listing, seo, updatedAt: new Date().toISOString() };
}
