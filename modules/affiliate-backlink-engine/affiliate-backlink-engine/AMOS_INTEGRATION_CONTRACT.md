# AMOS Integration Contract

This document specifies the integration contract between the `affiliate-backlink-engine` (hereafter "the engine") and AMOS, the asset- and content-producing operator layer. AMOS consumes structured opportunity analysis produced by the engine and returns refreshed content, new linkable assets, and finalized outreach copy. The contract is deliberately scoped: AMOS does not perform opportunity discovery, scoring, or risk assessment, and the engine does not write content. Each side owns its domain and exchanges data through documented TypeScript interfaces.

All interfaces referenced in this contract are exported from the engine's public barrel at `src/index.ts`. AMOS imports these types directly when running in-process, or reconstructs equivalent shapes from JSON when running as a separate service. Both modes are supported because the engine serializes every relevant structure to plain JSON via its standard serializers (no class instances cross the boundary).

## 1. Role of AMOS

AMOS is responsible for producing the supporting content and linkable assets that the engine's recommendations depend on, and for finalizing outreach copy from the briefs the engine produces. Concretely, AMOS takes a `ContentMatchResult` (which says "this opportunity needs refreshed content" or "this opportunity needs a new asset of archetype X") and a `OutreachBrief` (which says "here are the facts, inferences, unknowns, and draft variants"), then returns finished artifacts that the engine can attach to a campaign and that PrimeOS can approve for outreach.

The engine does not generate prose content. The deterministic drafts in `composeDeterministicDrafts` (in `src/outreach/personalization.ts`) are scaffolds intended for AMOS refinement, not final outreach copy. AMOS is expected to rewrite them into natural, brand-consistent language before PrimeOS approves any `OUTREACH_APPROVED` transition. The engine's AI boundary (`src/ai/boundary.ts`) is available as an optional draft-assist, but it is non-authoritative: when an `AiAdapter` is supplied, the engine will attempt `outreach_subject` and `outreach_body` draft tasks and fall through to deterministic variants on any failure.

## 2. Inputs AMOS Receives

AMOS receives two primary structured inputs from the engine. Each is documented in code with a TypeScript interface so that AMOS can consume them without parsing prose.

### 2.1 ContentMatchResult

Defined in `src/content/matcher.ts`:

```ts
interface ContentMatchResult {
  opportunityId: string;
  bestTargetPageId?: string;
  bestTargetUrl?: string;
  matchLevel: "direct" | "partial" | "none";
  contentGaps: string[];
  suggestedUpdate?: string;
  suggestedNewAsset?: {
    archetype: ContentAsset["archetype"];
    topic: string;
    rationale: string;
  };
  linkingRationale: string;
  confidence: number;
}
```

`matchLevel` is the key field AMOS consumes. `direct` means an existing page is suitable (no content work required); `partial` means an existing page needs expansion or refresh; `none` means a new asset must be produced (in which case `suggestedNewAsset` is populated with the recommended `archetype`, `topic`, and `rationale`). `contentGaps` is an array of short strings describing specific missing coverage (e.g. "Missing original data point", "Missing subtopic coverage", "No matching existing content"). `linkingRationale` is a human-readable explanation of why a third-party editor would plausibly link to the suggested asset.

### 2.2 OutreachBrief

Defined in `src/domain/outreach.ts` and produced by `personalizeOutreach` in `src/outreach/personalization.ts`:

```ts
interface OutreachBrief {
  outreachReason: string;
  personalizedContext: { value: string; basis: "observed" | "inferred" | "unknown" };
  targetAsset: { pageId?: string; url?: string; title?: string; rationale: string };
  evidenceIds: string[];
  suggestedSubjectConcepts: string[];
  draftVariants: Array<{ label: string; body: string }>;
  followUpStrategy: string;
  doNotContact: boolean;
  riskFlags: RiskFlag[];
  factInferenceUnknown: { facts: string[]; inferences: string[]; unknowns: string[] };
}
```

The `factInferenceUnknown` split (Section 4) is the most important field for AMOS. `suggestedSubjectConcepts` and `draftVariants` are scaffolds AMOS may rewrite; `followUpStrategy` is a deterministic string AMOS should respect (it currently reads "Send a single polite follow-up after 5 business days. Do not contact more than twice. Honor any opt-out immediately.").

