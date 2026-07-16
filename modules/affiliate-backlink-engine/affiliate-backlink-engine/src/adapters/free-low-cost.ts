/**
 * Free / Low-Cost Data Path (Mission 17).
 *
 * Because the system may be operated under cost constraints, this module
 * assembles a lawful low-cost path using combinations of:
 *  - user-supplied exports
 *  - search results (free tier)
 *  - sitemaps
 *  - public pages
 *  - crawl data
 *  - local analysis
 *  - local/free LLMs for classification
 *  - manual verification queues
 *
 * It clearly distinguishes what can be done:
 *  - free/local
 *  - low-cost API
 *  - premium data provider
 *
 * It does NOT assume premium SEO subscriptions are required.
 */
import { FixtureAdapter, CompositeAdapter } from "../adapters/fixtures.js";
import type { FixtureDataset } from "../adapters/fixtures.js";
import { SearchDataAdapter } from "../adapters/adapter.js";
import { NoOpAiAdapter, ResilientAiAdapter, AiAdapter } from "../ai/boundary.js";

export type DataTier = "free_local" | "low_cost_api" | "premium_provider";

export interface TieredCapability {
  tier: DataTier;
  /** What this tier can do. */
  capabilities: string[];
  /** Whether it requires network. */
  requiresNetwork: boolean;
  /** Whether it requires an API key. */
  requiresApiKey: boolean;
  /** Approximate cost per 1000 calls. */
  costPerThousand?: number;
  /** Confidence in data quality from this tier. */
  dataConfidence: number;
}

export const TIER_DESCRIPTIONS: TieredCapability[] = [
  {
    tier: "free_local",
    capabilities: [
      "Fixture/import mode",
      "Sitemap XML parsing",
      "CSV/JSON import",
      "Local content graph analysis",
      "Internal link analysis",
      "Content refresh prioritization (with supplied data)",
      "Deterministic scoring & risk filtering",
      "No-op AI fallback classification"
    ],
    requiresNetwork: false,
    requiresApiKey: false,
    costPerThousand: 0,
    dataConfidence: 1.0
  },
  {
    tier: "low_cost_api",
    capabilities: [
      "Free search API results (Bing / DuckDuckGo)",
      "Free SERP scraping within rate limits",
      "Public sitemap fetching",
      "Public page fetching (no auth)",
      "Local/free LLM classification",
      "Local/free LLM drafting"
    ],
    requiresNetwork: true,
    requiresApiKey: false,
    costPerThousand: 0.5,
    dataConfidence: 0.6
  },
  {
    tier: "premium_provider",
    capabilities: [
      "SEO backlink provider (e.g. Ahrefs, SEMrush, Moz)",
      "Premium SERP API",
      "Premium crawl provider",
      "Contact data provider",
      "Premium LLM"
    ],
    requiresNetwork: true,
    requiresApiKey: true,
    costPerThousand: 50,
    dataConfidence: 0.8
  }
];

export interface FreeLowCostConfig {
  /** Fixture datasets. */
  fixtures?: FixtureDataset;
  /** Optional free search adapter. */
  freeSearchAdapter?: SearchDataAdapter;
  /** Optional premium SEO adapter. */
  premiumSeoAdapter?: SearchDataAdapter;
  /** Optional free LLM adapter. */
  freeLlmAdapter?: AiAdapter;
  /** Optional premium LLM adapter. */
  premiumLlmAdapter?: AiAdapter;
  /** Whether to enable premium tier (default false). */
  enablePremium?: boolean;
}

export interface FreeLowCostStack {
  /** Composite adapter (fixtures + free + optional premium). */
  adapter: SearchDataAdapter;
  /** Resilient AI adapter (noop or supplied). */
  ai: AiAdapter;
  /** Active tier. */
  activeTier: DataTier;
  /** Tier descriptions for documentation. */
  tiers: TieredCapability[];
}

/**
 * Build a tiered data stack. Always includes free/local. Adds low-cost if
 * an adapter is supplied. Adds premium only if explicitly enabled AND a
 * premium adapter is supplied.
 */
export function buildDataStack(config: FreeLowCostConfig = {}): FreeLowCostStack {
  const adapters: SearchDataAdapter[] = [];
  let activeTier: DataTier = "free_local";

  const fixtureAdapter = new FixtureAdapter(config.fixtures ?? {});
  adapters.push(fixtureAdapter);

  if (config.freeSearchAdapter) {
    adapters.push(config.freeSearchAdapter);
    activeTier = "low_cost_api";
  }

  if (config.enablePremium && config.premiumSeoAdapter) {
    adapters.push(config.premiumSeoAdapter);
    activeTier = "premium_provider";
  }

  const composite = new CompositeAdapter(adapters);

  // AI stack.
  let ai: AiAdapter = new NoOpAiAdapter();
  if (config.freeLlmAdapter) {
    ai = config.freeLlmAdapter;
  }
  if (config.enablePremium && config.premiumLlmAdapter) {
    ai = config.premiumLlmAdapter;
  }
  const resilientAi = new ResilientAiAdapter(ai);

  return {
    adapter: composite,
    ai: resilientAi,
    activeTier,
    tiers: TIER_DESCRIPTIONS
  };
}

/**
 * Manual verification queue: items the engine could not verify automatically
 * are surfaced here for human review. This is a core part of the free path.
 */
export interface ManualVerificationItem {
  id: string;
  subjectId: string;
  claim: string;
  reason: string;
  suggestedAction: string;
  createdAt: number;
}

export class ManualVerificationQueue {
  private items: ManualVerificationItem[] = [];
  enqueue(item: Omit<ManualVerificationItem, "id" | "createdAt">): ManualVerificationItem {
    const m: ManualVerificationItem = {
      ...item,
      id: `mvq_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
      createdAt: Date.now()
    };
    this.items.push(m);
    return m;
  }
  list(): ManualVerificationItem[] {
    return [...this.items];
  }
  clear(subjectId?: string): void {
    if (subjectId) this.items = this.items.filter((i) => i.subjectId !== subjectId);
    else this.items = [];
  }
}
