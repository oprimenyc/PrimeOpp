import { describe, it, expect } from "vitest";
import {
  SiteInventoryBuilder,
  makeSiteProfile,
  makeTargetDomain,
  inferContentType,
  inferCommercialIntent
} from "../src/inventory/site-inventory.js";

describe("site inventory", () => {
  it("builds a site with pages", () => {
    const site = makeSiteProfile("Test", "test.com", ["topic"]);
    const builder = new SiteInventoryBuilder({});
    builder.addPage({ url: "https://test.com/about", siteProfileId: site.id });
    builder.addPage({ url: "https://test.com/best-thing", siteProfileId: site.id });
    const inv = builder.build(site);
    expect(inv.pages.length).toBe(2);
    expect(inv.pages[0].contentType).toBe("about");
    expect(inv.pages[1].contentType).toBe("listicle");
  });

  it("deduplicates by canonical URL via pageByUrl", () => {
    const site = makeSiteProfile("Test", "test.com", []);
    const builder = new SiteInventoryBuilder({});
    builder.addPage({ url: "https://test.com/guide", siteProfileId: site.id });
    const inv = builder.build(site);
    const found = inv.pageByUrl("https://test.com/guide");
    expect(found).toBeDefined();
    expect(inv.pageByUrl("https://other.com/")).toBeUndefined();
  });

  it("infers content type from path", () => {
    expect(inferContentType("/about")).toBe("about");
    expect(inferContentType("/contact")).toBe("contact");
    expect(inferContentType("/guide/x")).toBe("guide");
    expect(inferContentType("/calculator")).toBe("calculator");
    expect(inferContentType("/glossary")).toBe("glossary");
    expect(inferContentType("/best-things")).toBe("listicle");
    expect(inferContentType("/compare")).toBe("comparison");
    expect(inferContentType("/review/x")).toBe("review");
  });

  it("infers commercial intent", () => {
    expect(inferCommercialIntent("product", "buy now")).toBe("transactional");
    expect(inferCommercialIntent("guide", "best coffee grinder")).toBe("commercial_investigation");
    expect(inferCommercialIntent("guide", undefined)).toBe("informational");
    expect(inferCommercialIntent("article", undefined)).toBe("unknown");
  });

  it("records evidence when recorder is supplied", () => {
    const site = makeSiteProfile("Test", "test.com", []);
    const recorded: string[] = [];
    const builder = new SiteInventoryBuilder({
      recordEvidence: (e) => {
        recorded.push(e.claim);
        return { ...e, id: "evd_x" };
      }
    });
    builder.addPage({ url: "https://test.com/x", siteProfileId: site.id });
    expect(recorded.length).toBe(1);
  });

  it("stats computes counts", () => {
    const site = makeSiteProfile("Test", "test.com", []);
    const builder = new SiteInventoryBuilder({});
    builder.addPage({ url: "https://test.com/", siteProfileId: site.id });
    builder.addPage({ url: "https://test.com/product/x", siteProfileId: site.id });
    builder.addPage({ url: "https://test.com/guide/x", siteProfileId: site.id });
    const inv = builder.build(site);
    const s = inv.stats();
    expect(s.totalPages).toBe(3);
    expect(s.byContentType.homepage).toBe(1);
    expect(s.byContentType.product).toBe(1);
    expect(s.byContentType.guide).toBe(1);
  });
});
