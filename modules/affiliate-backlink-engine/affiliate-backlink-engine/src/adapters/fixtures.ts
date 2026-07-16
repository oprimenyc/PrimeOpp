/**
 * Fixture adapter — offline, deterministic data source.
 * Implements the SearchDataAdapter contract using in-memory datasets.
 *
 * This is the default adapter. It guarantees the engine works without
 * paid APIs or live network access.
 */
import {
  SearchDataAdapter,
  AdapterMeta,
  AdapterResult,
  SearchQuery,
  BacklinkQuery,
  BrokenLinkQuery,
  ResourcePageQuery,
  MentionQuery,
  SearchResultItem,
  BacklinkResultItem,
  BrokenLinkResultItem,
  ResourcePageResultItem,
  MentionResultItem
} from "./adapter.js";

export interface FixtureDataset {
  search?: Array<SearchResultItem & { queryMatch?: string[] }>;
  backlinks?: Array<BacklinkResultItem & { matchDomain?: string }>;
  brokenLinks?: Array<BrokenLinkResultItem & { matchPage?: string }>;
  resourcePages?: Array<ResourcePageResultItem & { topicMatch?: string[] }>;
  mentions?: Array<MentionResultItem & { matchTerm?: string }>;
}

export const FIXTURE_ADAPTER_META: AdapterMeta = {
  id: "adapter.fixture",
  name: "Fixture Adapter (offline)",
  providerKind: "import",
  capabilities: {
    canSearchBacklinks: true,
    canSearchBrokenLinks: true,
    canSearchResourcePages: true,
    canSearchMentions: true,
    canFetchPage: false,
    canDiscoverContacts: false,
    canProvideMetrics: false,
    canClassify: false,
    canDraft: false
  },
  rateLimit: { requestsPerMinute: 99999, burst: 99999 },
  cost: { hasFreeTier: true, perRequest: 0, perThousandRows: 0 },
  retry: { maxRetries: 0, initialBackoffMs: 0, jitter: 0, retryableOn: [] },
  provenance: {
    adapter: "fixture",
    providerKind: "import",
    version: "1.0.0"
  },
  confidence: {
    dataConfidence: 1.0,
    reason: "Deterministic fixture data, fully reproducible."
  },
  offline: true
};

export class FixtureAdapter implements SearchDataAdapter {
  readonly meta: AdapterMeta = FIXTURE_ADAPTER_META;
  constructor(private readonly dataset: FixtureDataset = {}) {}

  async search(q: SearchQuery): Promise<AdapterResult<SearchResultItem[]>> {
    const all = this.dataset.search ?? [];
    const qLower = q.query.toLowerCase();
    const matches = all
      .filter((item) => {
        if (item.queryMatch) {
          return item.queryMatch.some((m) => m.toLowerCase().includes(qLower) || qLower.includes(m.toLowerCase()));
        }
        return (
          (item.title ?? "").toLowerCase().includes(qLower) ||
          (item.snippet ?? "").toLowerCase().includes(qLower) ||
          item.url.toLowerCase().includes(qLower)
        );
      })
      .slice(0, q.limit ?? 50)
      .map(({ queryMatch: _q, ...rest }) => rest);
    return this.wrap(matches);
  }

  async searchBacklinks(q: BacklinkQuery): Promise<AdapterResult<BacklinkResultItem[]>> {
    const all = this.dataset.backlinks ?? [];
    const matches = all
      .filter((b) => (b.matchDomain ?? b.targetUrl ?? "").includes(q.targetDomain))
      .slice(0, q.limit ?? 200)
      .map(({ matchDomain: _m, ...rest }) => rest);
    return this.wrap(matches);
  }

  async searchBrokenLinks(q: BrokenLinkQuery): Promise<AdapterResult<BrokenLinkResultItem[]>> {
    const all = this.dataset.brokenLinks ?? [];
    const matches = all
      .filter((b) => (b.matchPage ?? b.sourcePageUrl) === q.pageUrl || b.sourcePageUrl === q.pageUrl)
      .map(({ matchPage: _m, ...rest }) => rest);
    return this.wrap(matches);
  }

