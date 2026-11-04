# Portada

La ruta `/` presenta TuEventoFun en cada idioma de la tabla: el idioma lo da el dominio o el prefijo ([I18N](I18N.md)). Es solo web; las apps no la muestran. Sus piezas están en `packages/app/src/ui/site/` y `landing.tsx` solo las ordena. El estilo está en «Sitio público» de [DESIGN.md](../DESIGN.md).

## Conversión

- «Crear mi primer evento» y «Crear un evento» abren `/registro?empezar=evento`. Tras registrarse o acceder, la persona llega al formulario de evento.
- «Crear con este diseño» abre `/registro?tema=<tema>`, con el diseño elegido en la galería. Son los temas reales de `themes`, en `packages/contracts`.
- «Ver la demostración» abre `/registro`: la demostración exige una cuenta (`tests/e2e/features/demo.feature`, REQ-05).
- Las categorías de proveedores abren la búsqueda con `?cat=<código>`. «Crear mi cuenta de proveedor» abre `/registro?tipo=proveedor`.
- La muestra de asistencia familiar es local e ilustrativa; cambiar sus respuestas no escribe en la base de datos.
- El boletín usa `POST /api/newsletter/subscribe`, con su aviso legal.

Los textos describen capacidades implementadas. No hay testimonios, tarifas ni estadísticas comerciales inventadas.

## Secciones

Titular con composición de teléfono y diseños, tipos de evento, galería de diseños con filtros, tres pasos, asistencia familiar, proveedores, promesa y preguntas frecuentes, y banda final con el boletín.

Los filtros de la galería se definen en `themeTags` (`home-designs.tsx`): un tema nuevo necesita su lista de estilos, y TypeScript avisa si falta.
