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

### Validación remota y renovación de parches

PR de implementación: https://github.com/yitztech/tuevento.fun/pull/42. La primera ejecución remota confirmó la integración Bake y detectó que una capa antigua de Alpine conservaba curl/libcurl 8.22.0-r0, con CVE-2026-92392 corregida en 8.23.0-r0. Se añadió SECURITY_REFRESH diario a las etapas de ejecución que aplican apk upgrade, tanto en CI como en publicación: renueva los parches sin invalidar las etapas de compilación. No se omitió el análisis de seguridad ni se añadió una excepción a la vulnerabilidad.

La integración en main requiere una aprobación y los checks obligatorios según el ruleset activo del repositorio. Las mediciones de despliegue y comprobaciones de producción se realizarán después de esa integración, sin bypass administrativo.

## Equilibrio de escenarios, Seguridad en paralelo y `:main` tras el CI (2026-10-27)

Medición del primer despliegue con tres partes (run 40623833862, 9:32 de principio a fin), con el `results.json` de cada parte:

| Parte | Escenarios | Tiempo de pruebas (suma) | E2E en el runner |
| --- | --- | --- | --- |
| 1/3 | 185 chromium | 152 s | 1:29 |
| 2/3 | 9 chromium + 176 android-chrome | 132 s | 1:19 |
| 3/3 | 4 android-chrome + 180 iphone-safari | 435 s | 3:56 |

`--shard=N/3` reparte por número de escenarios y en orden de proyecto, así que la última parte se queda casi todo WebKit, que tarda unas 3 veces más por escenario (2,4 s frente a 0,8 s). La parte 3 retrasaba todo el CI 2:30.

Cambios:

- **Partes por duración:** 1 = chromium y android-chrome (374 escenarios, unos 145 s con dos workers); 2 y 3 = iphone-safari en dos mitades (90 cada una, unos 110 s). Las pruebas auxiliares de navegador pasan a la parte 2. El listado local con Playwright 1.64.1 da 374 + 90 + 90 = 554, igual que la suite, sin duplicados.
- **Seguridad en dos jobs en paralelo** (`Seguridad · CodeQL` y `Seguridad · API y ZAP`) más el check obligatorio `Seguridad`, que los agrega como `Escenarios`. CodeQL ocupaba 1:40 antes de construir y levantar el entorno para ZAP; con los escenarios equilibrados, Seguridad (4:38) habría sido la ruta crítica.
- **Publicar en paralelo con el CI, solo con `:<sha>`**, y un job `promover` que copia el manifiesto a `:main` (`docker buildx imagetools create`, sin reconstruir) cuando el CI pasa. Es la regla DEP-14 de la plataforma: un commit que falla nunca mueve la imagen que usa producción. Publicar tardaba 0:56 después del CI; promover tarda unos 0:35.
- La comprobación de la versión consulta cada 5 s (antes, cada 10 s), con el mismo límite de 10 minutos.

Estimación: CI de unos 4:30 (antes, 6:48), promover 0:35 y despliegue 1:40; en total, unos 7 minutos frente a 9:32. Jobs simultáneos: 9 del CI + 6 de publicar = 15, por debajo del tope de 20 de la organización (plan Free). La duración real se mide en el primer despliegue tras fusionar.
