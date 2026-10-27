# Plan: proveedores de eventos, búsqueda, mapas y trabajo sin conexión

Estado a 2026-10-27. Plan para que lo implemente un agente, fase por fase. Cada fase es **un PR**
que se mezcla y se despliega antes de empezar la siguiente.

Funcionalidades pedidas:

1. Trabajo sin conexión en las apps de Android e iOS: consultar los datos y seguir trabajando.
2. Dos tipos de cuenta: **organizador** (el usuario de hoy, que crea eventos) y **proveedor**
   (salones, wedding planners, renta de sillas…), con página pública tipo landing y panel propio.
3. Búsqueda de proveedores por ubicación y por tipo, en un servicio separado.
4. Botón opcional en el evento para buscar proveedores; resultados en tarjetas.
5. Compartir la ubicación del evento o del local con Google Maps, Apple Maps o Waze.

## 0. Cómo trabajar con este plan

Lee antes de empezar, y vuelve a ellos en cada fase:

- `CLAUDE.md` y `AGENTS.md`: reglas obligatorias. Las que más pesan aquí:
  - **Idiomas**: todo texto nuevo, a la vez en `packages/contracts/src/locales/{es,en,pt,de,fr}.json`,
    con traducción real (tuteo en es, «você» en pt-BR, «du» en de, «tu» en fr con espacio fino antes
    de `? ! : ;`). Nada de texto fijo en JSX ni en `aria-label`, `title`, `alt`, `placeholder`. El
    contenido de los usuarios (nombre del negocio, servicios, descripciones) **no se traduce**.
  - **Límites**: cada longitud vive en `accountLimits` (`packages/contracts/src/index.ts`) y se aplica
    en el campo (`maxLength`), en Zod (mensaje traducido) y en la base de datos. La prueba
    `packages/contracts/src/limits.test.ts` solo reconoce restricciones escritas como
    `ALTER TABLE t ADD CONSTRAINT t_col_max_length CHECK (char_length(col) <= N)`: en tablas nuevas
    escríbelas así, no dentro del `CREATE TABLE`, y añade cada columna al mapa de ese test.
  - **Migraciones**: archivo nuevo `apps/api/migrations/NNN_*.sql`, nunca editar una aplicada. En
    tablas con datos, restricción `NOT VALID` y `VALIDATE CONSTRAINT` en la migración siguiente, con
    `SET lock_timeout` al principio (modelo: `015_landing_evento.sql` y `016_landing_evento_validar.sql`).
    Squawk revisa cada migración en el CI.
  - **Pruebas en el mismo PR**: escenario Gherkin en español en `tests/e2e/features/` por cada
    comportamiento visible; prueba de API por endpoint (`tests/api/test-endpoints.mjs`) y caso de
    seguridad si toca permisos o datos de otras cuentas (`tests/api/test-security.mjs`); prueba de
    base de datos por cada tabla, restricción o trigger (`tests/db/specs/`).
  - **Primero en local**: todo pasa en local antes de llevarlo al CI. Cada paso nuevo de un workflow
    lleva su `timeout-minutes` (ver el encabezado de `.github/workflows/ci.yml`).
  - **Versiones**: la última estable de cada dependencia nueva, **comprobada en su registro**
    (npm, pkg.go.dev, Docker Hub) el día que se añade, el mismo rango en todos los workspaces y
    `node scripts/check-versions.mjs` en verde.
  - **Commit y push** al terminar cada cambio, en una rama de trabajo; nunca push a `main`.
- `docs/ARCHITECTURE.md`, `docs/I18N.md`, `docs/TESTS.md`, `docs/E2E.md`, `DESIGN.md` (paleta,
  tipografía y componentes: las pantallas nuevas los usan, no inventan estilos).
- Los archivos de referencia que cita cada fase: copia sus patrones (nombres, estilo, manejo de errores)
  en vez de inventar otros.

Verificación al cerrar **cada** fase (con `docker compose up -d`):

```sh
npm run build -w @tuevento/contracts
npm run lint && npm run typecheck && npm run test:unit
npm test            # unit, api, endpoints, security, db y e2e
npm run e2e:summary
```

Y en la fase 5 y siguientes, además: `cd services/search && go vet ./... && go test ./...`.

No hacer: actualizar dependencias que no pide la fase, cambiar diseños aprobados, borrar o debilitar
pruebas para que pasen, añadir texto en un solo idioma, guardar datos personales en `localStorage`.

## 1. Decisiones tomadas

Revísalas con el dueño del proyecto antes de la fase 1; el resto del plan depende de ellas.

| # | Decisión | Motivo |
|---|---|---|
| D1 | **El tipo de cuenta se elige al registrarse y no cambia.** `organizer` (por defecto) o `provider`. Un proveedor no crea eventos; quien quiera ambas cosas usa dos cuentas con correos distintos | Lo pide la especificación («distinto al normal»). Evita mezclar permisos y pantallas. Las cuentas actuales quedan como `organizer` |
| D2 | **Búsqueda sobre PostgreSQL** (búsqueda de texto completo, `pg_trgm` para errores de escritura, `unaccent` y distancia geográfica) servida por un **servicio nuevo en Go, `search`**, de solo lectura | Cero costo y cero sincronización: los datos están en PostgreSQL y un trigger mantiene la tabla de búsqueda en la misma transacción. Algolia cuesta y saca datos fuera; Meilisearch o Typesense son otra base de datos que hay que sincronizar, respaldar y alimentar con memoria (AGENTS §26 pide justificarlo, y el servidor es compartido). Para cientos o miles de proveedores, PostgreSQL basta de sobra. Go: proceso de ~20 MB, separado de la API, como se pidió. **No** se escribe un motor de búsqueda propio |
| D3 | **Mapas sin claves de pago**: enlaces universales a Google Maps, Apple Maps y Waze (abren la app instalada); mapa embebido con MapLibre GL y teselas de OpenFreeMap (gratis, sin clave); geocodificación con Nominatim (OpenStreetMap) desde la API, con caché y sin autocompletar | La API de Google Maps/Places cuesta (ya se descartó en `docs/PLAN.md`). La política de uso de Nominatim prohíbe autocompletar y limita a 1 petición/s: se busca al pulsar un botón y se guarda en caché. `GEOCODER_URL` permite cambiar a un Nominatim propio si crece |
| D4 | **Sin conexión solo en las apps** (Android e iOS). Datos en IndexedDB cifrados con AES-GCM, con la clave en el llavero o el Keystore (`@aparajita/capacitor-secure-storage`, ya instalado). Cambios en una cola que se envía al volver la red, con IDs generados en el teléfono, `Idempotency-Key` y control de versión (409 si otro cambio llegó antes). Subir fotos exige conexión | Lo pide la especificación para el móvil. La web sigue igual. Los datos de invitados son personales: cifrados y borrados al cerrar sesión |
| D5 | **Los perfiles publicados de los proveedores son públicos e indexables** (200, `canonical`, en el sitemap). La búsqueda pública también. Borradores y perfiles suspendidos: 404 real; borrados: 410; slug cambiado: 301 al nuevo | Es el valor del directorio, y AGENTS §9.2 exige un solo estado por URL y 404 de verdad |
| D6 | **Publicar es inmediato y gratis.** La moderación es posterior: suspender desde el panel de administración (fase 9) | Sin pagos en esta fase; la página de precios no cambia |
| D7 | **Contacto sin formulario**: WhatsApp (`wa.me` con mensaje preparado), teléfono, correo y sitio web del proveedor | No hay que construir mensajería ni filtrar spam. Un formulario con aviso por correo queda para después |

