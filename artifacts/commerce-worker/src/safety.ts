/**
 * Write-mode safety gate. Pure functions over an env-like object — no I/O,
 * fully unit-testable. Two independent, explicit opt-ins are required
 * before any DB write is even considered:
 *
 *   1. DRY_RUN must be the exact string "false" (anything else — unset,
 *      "true", "", "0", typos — stays in dry-run).
 *   2. WRITE_MODE must be the exact string "true" (same rule).
 *
 * Both gates exist so that a single missing/misconfigured env var can
 * never accidentally flip the worker into write mode. Nothing in this
 * codebase currently sets either variable to activate write mode — the
 * gate exists so the code is honest about being read/plan-only right now,
 * not so it can be silently turned on later without a deliberate change.
 */

export interface WorkerEnv {
  DRY_RUN?: string;
  WRITE_MODE?: string;
}

export function isDryRun(env: WorkerEnv): boolean {
  return env.DRY_RUN !== "false";
}

export function isWriteModeActive(env: WorkerEnv): boolean {
  return !isDryRun(env) && env.WRITE_MODE === "true";
}
