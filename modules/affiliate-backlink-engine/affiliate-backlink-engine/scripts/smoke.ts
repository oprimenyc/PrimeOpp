/**
 * Smoke test runner. Executes all examples + CLI commands and prints a
 * summary. Used to generate RUNTIME_PROOF.md.
 */
import { execFileSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import { resolve } from "node:path";

interface Step {
  name: string;
  cmd: string;
  args: string[];
  expectedStdoutContains?: string[];
}

const steps: Step[] = [
  {
    name: "typecheck",
    cmd: "npx",
    args: ["tsc", "-p", "tsconfig.json", "--noEmit"]
  },
  {
    name: "build",
    cmd: "npx",
    args: ["tsc", "-p", "tsconfig.json"]
  },
  {
    name: "tests",
    cmd: "npx",
    args: ["vitest", "run"],
    expectedStdoutContains: ["passed"]
  },
  {
    name: "example:panticandy",
    cmd: "npx",
    args: ["tsx", "examples/panticandy-workflow.ts"],
    expectedStdoutContains: ["PantiCandy", "opportunitiesDiscovered"]
  },
  {
    name: "example:vital",
    cmd: "npx",
    args: ["tsx", "examples/vital-workflow.ts"],
    expectedStdoutContains: ["vITAL Core"]
  },
  {
    name: "example:generic",
    cmd: "npx",
    args: ["tsx", "examples/generic-workflow.ts"],
    expectedStdoutContains: ["Generic Affiliate Site"]
  },
  {
    name: "cli:help",
    cmd: "npx",
    args: ["tsx", "src/cli/index.ts", "--help"],
    expectedStdoutContains: ["site", "opportunities", "campaign", "evidence"]
  },
  {
    name: "cli:site-import",
    cmd: "npx",
    args: ["tsx", "src/cli/index.ts", "site", "import", "--name", "Smoke", "--domain", "smoke.example", "--topics", "a,b", "--pages", "fixtures/generic/site.json", "--json"],
    expectedStdoutContains: ["smoke.example", "totalPages"]
  },
  {
    name: "cli:broken-links",
    cmd: "npx",
    args: ["tsx", "src/cli/index.ts", "broken-links", "analyze", "--site", "s1", "--input", "fixtures/panticandy/site.json", "--pages", "fixtures/panticandy/site.json", "--topics", "lingerie", "--json"],
    expectedStdoutContains: ["matches"]
  },
  {
    name: "cli:internal-links",
    cmd: "npx",
    args: ["tsx", "src/cli/index.ts", "internal-links", "analyze", "--site", "s1", "--pages", "fixtures/panticandy/site.json", "--edges", "fixtures/panticandy/site.json", "--json"],
    expectedStdoutContains: ["orphans"]
  },
  {
    name: "cli:evidence-verify",
    cmd: "npx",
    args: ["tsx", "src/cli/index.ts", "evidence", "verify", "--evidence", "fixtures/panticandy/dataset.json", "--json"],
    expectedStdoutContains: ["verified"]
  }
];

interface Result {
  name: string;
  ok: boolean;
  durationMs: number;
  stdoutTail: string;
  stderrTail: string;
}

async function run(): Promise<Result[]> {
  const results: Result[] = [];
  for (const step of steps) {
    const start = Date.now();
    let ok = true;
    let stdout = "";
    let stderr = "";
    try {
      stdout = execFileSync(step.cmd, step.args, {
        cwd: process.cwd(),
        encoding: "utf-8",
        env: process.env,
        timeout: 120000
      });
    } catch (e: any) {
      ok = false;
      stdout = e.stdout ?? "";
      stderr = e.stderr ?? e.message ?? "";
    }
    if (ok && step.expectedStdoutContains) {
      for (const needle of step.expectedStdoutContains) {
        if (!stdout.includes(needle)) {
          ok = false;
          stderr += `\nExpected stdout to contain: ${needle}`;
        }
      }
    }
    const durationMs = Date.now() - start;
    results.push({
      name: step.name,
      ok,
      durationMs,
      stdoutTail: stdout.slice(-500),
      stderrTail: stderr.slice(-500)
    });
    // eslint-disable-next-line no-console
    console.log(`${ok ? "OK" : "FAIL"}  ${step.name}  (${durationMs}ms)`);
  }
  return results;
}

run().then((results) => {
  const allOk = results.every((r) => r.ok);
  const summary = {
    at: new Date().toISOString(),
    allOk,
    results: results.map((r) => ({ name: r.name, ok: r.ok, durationMs: r.durationMs }))
  };
  writeFileSync(resolve(process.cwd(), "RUNTIME_PROOF.json"), JSON.stringify(summary, null, 2));
  // eslint-disable-next-line no-console
  console.log("\n--- SUMMARY ---");
  // eslint-disable-next-line no-console
  console.log(JSON.stringify(summary, null, 2));
  process.exit(allOk ? 0 : 1);
});
