# Free / Low-Cost Data Strategy

This document describes how the affiliate-backlink-engine assembles a usable
data pipeline under cost constraints. The engine is designed to deliver
value with zero API spend; paid providers are an opt-in accelerator, not a
prerequisite. The strategy is encoded in `src/adapters/free-low-cost.ts`
and centers on three explicit tiers, a `buildDataStack` assembler that
composes adapters in order of cost, and a manual verification queue that
captures anything the automation cannot confidently confirm.

The guiding principle is that every operator, regardless of budget, can
run the engine end-to-end on locally supplied data. Free SERP APIs and
public page fetches can be layered on to broaden coverage at a nominal
cost. Premium SEO and LLM providers can be added when the operator has
budget and wants the deepest coverage. At no point does the engine assume
that a paid subscription exists; absence of a paid adapter simply means
the engine runs in a lower tier and surfaces more items for human
verification.

## 1. Three Tiers

The engine classifies every data source into one of three tiers, defined
by the `DataTier` type (`"free_local" | "low_cost_api" |
"premium_provider"`) and documented in the `TIER_DESCRIPTIONS` array.
Each tier entry is a `TieredCapability` record with `tier`,
`capabilities` (a string array of human-readable capabilities),
`requiresNetwork`, `requiresApiKey`, optional `costPerThousand`, and
`dataConfidence`. The three tiers form a strict ordering: free/local is
always available; low-cost API requires network but no key; premium
requires both network and a key.

| Tier | Network | API key | Cost / 1K | Confidence |
| --- | --- | --- | --- | --- |
| `free_local` | no | no | $0 | 1.0 |
| `low_cost_api` | yes | no | $0.50 | 0.6 |
| `premium_provider` | yes | yes | $50 | 0.8 |

The `TIER_DESCRIPTIONS` array is the single source of truth for these
numbers and is returned from `buildDataStack` as `stack.tiers` so that
operators and UIs can introspect the active tier configuration without
re-reading source files. The confidence values are intentional:
free/local fixtures are deterministic and reproducible, so they carry
confidence 1.0 despite their limited coverage. Low-cost API data has
real-world freshness and coverage gaps, so confidence is 0.6. Premium
data has the broadest coverage but is still subject to provider lag and
sampling, so confidence is 0.8 rather than 1.0.

## 2. Free / Local Tier (default)

The `free_local` tier is the default and requires no network access and
no API key. The `TIER_DESCRIPTIONS` entry lists eight capabilities for
this tier:

- Fixture/import mode
- Sitemap XML parsing
- CSV/JSON import
- Local content graph analysis
- Internal link analysis
- Content refresh prioritization (with supplied data)
- Deterministic scoring & risk filtering
- No-op AI fallback classification

In this tier the engine operates entirely on data the operator has
supplied locally. The operator can drop a `FixtureDataset` (containing
`search`, `backlinks`, `brokenLinks`, `resourcePages`, and `mentions`
arrays) into the engine and run the full discovery, scoring, risk
filtering, and outreach pipeline against it. Sitemap XML parsing and
CSV/JSON import allow operators to bring their own crawl exports, GA
referral lists, or Search Console exports. Internal link analysis and
content refresh prioritization operate on the operator's own site graph,
which is always available locally.

Scoring, risk filtering, and opportunity clustering are deterministic
functions of the input data and do not require any external call. AI
classification falls back to `NoOpAiAdapter`, which uses token-overlap
heuristics so the engine still produces structured labels and draft
outreach text without ever calling an LLM. Because the data is
deterministic, `dataConfidence` is 1.0 and `costPerThousand` is $0.
This is the only tier that is fully reproducible: running the engine
twice on the same fixture inputs produces identical output, which makes
it suitable for tests, demos, and CI smoke tests.

## 3. Low-Cost API Tier

The `low_cost_api` tier adds network access but still requires no API
key. Its declared capabilities are:

- Free search API results (Bing / DuckDuckGo)
- Free SERP scraping within rate limits
- Public sitemap fetching
- Public page fetching (no auth)
- Local/free LLM classification
- Local/free LLM drafting

This tier is activated when the operator supplies a
`freeSearchAdapter` to `buildDataStack`. The adapter is expected to
implement `SearchDataAdapter` with the `SEARCH_ADAPTER_STUB_META`
profile: `canSearchResourcePages` and `canSearchMentions` enabled,
`providerKind: "search"`, `hasFreeTier: true`, `perRequest: 0`, and
`dataConfidence: 0.5` to `0.6` depending on data quality. Public
sitemap fetching and public page fetching round out the network
footprint: the engine can read `/sitemap.xml` from any public domain
and fetch individual public pages (no auth headers) to build a content
graph on the fly.

The cost for this tier is documented as `$0.50` per 1000 calls, which
reflects the indirect cost of running a small scraping/serp-fetch
workload (bandwidth, compute, rate-limit backoff). Confidence drops to
0.6 because free SERP results have variable freshness, deduplication
gaps, and coverage holes. Local or free LLMs (for example a
self-hosted model or a free-tier API) can be plugged in as
`freeLlmAdapter`; the engine wraps them in `ResilientAiAdapter` so
that an LLM outage degrades gracefully to the `NoOpAiAdapter` fallback
rather than aborting the pipeline.

