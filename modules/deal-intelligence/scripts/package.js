#!/usr/bin/env node
/**
 * Package the monorepo into primeopp-deal-intelligence.zip
 * Excludes node_modules, dist, .git, and the zip itself.
 */
import { spawnSync } from 'node:child_process';
import { existsSync, rmSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = process.cwd();
const ZIP = join(ROOT, 'primeopp-deal-intelligence.zip');

if (existsSync(ZIP)) rmSync(ZIP);

// Use zip if available, else fall back to tar with gzip.
const r = spawnSync('zip', [
  '-r',
  '-q',
  ZIP,
  '.',
  '-x', 'node_modules/*',
  '-x', '*/node_modules/*',
  '-x', '*/dist/*',
  '-x', '.git/*',
  '-x', 'primeopp-deal-intelligence.zip',
  '-x', 'cleanroom-verify/*',
  '-x', '*.tsbuildinfo',
  '-x', 'evidence/*.json'
], { cwd: ROOT, stdio: 'inherit' });

if (r.status !== 0) {
  console.error('zip command failed (exit ' + r.status + ')');
  process.exit(1);
}
console.log('Package created: ' + ZIP);
