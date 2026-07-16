/**
 * Risk and Quality Filtering (Mission 8).
 *
 * Detects and flags:
 *  - link farms
 *  - excessive outbound-link pages
 *  - irrelevant domains
 *  - suspicious directory networks
 *  - thin content
 *  - adult/gambling/illegal-content mismatch
 *  - obvious paid-link solicitations where evidence exists
 *  - duplicate domains
 *  - duplicate opportunities
 *  - stale opportunities
 *  - unreachable pages
 *  - non-editorial sources
 *
 * Risk outputs: LOW | MEDIUM | HIGH | REJECT
 * The engine MUST NOT overclaim certainty.
 */
import { LinkOpportunity } from "../domain/opportunity.js";
import { RiskFlag, RiskLevel, RiskSignalKind } from "../domain/risk.js";
import { LinkingDomain, LinkingPage } from "../domain/backlink.js";
import { shouldRevalidate } from "../domain/verification.js";
import { normalizeUrl } from "../utils/url.js";

export interface RiskContext {
  targetTopics: string[];
  now?: number;
}

export function assessDomainRisk(ld: LinkingDomain, ctx: RiskContext): RiskFlag[] {
  const flags: RiskFlag[] = [];
  const domain = ld.domain.toLowerCase();
  // Link-farm heuristics (very conservative; we never claim certainty).
  if (/(links|seo|backlinks|submit|directory)-?farm/.test(domain)) {
    flags.push({
      kind: "link_farm",
      level: "HIGH",
      reason: `Domain name "${domain}" matches known link-farm naming patterns.`,
      confidence: 0.4
    });
  }
  // PBN suspicion (very low confidence).
  if (/\d+$/.test(domain) || /pbn/.test(domain)) {
    flags.push({
      kind: "pbn_suspicion",
      level: "MEDIUM",
      reason: "Domain name has patterns sometimes associated with PBNs.",
      confidence: 0.2
    });
  }
  // Spam score from provider, if supplied.
  if (ld.metrics?.spamScore && ld.metrics.spamScore.value > 50) {
    flags.push({
      kind: "spam_pattern",
      level: ld.metrics.spamScore.value > 80 ? "REJECT" : "HIGH",
      reason: `Provider spam score: ${ld.metrics.spamScore.value}/100 (source: ${ld.metrics.spamScore.source}).`,
      confidence: 0.7
    });
  }
  // Adult/gambling mismatch (target topics don't include these).
  const adultGambling = /(porn|xxx|casino|gambl|betting|weed|escort)/;
  if (adultGambling.test(domain) && !ctx.targetTopics.some((t) => adultGambling.test(t.toLowerCase()))) {
    flags.push({
      kind: "adult_gambling_illegal_mismatch",
      level: "REJECT",
      reason: "Domain appears to be adult/gambling/illegal-content; mismatch with target topics.",
      confidence: 0.6
    });
  }
  return flags;
}

export function assessPageRisk(lp: LinkingPage, ctx: RiskContext): RiskFlag[] {
  const flags: RiskFlag[] = [];
  // Excessive outbound links.
  if (lp.outboundLinkCount !== undefined && lp.outboundLinkCount > 100) {
    flags.push({
      kind: "excessive_outbound_links",
      level: lp.outboundLinkCount > 200 ? "REJECT" : "HIGH",
      reason: `Page has ${lp.outboundLinkCount} outbound links.`,
      confidence: 0.7
    });
  }
  // Thin content (very short title + no topic).
  if ((lp.title?.trim().length ?? 0) < 3) {
    flags.push({
      kind: "thin_content",
      level: "LOW",
      reason: "Page title is suspiciously short.",
      confidence: 0.3
    });
  }
  // Stale.
  if (lp.verification === "STALE" || (lp.verifiedAt && shouldRevalidate(lp.verifiedAt, ctx.now ?? Date.now()))) {
    flags.push({
      kind: "stale_opportunity",
      level: "LOW",
      reason: "Page data is past revalidation window.",
      confidence: 0.8
    });
  }
  // Unreachable.
  if (lp.verification === "UNAVAILABLE" || lp.verification === "BLOCKED") {
    flags.push({
      kind: "unreachable_page",
      level: "MEDIUM",
      reason: `Page verification status: ${lp.verification}.`,
      confidence: 0.8
    });
  }
  // Irrelevant domain.
  if (lp.topical && lp.topical.similarity < 0.05) {
    flags.push({
      kind: "irrelevant_domain",
      level: "MEDIUM",
      reason: `Topical similarity ${Math.round(lp.topical.similarity * 100)}% is very low.`,
      confidence: 0.5
    });
  }
  return flags;
}

