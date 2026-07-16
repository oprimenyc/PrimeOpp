/**
 * Example: downstream handoff to a hypothetical marketplace comps module.
 *
 * This example demonstrates the SHAPE of the handoff contract between
 * `primeopp-product-enrichment` and a downstream `primeopp-marketplace-comps`
 * module. The comps module does NOT exist in this clean-room build; we only
 * define the boundary contract and convert an `EnrichedProductProfile` into
 * a `CompsRequest` that the downstream module would accept.
 *
 * The comps module is responsible for: querying marketplaces, normalizing
 * comps, and computing profitability estimates. This example does NOT
 * implement any of that logic.
 */

import { ProductEnrichmentService } from "../src/application/service";
import { FixtureProductProvider } from "../src/providers/fixture-provider";
import { ManualInputProvider } from "../src/providers/manual-provider";
import { InMemoryEnrichmentCache } from "../src/cache";
import { normalizeIdentifier } from "../src/domain/identifier";
import { loadAllFixtures } from "../tests/fixtures-loader";
import type { EnrichedProductProfile } from "../src/contracts/output";

/**
 * Hypothetical downstream contract. A real comps module would import this
 * type from its own package. Until then, we declare it here.
 */
export interface CompsRequest {
  /** Stable enrichment ID for traceability. */
  enrichmentId: string;
  /** Intake ID for end-to-end tracing. */
  intakeId?: string;

  /** Primary identifier to use for comps lookup. */
  primaryIdentifier?: {
    type: "GTIN" | "UPC" | "EAN" | "ISBN" | "MPN" | "SKU";
    value: string;
  };

  /** Brand + model for fuzzy comp matching when no barcode is available. */
  brand?: string;
  model?: string;
  title?: string;

  /** Category hint for marketplace-specific category mapping. */
  category?: string;

  /** Condition hint (defaults to NEW). */
  condition?: "NEW" | "USED" | "REFURBISHED";

  /** Overall enrichment confidence — comps module may skip low-confidence profiles. */
  enrichmentConfidence: number;

  /** Conflicts that comps should be aware of (may affect pricing strategy). */
  knownConflicts: Array<{ field: string; severity: "LOW" | "MEDIUM" | "HIGH" }>;
}

/**
 * Adapter function: converts an EnrichedProductProfile into a CompsRequest.
 *
 * This is the SOLE handoff point. A real integration would either:
 *   (a) expose this function from the enrichment module's public API, OR
 *   (b) implement it inside the comps module as an input adapter.
 *
 * We expose it here as an example so integrating hosts can copy it.
 */
export function toCompsRequest(profile: EnrichedProductProfile): CompsRequest {
  // Pick the best primary identifier in priority order.
  let primaryIdentifier: CompsRequest["primaryIdentifier"];
  if (profile.identifiers.gtin?.[0]) {
    primaryIdentifier = { type: "GTIN", value: profile.identifiers.gtin[0] };
  } else if (profile.identifiers.upc?.[0]) {
    primaryIdentifier = { type: "UPC", value: profile.identifiers.upc[0] };
  } else if (profile.identifiers.ean?.[0]) {
    primaryIdentifier = { type: "EAN", value: profile.identifiers.ean[0] };
  } else if (profile.identifiers.isbn?.[0]) {
    primaryIdentifier = { type: "ISBN", value: profile.identifiers.isbn[0] };
  } else if (profile.identifiers.mpn?.[0]) {
    primaryIdentifier = { type: "MPN", value: profile.identifiers.mpn[0] };
  } else if (profile.identifiers.sku?.[0]) {
    primaryIdentifier = { type: "SKU", value: profile.identifiers.sku[0] };
  }

  return {
    enrichmentId: profile.enrichmentId,
    intakeId: profile.intakeId,
    primaryIdentifier,
    brand: profile.identity.brand,
    model: profile.identity.model,
    title: profile.identity.canonicalTitle,
    category: profile.classification.category,
    condition: "NEW",
    enrichmentConfidence: profile.confidence.overall,
    knownConflicts: profile.conflicts.map((c) => ({
      field: c.field,
      severity: c.severity,
    })),
  };
}

async function main(): Promise<void> {
  const fixtures = loadAllFixtures();
  const service = new ProductEnrichmentService({
    cache: new InMemoryEnrichmentCache({ capacity: 100 }),
    maxProviders: 5,
    providers: [
      { provider: new FixtureProductProvider({ id: "fixture", priority: 10, records: fixtures }), priority: 10 },
      { provider: new ManualInputProvider(), priority: 5 },
    ],
  });

  const profile = await service.enrich({
    intakeId: "intake-handoff-001",
    identifier: normalizeIdentifier("027242873826"),
  });

  const compsRequest = toCompsRequest(profile);

  console.log("Enriched profile:");
  console.log(`  enrichmentId: ${profile.enrichmentId}`);
  console.log(`  status: ${profile.status}`);
  console.log(`  confidence: ${profile.confidence.overall}`);
  console.log();
  console.log("Downstream CompsRequest:");
  console.log(JSON.stringify(compsRequest, null, 2));

  // Hypothetical downstream call (NOT implemented here):
  //
  //   const compsModule = createCompsModule({ ... });
  //   const comps = await compsModule.findComps(compsRequest);
  //
  // The comps module would then return a list of marketplace listings
  // with prices, conditions, sellers, and shipping estimates. This
  // example stops at the boundary.
}

main().catch((err) => {
  console.error("Example failed:", err);
  process.exit(1);
});
