import {
  describe,
  it,
  assertEqual,
  assertTruthy,
  assertFalsy,
  assertApprox,
} from "./harness";
import { ManualInputProvider } from "../src/providers/manual-provider";
import type { ProductEnrichmentInput } from "../src/contracts/input";

describe("ManualInputProvider", () => {
  it("canHandle returns true when manualProduct is present", async () => {
    const p = new ManualInputProvider();
    assertTruthy(await p.canHandle({ manualProduct: { title: "x" } }));
    assertFalsy(await p.canHandle({}));
  });

  it("emits a candidate for each populated manual field", async () => {
    const p = new ManualInputProvider();
    const result = await p.enrich(
      {
        manualProduct: {
          title: "T",
          brand: "B",
          model: "M",
          description: "D",
          mpn: "MPN-1",
          color: "red",
          size: "L",
          category: "Cat",
        },
      },
      { timeoutMs: 1000, includeImages: true }
    );
    assertEqual(result.found, true);
    assertEqual(result.candidates.length, 8);
    assertTruthy(result.candidates.some((c) => c.field === "identity.canonicalTitle"));
    assertTruthy(result.candidates.some((c) => c.field === "identifiers.mpn"));
    assertTruthy(result.candidates.some((c) => c.field === "attributes.color"));
  });

  it("skips empty / whitespace-only fields", async () => {
    const p = new ManualInputProvider();
    const result = await p.enrich(
      { manualProduct: { title: "   ", brand: "B" } },
      { timeoutMs: 1000, includeImages: true }
    );
    assertEqual(result.candidates.length, 1);
    assertEqual(result.candidates[0].field, "identity.brand");
  });

  it("returns found=false when manualProduct is missing", async () => {
    const p = new ManualInputProvider();
    const result = await p.enrich({}, { timeoutMs: 1000, includeImages: true });
    assertEqual(result.found, false);
    assertEqual(result.candidates.length, 0);
  });
});
