/**
 * Minimal test harness — no external dependencies.
 *
 * Provides:
 *   - describe / it blocks
 *   - assert helpers
 *   - colored output
 *   - exit code reporting
 *
 * We deliberately avoid Jest/Vitest/Mocha to keep the module dependency-free
 * and to ensure deterministic execution across environments.
 */

export type TestFn = () => void | Promise<void>;

interface TestCase {
  name: string;
  fn: TestFn;
}

interface TestSuite {
  name: string;
  cases: TestCase[];
  beforeEach?: () => void | Promise<void>;
}

const suites: TestSuite[] = [];
let currentSuite: TestSuite | null = null;

let passCount = 0;
let failCount = 0;
const failures: Array<{ suite: string; case: string; err: unknown }> = [];

export function describe(name: string, fn: () => void): void {
  const suite: TestSuite = { name, cases: [] };
  currentSuite = suite;
  try {
    fn();
  } finally {
    currentSuite = null;
  }
  suites.push(suite);
}

export function it(name: string, fn: TestFn): void {
  if (!currentSuite) {
    throw new Error(`"it" called outside of "describe": ${name}`);
  }
  currentSuite.cases.push({ name, fn });
}

export function beforeEach(fn: () => void | Promise<void>): void {
  if (!currentSuite) {
    throw new Error('"beforeEach" called outside of "describe"');
  }
  currentSuite.beforeEach = fn;
}

// ---------------------------------------------------------------------------
// Assertions
// ---------------------------------------------------------------------------

export function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(`Assertion failed: ${message}`);
  }
}

export function assertEqual<T>(actual: T, expected: T, message = "values not equal"): void {
  const a = JSON.stringify(actual);
  const b = JSON.stringify(expected);
  if (a !== b) {
    throw new Error(`Assertion failed: ${message}\n  expected: ${b}\n  actual:   ${a}`);
  }
}

export function assertNotEqual<T>(actual: T, unexpected: T, message = "values unexpectedly equal"): void {
  const a = JSON.stringify(actual);
  const b = JSON.stringify(unexpected);
  if (a === b) {
    throw new Error(`Assertion failed: ${message}\n  unexpected: ${b}\n  actual:     ${a}`);
  }
}

export function assertApprox(
  actual: number,
  expected: number,
  epsilon = 0.001,
  message = "values not approximately equal"
): void {
  if (Math.abs(actual - expected) > epsilon) {
    throw new Error(
      `Assertion failed: ${message}\n  expected: ${expected} ± ${epsilon}\n  actual:   ${actual}`
    );
  }
}

export function assertTruthy(value: unknown, message = "value not truthy"): void {
  if (!value) {
    throw new Error(`Assertion failed: ${message}\n  value: ${JSON.stringify(value)}`);
  }
}

export function assertFalsy(value: unknown, message = "value not falsy"): void {
  if (value) {
    throw new Error(`Assertion failed: ${message}\n  value: ${JSON.stringify(value)}`);
  }
}

export function assertIncludes<T>(haystack: T[] | string, needle: T | string, message = "needle not in haystack"): void {
  const ok = typeof haystack === "string"
    ? haystack.includes(needle as string)
    : Array.isArray(haystack) && haystack.includes(needle as T);
  if (!ok) {
    throw new Error(`Assertion failed: ${message}\n  needle: ${JSON.stringify(needle)}\n  haystack: ${JSON.stringify(haystack)}`);
  }
}

export function assertThrows(fn: () => void, messageMatch?: string): Error {
  let threw = false;
  let caught: unknown = null;
  try {
    fn();
  } catch (err) {
    threw = true;
    caught = err;
  }
  if (!threw) {
    throw new Error(`Assertion failed: expected function to throw.`);
  }
  if (!(caught instanceof Error)) {
    throw new Error(`Assertion failed: function threw non-Error value: ${JSON.stringify(caught)}`);
  }
  if (messageMatch && !caught.message.includes(messageMatch)) {
    throw new Error(`Assertion failed: error message "${caught.message}" does not contain "${messageMatch}"`);
  }
  return caught;
}

export async function assertRejects(fn: () => Promise<unknown>, messageMatch?: string): Promise<Error> {
  let threw = false;
  let caught: unknown = null;
  try {
    await fn();
  } catch (err) {
    threw = true;
    caught = err;
  }
  if (!threw) {
    throw new Error(`Assertion failed: expected async function to reject.`);
  }
  if (!(caught instanceof Error)) {
    throw new Error(`Assertion failed: function rejected non-Error value: ${JSON.stringify(caught)}`);
  }
  if (messageMatch && !caught.message.includes(messageMatch)) {
    throw new Error(`Assertion failed: error message "${caught.message}" does not contain "${messageMatch}"`);
  }
  return caught;
}

// ---------------------------------------------------------------------------
// Runner
// ---------------------------------------------------------------------------

async function runSuite(suite: TestSuite): Promise<void> {
  console.log(`\n  ${suite.name}`);
  for (const tc of suite.cases) {
    if (suite.beforeEach) {
      try {
        await suite.beforeEach();
      } catch (err) {
        failCount++;
        failures.push({ suite: suite.name, case: tc.name, err });
        console.log(`    ✗ ${tc.name} (beforeEach failed: ${err instanceof Error ? err.message : String(err)})`);
        continue;
      }
    }
    const start = Date.now();
    try {
      await tc.fn();
      passCount++;
      const ms = Date.now() - start;
      console.log(`    ✓ ${tc.name} (${ms}ms)`);
    } catch (err) {
      failCount++;
      failures.push({ suite: suite.name, case: tc.name, err });
      const ms = Date.now() - start;
      console.log(`    ✗ ${tc.name} (${ms}ms)`);
    }
  }
}

export async function runAll(): Promise<void> {
  const start = Date.now();
  for (const suite of suites) {
    await runSuite(suite);
  }
  const ms = Date.now() - start;
  console.log("");
  console.log("  " + "=".repeat(60));
  console.log(`  Tests:  ${passCount} passed, ${failCount} failed, ${passCount + failCount} total`);
  console.log(`  Time:   ${ms}ms`);

  if (failures.length > 0) {
    console.log("");
    console.log("  Failures:");
    for (const f of failures) {
      console.log("");
      console.log(`  [${f.suite}] ${f.case}`);
      if (f.err instanceof Error) {
        console.log(`    ${f.err.name}: ${f.err.message}`);
        if (f.err.stack) {
          // Print first 4 stack frames for context.
          const stackLines = f.err.stack.split("\n").slice(1, 5);
          for (const line of stackLines) {
            console.log(`    ${line.trim()}`);
          }
        }
      } else {
        console.log(`    ${JSON.stringify(f.err)}`);
      }
    }
  }

  if (failCount > 0) {
    process.exitCode = 1;
  }
}

// Allow `node tests/run-all.ts` to execute.
if (require.main === module) {
  runAll().catch((err) => {
    console.error("Fatal test runner error:", err);
    process.exit(1);
  });
}
