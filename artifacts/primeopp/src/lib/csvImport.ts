// csvImport.ts — pure parsing/mapping/validation logic for the bulk
// market-evidence CSV import utility (Sourcing → "Import Evidence (CSV)").
//
// Deliberately dependency-free and framework-free: this is an ingestion
// utility, not a spreadsheet application, so the parser only needs to
// handle real-world exports (Helium10/Keepa/SellerAmp/etc. all produce
// standard quoted CSV) — not arbitrary spreadsheet formats.
//
// The one hard rule threading through every function here: never invent a
// value. A cell that's missing, ambiguous, or out of range makes the row
// invalid — it does not get defaulted to something plausible-looking.
// Optional fields fall back to the same honest "unknown" values the manual
// entry form and the backend schema already use (UNKNOWN condition, MEDIUM
// confidence, USD currency) — those are declared unknowns, not guesses.

import type { ManualPriceObservationInput } from "./api";

// ─── CSV parsing ────────────────────────────────────────────────────────────

/**
 * Minimal RFC 4180-ish CSV parser: quoted fields, "" escaping inside quotes,
 * commas/newlines inside quoted fields, and \n / \r\n / bare \r line endings.
 */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  let i = 0;
  const len = text.length;

  const pushField = () => {
    row.push(field);
    field = "";
  };
  const pushRow = () => {
    pushField();
    rows.push(row);
    row = [];
  };

  while (i < len) {
    const char = text[i];
    if (inQuotes) {
      if (char === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i += 2;
          continue;
        }
        inQuotes = false;
        i += 1;
        continue;
      }
      field += char;
      i += 1;
      continue;
    }
    if (char === '"') {
      inQuotes = true;
      i += 1;
      continue;
    }
    if (char === ",") {
      pushField();
      i += 1;
      continue;
    }
    if (char === "\r") {
      if (text[i + 1] === "\n") {
        // Bare \r ahead of \n: skip it, let \n close the row.
        i += 1;
        continue;
      }
      pushRow();
      i += 1;
      continue;
    }
    if (char === "\n") {
      pushRow();
      i += 1;
      continue;
    }
    field += char;
    i += 1;
  }
  if (field.length > 0 || row.length > 0) pushRow();

  // Drop trailing fully-blank rows (a trailing newline produces one).
  return rows.filter((r) => !(r.length === 1 && r[0].trim() === ""));
}

export interface ParsedCsv {
  headers: string[];
  rows: string[][];
}

export function toParsedCsv(text: string, hasHeader: boolean): ParsedCsv {
  const allRows = parseCsv(text);
  if (allRows.length === 0) return { headers: [], rows: [] };
  if (hasHeader) {
    const [headerRow, ...rest] = allRows;
    return { headers: headerRow.map((h) => h.trim()), rows: rest };
  }
  const width = Math.max(...allRows.map((r) => r.length));
  const headers = Array.from({ length: width }, (_, idx) => `Column ${idx + 1}`);
  return { headers, rows: allRows };
}

// ─── Field mapping ──────────────────────────────────────────────────────────

export type FieldKey =
  | "platform"
  | "listingType"
  | "price"
  | "normalizedIdentifier"
  | "productId"
  | "identifierType"
  | "condition"
  | "matchConfidence"
  | "sourceUrl"
  | "currency";

export interface FieldDef {
  key: FieldKey;
  label: string;
  required: boolean;
  // Whether the field can be set to one fixed value applied to every row,
  // instead of (or in addition to being unavailable in) the CSV. Never
  // offered for fields that hold real per-row data (price, identifiers,
  // source URL) — a "fixed" price or identifier would be fabricated data.
  allowFixed: boolean;
  hint: string;
}

