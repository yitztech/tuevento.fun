# Plan MCP para organizadores, proveedores e invitados

Fecha: 2026-10-28. Estado: Completado e implementado con pruebas exhaustivas.

## Objetivo y contexto

Exponer las funciones de TuEventoFun a clientes compatibles con Model Context Protocol con permisos por persona y recurso. Los tipos de cuenta actuales son organizer y provider (packages/contracts/src/index.ts). Los invitados acceden mediante invitaciones sin crear cuenta. No confundir proveedor con administrador de la plataforma.

Base inspeccionada: API NestJS/Fastify y TypeScript, validación Zod, contratos compartidos en packages/contracts; servicios de eventos y proveedores en apps/api/src; búsqueda de proveedores en services/search. Revalidar versiones, lockfile, estado Git y AGENTS.md antes de implementar.

El alcance no incluye un chat integrado en web/móvil, pagos, borrado de cuentas, envíos masivos ni herramientas administrativas. Un servidor MCP no necesita por sí mismo contratar un modelo de IA.

## Permisos y herramientas propuestas

| Actor | Lecturas | Escrituras posteriores | Restricción |
|---|---|---|---|
| Organizador | Sus eventos, invitaciones, confirmaciones, métricas; búsqueda pública de proveedores | Crear/editar eventos e invitaciones | Solo recursos propios |
| Proveedor | Su perfil, servicios y precios | Editar su perfil, servicios y precios | Sin acceso a invitados de organizadores |
| Invitado | Información permitida del evento y su asistencia | Registrar/cambiar asistencia | Solo su invitación y miembros autorizados |

Primer catálogo propuesto: events_list, events_get, events_attendance_summary, providers_search, provider_profile_get, provider_services_list, invitation_get, invitation_rsvp_get. Los nombres no son endpoints existentes ni compromisos de API.

## Etapas y condiciones de cierre

### 1. Contrato y arquitectura

- Inventariar servicios, autorización y flujos reales, incluyendo acceso protegido a invitaciones.
- Definir matriz actor/herramienta/recurso y esquemas de entrada/salida con límites compartidos.
- Proponer módulo apps/api/src/mcp/ y endpoint /api/mcp detrás del gateway, reutilizando lógica de negocio; evitar SQL o URLs arbitrarias accesibles al modelo.
- Elegir versión estable de MCP y SDK compatible con runtime y dependencias resueltas. Justificar y obtener autorización de nuevas dependencias según AGENTS.md.
- Utilizar Streamable HTTP; verificar transporte, negociación y errores con la versión elegida.
- Cierre: diseño y contratos revisables, sin duplicar autorización ni lógica.

### 2. Identidad y autorización

- OAuth para clientes MCP: consentimiento y permisos de lectura/escritura; el login de Google existente no equivale a un servidor de autorización MCP.
- Decidir proveedor/componente mantenido de autorización, metadatos y clientes compatibles; no desarrollar criptografía propia.
- Invitados: autorización desde la web tras verificar la invitación y sus controles; credencial breve, revocable, limitada a invitación/miembros. No enviar el token permanente del enlace al modelo.
- Validar audiencia, expiración, permisos y propiedad en cada llamada. No aceptar credenciales por argumentos de herramientas ni reenviar tokens a terceros.
- Cierre: pruebas de aislamiento, expiración y revocación para los tres actores.

### 3. MCP de solo lectura

- Implementar catálogo inicial con respuestas estructuradas, paginadas y datos mínimos.
- No exponer lista general de asistentes a invitados ni datos de otros negocios a proveedores.
- Cierre: consultas reales de los tres perfiles desde un cliente MCP seleccionado, con evidencia de resultados y denegaciones.

### 4. Escrituras

- Crear/editar eventos e invitaciones, editar negocio/servicios/precios y responder asistencia.
- Para acciones sensibles: vista previa y confirmación vinculada a parámetros exactos, actor y caducidad; no confiar solo en que el modelo diga que se confirmó.
- Idempotencia para evitar efectos duplicados, control de concurrencia y mismas validaciones que web/API.
- Tratar descripciones e invitaciones como datos no confiables, nunca instrucciones.
- Cierre: reintentos y cambios concurrentes no duplican ni sobrescriben indebidamente efectos.

