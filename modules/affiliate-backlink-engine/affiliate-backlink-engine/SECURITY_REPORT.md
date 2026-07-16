# Security Report

This document catalogs the security posture of the `affiliate-backlink-engine`. Each control is documented against its concrete implementation in the source tree so that an operator or auditor can verify the claim without trusting the documentation alone. The engine is designed for safe-by-default operation: it ships offline, requires explicit opt-in for any networked provider, redacts secrets from logs, bounds every input, and refuses to make unverifiable claims.

The report covers twelve control areas. Where a control is enforced by code, the implementing file and the relevant function or constant are cited. Where a control is enforced by configuration, the `.env.example` entry is cited. No control relies on documentation alone.

## 1. Secret Handling

The engine never hardcodes API keys or credentials. All provider configuration is read from environment variables documented in `.env.example`:

| Variable | Purpose | Default |
|----------|---------|---------|
| `SEARCH_PROVIDER` / `SEARCH_API_KEY` | Search adapter selection and credential | `none` / empty |
| `SEO_PROVIDER` / `SEO_API_KEY` | SEO backlink adapter | `none` / empty |
| `LLM_PROVIDER` / `LLM_API_KEY` / `LLM_MODEL` | LLM adapter for classify/draft assistance | `none` / empty / empty |
| `CONTACT_PROVIDER` / `CONTACT_API_KEY` | Contact data adapter | `none` / empty |
| `CRAWL_PROVIDER` / `CRAWL_API_KEY` | Crawl adapter | `none` / empty |

Every `*_PROVIDER` defaults to `none`, which means no network call is attempted. The engine is fully functional with no env vars set, using only `FixtureAdapter` and `NoOpAiAdapter`. Operators who configure a real provider must supply the corresponding `*_API_KEY`; the engine reads these only at adapter-construction time and never logs the raw value.

Logging is secret-safe. `redact()` in `src/utils/logging.ts` walks any log field structure and replaces values whose key matches `/(key|secret|token|password|auth|credential|api[-_]?key)/i` with the literal string `"[REDACTED]"`. It also redacts string values that match the same pattern (so a value like `"Authorization: Bearer abc123"` is redacted). The `createLogger(sink)` factory wraps every emitted `LogEntry`'s `fields` through `redact()` before the sink sees them, so even a custom sink that serializes fields to disk cannot accidentally persist secrets. The default `consoleLogger` uses this factory and therefore inherits the redaction.

## 2. URL Validation

URL handling is centralized in `src/utils/url.ts`. Every adapter that fetches a URL MUST route through these helpers; the engine does not call `new URL()` directly in fetch paths.

`normalizeUrl(s, opts?)` performs safe parsing and normalization. It rejects any input whose protocol is not `http:` or `https:`, lowercases the hostname, strips default ports (`:80` for http, `:443` for https), removes trailing slashes from non-root paths, and computes a best-effort `rootDomain` (last two labels). On any parse failure or non-http(s) scheme, it returns `undefined` rather than throwing, so callers can branch cleanly.

`isSsrfSafe(s)` is the SSRF gate. It returns `false` (unsafe) when any of the following match:

| Blocked target | Reason |
|----------------|--------|
| `localhost`, `127.0.0.1`, `0.0.0.0`, `::1` | Loopback |
| `169.254.169.254` | Cloud metadata endpoint (AWS / Azure / GCP) |
| `metadata.google.internal` | GCP metadata endpoint |
| `10.x.x.x` | RFC1918 private (Class A) |
| `192.168.x.x` | RFC1918 private (Class C) |
| `172.16.x.x` through `172.31.x.x` | RFC1918 private (Class B) |
| `169.254.x.x` | Link-local |
| `0.x.x.x`, `255.x.x.x` | Reserved / broadcast |
| `127.x.x.x` | Loopback range |
| `fe80::` prefix | IPv6 link-local |
| `fc` prefix, `fd` prefix | IPv6 unique-local addresses (fc00::/7, fd00::/8) |

The implementation uses a `BLOCKED_HOSTS` set for exact hostname matches and a `PRIVATE_IP_REGEX` for IPv4 range checks. IPv6 link-local and ULA prefixes are matched by `hostname.startsWith("fe80:")`, `hostname.startsWith("fc")`, and `hostname.startsWith("fd")`. Any URL whose normalized hostname matches any of these patterns is treated as unsafe and must not be fetched. Adapters that respect the contract call `isSsrfSafe` before any outbound request.

