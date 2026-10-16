// Antes de los escenarios web: carga la app hasta que Vite (modo desarrollo en Docker) termina
// de optimizar dependencias. Tras recrear los contenedores, el primer arranque es lento y
// recarga la página, lo que hacía fallar escenarios que no tienen nada roto.
import { chromium } from "@playwright/test";
import { baseURL } from "./entorno.js";

export default async function calentar() {
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage();
    let tranquilas = 0;
    const limite = Date.now() + 90_000;
    while (tranquilas < 2 && Date.now() < limite) {
      let recargas = 0;
      page.on("framenavigated", () => recargas++);
      const ok = await page.goto(`${baseURL}/registro`, { waitUntil: "networkidle" }).then((r) => r?.ok(), () => false);
      const listo = ok && (await page.getByLabel("Nombre(s)", { exact: true }).isVisible({ timeout: 5000 }).catch(() => false));
      await page.waitForTimeout(1500);
      tranquilas = listo && recargas <= 1 ? tranquilas + 1 : 0;
      page.removeAllListeners("framenavigated");
    }
  } finally {
    await browser.close();
  }
}
