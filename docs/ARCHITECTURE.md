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

El tráfico entra por `gateway` y se reparte: `/api/` y `/.well-known/*` van a `api`; todo lo demás, a `web`. Así el frontend se puede escalar o cachear por separado.

- `services/gateway/`: Nginx de entrada, la misma imagen en desarrollo y producción. `default.conf.template` (rutas, IP real, `/healthz` y una zona de caché preparada, sin activar, para `/assets/`) y `snippets/proxy-headers.conf`. Reenvía el `Host` original a `web` y `api`.
- `services/web/`: el frontend. En producción, Nginx en el puerto 8080 con la SPA compilada: `default.conf.template` (`/version.json`, robots, sitemap, `canonical`/`hreflang`), `snippets/security-headers.conf` (cabeceras y CSP), `16-analytics.sh` (Umami opcional) y `17-sites.sh` (idioma por dominio: mapas generados con los idiomas de `packages/contracts`, que vuelca `locales-manifest.cjs`, y el `SITE_URL_<IDIOMA>` de cada uno). En desarrollo (`target: dev`), el mismo Nginx delante de Vite con recarga en caliente.

La configuración va dentro de las imágenes; el compose no monta archivos. El HTML varía por `Host` (idioma): si algún día se cachea en el gateway, la clave de caché debe incluir `$host`.

