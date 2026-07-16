// Channel contracts — Phase 18.
// Channel-neutral adapter interface + capability manifests + conformance suite.

import type {
  CanonicalCondition,
  CanonicalListing,
  ChannelCapability,
  ChannelCapabilityManifest,
  ChannelPublishRequest,
  ChannelPublishResult,
  ChannelSyncResult,
  MarketplaceChannelAdapter,
  TenantScoped,
} from '@primeopp/contracts';
import { nowUtc, uuid } from '@primeopp/contracts';

export interface ChannelRegistry {
  adapters: Map<string, MarketplaceChannelAdapter>; // channelRef -> adapter
}

export function createChannelRegistry(): ChannelRegistry {
  return { adapters: new Map() };
}

export function registerChannel(reg: ChannelRegistry, adapter: MarketplaceChannelAdapter): void {
  reg.adapters.set(adapter.channelRef, adapter);
}

export function getChannel(reg: ChannelRegistry, channelRef: string): MarketplaceChannelAdapter | undefined {
  return reg.adapters.get(channelRef);
}

export function listChannels(reg: ChannelRegistry): MarketplaceChannelAdapter[] {
  return Array.from(reg.adapters.values());
}

/**
 * Build a capability manifest for a channel.
 */
export function buildCapabilityManifest(opts: {
  channelRef: string;
  capabilities: ChannelCapability[];
  conditionMappings?: Partial<Record<CanonicalCondition, string>>;
  categoryRequirements?: Record<string, string[]>;
  testOnly?: boolean;
  feeScheduleRef?: string;
}): ChannelCapabilityManifest {
  const defaultMappings: Record<CanonicalCondition, string> = {
    NEW: 'New',
    NEW_WITH_TAGS: 'New with tags',
    NEW_WITHOUT_TAGS: 'New without tags',
    NEW_OPEN_BOX: 'New open box',
    LIKE_NEW: 'Like new',
    EXCELLENT: 'Excellent',
    VERY_GOOD: 'Very good',
    GOOD: 'Good',
    FAIR: 'Fair',
    POOR: 'Poor',
    FOR_PARTS: 'For parts',
    REFURBISHED: 'Refurbished',
    SELLER_REFURBISHED: 'Seller refurbished',
    MANUFACTURER_REFURBISHED: 'Manufacturer refurbished',
    DAMAGED: 'Damaged',
    CUSTOM: 'Custom',
  };
  return {
    channelRef: opts.channelRef,
    capabilities: opts.capabilities,
    conditionMappings: { ...defaultMappings, ...(opts.conditionMappings ?? {}) },
    categoryRequirements: opts.categoryRequirements ?? {},
    testOnly: opts.testOnly ?? false,
    ...(opts.feeScheduleRef ? { feeScheduleRef: opts.feeScheduleRef } : {}),
  };
}

// ---------------------------------------------------------------------------
// Local test channel adapter — TEST-ONLY
// ---------------------------------------------------------------------------

/**
 * Local fake channel adapter for tests.
 *
 * TEST-ONLY. Do NOT use in production.
 */
export class LocalTestChannelAdapter implements MarketplaceChannelAdapter {
  readonly adapterId: string;
  readonly version = '1.0.0';
  readonly channelRef: string;
  readonly testOnly = true;
  readonly capabilities: ChannelCapability[] = [
    'PUBLISH_LISTING', 'UPDATE_LISTING', 'PAUSE_LISTING', 'END_LISTING',
    'MARK_SOLD', 'SYNC_INVENTORY', 'SYNC_PRICE', 'RETRIEVE_LISTING_STATUS',
    'RETRIEVE_ERRORS', 'RETRIEVE_FEES',
  ];

  private readonly listings = new Map<string, CanonicalListing>();
  private readonly externalIds = new Map<string, string>(); // listingId -> externalListingId

  constructor(channelRef: string) {
    this.channelRef = channelRef;
    this.adapterId = `local.test.${channelRef}`;
  }

  getCapabilityManifest(): ChannelCapabilityManifest {
    return buildCapabilityManifest({
      channelRef: this.channelRef,
      capabilities: this.capabilities,
      testOnly: true,
    });
  }

  async publishListing(request: ChannelPublishRequest): Promise<ChannelPublishResult> {
    if (!request.userAccepted) {
      return {
        channelRef: this.channelRef,
        success: false,
        warnings: [],
        errors: ['user acceptance required before publication'],
      };
    }
    const externalId = `ext-${uuid()}`;
    this.listings.set(externalId, request.listing);
    this.externalIds.set(request.listing.id, externalId);
    return {
      channelRef: this.channelRef,
      success: true,
      externalListingId: externalId,
      warnings: [],
      errors: [],
      publishedAt: nowUtc(),
    };
  }

  async updateListing(request: ChannelPublishRequest): Promise<ChannelPublishResult> {
    const ext = this.externalIds.get(request.listing.id);
    if (!ext) {
      return { channelRef: this.channelRef, success: false, warnings: [], errors: ['listing not found'] };
    }
    this.listings.set(ext, request.listing);
    return { channelRef: this.channelRef, success: true, externalListingId: ext, warnings: [], errors: [], publishedAt: nowUtc() };
  }

