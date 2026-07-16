// Adapter SDK — Phase 24.
// Adapter contracts for all external integrations.

import type {
  AdapterHealthCheckResult,
  AdapterManifest,
  BarcodeAdapter,
  BarcodePayload,
  ChannelCapability,
  ImageMatchAdapter,
  MarketplaceChannelAdapter,
  OCRAdapter,
  TenantScoped,
} from '@primeopp/contracts';
import { nowUtc, uuid } from '@primeopp/contracts';

// Re-export adapter interfaces from contracts.
export type {
  AdapterManifest,
  AdapterHealthCheckResult,
  BarcodeAdapter,
  OCRAdapter,
  ImageMatchAdapter,
  MarketplaceChannelAdapter,
} from '@primeopp/contracts';

/**
 * Adapter registry — central catalog of all adapters in the system.
 */
export interface AdapterRegistry {
  barcode: Map<string, BarcodeAdapter>;
  ocr: Map<string, OCRAdapter>;
  imageMatch: Map<string, ImageMatchAdapter>;
  channel: Map<string, MarketplaceChannelAdapter>;
  manifests: Map<string, AdapterManifest>;
}

export function createAdapterRegistry(): AdapterRegistry {
  return {
    barcode: new Map(),
    ocr: new Map(),
    imageMatch: new Map(),
    channel: new Map(),
    manifests: new Map(),
  };
}

export function registerBarcodeAdapter(reg: AdapterRegistry, manifest: AdapterManifest, adapter: BarcodeAdapter): void {
  reg.barcode.set(adapter.adapterId, adapter);
  reg.manifests.set(adapter.adapterId, manifest);
}

export function registerOCRAdapter(reg: AdapterRegistry, manifest: AdapterManifest, adapter: OCRAdapter): void {
  reg.ocr.set(adapter.adapterId, adapter);
  reg.manifests.set(adapter.adapterId, manifest);
}

export function registerImageMatchAdapter(reg: AdapterRegistry, manifest: AdapterManifest, adapter: ImageMatchAdapter): void {
  reg.imageMatch.set(adapter.adapterId, adapter);
  reg.manifests.set(adapter.adapterId, manifest);
}

export function registerChannelAdapter(reg: AdapterRegistry, manifest: AdapterManifest, adapter: MarketplaceChannelAdapter): void {
  reg.channel.set(adapter.adapterId, adapter);
  reg.manifests.set(adapter.adapterId, manifest);
}

export function buildManifest(opts: AdapterManifest): AdapterManifest {
  return { ...opts };
}

/**
 * Run a health check on an adapter.
 * Default implementation returns a healthy result; real adapters MUST override.
 */
export async function defaultHealthCheck(adapterId: string): Promise<AdapterHealthCheckResult> {
  return {
    healthy: true,
    checkedAt: nowUtc(),
    details: { adapterId, note: 'default health check — real adapters must override' },
  };
}

/**
 * Adapter conformance test framework.
 */
export interface AdapterConformanceTest {
  name: string;
  description: string;
  run: (adapter: unknown, manifest: AdapterManifest) => Promise<{ passed: boolean; message: string }>;
}

/**
 * Common conformance tests that apply to ALL adapters.
 */
export const COMMON_CONFORMANCE_TESTS: AdapterConformanceTest[] = [
  {
    name: 'manifest-declares-id-and-version',
    description: 'Manifest must declare adapterId and version.',
    run: async (_adapter, manifest) => {
      if (!manifest.adapterId || !manifest.version) {
        return { passed: false, message: 'adapterId and version required' };
      }
      return { passed: true, message: `${manifest.adapterId} v${manifest.version}` };
    },
  },
  {
    name: 'manifest-declares-capabilities',
    description: 'Manifest must declare at least one capability.',
    run: async (_adapter, manifest) => {
      if (!manifest.capabilities || manifest.capabilities.length === 0) {
        return { passed: false, message: 'at least one capability required' };
      }
      return { passed: true, message: `${manifest.capabilities.length} capabilities declared` };
    },
  },
  {
    name: 'manifest-declares-auth',
    description: 'Manifest must declare authentication requirements.',
    run: async (_adapter, manifest) => {
      if (!manifest.authenticationRequirements) {
        return { passed: false, message: 'authenticationRequirements required' };
      }
      return { passed: true, message: `auth: ${manifest.authenticationRequirements}` };
    },
  },
  {
    name: 'manifest-declares-data-sensitivity',
    description: 'Manifest must declare data sensitivity classification.',
    run: async (_adapter, manifest) => {
      if (!manifest.dataSensitivity) {
        return { passed: false, message: 'dataSensitivity required' };
      }
      return { passed: true, message: `sensitivity: ${manifest.dataSensitivity}` };
    },
  },
  {
    name: 'manifest-declares-terms-restrictions',
    description: 'Manifest must declare terms restrictions (even if empty).',
    run: async (_adapter, manifest) => {
      if (!Array.isArray(manifest.termsRestrictions)) {
        return { passed: false, message: 'termsRestrictions must be an array' };
      }
      return { passed: true, message: `${manifest.termsRestrictions.length} terms restrictions` };
    },
  },
];

/**
 * Run conformance tests on an adapter.
 */
export async function runAdapterConformanceTests(
  adapter: unknown,
  manifest: AdapterManifest,
  tests: AdapterConformanceTest[] = COMMON_CONFORMANCE_TESTS,
): Promise<{ name: string; passed: boolean; message: string }[]> {
  const results: { name: string; passed: boolean; message: string }[] = [];
  for (const t of tests) {
    try {
      const r = await t.run(adapter, manifest);
      results.push({ name: t.name, passed: r.passed, message: r.message });
    } catch (e) {
      results.push({ name: t.name, passed: false, message: `test threw: ${(e as Error).message}` });
    }
  }
  return results;
}

/**
 * Capability manifest for an adapter.
 */
export function adapterCapabilityManifest(manifest: AdapterManifest): {
  adapterId: string;
  version: string;
  capabilities: string[];
  authenticationRequirements: string;
  supportedRegions: string[];
  supportedCategories: string[];
  dataSensitivity: string;
} {
  return {
    adapterId: manifest.adapterId,
    version: manifest.version,
    capabilities: manifest.capabilities,
    authenticationRequirements: manifest.authenticationRequirements,
    supportedRegions: manifest.supportedRegions ?? [],
    supportedCategories: manifest.supportedCategories ?? [],
    dataSensitivity: manifest.dataSensitivity ?? 'UNKNOWN',
  };
}
