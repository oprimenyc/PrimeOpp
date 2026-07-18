// Package the workspace into primeopp-commerce-core.zip
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, rmSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const downloadDir = '/home/z/my-project/download';
if (!existsSync(downloadDir)) mkdirSync(downloadDir, { recursive: true });

const zipPath = join(downloadDir, 'primeopp-commerce-core.zip');

// Remove existing zip
if (existsSync(zipPath)) rmSync(zipPath);

// Build the zip with proper exclusions.
// The `zip` command's -x patterns must match the full path within the archive.
// We exclude node_modules, dist, .DS_Store, log files, .tsbuildinfo, and the
// upload/ directory (which may contain the original mission spec).
const args = [
  '-r', '-q',
  zipPath,
  '.',  // archive the current directory
  '-x',
  'node_modules/*',
  'node_modules/**/*',
  '*/node_modules/*',
  '*/node_modules/**/*',
  '**/node_modules/**/*',
  'dist/*',
  '*/dist/*',
  '*/.DS_Store',
  '*.log',
  '*.tsbuildinfo',
  'upload/*',
];

const r = spawnSync('zip', args, { cwd: ROOT, stdio: 'inherit', shell: false });
if (r.status !== 0) {
  console.error(`zip failed with exit ${r.status}`);
  process.exit(1);
}

const stat = statSync(zipPath);
console.log(`Created ${zipPath} (${(stat.size / 1024).toFixed(1)} KB)`);

// Verify no node_modules / .env / secrets in the ZIP.
const verify = spawnSync('unzip', ['-l', zipPath], { cwd: ROOT, encoding: 'utf-8', shell: false });
const out = verify.stdout ?? '';
const lines = out.split('\n');
const bad: string[] = [];
for (const line of lines) {
  if (line.includes('node_modules/') && !line.endsWith('node_modules/')) bad.push(line.trim());
  if (/\.(env|pem|key)$/.test(line)) bad.push(line.trim());
  if (/password|secret/i.test(line) && !line.endsWith('/')) bad.push(line.trim());
}
if (bad.length > 0) {
  console.error('Forbidden entries in ZIP:');
  for (const b of bad.slice(0, 10)) console.error(`  ${b}`);
  process.exit(1);
}

// Print summary.
const fileCount = lines.filter((l) => l.trim().length > 0 && !l.startsWith('Archive') && !l.startsWith('  Length') && !l.startsWith('---------')).length;
console.log(`ZIP contains ${fileCount} files.`);
