import app from "./app";
import { startFulfillmentRetryWorker } from "./lib/fulfillmentQueue.js";
import { startNotificationRetryWorker } from "./lib/notificationQueue.js";
import { validateEnv } from "./lib/env.js";
import { seedInitialAdminUser } from "./lib/auth.js";

const env = validateEnv();

if (!env.STRIPE_SECRET_KEY || !env.STRIPE_WEBHOOK_SECRET) {
  console.warn(
    "[Boot] Stripe not configured (STRIPE_SECRET_KEY/STRIPE_WEBHOOK_SECRET missing) — " +
    "payment routes will fail closed with 503. No paid access will be granted.",
  );
}

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}
app.listen(port, "0.0.0.0", () => {
  console.log(`Server listening on port ${port}`);
  seedInitialAdminUser().catch((err) => {
    console.error("[Auth] Failed to seed initial admin user:", err);
    process.exit(1);
  });
  startFulfillmentRetryWorker();
  startNotificationRetryWorker();
});
