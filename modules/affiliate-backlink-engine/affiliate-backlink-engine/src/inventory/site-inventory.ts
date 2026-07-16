/**
 * Site Inventory (Mission 2).
 *
 * Accepts:
 *  - domain
 *  - sitemap
 *  - URL list
 *  - content export
 *  - manually supplied page inventory
 *
 * Normalizes into TargetPage[].
 *
 * Does NOT require live web access for tests. Fixture-driven.
 */
import {
  SiteProfile,
  TargetDomain,
  TargetPage,
  ContentType,
  CommercialIntent,
  IndexabilityState
} from "../domain/site.js";
import { deterministicId, slugId } from "../domain/ids.js";
import { VerificationStatus } from "../domain/verification.js";
import { normalizeUrl } from "../utils/url.js";
import { EvidenceRecord, EvidenceSource } from "../domain/evidence.js";
import { parseCsv, parseJsonSafe } from "../utils/validation.js";

export interface SiteInventoryInput {
  site: SiteProfile;
  domain?: TargetDomain;
  pages: TargetPage[];
}

export interface SiteInventoryBuildOptions {
  /** Default content type if not inferable. */
  defaultContentType?: ContentType;
  /** Default commercial intent if not inferable. */
  defaultCommercialIntent?: CommercialIntent;
  /** Default priority if not supplied. */
  defaultPriority?: number;
  /** Evidence source for the import. */
  evidenceSource?: EvidenceSource;
  /** Optional evidence recorder. */
  recordEvidence?: (e: Omit<EvidenceRecord, "id">) => EvidenceRecord;
}

export class SiteInventory {
  constructor(public readonly input: SiteInventoryInput) {}

  get site(): SiteProfile {
    return this.input.site;
  }
  get domain(): TargetDomain | undefined {
    return this.input.domain;
  }
  get pages(): TargetPage[] {
    return this.input.pages;
  }

  pageById(id: string): TargetPage | undefined {
    return this.input.pages.find((p) => p.id === id);
  }

  pageByUrl(url: string): TargetPage | undefined {
    const n = normalizeUrl(url);
    if (!n) return undefined;
    return this.input.pages.find((p) => {
      const pn = normalizeUrl(p.canonicalUrl);
      return pn?.href === n.href;
    });
  }

  /** Pages flagged as noindex / blocked. */
  nonIndexable(): TargetPage[] {
    return this.input.pages.filter((p) => p.indexability !== "indexable");
  }

  /** Commercial pages (transactional / commercial_investigation). */
  commercialPages(): TargetPage[] {
    return this.input.pages.filter(
      (p) => p.commercialIntent === "transactional" || p.commercialIntent === "commercial_investigation"
    );
  }

  /** Stats summary. */
  stats(): {
    totalPages: number;
    indexable: number;
    nonIndexable: number;
    commercial: number;
    byContentType: Record<string, number>;
  } {
    const byContentType: Record<string, number> = {};
    let indexable = 0;
    let nonIndexable = 0;
    let commercial = 0;
    for (const p of this.input.pages) {
      byContentType[p.contentType] = (byContentType[p.contentType] ?? 0) + 1;
      if (p.indexability === "indexable") indexable++;
      else nonIndexable++;
      if (p.commercialIntent === "transactional" || p.commercialIntent === "commercial_investigation") commercial++;
    }
    return { totalPages: this.input.pages.length, indexable, nonIndexable, commercial, byContentType };
  }
}

/**
 * Builder that turns raw import data into a SiteInventory.
 * Idempotent: same inputs produce same ids.
 */
export class SiteInventoryBuilder {
  private pages: TargetPage[] = [];
  private readonly opts: SiteInventoryBuildOptions;

  constructor(opts: SiteInventoryBuildOptions = {}) {
    this.opts = opts;
  }

  addPage(raw: Partial<TargetPage> & { url: string }): TargetPage {
    const n = normalizeUrl(raw.url);
    if (!n) throw new Error(`Invalid URL: ${raw.url}`);
    const contentType: ContentType = raw.contentType ?? this.opts.defaultContentType ?? inferContentType(n.pathname, raw.title);
    const commercialIntent: CommercialIntent =
      raw.commercialIntent ?? this.opts.defaultCommercialIntent ?? inferCommercialIntent(contentType, raw.targetKeyword);
    const indexability: IndexabilityState = raw.indexability ?? "unknown";
    const priority = raw.priority ?? this.opts.defaultPriority ?? 50;
    const page: TargetPage = {
      id: raw.id ?? deterministicId("page", [n.href]),
      siteProfileId: raw.siteProfileId ?? "",
      url: n.href,
      canonicalUrl: raw.canonicalUrl ? normalizeUrl(raw.canonicalUrl)?.href ?? n.href : n.href,
      title: raw.title,
      contentType,
      topic: raw.topic,
      commercialIntent,
      targetKeyword: raw.targetKeyword,
      productOrCategory: raw.productOrCategory,
      lastModified: raw.lastModified,
      indexability,
      priority,
      verification: raw.verification ?? "DISCOVERED",
      verifiedAt: raw.verifiedAt,
      attributes: raw.attributes
    };
    this.pages.push(page);
    if (this.opts.recordEvidence) {
      this.opts.recordEvidence({
        kind: "page_observation",
        subjectId: page.id,
        claim: `Imported page ${page.url} as ${page.contentType}`,
        observedAt: Date.now(),
        source: this.opts.evidenceSource ?? { adapter: "import" },
        verification: page.verification,
        payload: { url: page.url, contentType: page.contentType }
      });
    }
    return page;
  }

