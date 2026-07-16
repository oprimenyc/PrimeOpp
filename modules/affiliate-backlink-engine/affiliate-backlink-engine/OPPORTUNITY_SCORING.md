# Opportunity Scoring

This document describes the transparent scoring model implemented in
`src/scoring/engine.ts` and `src/domain/scoring.ts`. The engine converts a
`LinkOpportunity` plus a `ScoringContext` into an `OpportunityScore` whose
structure is auditable end-to-end. Every number is reproducible, every weight is
named, and every recommendation is traceable back to the components and risk
flags that produced it.

## 1. Transparency Principle

A score is meaningless without its components and explanation. The
`OpportunityScore` interface therefore refuses to carry a single number in
isolation: it always bundles a `total` together with a `components` array, a
`confidence` value, a `recommendedAction`, the `riskFlags` that were considered,
the `modelVersion` that produced it, and a `scoredAt` timestamp. The header
comment on `src/domain/scoring.ts` makes this rule explicit and states that the
engine MUST never present a single number without the component breakdown,
confidence, recommended action, and risk flags. Operators consuming a score are
expected to surface the components, not just the total, when triaging
opportunities, and downstream callers such as `summarizeScore()` always emit the
top three contributing components alongside the total and action. This is the
contract that lets a human reviewer audit any score in seconds and challenge
individual components rather than being forced to trust an opaque figure.

## 2. Scoring Components

The engine emits exactly 14 components per score, each with a `name`, a 0..100
`score`, the `weight` actually applied, a human-readable `explanation`, and
optional `evidenceIds`. Each component is pushed into the `components` array in
`scoreOpportunity()` in a fixed order, so the breakdown is stable across runs.

| # | Component | Measures | Default Weight | Raw Score Computation |
|---|-----------|----------|----------------|-----------------------|
| 1 | `topical_relevance` | How topically close the source is to the target property's declared topic. | 0.18 | `opp.topical.similarity ?? 0`, scaled by 100. |
| 2 | `audience_alignment` | Estimated overlap between the source's audience and the target property's. | 0.06 | `opp.audience.overlap ?? ctx.audienceAlignment ?? 0.5`, scaled by 100. |
| 3 | `target_page_fit` | Whether a target page on our property was matched and whether content is ready. | 0.10 | `100` if matched and `contentReady`, `60` if matched but not ready, `0` if no match. |
| 4 | `commercial_relevance` | Alignment of commercial intent (affiliate, ecommerce, leadgen, editorial, etc.). | 0.08 | `opp.commercial.alignment ?? 0.3`, scaled by 100. |
| 5 | `evidence_confidence` | How trustworthy the underlying evidence base is. | 0.10 | `computeEvidenceConfidence()` (see section 4), scaled by 100. |
| 6 | `competitor_overlap` | How many competitors already link from this source (gap opportunities only). | 0.08 | `Math.min(100, overlap * 25)` for `competitor_backlink_gap`, else `0`. |
| 7 | `editorial_legitimacy` | Inverse of the worst risk flag, measuring editorial trustworthiness. | 0.08 | `100 - RISK_LEVEL_RANK[worstRisk] * 25`. |
| 8 | `acquisition_difficulty` | Ease of acquisition (the component is the inverse of difficulty). | 0.06 | `(1 - difficulty) * 100` where `difficulty` is `ctx.acquisitionDifficulty ?? defaultDifficulty(opp)`. |
| 9 | `content_readiness` | Whether existing content is suitable for outreach without refresh. | 0.06 | `100` if ready, `30` if a refresh is required. |
| 10 | `relationship_potential` | Strength of any prior relationship with the source. | 0.04 | `ctx.relationshipPrior ?? 0`, scaled by 100. |
| 11 | `risk_inverse` | Penalty applied for the worst risk flag on the opportunity. | 0.06 | `100 - RISK_LEVEL_RANK[worstRisk] * 25`. |
| 12 | `freshness` | How recently the opportunity was discovered. | 0.04 | `Math.max(0, 100 - ageDays * 5)`. |
| 13 | `strategic_value` | Strategic priority multiplier supplied by the operator. | 0.04 | `clampScore(Math.min(100, 50 * strategicValueMultiplier))`. |
| 14 | `provider_authority` | Optional proprietary authority metric (0..100) from an external provider. | 0.02 | `ctx.providerAuthority ?? 0` used directly. |

The `defaultDifficulty()` helper picks a difficulty per opportunity `kind`:
`internal_link` = 0.05 (trivial, both ends controlled), `unlinked_mention` =
0.25 (easiest external, they already mention us), `broken_link` = 0.30, 
`resource_page` = 0.40, `competitor_backlink_gap` = 0.60, `linkable_asset` =
0.70, and `0.5` as a fallback for any other kind. The component is always the
inverse of this difficulty, so a lower difficulty yields a higher contribution.

## 3. Weights Table

