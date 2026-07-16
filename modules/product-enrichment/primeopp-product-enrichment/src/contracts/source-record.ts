/**
 * EnrichmentSourceRecord — provenance metadata for a single provider's
 * contribution to an enrichment. Stored on the final profile under
 * `sources`.
 *
 * Raw provider payloads are NOT stored by default to avoid unbounded
 * memory growth and accidental PII / secret leakage. Hosts that need raw
 * payloads can wrap the provider and stash them externally.
 */
export interface EnrichmentSourceRecord {
  providerId: string;
  /** ISO-8601 UTC timestamp. */
  retrievedAt: string;
  /** Provider-declared confidence for this record, 0.0 - 1.0. */
  confidence?: number;
  /**
   * Stable external reference (e.g. the provider's product ID). Useful for
   * downstream re-fetch or reconciliation.
   */
  externalReference?: string;
  /**
   * Dotted field paths this provider contributed to (e.g.
   * ["identity.brand", "identifiers.gtin"]).
   */
  fieldsProvided: string[];
  /**
   * Optional redacted / bounded raw reference ID. Should never contain the
   * full provider payload. Max 256 chars enforced by the normalization layer.
   */
  rawReferenceId?: string;
}
