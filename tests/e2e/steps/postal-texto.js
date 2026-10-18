import { expect } from "@playwright/test";
import { When, Then } from "./fixtures.js";

// Pasos comunes (evento con invitación, editor, añadir texto, guardar, abrir invitación) están en postal.js.

/** Capa de texto del editor con ese contenido. */
const capaEditor = (page, texto) => page.locator(".postcard-canvas.is-editable .postcard-text", { hasText: texto });
/** Capa de texto de la invitación pública con ese contenido. */
const capaInvitacion = (page, texto) => page.locator(".postcard-canvas .postcard-text", { hasText: texto });
/** Porcentaje de una propiedad `left`/`top` en línea (p. ej. "40.0000001%"). */
const porcentaje = (valor) => Number.parseFloat(valor);

When("arrastro el texto {string} un {int} % a la derecha y un {int} % hacia abajo", async ({ page }, texto, derecha, abajo) => {
  const lienzo = await page.locator(".postcard-canvas").boundingBox();
  const capa = capaEditor(page, texto);
  const caja = await capa.boundingBox();
  const inicioX = caja.x + caja.width / 2;
  const inicioY = caja.y + caja.height / 2;
  await page.mouse.move(inicioX, inicioY);
  await page.mouse.down();
  await page.mouse.move(inicioX + (lienzo.width * derecha) / 100, inicioY + (lienzo.height * abajo) / 100, { steps: 12 });
  await page.mouse.up();
});

When("elijo el color {string} para el texto", async ({ page }, color) => {
  // El primer selector de color dentro del texto seleccionado es el del propio texto (el de la sombra va después)
  await page.locator(".postcard-text-editor .postcard-field-row").first().locator('input[type="color"]').fill(color);
});

When("activo la sombra del texto", async ({ page }) => {
  await page.locator(".postcard-text-editor").getByRole("button", { name: "Sin sombra", exact: true }).click();
  await expect(page.locator(".postcard-text-editor").getByRole("button", { name: "Con sombra", exact: true })).toBeVisible();
});

When("elijo el color de fondo {string}", async ({ page }, color) => {
  // Primer grupo de muestras de la página: el de Fondo (las plantillas van antes, pero no tienen esa etiqueta)
  await page.getByRole("button", { name: `Color ${color}`, exact: true }).first().click();
});

Then(
  "la invitación muestra el texto {string} a un {int} % de la izquierda y un {int} % desde arriba",
  async ({ page }, texto, izquierda, arriba) => {
    const capa = capaInvitacion(page, texto);
    await expect(capa).toBeVisible();
    const left = porcentaje(await capa.evaluate((el) => el.style.left));
    const top = porcentaje(await capa.evaluate((el) => el.style.top));
    // Tolerancia de medio punto: el arrastre con el ratón no cae en un valor entero exacto
    expect(Math.abs(left - izquierda)).toBeLessThan(0.5);
    expect(Math.abs(top - arriba)).toBeLessThan(0.5);
  },
);

Then("la invitación muestra el texto {string} con sombra", async ({ page }, texto) => {
  await expect(capaInvitacion(page, texto)).not.toHaveCSS("text-shadow", "none");
});

Then("la invitación muestra el fondo de color {string}", async ({ page }, color) => {
  const fondo = page.locator(".postcard-canvas .postcard-background");
  await expect(fondo).toBeVisible();
  const esperado = (await page.evaluate((hex) => {
    const n = Number.parseInt(hex.slice(1), 16);
    return `rgb(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255})`;
  }, color));
  await expect(fondo).toHaveCSS("background-color", esperado);
});
