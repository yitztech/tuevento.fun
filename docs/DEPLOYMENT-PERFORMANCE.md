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

## Equilibrio de escenarios, caché de apt, Seguridad en paralelo y `:main` tras el CI (2026-10-28)

PR https://github.com/yitztech/tuevento.fun/pull/43. Punto de partida: el primer despliegue con tres partes (run 40623833862, 9:32 de principio a fin; CI 6:48). Del `results.json` de cada parte:

| Parte | Escenarios | Tiempo de pruebas (suma) | E2E en el runner |
| --- | --- | --- | --- |
| 1/3 | 185 chromium | 152 s | 1:29 |
| 2/3 | 9 chromium + 176 android-chrome | 132 s | 1:19 |
| 3/3 | 4 android-chrome + 180 iphone-safari | 435 s | 3:56 |

`--shard=N/3` reparte por número de escenarios y en orden de proyecto: la última parte se quedaba casi todo WebKit, que tarda unas 3 veces más por escenario. Además, `disenos.feature` (`@disenos`, 7 tamaños de pantalla) suma 128 s solo en WebKit, el 30 % de ese proyecto.

### Cambios

1. **Cuatro partes con filtros que cubren la suite entera** (`playwright test --list` con 1.64.1: 360 + 87 + 86 + 21 = 554, igual que la suite y sin duplicados; un escenario nuevo cae siempre en una parte):

   | Parte | Filtro | Escenarios | E2E (run 40645296717) |
   | --- | --- | --- | --- |
   | 1 | chromium y android-chrome sin `@disenos`, con 3 workers | 360 | 2:21 |
   | 2 | iphone-safari sin `@disenos`, primera mitad | 87 | 1:32 |
   | 3 | iphone-safari sin `@disenos`, segunda mitad | 86 | 1:33 |
   | 4 | `@disenos` en los tres proyectos, más las pruebas auxiliares de navegador | 21 | 1:30 |

   La parte 1 tiene un costo fijo por escenario que no aparece en su duración (con 2 workers tardaba 3:18 con solo 236 s de pruebas); con 3 workers en los 4 núcleos del runner bajó a 2:21, sin escenarios inestables. Las demás siguen con 2 workers. Intentos descartados: con tres partes (chromium + android; iphone-safari en dos mitades) el E2E tardó 2:56 / 2:41 / 1:19, porque la mitad con `@disenos` pesaba el doble.

2. **Caché de librerías de Playwright que de verdad se usa.** Con la caché acertada, `apt-get install <archivos .deb>` prefería la misma versión del repositorio al archivo local y bajaba los 181 paquetes (114 MB) del mirror de Azure en cada job: el paso tardaba de 30 s a 2:14 según el mirror. Ahora `Dir::Cache::Archives` apunta a la caché y `apt` no descarga nada («Need to get 0 B/114 MB»): el paso tarda 24–27 s en todas las partes. Probado antes en `ubuntu:24.04`.

3. **Entorno en paralelo con la instalación**, en Escenarios y en Seguridad · API y ZAP: se construyen las imágenes y se arrancan los contenedores (`up -d`, sin `--wait`) antes de `npm ci`, el build y los navegadores, y se espera a los healthchecks justo antes de las pruebas (antes, 33 s de espera). Se quita el `docker compose down` final: el runner se descarta.

4. **Seguridad en dos jobs en paralelo** (`Seguridad · CodeQL` y `Seguridad · API y ZAP`) más el check obligatorio `Seguridad`, que los agrega como `Escenarios`. CodeQL ocupaba 1:40 antes de construir el entorno para ZAP.

5. **Publicar en paralelo con el CI, solo con `:<sha>`**, y un job `promover` que copia el manifiesto a `:main` (`docker buildx imagetools create`, sin reconstruir) cuando el CI pasa. Es la regla DEP-14 de la plataforma: un commit que falla nunca mueve la imagen que usa producción. Publicar tardaba 0:56 después del CI; promover tarda unos 0:35.

6. La comprobación de la versión consulta cada 5 s (antes, cada 10 s), con el mismo límite de 10 minutos.

### Resultado

CI del PR: de 6:48 a entre **4:41 y 5:54** (runs 40645296717 y 40645883531). La preparación de cada parte ya es estable (unos 2:10); la diferencia entre runs es la velocidad del runner, que en el segundo hizo las pruebas un 30 % más lentas en todas las partes (parte 1: 141 s frente a 185 s, sin reintentos ni escenarios inestables en ninguno). Con promover (~0:35) y el despliegue en Coolify (~1:40), el despliegue completo debería quedar en unos 7 minutos frente a 9:32; se mide en el primer despliegue tras fusionar. Jobs simultáneos: 9 del CI + 6 de publicar = 15, por debajo del tope de 20 de la organización (plan Free).

## Partes de escenarios por etiquetas (2026-10-28)

PR https://github.com/yitztech/tuevento.fun/pull/44. En el primer despliegue tras #43 (run 40724065495, CI 5:51) la parte 1 seguía siendo la ruta crítica: 2:30 de E2E frente a 1:04 y 1:02 de las mitades de iphone-safari. Se quita `--shard` y se reparte por etiquetas; `@plataforma` (salud, indexación, dominios, legales, sesión, errores de la API y accesibilidad) pasa entera a la parte 2:

| Parte | Filtro | Escenarios | E2E antes (run 40724065495) | E2E después (run 40727430031, intento 2) |
| --- | --- | --- | --- | --- |
| 1 | chromium y android-chrome sin `@disenos` ni `@plataforma`, 3 workers | 238 (antes 360) | 2:30 | 1:45 |
| 2 | `@plataforma` en los tres proyectos, sin `@disenos`, 3 workers | 183 | 1:04 | 2:00 |
| 3 | iphone-safari sin `@disenos` ni `@plataforma`, 2 workers | 112 | 1:02 | 2:15 |
| 4 | `@disenos` (sin cambios) | 21 | 1:28 | 1:31 |

`playwright test --list` (1.64.1): 238 + 183 + 112 + 21 = 554, la suite entera sin duplicados. Ningún reintento ni escenario inestable en los dos intentos.

Las duraciones no se suman como pruebas sueltas: la aplicación corre en el mismo runner de 4 núcleos, y cada escenario tarda más cuanto más carga tiene el job. Quitar un tercio de los escenarios de la parte 1 solo bajó su suma de 399 s a 371 s, y `@plataforma` en iphone-safari pasó de unos 62 s a 156 s al compartir job con Chromium. Por eso la ganancia es de unos 15 s en el E2E más lento, no de un minuto. El primer intento cayó en un runner más lento (la parte 4, igual en los dos, tardó 1:45): 2:21 / 2:04 / 2:18.

CI completo: de 5:51 a 4:42 (intento 2) o 5:22 (intento 1). Parte de la diferencia con el run de main es la instalación de Playwright de la parte 1 en ese run (68 s frente a 24–30 s habituales). La parte 3 (WebKit) es ahora la más larga: el siguiente ajuste, si hace falta, es pasar alguna etiqueta suya a la parte 1.
