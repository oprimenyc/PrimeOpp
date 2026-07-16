# affiliate-backlink-engine

A reusable, provider-agnostic **backlink intelligence and campaign-planning engine** for SEO authority growth. Built for PantiCandy, vITAL Core / vITAL-Teas, affiliate content properties, and future ecosystem sites.

This is **not** a spam bot, **not** a mass-email cannon, and **not** a black-hat link manipulation system. It discovers, ranks, explains, and operationalizes **legitimate** backlink opportunities using evidence.

## Quick Start

```bash
# Install
npm install

# Run tests
npm test

# Build
npm run build

# Run an end-to-end example
npm run example:panticandy

# CLI
npx tsx src/cli/index.ts --help
npx tsx src/cli/index.ts site import --name "My Site" --domain "mysite.com" \
  --topics "affiliate,review" --pages ./fixtures/generic/site.json --json
```

## What It Does

The engine answers the questions an SEO operator or future PrimeOS/AMOS workflow would ask:

- Which sites are worth pursuing for backlinks?
- Why are they relevant?
- What specific page should we target?
- What asset or content angle gives us a legitimate reason to earn the link?
- Which competitors have links we do not?
- Which broken links can we replace with something genuinely useful?
- Which resource pages are relevant?
- Which existing articles should be refreshed before outreach?
- Which internal links are missing?
- What should we do first for the greatest SEO and commercial impact?

## Pipeline

```
Target site/domain
  -> site/content inventory
  -> topical map
  -> competitor set
  -> backlink opportunity discovery
  -> opportunity normalization
  -> evidence collection
  -> scoring
  -> strategy classification
  -> content-gap/content-refresh requirements
  -> outreach brief
  -> campaign queue
  -> tracking and outcome state
```

## Provider-Agnostic by Design

The engine works **with zero paid APIs**. It ships with:

- `FixtureAdapter` — offline, deterministic dataset adapter (default)
- `CompositeAdapter` — merges results from multiple adapters
- `NoOpAiAdapter` — deterministic AI fallback (no LLM required)
- `ResilientAiAdapter` — wraps any AI adapter and never throws

Concrete adapters for paid providers (Ahrefs, SEMrush, OpenAI, etc.) can be added later by implementing the `SearchDataAdapter` or `AiAdapter` interfaces. See [PROVIDER_ADAPTERS.md](./PROVIDER_ADAPTERS.md).

## Verification Contract

Every actionable claim the engine makes is backed by an `EvidenceRecord` that records:
- what was observed
- where it was observed (source reference)
- when it was observed (timestamp)
- how it was observed (adapter / method)
- verification status at observation time
- sanitized payload (no credentials, no PII without provenance)

Every entity carries a `VerificationStatus`:

| Status | Meaning |
|--------|---------|
| `DISCOVERED` | Found by an adapter, not yet validated. |
| `VERIFIED` | Re-checked against the source within the evidence window. |
| `INFERRED` | Derived by analysis, not directly observed. |
| `STALE` | Previously verified, now past the revalidation window. |
| `UNAVAILABLE` | Source could not be reached (transient). |
| `BLOCKED` | Source refused access (robots, auth, 403, etc.). |

**Inferred data is never presented as verified fact.**

## Modules

| Module | Purpose |
|--------|---------|
| `inventory/` | Site inventory builder (sitemap, CSV, JSON, manual). |
| `discovery/` | Provider-agnostic backlink opportunity discovery. |
| `competitors/` | Competitor backlink gap analysis. |
| `broken-links/` | Broken-link opportunity finder with replacement matching. |
| `resource-pages/` | Resource-page finder with classification. |
| `scoring/` | Transparent scoring engine (14 components). |
| `risk/` | Risk + quality filtering (LOW / MEDIUM / HIGH / REJECT). |
| `content/` | Content-asset matcher + refresh prioritizer. |
| `internal-links/` | Internal link optimizer (orphans, weak, depth). |
| `outreach/` | Outreach personalization + contact discovery. |
| `campaigns/` | Campaign planner + lifecycle tracker. |
| `adapters/` | Provider-agnostic data + AI adapter contracts. |
| `ai/` | AI assistance boundary (classify, draft, explain). |
| `cli/` | Full CLI with all required commands. |

## Examples

Three end-to-end example workflows ship with the engine:

```bash
npm run example:panticandy   # PantiCandy-style affiliate editorial property
npm run example:vital        # vITAL Core-style informational/commerce property
npm run example:generic      # Generic affiliate content site
```

Each example runs the full pipeline (inventory → discovery → gap analysis → broken-link → resource-page → scoring → content match → refresh prioritization → campaign planning → outreach brief) using only fixture data, and prints a JSON summary.

## Tests

```bash
npm test    # 124 tests across 18 files
```

See [TEST_REPORT.md](./TEST_REPORT.md) for the full breakdown.

## Documentation

- [ARCHITECTURE.md](./ARCHITECTURE.md) — System architecture and module boundaries.
- [DOMAIN_MODEL.md](./DOMAIN_MODEL.md) — Canonical domain entities.
- [OPPORTUNITY_SCORING.md](./OPPORTUNITY_SCORING.md) — Transparent scoring model.
- [RISK_FILTERING.md](./RISK_FILTERING.md) — Risk detection and filtering.
- [PROVIDER_ADAPTERS.md](./PROVIDER_ADAPTERS.md) — Adapter contracts and how to add new providers.
- [FREE_LOW_COST_DATA_STRATEGY.md](./FREE_LOW_COST_DATA_STRATEGY.md) — Zero-cost operating mode.
- [CAMPAIGN_LIFECYCLE.md](./CAMPAIGN_LIFECYCLE.md) — Campaign state machine.
- [INTEGRATION_HANDOFF.md](./INTEGRATION_HANDOFF.md) — How this pack plugs into the ecosystem.
- [PRIMEOS_INTEGRATION_CONTRACT.md](./PRIMEOS_INTEGRATION_CONTRACT.md)
- [AMOS_INTEGRATION_CONTRACT.md](./AMOS_INTEGRATION_CONTRACT.md)
- [EVE_VERIFICATION_CONTRACT.md](./EVE_VERIFICATION_CONTRACT.md)
- [SECURITY_REPORT.md](./SECURITY_REPORT.md)
- [TEST_REPORT.md](./TEST_REPORT.md)
- [RUNTIME_PROOF.md](./RUNTIME_PROOF.md)
- [IMPLEMENTATION_REPORT.md](./IMPLEMENTATION_REPORT.md)

## Non-Negotiable Rules

The engine **does not**:

- Buy links or automate deceptive link schemes
- Generate fake testimonials or impersonate real people
- Scrape behind authentication without permission
- Bypass robots/access controls
- Spam arbitrary email addresses
- Automatically send outreach by default
- Fabricate traffic metrics, domain authority, or competitor backlinks
- Claim a backlink exists without evidence
- Hardcode one SEO / search / LLM provider

## License

Internal ecosystem use. Independent audit required before integration into canonical repos.
