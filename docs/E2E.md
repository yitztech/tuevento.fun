# Pruebas E2E (Gherkin + Playwright)

Escenarios en español (`tests/e2e/features/*.feature`) que se ejecutan con Playwright
contra la app real (Docker). Un escenario describe un comportamiento; si se rompe, el
informe dice cuál.

```
tests/e2e/
  features/   .feature en español (# language: es)
  steps/      pasos en JavaScript (fixtures.js = estado y datos únicos por escenario)
  support/    entorno.js (URLs)
  scripts/    summary.mjs (resumen por característica y etiqueta)
  results/    informe HTML, results.json, capturas, vídeos y trazas (no se versiona)
```

## Ejecutar

La app debe estar arriba: `docker compose up -d` (http://localhost:5187).

| Qué | Comando (desde la raíz) |
|---|---|
| Todo, en terminal | `npm run e2e` |
| Con el navegador visible | `npm run e2e:headed` (más lento: `E2E_SLOWMO=300 npm run e2e:headed`) |
| Modo UI de Playwright (pasos, repetir, depurar) | `npm run e2e:ui` |
| Solo algunos escenarios | `npm run e2e -- --grep @smoke` (o `@registro`, `@limites`, `@api`…) |
| Un archivo | `npm run e2e -- features/perfil.feature` |
| Resumen: qué pasa, falla u omite | `npm run e2e:summary` |
| Informe HTML | `npm run report -w @tuevento/e2e` |

Cuando un escenario falla se guardan **captura, vídeo y traza** en `tests/e2e/results/`
(`npx playwright show-trace <trace.zip>`). Para grabar vídeo siempre: `E2E_VIDEO=on`.

Variables: `E2E_BASE_URL` (por defecto `http://localhost:5187`), `E2E_BASE_URL_EN`
(dominio inglés), `E2E_VIDEO`, `E2E_SLOWMO`.

## Escribir un escenario

1. Añade o edita un `.feature` con `# language: es` (Dado / Cuando / Entonces / Y).
2. Reutiliza los pasos existentes (`steps/`); si falta uno, `npm run bddgen -w @tuevento/e2e`
   indica el que hay que escribir.
3. Etiquetas: área (`@registro`, `@perfil`…) y tipo (`@smoke` = lo imprescindible,
   `@validacion`, `@limites`, `@i18n`, `@api` = sin navegador).
4. Los datos se crean únicos en cada escenario (`nuevaCuenta()`); no dependas de la base de datos.

## CI

`.github/workflows/ci.yml` ejecuta `npm run e2e` contra `compose.prod.yml` y sube
`tests/e2e/results/` como artifact `qa-evidence`.
