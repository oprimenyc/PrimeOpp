import { describe, it, expect } from 'vitest';
import { buildAffiliateLink, validateAffiliateLink, detectAffiliateHijack, estimateCommission, listTestNetworks } from '../src/index.js';
import { money } from '@primeopp-deal-intelligence/contracts';

const nets = listTestNetworks();
const prog = { network: nets[0], merchantId: 'amzn-1', merchantName: 'Amazon', defaultCommissionPct: 4 };

describe('affiliate-engine', () => {
  it('builds a valid affiliate link with disclosure', () => {
    const r = buildAffiliateLink({
      program: prog,
      destinationUrl: 'https://www.amazon.com/dp/B0XYZ',
      allowedDomains: ['www.amazon.com']
    });
    expect(r.rejected).toBe(false);
    expect(r.link?.disclosureRequired).toBe(true);
    expect(r.link?.disclosureText).toMatch(/affiliate/i);
    expect(r.link?.domainValidated).toBe(true);
  });
  it('rejects non-HTTPS', () => {
    const r = buildAffiliateLink({
      program: prog,
      destinationUrl: 'http://www.amazon.com/dp/B0XYZ',
      allowedDomains: ['www.amazon.com']
    });
    expect(r.rejected).toBe(true);
  });
  it('rejects unauthorized merchant domain', () => {
    const r = buildAffiliateLink({
      program: prog,
      destinationUrl: 'https://evil.com/dp/B0XYZ',
      allowedDomains: ['www.amazon.com']
    });
    expect(r.rejected).toBe(true);
  });
  it('validateAffiliateLink flags missing disclosure', () => {
    const link = { id: 'a', program: prog, destinationUrl: 'https://www.amazon.com/x', trackingUrl: 'https://track.test.local/?to=x', campaignTags: {}, disclosureRequired: false, disclosureText: '', domainValidated: true, createdAt: '2024-01-01T00:00:00Z' };
    const v = validateAffiliateLink(link as any, ['www.amazon.com']);
    expect(v.valid).toBe(false);
  });
  it('detectAffiliateHijack flags malicious tracking URL', () => {
    const link = { id: 'a', program: prog, destinationUrl: 'https://www.amazon.com/x', trackingUrl: 'https://evil.com/r', campaignTags: {}, disclosureRequired: true, disclosureText: 'affiliate', domainValidated: true, createdAt: '2024-01-01T00:00:00Z' };
    expect(detectAffiliateHijack(link as any, ['www.amazon.com'])).toBe(true);
  });
  it('estimateCommission returns undefined when pct missing', () => {
    const link = { id: 'a', program: { ...prog, defaultCommissionPct: undefined }, destinationUrl: 'x', trackingUrl: 'y', campaignTags: {}, disclosureRequired: true, disclosureText: 'affiliate', domainValidated: true, createdAt: '2024-01-01T00:00:00Z' };
    expect(estimateCommission(link as any, money(10000))).toBeUndefined();
  });
  it('estimateCommission computes when pct present', () => {
    const link = { id: 'a', program: prog, destinationUrl: 'x', trackingUrl: 'y', campaignTags: {}, disclosureRequired: true, disclosureText: 'affiliate', domainValidated: true, createdAt: '2024-01-01T00:00:00Z' };
    expect(estimateCommission(link as any, money(10000))?.amountMinor).toBe(400);
  });
});
