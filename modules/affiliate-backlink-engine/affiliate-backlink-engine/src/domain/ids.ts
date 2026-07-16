/**
 * Deterministic ID generation.
 *
 * IDs MUST be:
 *  - deterministic (same inputs => same id)
 *  - prefixed by entity kind for human readability
 *  - safe for use as filenames / map keys
 *  - opaque enough that they do not leak PII
 *
 * We use a stable SHA-256-based scheme (Web Crypto).
 */
import { createHash } from "node:crypto";

const PREFIX_MAP = {
  site: "site",
  domain: "dom",
  page: "page",
  asset: "asset",
  competitor: "comp",
  backlinkSource: "bls",
  linkingPage: "lp",
  linkingDomain: "ld",
  opportunity: "opp",
  brokenLink: "brk",
  resourcePage: "res",
  competitorGap: "gap",
  mention: "men",
  internalLink: "int",
  prospect: "pro",
  contact: "ctc",
  campaign: "cmp",
  action: "act",
  evidence: "evd",
  score: "scr"
} as const;

export type IdKind = keyof typeof PREFIX_MAP;

function hash(input: string): string {
  return createHash("sha256").update(input, "utf8").digest("hex").slice(0, 24);
}

function slugPart(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 32);
}

/**
 * Deterministic ID from kind + stable string parts.
 * Determinism: identical parts produce identical ids.
 */
export function deterministicId(kind: IdKind, parts: Array<string | number>): string {
  const joined = parts.map((p) => String(p)).join("|");
  const h = hash(joined);
  const prefix = PREFIX_MAP[kind];
  return `${prefix}_${h}`;
}

/**
 * Human-readable ID with a slug segment. Still deterministic given the same parts+label.
 */
export function slugId(kind: IdKind, label: string, parts: Array<string | number>): string {
  const h = hash(parts.map((p) => String(p)).join("|") + "|" + label);
  return `${PREFIX_MAP[kind]}_${slugPart(label) || "x"}_${h.slice(0, 12)}`;
}

/**
 * Fresh ID for entities that genuinely have no deterministic inputs
 * (e.g. user-initiated campaign created at runtime). Uses timestamp + random
 * but is still prefixed and safe.
 */
export function ephemeralId(kind: IdKind): string {
  const ts = Date.now().toString(36);
  const rand = Math.random().toString(36).slice(2, 10);
  return `${PREFIX_MAP[kind]}_${ts}${rand}`;
}

export function assertValidId(id: string): boolean {
  if (!id || typeof id !== "string") return false;
  return /^[a-z]+_[A-Za-z0-9_-]+$/.test(id);
}
