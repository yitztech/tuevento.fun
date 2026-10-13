# Verificación local de TuEventoFun

Validación del 13 de octubre de 2026, contra Docker Compose en `http://localhost:5187`. El alcance es una aplicación local real conectada a PostgreSQL. No es un despliegue público.

## Resultados

| Capa | Resultado | Cobertura |
| --- | --- | --- |
| Compilación | Correcta | Contratos, cliente, Nest/Fastify y React/Vite. |
| TypeScript | Sin errores | Todos los workspaces con comprobación de tipos. |
| Contratos | 9 pruebas aprobadas | Invitaciones, miembros, RSVP, registro, fechas, métricas y ES/EN. |
| API y PostgreSQL | 17 controles aprobados | Sesiones, CSRF, validación, aislamiento, CRUD, notas privadas, RSVP, SSE, perfil, avatar y traducciones. |
| Navegador | 16 recorridos aprobados | Demo, registro con avatar, eventos, familias, enlaces, RSVP, métricas en vivo, notificaciones, edición e inicio/cierre de sesión; ES/EN. |
| Responsive | Sin desbordamiento horizontal | 390, 768, 1512 y 1920 px. |
| JavaScript | 0 errores capturados | Recorrido completo del navegador. |
| Persistencia | Conservada | 2 eventos de prueba idénticos antes y después de reiniciar PostgreSQL. |
| Recuperación de proxy | Correcta | Backend recreado sin reiniciar Nginx; `/api/health` vuelve a responder por el frontend. |
| Dependencias npm | 0 vulnerabilidades reportadas | Auditoría ejecutada sobre el lockfile instalado. |

La validación de Google real necesita un cliente OAuth configurado. Las pruebas no afirman funcionamiento en una Smart TV física ni en un instalador desktop; prueban viewport 1920 × 1080 y pantalla completa del navegador.

## Evidencia reproducible

```bash
npm ci
npm run build
npm run typecheck
npm test
npm run test:api
npx playwright install chromium
npm run test:browser
```

Los tests de API y navegador crean cuentas propias con credenciales aleatorias en memoria y limpian las cuentas al terminar contra el stack local. `HEADED=1` muestra el navegador. Los resultados JSON se generan localmente y se excluyen de Git.

Capturas de `qa-artifacts/`:

- `dashboard-desktop.png`, `dashboard-mobile.png`, `dashboard-en-desktop.png`, `dashboard-en-mobile.png`.
- `templates-desktop.png`, `templates-mobile.png`.
- `event-editor-desktop.png`, `event-editor-en.png`.
- `event-detail-desktop.png`, `event-detail-mobile.png`, `event-detail-tablet.png`.
- `rsvp-mobile.png`, `rsvp-en-mobile.png`, `tv-1920.png`.

`api-results.json` y `browser-results.json` contienen los controles ejecutados. `persistence-results.json` registra la comparación de eventos de prueba después de reiniciar PostgreSQL. Las capturas contienen exclusivamente datos sintéticos.

## Revisión visual

La revisión externa de Impeccable se interrumpió dos veces por límite de agentes. Sus hallazgos recibidos y la revisión final realizada en el chat se documentan en `DESIGN-REVIEW.md`; no se presenta como aprobación independiente. El sistema visual quedó en `DESIGN.md` y `.impeccable/design.json`.

La prueba de persistencia encontró un 502 por dirección obsoleta del backend en Nginx. Se corrigió con DNS dinámico y un healthcheck que también comprueba la API a través del frontend; se volvió a ejecutar el recorrido completo después de la corrección.

## Pendientes externos

- Configurar `GOOGLE_CLIENT_ID` y probar inicio de sesión con el proyecto Google del usuario.
- Publicación: dominio, HTTPS y operación del servicio. Los enlaces localhost no se abren desde otros dispositivos.
- Empaquetar un host Electron/Tauri si se desea una app nativa; los paquetes y la entrada reutilizable ya están preparados.

## Landing de captación

La nueva ruta pública `/` pasó 8 controles de navegador: apertura sin API ni demo automática, menú/FAQ, idioma ES/EN persistente, muestra RSVP sin escrituras, registro con diseño elegido, panel en `/app`, acceso existente con intención de crear evento y demostración sin registro. Las cinco capturas completas en 390, 768 y 1512 px no muestran desbordamiento y todas las imágenes cargaron.

La regresión general del panel volvió a pasar sus 16 recorridos después de trasladar el resumen a `/app`. TypeScript, compilación y 9 pruebas de contratos también pasaron. No hubo errores JavaScript capturados.

Resultados: `qa-artifacts/landing-results.json`. Capturas: `landing-desktop.png`, `landing-mobile.png`, `landing-tablet.png`, `landing-en-desktop.png`, `landing-en-mobile.png`, y los dos primeros viewports. Prueba: `npm run test:landing`. Revisión visual independiente: `ship` en `docs/LANDING-DESIGN-REVIEW.md`; sistema heredado conservado, reglas de superficie documentadas en `docs/LANDING.md`.

## Ampliación Android/iOS y métricas — 2026-10-13

- Build TypeScript/Vite, 11 pruebas de contratos, 17 API existentes, 9 plataforma/permisos/PKCE.
- Navegador: 16 recorridos del panel y 8 de landing, ES/EN, sin errores ni overflow. Administración y descargas: 1512 y 390 px, filtro de periodo, rol dueño, estado sin publicaciones y traducción EN.
- Android: `assembleDebug` completado con JDK 21/SDK 36. Artefacto local de prueba, no distribución firmada.
- iOS: `xcodebuild ... -sdk iphonesimulator ... CODE_SIGNING_ALLOWED=NO build` completado. No prueba de dispositivo físico ni firma de distribución.
- Workflows validados con `actionlint`; todavía no ejecutados en GitHub (sin remoto definido).
- `npm audit`: cero vulnerabilidades después de sustituir el uuid transitivo obsoleto del parser Xcode por 11.1.1 mediante override.
- Pendientes externos confirmados: dominio HTTPS, repositorio, cuenta dueña, firma Android/Apple y credenciales Google. No hay descargas públicas ni aprobación de tiendas.
