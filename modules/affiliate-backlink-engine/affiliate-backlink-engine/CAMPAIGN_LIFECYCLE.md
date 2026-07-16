# CAMPAIGN_LIFECYCLE.md

This document specifies the campaign lifecycle of the `affiliate-backlink-engine`. It is the canonical reference for the campaign state machine, the evidence requirements for `LINK_ACQUIRED`, the verifier function contract, revalidation rules, action history, campaign types, the planner, and a fully worked end-to-end example. All states, transitions, evidence maps, and function names referenced here are matched exactly to the source files `src/domain/campaign.ts`, `src/campaigns/planner.ts`, and `src/campaigns/tracker.ts`. The engine is deterministic: any transition not present in the allowed map is forbidden, and any transition into `LINK_ACQUIRED` without verified evidence of kind `acquired_link_observation` is rejected by the tracker.

The lifecycle is intentionally strict because campaigns represent real outreach work that affects the reputation of the brand operating the engine. A false positive in `LINK_ACQUIRED` would corrupt downstream SEO reporting, and a false negative in `STALE` would waste operator cycles on dead opportunities. The state machine therefore errs toward explicit, auditable transitions rather than implicit auto-advancement. Every state change is recorded as a `CampaignAction`, every evidence attachment is recorded, and every outcome is recorded. The history is append-only and timestamped, so the full lifecycle of any campaign can be reconstructed from the action log alone.

## 1. The 14 Lifecycle States

A campaign moves through exactly 14 lifecycle states, declared in `CAMPAIGN_LIFECYCLE_STATES` and individually typed by `CampaignLifecycleState`. The states cover the full path from initial discovery through qualification, content preparation, outreach approval, contact, negotiation, and terminal outcomes. No campaign may exist in a state outside this list, and the tracker refuses any `transition()` call whose target is not one of these values. The states are summarized below and elaborated in the transition table that follows.

1. **DISCOVERED** — The campaign was just created from a set of opportunities and has no content work outstanding. The planner places a freshly minted campaign here when `contentWork.required` is false. It is the entry point of the lifecycle for campaigns that do not need new content assets before outreach can begin.
2. **QUALIFIED** — The campaign has passed initial qualification. The opportunities are sufficiently verified and scored to warrant further investment. From here the campaign may move into content preparation or directly to ready-for-outreach, depending on whether content work is required.
3. **CONTENT_REQUIRED** — The campaign needs content work (page refresh, new asset creation, or content gap closure) before any outreach can proceed. The planner places a campaign here when `contentWork.required` is true. Once the content is ready, the campaign moves to `READY_FOR_OUTREACH`.
4. **READY_FOR_OUTREACH** — Content is ready (or was never required), contacts are verified, and the campaign is queued for operator or PrimeOS approval. No outbound messaging has occurred. The campaign waits here until a human or external approver transitions it to `OUTREACH_APPROVED`.
5. **OUTREACH_APPROVED** — Risk, strategy, and content have been approved by the operator (or by PrimeOS in an integrated deployment). Outreach is authorized. This state is the gate between planning and execution; once entered, the campaign may move forward to `CONTACTED`, may be declined, may go stale, or, if the link is already observed live, may transition directly to `LINK_ACQUIRED`.
6. **CONTACTED** — The first outreach message has been sent to one or more prospects. The campaign now enters the wait window. From here the campaign may move to `FOLLOW_UP_DUE`, `REPLIED`, `NO_RESPONSE`, or, if the link is observed live, directly to `LINK_ACQUIRED`.
7. **FOLLOW_UP_DUE** — The wait window elapsed without a reply, and a follow-up is now scheduled or due. The campaign may return to `CONTACTED` (a follow-up was sent), move forward to `REPLIED`, transition to `NO_RESPONSE`, or move to `LINK_ACQUIRED` if the verifier confirms the link is live.
8. **REPLIED** — At least one prospect has replied. The campaign is in active conversation. It may move into `NEGOTIATING`, decline, go stale, become invalid, or transition to `LINK_ACQUIRED` if the prospect has placed the link and the verifier confirms it.
9. **NEGOTIATING** — The prospect is engaged in negotiation (terms, anchor text, placement, reciprocal considerations within policy). The campaign may end in `LINK_ACQUIRED`, `DECLINED`, `STALE`, or `INVALID`.
10. **LINK_ACQUIRED** — Terminal-with-evidence success state. A live acquired link has been observed and verified. The only exit is to `STALE` (for revalidation later); the link may not be "un-acquired" through this state machine. Entering this state requires verified evidence of kind `acquired_link_observation` (see section 3).
11. **DECLINED** — The prospect declined, or the operator withdrew the campaign. The campaign is closed unsuccessfully. It may later move to `STALE` or `INVALID` for bookkeeping and revalidation.
12. **NO_RESPONSE** — The campaign exhausted outreach and follow-up attempts without any reply. The campaign is closed unsuccessfully. It may be re-contacted later (`CONTACTED`), or move to `STALE` or `INVALID`.
13. **INVALID** — Hard terminal state. The campaign was based on bad input (bad URL, do-not-contact, fraud signal, etc.). No transitions out are allowed; `INVALID` has an empty entry in `ALLOWED_TRANSITIONS`.
14. **STALE** — The campaign has been inactive past the 30-day revalidation window, or was manually marked stale. From `STALE` the only legal move is back to `DISCOVERED`, which restarts the lifecycle with a fresh audit.

