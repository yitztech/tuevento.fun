---
name: TuEventoFun
description: Un espacio blanco y colorido para organizar celebraciones.
colors:
  primary: "#882d17"
  primary-deep: "#68200f"
  celebrate: "#ffca66"
  accent-secondary: "#e25c80"
  ground: "#ffffff"
  ink: "#261c18"
  muted: "#6e5f5a"
  line: "#efe6e1"
  surface-soft: "#fdf8f5"
  error: "#9c2020"
typography:
  headline:
    fontFamily: "Bricolage Grotesque Variable, Manrope Variable, sans-serif"
    fontSize: "36px"
    fontWeight: 650
    lineHeight: 1.15
    letterSpacing: "-1.1px"
  title:
    fontFamily: "Bricolage Grotesque Variable, Manrope Variable, sans-serif"
    fontSize: "23px"
    fontWeight: 600
    lineHeight: 1.25
    letterSpacing: "-0.5px"
  body:
    fontFamily: "Manrope Variable, sans-serif"
    lineHeight: 1.7
  label:
    fontFamily: "Manrope Variable, sans-serif"
    fontSize: "13px"
    fontWeight: 700
    lineHeight: 1.3
rounded:
  control: "8px"
  button: "9px"
  surface: "14px"
  card: "13px"
  tag: "5px"
  modal: "16px"
spacing:
  small: "8px"
  medium: "12px"
  control: "20px"
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.ground}"
    rounded: "{rounded.button}"
    padding: "12px 20px"
    typography: "{typography.label}"
  button-primary-hover:
    backgroundColor: "{colors.primary-deep}"
  button-secondary:
    backgroundColor: "{colors.ground}"
    textColor: "{colors.ink}"
    rounded: "{rounded.button}"
    padding: "12px 20px"
  button-danger:
    backgroundColor: "{colors.error}"
    textColor: "{colors.ground}"
    rounded: "{rounded.button}"
    padding: "12px 20px"
  button-danger-outline:
    backgroundColor: "{colors.ground}"
    textColor: "{colors.error}"
    rounded: "{rounded.button}"
    padding: "12px 20px"
  button-celebrate:
    backgroundColor: "{colors.peony}"
    textColor: "{colors.primary}"
    rounded: "{rounded.button}"
    padding: "12px 20px"
  input:
    backgroundColor: "{colors.ground}"
    textColor: "#353943"
    rounded: "{rounded.control}"
    padding: "12px"
    width: "100%"
  navigation-item-active:
    backgroundColor: "{colors.ice}"
    textColor: "{colors.primary}"
    rounded: "{rounded.control}"
    padding: "0 13px"
  status-pill:
    rounded: "{rounded.tag}"
    padding: "5px 7px"
  event-card:
    backgroundColor: "{colors.ground}"
    rounded: "{rounded.card}"
  rsvp-option:
    rounded: "7px"
    padding: "11px 7px"
---

# Design System: TuEventoFun

## Overview

**Creative North Star: "Revista contemporánea de celebraciones"**

Una interfaz de gestión clara que utiliza fotografía de celebraciones y tipografía expresiva para dar identidad a tareas concretas. El fondo blanco puro es una condición del producto; los acentos azul tinta, rosa peonía y amarillo aportan color sin cubrir el área de trabajo.

La personalidad editorial se concentra en titulares, cifras e invitaciones. Los controles de organización mantienen bordes discretos, estados claros y una densidad compacta. El lenguaje visual acompaña el trabajo del anfitrión y la respuesta del invitado.

**Key Characteristics:**

- Fotografías visibles y plantillas diferenciadas.
- Jerarquía editorial con controles de gestión compactos.
- Estados de asistencia identificados por texto y color.
- Español e inglés con el mismo lenguaje visual.

## Colors

