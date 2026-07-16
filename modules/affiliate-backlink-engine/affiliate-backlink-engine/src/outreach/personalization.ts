/**
 * Outreach Personalization Engine (Mission 12).
 *
 * Generates STRUCTURED OUTREACH BRIEFS, not blind spam.
 *
 * Input:
 *  - verified opportunity
 *  - source page context
 *  - target asset
 *  - legitimate value proposition
 *  - contact information if supplied
 *
 * Output:
 *  - outreach reason
 *  - personalized context (clearly marked as observed/inferred/unknown)
 *  - relevant target asset
 *  - evidence references
 *  - suggested subject concepts
 *  - concise draft variants
 *  - follow-up strategy
 *  - do-not-contact/risk flags
 *
 * The engine MUST distinguish:
 *  - factual observations
 *  - inferred personalization
 *  - unknown information
 *
 * Never invent personal details.
 */
import { OutreachBrief, OutreachProspect, ContactCandidate } from "../domain/outreach.js";
import { LinkOpportunity } from "../domain/opportunity.js";
import { TargetPage, ContentAsset } from "../domain/site.js";
import { LinkingPage } from "../domain/backlink.js";
import { EvidenceRecord } from "../domain/evidence.js";
import { deterministicId, ephemeralId } from "../domain/ids.js";
import { AiAdapter } from "../ai/boundary.js";
import { ContentMatchResult } from "../content/matcher.js";

export interface PersonalizationInput {
  siteProfileId: string;
  opportunity: LinkOpportunity;
  sourcePage?: LinkingPage;
  matchedTargetPage?: TargetPage;
  matchedAsset?: ContentAsset;
  contentMatch?: ContentMatchResult;
  contact?: ContactCandidate;
  evidence: EvidenceRecord[];
  ai?: AiAdapter;
  brandName: string;
  now?: number;
}

export interface PersonalizationResult {
  prospect: OutreachProspect;
  brief: OutreachBrief;
}

export async function personalizeOutreach(input: PersonalizationInput): Promise<PersonalizationResult> {
  const now = input.now ?? Date.now();
  const { opportunity, sourcePage, matchedTargetPage, matchedAsset, contact, evidence } = input;

  // 1. Factual observations (only what we actually saw).
  const facts: string[] = [];
  if (sourcePage?.url) facts.push(`Source page URL: ${sourcePage.url}`);
  if (sourcePage?.title) facts.push(`Source page title: "${sourcePage.title}"`);
  if (opportunity.kind === "broken_link") {
    facts.push(`Broken destination: ${opportunity.brokenDestinationUrl} (HTTP ${opportunity.httpState ?? "?"})`);
    if (opportunity.anchorText) facts.push(`Original anchor text: "${opportunity.anchorText}"`);
  }
  if (opportunity.kind === "unlinked_mention" && opportunity.snippet) {
    facts.push(`Mention snippet: "${opportunity.snippet}"`);
  }
  if (opportunity.kind === "competitor_backlink_gap") {
    facts.push(`${opportunity.competitorOverlap} competitor(s) link from this source.`);
  }
  if (matchedTargetPage) facts.push(`Matched target page: ${matchedTargetPage.url}`);

  // 2. Inferred personalization (clearly labeled).
  const inferences: string[] = [];
  if (contact?.name) inferences.push(`Likely contact name (observed): ${contact.name}`);
  if (contact?.role) inferences.push(`Likely contact role (observed): ${contact.role}`);
  if (sourcePage?.topical?.similarity !== undefined) {
    inferences.push(`Topical similarity to target: ${Math.round(sourcePage.topical.similarity * 100)}% (inferred).`);
  }

  // 3. Unknowns.
  const unknowns: string[] = [];
  if (!contact?.email && !contact?.contactFormUrl) unknowns.push("Contact email or form URL is unknown.");
  if (!contact?.name) unknowns.push("Contact name is unknown.");

  // 4. Outreach reason (factual).
  const outreachReason = composeOutreachReason(opportunity, input.brandName);

  // 5. Personalized context.
  const personalizedContext = {
    value: composePersonalizedContext(opportunity, sourcePage, input.brandName, contact),
    basis: (contact?.name || contact?.role ? "observed" : "inferred") as "observed" | "inferred" | "unknown"
  };

  // 6. Target asset.
  const targetAsset = {
    pageId: matchedTargetPage?.id ?? matchedAsset?.id,
    url: matchedTargetPage?.url ?? matchedAsset?.url,
    title: matchedTargetPage?.title ?? matchedAsset?.title,
    rationale: input.contentMatch?.linkingRationale ?? "Target asset offers value to the source page's audience."
  };

  // 7. Suggested subject concepts (deterministic by default; AI may refine).
  let suggestedSubjectConcepts = composeSubjectConcepts(opportunity, input.brandName);
  let draftVariants: OutreachBrief["draftVariants"] = [];
  if (input.ai?.draft) {
    try {
      const draft = await input.ai.draft({
        task: "outreach_subject",
        context: {
          brandName: input.brandName,
          sourceUrl: sourcePage?.url,
          sourceTopic: sourcePage?.topical?.topic,
          targetAssetUrl: targetAsset.url,
          targetAssetTitle: targetAsset.title,
          opportunityKind: opportunity.kind,
          topic: opportunity.topical?.topic
        },
        constraints: { variants: 3 }
      });
      suggestedSubjectConcepts = draft.variants.map((v) => v.body);
    } catch {
      // fall through to deterministic
    }
    try {
      const bodyDraft = await input.ai.draft({
        task: "outreach_body",
        context: {
          brandName: input.brandName,
          sourceUrl: sourcePage?.url,
          targetAssetUrl: targetAsset.url,
          targetAssetTitle: targetAsset.title,
          topic: opportunity.topical?.topic
        },
        constraints: { variants: 2, tone: "friendly" }
      });
      draftVariants = bodyDraft.variants;
    } catch {
      // fall through to deterministic
    }
  }
  if (draftVariants.length === 0) {
    draftVariants = composeDeterministicDrafts(opportunity, input.brandName, targetAsset, sourcePage);
  }

  // 8. Follow-up strategy.
  const followUpStrategy = "Send a single polite follow-up after 5 business days. Do not contact more than twice. Honor any opt-out immediately.";

  // 9. DNC + risk.
  const doNotContact = contact?.doNotContact ?? false;
  const riskFlags = [...(contact?.riskFlags ?? []), ...opportunity.riskFlags];

  const brief: OutreachBrief = {
    outreachReason,
    personalizedContext,
    targetAsset,
    evidenceIds: opportunity.evidenceIds,
    suggestedSubjectConcepts,
    draftVariants,
    followUpStrategy,
    doNotContact,
    riskFlags,
    factInferenceUnknown: { facts, inferences, unknowns }
  };

  const personalizationConfidence = computePersonalizationConfidence(facts, inferences, unknowns, contact);

  const prospect: OutreachProspect = {
    id: ephemeralId("prospect"),
    siteProfileId: input.siteProfileId,
    opportunityId: opportunity.id,
    contactId: contact?.id,
    verification: opportunity.verification,
    personalizationConfidence,
    riskFlags,
    brief,
    createdAt: now
  };

  return { prospect, brief };
}

