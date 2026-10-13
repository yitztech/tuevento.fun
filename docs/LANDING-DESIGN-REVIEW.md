disposition: ship

Limitación de entrada: la identidad heredada no dispone de tarjeta QUALITY BAR; el nivel de acabado se juzga contra PRODUCT.md, DESIGN.md y el contrato de superficie, sin referencias de mundos ajenos. La construcción directa autorizada no tiene comp aprobado.

## persistence

**pass.** PRODUCT.md existe y recoge la landing pública en `/`, el panel y la demo en `/app`, registro real e idiomas ES/EN. DESIGN.md conserva el mundo construido: blanco puro, verde botella, rosa peonía, amarillo, Manrope y Bricolage. La documentación específica de la landing corresponde al cierre posterior de esta revisión.

El contrato `packages/app/.impeccable/surfaces/landing-page.md` identifica las cinco promesas y FORM lleva el seed `3cce2558`, corroborado por `docs/landing-concept-roll.txt`: candidata 4, álbum fotográfico con producto interactivo. La preferencia confirmada de construcción directa justifica la ausencia de comp y de fases de reproducción de un comp.

Las siete capturas requeridas existen, muestran el documento desde arriba y tienen contenido, fuentes y fotografías visibles. Dimensiones verificadas: ES escritorio 1512×3838, ES móvil 390×5441, tablet 768×4184, EN escritorio 1512×3813, EN móvil 390×5370; primeros viewports ES 1512×1100 y 390×844. No hay regiones vacías o negras, ni desbordes visibles. Evidencia: `qa-artifacts/landing-desktop.png`, `landing-mobile.png`, `landing-tablet.png`, `landing-en-desktop.png`, `landing-en-mobile.png`, `landing-desktop-viewport.png` y `landing-mobile-viewport.png`.

## fidelity

| Elemento o promesa | Estado | Evidencia |
| --- | --- | --- |
| TYPE | match | Bricolage en titulares amplios y Manrope en lectura y controles. H1 con máximo de 83 px y tracking de −0.035em; pasos claros de escala y peso, sin recortes de texto en las traducciones capturadas. |
| TYPE de la invitación floral | adaptation | La serif cursiva pertenece a la plantilla Bodas Florales reutilizada. Conserva los seis temas existentes, conforme a la continuidad de identidad del contrato; la excepción estrecha de Georgia fue comunicada por el constructor. No cambia la voz tipográfica de la landing. |
| MATERIAL | match | Brindis, boda, globos y mesa de celebración son fotografías visibles, con peso real y recortes legibles. No hay material físico simulado ni un fondo que sustituya las fotos. |
| GROUND | match | Muestreo de píxeles en las cinco capturas completas: fondo RGB 255/255/255 (`#ffffff`) y bloque de apoyo RGB 232/242/237 (`#e8f2ed`). Los bloques menta y rosa tienen límites y función, compatibles con The White Ground Rule de DESIGN.md. |
| THESIS | match | El primer contacto expresa el deseo de estar juntos y lo sostiene con fotografía; después aparecen el proceso, la invitación y la respuesta familiar. |
| OWN-WORLD | match | Blanco, verde botella, rosa y amarillo conservan la identidad. Iconos Lucide, controles nativos y fotografía real. |
| STORY | match | El recorrido presenta celebración, preparación, elección del tema, asistencia por persona y conversión. La vista de invitación y la familia están etiquetadas como muestras; la demo tiene acciones secundarias reconocibles. |
| FIRST VIEWPORT | match | Escritorio coloca titular y registro a la izquierda y collage a la derecha. El registro verde domina sobre la demo. La frase recordable y las tres ocasiones fotografiadas sobreviven al test de memoria. |
| FIRST VIEWPORT móvil | adaptation | La composición se apila para el contexto móvil de PRODUCT.md: titular, CTA de registro, demo, nota y collage. El CTA completo queda dentro del primer viewport de 390×844, con 52 px de altura declarada; la fotografía comienza dentro del mismo viewport. |
| FORM | match | Álbum fotográfico con producto interactivo; la invitación y el RSVP tienen contenido concreto en lugar de tarjetas de relleno. El seed y la candidata coinciden con el roll guardado. |
| ES/EN | adaptation | Los cambios de longitud del inglés generan tres líneas en el H1 y reflujo de títulos. La traducción completa está autorizada en PRODUCT.md; mantiene acciones, orden y fotografía. |

El contraste calculado sobre los colores CSS declarados alcanza 9.81:1 en el CTA blanco sobre verde, 6.37:1 en el apoyo del hero, 6.24:1 en el texto sobre menta y 6.20:1 en el cierre sobre rosa. Estados RSVP: aceptado 7.10:1, pendiente 5.85:1, rechazado 6.61:1 y neutral 6.01:1. Los números de proceso de 28 px alcanzan 3.94:1 y superan el mínimo para texto grande.

La revisión del craft floor no muestra un hallazgo material: no hay kickers de marketing, sombras duras, texto con degradado, glifos usados como sistema de iconos ni tarjetas anidadas. La dedicatoria dentro de la invitación es contenido del producto, no una etiqueta ornamental encima de una sección. Los números explican una secuencia de preparación, envío y respuesta.

La procedencia de las seis fotografías reutilizadas figura en `docs/ASSETS.md`; el constructor aporta `SCAN 6 rasters, 0 missing` y metadatos de origen embebidos. No se produjeron imágenes nuevas. Las fotografías se presentan como decoración y demostración; las muestras no se atribuyen a clientes reales. No se observan precios, testimonios ni cifras comerciales inventadas.

Esta revisión inspecciona las capturas facilitadas y los archivos primarios. El flujo de registro, el menú abierto, el foco por teclado y la interacción con movimiento normal requieren la validación funcional del constructor; las capturas se tomaron con movimiento reducido.

## ceiling

El contrato alcanza un acabado suficiente para entrega visual: fotografía protagonista, escala tipográfica reconocible, separación editorial entre secciones y producto concreto que se puede explorar. No se identifican dispositivos expresivos exigidos por la identidad que hayan quedado ausentes. La falta de QUALITY BAR impide certificar equivalencia con una tarjeta externa; no se introduce ornamentación o movimiento de otro mundo para llenar ese vacío.

## material_fixes

Ninguno en esta revisión visual.

## keep

Conservar el blanco puro, el collage fotográfico con peso real, la frase del primer viewport, la prioridad del registro verde, la demo secundaria y las muestras claramente identificadas en ES/EN.
