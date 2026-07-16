/**
 * Test/fixture loader — centralizes fixture loading for both tests and the
 * FixtureProductProvider. Reads from the `fixtures/` directory relative to
 * the project root.
 */

import * as fs from "fs";
import * as path from "path";
import type { FixtureRecord } from "../src/providers/fixture-provider";

export function loadFixtureFile(name: string): FixtureRecord[] {
  const root = findProjectRoot(__dirname);
  const file = path.join(root, "fixtures", name.endsWith(".json") ? name : `${name}.json`);
  if (!fs.existsSync(file)) {
    throw new Error(`Fixture file not found: ${file}`);
  }
  const raw = fs.readFileSync(file, "utf8");
  return JSON.parse(raw) as FixtureRecord[];
}

export function loadAllFixtures(): FixtureRecord[] {
  const root = findProjectRoot(__dirname);
  const dir = path.join(root, "fixtures");
  if (!fs.existsSync(dir)) return [];
  const out: FixtureRecord[] = [];
  for (const f of fs.readdirSync(dir)) {
    if (!f.endsWith(".json")) continue;
    const raw = fs.readFileSync(path.join(dir, f), "utf8");
    const parsed = JSON.parse(raw) as FixtureRecord[];
    out.push(...parsed);
  }
  return out;
}

function findProjectRoot(start: string): string {
  let cur = start;
  for (let i = 0; i < 10; i++) {
    if (fs.existsSync(path.join(cur, "package.json"))) {
      // Confirm this is OUR package, not a parent.
      try {
        const pkg = JSON.parse(fs.readFileSync(path.join(cur, "package.json"), "utf8"));
        if (pkg.name === "primeopp-product-enrichment") return cur;
      } catch {
        // ignore
      }
    }
    const parent = path.dirname(cur);
    if (parent === cur) break;
    cur = parent;
  }
  // Fallback: assume tests/ lives one level under project root.
  return path.resolve(__dirname, "..");
}
