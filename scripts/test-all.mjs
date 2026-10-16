// npm test → todas las pruebas, una tras otra, con un resumen al final.
//   npm test                      unit, api, endpoints, security, db y e2e (web)
//   npm test -- security db       solo esas suites
//   npm test -- movil             Android e iOS, uno tras otro (solo local; no entra por defecto)
//   npm test -- --lista           muestra las suites
// Cada suite también tiene su comando propio (columna «comando»). Una suite que falla no
// detiene a las demás; el código de salida es distinto de 0 si alguna falló.
import { spawnSync } from "node:child_process";

const suites = {
  unit: { desc: "Esquemas Zod, límites, versiones y aislamiento de servicios de prueba", cmd: "npm run test:unit", stack: false },
  api: { desc: "API: flujos completos (eventos, invitaciones, RSVP, sesión, idiomas…)", cmd: "npm run test:api", stack: true },
  endpoints: { desc: "API: endpoints restantes, idiomas es/en/pt/de/fr y validación de entradas", cmd: "npm run test:endpoints", stack: true },
  security: { desc: "API: seguridad (auth, CSRF, IDOR, privilegios, sesión, fuerza bruta, fugas, inyección)", cmd: "npm run test:security", stack: true },
  db: { desc: "Base de datos: migraciones, restricciones, cascadas y permisos (solo local)", cmd: "npm run test:db", stack: true },
  e2e: { desc: "Web: escenarios Gherkin en Chromium", cmd: "npm run e2e", stack: true },
  movil: { desc: "Apps: Android e iOS, uno tras otro (solo local)", cmd: "npm run e2e:movil", stack: true, soloSiSePide: true },
};
const porDefecto = Object.keys(suites).filter((s) => !suites[s].soloSiSePide);

const args = process.argv.slice(2);
if (args.includes("--lista")) {
  for (const [n, s] of Object.entries(suites)) console.log(`${n.padEnd(10)} ${s.desc}\n${"".padEnd(11)}comando: ${s.cmd}`);
  process.exit(0);
}
const pedidas = args.length ? args : porDefecto;
const desconocidas = pedidas.filter((s) => !suites[s]);
if (desconocidas.length) {
  console.error(`Suite desconocida: ${desconocidas.join(", ")}. Disponibles: ${Object.keys(suites).join(", ")}`);
  process.exit(2);
}

const run = (command, opts = {}) => spawnSync(command, { shell: true, stdio: "inherit", ...opts });

// Las suites contra la API necesitan la app arriba (docker compose) y contracts compilado.
if (pedidas.some((s) => suites[s].stack)) {
  const arriba = await Promise.all([fetch("http://127.0.0.1:3087/api/health"), fetch("http://localhost:5187/")].map((p) => p.then((r) => r.ok).catch(() => false)));
  if (!arriba.every(Boolean)) {
    console.log("▸ La app no está arriba: docker compose up -d --wait");
    if (run("docker compose up -d --wait").status !== 0) {
      console.error("No se pudo levantar la app con Docker.");
      process.exit(1);
    }
  }
}
run("npm run build -w @tuevento/contracts", { stdio: "ignore" });

const resultados = [];
for (const nombre of pedidas) {
  const { desc, cmd } = suites[nombre];
  console.log(`\n━━ ${nombre}: ${desc}\n   $ ${cmd}\n`);
  const t = Date.now();
  const r = run(cmd);
  resultados.push({ nombre, ok: r.status === 0, seg: Math.round((Date.now() - t) / 1000), cmd });
}

console.log("\n━━ Resumen");
for (const r of resultados) console.log(`  ${r.ok ? "✓" : "✗"} ${r.nombre.padEnd(10)} ${String(r.seg).padStart(4)} s   ${r.ok ? "" : `→ repetir: ${r.cmd}`}`);
const fallidas = resultados.filter((r) => !r.ok).length;
console.log(fallidas ? `\n${fallidas} de ${resultados.length} suites fallaron` : `\nTodas las suites pasan (${resultados.length})`);
process.exit(fallidas ? 1 : 0);
