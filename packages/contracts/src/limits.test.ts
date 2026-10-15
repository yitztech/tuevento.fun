import test from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { accountLimits } from "./index";

const migrations = join(__dirname, "../../../apps/api/migrations");
const sql = readdirSync(migrations)
  .filter((f) => f.endsWith(".sql"))
  .sort()
  .map((f) => readFileSync(join(migrations, f), "utf8"))
  .join("\n");

/** Límite que impone la base de datos a `tabla.columna`, o undefined si no tiene. */
function dbLimit(table: string, column: string) {
  const re = new RegExp(
    `ALTER TABLE ${table} ADD CONSTRAINT \\w+ CHECK \\(char_length\\(${column}\\) <= (\\d+)\\)`,
    "g",
  );
  const found = [...sql.matchAll(re)].map((m) => Number(m[1]));
  return found.at(-1);
}

// Cada límite de accountLimits debe existir igual en la base de datos. La contraseña no
// tiene columna (se guarda su hash), así que solo se valida en la API.
const columns: Record<string, [string, string][]> = {
  personName: [["users", "first_name"], ["users", "last_name"]],
  email: [["users", "email"]],
  phone: [["users", "phone"]],
};

test("accountLimits coincide con las restricciones CHECK de la base de datos", () => {
  for (const [limit, targets] of Object.entries(columns)) {
    for (const [table, column] of targets) {
      assert.equal(
        dbLimit(table, column),
        accountLimits[limit as keyof typeof accountLimits],
        `${table}.${column} no coincide con accountLimits.${limit}`,
      );
    }
  }
});

test("Todo límite de accountLimits está en la base de datos o declarado sin columna", () => {
  const withoutColumn = ["password"];
  for (const key of Object.keys(accountLimits)) {
    assert.ok(
      key in columns || withoutColumn.includes(key),
      `accountLimits.${key} no tiene columna ni está declarado sin columna`,
    );
  }
});
