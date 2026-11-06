import { execFileSync } from "node:child_process";
import { When, Then } from "./fixtures.js";

/** Raíz del repositorio: `docker compose` busca ahí sus archivos. */
const raiz = new URL("../../../", import.meta.url);

When("mi cuenta queda como la deja el registro con Google", async ({ ctx }) => {
  // Sin credenciales de Google no hay registro real: se deja la cuenta sin teléfono y con el paso pendiente
  execFileSync("docker", ["compose", "exec", "-T", "postgres", "psql", "-U", "tuevento", "-d", "tueventofun", "-c",
    `UPDATE users SET phone='',must_add_phone=true WHERE email='${ctx.cuenta.email.replace(/'/g, "''")}'`], { stdio: "ignore", cwd: raiz });
});

Then("me pide mi teléfono", async ({ ui }) => {
  await ui.esperarTexto("Añade tu teléfono");
});
