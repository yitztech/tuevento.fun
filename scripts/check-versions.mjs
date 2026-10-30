// Falla si una misma dependencia tiene rangos distintos entre workspaces, o si un
// workspace importa un paquete que no declara (funciona hoy por el hoisting y rompe
// en la imagen de producción, que instala solo `--workspace @tuevento/api`).
import { readFileSync, readdirSync, existsSync, statSync } from "node:fs";
import { builtinModules } from "node:module";
import { join } from "node:path";

const read = (p) => JSON.parse(readFileSync(p, "utf8"));
const dirs = [
  ".",
  ...["apps", "packages", "tests"].flatMap((g) =>
    readdirSync(g).map((d) => join(g, d)),
  ),
].filter((d) => existsSync(join(d, "package.json")));

const kinds = ["dependencies", "devDependencies", "peerDependencies"];
// Paquetes atados a otro que exige una versión distinta en un workspace: se comprueba que ese
// workspace use exactamente el rango anotado y quedan fuera de la comparación con el resto.
const atados = {
  // @angular/compiler-cli 22 pide typescript >=6.0 <6.1; el resto del repositorio usa TypeScript 7
  typescript: { "@tuevento/admin": "~6.0.3" },
};
const ranges = new Map();
const errors = [];
const workspaceNames = new Set(dirs.map((d) => read(join(d, "package.json")).name));

for (const dir of dirs) {
  const pkg = read(join(dir, "package.json"));
  for (const kind of kinds) {
    for (const [name, range] of Object.entries(pkg[kind] ?? {})) {
      const atado = atados[name]?.[pkg.name];
      if (atado) {
        if (range !== atado) errors.push(`${pkg.name} debe usar ${name} ${atado} (atado, ver check-versions.mjs), no ${range}`);
        continue;
      }
      const seen = ranges.get(name) ?? new Map();
      seen.set(range, [...(seen.get(range) ?? []), `${pkg.name}`]);
      ranges.set(name, seen);
    }
  }
}
for (const [name, seen] of ranges) {
  if (seen.size > 1) {
    const detail = [...seen].map(([r, who]) => `${r} (${who.join(", ")})`).join(" ≠ ");
    errors.push(`Versiones distintas de ${name}: ${detail}`);
  }
}

const walk = (d) =>
  readdirSync(d).flatMap((f) => {
    const p = join(d, f);
    if (["node_modules", "dist", "android", "ios", ".features-gen", "results"].includes(f)) return [];
    return statSync(p).isDirectory() ? walk(p) : /\.(tsx?|mjs)$/.test(f) ? [p] : [];
  });
const builtins = new Set(builtinModules);
for (const dir of dirs.filter((d) => d !== ".")) {
  const pkg = read(join(dir, "package.json"));
  const declared = new Set(kinds.flatMap((k) => Object.keys(pkg[k] ?? {})));
  const missing = new Set();
  const sources = ["src", "steps", "support", "scripts", "features", "specs"].map((d) => join(dir, d)).filter(existsSync);
  for (const file of sources.flatMap(walk)) {
    for (const m of readFileSync(file, "utf8").matchAll(
      /(?:from\s+|import\s*\(\s*|require\(\s*)["']([^."'/][^"']*)["']/g,
    )) {
      // node: es del runtime; @/ es el alias de los componentes de shadcn (packages/app/components.json)
      if (m[1].startsWith("node:") || m[1].startsWith("@/")) continue;
      const spec = m[1];
      const name = spec.startsWith("@") ? spec.split("/").slice(0, 2).join("/") : spec.split("/")[0];
      if (!builtins.has(name) && !declared.has(name)) missing.add(name);
    }
  }
  for (const name of missing) errors.push(`${pkg.name} importa ${name} sin declararlo en su package.json`);
}

// Go (services/search): la versión de go.mod es la de la imagen que lo compila
const goMod = readFileSync("services/search/go.mod", "utf8").match(/^go (\S+)$/m)?.[1];
const goImage = readFileSync("services/search/Dockerfile", "utf8").match(/^FROM golang:([0-9.]+)-/m)?.[1];
if (!goMod || goMod !== goImage) errors.push(`services/search: go.mod pide Go ${goMod} y el Dockerfile usa golang:${goImage}`);

if (errors.length) {
  console.error(errors.map((e) => `✗ ${e}`).join("\n"));
  process.exit(1);
}
console.log(`✓ Versiones coherentes en ${dirs.length} workspaces (${workspaceNames.size} paquetes)`);
