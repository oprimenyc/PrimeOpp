/**
 * @primeopp-deal-intelligence/adapter-testkit
 *
 * TEST-ONLY adapter implementations and conformance tests. Every adapter
 * in this package is explicitly marked testOnly=true. They MUST NOT be
 * used in production.
 */
import type { AdapterId } from '@primeopp-deal-intelligence/contracts';
import {
  conformanceChecks,
  type RetailerApiAdapter,
  type AffiliateAdapter,
  type AlertChannelAdapter,
  type AnyAdapter
} from '@primeopp-deal-intelligence/adapter-sdk';

export const TEST_ONLY_BANNER = 'TEST-ONLY: This adapter is from @primeopp-deal-intelligence/adapter-testkit and MUST NOT be used in production.';

export class TestRetailerApiAdapter implements RetailerApiAdapter {
  readonly type = 'retailer-api' as const;
  readonly id: AdapterId = 'adapter:test-retailer-api' as AdapterId;
  readonly version = '1.0.0';
  readonly capabilities = ['fetch-product'];
  readonly supportedRetailers = [];
  readonly regions = ['US'];
  readonly authenticationRequired = false;
  readonly termsRestrictions: string[] = [];
  readonly retrySemantics = { maxRetries: 3, backoff: 'exponential' as const };
  readonly confidence = 0.5;
  readonly freshness = '2024-01-01T00:00:00Z';
  readonly evidenceSupport = true;
  readonly browserRequired = false;
  readonly legalReviewStatus = 'not-required' as const;
  readonly testOnly = true;
  async healthCheck() { return { status: 'healthy' as const, detail: TEST_ONLY_BANNER }; }
  async fetchProduct(id: string) { return { id, banner: TEST_ONLY_BANNER }; }
}

export class TestAffiliateAdapter implements AffiliateAdapter {
  readonly type = 'affiliate' as const;
  readonly id: AdapterId = 'adapter:test-affiliate' as AdapterId;
  readonly version = '1.0.0';
  readonly capabilities = ['build-link'];
  readonly supportedRetailers = [];
  readonly regions = ['US'];
  readonly authenticationRequired = false;
  readonly termsRestrictions: string[] = [];
  readonly retrySemantics = { maxRetries: 0, backoff: 'fixed' as const };
  readonly confidence = 0.3;
  readonly freshness = '2024-01-01T00:00:00Z';
  readonly evidenceSupport = false;
  readonly browserRequired = false;
  readonly legalReviewStatus = 'not-required' as const;
  readonly testOnly = true;
  async healthCheck() { return { status: 'healthy' as const, detail: TEST_ONLY_BANNER }; }
  async buildLink(input: { destinationUrl: string; merchantId: string }) {
    return { trackingUrl: `https://track.test.local/?to=${encodeURIComponent(input.destinationUrl)}`, banner: TEST_ONLY_BANNER };
  }
}

export class TestAlertChannelAdapter implements AlertChannelAdapter {
  readonly type = 'alert-channel' as const;
  readonly id: AdapterId = 'adapter:test-alert-channel' as AdapterId;
  readonly version = '1.0.0';
  readonly capabilities = ['deliver'];
  readonly supportedRetailers = [];
  readonly regions = [];
  readonly authenticationRequired = false;
  readonly termsRestrictions: string[] = [];
  readonly retrySemantics = { maxRetries: 0, backoff: 'fixed' as const };
  readonly confidence = 0.4;
  readonly freshness = '2024-01-01T00:00:00Z';
  readonly evidenceSupport = true;
  readonly browserRequired = false;
  readonly legalReviewStatus = 'not-required' as const;
  readonly testOnly = true;
  captured: unknown[] = [];
  async healthCheck() { return { status: 'healthy' as const, detail: TEST_ONLY_BANNER }; }
  async deliver(alert: unknown) { this.captured.push(alert); return { success: true, banner: TEST_ONLY_BANNER }; }
}

export function runConformance(adapter: AnyAdapter): { ok: boolean; issues: string[] } {
  const issues = conformanceChecks(adapter);
  if (!('testOnly' in adapter) || (adapter as { testOnly?: boolean }).testOnly !== true) {
    issues.push('adapter-testkit: every adapter MUST set testOnly=true');
  }
  return { ok: issues.length === 0, issues };
}

export function assertAllTestOnly(adapters: AnyAdapter[]): string[] {
  return adapters.filter(a => !(a as { testOnly?: boolean }).testOnly).map(a => a.id);
}
