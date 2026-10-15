# Pruebas E2E (Gherkin + Playwright)

Escenarios en español (`tests/e2e/features/*.feature`) que se ejecutan con Playwright
contra la app real (Docker). Un escenario describe un comportamiento; si se rompe, el
informe dice cuál.

```
tests/e2e/
  features/   .feature en español (# language: es)
  steps/      pasos en JavaScript (fixtures.js = estado y datos únicos por escenario)
  support/    entorno.js (URLs)
  scripts/    summary.mjs (resumen por característica y etiqueta)
  results/    informe HTML, results.json, capturas, vídeos y trazas (no se versiona)
```

## Ejecutar

La app debe estar arriba: `docker compose up -d` (http://localhost:5187).

| Qué | Comando (desde la raíz) |
|---|---|
| Todo, en terminal | `npm run e2e` |
| Ver cómo se ejecuta (una ventana, escenario a escenario, con pausas) | `npm run e2e:ver` (más lento: `E2E_SLOWMO=1200 npm run e2e:ver`; uno solo: `npm run e2e:ver -- --grep "Crear una cuenta con datos válidos"`) |
| Navegador visible, en paralelo | `npm run e2e:headed` |
| Modo UI de Playwright (pasos, repetir, depurar) | `npm run e2e:ui` |
| Solo algunos escenarios | `npm run e2e -- --grep @smoke` (o `@registro`, `@limites`, `@api`…) |
| Un archivo | `npm run e2e -- features/perfil.feature` |
| Resumen: qué pasa, falla u omite | `npm run e2e:summary` |
| Informe HTML | `npm run report -w @tuevento/e2e` |

**Ritmo humano** (`e2e:ver` ya lo activa; todo en milisegundos, 0 = a toda velocidad):

| Variable | Qué hace | En `e2e:ver` |
|---|---|---|
| `E2E_SLOWMO` | pausa tras cada acción (clic, relleno…) | 500 |
| `E2E_TECLADO` | pausa entre tecla y tecla al escribir | 90 |
| `E2E_PAUSA` | espera al final de cada escenario para ver el resultado | 2000 |

Ejemplo, aún más despacio: `E2E_SLOWMO=1000 E2E_TECLADO=150 E2E_PAUSA=4000 npm run e2e:ver`.
Con cualquiera de ellas los tiempos máximos de la prueba se amplían solos.

Cuando un escenario falla se guardan **captura, vídeo y traza** en `tests/e2e/results/`
(`npx playwright show-trace <trace.zip>`). Para grabar vídeo siempre: `E2E_VIDEO=on`.

Variables: `E2E_BASE_URL` (por defecto `http://localhost:5187`), `E2E_BASE_URL_EN`
(dominio inglés), `E2E_VIDEO`, `E2E_SLOWMO`.

## Escribir un escenario

1. Añade o edita un `.feature` con `# language: es` (Dado / Cuando / Entonces / Y).
2. Reutiliza los pasos existentes (`steps/`); si falta uno, `npm run bddgen -w @tuevento/e2e`
   indica el que hay que escribir.
3. Etiquetas: área (`@registro`, `@perfil`…) y tipo (`@smoke` = lo imprescindible,
   `@validacion`, `@limites`, `@i18n`, `@api` = sin navegador).
4. Los datos se crean únicos en cada escenario (`nuevaCuenta()`); no dependas de la base de datos.

## CI

`.github/workflows/ci.yml` ejecuta `npm run e2e` contra `compose.prod.yml` y sube
`tests/e2e/results/` como artifact `qa-evidence`.

## HTTPS local para las apps móviles (solo pruebas)

La app móvil exige un origen HTTPS. El servicio `mobile-tls` (Caddy, `compose.yml`, perfil
`mobile`) lo da en `https://localhost:8443` con una CA propia. **Es solo para pruebas: no
existe en `compose.prod.yml` y nunca se despliega en un VPS** (`scripts/check-test-only.mjs`,
dentro de `npm test`, falla si aparece en producción, en un Dockerfile o en un workflow).

```
docker compose --profile mobile up -d mobile-tls
bash scripts/mobile-test-ca.sh        # exporta la CA a tests/mobile/.ca/root.crt
curl --cacert tests/mobile/.ca/root.crt https://localhost:8443/api/health
```

La CA es pública y de pruebas (no se versiona). Android: se empaqueta solo en el build de
depuración. iOS: se añade solo al simulador con `xcrun simctl keychain booted add-root-cert`.
Un servicio nuevo solo de pruebas se añade a la lista de `scripts/check-test-only.mjs`.

## App móvil Android (emulador)

Los escenarios etiquetados `@movil` (hoy, todo `registro.feature` salvo los `@solo-web`) se
ejecutan también dentro del **WebView de la app real** instalada en el emulador. Playwright
se conecta a él por Chrome DevTools (`_android`); es el mismo código de pasos.

```
docker compose up -d
bash scripts/mobile-test-android.sh     # una vez, o tras cambiar la app: HTTPS de pruebas +
                                        # build de depuración + emulador + instalar + abrir
npm run e2e:android                     # los escenarios @movil en el emulador
npm run e2e:android:ver                 # igual, a ritmo humano (E2E_TECLADO / E2E_PAUSA)
```

- El APK es **de depuración** (`com.tueventofun.app.pruebas`), apunta a `https://localhost:8443`
  (ver «HTTPS local») y lleva la CA de pruebas solo en `src/debug/`. El release de `mobile.yml`
  no cambia.
- Cada escenario arranca con la app limpia (`pm clear`) y en español. Se ve en la ventana del
  emulador; `E2E_SLOWMO` no aplica aquí (no hay navegador que ralentizar).
- Si falla, se adjunta una captura de la pantalla del emulador. Un escenario que solo pasa al
  reintentar sale como «inestable» en `npm run e2e:summary`.
- `AVD=Pixel_10_Pro bash scripts/mobile-test-android.sh` usa otro emulador. No está en CI: un
  emulador en GitHub Actions necesitaría un job aparte.
- Los escenarios de perfil (`@perfil`) no llevan `@movil`: dependen de abrir sesión por la API
  del navegador, y la app nativa gestiona la sesión de otra forma.

## App móvil iOS (simulador, iPhone y iPad)

Los mismos escenarios `@movil` corren en el **WebView de la app real** dentro del simulador de
iOS. Playwright no maneja iOS, así que los conduce **Appium** (XCUITest + WebdriverIO) a través
de la interfaz común `ui` (`tests/e2e/support/ui-playwright.js` ↔ `ui-ios.js`): los pasos y los
`.feature` son los mismos que en web y Android.

```
docker compose up -d
bash scripts/mobile-test-ios.sh                  # build sin firma + CA solo en ese simulador + instalar + abrir
npm run e2e:ios                                  # los escenarios @movil en el iPhone
npm run e2e:ios:ver                              # igual, a ritmo humano (E2E_TECLADO / E2E_PAUSA)

# iPad (u otro simulador): prepararlo y señalarlo
SKIP_BUILD=1 SIMULATOR="iPad Pro 13-inch (M5)" bash scripts/mobile-test-ios.sh
E2E_IOS_SIMULADOR="iPad Pro 13-inch (M5)" npm run e2e:ios
```

- La app es un build de **Debug para simulador, sin firma** (`com.tueventofun.app.pruebas`), contra
  `https://localhost:8443`. El simulador comparte la red de la Mac y confía en la CA de pruebas
  (`xcrun simctl keychain … add-root-cert`, solo en ese simulador). El release de `mobile.yml` no cambia.
- Appium vive en `tests/mobile/.appium` (driver `xcuitest`, no se versiona): se instala una vez con
  `APPIUM_HOME=$PWD/tests/mobile/.appium npx appium driver install xcuitest`. Playwright arranca y
  para el servidor solo (`webServer` de la configuración).
- Cada escenario reinstala la app para empezar sin sesión ni datos. Si falla, se adjunta captura.
- El escenario `@sin-ios` («nombre muy largo se corta») no corre en iOS: Appium asigna el valor por
  programa y se salta el `maxlength` que sí respeta el teclado. La longitud sigue cubierta por los
  escenarios que comprueban el atributo `maxlength` de cada campo.
- **Recursos:** emulador de Android + simuladores de iOS + Docker saturan la máquina. Con varios
  abiertos a la vez, las pruebas se vuelven lentas y fallan por tiempo: apaga los que no uses
  (`xcrun simctl shutdown all`).

## Android e iOS, uno tras otro (nunca a la vez)

```
npm run e2e:movil                  # Android → se apaga → iOS → se apaga
npm run e2e:movil:ios-primero      # iOS → se apaga → Android → se apaga
bash scripts/mobile-test.sh ios    # solo una; MOBILE_VER=1 (ritmo humano), MOBILE_KEEP=1 (dejar encendida), SKIP_BUILD=1
bash scripts/mobile-test-stop.sh android|ios     # apagar a mano (espera a que se apague del todo)
```

Antes de empezar una plataforma se apaga la otra, y al terminar se apaga ella. Al final queda un
resumen por plataforma y el código de salida es distinto de 0 si alguna falló.

## CI de las apps móviles (`.github/workflows/mobile-e2e.yml`)

- **Sin coste:** los runners de GitHub son gratuitos en repositorios públicos. Cada job lleva
  `github.event.repository.private == false`: si el repositorio pasa a privado se omiten solos
  (los minutos de macOS cuestan 10x).
- **Android** (`ubuntu-latest`, KVM): emulador API 35 con `android-emulator-runner`; la pila es la
  de Docker (`compose.yml`, perfil `mobile`), igual que en local.
- **iOS** (`macos-latest`): macOS no tiene Docker, así que `scripts/mobile-native-stack.sh`
  levanta PostgreSQL 18, la API y Caddy (el mismo `Caddyfile` de `mobile-tls`, con
  `MOBILE_TLS_UPSTREAM=127.0.0.1:3087`) directamente en el runner (`MOBILE_STACK=native`).
- **Por ahora solo manual** (`workflow_dispatch`: android, ios o both): las pruebas móviles se
  ejecutan en local y el workflow no corre en los PR. Para activarlo en los PR, añadir el disparador
  `pull_request` con las rutas que indica el comentario del propio workflow. Sube
  `tests/e2e/results/` como artifact.
