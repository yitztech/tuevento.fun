---
version: 1
slug: landing-page
primary_target: packages/app/src/landing.tsx
related_targets: [packages/app/src/landing.css, apps/web/src/main.tsx]
---
# Captación de organizadores

Mode: Persuade.

Objetivo confirmado por el usuario: una landing con llamadas a la acción e imágenes que enamoren. La conversión es el registro real de un organizador; alternativa útil, una demo aislada. La identidad existente permanece y la preferencia anterior de construir directamente sigue vigente. No se han aportado precios, testimonios ni cifras comerciales.

Estructuras consideradas: catálogo de celebraciones, recorrido de un anfitrión, invitación a pantalla completa, álbum fotográfico con producto interactivo, proceso de tres pasos, prueba RSVP en directo, historia de una familia. El roll de superficie 3cce2558 da como lead la estructura 4; se construye directamente el álbum conforme a la preferencia del usuario. Alternativas 5 y 3 no reemplazan la identidad ni frenan la implementación con otra ronda de aprobación.

## Direction contract

THESIS: Primero el deseo de reunir a tus personas, después la herramienta que hace posible organizarlo: un álbum de celebraciones se abre en una invitación que puedes probar.
OWN-WORLD: Blanco puro, azul tinta, rosa peonía, amarillo y fotografías reales. Manrope para lectura, Bricolage para titulares amplios. Controles nativos y foco visible heredados.
STORY: El visitante reconoce su celebración, entiende que cada familiar puede responder y crea una cuenta o prueba la demo. El tema que elija se conserva hasta el editor después del registro.
FIRST VIEWPORT: Cabecera blanca con marca, navegación, idioma y registro; titular grande a la izquierda y un collage de brindis, boda y globos a la derecha. CTA de registro azul y demo secundaria. Imágenes con peso real, sin claims comerciales inventados.
FORM: Álbum fotográfico con producto interactivo, candidata 4 de superficie; seed 3cce2558 (salida guardada en docs/landing-concept-roll.txt). Identidad heredada de DESIGN.md. Construcción directa, sin comp aprobado.
FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance

Interacciones: selector de seis temas actualiza la invitación; un ejemplo de RSVP familiar permite cambiar respuestas localmente y muestra el conteo. Ambas muestras están identificadas. La landing no crea cuentas demo al visitarla.

## Cierre

Revisión visual independiente: `ship` en docs/LANDING-DESIGN-REVIEW.md. Ocho controles de captación y dieciséis de regresión del panel aprobados; ES/EN sin errores JavaScript ni desbordes. Documentación de la extensión en docs/LANDING.md; DESIGN.md y sidecar preservados. Seis fotografías existentes con procedencia verificada.
