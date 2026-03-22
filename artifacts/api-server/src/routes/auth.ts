// auth routes — /api/auth/login and /api/auth/verify
import { Router } from "express";
import { login, requireAdmin } from "../lib/auth.js";

const router = Router();

// POST /api/auth/login — accepts { username, password }, returns { token }
router.post("/auth/login", (req, res) => {
  const { username, password } = req.body as { username?: string; password?: string };

  if (!username || !password) {
    res.status(400).json({ error: "Username and password required" });
    return;
  }

  const token = login(username, password);
  if (!token) {
    res.status(401).json({ error: "Wrong username or password" });
    return;
  }

  res.json({ token, message: "Logged in!" });
});

// GET /api/auth/verify — checks if the current token is still valid
router.get("/auth/verify", requireAdmin, (_req, res) => {
  res.json({ valid: true });
});

export default router;