export const FIELD_DEFS: FieldDef[] = [
  { key: "platform", label: "Platform", required: true, allowFixed: true, hint: 'Marketplace key, e.g. "ebay", "stockx", "mercari" — lowercase letters/numbers/hyphens' },
  { key: "listingType", label: "Listing type", required: true, allowFixed: true, hint: "ACTIVE (asking price) or SOLD (completed sale)" },
  { key: "price", label: "Price", required: true, allowFixed: false, hint: "The one real number observed — never averaged, ranged, or estimated" },
  { key: "normalizedIdentifier", label: "Identifier", required: false, allowFixed: false, hint: "UPC / EAN / SKU / style code — must match what a scanned item resolves to" },
  { key: "productId", label: "Product ID", required: false, allowFixed: false, hint: "Only if this row is for your own catalog product, not a scanned identifier" },
  { key: "identifierType", label: "Identifier type", required: false, allowFixed: true, hint: "UPC, EAN, SKU, STYLE_CODE, etc. (optional)" },
  { key: "condition", label: "Condition", required: false, allowFixed: true, hint: "NEW, USED, REFURBISHED, OPEN_BOX — defaults to UNKNOWN, never guessed" },
  { key: "matchConfidence", label: "Match confidence", required: false, allowFixed: true, hint: "HIGH, MEDIUM, LOW — defaults to MEDIUM" },
  { key: "sourceUrl", label: "Source URL", required: false, allowFixed: false, hint: "Link to the listing, if you have one (optional)" },
  { key: "currency", label: "Currency", required: false, allowFixed: true, hint: "3-letter code — defaults to USD" },
];

export interface FieldMapping {
  column: number | null;
  fixed: string;
}

export type ColumnMapping = Partial<Record<FieldKey, FieldMapping>>;

const HEADER_SYNONYMS: Record<FieldKey, string[]> = {
  platform: ["platform", "marketplace", "site", "channel", "source"],
  listingType: ["listingtype", "type", "status", "saletype"],
  price: ["price", "amount", "value", "medianprice", "saleprice", "listprice", "askingprice"],
  normalizedIdentifier: ["identifier", "upc", "ean", "gtin", "isbn", "asin", "sku", "style", "stylecode", "barcode"],
  productId: ["productid", "catalogid", "internalid"],
  identifierType: ["identifiertype", "idtype"],
  condition: ["condition", "itemcondition"],
  matchConfidence: ["matchconfidence", "confidence"],
  sourceUrl: ["url", "link", "sourceurl", "listingurl"],
  currency: ["currency", "curr"],
};

function normalizeHeader(header: string): string {
  return header.trim().toLowerCase().replace(/[\s_-]/g, "");
}

/**
 * Suggests a starting column mapping by matching header names against known
 * synonyms. This only pre-fills the mapping UI for convenience — it never
 * decides row *values*, and the operator reviews/overrides every mapping
 * before anything is validated or submitted.
 */
export function guessColumnMapping(headers: string[]): ColumnMapping {
  const normalized = headers.map(normalizeHeader);
  const mapping: ColumnMapping = {};
  for (const def of FIELD_DEFS) {
    const synonyms = HEADER_SYNONYMS[def.key];
    const columnIndex = normalized.findIndex((h) => synonyms.includes(h));
    mapping[def.key] = { column: columnIndex === -1 ? null : columnIndex, fixed: "" };
  }
  return mapping;
}

// ─── Row validation ─────────────────────────────────────────────────────────

const PLATFORM_KEY_RE = /^[a-z0-9][a-z0-9-]*$/;
const CONDITION_VALUES = ["NEW", "USED", "REFURBISHED", "OPEN_BOX", "UNKNOWN"] as const;
const CONFIDENCE_VALUES = ["HIGH", "MEDIUM", "LOW", "UNKNOWN"] as const;

export interface RowValidationResult {
  rowIndex: number; // 0-based index into the data rows (not counting header)
  raw: string[];
  observation: ManualPriceObservationInput | null;
  errors: string[];
}

function cellValue(row: string[], mapping: ColumnMapping, key: FieldKey): string {
  const m = mapping[key];
  if (!m) return "";
  if (m.column !== null && m.column !== undefined) {
    return (row[m.column] ?? "").trim();
  }
  return (m.fixed ?? "").trim();
}

