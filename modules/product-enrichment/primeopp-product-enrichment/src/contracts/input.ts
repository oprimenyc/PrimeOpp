/**
 * Core input contracts for primeopp-product-enrichment.
 *
 * These contracts deliberately recreate the MINIMUM shared surface that the
 * prior clean-room module `primeopp-product-intake` is expected to emit. They
 * are intentionally isolated inside this module so that this package does not
 * depend on the intake module's source code.
 *
 * The integrating host is responsible for mapping its real intake output to
 * `ProductEnrichmentInput`. See INTEGRATION.md for the mapping table.
 */

/**
 * Supported product identifier types.
 *
 * These cover the GS1 barcode family (UPC/EAN/GTIN), the ISBN family, and a
 * catch-all `SKU` plus `UNKNOWN` for partial input that still needs to be
 * attempted against text-search providers.
 */
export type ProductIdentifierType =
  | "UPC_A"
  | "UPC_E"
  | "EAN_8"
  | "EAN_13"
  | "GTIN_8"
  | "GTIN_12"
  | "GTIN_13"
  | "GTIN_14"
  | "ISBN_10"
  | "ISBN_13"
  | "SKU"
  | "UNKNOWN";

/**
 * A single product identifier as emitted by the intake layer.
 *
 * The intake module is responsible for raw -> normalized conversion and for
 * reporting `isValidFormat` / `checksumValid`. The enrichment module treats
 * these flags as advisory and re-validates defensively.
 */
export interface ProductIdentifier {
  rawValue: string;
  normalizedValue: string;
  identifierType: ProductIdentifierType;
  isValidFormat: boolean;
  checksumValid?: boolean;
}

/**
 * Optional manual product entry. The enrichment module treats manual fields
 * as evidence (not absolute truth) by default. Host applications can elevate
 * manual trust via `EnrichmentOptions.manualTrustLevel`.
 */
export interface ManualProductEntry {
  title?: string;
  brand?: string;
  model?: string;
  category?: string;
  description?: string;
  mpn?: string;
  color?: string;
  size?: string;
}

/**
 * Input contract consumed by `ProductEnrichmentService.enrich()`.
 *
 * At least one of `identifier` or `manualProduct` MUST be present after
 * validation; otherwise the service returns a structured `INVALID_INPUT`
 * error rather than throwing.
 */
export interface ProductEnrichmentInput {
  intakeId?: string;

  identifier?: ProductIdentifier;

  manualProduct?: ManualProductEntry;

  /**
   * Free-form context bag forwarded to providers. The enrichment module does
   * not interpret unknown keys; providers may consult it (e.g. preferred
   * locale, marketplace hint).
   */
  sourceContext?: Record<string, unknown>;
}
