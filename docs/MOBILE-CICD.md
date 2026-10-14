# Android, iOS, métricas y publicación

La app reutiliza `packages/app` (pantallas React ES/EN), `packages/contracts` (Zod), `packages/client` y el mismo Nest/Fastify/PostgreSQL. Capacitor empaqueta recursos compilados en `apps/web/android` y `apps/web/ios`; no descarga código remoto. El adaptador nativo usa HTTP/cookies del sistema, portapapeles y navegador del sistema. Las notificaciones de datos usan el polling compartido de 30 segundos; no son notificaciones push.

## Entornos y cuentas

`VITE_PUBLIC_ORIGIN` debe contener el origen HTTPS real de la web y la API al compilar; en los workflows sale de la variable `SITE_URL` de la plataforma (dominio principal). No contiene secretos. La app nativa usa ese único dominio y, por tanto, su idioma. `MOBILE_APP_ID` por defecto es `com.tueventofun.app`; confirma que sea tu identificador registrado antes de publicar. `VITE_APP_VERSION`, `APP_VERSION` y `BUILD_NUMBER` versionan los recursos y paquetes; la compilación toma el número creciente de GitHub Actions. No reinicies ese contador ni publiques un número menor al de las tiendas.

La app inicia con acceso/registro, conserva la sesión mediante cookies nativas y comparte la misma cuenta con web. Google abre el acceso web en el navegador del sistema y devuelve un código de dos minutos ligado a PKCE SHA-256. El regreso a la app usa **App Links / Universal Links verificados** en `https://<host de VITE_PUBLIC_ORIGIN>/app-link/auth?code=…`; el esquema propio `tueventofun://` se retiró porque cualquier app podía registrarlo y recibir el código. El código es de un solo uso, no expone el token de sesión y se entrega solo tras pulsar «Conectar mi app» y después «Abrir TuEventoFun». Requiere configurar el client ID web de Google y su origen autorizado. El login real de Google y el regreso a la app deben validarse en dispositivos antes de distribuir.

Desarrollo (`compose.yml`, local) y producción (`compose.prod.yml`, desplegado por Coolify desde `deploy.yml`) son configuraciones separadas con los mismos servicios (`gateway`, `web`, `api`, `postgres`): demo activa y cookies sin `Secure` en desarrollo; demo desactivada y `COOKIE_SECURE=true` en producción. En producción el único punto de entrada es Traefik de la plataforma hacia el `gateway`. El gateway solo acepta `X-Forwarded-For` si llega de `TRUSTED_PROXY_CIDR` (la subred de Traefik) y lo **sobrescribe** con la IP real antes de pasarlo a la API, que a su vez solo confía en el gateway. Si `TRUSTED_PROXY_CIDR` no es la subred correcta, todos los usuarios comparten la IP de Traefik y el límite de peticiones.

## Desarrollo

```sh
npm ci
npm run build
VITE_PUBLIC_ORIGIN=https://TU-DOMINIO npm run build -w @tuevento/web
cd apps/web
npx cap sync
npx cap open android # o: npx cap open ios
```

Android requiere JDK 21 y SDK 36; iOS, macOS/Xcode y una cuenta Apple Developer para distribución. Los directorios nativos se versionan; `dist`, claves, certificados, paquetes y archivos locales están ignorados. `scripts/native-assets.mjs` produce los iconos nativos a partir del favicon original del proyecto.

## Métricas y dueño

`/administracion` solo aparece para usuarios con `users.is_owner=true`; todos los endpoints comprueban el rol en servidor. Registrarse nunca concede el rol. No existe una contraseña administrativa predeterminada.

Registra primero la cuenta del dueño y asigna el rol explícitamente:

```sh
DATABASE_URL='URL-PRIVADA-DE-LA-BD' node scripts/set-owner.mjs correo-del-dueno
```

No publiques la URL de base de datos ni la guardes en el repositorio. Alternativamente ejecuta una actualización parametrizada desde la consola administrativa de tu entorno. El rol se refleja al recargar la sesión.

