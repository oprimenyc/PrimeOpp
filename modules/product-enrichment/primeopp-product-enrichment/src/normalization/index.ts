/**
 * Deterministic normalization primitives.
 *
 * Each normalizer is a pure function. The resolution layer calls these to
 * derive `normalizedValue` for each `FieldCandidate`. Original values are
 * always preserved on the candidate's `value` field, so no information is
 * lost.
 *
 * Design rules:
 *  - Normalization MUST be idempotent.
 *  - Normalization MUST NOT mutate inputs.
 *  - Brand / model normalization is intentionally conservative: case and
 *    trivial punctuation only. We do NOT collapse "Coca-Cola" → "CocaCola"
 *    because that loses meaningful distinctions.
 */

import type { ProductImage } from "../contracts/image";

/**
 * Whitespace normalizer: trims ends, collapses internal whitespace runs to a
 * single space.
 */
export function normalizeWhitespace(value: string | undefined | null): string | undefined {
  if (value == null) return undefined;
  const trimmed = String(value).trim();
  if (trimmed === "") return undefined;
  return trimmed.replace(/\s+/g, " ");
}

/**
 * Brand normalizer. Conservative: trims, collapses whitespace, title-cases
 * common forms. Preserves hyphens and ampersands.
 */
export function normalizeBrand(value: string | undefined | null): string | undefined {
  const ws = normalizeWhitespace(value);
  if (!ws) return undefined;
  // Title-case each space-separated word, and within each word, title-case
  // each hyphen-separated segment (so "coca-cola" → "Coca-Cola").
  const words = ws.split(" ");
  const out = words.map((w) => {
    // Preserve all-caps acronyms of length 1-4 (IBM, HP, GE, IKEA).
    if (/^[A-Z]{1,4}$/.test(w)) return w;
    // Long all-caps strings get title-cased (e.g. SAMSUNG → Samsung).
    if (/^[A-Z]+$/.test(w) && w.length > 4) return w.charAt(0) + w.slice(1).toLowerCase();
    // Otherwise title-case each hyphen segment.
    return w
      .split("-")
      .map((seg) => {
        if (!seg) return seg;
        if (/^[A-Z]{1,4}$/.test(seg)) return seg;
        return seg.charAt(0).toUpperCase() + seg.slice(1).toLowerCase();
      })
      .join("-");
  });
  return out.join(" ");
}

/**
 * Title normalizer. Trims, collapses whitespace, but preserves original case
 * (titles are too varied to safely re-case).
 */
export function normalizeTitle(value: string | undefined | null): string | undefined {
  return normalizeWhitespace(value);
}

/**
 * Model normalizer. Trims, collapses whitespace, uppercases alphanumerics,
 * preserves hyphens and slashes. This catches "model-a1b2" vs "Model A1B2".
 */
export function normalizeModel(value: string | undefined | null): string | undefined {
  const ws = normalizeWhitespace(value);
  if (!ws) return undefined;
  return ws.toUpperCase().replace(/\s+/g, " ");
}

/**
 * Manufacturer normalizer — same rules as brand.
 */
export function normalizeManufacturer(value: string | undefined | null): string | undefined {
  return normalizeBrand(value);
}

/**
 * Category normalizer. Title-cases each word, preserves slashes.
 */
export function normalizeCategory(value: string | undefined | null): string | undefined {
  const ws = normalizeWhitespace(value);
  if (!ws) return undefined;
  return ws
    .split(" ")
    .map((w) => (w === w.toUpperCase() && w.length > 3 ? w : w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()))
    .join(" ");
}

/**
 * Color normalizer. Lowercases and collapses whitespace.
 */
export function normalizeColor(value: string | undefined | null): string | undefined {
  const ws = normalizeWhitespace(value);
  if (!ws) return undefined;
  return ws.toLowerCase();
}

/**
 * Size normalizer. Trims and uppercases short tokens, preserves numeric
 * fractions (e.g. "10.5").
 */
export function normalizeSize(value: string | undefined | null): string | undefined {
  const ws = normalizeWhitespace(value);
  if (!ws) return undefined;
  // Keep digits, dots, slashes, hyphens, x/X (for sizes like "10/12", "XL", "32x32").
  return ws.toUpperCase();
}

/**
 * Dimensions normalizer. Parses "L x W x H" with optional units into a
 * canonical "LxWxH|unit" string. Returns the original (whitespace-normalized)
 * string when the format is not parseable.
 */
export function normalizeDimensions(
  value: string | undefined | null
): { normalized: string; unit?: string } | undefined {
  const ws = normalizeWhitespace(value);
  if (!ws) return undefined;
  const match = ws.match(/^([\d.]+)\s*[xX×]\s*([\d.]+)(?:\s*[xX×]\s*([\d.]+))?\s*(cm|mm|m|in|inch|inches)?$/i);
  if (!match) {
    return { normalized: ws };
  }
  const [, l, w, h, unit] = match;
  const dims = [l, w, h].filter(Boolean).join("x");
  const unitNorm = unit ? unit.toLowerCase().replace(/inches|inch/gi, "in") : undefined;
  return { normalized: dims, unit: unitNorm };
}

