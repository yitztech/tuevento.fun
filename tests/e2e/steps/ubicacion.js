import { expect } from "@playwright/test";
import { Given, When, Then, nuevaCuenta, fechaFutura } from "./fixtures.js";

const cabecera = { "x-tuevento-client": "1" };

Given(
  "que un organizador tiene un evento en el punto {float}, {float} con una invitación para {string}",
  async ({ request, ctx }, lat, lng, persona) => {
    const registro = await request.post("/api/auth/register", { headers: cabecera, data: nuevaCuenta() });
    expect(registro.status()).toBe(201);
    ctx.codigo = (await registro.json()).publicCode;
    ctx.titulo = `Fiesta con mapa ${Date.now()}`;
    const evento = await request.post("/api/events", {
      headers: cabecera,
      data: {
        title: ctx.titulo,
        description: "",
        date: fechaFutura,
        timeZone: "America/Mexico_City",
        location: "Jardín Borda",
        theme: "floral",
        geo: { lat, lng },
      },
    });
    expect(evento.status()).toBe(201);
    ctx.evento = await evento.json();
    const invitacion = await request.post(`/api/events/${ctx.evento.id}/invitations`, {
      headers: cabecera,
      data: { name: persona, kind: "individual", email: "", phone: "", notes: "", members: [{ name: persona, kind: "adult", notes: "" }] },
    });
    expect(invitacion.status()).toBe(201);
    ctx.token = (await invitacion.json()).token;
  },
);

When("pulso el botón {string}", async ({ page }, nombre) => {
  await page.getByRole("button", { name: nombre, exact: true }).click();
});

When("elijo el primer lugar de la lista", async ({ page }) => {
  await page.getByRole("list", { name: "Elige el lugar correcto:" }).getByRole("button").first().click();
});

When("pego el enlace de mapas {string}", async ({ page }, enlace) => {
  await page.getByRole("button", { name: "Pegar enlace de mapas", exact: true }).click();
  await page.getByLabel("Enlace de Google Maps, Apple Maps o Waze").fill(enlace);
  await page.getByRole("button", { name: "Usar este enlace", exact: true }).click();
});

Then("veo el texto {string}", async ({ page }, texto) => {
  await expect(page.getByText(texto).first()).toBeVisible();
});

Then("no veo el texto {string}", async ({ page }, texto) => {
  await expect(page.getByText(texto)).toHaveCount(0);
});

Then("veo la alerta {string}", async ({ page }, texto) => {
  await expect(page.getByRole("alert").filter({ hasText: texto })).toBeVisible();
});

/** El punto se comprueba en la API: el mapa en sí puede no pintarse (sin WebGL en el navegador de pruebas). */
const puntoGuardado = async (page, ctx) => {
  let geo;
  await expect(async () => {
    const r = await page.request.get(`/api/events/${ctx.evento.id}`, { headers: cabecera });
    geo = (await r.json()).geo;
    expect(geo).not.toBeNull();
  }).toPass();
  return geo;
};

Then("mi evento guarda el punto del mapa", async ({ page, ctx }) => {
  const geo = await puntoGuardado(page, ctx);
  expect(typeof geo.lat).toBe("number");
  expect(typeof geo.lng).toBe("number");
});

Then("mi evento queda en el punto {float}, {float}", async ({ page, ctx }, lat, lng) => {
  expect(await puntoGuardado(page, ctx)).toEqual({ lat, lng });
});

Then("el enlace {string} lleva a {string}", async ({ page }, nombre, destino) => {
  await expect(page.getByRole("link", { name: nombre }).first()).toHaveAttribute("href", destino);
});
