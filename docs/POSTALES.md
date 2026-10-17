# Diez postales hermanas

Se añadieron diez fotografías y diseños al catálogo existente: ahora hay 16 postales disponibles en `/disenos`, el selector de la portada y el editor de eventos. Las nuevas variantes conservan la composición y la tipografía de sus familias.

| Familia original | Variantes nuevas | Archivos en `apps/web/public/images/` |
| --- | --- | --- |
| Tropical | Invernal, Primaveral, Otoñal | `winter.webp`, `spring.webp`, `autumn.webp` |
| Elegante Dorado | Elegante Plata, Cobre y Velas | `silver.webp`, `copper.webp` |
| Fiesta Neón | Fiesta Disco, Noche Estrellada | `disco.webp`, `starlight.webp` |
| Minimalista | Minimalista Arena | `sand.webp` |
| Bodas Florales | Flores Silvestres | `wildflower.webp` |
| Infantil | Infantil Pastel | `pastel.webp` |

Cada imagen tiene una versión de 1280 píxeles de ancho y una hermana de 640 píxeles con el sufijo `-640.webp`. Los 20 archivos suman 2,252,588 bytes. El navegador elige mediante `srcset`; las fotos fuera de pantalla tienen carga diferida. Los textos se renderizan en HTML y están traducidos a español, inglés, portugués, alemán y francés.

Generación: herramienta integrada `image_gen`, una fotografía por diseño, usando los JPG existentes como referencias de estilo. Los prompts completos, las referencias y las rutas de los archivos finales están en [assets/invitation-images.json](assets/invitation-images.json). Las imágenes generadas se optimizaron a WebP con `cwebp -q 84`, sin sustituir los seis originales.

La migración `apps/api/migrations/010_invitation_themes.sql` amplía la restricción de temas de los eventos. Se aplica automáticamente al arrancar la API. Fue aplicada al entorno Docker local; el cambio queda preparado para futuros despliegues mediante el proceso habitual del proyecto.

## Validación local del 16 de octubre de 2026

Se revisaron las fotos y las postales renderizadas. Las pruebas de navegador cubren catálogo, imágenes cargadas, títulos dentro de la postal, vista previa, editor, selector de portada e invitación pública. Se ampliaron a 44 × 44 píxeles las acciones de selección de postal y cierre de vista previa. Los contrastes de los títulos nuevos van de 6.18:1 a 11.11:1.

| Comprobación | Resultado |
| --- | --- |
| `npm run build` | Correcto; aviso de tamaño del bundle principal |
| `npm run typecheck` | Correcto |
| `npm run test:unit` | 43 correctas |
| `npm run test:db` | 12 correctas; acepta todos los temas del contrato |
| `npm run test:endpoints` | 8 correctas; todos los temas se guardan, editan y llegan a la invitación pública |
| `npm run e2e -- --workers=4` | 57 escenarios correctos, incluidos 7 del catálogo nuevo |
| Playwright: Chromium y WebKit | 36 comprobaciones correctas, 0 errores de página |

El catálogo y su vista previa se comprobaron en ambos motores a 320 × 568, 390 × 844, 844 × 390, 768 × 1024, 1024 × 768, 1180 × 820 y 1440 × 900. El editor se comprobó a 390, 768 y 1024 píxeles; la portada y el RSVP a 390 y 768. El catálogo traducido se comprobó en los cinco idiomas a 390 y 768 píxeles. No se detectó desbordamiento horizontal.

Estas son pruebas de navegadores con pantalla y entrada táctil emuladas. No acreditan pruebas en teléfonos o tabletas físicos, ni una publicación remota.

Evidencias:

- `qa-artifacts/new-invitation-images-contact-sheet.png`: las diez fotografías.
- `qa-artifacts/postales/catalog-mobile.png`: catálogo en móvil.
- `qa-artifacts/postales/catalog-tablet-portrait.png`: catálogo en tableta.
- `qa-artifacts/postales/catalog-desktop.png`: catálogo en escritorio.
- `qa-artifacts/postales/mobile-*.png` y `tablet-portrait-*.png`: las diez postales en ambos tamaños.
- `qa-artifacts/postales/webkit-preview-mobile.png`: vista previa en WebKit.
- `qa-artifacts/postales/webkit-rsvp-mobile.png` y `webkit-rsvp-tablet-portrait.png`: invitación pública.
- `qa-artifacts/postales/responsive-report.json`: tamaños, imágenes elegidas, colores y áreas táctiles medidas.
- `tests/e2e/results/results.json`: resultados de los 57 escenarios.

El script de la inspección de navegador está en `/tmp/playwright-test-tuevento-postales.js`. Se ejecutó con `node /Users/user/.agents/skills/playwright-skill/run.js /tmp/playwright-test-tuevento-postales.js`. Los escenarios permanentes están en `tests/e2e/features/disenos.feature` y `tests/e2e/steps/disenos.js`.
