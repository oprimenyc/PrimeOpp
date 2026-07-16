/**
 * Fingerprinting utilities for manual product deduplication.
 *
 * Produces a deterministic fingerprint from manual product fields
 * (normalized title + brand + model) for duplicate detection.
 */

import type { ManualProductData, ProductFingerprint } from "../types/index.js";
import { normalizeField } from "../validation/index.js";

/**
 * Generate a deterministic fingerprint for a manual product entry.
 *
 * Uses: lowercased, trimmed title + brand + model concatenated.
 * Fields that are undefined are omitted.
 */
export function generateProductFingerprint(data: ManualProductData): ProductFingerprint {
  const parts: string[] = [];
  const fieldsUsed: string[] = [];

  const title = normalizeField(data.title);
  const brand = normalizeField(data.brand);
  const model = normalizeField(data.model);

  if (title) {
    parts.push(title.toLowerCase());
    fieldsUsed.push("title");
  }
  if (brand) {
    parts.push(brand.toLowerCase());
    fieldsUsed.push("brand");
  }
  if (model) {
    parts.push(model.toLowerCase());
    fieldsUsed.push("model");
  }

  const fingerprint = parts.join("|");

  return { fingerprint, fieldsUsed };
}

/**
 * Validate that a manual product entry has sufficient data for intake.
 *
 * At minimum: title OR brand+model must be present.
 */
export function validateManualProductMinimum(data: ManualProductData): boolean {
  const title = normalizeField(data.title);
  const brand = normalizeField(data.brand);
  const model = normalizeField(data.model);

  return !!(title || (brand && model));
}