
// @primeopp-marketplace/adapter-sdk
// Stable MarketplaceChannelAdapter interface + all secondary adapter contracts.
import type {
  CanonicalListing, ChannelManifest, Offer, Order, ReturnRequest, DisputeRecord,
  Money, Identifier, TenantId, EvidenceRecord, Capability
} from '@primeopp-marketplace/contracts';

export interface AdapterDeclaration {
  readonly adapterId: string;
  readonly version: string;
  readonly capabilities: readonly Capability[];
  readonly authenticationRequirements: readonly string[];
  readonly supportedRegions: readonly { country: string; subdivision?: string }[];
  readonly supportedCategories: readonly string[];
  readonly rateLimits: { requestsPerSecond?: number; requestsPerDay?: number; burst?: number };
  readonly costMetadata?: Readonly<Record<string, unknown>>;
  readonly browserRequirements: boolean;
  readonly retrySemantics: 'at_least_once' | 'at_most_once' | 'exactly_once';
  readonly idempotencySupport: boolean;
  readonly healthCheck: () => Promise<{ healthy: boolean; message?: string }>;
  readonly evidenceSupport: boolean;
  readonly verificationSupport: boolean;
  readonly limitations: readonly string[];
  readonly termsRestrictions: readonly string[];
}

export interface MarketplaceChannelAdapter extends AdapterDeclaration {
  readonly channelId: string;
  readonly manifest: ChannelManifest;
  validateConfiguration(config: Readonly<Record<string, unknown>>): { valid: boolean; issues: readonly string[] };
  validateListing(listing: CanonicalListing): { valid: boolean; issues: readonly string[] };
  transformListing(listing: CanonicalListing): { payload: Readonly<Record<string, unknown>>; warnings: readonly string[] };
  publishListing(listing: CanonicalListing): Promise<{ channelListingId: string; evidence: EvidenceRecord }>;
  updateListing(channelListingId: string, listing: CanonicalListing): Promise<{ updated: boolean; evidence: EvidenceRecord }>;
  pauseListing(channelListingId: string): Promise<{ paused: boolean; evidence: EvidenceRecord }>;
  resumeListing(channelListingId: string): Promise<{ resumed: boolean; evidence: EvidenceRecord }>;
  endListing(channelListingId: string): Promise<{ ended: boolean; evidence: EvidenceRecord }>;
  retrieveListing(channelListingId: string): Promise<{ listing: unknown } | { notFound: true }>;
  retrieveListingStatus(channelListingId: string): Promise<{ state: string }>;
  syncInventory(channelListingId: string, quantity: number): Promise<{ synced: boolean; evidence: EvidenceRecord }>;
  syncPrice(channelListingId: string, price: Money): Promise<{ synced: boolean; evidence: EvidenceRecord }>;
  retrieveOffers(channelListingId: string): Promise<{ offers: unknown[] }>;
  respondToOffer(offerId: string, response: 'accept' | 'decline' | 'counter', counterAmount?: Money): Promise<{ responded: boolean; evidence: EvidenceRecord }>;
  retrieveMessages(channelListingId: string): Promise<{ messages: unknown[] }>;
  sendMessage(channelListingId: string, body: string): Promise<{ sent: boolean; evidence: EvidenceRecord }>;
  retrieveOrders(since?: string): Promise<{ orders: unknown[] }>;
  acknowledgeOrder(channelOrderId: string): Promise<{ acknowledged: boolean; evidence: EvidenceRecord }>;
  cancelOrder(channelOrderId: string, reason: string): Promise<{ cancelled: boolean; evidence: EvidenceRecord }>;
  retrieveReturns(since?: string): Promise<{ returns: unknown[] }>;
  retrieveFees(): Promise<{ fees: unknown }>;
  verifyListing(channelListingId: string): Promise<{ verified: boolean; evidence: EvidenceRecord }>;
  verifyOrder(channelOrderId: string): Promise<{ verified: boolean; evidence: EvidenceRecord }>;
  shutdown(): Promise<void>;
}