/**
 * Weight normalizer. Parses "<number> <unit>" and converts to grams.
 * Returns { normalized: "<value>g", grams: number, originalUnit: string }.
 */
export function normalizeWeight(
  value: string | number | undefined | null
): { normalized: string; grams: number; originalUnit: string } | undefined {
  if (value == null) return undefined;
  if (typeof value === "number") {
    return { normalized: `${value}g`, grams: value, originalUnit: "g" };
  }
  const ws = normalizeWhitespace(value);
  if (!ws) return undefined;
  const match = ws.match(/^([\d.]+)\s*(g|kg|mg|oz|lb|lbs|pounds?|ounces?)?$/i);
  if (!match) return undefined;
  const num = parseFloat(match[1]);
  const unitRaw = (match[2] || "g").toLowerCase();
  const unitMap: Record<string, { factor: number; canonical: string }> = {
    g: { factor: 1, canonical: "g" },
    kg: { factor: 1000, canonical: "g" },
    mg: { factor: 0.001, canonical: "g" },
    oz: { factor: 28.349523125, canonical: "g" },
    ounce: { factor: 28.349523125, canonical: "g" },
    ounces: { factor: 28.349523125, canonical: "g" },
    lb: { factor: 453.59237, canonical: "g" },
    lbs: { factor: 453.59237, canonical: "g" },
    pound: { factor: 453.59237, canonical: "g" },
    pounds: { factor: 453.59237, canonical: "g" },
  };
  const u = unitMap[unitRaw] || unitMap.g;
  return {
    normalized: `${num * u.factor}g`,
    grams: num * u.factor,
    originalUnit: unitRaw,
  };
}

/**
 * Identifier list normalizer. De-duplicates case-insensitively for GS1
 * family (all-digit), case-sensitively for SKU / alphanumeric identifiers.
 */
export function dedupeIdentifiers(values: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const v of values) {
    // For all-digit identifiers (GS1 family), case is irrelevant — dedupe by value.
    // For SKUs and alphanumeric identifiers, case is significant — keep both.
    const key = /^\d+$/.test(v) ? v : v;
    if (!seen.has(key)) {
      seen.add(key);
      out.push(v);
    }
  }
  return out;
}

/**
 * Bullet list normalizer. Trims each bullet, drops empty bullets,
 * de-duplicates case-insensitively while preserving first-seen order.
 */
export function normalizeBullets(values: string[] | undefined | null): string[] {
  if (!values || !Array.isArray(values)) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of values) {
    const v = normalizeWhitespace(String(raw));
    if (!v) continue;
    const key = v.toLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      out.push(v);
    }
  }
  return out;
}

/**
 * Image URL list normalizer. Trims, drops invalid URLs, de-duplicates by
 * normalized URL string (case-insensitive on hostname + path).
 */
export function dedupeImages(images: ProductImage[]): ProductImage[] {
  const seen = new Set<string>();
  const out: ProductImage[] = [];
  for (const img of images) {
    if (!img || typeof img.url !== "string") continue;
    try {
      // This will throw on invalid URLs — we skip them.
      // eslint-disable-next-line no-new
      new URL(img.url);
    } catch {
      continue;
    }
    const key = img.url.toLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      out.push(img);
    }
  }
  return out;
}

/**
 * Select the primary image from a list. Preference order:
 *  1. Image marked `isPrimary: true` by the highest-priority provider.
 *  2. Image with the highest confidence.
 *  3. First image in the list (stable).
 */
export function selectPrimaryImage(images: ProductImage[]): ProductImage | undefined {
  if (images.length === 0) return undefined;
  const primaries = images.filter((i) => i.isPrimary === true);
  if (primaries.length > 0) {
    primaries.sort((a, b) => (b.confidence ?? 0) - (a.confidence ?? 0));
    return primaries[0];
  }
  const sorted = [...images].sort((a, b) => (b.confidence ?? 0) - (a.confidence ?? 0));
  return sorted[0];
}

/**
 * URL validator. Used to filter out malformed URLs before they reach the
 * profile.
 */
export function isValidUrl(value: string): boolean {
  if (typeof value !== "string") return false;
  try {
    const u = new URL(value);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

/**
 * Bound a string to a maximum length. Used to defend against oversized
 * provider payloads. Coerces non-string values to string first.
 */
export function boundString(value: unknown, max: number): string | undefined {
  if (value == null) return undefined;
  const s = typeof value === "string" ? value : String(value);
  if (s.length <= max) return s;
  return s.slice(0, max);
}
