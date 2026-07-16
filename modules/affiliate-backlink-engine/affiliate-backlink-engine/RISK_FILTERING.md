# Risk Filtering

This document describes the risk model implemented in `src/domain/risk.ts` and
the assessment pipeline in `src/risk/filter.ts`. Risk flags are categorical,
explainable, and conservative: the engine never claims more certainty than the
underlying signals justify, and every flag carries both a reason string and a
0..1 confidence value so an operator can decide how to act.

## 1. Risk Taxonomy

Risk outputs use four categorical levels, defined in `src/domain/risk.ts` and
ranked via `RISK_LEVEL_RANK`:

| Level | Rank | Meaning |
|-------|-----:|---------|
| `LOW` | 0 | Minor concern; does not block outreach but should be noted. |
| `MEDIUM` | 1 | Worth investigating before pursuing; suppresses confidence. |
| `HIGH` | 2 | Suppress from outreach (`shouldSuppressFromOutreach()` returns true); scoring flips to `DEFER`. |
| `REJECT` | 3 | Hard reject; scoring always emits `REJECT` regardless of total. |

Each `RiskFlag` also carries a `kind` from the `RiskSignalKind` union, which has
exactly 17 values. The taxonomy is intentionally broad so that operators can
filter, group, and trend on specific failure modes rather than a single bucket.

| # | `RiskSignalKind` | Typical Level | Meaning |
|---|------------------|---------------|---------|
| 1 | `link_farm` | HIGH | Domain name matches known link-farm patterns (`links-farm`, `seo-farm`, `submit-farm`, `directory-farm`, `backlinks-farm`). |
| 2 | `excessive_outbound_links` | HIGH or REJECT | Page has more than 100 outbound links (>200 escalates to REJECT). |
| 3 | `irrelevant_domain` | MEDIUM | Page topical similarity is below 0.05. |
| 4 | `suspicious_directory_network` | MEDIUM | Generic top-level directory path (`/`, `/directory`, `/submit`). |
| 5 | `thin_content` | LOW | Page title is suspiciously short (<3 or <5 characters depending on caller). |
| 6 | `adult_gambling_illegal_mismatch` | REJECT | Domain name suggests adult/gambling/illegal content and target topics do not include those verticals. |
| 7 | `paid_link_solicitation` | HIGH | Page text contains paid-link solicitation language. |
| 8 | `duplicate_domain` | LOW | The same `linkingDomainId` appears more than 5 times across opportunities. |
| 9 | `duplicate_opportunity` | LOW | Two or more opportunities share the same `dedupKey`. |
| 10 | `stale_opportunity` | LOW or MEDIUM | Page or opportunity has aged past the revalidation window. |
| 11 | `unreachable_page` | MEDIUM or HIGH | Verification status is `UNAVAILABLE` or `BLOCKED`. |
| 12 | `non_editorial_source` | LOW | Only one competitor links here; may indicate an exclusive or paid relationship. |
| 13 | `pbn_suspicion` | MEDIUM | Domain name has patterns sometimes associated with private blog networks. |
| 14 | `low_trust_signals` | HIGH | Used by outreach/contact code when a domain appears on a do-not-contact list. |
| 15 | `robots_blocked` | (reserved) | Defined in the union; reserved for callers that detect robots.txt blocks. |
| 16 | `spam_pattern` | HIGH or REJECT | Provider spam score exceeds 50 (>80 escalates to REJECT). |
| 17 | `unknown` | (reserved) | Catch-all for unrecognized risk signals. |

Every `RiskFlag` carries a `reason` (human-readable explanation), a
`confidence` (0..1), and an optional `evidenceId` linking back to the
`EvidenceRecord` that backs the claim. The union is closed, so adding a new
signal kind is a deliberate type-level change rather than an incidental string.

## 2. Assessment Functions

The risk pipeline is split across five exported functions in
`src/risk/filter.ts`, each operating at a different scope:

- **`assessDomainRisk(ld, ctx)`** scans a `LinkingDomain` for link-farm naming
  patterns, PBN-style domain tokens (`pbn`, trailing digits), provider-supplied
  spam scores above 50, and adult/gambling/illegal mismatches against
  `ctx.targetTopics`. It returns an array of `RiskFlag` and never mutates the
  input domain.
- **`assessPageRisk(lp, ctx)`** scans a `LinkingPage` for excessive outbound
  links (>100, with >200 escalating to REJECT), thin-content titles (<3
  characters), stale verification status, unreachable pages
  (`UNAVAILABLE`/`BLOCKED`), and irrelevant domains (topical similarity <0.05).
