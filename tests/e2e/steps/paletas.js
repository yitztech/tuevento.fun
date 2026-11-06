import { expect } from "@playwright/test";
import { Given, When, Then, After, nuevaCuenta } from "./fixtures.js";
import { admin } from "../../db/support/db.js";

const headers = { "x-tuevento-client": "1" };
const ids = { "Mandarina y Frambuesa": "mandarin-raspberry", "Fucsia, Ciruela y Ámbar": "fuchsia-plum-amber" };

Given("que soy dueño del sistema y abro la administración", async ({ page, ctx }) => {
  const current = await page.request.get("/api/site-palette");
  expect(current.ok()).toBeTruthy();
  ctx.restorePalette = (await current.json()).palette;
  ctx.originalPalette = "terracotta";
  const response = await page.request.post("/api/auth/register", { headers, data: nuevaCuenta() });
  expect(response.status()).toBe(201);
  ctx.paletteOwnerId = (await response.json()).id;
  const db = admin("tueventofun");
  try {
    await db.query("UPDATE users SET is_owner=true WHERE id=$1", [ctx.paletteOwnerId]);
    await db.query("UPDATE site_palette_settings SET palette=$1 WHERE singleton=true", [ctx.originalPalette]);
  } finally { await db.end(); }
  await page.goto("/administracion");
  await expect(page.getByRole("heading", { name: "Paleta del sitio" })).toBeVisible();
});
When("previsualizo la paleta {string}", async ({ page }, name) => {
  await page.getByLabel("Seleccionar paleta").selectOption(ids[name]);
});
Then("la paleta seleccionada solo es una vista previa", async ({ page, ctx }) => {
  await expect(page.getByText("Vista previa sin guardar.")).toBeVisible();
  await expect(page.locator("html")).toHaveAttribute("data-site-palette", "mandarin-raspberry");
  expect((await (await page.request.get("/api/site-palette")).json()).palette).toBe(ctx.originalPalette);
});
When("cancelo la vista previa de la paleta", async ({ page }) => {
  await page.getByRole("button", { name: "Cancelar vista previa" }).click();
});
Then("se restaura la paleta guardada", async ({ page, ctx }) => {
  await expect(page.getByLabel("Seleccionar paleta")).toHaveValue(ctx.originalPalette);
  await expect(page.getByText("Vista previa sin guardar.")).toBeHidden();
});
When("guardo la paleta {string}", async ({ page }, name) => {
  await page.getByLabel("Seleccionar paleta").selectOption(ids[name]);
  await page.getByRole("button", { name: "Guardar paleta" }).click();
  await expect(page.getByText("Paleta guardada.")).toBeVisible();
});
Then("la paleta guardada se mantiene al recargar y aparece en la portada", async ({ page }) => {
  await page.reload();
  await expect(page.getByLabel("Seleccionar paleta")).toHaveValue("fuchsia-plum-amber");
  await page.goto("/");
  await expect(page.locator("html")).toHaveAttribute("data-site-palette", "fuchsia-plum-amber");
  await expect(page.locator(".site-surface")).toHaveCSS("--primary", "#d9004b");
});
Then("el servidor rechaza guardar sin origen o con datos no válidos", async ({ page }) => {
  const missingOrigin = await page.request.put("/api/owner/site-palette", { headers, data: { palette: "plum-champagne" } });
  expect(missingOrigin.status()).toBe(403);
  const invalid = await page.request.put("/api/owner/site-palette", { headers: { ...headers, Origin: new URL(page.url()).origin }, data: { palette: "no-existe" } });
  expect(invalid.status()).toBe(422);
});
After({ tags: "@paletas" }, async ({ ctx }) => {
  if (!ctx.paletteOwnerId && !ctx.restorePalette) return;
  const db = admin("tueventofun");
  try {
    if (ctx.restorePalette) await db.query("UPDATE site_palette_settings SET palette=$1 WHERE singleton=true", [ctx.restorePalette]);
    if (ctx.paletteOwnerId) await db.query("DELETE FROM users WHERE id=$1", [ctx.paletteOwnerId]);
  } finally { await db.end(); }
});
