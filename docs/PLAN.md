# Plan: invitaciones, calendario y avisos

Estado a 2026-10-17. Cada punto dice cómo funciona hoy y qué se propone.

## Estado de implementación

Implementado en `feat/invitaciones-plan`, con pruebas de API, seguridad, base de datos y E2E:

- **1. Calendario:** `.ics` del evento y de cada invitación (`/api/invitations/<token>/calendar.ics`, `/api/public/events/<slug>/calendar.ics`) y enlace a Google Calendar. Los eventos cancelados salen con `STATUS:CANCELLED`.
- **2. Protección de la URL:** contraseña opcional para la página pública (hash scrypt, cookie de acceso de 24 h solo con el hash guardado, bloqueo de 15 min tras 10 fallos). La página pública lleva `noindex` y `robots.txt` la excluye.
- **3. Unicidad:** índice único de la dirección pública y comprobación en vivo (`GET /events/slug-available`).
- **4. Avisos:** correo al organizador por cada respuesta o registro, y confirmación al invitado si dejó correo. Verificado en Mailpit.
- **5. Cambios del organizador:** correo a los invitados al cambiar fecha, zona o lugar, y al cancelar (estado nuevo `cancelled`). Las respuestas ya dadas se conservan.
- **6. Google Maps:** enlace de ubicación en la invitación y en la página pública; el `.ics` lleva `LOCATION`.
- **7. Dirección automática:** se sugiere desde el nombre del evento (sin acentos, con `-2`, `-3`… si está ocupada) hasta que el organizador la escribe a mano.
- **8. Invitación genérica:** tipo `open` sin personas. Cada invitado se registra desde el enlace con sus datos y personas, y se crea una invitación propia ya respondida (`parent_id`). Límite de 200 registros por enlace y 20 personas por registro. Borrar el enlace no borra sus registros.

## Pendiente (fuera de esta fase)

- **WhatsApp automático** al organizador o a los invitados: requiere la API de WhatsApp Business (cuenta, plantillas aprobadas, costo). Hoy solo hay enlaces `wa.me` manuales.
- **Agrupar avisos:** hoy cada respuesta envía su correo. Un resumen por lotes necesita una tarea programada.
- **Coordenadas exactas** en el mapa: requiere una clave de Google Places (costo).

## 1. Añadir el evento al calendario

**Hoy:** no existe. La página de invitación no ofrece añadir el evento a ningún calendario.

**Propuesta:**
- Botón «Añadir al calendario» en la invitación y en la postal pública: descarga un `.ics` (RFC 5545) con título, fecha, zona horaria, lugar y enlace al evento. Funciona en Apple Calendar, Outlook y Google Calendar.
- Enlace directo a Google Calendar (`calendar.google.com/calendar/render?action=TEMPLATE…`) para quien prefiera no descargar nada.
- Pruebas: endpoint o generación en cliente, escenario E2E y prueba de que la zona horaria y la hora de fin son correctas.

## 2. Proteger las URL de los eventos

**Hoy:**
- `/i/<token>` (invitación personalizada) es un secreto: 24 bytes aleatorios en base64url, unos 192 bits. No se puede adivinar; quien tiene el enlace responde.
- `/e/<slug>` (página pública del evento) es **pública**: cualquiera con la dirección la ve, y los motores de búsqueda pueden indexarla porque `robots.txt` no la excluye.

**Estrategias propuestas, combinables:**
- **Oculto por defecto:** el evento solo tiene dirección si el organizador la activa (ya es así: sin slug no hay página pública).
- **Contraseña opcional** para `/e/<slug>`: se guarda como hash (scrypt, como las contraseñas de cuenta) y, al verificarla, se entrega una cookie de acceso de corta duración.
- **Sin indexación:** `noindex` en la página pública y `Disallow: /e/` en `robots.txt`.
- **Revocar:** cambiar o quitar la dirección invalida el enlace anterior (ya funciona).
- **Caducidad opcional** de la dirección pública.

Recomendación: `noindex` más contraseña opcional. Son baratas y no cambian el modelo.

## 3. Verificar que la URL es única

**Hoy:**
- **Dirección pública (`slug`):** índice único en la base de datos (`events_slug_key`) y respuesta 409 si ya existe (`errors.eventSlugTaken`). Se comprueba al guardar, no mientras se escribe.
- **Token de invitación:** columna `UNIQUE` en la base de datos. Si alguna vez colisionara, la inserción fallaría con error 500; no hay reintento explícito. La probabilidad es despreciable.

