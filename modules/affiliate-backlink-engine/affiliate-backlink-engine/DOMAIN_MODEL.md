# DOMAIN MODEL

This document is the canonical reference for every entity defined in `src/domain/`. Each entity is a TypeScript interface or type exported from the domain barrel (`src/domain/index.ts`), and every field described here matches the actual codebase. The domain layer is pure: no I/O, no side effects, no adapter calls. It contains types, a handful of pure functions (ID generation, evidence hashing, score clamping, lifecycle transition checks), and the in-memory `InMemoryEvidenceStore` reference implementation of `EvidenceContract`.

Entities are grouped by concern: site and content inventory, competitors, backlink sources, opportunities, outreach, campaigns, evidence, verification, scoring, risk, and relevance. Every entity carries either an explicit `VerificationStatus` or an indirect path to one (via attached evidence), and every actionable entity carries `evidenceIds` so its claims can be audited.

---

## 1. Site and Content Inventory

### SiteProfile

`SiteProfile` is the root identity record for a property the engine is working on behalf of. It is the entity that every other entity hangs off via `siteProfileId`. It carries `id`, `name` (brand), `rootDomain` (e.g. `"panticandy.com"`), `topics` (declared topic labels used to anchor topical relevance scoring), an optional `commercialIntent` of `transactional | commercial_investigation | informational | navigational | unknown`, an optional `preferredOutreachTone` of `formal | friendly | concise` that downstream outreach briefs SHOULD honor, optional `notes`, and `createdAt`. The `SiteProfile` does not itself carry pages or assets; those are separate entities that reference back to it. Because it is the root, its ID is the join key for the entire opportunity graph for a property.

```ts
export interface SiteProfile {
  id: string;
  name: string;
  rootDomain: string;
  topics: string[];
  commercialIntent?: CommercialIntent;
  preferredOutreachTone?: "formal" | "friendly" | "concise";
  notes?: string;
  createdAt: number;
}
```

### TargetDomain

`TargetDomain` represents a domain owned by the `SiteProfile` (most properties have one, but the model permits multiple). It carries `id`, `siteProfileId`, `domain`, a `verification: VerificationStatus`, and an optional `metrics` object with `authority` and `estimatedTraffic` — each supplied as `{ value: number; source: string }` so that any third-party metric is always labeled by its source and never presented as ground truth. It also carries `verifiedAt`, `notes`. The metrics block is explicitly optional: the engine MUST function with no provider metrics at all, and provider metrics MUST NOT be the sole driver of any score. A `TargetDomain` in `DISCOVERED` state has been declared but not yet re-checked against a live source.

### TargetPage

`TargetPage` is a normalized page on a `TargetDomain`. It carries `id`, `siteProfileId`, `url`, `canonicalUrl` (normalized, equal to `url` if no canonical is declared), optional `title`, a `contentType` drawn from the `ContentType` union (`article | guide | review | comparison | listicle | calculator | glossary | statistics | dataset | landing | category | product | about | contact | legal | homepage | other`), an optional `topic`, optional `commercialIntent`, optional `targetKeyword`, optional `productOrCategory`, optional `lastModified`, an `indexability` of `indexable | noindex | blocked_robots | canonicalized | unknown`, a `priority` in 0..100, a `verification`, optional `verifiedAt`, and a free-form `attributes` map for import-supplied fields. `TargetPage` is the entity that opportunities point at via `targetPageId`.

### ContentAsset

`ContentAsset` represents a piece of content on the target property that could serve as a linkable asset or as a replacement target for broken links. It carries `id`, `siteProfileId`, an optional `pageId` (linking it back to a `TargetPage`), `url`, optional `title`, a `contentType`, and an optional `archetype` drawn from `original_research | calculator | comparison_guide | glossary | statistics_page | definitive_resource | visual_explainer | checklist | public_tool | useful_dataset | expert_commentary | guide | review | other`. It also carries optional `topical` (`TopicalRelevance`) and `commercial` (`CommercialRelevance`) dimensions, an optional `lastUpdated` timestamp, a `suitableAsReplacement` boolean used by the broken-link matcher, and a free-form `attributes` map. The `archetype` field is what the `LinkableAssetOpportunity` references when it suggests a new asset to build.

