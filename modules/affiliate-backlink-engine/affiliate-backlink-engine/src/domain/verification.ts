/**
 * Verification status contract.
 *
 * The engine MUST distinguish:
 *  DISCOVERED  - found by an adapter but not yet validated
 *  VERIFIED    - re-checked against the source within the evidence window
 *  INFERRED    - derived by analysis, not directly observed
 *  STALE       - previously verified, now past the revalidation window
 *  UNAVAILABLE - source could not be reached (transient)
 *  BLOCKED     - source refused access (robots, auth, 403, etc.)
 */
export type VerificationStatus =
  | "DISCOVERED"
  | "VERIFIED"
  | "INFERRED"
  | "STALE"
  | "UNAVAILABLE"
  | "BLOCKED";

export const VERIFICATION_STATUSES: readonly VerificationStatus[] = [
  "DISCOVERED",
  "VERIFIED",
  "INFERRED",
  "STALE",
  "UNAVAILABLE",
  "BLOCKED"
] as const;

export function isVerified(s: VerificationStatus | undefined): s is "VERIFIED" {
  return s === "VERIFIED";
}

export function isActionable(s: VerificationStatus | undefined): boolean {
  return s === "VERIFIED" || s === "DISCOVERED" || s === "INFERRED";
}

export function isStale(s: VerificationStatus | undefined): boolean {
  return s === "STALE";
}

export function isBlocked(s: VerificationStatus | undefined): boolean {
  return s === "BLOCKED" || s === "UNAVAILABLE";
}

/**
 * Revalidation policy (ms).
 * Default: 7 days. After that a VERIFIED record becomes STALE.
 */
export const DEFAULT_REVALIDATE_MS = 7 * 24 * 60 * 60 * 1000;

export function shouldRevalidate(verifiedAt: number | undefined, now: number = Date.now()): boolean {
  if (!verifiedAt) return true;
  return now - verifiedAt > DEFAULT_REVALIDATE_MS;
}

export function transitionToStaleIfNeeded(
  status: VerificationStatus,
  verifiedAt: number | undefined,
  now: number = Date.now()
): VerificationStatus {
  if (status === "VERIFIED" && shouldRevalidate(verifiedAt, now)) {
    return "STALE";
  }
  return status;
}
