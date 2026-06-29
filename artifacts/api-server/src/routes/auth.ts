import { Router } from "express";
import rateLimit from "express-rate-limit";
import { loginAdmin, logoutAdmin, requireAdmin, rotateCsrfToken } from "../lib/auth.js";
import { validateBody, loginSchema, passwordResetSchema } from "../lib/validation.js";
import { createAuditLog } from "../lib/audit.js";

const router = Router();

export const passwordResetLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 5,
  message: { error: "rate_limited" },
  standardHeaders: true,
  legacyHeaders: false,
});

router.post("/auth/login", validateBody(loginSchema), async (req, res) => {
  const body = req.body as { email?: string; username?: string; password: string };
  const email = body.email ?? body.username ?? "";
  const result = await loginAdmin(email, body.password, req, res);

  if (!result) {
    res.status(401).json({ error: "invalid_credentials" });
    return;
  }

  res.json({
    message: "Logged in",
    user: result.user,
    csrfToken: result.csrfToken,
  });
});

router.post("/auth/logout", requireAdmin, async (req, res) => {
  await logoutAdmin(req, res);
  res.json({ loggedOut: true });
});

router.get("/auth/verify", requireAdmin, async (req, res) => {
  const csrfToken = await rotateCsrfToken(req);
  res.json({ valid: true, user: req.adminUser, csrfToken });
});

router.post("/auth/password-reset", passwordResetLimiter, validateBody(passwordResetSchema), async (req, res) => {
  const { email } = req.body as { email: string };
  await createAuditLog({ req, action: "password_reset_requested", entityType: "admin_user", actorEmail: email });
  res.json({ accepted: true });
});

export default router;