## 2. Allowed Transitions Table

The transition map is the single source of truth for what state changes are legal. It is exported as `ALLOWED_TRANSITIONS` from `src/domain/campaign.ts` and re-exported through `src/campaigns/tracker.ts`. The helper `canTransition(from, to)` returns `true` only when `to` is listed under `from` in this map; `assertTransition(from, to)` throws `Illegal campaign transition: {from} -> {to}` otherwise. The tracker calls `assertTransition` on every `transition()` invocation, so any code path that attempts a forbidden move fails loudly instead of silently corrupting state.

| From State           | Allowed To States                                                                        |
| -------------------- | ---------------------------------------------------------------------------------------- |
| `DISCOVERED`         | `QUALIFIED`, `CONTENT_REQUIRED`, `INVALID`, `STALE`                                      |
| `QUALIFIED`          | `CONTENT_REQUIRED`, `READY_FOR_OUTREACH`, `DECLINED`, `INVALID`, `STALE`                 |
| `CONTENT_REQUIRED`   | `READY_FOR_OUTREACH`, `DECLINED`, `INVALID`, `STALE`                                     |
| `READY_FOR_OUTREACH` | `OUTREACH_APPROVED`, `DECLINED`, `STALE`, `INVALID`                                      |
| `OUTREACH_APPROVED`  | `CONTACTED`, `DECLINED`, `STALE`, `INVALID`, `LINK_ACQUIRED`                             |
| `CONTACTED`          | `FOLLOW_UP_DUE`, `REPLIED`, `NO_RESPONSE`, `STALE`, `INVALID`, `LINK_ACQUIRED`           |
| `FOLLOW_UP_DUE`      | `CONTACTED`, `REPLIED`, `NO_RESPONSE`, `STALE`, `INVALID`, `LINK_ACQUIRED`               |
| `REPLIED`            | `NEGOTIATING`, `LINK_ACQUIRED`, `DECLINED`, `STALE`, `INVALID`                           |
| `NEGOTIATING`        | `LINK_ACQUIRED`, `DECLINED`, `STALE`, `INVALID`                                          |
| `LINK_ACQUIRED`      | `STALE`                                                                                  |
| `DECLINED`           | `STALE`, `INVALID`                                                                       |
| `NO_RESPONSE`        | `CONTACTED`, `STALE`, `INVALID`                                                          |
| `INVALID`            | (none)                                                                                   |
| `STALE`              | `DISCOVERED`                                                                             |

