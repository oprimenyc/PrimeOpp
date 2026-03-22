// auth.ts — simple JWT-based admin authentication
// Hardcoded credentials for now — easy to upgrade later

import jwt from "jsonwebtoken";
import type { Request, Response, NextFunction } from "express";

// Admin credentials — change these to whatever you want!
const ADMIN_USERNAME = "admin";
const ADMIN_PASSWORD = "primeopp2025";

// Secret used to sign JWT tokens — keep this private!
const JWT_SECRET = process.env.JWT_SECRET ?? "primeopp-super-secret-2025";

// How long a login token lasts
const TOKEN_EXPIRY = "7d";

// Check username and password — returns a signed token or null
export function login(username: string, password: string): string | null {
  if (username === ADMIN_USERNAME && password === ADMIN_PASSWORD) {
    return jwt.sign({ role: "admin" }, JWT_SECRET, { expiresIn: TOKEN_EXPIRY });
  }
  return null;
}

// Middleware: protects routes that need admin login
export function requireAdmin(req: Request, res: Response, next: NextFunction): void {
  // Token comes in the Authorization header: "Bearer <token>"
  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;

  if (!token) {
    res.status(401).json({ error: "Not logged in" });
    return;
  }

  try {
    jwt.verify(token, JWT_SECRET);
    next(); // Token is valid — continue to the route
  } catch {
    res.status(401).json({ error: "Token expired or invalid" });
  }
}
