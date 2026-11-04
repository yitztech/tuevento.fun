#!/usr/bin/env node
// Borra de styles.css las reglas de clases que ya nadie usa. Solo borra una regla si TODOS sus
// selectores nombran una de las clases; borra también las media queries que queden vacías.
// Uso: node docs/plan-nuevo-diseno/herramientas/quitar-css.mjs auth-layout auth-story …
import { readFileSync, writeFileSync } from "node:fs";
import postcss from "postcss";

const classes = process.argv.slice(2);
if (!classes.length) {
  console.error("Uso: quitar-css.mjs <clase> [<clase>…]");
  process.exit(2);
}
const path = "packages/app/src/styles.css";
const root = postcss.parse(readFileSync(path, "utf8"));
const dead = new RegExp(`\\.(${classes.join("|")})(?![\\w-])`);
let removed = 0;
root.walkRules((rule) => {
  if (rule.selectors.every((selector) => dead.test(selector))) {
    rule.remove();
    removed += 1;
  } else {
    const alive = rule.selectors.filter((selector) => !dead.test(selector));
    if (alive.length !== rule.selectors.length) rule.selectors = alive;
  }
});
root.walkAtRules("media", (media) => {
  if (!media.nodes?.length) media.remove();
});
writeFileSync(path, root.toString());
console.log(`${removed} reglas borradas.`);
