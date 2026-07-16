/**
 * Provider interface stubs for search / SEO / crawl / LLM / contact adapters.
 *
 * These are NOT hardwired to any vendor. They define the contract that future
 * concrete adapters (e.g. an AhrefsAdapter, SerpApiAdapter, OpenAIAdapter) must
 * satisfy. Each is a thin subclass of the generic contract.
 */
import {
  SearchDataAdapter,
  AdapterMeta,
  AdapterConfidence,
  AdapterProvenance,
  AdapterCost,
  AdapterRetry,
  AdapterCapabilities
} from "./adapter.js";

function makeMeta(
  id: string,
  name: string,
  providerKind: AdapterProvenance["providerKind"],
  capabilities: AdapterCapabilities,
  cost: AdapterCost,
  confidence: AdapterConfidence,
  offline: boolean
): AdapterMeta {
  const retry: AdapterRetry = {
    maxRetries: 3,
    initialBackoffMs: 500,
    jitter: 0.2,
    retryableOn: [429, 500, 502, 503, 504, "network"]
  };
  const provenance: AdapterProvenance = { adapter: id, providerKind, version: "0.0.0-stub" };
  return { id, name, providerKind, capabilities, rateLimit: { requestsPerMinute: 60, burst: 10 }, cost, retry, provenance, confidence, offline };
}

/**
 * Abstract base class for concrete search adapters (Bing, SerpApi, etc.).
 * Concrete implementations live outside this engine; this is the contract.
 */
export abstract class BaseSearchAdapter implements SearchDataAdapter {
  abstract readonly meta: AdapterMeta;
  abstract search(q: { query: string; locale?: string; limit?: number }): Promise<import("./adapter.js").AdapterResult<import("./adapter.js").SearchResultItem[]>>;
}

export const SEARCH_ADAPTER_STUB_META: AdapterMeta = makeMeta(
  "adapter.search.stub",
  "Search Adapter (stub)",
  "search",
  {
    canSearchBacklinks: false,
    canSearchBrokenLinks: false,
    canSearchResourcePages: true,
    canSearchMentions: true,
    canFetchPage: false,
    canDiscoverContacts: false,
    canProvideMetrics: false,
    canClassify: false,
    canDraft: false
  },
  { hasFreeTier: true, perRequest: 0, perThousandRows: 0 },
  { dataConfidence: 0.5, reason: "Free search results have variable freshness and coverage." },
  false
);

export const SEO_ADAPTER_STUB_META: AdapterMeta = makeMeta(
  "adapter.seo.stub",
  "SEO Backlink Adapter (stub)",
  "seo",
  {
    canSearchBacklinks: true,
    canSearchBrokenLinks: true,
    canSearchResourcePages: false,
    canSearchMentions: false,
    canFetchPage: false,
    canDiscoverContacts: false,
    canProvideMetrics: true,
    canClassify: false,
    canDraft: false
  },
  { hasFreeTier: false, perRequest: 5, perThousandRows: 50 },
  { dataConfidence: 0.8, reason: "Premium SEO providers offer historical depth but may lag live state." },
  false
);

export const CRAWL_ADAPTER_STUB_META: AdapterMeta = makeMeta(
  "adapter.crawl.stub",
  "Crawl Adapter (stub)",
  "crawl",
  {
    canSearchBacklinks: false,
    canSearchBrokenLinks: true,
    canSearchResourcePages: false,
    canSearchMentions: false,
    canFetchPage: true,
    canDiscoverContacts: false,
    canProvideMetrics: false,
    canClassify: false,
    canDraft: false
  },
  { hasFreeTier: true, perRequest: 1, perThousandRows: 10 },
  { dataConfidence: 0.9, reason: "First-party crawl data is the freshest possible signal." },
  false
);

export const LLM_ADAPTER_STUB_META: AdapterMeta = makeMeta(
  "adapter.llm.stub",
  "LLM Adapter (stub)",
  "llm",
  {
    canSearchBacklinks: false,
    canSearchBrokenLinks: false,
    canSearchResourcePages: false,
    canSearchMentions: false,
    canFetchPage: false,
    canDiscoverContacts: false,
    canProvideMetrics: false,
    canClassify: true,
    canDraft: true
  },
  { hasFreeTier: true, perRequest: 0, perThousandRows: 0 },
  { dataConfidence: 0.6, reason: "LLM output must be reviewed; never auto-applied as fact." },
  false
);

export const CONTACT_ADAPTER_STUB_META: AdapterMeta = makeMeta(
  "adapter.contact.stub",
  "Contact Adapter (stub)",
  "contact",
  {
    canSearchBacklinks: false,
    canSearchBrokenLinks: false,
    canSearchResourcePages: false,
    canSearchMentions: false,
    canFetchPage: false,
    canDiscoverContacts: true,
    canProvideMetrics: false,
    canClassify: false,
    canDraft: false
  },
  { hasFreeTier: false, perRequest: 10, perThousandRows: 100 },
  { dataConfidence: 0.7, reason: "Contact data must be verified before outreach." },
  false
);

export { makeMeta as makeAdapterMeta };
