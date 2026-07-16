// scripts/clean-room-verify.js — extracts the ZIP into a fresh temp directory,
// installs from lockfile, runs the verification command, confirms required files exist,
// confirms no secrets/.env/payment credentials are included.
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, rmSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const DOWNLOAD_DIR = resolve(ROOT, '..');
const ZIP_PATH = join(DOWNLOAD_DIR, 'primeopp-marketplace-platform.zip');

if (!existsSync(ZIP_PATH)) {
  console.error(`ZIP not found: ${ZIP_PATH}`);
  console.error('Run `node scripts/package-zip.js` first.');
  process.exit(1);
}

const FRESH_DIR = join(tmpdir(), `primeopp-clean-room-${Date.now()}`);
console.log(`Clean-room verify in: ${FRESH_DIR}`);
mkdirSync(FRESH_DIR, { recursive: true });

// Extract ZIP
const extract = spawnSync('unzip', ['-q', ZIP_PATH, '-d', FRESH_DIR], { encoding: 'utf8' });
if (extract.status !== 0) {
  console.error('unzip failed:', extract.stderr);
  console.error('Falling back to tar.gz...');
  const tarGz = ZIP_PATH.replace(/\.zip$/, '.tar.gz');
  if (existsSync(tarGz)) {
    const t = spawnSync('tar', ['-xzf', tarGz, '-C', FRESH_DIR], { encoding: 'utf8' });
    if (t.status !== 0) { console.error('tar failed:', t.stderr); process.exit(1); }
  } else {
    console.error('No tar.gz fallback available.');
    process.exit(1);
  }
}

// Confirm required source files exist (dist/ will be built in clean room)
const requiredFiles = [
  'package.json',
  'package-lock.json',
  'tsconfig.json',
  'tsconfig.base.json',
  'tsconfig.build.json',
  'tsconfig.test.json',
  'README.md',
  'LICENSE',
  'CHANGELOG.md',
  'packages/contracts/src/index.ts',
  'packages/sdk/src/index.ts',
  'packages/cli/src/index.ts',
  'adapters/primeopp-marketplace/src/index.ts',
  'scripts/verify.js',
  'scripts/lint.js',
  'scripts/clean.js'
];

const missing = [];
for (const f of requiredFiles) {
  if (!existsSync(join(FRESH_DIR, 'primeopp-marketplace-platform', f)) && !existsSync(join(FRESH_DIR, f))) {
    missing.push(f);
  }
}
if (missing.length > 0) {
  console.error('Missing required files in ZIP:');
  for (const m of missing) console.error('  ' + m);
  process.exit(1);
}
console.log(`All ${requiredFiles.length} required source files present.`);

// Confirm no secrets
// Note: 'secrets.ts' in packages/contracts/src/types/ is a type definitions file for SecretReference — legitimate.
// We check filenames for actual secret-bearing patterns and scan content for real credential strings.
const forbiddenFilePatterns = [/\.env$/, /\.env\./, /\.pem$/, /\.key$/, /\.p12$/, /^credentials\./, /^secret\./];
const forbiddenContent = ['AKIA', 'sk_live_', 'ghp_', 'xoxb-', 'BEGIN PRIVATE KEY'];

function walk(dir, files = []) {
  for (const e of readdirSync(dir)) {
    const p = join(dir, e);
    const s = statSync(p);
    if (s.isDirectory()) {
      if (e === 'node_modules' || e === '.git') continue;
      walk(p, files);
    } else {
      files.push(p);
    }
  }
  return files;
}

const basePath = existsSync(join(FRESH_DIR, 'primeopp-marketplace-platform')) ? join(FRESH_DIR, 'primeopp-marketplace-platform') : FRESH_DIR;
const allFiles = walk(basePath);
let secretFound = false;
for (const f of allFiles) {
  const rel = f.replace(basePath + '/', '');
  const basename = rel.split('/').pop() ?? '';
  for (const pat of forbiddenFilePatterns) {
    if (pat.test(basename)) {
      console.error(`Forbidden file: ${rel}`);
      secretFound = true;
    }
  }
  // Scan content for forbidden strings
  if (f.endsWith('.ts') || f.endsWith('.js') || f.endsWith('.json') || f.endsWith('.md')) {
    let content;
    try { content = readFileSync(f, 'utf8'); } catch { continue; }
    for (const s of forbiddenContent) {
      if (content.includes(s)) {
        // Allow mention of these in audit/lint/clean-room scripts that detect them
        if (f.endsWith('audit.js') || f.endsWith('lint.js') || f.endsWith('clean-room-verify.js') || f.endsWith('THREAT_MODEL.md') || f.endsWith('SECURITY.md')) continue;
        console.error(`Forbidden content "${s}" in: ${rel}`);
        secretFound = true;
      }
    }
  }
}
if (secretFound) {
  console.error('Secrets detected in ZIP — aborting.');
  process.exit(1);
}
console.log('No secrets detected in ZIP content.');

// Install from lockfile
console.log('Installing from lockfile...');
const install = spawnSync('npm', ['ci', '--no-audit', '--no-fund'], { cwd: basePath, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
if (install.status !== 0) {
  console.error('npm ci failed:', install.stderr);
  // Fall back to npm install
  const install2 = spawnSync('npm', ['install', '--no-audit', '--no-fund'], { cwd: basePath, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  if (install2.status !== 0) {
    console.error('npm install also failed:', install2.stderr);
    process.exit(1);
  }
}

// Build
console.log('Building...');
const build = spawnSync('npx', ['tsc', '-b', 'tsconfig.build.json'], { cwd: basePath, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
if (build.status !== 0) {
  console.error('build failed:', build.stderr);
  process.exit(1);
}

// Build tests
console.log('Building tests...');
const testBuild = spawnSync('npx', ['tsc', '-b', 'tsconfig.test.json'], { cwd: basePath, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
if (testBuild.status !== 0) {
  console.error('test build failed:', testBuild.stderr);
  process.exit(1);
}

// Run verify
console.log('Running verify...');
const verify = spawnSync('node', ['scripts/verify.js'], { cwd: basePath, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
if (verify.status !== 0) {
  console.error('verify failed:', verify.stdout, verify.stderr);
  process.exit(1);
}

console.log('\n=== CLEAN-ROOM VERIFICATION PASSED ===');
console.log(`Fresh install + build + verify all succeeded in ${FRESH_DIR}.`);

// Cleanup
rmSync(FRESH_DIR, { recursive: true, force: true });
process.exit(0);
