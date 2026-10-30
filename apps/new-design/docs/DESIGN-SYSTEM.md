# Sistema de diseño del prototipo

El prototipo vive aislado en `apps/new-design` (workspace `@tuevento/new-design`). No toca `apps/web`,
`packages/app` ni la API. Su paleta sigue las referencias nuevas y **no** el `DESIGN.md` de la web
actual (fondo blanco, sin azul ni verde); si se adopta, habrá que reconciliar los dos.

## Decisiones acordadas

- **Solo español.** Excepción solo para este prototipo (como el panel admin). Todo el texto está en `src/lib/copy.ts`; ningún componente lleva texto fijo, así que pasarlo a un catálogo por idioma es mecánico.
- **Fotografías**: se pidió Unsplash/Pexels, pero no fue posible consultarlos; se usan recortes de las referencias (provisional).
- **Componentes estilo shadcn/ui escritos a mano** (`src/components/ui`: button, input, label, checkbox, accordion, textarea) sobre `radix-ui` y `class-variance-authority`, con el mismo patrón que `packages/app/src/ui`. No se usó la CLI de shadcn porque el registro no es accesible desde el sandbox. A diferencia de la web actual, las clases de Tailwind también aparecen en `components/` y `pages/` para componer maquetación.

## Tokens (`src/styles/index.css`)

| Token | Valor | Uso |
|---|---|---|
| `primary` | `#A63F30` (hover `#8A3225`) | Botones y enlaces. Blanco sobre él: 6,1:1 |
| `title` | `#7A2A1B` | Titulares |
| `foreground` | `#3D2A25` | Texto |
| `muted-foreground` | `#765F58` | Texto secundario (4,8:1 sobre el fondo) |
| `background` | `#FFF6F2` | Fondo |
| `secondary` / `accent` / `accent-soft` | `#EA8659` / `#F6C6A4` / `#FBE3D6` | Degradado final, iconos, selección |
| `warning`, `success`, `destructive` | `#F59E0B`, `#16A34A`, `#9C2020` (y fondos suaves) | «En espera», confirmaciones, errores |

Los valores de la tabla inicial del encargo (`#B94B44`, etc.) se oscurecieron para acercarse a la referencia y cumplir contraste AA.

Tipografías (todas locales con `@fontsource`): **Playfair Display Variable** (titulares), **Manrope Variable** (interfaz) y **Great Vibes** (texto de las invitaciones). Escala fluida con `clamp()` en `display-title` y `section-title`.

## Componentes

`components/layout` Header, Footer, Layout, AuthShell · `components/shared` Logo, Photo, SectionHeading, FAQAccordion, DecorativeBackground, RingsIcon · `components/invitations` InvitationCard, InvitationCarousel, PhoneFrame, PhoneInvitation, RSVPCard · `components/events` EventCategoryCard · `components/providers` ProviderCard · `components/forms` FormField, PasswordField, SocialAuthButtons, NewsletterForm, FormNotice.

- **InvitationCard** dibuja el fondo SVG y superpone el texto en HTML con unidades de contenedor (`cqw`): se ve igual a 90 px que a 400 px.
- **RSVPCard** usa radios nativos por persona (teclado y lector de pantalla sin código extra).
- **Photo** genera `srcset` en WebP con ancho y alto declarados y `loading="lazy"` salvo `eager` (hero).

## Datos simulados (documentado)

| Qué | Dónde | Por qué |
|---|---|---|
| Acceso, registro, recuperación, newsletter | `features/auth/mockAuth.ts` | No hay API conectada; no se inventan endpoints. Las pantallas lo avisan |
| Proveedores | `features/providers/data.ts` | Perfiles de ejemplo, marcados «Perfil de ejemplo», sin valoraciones |
| Demostración | `features/demo/*` | Estado local; copiar enlace usa el portapapeles con una URL de ejemplo |

## Ejecutar

```bash
npm install                       # desde la raíz
npm run dev -w @tuevento/new-design      # http://localhost:5190
npm run assets -w @tuevento/new-design   # regenera SVG y procesa photos-src/
npm run build -w @tuevento/new-design
npm test -w @tuevento/new-design         # Playwright: rutas, formularios, demo, axe, nueve tamaños
npm run shots -w @tuevento/new-design    # capturas en artifacts/screenshots/{mobile,tablet,laptop,desktop}
```

## Fotografías

Provisionales: recortes de las referencias (`npm run assets` los procesa desde `photos-src/`; ver `assets-manifest.md`).
Para sustituirlas guarda cada original con el mismo nombre (`photos-src/salones.jpg`; el script prefiere `.jpg`, `.jpeg`,
`.png` y `.webp` en ese orden de extensión) y ejecuta `npm run assets -w @tuevento/new-design`. Anota autor y URL en el inventario.
