// npm audit --audit-level=high en el CI (SEG-06), con excepciones documentadas y con fecha de
// revisión: pasada esa fecha, la excepción deja de valer y el check falla hasta que se revise.
import { execFileSync } from "node:child_process";

// Formato: paquete: { motivo: "…", revisar: "AAAA-MM-DD" }. Hoy no hay ninguna.
const excepciones = {};

const graves = new Set(["high", "critical"]);
let salida;
try {
  salida = execFileSync("npm", ["audit", "--json"], { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
} catch (error) {
  // npm audit sale con 1 cuando encuentra vulnerabilidades: el JSON viene igual
  salida = error.stdout;
}
const { vulnerabilities = {} } = JSON.parse(salida);
const hoy = new Date().toISOString().slice(0, 10);
const fallos = [];
for (const [paquete, v] of Object.entries(vulnerabilities)) {
  if (!graves.has(v.severity)) continue;
  const excepcion = excepciones[paquete];
  if (excepcion && hoy <= excepcion.revisar) {
    console.log(`Aceptado hasta ${excepcion.revisar}: ${paquete} (${v.severity}): ${excepcion.motivo}`);
    continue;
  }
  const avisos = v.via.filter((x) => typeof x === "object").map((x) => x.url);
  fallos.push(`${paquete} (${v.severity})${excepcion ? `: la excepción caducó el ${excepcion.revisar}` : ""} ${avisos.join(" ")}`);
}
if (fallos.length) {
  console.error(`Vulnerabilidades altas o críticas:\n- ${fallos.join("\n- ")}`);
  process.exit(1);
}
console.log("npm audit: sin vulnerabilidades altas ni críticas fuera de las excepciones.");
