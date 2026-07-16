# E.V.E. Verification Contract

This document specifies the verification contract between the `affiliate-backlink-engine` (hereafter "the engine") and E.V.E., the verification and provenance-auditing operator layer. E.V.E. is responsible for independently verifying the evidence the engine produces, re-validating stale records, auditing payload integrity, and confirming acquired-link outcomes. The engine treats every actionable claim as requiring at least one backing `EvidenceRecord`; E.V.E. is the authority that decides whether those records hold up under scrutiny.

The engine's evidence layer is defined entirely in `src/domain/evidence.ts` and `src/domain/verification.ts`. The campaign-side enforcement is in `src/campaigns/tracker.ts` and `src/domain/campaign.ts`. Every interface and constant referenced below is exported from the public barrel at `src/index.ts` so E.V.E. can consume them either in-process or via serialized JSON.

## 1. Role of E.V.E.

E.V.E. performs four functions within the engine's trust model: verifying opportunity evidence (re-fetching source pages and confirming that the observed facts still hold), verifying acquired links (confirming that a link the engine claims was earned is actually live on the target page), auditing provenance (tracing each EvidenceRecord back to its adapter, provider kind, reference, and fetch timestamp), and enforcing the no-auto-acquisition rule (ensuring the tracker never advances a campaign to `LINK_ACQUIRED` without verified evidence).

The engine is explicitly designed so that E.V.E. can perform these functions without privileged access. Every `EvidenceRecord` is immutable (see Section 2). Every `CampaignAction` is append-only. Every transition that requires evidence is gated by `REQUIRES_EVIDENCE_FOR` (see Section 8). E.V.E. operates on the same data structures the engine produces; there is no separate audit log or shadow state.

## 2. Evidence Contract

The `EvidenceContract` interface (defined in `src/domain/evidence.ts`) is the programmatic surface E.V.E. uses to read evidence:

```ts
interface EvidenceContract {
  record(e: Omit<EvidenceRecord, "id">): EvidenceRecord;
  for(subjectId: string): EvidenceRecord[];
  latest(subjectId: string, kind?: EvidenceKind): EvidenceRecord | undefined;
  all(): EvidenceRecord[];
}
```

`record` is the only way to create an `EvidenceRecord`. It accepts the record contents minus the `id` and uses `deterministicId("evidence", [subjectId, kind, observedAt, claim])` to compute a stable id. The deterministic id means that re-recording the same observation at the same timestamp for the same subject produces the same id; this is intentional for idempotent adapter replay. The default in-memory implementation is `InMemoryEvidenceStore`, which stores records in a `Map` keyed by id and never mutates a record after insertion.

Every actionable claim the engine makes MUST have at least one `EvidenceRecord`. This is enforced by convention in the discovery and analysis modules: each opportunity produced by `discoverCompetitorBacklinkOpportunities`, `discoverBrokenLinkOpportunities`, `discoverResourcePageOpportunities`, `discoverMentionOpportunities`, `analyzeCompetitorGap`, `analyzeBrokenLinks`, and `analyzeResourcePages` is accompanied by an `EvidenceRecord` whose `id` is in `opportunity.evidenceIds`. The scoring engine (`scoreOpportunity`) uses `evidenceIds.length === 0` as a strong negative signal in the `evidence_confidence` component (returning 0.1 in that case).

The `EvidenceRecord` shape itself:

```ts
interface EvidenceRecord {
  id: string;
  kind: EvidenceKind;          // 12 kinds, see source
  subjectId: string;
  claim: string;
  observedAt: number;
  source: EvidenceSource;      // adapter, providerKind, reference, fetchedAt
  verification: VerificationStatus;
  payload?: Record<string, unknown>;
  payloadHash?: string;        // see Section 5
}
```

## 3. Verification Statuses

The engine distinguishes six verification states, defined in `src/domain/verification.ts` and exported as the readonly array `VERIFICATION_STATUSES`:

