# Landing de captación

La ruta `/` presenta TuEventoFun en español e inglés. El panel sigue en `/app`, la autenticación en `/registro` y `/acceso`, y los enlaces de invitados en `/i/:token`.

## Conversión

- «Crear mi primer evento», «Crear un evento» y «Empezar mi celebración» abren `/registro?empezar=evento`. Tras registrarse o acceder, el usuario llega al editor de su primer evento.
- «Crear con este diseño» abre `/registro?tema=<tema>`. El tema se valida contra los seis IDs admitidos y se mantiene al abrir el editor. Cambiar entre registro y acceso conserva esta selección.
- La demostración abre `/app`. Una visita a la landing no crea cuenta, sesión de demo ni evento. Al abrir el panel sin sesión, se conserva el comportamiento de demostración aislada ya implementado.
- La muestra de asistencia familiar es local e ilustrativa; cambiar sus respuestas no escribe en PostgreSQL.

Los textos describen capacidades implementadas. No hay testimonios, tarifas ni estadísticas comerciales inventadas. La captura se realiza mediante el registro existente, que guarda los datos de contacto de la cuenta en PostgreSQL.

## Imagen y presentación

Se reutilizan fotografías locales verificadas: brindis entre amigos, boda, globos de cumpleaños y mesa festiva. Su procedencia está en [ASSETS.md](ASSETS.md). Fondo blanco, azul tinta, rosa y amarillo siguen la identidad de [DESIGN.md](../DESIGN.md). La interfaz respeta movimiento reducido y foco de teclado; los formularios y componentes siguen siendo reutilizables en desktop.

## Contrato y alcance visual

El [contrato de superficie](../packages/app/.impeccable/surfaces/landing-page.md) fija el álbum fotográfico con producto interactivo: primero el deseo de reunir a las personas, después la invitación y la asistencia por integrante. La implementación corresponde a `packages/app/src/landing.tsx` y `landing.css`; `apps/web/src/main.tsx` monta la landing en `/`.

Esta página extiende la «Revista contemporánea de celebraciones» existente. Los tokens de identidad siguen en [DESIGN.md](../DESIGN.md) y sus extensiones en [.impeccable/design.json](../.impeccable/design.json). Las medidas y reglas siguientes describen exclusivamente la landing; no sustituyen la escala del panel ni añaden una identidad nueva. La [revisión independiente](LANDING-DESIGN-REVIEW.md) tiene disposición `ship` y registra la evidencia visual ES/EN.

## Composición de la landing

**Regla del álbum.** El primer bloque combina titular y acciones con tres fotografías: el brindis ocupa las dos filas del collage y boda/globos forman la columna lateral. En escritorio, texto y álbum usan una cuadrícula de `1fr 1.06fr`, con separación de 44 px. El collage mide 548 px de alto, tiene esquinas de 15 px y desplaza las dos imágenes laterales 24 px hacia arriba. Los recortes conservan a las personas y los objetos protagonistas mediante `object-fit: cover` y posiciones específicas.

El recorrido continúa con tres pasos, selector de seis diseños y vista de invitación, ejemplo de asistencia familiar, preguntas frecuentes y cierre con fotografía. El contenedor alcanza 1280 px y deja 48 px por lado en la base de escritorio. Separadores finos, márgenes amplios y el cambio de blanco a hielo distinguen capítulos; cada capítulo aporta información o una interacción concreta.

**Regla de conversión visible.** El registro mantiene el botón azul principal y la demo un enlace secundario. Los botones protagonistas tienen una altura mínima de 54 px y padding de 17 × 22 px en escritorio; en móvil, 52 px y 15 × 18 px. El botón de cabecera conserva 44 px. Se repite la acción de registro al abrir, al elegir un diseño y al cerrar el recorrido; el CTA del diseño incorpora el tema elegido.

**Regla de prueba explícita.** La invitación se presenta como vista ilustrativa y la familia como muestra interactiva. El selector conserva nombre, miniatura, borde de selección y `aria-pressed`; el RSVP conserva tres respuestas por persona, texto, icono y color. El conteo usa `role="status"`. Las preguntas frecuentes son elementos nativos `details`/`summary`.

### Paleta, tipografía y profundidad