The default weights are exported as `DEFAULT_WEIGHTS` in `src/scoring/engine.ts`
and reproduced verbatim below. They sum to exactly 1.00, and the test suite
(`tests/scoring.test.ts`) asserts that the sum is within 0.05 of 1 and that
`provider_authority` is capped at 0.05 so a proprietary metric can never
dominate.

| Component | Default Weight |
|-----------|---------------:|
| `topical_relevance` | 0.18 |
| `audience_alignment` | 0.06 |
| `target_page_fit` | 0.10 |
| `commercial_relevance` | 0.08 |
| `evidence_confidence` | 0.10 |
| `competitor_overlap` | 0.08 |
| `editorial_legitimacy` | 0.08 |
| `acquisition_difficulty` | 0.06 |
| `content_readiness` | 0.06 |
| `relationship_potential` | 0.04 |
| `risk_inverse` | 0.06 |
| `freshness` | 0.04 |
| `strategic_value` | 0.04 |
| `provider_authority` | 0.02 |
| **Total** | **1.00** |

Callers can override any subset of these weights via `ScoringContext.weights`,
in which case the engine merges them onto `DEFAULT_WEIGHTS` (`{ ...DEFAULT_WEIGHTS,
...(ctx.weights ?? {}) }`). The cap on `provider_authority` is intentional and
enforced by both the constant itself (0.02) and the test suite: a proprietary
authority score may contribute, but it can never outweigh topical relevance,
target-page fit, evidence confidence, editorial legitimacy, or the risk
penalty. This keeps the engine honest even when a vendor metric is missing or
noisy.

## 4. Confidence Calculation

Evidence confidence is computed by the internal `computeEvidenceConfidence()`
function, which maps each `EvidenceRecord`'s `verification` status to a 0..1
trust weight: `VERIFIED` = 1.0, `DISCOVERED` = 0.6, `INFERRED` = 0.4, and
anything else (including `STALE`, `UNAVAILABLE`, `BLOCKED`, or unrecognized) =
0.2. The function filters the supplied evidence array to only records whose
`id` appears in `opp.evidenceIds`, sums the per-record trust weights, and
divides by the number of relevant records to produce a 0..1 average. If the
opportunity has no evidence ids at all, the function returns 0.1; if it has ids
but none of them resolve to supplied records, it returns 0.2. A `VERIFIED`
record that has aged past the revalidation window (see `shouldRevalidate()`,
default 7 days) is penalized by multiplying its trust weight by 0.5, so a stale
"verified" record contributes only 0.5 instead of 1.0. The aggregate confidence
becomes both a standalone component (`evidence_confidence`, scaled by 100) and
the input to `recommendedAction` logic, where confidence below 0.3 forces the
`NEEDS_EVIDENCE` action regardless of total score.

## 5. Recommended Actions

The `recommendAction()` helper maps each opportunity to one of six categorical
actions, evaluated in a strict precedence order so the most severe condition
always wins. The actions and their decision logic are:

| Action | Triggered When |
|--------|----------------|
| `REJECT` | `worstRisk(opp.riskFlags)` is `REJECT`. |
| `DEFER` | `worstRisk(opp.riskFlags)` is `HIGH`, OR none of the more selective rules below match. |
| `NEEDS_EVIDENCE` | `evidenceConfidence < 0.3` (the engine is not sure enough to act). |
| `PURSUE_AFTER_REFRESH` | Content is not ready (`contentReady === false`). |
| `PURSUE_NOW` | `total >= 70` and none of the above conditions hold. |
| `PURSUE_WITH_CAUTION` | `total >= 50` (but below 70) and none of the above conditions hold. |

The order matters: a `REJECT` risk flag short-circuits everything, so even an
opportunity with a 95 total will be rejected if it carries an
`adult_gambling_illegal_mismatch` flag. Likewise a `HIGH` risk flag forces
`DEFER` before the engine ever considers the score. The
`tests/scoring.test.ts` suite covers each branch individually, asserting that
`REJECT` yields `REJECT`, `HIGH` yields `DEFER`, empty evidence yields
`NEEDS_EVIDENCE`, `contentReady: false` yields `PURSUE_AFTER_REFRESH`, and that
the 70/50 thresholds correctly route to `PURSUE_NOW` and `PURSUE_WITH_CAUTION`.

## 6. Determinism

The engine is deterministic: identical inputs produce identical outputs, and
the `tests/scoring.test.ts` suite explicitly verifies this by calling
`scoreOpportunity()` twice with the same `opp`, `evidence`, and a fixed `now`
value, then asserting that both `total` and `recommendedAction` match. There
are no sources of randomness, no time-based drift beyond the explicit `now`
parameter, and no I/O during scoring. The constant `SCORING_MODEL_VERSION` is
set to `"transparent-v1"` and is included in every emitted `OpportunityScore`
under the `modelVersion` field, so any persisted score can be traced back to
the exact model that produced it. The `scoredAt` timestamp is the only
non-deterministic field and defaults to `Date.now()` if `ctx.now` is omitted,
so callers that want byte-for-byte reproducibility should always supply an
explicit `now`. This determinism is what makes scores safe to cache, diff, and
audit across pipeline runs.

