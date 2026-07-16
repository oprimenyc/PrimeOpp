/**
 * Backlink / linking-page / linking-domain entities.
 */
import { VerificationStatus } from "./verification.js";
import { TopicalRelevance } from "./relevance.js";

export interface LinkingDomain {
  id: string;
  domain: string;
  /** Verification state. */
  verification: VerificationStatus;
  /** Optional provider-supplied metrics (always labeled, never required). */
  metrics?: {
    authority?: { value: number; source: string };
    estimatedTraffic?: { value: number; source: string };
    spamScore?: { value: number; source: string };
  };
  verifiedAt?: number;
  /** Optional topical relevance to target. */
  topical?: TopicalRelevance;
  /** Risk flags at the domain level. */
  riskFlags?: import("./risk.js").RiskFlag[];
}

export interface LinkingPage {
  id: string;
  linkingDomainId: string;
  url: string;
  title?: string;
  /** Estimated number of outbound links on the page (if known). */
  outboundLinkCount?: number;
  /** Whether the page is indexed (if known). */
  indexed?: boolean;
  /** Last-modified if known. */
  lastModified?: number;
  verification: VerificationStatus;
  verifiedAt?: number;
  /** Topical relevance to target. */
  topical?: TopicalRelevance;
  /** Risk flags at the page level. */
  riskFlags?: import("./risk.js").RiskFlag[];
}

export interface BacklinkSource {
  id: string;
  linkingDomainId: string;
  linkingPageId: string;
  /** Target page on our property that this backlink would point to. */
  targetPageId?: string;
  /** Anchor text observed (if any). */
  anchorText?: string;
  /** Context around the link, sanitized. */
  context?: string;
  /** Whether this is currently a live backlink to our property. */
  isLive?: boolean;
  /** rel attribute if known. */
  rel?: string;
  /** First observed. */
  firstObservedAt?: number;
  /** Last verified. */
  lastVerifiedAt?: number;
  verification: VerificationStatus;
}
