# Android, iOS, métricas y publicación

La app reutiliza `packages/app` (pantallas React ES/EN), `packages/contracts` (Zod), `packages/client` y el mismo Nest/Fastify/PostgreSQL. Capacitor empaqueta recursos compilados en `apps/web/android` y `apps/web/ios`; no descarga código remoto. El adaptador nativo usa HTTP/cookies del sistema, portapapeles y navegador del sistema. Las notificaciones de datos usan el polling compartido de 30 segundos; no son notificaciones push.

## Entornos y cuentas

`VITE_PUBLIC_ORIGIN` debe contener el origen HTTPS real del backend/web al compilar. No contiene secretos. `MOBILE_APP_ID` por defecto es `com.tueventofun.app`; confirma que sea tu identificador registrado antes de publicar. `VITE_APP_VERSION`, `APP_VERSION` y `BUILD_NUMBER` versionan los recursos y paquetes; la compilación toma el número creciente de GitHub Actions. No reinicies ese contador ni publiques un número menor al de las tiendas.

La app inicia con acceso/registro, conserva la sesión mediante cookies nativas y comparte la misma cuenta con web. Google abre el acceso web en el navegador del sistema y devuelve un código de dos minutos ligado a PKCE SHA-256. El regreso a la app usa **App Links / Universal Links verificados** en `https://<host de VITE_PUBLIC_ORIGIN>/app-link/auth?code=…`; el esquema propio `tueventofun://` se retiró porque cualquier app podía registrarlo y recibir el código. El código es de un solo uso, no expone el token de sesión y se entrega solo tras pulsar «Conectar mi app» y después «Abrir TuEventoFun». Requiere configurar el client ID web de Google y su origen autorizado. El login real de Google y el regreso a la app deben validarse en dispositivos antes de distribuir.

Desarrollo (`compose.yml`, local) y producción (`compose.production.yml`, desplegado por `deploy.yml`) son configuraciones separadas: demo activa y cookies sin `Secure` en desarrollo; demo desactivada y `COOKIE_SECURE=true` en producción. Producción queda en `127.0.0.1` detrás de un HTTPS externo, que debe **añadir o fijar** `X-Forwarded-For` con la IP del cliente. Si lo elimina, el límite de peticiones vuelve a compartirse entre todos los usuarios. Nginx confía solo en redes privadas (`set_real_ip_from`) y reenvía la IP real a la API.

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
- Periodos 7/30/90 días, límites de fecha UTC, tablas por cliente y día. No se reconstruye actividad anterior. Retención de eventos de 90 días, depurada al arrancar API. No se guardan IP, UA, contactos o rutas privadas en `activity`.

## Descargas

`/descargas` muestra solo filas publicadas en el catálogo. Sin publicación presenta un estado honesto y ofrece la aplicación web. Android admite APK directo con SHA-256 o Google Play. iOS admite TestFlight o App Store; subir un IPA a GitHub no permite instalación pública en iPhone. La prueba externa de TestFlight puede requerir revisión de Apple: https://developer.apple.com/help/app-store-connect/test-a-beta-version/testflight-overview/

Publicación: `POST /api/releases` exige `Authorization: Bearer RELEASE_PUBLISH_TOKEN`, mínimo 32 caracteres, Zod, HTTPS y lista de hosts permitidos. Es independiente de sesiones del dueño. El endpoint es idempotente por plataforma/canal/build. Se selecciona el build mayor por canal. No coloques este secreto en variables `VITE_*`.

## GitHub Actions

El checkout actual no tiene remoto GitHub configurado. Los workflows están escritos; aún no se han ejecutado en GitHub.

| Workflow | Función |
|---|---|
| `ci.yml` | Build, tipos, contratos, API/plataforma y navegador con Compose aislado en runner |
| `deploy.yml` | Imágenes API/web en GHCR por SHA, despliegue SSH al entorno `production`, health check |
| `mobile.yml` | Manual: APK firmado/AAB y GitHub Release; iOS archive/export y carga a App Store Connect |
| `catalog.yml` | Publica enlace aprobado de TestFlight o tienda después de revisión/procesamiento |

Configura environments `production` y `mobile-production` con las protecciones deseadas. Ningún archivo contiene credenciales de tu cuenta.

### Variables

