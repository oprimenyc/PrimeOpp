/**
 * @primeopp-deal-intelligence/source-ingestion
 *
 * Source observation ingestion with provenance preservation.
 *
 * Source-precedence system (1 = highest):
 *   1. official-api or retailer-feed
 *   2. affiliate-feed
 *   3. verified structured retailer data (structured-csv, structured-json, webhook, rss)
 *   4. browser-operator
 *   5. community-submission
 *   6. manual-entry
 *   7. unknown / unsupported
 */
import type {
  RetailerSourceMethod, Evidence, ISO8601, Confidence, RegionCode
} from '@primeopp-deal-intelligence/contracts';
import { nextId, nowIso } from '@primeopp-deal-intelligence/contracts';

export interface SourceObservation {
  id: string;
  source: RetailerSourceMethod;
  retailerId: string;
  productIdentifier: { type: string; value: string };
  url?: string;
  observedPrice?: { amountMinor: number; currency: string };
  availability?: string;
  promotion?: string;
  coupon?: string;
  region?: RegionCode;
  store?: string;
  timestamp: ISO8601;
  evidence: Evidence[];
  confidence: Confidence;
  termsRestriction?: string;
  freshness: ISO8601;
  extractionMethod: string;
  precedence: number;
}

export function precedenceFor(source: RetailerSourceMethod): number {
  switch (source) {
    case 'official-api':
    case 'retailer-feed':
      return 1;
    case 'affiliate-feed':
      return 2;
    case 'structured-csv':
    case 'structured-json':
    case 'webhook':
    case 'rss':
    case 'product-feed':
    case 'authorized-partner-feed':
      return 3;
    case 'browser-operator':
      return 4;
    case 'community-submission':
      return 5;
    case 'manual-entry':
    case 'retailer-newsletter':
    case 'email-export':
      return 6;
    default:
      return 7;
  }
}

export function ingest(raw: Omit<SourceObservation, 'id' | 'precedence' | 'freshness'>): SourceObservation {
  if (!raw.retailerId) throw new Error('ingest: retailerId required');
  if (!raw.productIdentifier || !raw.productIdentifier.value) {
    throw new Error('ingest: productIdentifier.value required');
  }
  return {
    ...raw,
    id: nextId('obs'),
    precedence: precedenceFor(raw.source),
    freshness: nowIso()
  };
}

export function sortByPrecedence(obs: SourceObservation[]): SourceObservation[] {
  return obs.slice().sort((a, b) => a.precedence - b.precedence || (a.timestamp < b.timestamp ? 1 : -1));
}

export function assertNeverStripped(obs: SourceObservation): string[] {
  // Returns a list of required provenance fields present. Never strips provenance.
  const present: string[] = [];
  if (obs.source) present.push('source');
  if (obs.retailerId) present.push('retailerId');
  if (obs.productIdentifier) present.push('productIdentifier');
  if (obs.timestamp) present.push('timestamp');
  if (obs.evidence && obs.evidence.length) present.push('evidence');
  if (obs.confidence !== undefined) present.push('confidence');
  return present;
}
