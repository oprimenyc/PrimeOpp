import { describe, it, expect } from 'vitest';
import { CsvFixtureFeedAdapter } from '../src/index.js';

describe('feed-contracts', () => {
  it('parses CSV fixture into records', async () => {
    const a = new CsvFixtureFeedAdapter();
    expect(a.testOnly).toBe(true);
    const r = await a.parse('id,title,price\n1,Widget,9.99\n2,Gadget,19.99');
    expect(r.format).toBe('csv');
    expect(r.records).toHaveLength(2);
    expect(r.records[0].raw['title']).toBe('Widget');
  });
  it('fetch returns empty (never network)', async () => {
    const a = new CsvFixtureFeedAdapter();
    const r = await a.fetch('https://example.com/feed.csv');
    expect(r.records).toHaveLength(0);
  });
});
