/**
 * @primeopp-deal-intelligence/crawler-contracts
 *
 * Provider-agnostic contracts for HTTP and browser-based crawling.
 * Does NOT implement a competing Browser Operator; see browser-contracts.
 */
import type { AdapterId, ISO8601, Evidence } from '@primeopp-deal-intelligence/contracts';

export interface CrawlerRequest {
  url: string;
  method?: 'GET' | 'POST';
  headers?: Record<string, string>;
  body?: string;
  /** Max redirects to follow (default 5). */
  maxRedirects?: number;
  /** Timeout in milliseconds. */
  timeoutMs?: number;
  /** Required — every request must declare its terms basis. */
  termsBasis: 'robots-txt-allowed' | 'explicit-permission' | 'fixture-only' | 'community-submitted-evidence';
}

export interface CrawlerResponse {
  url: string;
  finalUrl: string;
  status: number;
  headers: Record<string, string>;
  body: string;
  /** True if the body was loaded from a local fixture (test-only). */
  fromFixture?: boolean;
  capturedAt: ISO8601;
  evidence: Evidence[];
}

export interface CrawlerAdapter {
  adapterId: AdapterId;
  testOnly?: boolean;
  fetch(req: CrawlerRequest): Promise<CrawlerResponse>;
}

export interface CrawlerSession {
  sessionId: string;
  createdAt: ISO8601;
  close(): Promise<void>;
  adapter: CrawlerAdapter;
}

export interface ProxyContract {
  proxyId: string;
  region?: string;
  rotationStrategy: 'per-request' | 'sticky';
  maxRequestsPerSession?: number;
}

export interface ThrottlingContract {
  minDelayMs: number;
  maxDelayMs: number;
  jitter: number;
  backoffOn429: boolean;
  circuitBreaker: { threshold: number; cooldownMs: number };
}

export interface PageParser<T> {
  name: string;
  canParse(url: string, contentType: string): boolean;
  parse(html: string, url: string): T;
}

export interface ProductParser extends PageParser<{ title?: string; price?: number; availability?: string; identifiers?: { type: string; value: string }[] }> {}
export interface CategoryParser extends PageParser<{ items: { url: string; title?: string }[] }> {}
export interface SearchParser extends PageParser<{ items: { url: string; title?: string }[] }> {}
export interface AvailabilityParser extends PageParser<{ state: string; stores?: string[] }> {}
export interface PromotionParser extends PageParser<{ promotions: { id: string; type: string; description: string }[] }> {}
export interface CouponParser extends PageParser<{ coupons: { code: string; description: string; discountType?: string }[] }> {}
export interface PriceParser extends PageParser<{ amountMinor: number; currency: string }> {}
export interface StockParser extends PageParser<{ state: string; quantityEstimate?: { min: number; max: number } }> {}

/** In-memory test-only crawler adapter that serves from a fixture map. */
export class FixtureCrawlerAdapter implements CrawlerAdapter {
  readonly adapterId: AdapterId = 'adapter:fixture-crawler' as AdapterId;
  readonly testOnly = true;
  constructor(private fixtures: Map<string, string>) {}
  async fetch(req: CrawlerRequest): Promise<CrawlerResponse> {
    const body = this.fixtures.get(req.url);
    if (body === undefined) {
      return {
        url: req.url,
        finalUrl: req.url,
        status: 404,
        headers: {},
        body: '',
        fromFixture: true,
        capturedAt: new Date().toISOString(),
        evidence: []
      };
    }
    return {
      url: req.url,
      finalUrl: req.url,
      status: 200,
      headers: { 'content-type': 'text/html; charset=utf-8' },
      body,
      fromFixture: true,
      capturedAt: new Date().toISOString(),
      evidence: []
    };
  }
}

export function assertSafeUrl(url: string): string {
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    throw new Error(`assertSafeUrl: invalid URL ${url}`);
  }
  if (u.protocol !== 'http:' && u.protocol !== 'https:') {
    throw new Error(`assertSafeUrl: disallowed protocol ${u.protocol}`);
  }
  // SSRF resistance: block common internal addresses.
  const host = u.hostname.toLowerCase();
  if (host === 'localhost' || host === '127.0.0.1' || host === '::1' || host.startsWith('169.254.') || host.startsWith('10.') || host.startsWith('192.168.') || host.startsWith('172.')) {
    throw new Error(`assertSafeUrl: internal address blocked ${host}`);
  }
  return url;
}

export function normalizeUrl(url: string): string {
  const u = new URL(url);
  // Drop tracking parameters
  const drop = new Set(['utm_source','utm_medium','utm_campaign','utm_term','utm_content','gclid','fbclid','ref']);
  for (const k of [...u.searchParams.keys()]) {
    if (drop.has(k)) u.searchParams.delete(k);
  }
  // Lowercase host, strip trailing slash on path
  u.hostname = u.hostname.toLowerCase();
  if (u.pathname.length > 1 && u.pathname.endsWith('/')) {
    u.pathname = u.pathname.replace(/\/+$/, '');
  }
  return u.toString();
}

export function validateRedirectChain(chain: string[], allowedDomains: string[]): boolean {
  for (const url of chain) {
    const u = new URL(url);
    if (!allowedDomains.includes(u.hostname.toLowerCase())) return false;
  }
  return true;
}