---

## 2. Competitor

`Competitor` represents a domain that competes with the target property for search visibility or backlinks. It carries `id`, `siteProfileId`, `domain`, an optional `name`, a `verification: VerificationStatus`, an optional `relationship` of `"direct" | "aspirational" | "adjacent"`, optional `verifiedAt`, and optional `notes`. A `direct` competitor overlaps the target commercially; an `aspirational` competitor is one the target wants to emulate; an `adjacent` competitor is topically near but not commercially overlapping. Competitors are the input to the gap analyzer, which calls `searchBacklinks` for each competitor domain and computes which linking sources link to competitors but not to the target. The `verification` field matters because a competitor whose domain cannot be resolved (status `UNAVAILABLE` or `BLOCKED`) cannot be gap-analyzed, and the engine must record that fact rather than silently omitting the competitor.

```ts
export interface Competitor {
  id: string;
  siteProfileId: string;
  domain: string;
  name?: string;
  verification: VerificationStatus;
  relationship?: "direct" | "aspirational" | "adjacent";
  verifiedAt?: number;
  notes?: string;
}
```

---

## 3. Backlink Entities

### LinkingDomain

`LinkingDomain` represents an external domain that hosts (or could host) a backlink to the target. It carries `id`, `domain`, a `verification: VerificationStatus`, an optional `metrics` block (with `authority`, `estimatedTraffic`, and `spamScore` — each `{ value: number; source: string }`), optional `verifiedAt`, an optional `topical: TopicalRelevance`, and an optional `riskFlags: RiskFlag[]` array. Every metric is labeled by `source` so the engine never presents a proprietary "domain authority" number as an objective fact. Risk flags at the domain level propagate to opportunities discovered on pages under that domain.

### LinkingPage

`LinkingPage` is a specific page on a `LinkingDomain` that hosts (or could host) a backlink. It carries `id`, `linkingDomainId`, `url`, optional `title`, optional `outboundLinkCount`, optional `indexed`, optional `lastModified`, a `verification: VerificationStatus`, optional `verifiedAt`, optional `topical: TopicalRelevance`, and optional `riskFlags: RiskFlag[]`. The `outboundLinkCount` matters because pages with an excessive number of outbound links are a risk signal (`excessive_outbound_links` in the `RiskSignalKind` taxonomy). `indexed` indicates whether the page is known to be indexed by a search engine, which affects the value of any backlink placed there.

### BacklinkSource

`BacklinkSource` represents an actual or potential backlink from a `LinkingPage` to a `TargetPage` on our property. It carries `id`, `linkingDomainId`, `linkingPageId`, an optional `targetPageId` (the page on our property the backlink points to), optional `anchorText`, optional `context` (sanitized surrounding text), an optional `isLive` boolean indicating whether the link currently exists, an optional `rel` attribute (`"nofollow"`, `"sponsored"`, `"ugc"`, etc.), optional `firstObservedAt` and `lastVerifiedAt` timestamps, and a `verification: VerificationStatus`. The `isLive` and `rel` fields are how the engine distinguishes a freshly acquired link from a historical one and how it tracks link attributes that affect SEO value.

```ts
export interface BacklinkSource {
  id: string;
  linkingDomainId: string;
  linkingPageId: string;
  targetPageId?: string;
  anchorText?: string;
  context?: string;
  isLive?: boolean;
  rel?: string;
  firstObservedAt?: number;
  lastVerifiedAt?: number;
  verification: VerificationStatus;
}
```

All three backlink entities treat metrics as optional and always labeled. The engine refuses to treat any provider-supplied number as a sole driver of scoring; metrics are at most one `ScoreComponent` among many.

---

## 4. Opportunity Hierarchy

