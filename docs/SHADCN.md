# shadcn/ui en la web

Los componentes de [shadcn/ui](https://ui.shadcn.com/) se copian como código fuente en
`packages/app/src/ui/` y conviven con el CSS propio (`styles.css`, `landing.css`). La skill oficial
está en `.claude/skills/shadcn` (instalada con `npx skills add shadcn/ui --skill shadcn`; su versión
queda en `skills-lock.json`, y `npx skills update -p` la actualiza).

## Piezas

| Archivo | Qué hace |
|---|---|
| `packages/app/components.json` | Configuración del CLI: estilo `new-york`, base Radix, iconos `lucide`, alias `@/ui`, `@/lib`, `@/hooks` |
| `packages/app/tsconfig.json` | Solo para el CLI: hereda de `apps/web/tsconfig.json`, que define `@/*` → `packages/app/src/*` |
| `packages/app/src/tailwind.css` | Tailwind v4 sin preflight y con los colores y radios de shadcn apuntando a los tokens de `styles.css` |
| `packages/app/src/lib/utils.ts` | Reexporta `cn` (paquete `cn`, el que usa el CLI) para componentes de registros que lo importan de `@/lib/utils` |
| `apps/web/vite.config.ts` | Plugin `@tailwindcss/vite` y alias `@` |

## Añadir un componente

Siempre desde `packages/app` (allí está `components.json`):

```bash
cd packages/app && npx shadcn@latest add dialog
```

Después:

1. Revisa el diff: el CLI no debe tocar `styles.css` ni añadir variables `--primary`, `--muted`, `--radius`…
   a `tailwind.css`. Si un componente trae variables nuevas (sidebar, chart), se apuntan a tokens de
   `styles.css` dentro de `@theme inline`, nunca con valores propios.
2. Comprueba que las dependencias nuevas quedan en `packages/app/package.json` con el mismo rango en todos
   los workspaces (`node scripts/check-versions.mjs`).
3. Ningún texto fijo: los textos por defecto de shadcn (`"Close"`, `"Toggle"`, `sr-only`…) se cambian por
   `tr("area.clave")` con su traducción en los cinco catálogos (CLAUDE.md, «Idiomas»).

## Reglas de estilo

- **DESIGN.md manda.** Los colores semánticos de shadcn (`bg-primary`, `text-muted-foreground`,
  `border-border`, `ring-ring`…) ya son los de la paleta; nunca colores crudos (`bg-red-500`) ni valores
  sueltos. Radios: `rounded-xs` 5 px (etiqueta), `rounded-sm` 8 px (control), `rounded-md` 9 px (botón),
  `rounded-lg` 13 px (tarjeta), `rounded-xl` 14 px (superficie), `rounded-2xl` 16 px (modal).
- **Ojo con `muted`.** En `styles.css`, `--muted` es el color de texto secundario; en shadcn, `muted` es un
  fondo suave y `muted-foreground` el texto secundario. Por eso `tailwind.css` no redefine `--muted`: mapea
  `--color-muted` a `--surface-soft` y `--color-muted-foreground` a `--muted`.
- **Solo se generan utilidades de los archivos de `@source`** (`src/ui`, `src/lib`). Una pantalla que pase a
  usar clases de Tailwind se añade a `@source` en `tailwind.css`. Antes, comprueba que no use clases propias
  con nombre de utilidad de Tailwind: hoy existen `container`, `hidden`, `shadow`, `ring`, `blur`, `filter`,
  `visible` y `resize`, que cambiarían de aspecto.
- **Sin preflight.** El reinicio base sigue siendo el de `styles.css`. Las utilidades no van en capa y se
  importan después de `styles.css`, así que una clase gana a sus reglas de elemento (`button`, `a`, `h1`…);
  `:focus-visible` de `styles.css` sigue dibujando su contorno además del `ring` de shadcn.
- Modo oscuro: la web no lo tiene; las clases `dark:` de los componentes no se activan.

## Accesibilidad y pruebas

Los componentes de Radix traen teclado y ARIA. Cada pantalla migrada conserva sus nombres accesibles (los
escenarios localizan por rol y etiqueta, docs/E2E.md) y pasa `npm run e2e` antes de cerrar el cambio.
