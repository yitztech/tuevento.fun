# Entornos locales: limpio y demo

Dos formas de correr TuEventoFun en local con Docker Compose, iguales en cualquier máquina (no dependen de OrbStack ni de Docker Desktop). Son proyectos de Compose distintos: tienen contenedores, volúmenes, red e imágenes propios y pueden correr a la vez. Producción no cambia: usa `compose.prod.yml`.

| | Limpio | Demo |
|---|---|---|
| Archivos | `compose.yml` | `compose.yml` + `compose.demo.yml` |
| Proyecto de Compose | `tueventofun` | `tueventofun-demo` |
| Datos | Ninguno (sin usuarios) | 20 organizadores, 124 eventos con invitados y respuestas, 20 proveedores publicados |
| Web | `http://tuevento.localhost:5187` (es) · `http://yourevent.localhost:5187` (en) | `http://tuevento.localhost:5287` · `http://yourevent.localhost:5287` |
| API | `127.0.0.1:3087` | `127.0.0.1:3187` |
| Base de datos | `127.0.0.1:5487` | `127.0.0.1:5587` |
| Correos (Mailpit) | `http://127.0.0.1:8026` | `http://127.0.0.1:8126` |
| Panel admin | `http://127.0.0.1:8188` | `http://127.0.0.1:8288` |
| Búsqueda | `127.0.0.1:3089` | `127.0.0.1:3189` |

Los dominios `*.localhost` los resuelve el navegador a `127.0.0.1` sin configurar nada; por eso las URLs valen en cualquier máquina. Los puertos del demo se cambian con `DEMO_WEB_PORT`, `DEMO_API_PORT`, `DEMO_DB_PORT`, `DEMO_ADMIN_PORT`, `DEMO_SEARCH_PORT` y `DEMO_MAIL_UI_PORT`.

## Comandos

```bash
bash scripts/local-env.sh limpio        # levanta el entorno sin usuarios
bash scripts/local-env.sh demo          # levanta, siembra e imprime la contraseña
bash scripts/local-env.sh parar demo    # detiene sin borrar datos (también: parar limpio)
bash scripts/local-env.sh borrar demo   # borra contenedores, volúmenes, imágenes y .env.demo
bash scripts/local-env.sh estado
```

Requiere Docker Compose 2.24 o más (el demo usa `!override` en los puertos).

## El demo

- **Sembrado**: `scripts/seed-demo.mjs` crea todo con la API real (mismas validaciones, hashes y restricciones que en uso normal), desde el servicio `seed` de `compose.demo.yml`, construido con su propio `services/demo/Dockerfile.demo`. Los correos de confirmación se leen de Mailpit, así que todas las cuentas están confirmadas. Se puede repetir: salta las cuentas que ya existen.
- **Cuentas**: `demo-organizador-01..20@example.invalid` y `demo-proveedor-01..20@example.invalid`. La contraseña es una sola, aleatoria, y queda en `.env.demo` (fuera de git; `borrar demo` la elimina).
- **Organizadores** (idiomas: 10 es, 4 en, 2 pt, 2 de, 2 fr):

  | Cuentas | Eventos cada una |
  |---|---|
  | 01–05 | 0 |
  | 06–10 | 1, 2, 3, 1, 2 |
  | 11–15 | 10 |
  | 16–20 | 11, 12, 13, 14, 15 |

  Cada evento tiene de 3 a 5 invitaciones (individuales y familiares) y la mayoría ya respondieron.
- **Proveedores**: 20 negocios en ciudades de México, con categorías distintas, 1 a 3 servicios con precio, portada y logo (imágenes de muestra generadas), publicados y encontrables en la búsqueda.

El panel de administración usa el usuario y la contraseña de desarrollo de `compose.yml`.
