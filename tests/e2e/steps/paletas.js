import { expect } from "@playwright/test";
import { execFileSync } from "node:child_process";
import { adminURL } from "../support/entorno.js";
import { Given, When, Then, After, nuevaCuenta, registrar } from "./fixtures.js";

const headers = { "x-tuevento-client": "1" };
/** Raíz del repositorio: `docker compose` busca ahí sus archivos. */
const raiz = new URL("../../../", import.meta.url);
/** Por `docker compose exec`: en CI la red de PostgreSQL es interna y su puerto no llega al host. */
const sql = (query) =>
  execFileSync("docker", ["compose", "exec", "-T", "postgres", "psql", "-U", "tuevento", "-d", "tueventofun", "-Atc", query], { encoding: "utf8", cwd: raiz }).trim();
const panel = (page, nombre) => page.getByRole("tab", { name: nombre, exact: true });

Given("que el sitio usa la paleta inicial", async ({ page, ctx }) => {
  const current = await page.request.get("/api/site-palette");
  expect(current.ok()).toBeTruthy();
  ctx.restorePalette = (await current.json()).palette;
  sql("UPDATE site_palette_settings SET palette='terracotta' WHERE singleton=true");
});
When("guardo la paleta {string} en el panel", async ({ page }, nombre) => {
  await panel(page, "Diseño").click();
  await page.getByRole("radio", { name: nombre }).check();
  await page.getByRole("button", { name: "Guardar paleta" }).click();
  await expect(page.getByText("Paleta guardada.")).toBeVisible();
});
Then("la paleta guardada se mantiene al recargar el panel y aparece en la portada", async ({ page }) => {
  await page.reload();
  await panel(page, "Diseño").click();
  await expect(page.getByText("Paleta activa: Fucsia, Ciruela y Ámbar.")).toBeVisible();
  await page.goto("/");
  await expect(page.locator("html")).toHaveAttribute("data-site-palette", "fuchsia-plum-amber");
  await expect(page.locator(".site-surface")).toHaveCSS("--primary", "#d9004b");
});
Then("el cambio de paleta queda registrado con quien lo hizo", async () => {
  expect(sql("SELECT admin || ' ' || target FROM admin_audit_log WHERE action='site_palette.update' ORDER BY created_at DESC LIMIT 1")).toBe("admin fuchsia-plum-amber");
});
Given("que soy dueño del sistema y abro la administración", async ({ page, ctx }) => {
  const response = await registrar(page.request, "/api/auth/register", { headers, data: nuevaCuenta() });
  expect(response.status()).toBe(201);
  ctx.paletteOwnerId = (await response.json()).id;
  sql(`UPDATE users SET is_owner=true WHERE id='${ctx.paletteOwnerId}'`);
  await page.goto("/administracion");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
});
Then("no veo la paleta del sitio", async ({ page }) => {
  await expect(page.getByRole("heading", { name: "Paleta del sitio" })).toBeHidden();
});
Then("la API de la web no permite guardar la paleta", async ({ page }) => {
  const respuesta = await page.request.put("/api/owner/site-palette", { headers: { ...headers, Origin: new URL(page.url()).origin }, data: { palette: "plum-champagne" } });
  expect(respuesta.status()).toBe(404);
});
When("guardo una paleta en el panel sin haber entrado", async ({ page, ctx }) => {
  ctx.estado = (await page.request.put(`${adminURL}/api/palette`, { data: { palette: "plum-champagne" } })).status();
});
After({ tags: "@paletas" }, async ({ ctx }) => {
  if (ctx.restorePalette) sql(`UPDATE site_palette_settings SET palette='${ctx.restorePalette}' WHERE singleton=true`);
  if (ctx.paletteOwnerId) sql(`DELETE FROM users WHERE id='${ctx.paletteOwnerId}'`);
});
