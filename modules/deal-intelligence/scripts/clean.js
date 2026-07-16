#!/usr/bin/env node
/** Clean dist, tsbuildinfo, and cleanroom-verify. */
import { rmSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { readdirSync, statSync } from 'node:fs';

const ROOT = process.cwd();
for (const d of readdirSync(ROOT)) {
  if (d === 'node_modules' || d === '.git') continue;
  const p = join(ROOT, d);
  if (d === 'cleanroom-verify' && existsSync(p)) { rmSync(p, { recursive: true, force: true }); continue; }
  if (!statSync(p).isDirectory()) continue;
  // Remove dist inside packages
  if (d === 'packages') {
    for (const sub of readdirSync(p)) {
      const dist = join(p, sub, 'dist');
      if (existsSync(dist)) rmSync(dist, { recursive: true, force: true });
    }
  }
}
console.log('Clean: done');
