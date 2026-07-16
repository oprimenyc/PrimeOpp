/**
 * Input validation + sanitization for CSV/JSON imports.
 * Enforces size limits and basic shape checks.
 */
export const MAX_IMPORT_ROWS = Number(process.env.MAX_IMPORT_ROWS ?? 50000);
export const MAX_STRING_LEN = 5000;
export const MAX_OBJECT_KEYS = 200;

export function truncateString(s: unknown, max: number = MAX_STRING_LEN): string {
  if (typeof s !== "string") return "";
  return s.length > max ? s.slice(0, max) : s;
}

export function sanitizeObject(o: unknown): Record<string, unknown> | undefined {
  if (!o || typeof o !== "object" || Array.isArray(o)) return undefined;
  const out: Record<string, unknown> = {};
  const entries = Object.entries(o as Record<string, unknown>).slice(0, MAX_OBJECT_KEYS);
  for (const [k, v] of entries) {
    if (typeof k !== "string" || k.length > 200) continue;
    if (typeof v === "string") out[k] = truncateString(v);
    else if (typeof v === "number" || typeof v === "boolean") out[k] = v;
    else if (v && typeof v === "object") out[k] = sanitizeObject(v);
  }
  return out;
}

export interface CsvParseOptions {
  delimiter?: string;
  hasHeader?: boolean;
  maxRows?: number;
}

/**
 * Minimal CSV parser (no external dep). Supports quoted fields and escaped quotes.
 * Suitable for fixture-driven tests and small/medium imports.
 */
export function parseCsv(text: string, opts: CsvParseOptions = {}): Record<string, string>[] {
  const delimiter = opts.delimiter ?? ",";
  const hasHeader = opts.hasHeader ?? true;
  const maxRows = opts.maxRows ?? MAX_IMPORT_ROWS;
  const rows = parseCsvRows(text, delimiter);
  if (rows.length === 0) return [];
  let header: string[];
  let dataRows: string[][];
  if (hasHeader) {
    header = rows[0];
    dataRows = rows.slice(1);
  } else {
    header = rows[0].map((_, i) => `col${i}`);
    dataRows = rows;
  }
  return dataRows.slice(0, maxRows).map((r) => {
    const obj: Record<string, string> = {};
    header.forEach((h, i) => {
      obj[h] = r[i] ?? "";
    });
    return obj;
  });
}

function parseCsvRows(text: string, delimiter: string): string[][] {
  const rows: string[][] = [];
  let cur: string[] = [];
  let field = "";
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += c;
      }
    } else {
      if (c === '"') {
        inQuotes = true;
      } else if (c === delimiter) {
        cur.push(field);
        field = "";
      } else if (c === "\n") {
        cur.push(field);
        rows.push(cur);
        cur = [];
        field = "";
      } else if (c === "\r") {
        // ignore
      } else {
        field += c;
      }
    }
  }
  if (field.length > 0 || cur.length > 0) {
    cur.push(field);
    rows.push(cur);
  }
  return rows;
}

export function parseJsonSafe(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}
