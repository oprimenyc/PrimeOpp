/**
 * Tests for error types.
 */

import {
  IntakeError,
  InvalidInputError,
  DuplicateIntakeError,
  AdapterError,
  UnsupportedInputError,
  InternalIntakeError,
} from "../src/errors/index.js";

describe("Error types", () => {
  test("IntakeError has code and details", () => {
    const err = new IntakeError("test", "TEST_CODE", { key: "value" });
    expect(err.code).toBe("TEST_CODE");
    expect(err.details).toEqual({ key: "value" });
    expect(err.message).toBe("test");
  });

  test("IntakeError.toJSON", () => {
    const err = new IntakeError("test", "TEST_CODE");
    const json = err.toJSON();
    expect(json.code).toBe("TEST_CODE");
    expect(json.name).toBe("IntakeError");
    // Should NOT contain stack trace
    expect(json).not.toHaveProperty("stack");
  });

  test("InvalidInputError", () => {
    const err = new InvalidInputError("bad input");
    expect(err.code).toBe("INVALID_INPUT");
    expect(err.name).toBe("InvalidInputError");
  });

  test("DuplicateIntakeError has existingIntakeId", () => {
    const err = new DuplicateIntakeError("dup", "id-123");
    expect(err.code).toBe("DUPLICATE_DETECTED");
    expect(err.existingIntakeId).toBe("id-123");
  });

  test("AdapterError has adapterName", () => {
    const err = new AdapterError("fail", "scanner-v1");
    expect(err.code).toBe("ADAPTER_FAILURE");
    expect(err.details?.adapterName).toBe("scanner-v1");
  });

  test("UnsupportedInputError", () => {
    const err = new UnsupportedInputError("not supported");
    expect(err.code).toBe("UNSUPPORTED_INPUT");
  });

  test("InternalIntakeError", () => {
    const err = new InternalIntakeError("oops");
    expect(err.code).toBe("INTERNAL_ERROR");
  });
});