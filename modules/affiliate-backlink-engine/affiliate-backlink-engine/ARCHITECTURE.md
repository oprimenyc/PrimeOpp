# ARCHITECTURE

This document describes the system architecture of `affiliate-backlink-engine`: its scope, module boundaries, pipeline flow, data contracts, provider model, determinism boundaries, and isolation guarantees. It is intended for engineers integrating the engine into a larger SEO/affiliate ecosystem as well as for internal maintainers who need a stable reference for how the pieces fit together.

---

## 1. Architectural Position

`affiliate-backlink-engine` is a focused, library-shaped engine that performs **backlink intelligence, opportunity scoring, evidence assembly, campaign planning, and structured output generation**. It is deliberately narrow: it does one job end-to-end (turn a target property and a set of inputs into a prioritized, evidence-backed, campaign-ready set of backlink opportunities) and refuses to absorb responsibilities that belong to neighboring canonical products in the ecosystem.

This engine is **not** an executive orchestrator. PrimeOS holds that role: it decides which work to run, in what order, against which properties, and how to allocate ecosystem resources. The engine exposes deterministic, composable building blocks (inventory, discovery, scoring, outreach, campaigns) that PrimeOS or any other orchestrator may call, but it does not itself decide strategic sequencing, cross-product prioritization, or human-approval routing.

This engine is **not** a generic AI platform. AI is treated as an optional, bounded assistance layer (`src/ai/boundary.ts`) used only for topical classification, relevance explanation, outreach drafting, content-gap summarization, and opportunity clustering. Every AI output is marked `INFERRED`, carries an explicit confidence value, and is funneled through `NoOpAiAdapter` or `ResilientAiAdapter` so the engine keeps working deterministically when no LLM is configured. AI never writes state, never asserts verification, and never promotes an opportunity to `LINK_ACQUIRED`.

This engine is **not** a browser automation platform. Foundry owns live crawling, rendering, and interaction with remote pages. The engine reaches external sources only through the `SearchDataAdapter` contract (see `src/adapters/adapter.ts`) and the `PageFetchQuery`/`PageSnapshot` shapes, which a Foundry-backed adapter may implement. The engine itself ships no headless browser, no JS execution, and no credentialled login flows.

This engine is **not** a content generator. AMOS owns long-form content authoring. The engine produces structured **content requirements** — page IDs that need refresh, archetype suggestions, content-gap summaries, internal-link suggestions — but it does not draft the content itself. The `content/` module matches existing assets to opportunities and prioritizes refresh work; it does not write the refreshed copy.

This engine is **not** a verifier. E.V.E. owns independent verification of acquired links, contact correctness, and outcome claims. The engine produces `EvidenceRecord`s that record what was observed during discovery and analysis, and it requires an `acquired_link_observation` evidence kind before a campaign may transition to `LINK_ACQUIRED` — but it does not perform the independent verification step itself. The engine treats verification as a contract boundary, not a capability.

In short: the engine reasons about *what opportunities exist, why they matter, and how to act on them in a structured way*, then hands off execution (orchestration, crawling, content authoring, independent verification) to its neighbors via documented contracts.

---

## 2. Module Map

The engine is organized as a single TypeScript package rooted at `src/`. The top-level barrel (`src/index.ts`) re-exports every module so external consumers can `import { ... } from "affiliate-backlink-engine"` without traversing internal paths. Each directory under `src/` owns a single responsibility and exposes a small, stable public API.