- **`assessOpportunityRisk(opp, ctx)`** scans a `LinkOpportunity` for the
  `non_editorial_source` signal (when `competitorOverlap === 1` on a
  competitor-gap opportunity), stale opportunities, unreachable pages, and
  carries forward any `riskFlags` already attached to the opportunity.
- **`detectDuplicateDomains(opps)`** scans a batch of opportunities and emits a
  `duplicate_domain` flag for any `linkingDomainId` that appears more than 5
  times, indicating a likely directory-style source.
- **`detectDuplicateOpportunities(opps)`** scans a batch and emits a
  `duplicate_opportunity` flag (confidence 1.0) for any `dedupKey` shared by
  two or more opportunities.

The companion helpers `applyRiskToOpportunity()`, `dedupFlags()`, and
`categorize()` merge domain- and page-level flags onto an opportunity, remove
exact-duplicate flags (matched on `kind|level|reason`), and reduce a flag array
to its single worst `RiskLevel` respectively. Callers typically run the domain
and page assessors first, merge with `applyRiskToOpportunity()`, then run the
two batch detectors across the whole opportunity set.

## 3. Conservative Confidence

Every `RiskFlag` carries a `confidence` value between 0 and 1, and the engine
never overclaims certainty. The header comment on `src/domain/risk.ts` makes
this rule explicit: confidence below 0.5 means "suspected but unverified", and
operators are expected to treat such flags as leads rather than verdicts.
Suspicion-style flags are deliberately set low: `pbn_suspicion` carries
confidence 0.2 because a trailing digit or `pbn` token in a domain name is a
weak signal that frequently appears on legitimate sites; `thin_content` carries
confidence 0.3 (or 0.4 in the resource-page caller) because a short title is
suggestive but not conclusive; `non_editorial_source` carries confidence 0.3
because a single-competitor overlap may simply reflect an exclusive editorial
relationship. Higher-confidence flags such as `spam_pattern` (0.7) or
`stale_opportunity` (0.8) are reserved for signals that are directly observed
or computed from a timestamp rather than inferred. This calibration lets the
engine surface weak signals for human review without letting them drive
hard-reject decisions on their own.

## 4. Worst-Risk Aggregation

Because a single entity can carry many flags, the engine reduces a flag array
to its single most severe level via two equivalent helpers. `worstRisk()` in
`src/domain/risk.ts` iterates flags and returns the highest-ranked `RiskLevel`
(lowest-rank `LOW` if the array is empty), and `categorize()` in
`src/risk/filter.ts` performs the same reduction using a private `rankLevel()`
map. Both rely on `RISK_LEVEL_RANK`, where `LOW=0`, `MEDIUM=1`, `HIGH=2`, and
`REJECT=3`. The helper `shouldSuppressFromOutreach(flags)` returns `true` when
`worstRisk(flags)` is `REJECT` or `HIGH`, which is how the outreach layer
filters out opportunities that should not be contacted even if they have not
been formally rejected. The companion `isRejected(flags)` returns `true` only
when the worst level is `REJECT`. The `tests/risk.test.ts` suite covers this
behavior directly: a flag array containing both a `LOW` `spam_pattern` and a
`HIGH` `thin_content` reduces to `"HIGH"` via `categorize()`, and three
identical `dedupFlags()` inputs collapse to a single flag.

## 5. How Risk Affects Scoring

Risk flags feed the scoring engine through two distinct components and one
recommendation gate. The `editorial_legitimacy` component (weight 0.08) is
computed as `100 - RISK_LEVEL_RANK[worstRisk(opp.riskFlags)] * 25`, so a `LOW`
risk yields 100, `MEDIUM` yields 75, `HIGH` yields 50, and `REJECT` yields 25.
The `risk_inverse` component (weight 0.06) applies the same penalty in a
different shape: `100 - RISK_LEVEL_RANK[worstRisk] * 25`. Together they ensure
that risk pulls the total score down twice, once as a legitimacy measure and
once as an explicit penalty. Beyond the components, the worst risk level drives
the `recommendAction()` precedence: a `REJECT` flag short-circuits to the
`REJECT` action regardless of the computed total, and a `HIGH` flag forces the
`DEFER` action before any score-based threshold is consulted. This means an
opportunity with a 90 total but a single `HIGH` `spam_pattern` flag will be
deferred, not pursued, and an opportunity with a 95 total but a `REJECT`
`adult_gambling_illegal_mismatch` flag will be rejected outright.

## 6. Adult / Gambling / Illegal Content Mismatch

