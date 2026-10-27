import { expect } from "@playwright/test";
import { Given, When, Then } from "./fixtures.js";
import { pngDataUrl, providerData } from "../../api/api.mjs";

const fotoPng = () => Buffer.from(pngDataUrl(40, 30).split(",")[1], "base64");
const servicio = (page, nombre) => page.locator(".provider-card").filter({ has: page.getByRole("heading", { name: nombre, exact: true }) });

Given("que ya guardé los datos de mi negocio", async ({ page }) => {
  const r = await page.request.put("/api/provider/profile", { headers: { "x-tuevento-client": "1" }, data: providerData() });
  expect(r.status()).toBe(200);
});

When("marco la categoría {string}", async ({ page }, categoria) => {
  await page.getByRole("group", { name: "Categorías" }).getByRole("checkbox", { name: categoria, exact: true }).check();
});

When("marco la opción {string}", async ({ page }, opcion) => {
  await page.getByRole("checkbox", { name: opcion, exact: true }).check();
});

When("subo una foto del negocio", async ({ page }) => {
  await page.getByLabel("Subir una foto", { exact: true }).setInputFiles({ name: "mesa.png", mimeType: "image/png", buffer: fotoPng() });
  await expect(page.getByLabel("Descripción de la foto", { exact: true })).toBeVisible();
});

When("subo un archivo de texto como foto", async ({ page }) => {
  await page.getByLabel("Subir una foto", { exact: true }).setInputFiles({ name: "notas.txt", mimeType: "text/plain", buffer: Buffer.from("hola") });
});

When("edito el servicio {string}", async ({ page }, nombre) => {
  await servicio(page, nombre).getByRole("button", { name: "Editar", exact: true }).click();
});

Then("para publicar solo falta {string}", async ({ page }, requisito) => {
  const pendientes = page.locator(".provider-missing li");
  await expect(pendientes).toHaveText([requisito]);
});

Then("el botón {string} está desactivado", async ({ page }, nombre) => {
  await expect(page.getByRole("button", { name: nombre, exact: true })).toBeDisabled();
});

Then("veo el servicio {string} con el precio {string}", async ({ page }, nombre, precio) => {
  await expect(servicio(page, nombre).locator(".provider-price")).toContainText(precio);
});
