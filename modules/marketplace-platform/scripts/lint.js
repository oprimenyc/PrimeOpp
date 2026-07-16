// scripts/lint.js — simple lint that scans source for forbidden patterns.
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');

const FORBIDDEN_PATTERNS = [
  { name: 'TODO', pattern: /\bTODO\b/ },
  { name: 'FIXME', pattern: /\bFIXME\b/ },
  { name: 'placeholder', pattern: /\bplaceholder\b/i },
  { name: 'not implemented', pattern: /\bnot implemented\b/i },
  { name: 'swallowed exception (|| true)', pattern: /\|\|\s*true/ },
  { name: 'empty catch', pattern: /catch\s*\([^)]*\)\s*\{\s*\}/ }
];

const FORBIDDEN_STRINGS = [
  'AKIA', // AWS access key prefix
  'sk_live_', // Stripe live key prefix
  'ghp_', // GitHub PAT prefix
  'xoxb-' // Slack token prefix
];

function walk(dir, files = []) {
  const entries = readdirSync(dir);
  for (const e of entries) {
    const p = join(dir, e);
    const s = statSync(p);
    if (s.isDirectory()) {
      if (e === 'node_modules' || e === 'dist' || e === 'dist-test' || e === '.git') continue;
      walk(p, files);
    } else if (s.isFile() && (p.endsWith('.ts') || p.endsWith('.js') || p.endsWith('.json') || p.endsWith('.md'))) {
      files.push(p);
    }
  }
  return files;
}

const files = walk(join(ROOT, 'packages')).concat(walk(join(ROOT, 'adapters')));
let violations = 0;
const details = [];

for (const f of files) {
  let content;
  try { content = readFileSync(f, 'utf8'); } catch { continue; }
  for (const { name, pattern } of FORBIDDEN_PATTERNS) {
    const matches = content.match(new RegExp(pattern.source, 'g'));
    if (matches) {
      // Allow "placeholder" in test fixtures where it's explicitly documenting
      if (name === 'placeholder' && f.includes('fixtures/')) continue;
      // Allow "not implemented" in docs that discuss limitations
      if (name === 'not implemented' && f.endsWith('.md')) continue;
      // Allow "placeholder" in docs that discuss the concept
      if (name === 'placeholder' && f.endsWith('.md')) continue;
      violations++;
      details.push(`${f}: ${name} (${matches.length}x)`);
    }
  }
  for (const s of FORBIDDEN_STRINGS) {
    if (content.includes(s)) {
      violations++;
      details.push(`${f}: forbidden secret string "${s}"`);
    }
  }
}

if (violations > 0) {
  console.error(`Lint failed with ${violations} violation(s):`);
  for (const d of details) console.error('  ' + d);
  process.exit(1);
} else {
  console.log(`Lint passed: ${files.length} files scanned, no forbidden patterns.`);
}
