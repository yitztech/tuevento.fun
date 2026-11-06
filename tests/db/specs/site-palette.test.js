import test, { before, after } from "node:test";
import assert from "node:assert/strict";
import { sitePaletteIds } from "@tuevento/contracts";
import { baseTemporal, codigoError, CHECK_VIOLATION, UNIQUE_VIOLATION } from "../support/db.js";

let base, db;
before(async () => { base = await baseTemporal({ hasta: "034_site_palette.sql" }); db = base.api; await base.aplicarResto(); });
after(async () => base?.cerrar());
test("La migración conserva la paleta original y solo permite una configuración global válida", async () => {
  assert.equal((await db.query("SELECT palette FROM site_palette_settings")).rows[0].palette, "terracotta");
  for (const palette of sitePaletteIds) {
    await db.query("UPDATE site_palette_settings SET palette=$1 WHERE singleton=true", [palette]);
    assert.equal((await db.query("SELECT palette FROM site_palette_settings WHERE singleton=true")).rows[0].palette, palette);
  }
  assert.equal(await codigoError(() => db.query("UPDATE site_palette_settings SET palette='no-existe'")), CHECK_VIOLATION);
  assert.equal(await codigoError(() => db.query("INSERT INTO site_palette_settings(singleton) VALUES(false)")), CHECK_VIOLATION);
  assert.equal(await codigoError(() => db.query("INSERT INTO site_palette_settings(singleton) VALUES(true)")), UNIQUE_VIOLATION);
});
