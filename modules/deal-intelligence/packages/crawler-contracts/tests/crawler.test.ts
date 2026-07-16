import { describe, it, expect } from 'vitest';
import { FixtureCrawlerAdapter, assertSafeUrl, normalizeUrl, validateRedirectChain } from '../src/index.js';

describe('crawler-contracts', () => {
  it('FixtureCrawlerAdapter serves fixtures and marks fromFixture', async () => {
    const fx = new Map([['https://example.com/p', '<html></html>']]);
    const a = new FixtureCrawlerAdapter(fx);
    expect(a.testOnly).toBe(true);
    const r = await a.fetch({ url: 'https://example.com/p', termsBasis: 'fixture-only' });
    expect(r.status).toBe(200);
    expect(r.fromFixture).toBe(true);
  });
  it('returns 404 for unknown fixtures', async () => {
    const a = new FixtureCrawlerAdapter(new Map());
    const r = await a.fetch({ url: 'https://example.com/x', termsBasis: 'fixture-only' });
    expect(r.status).toBe(404);
  });
  it('assertSafeUrl blocks internal addresses (SSRF)', () => {
    expect(() => assertSafeUrl('http://127.0.0.1/')).toThrow();
    expect(() => assertSafeUrl('http://localhost/')).toThrow();
    expect(() => assertSafeUrl('http://192.168.1.1/')).toThrow();
    expect(() => assertSafeUrl('file:///etc/passwd')).toThrow();
    expect(assertSafeUrl('https://www.amazon.com/dp/B0XYZ')).toBe('https://www.amazon.com/dp/B0XYZ');
  });
  it('normalizeUrl drops tracking parameters', () => {
    const n = normalizeUrl('https://www.amazon.com/dp/B0XYZ?utm_source=foo&ref=bar&q=1');
    expect(n).toBe('https://www.amazon.com/dp/B0XYZ?q=1');
  });
  it('normalizeUrl lowercases host and strips trailing slash', () => {
    const n = normalizeUrl('https://WWW.Example.com/Path/');
    expect(n).toBe('https://www.example.com/Path');
  });
  it('validateRedirectChain rejects cross-domain redirect', () => {
    expect(validateRedirectChain(
      ['https://www.amazon.com/a', 'https://evil.com/b'],
      ['www.amazon.com']
    )).toBe(false);
  });
});
