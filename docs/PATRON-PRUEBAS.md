# Patrón de pruebas de TuEventoFun (para reutilizarlo en otros proyectos)

Resumen de lo construido y de cómo replicarlo. Todo está en este repositorio; las rutas indican dónde mirar.
Detalle operativo: [TESTS.md](TESTS.md) (qué hay y cómo ejecutarlo) y [E2E.md](E2E.md) (Gherkin y móviles).

## 1. Idea central

**Un comportamiento = un escenario o prueba, en la capa donde se rompe, y un solo comando para todo.**

| Capa | Tecnología | Qué protege | ¿CI? |
|---|---|---|---|
| Unitarias | `node:test` + `tsx`, Zod | Esquemas de validación, límites, versiones de dependencias | sí |
| API (flujos) | Node (`node:http`), cliente propio | Casos de uso completos contra la API real | sí |
| API (endpoints) | ídem | Endpoints restantes, idiomas, validación de entradas | sí |
| API (seguridad) | ídem | Auth, CSRF, IDOR, privilegios, sesión, fuerza bruta, fugas, inyección | sí |
| Base de datos | `node:test` + `pg` | Migraciones, restricciones, cascadas, permisos del rol | solo local |
| E2E web | Playwright + **playwright-bdd** (Gherkin en español) | Comportamiento visible en Chromium | sí |
| E2E móvil Android | Playwright `_android` (WebView por DevTools) | Los mismos escenarios dentro de la app real en el emulador | solo local |
| E2E móvil iOS | **Appium 3** (XCUITest) + WebdriverIO | Los mismos escenarios en el simulador (iPhone/iPad) | solo local |

Por qué la API siempre corre en CI: la consumen varios clientes (web, Android, iOS). Base de datos y móviles
se quedan en local hasta decidir pasarlos, y **siempre se validan primero en local** (regla del proyecto).

## 2. Piezas reutilizables (copiar y adaptar)

### 2.1 Una sola fuente de verdad para los límites de datos
- `packages/contracts/src/index.ts` → `accountLimits` (nombre 50, correo 254, teléfono 20, contraseña 128).
- Se aplica con el **mismo valor** en tres niveles: `maxLength` en el campo (frontend), Zod con mensaje
  traducido (backend) y `CHECK (char_length(col) <= N)` en una migración (base de datos).
- `packages/contracts/src/limits.test.ts` lee las migraciones y **falla si el valor de la base de datos y el
  de `accountLimits` difieren** o si un límite no tiene columna. Las restricciones se añaden `NOT VALID`
  (se exigen en toda escritura nueva sin que un dato antiguo bloquee el arranque).

### 2.2 Coherencia de dependencias (`scripts/check-versions.mjs`)
Falla si un mismo paquete tiene rangos distintos entre workspaces, o si un workspace importa algo que no
declara en su `package.json` (funciona por *hoisting* y rompe en la imagen de producción).

### 2.3 Servicios solo de pruebas que no pueden llegar a producción (`scripts/check-test-only.mjs`)
Un servicio de pruebas (p. ej. `mobile-tls`) vive en `compose.yml` bajo `profiles`, lleva una etiqueta
`tuevento.solo-pruebas` y el script falla si aparece en `compose.prod.yml`, en Dockerfiles o en workflows de despliegue.

### 2.4 Gherkin con Playwright (`tests/e2e`)
- `playwright-bdd`: convierte los `.feature` (`# language: es`, Dado/Cuando/Entonces) en tests de Playwright
  Test; conserva vídeo, captura, traza, informe HTML, reintentos, modo UI y `--headed`.
- `features/` (escenarios, con etiquetas `@smoke @registro @validacion @limites @i18n @api @movil @solo-web @sin-ios`),
  `steps/` (pasos), `support/` (entorno, interfaz `ui`), `scripts/summary.mjs` (resumen por característica y etiqueta).
- **Datos únicos por escenario** (`nuevaCuenta()`): ninguna prueba depende del estado de la base de datos.
- **Evidencia:** captura + vídeo + traza al fallar; `E2E_VIDEO=on` graba siempre.
- **Ritmo humano para mirarlo:** `E2E_SLOWMO`, `E2E_TECLADO`, `E2E_PAUSA` (`npm run e2e:ver`).
- **Interfaz `ui`** (`support/ui-playwright.js` ↔ `ui-ios.js`): los pasos solo conocen `escribir`, `pulsar`,
  `esperarValor`, `esperarUrl`… y cada plataforma la implementa. Así web, Android e iOS comparten `.feature` y pasos.
- **Calentamiento** (`support/calentar.js`): con Vite en modo desarrollo dentro de Docker, el primer arranque
  recarga la página y hace fallar escenarios sanos; se carga la app hasta que se estabiliza antes de empezar.

### 2.5 Apps móviles en emulador/simulador, en local
- **HTTPS de pruebas:** servicio `mobile-tls` (Caddy con `tls internal`, CA propia) en `https://localhost:8443`,
  reenviando a la API. Android: la CA se empaqueta **solo en el build de depuración** (`src/debug/` con
  `network_security_config`), id `…app.pruebas`, y `adb reverse`. iOS: build de simulador **sin firma** y la CA
  solo en ese simulador (`xcrun simctl keychain … add-root-cert`).
- **Android:** `scripts/mobile-test-android.sh` (compila, arranca emulador, instala) → Playwright `_android`
  conduce el WebView. Locale por app con `cmd locale set-app-locales`; `pm clear` entre escenarios.
- **iOS:** `scripts/mobile-test-ios.sh` → Appium + XCUITest. Trucos: el inspector publica la app como
  `process-App` (hay que pasarlo en `additionalWebviewBundleIds`); la app se reinstala en cada escenario.
