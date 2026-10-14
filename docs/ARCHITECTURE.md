# Arquitectura

TuEventoFun es un monorepo TypeScript. La web no contiene reglas de negocio exclusivas del navegador.

| Directorio            | Responsabilidad                                                                 |
| --------------------- | ------------------------------------------------------------------------------- |
| `apps/web`            | Entrada Vite y adaptador del navegador.                                         |
| `packages/app`        | Aplicación React: navegación, componentes, formularios y estilos reutilizables. |
| `packages/contracts`  | Esquemas Zod, tipos, temas y cálculo de métricas compartidos.                   |
| `packages/client`     | Cliente HTTP tipado sin acceso al DOM, con transporte inyectable.               |
| `apps/api`            | NestJS sobre Fastify: autenticación, casos de uso y acceso a PostgreSQL.        |
| `apps/api/migrations` | Esquema relacional versionado.                                                  |

## Gateway, proxy y reinicios

`services/gateway/` contiene la configuración del Nginx de entrada (imagen construida desde `services/gateway/Dockerfile`): `default.conf.template` (rutas, IP real, `/healthz`, `/version.json`, robots, sitemap, `canonical`/`hreflang`), `snippets/` (cabeceras de proxy y de seguridad con la CSP), `16-analytics.sh` (Umami opcional) y `17-sites.sh` (idioma por dominio a partir de `SITE_URL_ES`/`SITE_URL_EN`). La configuración va dentro de la imagen; el compose no monta archivos.

Nginx usa la resolución dinámica de DNS de Docker para encontrar a la API cuando cambia su IP al recrear el contenedor; se usa `resolve` con una zona compartida ([documentación de upstream resolve](https://nginx.org/en/docs/http/ngx_http_upstream_module.html#server)). El healthcheck del gateway usa `/healthz`, que responde el propio Nginx: el gateway sigue sano aunque la API se esté reiniciando, y la API tiene su propio healthcheck.

IP real: Traefik (subred `TRUSTED_PROXY_CIDR`) añade la IP del cliente a `X-Forwarded-For`; el gateway solo acepta esa cabecera desde esa subred y la sobrescribe con la IP resultante hacia la API.

## Persistencia y seguridad

- Usuarios, sesiones, eventos, invitaciones, integrantes y notificaciones residen en PostgreSQL. Los volúmenes sobreviven a reinicios.
- Los organizadores solo acceden a eventos de su propiedad. Las comprobaciones se hacen en el servidor.
- Contraseñas derivadas mediante scrypt y sal aleatoria. Sesiones opacas de 256 bits con hash en base de datos; cookie HttpOnly y SameSite=Lax, revocada al cerrar sesión. `COOKIE_SECURE=true` se debe activar con HTTPS.
- CORS permite únicamente los orígenes configurados. Las escrituras requieren un encabezado no simple y un origen permitido cuando está presente, reduciendo CSRF. Fastify limita solicitudes. No se almacenan tokens de sesión en localStorage.
- Invitaciones privadas por posesión de tokens aleatorios de 192 bits. Su portal solo recibe datos necesarios, sin correo, teléfono ni notas del anfitrión. No se requiere cuenta de invitado.
- RSVP y edición de integrantes usan transacciones y bloqueo de la invitación. Se validan todos los IDs; no se pueden mover integrantes ajenos. Las respuestas idénticas no duplican notificaciones.
- Los avatares se validan y decodifican con Sharp, se redimensionan y se vuelven a codificar como JPEG. Se limitan a 2 MB y 25 millones de píxeles de entrada.
- Las fechas se guardan en UTC con zona IANA del evento. La web convierte desde la zona elegida, no desde una zona implícita del navegador.

## Actualización en vivo

Después de una escritura, el servidor emite un evento SSE dirigido al usuario propietario. El cliente obtiene métricas y notificaciones actualizadas. Existe una actualización de respaldo cada 30 segundos y reconexión automática de EventSource.

El bus SSE actual es en memoria para una única instancia de backend. Para varias réplicas se debe sustituir por PostgreSQL LISTEN/NOTIFY o Redis Pub/Sub, conservando las interfaces.

## Demostración

Al abrir el panel sin sesión y con `DEMO_ENABLED=true`, se crea un usuario temporal exclusivo de ese navegador con tres eventos sintéticos, invitaciones y respuestas de ejemplo. No se comparte una cuenta entre visitantes. Los datos se etiquetan como demostración. Las cuentas de demo con más de siete días se limpian al iniciar el backend. El registro de una cuenta normal siempre comienza vacío.

## Desktop

`packages/app/src/desktop.tsx` proporciona una entrada reutilizable con HashRouter. El host inyecta transporte HTTP, portapapeles, apertura de enlaces y suscripción SSE. El backend y los contratos son los mismos; no hace falta copiar las pantallas ni la lógica de validación.

Un host Electron/Tauri debe usar un transporte autenticado con almacén de cookies propio, persistir credenciales solo en almacenamiento seguro del sistema y permitir exclusivamente el servidor configurado. No exponga un puente HTTP arbitrario al renderer. La cuenta con contraseña funciona con el mismo contrato de sesión. Para Google en desktop utilice un navegador del sistema y un flujo OAuth propio del host con PKCE y retorno validado; el botón GIS web implementado no debe incrustarse como autenticación nativa. No se ha empaquetado ni validado un instalador desktop en este trabajo.

## Límites del alcance actual

No se implementan correo transaccional, recuperación de contraseña, verificación de correo, pagos, asignación de mesas ni lectura de QR; no formaban parte del documento. Correo y WhatsApp abren un mensaje preparado, no envían mensajes automáticamente. Para uso público real aún se requieren dominio accesible, HTTPS, configuración Google y estrategia operativa de copias/retención. El despliegue entregado está ligado a loopback para desarrollo local.