## 3. Input Size Limits

All imported data is bounded by constants in `src/utils/validation.ts`:

| Constant | Value | Configurable | Purpose |
|----------|-------|--------------|---------|
| `MAX_IMPORT_ROWS` | `50000` | Yes, via `MAX_IMPORT_ROWS` env var | Cap on rows returned from `parseCsv` and on arrays imported via CLI |
| `MAX_STRING_LEN` | `5000` | No | Per-string truncation limit in `truncateString` |
| `MAX_OBJECT_KEYS` | `200` | No | Cap on object keys retained in `sanitizeObject` |

`MAX_IMPORT_ROWS` is read at module load as `Number(process.env.MAX_IMPORT_ROWS ?? 50000)`, so an operator can lower (or raise) it for a given deployment. `MAX_STRING_LEN` and `MAX_OBJECT_KEYS` are compile-time constants; both are intentionally conservative to bound memory use during import.

`sanitizeObject(o)` recursively walks an object, drops any key whose name is not a string or exceeds 200 characters, truncates string values to `MAX_STRING_LEN`, preserves numbers and booleans, and recursively sanitizes nested objects. Arrays are not preserved at the top level (the function returns `undefined` for arrays); callers that expect arrays must extract them before calling `sanitizeObject`. CSV and JSON imports through the CLI use `parseCsv` and `parseJsonSafe` respectively, both of which honor these limits.

## 4. Timeout Handling

Network operations are bounded by configuration:

| Variable | Default | Purpose |
|----------|---------|---------|
| `DEFAULT_TIMEOUT_MS` | `15000` | Per-request timeout for adapter fetches |
| `MAX_FETCH_URLS_PER_RUN` | `200` | Cap on total URLs fetched in a single engine run |

