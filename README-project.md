# TuEventoFun

Aplicación en español e inglés para organizar celebraciones, crear invitaciones y confirmar asistencia por persona. Fondo blanco, fotografías, verde botella, rosa peonía y amarillo suave. Incluye una demostración aislada y registro real con espacio vacío.

## Abrir

**http://tuevento.localhost:5187** (español) · **http://yourevent.localhost:5187** (inglés)

El stack usa cuatro servicios, con los mismos nombres en desarrollo (`compose.yml`) y en producción (`compose.prod.yml`): `gateway` (Nginx de entrada: reparte `/api/` y `/.well-known/` a la API y el resto a la web; listo para cachear el frontend), `web` (la SPA React/Vite: idioma por dominio, `canonical`/`hreflang`, robots, sitemap y cabeceras de seguridad), `api` (NestJS/Fastify) y `postgres` (PostgreSQL 18). En desarrollo se suma `mailpit`, que atrapa los correos.

```bash
bash scripts/setup.sh
```

El script crea `.env` con una contraseña aleatoria de PostgreSQL (`POSTGRES_PASSWORD`) si no existe, compila, levanta los servicios y espera sus healthchecks. Si tu `.env` es anterior y usa `DB_PASSWORD`, la renombra. No crea un usuario organizador predeterminado. El registro está en **http://tuevento.localhost:5187/registro**.

| Servicio                  | Dirección local                                |
| ------------------------- | ---------------------------------------------- |
| Aplicación (es)           | http://tuevento.localhost:5187                 |
| Aplicación (en)           | http://yourevent.localhost:5187                |
| Aplicación (pt, de, fr)   | http://yourevent.localhost:5187/pt, /de, /fr   |
| Panel de administración   | http://admin.tuevento.localhost:5187           |
| Acceso con Google (es)    | http://localhost:5187                          |
| Salud del gateway         | http://localhost:5187/healthz                  |
| Salud API                 | http://localhost:3087/api/health               |
| PostgreSQL                | 127.0.0.1:5487                                 |
| Correos (Mailpit)         | http://127.0.0.1:8026                          |

Los puertos se ligan a loopback y no interfieren con otros proyectos. Los datos están en el volumen `tueventofun_postgres_data`. Si tenías un volumen de PostgreSQL 17, no sirve para la 18: bórralo (`docker compose down -v`, borra los datos) o migra los datos con `pg_dump`.

Un idioma por dominio, como `tuevento.fun` y `yourevent.fun` en producción: `tuevento.localhost` (español) y `yourevent.localhost` (inglés), los dos en el puerto 5187. `localhost:5187` también sirve el español. Los navegadores resuelven cualquier `*.localhost` a este Mac sin DNS ni certificados, y lo tratan como origen seguro aunque vaya por `http`. Esos orígenes ya están en `ALLOWED_ORIGINS`; si añades otro, ponlo ahí o los POST darán 403. Cualquier otro Host se sirve en español. Los enlaces de invitación generados en local solo se abren en este Mac.

```bash
docker compose ps
docker compose logs --tail=80 api
docker compose up -d --build --wait   # Aplicar cambios
docker compose stop                 # Detener conservando datos
docker compose start                # Volver a arrancar
```

## Landing de captación

La entrada `/` presenta TuEventoFun en español e inglés con fotografías, llamadas al registro, seis diseños interactivos, un ejemplo familiar de RSVP y preguntas frecuentes. El panel está en `/app`; si no hay sesión y la demo está habilitada, se crea una demostración aislada al entrar allí, no al visitar la landing. El diseño elegido se conserva en el editor después del registro o inicio de sesión. Los CTA generales abren el editor para crear el primer evento.

## Qué puedes hacer

- Registrarte con nombre, apellidos, teléfono, correo, usuario, contraseña y avatar/logo; iniciar y cerrar sesión; editar el perfil.
- Crear y editar múltiples eventos con fecha, hora, zona horaria, ubicación e indicaciones. Archivar, reactivar o eliminar.
- Elegir entre Elegante Dorado, Fiesta Neón, Tropical, Minimalista, Bodas Florales e Infantil, con vista previa inmediata.
- Añadir invitaciones individuales o familiares; crear, editar y eliminar integrantes adultos o niños y sus notas privadas.
- Copiar cada enlace privado y abrir mensajes preparados en WhatsApp o el cliente de correo.
- Responder sin registro con aceptado, rechazado o en espera, individualmente por integrante, y modificar la respuesta.
- Consultar métricas por persona y edad, filtrar invitados y recibir notificaciones por SSE. Marcar alertas como leídas.
- Usar la interfaz móvil/tablet y abrir el modo pantalla de un evento para monitores grandes.

