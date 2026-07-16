#!/usr/bin/env node
/**
 * Backlink Engine CLI (Mission 19).
 *
 * Commands:
 *  backlink-engine site import
 *  backlink-engine site analyze
 *  backlink-engine competitors import
 *  backlink-engine opportunities discover
 *  backlink-engine opportunities score
 *  backlink-engine opportunities list
 *  backlink-engine broken-links analyze
 *  backlink-engine resource-pages analyze
 *  backlink-engine internal-links analyze
 *  backlink-engine content refresh-priorities
 *  backlink-engine campaign create
 *  backlink-engine campaign list
 *  backlink-engine campaign export
 *  backlink-engine evidence verify
 *
 * Supports JSON output, human-readable output, and local fixture mode.
 */
import { Command } from "commander";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  SiteInventoryBuilder,
  makeSiteProfile,
  makeTargetDomain,
  SiteInventory
} from "../inventory/site-inventory.js";
import {
  InMemoryEvidenceStore,
  EvidenceRecord,
  canonicalPayloadHash
} from "../domain/evidence.js";
import { FixtureAdapter } from "../adapters/fixtures.js";
import {
  discoverCompetitorBacklinkOpportunities,
  discoverBrokenLinkOpportunities,
  discoverResourcePageOpportunities,
  discoverMentionOpportunities,
  deduplicateOpportunities
} from "../discovery/discovery.js";
import { analyzeBrokenLinks } from "../broken-links/finder.js";
import { analyzeResourcePages } from "../resource-pages/finder.js";
import { scoreOpportunity } from "../scoring/engine.js";
import { analyzeInternalLinks } from "../internal-links/optimizer.js";
import { prioritizeBatch } from "../content/refresh.js";
import { planCampaign } from "../campaigns/planner.js";
import { LinkOpportunity } from "../domain/opportunity.js";
import { TargetPage, ContentAsset } from "../domain/site.js";
import { parseJsonSafe } from "../utils/validation.js";

const program = new Command();
program
  .name("backlink-engine")
  .description("Provider-agnostic backlink intelligence and campaign-planning engine")
  .version("1.0.0");

interface GlobalOpts {
  json?: boolean;
  fixture?: string;
  out?: string;
}

function readJson(path: string | undefined): unknown {
  if (!path) return undefined;
  if (!existsSync(path)) {
    throw new Error(`File not found: ${path}`);
  }
  const text = readFileSync(path, "utf-8");
  const parsed = parseJsonSafe(text);
  if (parsed === undefined) {
    throw new Error(`Invalid JSON in: ${path}`);
  }
  return parsed;
}

/** Coerce a parsed JSON value into an array. Accepts raw arrays or objects wrapping a known key. */
function asArray<T = unknown>(value: unknown, ...keys: string[]): T[] {
  if (Array.isArray(value)) return value as T[];
  if (value && typeof value === "object") {
    const obj = value as Record<string, unknown>;
    for (const k of keys) {
      if (Array.isArray(obj[k])) return obj[k] as T[];
    }
  }
  return [];
}

function emit(out: unknown, opts: GlobalOpts) {
  const text = opts.json ? JSON.stringify(out, null, 2) : humanize(out);
  if (opts.out) {
    writeFileSync(resolve(opts.out), text);
    // eslint-disable-next-line no-console
    console.log(`Wrote ${opts.out}`);
  } else {
    // eslint-disable-next-line no-console
    console.log(text);
  }
}

function humanize(value: unknown): string {
  if (typeof value === "string") return value;
  if (Array.isArray(value)) {
    return value.map((v) => humanize(v)).join("\n---\n");
  }
  if (value && typeof value === "object") {
    const obj = value as Record<string, unknown>;
    return Object.entries(obj)
      .map(([k, v]) => `${k}: ${typeof v === "object" ? JSON.stringify(v) : v}`)
      .join("\n");
  }
  return String(value);
}

function loadFixture(fixturePath: string | undefined): FixtureAdapter {
  if (!fixturePath) return new FixtureAdapter({});
  const data = readJson(fixturePath) as any;
  return new FixtureAdapter(data ?? {});
}

// ---- site (group) ----
const site = program.command("site").description("Manage site inventories");