## 7. Worked Example

Consider a `broken_link` opportunity discovered just now, with strong topical
overlap, an affiliate-intent commercial alignment, a matched target page whose
content is ready, and a fresh `VERIFIED` evidence record. The fixture-style
input below mirrors the shape used in `tests/scoring.test.ts`.

```ts
const opp: BrokenLinkOpportunity = {
  id: "opp_demo",
  siteProfileId: "s1",
  kind: "broken_link",
  dedupKey: "broken_link::src.example/p::our.example/best-espresso-machines",
  verification: "VERIFIED",
  verifiedAt: Date.now(),
  evidenceIds: ["evd_demo"],
  brokenDestinationUrl: "https://dead.example/old",
  existingContentSuitable: true,
  contentUpdateRequired: false,
  topical: { topic: "espresso machines", similarity: 0.8,
             reason: "shared keyword cluster: 'best espresso machines'" },
  commercial: { alignment: 0.7, intent: "affiliate",
                reason: "target property monetizes via affiliate links" },
  audience: { overlap: 0.6, reason: "shared demographic: US home-barista audience" },
  riskFlags: [],
  discoveredAt: Date.now()
};

const ctx: ScoringContext = {
  matchedTargetPage: { url: "https://our.example/best-espresso-machines" } as TargetPage,
  contentReady: true,
  relationshipPrior: 0.3,
  strategicValueMultiplier: 1.5,
  providerAuthority: 65,
  evidence: [{ id: "evd_demo", verification: "VERIFIED",
               observedAt: Date.now(), source: { adapter: "fixture" },
               kind: "broken_link_observation", subjectId: "opp_demo",
               claim: "broken link observed" } as EvidenceRecord]
};
```

The component scores and weighted contributions are:

| # | Component | Raw Score | Weight | Contribution |
|---|-----------|----------:|-------:|-------------:|
| 1 | `topical_relevance` | 80.0 | 0.18 | 14.40 |
| 2 | `audience_alignment` | 60.0 | 0.06 | 3.60 |
| 3 | `target_page_fit` | 100.0 | 0.10 | 10.00 |
| 4 | `commercial_relevance` | 70.0 | 0.08 | 5.60 |
| 5 | `evidence_confidence` | 100.0 | 0.10 | 10.00 |
| 6 | `competitor_overlap` | 0.0 | 0.08 | 0.00 |
| 7 | `editorial_legitimacy` | 100.0 | 0.08 | 8.00 |
| 8 | `acquisition_difficulty` | 70.0 | 0.06 | 4.20 |
| 9 | `content_readiness` | 100.0 | 0.06 | 6.00 |
| 10 | `relationship_potential` | 30.0 | 0.04 | 1.20 |
| 11 | `risk_inverse` | 100.0 | 0.06 | 6.00 |
| 12 | `freshness` | 100.0 | 0.04 | 4.00 |
| 13 | `strategic_value` | 75.0 | 0.04 | 3.00 |
| 14 | `provider_authority` | 65.0 | 0.02 | 1.30 |
| - | **Total** | - | 1.00 | **77.30** |

The weighted sum is 77.30, which `clampScore()` rounds to 77.3. Confidence is
`min(1, 1.0 + 0.1) = 1.0` (the 0.1 bonus applies because `evidenceIds.length >
0`). The worst risk level is `LOW`, evidence confidence is above the 0.3
threshold, content is ready, and the total is at least 70, so
`recommendAction()` returns `PURSUE_NOW`. The resulting `OpportunityScore`
carries `total: 77.3`, `confidence: 1.0`, `recommendedAction: "PURSUE_NOW"`,
`modelVersion: "transparent-v1"`, and the full component breakdown above.

## 8. Why No Single "Authority" Number

The engine deliberately refuses to rely solely on proprietary metrics such as a
vendor-supplied "domain authority" score. Such metrics are opaque (their
computation is not disclosed), non-reproducible (they change with no public
changelog), and frequently wrong in ways that matter for affiliate link
building (a high-authority site may still be a paid-link farm or an irrelevant
directory). The `ScoringContext.providerAuthority` field exists so callers can
surface an external metric, but its weight is capped at 0.02 in
`DEFAULT_WEIGHTS`, the test suite asserts `provider_authority <= 0.05`, and the
engine's `src/domain/scoring.ts` header states explicitly that
provider-supplied metrics MAY be used as one component among many but MUST NOT
be the sole driver. The result is that an opportunity can never be ranked
highly on the strength of an opaque number alone; it must also pass the
topical-relevance, target-page-fit, editorial-legitimacy, and risk-inverse
components, all of which are computed from explainable signals in the
codebase. This tradeoff sacrifices a small amount of correlation with vendor
rankings in exchange for auditability, reproducibility, and resistance to
metric manipulation.
