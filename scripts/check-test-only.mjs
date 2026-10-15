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

const prohibidos = [
  "compose.prod.yml",
  ...readdirSync(".github/workflows").map((f) => `.github/workflows/${f}`),
  ...["api", "web", "gateway", "postgres"].map((s) => `services/${s}/Dockerfile`),
];
for (const file of prohibidos) {
  const text = readFileSync(file, "utf8");
  for (const servicio of soloPruebas)
    if (text.includes(servicio)) errores.push(`${file} menciona ${servicio} (solo para pruebas)`);
}

if (errores.length) {
  console.error(errores.map((e) => `✗ ${e}`).join("\n"));
  process.exit(1);
}
console.log(`✓ Servicios solo de pruebas aislados de producción (${soloPruebas.join(", ")})`);
