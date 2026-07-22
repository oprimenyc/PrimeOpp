import { z } from "zod";

const envSchema = z.object({
  DATABASE_URL: z.string().min(1),
  SESSION_SECRET: z.string().min(32),
  ADMIN_EMAIL: z.string().email(),
  ADMIN_PASSWORD: z.string().min(12),
  // Optional: payment routes fail closed (503) at the route level (see
  // getStripe() in routes/orders.ts) when these are absent, so a missing
  // Stripe provider must not prevent the rest of the app from booting.
  STRIPE_SECRET_KEY: z.string().min(1).optional(),
  STRIPE_WEBHOOK_SECRET: z.string().min(1).optional(),
});

export type AppEnv = z.infer<typeof envSchema>;

let cachedEnv: AppEnv | null = null;

export function validateEnv(): AppEnv {
  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    const details = parsed.error.issues
      .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
      .join("; ");
    throw new Error(`Missing or invalid required environment variables: ${details}`);
  }

  cachedEnv = parsed.data;
  return parsed.data;
}

export function getEnv(): AppEnv {
  return cachedEnv ?? validateEnv();
}
