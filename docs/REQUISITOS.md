# Requisitos y escenarios

Cada característica de `tests/e2e/features/` lleva la etiqueta del requisito que cubre (`@REQ-NN`) y, cuando
la hay, la regla de la auditoría de la plataforma (`@FE-11`, `@BE-26`…; ver `AGENTS.md` §36). Para ver los
escenarios de un requisito: `npm run e2e -- --grep @REQ-03`.

| Requisito | Qué cubre | Características |
|---|---|---|
| `@REQ-01` | Crear una cuenta y entrar: datos válidos, filtros de nombre y teléfono, longitudes, validación de la API | `registro`, `acceso`, `api-registro` |
| `@REQ-02` | Perfil de la cuenta: nombre, teléfono con prefijo del país | `perfil` |
| `@REQ-03` | Eventos e invitaciones: dirección pública, página protegida, enlace genérico, calendario y cancelación | `url-evento`, `pagina-protegida`, `invitacion-generica`, `calendario-y-avisos` |
| `@REQ-04` | Postal del evento y diseños: editor, textos, colores, variantes en móviles y tabletas | `postal`, `postal-texto`, `disenos` |
| `@REQ-05` | Precios y demostración | `precios`, `demo` |
| `@REQ-06` | Selector de idioma | `idioma` |
| `@REQ-07` | Panel de administración (admin.tuevento.fun) | `admin` |

Las reglas comunes de la plataforma (salud, dominios e idiomas, páginas legales, errores de la API, cookies,
límites y accesibilidad) están en `tests/e2e/features/plataforma/`, etiquetadas con la regla de la auditoría.

`@solo-lectura` marca los escenarios que no escriben nada: los `@smoke @solo-lectura` corren cada semana
contra los dos dominios de producción (`.github/workflows/semanal.yml`).
