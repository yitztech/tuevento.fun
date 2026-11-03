import { type CallHandler, type ExecutionContext, Injectable, Logger, type NestInterceptor } from "@nestjs/common";
import { HTTP_CODE_METADATA } from "@nestjs/common/constants";
import { Reflector } from "@nestjs/core";
import type { FastifyReply } from "fastify";
import { createHash } from "node:crypto";
import { catchError, from, mergeMap, type Observable, of, throwError } from "rxjs";
import type { AuthedRequest } from "./auth";
import { Database } from "./database";
import { ProblemException } from "./problem";

const WRITES = new Set(["POST", "PUT", "PATCH", "DELETE"]);
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type Saved = { method: string; path: string; body_hash: string; status: string | null; response: unknown };

/**
 * Escrituras repetibles (AGENTS.md §21): una escritura de una cuenta con `Idempotency-Key` (UUID)
 * guarda su respuesta 24 horas. Repetir la clave devuelve esa respuesta sin repetir el efecto (ni
 * los correos); la misma clave con otro método, ruta o cuerpo es un error del cliente (422), y
 * mientras la primera sigue en curso, 409. Un error no se guarda: se puede reintentar con la misma
 * clave. Cada cuenta tiene sus claves: la de otra nunca devuelve su respuesta.
 */
@Injectable()
export class IdempotencyInterceptor implements NestInterceptor {
  private readonly logger = new Logger(IdempotencyInterceptor.name);
  constructor(
    private db: Database,
    private reflector: Reflector,
  ) {}

  async intercept(context: ExecutionContext, next: CallHandler): Promise<Observable<unknown>> {
    const http = context.switchToHttp();
    const req = http.getRequest<AuthedRequest>();
    const header = req.headers["idempotency-key"];
    // Sin cuenta (registro, acceso, invitados) no hay a quién atar la clave: se ignora
    if (header === undefined || !WRITES.has(req.method) || !req.user) return next.handle();
    const key = String(header).trim();
    if (!UUID.test(key))
      throw new ProblemException({ status: 400, code: "invalid_idempotency_key", detail: "errors.invalidIdempotencyKey" });
    const userId = req.user.id;
    const path = req.url.slice(0, 2048);
    const bodyHash = createHash("sha256").update(JSON.stringify(req.body ?? null)).digest("hex");

    const { rowCount } = await this.db.pool.query(
      "INSERT INTO idempotency_keys(user_id,key,method,path,body_hash) VALUES($1,$2,$3,$4,$5) ON CONFLICT DO NOTHING",
      [userId, key, req.method, path, bodyHash],
    );
    if (!rowCount) return of(await this.replay(userId, key, req.method, path, bodyHash, http.getResponse<FastifyReply>()));

    const status =
      this.reflector.get<number | undefined>(HTTP_CODE_METADATA, context.getHandler()) ??
      (req.method === "POST" ? 201 : 200);
    return next.handle().pipe(
      mergeMap((value) =>
        from(
          this.db.pool
            .query("UPDATE idempotency_keys SET status=$3, response=$4 WHERE user_id=$1 AND key=$2", [
              userId,
              key,
              status,
              JSON.stringify(value ?? null),
            ])
            .catch((e: Error) => this.logger.error(`No se guardó la respuesta idempotente: ${e.message}`))
            .then(() => value),
        ),
      ),
      catchError((error: unknown) =>
        from(
          this.db.pool
            .query("DELETE FROM idempotency_keys WHERE user_id=$1 AND key=$2 AND status IS NULL", [userId, key])
            .catch(() => undefined),
        ).pipe(mergeMap(() => throwError(() => error))),
      ),
    );
  }

  private async replay(userId: string, key: string, method: string, path: string, bodyHash: string, reply: FastifyReply) {
    const { rows: [saved] } = await this.db.pool.query<Saved>(
      "SELECT method, path, body_hash, status, response FROM idempotency_keys WHERE user_id=$1 AND key=$2",
      [userId, key],
    );
    if (saved && (saved.method !== method || saved.path !== path || saved.body_hash !== bodyHash))
      throw new ProblemException({ status: 422, code: "idempotency_key_reused", detail: "errors.idempotencyKeyReused" });
    // En curso (o la primera acaba de fallar y se borró): reintentar en un momento
    if (!saved || saved.status === null)
      throw new ProblemException({
        status: 409,
        code: "idempotency_in_progress",
        detail: "errors.idempotencyInProgress",
        retryAfter: 1,
      });
    reply.header("Idempotency-Replayed", "true");
    return saved.response;
  }
}
