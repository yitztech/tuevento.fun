// Capturas de las seis páginas en los nueve tamaños del plan, y comprobación de desbordamiento horizontal.
//
//   npm run build -w @tuevento/new-design && npm run shots -w @tuevento/new-design
//   npm run shots -w @tuevento/new-design -- --only=home,demo --sizes=375x812,1440x900
//
// Salida: artifacts/screenshots/{mobile,tablet,laptop,desktop}/<pagina>-<ancho>x<alto>.png
import { spawn } from "node:child_process";
import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "@playwright/test";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const base = process.env.BASE_URL ?? "http://127.0.0.1:5190";
const arg = (n) => process.argv.find((a) => a.startsWith(`--${n}=`))?.split("=")[1]?.split(",");

const pages = { home: "/", login: "/login", registro: "/registro", recuperar: "/recuperar-contrasena", proveedores: "/proveedores", demo: "/demo" };
const sizes = [
  ["mobile", 320, 700],
  ["mobile", 375, 812],
  ["mobile", 430, 932],
  ["tablet", 768, 1024],
  ["tablet", 1024, 768],
  ["laptop", 1366, 768],
  ["desktop", 1440, 900],
  ["desktop", 1920, 1080],
  ["desktop", 2560, 1440],
];
const only = arg("only");
const onlySizes = arg("sizes");

const alive = () => fetch(base).then((r) => r.ok).catch(() => false);
let server;
if (!(await alive())) {
  server = spawn("npx", ["vite", "preview", "--port", "5190", "--strictPort"], { cwd: root, stdio: "ignore" });
  for (let i = 0; i < 50 && !(await alive()); i++) await new Promise((r) => setTimeout(r, 200));
}

const browser = await chromium.launch();
let overflow = 0;
let broken = 0;
for (const [group, w, h] of sizes) {
  if (onlySizes && !onlySizes.includes(`${w}x${h}`)) continue;
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 1, hasTouch: w < 800 });
  for (const [name, path] of Object.entries(pages)) {
    if (only && !only.includes(name)) continue;
    const page = await ctx.newPage();
    await page.goto(base + path, { waitUntil: "networkidle" });
    await page.evaluate(() => document.fonts.ready);
    // Fuerza la carga de las imágenes diferidas antes de capturar
    await page.evaluate(async () => {
      for (const img of document.images) img.loading = "eager";
      await Promise.all([...document.images].map((i) => (i.complete ? 0 : new Promise((r) => { i.onload = i.onerror = r; }))));
    });
    const info = await page.evaluate(() => ({
      over: document.documentElement.scrollWidth - window.innerWidth,
      broken: [...document.images].filter((i) => i.complete && i.naturalWidth === 0).map((i) => i.src),
    }));
    if (info.over > 0) { overflow++; console.log(`DESBORDE ${name} ${w}x${h}: +${info.over}px`); }
    if (info.broken.length) { broken += info.broken.length; console.log(`IMAGEN ROTA ${name} ${w}x${h}: ${info.broken.join(", ")}`); }
    const dir = join(root, "artifacts/screenshots", group);
    mkdirSync(dir, { recursive: true });
    await page.screenshot({ path: join(dir, `${name}-${w}x${h}.png`), fullPage: true });
    await page.close();
  }
  await ctx.close();
}
await browser.close();
server?.kill();
console.log(`Listo. Desbordes: ${overflow}. Imágenes rotas: ${broken}.`);
process.exit(overflow || broken ? 1 : 0);
