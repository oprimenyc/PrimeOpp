/**
 * Enrichment options consumed by `ProductEnrichmentService.enrich()`.
 */
export interface EnrichmentOptions {
  /** Restrict the orchestrator to a subset of registered provider IDs. */
  providerIds?: string[];

  /** Sequential vs parallel provider execution. Defaults to PARALLEL. */
  executionMode?: "SEQUENTIAL" | "PARALLEL";

  /** Overall per-call timeout in ms. Defaults to 5000. */
  timeoutMs?: number;

  /**
   * If overall confidence reaches this threshold BEFORE all providers have
   * been consulted, the orchestrator may short-circuit remaining providers.
   * Set to 1.0 to disable short-circuiting.
   */
  minimumConfidenceToShortCircuit?: number;

  /** Whether to consult the cache. Defaults to true. */
  useCache?: boolean;

  /** Whether to include images in the final profile. Defaults to true. */
  includeImages?: boolean;

  /**
   * Trust level for manual user input.
   * - "evidence" (default): treated as one more candidate, with elevated confidence.
   * - "authoritative": manual fields win ties against non-barcode-matched providers.
   */
  manualTrustLevel?: "evidence" | "authoritative";

  /**
   * Per-product important-fields list for completeness scoring. When omitted,
   * the engine uses a category-aware default (see completeness/default-fields).
   */
  importantFields?: string[];

  /** Free-form hints bag forwarded into `EnrichmentContext.hints`. */
  hints?: Record<string, unknown>;

  /** Logger callback. Useful for integration with host observability. */
  log?: (level: "info" | "warn" | "error", message: string, meta?: unknown) => void;
}

/**
 * Default options applied when an option is omitted. Exposed as a function
 * (not a constant) so callers cannot accidentally mutate the shared default.
 */
export function defaultEnrichmentOptions(): EnrichmentOptions {
  return {
    executionMode: "PARALLEL",
    timeoutMs: 5000,
    minimumConfidenceToShortCircuit: 0.95,
    useCache: true,
    includeImages: true,
    manualTrustLevel: "evidence",
  };
}
