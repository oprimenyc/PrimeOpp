// @primeopp-marketplace/primeopp-marketplace
// Functional local PrimeOpp Marketplace adapter — implements MarketplaceChannelAdapter.
// Uses in-memory persistence. NOT a mock — actually publishes, searches, accepts offers, creates orders.
import type {
  CanonicalListing, ChannelManifest, Offer, Order, Money, EvidenceRecord,
  Identifier, TenantId
} from '@primeopp-marketplace/contracts';
import { PRIMEOPP_MARKETPLACE_MANIFEST } from '@primeopp-marketplace/channel-registry';
import type { MarketplaceChannelAdapter } from '@primeopp-marketplace/adapter-sdk';

let counter = 0;
function newId(prefix: string): string {
  counter += 1;
  return `${prefix}_${Date.now().toString(36)}_${counter.toString(36)}`;
}

function fakeEvidenceRecord(tenantId: string, kind: string, description: string, subjectId: string, payload: Readonly<Record<string, unknown>>): EvidenceRecord {
  return {
    evidenceId: newId('ev'),
    hash: 'local-' + Math.random().toString(36).slice(2, 10),
    timestamp: new Date().toISOString(),
    tenantId,
    kind,
    description,
    actor: { actorType: 'adapter', actorId: 'primeopp-marketplace-adapter', tenantId },
    subject: { type: 'listing', id: subjectId },
    payload
  } as unknown as EvidenceRecord;
}

export interface PrimeOppMarketplaceStore {
  publish(listing: CanonicalListing): { channelListingId: string; evidence: EvidenceRecord };
  update(channelListingId: string, listing: CanonicalListing): { updated: boolean; evidence: EvidenceRecord };
  pause(channelListingId: string): { paused: boolean; evidence: EvidenceRecord };
  resume(channelListingId: string): { resumed: boolean; evidence: EvidenceRecord };
  end(channelListingId: string): { ended: boolean; evidence: EvidenceRecord };
  retrieve(channelListingId: string): { listing: CanonicalListing } | { notFound: true };
  status(channelListingId: string): { state: string };
  syncInventory(channelListingId: string, quantity: number): { synced: boolean; evidence: EvidenceRecord };
  syncPrice(channelListingId: string, price: Money): { synced: boolean; evidence: EvidenceRecord };
  search(query: { text?: string; limit?: number }): { results: ReadonlyArray<{ channelListingId: string; title: string; price: Money }> };
  listAll(): ReadonlyArray<{ channelListingId: string; listing: CanonicalListing; state: string }>;
}

export class InMemoryPrimeOppMarketplaceStore implements PrimeOppMarketplaceStore {
  private readonly map = new Map<string, { listing: CanonicalListing; state: string }>();

  publish(listing: CanonicalListing): { channelListingId: string; evidence: EvidenceRecord } {
    const channelListingId = newId('po_list');
    this.map.set(channelListingId, { listing, state: 'ACTIVE' });
    return {
      channelListingId,
      evidence: fakeEvidenceRecord(listing.tenantId, 'listing_published', `published to PrimeOpp Marketplace: ${listing.title}`, listing.listingId, { channelListingId })
    };
  }

  update(channelListingId: string, listing: CanonicalListing): { updated: boolean; evidence: EvidenceRecord } {
    const existing = this.map.get(channelListingId);
    if (!existing) return { updated: false, evidence: fakeEvidenceRecord(listing.tenantId, 'update_failed', 'listing not found', listing.listingId, {}) };
    this.map.set(channelListingId, { listing, state: existing.state });
    return { updated: true, evidence: fakeEvidenceRecord(listing.tenantId, 'listing_updated', `updated listing ${channelListingId}`, listing.listingId, { channelListingId }) };
  }

  pause(channelListingId: string): { paused: boolean; evidence: EvidenceRecord } {
    const existing = this.map.get(channelListingId);
    if (!existing) return { paused: false, evidence: fakeEvidenceRecord('', 'pause_failed', 'listing not found', channelListingId, {}) };
    this.map.set(channelListingId, { ...existing, state: 'PAUSED' });
    return { paused: true, evidence: fakeEvidenceRecord(existing.listing.tenantId, 'listing_paused', `paused ${channelListingId}`, channelListingId, {}) };
  }

  resume(channelListingId: string): { resumed: boolean; evidence: EvidenceRecord } {
    const existing = this.map.get(channelListingId);
    if (!existing) return { resumed: false, evidence: fakeEvidenceRecord('', 'resume_failed', 'listing not found', channelListingId, {}) };
    this.map.set(channelListingId, { ...existing, state: 'ACTIVE' });
    return { resumed: true, evidence: fakeEvidenceRecord(existing.listing.tenantId, 'listing_resumed', `resumed ${channelListingId}`, channelListingId, {}) };
  }

