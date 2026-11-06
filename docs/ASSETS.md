# Fotografías y tipografías

Fotografías de Unsplash servidas localmente, usadas como decoración y material de demostración. No representan eventos reales del usuario.

| Archivo      | Origen                                                       |
| ------------ | ------------------------------------------------------------ |
| gold.jpg     | https://images.unsplash.com/photo-1511795409834-ef04bbd61622 |
| floral.jpg   | https://images.unsplash.com/photo-1519741497674-611481863552 |
| kids.jpg     | https://images.unsplash.com/photo-1530103862676-de8c9debad1d |
| minimal.jpg  | https://images.unsplash.com/photo-1519671482749-fd09be7ccebf |
| neon.jpg     | https://images.unsplash.com/photo-1514525253161-7a46d19cd819 |
| tropical.jpg | https://images.unsplash.com/photo-1576013551627-0cc20b96c2a7 |

Tipografías autohospedadas mediante Fontsource: Manrope, Bricolage Grotesque, Playfair Display y Great Vibes. Los paquetes incluyen sus licencias OFL. Iconos: Lucide (licencia ISC). El logo combina texto y el icono PartyPopper; no es una marca registrada proporcionada por el usuario.

## Iconos nativos

Los iconos y splash de `apps/web/android/app/src/main/res` y `apps/web/ios/App/App/Assets.xcassets` son renders del SVG original `apps/web/public/favicon.svg`, con la nueva paleta azul tinta. Se generan con `scripts/native-assets.mjs`; la procedencia está embebida en los PNG. Las fotografías conservan su contenido natural; el cambio verde→azul afecta la identidad, controles, fondos, estados y temas de interfaz.

## Sitio público

Los SVG de `apps/web/public/site/` (logo, adornos y fondo de la banda final) son propios. Las fotografías ilustrativas del sitio se eligen en `packages/app/src/ui/site/photos.ts` y se sirven desde `apps/web/public/site/photos/`. Se generaron con la herramienta integrada de imágenes de OpenAI para el prototipo; no representan proveedores ni eventos reales. Los originales y el inventario del prototipo (`apps/new-design`, retirado) siguen en el historial de git, antes del commit que lo eliminó. Las imágenes de la tabla anterior siguen siendo utilizadas por los temas de invitación existentes.

### Inspiración de cumpleaños

Cinco fotografías ilustrativas generadas con la herramienta integrada de imágenes de OpenAI, sin referencia a eventos reales. Cada una se distribuye en WebP de 480 y 960 píxeles de ancho en `apps/web/public/site/photos/events/`, con los siguientes prefijos y conceptos de generación:

| Prefijo | Prompt: fotografía editorial natural, vertical, sin texto ni marcas |
| --- | --- |
| `cumple-infantil-jardin` | Fiesta infantil al aire libre, globos, pastel y niños jugando en un jardín con luz de día. |
| `cumple-infantil-mesa` | Mesa de cumpleaños infantil en interior, arco de globos pastel y pastel junto a una ventana. |
| `cumple-amigos-jardin` | Amigos adultos celebrando con un pastel y velas en un jardín al atardecer. |
| `cumple-amigos-picnic` | Amigos adultos celebrando con pastel durante un picnic de tarde. |
| `cumple-amigos-cena` | Cena íntima de cumpleaños entre amigos, pastel con velas y luz cálida de noche. |

Se muestran como inspiración en el filtro de cumpleaños; las imágenes no agregan plantillas de invitación ni representan celebraciones documentadas.

### Inspiración para cada ocasión

Con el mismo proceso integrado de generación de imágenes y las versiones WebP de 480 y 960 píxeles, se añadieron fotografías editoriales verticales sin texto ni marcas, con estos conceptos:

| Prefijo | Concepto del prompt |
| --- | --- |
| `infantil-jardin` | Fiesta infantil en jardín con globos y pastel. |
| `infantil-pastel` | Cumpleaños infantil con globos y mesa en tonos pastel. |
| `infantil-picnic` | Picnic de cumpleaños infantil con guirnaldas y pastel. |
| `infantil-arte` | Fiesta infantil de arte con pintura y pastel. |
| `infantil-safari` | Cumpleaños infantil con decoración de safari. |
| `infantil-arcoiris` | Cumpleaños infantil con decoración de arcoíris. |
| `bodas-jardin` | Boda íntima en un jardín con flores. |
| `minimalista-mesa` | Celebración minimalista con pastel, velas y tonos neutros. |
| `minimalista-lino` | Mesa de cumpleaños íntima con lino, pastel blanco y velas. |
| `minimalista-terraza` | Celebración en una terraza, con pastel sencillo y vegetación discreta. |
| `minimalista-brindis` | Amigos brindando en una cena de tonos neutros y luz de velas. |
| `minimalista-pastel` | Pastel de cumpleaños sencillo con velas y una rama decorativa. |
| `minimalista-jardin` | Celebración íntima de jardín con flores discretas y pastel. |
| `floral-fiesta` | Celebración entre flores en un jardín. |
| `elegante-cena` | Cena elegante con flores y velas. |
| `celebracion-amigos` | Amigos celebrando bajo guirnaldas de luces. |

Son imágenes de inspiración, no plantillas de invitación adicionales ni eventos reales.

## Marca v2: logo y favicon

Los recursos están en `apps/web/public/images/brand-v2/` y su procedencia, manifiesto y maestros en `docs/assets/brand-v2/`.

- **Logo completo por idioma:** `logo-{es,en,pt,de,fr}-{240,480,720,1080}.webp` (3:1). Lo pinta `BrandLogo` (`packages/app/src/ui/site/brand-logo.tsx`) con `srcset`, según el idioma activo, en la cabecera y el pie del sitio, en las páginas públicas y en el panel (`Logo` de `components.tsx`). Es decorativo: el enlace lleva su texto accesible (`common.tueventofunHome`).
- **Símbolo:** `icon-{96,192}.webp` con `BrandMark`, para espacios compactos.
- **Favicon y Apple touch:** `favicon.ico`, `favicon-16.png`, `favicon-32.png` y `apple-touch-icon.png`, declarados en `apps/web/index.html`.
- **Sin cambiar todavía:** los iconos y splash nativos (`scripts/native-assets.mjs` sigue leyendo `apps/web/public/favicon.svg`). `app-icon-512.png` y `app-icon-1024.png` quedan preparados para ellos.
