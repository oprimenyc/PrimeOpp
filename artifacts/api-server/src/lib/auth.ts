import { createHash, randomBytes } from "node:crypto";
import type { Request, Response, NextFunction } from "express";
import { query, transaction } from "./db.js";
import { getEnv } from "./env.js";
import { hashPassword, verifyPassword } from "./password.js";
import { createAuditLog } from "./audit.js";

export const ADMIN_SESSION_COOKIE = "__Host-primeopp_admin_session";
export const CSRF_HEADER = "x-csrf-token";

const IDLE_TIMEOUT_MS = 30 * 60 * 1000;
const ABSOLUTE_TIMEOUT_MS = 12 * 60 * 60 * 1000;
const LOCKOUT_ATTEMPTS = 5;
const LOCKOUT_MS = 15 * 60 * 1000;

export const ADMIN_ROLES = [
  "owner",
  "super_admin",
  "admin",
  "support",
  "marketing",
  "finance",
  "fulfillment",
] as const;

export type AdminRole = typeof ADMIN_ROLES[number];

export type Permission =
  | "products:read"
  | "products:write"
  | "products:delete"
  | "orders:read"
  | "orders:write"
  | "fulfillment:retry"
  | "admin:manage"
  | "settings:write"
  | "audit:read"
  | "marketing:write"
  | "finance:read";

const ROLE_PERMISSIONS: Record<AdminRole, Permission[]> = {
  owner: ["products:read", "products:write", "products:delete", "orders:read", "orders:write", "fulfillment:retry", "admin:manage", "settings:write", "audit:read", "marketing:write", "finance:read"],
  super_admin: ["products:read", "products:write", "products:delete", "orders:read", "orders:write", "fulfillment:retry", "admin:manage", "settings:write", "audit:read", "marketing:write", "finance:read"],
  admin: ["products:read", "products:write", "orders:read", "orders:write", "fulfillment:retry", "marketing:write"],
  support: ["orders:read", "orders:write", "fulfillment:retry"],
  marketing: ["products:read", "products:write", "marketing:write"],
  finance: ["orders:read", "finance:read"],
  fulfillment: ["orders:read", "fulfillment:retry"],
};

type AdminUserRow = {
  id: number;
  email: string;
  password_hash: string;
  role: AdminRole;
  is_active: boolean;
  email_verified_at: Date | string | null;
  failed_login_attempts: number;
  locked_until: Date | string | null;
};

type SessionRow = {
  id: number;
  admin_user_id: number;
  session_token_hash: string;
  csrf_token_hash: string;
  created_at: Date | string;
  last_seen_at: Date | string;
  expires_at: Date | string;
  revoked_at: Date | string | null;
  email: string;
  role: AdminRole;
  is_active: boolean;
};

function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function secureCookieOptions(maxAgeMs: number) {
  return {
    httpOnly: true,
    secure: true,
    sameSite: "strict" as const,
    path: "/",
    maxAge: maxAgeMs,
  };
}

function clearCookie(res: Response): void {
  res.clearCookie(ADMIN_SESSION_COOKIE, {
    httpOnly: true,
    secure: true,
    sameSite: "strict",
    path: "/",
  });
}

function isExpired(date: Date | string): boolean {
  return new Date(date).getTime() <= Date.now();
}

function isUnsafeMethod(method: string): boolean {
  return !["GET", "HEAD", "OPTIONS"].includes(method.toUpperCase());
}

function hasPermission(role: AdminRole, permission: Permission): boolean {
  return ROLE_PERMISSIONS[role].includes(permission);
}

export async function seedInitialAdminUser(): Promise<void> {
  const env = getEnv();
  const rows = await query<{ count: string }>("SELECT COUNT(*)::text AS count FROM admin_users");
  if (Number(rows[0]?.count ?? 0) > 0) return;

  await query(
    `INSERT INTO admin_users (email, password_hash, role, is_active, email_verified_at)
     VALUES ($1,$2,'owner',true,NOW())`,
    [env.ADMIN_EMAIL.toLowerCase(), hashPassword(env.ADMIN_PASSWORD)],
  );
  console.log("[Auth] Seeded initial owner admin user.");
}

