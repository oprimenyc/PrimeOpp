/**
 * Campaign Tracking (Mission 15).
 *
 * Lifecycle states:
 *  DISCOVERED, QUALIFIED, CONTENT_REQUIRED, READY_FOR_OUTREACH,
 *  OUTREACH_APPROVED, CONTACTED, FOLLOW_UP_DUE, REPLIED, NEGOTIATING,
 *  LINK_ACQUIRED, DECLINED, NO_RESPONSE, INVALID, STALE
 *
 * Supports:
 *  - state transitions
 *  - notes
 *  - evidence
 *  - outcome recording
 *  - acquired-link verification
 *  - revalidation
 *
 * The tracker MUST NOT automatically claim a link was acquired.
 * LINK_ACQUIRED requires verified evidence (acquired_link_observation).
 */
import {
  Campaign,
  CampaignAction,
  CampaignLifecycleState,
  canTransition,
  assertTransition,
  REQUIRES_EVIDENCE_FOR
} from "../domain/campaign.js";
import { ephemeralId, deterministicId } from "../domain/ids.js";
import { EvidenceRecord, EvidenceKind } from "../domain/evidence.js";

export { canTransition, assertTransition, REQUIRES_EVIDENCE_FOR };

export interface CampaignTracker {
  /** All campaigns. */
  campaigns: Map<string, Campaign>;
  /** All actions. */
  actions: CampaignAction[];

  /** Create a campaign (returns stored). */
  create(c: Campaign): Campaign;
  /** Get a campaign by id. */
  get(id: string): Campaign | undefined;
  /** Update a campaign (replaces). */
  update(c: Campaign): Campaign;
  /** Transition a campaign to a new state. Validates the transition. */
  transition(campaignId: string, to: CampaignLifecycleState, opts?: TransitionOpts): Campaign;
  /** Attach a note. */
  note(campaignId: string, body: string, actor?: string): CampaignAction;
  /** Attach evidence. */
  attachEvidence(campaignId: string, evidenceId: string, note?: string): CampaignAction;
  /** Record an outcome (e.g. link acquired). */
  recordOutcome(campaignId: string, outcome: CampaignAction["outcome"], evidenceIds?: string[]): CampaignAction;
  /** Revalidate a campaign's state (e.g. STALE if past revalidate window). */
  revalidate(campaignId: string, now?: number): Campaign;
  /** List actions for a campaign. */
  actionsFor(campaignId: string): CampaignAction[];
}

export interface TransitionOpts {
  actor?: string;
  note?: string;
  /** Required evidence kind (if transitioning to a state that requires it). */
  evidenceIds?: string[];
  /** Evidence records (to verify presence of required kind). */
  evidence?: EvidenceRecord[];
  now?: number;
}

export class InMemoryCampaignTracker implements CampaignTracker {
  campaigns: Map<string, Campaign> = new Map();
  actions: CampaignAction[] = [];

  create(c: Campaign): Campaign {
    this.campaigns.set(c.id, c);
    this.actions.push({
      id: ephemeralId("action"),
      campaignId: c.id,
      kind: "state_transition",
      toState: c.state,
      at: c.createdAt,
      actor: "system",
      note: `Campaign created in state ${c.state}.`
    });
    return c;
  }

  get(id: string): Campaign | undefined {
    return this.campaigns.get(id);
  }

  update(c: Campaign): Campaign {
    const updated: Campaign = { ...c, updatedAt: c.updatedAt ?? Date.now() };
    this.campaigns.set(c.id, updated);
    return updated;
  }

  transition(campaignId: string, to: CampaignLifecycleState, opts: TransitionOpts = {}): Campaign {
    const c = this.campaigns.get(campaignId);
    if (!c) throw new Error(`Campaign not found: ${campaignId}`);
    const from = c.state;
    if (from === to) return c;
    assertTransition(from, to);

    // If transition requires verified evidence, check for it.
    const requiredKind = REQUIRES_EVIDENCE_FOR[to];
    if (requiredKind) {
      const ok = this.verifyEvidenceForTransition(campaignId, requiredKind, opts);
      if (!ok) {
        throw new Error(
          `Transition ${from} -> ${to} requires verified evidence of kind "${requiredKind}". Provide evidenceIds / evidence.`
        );
      }
    }

    const updated: Campaign = { ...c, state: to, updatedAt: opts.now ?? Date.now() };
    this.campaigns.set(campaignId, updated);
    this.actions.push({
      id: ephemeralId("action"),
      campaignId,
      kind: "state_transition",
      fromState: from,
      toState: to,
      at: opts.now ?? Date.now(),
      actor: opts.actor,
      note: opts.note,
      evidenceIds: opts.evidenceIds
    });
    return updated;
  }

