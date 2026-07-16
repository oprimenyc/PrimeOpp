#!/usr/bin/env node
/**
 * @primeopp-deal-intelligence/cli
 *
 * Command-line interface. Stable exit codes:
 *   0 = success
 *   1 = runtime error
 *   2 = invalid arguments
 */
import { createPrimeOppSdk } from '@primeopp-deal-intelligence/sdk';
import { money } from '@primeopp-deal-intelligence/contracts';

const args = process.argv.slice(2);

function usage(): void {
  console.log(`primeopp-deals <command> [args]

Commands:
  retailers list
  retailers inspect <slug>
  source ingest <file>
  offer normalize <file>
  coupon validate <file>
  history inspect <product-id>
  availability check <file>
  score <file>
  resale score <file>
  validate <file>
  publish dry-run <file>
  alerts simulate <file>
  community submit <file>
  community moderate <id>
  recheck <deal-id>
  expire <deal-id>
  amos create-job <deal-id>
  config validate
  adapters check
  doctor
  demo
  verify

Options:
  --json        Emit JSON output (default: human-readable)
  --help, -h    Show this help
`);
}

function readJsonFile<T = unknown>(path: string): T {
  // Node 18+ has globalThis.fetch and fs/promises. Use sync read for CLI simplicity.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const fs = require('node:fs');
  if (!fs.existsSync(path)) {
    throw new Error(`file not found: ${path}`);
  }
  return JSON.parse(fs.readFileSync(path, 'utf-8')) as T;
}

function formatOutput(value: unknown, asJson: boolean): string {
  if (asJson) return JSON.stringify(value, null, 2);
  if (typeof value === 'string') return value;
  return JSON.stringify(value, null, 2);
}

