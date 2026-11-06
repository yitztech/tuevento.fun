import { expect } from "@playwright/test";
import { execFileSync } from "node:child_process";
import { Given, When, Then, After, nuevaCuenta } from "./fixtures.js";

const headers = { "x-tuevento-client": "1" };
/** Raíz del repositorio: `docker compose` busca ahí sus archivos. */
const raiz = new URL("../../../", import.meta.url);
/** Por `docker compose exec`: en CI la red de PostgreSQL es interna y su puerto no llega al host. */
const sql = (query) =>
  execFileSync("docker", ["compose", "exec", "-T", "postgres", "psql", "-U", "tuevento", "-d", "tueventofun", "-Atc", query], { encoding: "utf8", cwd: raiz }).trim();
const ids = { "Mandarina y Frambuesa": "mandarin-raspberry", "Fucsia, Ciruela y Ámbar": "fuchsia-plum-amber" };

Given("que soy dueño del sistema y abro la administración", async ({ page, ctx }) => {
  const current = await page.request.get("/api/site-palette");
  expect(current.ok()).toBeTruthy();
  ctx.restorePalette = (await current.json()).palette;
  ctx.originalPalette = "terracotta";
  const response = await page.request.post("/api/auth/register", { headers, data: nuevaCuenta() });
  expect(response.status()).toBe(201);
  ctx.paletteOwnerId = (await response.json()).id;
  sql(`UPDATE users SET is_owner=true WHERE id='${ctx.paletteOwnerId}'`);
  sql(`UPDATE site_palette_settings SET palette='${ctx.originalPalette}' WHERE singleton=true`);
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
Then("el cambio de paleta queda registrado con quien lo hizo", async ({ ctx }) => {
  expect(sql(`SELECT target FROM admin_audit_log WHERE admin='${ctx.paletteOwnerId}' AND action='site_palette.update'`)).toBe("fuchsia-plum-amber");
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
  if (ctx.restorePalette) sql(`UPDATE site_palette_settings SET palette='${ctx.restorePalette}' WHERE singleton=true`);
  if (ctx.paletteOwnerId) sql(`DELETE FROM users WHERE id='${ctx.paletteOwnerId}'`);
});
