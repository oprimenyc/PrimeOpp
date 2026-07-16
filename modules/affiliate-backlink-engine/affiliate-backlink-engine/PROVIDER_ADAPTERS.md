# Provider Adapters

This document describes the provider-agnostic adapter layer that bridges the
affiliate-backlink-engine to external data sources (search APIs, SEO backlink
providers, crawlers, LLMs, contact databases) and to local/imported datasets.
The design is deliberately vendor-neutral: concrete adapters (Ahrefs, SerpApi,
OpenAI, etc.) are NOT hardwired into the engine. Instead, every external source
must implement one of the contracts defined in `src/adapters/adapter.ts` and
`src/ai/boundary.ts`, and the engine interacts only with the contract.

The architecture enforces a strict rule: the engine MUST function in
fixture/import mode even when no paid APIs are present. Capabilities are
declared, not assumed, so unavailable features are skipped gracefully rather
than throwing. Provenance and confidence are attached to every result so that
downstream scoring and verification logic can reason about data quality without
inspecting the source adapter directly.

## 1. Adapter Contract

The central abstraction is the `SearchDataAdapter` interface defined in
`src/adapters/adapter.ts`. It is intentionally a "fat" interface with a small
required surface: only the `meta: AdapterMeta` field is mandatory. The seven
operational methods are all optional and prefixed with `?` in the interface
declaration. This optionality is what allows the engine to mix adapters with
very different capability profiles (a backlink-only SEO adapter, a
fetch-only crawl adapter, a classify-only LLM adapter) under a single uniform
type. The seven methods are:

| Method | Query Type | Returns |
| --- | --- | --- |
| `search(q)` | `SearchQuery` | `AdapterResult<SearchResultItem[]>` |
| `searchBacklinks(q)` | `BacklinkQuery` | `AdapterResult<BacklinkResultItem[]>` |
| `searchBrokenLinks(q)` | `BrokenLinkQuery` | `AdapterResult<BrokenLinkResultItem[]>` |
| `searchResourcePages(q)` | `ResourcePageQuery` | `AdapterResult<ResourcePageResultItem[]>` |
| `searchMentions(q)` | `MentionQuery` | `AdapterResult<MentionResultItem[]>` |
| `fetchPage(q)` | `PageFetchQuery` | `AdapterResult<PageSnapshot>` |
| `discoverContacts(q)` | `ContactQuery` | `AdapterResult<ContactResultItem[]>` |

Because every method is optional, the engine never calls a method directly
without first inspecting the adapter's `meta.capabilities`. Adapters declare
their capabilities honestly so the engine can skip unavailable features
gracefully and fall back to lower-tier adapters (or to the manual verification
queue) rather than throwing at runtime. The query types are deliberately
narrow value objects (`SearchQuery`, `BacklinkQuery`, etc.) so that adapters
cannot smuggle in undocumented parameters and so that the call sites remain
auditable.

## 2. AdapterMeta

Every adapter exposes an `AdapterMeta` record that fully describes its
identity, capabilities, limits, cost, retry behavior, provenance, and
confidence. The engine never reads adapter state outside of `meta`, which
makes it possible to display a full data-source inventory to operators
without instantiating any adapter. The fields are:

| Field | Type | Purpose |
| --- | --- | --- |
| `id` | `string` | Stable machine identifier (e.g. `adapter.fixture`). |
| `name` | `string` | Human-readable label. |
| `providerKind` | `AdapterProviderKind` | One of `search`, `seo`, `crawl`, `serp`, `llm`, `contact`, `import`, `internal`. |
| `capabilities` | `AdapterCapabilities` | Nine boolean flags (see below). |
| `rateLimit` | `AdapterRateLimit?` | `requestsPerMinute`, `burst`. |
| `cost` | `AdapterCost` | `perRequest`, `perThousandRows`, `hasFreeTier`. |
| `retry` | `AdapterRetry` | `maxRetries`, `initialBackoffMs`, `jitter`, `retryableOn`. |
| `provenance` | `AdapterProvenance` | `adapter`, `providerKind`, `version`, optional `reference` and `fetchedAt`. |
| `confidence` | `AdapterConfidence` | `dataConfidence` (0..1) plus a `reason` string. |
| `offline` | `boolean` | True for fixture/import adapters that never touch the network. |