Opportunities are the unit of work in the engine. Every opportunity MUST carry evidence references, a verification status, a deterministic `dedupKey`, and enough context for scoring and outreach. The hierarchy is a discriminated union on the `kind` field, with `BaseOpportunity` defining the shared shape and six concrete kinds extending it.

### BaseOpportunity

`BaseOpportunity` carries `id`, `siteProfileId`, `kind: OpportunityKind`, `dedupKey` (deterministic, produced by `dedupKeyFor(kind, parts)`), `verification: VerificationStatus`, optional `verifiedAt`, `evidenceIds: string[]` (the records backing this opportunity), optional `linkingDomainId`, optional `linkingPageId`, optional `targetPageId`, optional `topical: TopicalRelevance`, optional `commercial: CommercialRelevance`, optional `audience: AudienceAlignment`, `riskFlags: RiskFlag[]`, an optional `score: OpportunityScore` (assigned by the scoring engine), optional `notes`, and `discoveredAt`. The `dedupKey` is what lets the engine collapse the same opportunity discovered through multiple adapters into a single record. The `evidenceIds` array is non-optional: an opportunity with no evidence cannot be acted on.

```ts
export interface BaseOpportunity {
  id: string;
  siteProfileId: string;
  kind: OpportunityKind;
  dedupKey: string;
  verification: VerificationStatus;
  verifiedAt?: number;
  evidenceIds: string[];
  linkingDomainId?: string;
  linkingPageId?: string;
  targetPageId?: string;
  topical?: TopicalRelevance;
  commercial?: CommercialRelevance;
  audience?: AudienceAlignment;
  riskFlags: RiskFlag[];
  score?: OpportunityScore;
  notes?: string;
  discoveredAt: number;
}
```

The `OpportunityKind` union is `competitor_backlink_gap | broken_link | resource_page | unlinked_mention | linkable_asset | directory | expert_roundup | statistics_citation | internal_link | other`. Of these, six have dedicated subtypes in the `LinkOpportunity` union; the remaining kinds (`directory`, `expert_roundup`, `statistics_citation`, `other`) use `BaseOpportunity` directly.

### CompetitorGapOpportunity

`CompetitorGapOpportunity extends BaseOpportunity` with `kind: "competitor_backlink_gap"`, `competitorIds: string[]` (the competitors that have a link from this source), `competitorOverlap: number` (how many competitors link from this source), and a `replicable` object `{ value: boolean; reason: string; confidence: number }` that captures the engine's judgment about whether the target can realistically acquire the same link. The `replicable.confidence` is below 1.0 whenever the judgment rests on inference rather than direct observation.

### BrokenLinkOpportunity

`BrokenLinkOpportunity extends BaseOpportunity` with `kind: "broken_link"`, `brokenDestinationUrl: string` (the URL that no longer resolves), an optional `httpState: number` (the HTTP status observed when verified), an optional `anchorText`, an optional `candidateReplacementPageId` (a page or asset on our property that could replace the broken destination), `existingContentSuitable: boolean` (whether existing content suffices as a replacement), and `contentUpdateRequired: boolean` (whether new or updated content is required before outreach). These two booleans drive the `content_refresh_first` campaign type.

### ResourcePageOpportunity

`ResourcePageOpportunity extends BaseOpportunity` with `kind: "resource_page"`, a `classification` drawn from `industry_resource | educational_resource | product_guide | nonprofit_resource | directory | expert_resource | statistics_reference | niche_community_resource`, and `acceptsSubmissionsInferred: boolean`. The `acceptsSubmissionsInferred` flag is named to remind operators that submission acceptance is inferred, never assumed — outreach to a resource page that does not in fact accept submissions would be wasted effort at best and reputational harm at worst.

### MentionWithoutLinkOpportunity

`MentionWithoutLinkOpportunity extends BaseOpportunity` with `kind: "unlinked_mention"`, `mentionUrl: string` (where the mention was found), and an optional `snippet` (sanitized excerpt containing the mention). These opportunities are typically the highest-converting because the brand is already referenced; the ask is simply to convert the mention into a link.

### LinkableAssetOpportunity

