import { randomBytes } from "node:crypto";
import { type Database } from "../database";
import { tokenLookup } from "../tokens";
import type { McpActorType, McpScope, Locale } from "@tuevento/contracts";
import type { McpAuthContext } from "./mcp.types";

export interface CreateMcpTokenParams {
  actorType: McpActorType;
  userId?: string;
  invitationId?: string;
  clientName?: string;
  scopes?: McpScope[];
  expiresInSeconds?: number;
}

export async function createMcpToken(
  db: Database,
  params: CreateMcpTokenParams,
): Promise<{ token: string; expiresAt: Date }> {
  const { actorType, userId, invitationId, clientName = "", scopes = ["mcp:read", "mcp:write"] } = params;

  if (actorType === "guest") {
    if (!invitationId) throw new Error("invitationId is required for guest tokens");
    if (userId) throw new Error("userId cannot be provided for guest tokens");
  } else {
    if (!userId) throw new Error("userId is required for organizer/provider tokens");
    if (invitationId) throw new Error("invitationId cannot be provided for organizer/provider tokens");
  }

  // Invitados: 2 horas por defecto; organizadores/proveedores: 30 días
  const defaultTtl = actorType === "guest" ? 2 * 3600 : 30 * 24 * 3600;
  const ttl = params.expiresInSeconds ?? defaultTtl;
  const expiresAt = new Date(Date.now() + ttl * 1000);

  const token = `mcp_${randomBytes(32).toString("base64url")}`;
  const tokenHash = tokenLookup(token);

  await db.query(
    `INSERT INTO mcp_tokens(token_hash, actor_type, user_id, invitation_id, client_name, scopes, expires_at)
     VALUES($1, $2, $3, $4, $5, $6, $7)`,
    [tokenHash, actorType, userId ?? null, invitationId ?? null, clientName, scopes, expiresAt],
  );

  return { token, expiresAt };
}

export async function verifyMcpToken(
  db: Database,
  rawToken: string,
  locale: Locale = "es",
): Promise<McpAuthContext | null> {
  if (!rawToken || typeof rawToken !== "string" || !rawToken.startsWith("mcp_")) {
    return null;
  }

  const tokenHash = tokenLookup(rawToken);
  const rows = await db.query<{
    actor_type: McpActorType;
    user_id: string | null;
    invitation_id: string | null;
    client_name: string;
    scopes: McpScope[];
    expires_at: Date;
    revoked_at: Date | null;
  }>(
    `SELECT actor_type, user_id, invitation_id, client_name, scopes, expires_at, revoked_at
     FROM mcp_tokens
     WHERE token_hash = $1`,
    [tokenHash],
  );

  if (!rows.length) return null;
  const row = rows[0];

  if (row.revoked_at !== null) return null;
  if (new Date(row.expires_at).getTime() <= Date.now()) return null;

  return {
    actorType: row.actor_type,
    userId: row.user_id ?? undefined,
    invitationId: row.invitation_id ?? undefined,
    clientName: row.client_name,
    scopes: row.scopes,
    locale,
  };
}

export async function revokeMcpToken(db: Database, rawToken: string): Promise<boolean> {
  if (!rawToken || typeof rawToken !== "string") return false;
  const tokenHash = tokenLookup(rawToken);
  const res = await db.pool.query(
    `UPDATE mcp_tokens
     SET revoked_at = now()
     WHERE token_hash = $1 AND revoked_at IS NULL`,
    [tokenHash],
  );
  return (res.rowCount ?? 0) > 0;
}
