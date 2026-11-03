# Plan: llevar el diseño nuevo al sitio público

El diseño de la rama `feat/new-design` (prototipo `apps/new-design`) pasa al sitio real sin perder ninguna
función. Este plan lo ejecutan modelos económicos: casi todo el trabajo ya está hecho y probado aquí, y cada
tarea es aplicarlo, comprobarlo y hacer commit.

**Si eres el modelo que implementa:** lee «Reglas para quien implementa» y después solo el archivo de tu tarea.

## Qué se migra

| Página | Qué cambia | Tarea |
|---|---|---|
| Portada `/` | Todo el aspecto; se quitan `landing.css` y 18 textos | T04–T10 |
| Acceso, registro, recuperar, restablecer, confirmar correo, baja de avisos | El marco; los formularios siguen igual | T11 |
| Precios y páginas legales | Cabecera, pie, fondo y títulos | T12 |
| Descargas | Cabecera, pie, fondo y títulos | T13 |
| Búsqueda de proveedores y página de un proveedor | Cabecera, pie, fondo y títulos | T14 |

**No cambian:** el panel, la invitación `/i/…`, la página de evento `/<código>/<dirección>`, el pago `/pago` y
los iconos de las apps. Por eso los tokens nuevos viven dentro de `.site-surface` y no en `:root`.

## Qué se conserva del sitio viejo

El prototipo es una maqueta en español con datos simulados. Estas funciones reales lo sustituyen:

| El prototipo tenía | El sitio conserva |
|---|---|
| Sin selector de idioma | Selector de idioma y los cinco idiomas en todo texto |
| Sin Precios ni Descargas | Enlaces a Precios y Descargas |
| 8 invitaciones SVG inventadas | Los 16 temas reales; `/registro?tema=<id>` |
| Boletín simulado | `POST /api/newsletter/subscribe` y su aviso legal |
| Registro con nombre completo, términos y Apple | El formulario real, con Google Identity y `AuthLegalNotice` |
| Proveedores de ejemplo con fotos | Categorías reales con iconos, que abren `?cat=<código>` |
| Radios en la asistencia | Botones `aria-pressed` y el recuento `role="status"` |
| Cabecera y pie también en acceso | Barra con logo e idioma: el acceso también corre en las apps |
| Rutas `/login` y `/demo` | Rutas `/acceso` y `/registro` |

## Decisiones del usuario

Las tareas ya siguen la opción recomendada. Cambiar una decisión cambia el plan.

| # | Decisión | Opción aplicada | Efecto si cambia |
|---|---|---|---|
| D1 | ¿La página `/demo` del prototipo? | **No.** REQ-05 exige registrarse para ver la demostración | Ver `tareas/opcional-demo.md` |
| D2 | ¿También el panel? | **No.** Solo el sitio público | Es un plan aparte |
| D3 | ¿Logo del corazón? | **Sí, solo en el sitio.** Las apps conservan su icono | T05 |
| D4 | Fotografías | **Las de `docs/ASSETS.md`** hasta tener definitivas | `photos.ts`, un solo archivo |
| D5 | ¿Fondo durazno pese a «blanco puro innegociable»? | **Sí, solo en el sitio.** T16 lo escribe en `DESIGN.md` | T02 y T16 |

**Publicación:** las fotos del prototipo son recortes de maquetas sin licencia y no se usan. Antes de publicar,
el usuario revisa si las actuales le sirven (ver T17).

## Orden

Una tarea tras otra. No empieces una si la anterior no terminó bien.

| Tarea | Qué hace | Puerta |
|---|---|---|
| T01 | Rama de integración y PR en borrador | |
| T02 | Fuentes, tokens y `site.css` | |
| T03 | Botones, acordeón y SVG | |
| T04 | Piezas comunes | |
| T05 | Cabecera y pie | |
| T06 | Titular y tipos de evento | |
| T07 | Galería de diseños y pasos | |
| T08 | Asistencia y proveedores | |
| T09 | Preguntas y boletín | |
| T10 | Se estrena la portada nueva | **Revisión** |
| T11 | Marco del acceso | **Revisión** |
| T12 | Precios y legales | |
| T13 | Descargas | |
| T14 | Proveedores | **Revisión** |
| T15 | Limpieza de CSS | |
| T16 | Documentación | |
| T17 | Verificación final y cierre | **Usuario** |

