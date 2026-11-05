# Inventario de recursos

Todos los SVG los dibuja `scripts/generate-assets.mjs` (original, sin material de terceros). Estado:
**validado** = inspeccionado en las capturas · **marcador** = pendiente de una fotografía real.

## Identidad (`public/assets/branding`)

| Recurso | Propósito | Formato / tamaño | Origen | Estado |
|---|---|---|---|---|
| `logo-mark.svg` | Isotipo (corazón con hojas y destello), fondos claros | SVG 64×64 | Propio | validado |
| `logo-mark-light.svg` | Isotipo para fondos oscuros | SVG 64×64 | Propio | validado |
| `favicon.svg`, `favicon-32.png` | Favicon | SVG / PNG 32×32 | Propio | validado |
| `apple-touch-icon.png` | Icono iOS | PNG 180×180 | Propio | validado |

Las variantes **horizontal** y **compacta** del logotipo son el componente `Logo` (isotipo + texto en Playfair Display), no archivos: el texto de un SVG cargado con `<img>` no usa las fuentes de la página.

## Decoraciones y fondos

| Recurso | Propósito | Tamaño | Estado |
|---|---|---|---|
| `decorations/floral-corner.svg` | Esquina floral (hero) | 420×460 | validado |
| `decorations/leaf-branch.svg` | Rama de hojas | 260×420 | validado |
| `decorations/flower-{peach,rose,coral}.svg` | Flores sueltas | 160×160 | validado |
| `decorations/balloons.svg` | Globos (demo, banda final) | 220×320 | validado |
| `decorations/{confetti,heart,sparkle}.svg` | Confeti, corazón, destello | varios | validado |
| `backgrounds/cta-band.svg` | Degradado de la banda final | 1400×260 | validado |
| `backgrounds/peach-wash.svg` | Fondo suave alternativo | 1600×900 | sin uso por ahora |

## Invitaciones (`public/assets/invitations`, SVG 600×900; el texto lo pone `InvitationCard`)

`boda-floral`, `cumpleanos-globos`, `noche-bokeh`, `infantil-oso`, `xv-rosas`, `minimalista`, `elegante`, `evento-especial` — origen propio, **validado**.

## Fotografías (WebP, 480/960/1600 px según la ranura)

Las 14 imágenes de `photos-src/` fueron generadas con la herramienta integrada de imágenes de OpenAI para este prototipo. Son escenas ilustrativas, no fotografías de proveedores ni eventos reales. `npm run assets` produce las variantes WebP a partir de esos originales.

| Clave | Contenido |
|---|---|
| `providers/hero-mesa`, `events/mesa-gracias`, `events/hero-fondo` | Mesas y flores para celebraciones |
| `providers/salones`, `catering`, `fotografia`, `decoracion`, `musica`, `experiencias` | Escenas ilustrativas de cada categoría |
| `providers/pasteles`, `providers/coordinacion` | Pastel y coordinación de eventos |
| `events/auth-login`, `auth-registro`, `auth-recuperar` | Flores, planificación y sobre |