## 3. Outputs AMOS Produces

AMOS produces three categories of artifacts that flow back into the engine's campaign and evidence stores.

| Output | Engine consumer | Notes |
|--------|-----------------|-------|
| Refreshed content | `ContentAsset` / `TargetPage` (updated) | Re-supplied via `supplyManualContact`-style ingest or directly into the site inventory; AMOS marks the page as ready |
| New linkable assets | `ContentAsset` (new) | Added to the site inventory; archetype must be one of the 14 in Section 6 |
| Finalized outreach copy | Supplied to PrimeOS for approval | Engine does not consume finalized copy directly; PrimeOS attaches it to the campaign as a `CampaignAction` of kind `outreach_sent` after `OUTREACH_APPROVED` |

The engine's `Campaign.contentWork` field tracks whether content work is required before outreach. `planCampaign` sets `contentWork.required = true` when any opportunity has `matchLevel !== "direct"`. Once AMOS completes the refresh or asset creation, PrimeOS calls `tracker.transition(campaignId, "READY_FOR_OUTREACH")` to advance past `CONTENT_REQUIRED`. The engine does not validate the content itself; it trusts PrimeOS to confirm AMOS's work is complete.

## 4. Fact vs Inference Boundary

The `OutreachBrief.factInferenceUnknown` field is a hard contract boundary. AMOS MUST respect the three-way split:

- **Facts** (`facts: string[]`): observed data, sourced from `EvidenceRecord`s and the opportunity record. Examples include the source page URL, the source page title, the broken destination URL and its HTTP state, the matched target page URL, the mention snippet, and the competitor overlap count. These may be used in outreach copy verbatim.
- **Inferences** (`inferences: string[]`): best-guess derived values, clearly labeled. Examples include "Likely contact name (observed)" when a name was found, "Likely contact role (observed)" when a role was found, and topical similarity percentages. AMOS may use these in copy but must not present them as facts.
- **Unknowns** (`unknowns: string[]`): gaps in the engine's knowledge. Examples include "Contact email or form URL is unknown" and "Contact name is unknown." AMOS may fill these only with verified information sourced through legitimate channels (a CRM export, a public author profile, a manual operator input via `supplyManualContact`). AMOS MUST NOT fabricate plausible-sounding values to fill unknowns.

This split exists because the engine is explicitly designed to avoid inventing personal details (see the header comment in `src/outreach/personalization.ts`: "Never invent personal details."). AMOS inherits this constraint when refining drafts. Any AMOS-produced copy that asserts something not present in `facts` and not in AMOS's own verified inputs is a contract violation.

The `personalizedContext.basis` field provides a coarse summary of the overall brief's grounding: `"observed"` if a contact name or role was found, `"inferred"` otherwise, and `"unknown"` as a future-proof fallback. AMOS may use this to decide whether to include a personalized greeting.

## 5. API Surface

The engine functions AMOS consumes are listed below.

| Function | Signature | Source |
|----------|-----------|--------|
| `matchContentForOpportunity` | `(opp: LinkOpportunity, pages: TargetPage[], assets: ContentAsset[]) => ContentMatchResult` | `src/content/matcher.ts` |
| `personalizeOutreach` | `(input: PersonalizationInput) => Promise<PersonalizationResult>` | `src/outreach/personalization.ts` |
| `supplyManualContact` | `(ref, partial, opts: ContactDiscoveryOptions) => ContactCandidate` | `src/outreach/contact.ts` |
| `LINKABLE_ASSET_ARCHETYPES` | `ContentAsset["archetype"][]` | `src/content/matcher.ts` |

`matchContentForOpportunity` is deterministic. It computes token overlap between the opportunity's composed topic and each target page's title/topic/keyword/product fields, plus overlap with each existing `ContentAsset`. The match levels are scored at thresholds 0.4 (direct) and 0.2 (partial); below 0.2 the matcher suggests a new asset. AMOS does not influence these thresholds; AMOS consumes the resulting `ContentMatchResult` and produces the artifact the result asks for.