Los eventos, nombres y lugares de la demo son sintéticos. Cada navegador obtiene su propio espacio temporal. Las cuentas normales no heredan datos de ejemplo.

## Idiomas

`https://tuevento.fun` en español y `https://yourevent.fun` en inglés, con portugués, alemán y francés en `https://yourevent.fun/pt`, `/de` y `/fr`. El idioma lo deciden el Host y ese prefijo (no `?lang=` ni `Accept-Language`); un Host desconocido usa español. El gateway lo pone en `<html lang>`, añade `canonical` y `hreflang` (es, en, pt, de, fr, x-default) hacia la página equivalente en cada idioma y sirve `robots.txt` y `sitemap.xml` propios de cada dominio. Entre inglés, portugués, alemán y francés se cambia sin recargar; el español se ofrece con un enlace a su dominio. Nunca se redirige por el idioma del navegador: en la primera visita solo se propone. Las rutas son iguales en todos los idiomas salvo las legales (`/privacidad`, `/privacy`, `/pt/privacidade`, `/de/datenschutz`, `/fr/confidentialite` y sus equivalentes de condiciones). Las sesiones son de cada dominio. Fechas, formularios, validaciones, ayudas y notificaciones se muestran en el idioma del dominio. El texto escrito por usuarios permanece en su idioma original.

Se utilizan i18next/react-i18next y un catálogo compartido con el backend. Consulta [la guía de traducciones](docs/I18N.md) para ampliar idiomas.

## Google

La integración usa Google Identity Services en la web y `google-auth-library` para verificar la firma, audiencia, expiración y nonce en el backend. Nunca confía en un correo enviado por el frontend.

1. Crea un cliente OAuth **Aplicación web** en tu proyecto de Google y configura la pantalla de consentimiento y los usuarios de prueba cuando aplique.
2. Añade como orígenes JavaScript autorizados los dos dominios de producción (`https://tuevento.fun`, `https://yourevent.fun`) y en local `http://localhost:5187`. Google no admite subdominios de `localhost` (`tuevento.localhost`) ni dominios sin sufijo público: en local, el acceso con Google se prueba en `http://localhost:5187` (español). Para probarlo en inglés, pon en `.env` `SITE_URL_EN=http://127.0.0.1:5187`, añade ese origen en Google y recrea `api`, `web` y `gateway`. No hacen falta URI de redirección: el botón abre un popup y la app móvil reutiliza ese acceso web. La CSP del gateway ya admite Google Identity Services.
3. Pon su ID público en `.env`: `GOOGLE_CLIENT_ID=...apps.googleusercontent.com`. En producción lo pasa la plataforma.
4. Ejecuta `docker compose up -d --force-recreate api` y recarga la web.

No hace falta un client secret para este flujo. Sin ID configurado, el botón informa que el acceso aún no está habilitado. **La autenticación real con una cuenta Google está pendiente de tus credenciales y de una prueba con tu proyecto.**

