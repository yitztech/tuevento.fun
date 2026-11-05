# Relevo: unificar el nuevo diseño en web, Android e iOS

Fecha del relevo actualizado: 2026-11-05. Estado: **migración unificada completada, mezclada (PR #65) y desplegada en producción; verificada con pruebas unitarias, E2E de navegador y compilaciones nativas Debug/Simulador. Quedan pendientes la firma de distribución y la validación en dispositivos físicos**.

## Encargo y alcance

La persona propietaria pidió que el diseño aprobado en `apps/new-design` sea el diseño principal de la web y de las apps móviles, y retirar por completo el diseño anterior. Se conservaron el comportamiento real, los datos, los contratos API, los 16 temas de invitación, la accesibilidad (WCAG 2.2 AA) y los 5 idiomas (`es`, `en`, `pt`, `de`, `fr`), sin conectar los formularios ni datos ficticios del prototipo.

## Estado exacto del código

- Rama de trabajo: `feature/diseno-unificado-web-movil`, creada desde `373cd77` (`mejora/new-design-experiencia`), mezclada en `main` con el PR #65 (`db02f6a`).
- Los 30 archivos `.webp` de `apps/web/public/site/photos/` y los recursos nativos regenerados (`apps/web/android/`, `apps/web/ios/`) están versionados y desplegados.

## Trabajo completado en esta rama

1. **Superficie pública (`packages/app/src/ui/site/`, `packages/app/src/site.css`, `packages/app/src/downloads.tsx`):**
   - Fotografías editoriales en `apps/web/public/site/photos/` con variantes WebP (`480w`, `640w`, `960w`, `1280w`, `1920w`) y `srcset` en `packages/app/src/ui/site/photos.ts` y `packages/app/src/downloads.tsx`, documentadas en `docs/ASSETS.md`.
   - Corrección de las 4 advertencias de accesibilidad de Biome en `packages/app/src/ui/site/home-designs.tsx`, `packages/app/src/ui/site/rsvp-card.tsx`, `packages/app/src/ui/site/phone-frame.tsx` y `packages/app/src/site.css` (`<fieldset>` y `<figure>` semánticos; `npx biome lint packages/app/src/ui/site` con 0 advertencias y 0 errores).
   - Alineación del CTA final en `packages/app/src/ui/site/home-newsletter.tsx` con `apps/new-design`.
2. **Panel compartido, páginas públicas de invitación y mapa (`packages/app/src/styles.css`, `packages/app/src/tailwind.css`, `packages/app/src/components.tsx`, `packages/app/src/location.tsx`):**
   - Unificación de `:root` con los tokens cálidos del nuevo diseño (`--primary: #a63f30`, `--primary-deep: #8a3225`, `--ink: #3d2a25`, `--muted: #765f58`, `--line: #f0d8cb`, `--line-strong: #ecd2c4`, `--surface-soft: #f9e6dc`, `--surface-soft-hover: #fbe3d6`, fondo cálido `#fff6f2`).
   - Tipografía editorial `Playfair Display Variable` en titulares (`h1, h2, h3`) y `Manrope Variable` en cuerpo y controles, manteniendo `@font-face` de `Bricolage Grotesque Variable` para conservar las postales existentes de usuarios que eligieron la fuente `bricolage`.
   - Eliminación de todos los colores hexadecimales heredados azul frío/pizarra en controles, tablas, tarjetas, estados vacíos, avisos, modales, pestañas, RSVP público, modo pantalla TV y marcadores de MapLibre (`#a63f30`), preservando intactas las 16 variantes de temas de invitación (`.theme-gold` a `.theme-pastel`).
3. **Panel de administración (`apps/admin/src/web/styles.css`):**
   - Unificación de variables CSS en `:root` (claro y oscuro) con la paleta terracota (`#a63f30`, `#fff6f2`, `#3d2a25`, `#765f58`, `#f0d8cb`, `#ea8659`).
4. **Identidad web y recursos nativos Android e iOS (`apps/web/index.html`, `apps/web/public/favicon.svg`, `scripts/native-assets.mjs`, `apps/web/android/`, `apps/web/ios/`):**
   - `<meta name="theme-color" content="#fff6f2"/>` en `apps/web/index.html`.
   - Actualización de `apps/web/public/favicon.svg`, `scripts/native-assets.mjs` y `apps/web/android/app/src/main/res/values/{colors,ic_launcher_background}.xml` + `drawable/ic_launcher_background.xml` al emblema terracota cálido sobre `#fff6f2`.
   - Regeneración de iconos y pantallas de arranque (`node scripts/native-assets.mjs`) y sincronización de `apps/web/dist` hacia Android e iOS (`cd apps/web && npx cap sync`).
5. **Documentación del sistema de diseño (`DESIGN.md`):**
   - Actualización del frontmatter y secciones de color, tipografía y componentes en `DESIGN.md` para reflejar el sistema unificado.

## Verificaciones ejecutadas y resultados

- `npx biome lint packages/app/src/ui/site`: **OK** (20 archivos revisados, 0 errores, 0 advertencias).
- `npm run lint`: **OK** (sin errores en todo el repositorio).
- `npm run typecheck`: **OK** (`@tuevento/admin`, `@tuevento/api`, `@tuevento/new-design`, `@tuevento/web`, `@tuevento/client`, `@tuevento/contracts`).
- `npm run test:unit`: **OK** (paridad de versiones en 10 workspaces, aislamiento de servicios de prueba, paridad de los 5 catálogos de idioma, pruebas de contratos, API, cliente offline y 21 pruebas de `@tuevento/admin`).
- `npm run build`: **OK** (compilación completa de `contracts`, `client`, `api`, `web` y `admin`).
- `npm run test:landing`: **OK** (8/8 comprobaciones funcionales en español e inglés, 0 errores, 5/5 capturas en escritorio, móvil y tablet con `overflow: false` y `failedImages: 0`).
- `QA_SKIP_BASE=1 npm run test:browser`: **OK** (17/17 flujos reales de extremo a extremo — demo, cambio de idioma por dominio, 6 temas con vista previa, registro con validación y avatar, creación y edición de evento, familia, invitación pública, RSVP con SSE en vivo, filtros, modo pantalla TV 1920 px, notificaciones y persistencia de sesión — con 0 errores y 7/7 comprobaciones de viewport con `overflow: false`).
- Compilación Android Debug (`cd apps/web/android && JAVA_HOME="/Applications/Android Studio.app/Contents/jbr/Contents/Home" ANDROID_HOME="$HOME/Library/Android/sdk" ./gradlew assembleDebug`): **BUILD SUCCESSFUL** (`apps/web/android/app/build/outputs/apk/debug/app-debug.apk`).
- Compilación iOS Simulador (`xcodebuild -project apps/web/ios/App/App.xcodeproj -scheme App -sdk iphonesimulator -configuration Debug build CODE_SIGNING_ALLOWED=NO`): **BUILD SUCCEEDED**.

## Pendientes fuera de la compilación local

1. **Dispositivos físicos y distribución móvil:** las compilaciones verificadas aquí son el APK Debug de Android y el `.app` de simulador iOS. Para distribución pública o TestFlight se requiere compilar con `VITE_PUBLIC_ORIGIN` de producción y credenciales de firma (`keystore` de release en Android; certificado de distribución y perfil de aprovisionamiento en iOS según `docs/MOBILE-CICD.md`), además de validación visual y funcional en dispositivos físicos.