Each field matters because it is consumed by a specific subsystem.
`capabilities` lets the engine decide whether a given feature can be served
without attempting the call. `rateLimit` drives scheduler decisions and
prevents accidental quota exhaustion. `cost` enables budget-aware routing so
that low-confidence free data is preferred over paid data when both could
answer the same query. `retry` standardizes backoff behavior across vendors
so transient failures do not propagate as hard errors. `provenance` is
stamped onto every `AdapterResult` so that downstream evidence records can
cite the exact source, version, and fetch timestamp. `confidence` is
propagated into scoring so that opportunities built on low-confidence data
are penalized relative to those built on authoritative data. Finally,
`offline` lets the engine and the test harness skip network mocks entirely
when running in fixture mode.

The `AdapterCapabilities` interface declares nine booleans:
`canSearchBacklinks`, `canSearchBrokenLinks`, `canSearchResourcePages`,
`canSearchMentions`, `canFetchPage`, `canDiscoverContacts`,
`canProvideMetrics`, `canClassify`, and `canDraft`. The first six mirror the
optional `SearchDataAdapter` methods; the last three describe auxiliary
abilities (metrics, LLM classification, LLM drafting) that an adapter may
offer on top of its primary data role. Setting any of these flags to `true`
when the adapter cannot actually deliver on the capability is treated as a
bug, because the engine will route work to the adapter and then fail.

## 3. AdapterResult

Every adapter method returns `AdapterResult<T>`, a thin envelope that pairs
the payload `data` with the metadata required to audit and score it later.
The envelope is intentionally minimal so that adapters do not need to
construct complex reporting structures; they only need to attach provenance,
confidence, and any warnings they accumulated during the call. The shape is:

```ts
interface AdapterResult<T> {
  data: T;
  provenance: AdapterProvenance;
  confidence: AdapterConfidence;
  warnings?: string[];
}
```

The `provenance` field is a copy of (or refinement of) the adapter's
`meta.provenance`, with `fetchedAt` set to the time the call returned. This
ensures that every record flowing through the engine carries its origin with
it, which is required for evidence-chain reconstruction and for the manual
verification queue. The `confidence` field overrides the adapter-level
default on a per-call basis if a particular response is fresher or staler
than usual. The optional `warnings` array carries non-fatal issues such as
partial results, deprecation notices, or upstream throttling. Because
warnings are not exceptions, the engine can continue processing the data
while still surfacing the caveat to operators.

## 4. FixtureAdapter

The `FixtureAdapter` (defined in `src/adapters/fixtures.ts`) is the default
offline adapter. It implements `SearchDataAdapter` against an in-memory
`FixtureDataset`, which may contain arrays of `search`, `backlinks`,
`brokenLinks`, `resourcePages`, and `mentions` records. Each record may
carry an extra match-hint field (e.g. `queryMatch`, `matchDomain`,
`matchPage`, `topicMatch`, `matchTerm`) that the fixture uses to simulate
provider-side filtering. The hint fields are stripped from the returned
items so callers only see the public result shape.

The fixture's `FIXTURE_ADAPTER_META` declares `id: "adapter.fixture"`,
`providerKind: "import"`, `offline: true`, confidence `1.0` (because
fixtures are deterministic and reproducible), cost `0` across all units, and
a rate limit of 99999/minute (effectively unlimited). Capabilities cover the
five search-style methods but explicitly disable `canFetchPage`,
`canDiscoverContacts`, `canProvideMetrics`, `canClassify`, and `canDraft`,
because the fixture has no page-fetching, contact-discovery, or AI role.
Every result is wrapped with a `warnings: ["offline-fixture"]` entry so
downstream consumers can distinguish fixture-derived data from live data
even when both flow through the same composite.

The fixture is used in two modes. First, as the test-bed adapter: the test
suite in `tests/adapters.test.ts` constructs a `FixtureAdapter` with a known
dataset and asserts exact match counts. Second, as the default data source
when no paid APIs are configured: `buildDataStack` always pushes a
`FixtureAdapter` as the first element of the composite, guaranteeing that
the engine has at least one source of truth even in a freshly cloned
repository with no API keys.

## 5. CompositeAdapter

The `CompositeAdapter` (also in `src/adapters/fixtures.ts`) merges multiple
`SearchDataAdapter` instances into a single adapter that fans each query out
to every child and merges the results. The constructor requires at least one
adapter and throws `Error("CompositeAdapter requires at least one adapter")`
otherwise. Its `meta` is synthesized: `id` is `adapter.composite`, `name`
lists all child names joined with ` + `, `offline` is true only if every
child is offline, and `confidence.dataConfidence` is
`Math.max(...children's confidence)` so the composite reports the strongest
source available.