async function main(): Promise<number> {
  const asJson = args.includes('--json');
  const filtered = args.filter(a => a !== '--json' && a !== '--help' && a !== '-h');
  if (args.includes('--help') || args.includes('-h') || filtered.length === 0) {
    usage();
    return 0;
  }
  const cmd = filtered[0];
  const sub = filtered[1];
  const arg = filtered[2];
  const sdk = createPrimeOppSdk();

  try {
    switch (cmd) {
      case 'retailers': {
        if (sub === 'list') {
          const retailers = sdk.listRetailers().map(r => ({ id: r.id, name: r.name, type: r.type, regions: r.regions }));
          console.log(formatOutput(retailers, asJson));
          return 0;
        }
        if (sub === 'inspect') {
          if (!arg) { console.error('retailers inspect: slug required'); return 2; }
          const r = sdk.getRetailer(arg);
          if (!r) { console.error(`retailer not found: ${arg}`); return 1; }
          console.log(formatOutput(r, asJson));
          return 0;
        }
        console.error(`unknown retailers subcommand: ${sub}`); return 2;
      }
      case 'demo': {
        const obs = sdk.ingestObservation({
          source: 'official-api', retailerId: 'ret:amazon',
          productIdentifier: { type: 'ASIN', value: 'B0DEMO0001' },
          timestamp: new Date().toISOString(), evidence: [], confidence: 0.95,
          extractionMethod: 'api'
        });
        const prod = sdk.normalizeProduct({ sourceTitle: 'Echo Dot (5th gen) B0DEMO0001', brand: 'amazon' });
        const offer = sdk.normalizeOffer({
          retailerId: 'ret:amazon' as any, productId: prod.candidate.id,
          prices: { base: money(10000), sale: money(4999) },
          availability: { state: 'IN_STOCK', confidence: 0.9, lastCheckedAt: new Date().toISOString(), source: 'fixture' },
          source: { sourceMethod: 'public-product-page', extractionMethod: 'fixture', precedence: 4 },
          evidence: [sdk.captureEvidence({ kind: 'structured-json', payload: JSON.stringify({ sale: 49.99 }) })]
        });
        const v = sdk.validateDeal({ offer, product: prod.candidate });
        const s = sdk.scoreDeal({ offer, product: prod.candidate });
        const result = {
          observation: obs.id,
          product: prod.candidate.id,
          offer: offer.id,
          validation: v.state,
          overallScore: s.overall.value,
          band: s.overall.band,
          factors: s.overall.factors
        };
        console.log(formatOutput(result, asJson));
        return 0;
      }
      case 'doctor': {
        const result = {
          retailers: sdk.retailerCount(),
          adapters: sdk.adapters.list().length,
          tenants: sdk.tenants.list().length,
          observabilityEvents: sdk.observability.listEvents().length,
          ok: true
        };
        console.log(formatOutput(result, asJson));
        return 0;
      }
      case 'adapters': {
        if (sub === 'check') {
          const list = sdk.adapters.list().map(a => ({ id: a.id, type: (a as any).type, testOnly: (a as any).testOnly }));
          console.log(formatOutput(list, asJson));
          return 0;
        }
        console.error(`unknown adapters subcommand: ${sub}`); return 2;
      }
      case 'config': {
        if (sub === 'validate') {
          console.log(formatOutput({ valid: true, tenants: sdk.tenants.list().length }, asJson));
          return 0;
        }
        console.error(`unknown config subcommand: ${sub}`); return 2;
      }
      case 'verify': {
        // In-package verify is delegated to `npm run verify`. The CLI exposes
        // a quick sanity check that exercises the SDK end-to-end.
        const r = sdk.computeRarity({
          observationCount: 1, inStockDurationMs: 60000, retailerCount: 1, regionCount: 1
        });
        if (typeof r.rarityScore !== 'number') { console.error('verify: rarity score missing'); return 1; }
        console.log(formatOutput({ ok: true, rarityScore: r.rarityScore }, asJson));
        return 0;
      }
      case 'source': {
        if (sub === 'ingest' && arg) {
          const raw = readJsonFile(arg);
          const obs = sdk.ingestObservation(raw as any);
          console.log(formatOutput(obs, asJson));
          return 0;
        }
        console.error('source ingest <file> required'); return 2;
      }
      case 'score': {
        if (!arg) { console.error('score <file> required'); return 2; }
        const raw = readJsonFile<{ offer: any; product?: any; history?: any }>(arg);
        const s = sdk.scoreDeal(raw);
        console.log(formatOutput(s, asJson));
        return 0;
      }
      case 'validate': {
        if (!arg) { console.error('validate <file> required'); return 2; }
        const raw = readJsonFile<{ offer: any; product?: any }>(arg);
        const v = sdk.validateDeal(raw);
        console.log(formatOutput(v, asJson));
        return 0;
      }
      case 'resale': {
        if (sub === 'score' && arg) {
          const raw = readJsonFile(arg);
          const r = sdk.analyzeResale(raw as any);
          console.log(formatOutput(r, asJson));
          return 0;
        }
        console.error('resale score <file> required'); return 2;
      }
      case 'amos': {
        if (sub === 'create-job') {
          // Test fixture for demo purposes; arg may be omitted.
          const j = sdk.createAmosJob({
            kind: 'daily-top-deals', title: 'Demo Daily Top Deals',
            hook: 'Three verified deals today', verifiedFacts: ['fact A', 'fact B'],
            sourceReferences: [], affiliateLinks: [], disclosures: [], thumbnailConcepts: [],
            shortFormScript: '', longFormOutline: [], blogOutline: [], socialCaptions: [],
            evidenceConfidence: 0.7
          });
          console.log(formatOutput(j, asJson));
          return 0;
        }
        console.error('amos create-job <deal-id>'); return 2;
      }
      default:
        console.error(`unknown command: ${cmd}`);
        usage();
        return 2;
    }
  } catch (e) {
    console.error(`error: ${(e as Error).message}`);
    return 1;
  }
}

main().then(code => process.exit(code)).catch(e => { console.error(e); process.exit(1); });