- Visitantes únicos: identificador aleatorio local por navegador/instalación. Borrar almacenamiento puede volver a contarlos.
- Visitas: una por ruta pública relevante, pestaña y día UTC; reintentos usan el mismo UUID. Solo se reciben `landing`, `downloads`, `app`; nunca tokens de invitación ni URLs completas.
- Registros/accesos: se generan en servidor después del éxito; demos excluidas. Primer acceso Google registra creación y acceso.
- Descargas: clics en enlaces, no instalaciones verificadas.
- Plataforma: `web`, `android`, `ios`, declarada por el cliente y normalizada; sirve para analítica, nunca para autorización. Sesiones guardan plataforma y versión; usuarios, plataforma de registro.
- Periodos 7/30/90 días, límites de fecha UTC, tablas por cliente y día. No se reconstruye actividad anterior. Retención de eventos de 90 días, depurada al arrancar la API y cada hora. No se guardan IP, UA, contactos o rutas privadas en `activity`.

## Descargas

`/descargas` muestra solo filas publicadas en el catálogo. Sin publicación presenta un estado honesto y ofrece la aplicación web. Android admite APK directo con SHA-256 o Google Play. iOS admite TestFlight o App Store; subir un IPA a GitHub no permite instalación pública en iPhone. La prueba externa de TestFlight puede requerir revisión de Apple: https://developer.apple.com/help/app-store-connect/test-a-beta-version/testflight-overview/

Publicación: `POST /api/releases` exige `Authorization: Bearer RELEASE_PUBLISH_TOKEN`, mínimo 32 caracteres, Zod, HTTPS y lista de hosts permitidos. Es independiente de sesiones del dueño. El endpoint es idempotente por plataforma/canal/build. Se selecciona el build mayor por canal. No coloques este secreto en variables `VITE_*`.

## GitHub Actions

El repositorio remoto es `yitztech/tuevento.fun`. Los workflows usan Node 24 y acciones vigentes; validados con `actionlint`.

| Workflow | Función |
|---|---|
| `ci.yml` | Build, tipos, contratos, API/plataforma y navegador con Compose aislado en runner |
| `deploy.yml` | En push a `main`: pruebas, imágenes `gateway`, `web`, `api` y `postgres` en GHCR (`:main` y `:<sha>`), webhook de Coolify en el entorno `production` y espera a que `/version.json` sirva el commit en los dos dominios |
| `mobile.yml` | Manual: APK firmado/AAB y GitHub Release; iOS archive/export y carga a App Store Connect |
| `catalog.yml` | Publica enlace aprobado de TestFlight o tienda después de revisión/procesamiento |

El entorno `production` (secretos `COOLIFY_WEBHOOK` y `COOLIFY_TOKEN`, variables `SITE_URL` y `SITE_URL_EN`) lo crea y rellena la plataforma, y solo acepta despliegues desde `main`. Configura `mobile-production` con las protecciones deseadas. Ningún archivo contiene credenciales.

### Variables

- Plataforma: `SITE_URL` (origen HTTPS principal; lo usan `mobile.yml` y `catalog.yml`) y `SITE_URL_EN`.
- Repositorio (públicas, se hornean en la imagen de la API para `/.well-known/*`): `ANDROID_CERT_SHA256`, `APPLE_TEAM_ID`, `MOBILE_APP_ID`. `APPLE_TEAM_ID` y `MOBILE_APP_ID` también los usa `mobile.yml`.

### Secrets

- Despliegue: `COOLIFY_WEBHOOK`, `COOLIFY_TOKEN` (los pone la plataforma).
- Compartido API/publicación: `RELEASE_PUBLISH_TOKEN` (lo genera la plataforma y lo pasa para este secreto).
- Android: `ANDROID_KEYSTORE_BASE64`, `ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_ALIAS`, `ANDROID_KEY_PASSWORD`. Conserva la misma clave en cada actualización.
- iOS: `IOS_CERTIFICATE_BASE64` (P12 de distribución), `IOS_CERTIFICATE_PASSWORD`, `IOS_PROFILE_BASE64`, `KEYCHAIN_PASSWORD` (temporal), `ASC_KEY_ID`, `ASC_ISSUER_ID`, `ASC_PRIVATE_KEY` (P8).

