/**
 * Structured error hierarchy for the enrichment module.
 *
 * All errors extend `ProductEnrichmentError` and carry a stable `code` so
 * that integrating hosts can branch without parsing message strings.
 *
 * The service layer catches provider errors and converts them into either
 * structured `ProviderEnrichmentResult.error` entries (for partial failures)
 * or into one of these errors (for input / orchestration failures).
 */

export type EnrichmentErrorCode =
  | "INVALID_INPUT"
  | "NO_PROVIDER"
  | "NOT_FOUND"
  | "PROVIDER_TIMEOUT"
  | "PROVIDER_FAILURE"
  | "MALFORMED_PROVIDER_RESPONSE"
  | "IDENTITY_AMBIGUITY"
  | "INTERNAL_FAILURE";

export class ProductEnrichmentError extends Error {
  readonly code: EnrichmentErrorCode;
  readonly cause?: unknown;
  readonly details?: Record<string, unknown>;

  constructor(
    code: EnrichmentErrorCode,
    message: string,
    opts?: { cause?: unknown; details?: Record<string, unknown> }
  ) {
    super(message);
    this.name = "ProductEnrichmentError";
    this.code = code;
    if (opts) {
      this.cause = opts.cause;
      this.details = opts.details;
    }
    // Restore prototype chain for ES5 transpilation targets.
    Object.setPrototypeOf(this, new.target.prototype);
  }

  /**
   * Safe JSON representation. We never serialize `cause` directly because it
   * may contain provider payloads with secrets. Hosts should call
   * `toRedactedJSON()` instead of `JSON.stringify(err)`.
   */
  toRedactedJSON(): Record<string, unknown> {
    return {
      name: this.name,
      code: this.code,
      message: this.message,
      details: this.details,
    };
  }
}

export class InvalidInputError extends ProductEnrichmentError {
  constructor(message: string, details?: Record<string, unknown>) {
    super("INVALID_INPUT", message, { details });
    this.name = "InvalidInputError";
  }
}

export class NoProviderError extends ProductEnrichmentError {
  constructor(message: string, details?: Record<string, unknown>) {
    super("NO_PROVIDER", message, { details });
    this.name = "NoProviderError";
  }
}

export class NotFoundError extends ProductEnrichmentError {
  constructor(message: string, details?: Record<string, unknown>) {
    super("NOT_FOUND", message, { details });
    this.name = "NotFoundError";
  }
}

export class ProviderTimeoutError extends ProductEnrichmentError {
  readonly providerId: string;
  constructor(providerId: string, message = `Provider ${providerId} timed out`) {
    super("PROVIDER_TIMEOUT", message, { details: { providerId } });
    this.name = "ProviderTimeoutError";
    this.providerId = providerId;
  }
}

export class ProviderFailureError extends ProductEnrichmentError {
  readonly providerId: string;
  constructor(providerId: string, message: string, details?: Record<string, unknown>) {
    super(
      "PROVIDER_FAILURE",
      message,
      { details: { ...details, providerId } }
    );
    this.name = "ProviderFailureError";
    this.providerId = providerId;
  }
}

export class MalformedProviderResponseError extends ProductEnrichmentError {
  readonly providerId: string;
  constructor(providerId: string, message: string, details?: Record<string, unknown>) {
    super(
      "MALFORMED_PROVIDER_RESPONSE",
      message,
      { details: { ...details, providerId } }
    );
    this.name = "MalformedProviderResponseError";
    this.providerId = providerId;
  }
}

export class IdentityAmbiguityError extends ProductEnrichmentError {
  constructor(message: string, details?: Record<string, unknown>) {
    super("IDENTITY_AMBIGUITY", message, { details });
    this.name = "IdentityAmbiguityError";
  }
}

export class InternalFailureError extends ProductEnrichmentError {
  constructor(message: string, details?: Record<string, unknown>, cause?: unknown) {
    super("INTERNAL_FAILURE", message, { details, cause });
    this.name = "InternalFailureError";
  }
}