El gateway usa la resolución dinámica de DNS de Docker para encontrar a `api` y a `web` cuando cambia su IP al recrear el contenedor; se usa `resolve` con una zona compartida ([documentación de upstream resolve](https://nginx.org/en/docs/http/ngx_http_upstream_module.html#server)). El healthcheck del gateway usa `/healthz`, que responde el propio Nginx: el gateway sigue sano aunque la API o la web se estén reiniciando, y cada una tiene su propio healthcheck.

IP real: Traefik (subred `TRUSTED_PROXY_CIDR`) añade la IP del cliente a `X-Forwarded-For`; el gateway solo acepta esa cabecera desde esa subred y la sobrescribe con la IP resultante hacia la API.

## Persistencia y seguridad

- Usuarios, sesiones, eventos, invitaciones, integrantes y notificaciones residen en PostgreSQL. Los volúmenes sobreviven a reinicios.
- Los organizadores solo acceden a eventos de su propiedad. Las comprobaciones se hacen en el servidor.
- Contraseñas con Argon2id (`node:crypto`, m=19 MiB, t=2, p=1). Los hashes scrypt anteriores se siguen aceptando y se recalculan con Argon2id al iniciar sesión. Sesiones opacas de 256 bits con hash en base de datos; cookie `__Host-session` (HttpOnly, SameSite=Lax, `Path=/`, sin `Domain`; sin el prefijo y sin `Secure` mientras `COOKIE_SECURE` no sea `true`, en local), revocada al cerrar sesión.
- Límites propios por IP y por cuenta en acceso, registro, recuperación de contraseña y formularios públicos (`apps/api/src/rate-limit.ts`), con 429 y `Retry-After`; además del global de Fastify. Cuerpos de 1 MB como máximo y 3 MB solo en las subidas de imágenes.
- CORS permite únicamente los orígenes configurados. Las escrituras requieren un encabezado no simple y un origen permitido cuando está presente, reduciendo CSRF. Fastify limita solicitudes. No se almacenan tokens de sesión en localStorage.
- Invitaciones privadas por posesión de tokens aleatorios de 192 bits. Su portal solo recibe datos necesarios, sin correo, teléfono ni notas del anfitrión. No se requiere cuenta de invitado.
- RSVP y edición de integrantes usan transacciones y bloqueo de la invitación. Se validan todos los IDs; no se pueden mover integrantes ajenos. Las respuestas idénticas no duplican notificaciones.
- Los avatares se validan y decodifican con Sharp, se redimensionan y se vuelven a codificar como JPEG. Se limitan a 2 MB y 25 millones de píxeles de entrada.
- Las fechas se guardan en UTC con zona IANA del evento. La web convierte desde la zona elegida, no desde una zona implícita del navegador.

## Errores de la API

Todo error sale en Problem Details (RFC 9457, `apps/api/src/problem.ts`): `type`, `title`, `status`,
`code` estable en inglés, `detail` en el idioma del dominio, `requestId` (el de la cabecera `X-Request-ID`
y el de la línea de log) y `errors[]` por campo con `field`, `code` (`too_long`, `invalid_characters`,
`unknown_field`…) y `message`. Los datos no válidos responden 422; los parámetros de ruta y consulta, 400.

Compatibilidad con las apps publicadas: la respuesta mantiene también los campos anteriores
(`statusCode`, `message` y `fields`), y a las apps nativas (`X-Client-Platform: android|ios`) se les
responde con `Content-Type: application/json`. Estos campos y la excepción del tipo de contenido se
retiran en la próxima versión mayor de las apps, cuando ya no queden versiones que los lean.

## Actualización en vivo

Después de una escritura, el servidor emite un evento SSE dirigido al usuario propietario. El cliente obtiene métricas y notificaciones actualizadas. Existe una actualización de respaldo cada 30 segundos y reconexión automática de EventSource.

El bus SSE actual es en memoria para una única instancia de backend. Para varias réplicas se debe sustituir por PostgreSQL LISTEN/NOTIFY o Redis Pub/Sub, conservando las interfaces.

## Sincronización sin conexión (API)

Para las apps que trabajan sin red (`docs/PLAN-PROVEEDORES-Y-OFFLINE.md`, fase 8). Migración
`028_sincronizacion.sql`, `apps/api/src/sync.ts` e `idempotency.ts`; pruebas en `tests/db/specs/sync.test.js`,
`test-endpoints.mjs` y `test-security.mjs`.

- **Reloj de cambios por cuenta** (`sync_clock`): cada alta, cambio o borrado de un dato de la cuenta toma el
  siguiente número (`sync_seq`), por triggers. La fila del reloj queda bloqueada hasta el final de la
  transacción, así que los números de una cuenta se confirman en orden.
- **`GET /api/sync/changes?cursor=&limit=`** (con sesión, cualquier tipo de cuenta): lo que tiene un número
  mayor que el del cursor, por páginas de hasta 100, con `events`, `invitations` (con sus personas),
  `notifications`, `provider` (con servicios y fotos, solo si cambió), `deleted`, `nextCursor` y `hasMore`.
  Los números de una página salen de una sola instantánea (`REPEATABLE READ`). Sin cursor, todo. El cursor es
  opaco; uno roto responde 400 `invalid_sync_cursor` y uno de más de 90 días (o anterior a tombstones ya
  purgados), 410 `sync_cursor_expired`: el teléfono vuelve a descargarlo todo.
- **Tombstones** (`sync_tombstones`): un borrado deja `{ entity, id }`; un evento borrado deja también los de
  sus invitaciones y avisos. Se purgan a los 90 días.
- **Personas, servicios, fotos y categorías** viajan dentro de su invitación o su perfil: su cambio solo da un
  número nuevo al padre, sin subir su versión (que un invitado responda no es un conflicto para el organizador).
- **`If-Match: "<version>"`** en `PATCH /api/events/:id`, `PUT /api/events/:id/invitations/:id`,
  `PUT /api/provider/profile` y `PUT /api/provider/services/:id`: si no coincide, 409 `version_conflict` con
  `currentVersion`. Sin la cabecera, como siempre. `version` y `updatedAt` vienen en cada evento e invitación.
- **Id del cliente**: `POST /api/events` y `POST /api/events/:id/invitations` aceptan `id` (UUID, v7 desde el
  teléfono). Si ya existe en la cuenta (o en ese evento), devuelve lo guardado; si es de otra, 409 `id_taken`.
- **`Idempotency-Key`** (UUID) en cualquier escritura con sesión: la respuesta se guarda 24 horas por cuenta y
  repetir la clave la devuelve (`Idempotency-Replayed: true`) sin repetir el efecto. Con otro método, ruta o
  cuerpo, 422 `idempotency_key_reused`; mientras la primera sigue en curso, 409 `idempotency_in_progress`. Un
  error no se guarda.
- **Purga y cursor** (migración 029): la limpieza guarda `sync_clock.purged_at`; un cursor caduca si tiene más de
  90 días o si es anterior a la última purga en número y en fecha. Así, el cursor de una descarga completa
  hecha después de purgar ya no responde 410.

## Sincronización sin conexión (cliente)

`packages/client/src/offline/` (sin DOM ni Capacitor; pruebas en `offline.test.ts` con `fake-server.ts`):

- **`OfflineStore`**: `get/set/delete/list/clear` por colección (`events`, `invitations`, `notifications`,
  `provider`, `outbox`, `meta`). `MemoryStore` para las pruebas.
- **`Outbox`**: cola ordenada de escrituras con su `Idempotency-Key`, `baseVersion` y estado (`pending`,
  `failed`, `conflict`).
- **`SyncEngine`**: envía la cola en orden y después descarga `/api/sync/changes` desde el cursor guardado.
  Error de red, 5xx o 429: espera exponencial de 2 s a 5 min. 409: `conflict` con `currentVersion`. Otro 4xx:
  `failed`. 401: borra la copia y avisa (`onAuthLost`). 410: borra los datos y descarga todo. Lo que aún tiene
  escrituras en la cola no se pisa con lo descargado.
- **`OfflineEventApi`** (extiende `EventApi`): eventos, invitaciones y avisos. Lecturas con red primero (8 s) y
  la copia local si no hay; escrituras directas con `Idempotency-Key` y, sin red, a la copia local y a la cola.
  Creaciones con UUIDv7 del teléfono. Con escrituras en la cola, las nuevas también van a la cola.
- **Cifrado** (`crypto.ts`): AES-GCM 256 por registro, con colección e id como dato autenticado.

En las apps (`apps/web/src/offline-store.ts` y `native.ts`): IndexedDB con los registros cifrados; la clave,
aleatoria por cuenta, en `SecureStorage` (`tueventofun:offline-key:<userId>`). `Runtime` gana `network`
(`@capacitor/network`), `openOfflineStore(userId)` (borra antes la copia de otra cuenta) y `clearOfflineStore()`
(cerrar sesión, 401). En la web quedan sin definir. Las pantallas lo usan desde la fase 8c.

## Sincronización sin conexión (pantallas)

`packages/app/src/offline.tsx` y `sync-review.tsx` (fase 8c), solo en las apps y para organizadores:

- **`useOfflineSync`**: con `openOfflineStore`, abre la copia de la cuenta, crea el `SyncEngine` y cambia la
  `api` del contexto por `OfflineEventApi`. Sincroniza al abrir, al volver la red y al volver a primer plano.
  Un 401 borra la copia (`clearOfflineStore`) y lleva a entrar.
  Abrir y borrar la copia van en fila, y antes de borrar se cierran las conexiones propias a
  IndexedDB: un borrado bloqueado deja en cola toda apertura posterior y la app no arrancaría sin red.
- **Arranque sin red**: si `config()` o `me()` fallan por red, la app arranca con el usuario guardado en la
  copia (`meta/user`) de la cuenta dueña (`offlineOwner`).
- **Aviso fijo** (`OfflineBanner`): sin conexión, cambios pendientes con «Sincronizar ahora» y cambios por
  revisar. **`PendingMark`** en eventos e invitaciones con cambios sin enviar. Una invitación creada sin red no
  tiene enlace: «Compartir» desactivado con su motivo.
- **Correos al sincronizar**: sin red, cancelar un evento o cambiar su fecha o su lugar pide confirmar antes.
- **`/sincronizar`**: conflictos con «Tu versión» y «Versión guardada»; «Quedarme con la mía» reenvía sobre la
  versión del servidor y «Usar la guardada» (o «Descartar este cambio» en un fallo) se queda con lo del servidor.
- **Solo con conexión** (desactivado con «Necesita conexión a internet»): entrar, registrarse, Google,
  contraseña, perfil y foto, subir fotos, comprobar la dirección pública, buscar en el mapa y buscar
  proveedores. En la web, `online` es siempre verdadero y nada de esto aparece.

## Demostración

Al abrir el panel sin sesión y con `DEMO_ENABLED=true`, se crea un usuario temporal exclusivo de ese navegador con tres eventos sintéticos, invitaciones y respuestas de ejemplo. No se comparte una cuenta entre visitantes. Los datos se etiquetan como demostración. Las cuentas de demo con más de siete días se limpian al iniciar el backend. El registro de una cuenta normal siempre comienza vacío.

## Desktop

`packages/app/src/desktop.tsx` proporciona una entrada reutilizable con HashRouter. El host inyecta transporte HTTP, portapapeles, apertura de enlaces y suscripción SSE. El backend y los contratos son los mismos; no hace falta copiar las pantallas ni la lógica de validación.

Un host Electron/Tauri debe usar un transporte autenticado con almacén de cookies propio, persistir credenciales solo en almacenamiento seguro del sistema y permitir exclusivamente el servidor configurado. No exponga un puente HTTP arbitrario al renderer. La cuenta con contraseña funciona con el mismo contrato de sesión. Para Google en desktop utilice un navegador del sistema y un flujo OAuth propio del host con PKCE y retorno validado; el botón GIS web implementado no debe incrustarse como autenticación nativa. No se ha empaquetado ni validado un instalador desktop en este trabajo.

## Límites del alcance actual

No se implementan correo transaccional, recuperación de contraseña, verificación de correo, pagos, asignación de mesas ni lectura de QR; no formaban parte del documento. Correo y WhatsApp abren un mensaje preparado, no envían mensajes automáticamente. Para uso público real aún se requieren dominio accesible, HTTPS, configuración Google y estrategia operativa de copias/retención. El despliegue entregado está ligado a loopback para desarrollo local.
