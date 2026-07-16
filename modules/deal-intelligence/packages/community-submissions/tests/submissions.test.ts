import { describe, it, expect } from 'vitest';
import { CommunitySubmissionStore, redactForPublic, SUBMISSION_STATES } from '../src/index.js';
import { money } from '@primeopp-deal-intelligence/contracts';

describe('community-submissions', () => {
  it('submit creates a RECEIVED submission', () => {
    const s = new CommunitySubmissionStore();
    const sub = s.submit({
      tenantId: 't1' as any, contributorId: 'u1',
      url: 'https://www.amazon.com/dp/B0X', observedPrice: money(999)
    });
    expect(sub.state).toBe('RECEIVED');
    expect(sub.id).toMatch(/^sub_/);
  });
  it('duplicate detection marks DUPLICATE for same URL+contributor within 24h', () => {
    const s = new CommunitySubmissionStore();
    s.submit({ tenantId: 't1' as any, contributorId: 'u1', url: 'https://x.com/p', observedAt: '2024-01-01T00:00:00Z' });
    const dup = s.submit({ tenantId: 't1' as any, contributorId: 'u1', url: 'https://x.com/p', observedAt: '2024-01-01T12:00:00Z' });
    expect(dup.state).toBe('DUPLICATE');
    expect(dup.duplicateOf).toBeTruthy();
  });
  it('moderate updates reputation positively on VERIFIED', () => {
    const s = new CommunitySubmissionStore();
    const sub = s.submit({ tenantId: 't1' as any, contributorId: 'u1', url: 'https://x.com/p' });
    s.moderate(sub.id, 'VERIFIED', 'mod1');
    expect(s.reputationOf('u1')).toBe(1);
  });
  it('moderate updates reputation negatively on REJECTED', () => {
    const s = new CommunitySubmissionStore();
    const sub = s.submit({ tenantId: 't1' as any, contributorId: 'u1' });
    s.moderate(sub.id, 'REJECTED', 'mod1');
    expect(s.reputationOf('u1')).toBe(-1);
  });
  it('public list redacts contributorId', () => {
    const s = new CommunitySubmissionStore();
    s.submit({ tenantId: 't1' as any, contributorId: 'secret-user' });
    const pub = s.list();
    expect(pub[0].contributorId).toBe('redacted');
  });
  it('redactForPublic strips comments', () => {
    const sub = { id: 'x' as any, tenantId: 't' as any, contributorId: 'u', state: 'RECEIVED' as const, observedAt: '2024-01-01T00:00:00Z', evidence: [], comments: 'private note' };
    expect(redactForPublic(sub as any).comments).toBeUndefined();
  });
  it('SUBMISSION_STATES includes all required states', () => {
    for (const s of ['RECEIVED','DUPLICATE','VALIDATING','VERIFIED','VERIFIED_WITH_CONDITIONS','NEEDS_MORE_EVIDENCE','REJECTED','PUBLISHED','EXPIRED']) {
      expect(SUBMISSION_STATES).toContain(s as any);
    }
  });
});
