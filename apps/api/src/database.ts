import { Injectable, OnModuleInit, OnModuleDestroy } from "@nestjs/common";
import { Pool, PoolClient, QueryResultRow } from "pg";
import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";
@Injectable()
export class Database implements OnModuleInit, OnModuleDestroy {
  readonly pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    password: process.env.PGPASSWORD || undefined,
    max: 12,
  });
  private sweepTimer?: NodeJS.Timeout;

  constructor() {
    // Un cliente inactivo que pierde la conexión (p. ej. al reiniciarse PostgreSQL) emite
    // 'error' en el pool. Sin este oyente, Node lo trata como excepción no capturada y tumba
    // la API. El pool descarta ese cliente y abre otro en la siguiente consulta.
    this.pool.on("error", (error) => {
      console.error("PostgreSQL: conexión inactiva perdida", error);
    });
  }

  async onModuleInit() {
    const directory = join(__dirname, "../migrations");
    const migrations = (await readdir(directory))
      .filter((name) => name.endsWith(".sql"))
      .sort();
    await this.transaction(async (c) => {
      await c.query("SELECT pg_advisory_xact_lock(7429082)");
      await c.query(
        "CREATE TABLE IF NOT EXISTS schema_migrations(name text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())",
      );
      for (const name of migrations) {
        const applied = await c.query(
          "SELECT name FROM schema_migrations WHERE name=$1",
          [name],
        );
        if (applied.rowCount) continue;
        await c.query(await readFile(join(directory, name), "utf8"));
        await c.query("INSERT INTO schema_migrations(name) VALUES($1)", [name]);
      }
    });
    await this.cleanup();
    // Repetir la purga mientras el servicio vive, no solo al arrancar: sesiones y
    // códigos caducados, actividad antigua y cuentas demo no se acumulan entre
    // reinicios. unref para no mantener vivo el proceso en el apagado.
    this.sweepTimer = setInterval(() => {
      void this.cleanup().catch((error) =>
        console.error("Cleanup sweep failed:", (error as Error).message),
      );
    }, 60 * 60 * 1000);
    this.sweepTimer.unref?.();
  }
  private async cleanup() {
    await this.pool.query(
      "DELETE FROM activity WHERE created_at < now() - interval '90 days'",
    );
    await this.pool.query("DELETE FROM mobile_auth_codes WHERE expires_at < now()");
    await this.pool.query("DELETE FROM sessions WHERE expires_at < now()");
    await this.pool.query("DELETE FROM password_resets WHERE expires_at < now()");
    await this.pool.query(
      "DELETE FROM users WHERE is_demo = true AND created_at < now() - interval '7 days'",
    );
  }
  // Por defecto, filas sin tipar: cada consulta que las usa con un tipo concreto lo indica
  async query<T extends QueryResultRow = any>(
    sql: string,
    params: unknown[] = [],
  ): Promise<T[]> {
    return (await this.pool.query<T>(sql, params)).rows;
  }
  async transaction<T>(fn: (client: PoolClient) => Promise<T>): Promise<T> {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      const result = await fn(client);
      await client.query("COMMIT");
      return result;
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }
  async onModuleDestroy() {
    if (this.sweepTimer) clearInterval(this.sweepTimer);
    await this.pool.end();
  }
}
