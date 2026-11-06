import { expect } from "@playwright/test";
import { Given, When, Then, nuevaCuenta, fechaFutura, registrar } from "./fixtures.js";

// Trabajo sin conexión en las apps (sin-conexion.feature). Los datos se crean y se comprueban con
// `request`, que no comparte la sesión con la app: es «la web» u «otro dispositivo» de la misma cuenta.
const cabecera = { "x-tuevento-client": "1" };

Given("que tengo un evento con una invitación para {string} creados por la API", async ({ request, ctx }, nombre) => {
  ctx.cuenta = nuevaCuenta();
  expect((await registrar(request, "/api/auth/register", { headers: cabecera, data: ctx.cuenta })).status()).toBe(201);
  ctx.titulo = `Fiesta sin red ${Date.now()}`;
  const evento = await request.post("/api/events", {
    headers: cabecera,
    data: { title: ctx.titulo, description: "", date: fechaFutura, timeZone: "America/Mexico_City", location: "Jardín de pruebas", theme: "floral" },
  });
  expect(evento.status()).toBe(201);
  ctx.evento = await evento.json();
  const invitacion = await request.post(`/api/events/${ctx.evento.id}/invitations`, {
    headers: cabecera,
    data: { name: nombre, kind: "family", email: "", phone: "", notes: "", members: [{ name: "Luis Pérez", kind: "adult", notes: "" }] },
  });
  expect(invitacion.status()).toBe(201);
  ctx.invitacion = await invitacion.json();
});

Given("entro en la app con esa cuenta", async ({ ui, ctx }) => {
  await ui.abrir("/acceso");
  await ui.escribir("Correo electrónico", ctx.cuenta.email);
  await ui.escribir("Contraseña", ctx.cuenta.password);
  await ui.pulsar("Entrar a mi espacio");
  await ui.esperarUrl(/\/app$/);
  // La primera sincronización guarda los eventos en el teléfono
  await ui.esperarTexto(ctx.titulo);
  await ui.esperarCopiaLocal(ctx.cuenta.email);
});

// Hay un sondeo cada 10 s (dos peticiones); un bucle de recargas envía decenas en este tiempo
Then("la app en reposo no repite peticiones", async ({ ui }) => {
  await ui.pausar(3000); // termina la sincronización del arranque
  const antes = await ui.peticiones();
  await ui.pausar(5000);
  expect((await ui.peticiones()) - antes).toBeLessThanOrEqual(4);
});

When("me quedo sin conexión", async ({ ui }) => {
  await ui.sinRed(true);
});

When("vuelve la conexión", async ({ ui }) => {
  await ui.sinRed(false);
});

When("cierro y vuelvo a abrir la app", async ({ ui }) => {
  await ui.reabrir();
});

Then("veo mi evento en la lista", async ({ ui, ctx }) => {
  await ui.abrir("/eventos");
  await ui.esperarTexto(ctx.titulo);
});

When("creo el evento {string}", async ({ ui, ctx }, titulo) => {
  ctx.nuevo = `${titulo} ${Date.now()}`;
  await ui.abrir("/eventos/nuevo");
  await ui.escribir("Nombre del evento", ctx.nuevo);
  await ui.fijarValor("Fecha y hora", `${new Date().getUTCFullYear() + 1}-07-20T20:00`);
  await ui.escribir("¿Dónde nos vemos?", "Terraza de pruebas");
  await ui.pulsar("Crear mi evento");
  await ui.esperarTexto(ctx.nuevo);
});

Then("el evento {string} queda guardado en mi cuenta", async ({ request, ctx }, _titulo) => {
  await expect
    .poll(async () => (await (await request.get("/api/events", { headers: cabecera })).json()).map((e) => e.title), {
      timeout: 60_000,
    })
    .toContain(ctx.nuevo);
});

When("cambio el nombre de la invitación {string} por {string}", async ({ ui, ctx }, actual, nuevo) => {
  await ui.abrir(`/eventos/${ctx.evento.id}`);
  await ui.pulsar(actual);
  await ui.escribir("Nombre de la invitación", nuevo);
  await ui.pulsar("Guardar cambios");
  await ui.esperarTexto(nuevo);
});

When("otra persona cambia el nombre de esa invitación por {string}", async ({ request, ctx }, nombre) => {
  const { id, eventId, version, kind, email, phone, notes, members } = ctx.invitacion;
  const r = await request.put(`/api/events/${eventId}/invitations/${id}`, {
    headers: { ...cabecera, "If-Match": `"${version}"` },
    data: { name: nombre, kind, email, phone, notes, members: members.map(({ id: m, name, kind: k, notes: n }) => ({ id: m, name, kind: k, notes: n })) },
  });
  expect(r.status()).toBe(200);
});

When("abro los cambios por revisar y me quedo con mi versión", async ({ ui }) => {
  await ui.abrir("/sincronizar");
  await ui.esperarTexto("Versión guardada");
  await ui.pulsar("Quedarme con la mía");
});

Then("la invitación queda guardada como {string}", async ({ request, ctx }, nombre) => {
  await expect
    .poll(
      async () => {
        const lista = await (await request.get(`/api/events/${ctx.evento.id}/invitations`, { headers: cabecera })).json();
        return lista.find((i) => i.id === ctx.invitacion.id)?.name;
      },
      // La primera petición tras volver la red puede tardar en el emulador
      { timeout: 60_000 },
    )
    .toBe(nombre);
});
