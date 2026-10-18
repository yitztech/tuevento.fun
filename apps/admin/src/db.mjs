import { Pool } from "pg";

// Conexión como rol `admin_ro` (solo SELECT sobre las columnas del panel). Nunca escribe.
export function createDatabase({ connectionString, password }) {
  const pool = new Pool({ connectionString, password: password || undefined, max: 4, statement_timeout: 10_000 });
  return {
    async query(text, params = []) {
      const result = await pool.query(text, params);
      return result.rows;
    },
    close: () => pool.end(),
  };
}
