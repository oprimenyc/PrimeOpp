#!/usr/bin/env node
/**
 * Workflow B — Walmart Clearance
 *
 * Ingest store-level fixture, detect regional markdown, preserve ZIP/store requirement, score consumer and reseller value, publish with conditions.
 *
 * Run with: npx tsx index.mjs  (after `npm run build` at the monorepo root)
 */
import { createPrimeOppSdk } from '@primeopp-deal-intelligence/sdk';
import { money } from '@primeopp-deal-intelligence/contracts';

async function main() {
  const sdk = createPrimeOppSdk();
  console.log('=== Workflow B — Walmart Clearance ===');

  // Step 1: Ingest fixture observation
  const obs = sdk.ingestObservation({
    source: 'manual-entry',
    retailerId: 'ret:amazon',
    productIdentifier: { type: 'ASIN', value: 'B0DEMOWALMA' },
    timestamp: new Date().toISOString(),
    evidence: [],
    confidence: 0.85,
    extractionMethod: 'fixture'
  });
  console.log('Ingested:', obs.id);

  // Step 2: Normalize product
  const prod = sdk.normalizeProduct({
    sourceTitle: 'walmart-clearance demo product',
    brand: 'demo'
  });
  console.log('Normalized product:', prod.candidate.id);

  // Step 3: Normalize offer
  const offer = sdk.normalizeOffer({
    retailerId: 'ret:amazon' as any,
    productId: prod.candidate.id,
    prices: { base: money(10000), sale: money(4999) },
    availability: { state: 'IN_STOCK', confidence: 0.9, lastCheckedAt: new Date().toISOString(), source: 'fixture' },
    source: { sourceMethod: 'public-product-page', extractionMethod: 'fixture', precedence: 4 },
    evidence: [sdk.captureEvidence({ kind: 'structured-json', payload: JSON.stringify({ sale: 49.99 }) })]
  });
  console.log('Normalized offer:', offer.id);

  // Step 4: Validate
  const v = sdk.validateDeal({ offer, product: prod.candidate });
  console.log('Validation state:', v.state);

  // Step 5: Score
  const s = sdk.scoreDeal({ offer, product: prod.candidate });
  console.log('Overall score:', s.overall.value, s.overall.band);

  // Step 6: Affiliate link with disclosure
  const nets = sdk.listAffiliateNetworks();
  const link = sdk.buildAffiliateLink({
    program: { network: nets[0]!, merchantId: 'amzn', merchantName: 'Amazon', defaultCommissionPct: 4 },
    destinationUrl: 'https://www.amazon.com/dp/B0XYZ',
    allowedDomains: ['www.amazon.com']
  });
  console.log('Affiliate link rejected:', link.rejected, 'disclosure:', link.link?.disclosureRequired);

  // Step 7: Alert
  const alerts = await sdk.emitAlert({
    type: 'new-deal', tenantId: sdk.tenants.list()[0]!.id,
    headline: 'Workflow B — Walmart Clearance', body: 'Demo', score: s.overall.value
  });
  console.log('Alerts emitted:', alerts.length);

  // Step 8: AMOS job
  const amos = sdk.createAmosJob({
    kind: 'daily-top-deals', title: 'Workflow B — Walmart Clearance', hook: 'Demo hook',
    verifiedFacts: ['demo fact 1', 'demo fact 2'],
    sourceReferences: [], affiliateLinks: link.link ? [link.link] : [],
    disclosures: [], thumbnailConcepts: [],
    shortFormScript: 'demo script', longFormOutline: [], blogOutline: [],
    socialCaptions: [], evidenceConfidence: 0.7
  });
  console.log('AMOS job:', amos.id, 'kind:', amos.kind);

  console.log('\nWorkflow complete.');
}

main().catch(e => { console.error(e); process.exit(1); });