Preguntas abiertas, con el valor por defecto que se usa si nadie dice otra cosa:

- País por defecto de los perfiles y moneda de los precios: `MX` y `MXN` (la zona horaria por defecto
  ya es `America/Mexico_City`; ojo: `defaultPhoneCountry` es `"ES"`, no se toca en este plan).
- Radio de búsqueda por defecto: 30 km (máximo 200).

## 2. Orden de las fases

| Fase | Contenido | Pedido |
|---|---|---|
| 1 | Ubicación con coordenadas, mapa y compartir, en los eventos | 5 |
| 2 | Tipos de cuenta: organizador y proveedor | 2 |
| 3 | Perfil, servicios y fotos del proveedor; su panel | 2 |
| 4 | Página pública del proveedor e indexación | 2 y 5 |
| 5 | Servicio de búsqueda `search` (Go) | 3 |
| 6 | Página de búsqueda y tarjetas de proveedores | 3 |
| 7 | Botón «Buscar proveedores» en el evento | 4 |
| 8 | Trabajo sin conexión en las apps (API, cliente, pantallas, pruebas móviles) | 1 |
| 9 | Moderación de proveedores en el panel de administración (opcional) | 2 |

La ubicación va primero porque la usan los perfiles y la búsqueda. El modo sin conexión va al final
porque sincroniza los datos de los dos tipos de cuenta: hacerlo antes obligaría a rehacerlo.

Compatibilidad en todas las fases: hay apps publicadas (APK 1.0.5) que no conocen los campos nuevos.
Un campo nuevo es **opcional** en la API; si no llega, se conserva el valor guardado (no se borra), y
los clientes ignoran los campos que no conocen (AGENTS §21).

---

## Fase 1 — Ubicación con coordenadas, mapa y compartir (eventos)

**Objetivo**: un evento puede tener, además del texto `location` de hoy, un punto exacto en el mapa.
Organizador e invitados lo abren en Google Maps, Apple Maps o Waze y lo comparten.

### Base de datos

`017_event_geo.sql`:

```sql
SET lock_timeout = '5s';
ALTER TABLE events ADD COLUMN latitude double precision, ADD COLUMN longitude double precision;
ALTER TABLE events ADD CONSTRAINT events_geo_range CHECK (
  (latitude IS NULL AND longitude IS NULL) OR
  (latitude BETWEEN -90 AND 90 AND longitude BETWEEN -180 AND 180)) NOT VALID;
CREATE TABLE geo_cache (
  kind text NOT NULL CHECK (kind IN ('search','reverse','link')),
  key_hash text NOT NULL, locale text NOT NULL, response jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY (kind, key_hash, locale));
```

`018_event_geo_validar.sql`: `VALIDATE CONSTRAINT events_geo_range`. Purga de `geo_cache` con más de
30 días en `Database.cleanup()` (`apps/api/src/database.ts`).

### Contratos (`packages/contracts`)

- `geoPointSchema = z.strictObject({ lat: z.number().min(-90).max(90), lng: z.number().min(-180).max(180) })`.
- `eventSchema`: `geo: geoPointSchema.nullable().optional()`. `undefined` conserva, `null` lo quita.
  `Event` y `PublicEvent` llevan `geo: { lat, lng } | null`.
- En `calendar.ts`, junto a `mapsSearchUrl`: `mapLinks({ label, geo })` devuelve
  `{ google, googleDirections, apple, waze }`:
  - con coordenadas: `https://www.google.com/maps/search/?api=1&query=LAT,LNG`,
    `https://www.google.com/maps/dir/?api=1&destination=LAT,LNG`,
    `https://maps.apple.com/?q=<label>&ll=LAT,LNG`, `https://waze.com/ul?ll=LAT,LNG&navigate=yes`;
  - sin ellas, el texto: `query=<label>`, `https://maps.apple.com/?q=<label>`, `https://waze.com/ul?q=<label>`.
  - Pruebas en `calendar.test.ts` (codificación, coordenadas con 6 decimales).
- El `.ics` (`calendar.ts`) añade `GEO:LAT;LNG` cuando hay coordenadas.
- `accountLimits.geoQuery = 200` y `accountLimits.url = 2048` (excepciones en `limits.test.ts`: no
  tienen columna).

### API (`apps/api/src/geo.ts`, nuevo, más su controlador)

| Endpoint | Qué hace |
|---|---|
| `GET /api/geo/search?q=` | Hasta 5 resultados `{ label, lat, lng, city, region, country }`. Sin sesión (lo usa la búsqueda pública) |
| `GET /api/geo/reverse?lat=&lng=` | `{ label, city, region, country }` del punto |
| `POST /api/geo/parse-link` `{ url }` | Coordenadas de un enlace de Google Maps, Apple Maps o Waze |

- Cliente de Nominatim: `GEOCODER_URL` (por defecto `https://nominatim.openstreetmap.org`),
  `format=jsonv2&addressdetails=1&limit=5&accept-language=<idioma de la petición>`, cabecera
  `User-Agent: TuEventoFun/<versión> (contacto@tuevento.fun)`. Timeouts de 5 s para conectar y 30 s
  en total; reintento solo en GET (AGENTS §28).
- **Una petición por segundo** a Nominatim como máximo, para toda la API (cola en memoria con un
  intervalo de 1 s: hay una sola instancia). Antes, la caché `geo_cache` (clave: hash SHA-256 de la
  consulta normalizada).
- Límite por IP (`apps/api/src/rate-limit.ts`): 10 por minuto en `search` y `reverse`, 10 por minuto en
  `parse-link`. 429 con `Retry-After`.
- `parse-link`: solo `https://` y una lista blanca de hosts (`google.com`, `www.google.com`,
  `maps.google.com`, `maps.app.goo.gl`, `goo.gl`, `maps.apple.com`, `waze.com`, `www.waze.com`). Los
  enlaces cortos (`maps.app.goo.gl`) se resuelven siguiendo como máximo 3 redirecciones, comprobando el
  host en cada salto, sin leer el cuerpo (protección SSRF). Formatos: `@LAT,LNG`, `!3dLAT!4dLNG`,
  `q=LAT,LNG`, `ll=LAT,LNG`, `query=LAT,LNG`. Si no hay coordenadas: 422 `geo_link_without_coordinates`.
- Un fallo de Nominatim responde 503 `geocoder_unavailable`, traducido; nunca el error de terceros.
- `EventsService`: guarda y devuelve `geo`; la landing y la invitación pública también lo devuelven.

### Interfaz (`packages/app`)

