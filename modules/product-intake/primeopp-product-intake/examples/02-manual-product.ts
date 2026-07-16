/**
 * Example 2: Manual product intake (no barcode)
 *
 * Demonstrates processing a product that has no barcode,
 * entered manually with product details.
 */

import {
  ProductIntakeService,
  InMemoryDeduplicationStore,
} from "../src/index.js";

async function main() {
  const service = new ProductIntakeService({
    deduplicationStore: new InMemoryDeduplicationStore(),
  });

  const record = await service.intake({
    inputMethod: "MANUAL_PRODUCT",
    manualProduct: {
      title: "Handmade Ceramic Vase",
      brand: "Artisan Home",
      model: "CHV-2024",
      category: "Home Decor",
      description: "A hand-thrown ceramic vase with a matte glaze finish, 10 inches tall.",
    },
  });

  console.log("=== Manual Product Intake ===");
  console.log(JSON.stringify(record, null, 2));
  console.log(`\nStatus: ${record.status}`);
  console.log(`Title: ${record.manualProduct?.title}`);
  console.log(`Brand: ${record.manualProduct?.brand}`);
}

main().catch(console.error);