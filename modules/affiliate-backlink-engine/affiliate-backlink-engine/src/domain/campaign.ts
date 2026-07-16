/**
 * Campaign entities + lifecycle.
 *
 * Lifecycle states (Mission 15):
 *  DISCOVERED, QUALIFIED, CONTENT_REQUIRED, READY_FOR_OUTREACH,
 *  OUTREACH_APPROVED, CONTACTED, FOLLOW_UP_DUE, REPLIED, NEGOTIATING,
 *  LINK_ACQUIRED, DECLINED, NO_RESPONSE, INVALID, STALE
 *
 * State transitions are deterministic and validated.
 * The engine MUST NOT automatically claim a link was acquired.
 */
import { VerificationStatus } from "./verification.js";

export type CampaignLifecycleState =
  | "DISCOVERED"
  | "QUALIFIED"
  | "CONTENT_REQUIRED"
  | "READY_FOR_OUTREACH"
  | "OUTREACH_APPROVED"
  | "CONTACTED"
  | "FOLLOW_UP_DUE"
  | "REPLIED"
  | "NEGOTIATING"
  | "LINK_ACQUIRED"
  | "DECLINED"
  | "NO_RESPONSE"
  | "INVALID"
  | "STALE";

export const CAMPAIGN_LIFECYCLE_STATES: readonly CampaignLifecycleState[] = [
  "DISCOVERED",
  "QUALIFIED",
  "CONTENT_REQUIRED",
  "READY_FOR_OUTREACH",
  "OUTREACH_APPROVED",
  "CONTACTED",
  "FOLLOW_UP_DUE",
  "REPLIED",
  "NEGOTIATING",
  "LINK_ACQUIRED",
  "DECLINED",
  "NO_RESPONSE",
  "INVALID",
  "STALE"
] as const;

/**
 * Allowed transitions. Anything not listed is forbidden.
 * This makes the state machine explicit and testable.
 */
export const ALLOWED_TRANSITIONS: Record<CampaignLifecycleState, CampaignLifecycleState[]> = {
  DISCOVERED: ["QUALIFIED", "CONTENT_REQUIRED", "INVALID", "STALE"],
  QUALIFIED: ["CONTENT_REQUIRED", "READY_FOR_OUTREACH", "DECLINED", "INVALID", "STALE"],
  CONTENT_REQUIRED: ["READY_FOR_OUTREACH", "DECLINED", "INVALID", "STALE"],
  READY_FOR_OUTREACH: ["OUTREACH_APPROVED", "DECLINED", "STALE", "INVALID"],
  OUTREACH_APPROVED: ["CONTACTED", "DECLINED", "STALE", "INVALID", "LINK_ACQUIRED"],
  CONTACTED: ["FOLLOW_UP_DUE", "REPLIED", "NO_RESPONSE", "STALE", "INVALID", "LINK_ACQUIRED"],
  FOLLOW_UP_DUE: ["CONTACTED", "REPLIED", "NO_RESPONSE", "STALE", "INVALID", "LINK_ACQUIRED"],
  REPLIED: ["NEGOTIATING", "LINK_ACQUIRED", "DECLINED", "STALE", "INVALID"],
  NEGOTIATING: ["LINK_ACQUIRED", "DECLINED", "STALE", "INVALID"],
  LINK_ACQUIRED: ["STALE"],
  DECLINED: ["STALE", "INVALID"],
  NO_RESPONSE: ["CONTACTED", "STALE", "INVALID"],
  INVALID: [],
  STALE: ["DISCOVERED"]
};

export type CampaignType =
  | "broken_link"
  | "resource_page"
  | "competitor_gap"
  | "linkable_asset"
  | "content_refresh_first"
  | "digital_pr_data_asset"
  | "internal_link"
  | "unlinked_mention"
  | "mixed";

export interface Campaign {
  id: string;
  siteProfileId: string;
  name: string;
  type: CampaignType;
  objective: string;
  /** Opportunity ids included in the campaign. */
  opportunityIds: string[];
  /** Outreach prospect ids. */
  prospectIds: string[];
  /** Content work required (page ids or asset descriptions). */
  contentWork: {
    description: string;
    required: boolean;
    /** Page ids on our property that need refresh or creation. */
    pageIds: string[];
  };
  /** Outreach angle. */
  outreachAngle: string;
  /** Success criteria. */
  successCriteria: string[];
  /** Prerequisites. */
  prerequisites: string[];
  /** Overall state (the campaign itself, not per-opportunity). */
  state: CampaignLifecycleState;
  /** Priority 0..100. */
  priority: number;
  createdAt: number;
  updatedAt: number;
  notes?: string;
}

export interface CampaignAction {
  id: string;
  campaignId: string;
  opportunityId?: string;
  prospectId?: string;
  /** Action kind. */
  kind:
    | "state_transition"
    | "note"
    | "evidence_attached"
    | "outreach_sent"
    | "follow_up_scheduled"
    | "link_verified_acquired"
    | "link_verification_failed"
    | "revalidation"
    | "risk_flag_added"
    | "manual_override";
  /** From state, if a transition. */
  fromState?: CampaignLifecycleState;
  /** To state, if a transition. */
  toState?: CampaignLifecycleState;
  /** Note body. */
  note?: string;
  /** Evidence ids attached. */
  evidenceIds?: string[];
  /** Outcome (if any). */
  outcome?: {
    kind: "link_acquired" | "link_not_found" | "declined" | "no_response" | "replied" | "other";
    detail?: string;
    verifiedAt?: number;
  };
  at: number;
  actor?: string;
}

export function canTransition(from: CampaignLifecycleState, to: CampaignLifecycleState): boolean {
  return ALLOWED_TRANSITIONS[from].includes(to);
}

export function assertTransition(from: CampaignLifecycleState, to: CampaignLifecycleState): void {
  if (!canTransition(from, to)) {
    throw new Error(`Illegal campaign transition: ${from} -> ${to}`);
  }
}

export function isTerminal(s: CampaignLifecycleState): boolean {
  return ALLOWED_TRANSITIONS[s].length === 0 || s === "INVALID";
}

/**
 * LINK_ACQUIRED is special: it requires verified evidence (an
 * acquired_link_observation EvidenceRecord). The tracker MUST NOT auto-advance
 * to LINK_ACQUIRED; the verifier must produce evidence first.
 */
export const REQUIRES_EVIDENCE_FOR: Partial<Record<CampaignLifecycleState, "acquired_link_observation">> = {
  LINK_ACQUIRED: "acquired_link_observation"
};