La landing aplica **The White Ground Rule**: blanco como superficie principal, hielo para explorar diseños y un bloque rosa delimitado en el cierre. Azul tinta conduce titulares y acciones. Rosa y amarillo acompañan la celebración; los tonos contextuales de asistencia indican respuesta y nunca sustituyen sus etiquetas. El rosa de cierre y los tonos de apoyo están definidos en `landing.css` para esta composición, sin promoverse a nuevos tokens globales.

La distribución de fuentes conserva **The Task and Celebration Rule**: Bricolage Grotesque Variable en titulares y números del proceso; Manrope Variable en lectura y controles, servidas desde las fuentes locales del stylesheet compartido. La escala específica de esta superficie es:

| Uso | Valor base observado |
| --- | --- |
| Titular principal | `clamp(54px, 5.6vw, 83px)`, peso 650, interlínea 1.04, tracking −0.035em, ancho máximo 8.8ch |
| Título de sección | `clamp(32px, 3.25vw, 47px)`, peso 600, interlínea 1.12, tracking −0.03em |
| Título de paso | 21 px, interlínea 1.25, tracking −0.02em |
| Número del proceso | 28 px, interlínea 1 |
| Texto de apertura | 17 px, interlínea 1.8, ancho máximo 37ch |
| Texto de explicación | 14–16 px según sección; párrafos con interlínea 1.7–1.8 |
| CTA principal | 14 px y peso 700 heredado; 13 px en móvil |

La invitación reutiliza `InvitationArt` y las seis plantillas existentes. Los tratamientos serif de las plantillas floral y dorada pertenecen a la invitación; no cambian la tipografía de navegación o de los capítulos de la landing. Los títulos permiten balance y reflujo de líneas en ES/EN.

Los controles conservan esquinas de 9 px y la muestra RSVP, 14 px. Las sombras difusas se limitan al mensaje superpuesto al álbum (`0 12px 32px #1820341a`) y a la invitación (`0 18px 42px #17274c1c`); pasos y preguntas se separan mediante líneas. El foco compartido de 3 px y la preferencia de movimiento reducido siguen aplicándose a enlaces, botones y resúmenes.

### Adaptación responsive

| Condición | Composición observada |
| --- | --- |
| Desde 1600 px | Álbum de 600 px y mayor aire vertical en la apertura. |
| Hasta 1150 px | Márgenes de 32 px; se oculta el CTA de cabecera; el registro sigue visible en la apertura. |
| Hasta 850 px | Menú desplegable con control de 44 × 44 px; sección familiar en una columna. Apertura y diseños mantienen dos columnas; el selector de temas pasa a una columna. |
| Hasta 620 px | Márgenes de 20 px; apertura, diseños, FAQ y cierre se apilan. H1 `clamp(49px, 11vw, 66px)`, H2 de 35 px; selector de temas en dos columnas y respuestas RSVP con icono sobre texto. El mensaje fotográfico queda dentro del álbum. |
| Hasta 370 px | Selector de temas en una columna, H1 de 49 px y álbum de 310 px. |

Estos breakpoints pertenecen a la landing. La traducción cambia la longitud de los títulos sin alterar el orden de lectura, las acciones o las muestras; el selector de idioma permanece accesible en la cabecera y el acceso también está disponible en el pie.

### Deriva observada sin canonizar

La documentación global ya refleja la paleta azul, el hover destructivo propio y las acciones móviles con altura mínima de 44 px. La landing mantiene un texto de apoyo de 10 px en el mensaje fotográfico a 621–850 px; se registra como deuda local, sin convertirlo en una escala recomendada para futuras superficies.

## Pruebas

```bash
npm run build
npm run typecheck
npm run test:landing
npm run test:browser
```

`test:landing` cubre la página pública sin API, ambos idiomas, las vistas de escritorio/móvil/tablet, menú, preguntas frecuentes, respuestas de ejemplo, registro con tema seleccionado, acceso existente y demo. Guarda resultados y capturas en `qa-artifacts/` y limpia la cuenta que crea contra el stack local. `QA_SKIP_LANDING_CAPTURES=1` permite repetir solo el recorrido funcional.

La prueba general `test:browser` ahora entra por `/app` y conserva el recorrido de gestión de eventos e invitados.
