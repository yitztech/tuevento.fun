# TuEventoFun

## Idiomas: todo texto nace en todos los idiomas

La aplicación se publica en español (`es`, principal, tuevento.fun), inglés (`en`, yourevent.fun), portugués (`pt`, yourevent.fun/pt), alemán (`de`, yourevent.fun/de) y francés (`fr`, yourevent.fun/fr). La lista vive en `locales` (`packages/contracts/src/i18n.ts`); el detalle está en [docs/I18N.md](docs/I18N.md).

Regla: **todo componente, pantalla, correo, error o validación que muestre texto se entrega traducido a todos los idiomas de la tabla en el mismo cambio.** No hay "luego lo traduzco" ni textos que caen al español.

- Nada de texto fijo en JSX ni en atributos (`aria-label`, `title`, `alt`, `placeholder`): siempre `tr("area.clave")`, `<Lines k=… />` o `<RichText k=… />`.
- Cada clave nueva se añade a la vez en `packages/contracts/src/locales/{es,en,pt,de,fr}.json`, con traducción real y natural (no una copia del español ni del inglés), las mismas variables `{{…}}` y marcas `<…>`, y las categorías de plural que pida cada idioma (`_one`, `_other`…).
- Frases completas con variables; nunca concatenar trozos traducidos.
- Textos legales: un archivo por idioma en `packages/app/src/legal-texts/`.
- Tono: tuteo en español, «você» en portugués de Brasil (`pt-BR`), «du» en alemán, «tu» en francés (con espacio fino no separable antes de `? ! : ;` y dentro de « »).
- El contenido de los usuarios (títulos, nombres, notas, lugares) nunca se traduce.
- Si se añade un idioma a la tabla, esta regla lo incluye automáticamente: actualiza la lista de arriba.

Antes de cerrar un cambio con texto: `npm run build -w @tuevento/contracts`, `npm run typecheck` y `npm test` (paridad de claves, plurales, variables, marcas y claves sin uso o inexistentes en todos los idiomas).

## Dependencias: una sola versión por paquete

Un mismo paquete (zod, react…) lleva **el mismo rango en todos los workspaces**, y cada workspace declara en su `package.json` todo lo que importa (la imagen de producción instala solo `--workspace @tuevento/api`). `node scripts/check-versions.mjs` lo comprueba y corre dentro de `npm test` (y por tanto en CI). Si un paquete va atado a otro (p. ej. `fastify` fijado en `5.12.5` por `@nestjs/platform-fastify`), usa la versión que exige el otro, no la última.
