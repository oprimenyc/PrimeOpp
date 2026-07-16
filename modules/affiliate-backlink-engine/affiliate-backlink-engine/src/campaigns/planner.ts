/**
 * Campaign Planner (Mission 14).
 *
 * Groups opportunities into campaigns.
 * Examples:
 *  - broken-link campaign
 *  - resource-page campaign
 *  - competitor-gap campaign
 *  - linkable-asset campaign
 *  - content-refresh-first campaign
 *  - digital PR / data asset campaign
 *
 * For each campaign: objective, target pages, opportunities, priority,
 * prerequisites, outreach angle, content work required, evidence,
 * success criteria, status.
 */
import { Campaign, CampaignType, CampaignLifecycleState } from "../domain/campaign.js";
import { LinkOpportunity, OpportunityKind } from "../domain/opportunity.js";
import { ephemeralId } from "../domain/ids.js";
import { ContentMatchResult } from "../content/matcher.js";
import { RefreshPriority } from "../content/refresh.js";

export interface CampaignPlanInput {
  siteProfileId: string;
  name: string;
  type: CampaignType;
  opportunities: LinkOpportunity[];
  contentMatches?: ContentMatchResult[];
  refreshPriorities?: RefreshPriority[];
  brandName: string;
  /** Optional override for objective. */
  objective?: string;
  /** Optional override for outreach angle. */
  outreachAngle?: string;
  now?: number;
}

export function planCampaign(input: CampaignPlanInput): Campaign {
  const now = input.now ?? Date.now();
  const opportunityIds = input.opportunities.map((o) => o.id);

  // Determine content work required.
  const contentWork = computeContentWork(input);
  const successCriteria = computeSuccessCriteria(input);
  const prerequisites = computePrerequisites(input);
  const objective = input.objective ?? defaultObjective(input.type, input.brandName);
  const outreachAngle = input.outreachAngle ?? defaultOutreachAngle(input.type);

  // Priority: average of opportunity priorities (or scores if assigned).
  const priorities = input.opportunities.map((o) => o.score?.total ?? 50);
  const avg = priorities.length ? priorities.reduce((a, b) => a + b, 0) / priorities.length : 50;

  const state: CampaignLifecycleState = contentWork.required ? "CONTENT_REQUIRED" : "DISCOVERED";

  const campaign: Campaign = {
    id: ephemeralId("campaign"),
    siteProfileId: input.siteProfileId,
    name: input.name,
    type: input.type,
    objective,
    opportunityIds,
    prospectIds: [],
    contentWork,
    outreachAngle,
    successCriteria,
    prerequisites,
    state,
    priority: Math.round(avg),
    createdAt: now,
    updatedAt: now
  };
  return campaign;
}

export function groupOpportunitiesByKind(opps: LinkOpportunity[]): Map<OpportunityKind, LinkOpportunity[]> {
  const m = new Map<OpportunityKind, LinkOpportunity[]>();
  for (const o of opps) {
    const arr = m.get(o.kind) ?? [];
    arr.push(o);
    m.set(o.kind, arr);
  }
  return m;
}

/**
 * Auto-plan campaigns from a flat list of opportunities.
 * Creates one campaign per opportunity kind, plus a content-refresh-first
 * campaign if refresh priorities suggest it.
 */
export function autoPlanCampaigns(
  siteProfileId: string,
  brandName: string,
  opps: LinkOpportunity[],
  refreshPriorities: RefreshPriority[] = [],
  contentMatches: ContentMatchResult[] = [],
  now: number = Date.now()
): Campaign[] {
  const campaigns: Campaign[] = [];
  const grouped = groupOpportunitiesByKind(opps);
  const kindToType: Record<OpportunityKind, CampaignType> = {
    broken_link: "broken_link",
    resource_page: "resource_page",
    competitor_backlink_gap: "competitor_gap",
    linkable_asset: "linkable_asset",
    unlinked_mention: "digital_pr_data_asset",
    internal_link: "internal_link",
    directory: "resource_page",
    expert_roundup: "digital_pr_data_asset",
    statistics_citation: "digital_pr_data_asset",
    other: "mixed"
  };
  for (const [kind, list] of grouped.entries()) {
    if (list.length === 0) continue;
    campaigns.push(
      planCampaign({
        siteProfileId,
        name: `${kindToType[kind]} campaign (${list.length} opps)`,
        type: kindToType[kind],
        opportunities: list,
        contentMatches,
        refreshPriorities,
        brandName,
        now
      })
    );
  }
  // Content-refresh-first campaign.
  const highPriority = refreshPriorities.filter((r) => r.priority === "HIGH");
  if (highPriority.length > 0) {
    campaigns.push(
      planCampaign({
        siteProfileId,
        name: `Content refresh first (${highPriority.length} pages)`,
        type: "content_refresh_first",
        opportunities: [],
        refreshPriorities: highPriority,
        brandName,
        now
      })
    );
  }
  return campaigns;
}