- Componente `LocationField` (nuevo, `location-field.tsx`), sustituye al campo de lugar del editor
  (`event-pages.tsx`, campo `location`). Contiene:
  - el texto del lugar, como hoy (obligatorio, 3–300 caracteres);
  - «Buscar en el mapa»: busca el texto en `/api/geo/search` y muestra hasta 5 resultados para elegir
    (lista con botones, navegable con teclado). **No** busca mientras se escribe;
  - «Usar mi ubicación»: `navigator.geolocation` en la web y `@capacitor/geolocation` en las apps
    (añadir al `Runtime` en `context.tsx` un método `getPosition?()`);
  - «Pegar enlace de Google Maps»: campo para el enlace, que se envía a `/api/geo/parse-link`;
  - un mapa pequeño con un marcador que se puede arrastrar (MapLibre GL, cargado con `import()` solo
    cuando hace falta). Al mover el marcador, el texto **no** cambia solo: se ofrece «Usar esta
    dirección: …» (con `reverse`);
  - «Quitar punto del mapa».
  - El mapa es un complemento: todo se puede hacer sin él (accesibilidad), y lleva la atribución
    «© OpenStreetMap» (traducida) y la de OpenFreeMap.
- Componente `MapLinks` (nuevo): botones «Google Maps», «Apple Maps», «Waze», «Cómo llegar», «Copiar
  dirección» y «Compartir ubicación». Compartir usa `navigator.share` en la web y `@capacitor/share`
  en las apps (método `share?()` en el `Runtime`); si no hay, copia el texto. El texto compartido se
  redacta completo con variables (`location.shareText`: «{{place}} — {{url}}»).
- Se muestra en el detalle del evento, la landing (`public-event.tsx`) y la invitación
  (`public-rsvp.tsx`), donde hoy está el enlace de Google Maps. Con coordenadas, también un mapa
  estático pequeño (MapLibre sin interacción) que se abre a pantalla completa.
- `Runtime.openExternal` ya admite `https:`: no añadir otros esquemas.

### Web y apps

- CSP (`services/web/snippets/security-headers.conf`): `connect-src` e `img-src` para
  `https://tiles.openfreemap.org`, `worker-src blob:` para MapLibre. Comprobar que la landing y el
  editor siguen funcionando con el CSP de producción (la pila del CI, no Vite).
- Apps: `@capacitor/geolocation` y `@capacitor/share` (versiones compatibles con `@capacitor/core` 8.x,
  comprobadas en npm). Permisos: Android `ACCESS_COARSE_LOCATION` y `ACCESS_FINE_LOCATION`; iOS
  `NSLocationWhenInUseUsageDescription` traducida a los 5 idiomas (`InfoPlist.strings` por idioma en
  `apps/web/ios/App/App/<idioma>.lproj/`). Hace falta publicar una versión nueva de la app.

### Pruebas

- API: `search`, `reverse` y `parse-link` en los 5 idiomas, con entradas inválidas (400 o 422 con el
  campo), un host fuera de la lista (422), un enlace sin coordenadas y 429 al superar el límite. En el
  CI, Nominatim **no** se llama: `compose.ci.yml` define `GEOCODER_URL` hacia un doble de pruebas (un
  servicio solo de pruebas, con la etiqueta de §35 y añadido a la lista de `scripts/check-test-only.mjs`)
  que responde datos fijos, igual que Mailpit sustituye al SMTP.
- DB: `events_geo_range` rechaza coordenadas fuera de rango y una sola coordenada.
- E2E `ubicacion.feature` (`@ubicacion`): pegar un enlace de Google Maps fija el punto; los botones
  de mapas de la landing llevan las coordenadas; un evento sin punto usa el texto; quitar el punto; el
  `.ics` lleva `GEO` (`@api`). Un escenario `@i18n` con los textos de los botones en los 5 idiomas.

**Hecho cuando**: un organizador fija el punto de su evento por cualquiera de los tres caminos, los
invitados lo abren en la app de mapas de su teléfono, y las apps antiguas siguen guardando eventos sin
perder el punto.

---

## Fase 2 — Tipos de cuenta

**Objetivo**: al registrarse se elige «Organizo eventos» o «Ofrezco servicios para eventos». Cada tipo
ve su panel y solo puede usar sus endpoints.

### Base de datos

`019_account_type.sql`: `ALTER TABLE users ADD COLUMN account_type text NOT NULL DEFAULT 'organizer'`
y `ADD CONSTRAINT users_account_type_check CHECK (account_type IN ('organizer','provider')) NOT VALID`;
`020_account_type_validar.sql` la valida. Las cuentas existentes quedan como `organizer`.

### Contratos

- `accountTypes = ["organizer", "provider"] as const`, `AccountType`.
- `registerSchema`: `accountType: z.enum(accountTypes).default("organizer")` (las apps antiguas no lo
  envían). `User.accountType`.
- `/auth/google` acepta `accountType` opcional: se usa **solo** si la cuenta se crea en ese momento.

### API

- `AuthService` (`apps/api/src/auth.ts`): guarda `account_type` al crear la cuenta (registro y Google)
  y lo devuelve en `toUser`. La cuenta demo es `organizer`.
- Guardia `AccountTypeGuard` con el decorador `@AccountType("organizer" | "provider")`, junto a
  `SessionGuard`. **Todos** los endpoints actuales de eventos, invitaciones, postales y
  notificaciones exigen `organizer`; los de proveedor (fase 3), `provider`. Un tipo equivocado
  responde 403 `wrong_account_type`, traducido. Se comprueba en el servidor, en un solo sitio (AGENTS §25).

### Interfaz

- Registro (`account.tsx`): dos opciones grandes (radio con etiqueta, navegables con teclado) antes
  del formulario y del botón de Google. `?tipo=proveedor` las preselecciona (enlace desde la landing).
- `App.tsx`: la navegación y la página de inicio dependen de `user.accountType`. El proveedor ve «Mi
  negocio», «Servicios», «Fotos», «Mi página pública», «Perfil». Las rutas de eventos lo llevan a su
  inicio.
- Landing (`landing.tsx`): una sección para proveedores («¿Ofreces servicios para eventos?
  Publícate gratis») con enlace a `/registro?tipo=proveedor`. Respeta el diseño aprobado: es un
  bloque nuevo, no un cambio de los existentes.

### Pruebas

- API: registro de cada tipo, valor por defecto sin `accountType`, Google con tipo.
- Seguridad: un proveedor recibe 403 en cada endpoint de eventos, invitaciones y postales (recorre la
  lista completa: así un endpoint nuevo olvidado se detecta), y un organizador en los de proveedor.
  No se puede cambiar el tipo por `PATCH /profile` (campo desconocido: 422).
- DB: valores permitidos de `account_type`.
- E2E `cuenta-proveedor.feature` (`@registro @proveedores @movil`): registrarse como proveedor; el
  proveedor no ve «Eventos»; el organizador no ve «Mi negocio».

---

## Fase 3 — Perfil, servicios y fotos del proveedor; su panel

**Objetivo**: el proveedor completa los datos de su negocio, sus servicios con precio y sus fotos, y
publica su página cuando cumple lo mínimo.

### Base de datos

