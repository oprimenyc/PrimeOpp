import express, { type Express, type Request, type Response, type NextFunction } from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import cookieParser from "cookie-parser";
import { randomUUID } from "node:crypto";
import router from "./routes/index.js";

const app: Express = express();

app.use((req, res, next) => {
  const correlationId = req.headers["x-correlation-id"];
  req.id = typeof correlationId === "string" && correlationId.length <= 100 ? correlationId : randomUUID();
  res.setHeader("x-correlation-id", req.id);
  next();
});

// Trust the first proxy (Replit's load balancer) so rate limiting uses real IPs
// from X-Forwarded-For rather than the proxy's internal IP
app.set("trust proxy", 1);

// ── Security headers (helmet) ─────────────────────────────────────────────────
// Sets X-Content-Type-Options, X-Frame-Options, HSTS, Referrer-Policy, etc.
app.use(helmet({
  // API only — no HTML served here, so CSP not needed
  contentSecurityPolicy: false,
}));

// ── CORS ──────────────────────────────────────────────────────────────────────
const allowedOrigins = process.env["ALLOWED_ORIGINS"]
  ? process.env["ALLOWED_ORIGINS"].split(",").map((o) => o.trim())
  : null;

app.use(cors({
  origin: allowedOrigins
    ? (origin, callback) => {
        if (!origin || allowedOrigins.includes(origin)) {
          callback(null, true);
        } else {
          callback(new Error(`CORS: origin ${origin} not allowed`));
        }
      }
    : true,
  credentials: true,
}));
app.use(cookieParser());

// ── Rate limiters ─────────────────────────────────────────────────────────────

// Brute-force protection: 5 login attempts per IP per 15 minutes
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: { error: "Too many login attempts — try again in 15 minutes" },
  standardHeaders: true,
  legacyHeaders: false,
});

// Checkout abuse prevention: 15 sessions per IP per hour
const checkoutLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 15,
  message: { error: "Too many checkout attempts — try again later" },
  standardHeaders: true,
  legacyHeaders: false,
});

const adminLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 120,
  message: { error: "rate_limited" },
  standardHeaders: true,
  legacyHeaders: false,
});

const uploadLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 30,
  message: { error: "rate_limited" },
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => ["GET", "HEAD", "OPTIONS"].includes(req.method),
});

// General public API: 300 requests per IP per minute (generous for a storefront)
const publicApiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 300,
  message: { error: "Rate limit exceeded — slow down" },
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => req.path === "/healthz",
});

// Apply rate limiters BEFORE body parsing
app.use("/api/auth/login", loginLimiter);
app.use("/api/checkout/session", checkoutLimiter);
app.use("/api/products", uploadLimiter);
app.use("/api/auth", adminLimiter);
app.use("/api/orders", adminLimiter);
app.use("/api", publicApiLimiter);

// ── Body parsing ──────────────────────────────────────────────────────────────
// Stripe webhooks need the raw body — must come BEFORE express.json()
app.use("/api/webhook", express.raw({ type: "application/json" }));

// Tighten body size: public endpoints don't need more than 100kb;
// admin product uploads (base64 images) can be larger
app.use("/api/products", express.json({ limit: "12mb" }));
app.use(express.json({ limit: "100kb" }));
app.use(express.urlencoded({ extended: true }));

app.use("/api", router);

// ── 404 fallback ──────────────────────────────────────────────────────────────
app.use((_req: Request, res: Response) => {
  res.status(404).json({ error: "Not found" });
});

// ── Global error handler ──────────────────────────────────────────────────────
app.use((err: Error, req: Request, res: Response, _next: NextFunction) => {
  // Don't leak internal error details to clients
  const isKnownError = err.message?.startsWith("CORS:");
  console.error(JSON.stringify({
    level: "error",
    correlationId: req.id,
    message: err.message,
    stack: process.env["NODE_ENV"] === "production" ? undefined : err.stack,
  }));
  res.status(isKnownError ? 403 : 500).json({
    error: isKnownError ? err.message : "internal_server_error",
    correlationId: req.id,
  });
});

export default app;