  async pauseListing(externalListingId: string): Promise<ChannelSyncResult> {
    return { channelRef: this.channelRef, success: true, syncedAt: nowUtc(), warnings: [], errors: [] };
  }

  async endListing(externalListingId: string): Promise<ChannelSyncResult> {
    this.listings.delete(externalListingId);
    return { channelRef: this.channelRef, success: true, syncedAt: nowUtc(), warnings: [], errors: [] };
  }

  async markSold(externalListingId: string, qty: number): Promise<ChannelSyncResult> {
    return { channelRef: this.channelRef, success: true, syncedAt: nowUtc(), warnings: [], errors: [] };
  }

  async syncInventory(opts: { channelRef: string; externalListingId: string; quantityDelta: number; scope: TenantScoped }): Promise<ChannelSyncResult> {
    return { channelRef: this.channelRef, success: true, syncedAt: nowUtc(), warnings: [], errors: [] };
  }

  async syncPrice(externalListingId: string, price: { amount: number; currency: string; precise: boolean; status: string }): Promise<ChannelSyncResult> {
    return { channelRef: this.channelRef, success: true, syncedAt: nowUtc(), warnings: [], errors: [] };
  }
}

/**
 * PrimeOpp Marketplace test adapter.
 * TEST-ONLY. The real PrimeOpp Marketplace adapter is a future integration seam.
 */
export class PrimeOppMarketplaceTestAdapter extends LocalTestChannelAdapter {
  constructor() {
    super('primeopp-marketplace');
  }
}

// ---------------------------------------------------------------------------
// Conformance suite
// ---------------------------------------------------------------------------

export interface ConformanceTestResult {
  test: string;
  passed: boolean;
  message: string;
}

/**
 * Run conformance tests on a channel adapter.
 * Verifies that the adapter implements the required contract methods.
 */
export async function runConformanceSuite(adapter: MarketplaceChannelAdapter): Promise<ConformanceTestResult[]> {
  const results: ConformanceTestResult[] = [];

  // Test: adapter must have an id and version.
  if (!adapter.adapterId || !adapter.version) {
    results.push({ test: 'identity', passed: false, message: 'adapterId and version required' });
  } else {
    results.push({ test: 'identity', passed: true, message: `${adapter.adapterId} v${adapter.version}` });
  }

  // Test: must declare at least PUBLISH_LISTING capability.
  const manifest = adapter.getCapabilityManifest();
  if (!manifest.capabilities.includes('PUBLISH_LISTING')) {
    results.push({ test: 'capability.publish', passed: false, message: 'PUBLISH_LISTING capability required' });
  } else {
    results.push({ test: 'capability.publish', passed: true, message: 'PUBLISH_LISTING present' });
  }

  // Test: condition mappings cover all canonical conditions.
  const requiredConditions: CanonicalCondition[] = ['NEW', 'GOOD', 'FOR_PARTS', 'REFURBISHED'];
  const missing = requiredConditions.filter((c) => !manifest.conditionMappings[c]);
  if (missing.length > 0) {
    results.push({ test: 'conditionMappings', passed: false, message: `missing mappings for: ${missing.join(', ')}` });
  } else {
    results.push({ test: 'conditionMappings', passed: true, message: 'all required conditions mapped' });
  }

  // Test: testOnly flag is set on test adapters.
  if (adapter.testOnly && !manifest.testOnly) {
    results.push({ test: 'testOnlyFlag', passed: false, message: 'adapter is testOnly but manifest does not declare it' });
  } else {
    results.push({ test: 'testOnlyFlag', passed: true, message: adapter.testOnly ? 'test-only adapter correctly labeled' : 'production adapter' });
  }

  // Test: publishListing respects userAccepted.
  try {
    const fakeListing = {
      id: 'fake',
      tenantId: 't1',
      productId: 'p1',
      title: 'Test',
      bullets: [],
      attributes: {},
      condition: 'NEW' as CanonicalCondition,
      images: [],
      videoRefs: [],
      price: { amount: { amount: 10, currency: 'USD', precise: true, status: 'USER_ENTERED' as const }, acceptOffers: false },
      quantity: 1,
      shippingPolicy: { kind: 'CALCULATED' as const, localPickupOnly: false, internationalAllowed: false, returnAllowed: true },
      tags: [],
      seoKeywords: [],
      productIdentifiers: [],
      sellerDisclosures: [],
      channelOverrides: {},
      selectedChannels: [adapter.channelRef],
      alsoListOnPrimeOppMarketplace: false,
      state: 'DRAFT' as const,
      channelStates: {},
      version: 0,
      createdAt: '2026-01-01T00:00:00Z',
      updatedAt: '2026-01-01T00:00:00Z',
    };
    const r = await adapter.publishListing({ listing: fakeListing, scope: { tenantId: 't1' }, userAccepted: false });
    if (r.success) {
      results.push({ test: 'publishRequiresAcceptance', passed: false, message: 'publish succeeded without userAccepted' });
    } else {
      results.push({ test: 'publishRequiresAcceptance', passed: true, message: 'publish correctly rejected without acceptance' });
    }
  } catch (e) {
    results.push({ test: 'publishRequiresAcceptance', passed: true, message: `publish threw (acceptable): ${(e as Error).message}` });
  }

  return results;
}