- **Secuenciador** (`scripts/mobile-test.sh android ios`): antes de empezar una plataforma apaga la otra
  (`mobile-test-stop.sh`: `adb emu kill` / `simctl shutdown all`), la apaga al terminar y deja un resumen.
  Emulador + simuladores + Docker a la vez saturan la máquina y las pruebas fallan por tiempo.
- **CI móvil** (`.github/workflows/mobile-e2e.yml`): Android en `ubuntu-latest` con KVM y iOS en `macos-latest`
  (pila nativa sin Docker, `scripts/mobile-native-stack.sh`); gratis en repos públicos (`private == false`).
  **Solo manual y sin verificar en GitHub** hasta decidir activarlo.

### 2.6 Pruebas de la API (`scripts/test-api.mjs`, `test-endpoints.mjs`, `test-security.mjs`, `scripts/lib/api.mjs`)
- Cliente mínimo con sesión por cookie, `Host` fijable (el idioma depende del dominio), `raw` y `call(path, método, cuerpo, estado)`.
- **Seguridad** (checklist reutilizable): sin sesión todo lo privado da 401 · escrituras exigen cabecera propia y
  origen permitido · CORS no abre a orígenes ajenos · una cuenta no toca lo de otra (IDOR) · el cuerpo no da
  privilegios (`isOwner`, `isDemo`) · cookie `HttpOnly`/`SameSite`/no adivinable y revocada al salir · bloqueo
  tras N fallos de login · sin enumeración de cuentas · ninguna respuesta filtra hashes ni trazas · SQL/HTML
  llegan como texto · cabeceras (`nosniff`, anti-clickjacking, HSTS, `no-store`) · cuerpos enormes y archivos
  no válidos rechazados · IDs/tokens mal formados → 400/404, nunca 500.
- **Idiomas (es, en, pt, de, fr):** el idioma se guarda en la cuenta y llega en los mensajes de error, por
  dominio, por cabecera y desde las apps móviles.

### 2.7 Pruebas de la base de datos (`tests/db`)
Base temporal creada en el PostgreSQL de Docker, migraciones aplicadas **como el rol de la aplicación**
(sin privilegios de administrador), borrada al terminar. Comprueban: orden de migraciones, restricciones
`CHECK`/`UNIQUE`/`NOT NULL`, valores permitidos, integridad referencial, cascadas (borrar evento/cuenta),
que no se guardan secretos en claro y que el rol no es superusuario ni puede leer `pg_authid`.

### 2.8 Un solo comando (`scripts/test-all.mjs`)
`npm test` ejecuta todas las suites, no se detiene en la primera que falla y termina con un resumen
(✓/✗, tiempos y el comando para repetir). `npm test -- security db` elige suites; `npm test -- movil` añade
los móviles. Cada suite tiene su propio comando. **En CI se usa `npm run test:unit`** (rápido y sin app);
`npm test` necesita la app arriba y la levanta con `docker compose up -d --wait` si falta.

## 3. Cómo adoptarlo en otro proyecto (orden recomendado)
1. **Contratos y límites:** un paquete compartido con Zod y `accountLimits`; test de sincronía con las migraciones.
2. **`check-versions` y `check-test-only`** dentro de `test:unit`.
3. **Cliente de API + suites** `api`, `endpoints` y `security` (copiar `scripts/lib/api.mjs` y adaptar rutas).
4. **Suite `db`** con base temporal y rol de aplicación.
5. **E2E web:** `playwright-bdd`, `ui`, `calentar`, etiquetas y `summary`.
6. **Orquestador** `test-all.mjs` y la regla en `CLAUDE.md` (o equivalente) de que cada cambio llega con su prueba.
7. **CI:** `test:unit` antes de levantar la app; luego API y e2e; subir `tests/e2e/results/` como artifact.
8. **Móviles (opcional, local):** servicio TLS de pruebas + build de depuración + Appium/`_android` + secuenciador.

## 4. Lecciones y trampas encontradas
- **`npm run x -- --flag` dentro de un workspace:** el script raíz debe terminar en `--` para reenviar argumentos.
- **Appium `setValue` se salta `maxlength`** (asigna por programa); el teclado real sí lo respeta: ese escenario se marca `@sin-ios` y la longitud se cubre con el atributo.
- **DELETE con cuerpo JSON** devuelve 400 antes que el 403 del filtro de origen: en las pruebas, DELETE sin cuerpo.
- **Límite de peticiones (`rate limit`):** las suites hacen cientos de llamadas; el entorno de CI debe permitirlo.
- **Una prueba que no puede fallar no vale:** se comprobó cada guarda rompiéndola a propósito (p. ej. `<= 255` en la migración, o el nombre del servicio de pruebas en `compose.prod.yml`).
- **`docker compose watch` reconstruye servicios** al cambiar `package.json`: no dejarlo corriendo mientras se ejecutan pruebas.
- **CI sin verificar:** los workflows de CI se prueban primero ejecutando en local los mismos comandos; los móviles aún no se han ejecutado en GitHub.

## 5. Versiones usadas (octubre de 2026)
Node 24 LTS · Playwright 1.64 · playwright-bdd 9.2 · Appium 3.8 + xcuitest 12.18 · WebdriverIO 10 · Zod 4.6 ·
Vite 8 · TypeScript 7 · `pg` 8 · Caddy 2.11 · PostgreSQL 18 · Capacitor 8 · Docker Compose · GitHub Actions
(`checkout@v7`, `setup-node@v7`, `setup-java@v6`, `upload-artifact@v7`, `android-emulator-runner@v2.38.0`).
