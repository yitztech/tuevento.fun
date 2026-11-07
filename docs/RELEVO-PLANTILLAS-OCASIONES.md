# Plantillas de ocasiones y editor propio

Rama: `feat/plantillas-ocasiones`, basada en `origin/main`. Se añadieron al catálogo compartido 21 fotografías que antes aparecían en la portada como inspiración. Se conservan los 16 identificadores originales y se usan identificadores nuevos para cada fotografía. El selector de eventos, el catálogo de diseños, la portada y el editor de postales consumen la misma tabla de contratos. Las fotografías se sirven en WebP de 480 y 960 píxeles.

El editor propio seguía disponible en el detalle de cada evento mediante «Diseñar postal», pero no tenía acceso en «Diseños de invitación». Se añadió un acceso desde esa página: permite elegir un evento activo o crear uno si todavía no existe. El editor guarda el diseño por evento.

Las migraciones `044_occasion_themes.sql` y `045_occasion_themes_validate.sql` amplían y validan la restricción de temas sin cambiar los identificadores anteriores. Los clientes móviles instalados necesitan una versión actualizada que incluya el nuevo catálogo y las imágenes; un cliente anterior puede no reconocer los nuevos identificadores.

**No se ejecutaron pruebas por instrucción del usuario.** Antes de integrar o desplegar, hace falta ejecutar y revisar las comprobaciones de contratos y localización, migraciones con datos existentes, selector y persistencia de todas las plantillas, vista pública y editor, compatibilidad con web/Capacitor, accesibilidad y tamaños de pantalla. También deben verificarse versiones móviles y dispositivos físicos. No se ha comprobado el comportamiento en ejecución ni aplicado las migraciones.

Puntos de entrada: `packages/contracts/src/index.ts`, `packages/app/src/ui/site/home-designs.tsx`, `packages/app/src/dashboard.tsx`, `packages/app/src/postcard-editor.tsx`, `packages/app/src/theme-images.ts` y `apps/api/migrations/044_occasion_themes.sql`. Las imágenes nuevas están en `apps/web/public/images/occasion-*.webp` y deben incluirse en el commit junto al código.