The transitions where `OUTREACH_APPROVED`, `CONTACTED`, and `FOLLOW_UP_DUE` may move directly to `LINK_ACQUIRED` are explicit in the map and reflect a real-world pattern: sometimes the prospect places the link without further negotiation, sometimes the link is already live when outreach was sent, and sometimes a follow-up surfaces that the link has been added. In all three cases the same evidence requirement applies: the tracker refuses the transition unless verified evidence of kind `acquired_link_observation` is supplied. The transition legality (allowed by the map) and the evidence requirement (enforced by `REQUIRES_EVIDENCE_FOR`) are independent checks; both must pass for the transition to complete.

`INVALID` is the only state with an empty transition list, which makes it a true terminal. `LINK_ACQUIRED` is terminal in practice but allows `STALE` so that long-acquired links can be periodically re-checked and aged out if they disappear. `isTerminal(s)` returns true for `INVALID` and for any state whose transition list is empty.

## 3. Evidence Requirement for LINK_ACQUIRED

The engine does not auto-advance a campaign to `LINK_ACQUIRED`. This is a non-negotiable rule of the project: claiming a backlink was acquired without verified evidence would violate the verification contract documented in `README.md` and `EVE_VERIFICATION_CONTRACT.md`. The mechanism that enforces this rule is the `REQUIRES_EVIDENCE_FOR` map, exported from `src/domain/campaign.ts`:

```ts
export const REQUIRES_EVIDENCE_FOR: Partial<Record<CampaignLifecycleState, "acquired_link_observation">> = {
  LINK_ACQUIRED: "acquired_link_observation"
};
```

When `CampaignTracker.transition(campaignId, "LINK_ACQUIRED", opts)` is called, the tracker inspects `REQUIRES_EVIDENCE_FOR["LINK_ACQUIRED"]`, finds that it requires an `acquired_link_observation` evidence kind, and delegates to `verifyEvidenceForTransition`. The verification logic in `InMemoryCampaignTracker` operates in two modes:

1. **Verified-evidence path (preferred).** If `opts.evidence` is a non-empty array of `EvidenceRecord` objects, the tracker requires that at least one record (a) has its `id` listed in `opts.evidenceIds`, (b) has `kind === "acquired_link_observation"`, and (c) has `verification === "VERIFIED"`. All three conditions must hold simultaneously. This is the path used when `verifyAcquiredLink` produces the evidence record.
2. **Operator-trust fallback.** If no `EvidenceRecord` objects are supplied but `opts.evidenceIds` is a non-empty array, the tracker trusts the operator's claim that the named evidence exists and is verified. This path exists to support integration scenarios where the calling system maintains its own evidence store and only passes ids across the boundary. It is the operator's responsibility to ensure the named evidence actually exists and is verified; misuse of this path is an audit failure, not an engine failure.

If neither path succeeds, the tracker throws `Transition {from} -> LINK_ACQUIRED requires verified evidence of kind "acquired_link_observation". Provide evidenceIds / evidence.` and the campaign remains in its prior state. No partial update is committed. The unit test `LINK_ACQUIRED requires verified evidence` in `tests/campaigns.test.ts` exercises both paths: a bare transition with no evidence throws, while a transition with `{ evidenceIds: ["evd_1"] }` succeeds via the operator-trust fallback.

## 4. verifyAcquiredLink Verifier Function Contract

`verifyAcquiredLink` is the canonical way to produce the evidence required for a `LINK_ACQUIRED` transition. It is exported from `src/campaigns/tracker.ts` and is the function E.V.E. (or any external verifier) is expected to call. Its signature is:

