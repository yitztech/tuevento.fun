# Recursos de marca transformados

Seis originales preparados: símbolo y logos ES, EN, FR, DE y PT. Los archivos originales de `apps/web/public/images/icon*` se conservan sin sobrescribir. El sitio ya los usa (logo por idioma y favicon, ver `docs/ASSETS.md`); los iconos de los proyectos nativos (Android e iOS) siguen sin cambiar.

## Archivos de entrega

Los recursos utilizables están en `apps/web/public/images/brand-v2/`.

| Recurso | Formato y tamaños |
| --- | --- |
| Símbolo completo | PNG transparente y WebP transparente: 32, 48, 64, 96, 128, 192, 512 y 1024 px |
| Logos ES / EN / FR / DE / PT | WebP transparente: 240, 480, 720 y 1080 px de ancho |
| Alternativa de los cinco logos | PNG transparente: 720 px de ancho |
| Favicon simplificado | PNG transparente: 16, 32, 48 y 64 px; ICO con 16, 32 y 48 px |
| Apple touch | PNG opaco: 180 × 180 px |
| Icono para aplicaciones | PNG opaco: 512 y 1024 px, fondo durazno y margen alrededor del símbolo |

Los siete PNG maestros transparentes están en `masters/`, fuera de la carpeta pública. El favicon es una adaptación del calendario y corazón con menos elementos.

## Uso

- Usar el símbolo a 48–64 px en espacios compactos; para 16–32 px, preferir el favicon simplificado.
- Mostrar el logo completo, como orientación, entre 240 y 360 px de ancho CSS. A 240 px, los archivos de 240 / 480 / 720 px cubren densidades 1× / 2× / 3×. A 360 px y densidad 3×, usar el archivo de 1080 px.
- Los logos conservan la relación 3:1. Definir ancho y alto en la integración para reservar espacio y no deformarlos.
- Eliminar el fondo no cambia el color oscuro de las letras: los logos completos están preparados para fondos claros, incluido el durazno del sitio. Sobre fondos oscuros hace falta una variante de texto claro. El símbolo independiente sí se ha inspeccionado sobre fondo oscuro.
- Elegir el archivo por locale: `logo-es`, `logo-en`, `logo-fr`, `logo-de`, `logo-pt`. No inferir el idioma desde el nombre de archivo original.
- Los PNG opacos son exportaciones para integración. No sustituyen una configuración completa de iconos adaptativos de Android ni los catálogos y la validación nativa de iOS.

## Procedencia y verificación

Se utilizó la herramienta integrada `image_gen.imagegen` para quitar el fondo de cada original y crear la variante pequeña. Se conservaron los textos: TuEventoFun, YourEventFun, TonÉvénementFun, DeinEventFun y SeuEventoFun. No se cambió la paleta para adaptarla a terracota.

La exportación de tamaños y formatos se realizó localmente con Sharp ya instalado, sin cambiar dependencias ni lockfiles. WebP usa calidad 90 y alfa de calidad 100; PNG se exporta sin pérdida.

`manifest.json` registra los prompts completos, rutas relativas, dimensiones, tamaños, formatos y hashes SHA-256. `verification.json` contiene el resultado de comprobar que los recursos decodifican, que los transparentes tienen fondo transparente y contenido visible, que los opacos no tienen alfa y que los originales siguen intactos.

La inspección visual de `preview.png` cubre los cinco textos, el fondo durazno y blanco, el símbolo sobre fondo oscuro y las versiones pequeñas del favicon. Esta verificación de recursos no acredita su integración en la interfaz ni pruebas en teléfonos o tabletas físicos.