export async function loginAdmin(
  email: string,
  password: string,
  req: Request,
  res: Response,
): Promise<{ user: { id: number; email: string; role: AdminRole }; csrfToken: string } | null> {
  const normalizedEmail = email.toLowerCase();
  const users = await query<AdminUserRow>("SELECT * FROM admin_users WHERE lower(email)=lower($1)", [normalizedEmail]);
  const user = users[0];

  if (!user || !user.is_active || (user.locked_until && !isExpired(user.locked_until))) {
    await createAuditLog({ req, action: "admin_login_failed", entityType: "admin_user", actorEmail: normalizedEmail });
    return null;
  }

  if (!verifyPassword(password, user.password_hash)) {
    const attempts = user.failed_login_attempts + 1;
    const lockedUntil = attempts >= LOCKOUT_ATTEMPTS ? new Date(Date.now() + LOCKOUT_MS).toISOString() : null;
    await query(
      "UPDATE admin_users SET failed_login_attempts=$1, locked_until=$2 WHERE id=$3",
      [attempts, lockedUntil, user.id],
    );
    await createAuditLog({ req, action: "admin_login_failed", entityType: "admin_user", entityId: user.id, actorEmail: user.email });
    return null;
  }

  const sessionToken = randomBytes(32).toString("base64url");
  const csrfToken = randomBytes(32).toString("base64url");

  await transaction(async (client) => {
    await client.query("UPDATE admin_sessions SET revoked_at=NOW() WHERE admin_user_id=$1 AND revoked_at IS NULL", [user.id]);
    await client.query(
      `INSERT INTO admin_sessions
        (admin_user_id, session_token_hash, csrf_token_hash, ip_address, user_agent, expires_at)
       VALUES ($1,$2,$3,$4,$5,NOW() + ($6::text::interval))`,
      [user.id, sha256(sessionToken), sha256(csrfToken), req.ip ?? null, req.headers["user-agent"] ?? null, "12 hours"],
    );
    await client.query(
      "UPDATE admin_users SET failed_login_attempts=0, locked_until=NULL, last_login=NOW() WHERE id=$1",
      [user.id],
    );
  });

  res.cookie(ADMIN_SESSION_COOKIE, sessionToken, secureCookieOptions(ABSOLUTE_TIMEOUT_MS));
  await createAuditLog({ req, action: "admin_login_success", entityType: "admin_user", entityId: user.id, actorId: user.id, actorEmail: user.email });

  return { user: { id: user.id, email: user.email, role: user.role }, csrfToken };
}

export async function logoutAdmin(req: Request, res: Response): Promise<void> {
  const token = req.cookies?.[ADMIN_SESSION_COOKIE] as string | undefined;
  if (token) {
    await query("UPDATE admin_sessions SET revoked_at=NOW() WHERE session_token_hash=$1 AND revoked_at IS NULL", [sha256(token)]);
  }
  await createAuditLog({ req, action: "admin_logout", entityType: "admin_session" });
  clearCookie(res);
}

export async function rotateCsrfToken(req: Request): Promise<string | null> {
  const token = req.cookies?.[ADMIN_SESSION_COOKIE] as string | undefined;
  if (!token) return null;

  const csrfToken = randomBytes(32).toString("base64url");
  const rows = await query<{ id: number }>(
    `UPDATE admin_sessions
     SET csrf_token_hash=$1, last_seen_at=NOW()
     WHERE session_token_hash=$2 AND revoked_at IS NULL
     RETURNING id`,
    [sha256(csrfToken), sha256(token)],
  );

  return rows[0] ? csrfToken : null;
}

export async function loadAdminSession(req: Request, res: Response, next: NextFunction): Promise<void> {
  const token = req.cookies?.[ADMIN_SESSION_COOKIE] as string | undefined;
  if (!token) {
    res.status(401).json({ error: "not_authenticated" });
    return;
  }

  const rows = await query<SessionRow>(
    `SELECT s.*, u.email, u.role, u.is_active
     FROM admin_sessions s
     JOIN admin_users u ON u.id=s.admin_user_id
     WHERE s.session_token_hash=$1
     LIMIT 1`,
    [sha256(token)],
  );
  const session = rows[0];

  if (!session || session.revoked_at || !session.is_active || isExpired(session.expires_at)) {
    clearCookie(res);
    res.status(401).json({ error: "session_expired" });
    return;
  }

  if (Date.now() - new Date(session.last_seen_at).getTime() > IDLE_TIMEOUT_MS) {
    await query("UPDATE admin_sessions SET revoked_at=NOW() WHERE id=$1", [session.id]);
    clearCookie(res);
    res.status(401).json({ error: "session_idle_timeout" });
    return;
  }

  if (isUnsafeMethod(req.method)) {
    const csrf = req.headers[CSRF_HEADER] as string | undefined;
    if (!csrf || sha256(csrf) !== session.csrf_token_hash) {
      res.status(403).json({ error: "csrf_failed" });
      return;
    }
  }

  await query("UPDATE admin_sessions SET last_seen_at=NOW() WHERE id=$1", [session.id]);
  req.adminUser = { id: session.admin_user_id, email: session.email, role: session.role };
  next();
}

export function requireAdmin(req: Request, res: Response, next: NextFunction): void {
  void loadAdminSession(req, res, next);
}

export function requirePermission(permission: Permission) {
  return (req: Request, res: Response, next: NextFunction): void => {
    void loadAdminSession(req, res, () => {
      const role = req.adminUser?.role;
      if (!role || !hasPermission(role, permission)) {
        res.status(403).json({ error: "forbidden" });
        return;
      }
      next();
    });
  };
}

export function requireRole(roles: AdminRole[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    void loadAdminSession(req, res, () => {
      if (!req.adminUser || !roles.includes(req.adminUser.role)) {
        res.status(403).json({ error: "forbidden" });
        return;
      }
      next();
    });
  };
}
