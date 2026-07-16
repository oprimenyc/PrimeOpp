/**
 * Cache abstraction for enriched profiles.
 *
 * Implementations may be in-memory (default), Redis-backed (host-supplied),
 * or database-backed. The core module ships only the in-memory implementation
 * — host integrations are expected to provide their own adapter.
 */

import type { EnrichedProductProfile } from "../contracts/output";

export interface ProductEnrichmentCache {
  get(key: string): Promise<EnrichedProductProfile | null>;
  set(key: string, value: EnrichedProductProfile, ttlSeconds?: number): Promise<void>;
  delete(key: string): Promise<void>;
  clear(): Promise<void>;
}

interface CacheEntry {
  value: EnrichedProductProfile;
  expiresAt: number | null; // epoch ms; null = no expiry
}

/**
 * In-memory LRU-ish cache with TTL. Not a true LRU — entries are evicted
 * lazily on access and on insert when capacity is exceeded (oldest-first).
 */
export class InMemoryEnrichmentCache implements ProductEnrichmentCache {
  private readonly store = new Map<string, CacheEntry>();
  private readonly capacity: number;
  private readonly defaultTtlSeconds: number | null;

  constructor(opts?: { capacity?: number; defaultTtlSeconds?: number | null }) {
    this.capacity = opts?.capacity ?? 1000;
    this.defaultTtlSeconds = opts?.defaultTtlSeconds ?? null;
  }

  async get(key: string): Promise<EnrichedProductProfile | null> {
    const entry = this.store.get(key);
    if (!entry) return null;
    if (entry.expiresAt !== null && Date.now() > entry.expiresAt) {
      this.store.delete(key);
      return null;
    }
    // Refresh insertion order for LRU-like eviction.
    this.store.delete(key);
    this.store.set(key, entry);
    return entry.value;
  }

  async set(key: string, value: EnrichedProductProfile, ttlSeconds?: number): Promise<void> {
    const ttl = ttlSeconds ?? this.defaultTtlSeconds;
    const expiresAt = ttl === null || ttl === undefined ? null : Date.now() + ttl * 1000;
    this.store.set(key, { value, expiresAt });
    while (this.store.size > this.capacity) {
      const oldest = this.store.keys().next().value;
      if (oldest === undefined) break;
      this.store.delete(oldest);
    }
  }

  async delete(key: string): Promise<void> {
    this.store.delete(key);
  }

  async clear(): Promise<void> {
    this.store.clear();
  }

  /** Test helper. */
  get size(): number {
    return this.store.size;
  }
}

/**
 * Deterministic cache key derived from the input. Two equivalent inputs
 * (same normalized identifier and same manual fields) produce the same key.
 */
export function computeCacheKey(input: {
  identifier?: { normalizedValue: string; identifierType: string };
  manualProduct?: Record<string, unknown>;
}): string {
  const idPart = input.identifier
    ? `${input.identifier.identifierType}:${input.identifier.normalizedValue}`
    : "noid";
  const manualPart = input.manualProduct
    ? Object.keys(input.manualProduct)
        .sort()
        .map((k) => `${k}=${String((input.manualProduct as Record<string, unknown>)[k] ?? "")}`)
        .join("|")
    : "nomanual";
  return `enrich:${idPart}:${manualPart}`;
}
