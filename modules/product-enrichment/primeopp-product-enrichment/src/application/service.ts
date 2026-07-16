/**
 * ProductEnrichmentService — the main public application service.
 *
 * Orchestrates the full enrichment pipeline:
 *
 *   1. Input validation.
 *   2. Cache lookup.
 *   3. Provider selection (via orchestrator).
 *   4. Provider execution.
 *   5. Candidate extraction + normalization.
 *   6. Candidate resolution + conflict detection.
 *   7. Confidence scoring.
 *   8. Completeness scoring.
 *   9. Profile creation.
 *   10. Cache write.
 *   11. Result return.
 *
 * The service is constructed with a list of providers and an optional cache.
 * Hosts configure it once at startup and reuse it across requests.
 */

import type { ProductEnrichmentInput } from "../contracts/input";
import type { EnrichedProductProfile } from "../contracts/output";
import type { ProductEnrichmentProvider } from "../contracts/provider";
import type { EnrichmentOptions } from "./options";
import { defaultEnrichmentOptions } from "./options";
import { ProviderOrchestrator } from "./orchestrator";
import { buildProfile } from "./profile-builder";
import { InMemoryEnrichmentCache, computeCacheKey } from "../cache";
import type { ProductEnrichmentCache } from "../cache";
import { InvalidInputError, NoProviderError } from "../errors";
import { computeOverallConfidence } from "../confidence/engine";

export interface ProductServiceConfig {
  providers?: Array<{ provider: ProductEnrichmentProvider; priority?: number }>;
  cache?: ProductEnrichmentCache;
  maxProviders?: number;
}

export class ProductEnrichmentService {
  private readonly orchestrator: ProviderOrchestrator;
  private readonly cache: ProductEnrichmentCache | null;

  constructor(config: ProductServiceConfig = {}) {
    this.orchestrator = new ProviderOrchestrator({ maxProviders: config.maxProviders });
    this.cache = config.cache ?? new InMemoryEnrichmentCache({ capacity: 1000, defaultTtlSeconds: 300 });
    if (config.providers) {
      for (const { provider, priority } of config.providers) {
        this.orchestrator.registerProvider(provider, priority);
      }
    }
  }

  registerProvider(provider: ProductEnrichmentProvider, priority = 50): void {
    this.orchestrator.registerProvider(provider, priority);
  }

  listProviders(): Array<{ id: string; priority: number }> {
    return this.orchestrator.listProviders();
  }

  async enrich(
    input: ProductEnrichmentInput,
    options?: EnrichmentOptions
  ): Promise<EnrichedProductProfile> {
    const opts = { ...defaultEnrichmentOptions(), ...(options ?? {}) };
    const log = opts.log;

    // 1. Input validation.
    validateInput(input);

    // 2. Cache lookup.
    const cacheKey = computeCacheKey({
      identifier: input.identifier,
      manualProduct: input.manualProduct as Record<string, unknown> | undefined,
    });
    if (opts.useCache && this.cache) {
      try {
        const cached = await this.cache.get(cacheKey);
        if (cached) {
          log?.("info", `Cache hit for key ${cacheKey}`);
          return cached;
        }
      } catch (err) {
        log?.("warn", `Cache read failed: ${err instanceof Error ? err.message : String(err)}`);
      }
    }

    // 3. Provider selection + execution.
    const run = await this.orchestrator.run(input, opts, (results) => {
      // Interim confidence: compute on the fly from partial builder output.
      // We only need a fast approximation for short-circuit decisions.
      const successful = results.filter((r) => r.found);
      if (successful.length === 0) return 0;
      const avgConf = successful.reduce((s, r) => s + r.confidence, 0) / successful.length;
      // Boost when 2+ providers returned results.
      const agreementBoost = successful.length >= 2 ? 0.1 : 0;
      return Math.min(1, avgConf + agreementBoost);
    });

    if (run.results.length === 0) {
      throw new NoProviderError("No provider was able to handle the input.", {
        intakeId: input.intakeId,
      });
    }

    // 4. Build profile.
    const { profile } = buildProfile({
      input,
      providerResults: run.results,
      options: opts,
    });

    // 5. If short-circuited, log it.
    if (run.shortCircuited) {
      log?.("info", `Short-circuited after ${run.results.filter((r) => !r.shortCircuited).length} providers.`);
    }

    // 6. Cache write.
    if (opts.useCache && this.cache && profile.status !== "FAILED") {
      try {
        await this.cache.set(cacheKey, profile);
      } catch (err) {
        log?.("warn", `Cache write failed: ${err instanceof Error ? err.message : String(err)}`);
      }
    }

    return profile;
  }
}

function validateInput(input: ProductEnrichmentInput | null | undefined): void {
  if (!input || typeof input !== "object") {
    throw new InvalidInputError("Input must be a non-null object.");
  }
  if (input.intakeId !== undefined && typeof input.intakeId !== "string") {
    throw new InvalidInputError("intakeId must be a string when provided.");
  }
  const hasIdentifier =
    input.identifier &&
    typeof input.identifier.normalizedValue === "string" &&
    input.identifier.normalizedValue.length > 0;
  const hasManual =
    input.manualProduct &&
    Object.values(input.manualProduct).some(
      (v) => v !== undefined && v !== null && String(v).trim() !== ""
    );
  if (!hasIdentifier && !hasManual) {
    throw new InvalidInputError(
      "Input must include at least one of: identifier (with normalizedValue) or manualProduct (with at least one populated field)."
    );
  }
  if (input.identifier) {
    if (!input.identifier.identifierType) {
      throw new InvalidInputError("identifier.identifierType is required when identifier is provided.");
    }
  }
}