site
  .command("import")
  .description("Import a site inventory from a JSON file")
  .option("--name <name>", "Site name")
  .option("--domain <domain>", "Root domain")
  .option("--topics <topics>", "Comma-separated topics")
  .option("--pages <path>", "Path to JSON file with page records (each must have url)")
  .option("--json", "Output as JSON")
  .option("--out <path>", "Write output to file")
  .action((opts: GlobalOpts & { name?: string; domain?: string; topics?: string; pages?: string }) => {
    const sp = makeSiteProfile(opts.name ?? "Default Site", opts.domain ?? "example.com", (opts.topics ?? "").split(",").filter(Boolean));
    const dom = makeTargetDomain(sp.id, opts.domain ?? "example.com");
    const builder = new SiteInventoryBuilder({});
    if (opts.pages) {
      const pages = asArray<Record<string, unknown>>(readJson(opts.pages), "pages");
      for (const p of pages) {
        if (typeof p.url === "string") {
          builder.addPage({ ...(p as any), siteProfileId: sp.id });
        }
      }
    }
    const inv = builder.build(sp, dom);
    emit(
      {
        site: sp,
        domain: dom,
        pages: inv.pages,
        stats: inv.stats()
      },
      opts
    );
  });

site
  .command("analyze")
  .description("Analyze a site inventory JSON")
  .option("--inventory <path>", "Path to site inventory JSON")
  .option("--json", "Output as JSON")
  .option("--out <path>", "Write output to file")
  .action((opts: GlobalOpts & { inventory?: string }) => {
    if (!opts.inventory) throw new Error("--inventory is required");
    const data = readJson(opts.inventory) as any;
    const inv = new SiteInventory({
      site: data.site,
      domain: data.domain,
      pages: data.pages ?? []
    });
    emit(
      {
        stats: inv.stats(),
        nonIndexable: inv.nonIndexable().map((p) => p.url),
        commercialPages: inv.commercialPages().map((p) => p.url)
      },
      opts
    );
  });

// ---- competitors (group) ----
const competitors = program.command("competitors").description("Manage competitor datasets");

competitors
  .command("import")
  .description("Import competitor + backlink dataset JSON")
  .option("--competitors <path>", "Path to competitors JSON")
  .option("--json", "Output as JSON")
  .option("--out <path>", "Write output to file")
  .action((opts: GlobalOpts & { competitors?: string }) => {
    if (!opts.competitors) throw new Error("--competitors is required");
    const data = readJson(opts.competitors);
    emit({ imported: data, count: Array.isArray(data) ? data.length : 1 }, opts);
  });

// ---- opportunities (group) ----
const opportunities = program.command("opportunities").description("Discover, score, list opportunities");

opportunities
  .command("discover")
  .description("Discover opportunities via fixture/adapter")
  .option("--site <id>", "Site profile id")
  .option("--target-domain <d>", "Target domain")
  .option("--topics <topics>", "Comma-separated topics")
  .option("--competitor <domain>", "Competitor domain (for backlink discovery)")
  .option("--source-page <url>", "Source page URL (for broken-link discovery)")
  .option("--topic <topic>", "Topic (for resource-page discovery)")
  .option("--mention <term>", "Term (for mention discovery)")
  .option("--fixture <path>", "Path to fixture JSON")
  .option("--json", "Output as JSON")
  .option("--out <path>", "Write output to file")
  .action(async (opts: GlobalOpts & any) => {
    const adapter = loadFixture(opts.fixture);
    const store = new InMemoryEvidenceStore();
    const ctx = {
      siteProfileId: opts.site ?? "site_default",
      targetDomain: opts.targetDomain ?? "example.com",
      topics: (opts.topics ?? "").split(",").filter(Boolean),
      adapter,
      recordEvidence: (e: Omit<EvidenceRecord, "id">) => store.record(e)
    };
    const results: LinkOpportunity[] = [];
    if (opts.competitor) {
      const r = await discoverCompetitorBacklinkOpportunities({ id: `comp_${opts.competitor}`, domain: opts.competitor }, ctx);
      results.push(...r.opportunities);
    }
    if (opts.sourcePage) {
      const r = await discoverBrokenLinkOpportunities(opts.sourcePage, ctx);
      results.push(...r.opportunities);
    }
    if (opts.topic) {
      const r = await discoverResourcePageOpportunities(opts.topic, ctx);
      results.push(...r.opportunities);
    }
    if (opts.mention) {
      const r = await discoverMentionOpportunities(opts.mention, ctx);
      results.push(...r.opportunities);
    }
    emit(
      {
        opportunities: deduplicateOpportunities(results),
        evidence: store.all().length
      },
      opts
    );
  });

