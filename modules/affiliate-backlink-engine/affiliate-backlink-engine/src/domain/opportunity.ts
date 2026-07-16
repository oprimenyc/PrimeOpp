/**
 * Opportunity entities.
 *
 * Opportunities are the unit of work in the engine. Each one MUST:
 *  - carry evidence references
 *  - carry a verification status
 *  - be deduplicable by a deterministic key
 *  - carry enough context for scoring + outreach
 */
import { VerificationStatus } from "./verification.js";
import { TopicalRelevance, CommercialRelevance, AudienceAlignment } from "./relevance.js";
import { OpportunityScore } from "./scoring.js";
import { RiskFlag } from "./risk.js";

export type OpportunityKind =
  | "competitor_backlink_gap"
  | "broken_link"
  | "resource_page"
  | "unlinked_mention"
  | "linkable_asset"
  | "directory"
  | "expert_roundup"
  | "statistics_citation"
  | "internal_link"
  | "other";

export interface BaseOpportunity {
  id: string;
  siteProfileId: string;
  kind: OpportunityKind;
  /** Deterministic deduplication key. */
  dedupKey: string;
  /** Verification status. */
  verification: VerificationStatus;
  verifiedAt?: number;
  /** Evidence record ids backing this opportunity. */
  evidenceIds: string[];
  /** Linking domain id (or target domain for internal). */
  linkingDomainId?: string;
  /** Linking page id. */
  linkingPageId?: string;
  /** Target page id on our property. */
  targetPageId?: string;
  /** Topical relevance. */
  topical?: TopicalRelevance;
  /** Commercial relevance. */
  commercial?: CommercialRelevance;
  /** Audience alignment. */
  audience?: AudienceAlignment;
  /** Risk flags. */
  riskFlags: RiskFlag[];
  /** Score (assigned by scoring engine). */
  score?: OpportunityScore;
  /** Free-form notes. */
  notes?: string;
  /** Discovery timestamp. */
  discoveredAt: number;
}

export interface CompetitorGapOpportunity extends BaseOpportunity {
  kind: "competitor_backlink_gap";
  /** Competitors that have a link from this domain/page. */
  competitorIds: string[];
  /** Number of competitors linking from this source. */
  competitorOverlap: number;
  /** Whether we judge this replicable (with reason). */
  replicable: { value: boolean; reason: string; confidence: number };
}

export interface BrokenLinkOpportunity extends BaseOpportunity {
  kind: "broken_link";
  /** The broken destination URL. */
  brokenDestinationUrl: string;
  /** HTTP state when verified. */
  httpState?: number;
  /** Anchor/context of the broken link. */
  anchorText?: string;
  /** Candidate replacement asset on our property (pageId or assetId). */
  candidateReplacementPageId?: string;
  /** Whether existing target content is suitable. */
  existingContentSuitable: boolean;
  /** Whether new/updated content is required. */
  contentUpdateRequired: boolean;
}

export interface ResourcePageOpportunity extends BaseOpportunity {
  kind: "resource_page";
  /** Resource-page classification. */
  classification:
    | "industry_resource"
    | "educational_resource"
    | "product_guide"
    | "nonprofit_resource"
    | "directory"
    | "expert_resource"
    | "statistics_reference"
    | "niche_community_resource";
  /** Whether the page appears to accept submissions (inferred, not assumed). */
  acceptsSubmissionsInferred: boolean;
}

export interface MentionWithoutLinkOpportunity extends BaseOpportunity {
  kind: "unlinked_mention";
  /** Where the mention was found. */
  mentionUrl: string;
  /** Snippet containing the mention, sanitized. */
  snippet?: string;
}

export interface LinkableAssetOpportunity extends BaseOpportunity {
  kind: "linkable_asset";
  /** Suggested asset archetype. */
  suggestedArchetype: import("./site.js").ContentAsset["archetype"];
  /** Reason this asset would be linkable. */
  rationale: string;
}

export interface InternalLinkOpportunity extends BaseOpportunity {
  kind: "internal_link";
  /** Source page on our property. */
  sourcePageId: string;
  /** Target page on our property. */
  internalTargetPageId: string;
  /** Suggested anchor concept. */
  suggestedAnchor?: string;
  /** Contextual reason. */
  contextualReason: string;
  priority: number;
}

export type LinkOpportunity =
  | CompetitorGapOpportunity
  | BrokenLinkOpportunity
  | ResourcePageOpportunity
  | MentionWithoutLinkOpportunity
  | LinkableAssetOpportunity
  | InternalLinkOpportunity;

export function dedupKeyFor(
  kind: OpportunityKind,
  parts: Array<string | number | undefined>
): string {
  return [kind, ...parts.map((p) => String(p ?? ""))].join("::");
}
