// Simple lint: checks for forbidden patterns.
import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';

const ROOT = new URL('../', import.meta.url).pathname;
const FORBIDDEN_PATTERNS = [
  { pattern: /\|\|\s*true\b/, msg: 'swallowed `|| true`' },
  { pattern: /\bTODO\b/, msg: 'TODO comment' },
  { pattern: /\bFIXME\b/, msg: 'FIXME comment' },
  { pattern: /\bplaceholder\s+implementation\b/i, msg: 'placeholder implementation' },
  { pattern: /\bnot\s+implemented\b/i, msg: '"not implemented" comment' },
  { pattern: /\bmock-only\s+core\b/i, msg: 'mock-only core reference' },
  // Empty catch blocks (with only whitespace or only a comment).
  { pattern: /catch\s*\([^)]*\)\s*\{\s*(\/\/[^\n]*)?\s*\}/, msg: 'empty catch block' },
];

const files: string[] = [];
function walk(dir: string) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name === 'dist' || entry.name === '.git') continue;
    const full = join(dir, entry.name);
    if (entry.isDirectory()) walk(full);
    else if (entry.name.endsWith('.ts') || entry.name.endsWith('.js')) files.push(full);
  }
}
walk(join(ROOT, 'packages'));

let issues = 0;
for (const f of files) {
  const content = readFileSync(f, 'utf-8');
  for (const { pattern, msg } of FORBIDDEN_PATTERNS) {
    if (pattern.test(content)) {
      console.error(`${relative(ROOT, f)}: ${msg}`);
      issues++;
    }
  }
}

if (issues > 0) {
  console.error(`\n${issues} lint issue(s) found.`);
  process.exit(1);
}
console.log('No lint issues found.');
process.exit(0);
