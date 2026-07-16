/**
 * @primeopp-deal-intelligence/alert-engine
 *
 * Configurable multi-channel alert engine with LOCAL CAPTURE ONLY.
 * Does NOT send real notifications.
 */
import type {
  AlertRule, Alert, AlertType, AlertChannel, TenantId, DealId, ISO8601, AdapterId
} from '@primeopp-deal-intelligence/contracts';
import { nextId, nowIso } from '@primeopp-deal-intelligence/contracts';

export interface AlertContext {
  type: AlertType;
  dealId?: DealId;
  tenantId: TenantId;
  headline: string;
  body: string;
  score?: number;
  discountPct?: number;
  expectedProfitMinor?: number;
  roi?: number;
  category?: string;
  retailerId?: string;
  region?: string;
  productId?: string;
  premiumTier?: string;
  observedAt?: ISO8601;
}

export interface AlertChannelAdapter {
  adapterId: AdapterId;
  channel: AlertChannel;
  testOnly: true;            // All adapters in this package are test-only.
  deliver(alert: Alert): Promise<{ success: boolean; at: ISO8601; detail?: string }>;
}

/** Local capture adapter that records alerts in memory. Test-only. */
export class InMemoryAlertCaptureAdapter implements AlertChannelAdapter {
  readonly adapterId: AdapterId = 'adapter:alert-capture' as AdapterId;
  readonly testOnly = true;
  readonly channel: AlertChannel;
  captured: Alert[] = [];
  constructor(channel: AlertChannel) { this.channel = channel; }
  async deliver(alert: Alert): Promise<{ success: boolean; at: ISO8601; detail?: string }> {
    this.captured.push(alert);
    return { success: true, at: nowIso() };
  }
}

export class AlertEngine {
  private adapters = new Map<AlertChannel, AlertChannelAdapter>();
  private recentlySent = new Map<string, number>(); // key -> timestamp
  constructor(private rules: AlertRule[] = []) {}

  registerAdapter(adapter: AlertChannelAdapter): void {
    if (!adapter.testOnly) {
      throw new Error(`AlertEngine: only testOnly adapters are permitted; ${adapter.adapterId} rejected`);
    }
    this.adapters.set(adapter.channel, adapter);
  }

  setRules(rules: AlertRule[]): void { this.rules = rules; }

  async emit(ctx: AlertContext): Promise<Alert[]> {
    const now = ctx.observedAt ?? nowIso();
    const emitted: Alert[] = [];
    for (const rule of this.rules) {
      if (rule.tenantId !== ctx.tenantId) continue;
      if (!rule.types.includes(ctx.type)) continue;
      if (rule.minScore !== undefined && (ctx.score ?? 0) < rule.minScore) continue;
      if (rule.minDiscountPct !== undefined && (ctx.discountPct ?? 0) < rule.minDiscountPct) continue;
      if (rule.minRoi !== undefined && (ctx.roi ?? 0) < rule.minRoi) continue;
      if (rule.categories && ctx.category && !rule.categories.includes(ctx.category)) continue;
      if (rule.retailers && ctx.retailerId && !rule.retailers.includes(ctx.retailerId as any)) continue;
      if (rule.regions && ctx.region && !rule.regions.includes(ctx.region as any)) continue;
      if (rule.premiumTier && rule.premiumTier !== ctx.premiumTier) continue;

      // Duplicate suppression
      if (rule.duplicateSuppressionWindowMin) {
        const key = `${rule.id}|${ctx.dealId ?? ''}|${ctx.type}`;
        const last = this.recentlySent.get(key);
        if (last && (Date.parse(now) - last) < rule.duplicateSuppressionWindowMin * 60 * 1000) {
          const suppressed: Alert = {
            id: nextId('alert') as any,
            ruleId: rule.id, tenantId: ctx.tenantId, type: ctx.type,
            dealId: ctx.dealId, channels: rule.channels, headline: ctx.headline,
            body: ctx.body, createdAt: now, deliveredTo: [], suppressed: true,
            suppressionReason: 'duplicate within suppression window'
          };
          emitted.push(suppressed);
          continue;
        }
        this.recentlySent.set(key, Date.parse(now));
      }

      // Quiet hours
      if (rule.quietHours) {
        // Simple check: skip if now's HH:MM falls inside quiet window.
        // Note: this is a deterministic local-timezone approximation; production
        // implementations should use a TZ-aware library.
        const hhmm = now.slice(11, 16);
        if (hhmm >= rule.quietHours.start && hhmm < rule.quietHours.end) {
          continue;
        }
      }

      const alert: Alert = {
        id: nextId('alert') as any,
        ruleId: rule.id, tenantId: ctx.tenantId, type: ctx.type,
        dealId: ctx.dealId, channels: rule.channels, headline: ctx.headline,
        body: ctx.body, createdAt: now, deliveredTo: []
      };

      for (const ch of rule.channels) {
        const adapter = this.adapters.get(ch);
        if (!adapter) {
          alert.deliveredTo.push({ channel: ch, at: now, success: false, adapterId: 'adapter:missing' as AdapterId });
          continue;
        }
        const res = await adapter.deliver(alert);
        alert.deliveredTo.push({ channel: ch, at: res.at, success: res.success, adapterId: adapter.adapterId });
      }
      emitted.push(alert);
    }
    return emitted;
  }
}
