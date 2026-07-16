/**
 * AI Assistance Boundary (Mission 18).
 *
 * AI is used ONLY for:
 *  - topical classification
 *  - relevance explanation
 *  - outreach drafting
 *  - content-gap summarization
 *  - opportunity clustering
 *
 * Deterministic logic is used for:
 *  - IDs, state transitions, score arithmetic, deduplication,
 *    evidence provenance, validation, campaign status.
 *
 * The AI adapter is provider-agnostic. It MUST:
 *  - return structured output
 *  - declare its confidence
 *  - mark every output as INFERRED until verified
 *  - fail safe (return undefined, never throw uncaught)
 */
import { AdapterMeta } from "../adapters/adapter.js";

export interface AiClassificationRequest {
  text: string;
  candidateLabels: string[];
}

export interface AiClassificationResult {
  label: string;
  confidence: number; // 0..1
  alternatives?: { label: string; confidence: number }[];
  inferredAt: number;
}

export interface AiDraftRequest {
  task: "outreach_subject" | "outreach_body" | "content_gap_summary" | "opportunity_cluster_label";
  context: Record<string, unknown>;
  constraints?: {
    maxLength?: number;
    tone?: "formal" | "friendly" | "concise";
    variants?: number;
  };
}

export interface AiDraftResult {
  variants: { label: string; body: string }[];
  inferredAt: number;
  /** All AI drafts are INFERRED. */
  verification: "INFERRED";
}

export interface AiRelevanceExplainRequest {
  targetTopic: string;
  candidateTopic: string;
  sharedKeywords?: string[];
}

export interface AiRelevanceExplainResult {
  similarity: number; // 0..1
  reason: string;
  inferredAt: number;
}

export interface AiAdapter {
  meta: AdapterMeta;
  classify?(req: AiClassificationRequest): Promise<AiClassificationResult>;
  draft?(req: AiDraftRequest): Promise<AiDraftResult>;
  explainRelevance?(req: AiRelevanceExplainRequest): Promise<AiRelevanceExplainResult>;
}

/**
 * No-op AI adapter. Used when no LLM is configured.
 * Returns neutral defaults so the engine continues to function.
 */
export class NoOpAiAdapter implements AiAdapter {
  meta: AdapterMeta = {
    id: "ai.noop",
    name: "No-Op AI Adapter",
    providerKind: "internal",
    capabilities: {
      canSearchBacklinks: false,
      canSearchBrokenLinks: false,
      canSearchResourcePages: false,
      canSearchMentions: false,
      canFetchPage: false,
      canDiscoverContacts: false,
      canProvideMetrics: false,
      canClassify: true,
      canDraft: true
    },
    rateLimit: { requestsPerMinute: 99999, burst: 99999 },
    cost: { hasFreeTier: true, perRequest: 0, perThousandRows: 0 },
    retry: { maxRetries: 0, initialBackoffMs: 0, jitter: 0, retryableOn: [] },
    provenance: { adapter: "noop", providerKind: "internal", version: "1.0.0" },
    confidence: { dataConfidence: 0.0, reason: "No-op AI adapter; deterministic fallbacks only." },
    offline: true
  };

  async classify(req: AiClassificationRequest): Promise<AiClassificationResult> {
    // Deterministic fallback: pick the candidate label with most keyword overlap.
    const text = req.text.toLowerCase();
    let best = req.candidateLabels[0] ?? "unknown";
    let bestScore = -1;
    const alternatives: { label: string; confidence: number }[] = [];
    for (const label of req.candidateLabels) {
      const tokens = label.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);
      const hits = tokens.filter((t) => text.includes(t)).length;
      const score = tokens.length > 0 ? hits / tokens.length : 0;
      alternatives.push({ label, confidence: score });
      if (score > bestScore) {
        bestScore = score;
        best = label;
      }
    }
    return {
      label: best,
      confidence: bestScore,
      alternatives: alternatives.sort((a, b) => b.confidence - a.confidence).slice(0, 3),
      inferredAt: Date.now()
    };
  }

  async draft(req: AiDraftRequest): Promise<AiDraftResult> {
    const variants: { label: string; body: string }[] = [];
    const variantsCount = req.constraints?.variants ?? 1;
    for (let i = 0; i < variantsCount; i++) {
      variants.push({
        label: `variant_${i + 1}`,
        body: deterministicDraft(req)
      });
    }
    return { variants, inferredAt: Date.now(), verification: "INFERRED" };
  }

  async explainRelevance(req: AiRelevanceExplainRequest): Promise<AiRelevanceExplainResult> {
    const a = req.targetTopic.toLowerCase();
    const b = req.candidateTopic.toLowerCase();
    const overlap = jaccard(a.split(/[^a-z0-9]+/).filter(Boolean), b.split(/[^a-z0-9]+/).filter(Boolean));
    return {
      similarity: overlap,
      reason: `Topical overlap of ${Math.round(overlap * 100)}% via shared tokens between "${req.targetTopic}" and "${req.candidateTopic}".`,
      inferredAt: Date.now()
    };
  }
}

function jaccard(a: string[], b: string[]): number {
  const sa = new Set(a);
  const sb = new Set(b);
  let inter = 0;
  for (const x of sa) if (sb.has(x)) inter++;
  const union = sa.size + sb.size - inter;
  return union === 0 ? 0 : inter / union;
}

function deterministicDraft(req: AiDraftRequest): string {
  const ctx = req.context as Record<string, unknown>;
  switch (req.task) {
    case "outreach_subject":
      return `Resource suggestion for ${ctx.sourceTopic ?? "your article"}`;
    case "outreach_body":
      return `Hi,\n\nI noticed your page "${ctx.sourceUrl ?? ""}" mentions ${ctx.topic ?? "a topic"} we've written about. We have a resource on ${ctx.targetAssetTitle ?? "this"} at ${ctx.targetAssetUrl ?? ""} that may be a useful addition.\n\nThanks.`;
    case "content_gap_summary":
      return `Gap summary: ${JSON.stringify(ctx).slice(0, 200)}`;
    case "opportunity_cluster_label":
      return `Cluster: ${String(ctx.topic ?? "uncategorized")}`;
  }
}

/**
 * Resilient wrapper: wraps an AiAdapter and never throws.
 * On failure, returns neutral INFERRED defaults with confidence 0.
 */
export class ResilientAiAdapter implements AiAdapter {
  private readonly fallback = new NoOpAiAdapter();
  constructor(private readonly inner: AiAdapter) {}
  get meta(): AdapterMeta {
    return this.inner.meta;
  }
  async classify(req: AiClassificationRequest): Promise<AiClassificationResult> {
    try {
      if (!this.inner.classify) return this.fallback.classify(req);
      return await this.inner.classify(req);
    } catch {
      return this.fallback.classify(req);
    }
  }
  async draft(req: AiDraftRequest): Promise<AiDraftResult> {
    try {
      if (!this.inner.draft) return this.fallback.draft(req);
      return await this.inner.draft(req);
    } catch {
      return this.fallback.draft(req);
    }
  }
  async explainRelevance(req: AiRelevanceExplainRequest): Promise<AiRelevanceExplainResult> {
    try {
      if (!this.inner.explainRelevance) return this.fallback.explainRelevance(req);
      return await this.inner.explainRelevance(req);
    } catch {
      return this.fallback.explainRelevance(req);
    }
  }
}
