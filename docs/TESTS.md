# Pruebas: qué hay, dónde corre cada una y cómo ejecutarla

`npm test` ejecuta **todas** las suites una tras otra y termina con un resumen (✓/✗, tiempo y el
comando para repetir la que falle). Una suite que falla no detiene a las demás. Si la app no está
arriba, `npm test` la levanta con `docker compose up -d --wait`.

```
npm test                      # unit, api, endpoints, security, db, browser, landing y e2e (web)
npm test -- security db       # solo esas suites
npm test -- movil             # Android e iOS, uno tras otro (solo local; no entra por defecto)
npm test -- --lista           # qué suites hay y su comando
```

| Suite | Qué comprueba | Comando propio | GitHub Actions |
|---|---|---|---|
| `unit` | Esquemas Zod, límites de longitud (también contra las migraciones), versiones de dependencias, servicios solo de pruebas | `npm run test:unit` | sí |
| `go` | Servicio de búsqueda en Go (`services/search`): parámetros, cursor, mensajes en los 5 idiomas, idioma por dominio (los mismos casos que contracts, `locale-cases.json`), límite por IP, CORS y cabeceras | `npm run test:go` | sí (en «Verificar», con `gofmt`, `go vet` y `govulncheck`) |
| `api` | Flujos completos de la API: eventos, invitaciones, RSVP, sesión, idioma por dominio, recuperar contraseña… | `npm run test:api` | sí |
| `endpoints` | Endpoints restantes (`/config`, demo, Google, App Links), **idiomas es/en/pt/de/fr** y validación de entradas | `npm run test:endpoints` | sí |
| `security` | Autenticación, CSRF/origen/CORS, aislamiento entre cuentas (IDOR), escalada de privilegios, sesión, fuerza bruta, enumeración, fugas, inyección, cabeceras y límites | `npm run test:security` | sí |
| `db` | Migraciones desde cero como el rol `api`, restricciones (longitudes, idiomas, valores permitidos), integridad, cascadas, permisos del rol | `npm run test:db` | sí (job «Base de datos», con Squawk) |
| `browser` | Recorrido completo en los dos dominios: demo, registro, evento, invitación familiar, RSVP con SSE, pantalla TV | `npm run test:browser` | sí |
| `landing` | Landing, CTAs, preguntas frecuentes y cuenta creada desde la landing (es y en) | `npm run test:landing` | sí |
| `e2e` | Escenarios Gherkin en español sobre la web: Chromium de escritorio, Android (Chromium) e iPhone (WebKit) emulados; Firefox cada semana. Ver [E2E.md](E2E.md) | `npm run e2e` | sí |
| `movil` | Los escenarios `@movil` en Android (emulador) e iOS (simulador), uno tras otro | `npm run e2e:movil` | **no, solo local** |

**Por qué la API siempre corre en CI:** la sirve a varios clientes (web, Android, iOS); una regresión
ahí rompe a todos. Las pruebas de móviles se quedan en local por ahora, y se pasan a CI solo cuando
se decida, después de validarlas aquí (regla de `CLAUDE.md`).

**Checks del CI** (`.github/workflows/ci.yml`, en cada PR y antes de publicar, con los nombres comunes
de la plataforma): `Verificar` (instalación, lint, tipos, unitarias, build, `npm run check:audit`, Go y Trivy
sobre las 6 imágenes), `Escenarios` (`test:api`, `test:endpoints`, `e2e` y los recorridos de navegador),
`Base de datos` (`test:db` contra la imagen de PostgreSQL 18 y Squawk sobre las migraciones nuevas) y
`Seguridad` (`test:security`, CodeQL y ZAP baseline). `deploy.yml` llama a este workflow y solo publica
si los cuatro pasan. Cada lunes, `semanal.yml` repite los escenarios en Firefox, CodeQL, Trivy de
dependencias y secretos, y los `@smoke` `@solo-lectura` contra los dos dominios de producción.

## Pruebas de la base de datos (`tests/db`)

Cada ejecución crea una base temporal (`tuevento_test_xxxx`) en el PostgreSQL de `docker compose up`
(en el CI, en un contenedor de la imagen `services/postgres`),
aplica todas las migraciones **como el rol `api`** (el de producción, sin privilegios de
administrador) y la borra al terminar: no toca los datos de desarrollo. Necesita la app arriba
(`docker compose up -d`). Las contraseñas salen de `.env` (o `TEST_DB_*`).

## Pruebas de seguridad de la API

Cubren las amenazas habituales sobre los endpoints reales: sin sesión todo lo privado da 401; las
escrituras exigen `X-TuEvento-Client` y un origen permitido; una cuenta no ve ni modifica lo de otra;
el cuerpo de la petición no puede dar privilegios (`isOwner`, `isDemo`…); la cookie es `HttpOnly` y
`SameSite=Lax`, y salir la revoca en el servidor; 5 fallos de login bloquean la cuenta; no se revela si
un correo existe; ninguna respuesta filtra hashes ni trazas; SQL y HTML llegan como texto; hay
cabeceras de seguridad y `no-store`; los cuerpos enormes y los avatares no válidos se rechazan.

## Qué no cubren (y conviene saberlo)

- El flujo real de Google (necesita credenciales de Google): solo se prueba que rechaza credenciales falsas.
- El puente de autenticación móvil (App Link + PKCE) dentro de las apps; lo cubre `test:platform` solo en la API.
- Los escenarios `@perfil` y la sesión en las apps móviles.
- `test:browser` y `test:landing` son scripts largos anteriores a los escenarios Gherkin; falta migrarlos a `.feature`.
