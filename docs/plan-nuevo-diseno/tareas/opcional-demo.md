# Opcional · Página `/demo`

**Esta tarea no se ejecuta salvo que el usuario la pida, y no es para un modelo económico.**

El prototipo tiene una demostración sin cuenta en `/demo`. Hoy el requisito REQ-05 dice lo contrario: la
demostración exige registrarse (`tests/e2e/features/demo.feature`) y existe dentro del panel. Adoptarla es una
decisión de producto.

Si el usuario la pide, un modelo capaz debe:

1. Cambiar REQ-05 y sus dos escenarios, con el motivo.
2. Portar `apps/new-design/src/pages/Demo/Demo.tsx` de la rama `feat/new-design` a `src/ui/site/`, con `ThemeCard`
   en vez de `InvitationCard` y `tr()` en vez de `copy`.
3. Escribir sus unos 30 textos en los cinco idiomas.
4. Añadir la ruta en `apps/web/src/main.tsx` y en `public_pages` de `services/web/17-sites.sh`.
5. Apuntar a `/demo` los enlaces de `home-hero.tsx`, `home-family.tsx` y `site-layout.tsx`.
6. Actualizar la última comprobación de `scripts/test-landing.cjs`.
