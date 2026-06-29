import { query, transaction } from "./db.js";
import { sendOrderConfirmation } from "./email.js";
import type { OrderItem, ShippingAddress } from "./fulfillment.js";

const MAX_ATTEMPTS = 5;
const RETRY_DELAYS_MINUTES = [15, 30, 60, 120];

type NotificationJob = {
  id: number;
  order_id: number;
  attempts: number;
};

type OrderForEmail = {
  id: number;
  customer_email: string;
  customer_name: string | null;
  shipping_address: ShippingAddress | null;
  items: OrderItem[];
  total: string | number | null;
};

function retryDelayMinutes(attempts: number): number {
  return RETRY_DELAYS_MINUTES[Math.min(Math.max(attempts - 1, 0), RETRY_DELAYS_MINUTES.length - 1)] ?? 120;
}

export async function processNotificationJob(jobId: number): Promise<void> {
  const claimed = await transaction(async (client) => {
    const jobResult = await client.query<NotificationJob>(
      `UPDATE notification_jobs
       SET status='processing', attempts=attempts + 1, updated_at=NOW()
       WHERE id=$1 AND status IN ('queued','failed')
       RETURNING id, order_id, attempts`,
      [jobId],
    );
    const job = jobResult.rows[0];
    if (!job) return null;

    const orderResult = await client.query<OrderForEmail>(
      "SELECT id, customer_email, customer_name, shipping_address, items, total FROM orders WHERE id=$1",
      [job.order_id],
    );

    return { job, order: orderResult.rows[0] ?? null };
  });

  if (!claimed) return;

  const { job, order } = claimed;
  if (!order) {
    await markNotificationFailed(job, "Order no longer exists");
    return;
  }

  try {
    await sendOrderConfirmation({
      customerEmail: order.customer_email,
      customerName: order.customer_name ?? "",
      orderId: order.id,
      items: (Array.isArray(order.items) ? order.items : []).map((item) => ({
        title: item.title,
        size: item.size,
        color: item.color,
        quantity: item.quantity,
        price: item.price,
      })),
      total: Number(order.total ?? 0),
      shippingAddress: {
        line1: order.shipping_address?.line1 ?? "",
        city: order.shipping_address?.city ?? "",
        state: order.shipping_address?.state ?? "",
        postal_code: order.shipping_address?.postal_code ?? "",
        country: order.shipping_address?.country ?? "US",
      },
    });

    await query(
      "UPDATE notification_jobs SET status='completed', last_error=NULL, next_retry_at=NULL, updated_at=NOW() WHERE id=$1",
      [job.id],
    );
  } catch (err) {
    await markNotificationFailed(job, err instanceof Error ? err.message : "Unknown notification error");
  }
}

async function markNotificationFailed(job: NotificationJob, error: string): Promise<void> {
  const exhausted = job.attempts >= MAX_ATTEMPTS;
  const delay = retryDelayMinutes(job.attempts);

  await query(
    `UPDATE notification_jobs
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

export function processNotificationJobSoon(jobId: number): void {
  setTimeout(() => {
    processNotificationJob(jobId).catch((err) => {
      console.error("[NotificationQueue] Job failed outside retry handler:", err);
    });
  }, 0);
}

export async function processDueNotificationJobs(limit = 10): Promise<number> {
  const jobs = await query<{ id: number }>(
    `SELECT id
     FROM notification_jobs
     WHERE status IN ('queued','failed')
       AND attempts < $1
       AND (next_retry_at IS NULL OR next_retry_at <= NOW())
     ORDER BY created_at ASC
     LIMIT $2`,
    [MAX_ATTEMPTS, limit],
  );

  for (const job of jobs) {
    await processNotificationJob(job.id);
  }

  return jobs.length;
}

export function startNotificationRetryWorker(): NodeJS.Timeout {
  return setInterval(() => {
    processDueNotificationJobs().catch((err) => {
      console.error("[NotificationQueue] Retry scan failed:", err);
    });
  }, 60_000);
}
