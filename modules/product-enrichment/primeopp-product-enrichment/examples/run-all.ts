/**
 * Run all examples in sequence. Used by `npm run examples:all`.
 */

import { execFileSync } from "child_process";
import * as path from "path";

const examples = [
  "barcode-enrichment.ts",
  "isbn-enrichment.ts",
  "brand-model-enrichment.ts",
  "manual-enrichment.ts",
  "multi-provider-merge.ts",
  "conflict-detection.ts",
  "cache-usage.ts",
  "downstream-handoff.ts",
];

let failed = 0;
for (const ex of examples) {
  console.log("\n" + "=".repeat(70));
  console.log(`  Running: ${ex}`);
  console.log("=".repeat(70));
  try {
    execFileSync(
      process.execPath,
      ["--require", "ts-node/register", path.join(__dirname, ex)],
      { stdio: "inherit" }
    );
  } catch (err) {
    console.error(`  FAILED: ${ex}`);
    failed++;
  }
}

console.log(`\n${examples.length - failed}/${examples.length} examples passed.`);
if (failed > 0) {
  process.exit(1);
}
