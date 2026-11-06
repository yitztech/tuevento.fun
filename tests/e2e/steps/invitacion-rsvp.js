import { expect } from "@playwright/test";
import { Given, When, Then, nuevaCuenta, fechaFutura, registrar } from "./fixtures.js";

const cabecera = { "x-tuevento-client": "1" };

// El organizador se crea con `request` (no comparte cookies con el navegador): quien abre el
// enlace después es un invitado sin sesión, como en la realidad.
Given("que un organizador tiene una invitación familiar con notas privadas", async ({ request, ctx }) => {
  const registro = await registrar(request, "/api/auth/register", { headers: cabecera, data: nuevaCuenta() });
  expect(registro.status()).toBe(201);
  const evento = await request.post("/api/events", {
    headers: cabecera,
    data: {
      title: "Fiesta de notas privadas",
      description: "",
      date: fechaFutura,
      timeZone: "America/Mexico_City",
      location: "Jardín de pruebas",
      theme: "floral",
    },
  });
  expect(evento.status()).toBe(201);
  ctx.evento = await evento.json();
  const invitacion = await request.post(`/api/events/${ctx.evento.id}/invitations`, {
    headers: cabecera,
    data: {
      name: "Familia Notas",
      kind: "family",
      email: "",
      phone: "",
      notes: "",
      members: [
        { name: "Ana Prueba", kind: "adult", notes: "Alergia privada" },
        { name: "Leo Prueba", kind: "child", notes: "Sin nueces" },
      ],
    },
  });
  expect(invitacion.status()).toBe(201);
  ctx.token = (await invitacion.json()).token;
});

Then("veo al integrante {string}", async ({ page }, nombre) => {
  await expect(page.getByRole("group", { name: new RegExp(`^${nombre}`) })).toBeVisible();
});

Then("no veo la nota privada {string}", async ({ page }, nota) => {
  await expect(page.getByText(nota)).toHaveCount(0);
});

When("en la invitación {string} respondo {string}", async ({ page }, nombre, respuesta) => {
  await page
    .getByRole("group", { name: new RegExp(`^${nombre}`) })
    .getByRole("button", { name: respuesta, exact: true })
    .click();
});
