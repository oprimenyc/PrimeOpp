// Clean-room verification: extract the ZIP into a fresh temp directory,
// install from lockfile, and run `npm run verify`.
import { spawnSync } from 'node:child_process';
import { mkdirSync, existsSync, rmSync, mkdtempSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

const downloadDir = '/home/z/my-project/download';
const zipPath = join(downloadDir, 'primeopp-commerce-core.zip');

if (!existsSync(zipPath)) {
  console.error(`ZIP not found: ${zipPath}. Run \`npm run package\` first.`);
  process.exit(1);
}

const cleanRoom = mkdtempSync(join(tmpdir(), 'primeopp-cleanroom-'));
console.log(`Clean room: ${cleanRoom}`);

// Extract
const unzip = spawnSync('unzip', ['-q', zipPath, '-d', cleanRoom], { stdio: 'inherit', shell: false });
if (unzip.status !== 0) {
  console.error(`unzip failed with exit ${unzip.status}`);
  process.exit(1);
}

// Install from lockfile (nofrozen-lockfile to allow re-resolution)
console.log('Running npm ci...');
const ci = spawnSync('npm', ['ci'], { cwd: cleanRoom, stdio: 'inherit', shell: true });
if (ci.status !== 0) {
  console.error(`npm ci failed with exit ${ci.status}`);
  process.exit(1);
}

// Run verify
console.log('Running npm run verify...');
const verify = spawnSync('npm', ['run', 'verify'], { cwd: cleanRoom, stdio: 'inherit', shell: true });
if (verify.status !== 0) {
  console.error(`npm run verify failed with exit ${verify.status}`);
  process.exit(1);
}

console.log('Clean-room verification PASSED.');
// Leave the clean room for inspection.
console.log(`Clean room preserved at: ${cleanRoom}`);
process.exit(0);