`LinkableAssetOpportunity extends BaseOpportunity` with `kind: "linkable_asset"`, `suggestedArchetype` (drawn from the `ContentAsset["archetype"]` union), and `rationale: string` (the reason this asset would be linkable). This opportunity type is the bridge to AMOS: it tells the content generator what to build and why, without writing the content itself.

### InternalLinkOpportunity

`InternalLinkOpportunity extends BaseOpportunity` with `kind: "internal_link"`, `sourcePageId: string` (the page on our property that should add the link), `internalTargetPageId: string` (the page that should receive the link), an optional `suggestedAnchor`, a `contextualReason: string`, and a `priority: number`. Internal links are first-party and do not require outreach, but they are still opportunities in the engine's model because they affect SEO outcomes.

### LinkOpportunity Union

```ts
export type LinkOpportunity =
  | CompetitorGapOpportunity
  | BrokenLinkOpportunity
  | ResourcePageOpportunity
  | MentionWithoutLinkOpportunity
  | LinkableAssetOpportunity
  | InternalLinkOpportunity;
```

The `dedupKeyFor(kind, parts)` helper produces a canonical key by joining `kind` and the parts with `::`. For example, a broken-link opportunity's dedup key is typically `broken_link::<linkingPageId>::<brokenDestinationUrl>`. Identical parts produce identical keys, which is what lets `CompositeAdapter` merge results from multiple providers without creating duplicate opportunities.

---

## 5. Outreach Entities

### ContactCandidate

`ContactCandidate` represents a person or generic contact endpoint (e.g. a contact form) discovered on a public page or supplied by a CRM. It carries `id`, `originRef` (the page or domain the contact was found on), an optional `name`, an optional `role`, an optional `email` (only if observed on a public page or supplied by CRM), an optional `contactFormUrl`, an optional `socials` array of `{ platform; handle }`, a `provenance` drawn from `page_contact_info | author_profile | org_contact_page | crm_export | manual | adapter`, a `verification: VerificationStatus`, a `doNotContact: boolean`, an optional `doNotContactReason`, `evidenceIds: string[]`, and `riskFlags: RiskFlag[]`. The `doNotContact` flag is non-negotiable: a contact with `doNotContact === true` is never included in outreach, regardless of how strong the opportunity is.

### OutreachProspect

`OutreachProspect` pairs an opportunity with a contact and a brief. It carries `id`, `siteProfileId`, `opportunityId`, an optional `contactId`, a `verification: VerificationStatus`, a `personalizationConfidence: number` (0..1) reflecting how personalized the brief can be, `riskFlags: RiskFlag[]`, a `brief: OutreachBrief`, and `createdAt`. The `personalizationConfidence` is low when the contact's identity or the opportunity's context is thin; operators should treat low-confidence prospects as candidates for a more generic, less assertive outreach.

### OutreachBrief

`OutreachBrief` is a structured brief, not a spam template. It carries `outreachReason` (factual, evidence-backed reason for outreach), a `personalizedContext` object `{ value: string; basis: "observed" | "inferred" | "unknown" }`, a `targetAsset` object `{ pageId?; url?; title?; rationale }`, `evidenceIds: string[]`, `suggestedSubjectConcepts: string[]` (concepts, not final copy), `draftVariants: { label; body }[]` (clearly labeled as drafts), a `followUpStrategy: string`, `doNotContact: boolean`, `riskFlags: RiskFlag[]`, and a `factInferenceUnknown` object `{ facts: string[]; inferences: string[]; unknowns: string[] }`. The `factInferenceUnknown` split is the heart of the outreach contract: every claim in the brief is categorized so the recipient (and the operator reviewing the brief before sending) can see what is observed, what is inferred, and what is genuinely unknown.

```ts
export interface OutreachBrief {
  outreachReason: string;
  personalizedContext: { value: string; basis: "observed" | "inferred" | "unknown" };
  targetAsset: { pageId?: string; url?: string; title?: string; rationale: string };
  evidenceIds: string[];
  suggestedSubjectConcepts: string[];
  draftVariants: { label: string; body: string }[];
  followUpStrategy: string;
  doNotContact: boolean;
  riskFlags: RiskFlag[];
  factInferenceUnknown: { facts: string[]; inferences: string[]; unknowns: string[] };
}
```

