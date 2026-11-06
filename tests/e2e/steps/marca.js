// Pasos de features/marca.feature: logo por idioma y favicon.
import { expect } from "@playwright/test";
import { Then } from "./fixtures.js";

const logoDeCabecera = (page) => page.locator("header a[aria-label] img[src*='/images/brand-v2/logo-']").first();

Then("la cabecera muestra el logo en {string} y se ve completo", async ({ page }, idioma) => {
  const logo = logoDeCabecera(page);
  await expect(logo).toBeVisible();
  await expect(logo).toHaveAttribute("src", new RegExp(`/logo-${idioma}-\\d+\\.webp$`));
  // Cargó de verdad (no una imagen rota) y conserva su proporción 3:1
  await expect.poll(() => logo.evaluate((img) => img.complete && img.naturalWidth > 0)).toBe(true);
  const caja = await logo.boundingBox();
  expect(caja.width / caja.height).toBeCloseTo(3, 1);
});

Then("el HTML inicial declara el favicon de la marca y los iconos existen", async ({ page, ctx }) => {
  const html = await ctx.respuesta.text();
  const rutas = [...html.matchAll(/<link rel="(?:icon|apple-touch-icon)" href="([^"]+)"/g)].map((m) => m[1]);
  expect(rutas).toEqual(
    expect.arrayContaining([
      "/images/brand-v2/favicon.ico",
      "/images/brand-v2/favicon-32.png",
      "/images/brand-v2/favicon-16.png",
      "/images/brand-v2/apple-touch-icon.png",
    ]),
  );
  expect(html).not.toContain("/favicon.svg");
  for (const ruta of rutas) {
    const respuesta = await page.request.get(new URL(ruta, page.url()).href);
    expect(respuesta.status(), ruta).toBe(200);
  }
});

Then("el logo cabe en una pantalla de {int} por {int}", async ({ page }, ancho, alto) => {
  await page.setViewportSize({ width: ancho, height: alto });
  const logo = logoDeCabecera(page);
  await expect(logo).toBeVisible();
  const caja = await logo.boundingBox();
  expect(caja.x).toBeGreaterThanOrEqual(0);
  expect(caja.x + caja.width).toBeLessThanOrEqual(ancho);
});
