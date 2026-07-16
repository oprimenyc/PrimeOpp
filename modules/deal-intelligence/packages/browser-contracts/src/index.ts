/**
 * @primeopp-deal-intelligence/browser-contracts
 *
 * Adapter contract for an external Browser Operator (e.g. VERIDIAN Browser
 * Operator). This package does NOT implement a Browser Operator. It only
 * defines the seam through which future Browser Operator implementations
 * will be plugged into the deal intelligence platform.
 */
import type { AdapterId, ISO8601, Evidence } from '@primeopp-deal-intelligence/contracts';

export interface BrowserSession {
  sessionId: string;
  createdAt: ISO8601;
  close(): Promise<void>;
}

export interface BrowserNavigateOptions {
  url: string;
  waitUntil?: 'load' | 'domcontentloaded' | 'networkidle';
  timeoutMs?: number;
  viewport?: { width: number; height: number };
  userAgent?: string;
}

export interface BrowserSnapshot {
  url: string;
  finalUrl: string;
  title?: string;
  html: string;
  text: string;
  screenshotPngRef?: string;
  domRef?: string;
  capturedAt: ISO8601;
  evidence: Evidence[];
}

export interface BrowserAction {
  type: 'click' | 'type' | 'wait' | 'scroll' | 'evaluate';
  selector?: string;
  text?: string;
  ms?: number;
  script?: string;
}

export interface BrowserOperatorAdapter {
  adapterId: AdapterId;
  testOnly?: boolean;
  openSession(): Promise<BrowserSession>;
  navigate(session: BrowserSession, opts: BrowserNavigateOptions): Promise<BrowserSnapshot>;
  perform(session: BrowserSession, actions: BrowserAction[]): Promise<BrowserSnapshot>;
  screenshot(session: BrowserSession): Promise<{ payloadRef: string; hash: string }>;
}

/** Test-only stub adapter that returns deterministic snapshots. */
export class StubBrowserOperatorAdapter implements BrowserOperatorAdapter {
  readonly adapterId: AdapterId = 'adapter:stub-browser' as AdapterId;
  readonly testOnly = true;
  async openSession(): Promise<BrowserSession> {
    return { sessionId: 'stub-session', createdAt: new Date().toISOString(),
      async close() { /* no-op */ } };
  }
  async navigate(_s: BrowserSession, opts: BrowserNavigateOptions): Promise<BrowserSnapshot> {
    return {
      url: opts.url,
      finalUrl: opts.url,
      title: 'Stub',
      html: '<html><body>stub</body></html>',
      text: 'stub',
      capturedAt: new Date().toISOString(),
      evidence: []
    };
  }
  async perform(session: BrowserSession, _a: BrowserAction[]): Promise<BrowserSnapshot> {
    return this.navigate(session, { url: 'about:blank' });
  }
  async screenshot(_s: BrowserSession): Promise<{ payloadRef: string; hash: string }> {
    return { payloadRef: 'ref://stub-screenshot', hash: 'sha256:stub' };
  }
}
