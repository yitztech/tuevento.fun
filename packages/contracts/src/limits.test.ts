import test from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { accountLimits, providerCategories } from "./index";

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
  email: [["users", "email"], ["provider_profiles", "public_email"]],
  phone: [["users", "phone"], ["provider_profiles", "phone"], ["provider_profiles", "whatsapp"]],
  eventSlug: [["events", "slug"]],
  url: [["provider_profiles", "website"], ["provider_profiles", "instagram_url"], ["provider_profiles", "facebook_url"], ["provider_profiles", "tiktok_url"]],
  providerSlug: [["provider_profiles", "slug"]],
  businessName: [["provider_profiles", "business_name"]],
  headline: [["provider_profiles", "headline"]],
  providerDescription: [["provider_profiles", "description"]],
  serviceTitle: [["provider_services", "title"]],
  serviceDescription: [["provider_services", "description"]],
  imageAlt: [["provider_images", "alt"]],
  addressLine: [["provider_profiles", "address"]],
  city: [["provider_profiles", "city"]],
  region: [["provider_profiles", "region"]],
  postalCode: [["provider_profiles", "postal_code"]],
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
  // La contraseña se guarda como hash; el texto de la postal vive dentro del JSON del diseño,
  // que la base de datos acota en tamaño ('postcards_design_size') y la API valida por texto.
  // geoQuery es una entrada que no se guarda (búsqueda en el mapa).
  const withoutColumn = ["password", "postcardText", "geoQuery"];
  for (const key of Object.keys(accountLimits)) {
    assert.ok(
      key in columns || withoutColumn.includes(key),
      `accountLimits.${key} no tiene columna ni está declarado sin columna`,
    );
  }
});

test("Las categorías de proveedor son las mismas que admite la base de datos", () => {
  const check = /category text NOT NULL CHECK \(category IN \(([^)]*)\)\)/.exec(sql);
  assert.ok(check, "provider_categories.category no tiene CHECK");
  const enDb = [...check[1].matchAll(/'([^']+)'/g)].map((m) => m[1]);
  assert.deepEqual([...enDb].sort(), [...providerCategories].sort());
});