`021_providers.sql` (tablas nuevas, sin datos: las restricciones van válidas desde el principio, pero
las de longitud con `ALTER TABLE … ADD CONSTRAINT …` para `limits.test.ts`):

```sql
CREATE TABLE provider_profiles (
  id uuid PRIMARY KEY,
  user_id uuid NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  slug text NOT NULL UNIQUE,
  business_name text NOT NULL,
  headline text NOT NULL DEFAULT '',
  description text NOT NULL DEFAULT '',
  phone text NOT NULL DEFAULT '',         -- E.164
  whatsapp text NOT NULL DEFAULT '',      -- E.164
  public_email text NOT NULL DEFAULT '',
  website text NOT NULL DEFAULT '',
  instagram_url text NOT NULL DEFAULT '',
  facebook_url text NOT NULL DEFAULT '',
  tiktok_url text NOT NULL DEFAULT '',
  address text NOT NULL DEFAULT '',
  city text NOT NULL DEFAULT '',
  region text NOT NULL DEFAULT '',
  postal_code text NOT NULL DEFAULT '',
  country text NOT NULL DEFAULT 'MX' CHECK (country ~ '^[A-Z]{2}$'),
  latitude double precision, longitude double precision,
  address_visibility text NOT NULL DEFAULT 'approximate' CHECK (address_visibility IN ('exact','approximate')),
  service_radius_km integer NOT NULL DEFAULT 25 CHECK (service_radius_km BETWEEN 0 AND 500),
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','published','suspended')),
  published_at timestamptz,
  cover_image_id uuid, logo_image_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK ((latitude IS NULL AND longitude IS NULL) OR (latitude BETWEEN -90 AND 90 AND longitude BETWEEN -180 AND 180))
);
CREATE TABLE provider_categories (
  provider_id uuid NOT NULL REFERENCES provider_profiles(id) ON DELETE CASCADE,
  category text NOT NULL CHECK (category IN (/* providerCategories */)),
  PRIMARY KEY (provider_id, category));
CREATE TABLE provider_services (
  id uuid PRIMARY KEY,
  provider_id uuid NOT NULL REFERENCES provider_profiles(id) ON DELETE CASCADE,
  title text NOT NULL, description text NOT NULL DEFAULT '',
  price_from_cents bigint CHECK (price_from_cents >= 0),
  currency text CHECK (currency ~ '^[A-Z]{3}$'),
  price_unit text CHECK (price_unit IN ('event','hour','person','item','day')),
  position integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK ((price_from_cents IS NULL) = (currency IS NULL)));
CREATE TABLE provider_images (
  id uuid PRIMARY KEY,
  provider_id uuid NOT NULL REFERENCES provider_profiles(id) ON DELETE CASCADE,
  service_id uuid REFERENCES provider_services(id) ON DELETE SET NULL,
  alt text NOT NULL DEFAULT '', width integer NOT NULL, height integer NOT NULL,
  position integer NOT NULL DEFAULT 0, created_at timestamptz NOT NULL DEFAULT now());
ALTER TABLE provider_profiles
  ADD CONSTRAINT provider_profiles_cover_fk FOREIGN KEY (cover_image_id) REFERENCES provider_images(id) ON DELETE SET NULL,
  ADD CONSTRAINT provider_profiles_logo_fk FOREIGN KEY (logo_image_id) REFERENCES provider_images(id) ON DELETE SET NULL;
CREATE TABLE provider_slug_history (slug text PRIMARY KEY, provider_id uuid NOT NULL REFERENCES provider_profiles(id) ON DELETE CASCADE);
CREATE TABLE provider_deleted_slugs (slug text PRIMARY KEY, deleted_at timestamptz NOT NULL DEFAULT now());
CREATE INDEX provider_services_provider_idx ON provider_services(provider_id, position);
CREATE INDEX provider_images_provider_idx ON provider_images(provider_id, position);
-- + ALTER TABLE … ADD CONSTRAINT …_max_length CHECK (char_length(col) <= N) por cada texto
```

- Trigger `updated_at` en `provider_profiles` y `provider_services`.
- Al borrar un perfil (cuenta borrada), su slug pasa a `provider_deleted_slugs` (trigger `BEFORE
  DELETE`) y sus slugs antiguos también: así responden 410 y no se reutilizan.
- Volumen nuevo `provider_uploads:/data/providers` en los tres compose. El nombre termina en
  `_uploads` porque el backup de la plataforma copia `*_uploads` (AGENTS §29). **Aviso**: el volumen
  actual `postcard_images` no sigue esa convención y quizá no se respalda; díselo al dueño del
  proyecto, no lo cambies en este plan.

### Contratos

- `providerCategories` (códigos estables, en inglés):
  `venue` (salones y locales), `planner` (organización de eventos), `wedding-planner`,
  `furniture-rental` (sillas, mesas, carpas), `catering`, `bakery` (pasteles y repostería),
  `dj`, `live-music`, `photo-video`, `decoration` (decoración y flores), `lighting-sound`,
  `entertainment` (animación y shows), `bar` (bebidas y barra), `beauty` (maquillaje y peinado),
  `attire` (vestidos y trajes), `transport`, `other`. Nombre de cada una en
  `providers.categories.<código>` en los 5 idiomas. Un test compara la lista con el `CHECK` de la
  migración (como `limits.test.ts`).
- `accountLimits`: `businessName: 150`, `headline: 150`, `providerDescription: 5000`,
  `serviceTitle: 150`, `serviceDescription: 2000`, `imageAlt: 255`, `addressLine: 200`, `city: 200`,
  `region: 200`, `postalCode: 10`, `url: 2048`, `providerSlug: 60`. Listas: `providerLimits =
  { categories: 5, services: 50, images: 40, imagesPerService: 10 }`.
- Esquemas `providerProfileSchema`, `providerServiceSchema`, `providerImageSchema`: textos con
  `.trim()` y sin recortar en silencio (422 `too_long`); teléfonos con la regla de §6.2 (E.164);
  URLs solo `https:` (y el host de cada red social en su campo); `slug` con `eventSlugPattern` y una
  lista de palabras reservadas (`buscar`, `categoria`, `mapa`, `nuevo`…).
- Tipos `ProviderProfile` (privado, para el panel), `ProviderPublic` (página pública) y
  `ProviderCard` (tarjeta de búsqueda: `slug, businessName, headline, categories, city, region,
  distanceKm?, coverUrl, priceFrom?`).
- `providerCompleteness(profile)`: lista de lo que falta para publicar (nombre, al menos una
  categoría, ubicación con coordenadas, al menos una foto y al menos un medio de contacto). La usan el
  panel y la API.

### API (`apps/api/src/providers.ts`, nuevo)

Todos con sesión y `@AccountType("provider")`:

