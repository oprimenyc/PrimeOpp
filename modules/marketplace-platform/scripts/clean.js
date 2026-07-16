// scripts/clean.js — removes build artifacts.
import { rmSync, existsSync } from 'node:fs';
import { readdirSync, statSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');

function cleanDir(dir) {
  if (!existsSync(dir)) return;
  for (const entry of readdirSync(dir)) {
    const p = join(dir, entry);
    const s = statSync(p);
    if (s.isDirectory()) {
      if (entry === 'dist' || entry === 'dist-test' || entry === 'node_modules') {
        rmSync(p, { recursive: true, force: true });
      }
    } else if (entry.endsWith('.tsbuildinfo')) {
      rmSync(p, { force: true });
    }
  }
}

for (const sub of ['packages', 'adapters']) {
  const subDir = join(ROOT, sub);
  if (!existsSync(subDir)) continue;
  for (const entry of readdirSync(subDir)) {
    const p = join(subDir, entry);
    if (statSync(p).isDirectory()) cleanDir(p);
  }
}

console.log('Clean complete.');