---

## 6. Campaign Entities

### Campaign

`Campaign` bundles opportunities, prospects, and content work into a single tracked work item. It carries `id`, `siteProfileId`, `name`, a `type` drawn from `CampaignType` (`broken_link | resource_page | competitor_gap | linkable_asset | content_refresh_first | digital_pr_data_asset | internal_link | unlinked_mention | mixed`), an `objective: string`, `opportunityIds: string[]`, `prospectIds: string[]`, a `contentWork` object `{ description; required; pageIds: string[] }`, an `outreachAngle: string`, `successCriteria: string[]`, `prerequisites: string[]`, a `state: CampaignLifecycleState`, a `priority: number` (0..100), `createdAt`, `updatedAt`, and optional `notes`. The `contentWork.required` flag is what distinguishes a campaign that can proceed to outreach immediately from one that must wait for content refresh or creation.

### CampaignAction

`CampaignAction` is an append-only audit log entry for a campaign. It carries `id`, `campaignId`, optional `opportunityId` and `prospectId`, a `kind` drawn from `state_transition | note | evidence_attached | outreach_sent | follow_up_scheduled | link_verified_acquired | link_verification_failed | revalidation | risk_flag_added | manual_override`, optional `fromState` and `toState` (for transitions), an optional `note`, optional `evidenceIds`, an optional `outcome` object `{ kind; detail?; verifiedAt? }` where `kind` is `link_acquired | link_not_found | declined | no_response | replied | other`, an `at` timestamp, and an optional `actor`. The full action history of a campaign is reconstructable from its `CampaignAction[]` records.

### CampaignLifecycleState

`CampaignLifecycleState` is a 14-state enum: `DISCOVERED`, `QUALIFIED`, `CONTENT_REQUIRED`, `READY_FOR_OUTREACH`, `OUTREACH_APPROVED`, `CONTACTED`, `FOLLOW_UP_DUE`, `REPLIED`, `NEGOTIATING`, `LINK_ACQUIRED`, `DECLINED`, `NO_RESPONSE`, `INVALID`, `STALE`. The `ALLOWED_TRANSITIONS` table in `src/domain/campaign.ts` enumerates every legal transition; anything not listed is forbidden and `assertTransition` throws on illegal attempts. Terminal states are `INVALID` (and any state whose allowed-transitions list is empty). `LINK_ACQUIRED` is special: it requires an `acquired_link_observation` `EvidenceRecord` before the transition is permitted (see `REQUIRES_EVIDENCE_FOR`). The engine MUST NOT auto-advance a campaign to `LINK_ACQUIRED`; the verifier (E.V.E.) must produce the evidence first.

| From | Allowed transitions to |
|------|------------------------|
| `DISCOVERED` | `QUALIFIED`, `CONTENT_REQUIRED`, `INVALID`, `STALE` |
| `QUALIFIED` | `CONTENT_REQUIRED`, `READY_FOR_OUTREACH`, `DECLINED`, `INVALID`, `STALE` |
| `CONTENT_REQUIRED` | `READY_FOR_OUTREACH`, `DECLINED`, `INVALID`, `STALE` |
| `READY_FOR_OUTREACH` | `OUTREACH_APPROVED`, `DECLINED`, `STALE`, `INVALID` |
| `OUTREACH_APPROVED` | `CONTACTED`, `DECLINED`, `STALE`, `INVALID`, `LINK_ACQUIRED` |
| `CONTACTED` | `FOLLOW_UP_DUE`, `REPLIED`, `NO_RESPONSE`, `STALE`, `INVALID`, `LINK_ACQUIRED` |
| `FOLLOW_UP_DUE` | `CONTACTED`, `REPLIED`, `NO_RESPONSE`, `STALE`, `INVALID`, `LINK_ACQUIRED` |
| `REPLIED` | `NEGOTIATING`, `LINK_ACQUIRED`, `DECLINED`, `STALE`, `INVALID` |
| `NEGOTIATING` | `LINK_ACQUIRED`, `DECLINED`, `STALE`, `INVALID` |
| `LINK_ACQUIRED` | `STALE` |
| `DECLINED` | `STALE`, `INVALID` |
| `NO_RESPONSE` | `CONTACTED`, `STALE`, `INVALID` |
| `INVALID` | (none — terminal) |
| `STALE` | `DISCOVERED` |