| Endpoint | Qué hace |
|---|---|
| `GET /api/provider/profile` | El perfil (o `null` si no existe) |
| `PUT /api/provider/profile` | Lo crea o lo actualiza; slug sugerido desde el nombre como en los eventos (`events.ts`). Cambiar el slug de un perfil publicado guarda el anterior en `provider_slug_history` |
| `GET /api/provider/slug-available?slug=` | Como `events/slug-available` |
| `POST /api/provider/publish` / `unpublish` | Publicar exige `providerCompleteness` vacío; si no, 422 con un error por requisito |
| `GET/POST /api/provider/services`, `PUT/DELETE /api/provider/services/:id`, `PUT /api/provider/services/order` | Servicios |
| `POST /api/provider/images` `{ dataUrl, alt, serviceId? }`, `PATCH/DELETE /api/provider/images/:id`, `PUT /api/provider/cover`, `PUT /api/provider/logo` | Fotos |

- Fotos: copia el flujo de `apps/api/src/postcards.ts` (Sharp, `limitInputPixels`, tipo por contenido,
  sin EXIF, nombre generado por el servidor). Dos tamaños: 1600 px y 480 px de lado mayor. Máximo 3 MB
  por foto: el gateway (`services/gateway/default.conf.template`) abre `client_max_body_size 3m` solo
  para `/api/provider/images`. Cuotas (`providerLimits`) comprobadas en una transacción con
  `SELECT … FOR UPDATE` sobre el perfil, para que dos subidas a la vez no las superen.
- Todo identificador de servicio o foto se busca **junto con** el `provider_id` de la sesión: el de
  otra cuenta responde 404 (IDOR).
- `GET /api/public/providers/images/:id/:size`: solo de perfiles publicados (o del dueño con su
  sesión); `Cache-Control: public, max-age=31536000, immutable`, `X-Content-Type-Options: nosniff`.

### Interfaz (rutas privadas, con `noindex`)

Rutas nuevas: `/negocio`, `/negocio/servicios` y `/negocio/fotos`. Añádelas a `private_pages` en
`services/web/17-sites.sh` (si no, nginx responde 404) y al `Routes` de `App.tsx`.

- `/negocio`: datos del negocio en secciones (identidad, contacto, ubicación con el `LocationField`
  de la fase 1 más «Mostrar dirección exacta» y radio de servicio, redes). Lista de lo que falta para
  publicar, botón «Publicar» o «Despublicar», enlace a la página pública y «Compartir mi página».
- `/negocio/servicios`: tarjetas con título, descripción, precio «desde» (`Intl.NumberFormat` con
  la moneda) y unidad; añadir, editar, borrar y reordenar (botones subir/bajar, no solo arrastrar).
- `/negocio/fotos`: subir (validación en el cliente antes de enviar), texto alternativo
  **obligatorio** para publicar, elegir portada y logo, asignar a un servicio, reordenar, borrar con
  confirmación.
- Contador visible en textos largos; aviso al pegar un texto más largo (§6.3).

### Pruebas

- API: cada endpoint (éxito, 422 por campo, 404) en los 5 idiomas; reglas de publicación; cuotas
  (subida 41 → 422); slug ocupado (409) y cambio de slug.
- Seguridad: IDOR en servicios y fotos de otro proveedor; un organizador no entra (403); fotos de un
  borrador no se ven sin sesión; archivo que no es imagen y cuerpo de más de 3 MB rechazados; HTML y
  SQL en los textos llegan como texto.
- DB: restricciones, cascada al borrar la cuenta (perfil, servicios, fotos), `provider_deleted_slugs`,
  `updated_at`.
- E2E `perfil-proveedor.feature` (`@proveedores @movil`, más `@validacion` y `@limites`): completar
  el perfil, intentar publicar sin foto (mensaje), subir foto, publicar, editar un servicio.

---

## Fase 4 — Página pública del proveedor e indexación

**Objetivo**: cada perfil publicado tiene una página tipo landing, indexable y para compartir.

### Rutas

- Ruta traducida nueva en la tabla de idiomas (`packages/contracts/src/i18n.ts`): añade
  `providers` a `LocalizedPage` y a `paths` de cada idioma: es `/proveedores`, en `/vendors`,
  pt `/fornecedores`, de `/dienstleister`, fr `/prestataires`. Con eso, `locales-manifest.cjs` y
  `17-sites.sh` la publican y la ponen en el sitemap (la búsqueda pública de la fase 6).
- Perfil: `<ruta de providers>/<slug>` (`/proveedores/salon-luna`, `/pt/fornecedores/salon-luna`).

### Estado de cada URL (AGENTS §9.2), sin ejecutar JavaScript

En `services/web/default.conf.template` (generado desde `17-sites.sh` con las rutas del manifiesto),
una `location` para los perfiles con `auth_request` a un endpoint interno de la API:

- `GET /api/internal/seo/providers/:slug` (Host e idioma de la petición original):
  - publicado → 204 con `X-Seo-Title`, `X-Seo-Description` y `X-Seo-Image` (texto ya escapado para
    HTML por la API);
  - slug antiguo → 204 con `X-Seo-Redirect: <ruta nueva>` → nginx responde **301** en un salto;
  - borrado (`provider_deleted_slugs`) → 401 → nginx responde **410**;
  - inexistente, borrador o suspendido → 403 → nginx responde **404** con la página de no encontrada
    y `noindex`.
- `auth_request_set` recoge las cabeceras y `sub_filter` las pone en `<title>`, la descripción,
  `og:title`, `og:description`, `og:image` y `canonical` (mismo mecanismo que `$seo_title` hoy).
- El gateway bloquea `/api/internal/` desde fuera (`location /api/internal/ { return 404; }`): solo
  lo usa el contenedor `web` por la red interna.
- Sitemap: `GET /sitemap-providers.xml` (gateway → `GET /api/public/sitemap/providers.xml`) con los
  perfiles publicados del dominio y sus `hreflang`; `robots.txt` añade esa segunda línea `Sitemap:`.
- Prueba con la pila del CI (no con Vite): `curl -I` de un perfil publicado (200, `canonical`
  idéntico), un borrador (404), un slug antiguo (301), uno borrado (410), y que cada `<loc>` del
  sitemap responde 200.

### Contenido de la página (`packages/app/src/provider-page.tsx`)

`GET /api/public/providers/:slug` → `ProviderPublic`. Con `address_visibility = approximate`, la API
**no** devuelve la dirección ni las coordenadas exactas: solo ciudad y región, y un punto redondeado a
2 decimales (~1 km) que el mapa pinta como un círculo.

Secciones, siguiendo `DESIGN.md`:

1. Portada (imagen de portada, logo, nombre, frase, categorías como etiquetas, ciudad).
2. Contacto: WhatsApp (`https://wa.me/<número>?text=<providers.whatsappMessage>`, mensaje traducido
   con el nombre del negocio), llamar (`tel:`), correo (`mailto:`), sitio web y redes; «Compartir».
3. Servicios: tarjetas con foto, título, precio «desde» y descripción.
4. Galería en cuadrícula con visor a pantalla completa (navegable con teclado, `Esc` cierra, foco
   devuelto al cerrar, `alt` del proveedor).
5. Sobre nosotros (descripción como texto plano: saltos de línea sí, HTML nunca).
6. Ubicación: mapa y `MapLinks` de la fase 1 (exacta) o zona aproximada.

