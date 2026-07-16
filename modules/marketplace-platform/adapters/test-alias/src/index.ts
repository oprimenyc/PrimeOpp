// @primeopp-marketplace/test-alias
// TEST-ONLY adapter stub for Alias. NO LIVE CONNECTIVITY.
// This adapter simulates Alias marketplace behavior for local development,
// testing, and workflow proofs. It must NEVER be presented as a live integration.
import type {
  CanonicalListing, ChannelManifest, Money, EvidenceRecord
} from '@primeopp-marketplace/contracts';
import { getManifest } from '@primeopp-marketplace/channel-registry';
import type { MarketplaceChannelAdapter } from '@primeopp-marketplace/adapter-sdk';

let counter = 0;
function newId(prefix: string): string {
  counter += 1;
  return `${prefix}_${Date.now().toString(36)}_${counter.toString(36)}`;
}

function fakeEvidenceRecord(tenantId: string, kind: string, description: string, subjectId: string, payload: Readonly<Record<string, unknown>>): EvidenceRecord {
  return {
    evidenceId: newId('ev'),
    hash: 'test-' + Math.random().toString(36).slice(2, 10),
    timestamp: new Date().toISOString(),
    tenantId,
    kind,
    description,
    actor: { actorType: 'adapter', actorId: 'test-alias', tenantId },
    subject: { type: 'listing', id: subjectId },
    payload
  } as unknown as EvidenceRecord;
}

export class ALIATestAdapter implements MarketplaceChannelAdapter {
  readonly adapterId = 'test-alias_adapter';
  readonly version = '0.1.0-test';
  readonly channelId = 'test-alias';
  readonly manifest: ChannelManifest = getManifest('test-alias')!;
  readonly capabilities = this.manifest.listingCapabilities;
  readonly authenticationRequirements = ['test_only'];
  readonly supportedRegions = [{ country: 'US' }];
  readonly supportedCategories = this.manifest.supportedCategories;
  readonly rateLimits = { requestsPerSecond: 1, requestsPerDay: 100, burst: 5 };
  readonly browserRequirements = this.manifest.browserRequirement;
  readonly retrySemantics = 'at_least_once' as const;
  readonly idempotencySupport = true;
  readonly evidenceSupport = true;
  readonly verificationSupport = true;
  readonly limitations = [
    'TEST-ONLY adapter — no live connectivity',
    'All operations return simulated results',
    'Must NEVER be presented as a live integration'
  ];
  readonly termsRestrictions: readonly string[] = ['test_only_use'];

  async healthCheck(): Promise<{ healthy: boolean; message?: string }> {
    return { healthy: true, message: 'Alias TEST-ONLY adapter healthy' };
  }

  validateConfiguration(): { valid: boolean; issues: readonly string[] } {
    return { valid: true, issues: [] };
  }

  validateListing(listing: CanonicalListing): { valid: boolean; issues: readonly string[] } {
    const issues: string[] = [];
    if (!listing.title) issues.push('title required');
    return { valid: issues.length === 0, issues };
  }

  transformListing(listing: CanonicalListing): { payload: Readonly<Record<string, unknown>>; warnings: readonly string[] } {
    return {
      payload: { title: listing.title, price: listing.price, quantity: listing.quantity },
      warnings: []
    };
  }

  async publishListing(listing: CanonicalListing): Promise<{ channelListingId: string; evidence: EvidenceRecord }> {
    const channelListingId = newId('alia_list');
    return {
      channelListingId,
      evidence: fakeEvidenceRecord(listing.tenantId, 'test_listing_published', `[TEST-ONLY Alias] published: ${listing.title}`, listing.listingId, { channelListingId })
    };
  }

  async updateListing(channelListingId: string, listing: CanonicalListing): Promise<{ updated: boolean; evidence: EvidenceRecord }> {
    return { updated: true, evidence: fakeEvidenceRecord(listing.tenantId, 'test_listing_updated', `[TEST-ONLY Alias] updated ${channelListingId}`, channelListingId, {}) };
  }

  async pauseListing(channelListingId: string): Promise<{ paused: boolean; evidence: EvidenceRecord }> {
    return { paused: true, evidence: fakeEvidenceRecord('', 'test_listing_paused', `[TEST-ONLY Alias] paused ${channelListingId}`, channelListingId, {}) };
  }

