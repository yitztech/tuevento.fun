// Pasos de features/sitio/paletas-pantallas.feature. La paleta se simula en la respuesta de la API.
import { expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { sitePalettes } from "@tuevento/contracts";
import { Given, Then, nuevaCuenta } from "./fixtures.js";

const headers = { "x-tuevento-client": "1" };
const rgb = (hex) => `rgb(${[1, 3, 5].map((i) => Number.parseInt(hex.slice(i, i + 2), 16)).join(", ")})`;

async function usaLaPaleta(page, ctx) {
  await expect(page.locator("html")).toHaveAttribute("data-site-palette", ctx.paleta);
  const primario = await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue("--primary").trim());
  expect(primario).toBe(sitePalettes[ctx.paleta].primary);
}

/** Las postales y los temas de invitación tienen su propia paleta: no dependen de la del sitio. */
async function contrasteSuficiente(page) {
  const { violations } = await new AxeBuilder({ page })
    .withRules(["color-contrast"])
    .exclude(".invitation-art")
    .exclude(".template-card")
    .analyze();
  const graves = violations.filter((v) => v.impact === "serious" || v.impact === "critical");
  expect(graves.map((v) => `${v.id}: ${v.nodes.slice(0, 4).map((n) => `${n.target.join(" ")} ${n.any[0]?.message ?? ""}`).join(" | ")}`)).toEqual([]);
}

Given("que la paleta publicada es {string} en una pantalla de {int} por {int}", async ({ page, ctx, $test }, paleta, ancho, alto) => {
  // Recorre cuatro pantallas con cuatro análisis de accesibilidad
  $test.setTimeout(60_000);
  ctx.paleta = paleta;
  await page.setViewportSize({ width: ancho, height: alto });
  await page.route("**/api/site-palette", (ruta) => ruta.fulfill({ json: { palette: paleta } }));
});

Then("la portada usa la paleta, con foco visible y contraste suficiente", async ({ page, ctx }) => {
  await page.goto("/");
  await usaLaPaleta(page, ctx);
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  // Los botones tienen transición de color: se espera a que terminen de cambiar
  await expect
    .poll(() => page.locator('[data-slot="button"]:visible').evaluateAll((lista) => lista.map((b) => getComputedStyle(b).backgroundColor)))
    .toContain(rgb(sitePalettes[ctx.paleta].primary));
  await page.keyboard.press("Tab");
  const selector = page.locator(".language-menu > summary:visible").first();
  await selector.focus();
  await expect(selector).toHaveCSS("outline-color", rgb(sitePalettes[ctx.paleta].primary));
  await expect(selector).toHaveCSS("outline-style", "solid");
  await contrasteSuficiente(page);
});

Then("la navegación del sitio usa la paleta", async ({ page, ctx }) => {
  const menu = page.locator("header").getByRole("button", { expanded: false }).last();
  if (await menu.isVisible()) await menu.click();
  const enlace = page.locator("header nav a:visible").first();
  await expect(enlace).toBeVisible();
  // En pantallas táctiles no hay hover: el enlace conserva el color de texto de la paleta
  if (await page.evaluate(() => matchMedia("(hover: hover)").matches)) {
    await enlace.hover();
    await expect(enlace).toHaveCSS("color", rgb(sitePalettes[ctx.paleta].primary));
  } else {
    await expect(enlace).not.toHaveCSS("color", rgb("#3d2a25"));
  }
  await contrasteSuficiente(page);
});

Then("el formulario de acceso muestra sus errores sin confundirlos con la paleta", async ({ page, ctx }) => {
  await page.goto("/acceso");
  await usaLaPaleta(page, ctx);
  await page.getByLabel("Correo electrónico").fill("no-es-correo");
  await page.getByLabel("Contraseña", { exact: true }).fill("una-clave-larga-1");
  await page.getByRole("button", { name: "Entrar a mi espacio", exact: true }).click();
  const error = page.getByText("Escribe un correo válido.").first();
  await expect(error).toBeVisible();
  const color = await error.evaluate((e) => getComputedStyle(e).color);
  expect(color).not.toBe(rgb(sitePalettes[ctx.paleta].primary));
  await contrasteSuficiente(page);
});

Then("el panel y un modal usan la paleta, con contraste suficiente", async ({ page, ctx }) => {
  const registro = await page.request.post("/api/auth/register", { headers, data: nuevaCuenta() });
  expect(registro.status()).toBe(201);
  await page.goto("/app");
  await usaLaPaleta(page, ctx);
  await expect(page.getByRole("heading").first()).toBeVisible();
  await contrasteSuficiente(page);
  await page.goto("/disenos");
  await page.getByRole("button", { name: /^Vista previa de / }).first().click();
  const modal = page.getByRole("dialog");
  await expect(modal).toBeVisible();
  // El modal entra con un fundido: el contraste se mide cuando termina
  await modal.evaluate(() => Promise.all(document.getAnimations().map((a) => a.finished)));
  await expect(modal.getByRole("link", { name: "Crear evento con este diseño" })).toHaveCSS("background-color", rgb(sitePalettes[ctx.paleta].primary));
  await contrasteSuficiente(page);
});