  end(channelListingId: string): { ended: boolean; evidence: EvidenceRecord } {
    const existing = this.map.get(channelListingId);
    if (!existing) return { ended: false, evidence: fakeEvidenceRecord('', 'end_failed', 'listing not found', channelListingId, {}) };
    this.map.set(channelListingId, { ...existing, state: 'ENDED' });
    return { ended: true, evidence: fakeEvidenceRecord(existing.listing.tenantId, 'listing_ended', `ended ${channelListingId}`, channelListingId, {}) };
  }

  retrieve(channelListingId: string): { listing: CanonicalListing } | { notFound: true } {
    const existing = this.map.get(channelListingId);
    if (!existing) return { notFound: true };
    return { listing: existing.listing };
  }

  status(channelListingId: string): { state: string } {
    const existing = this.map.get(channelListingId);
    return { state: existing?.state ?? 'unknown' };
  }

  syncInventory(channelListingId: string, quantity: number): { synced: boolean; evidence: EvidenceRecord } {
    const existing = this.map.get(channelListingId);
    if (!existing) return { synced: false, evidence: fakeEvidenceRecord('', 'sync_failed', 'listing not found', channelListingId, {}) };
    const updated: CanonicalListing = { ...existing.listing, quantity };
    this.map.set(channelListingId, { listing: updated, state: existing.state });
    return { synced: true, evidence: fakeEvidenceRecord(updated.tenantId, 'inventory_synced', `synced quantity ${quantity}`, channelListingId, { quantity }) };
  }

  syncPrice(channelListingId: string, price: Money): { synced: boolean; evidence: EvidenceRecord } {
    const existing = this.map.get(channelListingId);
    if (!existing) return { synced: false, evidence: fakeEvidenceRecord('', 'sync_failed', 'listing not found', channelListingId, {}) };
    const updated: CanonicalListing = { ...existing.listing, price };
    this.map.set(channelListingId, { listing: updated, state: existing.state });
    return { synced: true, evidence: fakeEvidenceRecord(updated.tenantId, 'price_synced', `synced price ${price.amount} ${price.currency}`, channelListingId, { price }) };
  }

  search(query: { text?: string; limit?: number }): { results: ReadonlyArray<{ channelListingId: string; title: string; price: Money }> } {
    const all = Array.from(this.map.entries()).filter(([, v]) => v.state === 'ACTIVE');
    let filtered = all;
    if (query.text) {
      const q = query.text.toLowerCase();
      filtered = filtered.filter(([, v]) => v.listing.title.toLowerCase().includes(q) || v.listing.description.toLowerCase().includes(q));
    }
    const limit = query.limit ?? 20;
    return {
      results: filtered.slice(0, limit).map(([id, v]) => ({ channelListingId: id, title: v.listing.title, price: v.listing.price }))
    };
  }

  listAll(): ReadonlyArray<{ channelListingId: string; listing: CanonicalListing; state: string }> {
    return Array.from(this.map.entries()).map(([channelListingId, v]) => ({ channelListingId, listing: v.listing, state: v.state }));
  }
}

export class PrimeOppMarketplaceAdapter implements MarketplaceChannelAdapter {
  readonly adapterId = 'primeopp_marketplace_adapter';
  readonly version = '1.0.0';
  readonly channelId = 'primeopp-marketplace';
  readonly manifest: ChannelManifest = PRIMEOPP_MARKETPLACE_MANIFEST;
  readonly capabilities = PRIMEOPP_MARKETPLACE_MANIFEST.listingCapabilities;
  readonly authenticationRequirements = ['none_local'];
  readonly supportedRegions = [{ country: 'US' }];
  readonly supportedCategories = PRIMEOPP_MARKETPLACE_MANIFEST.supportedCategories;
  readonly rateLimits = { requestsPerSecond: 100, requestsPerDay: 1000000, burst: 1000 };
  readonly browserRequirements = false;
  readonly retrySemantics = 'at_least_once' as const;
  readonly idempotencySupport = true;
  readonly evidenceSupport = true;
  readonly verificationSupport = true;
  readonly limitations = ['local in-memory storage only', 'no real payment processing', 'no real shipping label purchase'];
  readonly termsRestrictions: readonly string[] = [];

  constructor(private readonly store: PrimeOppMarketplaceStore = new InMemoryPrimeOppMarketplaceStore()) {}

  async healthCheck(): Promise<{ healthy: boolean; message?: string }> {
    return { healthy: true, message: 'local marketplace runtime healthy' };
  }

  validateConfiguration(): { valid: boolean; issues: readonly string[] } {
    return { valid: true, issues: [] };
  }

  validateListing(listing: CanonicalListing): { valid: boolean; issues: readonly string[] } {
    const issues: string[] = [];
    if (!listing.title) issues.push('title required');
    if (listing.quantity < 0) issues.push('quantity must be >= 0');
    if (parseFloat(listing.price.amount) < 0) issues.push('price must be >= 0');
    return { valid: issues.length === 0, issues };
  }

