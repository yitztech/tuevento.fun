# Paletas globales

La paleta global solo se cambia en el panel de administración (subdominio `admin`, pestaña Diseño): la paleta inicial Terracota o cuatro propuestas de marca: Fucsia, Ciruela y Ámbar; Ciruela y Champagne; Mandarina y Frambuesa; Frambuesa y Vainilla. Guardar confirma el cambio global; no hay vista previa. Una respuesta fallida conserva la selección sin guardarla y muestra el error.

La migración `034_site_palette.sql` crea una sola fila, con `terracotta` por defecto, y un `CHECK` que limita los identificadores. `GET /api/site-palette` es público y no se cachea. La API de la web no tiene ninguna ruta de escritura: el dueño del sitio (`is_owner`) tampoco puede cambiarla. El panel escribe con `PUT /api/palette` de su propio servicio, con sesión del panel, y la función `admin_set_site_palette` (migración 035), porque su rol `admin_ro` no escribe tablas. Valida la entrada con una lista de identificadores; nunca recibe CSS. El contrato del endpoint público está en [openapi/site-palettes.yaml](openapi/site-palettes.yaml); este archivo documenta solo la funcionalidad de paletas, no toda la API.

La tabla de valores e identificadores está en `packages/contracts/src/site-palettes.ts`. La interfaz deriva de ella sus variables CSS; `terracotta` elimina las variables de vista previa para conservar los estilos existentes. El sitio público vuelve a heredar los tokens generales porque `.site-surface` los redefine. Los temas y colores propios de las invitaciones no se modifican. Web y Capacitor cargan la configuración mediante el mismo proveedor; mientras la página está visible se consulta cada 30 segundos. Si la API no responde, la sesión mantiene la última paleta obtenida; en un arranque sin red se muestra la paleta original hasta poder consultar el servidor.

Cada guardado escribe en `admin_audit_log` (`site_palette.update`, el usuario del panel y la paleta), en la misma transacción. La interfaz guarda en `localStorage` (`tuevento.sitePalette`) la última paleta confirmada por el servidor y la aplica antes de pintar: evita el parpadeo a partir de la segunda visita y da la paleta a las apps sin conexión.

## Verificación

- `npm run build -w @tuevento/contracts && npm run build -w @tuevento/client && npm run typecheck`
- `npm run test:unit` verifica la tabla de identificadores, los pares de contraste y la correspondencia con el contrato OpenAPI.
- `npm run test:db` aplica migraciones desde cero y prueba la 034 sobre una base con las migraciones anteriores; la base temporal usa el rol de API.
- `npm run e2e -- --grep @paletas --project=chromium --workers=1` prueba el guardado en el panel, la persistencia, la portada, la protección del endpoint y que el dueño ya no tenga el selector. El escenario usa la base local de pruebas para crear un dueño temporal y restaurar la paleta. Nunca ejecutarlo contra producción.
- `npm run e2e -- --grep @paletas-pantallas` recorre las cuatro paletas a 390, 820 y 1440 px: portada, navegación, foco, errores del acceso, panel y modal, con el contraste medido por axe. La paleta se simula en la respuesta de la API: no cambia el estado global.
- `npm run test:security` comprueba que la API de la web ya no tiene endpoint de escritura.

Antes de publicar, ejecutar la batería completa en el entorno de CI y las pruebas de Android/iOS, además de validar en dispositivos físicos. Las capturas de navegador y la emulación no acreditan comportamiento nativo ni funcionamiento sin conexión en un dispositivo.
