import { randomBytes } from "node:crypto";
import { When } from "./fixtures.js";

// Tokens con el formato correcto que no existen: la API responde como a uno caducado
const token = () => randomBytes(32).toString("base64url");

When("abro un enlace para confirmar el correo que ya caducó", async ({ page }) => {
  await page.goto(`/confirmar-correo?token=${token()}`);
});

When("abro un enlace para dejar de recibir avisos que no es válido", async ({ page }) => {
  await page.goto(`/baja-de-avisos?h=${token()}&s=${token()}`);
});