The helper functions `canTransition(from, to)`, `assertTransition(from, to)`, and `isTerminal(s)` enforce this table. `STALE` is the only state that can return to `DISCOVERED`, modeling a re-discovered opportunity whose prior campaign was abandoned.

---

## 7. Evidence Backbone

### EvidenceRecord

`EvidenceRecord` is the immutable atomic unit of accountability. It carries `id`, a `kind` drawn from `EvidenceKind` (`page_observation | link_observation | broken_link_observation | resource_page_observation | backlink_observation | competitor_backlink_observation | mention_observation | contact_observation | metric_observation | outcome_observation | acquired_link_observation | risk_observation`), a `subjectId` (the entity this evidence is about), a `claim: string` (what was observed), an `observedAt` timestamp, a `source: EvidenceSource`, a `verification: VerificationStatus`, an optional sanitized `payload`, and an optional `payloadHash`. Evidence is immutable: to update a claim you add a new `EvidenceRecord`, you never mutate an existing one. The `makeEvidence(e)` helper assigns a deterministic ID from `[subjectId, kind, observedAt, claim]`, and `canonicalPayloadHash(payload)` produces a stable FNV-style hash of the sorted-keys payload for tamper detection.

### EvidenceSource

`EvidenceSource` records how evidence was obtained. It carries `adapter: string` (e.g. `"fixture"`, `"sitemap"`, `"ahrefs"`), an optional `providerKind` drawn from `EvidenceProviderKind` (`search | seo | crawl | serp | llm | contact | manual | sitemap | import | internal`), an optional `reference` (URL, file path, or fixture ID), and an optional `fetchedAt`. Together with `observedAt`, this gives every claim a full provenance chain.

### EvidenceContract

`EvidenceContract` is the interface that the engine uses to record and query evidence. It exposes four methods:

```ts
export interface EvidenceContract {
  record(e: Omit<EvidenceRecord, "id">): EvidenceRecord;
  for(subjectId: string): EvidenceRecord[];
  latest(subjectId: string, kind?: EvidenceKind): EvidenceRecord | undefined;
  all(): EvidenceRecord[];
}
```

`InMemoryEvidenceStore` is the reference implementation and ships with the engine. Production deployments may substitute a durable store (database, object storage) as long as they implement the same interface. The contract is narrow on purpose: it does not expose mutation or deletion, which preserves the immutability guarantee.

---

## 8. VerificationStatus

`VerificationStatus` is a 6-state enum that every entity carries (directly or via its evidence). The states and their meanings are:

| Status | Meaning |
|--------|---------|
| `DISCOVERED` | Found by an adapter but not yet validated. Actionable but should be treated with caution. |
| `VERIFIED` | Re-checked against the source within the evidence window. The strongest actionable state. |
| `INFERRED` | Derived by analysis (including AI output) rather than directly observed. Never presented as verified fact. |
| `STALE` | Previously verified, now past the revalidation window. Should be re-checked before action. |
| `UNAVAILABLE` | Source could not be reached (transient). Retry is appropriate. |
| `BLOCKED` | Source refused access (robots, auth, 403, etc.). Do not retry without policy change. |