**Propuesta:**
- Endpoint `GET /events/slug-available?slug=…` para avisar mientras el usuario escribe.
- Generación de token con reintento ante colisión.

## 4. Avisos al propietario y a los invitados

**Hoy:**
- **Propietario:** al cambiar las respuestas de una invitación se crea una notificación **solo en la aplicación** (campana, con actualización en tiempo real). **No hay correo ni WhatsApp.**
- **Invitado:** no recibe ningún aviso al aceptar, declinar o dejar en espera. Solo ve su estado en la página de invitación.
- Estados reales: `accepted` (confirmado), `declined` (no asistirá), `pending` (en espera o sin responder).

**Propuesta:**
- **Correo al propietario** (cuando hay cambios en las respuestas): reutilizar `mail.ts` y sus plantillas; resumen por lotes para no enviar un correo por cada clic.
- **Correo al invitado** al confirmar su respuesta (copia de lo que eligió) — opcional, con enlace para cambiarla.
- **WhatsApp:** hoy solo existe el enlace `wa.me` que abre el chat desde el dispositivo del propietario (manual, sin envío automático). Enviar mensajes automáticos exige la API de WhatsApp Business (cuenta, plantillas aprobadas y costo por mensaje). Se deja para una fase posterior.

## 5. Cambios del propietario y avisos a los invitados

**Hoy:**
- Cambiar fecha, hora, lugar o descripción del evento **no avisa** a nadie.
- Editar una invitación (nombre, integrantes, notas) conserva los estados ya respondidos.
- Archivar el evento oculta la invitación (`errors.invitationIsntAvailable`), sin aviso.

**Propuesta:**
- Detectar cambios que importan (fecha, hora, zona horaria, lugar, archivado o cancelado) y avisar a los invitados con correo, con el enlace a su invitación.
- Un solo aviso por edición o en lote (no uno por cada cambio menor).
- Estado nuevo **cancelado** para el evento, con aviso específico.
- Los invitados sin correo solo reciben el enlace por WhatsApp desde el propietario.
- Registrar cada envío (quién, cuándo, a qué invitación) para no repetirlo.

## 6. Ubicación en Google Maps

**Hoy:** la invitación ya enlaza a `google.com/maps/search/?api=1&query=<lugar>` (`packages/app/src/public-rsvp.tsx`). La página pública `/e/<slug>` y la vista del organizador no lo tienen.

**Propuesta:**
- Mismo enlace en la página pública del evento y en el `.ics` (campo `LOCATION`).
- Coordenadas o Place ID con autocompletado de lugar: exige una clave de la API de Google Places y tiene costo. Se hace solo si el enlace de búsqueda se queda corto.

## 7. Dirección pública automática desde el nombre

**Hoy:** el organizador escribe la dirección a mano.

**Propuesta:**
- Al escribir el título, sugerir el slug: sin acentos, minúsculas, guiones, máximo 60 caracteres.
- Si está ocupado, añadir `-2`, `-3`… (usa el endpoint del punto 3).
- Si el organizador ya editó el campo a mano, no volver a sobrescribirlo.
- Pruebas: escenario E2E con título con acentos y con dirección repetida.

## 8. Invitación genérica (nuevo tipo)

**Hoy:** todas las invitaciones son personalizadas: el organizador escribe nombre, contacto e integrantes, y el invitado solo confirma.

**Propuesta:** tipo nuevo, **genérica**:
- El organizador crea la invitación solo con los detalles del evento y envía el enlace a quien quiera.
- El invitado entra su propio nombre, contacto e integrantes, y responde.
- El organizador ve todas las respuestas que llegaron por ese enlace y puede editarlas o borrarlas.
- **Convive con la personalizada:** cada invitación tiene un tipo. Las personalizadas no cambian.

**Detalles a cuidar:**
- Límite de integrantes y de respuestas por enlace, para evitar abusos.
- Opción de cerrar el enlace o ponerle caducidad.
- Un invitado genérico nunca ve datos de otros invitados.
- Migración: nuevo valor en `invitations.kind` y, si hace falta, restricciones propias.
- Actualizar la política de privacidad (los datos los escribe el propio invitado).

## Orden sugerido

1. Dirección automática y disponibilidad (7 y 3): cambios pequeños y visibles.
2. Invitación genérica (8): cambia el modelo; conviene hacerla pronto.
3. Calendario y Google Maps (1 y 6).
4. Avisos por correo al propietario y al invitado (4) y avisos de cambios (5).
5. Protección de la página pública (2): `noindex` primero; la contraseña después si se necesita.
6. WhatsApp automático (4): fase posterior, con cuenta de WhatsApp Business.