El sistema utiliza variables CSS flexibles en `:root` que permiten conmutar temas (p. ej. mediante `data-theme`). La paleta activa es **Terracota Festivo & Ámbar**: el terracota noble (`--primary: #882d17`) identifica acciones principales y enlaces destacados, mientras que el ámbar caléndula (`--celebrate: #ffca66`) y la granada cálida (`--accent-secondary: #e25c80`) distinguen momentos de celebración y detalles festivos.

El lino cálido marfil (`--surface-soft: #fdf8f5`) identifica navegación activa y superficies de soporte sobre el fondo blanco puro innegociable (`--ground: #ffffff`). La tinta café tostado (`--ink: #261c18`) y el texto secundario cálido (`--muted: #6e5f5a`) garantizan lecturas con ratios de contraste superiores a 16:1 y 6:1 (WCAG AAA).

### Primary

- **Terracota noble** (`#882d17`) y **terracota profundo** (`#68200f`): acción principal y su respuesta al pasar el puntero.

### Secondary

- **Ámbar caléndula** (`#ffca66`): acciones celebratorias y botones de demostración.
- **Granada cálida** (`#e25c80`): acentos festivos y detalles de composición.

### Neutral

- **Blanco puro** (`#ffffff`): superficie principal innegociable y campos.
- **Café tostado** (`#261c18`): lectura principal de alto contraste.
- **Arcilla suave** (`#6e5f5a`): texto secundario accesible.
- **Línea arena** (`#efe6e1`): bordes y divisores suaves.
- **Lino marfil** (`#fdf8f5`): navegación seleccionada y superficies de apoyo.

### Estados de Asistencia (RSVP)

El **carmesí accesible** (`#9c2020` sobre `#fdeae8`) expresa rechazo y acciones destructivas; la confirmación usa **bronce ocre** (`#804306` sobre `#fef1e1`), y la espera usa **ámbar tostado** (`#8c5405` sobre `#fff6e5`), siempre acompañados de su etiqueta textual.

El verde y el azul quedan fuera de los colores principales de interfaz por decisión del producto; las fotografías conservan sus colores naturales.

**The White Ground Rule.** La superficie principal permanece blanca; los bloques de color tienen una función concreta y límites visibles.

## Typography

Manrope Variable se usa en controles y texto. Bricolage Grotesque Variable se reserva para titulares, títulos de eventos y cifras protagonistas. Ambas fuentes se sirven localmente. Los encabezados usan balance de líneas y un interletrado ligeramente negativo; el texto de lectura conserva un ritmo holgado.

Los tamaños base de titulares y títulos están en el frontmatter. La cabecera de página usa una variante de 32 px; el título de tarjeta usa 16 px y las cifras del resumen, 30 px con números tabulares. El cuerpo no tiene un tamaño global explícito: cada contexto fija su densidad, por lo que no se declara una escala de cuerpo inventada. En móvil los títulos y composiciones se adaptan mediante las reglas del stylesheet.

**The Task and Celebration Rule.** Manrope sostiene lectura y controles; Bricolage aporta la voz expresiva de títulos y cifras.

## Layout

Navegación lateral de 232 px y cabecera horizontal. El contenido de escritorio usa 34 px arriba y 38 px a los lados. Las tarjetas de evento forman una cuadrícula; los formularios combinan campos y vista previa. Los breakpoints del panel son 1650, 1200, 1000, 760 y 480 px; administración y descargas añaden una adaptación a 767 px. La landing conserva su escala propia documentada en `docs/LANDING.md`.

La barra lateral se convierte en un panel móvil con fondo de cierre. A 760 px se oculta la fecha de la cabecera y se simplifica el selector de idioma. El margen lateral depende de la superficie: el panel usa 18 px a 480 px o menos y el RSVP usa 21 px. Los formularios se apilan y las acciones se reorganizan. El modo pantalla tiene su propia composición.

## Elevation & Depth

Las superficies de gestión se distinguen con bordes finos y fondos, no con sombras constantes. Sombras difusas aparecen en modales, avisos y elementos superpuestos, como la fecha sobre una fotografía. El modal utiliza `0 24px 90px #131b2f40`; el aviso usa `0 6px 25px #16213a29`. La profundidad de las invitaciones procede principalmente de sus fotografías.