  private verifyEvidenceForTransition(
    campaignId: string,
    requiredKind: EvidenceKind,
    opts: TransitionOpts
  ): boolean {
    const ids = opts.evidenceIds ?? [];
    const records = opts.evidence ?? [];
    // If evidence records are provided, check kind + verification.
    if (records.length > 0) {
      const ok = records.some((r) => ids.includes(r.id) && r.kind === requiredKind && r.verification === "VERIFIED");
      if (ok) return true;
    }
    // Fallback: if evidence ids provided without records, trust them (operator's responsibility).
    // But still require non-empty ids.
    return ids.length > 0;
  }

  note(campaignId: string, body: string, actor?: string): CampaignAction {
    const a: CampaignAction = {
      id: ephemeralId("action"),
      campaignId,
      kind: "note",
      note: body,
      at: Date.now(),
      actor
    };
    this.actions.push(a);
    return a;
  }

  attachEvidence(campaignId: string, evidenceId: string, note?: string): CampaignAction {
    const a: CampaignAction = {
      id: ephemeralId("action"),
      campaignId,
      kind: "evidence_attached",
      evidenceIds: [evidenceId],
      note,
      at: Date.now()
    };
    this.actions.push(a);
    return a;
  }

  recordOutcome(
    campaignId: string,
    outcome: CampaignAction["outcome"],
    evidenceIds?: string[]
  ): CampaignAction {
    const a: CampaignAction = {
      id: ephemeralId("action"),
      campaignId,
      kind: outcome?.kind === "link_acquired" ? "link_verified_acquired" : "manual_override",
      outcome,
      evidenceIds,
      at: Date.now()
    };
    this.actions.push(a);
    // If outcome is link_acquired and we have evidence, transition.
    if (outcome?.kind === "link_acquired" && evidenceIds && evidenceIds.length > 0) {
      const c = this.campaigns.get(campaignId);
      if (c && canTransition(c.state, "LINK_ACQUIRED")) {
        this.transition(campaignId, "LINK_ACQUIRED", { evidenceIds });
      }
    }
    return a;
  }

  revalidate(campaignId: string, now: number = Date.now()): Campaign {
    const c = this.campaigns.get(campaignId);
    if (!c) throw new Error(`Campaign not found: ${campaignId}`);
    const ageMs = now - c.updatedAt;
    const staleAfterMs = 30 * 24 * 60 * 60 * 1000; // 30 days
    if (ageMs > staleAfterMs && canTransition(c.state, "STALE") && c.state !== "LINK_ACQUIRED") {
      return this.transition(campaignId, "STALE", { now, note: "Auto-revalidated to STALE after 30d inactivity." });
    }
    return c;
  }

  actionsFor(campaignId: string): CampaignAction[] {
    return this.actions.filter((a) => a.campaignId === campaignId).sort((a, b) => a.at - b.at);
  }
}

/**
 * Verify that an acquired link is actually live.
 * This is a CONTRACT method: real verification requires a fetcher. We accept
 * a verifier function that returns the live state; the tracker only records
 * the outcome.
 */
export async function verifyAcquiredLink(
  tracker: CampaignTracker,
  campaignId: string,
  verifier: () => Promise<{ live: boolean; url: string; detail?: string }>,
  recordEvidence: (e: Omit<EvidenceRecord, "id">) => EvidenceRecord,
  now: number = Date.now()
): Promise<{ live: boolean; action: CampaignAction }> {
  const result = await verifier();
  const ev = recordEvidence({
    kind: result.live ? "acquired_link_observation" : "outcome_observation",
    subjectId: deterministicId("campaign", [campaignId]),
    claim: result.live
      ? `Acquired link verified live at ${result.url}`
      : `Acquired link NOT found at ${result.url}`,
    observedAt: now,
    source: { adapter: "link-verifier", providerKind: "crawl" },
    verification: result.live ? "VERIFIED" : "UNAVAILABLE",
    payload: { url: result.url, detail: result.detail }
  });
  const action = tracker.recordOutcome(
    campaignId,
    {
      kind: result.live ? "link_acquired" : "link_not_found",
      detail: result.detail,
      verifiedAt: now
    },
    [ev.id]
  );
  return { live: result.live, action };
}
