/**
 * Batch intake processor.
 *
 * Processes multiple RawProductInput items, collecting individual results
 * and aggregate statistics. Individual item failures do NOT fail the batch.
 */

import type {
  BatchProductIntakeRequest,
  BatchProductIntakeResult,
  ProductIntakeRecord,
} from "../types/index.js";

import { ProductIntakeService } from "../application/product-intake-service.js";

/**
 * Process a batch of product intake requests.
 *
 * Each item is processed independently. If one item fails, the batch
 * continues with remaining items. The result includes per-item outcomes
 * and aggregate statistics.
 */
export async function processBatch(
  service: ProductIntakeService,
  request: BatchProductIntakeRequest,
): Promise<BatchProductIntakeResult> {
  const items: ProductIntakeRecord[] = [];
  let accepted = 0;
  let rejected = 0;
  let duplicates = 0;
  let needsReview = 0;

  for (const rawInput of request.items) {
    try {
      const record = await service.intake(rawInput);
      items.push(record);

      switch (record.status) {
        case "ACCEPTED":
          accepted++;
          break;
        case "REJECTED":
          rejected++;
          break;
        case "DUPLICATE":
          duplicates++;
          break;
        case "NEEDS_REVIEW":
          needsReview++;
          break;
      }
    } catch {
      // If the service throws (unexpected), create a synthetic rejected record
      const syntheticRecord: ProductIntakeRecord = {
        intakeId: crypto.randomUUID(),
        createdAt: new Date().toISOString(),
        inputMethod: rawInput.inputMethod,
        status: "REJECTED",
        validationIssues: [
          {
            code: "INTERNAL_BATCH_ERROR",
            message: "An unexpected error occurred while processing this item.",
            severity: "ERROR",
          },
        ],
        sourceContext: rawInput.sourceContext,
      };
      items.push(syntheticRecord);
      rejected++;
    }
  }

  return {
    batchId: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
    totalReceived: request.items.length,
    accepted,
    rejected,
    duplicates,
    needsReview,
    items,
  };
}