function composeOutreachReason(opp: LinkOpportunity, brand: string): string {
  switch (opp.kind) {
    case "broken_link":
      return `A link on this page is broken (${opp.brokenDestinationUrl}). ${brand} has a relevant replacement resource.`;
    case "resource_page":
      return `This page curates resources on a topic ${brand} covers; we may have a useful addition.`;
    case "unlinked_mention":
      return `${brand} is mentioned on this page without a link. We're asking the author to add a citation.`;
    case "competitor_backlink_gap":
      return `This source links to a competitor. ${brand} has a comparable (or more comprehensive) resource.`;
    case "linkable_asset":
      return `We've identified a linkable asset gap that ${brand} could fill.`;
    case "internal_link":
      return `Internal linking opportunity (not for external outreach).`;
  }
}

function composePersonalizedContext(
  opp: LinkOpportunity,
  sourcePage: LinkingPage | undefined,
  brand: string,
  contact: ContactCandidate | undefined
): string {
  const bits: string[] = [];
  if (sourcePage?.title) bits.push(`I was reading "${sourcePage.title}"`);
  else if (sourcePage?.url) bits.push(`I was reading ${sourcePage.url}`);
  if (opp.kind === "broken_link") bits.push(`and noticed a broken link to ${opp.brokenDestinationUrl}`);
  if (opp.kind === "unlinked_mention") bits.push(`and noticed you mentioned ${brand}`);
  if (contact?.name) bits.push(`Hi ${contact.name}`);
  return bits.join(", ") + ".";
}

function composeSubjectConcepts(opp: LinkOpportunity, brand: string): string[] {
  const base: string[] = [];
  switch (opp.kind) {
    case "broken_link":
      base.push("Broken link on your page", `Resource suggestion for your readers`, `${brand} resource you may find useful`);
      break;
    case "resource_page":
      base.push("Resource suggestion", `Possible addition to your resource list`, `${brand} resource`);
      break;
    case "unlinked_mention":
      base.push(`Thanks for mentioning ${brand}`, `Quick note about your recent mention of ${brand}`);
      break;
    case "competitor_backlink_gap":
      base.push("Alternative resource for your readers", `${brand} comparison resource`);
      break;
    default:
      base.push("Resource suggestion");
  }
  return base;
}

function composeDeterministicDrafts(
  opp: LinkOpportunity,
  brand: string,
  targetAsset: { url?: string; title?: string },
  sourcePage: LinkingPage | undefined
): OutreachBrief["draftVariants"] {
  const reason = composeOutreachReason(opp, brand);
  const intro = sourcePage?.title ? `I was reading "${sourcePage.title}"` : `I came across your page`;
  const assetLine = targetAsset.url ? `We have a resource at ${targetAsset.url}${targetAsset.title ? ` ("${targetAsset.title}")` : ""} that might be a useful addition.` : `We have a resource that might be a useful addition.`;
  const body1 = `Hi,\n\n${intro}. ${reason} ${assetLine}\n\nThanks for considering.\n\nBest,\n${brand}`;
  const body2 = `Hello,\n\n${reason}\n\n${assetLine}\n\nLet me know if you'd like more detail.\n\nRegards,\n${brand}`;
  return [
    { label: "variant_1_formal", body: body1 },
    { label: "variant_2_concise", body: body2 }
  ];
}

function computePersonalizationConfidence(
  facts: string[],
  inferences: string[],
  unknowns: string[],
  contact: ContactCandidate | undefined
): number {
  let conf = 0.3;
  if (facts.length >= 2) conf += 0.2;
  if (contact?.email || contact?.contactFormUrl) conf += 0.2;
  if (contact?.name) conf += 0.1;
  if (inferences.length === 0 && unknowns.length > 2) conf -= 0.1;
  return Math.max(0, Math.min(1, conf));
}
