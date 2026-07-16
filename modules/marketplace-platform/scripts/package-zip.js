// scripts/package-zip.js — packages the platform into primeopp-marketplace-platform.zip.
// Excludes: node_modules, dist, dist-test, .tsbuildinfo, .env files, secrets.
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const DOWNLOAD_DIR = resolve(ROOT, '..'); // parent of project root
const ZIP_PATH = join(DOWNLOAD_DIR, 'primeopp-marketplace-platform.zip');

// Ensure download dir exists
mkdirSync(DOWNLOAD_DIR, { recursive: true });

// Remove existing ZIP
if (existsSync(ZIP_PATH)) rmSync(ZIP_PATH);

// Use tar with gzip (more reliable than zip for cross-platform)
const TARGZ_PATH = ZIP_PATH.replace(/\.zip$/, '.tar.gz');

// Build exclusion list
const excludes = [
  '--exclude=./node_modules',
  '--exclude=./packages/*/node_modules',
  '--exclude=./adapters/*/node_modules',
  '--exclude=./.git',
  '--exclude=./.env',
  '--exclude=./.env.*',
  '--exclude=./.DS_Store',
  '--exclude=./*.tsbuildinfo',
  '--exclude=./packages/*/*.tsbuildinfo',
  '--exclude=./adapters/*/*.tsbuildinfo',
  '--exclude=./packages/*/dist',
  '--exclude=./adapters/*/dist',
  '--exclude=./packages/*/dist-test',
  '--exclude=./adapters/*/dist-test',
  '--exclude=./.zipexclude'
];

// Try zip first (preserves spec-required .zip extension)
const excludePatterns = [
  'node_modules/*', 'node_modules/**/*',
  'packages/*/node_modules/*', 'packages/*/node_modules/**/*',
  'adapters/*/node_modules/*', 'adapters/*/node_modules/**/*',
  'packages/*/dist/*', 'packages/*/dist/**/*',
  'adapters/*/dist/*', 'adapters/*/dist/**/*',
  'packages/*/dist-test/*', 'packages/*/dist-test/**/*',
  'adapters/*/dist-test/*', 'adapters/*/dist-test/**/*',
  '*.tsbuildinfo', 'packages/*/*.tsbuildinfo', 'adapters/*/*.tsbuildinfo',
  '.env', '.env.*', '.git/*', '.git/**/*', '.DS_Store', '.zipexclude'
];

const excludeFile = join(ROOT, '.zipexclude');
writeFileSync(excludeFile, excludePatterns.map(p => p.replace(/^\.\//, '')).join('\n') + '\n', 'utf8');

const zipResult = spawnSync('zip', ['-r', '-q', ZIP_PATH, '.', '-x', `@${excludeFile}`], { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });

if (zipResult.status === 0 && existsSync(ZIP_PATH)) {
  console.log(`Created: ${ZIP_PATH}`);
  const verify = spawnSync('unzip', ['-l', ZIP_PATH], { encoding: 'utf8' });
  if (verify.status === 0) {
    const lines = verify.stdout.split('\n').filter(Boolean);
    // Count entries (excluding header/footer lines)
    const fileCount = lines.length - 3; // last 3 lines are summary
    let hasNodeModules = false;
    for (const l of lines) {
      if (l.includes('node_modules/')) { hasNodeModules = true; break; }
    }
    console.log(`ZIP contains ${fileCount} entries.`);
    if (hasNodeModules) {
      console.error('WARNING: ZIP contains node_modules — exclude failed.');
      // Fall through to tar fallback
    } else {
      // Cleanup
      try { rmSync(excludeFile); } catch {}
      process.exit(0);
    }
  }
}

// Fallback: tar.gz
console.log('Falling back to tar.gz...');
if (existsSync(ZIP_PATH)) rmSync(ZIP_PATH);
const tarResult = spawnSync('tar', [...excludes, '-czf', TARGZ_PATH, '.'], { cwd: ROOT, encoding: 'utf8' });
if (tarResult.status !== 0) {
  console.error('tar failed:', tarResult.stderr);
  process.exit(1);
}
console.log(`Created: ${TARGZ_PATH}`);

// Verify
const verifyTar = spawnSync('tar', ['-tzf', TARGZ_PATH], { encoding: 'utf8' });
if (verifyTar.status === 0) {
  const entries = verifyTar.stdout.split('\n').filter(Boolean);
  const hasNodeModules = entries.some(e => e.includes('node_modules/'));
  console.log(`TARBALL contains ${entries.length} entries.`);
  if (hasNodeModules) {
    console.error('WARNING: tarball contains node_modules — exclude failed.');
    process.exit(1);
  }
}

// Cleanup exclude file
try { rmSync(excludeFile); } catch {}

