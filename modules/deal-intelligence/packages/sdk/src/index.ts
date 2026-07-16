/**
 * @primeopp-deal-intelligence/sdk
 *
 * Public TypeScript SDK facade. Provides a single entry point that
 * composes the platform's engines and adapters.
 *
 * All engines and adapters composed by this SDK are local and test-only.
 * External integration (live retailers, real affiliate networks, real
 * Discord, etc.) must be supplied via the adapter SDK.
 */
import type {
  Retailer, RetailerId, ProductId, DealId, TenantId, ISO8601,
  AlertRule, DealScoreSet, ResaleAnalysis, Evidence
} from '@primeopp-deal-intelligence/contracts';

import { listRetailers, getRetailerBySlug, RETAILER_COUNT } from '@primeopp-deal-intelligence/retailer-registry';
import { ingest, type SourceObservation } from '@primeopp-deal-intelligence/source-ingestion';
import { normalize, type NormalizeResult } from '@primeopp-deal-intelligence/product-normalization';
import { normalizeOffer, effectivePrice, type NormalizeOfferInput } from '@primeopp-deal-intelligence/offer-normalization';
import { evaluateStack, type StackInput, type CouponStackResult } from '@primeopp-deal-intelligence/coupon-engine';
import { evaluatePromotion, type PromotionContext, type PromotionEvaluation } from '@primeopp-deal-intelligence/promotion-engine';
import { InMemoryHistoricalPriceStore, type HistoricalPriceStore } from '@primeopp-deal-intelligence/historical-pricing';
import { fromRetailerString, isAvailableState } from '@primeopp-deal-intelligence/availability-engine';
import { isRestockTransition, classifyRestock } from '@primeopp-deal-intelligence/restock-engine';
import { computeRarity, type RarityInputs, type RarityOutput } from '@primeopp-deal-intelligence/rarity-engine';
import { validateDeal, type ValidationContext } from '@primeopp-deal-intelligence/deal-validation';
import { scoreDeal, type ScoringContext } from '@primeopp-deal-intelligence/deal-scoring';
import { analyzeResale, type ResaleInput } from '@primeopp-deal-intelligence/resale-opportunity';
import { buildAffiliateLink, validateAffiliateLink, detectAffiliateHijack, listTestNetworks, type BuildLinkInput } from '@primeopp-deal-intelligence/affiliate-engine';
import { AlertEngine, InMemoryAlertCaptureAdapter } from '@primeopp-deal-intelligence/alert-engine';
import { buildPublication, type Publication, type PublicationTarget } from '@primeopp-deal-intelligence/publishing-contracts';
import { createAmosJob, type AmosJobInput } from '@primeopp-deal-intelligence/amos-contracts';
import { CommunitySubmissionStore } from '@primeopp-deal-intelligence/community-submissions';
import { TenantRegistry, defaultPublicTenant, defaultEnterpriseTenant } from '@primeopp-deal-intelligence/tenant-config';
import { captureEvidence } from '@primeopp-deal-intelligence/evidence';
import type { Evidence as EvidenceCapture } from '@primeopp-deal-intelligence/contracts';
import { ObservabilityBus } from '@primeopp-deal-intelligence/observability';
import { InMemoryAdapterRegistry, type AnyAdapter } from '@primeopp-deal-intelligence/adapter-sdk';

export interface PrimeOppSdkOptions {
  historicalPriceStore?: HistoricalPriceStore;
  alertRules?: AlertRule[];
  tenantId?: TenantId;
}

export class PrimeOppSdk {
  readonly observability = new ObservabilityBus();
  readonly adapters = new InMemoryAdapterRegistry();
  readonly tenants = new TenantRegistry();
  readonly submissions = new CommunitySubmissionStore();
  readonly alerts: AlertEngine;
  historicalPrices: HistoricalPriceStore;

  constructor(opts: PrimeOppSdkOptions = {}) {
    this.historicalPrices = opts.historicalPriceStore ?? new InMemoryHistoricalPriceStore();
    this.alerts = new AlertEngine(opts.alertRules ?? []);
    // Always register test-only capture adapters by default.
    for (const ch of ['website','discord','email','sms','push','webhook','rss','social'] as const) {
      this.alerts.registerAdapter(new InMemoryAlertCaptureAdapter(ch));
    }
    // Always create default public tenant.
    if (opts.tenantId) {
      // caller will manage
    } else {
      this.tenants.create(defaultPublicTenant());
    }
  }

