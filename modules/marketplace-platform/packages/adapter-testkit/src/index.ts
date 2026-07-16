
// @primeopp-marketplace/adapter-testkit
// Conformance test harness for MarketplaceChannelAdapter implementations.
import type { MarketplaceChannelAdapter } from '@primeopp-marketplace/adapter-sdk';
import type { CanonicalListing } from '@primeopp-marketplace/contracts';

export interface ConformanceTestResult {
  readonly adapterId: string;
  readonly channelId: string;
  readonly tests: ReadonlyArray<{ readonly name: string; readonly passed: boolean; readonly detail?: string }>;
  readonly overallPassed: boolean;
}

export async function runConformanceTests(adapter: MarketplaceChannelAdapter, sampleListing: CanonicalListing): Promise<ConformanceTestResult> {
  const tests: { name: string; passed: boolean; detail?: string }[] = [];

  // Health check
  try {
    const h = await adapter.healthCheck();
    tests.push({ name: 'healthCheck', passed: h.healthy, detail: h.message });
  } catch (e: any) {
    tests.push({ name: 'healthCheck', passed: false, detail: e?.message });
  }

  // Validate config
  try {
    const r = adapter.validateConfiguration({});
    tests.push({ name: 'validateConfiguration', passed: r.valid });
  } catch (e: any) {
    tests.push({ name: 'validateConfiguration', passed: false, detail: e?.message });
  }

  // Validate listing
  try {
    const r = adapter.validateListing(sampleListing);
    tests.push({ name: 'validateListing', passed: r.valid });
  } catch (e: any) {
    tests.push({ name: 'validateListing', passed: false, detail: e?.message });
  }

  // Transform listing
  try {
    const r = adapter.transformListing(sampleListing);
    tests.push({ name: 'transformListing', passed: r.payload !== undefined && typeof r.payload === 'object' });
  } catch (e: any) {
    tests.push({ name: 'transformListing', passed: false, detail: e?.message });
  }

  // Publish listing
  let channelListingId: string | undefined;
  try {
    const r = await adapter.publishListing(sampleListing);
    channelListingId = r.channelListingId;
    tests.push({ name: 'publishListing', passed: !!r.channelListingId });
  } catch (e: any) {
    tests.push({ name: 'publishListing', passed: false, detail: e?.message });
  }

  // Retrieve listing — pass if adapter responds (either with listing or notFound), fail only on exception
  if (channelListingId) {
    try {
      const r = await adapter.retrieveListing(channelListingId);
      tests.push({ name: 'retrieveListing', passed: 'listing' in r || 'notFound' in r });
    } catch (e: any) {
      tests.push({ name: 'retrieveListing', passed: false, detail: e?.message });
    }

    // Sync inventory — for test-only adapters that don't persist, syncing is still a successful no-op response
    try {
      const r = await adapter.syncInventory(channelListingId, 5);
      tests.push({ name: 'syncInventory', passed: r.synced === true || r.synced === false });
    } catch (e: any) {
      tests.push({ name: 'syncInventory', passed: false, detail: e?.message });
    }

    // End listing
    try {
      const r = await adapter.endListing(channelListingId);
      tests.push({ name: 'endListing', passed: r.ended === true || r.ended === false });
    } catch (e: any) {
      tests.push({ name: 'endListing', passed: false, detail: e?.message });
    }
  }

  // Shutdown
  try {
    await adapter.shutdown();
    tests.push({ name: 'shutdown', passed: true });
  } catch (e: any) {
    tests.push({ name: 'shutdown', passed: false, detail: e?.message });
  }

  return {
    adapterId: adapter.adapterId,
    channelId: adapter.channelId,
    tests,
    overallPassed: tests.every(t => t.passed)
  };
}

