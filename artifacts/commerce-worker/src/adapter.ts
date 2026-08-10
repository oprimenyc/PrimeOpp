/**
 * Pure mapping/planning logic: canonical `Product` -> live `products` row.
 *
 * No I/O of any kind happens here — no database, no network, no secrets.
 * Every function is deterministic and fully unit-testable with plain
 * fixtures. See PRIMEOPP_COMMERCE_CORE_ADAPTER_CONTRACT.md for the field
 * map and the reasoning behind each mapping decision.
 */

import type {
  CanonicalProduct,
  CanonicalProductPriceInput,
  ExistingLiveProductRow,
  ImportAction,
  ImportPlanEntry,
  ImportPlanSummary,
  LiveProductColor,
  LiveProductRow,
  LiveProductType,
} from "./types.js";

const KIND_TO_LIVE_TYPE: Partial<Record<CanonicalProduct["kind"], LiveProductType>> = {
  POD: "pod",
  AFFILIATE: "affiliate",
};

export function mapKindToLiveType(kind: CanonicalProduct["kind"]): LiveProductType | null {
  return KIND_TO_LIVE_TYPE[kind] ?? null;
}

export function pickThumbnail(images: CanonicalProduct["images"]): string | null {
  const primary = images.find((img) => img.kind === "PRIMARY" && img.url);
  if (primary?.url) return primary.url;
  const firstWithUrl = images.find((img) => img.url);
  return firstWithUrl?.url ?? null;
}

export function pickCategory(category: CanonicalProduct["category"]): string | null {
  if (!category) return null;
  return category.leaf?.trim() || category.path[category.path.length - 1]?.trim() || null;
}

const SIZE_AXES = new Set(["SIZE", "SHOE_SIZE", "APPAREL_SIZE"]);

export function pickSizes(variants: CanonicalProduct["variants"]): string[] {
  const sizes = new Set<string>();
  for (const variant of variants) {
    for (const attr of variant.attributes) {
      if (SIZE_AXES.has(attr.axis) && attr.value.trim()) {
        sizes.add(attr.value.trim());
      }
    }
  }
  return Array.from(sizes);
}

/**
 * Colors always come back with `hex: null, price: null` — the canonical
 * model has no such fields on a variant attribute (see contract doc,
 * "Color richness loss"). Callers must not fabricate a hex value; a color
 * with no known hex is reported as a warning, not silently dropped or
 * invented.
 */
export function pickColors(variants: CanonicalProduct["variants"]): { colors: LiveProductColor[]; warnings: string[] } {
  const names = new Set<string>();
  for (const variant of variants) {
    for (const attr of variant.attributes) {
      if (attr.axis === "COLOR" && attr.value.trim()) {
        names.add(attr.value.trim());
      }
    }
  }
  const colors: LiveProductColor[] = Array.from(names).map((name) => ({ name, hex: null, price: null }));
  const warnings = colors.length > 0
    ? [`${colors.length} color(s) mapped without a hex value (not present on the canonical model) — admin product validation requires a hex per color, so these rows will need manual hex assignment before they can be saved through the existing admin UI`]
    : [];
  return { colors, warnings };
}

function isHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

export function pickExternalLink(source: CanonicalProduct["source"]): string | null {
  if (source.kind !== "CATALOG" && source.kind !== "IMPORT") return null;
  return isHttpUrl(source.ref) ? source.ref : null;
}

export function buildRow(
  product: CanonicalProduct,
  priceInput?: CanonicalProductPriceInput,
): { row: LiveProductRow | null; type: LiveProductType | null; warnings: string[] } {
  const type = mapKindToLiveType(product.kind);
  if (!type) {
    return { row: null, type: null, warnings: [] };
  }

  const { colors, warnings } = pickColors(product.variants);
  const row: LiveProductRow = {
    type,
    title: product.title,
    description: product.description?.trim() || null,
    price: priceInput && priceInput.productId === product.id ? priceInput.price : null,
    category: pickCategory(product.category),
    thumbnail_url: pickThumbnail(product.images),
    external_link: pickExternalLink(product.source),
    stock_level: null,
    shipping_info: null,
    colors,
    sizes: pickSizes(product.variants),
    pod_provider: null,
    printful_variant_id: null,
    tapstitch_variant_id: null,
  };
  return { row, type, warnings };
}

function validateRequiredFields(product: CanonicalProduct): string[] {
  const errors: string[] = [];
  if (!product.title || !product.title.trim()) {
    errors.push("REQUIRED_FIELD_MISSING: title");
  }
  return errors;
}

/**
 * Heuristic dedupe key: (lower(title), type). See contract doc section 7 —
 * the live schema has no column to store a stable external/canonical id,
 * so this is a deliberately weak, documented stand-in used only because
 * this adapter never actually writes. A real write-mode pass needs a
 * schema change (`external_id` column) before this heuristic should be
 * trusted for a real upsert.
 */
export function findDedupeMatch(
  title: string,
  type: LiveProductType,
  existingRows: ExistingLiveProductRow[],
): ExistingLiveProductRow | undefined {
  const normalizedTitle = title.trim().toLowerCase();
  return existingRows.find((row) => row.type === type && row.title.trim().toLowerCase() === normalizedTitle);
}

export function planImportEntry(
  product: CanonicalProduct,
  existingRows: ExistingLiveProductRow[],
  priceInput?: CanonicalProductPriceInput,
): ImportPlanEntry {
  if (product.archived) {
    return { canonicalProductId: product.id, action: "skip", reason: "ARCHIVED_PRODUCT", warnings: [] };
  }

  const fieldErrors = validateRequiredFields(product);
  if (fieldErrors.length > 0) {
    return { canonicalProductId: product.id, action: "error", reason: fieldErrors.join("; "), warnings: [] };
  }

  const { row, type, warnings } = buildRow(product, priceInput);
  if (!row || !type) {
    return {
      canonicalProductId: product.id,
      action: "skip",
      reason: `UNSUPPORTED_KIND: '${product.kind}' has no live 'products.type' equivalent (only POD and AFFILIATE are representable)`,
      warnings: [],
    };
  }

  const match = findDedupeMatch(row.title, type, existingRows);
  const action: ImportAction = match ? "update" : "insert";

  return {
    canonicalProductId: product.id,
    action,
    ...(match ? { matchedExistingId: match.id } : {}),
    row,
    warnings,
  };
}

export function planImport(
  products: CanonicalProduct[],
  existingRows: ExistingLiveProductRow[],
  prices: CanonicalProductPriceInput[] = [],
): ImportPlanSummary {
  const priceByProductId = new Map(prices.map((p) => [p.productId, p]));
  const entries = products.map((product) => planImportEntry(product, existingRows, priceByProductId.get(product.id)));

  return {
    total: entries.length,
    insert: entries.filter((e) => e.action === "insert").length,
    update: entries.filter((e) => e.action === "update").length,
    skip: entries.filter((e) => e.action === "skip").length,
    error: entries.filter((e) => e.action === "error").length,
    entries,
  };
}
