/**
 * Test runner entrypoint. Loads all test files in order, then runs them.
 *
 * Usage:  node --require ts-node/register tests/run-all.ts
 */

import { runAll } from "./harness";

// Importing these files registers their describe/it blocks via side effect.
import "./test-identifier";
import "./test-normalization";
import "./test-resolution";
import "./test-confidence";
import "./test-completeness";
import "./test-enrichment";
import "./test-service";
import "./test-http-provider";
import "./test-isbn-provider";
import "./test-manual-provider";
import "./test-intake-handoff";

runAll().catch((err) => {
  console.error("Fatal test runner error:", err);
  process.exit(1);
});
