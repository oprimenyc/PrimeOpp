// Generates standard package.json and tsconfig.json for every workspace package.
import { writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(dirname(fileURLToPath(import.meta.url))), 'packages');
const PKGS = [
  'contracts', 'schemas', 'product-identity', 'barcode', 'ocr-contracts',
  'image-match-contracts', 'canonical-catalog', 'variant-engine', 'condition-engine',
  'inventory', 'pricing', 'fee-engine', 'shipping-estimator', 'profit-engine',
  'opportunity-engine', 'listing-contracts', 'channel-contracts', 'commerce-events',
  'tenant-config', 'evidence', 'adapter-sdk', 'adapter-testkit', 'sdk', 'cli'
];

// Map of package name -> dependency array (lowercase names)
const DEPS = {
  'contracts': [],
  'schemas': ['contracts'],
  'barcode': ['contracts'],
  'ocr-contracts': ['contracts'],
  'image-match-contracts': ['contracts'],
  'variant-engine': ['contracts'],
  'condition-engine': ['contracts'],
  'product-identity': ['contracts', 'barcode', 'ocr-contracts', 'image-match-contracts', 'variant-engine', 'condition-engine'],
  'canonical-catalog': ['contracts', 'product-identity', 'variant-engine', 'condition-engine'],
  'inventory': ['contracts', 'commerce-events'],
  'pricing': ['contracts', 'fee-engine'],
  'fee-engine': ['contracts'],
  'shipping-estimator': ['contracts'],
  'profit-engine': ['contracts', 'fee-engine', 'shipping-estimator', 'pricing'],
  'opportunity-engine': ['contracts', 'profit-engine', 'pricing'],
  'listing-contracts': ['contracts', 'pricing'],
  'channel-contracts': ['contracts', 'listing-contracts'],
  'commerce-events': ['contracts'],
  'tenant-config': ['contracts'],
  'evidence': ['contracts'],
  'adapter-sdk': ['contracts', 'commerce-events'],
  'adapter-testkit': ['contracts', 'barcode', 'ocr-contracts', 'image-match-contracts', 'channel-contracts', 'pricing'],
  'sdk': ['contracts', 'barcode', 'product-identity', 'variant-engine', 'condition-engine', 'canonical-catalog', 'inventory', 'pricing', 'fee-engine', 'shipping-estimator', 'profit-engine', 'opportunity-engine', 'listing-contracts', 'channel-contracts', 'commerce-events', 'tenant-config', 'evidence', 'adapter-sdk', 'adapter-testkit'],
  'cli': ['sdk', 'contracts', 'barcode', 'pricing', 'profit-engine', 'opportunity-engine', 'inventory', 'listing-contracts', 'channel-contracts', 'adapter-testkit', 'tenant-config']
};

for (const name of PKGS) {
  const pkgDir = join(ROOT, name);
  if (!existsSync(join(pkgDir, 'src'))) mkdirSync(join(pkgDir, 'src'), { recursive: true });
  if (!existsSync(join(pkgDir, 'tests'))) mkdirSync(join(pkgDir, 'tests'), { recursive: true });

  const deps = DEPS[name] || [];
  const dependencies = {};
  for (const d of deps) {
    dependencies[`@primeopp/${d}`] = '1.0.0';
  }

  const pkgJson = {
    name: `@primeopp/${name}`,
    version: '1.0.0',
    description: `PrimeOpp Commerce Core — ${name}.`,
    license: 'Apache-2.0',
    type: 'module',
    main: './src/index.ts',
    types: './src/index.ts',
    exports: {
      '.': {
        types: './src/index.ts',
        import: './src/index.ts'
      }
    },
    scripts: {
      typecheck: 'tsc --noEmit',
      test: 'node --test "tests/**/*.test.ts"'
    },
    ...(Object.keys(dependencies).length > 0 ? { dependencies } : {})
  };

  writeFileSync(join(pkgDir, 'package.json'), JSON.stringify(pkgJson, null, 2) + '\n');

  const tsconfig = {
    extends: '../../tsconfig.json',
    compilerOptions: {
      composite: false,
      noEmit: true
    },
    include: ['src/**/*.ts', 'tests/**/*.ts']
  };
  writeFileSync(join(pkgDir, 'tsconfig.json'), JSON.stringify(tsconfig, null, 2) + '\n');
}

console.log(`Generated package.json + tsconfig.json for ${PKGS.length} packages.`);
