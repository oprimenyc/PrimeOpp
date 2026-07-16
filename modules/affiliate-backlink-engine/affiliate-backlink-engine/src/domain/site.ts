/**
 * Site / Target / Content domain entities.
 */
import { VerificationStatus } from "./verification.js";
import { TopicalRelevance, CommercialRelevance } from "./relevance.js";

export type ContentType =
  | "article"
  | "guide"
  | "review"
  | "comparison"
  | "listicle"
  | "calculator"
  | "glossary"
  | "statistics"
  | "dataset"
  | "landing"
  | "category"
  | "product"
  | "about"
  | "contact"
  | "legal"
  | "homepage"
  | "other";

export type CommercialIntent =
  | "transactional"
  | "commercial_investigation"
  | "informational"
  | "navigational"
  | "unknown";

export type IndexabilityState = "indexable" | "noindex" | "blocked_robots" | "canonicalized" | "unknown";

export interface SiteProfile {
  id: string;
  /** Brand / site name. */
  name: string;
  /** Root domain, e.g. "panticandy.com". */
  rootDomain: string;
  /** Optional declared topics. */
  topics: string[];
  /** Optional declared commercial intent. */
  commercialIntent?: CommercialIntent;
  /** Optional preferred schemes for new opportunities. */
  preferredOutreachTone?: "formal" | "friendly" | "concise";
  /** Notes. */
  notes?: string;
  createdAt: number;
}

export interface TargetDomain {
  id: string;
  siteProfileId: string;
  domain: string;
  /** Verification state of the domain itself. */
  verification: VerificationStatus;
  /** Optional provider-supplied metrics (never required, never sole driver). */
  metrics?: {
    /** e.g. Domain Authority-style 0..100. Labeled by source. */
    authority?: { value: number; source: string };
    /** Estimated organic traffic, if known. */
    estimatedTraffic?: { value: number; source: string };
  };
  verifiedAt?: number;
  notes?: string;
}

export interface TargetPage {
  id: string;
  siteProfileId: string;
  url: string;
  /** Normalized canonical URL (same as url if none declared). */
  canonicalUrl: string;
  title?: string;
  contentType: ContentType;
  topic?: string;
  commercialIntent?: CommercialIntent;
  targetKeyword?: string;
  productOrCategory?: string;
  lastModified?: number;
  indexability: IndexabilityState;
  priority: number; // 0..100
  verification: VerificationStatus;
  verifiedAt?: number;
  /** Free-form attributes from import. */
  attributes?: Record<string, string | number | boolean>;
}

export interface ContentAsset {
  id: string;
  siteProfileId: string;
  pageId?: string;
  url: string;
  title?: string;
  contentType: ContentType;
  /** Linkable-asset archetype, if known. */
  archetype?:
    | "original_research"
    | "calculator"
    | "comparison_guide"
    | "glossary"
    | "statistics_page"
    | "definitive_resource"
    | "visual_explainer"
    | "checklist"
    | "public_tool"
    | "useful_dataset"
    | "expert_commentary"
    | "guide"
    | "review"
    | "other";
  /** Optional relevance dimensions. */
  topical?: TopicalRelevance;
  commercial?: CommercialRelevance;
  lastUpdated?: number;
  /** Whether this asset is suitable as a replacement target for broken links. */
  suitableAsReplacement?: boolean;
  attributes?: Record<string, string | number | boolean>;
}

export interface Competitor {
  id: string;
  siteProfileId: string;
  domain: string;
  /** Optional display name. */
  name?: string;
  /** Verification state. */
  verification: VerificationStatus;
  /** Optional relationship to target (e.g. "direct", "aspirational"). */
  relationship?: "direct" | "aspirational" | "adjacent";
  verifiedAt?: number;
  notes?: string;
}
