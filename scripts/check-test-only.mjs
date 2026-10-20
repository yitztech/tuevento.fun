// Los servicios solo de pruebas no pueden llegar a producción: deben vivir en
// compose.yml bajo un perfil, y no aparecer en compose.prod.yml, Dockerfiles ni workflows
// de despliegue.
import { readFileSync, readdirSync } from "node:fs";

const soloPruebas = ["mobile-tls"];
const errores = [];
const compose = readFileSync("compose.yml", "utf8");

for (const servicio of soloPruebas) {
  const bloque = compose.match(new RegExp(`^  ${servicio}:\\n((?:    .*\\n|\\n)+)`, "m"))?.[1];
  if (!bloque) errores.push(`${servicio} no está en compose.yml`);
  else if (!/^    profiles: \[.+\]/m.test(bloque))
    errores.push(`${servicio} debe tener un perfil (profiles) en compose.yml`);
  else if (!/tuevento\.solo-pruebas: "true"/.test(bloque))
    errores.push(`${servicio} debe llevar la etiqueta tuevento.solo-pruebas`);
}

// Servicios que solo añade compose.ci.yml (el entorno de pruebas sobre el de producción)
const soloPruebasCi = ["mailpit"];
const composeCi = readFileSync("compose.ci.yml", "utf8");
for (const servicio of soloPruebasCi) {
  const bloque = composeCi.match(new RegExp(`^  ${servicio}:\\n((?:    .*\\n|\\n)+)`, "m"))?.[1];
  if (!bloque) errores.push(`${servicio} no está en compose.ci.yml`);
  else if (!/tuevento\.solo-pruebas: "true"/.test(bloque))
    errores.push(`${servicio} debe llevar la etiqueta tuevento.solo-pruebas en compose.ci.yml`);
}

const prohibidos = [
  "compose.prod.yml",
  // mobile-e2e.yml es el único workflow de pruebas: nombra el servicio, pero no despliega nada.
  ...readdirSync(".github/workflows")
    .filter((f) => f !== "mobile-e2e.yml")
    .map((f) => `.github/workflows/${f}`),
  ...["api", "web", "gateway", "postgres"].map((s) => `services/${s}/Dockerfile`),
];
for (const file of prohibidos) {
  const text = readFileSync(file, "utf8");
  for (const servicio of [...soloPruebas, ...soloPruebasCi])
    if (new RegExp(`^\\s+${servicio}:`, "m").test(text) || (servicio !== "mailpit" && text.includes(servicio)))
      errores.push(`${file} menciona ${servicio} (solo para pruebas)`);
}

if (errores.length) {
  console.error(errores.map((e) => `✗ ${e}`).join("\n"));
  process.exit(1);
}
console.log(`✓ Servicios solo de pruebas aislados de producción (${[...soloPruebas, ...soloPruebasCi].join(", ")})`);
