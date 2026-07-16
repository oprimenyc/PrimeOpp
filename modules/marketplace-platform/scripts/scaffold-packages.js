// Scaffolds per-package package.json + tsconfig.json files for all packages and adapters.
// Adds @primeopp-marketplace/contracts dependency to every package, plus inter-package deps.
import { writeFileSync, mkdirSync, existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');

// Dependency graph (each entry lists internal @primeopp-marketplace/* deps).
const PKG_DEPS = {
  contracts: [],
  schemas: ['contracts'],
  seller: ['contracts'],
  buyer: ['contracts'],
  'canonical-listing': ['contracts', 'schemas'],
  'channel-registry': ['contracts'],
  'listing-transformer': ['contracts', 'channel-registry', 'seo'],
  'listing-publisher': ['contracts', 'channel-registry', 'listing-transformer', 'evidence', 'observability', 'canonical-listing', 'trust-safety', 'adapter-sdk'],
  'listing-sync': ['contracts', 'channel-registry'],
  'inventory-sync': ['contracts', 'evidence', 'observability'],
  'offer-engine': ['contracts', 'evidence'],
  'negotiation-engine': ['contracts', 'offer-engine'],
  'order-engine': ['contracts', 'inventory-sync', 'commission-engine', 'settlement-contracts', 'shipping-contracts', 'fulfillment-contracts', 'evidence', 'observability'],
  'fulfillment-contracts': ['contracts', 'shipping-contracts'],
  'shipping-contracts': ['contracts'],
  'commission-engine': ['contracts', 'evidence'],
  'settlement-contracts': ['contracts', 'commission-engine'],
  returns: ['contracts', 'order-engine', 'evidence'],
  disputes: ['contracts', 'evidence'],
  messaging: ['contracts', 'trust-safety', 'evidence'],
  'trust-safety': ['contracts', 'moderation'],
  moderation: ['contracts', 'evidence'],
  'search-contracts': ['contracts'],
  seo: ['contracts'],
  'affiliate-contracts': ['contracts'],
  'amos-contracts': ['contracts'],
  evidence: ['contracts'],
  observability: ['contracts'],
  'tenant-config': ['contracts'],
  'adapter-sdk': ['contracts'],
  'adapter-testkit': ['contracts', 'adapter-sdk'],
  sdk: ['contracts','schemas','seller','buyer','canonical-listing','channel-registry','listing-transformer','listing-publisher','listing-sync','inventory-sync','offer-engine','negotiation-engine','order-engine','fulfillment-contracts','shipping-contracts','commission-engine','settlement-contracts','returns','disputes','messaging','trust-safety','moderation','search-contracts','seo','affiliate-contracts','amos-contracts','evidence','observability','tenant-config','adapter-sdk','adapter-testkit','primeopp-marketplace','test-ebay','test-amazon','test-facebook-marketplace'],
  cli: ['sdk']
};

const ADAPTERS = [
  'primeopp-marketplace',
  'test-ebay','test-amazon','test-walmart','test-facebook-marketplace',
  'test-offerup','test-depop','test-poshmark','test-mercari','test-etsy',
  'test-goat','test-stockx','test-alias','test-flight-club','test-stadium-goods',
  'test-grailed','test-whatnot','test-craigslist'
];

function packageJson(name, deps = [], opts = {}) {
  const isAdapter = opts.adapter === true;
  const isTestOnly = isAdapter && name.startsWith('test-');
  const desc = isTestOnly
    ? `TEST-ONLY adapter stub for ${name.replace('test-','')}. No live connectivity.`
    : isAdapter
      ? `PrimeOpp Marketplace local functional adapter.`
      : `PrimeOpp Marketplace Platform — ${name} package.`;
  const dependencies = {};
  for (const d of deps) dependencies[`@primeopp-marketplace/${d}`] = '1.0.0';
  return {
    name: `@primeopp-marketplace/${name}`,
    version: '1.0.0',
    description: desc,
    type: 'module',
    main: './dist/index.js',
    types: './dist/index.d.ts',
    exports: {
      '.': {
        types: './dist/index.d.ts',
        import: './dist/index.js'
      }
    },
    license: 'Apache-2.0',
    dependencies: Object.keys(dependencies).length ? dependencies : undefined,
    scripts: {
      build: 'tsc -b',
      test: 'node --test --test-reporter=spec "dist-test/**/*.test.js"'
    }
  };
}

const ALL_ADAPTER_NAMES = ['primeopp-marketplace','test-ebay','test-amazon','test-walmart','test-facebook-marketplace','test-offerup','test-depop','test-poshmark','test-mercari','test-etsy','test-goat','test-stockx','test-alias','test-flight-club','test-stadium-goods','test-grailed','test-whatnot','test-craigslist'];

// Compute the relative reference path from a package or adapter to one of its deps.
// `sourceLocation` is 'packages' or 'adapters'. Dep names may be in either.
function refPath(sourceLocation, depName) {
  const depIsAdapter = ALL_ADAPTER_NAMES.includes(depName);
  if (sourceLocation === 'packages') {
    // packages/<src>/tsconfig.json -> ../<dep> (if dep is a package) or ../../adapters/<dep> (if dep is adapter)
    return depIsAdapter ? `../../adapters/${depName}` : `../${depName}`;
  } else {
    // adapters/<src>/tsconfig.json -> ../../packages/<dep> (if dep is a package) or ../<dep> (if dep is adapter)
    return depIsAdapter ? `../${depName}` : `../../packages/${depName}`;
  }
}

function tsconfigJson(sourceLocation, deps = []) {
  const refs = deps.map(d => ({ path: refPath(sourceLocation, d) }));
  return {
    extends: '../../tsconfig.base.json',
    compilerOptions: {
      rootDir: './src',
      outDir: './dist',
      resolveJsonModule: true
    },
    include: ['src/**/*.ts', 'src/**/*.json'],
    exclude: ['test/**/*', 'dist/**/*', 'dist-test/**/*', 'node_modules/**/*'],
    references: refs
  };
}

function tsconfigTestJson(sourceLocation, deps = []) {
  const refs = deps.map(d => ({ path: refPath(sourceLocation, d) }));
  refs.unshift({ path: './tsconfig.json' });
  return {
    extends: '../../tsconfig.base.json',
    compilerOptions: {
      rootDir: '.',
      outDir: './dist-test',
      composite: true,
      declaration: true,
      declarationMap: false,
      sourceMap: false,
      noEmit: false
    },
    include: ['test/**/*'],
    references: refs
  };
}

function writeJson(path, obj) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, JSON.stringify(obj, null, 2) + '\n', 'utf8');
}

// packages/
for (const [p, deps] of Object.entries(PKG_DEPS)) {
  const dir = join(ROOT, 'packages', p);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  writeJson(join(dir, 'package.json'), packageJson(p, deps));
  writeJson(join(dir, 'tsconfig.json'), tsconfigJson('packages', deps));
  writeJson(join(dir, 'tsconfig.test.json'), tsconfigTestJson('packages', deps));
}

// adapters/ — every adapter depends on contracts + adapter-sdk
for (const a of ADAPTERS) {
  const dir = join(ROOT, 'adapters', a);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  const adapterDeps = ['contracts', 'adapter-sdk'];
  writeJson(join(dir, 'package.json'), packageJson(a, adapterDeps, { adapter: true }));
  writeJson(join(dir, 'tsconfig.json'), tsconfigJson('adapters', adapterDeps));
  writeJson(join(dir, 'tsconfig.test.json'), tsconfigTestJson('adapters', adapterDeps));
}

console.log(`Scaffolded ${Object.keys(PKG_DEPS).length} packages and ${ADAPTERS.length} adapters.`);