`personalizeOutreach` is async because it may invoke an optional `AiAdapter` for subject and body drafts. AMOS should treat the AI-assisted drafts as raw material: they are not authoritative, they may be empty (the engine falls back to deterministic drafts on any AI failure), and they do not override the `factInferenceUnknown` boundary. The deterministic drafts (`variant_1_formal`, `variant_2_concise`) are always populated as a baseline.

`supplyManualContact` is the sanctioned way for AMOS (or an operator) to inject a contact discovered outside the adapter pipeline (e.g. from a CRM export). It records a `contact_observation` EvidenceRecord with `source.adapter = "manual"` and `source.providerKind = "manual"`, applies the do-not-contact list, and returns a `ContactCandidate` with `provenance: "manual"`. AMOS must use this entry point rather than constructing `ContactCandidate` objects directly, so the evidence trail is preserved.

## 6. Asset Archetypes

The engine recognizes exactly 14 linkable-asset archetypes, enumerated in `LINKABLE_ASSET_ARCHETYPES` (`src/content/matcher.ts`) and mirrored in the `ContentAsset.archetype` type (`src/domain/site.ts`). AMOS may produce assets of any of these archetypes. Any asset AMOS returns to the engine must declare one of these values; an unrecognized archetype will be rejected by the type system at compile time and by downstream serializers at runtime.

| Archetype | Typical use |
|-----------|-------------|
| `original_research` | Survey, study, or experiment with sourced methodology |
| `calculator` | Interactive tool computing a useful value for the audience |
| `comparison_guide` | Side-by-side comparison of options |
| `glossary` | Term definitions for an industry vertical |
| `statistics_page` | Curated, sourced statistics on a topic |
| `definitive_resource` | Comprehensive evergreen guide |
| `visual_explainer` | Diagram, infographic, or interactive visual |
| `checklist` | Actionable checklist the audience can apply |
| `public_tool` | Free-standing utility (e.g. URL inspector, schema generator) |
| `useful_dataset` | downloadable or queryable dataset with provenance |
| `expert_commentary` | Curated expert quotes or analysis |
| `guide` | Step-by-step tutorial |
| `review` | In-depth product or service review |
| `other` | Fallback; AMOS should provide a clear `rationale` |

The matcher's `suggestAsset` helper (`src/content/matcher.ts`) selects archetypes by opportunity kind: `linkable_asset` opportunities use the opportunity's `suggestedArchetype`; `broken_link` opportunities default to `definitive_resource`; `resource_page` opportunities default to `statistics_page`. AMOS may override these suggestions, but should record the override reason in the asset's `rationale` field so the change is auditable.

## 7. No Fabrication Rule

AMOS MUST NOT generate fake research, fabricated statistics, invented testimonials, or impersonated quotes. The engine's README states this as a non-negotiable rule ("Generate fake testimonials or impersonate real people" is in the explicit "does not" list), and the `ContentMatchResult.suggestedNewAsset` is explicitly a scaffold, not a finished product. The `rationale` field on a suggested asset describes the editorial intent; it does not constitute content.

Concretely, this means:

- **Original research** assets must contain a documented methodology and raw data AMOS can supply on request. The engine does not generate the methodology; AMOS owns it.
- **Statistics pages** must cite each statistic to a verifiable primary or secondary source. The matcher suggests a `statistics_page` archetype for `resource_page` opportunities specifically because resource pages favor citable statistics; if AMOS cannot source the data, AMOS must downgrade the asset to a different archetype or decline to produce it.
- **Expert commentary** must quote real, named individuals with their consent or with publicly attributable statements. Inventing quotes is a contract violation.
- **Useful datasets** must have documented provenance per row. Synthetic data is acceptable only when clearly labeled as such in the asset itself.

If AMOS cannot produce a suggested asset without fabrication, AMOS should report the gap back to PrimeOS so the campaign can be moved to `DECLINED` or `STALE` rather than proceed with fabricated content. The engine's evidence contract (see `EVE_VERIFICATION_CONTRACT.md`) requires that any claim of asset production be backed by an `EvidenceRecord`; fabricated assets would fail this audit.