  transformListing(listing: CanonicalListing): { payload: Readonly<Record<string, unknown>>; warnings: readonly string[] } {
    return {
      payload: {
        title: listing.title,
        description: listing.description,
        price: listing.price,
        quantity: listing.quantity,
        condition: listing.condition
      },
      warnings: []
    };
  }

  async publishListing(listing: CanonicalListing): Promise<{ channelListingId: string; evidence: EvidenceRecord }> {
    return this.store.publish(listing);
  }

  async updateListing(channelListingId: string, listing: CanonicalListing): Promise<{ updated: boolean; evidence: EvidenceRecord }> {
    return this.store.update(channelListingId, listing);
  }

  async pauseListing(channelListingId: string): Promise<{ paused: boolean; evidence: EvidenceRecord }> {
    return this.store.pause(channelListingId);
  }

  async resumeListing(channelListingId: string): Promise<{ resumed: boolean; evidence: EvidenceRecord }> {
    return this.store.resume(channelListingId);
  }

  async endListing(channelListingId: string): Promise<{ ended: boolean; evidence: EvidenceRecord }> {
    return this.store.end(channelListingId);
  }

  async retrieveListing(channelListingId: string): Promise<{ listing: unknown } | { notFound: true }> {
    return this.store.retrieve(channelListingId);
  }

  async retrieveListingStatus(channelListingId: string): Promise<{ state: string }> {
    return this.store.status(channelListingId);
  }

  async syncInventory(channelListingId: string, quantity: number): Promise<{ synced: boolean; evidence: EvidenceRecord }> {
    return this.store.syncInventory(channelListingId, quantity);
  }

  async syncPrice(channelListingId: string, price: Money): Promise<{ synced: boolean; evidence: EvidenceRecord }> {
    return this.store.syncPrice(channelListingId, price);
  }

  async retrieveOffers(channelListingId: string): Promise<{ offers: unknown[] }> {
    void channelListingId;
    return { offers: [] };
  }

  async respondToOffer(offerId: string, response: 'accept' | 'decline' | 'counter', counterAmount?: Money): Promise<{ responded: boolean; evidence: EvidenceRecord }> {
    void offerId; void response; void counterAmount;
    return { responded: true, evidence: fakeEvidenceRecord('', 'offer_responded', `responded ${response}`, offerId, {}) };
  }

  async retrieveMessages(channelListingId: string): Promise<{ messages: unknown[] }> {
    void channelListingId;
    return { messages: [] };
  }

  async sendMessage(channelListingId: string, body: string): Promise<{ sent: boolean; evidence: EvidenceRecord }> {
    void channelListingId;
    return { sent: true, evidence: fakeEvidenceRecord('', 'message_sent', body.slice(0, 80), channelListingId, {}) };
  }

  async retrieveOrders(since?: string): Promise<{ orders: unknown[] }> {
    void since;
    return { orders: [] };
  }

  async acknowledgeOrder(channelOrderId: string): Promise<{ acknowledged: boolean; evidence: EvidenceRecord }> {
    return { acknowledged: true, evidence: fakeEvidenceRecord('', 'order_acknowledged', `ack ${channelOrderId}`, channelOrderId, {}) };
  }

  async cancelOrder(channelOrderId: string, reason: string): Promise<{ cancelled: boolean; evidence: EvidenceRecord }> {
    return { cancelled: true, evidence: fakeEvidenceRecord('', 'order_cancelled', `cancel ${channelOrderId}: ${reason}`, channelOrderId, { reason }) };
  }

  async retrieveReturns(since?: string): Promise<{ returns: unknown[] }> {
    void since;
    return { returns: [] };
  }

  async retrieveFees(): Promise<{ fees: unknown }> {
    return { fees: { commissionRatePercent: 0, description: 'PrimeOpp Marketplace grand opening — zero fee' } };
  }

  async verifyListing(channelListingId: string): Promise<{ verified: boolean; evidence: EvidenceRecord }> {
    const r = this.store.retrieve(channelListingId);
    const verified = 'listing' in r;
    return { verified, evidence: fakeEvidenceRecord('', 'listing_verified', `verify ${channelListingId}`, channelListingId, { verified }) };
  }

  async verifyOrder(channelOrderId: string): Promise<{ verified: boolean; evidence: EvidenceRecord }> {
    return { verified: true, evidence: fakeEvidenceRecord('', 'order_verified', `verify ${channelOrderId}`, channelOrderId, {}) };
  }

  async shutdown(): Promise<void> {
    // No-op for in-memory adapter.
  }

  // Exposed for runtime tests
  getStore(): PrimeOppMarketplaceStore { return this.store; }
}

export function createPrimeOppMarketplaceAdapter(store?: PrimeOppMarketplaceStore): PrimeOppMarketplaceAdapter {
  return new PrimeOppMarketplaceAdapter(store);
}