`DEFAULT_TIMEOUT_MS` is intended to be applied by concrete adapter implementations (the engine's default adapters are offline and do not fetch, but the contract documents the value as the canonical per-request bound). `MAX_FETCH_URLS_PER_RUN` bounds runaway crawls: an operator who accidentally points the engine at a deeply-linked sitemap cannot cause it to fetch thousands of URLs in a single invocation. Both values are env-configurable so deployments with stricter limits (or known-safe wider limits) can override them.

These limits are defense-in-depth, not the primary safety mechanism. The primary mechanism is the offline-by-default posture (Section 12): if no networked adapter is wired in, no fetches occur at all and the limits are not exercised.

## 5. DRY_RUN Default

`.env.example` ships with `DRY_RUN=true`. This is the engine's default runtime posture: outreach is never sent automatically, no email is dispatched, no contact form is submitted, and no social post is created without explicit operator action. The engine's code does not contain an outbound outreach transport; the `DRY_RUN` flag exists to communicate intent to any wrapping operator layer that may add one.

The flag's semantics for the engine itself are conservative: when `DRY_RUN=true`, the engine will produce outreach briefs, score opportunities, and plan campaigns, but it will not transition any campaign past `READY_FOR_OUTREACH` without an explicit `tracker.transition(campaignId, "OUTREACH_APPROVED", { actor, note, evidenceIds })` call from PrimeOS (see `PRIMEOS_INTEGRATION_CONTRACT.md`). The state machine in `src/domain/campaign.ts` enforces this regardless of the `DRY_RUN` value, so the flag is belt-and-suspenders: even if an operator sets `DRY_RUN=false` and wires in a transport, the engine still requires per-campaign approval before outreach.

## 6. Do-Not-Contact List

Contact discovery honors an explicit do-not-contact (DNC) list. The `ContactDiscoveryOptions` interface in `src/outreach/contact.ts` accepts a `doNotContact?: Set<string>` containing emails (lowercased) and/or hostnames. The `isDoNotContact(item, dnc)` helper checks each discovered contact against the set: if `item.email` (lowercased) is in the set, the contact is flagged with reason `"Email on DNC list."`; if the hostname parsed from `item.ref` is in the set, the contact is flagged with reason `"Domain on DNC list."`.

Flagged contacts are still recorded (with `doNotContact: true`, `doNotContactReason`, and a `low_trust_signals` risk flag at level `HIGH` with confidence 1), but they are also added to the `skipped` array returned by `discoverContacts`, and PrimeOS / AMOS / E.V.E. consumers are expected to exclude them from outreach. The outreach personalization layer propagates `contact.doNotContact` into `OutreachBrief.doNotContact`, so any downstream consumer that reads the brief has a clear signal not to contact.

The DNC list is operator-supplied; the engine does not maintain a built-in DNC list. Operators are expected to seed `ContactDiscoveryOptions.doNotContact` from their CRM, unsubscribe registry, or compliance system before invoking `discoverContacts` or `supplyManualContact`.

## 7. Email Hashing

Contact emails are never stored in `EvidenceRecord` payloads in raw form. The `discoverContacts` function in `src/outreach/contact.ts` explicitly omits `item.email` from the recorded payload and instead stores `emailHash: hashEmail(item.email)`:

```ts
payload: {
  ref: item.ref ?? ref,
  name: item.name,
  role: item.role,
  contactFormUrl: item.contactFormUrl,
  emailHash: item.email ? hashEmail(item.email) : undefined
}
```

`hashEmail(email)` computes a lightweight 32-bit hash (`e` + 8-char hex) suitable for deduplication. It is explicitly not a cryptographic hash (the source comment reads "Lightweight hash for dedup; not security-sensitive"), but it is sufficient to prevent raw email addresses from being persisted in evidence stores that may be exported, backed up, or audited. The raw email is still available on the in-memory `ContactCandidate` for the operator layer that needs to send outreach, but it does not enter the durable evidence trail.

Operators who need stronger PII protection (e.g. for GDPR compliance) should treat the in-memory `ContactCandidate` as ephemeral and ensure their wrapping layer hashes or encrypts emails at rest. The engine's contract is to not persist raw emails in `EvidenceRecord`s, which it honors.

## 8. Robots / Auth Boundary

Adapters MUST NOT bypass `robots.txt` or authentication. The engine's `VerificationStatus` enum includes `BLOCKED`, defined in `src/domain/verification.ts` as "source refused access (robots, auth, 403, etc.)". When an adapter encounters a 403, a robots.txt disallow, or an authentication requirement, it is expected to record the observation with `verification: "BLOCKED"` rather than attempt to circumvent the control.

The `isBlocked(s)` helper returns true for both `BLOCKED` and `UNAVAILABLE` statuses, and `isActionable(s)` returns false for both. This means blocked records cannot drive an actionable opportunity: the scoring engine's `evidence_confidence` component assigns such records a confidence of 0.2, and `recommendAction` will route the opportunity to `NEEDS_EVIDENCE` or `DEFER` rather than `PURSUE_NOW`.

The engine ships no code that submits credentials to a third-party site, no code that parses or bypasses `robots.txt`, and no code that scrapes behind authentication. The README's "Non-Negotiable Rules" section makes this explicit: the engine does not scrape behind authentication without permission and does not bypass robots or access controls. Any adapter that violates this rule is non-conformant with the engine's contract.

## 9. CSV / JSON Validation

CSV and JSON parsing are implemented safely in `src/utils/validation.ts`.

`parseCsv(text, opts)` is a minimal, dependency-free CSV parser. It supports quoted fields (a `"` character opens a quoted section that continues until the next unescaped `"`) and escaped quotes (a `""` sequence inside a quoted field is interpreted as a literal `"`). The parser handles `\n` as a row terminator and silently ignores `\r`. It does not throw on malformed input; instead, it produces the best-effort row set it can. The `maxRows` option (defaulting to `MAX_IMPORT_ROWS`) caps the number of data rows returned, so a 10-million-row CSV cannot exhaust memory.

`parseJsonSafe(text)` wraps `JSON.parse` in a try/catch and returns `undefined` on any parse failure. This is the function used throughout the CLI (see `src/cli/index.ts`'s `readJson` helper) to ensure that malformed JSON input produces a clean error message rather than an unhandled exception. Callers check for `undefined` and surface a domain-level error (`"Invalid JSON in: <path>"`) rather than crashing.

Both parsers are deterministic and side-effect-free. Neither writes to disk, makes network calls, or evaluates dynamic content. JSON is parsed strictly as data; there is no `eval`, no `Function` constructor, and no prototype-polluting revive function.

## 10. No PII Without Provenance

Personal data is stored only with explicit provenance. The `ContactCandidate` interface in `src/domain/outreach.ts` declares:

```ts
provenance: "page_contact_info" | "author_profile" | "org_contact_page" | "crm_export" | "manual" | "adapter";
```

Every `ContactCandidate` produced by the engine carries one of these six provenance values. The `discoverContacts` function sets `provenance: "adapter"` for contacts retrieved via a `SearchDataAdapter.discoverContacts` call. The `supplyManualContact` function sets `provenance: "manual"` for contacts supplied by an operator or CRM. The other four values (`page_contact_info`, `author_profile`, `org_contact_page`, `crm_export`) are reserved for higher-level adapters that inspect specific contact sources; the engine does not fabricate them.

The provenance field is more than a label: it determines how downstream consumers treat the contact. A contact with `provenance: "crm_export"` may be trusted for outreach (the operator sourced it through their own compliance-reviewed system); a contact with `provenance: "page_contact_info"` may be subject to additional consent checks before outreach; a contact with `provenance: "adapter"` carries the adapter's confidence and the recorded `EvidenceRecord` chain. The `EvidenceRecord` for each contact is of kind `contact_observation`, with `source.adapter` and `source.providerKind` reflecting the discovery path, so the full audit chain is preserved.

## 11. Audit Trail

Every state-changing operation on a campaign is recorded as an immutable `CampaignAction`. The `CampaignAction` interface (in `src/domain/campaign.ts`) includes:

```ts
interface CampaignAction {
  id: string;
  campaignId: string;
  kind: "state_transition" | "note" | "evidence_attached" | "outreach_sent" |
        "follow_up_scheduled" | "link_verified_acquired" | "link_verification_failed" |
        "revalidation" | "risk_flag_added" | "manual_override";
  fromState?: CampaignLifecycleState;
  toState?: CampaignLifecycleState;
  note?: string;
  evidenceIds?: string[];
  outcome?: { kind: "link_acquired" | "link_not_found" | "declined" | "no_response" | "replied" | "other"; detail?: string; verifiedAt?: number; };
  at: number;
  actor?: string;
}
```

Every `InMemoryCampaignTracker` method that mutates state (`create`, `transition`, `note`, `attachEvidence`, `recordOutcome`) pushes a new `CampaignAction` to the `actions` array. The `actionsFor(campaignId)` method returns the actions for a campaign sorted by `at` ascending, giving a complete ordered history of who did what, when, and why. The `actor` field is populated by the caller (e.g. `"primeos"`, `"eve"`, `"system"`), so audit trails can be filtered by responsible party.

`EvidenceRecord`s are equally immutable. The `InMemoryEvidenceStore` stores records in a `Map` keyed by id; once a record is inserted via `record()`, it is never mutated or deleted. To "update" a claim, callers insert a new record with a new `observedAt` and the prior record remains in place. `EvidenceContract.latest(subjectId, kind)` returns the most recent record by `observedAt`, but the historical chain is preserved in `EvidenceContract.for(subjectId)`. This means E.V.E. (or any auditor) can replay the full history of a claim: every observation, every re-validation, every status transition.

## 12. No Outbound Network by Default

The engine ships with two adapters in `src/adapters/`: `FixtureAdapter` (defined in `src/adapters/fixtures.ts`) and `CompositeAdapter`. `FixtureAdapter` is entirely offline; it returns deterministic data from an in-memory dataset and performs no network I/O. It is the default adapter used by every CLI command and every example workflow when no other adapter is configured.

`CompositeAdapter` merges results from multiple adapters. It only makes network calls if a non-offline adapter is supplied to it. If every adapter in the composite is offline (e.g. all `FixtureAdapter`s), the composite is offline. The engine never instantiates a networked adapter unless an operator explicitly configures one via the `*_PROVIDER` env vars in `.env.example`; since every `*_PROVIDER` defaults to `none`, the default deployment is offline.

The `NoOpAiAdapter` (in `src/ai/boundary.ts`) is the AI equivalent: a deterministic, offline adapter that returns canned classifications and draft variants. It is the default AI adapter; the engine never calls out to an LLM unless an operator configures `LLM_PROVIDER` to a non-`none` value. Even when an LLM is configured, the `ResilientAiAdapter` wrapper catches all failures and falls through to deterministic behavior, so a misconfigured or unavailable LLM cannot break the engine or leak data through error messages.

This default-off posture is the engine's primary security control. Every other control in this report is defense-in-depth for the case where an operator has explicitly opted into networked operation. With the default configuration, the engine is a pure data-processing library: it ingests fixtures, computes scores, plans campaigns, and writes JSON. No data leaves the process.
