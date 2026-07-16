/**
 * @primeopp-deal-intelligence/feed-contracts
 *
 * Contracts for affiliate and product feeds. Does not implement any
 * specific feed parser; consumers register adapters via the Adapter SDK.
 */
import type { AdapterId, ISO8601, Evidence, Money } from '@primeopp-deal-intelligence/contracts';

export type FeedFormat = 'csv' | 'tsv' | 'json' | 'xml' | 'rss';

export interface FeedRecord {
  raw: Record<string, string | number | boolean | null>;
  normalized?: {
    productId?: string;
    retailerId?: string;
    title?: string;
    price?: Money;
    url?: string;
    availability?: string;
    promotion?: string;
    evidence: Evidence[];
  };
}

export interface FeedFetchResult {
  sourceUrl: string;
  fetchedAt: ISO8601;
  format: FeedFormat;
  records: FeedRecord[];
  evidence: Evidence[];
}

export interface FeedAdapter {
  adapterId: AdapterId;
  testOnly?: boolean;
  supports: FeedFormat[];
  fetch(url: string): Promise<FeedFetchResult>;
}

/** Test-only CSV feed adapter that parses from a string. */
export class CsvFixtureFeedAdapter implements FeedAdapter {
  readonly adapterId: AdapterId = 'adapter:csv-fixture-feed' as AdapterId;
  readonly testOnly = true;
  supports: FeedFormat[] = ['csv'];
  async parse(csv: string): Promise<FeedFetchResult> {
    const lines = csv.split(/\r?\n/).filter(l => l.length > 0);
    if (lines.length === 0) {
      return { sourceUrl: 'fixture://csv', fetchedAt: new Date().toISOString(),
        format: 'csv', records: [], evidence: [] };
    }
    const headers = (lines[0] ?? '').split(',').map(h => h.trim());
    const records: FeedRecord[] = [];
    for (let i = 1; i < lines.length; i++) {
      const cells = (lines[i] ?? '').split(',').map(c => c.trim());
      const raw: Record<string, string | number | boolean | null> = {};
      headers.forEach((h, idx) => { raw[h] = cells[idx] ?? null; });
      records.push({ raw });
    }
    return { sourceUrl: 'fixture://csv', fetchedAt: new Date().toISOString(),
      format: 'csv', records, evidence: [] };
  }
  async fetch(url: string): Promise<FeedFetchResult> {
    // Test-only: never actually fetches the network. Returns empty.
    return { sourceUrl: url, fetchedAt: new Date().toISOString(),
      format: 'csv', records: [], evidence: [] };
  }
}