### Servidor

Lo opera la plataforma: Coolify lee `compose.prod.yml`, descarga las imágenes de GHCR y pone los dominios y certificados con Traefik. Las variables (`POSTGRES_PASSWORD`, `TRUSTED_PROXY_CIDR`, `SITE_URL_*`, `UMAMI_*`, `RELEASE_PUBLISH_TOKEN`, `GOOGLE_CLIENT_ID`) las pasa la plataforma; ver la tabla del README. El backup de PostgreSQL también es de la plataforma. Los workflows no crean servidores, DNS, TLS ni claves de firma.

La descarga directa de GitHub Release debe ser pública: el workflow comprueba la URL sin autenticación antes de añadirla al catálogo. Si el repositorio es privado, publica el APK en tu host/CDN permitido y usa el endpoint desde un workflow adaptado; no expongas un token GitHub al visitante. El AAB queda para publicación en Play Console; no se automatiza el envío a Google Play en esta versión. iOS se carga para procesamiento, no se declara aprobado; el enlace se habilita con `catalog.yml` cuando realmente esté disponible.

## App Links (verificación de dominio)

Para que Android e iOS abran `/app-link/auth` en la app, el dominio debe publicar los archivos de asociación. La API los sirve, y el gateway los expone en los dos dominios (`tuevento.fun` y `yourevent.fun`). Los valores no son secretos ni variables de la plataforma: son **variables del repositorio** que `deploy.yml` hornea en la imagen de la API como build-args, así que cambiarlos requiere un nuevo despliegue:

- `ANDROID_CERT_SHA256`: huella SHA-256 del certificado de firma de la app Android, formato `AA:BB:…` (32 pares). Admite varias separadas por comas: la de la clave propia (APK directo de GitHub Releases) y, si se publica en Google Play con Play App Signing, la de la clave de firma que muestra Play Console (Integridad de la app).
- `APPLE_TEAM_ID`: Team ID de 10 caracteres del Apple Developer.
- `MOBILE_APP_ID`: el mismo bundle/applicationId de los builds (por defecto `com.tueventofun.app`).
- Build iOS: el workflow fija `APP_LINK_HOST` desde `VITE_PUBLIC_ORIGIN` y firma con el entitlement `applinks:`. El perfil de distribución debe tener activada la capacidad **Associated Domains** en el portal de Apple; sin ello, la firma falla o el enlace no se abre.
- Comprobaciones: `https://<dominio>/.well-known/assetlinks.json` y `https://<dominio>/.well-known/apple-app-site-association` responden 200 JSON sin redirección. En Android, `adb shell pm get-app-links com.tueventofun.app` debe mostrar `verified`.
- Hasta que estén configurados, los `.well-known` responden 404 y la conexión móvil no funciona en dispositivos; esa es la forma segura de fallar.

## Límites de entrega

No hay publicación de tiendas ni release firmada sin las credenciales del propietario. Una compilación local de prueba no acredita login Google, instalación física, aprobación de tienda o despliegue remoto. Antes de enviar a revisión deben completarse la ficha, política de privacidad, declaraciones de datos y requisitos de cuentas de las tiendas para el producto definitivo.

Estado confirmado por el propietario durante esta entrega: repositorio, dominio y cuenta dueña todavía no definidos. Se dejan campos sin credenciales y catálogo vacío. Los binarios locales de QA se encuentran en `apps/web/android/app/build/outputs/apk/debug/app-debug.apk` y `/tmp/tuevento-ios-build/Build/Products/Debug-iphonesimulator/App.app`; son pruebas de compilación y no contienen un origen de producción configurado, por lo que no deben distribuirse a clientes. Los workflows reconstruyen con el origen y firma reales.
