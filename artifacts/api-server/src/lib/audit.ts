import type { Request } from "express";
import { query } from "./db.js";

type AuditPayload = {
  req?: Request;
  action: string;
  entityType: string;
  entityId?: string | number | null;
  before?: unknown;
  after?: unknown;
  actorId?: number | null;
  actorEmail?: string | null;
};

export async function createAuditLog(payload: AuditPayload): Promise<void> {
  const actor = payload.req?.adminUser;

  await query(
    `INSERT INTO audit_log
      (actor_id, actor_email, actor_ip, action, entity_type, entity_id, old_value, new_value)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
    [
      payload.actorId ?? actor?.id ?? null,
      payload.actorEmail ?? actor?.email ?? null,
      payload.req?.ip ?? null,
      payload.action,
      payload.entityType,
      payload.entityId === undefined || payload.entityId === null ? null : String(payload.entityId),
      payload.before === undefined ? null : JSON.stringify(payload.before),
      payload.after === undefined ? null : JSON.stringify(payload.after),
    ],
  );
}