Referencias: [botón Google Identity Services](https://developers.google.com/identity/gsi/web/guides/display-button), [verificación de ID tokens](https://developers.google.com/identity/gsi/web/guides/verify-google-id-token), [Fastify en NestJS](https://docs.nestjs.com/techniques/performance).

## Reutilización en desktop

`packages/contracts` comparte validaciones y modelos; `packages/client` ofrece transporte HTTP inyectable; `packages/app` contiene la aplicación React reutilizable. Hay una entrada `DesktopApp` con HashRouter en `packages/app/src/desktop.tsx`.

El host desktop debe inyectar un `Runtime` con el servidor, transporte autenticado, portapapeles, apertura segura de enlaces y suscripción a cambios. La entrada web es un ejemplo operativo. Consulta [la arquitectura](docs/ARCHITECTURE.md) para las fronteras y el tratamiento de Google en desktop. La entrega permite integrar un host Electron/Tauri, pero no incluye ni afirma haber probado un instalador nativo.

## Desarrollo y verificación

Node 24 (LTS activa) y Docker Compose v2.

```bash
npm ci
npm run build
npm run typecheck
npm test
npm run test:api
npx playwright install chromium
npm run test:browser
npm run test:landing
npm run test:password
```

`test:api` crea usuarios de prueba con credenciales aleatorias en memoria, ejerce los endpoints y limpia sus propias cuentas al terminar. Apunta por defecto al backend local. `TEST_API_URL` permite cambiar el destino, pero en ese caso no ejecuta limpieza directa de PostgreSQL.

`test:browser` ejecuta el recorrido completo ES/EN, captura escritorio/móvil/tablet/TV y elimina la cuenta que creó al finalizar en localhost. Usa `HEADED=1 npm run test:browser` para ver el navegador. Las capturas quedan en `qa-artifacts/`.

Para probar a través del gateway (como en producción) en lugar del backend directo:

```bash
TEST_API_URL=http://localhost:5187/api npm run test:api
TEST_WEB_URL=http://localhost:5187 npm run test:browser
```

Con `TEST_WEB_URL`, `test:browser` no borra la cuenta de prueba que crea.

Para editar la web con Vite y conservar API y base de datos en Docker:

```bash
docker compose stop gateway web
npm run dev
```

Vite escucha en 5187 y hace proxy a la API en 3087. Sin `gateway` y `web` no hay idioma por dominio (siempre español), `canonical`/`hreflang`, `robots.txt` ni `sitemap.xml`. Al terminar, detén Vite y ejecuta `docker compose start web gateway`. No ejecutes Vite y el gateway en el mismo puerto. Normalmente no hace falta: `docker compose up --watch` ya recarga la web en caliente dentro del contenedor `web`.

La matriz y evidencia de QA están en [docs/QA.md](docs/QA.md); las capturas de `qa-artifacts/` se quedan en local y no se suben al repositorio (pueden tener datos personales). No son prueba de despliegue público, de Google configurado ni de un dispositivo Smart TV físico.

La descripción de captación y sus rutas están en [docs/LANDING.md](docs/LANDING.md); su revisión visual independiente, en [docs/LANDING-DESIGN-REVIEW.md](docs/LANDING-DESIGN-REVIEW.md).

## Producción (plataforma yitztech)

Se despliega en modo imágenes: `.github/workflows/deploy.yml` prueba (Node 24), publica `ghcr.io/yitztech/tuevento.fun-gateway`, `ghcr.io/yitztech/tuevento.fun-web`, `ghcr.io/yitztech/tuevento.fun-api` y `ghcr.io/yitztech/tuevento.fun-postgres` con las etiquetas `:main` y `:<sha>`, pide el despliegue a Coolify (POST al webhook con `Authorization: Bearer`) y espera hasta 10 minutos a que `SITE_URL/version.json` y `SITE_URL_EN/version.json` devuelvan el commit. Se dispara en push a `main` (salvo cambios solo en `.md`) y con `workflow_dispatch`, y solo publica y despliega desde `main`. El servidor nunca compila.

`compose.prod.yml` define `gateway` (único servicio con dominio, puerto 80, `/healthz` sin depender de los demás; reparte a `web` y `api`), `web` (Nginx en el puerto 8080 con la SPA; sirve `/version.json` con el commit, que el gateway expone), `api` (read_only, tmpfs /tmp, mem_limit 256m) y `postgres` (red `backend` interna, PostgreSQL 18.6 con postgresql.conf ajustado y rol `api`). Ningún servicio publica puertos ni monta archivos del repositorio. Todos llevan `mem_limit` y `cpus` (64m, 64m, 256m y 512m), `restart: unless-stopped`, `no-new-privileges`, `cap_drop: [ALL]` con las capacidades mínimas y logs `json-file` rotados (10m × 3). La plataforma hace el backup de PostgreSQL.

Variables que pasa la plataforma (no se usan otros nombres):

| Variable | Servicio | Uso |
| --- | --- | --- |
| `IMAGE_PREFIX`, `IMAGE_TAG` | todos | Imágenes (`IMAGE_TAG` por defecto `main`) |
| `TRUSTED_PROXY_CIDR` | gateway | Subred de Traefik: solo desde ella se acepta `X-Forwarded-For` |
| `SITE_URL_ES`, `SITE_URL_EN` | web, api | Origen de cada idioma; también forman `ALLOWED_ORIGINS` |
| `UMAMI_SCRIPT_URL`, `UMAMI_WEBSITE_ID` | web | Analítica (vacío = sin analítica) |
| `UMAMI_API_URL`, `UMAMI_API_USER`, `UMAMI_API_PASSWORD` | admin | API de Umami con un usuario de solo lectura, para los visitantes por país del panel. `UMAMI_WEBSITE_ID` (admin) toma por defecto el sitio único de los dos dominios |
| `POSTGRES_PASSWORD` | postgres | Contraseña de superusuario `tuevento` |
| `API_DB_PASSWORD` | api, postgres | Contraseña del rol `api` con el que conecta el backend |
| `ADMIN_DB_PASSWORD` | admin, postgres | Contraseña del rol de solo lectura `admin_ro` del panel |
| `SEARCH_DB_PASSWORD` | search, postgres | Contraseña del rol `search_ro` del servicio de búsqueda (solo lee `provider_search`) |
| `ADMIN_USER`, `ADMIN_PASSWORD_HASH` | admin | Usuario del panel y hash scrypt de su contraseña (ver [Panel de administración](#panel-de-administración)) |
| `ADMIN_HOST` | gateway | Subdominio del panel (por defecto `admin.tuevento.fun`) |
| `RELEASE_PUBLISH_TOKEN` | api | Lo genera la plataforma; también es el secreto de GitHub del catálogo |
| `APP_SECRET` | api | 32+ caracteres aleatorios (`openssl rand -base64 48`). Cifra los enlaces de invitación guardados y firma los enlaces de los correos; sin ella la API no arranca. Si cambia, los enlaces de invitación existentes dejan de abrir |
| `GOOGLE_CLIENT_ID` | api | Opcional, cuando exista el cliente OAuth |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE` | api | Servidor SMTP común a los dos idiomas |
| `SMTP_USER`, `SMTP_PASSWORD`, `MAIL_FROM` | api | Remitente en español (`no-reply@tuevento.fun`) |
| `SMTP_USER_EN`, `SMTP_PASSWORD_EN`, `MAIL_FROM_EN` | api | Remitente en inglés (`no-reply@yourevent.fun`); sin él, el inglés sale del remitente español |
| `LISTMONK_URL`, `LISTMONK_LIST_UUID` | api | Newsletter en español (Listmonk en `news.tuevento.fun`) |
| `LISTMONK_URL_EN`, `LISTMONK_LIST_UUID_EN` | api | Newsletter en inglés (Listmonk en `news.yourevent.fun`) |

### Correos por idioma

El idioma lo decide el dominio por el que entra el usuario, igual que la web:

- **Recuperar contraseña** (`/recuperar-contrasena` → correo → `/nueva-contrasena?token=…`): el correo sale en el idioma del dominio donde se pidió, desde su remitente (`MAIL_FROM` o `MAIL_FROM_EN`) y con el enlace a ese mismo dominio. El enlace es de un solo uso, caduca en 60 minutos y solo se guarda su hash. Al cambiar la contraseña se cierran todas las sesiones y se envía un aviso. La respuesta es idéntica exista o no la cuenta, con límites por IP y por correo.
- **Idioma de la cuenta**: se actualiza con el dominio por el que el usuario inicia sesión.
- **Newsletter**: el alta va a la lista del Listmonk de su idioma mediante la suscripción pública (`/api/public/subscription`, sin credenciales). Las listas deben ser públicas y de doble confirmación; Listmonk envía la confirmación y las campañas desde su dominio. También se guarda una copia en `newsletter_subscribers`.
- Sin SMTP configurado, la API no envía correos: en desarrollo los escribe en el log; en producción solo avisa. `compose.yml` y `compose.ci.yml` usan Mailpit, como micitaentiempo: interfaz en `http://127.0.0.1:8026` (8026 para no chocar con el Mailpit de micitaentiempo en 8025) y SMTP con usuario `dev`, para ejercitar también la autenticación.

### Migración de base de datos en producción (Coolify)
El rol `api` no es superusuario ni dueño de la base de datos. Para volúmenes existentes creados antes de este cambio:
1. Hacer un respaldo de la base de datos en Coolify.
2. Añadir la variable `API_DB_PASSWORD` en el panel de Coolify.
3. En el contenedor PostgreSQL de producción, ejecutar antes o durante la actualización:
```bash
docker compose exec -T postgres psql -U tuevento -d tueventofun -c "
DO \$\$ BEGIN
  IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'api') THEN
    CREATE ROLE api LOGIN PASSWORD '\$API_DB_PASSWORD';
  ELSE
    ALTER ROLE api WITH PASSWORD '\$API_DB_PASSWORD';
  END IF;
END \$\$;
GRANT CONNECT ON DATABASE tueventofun TO api;
GRANT USAGE, CREATE ON SCHEMA public TO api;
DO \$\$ DECLARE r RECORD; BEGIN
  FOR r IN (SELECT tablename FROM pg_tables WHERE schemaname = 'public') LOOP
    EXECUTE 'ALTER TABLE public.' || quote_ident(r.tablename) || ' OWNER TO api';
  END LOOP;
  FOR r IN (SELECT sequence_name FROM information_schema.sequences WHERE sequence_schema = 'public') LOOP
    EXECUTE 'ALTER SEQUENCE public.' || quote_ident(r.sequence_name) || ' OWNER TO api';
  END LOOP;
END \$\$;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO api;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO api;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO api;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO api;
"
```

Para App Links, la imagen de la API hornea `ANDROID_CERT_SHA256` (una o varias huellas separadas por comas), `APPLE_TEAM_ID` y `MOBILE_APP_ID` como build-args desde las **variables del repositorio** de GitHub (son públicos; ver [MOBILE-CICD.md](docs/MOBILE-CICD.md)).

Comprobar antes de un PR:

```bash
docker compose -f compose.prod.yml -f compose.ci.yml --env-file .env.ci up -d --build --wait
grep -c mem_limit compose.prod.yml    # 3, uno por servicio
grep -n "ports:" compose.prod.yml     # sin salida
curl localhost:5187/version.json      # {"revision":"ci"}
curl localhost:5187/healthz           # ok
```

Los enlaces compartidos apuntan al dominio desde el que se crean; `localhost` no es accesible desde el teléfono de un invitado.

[Arquitectura y límites](docs/ARCHITECTURE.md) · [Procedencia de imágenes](docs/ASSETS.md) · [Diseño](DESIGN.md)

## Panel de administración

`services/admin` (`apps/admin`): panel del administrador del sitio, en `ADMIN_HOST`. Node sin framework y una interfaz en Angular 22 (componentes independientes, signals y sin zone.js; código en `apps/admin/src/web`, se compila con `npm run build -w @tuevento/admin` y la imagen la compila en su propia etapa) servidos por el mismo contenedor, responsivo para el móvil. Solo en español: el panel no está traducido a propósito. Muestra usuarios conectados (visitantes con actividad en los últimos 5 minutos), altas, sesiones, eventos, invitaciones y confirmaciones, actividad diaria y páginas más visitadas. Solo lee la base con el rol `admin_ro` (sin contraseñas, tokens ni teléfonos). El país de cada visita no se guarda en la base: los visitantes por país salen de Umami (`https://stats.yunitztech.com`, un solo sitio para los dos dominios, datos desde el 19 de octubre de 2026). El panel entra con `POST /api/auth/login`, pide `GET /api/websites/<id>/metrics?type=country&startAt&endAt` (milisegundos) y guarda el resultado 5 minutos. La API de Umami solo responde al servidor de producción: en local, sin esas variables, el panel indica que Umami no está configurado.

Puesta en marcha en producción:

1. Generar el hash de la contraseña sin dejarla en el historial de la shell: `printf '%s' 'contraseña' | npm run hash-password -w @tuevento/admin`. Sale con el formato `scrypt:N:r:p:sal:hash`, sin `$`, para que Docker Compose y Coolify no lo interpreten como variable y lo recorten. Un hash del formato anterior (con `$`) se acepta, pero en Coolify habría que escribir cada `$` como `$$`: mejor generar uno nuevo.
2. Definir en Coolify `ADMIN_USER`, `ADMIN_PASSWORD_HASH` (el valor entero, sin comillas), `ADMIN_DB_PASSWORD` y `UMAMI_API_URL`, `UMAMI_API_USER`, `UMAMI_API_PASSWORD`, y añadir `ADMIN_HOST` al servicio `gateway` como dominio. Sin estas variables el despliegue se detiene, y con un hash recortado o mal pegado `admin` no arranca y lo dice en su log.
3. Crear el rol de solo lectura en un volumen existente, como el dueño de la base. Se puede repetir (también para cambiar la contraseña): crea el rol si falta, nunca lo borra y deja sus permisos en la lista del script:
```bash
docker compose exec -T postgres psql -v ON_ERROR_STOP=1 -U tuevento -d tueventofun -v admin_pw="$ADMIN_DB_PASSWORD" -v db=tueventofun < services/postgres/sql/admin-role.sql
```
   Antes de hacerlo, el servicio `admin` no puede leer la base (no encuentra el rol). El primer arranque de un volumen nuevo lo crea solo (`services/postgres/initdb/01-admin-role.sh`).
4. Comprobar `https://admin.tuevento.fun/api/health`: 200 `{"status":"ok"}` si el rol entra y tiene sus permisos; 503 `{"status":"error"}` si no (rol sin crear, contraseña distinta o migración 014 sin aplicar). Es la ruta que puede vigilar Uptime Kuma. `/healthz`, la del `healthcheck` de Docker, solo dice que el proceso vive, como pide el contrato de la plataforma.

En local: `docker compose up -d --build admin` y el panel en `http://127.0.0.1:8188` (usuario `admin-dev`, contraseña `admin-dev-password`; solo para desarrollo). Las pruebas: `npm run e2e` (escenarios `@admin`), `npm run test:db` (permisos del rol) y `npm run test -w @tuevento/admin` (contraseñas, sesiones y bloqueo).

## Búsqueda de proveedores

`services/search`: servicio en Go (binario estático sobre `scratch`, sin root, 64 MB) que responde
`GET /api/search/providers` a través del gateway. Lee solo la tabla `provider_search`, que la migración
022 mantiene con triggers en la misma transacción que cada cambio de un perfil, con el rol `search_ro`.
Idiomas, límites, categorías y textos salen de `packages/contracts` (`dist/shared.json`, embebido al compilar).

Parámetros: `q` (100 caracteres), `categories` (separadas por comas), `lat`, `lng` y `radiusKm` (30 por
defecto, 200 como máximo), `sort` (`relevance` o `distance`, que pide `lat` y `lng`), `limit` (20; 50 como máximo) y `cursor`
(el `nextCursor` de la página anterior). Un parámetro desconocido o fuera de rango responde 400 en Problem
Details con el campo. 30 peticiones por IP cada 10 s (`SEARCH_RATE_LIMIT`).

Puesta en marcha en producción, **antes** de desplegar la versión que trae la migración 022 (sin las
extensiones, la migración falla y la API no arranca):

1. Definir en Coolify `SEARCH_DB_PASSWORD` (aleatoria, p. ej. `openssl rand -hex 24`).
2. Crear las extensiones `pg_trgm` y `unaccent` y el rol `search_ro`, como el dueño de la base. Se puede repetir
   (también para cambiar la contraseña). La contraseña no está en el shell del servidor: `read -rs` la pide sin
   mostrarla ni dejarla en el historial, y el script no la imprime:
```bash
read -rs SEARCH_DB_PASSWORD
docker compose exec -T postgres psql -v ON_ERROR_STOP=1 -U tuevento -d tueventofun -v search_pw="$SEARCH_DB_PASSWORD" -v db=tueventofun < services/postgres/sql/search-bootstrap.sql
unset SEARCH_DB_PASSWORD
```
   Un volumen nuevo lo hace solo al arrancar (`services/postgres/initdb/02-search.sh`).
3. Desplegar. Comprobar `https://tuevento.fun/api/search/providers?limit=1`: 200 con `items`.

En local: `docker compose up -d --build search` (en `http://127.0.0.1:3089` directo) y `npm run test:go`.

## Apps Android/iOS, administración y releases

Las apps comparten React y API con web. Nuevo panel protegido `/administracion`, catálogo `/descargas`, paleta azul tinta y workflows `.github/workflows/`. Consulta [MOBILE-CICD.md](docs/MOBILE-CICD.md) para variables, secrets, rol dueño, builds, firma y publicación. No hay dominio, repositorio remoto ni credenciales de firma definidos; no hay releases públicas todavía.
