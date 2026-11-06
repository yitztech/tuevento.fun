// Paletas que acepta el panel. Son los identificadores de `sitePaletteIds` (packages/contracts) y la
// base de datos los repite en su CHECK (migración 034).
export const PALETTES = ["terracotta", "fuchsia-plum-amber", "plum-champagne", "mandarin-raspberry", "raspberry-vanilla"];

/** La paleta del cuerpo, si es lo único que trae y es una conocida (AGENTS.md §23), o lanza 422. */
export function parsePalette(body) {
  const valid = body !== null && typeof body === "object" && !Array.isArray(body)
    && Object.keys(body).length === 1 && PALETTES.includes(body.palette);
  if (!valid) throw { status: 422 };
  return body.palette;
}
