# Paletas globales

El dueño puede seleccionar en `/administracion` la paleta inicial Terracota o cuatro propuestas de marca: Fucsia, Ciruela y Ámbar; Ciruela y Champagne; Mandarina y Frambuesa; Frambuesa y Vainilla. Cambiar el selector aplica una vista previa únicamente en ese navegador. Cancelar o salir de la página la descarta. Guardar confirma el cambio global; una respuesta fallida conserva la selección sin guardarla y muestra el error.

La migración `034_site_palette.sql` crea una sola fila, con `terracotta` por defecto, y un `CHECK` que limita los identificadores. `GET /api/site-palette` es público y no se cachea. `PUT /api/owner/site-palette` exige sesión del dueño no demo, cabecera propia y `Origin` permitido. La API valida la entrada estrictamente; nunca recibe CSS. El contrato de estos dos endpoints está en [openapi/site-palettes.yaml](openapi/site-palettes.yaml); este archivo documenta solo la funcionalidad de paletas, no toda la API.

La tabla de valores e identificadores está en `packages/contracts/src/site-palettes.ts`. La interfaz deriva de ella sus variables CSS; `terracotta` elimina las variables de vista previa para conservar los estilos existentes. El sitio público vuelve a heredar los tokens generales porque `.site-surface` los redefine. Los temas y colores propios de las invitaciones no se modifican. Web y Capacitor cargan la configuración mediante el mismo proveedor; mientras la página está visible se consulta cada 30 segundos. Si la API no responde, la sesión mantiene la última paleta obtenida; en un arranque sin red se muestra la paleta original hasta poder consultar el servidor.

## Verificación

- `npm run build -w @tuevento/contracts && npm run build -w @tuevento/client && npm run typecheck`
- `npm run test:unit` verifica la tabla de identificadores, los pares de contraste y la correspondencia con el contrato OpenAPI.
- `npm run test:db` aplica migraciones desde cero y prueba la 034 sobre una base con las migraciones anteriores; la base temporal usa el rol de API.
- `npm run e2e -- --grep @paletas --project=chromium --workers=1` prueba vista previa, cancelación, persistencia, portada y protección del endpoint. El escenario usa la base local de pruebas para crear un dueño temporal y restaurar la paleta. Nunca ejecutarlo contra producción.
- `npm run test:security` incluye acceso sin sesión y de una cuenta normal al endpoint de escritura.

Antes de publicar, ejecutar la batería completa en el entorno de CI y las pruebas de Android/iOS, además de validar en dispositivos físicos. Las capturas de navegador y la emulación no acreditan comportamiento nativo ni funcionamiento sin conexión en un dispositivo.