  async resumeListing(channelListingId: string): Promise<{ resumed: boolean; evidence: EvidenceRecord }> {
    return { resumed: true, evidence: fakeEvidenceRecord('', 'test_listing_resumed', `[TEST-ONLY Alias] resumed ${channelListingId}`, channelListingId, {}) };
  }

  async endListing(channelListingId: string): Promise<{ ended: boolean; evidence: EvidenceRecord }> {
    return { ended: true, evidence: fakeEvidenceRecord('', 'test_listing_ended', `[TEST-ONLY Alias] ended ${channelListingId}`, channelListingId, {}) };
  }

  async retrieveListing(channelListingId: string): Promise<{ listing: unknown } | { notFound: true }> {
    void channelListingId;
    return { notFound: true };
  }

  async retrieveListingStatus(channelListingId: string): Promise<{ state: string }> {
    void channelListingId;
    return { state: 'unknown_test_only' };
  }

  async syncInventory(channelListingId: string, quantity: number): Promise<{ synced: boolean; evidence: EvidenceRecord }> {
    return { synced: true, evidence: fakeEvidenceRecord('', 'test_inventory_synced', `[TEST-ONLY Alias] synced qty=${quantity}`, channelListingId, { quantity }) };
  }

  async syncPrice(channelListingId: string, price: Money): Promise<{ synced: boolean; evidence: EvidenceRecord }> {
    return { synced: true, evidence: fakeEvidenceRecord('', 'test_price_synced', `[TEST-ONLY Alias] synced price=${price.amount}`, channelListingId, { price }) };
  }

  async retrieveOffers(channelListingId: string): Promise<{ offers: unknown[] }> {
    void channelListingId;
    return { offers: [] };
  }

  async respondToOffer(offerId: string, response: 'accept' | 'decline' | 'counter', counterAmount?: Money): Promise<{ responded: boolean; evidence: EvidenceRecord }> {
    void offerId; void response; void counterAmount;
    return { responded: true, evidence: fakeEvidenceRecord('', 'test_offer_responded', `[TEST-ONLY Alias] responded`, offerId, {}) };
  }

  async retrieveMessages(channelListingId: string): Promise<{ messages: unknown[] }> {
    void channelListingId;
    return { messages: [] };
  }

  async sendMessage(channelListingId: string, body: string): Promise<{ sent: boolean; evidence: EvidenceRecord }> {
    void channelListingId;
    return { sent: true, evidence: fakeEvidenceRecord('', 'test_message_sent', body.slice(0, 80), channelListingId, {}) };
  }

  async retrieveOrders(since?: string): Promise<{ orders: unknown[] }> {
    void since;
    return { orders: [] };
  }

  async acknowledgeOrder(channelOrderId: string): Promise<{ acknowledged: boolean; evidence: EvidenceRecord }> {
    return { acknowledged: true, evidence: fakeEvidenceRecord('', 'test_order_acknowledged', `[TEST-ONLY Alias] ack ${channelOrderId}`, channelOrderId, {}) };
  }

  async cancelOrder(channelOrderId: string, reason: string): Promise<{ cancelled: boolean; evidence: EvidenceRecord }> {
    return { cancelled: true, evidence: fakeEvidenceRecord('', 'test_order_cancelled', `[TEST-ONLY Alias] cancel ${channelOrderId}: ${reason}`, channelOrderId, { reason }) };
  }

  async retrieveReturns(since?: string): Promise<{ returns: unknown[] }> {
    void since;
    return { returns: [] };
  }

  async retrieveFees(): Promise<{ fees: unknown }> {
    return { fees: { testOnly: true, commissionRatePercent: 10, description: 'TEST-ONLY fee schedule' } };
  }

  async verifyListing(channelListingId: string): Promise<{ verified: boolean; evidence: EvidenceRecord }> {
    return { verified: true, evidence: fakeEvidenceRecord('', 'test_listing_verified', `[TEST-ONLY Alias] verify ${channelListingId}`, channelListingId, {}) };
  }

  async verifyOrder(channelOrderId: string): Promise<{ verified: boolean; evidence: EvidenceRecord }> {
    return { verified: true, evidence: fakeEvidenceRecord('', 'test_order_verified', `[TEST-ONLY Alias] verify ${channelOrderId}`, channelOrderId, {}) };
  }

  async shutdown(): Promise<void> {}
}

export function createALIATestAdapter(): ALIATestAdapter {
  return new ALIATestAdapter();
}
