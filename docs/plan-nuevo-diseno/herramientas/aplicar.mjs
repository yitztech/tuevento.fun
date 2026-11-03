#!/usr/bin/env node
// Aplica una tarea del plan: comprueba el parche, copia los archivos, aplica el parche, borra lo
// que toque y añade las traducciones. Si algo no encaja, para ANTES de cambiar nada.
// Uso: node docs/plan-nuevo-diseno/herramientas/aplicar.mjs T06
import { execFileSync } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, readFileSync, rmSync } from "node:fs";
import { dirname, join } from "node:path";

const plan = "docs/plan-nuevo-diseno";
const id = process.argv[2];
const tasks = JSON.parse(readFileSync(join(plan, "herramientas/tareas.json"), "utf8"));
const task = tasks[id];
if (!task) {
  console.error(`No existe la tarea ${id}. Tareas: ${Object.keys(tasks).join(" ")}`);
  process.exit(2);
}
const stop = (message) => {
  console.error(`\nPARA: ${message}\nNo se cambió nada. No improvises: avisa con este mensaje.`);
  process.exit(1);
};
const patch = task.parche && join(plan, "parches", task.parche);
if (patch) {
  try {
    execFileSync("git", ["apply", "--check", patch], { stdio: "pipe" });
  } catch (error) {
    stop(`el parche ${task.parche} no encaja:\n${error.stderr}`);
  }
}
for (const file of task.nuevos ?? []) {
  if (existsSync(file)) stop(`${file} ya existe; ¿ya se aplicó esta tarea?`);
  if (!existsSync(join(plan, "fuentes", file))) stop(`falta ${file} en fuentes/`);
}
for (const file of task.reemplazar ?? []) {
  if (!existsSync(file)) stop(`no existe ${file}, que se iba a reemplazar`);
}
for (const file of [...(task.nuevos ?? []), ...(task.reemplazar ?? [])]) {
  mkdirSync(dirname(file), { recursive: true });
  copyFileSync(join(plan, "fuentes", file), file);
  console.log(`copiado  ${file}`);
}
if (patch) {
  execFileSync("git", ["apply", patch], { stdio: "inherit" });
  console.log(`parche   ${task.parche}`);
}
for (const file of task.borrar ?? []) {
  rmSync(file);
  console.log(`borrado  ${file}`);
}
if (task.claves) {
  execFileSync("node", [join(plan, "herramientas/add-keys.mjs"), join(plan, "traducciones", task.claves)], { stdio: "inherit" });
}
if (task.podar) {
  execFileSync("node", [join(plan, "herramientas/prune-keys.mjs"), ...task.podar], { stdio: "inherit" });
}
if (task.css) {
  execFileSync("node", [join(plan, "herramientas/quitar-css.mjs"), ...task.css], { stdio: "inherit" });
}
console.log(`\n${id} aplicada. Sigue con la verificación de la tarea.`);
