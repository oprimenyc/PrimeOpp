/**
 * @primeopp-deal-intelligence/community-submissions
 *
 * Community deal submission workflow. Does not expose private contributor
 * information publicly.
 */
import type {
  CommunitySubmission, SubmissionState, TenantId, Money, Evidence, ISO8601,
  SubmissionId, RegionCode
} from '@primeopp-deal-intelligence/contracts';
import { nextId, nowIso } from '@primeopp-deal-intelligence/contracts';

export interface SubmissionInput {
  tenantId: TenantId;
  contributorId: string;
  url?: string;
  photoRef?: string;
  receiptRef?: string;
  store?: string;
  zipCode?: string;
  observedPrice?: Money;
  quantity?: number;
  observedAt?: ISO8601;
  membership?: string;
  comments?: string;
  evidence?: Evidence[];
}

export class CommunitySubmissionStore {
  private subs: CommunitySubmission[] = [];
  private reputation = new Map<string, number>(); // contributorId -> score

  submit(input: SubmissionInput): CommunitySubmission {
    if (!input.contributorId) throw new Error('submit: contributorId required');
    const now = input.observedAt ?? nowIso();
    const sub: CommunitySubmission = {
      id: nextId('sub') as SubmissionId,
      tenantId: input.tenantId,
      contributorId: input.contributorId,
      url: input.url,
      photoRef: input.photoRef,
      receiptRef: input.receiptRef,
      store: input.store,
      zipCode: input.zipCode,
      observedPrice: input.observedPrice,
      quantity: input.quantity,
      observedAt: now,
      membership: input.membership,
      comments: input.comments,
      evidence: input.evidence ?? [],
      state: 'RECEIVED'
    };
    // Duplicate detection: same URL + same contributor within 24h.
    if (input.url) {
      const dup = this.subs.find(s => s.url === input.url && s.contributorId === input.contributorId
        && (Date.parse(now) - Date.parse(s.observedAt)) < 24 * 3600 * 1000);
      if (dup) {
        sub.state = 'DUPLICATE';
        sub.duplicateOf = dup.id;
      }
    }
    this.subs.push(sub);
    return sub;
  }

  moderate(id: string, decision: Exclude<SubmissionState, 'RECEIVED' | 'DUPLICATE'>, moderator: string): CommunitySubmission {
    const sub = this.subs.find(s => s.id === id);
    if (!sub) throw new Error(`moderate: submission ${id} not found`);
    sub.state = decision;
    sub.moderatedAt = nowIso();
    sub.moderatedBy = moderator;
    // Reputation update
    const cur = this.reputation.get(sub.contributorId) ?? 0;
    if (decision === 'VERIFIED' || decision === 'VERIFIED_WITH_CONDITIONS') {
      sub.reputationDelta = +1;
      this.reputation.set(sub.contributorId, cur + 1);
    } else if (decision === 'REJECTED') {
      sub.reputationDelta = -1;
      this.reputation.set(sub.contributorId, cur - 1);
    } else {
      sub.reputationDelta = 0;
    }
    return sub;
  }

  list(): CommunitySubmission[] {
    // Public view: redact contributorId
    return this.subs.map(s => ({ ...s, contributorId: 'redacted' }));
  }

  listForModeration(): CommunitySubmission[] {
    return this.subs.slice();
  }

  reputationOf(contributorId: string): number {
    return this.reputation.get(contributorId) ?? 0;
  }
}

export function redactForPublic(s: CommunitySubmission): CommunitySubmission {
  return { ...s, contributorId: 'redacted', comments: undefined };
}

export const SUBMISSION_STATES: SubmissionState[] = [
  'RECEIVED','DUPLICATE','VALIDATING','VERIFIED',
  'VERIFIED_WITH_CONDITIONS','NEEDS_MORE_EVIDENCE',
  'REJECTED','PUBLISHED','EXPIRED'
];
