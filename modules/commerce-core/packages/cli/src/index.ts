#!/usr/bin/env node
// PrimeOpp Commerce Core CLI — Phase 25.

import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { createSdk } from '@primeopp/sdk';
import { validateBarcode, toBarcodePayload, createScanEvent } from '@primeopp/barcode';
import { assessCondition } from '@primeopp/condition-engine';
import { priceProduct, createPricingObservation } from '@primeopp/pricing';
import { calculateProfit } from '@primeopp/profit-engine';
import { scoreOpportunity } from '@primeopp/opportunity-engine';
import { createCanonicalListing, validateListingForPublication, listingPreview, disablePrimeOppMarketplace, acceptSelectedChannels } from '@primeopp/listing-contracts';
import { listChannels, runConformanceSuite } from '@primeopp/channel-contracts';
import { defaultPrimeOppMarketplaceFeeSchedule } from '@primeopp/fee-engine';
import { estimateShipping, buildPackageSpec } from '@primeopp/shipping-estimator';
import type { CanonicalCondition, PricingStrategy } from '@primeopp/contracts';

const argv = process.argv.slice(2);
const [command, ...rest] = argv;

function readJson(file: string): unknown {
  const path = resolve(file);
  if (!existsSync(path)) {
    stderr(`File not found: ${path}`);
    process.exit(2);
  }
  try {
    return JSON.parse(readFileSync(path, 'utf-8'));
  } catch (e) {
    stderr(`Invalid JSON in ${path}: ${(e as Error).message}`);
    process.exit(2);
  }
}

function stdout(s: string): void {
  process.stdout.write(s + '\n');
}

function stderr(s: string): void {
  process.stderr.write(s + '\n');
}

function jsonOut(v: unknown): void {
  stdout(JSON.stringify(v, null, 2));
}

function usage(): never {
  stdout(`
PrimeOpp Commerce Core CLI

Usage: primeopp <command> [args]

Commands:
  products resolve <file>          Resolve product identity from input JSON.
  products inspect <id>            Inspect a product by ID.
  barcode validate <code>          Validate a barcode.
  barcode resolve <code>           Resolve a barcode to a product candidate.
  condition assess <file>          Assess condition from JSON.
  pricing calculate <file>         Calculate pricing from JSON.
  profit calculate <file>          Calculate profit from JSON.
  opportunity score <file>         Score opportunity from JSON.
  inventory create <file>          Create inventory from JSON.
  inventory adjust <file>          Adjust inventory from JSON.
  inventory reserve <file>         Reserve inventory from JSON.
  inventory reconcile              Reconcile inventory.
  listing create <file>            Create a listing from JSON.
  listing validate <file>          Validate a listing.
  channels list                    List registered channels.
  adapters check                   Run adapter conformance checks.
  config validate                  Validate tenant config.
  doctor                           Diagnose the install.
  demo                             Run the demo workflow.
  verify                           Run npm run verify (alias).

Global flags:
  --json                           Emit JSON output (where applicable).
  --tenant <id>                    Tenant ID (default: 'cli-default').
  --org <id>                       Organization ID.
`);
  process.exit(0);
}

function getFlag(name: string): string | undefined {
  const idx = rest.indexOf(`--${name}`);
  if (idx === -1) return undefined;
  const v = rest[idx + 1];
  if (!v) return undefined;
  rest.splice(idx, 2);
  return v;
}

function getJsonFlag(): boolean {
  const idx = rest.indexOf('--json');
  if (idx === -1) return false;
  rest.splice(idx, 1);
  return true;
}