The private `merge` helper iterates children in order, awaits each call, and
concatenates successful results. Three behaviors distinguish it from a naive
`Promise.all`-style fan-out. First, it takes the highest confidence value
across children, and adopts the provenance of the child that produced that
value (so the merged result still cites a real source). Second, it captures
per-child exceptions and records them in the `warnings` array using the
format `${adapter.meta.id}: ${error.message}` rather than rethrowing; this
means a failing premium adapter never breaks a query that the fixture
adapter alone could answer. Third, the merged `confidence.reason` is set to
`"Merged from ${n} adapters."` so downstream consumers can see that the
result was a blend.

The composite implements `search`, `searchBacklinks`,
`searchBrokenLinks`, `searchResourcePages`, and `searchMentions` but not
`fetchPage` or `discoverContacts`; those methods are left undefined on the
composite because they return single snapshots rather than arrays and the
merge semantics would be ambiguous. The test suite verifies that the
composite takes the highest confidence, throws on empty input, and captures
`AdapterError` instances as warnings while still returning data from the
healthy child.

## 6. Provider Stubs

`src/adapters/providers.ts` defines five stub `AdapterMeta` records that
describe the contract concrete vendor adapters must satisfy. None of these
are wired to a real API; they exist to document the capability surface,
default confidence, and cost envelope each vendor class is expected to
expose. A `makeMeta` helper supplies a common retry policy (`maxRetries: 3`,
`initialBackoffMs: 500`, `jitter: 0.2`, `retryableOn: [429, 500, 502, 503,
504, "network"]`) and a common rate limit (`60 rpm`, `10 burst`). The five
stubs are:

| Stub meta | providerKind | Capabilities (true) | Cost | Confidence |
| --- | --- | --- | --- | --- |
| `SEARCH_ADAPTER_STUB_META` | `search` | `canSearchResourcePages`, `canSearchMentions` | free (`perRequest: 0`, `hasFreeTier: true`) | 0.5 |
| `SEO_ADAPTER_STUB_META` | `seo` | `canSearchBacklinks`, `canSearchBrokenLinks`, `canProvideMetrics` | paid (`perRequest: 5`, `perThousandRows: 50`, `hasFreeTier: false`) | 0.8 |
| `CRAWL_ADAPTER_STUB_META` | `crawl` | `canSearchBrokenLinks`, `canFetchPage` | cheap (`perRequest: 1`, `perThousandRows: 10`, `hasFreeTier: true`) | 0.9 |
| `LLM_ADAPTER_STUB_META` | `llm` | `canClassify`, `canDraft` | free (`perRequest: 0`, `hasFreeTier: true`) | 0.6 |
| `CONTACT_ADAPTER_STUB_META` | `contact` | `canDiscoverContacts` | paid (`perRequest: 10`, `perThousandRows: 100`, `hasFreeTier: false`) | 0.7 |

The stubs are deliberately opinionated. The `SEARCH` stub covers resource
page and mention discovery (typical free SERP use cases) but not backlink
lookup, because free search APIs cannot return link graphs. The `SEO` stub
is the only one with `canProvideMetrics`, since authority and trust scores
are the primary value of paid SEO tools. The `CRAWL` stub has the highest
confidence (0.9) because first-party crawls are the freshest possible
signal, with a `reason` of `"First-party crawl data is the freshest possible
signal."`. The `LLM` stub declares `canClassify` and `canDraft` but caps
confidence at 0.6 with the reason `"LLM output must be reviewed; never
auto-applied as fact."`, enforcing the policy that AI output is always
treated as `INFERRED`. The `CONTACT` stub is paid (contact data is
commercially scraped) and carries confidence 0.7 with the reason `"Contact
data must be verified before outreach."`.

`providers.ts` also exports an abstract `BaseSearchAdapter` class that
concrete search adapters can extend; it requires only that the subclass
declare `meta` and implement `search`. The `makeMeta` helper is re-exported
as `makeAdapterMeta` so that downstream adapter authors can construct
custom metas with the same retry defaults.

## 7. How to Add a New Provider

Adding a new provider is a five-step process. First, implement the
`SearchDataAdapter` interface (or extend `BaseSearchAdapter`) in a new file
under `src/adapters/`. Second, declare the `meta.capabilities` booleans
honestly: setting a flag the adapter cannot fulfill will cause the engine
to route queries to it and then fail at runtime. Third, populate the
`cost` block with the vendor's actual pricing so budget-aware routing can
prefer free data when both could answer a query. Fourth, set
`confidence.dataConfidence` based on data quality (fixtures = 1.0,
first-party crawls = 0.9, paid SEO = 0.8, contact data = 0.7, LLM = 0.6,
free SERP = 0.5, no-op = 0.0) and write a one-sentence `reason` explaining
the number. Fifth, register the adapter with the engine via
`CompositeAdapter` (for ad-hoc composition) or via `buildDataStack` (for
tiered composition with the free/low-cost/premium discipline).

