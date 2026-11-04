# Plan: sitio público nuevo, Stripe y cupones

Este plan lo ejecutan modelos económicos: casi todo el trabajo ya está hecho y probado aquí, y cada tarea es
aplicarlo, comprobarlo y hacer commit. Tiene dos partes independientes, cada una con su rama y su PR:

| Parte | Qué hace | Tareas | Rama |
|---|---|---|---|
| A | El diseño de `feat/new-design` (prototipo `apps/new-design`) pasa al sitio real sin perder ninguna función | T01–T17 | `feat/sitio-nuevo` |
| B | La integración con Stripe queda lista para la cuenta real y se añaden cupones de descuento | P01–P08 | `feat/pagos-cupones` |

Se pueden hacer en cualquier orden, pero una después de otra: las dos usan la pila de CI y los mismos puertos.

**Si eres el modelo que implementa:** lee «Reglas para quien implementa» y después solo el archivo de tu tarea.

## Estado

El código de las dos partes ya está aplicado: el usuario prefirió conservar lo probado en vez de repetirlo. **No
ejecutes T01–T16 ni P01–P07.**

| Parte | PR | Lo que queda |
|---|---|---|
| A | [#59](https://github.com/yitztech/tuevento.fun/pull/59), en borrador | T17 y la revisión de diseño |
| B | [#60](https://github.com/yitztech/tuevento.fun/pull/60), en borrador | P08 y la revisión de `payments.ts` |

Las tareas siguen aquí como registro de lo que se hizo y por si hay que rehacer una. T17 y P08 quitan su material,
pero en estas ramas nunca entró: omite ese paso.

# Parte A: el sitio público

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

# Parte B: Stripe y cupones

## Qué se añade

La integración con Stripe ya existe, pero solo se ha probado contra un doble que no exigía nada. Cobrar de verdad
necesita la cuenta del usuario y cerrar estos huecos:

| Hueco | Qué pasaba | Qué se hace | Tarea |
|---|---|---|---|
| Idioma | Se enviaba `pt` y `es` sin variante | `pt-BR` y `es-419`; el doble rechaza un idioma que Stripe no acepta | P02 |
| Caducidad | Una sesión duraba 24 horas | 31 minutos: Stripe exige entre 30 minutos y 24 horas | P02 |
| Versión | Dependía de la cuenta | Se fija `Stripe-Version: 2026-10-28.endive` | P02 |
| Intentos sin cobrar | Quedaban `pending` para siempre | Los eventos `expired` y `async_payment_failed` los pasan a `canceled` | P02 |
| Probar en local | `compose.yml` no pasaba las claves | Las pasa, y `docs/PAGOS-PENDIENTES.md` explica `stripe listen` | P02, P07 |

Y estos cupones:

| Parte | Qué hace | Tarea |
|---|---|---|
| Base de datos | `coupons`, `coupon_redemptions` y `admin_audit_log` | P03 |
| Panel | Pestaña «Cupones»: crear, listar, desactivar | P04 |
| API | `POST /api/coupons/check` y `coupon` en el pago | P05 |
| Página de pago | Campo de cupón y precios con descuento | P06 |

El panel entra con el rol `admin_ro`, que no escribe tablas. Sigue sin hacerlo: solo puede ejecutar dos funciones
`SECURITY DEFINER`, que dejan registro. Es el mecanismo que la fase 9 de `docs/PLAN-PROVEEDORES-Y-OFFLINE.md` ya
preveía para la moderación.

## Decisiones del usuario

Las tareas ya siguen la opción recomendada. Cambiar una decisión cambia el plan.

| # | Decisión | Opción aplicada | Efecto si cambia |
|---|---|---|---|
| D6 | ¿Cupones propios o de Stripe? | **Propios.** Se ve el precio antes de pagar y se gestionan en el panel. Con los de Stripe el webhook no podría comprobar el importe | Rehacer P03–P06 |
| D7 | ¿Reglas de un cupón? | **Un uso por cuenta**, porcentaje o cantidad, caducidad y máximo de usos opcionales, también sobre la diferencia al subir de tramo | P03 y P05 |
| D8 | ¿Cobro mínimo y cupón del 100 %? | **Mínimo $1.00**, válido sea cual sea la moneda de liquidación de la cuenta. Al 100 % no se pasa por Stripe | `MIN_CHARGE_CENTS` |
| D9 | ¿Moneda? | **USD**, como la página de precios | Precios, `event_payments` y el doble |
| D10 | ¿Reembolsos y disputas? | **A mano en Stripe**; el evento sigue pagado | Tarea nueva con `charge.refunded` |

**Fuera de este plan, antes de cobrar:** impuestos y facturas (la API no calcula IVA ni emite facturas) y, antes de
publicar iOS, si Apple acepta pagar un servicio digital en el navegador. Los dos están en `docs/PAGOS-PENDIENTES.md`.

## Orden

Una tarea tras otra, en la rama `feat/pagos-cupones`. No hace falta la cuenta de Stripe hasta el final.

| Tarea | Qué hace | Puerta |
|---|---|---|
| P01 | Rama y PR en borrador | |
| P02 | Stripe real: idioma, caducidad, versión, pagos cancelados | |
| P03 | Modelo de cupones | |
| P04 | Cupones en el panel | |
| P05 | Cupones en la API | **Revisión** |
| P06 | Cupón en la página de pago | |
| P07 | Documentación | |
| P08 | Verificación final y cierre | **Usuario** |
| — | Conectar la cuenta de Stripe, después de mezclar | **Solo el usuario** |

**Revisión:** es dinero, así que un modelo más capaz, o el usuario, revisa `apps/api/src/payments.ts` con
`/code-review`.

**Conectar la cuenta:** ningún modelo la hace. Crear la cuenta, las claves y el webhook, y el pago real de prueba,
están en «Pendiente, con la cuenta de Stripe» de `docs/PAGOS-PENDIENTES.md`. Las claves nunca se pegan en un chat.

# Para las dos partes

## Reglas para quien implementa

1. **Haz solo lo que dice tu tarea.** No mejores, no refactorices, no cambies textos ni clases.
2. **No edites los archivos que copia `aplicar.mjs`.** Están probados. Tampoco edites `fuentes/`, `parches/` ni
   `traducciones/`.
3. **No traduzcas.** Las traducciones ya están escritas.
4. **Añade archivos a git por su ruta, como dice la tarea.** Nunca `git add .` ni `git add -A`. Nunca entran
   `apps/new-design/`, `Package.resolved`, `.env`, `.env.ci` ni `qa-artifacts/`. `.env.example` solo entra si la
   tarea lo nombra.
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
| `herramientas/verificar.sh` | Contratos, cliente, lint, tipos y unitarias |
| `herramientas/pila-ci.sh` | Levanta la pila de CI y ejecuta los escenarios o las pruebas de API |
| `herramientas/capturas.mjs` | Capturas a tres anchos, desbordes e imágenes rotas |
| `herramientas/add-keys.mjs`, `prune-keys.mjs`, `quitar-css.mjs` | Las usa `aplicar.mjs` |

T17 y P08 borran esta carpeta en su rama, salvo este README y `ENSAYO.md`. Cada rama tiene su copia: borrarla en una
no afecta a la otra.

## Cómo se comprobó

Cada parte se ensayó en una rama desechable, tarea a tarea, con `aplicar.mjs` y `verificar.sh`. Los resultados y lo
que quedó sin ejecutar están en `ENSAYO.md`.

## Si hay que deshacer algo

Cada tarea es un commit. Para quitar una: `git revert <commit>` y `git push origin <rama de la parte>`. Hazlo solo
si te lo pide el usuario o el revisor. Una migración ya aplicada no se revierte: si la tarea trae una, para y avisa.