opportunities
  .command("score")
  .description("Score opportunities JSON")
  .option("--opportunities <path>", "Path to opportunities JSON")
  .option("--evidence <path>", "Path to evidence JSON")
  .option("--pages <path>", "Path to target pages JSON")
  .option("--assets <path>", "Path to content assets JSON")
  .option("--json", "Output as JSON")
  .option("--out <path>", "Write output to file")
  .action((opts: GlobalOpts & any) => {
    const opps = asArray<LinkOpportunity>(readJson(opts.opportunities), "opportunities");
    const evidence = asArray<EvidenceRecord>(readJson(opts.evidence), "evidence");
    const pages = asArray<TargetPage>(readJson(opts.pages), "pages");
    const assets = asArray<ContentAsset>(readJson(opts.assets), "assets");
    const scored = opps.map((o) => {
      const ctx = {
        matchedTargetPage: pages.find((p) => p.id === o.targetPageId),
        matchedAsset: undefined,
        contentReady: true,
        evidence,
        now: Date.now()
      };
      const s = scoreOpportunity(o, ctx);
      return { opportunity: o, score: s };
    });
    emit({ scored }, opts);
  });

opportunities
  .command("list")
  .description("List opportunities JSON (optional filter)")
  .option("--opportunities <path>", "Path to opportunities JSON")
  .option("--kind <kind>", "Filter by kind")
  .option("--min-score <n>", "Min score", parseFloat)
  .option("--json", "Output as JSON")
  .option("--out <path>", "Write output to file")
  .action((opts: GlobalOpts & any) => {
    const opps = asArray<LinkOpportunity>(readJson(opts.opportunities), "opportunities");
    let list = opps;
    if (opts.kind) list = list.filter((o) => o.kind === opts.kind);
    if (opts.minScore !== undefined) list = list.filter((o) => (o.score?.total ?? 0) >= opts.minScore);
    emit({ count: list.length, opportunities: list }, opts);
  });

// ---- broken-links (group) ----
const brokenLinks = program.command("broken-links").description("Broken-link analysis");

brokenLinks
  .command("analyze")
  .description("Analyze broken-link inputs")
  .option("--site <id>", "Site profile id")
  .option("--input <path>", "Path to broken-link inputs JSON")
  .option("--pages <path>", "Path to candidate replacement pages JSON")
  .option("--assets <path>", "Path to candidate replacement assets JSON")
  .option("--topics <topics>", "Comma-separated target topics")
  .option("--json", "Output as JSON")
  .option("--out <path>", "Write output to file")
  .action((opts: GlobalOpts & any) => {
    const store = new InMemoryEvidenceStore();
    const inputs = asArray<any>(readJson(opts.input), "brokenLinks");
    const pages = asArray<TargetPage>(readJson(opts.pages), "pages");
    const assets = asArray<ContentAsset>(readJson(opts.assets), "assets");
    const result = analyzeBrokenLinks(inputs, {
      siteProfileId: opts.site ?? "site_default",
      targetTopics: (opts.topics ?? "").split(",").filter(Boolean),
      candidateReplacementPages: pages,
      candidateReplacementAssets: assets,
      recordEvidence: (e) => store.record(e)
    });
    emit({ matches: result.matches.length, stale: result.stale.length, result, evidence: store.all().length }, opts);
  });

// ---- resource-pages (group) ----
const resourcePages = program.command("resource-pages").description("Resource-page analysis");

resourcePages
  .command("analyze")
  .description("Analyze resource-page inputs")
  .option("--site <id>", "Site profile id")
  .option("--input <path>", "Path to resource-page inputs JSON")
  .option("--topics <topics>", "Comma-separated target topics")
  .option("--json", "Output as JSON")
  .option("--out <path>", "Write output to file")
  .action((opts: GlobalOpts & any) => {
    const store = new InMemoryEvidenceStore();
    const inputs = asArray<any>(readJson(opts.input), "resourcePages");
    const results = analyzeResourcePages(inputs, {
      siteProfileId: opts.site ?? "site_default",
      targetTopics: (opts.topics ?? "").split(",").filter(Boolean),
      recordEvidence: (e) => store.record(e)
    });
    emit({ count: results.length, results, evidence: store.all().length }, opts);
  });

// ---- internal-links (group) ----
const internalLinks = program.command("internal-links").description("Internal link analysis");

