import { expect } from "@playwright/test";
import { randomBytes } from "node:crypto";
import { Given, When, Then, nuevaCuenta } from "./fixtures.js";

const cabecera = { "x-tuevento-client": "1" };
const campoApi = { correo: "email", teléfono: "phone", nombre: "firstName", apellidos: "lastName", contraseña: "password" };

/** Texto del tamaño exacto pedido; el correo conserva forma válida. */
function texto(campo, n) {
  // Prefijo aleatorio: el correo debe ser único en cada ejecución.
  if (campo === "email") {
    const unico = randomBytes(6).toString("hex");
    return `${unico}${"a".repeat(n - "@example.com".length - unico.length)}@example.com`;
  }
  if (campo === "phone") return "1".repeat(n);
  return "a".repeat(n);
}

Given("un registro válido para la API", async ({ ctx }) => {
  ctx.datos = nuevaCuenta();
});

When("cambio {string} por {string}", async ({ ctx }, campo, valor) => {
  ctx.datos[campoApi[campo]] = valor;
});

When("cambio {string} por un texto de {int} caracteres", async ({ ctx }, campo, n) => {
  const clave = campoApi[campo];
  ctx.datos[clave] = texto(clave, n);
});

When("lo envío a la API de registro", async ({ page, ctx }) => {
  ctx.respuesta = await page.request.post("/api/auth/register", { headers: cabecera, data: ctx.datos });
});

When("envío a la API del perfil el nombre {string}", async ({ page, ctx }, nombre) => {
  ctx.respuesta = await page.request.patch("/api/profile", {
    headers: cabecera,
    data: { firstName: nombre, lastName: ctx.cuenta.lastName, phone: ctx.cuenta.phone },
  });
});

Then("la API responde {int}", async ({ ctx }, estado) => {
  expect(ctx.respuesta.status()).toBe(estado);
});

Then("la API responde {int} con el mensaje {string}", async ({ ctx }, estado, mensaje) => {
  expect(ctx.respuesta.status()).toBe(estado);
  expect((await ctx.respuesta.json()).message).toBe(mensaje);
});