The `adult_gambling_illegal_mismatch` signal is emitted by
`assessDomainRisk()` when the domain name matches the regex
`/(porn|xxx|casino|gambl|betting|weed|escort)/` AND none of the
`ctx.targetTopics` match the same regex (case-insensitive). When both
conditions hold, the flag is emitted at level `REJECT` with confidence 0.6 and
a reason explaining the mismatch. The check is target-aware, so an operator
running a lingerie or wellness property can include those topics in
`ctx.targetTopics` and the same domain will not be flagged; the
`tests/risk.test.ts` suite verifies both directions explicitly. A
`casino-betting.example` domain produces a `REJECT` flag when the only target
topic is `"lingerie"`, but produces no `REJECT` flag when `"casino"` is among
the target topics. This keeps the filter conservative on real affiliate
verticals (where adult, gambling, or CBD content may be a legitimate target)
while still hard-rejecting mismatches that would otherwise put the operator at
policy or legal risk.

## 7. Paid-Link Solicitation Detection

Paid-link solicitation is detected by the `resourcePageRiskFlags()` helper in
`src/resource-pages/finder.ts` rather than the generic
`assessDomainRisk()`/`assessPageRisk()` pipeline, because the signal is most
useful when classifying resource pages. The helper concatenates the page URL
and title, lowercases the result, and tests it against the regex
`/(free|submit|add your site|cheap|pay-?for|buy backlink)/`. A match emits a
`paid_link_solicitation` flag at level `HIGH` with confidence 0.7 and a reason
that includes the first 80 characters of the haystack so the operator can see
exactly what triggered the match. The phrase set is deliberately broad: the
engine favors false positives on this signal because contacting a paid-link
vendor carries reputational and policy risk that outweighs a missed outreach
opportunity. The `tests/resource-pages.test.ts` suite verifies that a title
like `"Submit your site, buy backlinks cheap"` produces the expected `HIGH`
flag. The companion `suspicious_directory_network` flag (also from
`resourcePageRiskFlags()`) is emitted when a classified `directory` page sits
at a generic top-level path (`/`, `/directory`, or `/submit`), capturing the
common case of a low-value submit-your-site directory.

## 8. Duplicate Detection

Two batch functions handle duplicates. `detectDuplicateDomains(opps)` counts
how many times each `linkingDomainId` appears across the opportunity set and
emits a `duplicate_domain` flag at level `LOW` with confidence 0.5 for any
domain that appears more than 5 times. The threshold of 5 is hardcoded in
`src/risk/filter.ts` and is intentionally permissive: a domain appearing 3 or 4
times may simply be a large publisher with multiple linkable pages, but 6 or
more appearances strongly suggests a directory-style source where individual
placements have low editorial value. `detectDuplicateOpportunities(opps)` is
stricter: it counts occurrences of each `dedupKey` and emits a
`duplicate_opportunity` flag at level `LOW` with confidence 1.0 whenever the
same key appears two or more times. The high confidence reflects that
`dedupKey` is by construction deterministic (built via `dedupKeyFor()` in
`src/domain/opportunity.ts`), so a collision is unambiguous evidence of a
duplicate rather than a heuristic suspicion. The `tests/risk.test.ts` suite
verifies both detectors: seven opportunities sharing `linkingDomainId: "ld_same"`
produce exactly one `duplicate_domain` flag, and two opportunities sharing
`dedupKey: "k1"` produce exactly one `duplicate_opportunity` flag.

## 9. Stale Opportunity Handling

A record is considered stale when it has aged past the revalidation window,
which defaults to 7 days (`DEFAULT_REVALIDATE_MS = 7 * 24 * 60 * 60 * 1000` in
`src/domain/verification.ts`). The `shouldRevalidate(verifiedAt, now)` helper
returns `true` when `now - verifiedAt` exceeds the window, or when `verifiedAt`
is undefined. Stale handling appears in three places. First,
`assessPageRisk()` emits a `stale_opportunity` flag at level `LOW` with
confidence 0.8 when a page's `verification === "STALE"` or when
`shouldRevalidate(lp.verifiedAt, now)` returns true. Second,
`assessOpportunityRisk()` emits a `stale_opportunity` flag at level `MEDIUM`
with confidence 0.8 when the opportunity's own `verification === "STALE"`,
escalating from the page-level LOW because a stale opportunity is closer to the
outreach decision. Third, in the scoring engine, `computeEvidenceConfidence()`
halves the trust weight of any `VERIFIED` evidence record whose `observedAt`
has crossed the revalidation window, so a stale "verified" record contributes
0.5 instead of 1.0 to the evidence-confidence component. Operators are
expected to call `transitionToStaleIfNeeded()` (also in
`src/domain/verification.ts`) during ingestion to flip a `VERIFIED` record's
status to `STALE` once the window has elapsed, which then triggers the
page- and opportunity-level flags above on the next assessment pass.
