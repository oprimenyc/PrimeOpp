// Adapter test kit — Phase 24 / 27.
// Local deterministic test adapters for all adapter contract families.
//
// TEST-ONLY. Every adapter in this package is clearly labeled TEST-ONLY
// and MUST NOT be used in production.

export { LocalTestOCRAdapter, sanitizeOcrOutput, mergeOcrResults, extractOcrFields, createOcrRequest } from '@primeopp/ocr-contracts';
export { LocalTestImageMatchAdapter, pseudoSimilarity, pseudoQuality, perceptualHash, hammingSimilarity, createImageMatchRequest } from '@primeopp/image-match-contracts';
export { LocalBarcodeLookupAdapter, createTestBarcodeAdapter, toBarcodePayload } from '@primeopp/barcode';
export {
  LocalTestChannelAdapter,
  PrimeOppMarketplaceTestAdapter,
  buildCapabilityManifest,
  createChannelRegistry,
  registerChannel,
  getChannel,
  listChannels,
  runConformanceSuite,
} from '@primeopp/channel-contracts';
export type { ConformanceTestResult } from '@primeopp/channel-contracts';

import type {
  AdapterManifest,
  BarcodeAdapter,
  ImageMatchAdapter,
  MarketplaceChannelAdapter,
  OCRAdapter,
} from '@primeopp/contracts';
import { LocalTestOCRAdapter } from '@primeopp/ocr-contracts';
import { LocalTestImageMatchAdapter } from '@primeopp/image-match-contracts';
import { LocalBarcodeLookupAdapter } from '@primeopp/barcode';
import { LocalTestChannelAdapter, PrimeOppMarketplaceTestAdapter } from '@primeopp/channel-contracts';

/**
 * Build a fully-wired test registry with all test adapters pre-registered.
 * Useful for examples, demos, and the verify command.
 *
 * TEST-ONLY.
 */
export function buildTestAdapterRegistry(): {
  barcode: LocalBarcodeLookupAdapter;
  ocr: LocalTestOCRAdapter;
  imageMatch: LocalTestImageMatchAdapter;
  channels: Map<string, MarketplaceChannelAdapter>;
  primeOpp: PrimeOppMarketplaceTestAdapter;
  manifests: Map<string, AdapterManifest>;
} {
  const barcode = new LocalBarcodeLookupAdapter();
  const ocr = new LocalTestOCRAdapter();
  const imageMatch = new LocalTestImageMatchAdapter();
  const channels = new Map<string, MarketplaceChannelAdapter>();
  const primeOpp = new PrimeOppMarketplaceTestAdapter();
  channels.set(primeOpp.channelRef, primeOpp);
  const testChannel = new LocalTestChannelAdapter('ebay-test-adapter');
  channels.set(testChannel.channelRef, testChannel);

  const manifests = new Map<string, AdapterManifest>();
  manifests.set(barcode.adapterId, {
    adapterId: barcode.adapterId,
    version: barcode.version,
    capabilities: barcode.capabilities,
    authenticationRequirements: 'NONE',
    dataSensitivity: 'TENANT',
    termsRestrictions: ['TEST-ONLY — do not use in production'],
    supportedRegions: ['*'],
  });
  manifests.set(ocr.adapterId, {
    adapterId: ocr.adapterId,
    version: ocr.version,
    capabilities: ocr.capabilities,
    authenticationRequirements: 'NONE',
    dataSensitivity: 'TENANT',
    termsRestrictions: ['TEST-ONLY — do not use in production'],
    supportedRegions: ['*'],
  });
  manifests.set(imageMatch.adapterId, {
    adapterId: imageMatch.adapterId,
    version: imageMatch.version,
    capabilities: imageMatch.capabilities,
    authenticationRequirements: 'NONE',
    dataSensitivity: 'TENANT',
    termsRestrictions: ['TEST-ONLY — do not use in production'],
    supportedRegions: ['*'],
  });
  for (const ch of channels.values()) {
    manifests.set(ch.adapterId, {
      adapterId: ch.adapterId,
      version: ch.version,
      capabilities: ch.capabilities,
      authenticationRequirements: 'NONE',
      dataSensitivity: 'TENANT',
      termsRestrictions: ['TEST-ONLY — do not use in production'],
      supportedRegions: ['*'],
    });
  }

  return { barcode, ocr, imageMatch, channels, primeOpp, manifests };
}

/**
 * Convenience: returns the type of each test adapter for downstream typing.
 */
export interface TestAdapterRegistry {
  barcode: BarcodeAdapter;
  ocr: OCRAdapter;
  imageMatch: ImageMatchAdapter;
  channels: Map<string, MarketplaceChannelAdapter>;
}
