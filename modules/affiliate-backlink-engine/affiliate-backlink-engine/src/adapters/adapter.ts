/**
 * Provider-agnostic adapter contracts (Mission 16).
 *
 * Every external data source is reached through an adapter that declares:
 *  - capabilities (what it can do)
 *  - rate limits
 *  - error handling
 *  - retry semantics
 *  - cost metadata
 *  - provenance
 *  - confidence
 *
 * The system MUST function with fixture/import mode even without paid APIs.
 */

export type AdapterProviderKind = "search" | "seo" | "crawl" | "serp" | "llm" | "contact" | "import" | "internal";

export interface AdapterCapabilities {
  canSearchBacklinks: boolean;
  canSearchBrokenLinks: boolean;
  canSearchResourcePages: boolean;
  canSearchMentions: boolean;
  canFetchPage: boolean;
  canDiscoverContacts: boolean;
  canProvideMetrics: boolean;
  canClassify: boolean;
  canDraft: boolean;
}

export interface AdapterRateLimit {
  /** Max requests per minute, if known. */
  requestsPerMinute?: number;
  /** Burst size. */
  burst?: number;
}

export interface AdapterCost {
  /** Cost per request in arbitrary units (USD cents or credits). */
  perRequest?: number;
  /** Cost per 1000 rows. */
  perThousandRows?: number;
  /** Free tier available. */
  hasFreeTier: boolean;
}

export interface AdapterRetry {
  /** Max retries. */
  maxRetries: number;
  /** Initial backoff ms. */
  initialBackoffMs: number;
  /** Jitter factor 0..1. */
  jitter: number;
  /** Retryable status codes / errors. */
  retryableOn: Array<string | number>;
}

export interface AdapterProvenance {
  adapter: string;
  providerKind: AdapterProviderKind;
  /** Adapter version. */
  version: string;
  /** Source reference (URL / fixture / dataset name). */
  reference?: string;
  /** Fetched at. */
  fetchedAt?: number;
}

export interface AdapterConfidence {
  /** 0..1 confidence in adapter-provided data (e.g. fixture=1.0, free search=0.6). */
  dataConfidence: number;
  /** Reason for confidence. */
  reason: string;
}

export interface AdapterMeta {
  id: string;
  name: string;
  providerKind: AdapterProviderKind;
  capabilities: AdapterCapabilities;
  rateLimit?: AdapterRateLimit;
  cost: AdapterCost;
  retry: AdapterRetry;
  provenance: AdapterProvenance;
  confidence: AdapterConfidence;
  /** Whether this adapter is offline-only (fixtures / imports). */
  offline: boolean;
}

export interface AdapterResult<T> {
  data: T;
  provenance: AdapterProvenance;
  confidence: AdapterConfidence;
  warnings?: string[];
}

export class AdapterError extends Error {
  constructor(
    message: string,
    public readonly adapter: string,
    public readonly kind: "network" | "auth" | "rate_limit" | "data" | "config" | "unknown",
    public readonly retryable: boolean,
    public readonly cause?: unknown
  ) {
    super(message);
    this.name = "AdapterError";
  }
}

export interface SearchQuery {
  query: string;
  /** Optional locale. */
  locale?: string;
  /** Max results. */
  limit?: number;
}

export interface BacklinkQuery {
  /** Target domain to inspect backlinks FOR (i.e. competitor). */
  targetDomain: string;
  /** Limit. */
  limit?: number;
}

export interface BrokenLinkQuery {
  /** Page URL to scan for broken outbound links. */
  pageUrl: string;
}

export interface ResourcePageQuery {
  /** Topic / keyword. */
  topic: string;
  /** Limit. */
  limit?: number;
}

export interface MentionQuery {
  /** Brand or topic to find mentions of. */
  term: string;
  /** Limit. */
  limit?: number;
}

export interface PageFetchQuery {
  url: string;
}

export interface ContactQuery {
  /** Page or domain to discover contact info for. */
  ref: string;
}

/**
 * The generic search/data adapter contract. Concrete adapters implement this.
 */
export interface SearchDataAdapter {
  meta: AdapterMeta;
  search?(q: SearchQuery): Promise<AdapterResult<SearchResultItem[]>>;
  searchBacklinks?(q: BacklinkQuery): Promise<AdapterResult<BacklinkResultItem[]>>;
  searchBrokenLinks?(q: BrokenLinkQuery): Promise<AdapterResult<BrokenLinkResultItem[]>>;
  searchResourcePages?(q: ResourcePageQuery): Promise<AdapterResult<ResourcePageResultItem[]>>;
  searchMentions?(q: MentionQuery): Promise<AdapterResult<MentionResultItem[]>>;
  fetchPage?(q: PageFetchQuery): Promise<AdapterResult<PageSnapshot>>;
  discoverContacts?(q: ContactQuery): Promise<AdapterResult<ContactResultItem[]>>;
}

export interface SearchResultItem {
  url: string;
  title?: string;
  snippet?: string;
  position?: number;
}

export interface BacklinkResultItem {
  linkingDomain: string;
  linkingPageUrl: string;
  targetUrl: string;
  anchorText?: string;
  firstSeen?: number;
  lastSeen?: number;
  /** Optional provider metrics. */
  authority?: number;
  /** Optional rel attribute. */
  rel?: string;
}

export interface BrokenLinkResultItem {
  sourcePageUrl: string;
  brokenDestinationUrl: string;
  anchorText?: string;
  context?: string;
  httpState?: number;
  detectedAt?: number;
}

export interface ResourcePageResultItem {
  url: string;
  title?: string;
  snippet?: string;
  /** Hint for classification. */
  hint?: string;
}

export interface MentionResultItem {
  url: string;
  snippet?: string;
  /** The matched term. */
  term?: string;
  /** Whether the mention already contains a link to the target. */
  hasLink?: boolean;
}

export interface PageSnapshot {
  url: string;
  finalUrl?: string;
  httpStatus: number;
  title?: string;
  /** Outbound links found on the page. */
  outboundLinks?: Array<{ href: string; anchor: string }>;
  /** Page text excerpt (sanitized, truncated). */
  excerpt?: string;
  fetchedAt: number;
}

export interface ContactResultItem {
  ref: string;
  name?: string;
  role?: string;
  email?: string;
  contactFormUrl?: string;
  socials?: Array<{ platform: string; handle: string }>;
  observedAt?: number;
}
