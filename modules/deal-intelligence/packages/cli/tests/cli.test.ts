import { describe, it, expect } from 'vitest';
import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';

const CLI = process.env.CLI_DIST
  ? process.env.CLI_DIST
  : null;

describe('cli (smoke)', () => {
  it('package source file exists', () => {
    // Without a build step in unit tests, we verify the source file is present.
    const src = '/home/z/my-project/primeopp-deal-intelligence/packages/cli/src/index.ts';
    expect(existsSync(src)).toBe(true);
  });
  it('usage prints when no args (only if dist exists)', () => {
    if (!CLI) return; // skip when dist is not built
    const out = execFileSync('node', [CLI], { encoding: 'utf-8' });
    expect(out).toMatch(/primeopp-deals/);
  });
});