| Directory | Responsibility | Key Public API |
|-----------|----------------|----------------|
| `src/domain/` | Canonical, framework-agnostic domain entities and value objects. Pure types plus a handful of pure functions (ID generation, evidence hashing, score clamping, lifecycle transition checks). No I/O, no side effects, no adapter calls. | `SiteProfile`, `TargetDomain`, `TargetPage`, `ContentAsset`, `Competitor`, `LinkingDomain`, `LinkingPage`, `BacklinkSource`, `LinkOpportunity` union, `OutreachProspect`, `OutreachBrief`, `Campaign`, `CampaignAction`, `EvidenceRecord`, `EvidenceContract`, `VerificationStatus`, `OpportunityScore`, `RiskFlag`, `TopicalRelevance`, `CommercialRelevance`, `AudienceAlignment`, plus `deterministicId`, `makeEvidence`, `canTransition`, `assertTransition`. |
| `src/adapters/` | Provider-agnostic adapter contracts and the offline default implementation. Defines `SearchDataAdapter`, `AdapterMeta`, all query/result shapes, `AdapterError`, and ships `FixtureAdapter` (offline, deterministic) and `CompositeAdapter` (fan-out + merge). Also exposes provider stub metadata for search, SEO, crawl, LLM, and contact adapters. | `SearchDataAdapter`, `AdapterMeta`, `AdapterResult<T>`, `FixtureAdapter`, `CompositeAdapter`, `FIXTURE_ADAPTER_META`, `BaseSearchAdapter`, `SEARCH_ADAPTER_STUB_META` / `SEO_ADAPTER_STUB_META` / `CRAWL_ADAPTER_STUB_META` / `LLM_ADAPTER_STUB_META` / `CONTACT_ADAPTER_STUB_META`. |
| `src/ai/` | AI assistance boundary. Defines the `AiAdapter` interface, the `NoOpAiAdapter` deterministic fallback, and the `ResilientAiAdapter` never-throws wrapper. Restricts AI use to classification, drafting, and relevance explanation; every output is `INFERRED`. | `AiAdapter`, `AiClassificationRequest`/`Result`, `AiDraftRequest`/`Result`, `AiRelevanceExplainRequest`/`Result`, `NoOpAiAdapter`, `ResilientAiAdapter`. |
| `src/inventory/` | Site inventory builder. Ingests sitemap XML, CSV, JSON, or manual input and produces `TargetDomain`, `TargetPage`, and `ContentAsset` records with normalized canonical URLs and `IndexabilityState`. | `buildSiteInventory(...)` and supporting ingestion helpers exported from `src/inventory/site-inventory.ts`. |
| `src/discovery/` | Provider-agnostic backlink opportunity discovery. Calls `SearchDataAdapter` methods (backlinks, broken links, resource pages, mentions) and normalizes raw results into `LinkOpportunity` records with deduplication keys, evidence IDs, and verification status. | `src/discovery/discovery.ts` — discovery entry points that emit `LinkOpportunity[]` paired with `EvidenceRecord[]`. |
| `src/competitors/` | Competitor backlink gap analysis. Given a `Competitor[]` and a backlink adapter, computes which linking domains/pages already link to competitors but not to the target, and produces `CompetitorGapOpportunity` records including `competitorOverlap` and a `replicable` judgment. | `src/competitors/gap-analyzer.ts`. |
| `src/broken-links/` | Broken-link opportunity finder with replacement matching. Scans pages (via crawl/SEO adapter) for outbound links that no longer resolve, then matches each broken destination against the target's `ContentAsset` inventory to suggest a replacement (or flag `contentUpdateRequired`). | `src/broken-links/finder.ts`. |
| `src/resource-pages/` | Resource-page finder and classifier. Discovers pages that function as curated resource lists and assigns a `classification` (industry, educational, product guide, directory, etc.) plus an `acceptsSubmissionsInferred` flag. | `src/resource-pages/finder.ts`. |
| `src/scoring/` | Transparent scoring engine. Computes `OpportunityScore` from weighted `ScoreComponent[]`, applies risk adjustments, and emits a `ScoreRecommendedAction` (`PURSUE_NOW`, `PURSUE_AFTER_REFRESH`, `PURSUE_WITH_CAUTION`, `DEFER`, `REJECT`, `NEEDS_EVIDENCE`). | `src/scoring/engine.ts`, `clampScore`, `summarizeScore`. |
| `src/risk/` | Risk and quality filtering. Produces `RiskFlag[]` against the `RiskSignalKind` taxonomy, computes the worst-case `RiskLevel` (LOW / MEDIUM / HIGH / REJECT), and decides suppression from outreach. | `src/risk/filter.ts`, `worstRisk`, `isRejected`, `shouldSuppressFromOutreach`. |
| `src/content/` | Content-asset matcher and refresh prioritizer. Matches opportunities to existing `ContentAsset`s, decides whether existing content is suitable as a replacement or refresh target, and prioritizes refresh work by opportunity score and impact. | `src/content/matcher.ts`, `src/content/refresh.ts`. |
| `src/internal-links/` | Internal link optimizer. Analyzes the target's own page graph for orphan pages, weak internal links, and excessive depth, and emits `InternalLinkOpportunity` records with `suggestedAnchor` and `contextualReason`. | `src/internal-links/optimizer.ts`. |
| `src/outreach/` | Outreach personalization and contact discovery. Builds `ContactCandidate`s from adapter results, applies do-not-contact rules, and produces `OutreachBrief`s with the fact/inference/unknown split and draft variants. | `src/outreach/contact.ts`, `src/outreach/personalization.ts`. |
| `src/campaigns/` | Campaign planner and lifecycle tracker. Groups opportunities into `Campaign`s by `CampaignType`, attaches content work and outreach angle, and tracks `CampaignAction` history against the deterministic state machine defined in `src/domain/campaign.ts`. | `src/campaigns/planner.ts`, `src/campaigns/tracker.ts`. |
| `src/cli/` | Full command-line interface. Exposes subcommands for site import, inventory, discovery, scoring, campaigns, and outreach so the engine can be operated without writing code. | `src/cli/index.ts`. |
| `src/utils/` | Shared utilities: URL normalization, validation, structured logging. Pure functions, no domain semantics. | `src/utils/url.ts`, `src/utils/validation.ts`, `src/utils/logging.ts`. |

