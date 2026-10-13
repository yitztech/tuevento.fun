import { Injectable, OnModuleInit, OnModuleDestroy } from "@nestjs/common";
import { Pool, PoolClient, QueryResultRow } from "pg";
import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";
@Injectable()
export class Database implements OnModuleInit, OnModuleDestroy {
  readonly pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    max: 12,
  });
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
    await this.pool.query("DELETE FROM activity WHERE created_at < now() - interval '90 days'");
    await this.pool.query("DELETE FROM mobile_auth_codes WHERE expires_at < now()");
    await this.pool.query("DELETE FROM sessions WHERE expires_at < now()");
    await this.pool.query(
      "DELETE FROM users WHERE is_demo = true AND created_at < now() - interval '7 days'",
    );
  }
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
    await this.pool.end();
  }
}