T04 a T09 añaden componentes que aún nadie muestra: es normal que la web no cambie hasta T10.

**Revisión:** un modelo más capaz, o el usuario, mira las capturas con `design:design-critique` y las compara
con `apps/new-design/artifacts/screenshots/`. Esa carpeta solo existe en la máquina del usuario, sin versionar:
si no la tienes, pídele las capturas.
La jerarquía, el tono y el equilibrio no los comprueba ninguna prueba.

## Reglas para quien implementa

1. **Haz solo lo que dice tu tarea.** No mejores, no refactorices, no cambies textos ni clases.
2. **No edites los archivos que copia `aplicar.mjs`.** Están probados. Tampoco edites `fuentes/`, `parches/` ni
   `traducciones/`.
3. **No traduzcas.** Las traducciones ya están escritas.
4. **Añade archivos a git por su ruta, como dice la tarea.** Nunca `git add .` ni `git add -A`. Nunca entran
   `apps/new-design/`, `Package.resolved`, `.env*` ni `qa-artifacts/`.
5. **Nunca hagas push a `main` ni mezcles el PR.** Eso lo hace el usuario.
6. **Una prueba que falla no se borra, no se salta y no se debilita.**
7. **Si algo no cuadra, para.** No inventes un arreglo. Cuenta qué comando ejecutaste, el error completo y en qué
   tarea estás. Parar a tiempo es el resultado correcto.
8. **Di solo lo que comprobaste.** Si una prueba no se ejecutó, dilo.

### Cuándo parar

- `aplicar.mjs` escribe `PARA:`.
- `verificar.sh` escribe `FALLÓ:` y el error no está en la sección «Si falla» de tu tarea.
- Una prueba falla dos veces seguidas con el mismo error.
- La tarea pide un archivo que no existe, o `git status` muestra cambios que no son tuyos.

### Comandos en Claude Code

`git`, `gh`, `docker`, `npm`, Playwright y el emulador necesitan ejecutarse fuera del sandbox: si fallan con
`Operation not permitted`, repite con `dangerouslyDisableSandbox: true`.

### Formato del commit

Cada tarea trae su mensaje. Termínalo con la línea de atribución que te indique tu sistema.

## Qué hay en esta carpeta

| Ruta | Para qué |
|---|---|
| `tareas/` | Una tarea por archivo |
| `fuentes/` | Archivos finales, con la misma ruta que tendrán en el repositorio |
| `parches/` | Cambios a archivos que ya existen |
| `traducciones/` | Textos nuevos en los cinco idiomas, uno por tarea |
| `herramientas/aplicar.mjs` | Aplica una tarea según `tareas.json` |
| `herramientas/verificar.sh` | Contratos, lint, tipos y unitarias |
| `herramientas/pila-ci.sh` | Levanta la pila de CI y ejecuta la suite |
| `herramientas/capturas.mjs` | Capturas a tres anchos, desbordes e imágenes rotas |
| `herramientas/add-keys.mjs`, `prune-keys.mjs`, `quitar-css.mjs` | Las usa `aplicar.mjs` |

T17 borra esta carpeta salvo este README y el resumen del resultado.

## Cómo se comprobó

El plan se ensayó en una rama desechable, de T02 a T16, con `aplicar.mjs` y `verificar.sh` en cada tarea. Los
resultados y lo que quedó sin ejecutar están en `ENSAYO.md`.

## Si hay que deshacer algo

Cada tarea es un commit. Para quitar una: `git revert <commit>` y `git push origin feat/sitio-nuevo`. Hazlo solo
si te lo pide el usuario o el revisor.
