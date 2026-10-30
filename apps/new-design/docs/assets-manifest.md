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

## Fotografías (WebP, 480/960/1600 px según la ranura) — **marcadores**

| Clave | Dónde | Proporción | Qué debe mostrar |
|---|---|---|---|
| `providers/hero-mesa` | Hero de proveedores | 1,6:1 | Mesa de banquete con flores y velas |
| `events/mesa-gracias` | Portada, «Cada persona cuenta» | 1,4:1 | Mesa con arreglo floral y espacio para la tarjeta |
| `events/hero-fondo` | Portada, fondo difuso del hero | 16:9 | Flores desenfocadas, tonos durazno |
| `providers/salones`, `catering`, `fotografia`, `decoracion`, `musica`, `experiencias`, `pasteles`, `coordinacion` | Tarjetas y mosaico | 4:3 | Una por categoría |
| `events/auth-login` | Login | 4:5 | Flores con velas |
| `events/auth-registro` | Registro | 4:5 | Persona sonriendo con portátil y globos |
| `events/auth-recuperar` | Recuperar contraseña | 4:5 | Sobre con corazón sobre flores |

Origen: **pendiente** (sin generador de imágenes en la sesión; la búsqueda en Unsplash/Pexels no fue posible desde el entorno). Sin texto dentro de las fotos.