---

## 3. Pipeline Flow

The canonical pipeline is the spine of the engine. Every example workflow (`npm run example:panticandy`, `example:vital`, `example:generic`) and every CLI invocation traces this same sequence; only the inputs and adapter configuration differ. The pipeline is intentionally linear so that each stage's outputs are the next stage's inputs and so that an operator can resume from any intermediate artifact.

```
Target site/domain
  -> site/content inventory
  -> topical map
  -> competitor set
  -> backlink opportunity discovery
  -> opportunity normalization
  -> evidence collection
  -> scoring
  -> strategy classification
  -> content-gap/content-refresh requirements
  -> outreach brief
  -> campaign queue
  -> tracking and outcome state
```

The pipeline begins with a **target site/domain**: a `SiteProfile` (brand, root domain, declared topics, commercial intent, preferred outreach tone) plus one or more `TargetDomain` records. The `inventory/` module ingests sitemap XML, CSV, JSON, or manual input and produces a normalized set of `TargetPage` records (with canonical URLs, content type, indexability, priority) and `ContentAsset` records (with archetype, topical and commercial relevance, and a `suitableAsReplacement` flag for broken-link substitution). This inventory is the foundation: every downstream stage references page IDs and asset IDs that originate here.

From the inventory, the engine derives a **topical map** — the set of declared and inferred topics that anchor relevance scoring — and a **competitor set** of `Competitor` records (each with a `relationship` of `direct`, `aspirational`, or `adjacent`). The competitor set drives the gap analyzer, which calls `searchBacklinks` per competitor and intersects the results against the target's existing backlinks to surface `CompetitorGapOpportunity` records. In parallel, the `broken-links/`, `resource-pages/`, and `discovery/` modules run their respective adapter queries to emit `BrokenLinkOpportunity`, `ResourcePageOpportunity`, `MentionWithoutLinkOpportunity`, `LinkableAssetOpportunity`, and `InternalLinkOpportunity` records.