## Shapes

Controles y botones tienen esquinas suaves de 8 y 9 px. La superficie reutilizable usa 14 px. Los avatares y puntos de estado son circulares; las tarjetas conservan contornos rectangulares reconocibles. Iconos Lucide con tamaño coherente, sin glifos decorativos como sustitutos de controles.

## Components

### Buttons

Botón principal azul; secundario blanco con borde; acción celebratoria rosa. Existen variantes destructivas roja y blanca con borde rojizo. La base de botones y campos tiene una altura mínima de 44 px; algunas variantes compactas la reducen. El hover base del botón eleva 1 px y cambia el fondo en 180 ms. Foco visible de 3 px con separación de 3 px. La preferencia de movimiento reducido elimina animaciones no esenciales.

### Inputs / Fields

Los campos mantienen etiqueta independiente, ayuda y error vinculados mediante `aria-describedby`. Fondo blanco, borde gris frío suave, padding de 12 px y esquinas de control. La búsqueda agrupa icono y campo y muestra su propio contorno al recibir foco.

### Navigation

La navegación lateral combina icono, etiqueta y contadores. La selección usa hielo, azul y un peso de 800; el hover usa un fondo azul muy claro. Las acciones destructivas conservan su color rojo al interactuar. El aviso de demostración permanece visible en el panel móvil. El selector de idioma es un `select` nativo de al menos 44 px, visible en panel, acceso, registro, RSVP y pantalla.

### Chips

Las etiquetas de asistencia combinan nombre, punto de color y estado accesible. Se usan tres tratamientos: confirmado, pendiente y rechazado. No son botones ni filtros.

### Cards / Containers

La tarjeta de evento integra fotografía, fecha superpuesta, tema, título, lugar y barra de asistencia. Tiene borde fino, esquinas de tarjeta y padding interior de 17 px, con 15 px abajo. El hover cambia el borde y escala la foto a 1.025 en 500 ms; no levanta la tarjeta. Las invitaciones conservan fotografía y composición temática.

### RSVP

Cada integrante tiene tres respuestas de igual jerarquía; la selección cambia fondo, borde y texto y conserva una etiqueta explícita. En móvil las opciones apilan icono y texto para mantener las tres respuestas visibles.

### Owner Analytics and Downloads

Administración reutiliza navegación, titulares, cifras tabulares y selector nativo de periodo. Los cinco totales se distribuyen en cinco columnas y pasan a dos hasta 767 px; las tablas conservan desplazamiento horizontal. Descargas combina fotografía y disponibilidad por plataforma en dos columnas, apiladas hasta 767 px. La falta de publicación usa una superficie hielo y ofrece continuar en web. Las pantallas React compartidas conservan estos patrones dentro de Capacitor; esta continuidad no equivale a validación visual en dispositivos físicos.

### Dialogs and Feedback

Los modales usan `dialog`, conservan foco nativo y admiten Escape. Los avisos azules aparecen sobre la interfaz con animación breve y sombra difusa. La elevación completa, las transiciones, los breakpoints y los ejemplos renderizables se registran en `.impeccable/design.json`.

Deuda observada, no convertida en regla: microtextos de 9–10 px y el kicker del banner. Las variantes destructivas tienen su propio hover rojo; las acciones móviles corregidas conservan una altura mínima de 44 px.

## Do's and Don'ts

### Do:

- **Do** conservar el fondo blanco puro y los acentos definidos.
- **Do** mostrar nombres de estados además de su color.
- **Do** traducir los textos de interfaz y conservar intacto el contenido escrito por usuarios.
- **Do** mantener imágenes reales, fuentes locales y foco visible.
### Don't:

- **Don't** presentar datos de demostración como eventos reales del usuario.
- **Don't** sustituir fotografías por degradados o texturas simuladas.
- **Don't** fijar anchos de texto que corten las traducciones.
