// Typecheck all packages in dependency order.
import { spawnSync } from 'node:child_process';
import { readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = new URL('../', import.meta.url).pathname;
const packagesDir = join(ROOT, 'packages');
const all = readdirSync(packagesDir).filter((d) => existsSync(join(packagesDir, d, 'tsconfig.json')));

let failed = 0;
for (const pkg of all) {
  const r = spawnSync('npx', ['tsc', '--noEmit', '-p', `packages/${pkg}/tsconfig.json`], { cwd: ROOT, shell: true, stdio: 'inherit' });
  if (r.status !== 0) {
    console.error(`✗ ${pkg} (exit ${r.status})`);
    failed++;
  } else {
    console.log(`✓ ${pkg}`);
  }
}

if (failed > 0) {
  console.error(`\n${failed} package(s) failed typecheck`);
  process.exit(1);
}
console.log(`\nAll ${all.length} packages typechecked cleanly.`);
