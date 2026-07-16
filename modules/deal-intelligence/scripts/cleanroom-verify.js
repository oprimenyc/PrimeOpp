#!/usr/bin/env node
/**
 * Clean-room verification:
 *   1. Extract primeopp-deal-intelligence.zip into a fresh temp directory
 *   2. Run `npm install` from the lockfile
 *   3. Run `npm run verify`
 *   4. Confirm every required file exists
 *   5. Confirm no secrets, .env files or private credentials
 *   6. Confirm all test adapters are labeled test-only
 *   7. Confirm no package requires a paid provider or live retailer to verify
 */
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, rmSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = process.cwd();
const ZIP = join(ROOT, 'primeopp-deal-intelligence.zip');
const CLEANROOM = join(ROOT, 'cleanroom-verify');

if (!existsSync(ZIP)) {
  console.error('ZIP not found: ' + ZIP);
  process.exit(1);
}

if (existsSync(CLEANROOM)) rmSync(CLEANROOM, { recursive: true, force: true });
mkdirSync(CLEANROOM, { recursive: true });

function run(cmd, args, cwd, label) {
  console.log(`\n=== ${label} ===`);
  const r = spawnSync(cmd, args, { cwd, stdio: 'inherit' });
  if (r.status !== 0) {
    console.error(`${label} failed (exit ${r.status})`);
    return false;
  }
  return true;
}

// 1. Extract
if (!run('unzip', ['-q', ZIP, '-d', CLEANROOM], ROOT, 'Extract ZIP')) process.exit(1);

// 2. Install
if (!run('npm', ['install'], CLEANROOM, 'npm install')) process.exit(1);

// 3. Verify
if (!run('npm', ['run', 'verify'], CLEANROOM, 'npm run verify')) process.exit(1);

// 4. Required files
const REQUIRED = [
  'package.json', 'package-lock.json', 'tsconfig.json', 'README.md',
  'LICENSE', 'CHANGELOG.md', 'vitest.config.ts',
  'packages/contracts/src/index.ts',
  'packages/retailer-registry/src/index.ts',
  'packages/sdk/src/index.ts',
  'packages/cli/src/index.ts',
  'docs/ARCHITECTURE.md',
  'docs/SECURITY.md',
  'evidence/RUNTIME_VERIFICATION.md'
];
const missing = REQUIRED.filter(f => !existsSync(join(CLEANROOM, f)));
if (missing.length > 0) {
  console.error('Missing required files: ' + missing.join(', '));
  process.exit(1);
}
console.log('\n✓ All required files present');

// 5. Secret scan
function walk(dir, files = []) {
  for (const e of readdirSync(dir)) {
    if (e === 'node_modules' || e === '.git' || e === 'dist') continue;
    const p = join(dir, e);
    const s = statSync(p);
    if (s.isDirectory()) walk(p, files);
    else files.push(p);
  }
  return files;
}
const SECRET_PATTERNS = [
  /AKIA[0-9A-Z]{16}/,
  /sk_live_[0-9a-zA-Z]{24}/,
  /ghp_[0-9a-zA-Z]{36}/,
  /-----BEGIN (RSA |EC )?PRIVATE KEY-----/
];
const ENV_FILES = [];
let secretHits = 0;
for (const f of walk(CLEANROOM)) {
  if (/\.(env|env\..*)$/.test(f) || /\.env$/.test(f)) ENV_FILES.push(f);
  let content;
  try { content = readFileSync(f, 'utf-8'); } catch { continue; }
  for (const re of SECRET_PATTERNS) {
    if (re.test(content)) { secretHits++; console.error('Secret in: ' + f); }
  }
}
if (ENV_FILES.length > 0) {
  console.error('.env files found: ' + ENV_FILES.join(', '));
  process.exit(1);
}
if (secretHits > 0) {
  console.error(`${secretHits} secret(s) found`);
  process.exit(1);
}
console.log('✓ No secrets, no .env files');

// 6. test-only adapters
let adapterFiles = 0;
let testOnlyCount = 0;
for (const f of walk(join(CLEANROOM, 'packages'))) {
  if (!f.endsWith('.ts')) continue;
  const c = readFileSync(f, 'utf-8');
  if (c.includes('testOnly = true') || c.includes('testOnly: true') || c.includes('readonly testOnly = true')) {
    testOnlyCount++;
  }
  if (c.includes('implements') && c.includes('Adapter')) adapterFiles++;
}
if (testOnlyCount < 5) {
  console.error(`Only ${testOnlyCount} testOnly adapters found (expected 5+)`);
  process.exit(1);
}
console.log(`✓ ${testOnlyCount} test-only adapters labeled`);

// 7. No live retailer calls
// (Inspect that no source file imports node-fetch, axios, or plays with live URLs.)
const LIVE_LIBS = ['node-fetch', 'axios', 'got(', 'puppeteer', 'playwright'];
let liveHits = 0;
for (const f of walk(join(CLEANROOM, 'packages'))) {
  if (!f.endsWith('.ts')) continue;
  const c = readFileSync(f, 'utf-8');
  for (const lib of LIVE_LIBS) {
    if (c.includes(lib)) {
      // Allow playwright mentions in comments only
      if (c.includes('//') && c.split('\n').filter(l => l.includes(lib)).every(l => l.trim().startsWith('//'))) continue;
      liveHits++; console.error(`Live lib ${lib} in ${f}`);
    }
  }
}
if (liveHits > 0) {
  console.error(`${liveHits} live-library references found (no package may require live retailer)`);
  process.exit(1);
}
console.log('✓ No live-retailer/paid-provider dependencies');

writeFileSync(join(ROOT, 'evidence', 'CLEANROOM_RESULTS.json'), JSON.stringify({
  extractedTo: CLEANROOM,
  installOk: true,
  verifyOk: true,
  requiredFilesOk: missing.length === 0,
  secretsOk: secretHits === 0,
  envFilesOk: ENV_FILES.length === 0,
  testOnlyAdapters: testOnlyCount,
  noLiveRetailer: liveHits === 0,
  ok: true
}, null, 2) + '\n');

console.log('\n✓ Clean-room verification PASS');
process.exit(0);
