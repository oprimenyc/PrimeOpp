# TEST_REPORT

## Summary

| Metric | Value |
|--------|-------|
| Test files | 18 |
| Tests | 124 |
| Passed | 124 |
| Failed | 0 |
| Duration | ~6 seconds |

All tests pass cleanly with no warnings.

## Test File Breakdown

| File | Tests | Coverage Area |
|------|-------|---------------|
| `tests/domain.test.ts` | 6 | Deterministic IDs (deterministicId, slugId, ephemeralId, assertValidId). |
| `tests/verification.test.ts` | 9 | VerificationStatus (DISCOVERED/VERIFIED/INFERRED/STALE/UNAVAILABLE/BLOCKED), revalidation window, transition to STALE. |
| `tests/evidence.test.ts` | 7 | EvidenceRecord creation, deterministic IDs, latest-by-kind, canonical payload hash, source provenance. |
| `tests/inventory.test.ts` | 6 | SiteInventoryBuilder, content-type inference, commercial-intent inference, evidence recording, stats. |
| `tests/adapters.test.ts` | 11 | FixtureAdapter (search, backlinks, broken links, resource pages, mentions, offline marker), CompositeAdapter (merge, max confidence, error capture). |
| `tests/discovery.test.ts` | 8 | Competitor/broken-link/resource-page/mention discovery, evidence preservation, deduplication, linkable-asset suggestions, topical relevance. |
| `tests/competitors.test.ts` | 6 | Competitor gap analysis, overlap counts, multi-competitor pages, common resource domains, replicability assessment, risk flags. |
| `tests/broken-links.test.ts` | 4 | Broken-link finder, stale detection, replacement matching. |
| `tests/resource-pages.test.ts` | 5 | Resource-page classification, paid-link solicitation risk, generic directory risk, evidence, inferred submission acceptance. |
| `tests/scoring.test.ts` | 9 | Score generation, component breakdown, weighted-sum math, REJECT/HIGH/NEEDS_EVIDENCE/PURSUE_AFTER_REFRESH actions, deterministic scoring, weight constraints. |
| `tests/risk.test.ts` | 11 | Link-farm/PRN detection, adult/gambling mismatch, excessive outbound links, stale pages, unreachable pages, duplicate domains, duplicate opportunities, flag dedup, worst-level categorization. |
| `tests/content-matcher.test.ts` | 5 | Direct/partial/none matching, suggested new asset, refresh prioritization with/without ranking data, batch sorting. |
| `tests/internal-links.test.ts` | 5 | Orphan pages, weakly connected commercial pages, repetitive anchors, deeply buried pages, internal-link opportunity generation. |
| `tests/outreach.test.ts` | 7 | Outreach brief generation, fact/inference/unknown separation, observed vs inferred basis, DNC handling, no invention of contact details, AI failure fallback, contact discovery with DNC list. |
| `tests/campaigns.test.ts` | 10 | Campaign planning, opportunity grouping, auto-plan, state machine transitions, illegal transition rejection, LINK_ACQUIRED evidence requirement, note/action recording, verifyAcquiredLink, revalidate to STALE. |
| `tests/ai-boundary.test.ts` | 4 | NoOp classify/draft/explain, ResilientAiAdapter fallback on AI failure. |
| `tests/free-low-cost.test.ts` | 6 | buildDataStack tier selection (free_local / low_cost_api / premium_provider), tier documentation, ManualVerificationQueue. |
| `tests/cli.test.ts` | 5 | CLI smoke tests: --help, site import, broken-links analyze, evidence verify, internal-links analyze. |

## Coverage Areas Required by Mission 21

All required test areas are covered:

| Required Area | Covered By |
|---------------|-----------|
| Deterministic IDs | `tests/domain.test.ts` |
| Normalization | `tests/inventory.test.ts`, `tests/adapters.test.ts` (URL normalization) |
| Deduplication | `tests/discovery.test.ts` (deduplicateOpportunities) |
| Competitor gap analysis | `tests/competitors.test.ts` |
| Broken-link logic | `tests/broken-links.test.ts` |
| Resource-page classification | `tests/resource-pages.test.ts` |
| Scoring | `tests/scoring.test.ts` |
| Risk filtering | `tests/risk.test.ts` |
| Content matching | `tests/content-matcher.test.ts` |
| Refresh prioritization | `tests/content-matcher.test.ts` |
| Internal linking | `tests/internal-links.test.ts` |
| Campaign state transitions | `tests/campaigns.test.ts` |
| Evidence provenance | `tests/evidence.test.ts`, `tests/discovery.test.ts` |
| Stale-data handling | `tests/verification.test.ts`, `tests/broken-links.test.ts`, `tests/risk.test.ts`, `tests/campaigns.test.ts` |
| Adapter failure | `tests/adapters.test.ts` (CompositeAdapter captures errors as warnings) |
| AI provider failure | `tests/ai-boundary.test.ts`, `tests/outreach.test.ts` (ResilientAiAdapter fallback) |
| Duplicate outreach prevention | `tests/outreach.test.ts` (do-not-contact + dedupKey) |
| Acquired-link verification states | `tests/campaigns.test.ts` (verifyAcquiredLink, REQUIRES_EVIDENCE_FOR) |

## Build Verification

| Step | Result |
|------|--------|
| `npm install` | PASS (82 packages) |
| `npx tsc -p tsconfig.json --noEmit` (typecheck) | PASS (0 errors) |
| `npx tsc -p tsconfig.json` (build) | PASS (0 errors, dist/ populated) |
| `npx vitest run` (full test suite) | PASS (124/124) |
| Example workflows (panticandy, vital, generic) | PASS |
| CLI smoke tests | PASS |

## Test Execution

```bash
cd /home/z/my-project/affiliate-backlink-engine
npm test
```

Output:
```
Test Files  18 passed (18)
     Tests  124 passed (124)
   Duration  ~6 seconds
```

## Verdict

**FULL TEST SUITE: PASS**
