// Common shared types used across the platform.

/** ISO-8601 timestamp string (UTC). */
export type ISO8601 = string;

/** A stable unique identifier (UUID v4 or ULID). */
export type Identifier = string;

/** Tenant identifier for multi-tenant isolation. */
export type TenantId = string;

/** Currency code in ISO 4217 (e.g. "USD"). */
export type CurrencyCode = string;

/** A reference to a secret stored in an external vault (e.g. Prime Vault).
 *  NEVER store raw secret material inline. Always use a SecretReference. */
export interface SecretReference {
  readonly vault: string;
  readonly key: string;
  readonly version?: string;
}

/** Monetary amount with explicit currency. */
export interface Money {
  readonly amount: string; // string to preserve precision
  readonly currency: CurrencyCode;
}

/** A non-repudiable evidence record. Every workflow terminal state must produce evidence. */
export interface EvidenceRecord {
  readonly evidenceId: Identifier;
  readonly tenantId: TenantId;
  readonly timestamp: ISO8601;
  readonly kind: string;
  readonly description: string;
  readonly actor: ActorReference;
  readonly subject: { readonly type: string; readonly id: Identifier };
  readonly payload: Readonly<Record<string, unknown>>;
  readonly hash: string;
}

/** A reference to an actor (human, service, or system). */
export interface ActorReference {
  readonly actorType: 'human' | 'service' | 'system' | 'adapter' | 'verifier';
  readonly actorId: Identifier;
  readonly tenantId: TenantId;
  readonly role?: string;
}

/** Generic result wrapper — every operation must terminate in an explicit success or failure. */
export type Result<T, E = Failure> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: E };

export interface Failure {
  readonly code: string;
  readonly message: string;
  readonly details?: Readonly<Record<string, unknown>>;
  readonly recoverable?: boolean;
  readonly evidenceId?: Identifier;
}

/** Capability declaration used by adapters and channels. */
export interface Capability {
  readonly name: string;
  readonly supported: boolean;
  readonly notes?: string;
}

/** A geographic region (ISO 3166-1 alpha-2 country code, optionally with subdivision). */
export interface Region {
  readonly country: string;
  readonly subdivision?: string;
}

/** Outcome of a deterministic conflict resolution. */
export type ConflictOutcome =
  | 'LOCAL_WINS'
  | 'REMOTE_WINS'
  | 'NEWEST_WINS'
  | 'MANUAL_REVIEW'
  | 'POLICY_DECISION'
  | 'UNSUPPORTED';

/** Generic list response. */
export interface ListResponse<T> {
  readonly items: readonly T[];
  readonly nextCursor?: string;
  readonly totalEstimate?: number;
}

/** Audit log entry. */
export interface AuditEntry {
  readonly auditId: Identifier;
  readonly tenantId: TenantId;
  readonly timestamp: ISO8601;
  readonly actor: ActorReference;
  readonly action: string;
  readonly resourceType: string;
  readonly resourceId: Identifier;
  readonly outcome: 'success' | 'failure';
  readonly reason?: string;
  readonly evidenceId?: Identifier;
}
