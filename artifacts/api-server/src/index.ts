import app from "./app";
import { startFulfillmentRetryWorker } from "./lib/fulfillmentQueue.js";
import { startNotificationRetryWorker } from "./lib/notificationQueue.js";
import { validateEnv } from "./lib/env.js";
import { seedInitialAdminUser } from "./lib/auth.js";

validateEnv();

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

app.listen(port, () => {
  console.log(`Server listening on port ${port}`);
  seedInitialAdminUser().catch((err) => {
    console.error("[Auth] Failed to seed initial admin user:", err);
    process.exit(1);
  });
  startFulfillmentRetryWorker();
  startNotificationRetryWorker();
});
