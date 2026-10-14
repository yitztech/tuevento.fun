# TuEventoFun

Aplicación en español e inglés para organizar celebraciones, crear invitaciones y confirmar asistencia por persona. Fondo blanco, fotografías, verde botella, rosa peonía y amarillo suave. Incluye una demostración aislada y registro real con espacio vacío.

## Abrir

**http://localhost:5187**

El stack usa tres servicios independientes: frontend React/Vite servido por Nginx, backend NestJS/Fastify y PostgreSQL 17.

```bash
bash scripts/setup.sh
```

El script crea `.env` con una contraseña aleatoria de PostgreSQL si no existe, compila, levanta los servicios y espera sus healthchecks. No crea una contraseña ni un usuario organizador predeterminado. El registro está en **http://localhost:5187/registro**.

| Servicio   | Dirección local                  | Con OrbStack                              |
| ---------- | -------------------------------- | ----------------------------------------- |
| Aplicación | http://localhost:5187            | https://tueventofun.orb.local             |
| Salud API  | http://localhost:3087/api/health | https://tueventofun.orb.local/api/health  |
| PostgreSQL | 127.0.0.1:5487                   | postgres.tueventofun.orb.local:5432       |

Los puertos se ligan a loopback y no interfieren con otros proyectos. Los datos están en el volumen `tueventofun_postgres_data`.

Con OrbStack, `https://tueventofun.orb.local` usa su certificado local de confianza; también responden `frontend.tueventofun.orb.local` y `backend.tueventofun.orb.local`. Esos orígenes ya están en `ALLOWED_ORIGINS`. Si cambias el nombre del proyecto Compose, los dominios cambian y debes añadirlos ahí, o los POST darán 403. Para Google, añade `https://tueventofun.orb.local` como origen autorizado. Los enlaces de invitación generados desde estas URL solo se abren en este Mac, igual que con `localhost`.

```bash
docker compose ps
docker compose logs --tail=80 backend
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

El selector Español / English está disponible en el panel, registro, acceso, invitaciones públicas y modo pantalla. La elección se conserva en este dispositivo. Los enlaces de invitación incluyen `?lang=es` o `?lang=en`; esta preferencia tiene prioridad al abrirlos. Fechas, formularios, validaciones, ayudas y notificaciones se muestran en el idioma elegido. El texto escrito por usuarios permanece en su idioma original.

Se utilizan i18next/react-i18next y un catálogo compartido con el backend. Consulta [la guía de traducciones](docs/I18N.md) para ampliar idiomas.

## Google

La integración usa Google Identity Services en la web y `google-auth-library` para verificar la firma, audiencia, expiración y nonce en el backend. Nunca confía en un correo enviado por el frontend.

1. Crea un cliente OAuth **Aplicación web** en tu proyecto de Google y configura la pantalla de consentimiento y los usuarios de prueba cuando aplique.
2. Añade `http://localhost:5187` y `http://127.0.0.1:5187` como orígenes JavaScript autorizados. El flujo GIS con callback usado aquí no requiere URI de redirección.
3. Pon su ID público en `.env`: `GOOGLE_CLIENT_ID=...apps.googleusercontent.com`.
4. Ejecuta `docker compose up -d --force-recreate backend` y recarga la web.

No hace falta un client secret para este flujo. Sin ID configurado, el botón informa que el acceso aún no está habilitado. **La autenticación real con una cuenta Google está pendiente de tus credenciales y de una prueba con tu proyecto.**

Referencias: [botón Google Identity Services](https://developers.google.com/identity/gsi/web/guides/display-button), [verificación de ID tokens](https://developers.google.com/identity/gsi/web/guides/verify-google-id-token), [Fastify en NestJS](https://docs.nestjs.com/techniques/performance).

## Reutilización en desktop

`packages/contracts` comparte validaciones y modelos; `packages/client` ofrece transporte HTTP inyectable; `packages/app` contiene la aplicación React reutilizable. Hay una entrada `DesktopApp` con HashRouter en `packages/app/src/desktop.tsx`.

El host desktop debe inyectar un `Runtime` con el servidor, transporte autenticado, portapapeles, apertura segura de enlaces y suscripción a cambios. La entrada web es un ejemplo operativo. Consulta [la arquitectura](docs/ARCHITECTURE.md) para las fronteras y el tratamiento de Google en desktop. La entrega permite integrar un host Electron/Tauri, pero no incluye ni afirma haber probado un instalador nativo.

## Desarrollo y verificación

Node 22.12+ y Docker Compose v2.

```bash
npm ci
npm run build
npm run typecheck
npm test
npm run test:api
npx playwright install chromium
npm run test:browser
npm run test:landing
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

Para editar el frontend con Vite y conservar backend/base de datos en Docker:

```bash
docker compose stop frontend
npm run dev
```

Vite escucha en 5187 y hace proxy al backend en 3087. Al terminar, detén Vite y ejecuta `docker compose start frontend`. No ejecutes ambos frontends en el mismo puerto.

La matriz y evidencia de QA están en [docs/QA.md](docs/QA.md) y `qa-artifacts/`. No son prueba de despliegue público, de Google configurado ni de un dispositivo Smart TV físico.

La descripción de captación y sus rutas están en [docs/LANDING.md](docs/LANDING.md); su revisión visual independiente, en [docs/LANDING-DESIGN-REVIEW.md](docs/LANDING-DESIGN-REVIEW.md).

## Para salir de localhost

Configura una URL pública con HTTPS, `ALLOWED_ORIGINS` y `COOKIE_SECURE=true`. Desactiva la demo con `DEMO_ENABLED=false` si no la quieres publicada. Los enlaces compartidos actualmente apuntan a la dirección desde la que abres la web; `localhost` no es accesible desde el teléfono de un invitado. Revisa backups, retención y operación antes de abrir el servicio a terceros.

[Arquitectura y límites](docs/ARCHITECTURE.md) · [Procedencia de imágenes](docs/ASSETS.md) · [Diseño](DESIGN.md)

## Apps Android/iOS, administración y releases

Las apps comparten React y API con web. Nuevo panel protegido `/administracion`, catálogo `/descargas`, paleta azul tinta y workflows `.github/workflows/`. Consulta [MOBILE-CICD.md](docs/MOBILE-CICD.md) para variables, secrets, rol dueño, builds, firma y publicación. No hay dominio, repositorio remoto ni credenciales de firma definidos; no hay releases públicas todavía.