```ts
export async function verifyAcquiredLink(
  tracker: CampaignTracker,
  campaignId: string,
  verifier: () => Promise<{ live: boolean; url: string; detail?: string }>,
  recordEvidence: (e: Omit<EvidenceRecord, "id">) => EvidenceRecord,
  now: number = Date.now()
): Promise<{ live: boolean; action: CampaignAction }>;
```

The contract is as follows. The caller supplies a `verifier` function that performs the actual HTTP fetch or browser check and returns `{ live, url, detail }`. The engine itself never performs network I/O; it records what the verifier reports. `recordEvidence` is the evidence sink (typically `InMemoryEvidenceStore.prototype.record` or an external store implementing `EvidenceContract`). The function executes the verifier, then constructs an `EvidenceRecord` with `kind` set to `acquired_link_observation` if `live` is true, or `outcome_observation` if `live` is false. The `verification` field is set to `"VERIFIED"` when the link is live and `"UNAVAILABLE"` when it is not. The `subjectId` is a deterministic id derived from the campaign id; the `source` is `{ adapter: "link-verifier", providerKind: "crawl" }`; the `payload` carries the observed `url` and any `detail`.

The function then calls `tracker.recordOutcome(campaignId, { kind: result.live ? "link_acquired" : "link_not_found", detail, verifiedAt: now }, [ev.id])`. `recordOutcome` pushes a `CampaignAction` whose `kind` is `link_verified_acquired` (when the outcome is `link_acquired`) or `manual_override` (otherwise). When the outcome is `link_acquired` and at least one evidence id is supplied, `recordOutcome` internally calls `tracker.transition(campaignId, "LINK_ACQUIRED", { evidenceIds })`. Because the supplied evidence has `verification === "VERIFIED"` and `kind === "acquired_link_observation"`, the transition's verified-evidence path succeeds. If `live` is false, no `LINK_ACQUIRED` transition is attempted; the campaign remains in its current state and the negative outcome is recorded for audit. The function returns `{ live, action }` to the caller.

The verifier contract is deliberately adapter-agnostic: the engine does not care whether the verifier is a headless browser, an HTTP client with HTML parsing, a third-party link index, or a manual operator check. It only cares that the verifier returns the `{ live, url, detail }` shape. This allows Foundry, E.V.E., or any future operator to plug in their own verification implementation while the engine continues to enforce the evidence contract.

## 5. Revalidation

Campaigns that are not actively worked tend to drift out of relevance: prospects change roles, pages get redesigned, broken links get fixed by their owners, and contact addresses go stale. The tracker exposes `revalidate(campaignId, now?)` to enforce a 30-day inactivity cutoff. The implementation in `InMemoryCampaignTracker` computes `ageMs = now - c.updatedAt` and compares it to `30 * 24 * 60 * 60 * 1000` (thirty days in milliseconds). If the age exceeds that threshold, `canTransition(c.state, "STALE")` is true, and the campaign is not already in `LINK_ACQUIRED`, the tracker transitions the campaign to `STALE` with the note `"Auto-revalidated to STALE after 30d inactivity."`. The transition produces a normal `CampaignAction` of kind `state_transition`, so the revalidation is auditable.

The `LINK_ACQUIRED` exemption is intentional. A successfully acquired link should not be flipped to `STALE` merely because 30 days have passed; it should be re-checked by re-running `verifyAcquiredLink`, which can be scheduled independently. If a re-check fails (the link has been removed), the operator can manually transition `LINK_ACQUIRED` -> `STALE` (the only legal exit from that state) and then `STALE` -> `DISCOVERED` to restart the lifecycle. The unit test `revalidate transitions stale campaigns to STALE` in `tests/campaigns.test.ts` constructs a campaign with `updatedAt` set 31 days in the past and asserts that `revalidate` returns a campaign in state `STALE`.

Revalidation is intended to be run on a schedule by an external orchestrator (Foundry in the integrated deployment). The engine does not run a background timer; it provides the function and expects the caller to invoke it for each campaign on a cadence appropriate to the deployment. The 30-day window is a constant in the tracker implementation, not a configuration value, to keep the contract explicit and testable.

