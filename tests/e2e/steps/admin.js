import { expect } from "@playwright/test";
import { adminURL } from "../support/entorno.js";
import { Given, When, Then } from "./fixtures.js";

// Panel de administración (servicio admin): solo en web, en su propio origen.
// Estas funciones usan `page`, que existe en la web (en móvil no se prueba este panel).

Given("que el panel se abre en un móvil de {int} por {int}", async ({ page }, ancho, alto) => {
  await page.setViewportSize({ width: ancho, height: alto });
});

When("abro el panel de administración", async ({ page }) => {
  await page.goto(adminURL);
});

When("entro al panel con el usuario {string} y la contraseña {string}", async ({ page }, usuario, clave) => {
  await page.getByLabel("Usuario", { exact: true }).fill(usuario);
  await page.getByLabel("Contraseña", { exact: true }).fill(clave);
  await page.getByRole("button", { name: "Entrar", exact: true }).click();
});

const clave = (page) => page.getByLabel("Contraseña", { exact: true });

When("escribo la contraseña {string} en el panel", async ({ page }, texto) => {
  await clave(page).fill(texto);
});

When("pulso {string} en el panel", async ({ page }, nombre) => {
  await page.getByRole("button", { name: nombre, exact: true }).click();
});

Then("la contraseña del panel está oculta", async ({ page }) => {
  await expect(clave(page)).toHaveAttribute("type", "password");
  await expect(page.getByRole("button", { name: "Mostrar contraseña", exact: true })).toHaveAttribute("aria-pressed", "false");
});

Then("la contraseña del panel se ve como {string}", async ({ page }, texto) => {
  await expect(clave(page)).toHaveAttribute("type", "text");
  await expect(clave(page)).toHaveValue(texto);
  await expect(page.getByRole("button", { name: "Ocultar contraseña", exact: true })).toHaveAttribute("aria-pressed", "true");
});

When("salgo del panel", async ({ page }) => {
  await page.getByRole("button", { name: "Salir", exact: true }).click();
});

When("pido las estadísticas del panel sin haber entrado", async ({ page, ctx }) => {
  ctx.estado = (await page.request.get(`${adminURL}/api/stats`)).status();
});

When("pido la salud del panel", async ({ page, ctx }) => {
  const respuesta = await page.request.get(`${adminURL}/api/health`);
  ctx.estado = respuesta.status();
  ctx.cuerpo = await respuesta.json();
});

Then("el panel responde {int} con el estado {string}", async ({ ctx }, estado, valor) => {
  expect(ctx.estado).toBe(estado);
  expect(ctx.cuerpo).toEqual({ status: valor });
});

When("pido los países del panel sin haber entrado", async ({ page, ctx }) => {
  ctx.estado = (await page.request.get(`${adminURL}/api/countries`)).status();
});

// La API de Umami solo responde a producción: aquí se simula la respuesta del panel a /api/countries
Given("que Umami responde con {int} visitantes de {string} y {int} de {string}", async ({ page }, n1, p1, n2, p2) => {
  await page.route("**/api/countries*", (route) =>
    route.fulfill({ json: { available: true, days: 30, rows: [{ country: p1, visitors: n1 }, { country: p2, visitors: n2 }] } }),
  );
});

Given("que Umami no responde", async ({ page }) => {
  await page.route("**/api/countries*", (route) => route.fulfill({ status: 502, json: { error: "umami" } }));
});

const paises = (page) => page.getByRole("article", { name: "Visitantes por país" });

Then("veo {string} en los visitantes por país", async ({ page }, texto) => {
  await expect(paises(page).getByText(texto, { exact: true })).toBeVisible();
});

Then("los visitantes por país muestran {string} con {int} y {string} con {int}", async ({ page }, pais1, n1, pais2, n2) => {
  const filas = paises(page).getByRole("row");
  await expect(filas).toHaveCount(2);
  for (const [fila, pais, n] of [[0, pais1, n1], [1, pais2, n2]]) {
    await expect(filas.nth(fila).getByRole("rowheader")).toHaveText(pais);
    await expect(filas.nth(fila).getByRole("cell")).toHaveText(String(n));
  }
});

Then("veo el error {string} del panel", async ({ page }, texto) => {
  await expect(page.getByRole("alert").filter({ hasText: texto })).toBeVisible();
});

Then("veo el resumen del panel con {string} y {string}", async ({ page }, primero, segundo) => {
  await expect(page.getByText(primero, { exact: true })).toBeVisible();
  await expect(page.getByText(segundo, { exact: true })).toBeVisible();
});