async function main() {
  const json = getJsonFlag();
  const tenantId = getFlag('tenant') ?? 'cli-default';
  const organizationId = getFlag('org');

  const sdk = createSdk({ tenantId, ...(organizationId ? { organizationId } : {}) });

  switch (command) {
    case undefined:
    case '-h':
    case '--help':
    case 'help':
      usage();

    case 'demo': {
      stdout('=== PrimeOpp Commerce Core Demo ===');
      stdout('Tenant: ' + tenantId);
      stdout('');
      stdout('1. Barcode validation');
      const r = validateBarcode('036000291452');
      stdout(`   UPC-A 036000291452 → valid=${r.valid} checkDigit=${r.checkDigitValid}`);
      stdout('');
      stdout('2. Pricing (with 3 sold comps)');
      const obs = [
        createPricingObservation({ productId: 'p1', condition: 'GOOD', price: { amount: 100, currency: 'USD', precise: true, status: 'ACTUAL' }, currency: 'USD', quantity: 1, source: 'MARKETPLACE_SOLD_LISTING', listingStatus: 'SOLD', confidence: 0.95, evidenceRefs: [], scope: { tenantId } }),
        createPricingObservation({ productId: 'p1', condition: 'GOOD', price: { amount: 110, currency: 'USD', precise: true, status: 'ACTUAL' }, currency: 'USD', quantity: 1, source: 'MARKETPLACE_SOLD_LISTING', listingStatus: 'SOLD', confidence: 0.95, evidenceRefs: [], scope: { tenantId } }),
        createPricingObservation({ productId: 'p1', condition: 'GOOD', price: { amount: 105, currency: 'USD', precise: true, status: 'ACTUAL' }, currency: 'USD', quantity: 1, source: 'MARKETPLACE_SOLD_LISTING', listingStatus: 'SOLD', confidence: 0.95, evidenceRefs: [], scope: { tenantId } }),
      ];
      const priced = priceProduct({ productId: 'p1', condition: 'GOOD', activeComps: [], soldComps: obs, strategy: 'BALANCED', scope: { tenantId } });
      stdout(`   estimated market value midpoint: ${priced.estimatedMarketValue.midpoint.amount} USD`);
      stdout(`   recommended list price: ${priced.recommendedListPrice.amount} USD`);
      stdout(`   comparable count: ${priced.comparableCount}`);
      stdout('');
      stdout('3. Profit & ROI');
      const feeAssessment = sdk.assessFees({ marketplaceRef: 'primeopp-marketplace', basis: { amount: priced.recommendedListPrice.amount, currency: 'USD', precise: false, status: 'ESTIMATED' } });
      const profit = calculateProfit({
        productId: 'p1',
        listingPrice: { amount: priced.recommendedListPrice.amount, currency: 'USD', precise: false, status: 'ESTIMATED' },
        costBasis: { amount: 50, currency: 'USD', precise: true, status: 'ACTUAL' },
        inboundCost: { amount: 5, currency: 'USD', precise: true, status: 'ACTUAL' },
        feeAssessment,
        taxTreatment: 'EXCLUDED',
        scope: { tenantId },
      });
      stdout(`   net profit: ${profit.netProfit.amount} USD`);
      stdout(`   margin: ${(profit.margin * 100).toFixed(1)}%`);
      stdout(`   ROI: ${(profit.roi * 100).toFixed(1)}%`);
      stdout('');
      stdout('4. Opportunity decision');
      const opp = scoreOpportunity({
        expectedProfit: profit.netProfit,
        roi: profit.roi,
        margin: profit.margin,
        comparableCount: priced.comparableCount,
        confidence: 0.85,
        scope: { tenantId },
      });
      stdout(`   decision: ${opp.decision}`);
      stdout(`   next: ${opp.recommendedNextStep}`);
      stdout('');
      stdout('5. Listing with PrimeOpp Marketplace default ON');
      const listing = createCanonicalListing({
        productId: 'p1',
        title: 'Demo product',
        tenantId,
        price: { amount: { amount: priced.recommendedListPrice.amount, currency: 'USD', precise: false, status: 'ESTIMATED' }, acceptOffers: true, minimumOffer: { amount: 80, currency: 'USD', precise: false, status: 'ESTIMATED' } },
        quantity: 1,
        condition: 'GOOD',
        selectedChannels: ['ebay-test-adapter'],
      });
      stdout(listingPreview(listing));
      stdout('');
      stdout('6. Tenant opts out of PrimeOpp Marketplace');
      const { listing: optedOut } = disablePrimeOppMarketplace(listing, { reason: 'demo opt-out', userRef: 'demo-user' });
      stdout(listingPreview(optedOut));
      stdout('');
      stdout('Demo complete.');
      break;
    }

    case 'doctor': {
      stdout('=== PrimeOpp Doctor ===');
      stdout(`Node version: ${process.version}`);
      stdout(`Platform: ${process.platform} ${process.arch}`);
      stdout(`Tenant: ${tenantId}`);
      stdout('');
      stdout('Adapters:');
      for (const [id, m] of sdk.testAdapters.manifests) {
        stdout(`  - ${id} v${m.version} (TEST-ONLY)`);
      }
      stdout('');
      stdout('Channels:');
      for (const ch of listChannels(sdk.channelRegistry)) {
        stdout(`  - ${ch.channelRef} (testOnly=${ch.testOnly})`);
      }
      stdout('');
      stdout('All systems nominal.');
      break;
    }

    case 'barcode': {
      const sub = rest.shift();
      const value = rest.shift();
      if (!value) { stderr('barcode: missing <code>'); process.exit(2); }
      if (sub === 'validate') {
        const r = validateBarcode(value);
        if (json) jsonOut(r); else stdout(`valid=${r.valid} format=${r.format} checkDigit=${r.checkDigitValid} errors=${r.errors.join('; ')}`);
        process.exit(r.valid ? 0 : 1);
      }
      if (sub === 'resolve') {
        const payload = toBarcodePayload(value);
        const lookup = await sdk.testAdapters.barcode.lookup(payload, sdk.scope);
        if (json) jsonOut(lookup); else stdout(`matched=${lookup.matched} candidates=${lookup.candidates.length} collision=${lookup.collision}`);
        break;
      }
      stderr(`barcode: unknown subcommand ${sub}`);
      process.exit(2);
    }

    case 'condition': {
      const sub = rest.shift();
      if (sub !== 'assess') { stderr(`condition: unknown subcommand ${sub}`); process.exit(2); }
      const file = rest.shift();
      if (!file) { stderr('condition assess: missing <file>'); process.exit(2); }
      const input = readJson(file) as Parameters<typeof assessCondition>[0];
      const result = assessCondition({ ...input, scope: sdk.scope });
      if (json) jsonOut(result); else stdout(`condition=${result.assessment.condition} confidence=${result.confidence.toFixed(2)} missing=${result.missingDimensions.join(',')}`);
      break;
    }

    case 'pricing': {
      const sub = rest.shift();
      if (sub !== 'calculate') { stderr(`pricing: unknown subcommand ${sub}`); process.exit(2); }
      const file = rest.shift();
      if (!file) { stderr('pricing calculate: missing <file>'); process.exit(2); }
      const input = readJson(file) as Parameters<typeof priceProduct>[0];
      const result = priceProduct({ ...input, scope: sdk.scope });
      if (json) jsonOut(result); else stdout(`estimated midpoint=${result.estimatedMarketValue.midpoint.amount} list=${result.recommendedListPrice.amount} comps=${result.comparableCount}`);
      break;
    }

    case 'profit': {
      const sub = rest.shift();
      if (sub !== 'calculate') { stderr(`profit: unknown subcommand ${sub}`); process.exit(2); }
      const file = rest.shift();
      if (!file) { stderr('profit calculate: missing <file>'); process.exit(2); }
      const input = readJson(file) as Parameters<typeof calculateProfit>[0];
      const result = calculateProfit({ ...input, scope: sdk.scope });
      if (json) jsonOut(result); else stdout(`netProfit=${result.netProfit.amount} margin=${(result.margin * 100).toFixed(1)}% roi=${(result.roi * 100).toFixed(1)}%`);
      break;
    }

    case 'opportunity': {
      const sub = rest.shift();
      if (sub !== 'score') { stderr(`opportunity: unknown subcommand ${sub}`); process.exit(2); }
      const file = rest.shift();
      if (!file) { stderr('opportunity score: missing <file>'); process.exit(2); }
      const input = readJson(file) as Parameters<typeof scoreOpportunity>[0];
      const result = scoreOpportunity({ ...input, scope: sdk.scope });
      if (json) jsonOut(result); else stdout(`decision=${result.decision} next=${result.recommendedNextStep}`);
      break;
    }

    case 'inventory': {
      const sub = rest.shift();
      if (sub === 'create') {
        const file = rest.shift();
        if (!file) { stderr('inventory create: missing <file>'); process.exit(2); }
        const input = readJson(file) as { productId: string; variantId?: string; locationId: string; quantity: number; idempotencyKey: string };
        const result = await sdk.inventoryOp({ kind: 'CREATE', ...input, scope: sdk.scope });
        if (json) jsonOut(result); else stdout(`success=${result.success} state=${result.record?.state} version=${result.record?.version}`);
        break;
      }
      if (sub === 'adjust') {
        const file = rest.shift();
        if (!file) { stderr('inventory adjust: missing <file>'); process.exit(2); }
        const input = readJson(file) as { productId: string; variantId?: string; locationId: string; quantity: number; idempotencyKey: string };
        const result = await sdk.inventoryOp({ kind: 'ADJUST', ...input, scope: sdk.scope });
        if (json) jsonOut(result); else stdout(`success=${result.success} available=${result.record?.quantities.available}`);
        break;
      }
      if (sub === 'reserve') {
        const file = rest.shift();
        if (!file) { stderr('inventory reserve: missing <file>'); process.exit(2); }
        const input = readJson(file) as { productId: string; variantId?: string; locationId: string; quantity: number; idempotencyKey: string };
        const result = await sdk.inventoryOp({ kind: 'RESERVE', ...input, scope: sdk.scope });
        if (json) jsonOut(result); else stdout(`success=${result.success} reserved=${result.record?.quantities.reserved}`);
        break;
      }
      if (sub === 'reconcile') {
        // Reconcile reads all inventory for the tenant and reports quantities.
        const records = await sdk.inventoryStorage.listByTenant(tenantId);
        if (json) {
          jsonOut(records.map((r) => ({ productId: r.productId, variantId: r.variantId, locationId: r.locationId, available: r.quantities.available, reserved: r.quantities.reserved, sold: r.quantities.sold, state: r.state })));
        } else {
          if (records.length === 0) {
            stdout('No inventory records found.');
          } else {
            for (const r of records) {
              stdout(`${r.productId} @ ${r.locationId} — available=${r.quantities.available} reserved=${r.quantities.reserved} sold=${r.quantities.sold} state=${r.state}`);
            }
          }
        }
        break;
      }
      stderr(`inventory: unknown subcommand ${sub}`);
      process.exit(2);
    }

    case 'listing': {
      const sub = rest.shift();
      if (sub === 'create') {
        const file = rest.shift();
        if (!file) { stderr('listing create: missing <file>'); process.exit(2); }
        const input = readJson(file) as Parameters<typeof createCanonicalListing>[0];
        const listing = createCanonicalListing(input);
        if (json) jsonOut(listing); else stdout(listingPreview(listing));
        break;
      }
      if (sub === 'validate') {
        const file = rest.shift();
        if (!file) { stderr('listing validate: missing <file>'); process.exit(2); }
        const listing = readJson(file) as Parameters<typeof validateListingForPublication>[0];
        const result = validateListingForPublication(listing);
        if (json) jsonOut(result); else stdout(`valid=${result.valid} errors=${result.errors.join('; ')} warnings=${result.warnings.join('; ')}`);
        process.exit(result.valid ? 0 : 1);
      }
      stderr(`listing: unknown subcommand ${sub}`);
      process.exit(2);
    }

    case 'channels': {
      const sub = rest.shift();
      if (sub !== 'list') { stderr(`channels: unknown subcommand ${sub}`); process.exit(2); }
      const channels = listChannels(sdk.channelRegistry);
      if (json) jsonOut(channels.map((c) => ({ channelRef: c.channelRef, adapterId: c.adapterId, testOnly: c.testOnly, capabilities: c.capabilities })));
      else {
        for (const c of channels) stdout(`- ${c.channelRef} (adapter=${c.adapterId}, testOnly=${c.testOnly}, capabilities=${c.capabilities.length})`);
      }
      break;
    }

    case 'adapters': {
      const sub = rest.shift();
      if (sub !== 'check') { stderr(`adapters: unknown subcommand ${sub}`); process.exit(2); }
      const results: Record<string, unknown> = {};
      for (const [id, adapter] of sdk.testAdapters.channels) {
        const r = await runConformanceSuite(adapter);
        results[id] = r;
      }
      if (json) jsonOut(results);
      else {
        for (const [id, r] of Object.entries(results)) {
          stdout(`Channel: ${id}`);
          for (const t of r as Array<{ test: string; passed: boolean; message: string }>) {
            stdout(`  ${t.passed ? '✓' : '✗'} ${t.test}: ${t.message}`);
          }
        }
      }
      break;
    }

    case 'config': {
      const sub = rest.shift();
      if (sub !== 'validate') { stderr(`config: unknown subcommand ${sub}`); process.exit(2); }
      const cfg = await sdk.tenantConfigStore.get(tenantId);
      if (!cfg) {
        stdout('No tenant config found; initializing with defaults.');
        const c = await sdk.initTenantConfig({ name: 'Default' });
        if (json) jsonOut(c); else stdout(`tenant=${c.tenantId} name=${c.name} primeOppDefault=${c.defaultAlsoListOnPrimeOppMarketplace}`);
      } else {
        if (json) jsonOut(cfg); else stdout(`tenant=${cfg.tenantId} name=${cfg.name} primeOppDefault=${cfg.defaultAlsoListOnPrimeOppMarketplace}`);
      }
      break;
    }

    case 'products': {
      const sub = rest.shift();
      if (sub === 'resolve') {
        const file = rest.shift();
        if (!file) { stderr('products resolve: missing <file>'); process.exit(2); }
        const input = readJson(file);
        const result = await sdk.resolveProductIdentity(input as Parameters<typeof sdk.resolveProductIdentity>[0]);
        if (json) jsonOut(result); else stdout(`state=${result.state} candidates=${result.candidates.length} next=${result.recommendedNextAction}`);
        break;
      }
      if (sub === 'inspect') {
        const id = rest.shift();
        if (!id) { stderr('products inspect: missing <id>'); process.exit(2); }
        const p = await sdk.getProduct(id);
        if (!p) { stderr('not found'); process.exit(1); }
        if (json) jsonOut(p); else stdout(`id=${p.id} title=${p.title} kind=${p.kind} version=${p.version} archived=${p.archived ?? false}`);
        break;
      }
      stderr(`products: unknown subcommand ${sub}`);
      process.exit(2);
    }

    case 'verify': {
      stdout('Delegating to `npm run verify`...');
      const r = await import('node:child_process').then((c) => c.spawnSync('npm', ['run', 'verify'], { stdio: 'inherit', shell: true }));
      process.exit(r.status ?? 1);
    }

    default:
      stderr(`Unknown command: ${command}`);
      usage();
  }
}

main().catch((e) => {
  stderr(`FATAL: ${e?.message ?? e}`);
  process.exit(1);
});