The **opportunity normalization** stage then enforces the contract that every opportunity carries a `dedupKey`, a `VerificationStatus`, an `evidenceIds` array, and the relevance/risk/score fields needed downstream. **Evidence collection** records an `EvidenceRecord` (via the `EvidenceContract`) for each observed fact that backs an opportunity — page observations, link observations, broken-link observations, competitor-backlink observations, mention observations, and so on. **Scoring** computes a transparent `OpportunityScore` from weighted components, applies risk adjustments, and emits a recommended action. **Strategy classification** then groups scored opportunities into campaign-ready clusters and tags each with the content work it implies: a `content_refresh_first` campaign, a `broken_link` campaign, a `competitor_gap` campaign, and so on.

The **content-gap/content-refresh requirements** stage produces explicit content work descriptors (`pageIds` to refresh or create, archetype suggestions, replacement suitability). The **outreach brief** stage produces `OutreachProspect` + `OutreachBrief` pairs that distinguish facts, inferences, and unknowns, attach do-not-contact flags, and include draft variants (labeled as drafts, never as final copy). Finally, the **campaign queue** stage bundles opportunities, prospects, and content work into `Campaign` records in the `DISCOVERED` state, and the **tracking and outcome state** stage advances campaigns through the 14-state lifecycle (`CampaignLifecycleState`), recording every transition as a `CampaignAction` and refusing to mark a campaign `LINK_ACQUIRED` without an `acquired_link_observation` evidence record.

---

## 4. Data Flow + Boundary Contracts

All external data enters the engine through three documented contracts: the `SearchDataAdapter` interface (for backlinks, broken links, resource pages, mentions, page fetches, and contacts), the `AiAdapter` interface (for classification, drafting, and relevance explanation), and the `EvidenceContract` (for recording and querying evidence records). These contracts are the only sanctioned seams between the engine and the outside world; nothing inside the engine imports a vendor SDK or calls `fetch` directly.

The `SearchDataAdapter` interface (defined in `src/adapters/adapter.ts`) declares a `meta: AdapterMeta` plus a set of optional methods (`search`, `searchBacklinks`, `searchBrokenLinks`, `searchResourcePages`, `searchMentions`, `fetchPage`, `discoverContacts`). Each method takes a typed query (`SearchQuery`, `BacklinkQuery`, `BrokenLinkQuery`, `ResourcePageQuery`, `MentionQuery`, `PageFetchQuery`, `ContactQuery`) and returns an `AdapterResult<T>` that bundles the data, provenance (`AdapterProvenance`), confidence (`AdapterConfidence`), and optional warnings. The `AdapterMeta` carries capabilities, rate limits, cost, retry semantics, provenance, and confidence — so every adapter is self-describing and the engine can reason about which adapter to call for which query.

The `AiAdapter` interface (defined in `src/ai/boundary.ts`) is similarly narrow: it declares `meta: AdapterMeta` plus optional `classify`, `draft`, and `explainRelevance` methods. Every AI result is explicitly typed (`AiClassificationResult`, `AiDraftResult`, `AiRelevanceExplainResult`) and carries a confidence value plus an `inferredAt` timestamp. The `AiDraftResult` always sets `verification: "INFERRED"` — the engine never promotes an AI draft to `VERIFIED` status. The `ResilientAiAdapter` wraps any inner `AiAdapter` and falls back to `NoOpAiAdapter` on exception, so a misbehaving LLM provider can never crash the pipeline.

The `EvidenceContract` (defined in `src/domain/evidence.ts`) is the backbone of the engine's accountability model. It exposes four methods: `record(e)` to persist an `EvidenceRecord`, `for(subjectId)` to retrieve all evidence for a subject, `latest(subjectId, kind?)` to fetch the most recent record of a given kind, and `all()` for bulk access. The in-memory `InMemoryEvidenceStore` is the reference implementation; production deployments may substitute a durable store as long as they implement the same interface.