The helper functions in `src/domain/verification.ts` formalize the policy: `isVerified(s)` is a type guard for `"VERIFIED"`; `isActionable(s)` returns true for `VERIFIED`, `DISCOVERED`, and `INFERRED` (these states may be acted on, with appropriate caution); `isStale(s)` returns true for `STALE`; `isBlocked(s)` returns true for `BLOCKED` or `UNAVAILABLE`. The revalidation policy is `DEFAULT_REVALIDATE_MS = 7 * 24 * 60 * 60 * 1000` (seven days). `shouldRevalidate(verifiedAt, now)` returns true if no `verifiedAt` is set or if the elapsed time exceeds the window. `transitionToStaleIfNeeded(status, verifiedAt, now)` returns `"STALE"` when a `VERIFIED` record has aged past the window, otherwise returns the input status unchanged.

```ts
export type VerificationStatus =
  | "DISCOVERED"
  | "VERIFIED"
  | "INFERRED"
  | "STALE"
  | "UNAVAILABLE"
  | "BLOCKED";

export const DEFAULT_REVALIDATE_MS = 7 * 24 * 60 * 60 * 1000;
```

The revalidation policy is the engine's defense against stale data being presented as current. A backlink observed three months ago is not asserted to exist today; it is marked `STALE` and the engine records that an operator (or a verifier like E.V.E.) should re-check it before relying on it.

---

## 9. Scoring Model

### ScoreComponent

`ScoreComponent` is one weighted input to an `OpportunityScore`. It carries `name` (e.g. `"topical_relevance"`, `"evidence_confidence"`, `"competitor_overlap"`, `"authority"`), a `score` in 0..100, a `weight` in 0..1, a human-readable `explanation`, and optional `evidenceIds`. The `explanation` field is what makes the score auditable: an operator should be able to read why a component scored the way it did without re-running the scorer.

### OpportunityScore

`OpportunityScore` is the engine's transparent scoring output. It carries `total` (0..100, the weighted sum of components), `components: ScoreComponent[]`, `confidence` (0..1, lower when evidence is thin), a `recommendedAction` drawn from `ScoreRecommendedAction` (`PURSUE_NOW | PURSUE_AFTER_REFRESH | PURSUE_WITH_CAUTION | DEFER | REJECT | NEEDS_EVIDENCE`), `riskFlags: RiskFlag[]` considered in the score, a `modelVersion: string` for reproducibility, and a `scoredAt` timestamp. The transparency rule is explicit in `src/domain/scoring.ts`: the engine MUST never present a single number without its component breakdown, confidence, recommended action, and risk flags. Provider-supplied metrics MAY be one component among many but MUST NOT be the sole driver.

```ts
export interface OpportunityScore {
  total: number;
  components: ScoreComponent[];
  confidence: number;
  recommendedAction: ScoreRecommendedAction;
  riskFlags: RiskFlag[];
  modelVersion: string;
  scoredAt: number;
}
```

`clampScore(x)` clamps to 0..100 and rounds to one decimal place. `summarizeScore(s)` produces a compact one-line summary that names the total, confidence, recommended action, and the top three components by weighted contribution. The `modelVersion` field is critical for reproducibility: when the scoring model changes, the version bumps so old scores can be flagged as computed under a different model.

---

## 10. Risk Taxonomy

### RiskFlag

`RiskFlag` is a single categorical risk signal. It carries `kind: RiskSignalKind`, `level: RiskLevel`, `reason: string`, `confidence: number` (0..1, confidence in the risk assessment itself — below 0.5 means "suspected but unverified"), and an optional `evidenceId` backing the flag. A `RiskFlag` is always explainable: the `reason` field says why the flag was raised, and `evidenceId` (when present) lets the operator trace the flag back to the observation that triggered it.

### RiskLevel

`RiskLevel` is a 4-level categorical scale: `LOW | MEDIUM | HIGH | REJECT`. `RISK_LEVEL_RANK` assigns numeric ranks (LOW=0, MEDIUM=1, HIGH=2, REJECT=3) so `worstRisk(flags)` can return the highest-ranked level across an array. `isRejected(flags)` returns true if the worst level is `REJECT`, and `shouldSuppressFromOutreach(flags)` returns true if the worst level is `REJECT` or `HIGH` — these opportunities should not be acted on without manual review.

### RiskSignalKind