  async searchResourcePages(q: ResourcePageQuery): Promise<AdapterResult<ResourcePageResultItem[]>> {
    const all = this.dataset.resourcePages ?? [];
    const qLower = q.topic.toLowerCase();
    const matches = all
      .filter((r) => {
        if (r.topicMatch) {
          return r.topicMatch.some((t) => qLower.includes(t.toLowerCase()) || t.toLowerCase().includes(qLower));
        }
        return (r.title ?? "").toLowerCase().includes(qLower) || (r.snippet ?? "").toLowerCase().includes(qLower);
      })
      .slice(0, q.limit ?? 50)
      .map(({ topicMatch: _t, ...rest }) => rest);
    return this.wrap(matches);
  }

  async searchMentions(q: MentionQuery): Promise<AdapterResult<MentionResultItem[]>> {
    const all = this.dataset.mentions ?? [];
    const qLower = q.term.toLowerCase();
    const matches = all
      .filter((m) => {
        const term = (m.matchTerm ?? m.term ?? q.term).toLowerCase();
        return qLower.includes(term) || term.includes(qLower);
      })
      .slice(0, q.limit ?? 50)
      .map(({ matchTerm: _m, ...rest }) => rest);
    return this.wrap(matches);
  }

  private wrap<T>(data: T): AdapterResult<T> {
    return {
      data,
      provenance: { ...this.meta.provenance, fetchedAt: Date.now() },
      confidence: this.meta.confidence,
      warnings: this.meta.offline ? ["offline-fixture"] : undefined
    };
  }
}

/**
 * Composite adapter — fans a query out to multiple adapters and merges.
 * Allows free + premium adapters to coexist.
 */
export class CompositeAdapter implements SearchDataAdapter {
  readonly meta: AdapterMeta;
  constructor(private readonly adapters: SearchDataAdapter[]) {
    if (adapters.length === 0) throw new Error("CompositeAdapter requires at least one adapter");
    const first = adapters[0];
    this.meta = {
      ...first.meta,
      id: "adapter.composite",
      name: `Composite (${adapters.map((a) => a.meta.name).join(" + ")})`,
      offline: adapters.every((a) => a.meta.offline),
      confidence: {
        dataConfidence: Math.max(...adapters.map((a) => a.meta.confidence.dataConfidence)),
        reason: "Composite of multiple adapters; confidence is the max among them."
      }
    };
  }

  async search(q: SearchQuery) {
    return this.merge(q, (a) => a.search?.(q));
  }
  async searchBacklinks(q: BacklinkQuery) {
    return this.merge(q, (a) => a.searchBacklinks?.(q));
  }
  async searchBrokenLinks(q: BrokenLinkQuery) {
    return this.merge(q, (a) => a.searchBrokenLinks?.(q));
  }
  async searchResourcePages(q: ResourcePageQuery) {
    return this.merge(q, (a) => a.searchResourcePages?.(q));
  }
  async searchMentions(q: MentionQuery) {
    return this.merge(q, (a) => a.searchMentions?.(q));
  }

  private async merge<T>(q: unknown, call: (a: SearchDataAdapter) => Promise<AdapterResult<T[]>> | undefined): Promise<AdapterResult<T[]>> {
    const results: T[] = [];
    const warnings: string[] = [];
    let maxConf = 0;
    let provenance = this.meta.provenance;
    for (const a of this.adapters) {
      const p = call(a);
      if (!p) continue;
      try {
        const r = await p;
        results.push(...r.data);
        if (r.warnings) warnings.push(...r.warnings);
        if (r.confidence.dataConfidence > maxConf) {
          maxConf = r.confidence.dataConfidence;
          provenance = r.provenance;
        }
      } catch (e) {
        warnings.push(`${a.meta.id}: ${(e as Error).message}`);
      }
    }
    return {
      data: results,
      provenance: { ...provenance, fetchedAt: Date.now() },
      confidence: {
        dataConfidence: maxConf,
        reason: `Merged from ${this.adapters.length} adapters.`
      },
      warnings
    };
  }
}
