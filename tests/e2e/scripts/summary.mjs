// Resumen de la última ejecución: escenarios por característica y por etiqueta.
//   npm run e2e:summary            (lee results/results.json)
import { readFileSync, existsSync } from "node:fs";

const file = new URL("../results/results.json", import.meta.url);
if (!existsSync(file)) {
  console.error("No hay resultados. Ejecuta antes: npm run e2e");
  process.exit(2);
}
const { suites, stats } = JSON.parse(readFileSync(file, "utf8"));

const rows = [];
const walk = (suite, feature, path) => {
  for (const spec of suite.specs ?? []) {
    const estado = spec.tests?.[0]?.status === "skipped" ? "omitido" : spec.ok ? "ok" : "FALLA";
    rows.push({
      feature,
      titulo: [...path, spec.title.replace(/\s@.*$/, "")].join(" › "),
      tags: spec.tags ?? [],
      estado,
    });
  }
  for (const child of suite.suites ?? []) walk(child, feature, [...path, child.title]);
};
// Nivel 1: el archivo; nivel 2: la Característica; después, esquemas de escenario.
for (const file of suites)
  for (const feature of file.suites ?? []) walk(feature, feature.title, []);

const icono = { ok: "✓", FALLA: "✗", omitido: "–" };
const porFeature = Map.groupBy(rows, (r) => r.feature);
for (const [feature, list] of porFeature) {
  const ok = list.filter((r) => r.estado === "ok").length;
  console.log(`\n${feature}  (${ok}/${list.length})`);
  for (const r of list) console.log(`  ${icono[r.estado]} ${r.titulo}  ${r.tags.map((t) => `@${t.replace(/^@/, "")}`).join(" ")}`);
}

console.log("\nPor etiqueta");
const porTag = new Map();
for (const r of rows) for (const t of new Set(r.tags.map((x) => x.replace(/^@/, ""))))
  porTag.set(t, [...(porTag.get(t) ?? []), r]);
for (const [tag, list] of [...porTag].sort()) {
  const ok = list.filter((r) => r.estado === "ok").length;
  console.log(`  @${tag.padEnd(12)} ${ok}/${list.length}`);
}

const fallan = rows.filter((r) => r.estado === "FALLA").length;
console.log(
  `\nTotal: ${stats.expected} correctos, ${stats.unexpected} fallidos, ${stats.skipped} omitidos, ${stats.flaky} inestables`,
);
process.exit(fallan ? 1 : 0);
