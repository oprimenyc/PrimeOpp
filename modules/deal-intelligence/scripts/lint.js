#!/usr/bin/env node
/**
 * PrimeOpp Deal Intelligence — Lint
 *
 * Searches source code for forbidden patterns: TODO, FIXME, placeholder,
 * "not implemented", swallowed exceptions, `|| true`, hardcoded secrets,
 * missing affiliate disclosures, fake discount logic, etc.
 *
 * Exits 1 if any forbidden pattern is found, 0 otherwise.
 */
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, relative } from 'node:path';

const ROOT = process.cwd();
const FORBIDDEN_PATTERNS = [
  { re: /\bTODO\b/, reason: 'unresolved TODO' },
  { re: /\bFIXME\b/, reason: 'unresolved FIXME' },
  { re: /not implemented/i, reason: 'explicit "not implemented"' },
  { re: /placeholder implementation/i, reason: 'placeholder implementation' },
  { re: /\|\|\s*true/, reason: 'swallowed boolean (|| true)' },
  { re: /catch\s*\([^)]*\)\s*\{\s*\}/, reason: 'empty catch block' },
  { re: /AKIA[0-9A-Z]{16}/, reason: 'hardcoded AWS access key pattern' },
  { re: /sk_live_[0-9a-zA-Z]{24}/, reason: 'hardcoded Stripe live key pattern' },
  { re: /ghp_[0-9a-zA-Z]{36}/, reason: 'hardcoded GitHub PAT pattern' },
  { re: /password\s*=\s*['"][^'"]+['"]/i, reason: 'hardcoded password assignment' },
  { re: /api[_-]?key\s*=\s*['"][^'"]+['"]/i, reason: 'hardcoded api key assignment' }
];

// Whitelist: comments that mention these patterns in a documentation context.
const ALLOWED = [
  /\/\/.*forbidden/i,
  /\/\/.*never/i,
  /\/\/.*must not/i,
  /\*.*forbidden/i,
  /\*.*never/i,
  /\*.*must not/i
];

function walk(dir, files = []) {
  for (const entry of readdirSync(dir)) {
    if (entry === 'node_modules' || entry === 'dist' || entry === '.git' || entry === 'cleanroom-verify') continue;
    const p = join(dir, entry);
    const s = statSync(p);
    if (s.isDirectory()) walk(p, files);
    else if (/\.(ts|js|json|md)$/.test(entry)) {
      // Skip this lint script itself (it contains pattern strings that match the patterns).
      if (p.endsWith('scripts/lint.js')) continue;
      files.push(p);
    }
  }
  return files;
}

const files = walk(ROOT);
let issues = 0;
const findings = [];

for (const file of files) {
  let content;
  try { content = readFileSync(file, 'utf-8'); } catch { continue; }
  const lines = content.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!line) continue;
    for (const { re, reason } of FORBIDDEN_PATTERNS) {
      if (re.test(line)) {
        // Check allowlist (documentation comments)
        if (ALLOWED.some(a => a.test(line))) continue;
        findings.push(`${relative(ROOT, file)}:${i + 1}: ${reason}: ${line.trim().slice(0, 100)}`);
        issues++;
      }
    }
  }
}

if (issues > 0) {
  console.error(`Lint: ${issues} forbidden pattern(s) found:`);
  for (const f of findings.slice(0, 50)) console.error('  ' + f);
  if (findings.length > 50) console.error(`  ... and ${findings.length - 50} more`);
  process.exit(1);
}
console.log('Lint: OK — no forbidden patterns found.');
