import { createHash } from "node:crypto";
import { expect } from "@playwright/test";
import { When, Then } from "./fixtures.js";

// Regreso a la app tras el acceso en el navegador (regreso-app.feature). `request` ya tiene la sesión
// de la cuenta (la creó el paso anterior): hace de la página «Conectar mi app» del navegador.
When("empiezo a entrar con Google desde la app", async ({ ui }) => {
  await ui.abrir("/acceso");
  await ui.pulsar("Continuar con Google");
});

When("el navegador devuelve a la app el enlace de regreso", async ({ ui, request }) => {
  const verificador = await ui.verificadorPkce();
  const challenge = createHash("sha256").update(verificador).digest("base64url");
  const respuesta = await request.post("/api/auth/mobile/authorize", { headers: { "x-tuevento-client": "1" }, data: { challenge } });
  expect(respuesta.status()).toBe(201);
  const { code } = await respuesta.json();
  await ui.abrirEnlace(`https://localhost:8443/app-link/auth?code=${code}`);
});

Then("la app abre la sesión de mi cuenta", async ({ ui, ctx }) => {
  await ui.esperarUrl(/\/events$/);
  await ui.esperarTexto(ctx.titulo);
  expect(await ui.verificadorPkce()).toBeNull();
});
