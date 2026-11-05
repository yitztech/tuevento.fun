import type { Database } from "../database";
import { tokenLookup } from "../tokens";

type Payload = Record<string, unknown> & { accountId?: unknown; grantId?: unknown; jti?: unknown; uid?: unknown };

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Almacén de `oidc-provider` en PostgreSQL (§26). El identificador de un registro es el propio token
 * o código: se guarda su HMAC y se quita del contenido (`jti`), así que un volcado de la base no
 * sirve para usar ninguno. La sesión del flujo es la excepción: `findByUid` la devuelve sin conocer su
 * identificador, que solo sirve con la cookie firmada y dura lo que el consentimiento (10 minutos).
 * Cada dominio tiene su emisor y sus registros no se cruzan.
 */
export function oauthAdapter(db: Database, issuer: string) {
  const hash = (kind: string, value: string) => tokenLookup(`mcp-oauth:${issuer}:${kind}:${value}`);

  return class PostgresAdapter {
    constructor(private model: string) {}

    async upsert(id: string, payload: Payload, expiresIn: number) {
      const { jti: _jti, ...secretless } = payload;
      const stored = this.model === "Session" ? payload : secretless;
      const accountId = typeof payload.accountId === "string" && uuid.test(payload.accountId) ? payload.accountId : null;
      const grantHash = typeof payload.grantId === "string" ? hash("Grant", payload.grantId) : null;
      const uidHash = typeof payload.uid === "string" ? hash(`${this.model}:uid`, payload.uid) : null;
      await db.query(
        `INSERT INTO mcp_oauth_records(record_hash, model, grant_hash, uid_hash, user_id, payload, expires_at)
         VALUES($1, $2, $3, $4, $5, $6, now() + make_interval(secs => $7))
         ON CONFLICT (record_hash) DO UPDATE
         SET grant_hash = $3, uid_hash = $4, user_id = $5, payload = $6, expires_at = now() + make_interval(secs => $7), updated_at = now()`,
        [hash(this.model, id), this.model, grantHash, uidHash, accountId, JSON.stringify(stored), expiresIn],
      );
      // Cada acceso nuevo limpia lo caducado: no hace falta una tarea periódica
      if (this.model === "Interaction") await db.query("DELETE FROM mcp_oauth_records WHERE expires_at < now()");
    }

    async find(id: string) {
      const [row] = await db.query<{ payload: Payload; consumed_at: Date | null }>(
        "SELECT payload, consumed_at FROM mcp_oauth_records WHERE record_hash = $1 AND expires_at > now()",
        [hash(this.model, id)],
      );
      if (!row) return undefined;
      return {
        ...row.payload,
        jti: id,
        ...(row.consumed_at ? { consumed: Math.floor(row.consumed_at.getTime() / 1000) } : {}),
      };
    }

    async consume(id: string) {
      await db.query("UPDATE mcp_oauth_records SET consumed_at = now(), updated_at = now() WHERE record_hash = $1", [
        hash(this.model, id),
      ]);
    }

    async destroy(id: string) {
      await db.query("DELETE FROM mcp_oauth_records WHERE record_hash = $1", [hash(this.model, id)]);
    }

    async revokeByGrantId(grantId: string) {
      await db.query("DELETE FROM mcp_oauth_records WHERE grant_hash = $1", [hash("Grant", grantId)]);
    }

    async findByUid(uid: string) {
      const [row] = await db.query<{ payload: Payload }>(
        "SELECT payload FROM mcp_oauth_records WHERE uid_hash = $1 AND expires_at > now()",
        [hash(`${this.model}:uid`, uid)],
      );
      return row?.payload;
    }

    // Sin flujo de dispositivo: nadie busca por código de usuario
    async findByUserCode() {
      return undefined;
    }
  };
}
