# Análisis visual — TuEventoFun (prototipo `apps/new-design`)

Referencias: `design/01_Landing.png` (1024×1536, landing completa) y `design/Collage UI de TuEventoFun en español.png`
(1536×1024: login, registro, recuperar contraseña, proveedores, demo en dos paneles). Ambas son maquetas
generadas, solo en español.

## Lo observado

| Aspecto | Observación |
|---|---|
| Fondo | Durazno muy claro (≈ `#FFF6F2`) con manchas radiales más cálidas arriba a la derecha y a la izquierda; las secciones son tarjetas blancas translúcidas de esquinas amplias (≈ 24–32 px) con sombra difusa cálida |
| Color de acción | Terracota profundo (≈ `#A3402F`); texto blanco. Títulos en marrón rojizo (≈ `#7A2A1B`) |
| Acentos | Durazno `#F6C6A4`, coral `#EA8659` (degradado de la banda final), ámbar para «En espera» |
| Tipografía | Titulares serif editorial semibold con cursiva en «estar juntos.»; texto en sans geométrica; texto de las invitaciones en caligrafía |
| Retícula | Contenedor ≈ 1152–1280 px en 1440; secciones apiladas con 12–16 px entre tarjetas |
| Bordes y radios | Tarjetas 16–24 px, botones 8–10 px (no píldora), chips redondeados |
| Iconos | Línea fina de un solo color terracota dentro de círculos durazno |
| Hero | Texto a la izquierda; a la derecha cuatro invitaciones inclinadas y un teléfono con la invitación y la barra de respuesta; cinta inclinada «Diseños que cuentan tu historia» |
| Acceso | Tarjeta dividida: formulario a la izquierda, fotografía con borde izquierdo curvo, tarjeta de papel inclinada con frase caligráfica y lista de beneficios apilada sobre la foto |
| Proveedores | Hero con fotografía, buscador, fila de ocho categorías con icono, tarjetas con foto/nombre/especialidad, banda de CTA |
| Demo | Cuatro pasos numerados, selector de diseño con lista de estilos + carrusel, teléfono a la derecha, tarjetas de personalización/compartir/respuestas |

## Lo inferido (no está en las imágenes)

- Comportamiento responsive (móvil de una columna, tablet con rejillas de 2–3 columnas, anchos máximos en pantallas grandes).
- Estados de error, carga, vacío y foco; el menú móvil; los textos de las respuestas de las preguntas frecuentes.
- Los diseños `elegante`, `minimalista` y `evento-especial` (la referencia solo muestra cinco invitaciones).
- Los pasos 1 y 2 del demo en móvil.

## Matriz referencia → página → componentes → recursos

| Referencia (zona) | Página | Componentes | Recursos |
|---|---|---|---|
| Landing: cabecera | todas | `Header`, `Logo` | `branding/logo-mark*.svg` |
| Landing: hero | `/` | `Hero`, `InvitationCard`, `PhoneInvitation`, `PhoneFrame` | `invitations/*.svg`, `events/hero-fondo` (foto), `decorations/floral-corner.svg` |
| Landing: categorías | `/` | `EventCategoryCard`, `RingsIcon` | iconos Lucide |
| Landing: galería | `/` | `InvitationCarousel`, chips de filtro | `invitations/*.svg` |
| Landing: tres pasos | `/` | `Steps`, `SectionHeading` | — |
| Landing: familia | `/` | `RSVPCard`, `FamilyRsvp` | `events/mesa-gracias` (foto) |
| Landing: proveedores | `/` | `ProvidersTeaser`, `Photo` | `providers/*` (fotos) |
| Landing: testimonio + FAQ | `/` | `PromiseAndFaq`, `FAQAccordion` | — |
| Landing: banda final | `/` | `FinalCta`, `NewsletterForm` | `backgrounds/cta-band.svg`, `decorations/balloons.svg` |
| Landing: pie | todas | `Footer` | — |
| Collage 1: login | `/login` | `AuthShell`, `FormField`, `PasswordField`, `SocialAuthButtons` | `events/auth-login` (foto) |
| Collage 2: registro | `/registro` | ídem + `Checkbox` | `events/auth-registro` (foto) |
| Collage 3: recuperar | `/recuperar-contrasena` | `AuthShell`, `FormNotice` | `events/auth-recuperar` (foto) |
| Collage 4: proveedores | `/proveedores` | `ProviderCard`, filtros, buscador | `providers/hero-mesa`, `providers/*` |
| Collage 5–6: demo | `/demo` | `PhoneInvitation`, `InvitationCarousel`, `RSVPCard` | `invitations/*.svg` |

## Cambios deliberados respecto a las imágenes

- **Sin testimonio.** El producto no tiene opiniones reales (PRODUCT.md); la tarjeta de «María & Andrés» se sustituye por una promesa de producto sin autor.
- **Sin valoraciones, ciudades ni disponibilidad** en las tarjetas de proveedores: son perfiles de ejemplo y lo dicen.
- **Sin selector de idioma, «Precios», redes sociales ni «Más ▾»**: llevarían a páginas o integraciones que no existen en el prototipo.
- **Google y Apple** se ven pero están desactivados: no hay integración.
- **Registro sin confirmación de contraseña**: como en la referencia, el campo tiene botón para mostrarla.
- **El teléfono del hero no sostiene una mano**: es un marco dibujado en CSS (no se reconstruyen fotografías con CSS/SVG).
