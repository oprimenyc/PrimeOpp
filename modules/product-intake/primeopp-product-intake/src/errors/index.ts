/**
 * Custom error types for the Product Intake module.
 *
 * These errors provide structured, machine-readable failure information
 * without leaking raw stack traces into public result objects.
 */

// ---------------------------------------------------------------------------
// Base Intake Error
// ---------------------------------------------------------------------------

export class IntakeError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = "IntakeError";
  }

  public toJSON(): Record<string, unknown> {
    return {
      name: this.name,
      code: this.code,
      message: this.message,
      details: this.details,
    };
  }
}

// ---------------------------------------------------------------------------
// Specific Error Types
// ---------------------------------------------------------------------------

export class InvalidInputError extends IntakeError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(message, "INVALID_INPUT", details);
    this.name = "InvalidInputError";
  }
}

export class DuplicateIntakeError extends IntakeError {
  constructor(
    message: string,
    public readonly existingIntakeId: string,
  ) {
    super(message, "DUPLICATE_DETECTED", { existingIntakeId });
    this.name = "DuplicateIntakeError";
  }
}

export class AdapterError extends IntakeError {
  constructor(message: string, adapterName: string, details?: Record<string, unknown>) {
    super(message, "ADAPTER_FAILURE", { adapterName, ...details });
    this.name = "AdapterError";
  }
}

export class UnsupportedInputError extends IntakeError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(message, "UNSUPPORTED_INPUT", details);
    this.name = "UnsupportedInputError";
  }
}

export class InternalIntakeError extends IntakeError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(message, "INTERNAL_ERROR", details);
    this.name = "InternalIntakeError";
  }
}