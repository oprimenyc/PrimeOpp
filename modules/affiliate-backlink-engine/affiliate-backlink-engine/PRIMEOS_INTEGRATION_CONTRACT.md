# PRIMEOS Integration Contract

This document specifies the integration contract between the `affiliate-backlink-engine` (hereafter "the engine") and PrimeOS, the orchestrating operator layer. PrimeOS is the strategic authority that decides what to pursue, what to publish, and what to approve; the engine is the analytical and campaign-planning substrate that produces evidence-backed opportunities and tracks their lifecycle. The contract is intentionally narrow: the engine never autonomously sends outreach, never claims a link was acquired without verified evidence, and never modifies site content. All execution authority rests with PrimeOS.

The engine exposes its full public surface through the barrel at `src/index.ts`, which re-exports every domain type, utility, adapter contract, and pipeline function referenced below. PrimeOS consumes the engine either as a TypeScript library imported into a larger PrimeOS process, or as a CLI invoked from a shell. Both surfaces are documented here against their concrete implementations so that the contract is auditable against source.

## 1. Role of PrimeOS

PrimeOS sits above the engine as the campaign authority. Its responsibilities are: setting the campaign objective for a given site profile, selecting the target brand and domain, approving the risk envelope for the strategy being proposed, and orchestrating the actual execution of approved work. The engine produces recommendations, scored opportunities, draft outreach briefs, and risk flags; PrimeOS consumes these as inputs to its own decision loop and is the sole actor that can move a campaign from `READY_FOR_OUTREACH` to `OUTREACH_APPROVED`.

The engine enforces this boundary structurally. The campaign state machine defined in `src/domain/campaign.ts` (`ALLOWED_TRANSITIONS`) requires that `OUTREACH_APPROVED` be reached only from `READY_FOR_OUTREACH`, and `CONTACTED` only from `OUTREACH_APPROVED`. There is no code path in the engine that auto-advances a campaign through this gate. Even `autoPlanCampaigns` (see Section 5) only produces plans; it does not approve them. PrimeOS must explicitly call `InMemoryCampaignTracker.transition(campaignId, "OUTREACH_APPROVED", { actor: "primeos", ... })` to proceed.

## 2. Inputs PrimeOS Provides

PrimeOS supplies the engine with the contextual frame within which all opportunity discovery, scoring, and planning happens. These inputs are passed through the `GapAnalysisOptions`, `CampaignPlanInput`, and `ScoringContext` shapes (see `src/competitors/gap-analyzer.ts`, `src/campaigns/planner.ts`, and `src/scoring/engine.ts` respectively).

| Input | Type | Where consumed | Purpose |
|-------|------|----------------|---------|
| Site profile | `SiteProfile` (id, name, domain, topics) | `SiteInventoryBuilder`, `GapAnalysisOptions.siteProfileId`, `CampaignPlanInput.siteProfileId` | Defines the property being promoted |
| Target domain | `TargetDomain` | `GapAnalysisOptions.targetDomain` | The root domain opportunities must reference |
| Target topics | `string[]` | `GapAnalysisOptions.targetTopics`, `ScoringContext` (via opportunity `topical`) | Topical relevance baseline |
| Competitor list | `CompetitorBacklinkInput[]` | `analyzeCompetitorGap(inputs, opts)` | Domains whose backlink sets are compared to the target |
| Risk appetite | implicit via `ScoringContext.weights` and `RiskFlag` review | `scoreOpportunity`, `risk/filter.ts` | Weighted into `risk_inverse` and `editorial_legitimacy` components |

PrimeOS is responsible for the correctness of these inputs. The engine does not validate that the competitor list is actually a competitor set; it only computes gaps against whatever domains PrimeOS supplies. If PrimeOS supplies a malformed target domain (e.g. non-http URL), `normalizeUrl` will return `undefined` and downstream stages will skip the entry rather than throw.

## 3. Outputs Engine Returns

The engine returns structured, evidence-backed artifacts at four levels of granularity. Each is documented in code with an interface or type so PrimeOS can consume them without parsing free text.

