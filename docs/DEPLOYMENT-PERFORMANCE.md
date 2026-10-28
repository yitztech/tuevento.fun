# Revisión del tiempo de despliegue

Revisión de los workflows y de ejecuciones reales de GitHub Actions, realizada el 27 de octubre de 2026 (hora de México).

## Mediciones de referencia

Las últimas cinco ejecuciones correctas de Desplegar tardaron 15:13, 12:33, 13:44, 12:15 y 10:39 desde la creación hasta la actualización final. Estos tiempos incluyen CI, publicación y espera de la nueva versión; no equivalen al tiempo de caída del sitio.

Referencia detallada: https://github.com/yitztech/tuevento.fun/actions/runs/40612129376

| Etapa | Duración observada |
| --- | --- |
| CI / Escenarios | 11:42 |
| Solo E2E, dentro de Escenarios | 7:39 |
| CI / Seguridad, en paralelo | 5:39 |
| CI / Verificar, en paralelo | 3:20 |
| Publicar imágenes, duración máxima de un job | 1:34 |
| Job de despliegue en Coolify | 1:47 |
| Esperar la revisión en ambos dominios | 1:44 |

La ejecución anterior, 40601715963, consumió 6:04 en E2E y 1:33 esperando la revisión. La mayor oportunidad está en Escenarios, no en npm ci ni en el build de TypeScript.

## Cambios preparados

- La suite E2E completa se divide en tres runners con bases de datos independientes. Se mantienen los dos workers por runner y los tres perfiles de navegador. No se cambian escenarios, reintentos ni aserciones.
- El check obligatorio `Escenarios` agrega el resultado de las tres partes. Falla si alguna falla, se cancela o se omite. La publicación sigue dependiendo del CI completo.
- Cada parte conserva su resumen y artefacto `qa-evidence-1`, `qa-evidence-2` o `qa-evidence-3`. Las pruebas auxiliares de navegador corren en la primera parte; API y endpoints se ejecutan en cada entorno independiente.
- `docker-bake.ci.hcl` asigna un scope de caché a cada imagen, igual al de la publicación. Antes todos los targets de Bake usaban el scope predeterminado y la publicación usaba scopes por servicio. Las diferencias de argumentos de build siguen invalidando las capas correspondientes.

La duración real debe medirse después de ejecutar el nuevo workflow. La división por número de tests no garantiza un reparto idéntico por duración. Hay más minutos totales de runner y se necesitan dos plazas concurrentes adicionales. Si la cuenta impone una cola, el beneficio puede disminuir. Después de acelerar Escenarios, Seguridad podría pasar a ser la ruta crítica.

## Verificación local

- `actionlint` sobre CI y Desplegar: correcto.
- `docker buildx bake ... --print`: configuración válida de los siete targets y scopes comprobados.
- Generación BDD y listado de Playwright: 554 tests; partes de 185, 185 y 184. La unión coincide exactamente con la suite completa, sin duplicados.
- `git diff --check`: correcto.

No se ejecutó la suite E2E completa ni se publicaron imágenes o se activó Coolify. El listado local utilizó Node 22.23.1; el workflow conserva el runtime del proyecto definido en `.nvmrc` y necesita validación en ese entorno.

## Siguientes oportunidades

1. Medir los tres shards y la cola de runners antes de aumentar el paralelismo.
2. Evaluar construir una vez y promover exactamente las imágenes verificadas. Actualmente Verificar, Escenarios, Seguridad y Publicar construyen por separado; un cambio de este tipo exige cuidar los argumentos de producción, el almacenamiento de artefactos y los permisos de PR externos.
3. Revisar en Coolify descarga de imágenes, recreación de servicios y parada/arranque. Los healthchecks de producción tienen intervalos de 10–15 segundos y dependencias encadenadas, pero sin logs del servidor no puede atribuirse a ellos la espera de 1:33–1:44 ni cuantificarse la caída. No se ha cambiado la configuración de producción.
4. Evitar que cambios de una app invaliden builds ajenos: API y web tienen `COPY apps apps` y `COPY packages packages`. Su impacto en esta referencia es secundario frente a E2E.

Referencias técnicas: [sharding de Playwright](https://playwright.dev/docs/test-sharding), [scope de caché GHA en Docker](https://docs.docker.com/build/cache/backends/gha/).

## Implementación del plan gratuito

El repositorio se verificó como público. La consulta de uso devolvió 5.875.912.509 bytes de caché (433 entradas); no se amplió el límite de almacenamiento ni se activaron runners de pago.

Se completó la integración con docker/bake-action v7.5.0: Verificar exporta caché; Escenarios y Seguridad solo importan. Publicar actualiza los scopes por servicio. Las operaciones de caché tienen timeout de dos minutos y los errores de exportación no invalidan el build. Las evidencias de cada shard se conservan siete días. Trivy reutiliza su directorio entre imágenes y una caché diaria por versión, sin desactivar la actualización de vulnerabilidades.

API copia únicamente contratos y sus propias fuentes, y ya no compila el cliente. Web copia sus tres paquetes compartidos y sus propias fuentes. Los manifiestos permanecen antes de la instalación para conservar la capa de dependencias.

Verificación adicional: actionlint y diff --check correctos; Bake con cache-to vacío produce los siete targets sin exportación; builds Docker completos de API y web correctos, usando los runtimes de sus imágenes. No se ejecutó todavía CI remoto ni se midieron los tres despliegues posteriores: la mejora de duración y el comportamiento de la caché GHA requieren esa validación. El límite gratuito de caché no se modificó; la ocupación debe revisarse después de calentar los nuevos scopes.
