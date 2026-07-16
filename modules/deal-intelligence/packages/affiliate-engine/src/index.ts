/**
 * @primeopp-deal-intelligence/affiliate-engine
 *
 * Affiliate routing, disclosure and validation. NEVER conceals affiliate
 * status. NEVER rewrites links for unauthorized merchants. NEVER fabricates
 * expected commission.
 */
import type {
  AffiliateLink, AffiliateProgram, AffiliateNetwork, Money, Evidence, ISO8601
} from '@primeopp-deal-intelligence/contracts';
import { nextId, nowIso } from '@primeopp-deal-intelligence/contracts';

export interface BuildLinkInput {
  program: AffiliateProgram;
  destinationUrl: string;
  campaignTags?: Record<string, string>;
  expiresAt?: ISO8601;
  allowedDomains: string[];   // official retailer domains
  evidence?: Evidence[];
}

export interface BuildLinkResult {
  link?: AffiliateLink;
  rejected: boolean;
  reasons: string[];
}

const TEST_NETWORKS: AffiliateNetwork[] = [
  { id: 'amazon-associates', name: 'Amazon Associates' },
  { id: 'impact', name: 'Impact' },
  { id: 'cj', name: 'Commission Junction' },
  { id: 'rakuten', name: 'Rakuten Advertising' },
  { id: 'shareasale', name: 'ShareASale' }
];

export function listTestNetworks(): AffiliateNetwork[] {
  return TEST_NETWORKS.slice();
}

export function buildAffiliateLink(input: BuildLinkInput): BuildLinkResult {
  const reasons: string[] = [];
  // Validate destination URL
  let dest: URL;
  try {
    dest = new URL(input.destinationUrl);
  } catch {
    return { rejected: true, reasons: ['invalid destination URL'] };
  }
  if (dest.protocol !== 'https:') {
    reasons.push('destination URL not HTTPS');
    return { rejected: true, reasons };
  }
  if (!input.allowedDomains.includes(dest.hostname.toLowerCase())) {
    reasons.push(`domain ${dest.hostname} not in allowed domains`);
    return { rejected: true, reasons };
  }
  // Build tracking URL — test-only; uses deterministic placeholder subdomain.
  const trackingUrl = `https://track.test.local/?to=${encodeURIComponent(input.destinationUrl)}&net=${encodeURIComponent(input.program.network.id)}`;
  const disclosureText = `Affiliate link: PrimeOpp may earn a commission from ${input.program.merchantName} via ${input.program.network.name}.`;

  const link: AffiliateLink = {
    id: nextId('aff'),
    program: input.program,
    destinationUrl: input.destinationUrl,
    trackingUrl,
    campaignTags: input.campaignTags ?? {},
    expiresAt: input.expiresAt,
    disclosureRequired: true,
    disclosureText,
    domainValidated: true,
    createdAt: nowIso()
  };
  return { link, rejected: false, reasons };
}

export function validateAffiliateLink(link: AffiliateLink, allowedDomains: string[]): {
  valid: boolean; reasons: string[];
} {
  const reasons: string[] = [];
  let dest: URL;
  try {
    dest = new URL(link.destinationUrl);
  } catch {
    return { valid: false, reasons: ['invalid destination URL'] };
  }
  if (!allowedDomains.includes(dest.hostname.toLowerCase())) {
    reasons.push('destination domain not in allowed list');
  }
  if (!link.disclosureRequired) {
    reasons.push('disclosureRequired must be true');
  }
  if (!link.disclosureText || !link.disclosureText.toLowerCase().includes('affiliate')) {
    reasons.push('disclosureText must mention affiliate');
  }
  if (link.expiresAt && Date.parse(link.expiresAt) < Date.now()) {
    reasons.push('link expired');
  }
  return { valid: reasons.length === 0, reasons };
}

/** Detect malicious redirect substitution. */
export function detectAffiliateHijack(link: AffiliateLink, officialDomains: string[]): boolean {
  try {
    const dest = new URL(link.destinationUrl);
    const track = new URL(link.trackingUrl);
    if (!officialDomains.includes(dest.hostname.toLowerCase())) return true;
    // Tracking URL pointing to an unexpected non-test domain.
    if (!track.hostname.endsWith('.test.local') && !officialDomains.includes(track.hostname.toLowerCase())) {
      return true;
    }
    return false;
  } catch {
    return true;
  }
}

export function estimateCommission(link: AffiliateLink, saleAmount: Money): Money | undefined {
  // NEVER fabricate commission. Only return estimate if program has defaultCommissionPct.
  const pct = link.program.defaultCommissionPct;
  if (typeof pct !== 'number' || pct <= 0) return undefined;
  return { amountMinor: Math.round(saleAmount.amountMinor * pct / 100), currency: saleAmount.currency };
}
