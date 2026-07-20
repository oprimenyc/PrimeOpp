// Small shared helper for JSON-file-backed persistence.
//
// Writes are atomic (write to a sibling temp file, then rename) so a crash
// mid-write never corrupts the on-disk store. Reads tolerate a missing file
// (fresh install) but not a malformed one (data corruption must surface,
// never be silently discarded).

import { readFile, writeFile, rename, mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';

export async function readJsonFile<T>(path: string, fallback: T): Promise<T> {
  try {
    const raw = await readFile(path, 'utf-8');
    return JSON.parse(raw) as T;
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return fallback;
    throw new Error(`PIPELINE_STORE_CORRUPT: failed to read/parse ${path}: ${(err as Error).message}`);
  }
}

export async function writeJsonFileAtomic(path: string, value: unknown): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  const tmpPath = `${path}.${process.pid}.${Date.now()}.tmp`;
  await writeFile(tmpPath, JSON.stringify(value, null, 2), 'utf-8');
  await rename(tmpPath, path);
}
