import { Given } from "./fixtures.js";

// La app nativa no comparte la sesión con `request` ni con la API del navegador: se entra por
// el formulario de acceso, igual que haría una persona en el teléfono.
Given("entro en la app con mi cuenta", async ({ ui, ctx }) => {
  await ui.abrir("/acceso");
  await ui.escribir("Correo electrónico", ctx.cuenta.email);
  await ui.escribir("Contraseña", ctx.cuenta.password);
  await ui.pulsar("Entrar a mi espacio");
  await ui.esperarUrl(/\/app$/);
});