function computeContentWork(input: CampaignPlanInput): Campaign["contentWork"] {
  const pageIds: string[] = [];
  let description = "No additional content work required.";
  let required = false;

  if (input.type === "content_refresh_first" && input.refreshPriorities) {
    required = true;
    pageIds.push(...input.refreshPriorities.map((r) => r.pageId));
    description = `Refresh ${pageIds.length} page(s) before outreach: ${input.refreshPriorities
      .map((r) => r.recommendedChanges.slice(0, 1).join(""))
      .join("; ")}`;
  } else if (input.contentMatches) {
    const gaps = input.contentMatches.filter((m) => m.matchLevel !== "direct");
    if (gaps.length > 0) {
      required = true;
      for (const g of gaps) {
        if (g.bestTargetPageId) pageIds.push(g.bestTargetPageId);
      }
      description = `${gaps.length} opportunity(ies) require content updates or new assets.`;
    }
  }

  return { description, required, pageIds };
}

function computeSuccessCriteria(input: CampaignPlanInput): string[] {
  const c: string[] = [];
  switch (input.type) {
    case "broken_link":
      c.push("Acquire >= 1 replacement link from a contacted source.");
      c.push("All replacement targets are reachable and topical.");
      break;
    case "resource_page":
      c.push("Acquire >= 1 inclusion on a relevant resource page.");
      break;
    case "competitor_gap":
      c.push("Acquire >= 1 link from a domain that previously linked only to a competitor.");
      break;
    case "linkable_asset":
      c.push("Produce the suggested linkable asset.");
      c.push("Acquire >= 1 citation to the new asset.");
      break;
    case "content_refresh_first":
      c.push("Refresh high-priority pages.");
      c.push("Re-crawl to confirm improved internal connectivity.");
      break;
    case "digital_pr_data_asset":
      c.push("Acquire >= 1 citation to the data asset.");
      break;
    case "internal_link":
      c.push("Implement suggested internal links.");
      c.push("Reduce orphan page count by >= 50%.");
      break;
    case "mixed":
      c.push("Acquire >= 1 verified link.");
      break;
  }
  return c;
}

function computePrerequisites(input: CampaignPlanInput): string[] {
  const p: string[] = [];
  if (input.type === "broken_link") p.push("Re-verify each broken link's HTTP state before outreach.");
  if (input.type === "linkable_asset") p.push("Create the linkable asset before any outreach.");
  if (input.type === "content_refresh_first") p.push("Complete all flagged content refreshes.");
  if (input.type === "competitor_gap") p.push("Confirm competitor backlinks are not paid/exclusive.");
  p.push("Verify contact information via a permitted source.");
  p.push("Honor do-not-contact list.");
  return p;
}

function defaultObjective(type: CampaignType, brand: string): string {
  switch (type) {
    case "broken_link":
      return `Acquire backlinks by replacing broken outbound links with ${brand} resources.`;
    case "resource_page":
      return `Earn inclusions on relevant resource pages for ${brand}.`;
    case "competitor_gap":
      return `Close the backlink gap vs. competitors for ${brand}.`;
    case "linkable_asset":
      return `Build linkable assets that earn citations for ${brand}.`;
    case "content_refresh_first":
      return `Refresh existing ${brand} content to unlock backlink outreach.`;
    case "digital_pr_data_asset":
      return `Promote ${brand} data assets for digital PR citations.`;
    case "internal_link":
      return `Improve ${brand} internal link structure for authority flow.`;
    case "mixed":
      return `Grow ${brand} organic authority via mixed backlink outreach.`;
    default:
      return `Grow ${brand} organic authority.`;
  }
}

function defaultOutreachAngle(type: CampaignType): string {
  switch (type) {
    case "broken_link":
      return "Helpful heads-up about a broken link + suggested replacement.";
    case "resource_page":
      return "Suggest a useful addition to their curated list.";
    case "competitor_gap":
      return "Offer a comparable or more comprehensive resource.";
    case "linkable_asset":
      return "Introduce a genuinely useful new asset.";
    case "content_refresh_first":
      return "Outreach begins after refresh is complete.";
    case "digital_pr_data_asset":
      return "Offer original data with proper citation guidance.";
    case "internal_link":
      return "(Internal; no external outreach.)";
    case "mixed":
      return "Tailored per opportunity.";
    default:
      return "Tailored per opportunity.";
  }
}
