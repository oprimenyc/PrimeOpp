// auth.ts — JWT-based admin authentication
// Credentials and secret come from environment variables.
// Hardcoded fallbacks exist for local dev ONLY — production requires real env vars.

import jwt from "jsonwebtoken";
import type { Request, Response, NextFunction } from "express";

const isProduction = process.env["NODE_ENV"] === "production";

function getAdminUsername(): string {
  const val = process.env["ADMIN_USERNAME"];
  if (!val && isProduction) {
    throw new Error("CRITICAL: ADMIN_USERNAME env var not set in production");
  }
  return val ?? "admin";
}

function getAdminPassword(): string {
  const val = process.env["ADMIN_PASSWORD"];
  if (!val && isProduction) {
    throw new Error("CRITICAL: ADMIN_PASSWORD env var not set in production");
  }
  return val ?? "primeopp2025";
}

function getJwtSecret(): string {
  const val = process.env["JWT_SECRET"];
  if (!val) {
    if (isProduction) {
      throw new Error("CRITICAL: JWT_SECRET env var not set in production");
    }
    console.warn("[Auth] JWT_SECRET not set — using insecure default (dev only)");
    return "primeopp-dev-secret-CHANGE-IN-PRODUCTION";
  }
  return val;
}

const TOKEN_EXPIRY = "7d";

export function login(username: string, password: string): string | null {
  try {
    if (username === getAdminUsername() && password === getAdminPassword()) {
      return jwt.sign({ role: "admin" }, getJwtSecret(), { expiresIn: TOKEN_EXPIRY });
    }
    return null;
  } catch (err) {
    console.error("[Auth] login error:", err);
    return null;
  }
}

export function requireAdmin(req: Request, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;

  if (!token) {
    res.status(401).json({ error: "Not logged in" });
    return;
  }

  try {
    jwt.verify(token, getJwtSecret());
    next();
  } catch {
    res.status(401).json({ error: "Token expired or invalid" });
  }
}