The non-negotiable rule is that **every actionable claim must be backed by at least one `EvidenceRecord`**. An `EvidenceRecord` records what was observed (`claim`), where (`source.reference`), when (`observedAt`), how (`source.adapter` and `source.providerKind`), the verification status at observation time, and an optional sanitized `payload` with a `payloadHash` for tamper detection. Opportunities reference evidence via `evidenceIds`; outreach briefs reference evidence via `evidenceIds`; risk flags may reference evidence via `evidenceId`; and the `LINK_ACQUIRED` campaign state specifically requires an `acquired_link_observation` evidence record (see `REQUIRES_EVIDENCE_FOR` in `src/domain/campaign.ts`). The engine will not invent a claim it cannot cite.

---

## 5. Provider-Agnostic Principle

The engine is provider-agnostic by construction. It ships with no hardwired dependency on Ahrefs, SEMrush, SerpApi, OpenAI, Anthropic, or any other vendor. The only adapter that the engine assumes exists is `FixtureAdapter`, which is offline, deterministic, and exercises the full pipeline from fixture datasets. This guarantee means the engine can be installed, tested, demoed, and operated end-to-end with zero paid APIs and zero network access.

`FixtureAdapter` (in `src/adapters/fixtures.ts`) implements `SearchDataAdapter` against an in-memory `FixtureDataset` of search results, backlinks, broken links, resource pages, and mentions. Its `meta` declares `providerKind: "import"`, `offline: true`, and `dataConfidence: 1.0` with the reason "Deterministic fixture data, fully reproducible." Because the dataset is in memory and the queries are pure string matching, every run against the same fixture produces the same outputs — which is why all three example workflows and the entire test suite (124 tests across 18 files) run without network access.

`CompositeAdapter` (also in `src/adapters/fixtures.ts`) lets operators combine multiple adapters without writing glue code. Its constructor takes an array of `SearchDataAdapter` instances, fans each query out to every adapter that supports the corresponding method, and merges the results. The merge takes the union of all `data` arrays, collects `warnings` from any adapter that threw, and adopts the **maximum** `dataConfidence` among contributing adapters as the composite confidence, while preserving the provenance of the highest-confidence contributor. This lets an operator run a free fixture/import adapter alongside a paid SEO adapter: when the paid adapter returns data, its higher confidence and provenance win; when it does not (rate-limited, unconfigured, erroring), the fixture adapter keeps the pipeline moving.

The `free-low-cost.ts` module formalizes this further by declaring three data tiers (`free_local`, `low_cost_api`, `premium_provider`) and enumerating what each tier can lawfully do. The engine never assumes a premium tier is available; it always degrades gracefully to the free/local tier. Concrete adapters for paid providers are added later by implementing `SearchDataAdapter` or `AiAdapter`; no engine code changes are required.

---

## 6. Determinism Boundaries

The engine draws a hard line between deterministic logic and AI-assisted logic. This boundary is documented in `src/ai/boundary.ts` and enforced structurally: every AI output is typed as `INFERRED`, and every state-affecting operation routes through pure functions in `src/domain/`. The goal is that two runs of the engine against the same inputs (same fixtures, same adapter responses, same AI responses) produce the same outputs — and that an operator can audit any output back to its evidence and its deterministic computation.

The following are **deterministic** and never delegated to AI:

- **ID generation** — `deterministicId`, `slugId`, and `ephemeralId` in `src/domain/ids.ts` produce prefixed, hash-based IDs. Deterministic IDs are required for deduplication and reproducibility.
- **State transitions** — the campaign lifecycle is enforced by `ALLOWED_TRANSITIONS`, `canTransition`, `assertTransition`, and `isTerminal` in `src/domain/campaign.ts`. Anything not in the transition table is forbidden and throws.
- **Score arithmetic** — `clampScore` and the weighted-sum computation in `src/scoring/engine.ts` are pure math. Provider metrics may feed a component, but the aggregation is deterministic.
- **Deduplication** — `dedupKeyFor(kind, parts)` produces a canonical `dedupKey` for every opportunity kind, and the engine collapses duplicates by this key.
- **Evidence provenance** — `makeEvidence` assigns deterministic IDs to evidence records, and `canonicalPayloadHash` produces a stable FNV-style hash of the sanitized payload for tamper detection.
- **Validation** — `src/utils/validation.ts` and `assertValidId` enforce structural rules. Invalid inputs are rejected, not silently coerced.
- **Campaign status** — `isTerminal`, `isRejected`, `shouldSuppressFromOutreach`, and the `REQUIRES_EVIDENCE_FOR` map are pure checks. The engine never auto-advances a campaign to `LINK_ACQUIRED`; the verifier must produce evidence first.

The following **may use AI**, always through the `AiAdapter` interface, always marked `INFERRED`, and always with a confidence value:

- **Topical classification** — assigning a topic label to a page or asset via `AiAdapter.classify`.
- **Relevance explanation** — producing the human-readable `reason` and `similarity` for a `TopicalRelevance` via `AiAdapter.explainRelevance`.
- **Outreach drafting** — producing draft subject lines and bodies via `AiAdapter.draft` with `task: "outreach_subject" | "outreach_body"`. Drafts are labeled as drafts and never as final copy.
- **Content-gap summarization** — producing a content-gap summary via `AiAdapter.draft` with `task: "content_gap_summary"`.
- **Opportunity clustering** — producing cluster labels via `AiAdapter.draft` with `task: "opportunity_cluster_label"`.

When no `AiAdapter` is configured, `NoOpAiAdapter` supplies deterministic fallbacks (keyword-overlap classification, Jaccard similarity, templated drafts) so the engine continues to function. When an AI adapter throws, `ResilientAiAdapter` catches the exception and falls back to `NoOpAiAdapter`. Under no circumstances does an AI failure propagate as an uncaught exception in the pipeline.

---

## 7. Isolation Guarantees

This workspace is strictly isolated from the other canonical products in the ecosystem: PantiCandy, AMOS, PrimeOS, Foundry, and E.V.E. The engine imports nothing from those repositories, references no internal package names from them, and assumes no shared runtime state with them. Integration with those products happens exclusively through the documented contracts described above — `SearchDataAdapter`, `AiAdapter`, `EvidenceContract`, and the exported domain types — and through the dedicated integration-contract documents (`PRIMEOS_INTEGRATION_CONTRACT.md`, `AMOS_INTEGRATION_CONTRACT.md`, `EVE_VERIFICATION_CONTRACT.md`, `INTEGRATION_HANDOFF.md`).

The isolation is enforced structurally. The `src/` tree contains no `import` statements that reference sibling product packages; every external dependency is either a published npm package or an internal module of this engine. The `package.json` declares only the runtime and dev dependencies needed by the engine itself. The README's "Non-Negotiable Rules" section codifies the boundaries: the engine does not bypass robots or access controls, does not scrape behind authentication, does not auto-send outreach, does not fabricate metrics or competitor backlinks, does not claim a backlink exists without evidence, and does not hardcode any single SEO, search, or LLM provider.

The benefit of this isolation is that the engine can be developed, tested, audited, and versioned independently of its consumers. PrimeOS may invoke the engine to enrich a workflow; AMOS may consume the engine's content-gap outputs; Foundry may implement a `SearchDataAdapter` that satisfies the engine's crawl needs; E.V.E. may produce the `acquired_link_observation` evidence that promotes a campaign to `LINK_ACQUIRED`. None of those integrations require this engine to know about them — they require only that the contract be honored. An independent audit of this engine can therefore certify its behavior without coordinating with the other repositories.
