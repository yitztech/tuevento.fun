# TuEventoFun

Aplicación en español e inglés para organizar celebraciones, crear invitaciones y confirmar asistencia por persona. Fondo blanco, fotografías, verde botella, rosa peonía y amarillo suave. Incluye una demostración aislada y registro real con espacio vacío.

## Abrir

**http://localhost:5187**

El stack usa cuatro servicios, con los mismos nombres en desarrollo (`compose.yml`) y en producción (`compose.prod.yml`): `gateway` (Nginx de entrada: reparte `/api/` y `/.well-known/` a la API y el resto a la web; listo para cachear el frontend), `web` (la SPA React/Vite: idioma por dominio, `canonical`/`hreflang`, robots, sitemap y cabeceras de seguridad), `api` (NestJS/Fastify) y `postgres` (PostgreSQL 18). En desarrollo se suma `mailpit`, que atrapa los correos.

```bash
bash scripts/setup.sh
```

El script crea `.env` con una contraseña aleatoria de PostgreSQL (`POSTGRES_PASSWORD`) si no existe, compila, levanta los servicios y espera sus healthchecks. Si tu `.env` es anterior y usa `DB_PASSWORD`, la renombra. No crea un usuario organizador predeterminado. El registro está en **http://localhost:5187/registro**.

| Servicio            | Dirección local                  | Con OrbStack                                |
| ------------------- | -------------------------------- | ------------------------------------------- |
| Aplicación (es)     | http://localhost:5187            | https://tueventofun.orb.local               |
| Aplicación (en)     | —                                | https://en.tueventofun.orb.local            |
| Salud del gateway   | http://localhost:5187/healthz    | https://tueventofun.orb.local/healthz       |
| Salud API           | http://localhost:3087/api/health | https://tueventofun.orb.local/api/health    |
| PostgreSQL          | 127.0.0.1:5487                   | postgres.tueventofun.orb.local:5432         |
| Correos (Mailpit)   | http://127.0.0.1:8026            | http://mail.tueventofun.orb.local:8025      |

Los puertos se ligan a loopback y no interfieren con otros proyectos. Los datos están en el volumen `tueventofun_postgres_data`. Si tenías un volumen de PostgreSQL 17, no sirve para la 18: bórralo (`docker compose down -v`, borra los datos) o migra los datos con `pg_dump`.

Con OrbStack, el gateway responde en dos dominios con su certificado local de confianza: `tueventofun.orb.local` (español) y `en.tueventofun.orb.local` (inglés), igual que `tuevento.fun` y `yourevent.fun` en producción. También responde `gateway.tueventofun.orb.local`. Esos orígenes ya están en `ALLOWED_ORIGINS`; si cambias el nombre del proyecto Compose o los dominios, añádelos ahí o los POST darán 403. `localhost` es un Host desconocido y se sirve en español. Para Google, añade los dos orígenes de OrbStack como autorizados. Los enlaces de invitación generados desde estas URL solo se abren en este Mac.

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

Un idioma por dominio: `https://tuevento.fun` en español y `https://yourevent.fun` en inglés. El idioma lo decide el Host (no `?lang=`, el navegador ni `Accept-Language`); un Host desconocido usa español. El gateway lo pone en `<html lang>`, añade `canonical` y `hreflang` (es, en, x-default) hacia la página equivalente del otro dominio y sirve `robots.txt` y `sitemap.xml` propios de cada dominio. El otro idioma se ofrece con un enlace a su dominio, nunca con una redirección. Las rutas son iguales en los dos idiomas salvo `/privacidad`↔`/privacy` y `/condiciones`↔`/terms`. Las sesiones son de cada dominio. Fechas, formularios, validaciones, ayudas y notificaciones se muestran en el idioma del dominio. El texto escrito por usuarios permanece en su idioma original.

Se utilizan i18next/react-i18next y un catálogo compartido con el backend. Consulta [la guía de traducciones](docs/I18N.md) para ampliar idiomas.

## Google

La integración usa Google Identity Services en la web y `google-auth-library` para verificar la firma, audiencia, expiración y nonce en el backend. Nunca confía en un correo enviado por el frontend.

1. Crea un cliente OAuth **Aplicación web** en tu proyecto de Google y configura la pantalla de consentimiento y los usuarios de prueba cuando aplique.
2. Añade como orígenes JavaScript autorizados los dos dominios de producción (`https://tuevento.fun`, `https://yourevent.fun`), sus URI de redirección si la plataforma las requiere, y en local `http://localhost:5187` y los dos dominios de OrbStack. La CSP del gateway ya admite Google Identity Services.
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

Para probar contra los dominios de OrbStack, Node necesita su CA local, porque no usa el llavero de macOS (sin ella falla con `SELF_SIGNED_CERT_IN_CHAIN`):

```bash
security find-certificate -c "OrbStack Development Root CA" -p > /tmp/orbstack-ca.pem
export NODE_EXTRA_CA_CERTS=/tmp/orbstack-ca.pem
TEST_API_URL=https://tueventofun.orb.local/api npm run test:api
TEST_WEB_URL=https://tueventofun.orb.local npm run test:browser
```

Con `TEST_WEB_URL`, `test:browser` no borra la cuenta de prueba que crea.

Para editar la web con Vite y conservar API y base de datos en Docker:

```bash
docker compose stop gateway web
npm run dev
```

Vite escucha en 5187 y hace proxy a la API en 3087. Sin `gateway` y `web` no hay idioma por dominio (siempre español), `canonical`/`hreflang`, `robots.txt` ni `sitemap.xml`. Al terminar, detén Vite y ejecuta `docker compose start web gateway`. No ejecutes Vite y el gateway en el mismo puerto. Normalmente no hace falta: `docker compose up --watch` ya recarga la web en caliente dentro del contenedor `web`.

La matriz y evidencia de QA están en [docs/QA.md](docs/QA.md) y `qa-artifacts/`. No son prueba de despliegue público, de Google configurado ni de un dispositivo Smart TV físico.

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
| `POSTGRES_PASSWORD` | postgres | Contraseña de superusuario `tuevento` |
| `API_DB_PASSWORD` | api, postgres | Contraseña del rol `api` con el que conecta el backend |
| `RELEASE_PUBLISH_TOKEN` | api | Lo genera la plataforma; también es el secreto de GitHub del catálogo |
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

## Apps Android/iOS, administración y releases

Las apps comparten React y API con web. Nuevo panel protegido `/administracion`, catálogo `/descargas`, paleta azul tinta y workflows `.github/workflows/`. Consulta [MOBILE-CICD.md](docs/MOBILE-CICD.md) para variables, secrets, rol dueño, builds, firma y publicación. No hay dominio, repositorio remoto ni credenciales de firma definidos; no hay releases públicas todavía.