`PUBLIC_ORIGIN` (HTTPS), `MOBILE_APP_ID`, `APPLE_TEAM_ID`, `DEPLOY_HOST`, `DEPLOY_USER`.

### Secrets

- Despliegue: `DEPLOY_SSH_KEY`, `DEPLOY_KNOWN_HOSTS` (clave verificada del host, no aceptación ciega).
- Compartido API/publicación: `RELEASE_PUBLISH_TOKEN`.
- Android: `ANDROID_KEYSTORE_BASE64`, `ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_ALIAS`, `ANDROID_KEY_PASSWORD`. Conserva la misma clave en cada actualización.
- iOS: `IOS_CERTIFICATE_BASE64` (P12 de distribución), `IOS_CERTIFICATE_PASSWORD`, `IOS_PROFILE_BASE64`, `KEYCHAIN_PASSWORD` (temporal), `ASC_KEY_ID`, `ASC_ISSUER_ID`, `ASC_PRIVATE_KEY` (P8).

### Servidor

Prepara `~/tueventofun/.env` con DB_PASSWORD, PUBLIC_ORIGIN, RELEASE_PUBLISH_TOKEN, GOOGLE_CLIENT_ID y opciones de `.env.example`. Instala Docker Compose y configura HTTPS externo hacia `127.0.0.1:5187`; la BD no publica puerto en producción. El usuario SSH debe tener acceso a Docker y autenticación de lectura GHCR si las imágenes son privadas. Configura backups antes de usar datos reales. El workflow no crea servidores, DNS, TLS ni claves de firma.

La descarga directa de GitHub Release debe ser pública: el workflow comprueba la URL sin autenticación antes de añadirla al catálogo. Si el repositorio es privado, publica el APK en tu host/CDN permitido y usa el endpoint desde un workflow adaptado; no expongas un token GitHub al visitante. El AAB queda para publicación en Play Console; no se automatiza el envío a Google Play en esta versión. iOS se carga para procesamiento, no se declara aprobado; el enlace se habilita con `catalog.yml` cuando realmente esté disponible.

## App Links (verificación de dominio)

Para que Android e iOS abran `/app-link/auth` en la app, el dominio debe publicar los archivos de asociación. La API los sirve desde su configuración, sin reconstruir la web:

- `ANDROID_CERT_SHA256`: huella SHA-256 del certificado de firma de la app Android, formato `AA:BB:…` (32 pares). Va en `.env` del servidor.
- `APPLE_TEAM_ID`: Team ID de 10 caracteres del Apple Developer. Va en `.env` del servidor.
- `MOBILE_APP_ID`: el mismo bundle/applicationId de los builds.
- Build iOS: el workflow fija `APP_LINK_HOST` desde `VITE_PUBLIC_ORIGIN` y firma con el entitlement `applinks:`. El perfil de distribución debe tener activada la capacidad **Associated Domains** en el portal de Apple; sin ello, la firma falla o el enlace no se abre.
- Comprobaciones: `https://<dominio>/.well-known/assetlinks.json` y `https://<dominio>/.well-known/apple-app-site-association` responden 200 JSON sin redirección. En Android, `adb shell pm get-app-links com.tueventofun.app` debe mostrar `verified`.
- Hasta que estén configurados, los `.well-known` responden 404 y la conexión móvil no funciona en dispositivos; esa es la forma segura de fallar.

## Límites de entrega

No hay publicación de tiendas ni release firmada sin las credenciales del propietario. Una compilación local de prueba no acredita login Google, instalación física, aprobación de tienda o despliegue remoto. Antes de enviar a revisión deben completarse la ficha, política de privacidad, declaraciones de datos y requisitos de cuentas de las tiendas para el producto definitivo.

Estado confirmado por el propietario durante esta entrega: repositorio, dominio y cuenta dueña todavía no definidos. Se dejan campos sin credenciales y catálogo vacío. Los binarios locales de QA se encuentran en `apps/web/android/app/build/outputs/apk/debug/app-debug.apk` y `/tmp/tuevento-ios-build/Build/Products/Debug-iphonesimulator/App.app`; son pruebas de compilación y no contienen un origen de producción configurado, por lo que no deben distribuirse a clientes. Los workflows reconstruyen con el origen y firma reales.
