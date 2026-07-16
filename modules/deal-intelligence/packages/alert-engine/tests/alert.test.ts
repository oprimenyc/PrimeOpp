import { describe, it, expect } from 'vitest';
import { AlertEngine, InMemoryAlertCaptureAdapter } from '../src/index.js';

describe('alert-engine', () => {
  it('emits to registered adapter', async () => {
    const discordAdapter = new InMemoryAlertCaptureAdapter('discord');
    const engine = new AlertEngine([{
      id: 'r1', tenantId: 't1' as any, name: 'high-score',
      types: ['new-deal'], channels: ['discord'], mode: 'immediate',
      minScore: 70
    }]);
    engine.registerAdapter(discordAdapter);
    const alerts = await engine.emit({
      type: 'new-deal', tenantId: 't1' as any, headline: 'Big deal!',
      body: '50% off', score: 85
    });
    expect(alerts).toHaveLength(1);
    expect(alerts[0].deliveredTo).toHaveLength(1);
    expect(alerts[0].deliveredTo[0].success).toBe(true);
    expect(discordAdapter.captured).toHaveLength(1);
  });
  it('does not emit when score below threshold', async () => {
    const engine = new AlertEngine([{
      id: 'r1', tenantId: 't1' as any, name: 'high-score',
      types: ['new-deal'], channels: ['discord'], mode: 'immediate',
      minScore: 70
    }]);
    const alerts = await engine.emit({
      type: 'new-deal', tenantId: 't1' as any, headline: 'x', body: 'y', score: 50
    });
    expect(alerts).toHaveLength(0);
  });
  it('duplicate suppression within window', async () => {
    const engine = new AlertEngine([{
      id: 'r1', tenantId: 't1' as any, name: 'r',
      types: ['new-deal'], channels: ['website'], mode: 'immediate',
      duplicateSuppressionWindowMin: 60
    }]);
    engine.registerAdapter(new InMemoryAlertCaptureAdapter('website'));
    await engine.emit({ type: 'new-deal', tenantId: 't1' as any, headline: 'a', body: 'b', dealId: 'd1' as any, observedAt: '2024-01-01T00:00:00Z' });
    const second = await engine.emit({ type: 'new-deal', tenantId: 't1' as any, headline: 'a', body: 'b', dealId: 'd1' as any, observedAt: '2024-01-01T00:10:00Z' });
    expect(second[0].suppressed).toBe(true);
  });
  it('rejects non-testOnly adapter', () => {
    const engine = new AlertEngine([]);
    const bad = { adapterId: 'bad' as any, channel: 'discord' as const, testOnly: false as const,
      async deliver() { return { success: true, at: '2024-01-01T00:00:00Z' }; } };
    expect(() => engine.registerAdapter(bad)).toThrow();
  });
});
