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

Antes de cerrar un cambio con texto: `npm run build -w @tuevento/contracts`, `npm run typecheck` y `npm run test:unit` (paridad de claves, plurales, variables, marcas y claves sin uso o inexistentes en todos los idiomas). `npm test` ejecuta además la API, la base de datos y los escenarios web (ver [docs/TESTS.md](docs/TESTS.md)).

## Dependencias: una sola versión por paquete

Un mismo paquete (zod, react…) lleva **el mismo rango en todos los workspaces**, y cada workspace declara en su `package.json` todo lo que importa (la imagen de producción instala solo `--workspace @tuevento/api`). `node scripts/check-versions.mjs` lo comprueba y corre dentro de `npm test` (y por tanto en CI). Si un paquete va atado a otro (p. ej. `fastify` fijado en `5.12.5` por `@nestjs/platform-fastify`), usa la versión que exige el otro, no la última.

## Límites de datos: los mismos en frontend, backend y base de datos

Todo límite de longitud de un dato (máximo de caracteres, dígitos…) vive en **un solo sitio** (`accountLimits` en `packages/contracts/src/index.ts`) y se aplica en los tres niveles con el mismo valor:

- **Frontend:** `maxLength={accountLimits.x}` en el campo.
- **Backend:** el esquema Zod usa `accountLimits.x` y un mensaje traducido (`validation.maximumNCharacters`, en todos los idiomas).
- **Base de datos:** una migración nueva (`apps/api/migrations/NNN_*.sql`, nunca editar una ya aplicada) con `ALTER TABLE t ADD CONSTRAINT t_col_max_length CHECK (char_length(col) <= N)`.

Al crear o cambiar un límite, añade su columna a `packages/contracts/src/limits.test.ts`: ese test (dentro de `npm test`) falla si el valor de la base de datos y el de `accountLimits` difieren o si un límite no tiene columna. Un dato sin columna (p. ej. la contraseña, que se guarda como hash) se declara ahí como excepción.

## Pruebas E2E: cada comportamiento tiene su escenario

Todo comportamiento visible o regla de validación nueva o cambiada se entrega con su escenario Gherkin en español en `tests/e2e/features/` (ver [docs/E2E.md](docs/E2E.md)), en el mismo cambio. Los pasos están en `tests/e2e/steps/`; los escenarios usan datos únicos y no dependen del estado de la base de datos.

Antes de cerrar un cambio, con la app arriba (`docker compose up -d`): `npm run e2e` y `npm run e2e:summary`. Si un escenario falla, se arregla el código o se actualiza el escenario con motivo: nunca se omite ni se borra para pasar. CI ejecuta lo mismo.

## Primero en local, después en CI o producción

Toda prueba, script o workflow nuevo se valida **primero en local** y solo cuando pasa ahí se lleva a CI o a producción; nunca al revés. **Solo dos grupos de pruebas se ejecutan solo en local** por ahora, por decisión del usuario: las de las **apps móviles** (emulador de Android, simulador de iOS: `npm run e2e:movil`; `.github/workflows/mobile-e2e.yml` queda en manual) y las de la **base de datos** (`tests/db`, `npm run test:db`). Ninguna se añade a los PR ni a un despliegue hasta que el usuario lo pida. El resto (web, API, contracts) sí corre en CI como siempre, después de pasar en local. Un cambio en un workflow de CI se prueba antes ejecutando en local lo mismo que hace (los mismos comandos), y se avisa de lo que no se pudo comprobar.

## Pruebas: cada capa tiene las suyas

`npm test` ejecuta todas las suites (unit, api, endpoints, security, db, e2e) con un resumen; cada una tiene su comando (`npm run test:api`, `test:endpoints`, `test:security`, `test:db`, `e2e`). Detalle en [docs/TESTS.md](docs/TESTS.md).

- Un endpoint nuevo o cambiado se entrega con su prueba de API; si toca autenticación, permisos, datos de otras cuentas o entradas del usuario, también con su caso en `tests/api/test-security.mjs`.
- Una migración, restricción o columna nueva se entrega con su prueba en `tests/db/specs/`.
- Idiomas soportados: es, en, pt, de y fr; cualquier prueba que dependa del idioma cubre los cinco.
- **La API siempre corre en GitHub Actions** (`test:api`, `test:endpoints`, `test:security`: la sirve a varios clientes). **Base de datos (`tests/db`) y móviles, solo en local** hasta que el usuario pida pasarlas a CI.
- En los workflows, `npm run test:unit` (rápido, sin app) sustituye a `npm test`, que necesita la app arriba.
