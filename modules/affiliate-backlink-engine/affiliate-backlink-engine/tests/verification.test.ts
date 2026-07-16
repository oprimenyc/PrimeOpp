import { describe, it, expect } from "vitest";
import {
  VerificationStatus,
  isVerified,
  isActionable,
  isStale,
  isBlocked,
  shouldRevalidate,
  transitionToStaleIfNeeded,
  DEFAULT_REVALIDATE_MS,
  VERIFICATION_STATUSES
} from "../src/domain/verification.js";

describe("verification status", () => {
  it("exposes all six canonical statuses", () => {
    expect(VERIFICATION_STATUSES).toEqual([
      "DISCOVERED",
      "VERIFIED",
      "INFERRED",
      "STALE",
      "UNAVAILABLE",
      "BLOCKED"
    ]);
  });

  it("isVerified only true for VERIFIED", () => {
    expect(isVerified("VERIFIED")).toBe(true);
    expect(isVerified("DISCOVERED")).toBe(false);
    expect(isVerified(undefined)).toBe(false);
  });

  it("isActionable for VERIFIED, DISCOVERED, INFERRED", () => {
    expect(isActionable("VERIFIED")).toBe(true);
    expect(isActionable("DISCOVERED")).toBe(true);
    expect(isActionable("INFERRED")).toBe(true);
    expect(isActionable("STALE")).toBe(false);
    expect(isActionable("BLOCKED")).toBe(false);
    expect(isActionable("UNAVAILABLE")).toBe(false);
  });

  it("isStale only true for STALE", () => {
    expect(isStale("STALE")).toBe(true);
    expect(isStale("VERIFIED")).toBe(false);
  });

  it("isBlocked true for BLOCKED and UNAVAILABLE", () => {
    expect(isBlocked("BLOCKED")).toBe(true);
    expect(isBlocked("UNAVAILABLE")).toBe(true);
    expect(isBlocked("VERIFIED")).toBe(false);
  });

  it("shouldRevalidate returns true when verifiedAt is undefined", () => {
    expect(shouldRevalidate(undefined)).toBe(true);
  });

  it("shouldRevalidate returns false within window", () => {
    const now = Date.now();
    expect(shouldRevalidate(now - 1000, now)).toBe(false);
  });

  it("shouldRevalidate returns true past window", () => {
    const now = Date.now();
    expect(shouldRevalidate(now - DEFAULT_REVALIDATE_MS - 1, now)).toBe(true);
  });

  it("transitionToStaleIfNeeded flips VERIFIED to STALE past window", () => {
    const now = Date.now();
    const old = now - DEFAULT_REVALIDATE_MS - 1;
    expect(transitionToStaleIfNeeded("VERIFIED", old, now)).toBe("STALE");
    expect(transitionToStaleIfNeeded("VERIFIED", now, now)).toBe("VERIFIED");
    expect(transitionToStaleIfNeeded("DISCOVERED", old, now)).toBe("DISCOVERED");
  });
});