| Status | Meaning | Actionable? |
|--------|---------|-------------|
| `DISCOVERED` | Found by an adapter, not yet validated | Yes |
| `VERIFIED` | Re-checked against the source within the evidence window | Yes |
| `INFERRED` | Derived by analysis, not directly observed | Yes (with caveat) |
| `STALE` | Previously verified, now past the revalidation window | No (needs re-check) |
| `UNAVAILABLE` | Source could not be reached (transient) | No |
| `BLOCKED` | Source refused access (robots, auth, 403, etc.) | No |

The helper functions `isVerified`, `isActionable`, `isStale`, and `isBlocked` (all in `src/domain/verification.ts`) provide predicate access. `isActionable` returns true only for `VERIFIED`, `DISCOVERED`, and `INFERRED`; this is the gate the scoring engine uses to decide whether an opportunity should influence the recommended action.

E.V.E. can re-validate any record by re-fetching the source via the original adapter (identified by `source.adapter` and `source.providerKind`). The re-validation flow is: invoke the adapter (typically `SearchDataAdapter.fetchPage` for `page_observation` records, `searchBacklinks` for `backlink_observation` records, etc.), compare the new observation to the existing `payload`, and either record a fresh `EvidenceRecord` with `verification: "VERIFIED"` (if the observation matches) or record a new record with the new state and let the original remain `STALE`. The engine never mutates the original record; re-validation produces a new immutable entry, and `EvidenceContract.latest(subjectId, kind)` returns the most recent by `observedAt`.

`INFERRED` is treated specially. The engine's gap analyzer and content matcher produce inferred observations (e.g. replicability assessments, match-level classifications) that are not directly observable. E.V.E. cannot re-fetch an inferred record because there is no source to re-fetch; E.V.E.'s role for inferred records is to confirm the inference chain is documented (i.e. that the inference cites the underlying observed records it was derived from).

## 4. Revalidation Policy

The revalidation window is defined by `DEFAULT_REVALIDATE_MS = 7 * 24 * 60 * 60 * 1000` (7 days) in `src/domain/verification.ts`. After 7 days, a `VERIFIED` record is considered `STALE` and must be re-checked before being relied upon for an actionable decision.

The policy is enforced by two helpers:

```ts
function shouldRevalidate(verifiedAt: number | undefined, now: number = Date.now()): boolean;
function transitionToStaleIfNeeded(
  status: VerificationStatus,
  verifiedAt: number | undefined,
  now: number = Date.now()
): VerificationStatus;
```

`shouldRevalidate` returns `true` if `verifiedAt` is missing or if `now - verifiedAt > DEFAULT_REVALIDATE_MS`. `transitionToStaleIfNeeded` returns `"STALE"` if the input status is `"VERIFIED"` and `shouldRevalidate` returns true; otherwise it returns the input status unchanged. The scoring engine uses `shouldRevalidate` directly to penalize stale-but-still-VERIFIED records: in `computeEvidenceConfidence` (`src/scoring/engine.ts`), a `VERIFIED` record that has aged past the window has its confidence multiplied by 0.5.

E.V.E. is expected to call `transitionToStaleIfNeeded` on every `VERIFIED` record during a periodic audit pass, then re-fetch and re-record any records that flipped to `STALE`. The engine does not run this pass automatically; it provides the policy and the helpers, and E.V.E. orchestrates the cadence.

## 5. Payload Integrity

Every `EvidenceRecord` may carry an optional `payload` (a sanitized object with no credentials and no PII without provenance) and an optional `payloadHash`. The hash is produced by `canonicalPayloadHash(payload)`, defined in `src/domain/evidence.ts`:

```ts
function canonicalPayloadHash(payload: unknown): string;
```

The implementation sorts object keys recursively (via `sortKeys`), serializes the result with `JSON.stringify`, and computes a lightweight FNV-1a-style 32-bit hash. The result is an 8-character lowercase hex string. The hash is intentionally not cryptographic; it is a tamper-detection mechanism, not a security control.