  /** Bulk import from an array of raw page records. */
  addPages(records: Array<Partial<TargetPage> & { url: string }>): TargetPage[] {
    return records.map((r) => this.addPage(r));
  }

  /** Import from a sitemap XML <urlset> parsed into { loc, lastmod } objects. */
  addFromSitemapEntries(
    entries: Array<{ loc: string; lastmod?: string }>,
    siteProfileId: string
  ): TargetPage[] {
    return entries.map((e) =>
      this.addPage({
        url: e.loc,
        siteProfileId,
        lastModified: e.lastmod ? Date.parse(e.lastmod) || undefined : undefined
      })
    );
  }

  /** Import from CSV (expects a `url` column). */
  addFromCsv(csvText: string, siteProfileId: string): TargetPage[] {
    const rows = parseCsv(csvText);
    return rows
      .filter((r) => r.url)
      .map((r) =>
        this.addPage({
          url: r.url,
          siteProfileId,
          title: r.title || undefined,
          contentType: (r.contentType as ContentType) || undefined,
          topic: r.topic || undefined,
          targetKeyword: r.targetKeyword || undefined,
          productOrCategory: r.productOrCategory || undefined,
          priority: r.priority ? Number(r.priority) : undefined,
          lastModified: r.lastModified ? Date.parse(r.lastModified) || undefined : undefined,
          attributes: { source: "csv" }
        })
      );
  }

  /** Import from JSON (array of partial TargetPage with url). */
  addFromJson(jsonText: string, siteProfileId: string): TargetPage[] {
    const parsed = parseJsonSafe(jsonText);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((r) => r && typeof r === "object" && "url" in r)
      .map((r) => this.addPage({ ...(r as Record<string, unknown>) as any, siteProfileId }));
  }

  build(site: SiteProfile, domain?: TargetDomain): SiteInventory {
    // Patch siteProfileId on all pages.
    const pages = this.pages.map((p) => ({ ...p, siteProfileId: site.id }));
    return new SiteInventory({ site, domain, pages });
  }
}

export function inferContentType(pathname: string, title?: string): ContentType {
  const p = pathname.toLowerCase();
  const t = (title ?? "").toLowerCase();
  if (p === "/" || p === "") return "homepage";
  if (p.includes("/about")) return "about";
  if (p.includes("/contact")) return "contact";
  if (p.includes("/legal") || p.includes("/privacy") || p.includes("/terms")) return "legal";
  if (p.includes("/calculator")) return "calculator";
  if (p.includes("/glossary")) return "glossary";
  if (p.includes("/statistics") || p.includes("/stats")) return "statistics";
  if (p.includes("/compare") || p.includes("/comparison") || t.includes("compare")) return "comparison";
  if (p.includes("/review") || t.includes("review")) return "review";
  if (p.includes("/best-") || /^\d+-(?:best|top)/.test(t)) return "listicle";
  if (p.includes("/category") || p.includes("/categories")) return "category";
  if (p.includes("/product/")) return "product";
  if (p.includes("/guide") || p.includes("/how-to")) return "guide";
  return "article";
}

export function inferCommercialIntent(contentType: ContentType, keyword?: string): CommercialIntent {
  const k = (keyword ?? "").toLowerCase();
  if (k.includes("buy") || k.includes("price") || k.includes("discount") || k.includes("deal")) return "transactional";
  if (k.includes("best") || k.includes("review") || k.includes("compare") || k.includes("vs")) return "commercial_investigation";
  if (contentType === "product" || contentType === "category") return "transactional";
  if (contentType === "guide" || contentType === "glossary" || contentType === "statistics") return "informational";
  if (contentType === "landing") return "navigational";
  return "unknown";
}

export function makeSiteProfile(name: string, rootDomain: string, topics: string[]): SiteProfile {
  return {
    id: slugId("site", name, [rootDomain]),
    name,
    rootDomain,
    topics,
    createdAt: Date.now()
  };
}

export function makeTargetDomain(siteProfileId: string, domain: string): TargetDomain {
  return {
    id: deterministicId("domain", [domain]),
    siteProfileId,
    domain,
    verification: "DISCOVERED"
  };
}