## 4. Premium Provider Tier

The `premium_provider` tier is the highest data tier. Its declared
capabilities are:

- SEO backlink provider (e.g. Ahrefs, SEMrush, Moz)
- Premium SERP API
- Premium crawl provider
- Contact data provider
- Premium LLM

This tier is activated only when both `enablePremium: true` AND a
`premiumSeoAdapter` (or `premiumLlmAdapter`) are supplied to
`buildDataStack`. It requires both network access and an API key
managed by the adapter implementation. The cost is documented as
`$50` per 1000 calls, reflecting typical enterprise SEO API pricing.
Confidence is 0.8, lower than the free/local tier's 1.0 because
premium data, while broad, is still a sampled snapshot of the live
web and may lag real-time state by days or weeks.

Premium SEO adapters should declare the `SEO_ADAPTER_STUB_META`
profile: `canSearchBacklinks`, `canSearchBrokenLinks`, and
`canProvideMetrics` enabled, `providerKind: "seo"`,
`hasFreeTier: false`, `perRequest: 5`, `perThousandRows: 50`. Contact
adapters should declare the `CONTACT_ADAPTER_STUB_META` profile with
`canDiscoverContacts` enabled. Premium LLMs follow the
`LLM_ADAPTER_STUB_META` profile (`canClassify`, `canDraft`,
`dataConfidence: 0.6`) because even a premium LLM's output is
`INFERRED` and must be reviewed. The engine does not assume any
specific vendor; any adapter that satisfies the `SearchDataAdapter`
or `AiAdapter` contract and is registered via `buildDataStack` is
treated uniformly.

## 5. buildDataStack

`buildDataStack(config)` is the assembler that turns a
`FreeLowCostConfig` into a `FreeLowCostStack`. It is the single entry
point operators use to wire up the data tier at runtime. The assembly
rules are deterministic and ordered:

1. Always push a `new FixtureAdapter(config.fixtures ?? {})` as the
   first adapter, and set `activeTier = "free_local"`.
2. If `config.freeSearchAdapter` is supplied, push it and set
   `activeTier = "low_cost_api"`.
3. If `config.enablePremium === true` AND `config.premiumSeoAdapter`
   is supplied, push it and set `activeTier = "premium_provider"`.
4. Wrap the resulting adapter list in a `CompositeAdapter` and expose
   it as `stack.adapter`.
5. For AI: start with `new NoOpAiAdapter()`; if
   `config.freeLlmAdapter` is supplied, replace it; if
   `config.enablePremium === true` AND `config.premiumLlmAdapter` is
   supplied, replace it with the premium LLM. Always wrap the final
   choice in `new ResilientAiAdapter(...)` and expose it as
   `stack.ai`.

The returned `FreeLowCostStack` has four fields: `adapter` (the
composite), `ai` (the resilient AI adapter), `activeTier` (the highest
tier reached), and `tiers` (the full `TIER_DESCRIPTIONS` array). The
order of step 2 and step 3 is significant: a premium adapter is only
added when `enablePremium` is true, even if the adapter object is
present. This prevents accidental premium API spend when an adapter
has been configured in code but the operator did not intend to enable
it for the current run. The test suite verifies this rule by passing a
`premiumSeoAdapter` with `enablePremium: false` and asserting that
`activeTier` remains `"free_local"`.

Because the composite always starts with the fixture adapter, even a
stack that has upgraded to `premium_provider` retains the free/local
adapter as a fallback. If the premium adapter throws on a given query,
the composite captures the error as a warning and returns whatever the
fixture and free adapters can produce. This is the mechanism that
makes the no-premium-required principle enforceable at runtime rather
than merely aspirational.

## 6. Manual Verification Queue

The `ManualVerificationQueue` is a core part of the free path. When
the engine cannot verify a claim automatically (for example, a
suspected broken link that the free tier could not re-fetch, or a
contact email that could not be confirmed against a contact
adapter), it enqueues a `ManualVerificationItem` describing what
should be reviewed. The item shape is:

```ts
interface ManualVerificationItem {
  id: string;            // e.g. mvq_<base36 timestamp>_<random>
  subjectId: string;     // opportunity / target id
  claim: string;         // what the engine believes
  reason: string;        // why it could not be verified
  suggestedAction: string;
  createdAt: number;
}
```

The queue exposes three methods: `enqueue(item)` returns the created
item with a generated `id` and `createdAt`; `list()` returns a
shallow copy of the queue; `clear(subjectId?)` removes either all
items or just those for a given subject. The id format
`mvq_${Date.now().toString(36)}_${Math.random().toString(36).slice(2,
8)}` is stable for tests and traceable in logs. Because the queue is
in-process and not persisted, operators are expected to drain it
during a run and either resolve items manually or feed the resolved
data back into the next run as a fixture.