Datos estructurados `LocalBusiness` en JSON-LD (nombre, dirección según visibilidad, teléfono, URL,
imagen), generados desde los datos y escapados.

### Pruebas

- API: perfil público (publicado, borrador 404, aproximado sin dirección exacta), sitemap.
- Seguridad: la respuesta pública no incluye el correo de la cuenta, el `user_id` ni datos de un borrador.
- E2E `pagina-proveedor.feature` (`@proveedores @movil`): ver la página publicada, abrir WhatsApp con
  el mensaje, la galería con teclado; y en `features/plataforma/indexacion.feature`, los estados
  200/301/404/410 y el sitemap (`@api`).

---

## Fase 5 — Servicio de búsqueda `search` (Go)

**Objetivo**: `GET /api/search/providers` responde en menos de 200 ms con filtros por texto,
categoría y distancia, desde un servicio separado y de solo lectura.

### Preparación de PostgreSQL (superusuario, una sola vez)

El rol `api` no puede crear extensiones ni roles. Igual que `admin_ro` (ver
`services/postgres/initdb/01-admin-role.sh` y `services/postgres/sql/admin-role.sql`):

- `services/postgres/initdb/02-search.sh` (volúmenes nuevos: local y CI) y
  `services/postgres/sql/search-bootstrap.sql` (volúmenes existentes, a mano):
  `CREATE EXTENSION IF NOT EXISTS pg_trgm; CREATE EXTENSION IF NOT EXISTS unaccent;`,
  `CREATE ROLE search_ro LOGIN PASSWORD …`, `GRANT CONNECT …`, `GRANT USAGE ON SCHEMA public …`.
- Variable nueva `SEARCH_DB_PASSWORD` (en `compose*.yml`, `.env.ci` y la tabla de variables del
  `README.md`). **Antes de desplegar esta fase** el dueño del proyecto la define en Coolify y ejecuta
  una vez en producción `search-bootstrap.sql`. Documenta el comando exacto en el PR.
- La migración comprueba que existen las extensiones y, si no, falla con un mensaje claro
  (`RAISE EXCEPTION 'Falta ejecutar services/postgres/sql/search-bootstrap.sql'`).

### Tabla de búsqueda (migración `022_provider_search.sql`)

- Función inmutable `f_unaccent(text)` (envoltorio de `unaccent('unaccent', $1)`).
- Tabla `provider_search` (una fila por perfil **publicado**): `provider_id`, `slug`,
  `business_name`, `headline`, `city`, `region`, `country`, `categories text[]`, `latitude`,
  `longitude` (las públicas: redondeadas si es aproximada), `service_radius_km`, `price_from_cents`
  (el menor de sus servicios) y `currency`, `cover_image_id`, `name_norm` (minúsculas sin acentos),
  `document tsvector` (pesos: nombre A, frase y servicios B, descripción y ciudad C;
  configuración `simple` sobre `f_unaccent`, porque el contenido llega en cualquier idioma),
  `published_at`, `updated_at`.
- Índices: GIN sobre `document`, GIN `gin_trgm_ops` sobre `name_norm`, GIN sobre `categories`,
  btree sobre `(latitude, longitude)`.
- Función `refresh_provider_search(p uuid)` (borra la fila si el perfil no está publicado; si lo está,
  la reescribe) y triggers `AFTER INSERT OR UPDATE OR DELETE` en `provider_profiles`,
  `provider_categories`, `provider_services` y `provider_images` que la llaman. Así la búsqueda está
  al día en la misma transacción, sin colas ni sincronización.
- `GRANT SELECT ON provider_search TO search_ro` (con el patrón `IF EXISTS` de la migración 014).
  `search_ro` no puede leer ninguna otra tabla.

### El servicio (`services/search/`)

```
services/search/
  go.mod                 # Go: última versión estable, comprobada en go.dev
  cmd/search/main.go     # configuración, servidor, apagado ordenado
  internal/api/          # handlers, validación, Problem Details, idioma, límite por IP
  internal/store/        # consultas a PostgreSQL (pgx v5, la última estable)
  internal/catalog/      # catálogos de idioma y límites embebidos (embed)
  openapi.yaml           # contrato de /api/search/*
  Dockerfile             # multi-stage → binario estático en imagen mínima, sin root
```

Solo la biblioteca estándar más `pgx`; enrutado con `net/http` (patrones de Go 1.22+).

| Endpoint | Respuesta |
|---|---|
| `GET /api/search/providers?q=&categories=venue,dj&lat=&lng=&radiusKm=&sort=relevance\|distance&limit=20&cursor=` | `{ items: ProviderCard[], nextCursor: string\|null, facets: { categories: { [código]: número } } }` |
| `GET /api/search/suggest?q=` | Hasta 8 `{ type: "provider", slug, name }` o `{ type: "category", code }` (opcional; puede quedar para después) |
| `GET /healthz` | 200 sin consultar nada (healthcheck de Docker) |

Reglas:

- Validación estricta: parámetros desconocidos → 400; `q` de 100 caracteres como máximo
  (`accountLimits.search`); `limit` 1–50 (20 por defecto); `radiusKm` 1–200 (30 por defecto, solo con
  `lat` y `lng`); categorías de la lista. Errores en Problem Details (AGENTS §22) traducidos.
- Consulta: `websearch_to_tsquery('simple', f_unaccent(q))` **o** `similarity(name_norm, q) > 0.3`
  (errores de escritura en el nombre). Si `q` coincide con el nombre traducido de una categoría en
  cualquier idioma («sillas», «chairs», «Stühle»…), se añade esa categoría como refuerzo, con los
  catálogos embebidos. Distancia con la fórmula del haversine y un filtro previo por recuadro
  (latitud y longitud `BETWEEN`) para usar el índice.
- Orden por relevancia (`ts_rank_cd` + similitud del nombre, con desempate por `provider_id`) o por
  distancia. Paginación por cursor opaco (base64 de los valores de orden y el `provider_id`).
- **Idioma** y **límites** desde una sola fuente: el build de `@tuevento/contracts` genera
  `dist/shared.json` (idiomas, `hostedBy`, `accountLimits`, `providerCategories`, límites de búsqueda,
  catálogos `search.*` y `validation.*`) y el Dockerfile lo copia para embeberlo. La regla de
  `localeForRequest` se reescribe en Go y se prueba contra un archivo de casos
  (`packages/contracts/src/locale-cases.json`) que también prueba la versión TypeScript: si una cambia
  sin la otra, falla.
- Seguridad y operación: IP real de `X-Real-IP` (la pone el gateway); límite de 30 peticiones por
  10 s y por IP (429 con `Retry-After`); pool de 4 conexiones y `statement_timeout` de 2 s; logs JSON
  con `log/slog` y `requestId` (AGENTS §30); `SIGTERM` cierra en menos de 10 s; `GOMEMLIMIT` al 90 %
  de `mem_limit: 64m`; `Cache-Control: public, max-age=60` (solo datos públicos).
- Gateway: `upstream search_upstream` y `location /api/search/ { … proxy_pass http://search_upstream; }`
  antes de `location /api/`.

### CI y despliegue