## 6. CampaignAction History

Every meaningful event in a campaign's life is recorded as a `CampaignAction`. The action log is append-only: actions are pushed to the `actions` array and never removed or mutated. Each action carries `id`, `campaignId`, optional `opportunityId` and `prospectId`, a `kind`, optional `fromState` / `toState` (for transitions), optional `note`, optional `evidenceIds`, optional `outcome`, a mandatory `at` timestamp, and an optional `actor`. The `kind` field is the discriminator:

| Kind                       | Recorded When                                                                              |
| -------------------------- | ------------------------------------------------------------------------------------------ |
| `state_transition`         | Any `transition()` call succeeds, including the implicit transition recorded by `create()`. |
| `note`                     | `note(campaignId, body, actor)` is called.                                                 |
| `evidence_attached`        | `attachEvidence(campaignId, evidenceId, note?)` is called.                                 |
| `outreach_sent`            | Reserved for outreach execution integrations (Foundry) to record via `note` or `manual_override`. |
| `follow_up_scheduled`      | Reserved for follow-up scheduling integrations.                                            |
| `link_verified_acquired`   | `recordOutcome` is called with `outcome.kind === "link_acquired"`.                          |
| `link_verification_failed` | Reserved for negative verification outcomes recorded via `recordOutcome` with `link_not_found`. |
| `revalidation`             | Reserved for explicit revalidation actions (the tracker uses `state_transition` with a note). |
| `risk_flag_added`          | Reserved for risk-flag additions recorded via `note` or `manual_override`.                 |
| `manual_override`          | `recordOutcome` is called with a non-`link_acquired` outcome, or any manual action that does not match a more specific kind. |

The `outcome` sub-object, when present, has `kind` (`link_acquired`, `link_not_found`, `declined`, `no_response`, `replied`, or `other`), an optional `detail` string, and an optional `verifiedAt` timestamp. The `actionsFor(campaignId)` method returns the filtered, time-sorted list of actions for a single campaign, which is the primary input for audit reports and for reconstructing the lifecycle after the fact. The `create(c)` method itself records an initial `state_transition` action with `actor: "system"` and a note `Campaign created in state {state}.`, so every campaign has at least one action from the moment it enters the tracker.

The action log is the integration surface for downstream reporting systems. A consumer that reads only the `actions` array can reproduce the full campaign history without needing the live `Campaign` objects, which makes it suitable for shipping to a data warehouse or to PrimeOS for oversight. Actions are intentionally lightweight (no nested evidence payloads, only evidence ids) so the log remains compact even for high-volume deployments.

## 7. Campaign Types

A `CampaignType` declares what kind of outreach work the campaign represents. The type drives default objective text, default outreach angle, success criteria, prerequisites, and content-work computation in the planner. The full union, declared in `src/domain/campaign.ts`, is:

| Type                       | Purpose                                                                                                                                                                                     |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `broken_link`              | Replace broken outbound links on third-party pages with our topical replacement pages. Prerequisite: re-verify each broken link's HTTP state before outreach.                                |
| `resource_page`            | Earn inclusion on curated resource pages by suggesting a genuinely useful addition. Success: at least one inclusion on a relevant resource page.                                            |
| `competitor_gap`           | Close the backlink gap versus competitors by acquiring links from domains that previously linked only to a competitor. Prerequisite: confirm competitor backlinks are not paid or exclusive. |
| `linkable_asset`           | Build a new linkable asset (research, tool, data, calculator) and earn citations to it. Prerequisite: create the asset before any outreach.                                                 |
| `content_refresh_first`    | Refresh existing pages (typically HIGH-priority refresh candidates) to unlock outreach. Outreach begins only after refresh is complete.                                                      |
| `digital_pr_data_asset`    | Promote original data assets for digital PR citations (statistics, original research, expert roundups).                                                                                     |
| `internal_link`            | Improve internal link structure for authority flow (orphans, weak commercial pages, depth). No external outreach; the planner's outreach angle for this type is `(Internal; no external outreach.)`. |
| `mixed`                    | Tailored per opportunity; used for opportunities of kind `other` or for hybrid campaigns.                                                                                                   |