The queue exists because the free tier deliberately under-promises:
rather than emitting low-confidence results as if they were facts, the
engine marks them as needing review. This keeps the deterministic
output of the free tier trustworthy and gives operators a concrete
worklist instead of a black-box score. In premium mode the queue
shrinks because more claims can be verified automatically, but it
never disappears entirely, since even premium data carries the
`INFERRED` stamp for LLM output and the 0.8 confidence ceiling for
SEO data.

## 7. No-Premium-Required Principle

The engine MUST function with fixture/import mode even without paid
APIs. This principle is stated explicitly in the adapter module
header and is enforced by `buildDataStack`: the fixture adapter is
always present, the AI adapter always has the `NoOpAiAdapter`
fallback, and the `ResilientAiAdapter` wrapper guarantees that no AI
call can crash the pipeline. No premium SEO subscription is assumed
at any layer of the codebase. The premium tier is reached only when
the operator sets `enablePremium: true` AND supplies a premium
adapter; in every other configuration the engine stays at or below
`low_cost_api`.

This principle has practical consequences. First, every feature that
is implemented against a premium capability must also work in
fixture mode, either by degrading to a deterministic fallback or by
emitting a manual verification item. Second, the test suite must
exercise the full pipeline without any network or API key; the
`tests/free-low-cost.test.ts` tests do exactly this, asserting that
`buildDataStack()` with no arguments produces a stack whose
`activeTier` is `"free_local"` and whose `adapter.meta.offline` is
`true`. Third, documentation and operator guides must never state or
imply that a paid subscription is required to use the engine; this
document and the `TIER_DESCRIPTIONS` array are the canonical
references for what each tier can do.

## 8. Worked Example

The three configurations below show how `buildDataStack` behaves in
each tier. They are adapted directly from `tests/free-low-cost.test.ts`
so the assertions are guaranteed by the test suite.

```ts
import { buildDataStack } from "../src/adapters/free-low-cost.js";
import { FixtureAdapter } from "../src/adapters/fixtures.js";

// (a) Free only — no adapters supplied.
const free = buildDataStack();
free.activeTier;          // "free_local"
free.adapter.meta.offline; // true (composite of one offline adapter)
free.ai;                  // ResilientAiAdapter(NoOpAiAdapter)

// (b) Low-cost API — a free search adapter is supplied.
const lowCost = buildDataStack({
  freeSearchAdapter: new FixtureAdapter({}) // stand-in for a real free SERP adapter
});
lowCost.activeTier;        // "low_cost_api"

// (c) Premium — enabled AND a premium adapter is supplied.
const premium = buildDataStack({
  premiumSeoAdapter: new FixtureAdapter({}), // stand-in for an Ahrefs/SEMrush adapter
  enablePremium: true
});
premium.activeTier;        // "premium_provider"

// (d) Premium adapter supplied but NOT enabled — stays free.
const dormant = buildDataStack({
  premiumSeoAdapter: new FixtureAdapter({}),
  enablePremium: false
});
dormant.activeTier;        // "free_local"
```

In case (a) the composite contains a single `FixtureAdapter` and the AI
stack is `NoOpAiAdapter` wrapped in `ResilientAiAdapter`. In case (b)
the composite contains the fixture adapter plus the free search
adapter, so the `activeTier` upgrades to `low_cost_api`. In case (c)
the composite contains all three adapters and the `activeTier`
upgrades to `premium_provider`. In case (d) the premium adapter is
present in the config but is NOT added to the composite because
`enablePremium` is false; the `activeTier` remains `"free_local"`,
which is the safety property that prevents accidental spend.

## 9. Cost vs Confidence Tradeoff

The three tiers embody an explicit cost-vs-confidence tradeoff that
operators must navigate. Free/local data has confidence 1.0 (because
fixtures are deterministic) but limited coverage: the engine can only
reason about what the operator has supplied. Low-cost API data has
confidence 0.6 with broader coverage: free SERP and public page
fetches extend the engine's view of the web at a nominal cost. Premium
data has confidence 0.8 with the broadest coverage: paid SEO
providers expose link graphs and authority metrics that no free source
can match, but the data is still sampled and lags real-time state.

The tradeoff is not "higher tier is always better." A free/local run
on a carefully curated fixture can be more trustworthy than a
premium run on stale data, because the fixture is reproducible and
the premium snapshot is not. Operators should choose the tier based
on the question they are asking: for content refresh prioritization
on their own site, the free/local tier is sufficient because the
operator's own data is authoritative. For competitive backlink gap
analysis, the premium tier is required because no free source
exposes competitor link graphs. For opportunistic resource-page
discovery, the low-cost tier is the sweet spot.

The `stack.tiers` array returned from `buildDataStack` exists so that
operators and UIs can display this tradeoff alongside every result.
A result with `dataConfidence: 0.6` from the low-cost tier should be
presented to the user with a visible caveat; a result with
`dataConfidence: 1.0` from the free/local tier can be presented as
authoritative within the scope of the supplied data. The manual
verification queue is the safety net for results whose confidence is
too low to act on automatically: rather than discarding them, the
engine enqueues them for human review, preserving the work done by
the lower tiers while still demanding verification before outreach.