- `ci.yml`, job Verificar: `actions/setup-go` (versión de `go.mod`), `go vet`, `go test`,
  `govulncheck`; Trivy sobre 6 imágenes. Job Seguridad: `go` en los idiomas de CodeQL. Escenarios:
  el servicio en `compose.ci.yml`. Cada paso nuevo con `timeout-minutes`.
- `deploy.yml`: `search` en la matriz de `publicar`.
- `scripts/check-versions.mjs`: la versión de Go de `go.mod` y la de la imagen `golang` del Dockerfile
  coinciden.
- `scripts/test-all.mjs`: añade las pruebas de Go como suite.

### Pruebas

- Go: unidad (validación, cursor, idioma contra `locale-cases.json`, catálogos) e integración contra
  el PostgreSQL de pruebas (la misma base temporal que `tests/db`, o la del compose de CI).
- DB: los triggers mantienen `provider_search` (publicar, despublicar, cambiar categoría, borrar un
  servicio, borrar la cuenta); `search_ro` no lee `users` ni ninguna otra tabla, ni escribe.
- API (`tests/api/test-search.mjs`, en `test:endpoints`): filtros, orden, paginación sin duplicados,
  errores en los 5 idiomas, 429; las respuestas cumplen `openapi.yaml`.
- Datos de prueba únicos: cada prueba crea sus proveedores con un nombre con un sufijo aleatorio y en
  coordenadas propias, y busca por ese sufijo o esa zona. Nunca depende de lo que haya en la base.

---

## Fase 6 — Página de búsqueda y tarjetas

**Objetivo**: cualquiera (con o sin cuenta) busca proveedores en `/proveedores` (y sus traducciones).

- Componente `ProviderSearch` (reutilizable en la fase 7) en `packages/app/src/provider-search.tsx`:
  - texto libre; categorías como casillas o etiquetas con su contador (`facets`); ubicación: «Cerca
    de mí» (geolocalización) o una ciudad (buscada con `/api/geo/search` **al pulsar**, no al escribir);
    radio (10, 30, 50, 100 km); orden.
  - Los filtros viven en la URL (`?q=&cat=&lat=&lng=&r=`) para compartir y volver atrás; el
    `canonical` es la ruta sin parámetros.
  - Resultados como `ProviderCard`: portada (480 px, `loading="lazy"`, `alt`), nombre, frase,
    categorías, ciudad, distancia («a 12 km») y precio «desde». Toda la tarjeta enlaza al perfil.
  - «Cargar más» con `nextCursor` (no scroll infinito: accesible y medible).
  - Estados: cargando (esqueleto sin saltos de layout), vacío (con sugerencia de ampliar el radio o
    quitar filtros), error con reintento, sin conexión (en las apps).
  - Opcional: vista de mapa con los resultados (MapLibre, cargado aparte).
- Cliente (`packages/client`): `searchProviders(params)` y `geoSearch(q)`.
- Enlaces a la búsqueda desde la landing y el pie de página.
- E2E `busqueda-proveedores.feature` (`@busqueda @movil`): por categoría, por ubicación (un proveedor
  dentro y otro fuera del radio), texto con una errata, estado vacío, «Cargar más» y `@i18n` con los
  nombres de categoría en los 5 idiomas.

---

## Fase 7 — Botón «Buscar proveedores» en el evento

**Objetivo**: al crear o editar un evento, una invitación opcional a buscar proveedores cerca del lugar.

- En `EventEditor` (`event-pages.tsx`), después del campo de lugar, una tarjeta discreta: «¿Necesitas
  salón, sillas, música…? Busca proveedores cerca de tu evento» y el botón «Buscar proveedores». En
  el detalle del evento (`EventDetail`), la misma tarjeta.
- Abre un panel lateral (`<dialog>` modal: foco atrapado, `Esc` cierra, foco devuelto al botón) con
  `ProviderSearch` y la ubicación del evento precargada: sus coordenadas si las tiene; si no, su
  texto geocodificado. **El formulario del evento no se pierde**: el panel no navega.
- Las tarjetas abren el perfil dentro del mismo panel (vista de detalle con «Volver a los
  resultados») y «Abrir página completa» en otra pestaña (web) o en la app.
- «Ahora no» oculta la tarjeta para ese evento (preferencia del dispositivo en `localStorage`, envuelta
  en `try/catch`: es una comodidad, no un dato).
- Solo para organizadores. Sin conexión (fase 8): el botón queda desactivado con su motivo.
- E2E `evento-buscar-proveedores.feature` (`@eventos @proveedores @movil`): el botón abre la búsqueda
  con la ubicación del evento, se ven tarjetas, se cierra y el formulario conserva lo escrito.

---

## Fase 8 — Trabajo sin conexión en las apps

**Objetivo**: sin red, el usuario abre la app, consulta sus eventos, invitados y respuestas (o su
negocio, si es proveedor), sigue creando y editando, y todo se envía solo al volver la conexión.

Divídela en tres PR: 8a (API), 8b (cliente y almacenamiento) y 8c (pantallas y pruebas móviles).

### 8a — API de sincronización

- Migración: `updated_at` y `version integer NOT NULL DEFAULT 1` en `events`, `invitations` y
  `members` (y `version` en las tablas de proveedor). Trigger que suma 1 a `version` y actualiza
  `updated_at` en cada `UPDATE`. Columnas nuevas en tablas con datos: `ADD COLUMN … DEFAULT` (sin
  reescritura) y restricciones `NOT VALID` + validación posterior; Squawk debe pasar.
- `sync_tombstones(user_id, entity, entity_id, deleted_at)`, rellenada por triggers `AFTER DELETE`
  (incluidos los borrados en cascada), purgada a los 90 días.
- `GET /api/sync/changes?cursor=&limit=100` (con sesión): lo cambiado desde el cursor, del usuario de
  la sesión, por páginas: `{ events, invitations, notifications, provider?, services?, images?,
  deleted: [{ entity, id }], nextCursor, hasMore }`. Sin cursor, todo (también por páginas). Un cursor
  de más de 90 días → 410 `sync_cursor_expired` (el cliente vuelve a descargar todo).
- Escrituras repetibles:
  - **`Idempotency-Key`** (UUID) en todo `POST`, `PUT`, `PATCH` y `DELETE` de datos propios: tabla
    `idempotency_keys(user_id, key, method, path, status, response jsonb, created_at)`, 24 h. Repetir
    la misma clave devuelve la misma respuesta sin repetir el efecto (ni los correos a invitados).
  - **ID del cliente** al crear: `POST /api/events` e invitaciones aceptan `id` (UUIDv7) opcional. Si
    ese id ya existe y es del mismo usuario, devuelve lo guardado; si es de otro, 409.
  - **Control de versión**: `PATCH`/`PUT` aceptan `If-Match: "<version>"`. Si no coincide, 409
    `version_conflict` con la versión actual en el cuerpo. Sin `If-Match` (web y apps antiguas), se
    comporta como hoy.
