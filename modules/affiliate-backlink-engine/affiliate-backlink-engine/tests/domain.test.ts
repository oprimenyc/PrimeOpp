import { describe, it, expect } from "vitest";
import { deterministicId, slugId, ephemeralId, assertValidId } from "../src/domain/ids.js";

describe("deterministic IDs", () => {
  it("produces stable IDs for identical inputs", () => {
    const a = deterministicId("opportunity", ["a", "b", 1]);
    const b = deterministicId("opportunity", ["a", "b", 1]);
    expect(a).toBe(b);
  });

  it("produces different IDs for different inputs", () => {
    const a = deterministicId("opportunity", ["a", "b"]);
    const b = deterministicId("opportunity", ["a", "c"]);
    expect(a).not.toBe(b);
  });

  it("includes the entity prefix", () => {
    expect(deterministicId("page", ["x"])).toMatch(/^page_/);
    expect(deterministicId("campaign", ["x"])).toMatch(/^cmp_/);
    expect(deterministicId("evidence", ["x"])).toMatch(/^evd_/);
  });

  it("slugId is deterministic and includes slug", () => {
    const a = slugId("site", "PantiCandy", ["panticandy.com"]);
    const b = slugId("site", "PantiCandy", ["panticandy.com"]);
    expect(a).toBe(b);
    expect(a).toContain("panticandy");
  });

  it("ephemeralId is unique within reason", () => {
    const a = ephemeralId("campaign");
    const b = ephemeralId("campaign");
    expect(a).not.toBe(b);
    expect(a).toMatch(/^cmp_/);
  });

  it("assertValidId accepts valid ids and rejects junk", () => {
    expect(assertValidId("page_abc123")).toBe(true);
    expect(assertValidId("")).toBe(false);
    expect(assertValidId("nope")).toBe(false);
    expect(assertValidId("page_")).toBe(false); // prefix-only with separator but no body is invalid
  });
});