`RiskSignalKind` is a closed taxonomy of risk signals the engine knows how to detect:

| Kind | Meaning |
|------|---------|
| `link_farm` | The linking domain appears to be part of a link farm. |
| `excessive_outbound_links` | The linking page has an unusual number of outbound links. |
| `irrelevant_domain` | The linking domain is topically irrelevant to the target. |
| `suspicious_directory_network` | The domain appears to be part of a low-quality directory network. |
| `thin_content` | The linking page has little or low-quality content. |
| `adult_gambling_illegal_mismatch` | The linking domain is in an adult/gambling/illegal niche that mismatches the target. |
| `paid_link_solicitation` | Evidence suggests the source solicits paid links (a policy violation). |
| `duplicate_domain` | The same domain has already been counted elsewhere. |
| `duplicate_opportunity` | The same opportunity was already discovered (and should have been deduped). |
| `stale_opportunity` | The opportunity's evidence is past the revalidation window. |
| `unreachable_page` | The linking page could not be reached at verification time. |
| `non_editorial_source` | The source does not appear to be editorially controlled. |
| `pbn_suspicion` | Suspicion of a private blog network (PBN). |
| `low_trust_signals` | Multiple weak trust signals (no single red flag, but combined concern). |
| `robots_blocked` | The source is blocked by robots.txt. |
| `spam_pattern` | The source matches a known spam pattern. |
| `unknown` | Reserved for risk signals that do not fit any other kind. |

The taxonomy is closed (no `string` escape hatch) so the engine can reason about every kind of risk it produces. New risk kinds require an explicit addition to `RiskSignalKind`, which forces a deliberate decision rather than ad hoc string tagging.

---

## 11. Relevance Dimensions

Relevance is never a single opaque number in this engine. Three independent dimensions capture different aspects of how an opportunity relates to the target property.

### TopicalRelevance

`TopicalRelevance` captures the topical similarity between an opportunity's source and the target's declared topic. It carries `topic: string` (a free-text label, e.g. `"affiliate marketing"`, `"kitchen appliances"`), `similarity: number` (0..1, similarity to the target property's declared topic), `reason: string` (human-readable explanation, e.g. `"shared keyword cluster: 'best espresso machines'"`), and an optional `sharedKeywords: string[]`. The `reason` field is mandatory because a similarity number without an explanation is unactionable: an operator needs to know why two topics are considered similar before deciding to act on the relevance score.

### CommercialRelevance

`CommercialRelevance` captures how well the opportunity aligns with the target's commercial intent. It carries `alignment: number` (0..1), an `intent` drawn from `affiliate | ecommerce | leadgen | editorial | nonprofit | informational | unknown`, and a `reason: string`. A high `alignment` with `intent: "affiliate"` means the source is commercially aligned with an affiliate property; the same alignment with `intent: "nonprofit"` would mean something quite different. The `reason` field explains why the alignment score was assigned.

### AudienceAlignment

`AudienceAlignment` captures the estimated overlap between the source's audience and the target's. It carries `overlap: number` (0..1), `reason: string` (e.g. `"shared demographic: US-based content creators"`), and an optional `signals: string[]` of evidence-backed signals. `AudienceAlignment` is the most inferential of the three dimensions and should generally carry lower confidence than `TopicalRelevance` or `CommercialRelevance` unless backed by direct evidence (e.g. a shared audience-measurement dataset).

```ts
export interface TopicalRelevance {
  topic: string;
  similarity: number;
  reason: string;
  sharedKeywords?: string[];
}

export interface CommercialRelevance {
  alignment: number;
  intent: "affiliate" | "ecommerce" | "leadgen" | "editorial" | "nonprofit" | "informational" | "unknown";
  reason: string;
}

export interface AudienceAlignment {
  overlap: number;
  reason: string;
  signals?: string[];
}
```

The `clamp01(x)` helper enforces the 0..1 range for all three dimension scores. Together, these three dimensions feed the scoring engine as components (each weighted, each explained) rather than as a single "relevance" number, so an operator can always see which dimension drove a score up or down.
