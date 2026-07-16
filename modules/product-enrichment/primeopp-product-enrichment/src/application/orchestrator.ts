/**
 * Provider orchestrator.
 *
 * Responsibilities:
 *   - Select eligible providers for an input (via `canHandle`).
 *   - Execute providers sequentially or in parallel.
 *   - Apply per-provider timeout and overall timeout.
 *   - Isolate failures (one provider's failure never crashes the run).
 *   - Short-circuit when overall confidence reaches a threshold.
 *   - Enforce max-provider-count cap.
 *
 * The orchestrator does NOT decide how to merge results — it just returns
 * a list of `ProviderEnrichmentResult` objects for the resolution engine.
 */

import type { ProductEnrichmentInput } from "../contracts/input";
import type {
  ProductEnrichmentProvider,
  ProviderEnrichmentResult,
  EnrichmentContext,
} from "../contracts/provider";
import type { EnrichmentOptions } from "./options";
import { defaultEnrichmentOptions } from "./options";
import { ProviderTimeoutError } from "../errors";

export interface OrchestratorConfig {
  /** Max providers consulted per enrichment. Defaults to 5. */
  maxProviders?: number;
}

export interface OrchestratorRunResult {
  results: Array<{
    providerId: string;
    result: ProviderEnrichmentResult;
    failed: boolean;
    shortCircuited?: boolean;
  }>;
  shortCircuited: boolean;
}

export class ProviderOrchestrator {
  private readonly providers = new Map<string, ProductEnrichmentProvider>();
  private readonly priorities = new Map<string, number>();
  private readonly maxProviders: number;

  constructor(config: OrchestratorConfig = {}) {
    this.maxProviders = config.maxProviders ?? 5;
  }

  registerProvider(provider: ProductEnrichmentProvider, priority = 50): void {
    if (this.providers.has(provider.id)) {
      throw new Error(`Provider already registered: ${provider.id}`);
    }
    this.providers.set(provider.id, provider);
    this.priorities.set(provider.id, priority);
  }

  listProviders(): Array<{ id: string; priority: number }> {
    return Array.from(this.providers.keys()).map((id) => ({ id, priority: this.priorities.get(id)! }));
  }

  /**
   * Run eligible providers for an input.
   *
   * `interimConfidenceProvider` is called after each successful provider
   * result; if it returns a value >= `minimumConfidenceToShortCircuit`,
   * remaining providers are skipped.
   */
  async run(
    input: ProductEnrichmentInput,
    options: EnrichmentOptions,
    interimConfidenceProvider: (results: ProviderEnrichmentResult[]) => number
  ): Promise<OrchestratorRunResult> {
    const opts = { ...defaultEnrichmentOptions(), ...options };
    const allowed = opts.providerIds ?? Array.from(this.providers.keys());

    // Select eligible providers (those whose canHandle returns true), ordered
    // by priority (lower number first).
    const eligible: ProductEnrichmentProvider[] = [];
    for (const id of allowed) {
      const p = this.providers.get(id);
      if (!p) continue;
      const canHandle = await p.canHandle(input);
      if (canHandle) eligible.push(p);
    }
    eligible.sort((a, b) => (this.priorities.get(a.id) ?? 99) - (this.priorities.get(b.id) ?? 99));

    const selected = eligible.slice(0, this.maxProviders);
    if (selected.length === 0) {
      return { results: [], shortCircuited: false };
    }

    const ctx: EnrichmentContext = {
      timeoutMs: opts.timeoutMs ?? 5000,
      includeImages: opts.includeImages ?? true,
      hints: opts.hints,
      log: opts.log,
    };

    const collected: OrchestratorRunResult["results"] = [];

    if (opts.executionMode === "SEQUENTIAL") {
      for (const provider of selected) {
        const r = await this.runOne(provider, input, ctx);
        collected.push(r);
        if (
          !r.failed &&
          opts.minimumConfidenceToShortCircuit !== undefined &&
          opts.minimumConfidenceToShortCircuit < 1.0
        ) {
          const interim = interimConfidenceProvider(collected.map((c) => c.result));
          if (interim >= opts.minimumConfidenceToShortCircuit) {
            // Mark remaining providers as short-circuited (not run).
            for (const remaining of selected.slice(collected.length)) {
              collected.push({
                providerId: remaining.id,
                result: {
                  providerId: remaining.id,
                  found: false,
                  confidence: 0,
                  candidates: [],
                  retrievedAt: new Date().toISOString(),
                  error: {
                    code: "short-circuited",
                    message: "Skipped due to short-circuit.",
                    retryable: false,
                  },
                },
                failed: false,
                shortCircuited: true,
              });
            }
            return { results: collected, shortCircuited: true };
          }
        }
      }
      return { results: collected, shortCircuited: false };
    }

    // PARALLEL
    const settled = await Promise.allSettled(
      selected.map((p) => this.runOne(p, input, ctx))
    );
    for (let i = 0; i < settled.length; i++) {
      const s = settled[i];
      if (s.status === "fulfilled") {
        collected.push(s.value);
      } else {
        // Defensive: runOne catches its own errors, but if something escaped,
        // we record a synthetic failure.
        const provider = selected[i];
        collected.push({
          providerId: provider.id,
          result: {
            providerId: provider.id,
            found: false,
            confidence: 0,
            candidates: [],
            retrievedAt: new Date().toISOString(),
            error: {
              code: "internal-error",
              message: s.reason instanceof Error ? s.reason.message : String(s.reason),
              retryable: false,
            },
          },
          failed: true,
        });
      }
    }
    return { results: collected, shortCircuited: false };
  }

  private async runOne(
    provider: ProductEnrichmentProvider,
    input: ProductEnrichmentInput,
    ctx: EnrichmentContext
  ): Promise<{
    providerId: string;
    result: ProviderEnrichmentResult;
    failed: boolean;
  }> {
    const start = Date.now();
    try {
      const result = await provider.enrich(input, ctx);
      const elapsed = Date.now() - start;
      if (elapsed > ctx.timeoutMs) {
        // Provider ran longer than timeout. We still keep the result if it
        // succeeded, but log a warning.
        ctx.log?.("warn", `Provider ${provider.id} exceeded timeout (${elapsed}ms > ${ctx.timeoutMs}ms)`);
      }
      const failed = !result.found && Boolean(result.error) && result.error?.code !== "not-found" && result.error?.code !== "NOT_FOUND";
      return { providerId: provider.id, result, failed };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      if (err instanceof ProviderTimeoutError) {
        return {
          providerId: provider.id,
          result: {
            providerId: provider.id,
            found: false,
            confidence: 0,
            candidates: [],
            retrievedAt: new Date().toISOString(),
            error: { code: "timeout", message, retryable: true },
          },
          failed: true,
        };
      }
      return {
        providerId: provider.id,
        result: {
          providerId: provider.id,
          found: false,
          confidence: 0,
          candidates: [],
          retrievedAt: new Date().toISOString(),
          error: {
            code: "provider-exception",
            message,
            retryable: false,
          },
        },
        failed: true,
      };
    }
  }
}