| Output | Type | Producer | Notes |
|--------|------|----------|-------|
| Scored opportunities | `Array<{ opp: LinkOpportunity; score: OpportunityScore }>` | `scoreOpportunity` / `rankByScore` | 14 transparent scoring components, total 0..100 |
| Campaign plans | `Campaign[]` | `planCampaign`, `autoPlanCampaigns` | Includes `objective`, `prerequisites`, `successCriteria`, `contentWork` |
| Outreach briefs | `OutreachBrief` | `personalizeOutreach` | Carries `factInferenceUnknown` split, draft variants, follow-up strategy |
| Risk flags | `RiskFlag[]` | `risk/filter.ts`, opportunity `riskFlags` | Each flag has `kind`, `level` (LOW/MEDIUM/HIGH/REJECT), `reason`, `confidence` |

Every output carries the evidence ids it was derived from (`opportunity.evidenceIds`, `brief.evidenceIds`, `score.components[].evidenceIds`). PrimeOS can audit any recommendation back to the underlying `EvidenceRecord` set via `EvidenceContract.for(subjectId)` or `EvidenceContract.latest(subjectId, kind)`.

## 4. Approval Boundary

The engine is structurally prevented from auto-sending outreach. There is no function in the public API that sends email, opens a browser, or posts to a contact form. The outreach surface stops at `OutreachBrief` production; everything beyond that is PrimeOS's responsibility. This is enforced in three places:

1. **State machine**: `ALLOWED_TRANSITIONS.READY_FOR_OUTREACH = ["OUTREACH_APPROVED", "DECLINED", "STALE", "INVALID"]`. The engine cannot move a campaign past `READY_FOR_OUTREACH` without an explicit transition call.
2. **No outbound transport**: there is no SMTP client, no `fetch` against external outreach endpoints, no contact-form submission helper in the codebase. The `FixtureAdapter` and `NoOpAiAdapter` defaults are entirely offline.
3. **DRY_RUN default**: `.env.example` ships with `DRY_RUN=true`. Even if PrimeOS wires up a real transport, the engine's runtime guards treat this as the default safe state.

PrimeOS approves each campaign before any outreach action. The recommended approval call is:

```ts
tracker.transition(campaignId, "OUTREACH_APPROVED", {
  actor: "primeos",
  note: "Approved by PrimeOS operator after risk review.",
  evidenceIds: requiredEvidenceForApproval
});
```

The transition validates the source state, attaches the action to the audit trail (see Section 7), and returns the updated `Campaign`. No silent side effects occur.

## 5. API Surface

The engine exports its full programmatic surface from `src/index.ts`. The functions most relevant to PrimeOS are listed below with their signatures and the file in which they are defined.

| Function | Signature | Source |
|----------|-----------|--------|
| `planCampaign` | `(input: CampaignPlanInput) => Campaign` | `src/campaigns/planner.ts` |
| `autoPlanCampaigns` | `(siteProfileId, brandName, opps, refreshPriorities?, contentMatches?, now?) => Campaign[]` | `src/campaigns/planner.ts` |
| `scoreOpportunity` | `(opp: LinkOpportunity, ctx: ScoringContext) => OpportunityScore` | `src/scoring/engine.ts` |
| `analyzeCompetitorGap` | `(inputs: CompetitorBacklinkInput[], opts: GapAnalysisOptions) => GapAnalysisResult` | `src/competitors/gap-analyzer.ts` |
| `rankByScore` | `(scored) => scored` (stable, descending) | `src/scoring/engine.ts` |
| `InMemoryCampaignTracker.transition` | `(campaignId, to, opts?) => Campaign` | `src/campaigns/tracker.ts` |
| `InMemoryEvidenceStore.record` / `.for` / `.latest` / `.all` | see `EvidenceContract` | `src/domain/evidence.ts` |

`planCampaign` accepts explicit overrides for `objective` and `outreachAngle`; if PrimeOS omits them, deterministic defaults are generated based on `CampaignType` and `brandName`. `autoPlanCampaigns` groups opportunities by kind and emits one campaign per group plus an additional `content_refresh_first` campaign when high-priority refresh work exists. PrimeOS may then filter, edit, or reject any produced plan before calling `tracker.create(campaign)`.

`scoreOpportunity` is deterministic given the same inputs. The 14 scoring components and their default weights are defined in `DEFAULT_WEIGHTS`; PrimeOS may override any subset via `ScoringContext.weights`. The recommended action returned in `OpportunityScore.recommendedAction` is one of `PURSUE_NOW`, `PURSUE_WITH_CAUTION`, `PURSUE_AFTER_REFRESH`, `DEFER`, `NEEDS_EVIDENCE`, or `REJECT`, derived from the total score, the worst risk level, content readiness, and evidence confidence.