The planner maps opportunity kinds to campaign types as follows: `broken_link` -> `broken_link`, `resource_page` -> `resource_page`, `competitor_backlink_gap` -> `competitor_gap`, `linkable_asset` -> `linkable_asset`, `unlinked_mention` -> `digital_pr_data_asset`, `internal_link` -> `internal_link`, `directory` -> `resource_page`, `expert_roundup` -> `digital_pr_data_asset`, `statistics_citation` -> `digital_pr_data_asset`, and `other` -> `mixed`. Note that the type union in `src/domain/campaign.ts` also includes `unlinked_mention`, which exists for forward compatibility but is not produced by the planner's mapping; the planner maps `unlinked_mention` opportunities to the `digital_pr_data_asset` campaign type because unlinked mentions are most naturally monetized through digital PR outreach.

Each type produces distinct success criteria. A `broken_link` campaign requires acquiring at least one replacement link from a contacted source and that all replacement targets are reachable and topical. A `linkable_asset` campaign requires producing the suggested linkable asset and acquiring at least one citation to the new asset. A `content_refresh_first` campaign requires refreshing the high-priority pages and re-crawling to confirm improved internal connectivity. An `internal_link` campaign requires implementing the suggested internal links and reducing orphan page count by at least 50 percent. These criteria are recorded in `campaign.successCriteria` at creation time and are the basis for downstream success measurement.

## 8. Campaign Planner

The planner is exported from `src/campaigns/planner.ts`. Its primary entry point is `planCampaign(input: CampaignPlanInput): Campaign`. The input requires `siteProfileId`, `name`, `type`, `opportunities`, and `brandName`, and optionally accepts `contentMatches`, `refreshPriorities`, `objective`, `outreachAngle`, and `now`. The planner computes `contentWork` from the type and the supplied content matches or refresh priorities, computes `successCriteria` and `prerequisites` from the type, defaults the `objective` and `outreachAngle` from the type and brand name when not overridden, and computes `priority` as the average of the opportunities' `score.total` values (defaulting to 50 when scores are absent). The initial state is `CONTENT_REQUIRED` when `contentWork.required` is true and `DISCOVERED` otherwise.

The second entry point is `autoPlanCampaigns(siteProfileId, brandName, opps, refreshPriorities?, contentMatches?, now?)`. It groups opportunities by `kind` via `groupOpportunitiesByKind`, applies the kind-to-type mapping, and creates one campaign per non-empty group. After the per-kind campaigns are planned, the function inspects `refreshPriorities` for entries with `priority === "HIGH"`; if any exist, it appends one additional `content_refresh_first` campaign whose `opportunities` array is empty and whose `refreshPriorities` are the HIGH-priority subset. The test `autoPlanCampaigns creates one campaign per kind + refresh-first if HIGH` asserts this behavior with one broken-link opportunity and one HIGH refresh priority, expecting exactly two campaigns: one of type `broken_link` and one of type `content_refresh_first`.

The planner's outputs are pure data: a `Campaign` or an array of `Campaign` objects. The planner does not touch the tracker, does not record actions, and does not perform any I/O. This makes it trivially testable and allows the caller (CLI, library consumer, or external orchestrator) to decide whether and when to register the campaigns with a tracker. The CLI's `campaign create` command wraps `planCampaign` and emits the resulting campaign as JSON; the CLI's `campaign list` and `campaign export` commands operate on JSON files of campaigns without requiring a live tracker.

## 9. Worked Example