A typical skeleton looks like:

```ts
import { SearchDataAdapter, AdapterResult, SearchResultItem } from "./adapter.js";
import { makeAdapterMeta } from "./providers.js";

export class MySearchAdapter implements SearchDataAdapter {
  readonly meta = makeAdapterMeta(
    "adapter.search.mine",
    "My Search Adapter",
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
    { dataConfidence: 0.55, reason: "Free-tier results with variable freshness." },
    false
  );

  async search(q) {
    const data: SearchResultItem[] = await callVendor(q);
    return { data, provenance: { ...this.meta.provenance, fetchedAt: Date.now() }, confidence: this.meta.confidence };
  }
}
```

For the tiered path, pass the new adapter as `freeSearchAdapter` or
`premiumSeoAdapter` to `buildDataStack`. For the manual path, construct a
`CompositeAdapter([fixtureAdapter, myAdapter])` directly. In both cases the
engine treats the new adapter uniformly: it inspects `meta.capabilities`
before every call and records the adapter's `provenance` and `confidence`
on every result.

## 8. AdapterError Handling

`AdapterError` is the standard error type that adapters are expected to
throw when they cannot produce a result. It is defined in
`src/adapters/adapter.ts` and extends `Error` with three additional fields:
`adapter` (the source adapter id), `kind` (one of `"network"`, `"auth"`,
`"rate_limit"`, `"data"`, `"config"`, `"unknown"`), and `retryable`
(boolean). The original error, if any, is preserved on the `cause`
property. The `name` is set to `"AdapterError"` so callers can distinguish
it from generic `Error` instances.

The `kind` taxonomy is consumed by retry logic and by the
`CompositeAdapter`. Network errors and rate-limit errors are typically
retryable; auth, config, and data errors typically are not. The
`retryableOn` array on `AdapterRetry` uses the same vocabulary (HTTP
status codes plus the string `"network"`) so the retry layer can match
either numeric status codes or symbolic kinds. The `CompositeAdapter`
catches every per-child exception and converts it into a warning string of
the form `${adapter.meta.id}: ${message}`, which means an `AdapterError`
thrown by a paid adapter never aborts a query that the fixture adapter can
answer. The test suite explicitly verifies this behavior by registering a
failing adapter that throws `new AdapterError("boom", "test", "network",
true)` alongside a healthy `FixtureAdapter` and asserting that the
composite returns data plus a `warnings` entry containing `"boom"`.

## 9. AI Adapter Boundary

The AI adapter layer (`src/ai/boundary.ts`) is a parallel contract to
`SearchDataAdapter`, scoped specifically to language-model operations.
The `AiAdapter` interface exposes three optional methods: `classify`,
`draft`, and `explainRelevance`. `classify` takes a text and candidate
labels and returns a label plus a 0..1 confidence plus up to three
alternative labels. `draft` takes one of four task kinds
(`outreach_subject`, `outreach_body`, `content_gap_summary`,
`opportunity_cluster_label`) plus a context object and optional
constraints (maxLength, tone, variants) and returns one or more draft
variants; every draft is stamped with `verification: "INFERRED"` so that
downstream code can never treat LLM output as verified fact.
`explainRelevance` takes a target topic, a candidate topic, and optional
shared keywords, and returns a similarity score plus a human-readable
reason.

`NoOpAiAdapter` is the deterministic fallback. It declares `id: "ai.noop"`,
`providerKind: "internal"`, `offline: true`, and
`confidence.dataConfidence: 0.0` with the reason `"No-op AI adapter;
deterministic fallbacks only."`. Its `classify` picks the candidate label
with the most token overlap with the input text, its `draft` produces a
templated body based on the task kind, and its `explainRelevance` computes
a Jaccard similarity over the tokenized topic strings. These heuristics
ensure that the engine can produce structured, deterministic output even
when no LLM is configured, which is critical for the free tier.

`ResilientAiAdapter` wraps any `AiAdapter` and never throws. Each method
delegates to the inner adapter inside a `try/catch`; on any exception (or
when the inner adapter omits the method entirely), it falls back to the
corresponding `NoOpAiAdapter` method. The wrapper's `meta` getter returns
the inner adapter's `meta` so that downstream code sees the configured
provider, not the resilient wrapper. `buildDataStack` always wraps the
chosen AI adapter in a `ResilientAiAdapter`, so the rest of the engine
never needs to handle AI failures explicitly: it always receives a
structurally valid result, possibly with confidence 0 and provenance
`noop`.
