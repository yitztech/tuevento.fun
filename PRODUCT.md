# TuEventoFun

<!-- impeccable:product-schema 1 -->

## Platform

Web y apps Android/iOS con pantallas React compartidas y empaquetado Capacitor.

## Stack

React con Vite, NestJS con Fastify, PostgreSQL y Docker Compose. TypeScript, contratos Zod, cliente API y pantallas compartidos entre web, Android e iOS; un cliente desktop sigue siendo una posibilidad de reutilización, no una entrega publicada.

## Users

Organizadores de fiestas, personas invitadas individualmente o como familias y el dueño del sistema, con acceso administrativo explícito.

## Product Purpose

Crear eventos, personalizar invitaciones, distribuir enlaces privados y conocer la asistencia por persona.

## Operating Context

Administración en computadora y tablet; RSVP y envío en móviles; visualización de asistencia en pantallas grandes y Smart TVs.

## Capabilities and Constraints

Registro con avatar, sesiones y Google; múltiples eventos; seis temas; familias con adultos/niños y notas; compartir por URL, WhatsApp y email; RSVP por integrante con estados azul, amarillo y rosa rojizo; métricas y notificaciones actualizadas. Los enlaces son privados por posesión. No se han proporcionado credenciales Google ni dominio de publicación.

## Brand Commitments

Fondo blanco puro, elegante y colorido con imágenes. Azul tinta, hielo, rosa peonía y amarillo; el usuario pide eliminar el verde de toda la interfaz. Evitar paletas genéricas de herramientas de IA. Idioma español. Nombre TuEventoFun confirmado por el usuario.

## Evidence on Hand

Especificación funcional aportada en Texto pegado.txt. No hay imágenes propias, clientes, testimonios o datos de eventos reales. La demostración debe identificarse como tal.

## Product Principles

- Resolver la asistencia por persona, incluso dentro de una familia.
- Hacer visible el siguiente paso de organización.
- No exigir registro para responder una invitación.
- Separar los datos de cada organizador.

## Open Decisions

Confirmado: construcción directa del sitio. La nueva solicitud añade una landing de captación como entrada pública en `/`; el panel y la demostración aislada permanecen en `/app`. Registro real con cuenta vacía o apertura del editor cuando el visitante inicia un evento desde la landing.

## Idiomas

Un idioma por dominio: https://tuevento.fun en español y https://yourevent.fun en inglés, con la misma aplicación. El idioma lo decide el dominio (un dominio desconocido usa español), no el navegador ni una preferencia guardada. El otro idioma se ofrece con un enlace a su dominio, nunca con una redirección automática. Cada página lleva su `canonical` y sus `hreflang`; `robots.txt` y `sitemap.xml` van por dominio. La cuenta guarda el idioma del dominio donde se registró. La interfaz y los mensajes se traducen; el contenido escrito por el usuario se conserva. Privacidad y condiciones están en `/privacidad` y `/condiciones` (es) y en `/privacy` y `/terms` (en); el titular y el contacto están pendientes de publicar. Detalle técnico en [docs/I18N.md](docs/I18N.md).

## Administración, descargas y apps

El dueño autorizado consulta en `/administracion` visitantes únicos, visitas, registros, accesos y clics de descarga, con periodos de 7/30/90 días y tablas por plataforma y día. El servidor comprueba el rol; el registro no concede privilegios. La demo queda excluida de registros y accesos. Los clics no acreditan instalaciones.

`/descargas` presenta Android e iOS desde un catálogo de publicaciones reales. Mientras no haya una versión publicada, informa de su disponibilidad pendiente y permite continuar en web. Android admite APK o Google Play; iOS, TestFlight o App Store. No se muestran enlaces de instalación ficticios.

Las apps reutilizan las pantallas React ES/EN, contratos, cliente y backend web. Capacitor integra HTTP/cookies, portapapeles y navegador del sistema; las actualizaciones de datos usan polling, no push. Los workflows de GitHub Actions cubren CI, despliegue, compilación móvil y publicación del catálogo. El detalle operativo está en `docs/MOBILE-CICD.md`.

## Estado de publicación y validación

Repositorio GitHub, dominio público y cuenta del dueño siguen sin definir por el usuario. No hay apps firmadas o publicadas ni ejecución remota de los workflows acreditada. Las compilaciones Android debug e iOS para simulador son evidencia de compilación local, no de ejecución visual ni funcionamiento en dispositivos físicos. Publicación, firma, Google real y retorno a la app requieren configuración externa y validación adicional.