export function assessOpportunityRisk(opp: LinkOpportunity, ctx: RiskContext): RiskFlag[] {
  const flags: RiskFlag[] = [];
  // Duplicate opportunity is detected at dedup stage; if it slipped through,
  // flag it here based on opportunity duplication signals.
  if (opp.kind === "competitor_backlink_gap" && opp.competitorOverlap === 1) {
    flags.push({
      kind: "non_editorial_source",
      level: "LOW",
      reason: "Only one competitor links here; may be an exclusive or paid relationship.",
      confidence: 0.3
    });
  }
  // Stale opportunity.
  if (opp.verification === "STALE") {
    flags.push({
      kind: "stale_opportunity",
      level: "MEDIUM",
      reason: "Opportunity is past revalidation window.",
      confidence: 0.8
    });
  }
  // Unreachable.
  if (opp.verification === "UNAVAILABLE" || opp.verification === "BLOCKED") {
    flags.push({
      kind: "unreachable_page",
      level: "HIGH",
      reason: `Opportunity verification status: ${opp.verification}.`,
      confidence: 0.8
    });
  }
  // Existing flags carried forward.
  for (const f of opp.riskFlags) flags.push(f);
  return flags;
}

export function detectDuplicateDomains(opps: LinkOpportunity[]): RiskFlag[] {
  const flags: RiskFlag[] = [];
  const seen = new Map<string, number>();
  for (const o of opps) {
    if (o.linkingDomainId) {
      seen.set(o.linkingDomainId, (seen.get(o.linkingDomainId) ?? 0) + 1);
    }
  }
  for (const [domId, count] of seen.entries()) {
    if (count > 5) {
      flags.push({
        kind: "duplicate_domain",
        level: "LOW",
        reason: `Domain ${domId} appears ${count} times across opportunities; may indicate a directory-style source.`,
        confidence: 0.5
      });
    }
  }
  return flags;
}

export function detectDuplicateOpportunities(opps: LinkOpportunity[]): RiskFlag[] {
  const flags: RiskFlag[] = [];
  const byKey = new Map<string, number>();
  for (const o of opps) {
    byKey.set(o.dedupKey, (byKey.get(o.dedupKey) ?? 0) + 1);
  }
  for (const [key, count] of byKey.entries()) {
    if (count > 1) {
      flags.push({
        kind: "duplicate_opportunity",
        level: "LOW",
        reason: `Opportunity dedupKey ${key} appears ${count} times; should be deduplicated.`,
        confidence: 1.0
      });
    }
  }
  return flags;
}

export function applyRiskToOpportunity(
  opp: LinkOpportunity,
  domainFlags: RiskFlag[],
  pageFlags: RiskFlag[]
): LinkOpportunity {
  const all = [...opp.riskFlags, ...domainFlags, ...pageFlags];
  return { ...opp, riskFlags: dedupFlags(all) };
}

export function dedupFlags(flags: RiskFlag[]): RiskFlag[] {
  const seen = new Set<string>();
  const out: RiskFlag[] = [];
  for (const f of flags) {
    const k = `${f.kind}|${f.level}|${f.reason}`;
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(f);
  }
  return out;
}

export function categorize(flags: RiskFlag[]): RiskLevel {
  let worst: RiskLevel = "LOW";
  for (const f of flags) {
    if (rankLevel(f.level) > rankLevel(worst)) worst = f.level;
  }
  return worst;
}

function rankLevel(l: RiskLevel): number {
  return { LOW: 0, MEDIUM: 1, HIGH: 2, REJECT: 3 }[l];
}
