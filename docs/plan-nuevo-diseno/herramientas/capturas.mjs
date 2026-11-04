#!/usr/bin/env node
// Capturas de las páginas públicas en tres anchos, y comprobación de desbordes e imágenes rotas.
// La app debe estar arriba. Uso: node docs/plan-nuevo-diseno/herramientas/capturas.mjs /acceso /precios
import { mkdirSync } from "node:fs";
import { chromium } from "playwright";

const base = process.env.E2E_BASE_URL || "http://localhost:5187";
const paths = process.argv.slice(2).length ? process.argv.slice(2) : ["/"];
const out = "qa-artifacts/sitio";
mkdirSync(out, { recursive: true });
const browser = await chromium.launch();
let bad = 0;
for (const path of paths) {
  for (const width of [1440, 768, 390]) {
    const page = await browser.newPage({ viewport: { width, height: 900 }, reducedMotion: "reduce" });
    await page.goto(base + path, { waitUntil: "networkidle" });
    const info = await page.evaluate(async () => {
      for (const image of document.images) image.loading = "eager";
      await Promise.all([...document.images].map((i) => i.decode().catch(() => {})));
      return {
        overflow: document.documentElement.scrollWidth - innerWidth,
        broken: [...document.images].filter((i) => !i.naturalWidth).length,
      };
    });
    const name = `${path.replace(/\W+/g, "-").replace(/^-|-$/g, "") || "inicio"}-${width}.png`;
    await page.screenshot({ path: `${out}/${name}`, fullPage: true });
    const ok = info.overflow <= 0 && info.broken === 0;
    if (!ok) bad += 1;
    console.log(`${ok ? "bien" : "MAL "} ${name} desborde=${info.overflow} rotas=${info.broken}`);
    await page.close();
  }
}
await browser.close();
process.exit(bad ? 1 : 0);