E.V.E.'s integrity audit flow is:

1. For each `EvidenceRecord` with both `payload` and `payloadHash` set, recompute `canonicalPayloadHash(record.payload)`.
2. Compare the recomputed hash to `record.payloadHash`. A mismatch indicates the payload was tampered with after recording.
3. For records where `payloadHash` is missing, the audit can compute and backfill the hash (the engine's CLI `evidence verify` command does exactly this; see `src/cli/index.ts`).

The CLI surfaces this as a verification report:

```bash
backlink-engine evidence verify --evidence ./out/evidence.json --json
# {
#   "verified": <count where hashOk>,
#   "total": <count>,
#   "results": [{ "id", "subjectId", "verification", "hashOk", "observedAt" }, ...]
# }
```

`hashOk` is `true` when either `payloadHash` is absent (no hash to check) or when the recomputed hash matches. E.V.E. should treat any `hashOk: false` result as a tamper signal warranting investigation.

## 6. Acquired-Link Verification

Acquired-link verification is the most operationally consequential verification flow. The engine's contract method is `verifyAcquiredLink`, defined in `src/campaigns/tracker.ts`:

```ts
async function verifyAcquiredLink(
  tracker: CampaignTracker,
  campaignId: string,
  verifier: () => Promise<{ live: boolean; url: string; detail?: string }>,
  recordEvidence: (e: Omit<EvidenceRecord, "id">) => EvidenceRecord,
  now: number = Date.now()
): Promise<{ live: boolean; action: CampaignAction }>;
```

The flow is:

1. E.V.E. supplies a `verifier` callback that performs the actual fetch (re-fetching the linking page, searching for the target URL in `outboundLinks`, returning `{ live: true, url, detail }` if found or `{ live: false, url, detail }` if not).
2. `verifyAcquiredLink` awaits the verifier's result.
3. It records an `EvidenceRecord` of kind `acquired_link_observation` (if `live === true`) or `outcome_observation` (if `live === false`), with `verification: "VERIFIED"` for live links and `verification: "UNAVAILABLE"` for not-found links. The `source` is `{ adapter: "link-verifier", providerKind: "crawl" }`.
4. It calls `tracker.recordOutcome(campaignId, { kind: "link_acquired" | "link_not_found", detail, verifiedAt: now }, [ev.id])`.
5. `recordOutcome` checks whether the outcome is `link_acquired` with non-empty `evidenceIds` and whether `canTransition(c.state, "LINK_ACQUIRED")` is true. If both hold, it calls `tracker.transition(campaignId, "LINK_ACQUIRED", { evidenceIds })`.
6. The transition itself enforces `REQUIRES_EVIDENCE_FOR["LINK_ACQUIRED"] = "acquired_link_observation"` (see Section 8): the evidence records are checked for both kind and `verification === "VERIFIED"`.
7. `verifyAcquiredLink` returns `{ live, action }` so the caller can confirm what was recorded.

The contract is therefore: the campaign transitions to `LINK_ACQUIRED` only if (a) the verifier returned `live: true`, (b) an `acquired_link_observation` EvidenceRecord with `verification: "VERIFIED"` was recorded, (c) the campaign's current state can legally transition to `LINK_ACQUIRED`, and (d) the transition's evidence check passes. If any of these conditions fails, the campaign remains in its prior state and the audit trail shows the failed verification.

E.V.E. is the expected supplier of the `verifier` callback. The engine does not ship a networked verifier by default; `FixtureAdapter` does not perform live fetches. E.V.E. wires in a real fetcher (respecting the SSRF rules in `src/utils/url.ts` and the timeout in `DEFAULT_TIMEOUT_MS`) and the engine handles the bookkeeping.

## 7. Provenance Auditing

Every `EvidenceRecord` carries a `source: EvidenceSource` field:

```ts
interface EvidenceSource {
  adapter: string;            // e.g. "fixture", "sitemap", "ahrefs", "manual", "link-verifier"
  providerKind?: EvidenceProviderKind;  // "search" | "seo" | "crawl" | "serp" | "llm" | "contact" | "manual" | "sitemap" | "import" | "internal"
  reference?: string;         // source URL, file path, or fixture id
  fetchedAt?: number;         // fetch/crawl timestamp
}
```

E.V.E. can audit the full provenance chain for any claim by:

1. Calling `EvidenceContract.for(subjectId)` to retrieve all records for a subject.
2. For each record, inspecting `source.adapter` and `source.providerKind` to identify the producing system.
3. Inspecting `source.reference` to find the original URL, file path, or fixture id.
4. Inspecting `source.fetchedAt` to determine freshness (combined with `DEFAULT_REVALIDATE_MS`).
5. If `source.adapter` is a networked adapter, re-fetching `source.reference` (subject to SSRF safety in `isSsrfSafe`) and comparing the new observation to `payload`.

The audit chain is complete: there is no engine-internal path that produces an `EvidenceRecord` without a `source.adapter`. The contact discovery module (`src/outreach/contact.ts`) propagates `result.provenance` from the adapter's `AdapterResult` directly into the `EvidenceSource`. The competitor gap analyzer (`src/competitors/gap-analyzer.ts`) records `source: { adapter: "competitor-gap-analyzer", providerKind: "internal" }` for its derived observations, making clear that those records are internal derivations rather than external observations.

## 8. No Auto-Acquisition Rule

The engine enforces a hard rule: the tracker MUST NOT automatically claim a link was acquired. This is implemented through `REQUIRES_EVIDENCE_FOR` in `src/domain/campaign.ts`:

```ts
export const REQUIRES_EVIDENCE_FOR: Partial<Record<CampaignLifecycleState, "acquired_link_observation">> = {
  LINK_ACQUIRED: "acquired_link_observation"
};
```

The transition logic in `InMemoryCampaignTracker.transition` (in `src/campaigns/tracker.ts`) checks `REQUIRES_EVIDENCE_FOR[to]`. If a required kind is present, it calls `verifyEvidenceForTransition(campaignId, requiredKind, opts)`, which checks that either (a) the supplied `evidence` records contain at least one record with `kind === requiredKind` and `verification === "VERIFIED"` whose id is in `opts.evidenceIds`, or (b) `opts.evidenceIds` is non-empty (in which case the operator is trusted to have supplied the right kind, since the records may be in a remote store). If neither holds, the transition throws:

```
Transition <from> -> LINK_ACQUIRED requires verified evidence of kind
"acquired_link_observation". Provide evidenceIds / evidence.
```

This means:

- `recordOutcome` in the tracker cannot silently advance a campaign to `LINK_ACQUIRED`. Even when `outcome.kind === "link_acquired"` and `evidenceIds.length > 0`, the subsequent `transition(campaignId, "LINK_ACQUIRED", { evidenceIds })` call is still subject to the `REQUIRES_EVIDENCE_FOR` check.
- `verifyAcquiredLink` is the only sanctioned way to produce the required evidence kind. It records the `acquired_link_observation` EvidenceRecord only after the verifier confirms `live === true`, and only then does it attempt the transition.
- Manual calls to `transition(campaignId, "LINK_ACQUIRED", { evidenceIds: [...] })` will succeed only if the supplied evidence ids correspond to `VERIFIED` `acquired_link_observation` records (or if the caller supplies no `evidence` records but does supply `evidenceIds`, in which case the operator assumes responsibility for the claim's correctness).

E.V.E. is the expected operator of `verifyAcquiredLink`. The engine's role is to provide the contract method, enforce the evidence requirement, and record the audit trail. The actual network verification is delegated to the `verifier` callback E.V.E. supplies, keeping the engine provider-agnostic and the verification authority in the right hands.