`analyzeCompetitorGap` is the entry point for competitor backlink gap analysis. It accepts per-competitor backlink datasets, excludes any domain the target already has a backlink from (via `targetExistingBacklinkDomains`), and emits `CompetitorGapOpportunity` records each backed by a `competitor_backlink_observation` EvidenceRecord. The `assessReplicability` helper produces a confidence score; it never assumes a link is replicable just because a competitor has one.

## 6. CLI Handoff

PrimeOS may invoke the engine through the CLI at `src/cli/index.ts` (binary name `backlink-engine`). The two commands most relevant to PrimeOS orchestration are `campaign create` and `opportunities score`, but the full command surface is available for shell-driven workflows.

```bash
# Create a campaign from a JSON file of opportunities
backlink-engine campaign create \
  --site site_panticandy \
  --brand "PantiCandy" \
  --type broken_link \
  --name "Q3 broken-link campaign" \
  --opportunities ./out/opportunities.json \
  --json --out ./out/campaign.json

# Score opportunities with matched target pages
backlink-engine opportunities score \
  --opportunities ./out/opportunities.json \
  --evidence ./out/evidence.json \
  --pages ./out/pages.json \
  --assets ./out/assets.json \
  --json --out ./out/scored.json
```

All commands support `--json` for machine-readable output and `--out <path>` to write the result to a file. The CLI uses `parseJsonSafe` for input parsing, which returns `undefined` on malformed JSON rather than throwing, and surfaces a clean error message. When PrimeOS pipes fixtures through the CLI, the default `FixtureAdapter` keeps every command offline; no network calls occur unless PrimeOS explicitly wires a non-offline adapter into a higher-level wrapper.

The CLI commands are thin wrappers over the same library functions documented in Section 5. The `campaign create` command calls `planCampaign`; the `opportunities score` command calls `scoreOpportunity` for each opportunity in the input. Outputs are therefore byte-for-byte identical to what the library produces for the same inputs, which means PrimeOS can freely mix CLI and library invocations within a single workflow.

## 7. State Coordination

The `Campaign.state` field is the single source of truth for campaign progression. PrimeOS reads and writes this state exclusively through `InMemoryCampaignTracker.transition()`, which validates the transition against `ALLOWED_TRANSITIONS`, optionally verifies required evidence, appends a `CampaignAction` to the audit trail, and returns the updated `Campaign`. Direct mutation of `Campaign.state` is unsupported and breaks the audit trail.

The lifecycle states (from `src/domain/campaign.ts`) are:

```
DISCOVERED -> QUALIFIED -> CONTENT_REQUIRED -> READY_FOR_OUTREACH
READY_FOR_OUTREACH -> OUTREACH_APPROVED -> CONTACTED -> FOLLOW_UP_DUE
FOLLOW_UP_DUE -> REPLIED -> NEGOTIATING -> LINK_ACQUIRED
Side states: DECLINED, NO_RESPONSE, INVALID, STALE
```

The transition rules enforce discipline. For example, `LINK_ACQUIRED` is reachable only from `OUTREACH_APPROVED`, `CONTACTED`, `FOLLOW_UP_DUE`, `REPLIED`, or `NEGOTIATING` (and never from `DISCOVERED` directly). Furthermore, `REQUIRES_EVIDENCE_FOR["LINK_ACQUIRED"] = "acquired_link_observation"` (see `src/domain/campaign.ts`) requires that the transition be accompanied by an `EvidenceRecord` of kind `acquired_link_observation` with `verification === "VERIFIED"`. If PrimeOS attempts the transition without such evidence, the tracker throws:

```
Transition <from> -> LINK_ACQUIRED requires verified evidence of kind
"acquired_link_observation". Provide evidenceIds / evidence.
```

The tracker also auto-revalidates campaigns after 30 days of inactivity, transitioning them to `STALE` if `STALE` is a legal target and the campaign is not already in `LINK_ACQUIRED`. PrimeOS can call `tracker.revalidate(campaignId)` on a schedule to keep the campaign set honest. Every transition produces an immutable `CampaignAction` entry retrievable via `tracker.actionsFor(campaignId)`, giving PrimeOS a complete, ordered audit trail of who did what and when.