  // -- Retailers
  listRetailers(): Retailer[] { return listRetailers(); }
  getRetailer(slug: string) { return getRetailerBySlug(slug); }
  retailerCount() { return RETAILER_COUNT; }

  // -- Source ingestion
  ingestObservation(obs: Omit<SourceObservation, 'id' | 'precedence' | 'freshness'>): SourceObservation {
    const o = ingest(obs);
    this.observability.emit('source-check-completed', { id: o.id, retailer: o.retailerId });
    return o;
  }

  // -- Product normalization
  normalizeProduct(input: Parameters<typeof normalize>[0]): NormalizeResult {
    const r = normalize(input);
    this.observability.emit('product-normalized', { id: r.candidate.id, confidence: r.confidence });
    return r;
  }

  // -- Offer normalization
  normalizeOffer(input: NormalizeOfferInput) {
    const o = normalizeOffer(input);
    this.observability.emit('offer-normalized', { id: o.id });
    return o;
  }

  // -- Coupon engine
  evaluateStack(input: StackInput): CouponStackResult {
    const r = evaluateStack(input);
    this.observability.emit('coupon-validated', { status: r.status });
    return r;
  }

  // -- Promotion engine
  evaluatePromotion(promo: Parameters<typeof evaluatePromotion>[0], ctx: PromotionContext): PromotionEvaluation {
    const r = evaluatePromotion(promo, ctx);
    this.observability.emit('promotion-detected', { id: promo.id, applies: r.applies });
    return r;
  }

  // -- Historical pricing
  async recordPrice(obs: Parameters<HistoricalPriceStore['record']>[0]) {
    await this.historicalPrices.record(obs);
    this.observability.emit('price-history-updated', { product: obs.productId });
  }

  // -- Availability
  parseAvailability(s: string) { return fromRetailerString(s); }
  isAvailable(state: string) { return isAvailableState(state as any); }
  isRestockTransition(a: any, b: any) { return isRestockTransition(a, b); }
  classifyRestock(a: any, b: any, ctx: any) { return classifyRestock(a, b, ctx); }

  // -- Rarity
  computeRarity(input: RarityInputs): RarityOutput { return computeRarity(input); }

  // -- Deal validation
  validateDeal(ctx: ValidationContext) {
    const r = validateDeal(ctx);
    this.observability.emit(r.state === 'VERIFIED' ? 'deal-validated' : 'deal-rejected', { state: r.state });
    return r;
  }

  // -- Deal scoring
  scoreDeal(ctx: ScoringContext): DealScoreSet {
    const s = scoreDeal(ctx);
    this.observability.emit('deal-scored', { overall: s.overall.value });
    return s;
  }

  // -- Resale
  analyzeResale(input: ResaleInput): ResaleAnalysis {
    const r = analyzeResale(input);
    this.observability.emit('resale-opportunity-scored', { rec: r.recommendation });
    return r;
  }

  // -- Affiliate
  listAffiliateNetworks() { return listTestNetworks(); }
  buildAffiliateLink(input: BuildLinkInput) { return buildAffiliateLink(input); }
  validateAffiliateLink(link: any, allowed: string[]) { return validateAffiliateLink(link, allowed); }
  detectAffiliateHijack(link: any, allowed: string[]) { return detectAffiliateHijack(link, allowed); }

  // -- Alerts
  async emitAlert(ctx: Parameters<AlertEngine['emit']>[0]) {
    const alerts = await this.alerts.emit(ctx);
    for (const a of alerts) {
      this.observability.emit('alert-queued', { id: a.id, suppressed: a.suppressed });
      if (!a.suppressed) this.observability.emit('alert-delivered', { id: a.id });
    }
    return alerts;
  }

  // -- Publishing
  buildPublication(input: Omit<Publication, 'id' | 'createdAt'>) {
    const p = buildPublication(input);
    return p;
  }

  // -- AMOS
  createAmosJob(input: AmosJobInput) {
    const j = createAmosJob(input);
    this.observability.emit('amos-job-created', { id: j.id, kind: j.kind });
    return j;
  }

  // -- Evidence
  captureEvidence(input: Parameters<typeof captureEvidence>[0]): EvidenceCapture {
    return captureEvidence(input);
  }

  // -- Adapter registration
  registerAdapter(a: AnyAdapter) { this.adapters.register(a); }
}

/** Convenience factory. */
export function createPrimeOppSdk(opts?: PrimeOppSdkOptions): PrimeOppSdk {
  return new PrimeOppSdk(opts);
}

export { defaultEnterpriseTenant, defaultPublicTenant };
