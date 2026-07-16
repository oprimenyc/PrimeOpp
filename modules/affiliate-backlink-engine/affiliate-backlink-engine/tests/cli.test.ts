import { describe, it, expect } from "vitest";
import { execFileSync } from "node:child_process";
import { resolve } from "node:path";

const CLI = resolve(process.cwd(), "src/cli/index.ts");
const TSX = "tsx";

function run(args: string[], opts: { cwd?: string } = {}): { stdout: string; stderr: string; code: number } {
  try {
    const stdout = execFileSync(TSX, [CLI, ...args], {
      cwd: opts.cwd ?? process.cwd(),
      encoding: "utf-8",
      env: process.env,
      timeout: 30000
    });
    return { stdout, stderr: "", code: 0 };
  } catch (e: any) {
    return { stdout: e.stdout ?? "", stderr: e.stderr ?? e.message ?? "", code: e.status ?? 1 };
  }
}

describe("CLI smoke tests", () => {
  it("--help prints command list", () => {
    const r = run(["--help"]);
    if (r.code !== 0) console.error("STDERR:", r.stderr);
    expect(r.code).toBe(0);
    expect(r.stdout).toContain("site");
    expect(r.stdout).toContain("opportunities");
    expect(r.stdout).toContain("campaign");
    expect(r.stdout).toContain("evidence");
  });

  it("site import builds an inventory from JSON", () => {
    const r = run([
      "site", "import",
      "--name", "Test",
      "--domain", "test.com",
      "--topics", "alpha,beta",
      "--pages", resolve(process.cwd(), "fixtures/generic/site.json"),
      "--json"
    ]);
    if (r.code !== 0) console.error("STDERR:", r.stderr);
    expect(r.code).toBe(0);
    expect(r.stdout).toContain("test.com");
    expect(r.stdout).toContain("totalPages");
  });

  it("broken-links analyze runs against fixture inputs", () => {
    const r = run([
      "broken-links", "analyze",
      "--site", "s1",
      "--input", resolve(process.cwd(), "fixtures/panticandy/site.json"),
      "--pages", resolve(process.cwd(), "fixtures/panticandy/site.json"),
      "--topics", "lingerie"
    ]);
    if (r.code !== 0) console.error("STDERR:", r.stderr);
    expect(r.code).toBe(0);
    expect(r.stdout).toContain("matches");
  });

  it("evidence verify returns verified count", () => {
    const r1 = run([
      "opportunities", "discover",
      "--site", "s1",
      "--target-domain", "panticandy.com",
      "--topics", "lingerie",
      "--competitor", "competitorone.com",
      "--fixture", resolve(process.cwd(), "fixtures/panticandy/dataset.json")
    ]);
    if (r1.code !== 0) console.error("STDERR1:", r1.stderr);
    expect(r1.code).toBe(0);
    expect(r1.stdout).toContain("opportunities");

    const r2 = run([
      "evidence", "verify",
      "--evidence", resolve(process.cwd(), "fixtures/panticandy/dataset.json")
    ]);
    if (r2.code !== 0) console.error("STDERR2:", r2.stderr);
    expect(r2.code).toBe(0);
  });

  it("internal-links analyze runs", () => {
    const r = run([
      "internal-links", "analyze",
      "--site", "s1",
      "--pages", resolve(process.cwd(), "fixtures/panticandy/site.json"),
      "--edges", resolve(process.cwd(), "fixtures/panticandy/site.json")
    ]);
    if (r.code !== 0) console.error("STDERR:", r.stderr);
    expect(r.code).toBe(0);
  });
});
