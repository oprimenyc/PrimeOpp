import { query, transaction } from "./db.js";
import { fulfillOrder, type OrderItem, type ShippingAddress } from "./fulfillment.js";
import { canTransitionOrder, isOrderStatus, transitionOrderStatus } from "./orderState.js";

const RETRY_DELAYS_MINUTES = [15, 30, 60, 120];
const MAX_ATTEMPTS = 5;
const STALE_PROCESSING_MINUTES = Number(process.env["FULFILLMENT_STALE_MINUTES"] ?? 10);

type OrderForFulfillment = {
  id: number;
  status: string;
  customer_email: string;
  shipping_address: ShippingAddress | null;
  items: OrderItem[] | null;
};

type FulfillmentJob = {
  id: number;
  order_id: number;
  attempts: number;
};

function retryDelayMinutes(attempts: number): number {
  return RETRY_DELAYS_MINUTES[Math.min(Math.max(attempts - 1, 0), RETRY_DELAYS_MINUTES.length - 1)] ?? 120;
}

function isSuccessfulFulfillmentStatus(status: string): boolean {
  return status === "submitted" || status === "skipped" || status === "no_items";
}

export async function processFulfillmentJob(jobId: number): Promise<void> {
  const claimed = await transaction(async (client) => {
    const jobResult = await client.query<FulfillmentJob>(
      `UPDATE fulfillment_jobs
       SET status='processing', attempts=attempts + 1, updated_at=NOW()
       WHERE id=$1 AND status IN ('queued','failed')
       RETURNING id, order_id, attempts`,
      [jobId],
    );

    const job = jobResult.rows[0];
    if (!job) return null;

    const orderResult = await client.query<OrderForFulfillment>(
      "SELECT id, status, customer_email, shipping_address, items FROM orders WHERE id=$1 FOR UPDATE",
      [job.order_id],
    );

    return { job, order: orderResult.rows[0] ?? null };
  });

  if (!claimed) return;

  const { job, order } = claimed;

  if (!order) {
    await markJobFailed(job, "Order no longer exists");
    return;
  }

  if (!isOrderStatus(order.status) || !canTransitionOrder(order.status, "processing")) {
    await markJobFailed(job, `Order status ${order.status} cannot be fulfilled`);
    return;
  }

  if (!order.shipping_address?.line1 || !Array.isArray(order.items) || order.items.length === 0) {
    await markJobFailed(job, "Order is missing shipping address or items");
    return;
  }

  try {
    const results = await fulfillOrder(order.items, order.shipping_address, order.customer_email, String(order.id));
    const failed = results.filter((result) => !isSuccessfulFulfillmentStatus(result.status));

    if (failed.length > 0) {
      throw new Error(failed.map((result) => `${result.provider}: ${result.status}`).join("; "));
    }

    const summary = results.map((result) => result.status).join(", ");
    const providers = results.map((result) => result.provider).join(", ");
    const providerOrderIds = results.map((result) => result.order_id).join(", ");

    await transaction(async (client) => {
      const current = await client.query<{ status: string }>(
        "SELECT status FROM orders WHERE id=$1 FOR UPDATE",
        [order.id],
      );
      const from = current.rows[0]?.status;
      if (!from) throw new Error("Order disappeared before completion");
      const processing = transitionOrderStatus(from, "processing");
      const fulfilled = transitionOrderStatus(processing, "fulfilled");

      await client.query(
        `UPDATE orders
         SET status=$1,
             fulfillment_provider=$2,
             fulfillment_order_id=$3,
             fulfillment_status=$4,
             updated_at=NOW()
         WHERE id=$5`,
        [fulfilled, providers, providerOrderIds, summary || "completed", order.id],
      );
      await client.query(
        "UPDATE fulfillment_jobs SET status='completed', last_error=NULL, next_retry_at=NULL, updated_at=NOW() WHERE id=$1",
        [job.id],
      );
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown fulfillment error";
    await query("UPDATE orders SET fulfillment_status=$1, updated_at=NOW() WHERE id=$2", [`retry_pending: ${message}`, order.id]);
    await markJobFailed(job, message);
  }
}

export async function recoverStaleFulfillmentJobs(): Promise<number> {
  const recovered = await query<{ id: number }>(
    `UPDATE fulfillment_jobs
     SET status='failed',
         last_error='Recovered stale processing job',
         next_retry_at=NOW(),
         updated_at=NOW()
     WHERE status='processing'
       AND updated_at < NOW() - ($1::text::interval)
     RETURNING id`,
    [`${STALE_PROCESSING_MINUTES} minutes`],
  );

  return recovered.length;
}

async function markJobFailed(job: FulfillmentJob, error: string): Promise<void> {
  const exhausted = job.attempts >= MAX_ATTEMPTS;
  const delay = retryDelayMinutes(job.attempts);

  await query(
    `UPDATE fulfillment_jobs
     SET status='failed',
         last_error=$1,
         next_retry_at=$2,
         updated_at=NOW()
     WHERE id=$3`,
    [
      error,
      exhausted ? null : new Date(Date.now() + delay * 60 * 1000).toISOString(),
      job.id,
    ],
  );
}

export function processFulfillmentJobSoon(jobId: number): void {
  setTimeout(() => {
    processFulfillmentJob(jobId).catch((err) => {
      console.error("[FulfillmentQueue] Job failed outside retry handler:", err);
    });
  }, 0);
}

export async function processDueFulfillmentJobs(limit = 10): Promise<number> {
  await recoverStaleFulfillmentJobs();

  const jobs = await query<{ id: number }>(
    `SELECT id
     FROM fulfillment_jobs
     WHERE status IN ('queued','failed')
       AND attempts < $1
       AND (next_retry_at IS NULL OR next_retry_at <= NOW())
     ORDER BY created_at ASC
     LIMIT $2`,
    [MAX_ATTEMPTS, limit],
  );

  for (const job of jobs) {
    await processFulfillmentJob(job.id);
  }

  return jobs.length;
}

export function startFulfillmentRetryWorker(): NodeJS.Timeout {
  return setInterval(() => {
    processDueFulfillmentJobs().catch((err) => {
      console.error("[FulfillmentQueue] Retry scan failed:", err);
    });
  }, 60_000);
}