// Secondary adapter contracts
export interface InventoryAdapter {
  readonly adapterId: string;
  getInventory(inventoryId: string): Promise<unknown>;
  reserve(params: { inventoryId: string; quantity: number; referenceId: string }): Promise<{ reserved: boolean }>;
  release(reservationId: string): Promise<{ released: boolean }>;
}
export interface ProductCatalogAdapter { readonly adapterId: string; getProduct(productId: string): Promise<unknown>; }
export interface IdentityAdapter { readonly adapterId: string; verifyIdentity(actorId: string): Promise<{ verified: boolean }>; }
export interface AuthorityAdapter { readonly adapterId: string; checkPermission(actorId: string, permission: string): Promise<{ allowed: boolean }>; }
export interface ApprovalAdapter { readonly adapterId: string; requestApproval(params: { subjectId: string; subjectType: string; reason: string }): Promise<{ approvalId: string; status: 'pending' | 'approved' | 'denied' }>; }
export interface PaymentAdapter { readonly adapterId: string; authorize(params: { amount: Money; referenceId: string }): Promise<{ authorized: boolean; authorizationId?: string }>; capture(authorizationId: string): Promise<{ captured: boolean }>; }
export interface PayoutAdapter { readonly adapterId: string; requestPayout(params: { amount: Money; payeeRef: string }): Promise<{ payoutId: string; status: 'pending' | 'paid' | 'failed' }>; }
export interface ShippingAdapterContract { readonly adapterId: string; getRateQuote(req: unknown): Promise<unknown>; purchaseLabel(req: unknown): Promise<unknown>; }
export interface TaxAdapter { readonly adapterId: string; calculateTax(params: { amount: Money; jurisdiction: string }): Promise<{ amount: Money }>; }
export interface MessagingAdapter { readonly adapterId: string; send(params: { to: string; body: string }): Promise<{ sent: boolean }>; }
export interface ModerationAdapter { readonly adapterId: string; moderate(params: { subjectId: string; subjectType: string; content: string }): Promise<{ outcome: string }>; }
export interface SearchAdapter { readonly adapterId: string; search(query: unknown): Promise<{ results: unknown[] }>; }
export interface EvidenceAdapter { readonly adapterId: string; record(evidence: unknown): Promise<{ evidenceId: string }>; }
export interface VerificationAdapter { readonly adapterId: string; verify(params: { subjectId: string; subjectType: string }): Promise<{ verified: boolean }>; }
export interface BrowserOperatorAdapter {
  readonly adapterId: string;
  navigate(url: string): Promise<{ ok: boolean }>;
  click(selector: string): Promise<{ ok: boolean }>;
  type(selector: string, text: string): Promise<{ ok: boolean }>;
  snapshot(): Promise<{ html: string }>;
  shutdown(): Promise<void>;
}
export interface AffiliateAdapter { readonly adapterId: string; fetchOffers(query: string): Promise<{ offers: unknown[] }>; }
export interface AmosAdapter { readonly adapterId: string; submitJob(job: unknown): Promise<{ jobId: string; status: string }>; }

export interface AdapterRegistry {
  registerMarketplaceAdapter(adapter: MarketplaceChannelAdapter): void;
  getMarketplaceAdapter(channelId: string): MarketplaceChannelAdapter | undefined;
  listMarketplaceAdapters(): readonly MarketplaceChannelAdapter[];
}

export class InMemoryAdapterRegistry implements AdapterRegistry {
  private readonly map = new Map<string, MarketplaceChannelAdapter>();
  registerMarketplaceAdapter(a: MarketplaceChannelAdapter): void { this.map.set(a.channelId, a); }
  getMarketplaceAdapter(channelId: string): MarketplaceChannelAdapter | undefined { return this.map.get(channelId); }
  listMarketplaceAdapters(): readonly MarketplaceChannelAdapter[] { return Array.from(this.map.values()); }
}