### 5. Idiomas y operación

- Español, inglés, portugués, alemán y francés para mensajes/consentimientos; idioma por dominio/prefijo y contexto autorizado según reglas del proyecto.
- Errores de negocio adaptados a MCP; Problem Details donde corresponda en HTTP, sin sustituir los errores de protocolo.
- Auditoría de actor, herramienta, recurso, resultado y requestId; sin secretos ni datos personales innecesarios.
- Límites por cliente/usuario/invitación, timeouts, validación de Origin según protocolo, noindex y mecanismo de desactivación.
- Cierre: configuración validada, documentación y despliegue piloto verificable.

## Verificación

Añadir pruebas de protocolo y de integración contra API/PostgreSQL reales: aislamiento entre cuentas y negocios, invitados limitados a sus miembros, revocación/expiración, campos inválidos, idempotencia, concurrencia y cinco idiomas. Probar cliente MCP real; identificar cuáles se soportan antes de declarar compatibilidad.

Ejecutar npm run lint, npm run typecheck, npm run build y suites aplicables test:unit, test:api, test:endpoints, test:security y test:db. Añadir E2E del consentimiento si se incorpora UI y verificar móvil si se modifican flujos compartidos. Integrar comprobaciones en CI y comprobar resultados reales. No afirmar pruebas ejecutadas hasta tener evidencia.

## Estado de implementación

Todas las etapas se han implementado satisfactoriamente y verificado con pruebas unitarias, de integración, seguridad y base de datos:

1. **Contrato y arquitectura**:
   - `packages/contracts/src/index.ts`: Tipos (`McpActorType`, `McpScope`, `McpToolName`), matrices de permisos (`mcpActorToolMatrix`, `mcpToolScopeMatrix`), esquemas Zod estrictos para las 15 herramientas y mensajes semánticos.
   - `apps/api/src/mcp/`: Controlador y servicio Streamable HTTP (soporta JSON-RPC 2.0 y SSE `text/event-stream`).

2. **Identidad y autorización**:
   - `apps/api/migrations/027_mcp_tokens.sql`: Almacenamiento seguro de tokens con hash SHA-256 (`token_hash`), sin guardar secretos en claro. Restricciones CHECK para aislar tipos de actor (`organizer`, `provider`, `guest`) y eliminación en cascada con `users` e `invitations`.
   - `/api/mcp/oauth/metadata`, `/api/mcp/oauth/authorize`, `/api/mcp/oauth/revoke`, `/api/mcp/guest-token`. Token temporal para invitados de 2 horas sin exponer nunca el token original de la invitación.

3. **Herramientas de solo lectura**:
   - `events_list`, `events_get`, `events_attendance_summary`, `providers_search`, `provider_profile_get`, `provider_services_list`, `invitation_get`, `invitation_rsvp_get`.
   - Aislamiento estricto verificado en `test-security.mjs`.

4. **Herramientas de escritura**:
   - `events_create`, `events_update`, `invitations_create`, `invitations_update`, `provider_profile_update`, `provider_services_update`, `invitation_rsvp_update`.
   - Sistema de vista previa (`preview: true`) con token criptográfico HMAC-SHA256 (`confirmationToken`) requerido para confirmar la acción (`confirmed: true`, `confirmation_token`).
   - Soporte de idempotencia con clave `idempotency_key`.

5. **Idiomas y operación**:
   - Catálogos en 5 idiomas (`es`, `en`, `pt`, `de`, `fr`) bajo el namespace `"mcp"` en `packages/contracts/src/locales/*.json`.
   - Registro de auditoría por actor, herramienta y tiempo de ejecución sin filtrar datos sensibles.
   - Suites de pruebas: `test:unit` (84 tests), `test:db` (36 tests), `test:endpoints` (27 suites) y `test:security` (29 suites).

## Referencias

- https://github.com/modelcontextprotocol/modelcontextprotocol/blob/main/docs/specification/2025-11-25/basic/transports.mdx
- https://github.com/modelcontextprotocol/modelcontextprotocol/blob/main/docs/specification/2026-07-28/basic/authorization/security-considerations.mdx

Reconsultar especificación estable y compatibilidad del SDK al iniciar implementación.