export function validateRow(row: string[], mapping: ColumnMapping, rowIndex: number): RowValidationResult {
  const errors: string[] = [];

  const platformRaw = cellValue(row, mapping, "platform");
  const platform = platformRaw.toLowerCase();
  if (!platform) {
    errors.push("Platform is required.");
  } else if (!PLATFORM_KEY_RE.test(platform) || platform.length > 60) {
    errors.push(`Platform "${platformRaw}" must be lowercase letters/numbers/hyphens (e.g. "ebay", "flight-club").`);
  }

  const listingTypeRaw = cellValue(row, mapping, "listingType").toUpperCase();
  if (!listingTypeRaw) {
    errors.push("Listing type is required.");
  } else if (listingTypeRaw !== "ACTIVE" && listingTypeRaw !== "SOLD") {
    errors.push(`Listing type "${listingTypeRaw}" must be ACTIVE or SOLD.`);
  }

  const priceCell = cellValue(row, mapping, "price");
  const priceCleaned = priceCell.replace(/[$,\s]/g, "");
  const price = priceCleaned ? Number(priceCleaned) : NaN;
  if (!priceCell) {
    errors.push("Price is required.");
  } else if (!Number.isFinite(price) || price <= 0 || price > 1_000_000) {
    errors.push(`Price "${priceCell}" must be a positive number.`);
  }

  const productIdRaw = cellValue(row, mapping, "productId");
  let productId: number | null = null;
  if (productIdRaw) {
    const parsed = Number(productIdRaw);
    if (!Number.isInteger(parsed) || parsed <= 0) {
      errors.push(`Product ID "${productIdRaw}" must be a positive whole number.`);
    } else {
      productId = parsed;
    }
  }

  const normalizedIdentifier = cellValue(row, mapping, "normalizedIdentifier") || null;
  if (normalizedIdentifier && normalizedIdentifier.length > 120) {
    errors.push("Identifier is longer than 120 characters.");
  }

  if (!productId && !normalizedIdentifier) {
    errors.push("Row must include a Product ID or an Identifier — evidence must be scoped to something real.");
  }

  const identifierTypeRaw = cellValue(row, mapping, "identifierType");
  if (identifierTypeRaw && identifierTypeRaw.length > 40) {
    errors.push("Identifier type is longer than 40 characters.");
  }

  const conditionRaw = cellValue(row, mapping, "condition").toUpperCase();
  let condition: (typeof CONDITION_VALUES)[number] = "UNKNOWN";
  if (conditionRaw) {
    if (!CONDITION_VALUES.includes(conditionRaw as (typeof CONDITION_VALUES)[number])) {
      errors.push(`Condition "${conditionRaw}" is not one of ${CONDITION_VALUES.join(", ")}.`);
    } else {
      condition = conditionRaw as (typeof CONDITION_VALUES)[number];
    }
  }

  const confidenceRaw = cellValue(row, mapping, "matchConfidence").toUpperCase();
  let matchConfidence: (typeof CONFIDENCE_VALUES)[number] = "MEDIUM";
  if (confidenceRaw) {
    if (!CONFIDENCE_VALUES.includes(confidenceRaw as (typeof CONFIDENCE_VALUES)[number])) {
      errors.push(`Match confidence "${confidenceRaw}" is not one of ${CONFIDENCE_VALUES.join(", ")}.`);
    } else {
      matchConfidence = confidenceRaw as (typeof CONFIDENCE_VALUES)[number];
    }
  }

  const sourceUrlRaw = cellValue(row, mapping, "sourceUrl");
  let sourceUrl: string | null = null;
  if (sourceUrlRaw) {
    if (sourceUrlRaw.length > 500) {
      errors.push("Source URL is longer than 500 characters.");
    } else {
      try {
        const parsedUrl = new URL(sourceUrlRaw);
        if (parsedUrl.protocol !== "http:" && parsedUrl.protocol !== "https:") throw new Error("unsupported protocol");
        sourceUrl = sourceUrlRaw;
      } catch {
        errors.push(`Source URL "${sourceUrlRaw}" is not a valid http(s) URL.`);
      }
    }
  }

  const currencyRaw = cellValue(row, mapping, "currency").toUpperCase();
  let currency = "USD";
  if (currencyRaw) {
    if (currencyRaw.length !== 3) {
      errors.push(`Currency "${currencyRaw}" must be a 3-letter code.`);
    } else {
      currency = currencyRaw;
    }
  }

  if (errors.length > 0) {
    return { rowIndex, raw: row, observation: null, errors };
  }

  return {
    rowIndex,
    raw: row,
    errors: [],
    observation: {
      platform,
      listingType: listingTypeRaw as "ACTIVE" | "SOLD",
      price,
      productId,
      normalizedIdentifier,
      identifierType: identifierTypeRaw || null,
      condition,
      matchConfidence,
      sourceUrl,
      currency,
    },
  };
}

export function validateRows(rows: string[][], mapping: ColumnMapping): RowValidationResult[] {
  return rows.map((row, idx) => validateRow(row, mapping, idx));
}

// ─── Batch chunking ─────────────────────────────────────────────────────────

// Matches manualPriceObservationBatchSchema's max (artifacts/api-server/src/lib/validation.ts).
export const MAX_OBSERVATIONS_PER_BATCH = 50;

export function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}
