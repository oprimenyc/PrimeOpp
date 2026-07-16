/**
 * Example 3: Hardware scanner-style input
 *
 * USB/Bluetooth barcode scanners typically emulate keyboard input
 * and append a terminator (Enter key = \r\n). This example shows
 * how to process such input.
 */

import {
  ProductIntakeService,
  InMemoryDeduplicationStore,
  hardwareScannerStringToEvent,
  scannerEventToInput,
} from "../src/index.js";

async function main() {
  const service = new ProductIntakeService({
    deduplicationStore: new InMemoryDeduplicationStore(),
  });

  // Raw string from a USB barcode scanner (includes \r\n terminator)
  const rawScannerString = "036000291452\r\n";

  // Step 1: Convert to a ScannerEvent (strips terminator)
  const event = hardwareScannerStringToEvent(rawScannerString, "usb-scanner-01");

  // Step 2: Convert to RawProductInput
  const input = scannerEventToInput(event);

  // Step 3: Process
  const record = await service.intake(input);

  console.log("=== Hardware Scanner Intake ===");
  console.log(JSON.stringify(record, null, 2));
  console.log(`\nInput Method: ${record.inputMethod}`);
  console.log(`Identifier: ${record.identifier?.normalizedValue}`);
  console.log(`Device: ${record.sourceContext?.deviceId}`);
}

main().catch(console.error);