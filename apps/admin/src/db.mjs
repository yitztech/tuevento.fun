import { Pool } from "pg";

// Conexión como rol `admin_ro`: SELECT sobre las columnas del panel y las funciones de los cupones y la paleta.
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
