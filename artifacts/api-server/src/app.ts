import express, { type Express, type Request, type Response, type NextFunction } from "express";
import cors from "cors";
import router from "./routes/index.js";

const app: Express = express();

// Restrict CORS to the app's own origin in production
const allowedOrigins = process.env["ALLOWED_ORIGINS"]
  ? process.env["ALLOWED_ORIGINS"].split(",").map((o) => o.trim())
  : null; // null = allow all (dev)

app.use(cors({
  origin: allowedOrigins
    ? (origin, callback) => {
        // Allow same-origin requests (no Origin header) and listed origins
        if (!origin || allowedOrigins.includes(origin)) {
          callback(null, true);
        } else {
          callback(new Error(`CORS: origin ${origin} not allowed`));
        }
      }
    : true,
  credentials: true,
}));

// Stripe webhooks need the raw body — must come BEFORE express.json()
app.use("/api/webhook", express.raw({ type: "application/json" }));

app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));

app.use("/api", router);

// 404 fallback
app.use((_req: Request, res: Response) => {
  res.status(404).json({ error: "Not found" });
});

// Error handler
app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  console.error("Unhandled error:", err);
  res.status(500).json({ error: "Internal server error" });
});

export default app;
