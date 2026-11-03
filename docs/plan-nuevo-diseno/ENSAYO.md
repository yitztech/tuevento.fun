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
