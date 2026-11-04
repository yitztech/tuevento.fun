# Resultado del ensayo

Ensayo del 3 de noviembre de 2026 sobre `3f4c515`, el último commit del PR #58.

| Prueba | Sobre qué | Resultado |
|---|---|---|
| `aplicar.mjs` y `verificar.sh` | Cada tarea, de T02 a T15 | Todas correctas |
| `aplicar.mjs` | T16 | Correcta; es documentación y no lleva `verificar.sh` |
| `npm run e2e` en la pila de CI | Resultado de T16 | 656 de 656 |
| `test:platform`, `test:browser`, `test:landing`, `test:password`, `test-owner-browser` | Resultado de T16 | Todas correctas |
| `capturas.mjs`, 8 páginas a 3 anchos | Resultado de T16 | Sin desbordes ni imágenes rotas |
| Android, escenarios `@movil` | Resultado de T16 | 23 de 23 |
| iOS, escenarios `@movil` | Versión previa al ensayo, antes de T15 y de separar los escenarios del sitio | 22 de 22 |

## Sin ejecutar

- La suite de la pila de CI en las tareas intermedias: T10, T11, T12, T13 y T14 solo pasaron `verificar.sh`. Es lo
  primero que puede fallar al implementar.
- iOS sobre el resultado final. T11 y T17 lo ejecutan.
- `test:db`, `test:api`, `test:endpoints` y `test:security`: el plan no toca la base de datos ni la API. T17 ejecuta
  `test:db` y el CI del PR el resto.
- El CI de GitHub.
- La revisión de diseño: el parecido con el prototipo se miró a ojo en la portada, el acceso, precios y proveedores.
  Falta la revisión con `design:design-critique` de T10, T11 y T14.
- La lectura de las traducciones por una persona nativa.
- Los parches contra `main`: se comprobaron contra el PR #58 sin mezclar. T01 lo vuelve a comprobar.

# Resultado del ensayo de la Parte B

Ensayo del 3 de noviembre de 2026 sobre `61bfc90`, `main` con el PR #58. Cada tarea se ejecutó tal como está escrita,
desde una rama limpia.

| Prueba | Sobre qué | Resultado |
|---|---|---|
| `aplicar.mjs`, `verificar.sh` y las listas de `git add` | P02 a P07 | Todas correctas, sin archivos sobrantes |
| Squawk | Migraciones 030, 031 y 032 | Sin avisos |
| `pila-ci.sh api` | P02 y P05 | Correctas |
| `npm run test:db` | P02 y P03 | Sin fallos |
| Escenarios en la pila de CI | P02 (9), P04 (17), P05 (11) y P06 (41) | Sin fallos |
| Árbol final | Comparado con el probado | Idéntico |

## Lo que encontró el ensayo

- `verificar.sh` no compilaba `@tuevento/client`: en un árbol limpio los tipos fallaban, y P06 cambia ese paquete.
- Repetir `pila-ci.sh api` sin reiniciar la API daba 429: los límites viven en memoria. Ahora la reinicia.
- Un `ECONNRESET` al escribir en una ejecución de `pila-ci.sh api`. No se reprodujo en seis repeticiones de
  `test:security` ni en el ensayo final, y no se sabe en qué prueba ocurrió.

## Sin ejecutar

- Stripe real: nada se ha probado contra su API. Los datos de su documentación se leyeron el 3 de noviembre.
- `npm run e2e:movil`. Los escenarios de `/pago` son `@solo-web`; P08 ejecuta las apps.
- El campo de cupón dentro de las apps, y sobre todo el camino del cupón del 100 %.
- La lectura de las traducciones por una persona nativa.