internalLinks
  .command("analyze")
  .description("Analyze internal link graph")
  .option("--site <id>", "Site profile id")
  .option("--pages <path>", "Path to pages JSON")
  .option("--edges <path>", "Path to edges JSON")
  .option("--json", "Output as JSON")
  .option("--out <path>", "Write output to file")
  .action((opts: GlobalOpts & any) => {
    const pages = asArray<TargetPage>(readJson(opts.pages), "pages");
    const edges = asArray<any>(readJson(opts.edges), "internalLinks");
    const result = analyzeInternalLinks(
      { pages, edges },
      { siteProfileId: opts.site ?? "site_default" }
    );
    emit(
      {
        orphans: result.orphans.map((p) => p.url),
        weakCommercial: result.weakCommercial.map((p) => p.url),
        repetitiveAnchors: result.repetitiveAnchors,
        deeplyBuried: result.deeplyBuried.map((p) => p.url),
        opportunities: result.opportunities
      },
      opts
    );
  });

// ---- content (group) ----
const content = program.command("content").description("Content analysis");

content
  .command("refresh-priorities")
  .description("Compute content refresh priorities")
  .option("--input <path>", "Path to refresh inputs JSON")
  .option("--json", "Output as JSON")
  .option("--out <path>", "Write output to file")
  .action((opts: GlobalOpts & any) => {
    const inputs = asArray<any>(readJson(opts.input), "refreshInputs");
    const results = prioritizeBatch(inputs);
    emit({ priorities: results }, opts);
  });

// ---- campaign (group) ----
const campaign = program.command("campaign").description("Campaign planning and tracking");

campaign
  .command("create")
  .description("Create a campaign from opportunities")
  .option("--site <id>", "Site profile id")
  .option("--brand <name>", "Brand name")
  .option("--opportunities <path>", "Path to opportunities JSON")
  .option("--type <type>", "Campaign type")
  .option("--name <name>", "Campaign name")
  .option("--json", "Output as JSON")
  .option("--out <path>", "Write output to file")
  .action((opts: GlobalOpts & any) => {
    const opps = asArray<LinkOpportunity>(readJson(opts.opportunities), "opportunities");
    const c = planCampaign({
      siteProfileId: opts.site ?? "site_default",
      name: opts.name ?? "Campaign",
      type: opts.type ?? "mixed",
      opportunities: opps,
      brandName: opts.brand ?? "Brand"
    });
    emit({ campaign: c }, opts);
  });

campaign
  .command("list")
  .description("List campaigns JSON")
  .option("--campaigns <path>", "Path to campaigns JSON")
  .option("--json", "Output as JSON")
  .option("--out <path>", "Write output to file")
  .action((opts: GlobalOpts & any) => {
    const list = asArray<any>(readJson(opts.campaigns), "campaigns");
    emit({ count: list.length, campaigns: list }, opts);
  });

campaign
  .command("export")
  .description("Export a campaign to JSON handoff format")
  .option("--campaign <path>", "Path to campaign JSON")
  .option("--json", "Output as JSON")
  .option("--out <path>", "Write output to file")
  .action((opts: GlobalOpts & any) => {
    const c = readJson(opts.campaign);
    emit({ handoff: c, exportedAt: Date.now() }, opts);
  });

// ---- evidence (group) ----
const evidence = program.command("evidence").description("Evidence operations");

evidence
  .command("verify")
  .description("Verify evidence records (hash + freshness)")
  .option("--evidence <path>", "Path to evidence JSON")
  .option("--json", "Output as JSON")
  .option("--out <path>", "Write output to file")
  .action((opts: GlobalOpts & any) => {
    const list = asArray<EvidenceRecord>(readJson(opts.evidence), "evidence");
    const results = (list as EvidenceRecord[]).map((e) => {
      const recomputed = e.payload ? canonicalPayloadHash(e.payload) : undefined;
      const hashOk = !e.payloadHash || recomputed === e.payloadHash;
      return {
        id: e.id,
        subjectId: e.subjectId,
        verification: e.verification,
        hashOk,
        observedAt: e.observedAt
      };
    });
    emit({ verified: results.filter((r) => r.hashOk).length, total: results.length, results }, opts);
  });

const __main = fileURLToPath(import.meta.url) === process.argv[1];
if (__main) {
  program.parseAsync(process.argv).catch((err) => {
    // eslint-disable-next-line no-console
    console.error(`Error: ${(err as Error).message}`);
    process.exit(1);
  });
}

export { program };