Then("el panel responde {int}", async ({ ctx }, estado) => {
  expect(ctx.estado).toBe(estado);
});

Then("el panel cabe en pantalla sin desbordamiento horizontal", async ({ page }) => {
  const { ancho, visible } = await page.evaluate(() => ({
    ancho: document.documentElement.scrollWidth,
    visible: document.documentElement.clientWidth,
  }));
  expect(ancho).toBeLessThanOrEqual(visible);
});

const menuUsuarios = (page) => page.getByRole("tab", { name: "Usuarios", exact: true });

Then("el menú del panel está cerrado", async ({ page }) => {
  await expect(menuUsuarios(page)).toBeHidden();
  await expect(page.getByRole("button", { name: "Abrir menú", exact: true })).toHaveAttribute("aria-expanded", "false");
});

Then("el menú del panel está abierto", async ({ page }) => {
  await expect(menuUsuarios(page)).toBeVisible();
  await expect(page.getByRole("button", { name: "Cerrar menú", exact: true })).toHaveAttribute("aria-expanded", "true");
});

When("abro la pestaña {string} del panel", async ({ page }, nombre) => {
  await page.getByRole("tab", { name: nombre, exact: true }).click();
});

Then(
  "veo la tabla del panel con las columnas {string}, {string} y {string} en la página {int}",
  async ({ page }, primera, segunda, tercera, pagina) => {
    for (const columna of [primera, segunda, tercera]) {
      await expect(page.getByRole("columnheader", { name: columna, exact: true })).toBeVisible();
    }
    await expect(page.getByText(`Página ${pagina}`, { exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Anterior", exact: true })).toBeDisabled();
  },
);

// El nombre accesible del selector incluye la opción elegida («Periodo 30 días»)
const periodo = (page) => page.getByRole("combobox", { name: /^Periodo/ });

When("elijo el periodo {string} en el panel", async ({ page, ctx }, texto) => {
  const dias = Number.parseInt(texto, 10);
  await expect(page.getByText("Conectados ahora", { exact: true })).toBeVisible();
  ctx.periodo = Promise.all([
    page.waitForResponse((r) => r.url().endsWith(`/api/stats?days=${dias}`) && r.ok()),
    page.waitForResponse((r) => r.url().endsWith(`/api/countries?days=${dias}`) && r.ok()),
  ]);
  await periodo(page).selectOption({ label: texto });
});

Then("el panel pide el resumen y los países de {int} días", async ({ page, ctx }, dias) => {
  await ctx.periodo;
  await expect(periodo(page).locator("option:checked")).toHaveText(`${dias} días`);
});

When("recargo el panel", async ({ page }) => {
  await page.reload();
});

Then("veo el formulario de entrada del panel", async ({ page }) => {
  await expect(page.getByRole("heading", { name: "Entrar al panel", exact: true })).toBeVisible();
});

const filaCupon = (page, codigo) => page.getByRole("row").filter({ hasText: codigo });

async function rellenarCupon(page, codigo, porcentaje) {
  await page.getByLabel("Código", { exact: true }).fill(codigo);
  await page.getByLabel("Descuento", { exact: true }).fill(String(porcentaje));
  await page.getByRole("button", { name: "Crear cupón", exact: true }).click();
}

When("creo un cupón nuevo del {int} % en el panel", async ({ page, ctx }, porcentaje) => {
  ctx.cupon = { codigo: `QA-${Date.now()}-${Math.floor(Math.random() * 1000)}`, porcentaje };
  await rellenarCupon(page, ctx.cupon.codigo, porcentaje);
  await expect(filaCupon(page, ctx.cupon.codigo)).toBeVisible();
});

When("repito el cupón nuevo en el panel", async ({ page, ctx }) => {
  await rellenarCupon(page, ctx.cupon.codigo, ctx.cupon.porcentaje);
});

Then("veo el cupón nuevo en el panel con {string} y {string}", async ({ page, ctx }, descuento, estado) => {
  const fila = filaCupon(page, ctx.cupon.codigo);
  await expect(fila).toContainText(descuento);
  await expect(fila).toContainText(estado);
});

When("desactivo el cupón nuevo en el panel", async ({ page, ctx }) => {
  await page.getByRole("button", { name: `Desactivar ${ctx.cupon.codigo}`, exact: true }).click();
});

When("pido los cupones del panel sin haber entrado", async ({ page, ctx }) => {
  ctx.estado = (await page.request.get(`${adminURL}/api/coupons`)).status();
});
