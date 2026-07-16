import { describe, it, expect } from 'vitest';
import { StubBrowserOperatorAdapter } from '../src/index.js';

describe('browser-contracts', () => {
  it('StubBrowserOperatorAdapter is test-only and returns deterministic snapshot', async () => {
    const a = new StubBrowserOperatorAdapter();
    expect(a.testOnly).toBe(true);
    const s = await a.openSession();
    const snap = await a.navigate(s, { url: 'https://example.com' });
    expect(snap.url).toBe('https://example.com');
    expect(snap.html).toContain('stub');
  });
  it('screenshot returns payload ref and hash', async () => {
    const a = new StubBrowserOperatorAdapter();
    const s = await a.openSession();
    const sh = await a.screenshot(s);
    expect(sh.payloadRef).toBeTruthy();
    expect(sh.hash).toBeTruthy();
  });
});