- Pruebas: API (páginas sin huecos ni duplicados, tombstones, cursor caducado, repetición con la misma
  clave, conflicto de versión, id del cliente repetido y de otra cuenta), seguridad (`sync/changes`
  nunca devuelve datos de otra cuenta; la clave de idempotencia de otro usuario no devuelve su
  respuesta), DB (triggers de versión y tombstones, también en cascada).

### 8b — Cliente y almacenamiento en el teléfono

En `packages/client/src/offline/` (sin DOM ni Capacitor: se prueba con `node:test`):

- `OfflineStore`: interfaz `get/set/delete/list/clear` por colección.
- `Outbox`: cola ordenada de operaciones `{ id, idempotencyKey, method, path, body, baseVersion,
  entity, createdAt, attempts, state: "pending"|"failed"|"conflict", error? }`.
- `SyncEngine`: al arrancar, al volver la red y al volver la app a primer plano: primero envía la cola
  **en orden** (una creación va antes que sus invitaciones), después descarga los cambios. Error de red
  → para y reintenta más tarde (espera exponencial de 2 s a 5 min); 409 → `conflict`; 4xx de
  validación → `failed` con el mensaje traducido; 401 → borra todo y pide entrar.
- `OfflineEventApi` (extiende `EventApi`, mismos métodos y firmas): lecturas con red primero (timeout
  de 8 s) y la copia local si no hay; escrituras sin red aplicadas a la copia local (métricas
  recalculadas con `countMetrics` de contracts) y puestas en la cola. Creaciones con UUIDv7 generado
  en el teléfono.
- Pruebas unitarias con un almacén en memoria y un transporte falso: orden de la cola, reintentos,
  conflicto, idempotencia, borrado al cerrar sesión. Añade `packages/client/src/**/*.test.ts` al
  comando `test:unit` de `package.json`.

En la app (`apps/web/src/native.ts`):

- Almacén IndexedDB con cada registro cifrado con AES-GCM 256 (WebCrypto). La clave, aleatoria por
  usuario, se guarda en `SecureStorage` (`tueventofun:offline-key:<userId>`). Al cerrar sesión, al
  recibir 401 o al entrar con otra cuenta: se borran la base y la clave.
- Red: `@capacitor/network` (versión compatible con Capacitor 8, comprobada). `Runtime` gana
  `network?: { online(): boolean; onChange(cb): () => void }` y `offlineStore?: OfflineStore`. En la
  web quedan sin definir y todo funciona como hoy.
- Fotos de postales y avatares ya vistos: en `CacheStorage`, 50 MB como máximo con descarte del más
  antiguo (opcional dentro de 8b).

### 8c — Pantallas y pruebas móviles

- `App.tsx`: si `config()` o `me()` fallan por red y hay un usuario guardado, la app arranca sin
  conexión con él (hoy mostraría un error).
- Aviso fijo: «Sin conexión. Tus cambios se guardan en el teléfono y se enviarán al volver la red».
  Contador de cambios pendientes y «Sincronizar ahora».
- Cada evento o invitado pendiente lleva la marca «Pendiente de enviar». Una invitación creada sin red
  no tiene enlace todavía (el token lo genera el servidor): «Compartir» desactivado con su motivo.
- Avisos antes de acciones que mandan correos al sincronizar (cancelar un evento, cambiar la fecha).
- Conflictos: pantalla con «Tu versión» y «Versión guardada» lado a lado; «Quedarme con la mía»
  (reenvía con la versión nueva) o «Usar la guardada».
- Solo con conexión, desactivado y con su motivo: entrar, registrarse, Google, contraseña, subir
  fotos, comprobar si una dirección está libre, búsqueda de proveedores, geocodificación.
- Textos `offline.*` en los 5 idiomas, plurales incluidos («1 cambio pendiente» / «3 cambios…»).
- E2E `sin-conexion.feature`, solo en las apps (en local: `npm run e2e:movil`; móvil no corre en el
  CI). Android: modo avión con `adb shell cmd connectivity airplane-mode enable|disable` desde la
  interfaz `ui` de los pasos. iOS: el simulador no puede quitarse la red por línea de comandos; el
  build de pruebas (`<appId>.pruebas`) incluye un interruptor «simular sin conexión» que **no** existe
  en el build de publicación (compruébalo con `scripts/check-test-only.mjs`). La etiqueta de un
  escenario que solo corre en las apps (`@solo-movil`) no existe todavía: documéntala en `docs/E2E.md`
  y avisa de ella en el PR. Escenarios: abrir la app sin red y ver los eventos; crear un evento sin red
  y verlo en la web al volver la red; editar sin red un invitado que otra persona cambió (conflicto).
- Publicar una versión nueva de la app con `mobile.yml` y comprobar que la versión anterior sigue
  funcionando contra la API nueva.

---

## Fase 9 — Moderación en el panel de administración (opcional)

El panel (`apps/admin`, solo en español) entra con `admin_ro`, de solo lectura. Para no darle
escritura general:

- Lista de proveedores (nombre, ciudad, estado, fecha de publicación, enlace a la página).
- «Suspender» y «Reactivar» con un motivo: la API crea una función `SECURITY DEFINER
  admin_set_provider_status(provider_id, status, reason, admin)` que cambia solo `status` y escribe en
  `admin_audit_log(admin, action, target, reason, created_at)` (AGENTS §25), con `EXECUTE` para
  `admin_ro` y nada más.
- Pruebas: DB (`admin_ro` solo puede ejecutar esa función; queda registrada) y `admin.feature`.

---

## 3. Riesgos y cómo se mitigan

| Riesgo | Mitigación |
|---|---|
| Nominatim limita o bloquea por uso | Caché de 30 días, 1 petición/s, búsqueda solo al pulsar, `GEOCODER_URL` para un Nominatim propio, y el punto se puede fijar sin geocodificar (enlace o mapa) |
| Fallo de `search` | Servicio aparte: si cae, falla solo la búsqueda; el resto de la app sigue. Healthcheck y Uptime Kuma |
| La búsqueda deja de bastar (decenas de miles de perfiles, búsqueda por sinónimos) | El contrato `openapi.yaml` no depende del motor: se puede cambiar a Meilisearch detrás del mismo servicio, alimentado por la misma tabla |
| Datos personales en el teléfono | Cifrados, con la clave en el llavero o el Keystore, borrados al salir |
| Conflictos al sincronizar | Versión por fila y 409; el usuario elige; nada se sobrescribe en silencio |
| Apps publicadas sin los campos nuevos | Todo campo nuevo es opcional y se conserva si no llega; probado con la versión anterior de la app |
| Páginas públicas con estado incorrecto en Search Console | `auth_request` decide 200/301/404/410 en el servidor, probado con `curl` en la pila del CI |
| Pasos manuales en producción (fase 5) | Un mensaje claro si faltan, documentados en el PR y ejecutados por el dueño del proyecto antes de desplegar |

## 4. Fuera de este plan

Pagos o planes de pago para proveedores, reseñas y valoraciones, mensajería o formulario de contacto,
guardar proveedores en un evento, verificación de identidad de proveedores, modo sin conexión en la
web, notificaciones push, autocompletar direcciones y el contrato OpenAPI del resto de la API (hoy no
existe; esta propuesta solo lo añade para `search`).