This example walks through creating a broken-link campaign and transitioning it through the full lifecycle to `LINK_ACQUIRED` with verified evidence. It mirrors the test cases in `tests/campaigns.test.ts`.

Step 1: Create the campaign via the planner.

```ts
import { planCampaign } from "./src/campaigns/planner.js";
import { InMemoryCampaignTracker } from "./src/campaigns/tracker.js";

const campaign = planCampaign({
  siteProfileId: "site_panticandy",
  name: "Broken-link outreach Q1",
  type: "broken_link",
  opportunities: [brokenOpp1, brokenOpp2], // BrokenLinkOpportunity[]
  brandName: "PantiCandy"
});
// campaign.state === "DISCOVERED" (no content work required)
// campaign.successCriteria includes:
//   "Acquire >= 1 replacement link from a contacted source."
// campaign.prerequisites includes:
//   "Re-verify each broken link's HTTP state before outreach."
//   "Verify contact information via a permitted source."
//   "Honor do-not-contact list."
```

Step 2: Register the campaign with a tracker.

```ts
const tracker = new InMemoryCampaignTracker();
tracker.create(campaign);
// tracker.actionsFor(campaign.id) now contains one action of kind "state_transition"
// with actor "system" and note "Campaign created in state DISCOVERED."
```

Step 3: Qualify and prepare content. Suppose content work is required because a content match has `matchLevel !== "direct"`.

```ts
tracker.transition(campaign.id, "QUALIFIED", { actor: "operator" });
tracker.transition(campaign.id, "CONTENT_REQUIRED", { actor: "operator" });
// Content team produces the refresh or new asset.
tracker.transition(campaign.id, "READY_FOR_OUTREACH", { actor: "operator" });
```

Step 4: PrimeOS (or an operator) approves outreach.

```ts
tracker.transition(campaign.id, "OUTREACH_APPROVED", {
  actor: "primeos",
  note: "Risk + strategy approved by PrimeOS."
});
```

Step 5: Foundry executes the outreach and the campaign moves to `CONTACTED`.

```ts
tracker.transition(campaign.id, "CONTACTED", {
  actor: "foundry",
  note: "First outreach email sent via Foundry adapter."
});
```

Step 6: The prospect replies. The campaign moves to `REPLIED`.

```ts
tracker.transition(campaign.id, "REPLIED", {
  actor: "operator",
  note: "Prospect confirmed interest; will add the link."
});
```

Step 7: E.V.E. verifies that the acquired link is live.

```ts
import { verifyAcquiredLink } from "./src/campaigns/tracker.js";
import { InMemoryEvidenceStore } from "./src/domain/evidence.js";

const store = new InMemoryEvidenceStore();
const result = await verifyAcquiredLink(
  tracker,
  campaign.id,
  async () => ({ live: true, url: "https://prospect.example/article#pantiCandy" }),
  (e) => store.record(e)
);
// result.live === true
// tracker.get(campaign.id).state === "LINK_ACQUIRED"
// store.all() contains one EvidenceRecord with:
//   kind: "acquired_link_observation"
//   verification: "VERIFIED"
// tracker.actionsFor(campaign.id) contains:
//   - one "link_verified_acquired" action with outcome.kind === "link_acquired"
//   - one "state_transition" action REPLIED -> LINK_ACQUIRED with evidenceIds: [<ev.id>]
```

If at step 7 the verifier had returned `{ live: false, url: ... }`, the function would have recorded an `outcome_observation` evidence record with `verification: "UNAVAILABLE"`, pushed a `link_verification_failed` / `manual_override` action with `outcome.kind === "link_not_found"`, and the campaign would have remained in `REPLIED`. No `LINK_ACQUIRED` transition would have been attempted. This is the core safety property of the lifecycle: a campaign cannot reach `LINK_ACQUIRED` without a verified live-link observation, and the verifier function is the only sanctioned way to produce that observation.
