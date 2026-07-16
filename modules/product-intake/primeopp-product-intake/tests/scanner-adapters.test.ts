/**
 * Tests for scanner adapter helpers.
 */

import {
  scannerEventToInput,
  hardwareScannerStringToEvent,
  cameraScanToEvent,
  apiSubmissionToInput,
} from "../src/adapters/index.js";

describe("scannerEventToInput", () => {
  test("converts camera scanner event", () => {
    const event = {
      value: "036000291452",
      symbology: "UPC_A",
      capturedAt: "2025-01-15T10:30:00Z",
      deviceId: "cam-001",
      metadata: { resolution: "720p" },
    };

    const input = scannerEventToInput(event);
    expect(input.rawValue).toBe("036000291452");
    expect(input.inputMethod).toBe("CAMERA_SCAN");
    expect(input.sourceContext?.scannerSymbology).toBe("UPC_A");
    expect(input.sourceContext?.capturedAt).toBe("2025-01-15T10:30:00Z");
    expect(input.sourceContext?.resolution).toBe("720p");
  });

  test("defaults to HARDWARE_SCANNER when no symbology", () => {
    const event = {
      value: "036000291452",
      capturedAt: "2025-01-15T10:30:00Z",
    };

    const input = scannerEventToInput(event);
    expect(input.inputMethod).toBe("HARDWARE_SCANNER");
  });

  test("respects explicit method override", () => {
    const event = {
      value: "036000291452",
      capturedAt: "2025-01-15T10:30:00Z",
    };

    const input = scannerEventToInput(event, "API");
    expect(input.inputMethod).toBe("API");
  });
});

describe("hardwareScannerStringToEvent", () => {
  test("strips \\r\\n terminator", () => {
    const event = hardwareScannerStringToEvent("036000291452\r\n", "usb-01");
    expect(event.value).toBe("036000291452");
    expect(event.deviceId).toBe("usb-01");
    expect(event.capturedAt).toBeDefined();
  });

  test("strips \\r terminator", () => {
    const event = hardwareScannerStringToEvent("036000291452\r");
    expect(event.value).toBe("036000291452");
  });

  test("strips \\n terminator", () => {
    const event = hardwareScannerStringToEvent("036000291452\n");
    expect(event.value).toBe("036000291452");
  });

  test("handles input without terminator", () => {
    const event = hardwareScannerStringToEvent("036000291452");
    expect(event.value).toBe("036000291452");
  });
});

describe("cameraScanToEvent", () => {
  test("creates event with symbology", () => {
    const event = cameraScanToEvent("5901234123457", "EAN_13", "cam-front");
    expect(event.value).toBe("5901234123457");
    expect(event.symbology).toBe("EAN_13");
    expect(event.deviceId).toBe("cam-front");
  });

  test("works without optional fields", () => {
    const event = cameraScanToEvent("5901234123457");
    expect(event.value).toBe("5901234123457");
    expect(event.symbology).toBeUndefined();
    expect(event.deviceId).toBeUndefined();
  });
});

describe("apiSubmissionToInput", () => {
  test("creates API input", () => {
    const input = apiSubmissionToInput("036000291452", { requestId: "req-123" });
    expect(input.rawValue).toBe("036000291452");
    expect(input.inputMethod).toBe("API");
    expect(input.sourceContext?.requestId).toBe("req-123");
  });
});