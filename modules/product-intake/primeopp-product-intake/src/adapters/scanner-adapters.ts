/**
 * Scanner adapter helpers and contracts.
 *
 * These adapters translate external scanner events into the
 * RawProductInput format consumed by the intake engine.
 *
 * PROVIDER-DEPENDENT: The actual scanner hardware/browser API
 * is provider-specific. These adapters define the translation layer.
 */

import type { ScannerEvent, RawProductInput, InputMethod } from "../types/index.js";

/**
 * Convert a ScannerEvent into a RawProductInput suitable for the intake engine.
 *
 * This is a pure translation — no validation or classification occurs here.
 */
export function scannerEventToInput(
  event: ScannerEvent,
  method?: InputMethod,
): RawProductInput {
  return {
    rawValue: event.value,
    inputMethod: method ?? (event.symbology ? "CAMERA_SCAN" : "HARDWARE_SCANNER"),
    sourceContext: {
      scannerSymbology: event.symbology,
      capturedAt: event.capturedAt,
      deviceId: event.deviceId,
      ...event.metadata,
    },
  };
}

/**
 * Simulate a USB/Bluetooth hardware scanner that acts as keyboard input.
 *
 * In real applications, hardware scanners often append a terminator character
 * (Enter/Newline). This helper strips that terminator and creates a ScannerEvent.
 *
 * @param rawKeyboardInput - The raw string from a keyboard-emulating scanner (often ends with \r or \n).
 * @param deviceId - Optional device identifier.
 */
export function hardwareScannerStringToEvent(
  rawKeyboardInput: string,
  deviceId?: string,
): ScannerEvent {
  // Hardware scanners typically terminate with \r\n, \r, or \n
  const value = rawKeyboardInput.replace(/[\r\n]+$/, "");
  return {
    value,
    capturedAt: new Date().toISOString(),
    deviceId,
  };
}

/**
 * Simulate a camera scanner result (e.g., from a browser-based barcode reader).
 *
 * @param detectedValue - The barcode value detected by the camera.
 * @param symbology - The barcode format detected (e.g., "EAN_13", "QR_CODE").
 * @param deviceId - Optional camera device identifier.
 */
export function cameraScanToEvent(
  detectedValue: string,
  symbology?: string,
  deviceId?: string,
): ScannerEvent {
  return {
    value: detectedValue,
    symbology,
    capturedAt: new Date().toISOString(),
    deviceId,
  };
}

/**
 * Create a RawProductInput from a direct API submission.
 *
 * @param value - The identifier string from the API payload.
 * @param additionalContext - Optional metadata from the API request.
 */
export function apiSubmissionToInput(
  value: string,
  additionalContext?: Record<string, unknown>,
): RawProductInput {
  return {
    rawValue: value,
    inputMethod: "API",
    sourceContext: additionalContext,
  };
}