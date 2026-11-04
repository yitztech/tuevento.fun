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

## Fotografías (WebP, 480/960/1600 px según la ranura) — **provisionales, recortadas de las referencias**

Origen: recortes de `design/01_Landing.png` y `design/Collage UI de TuEventoFun en español.png` (maquetas generadas por IA,
1024–1536 px), hechos con `scripts/crop-references.mjs` hacia `photos-src/` y procesados por `npm run assets`. Sin texto
dentro. Son de 80–300 px de origen, así que se ven suaves al ampliarse: **no son aptas para publicar** y no tienen licencia
documentada; hay que sustituirlas por fotografías con licencia (mismo nombre en `photos-src/`).

| Clave | Dónde | Recorte de origen |
|---|---|---|
| `providers/hero-mesa` | Hero de proveedores | Mesa con velas (collage, panel de proveedores) |
| `events/mesa-gracias`, `events/hero-fondo`, `events/auth-recuperar` | Portada «Cada persona cuenta», fondo del hero, recuperar contraseña | Flores y velas (landing, sección de familia); las tres comparten origen |
| `providers/salones`, `catering`, `fotografia`, `decoracion`, `musica`, `experiencias` | Tarjetas y mosaico | Un mosaico de la landing cada una |
| `providers/pasteles`, `providers/coordinacion` | Tarjetas | Reutilizan los mosaicos de decoración y música (la referencia no trae otros) |
| `events/auth-login` | Login | Flores con velas (collage, login) |
| `events/auth-registro` | Registro | Mujer sonriendo con globos (collage, registro) |
