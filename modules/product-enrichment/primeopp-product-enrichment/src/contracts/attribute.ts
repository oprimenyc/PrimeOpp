/**
 * Flexible attribute contract.
 *
 * `value` supports scalar and array types. `unit` is optional and applies
 * primarily to numeric measurements (weight, dimensions, capacity).
 * `confidence` is a per-attribute score in 0.0 - 1.0 derived from the
 * resolution engine. `sources` lists the providerIds that contributed this
 * attribute (more than one entry implies agreement, which boosts confidence).
 */
export interface NormalizedAttribute {
  value: string | number | boolean | string[];
  unit?: string;
  confidence: number;
  sources: string[];
}
