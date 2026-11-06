import test from "node:test";
import assert from "node:assert/strict";
import { sitePaletteIds, sitePalettes, sitePaletteSchema } from "./site-palettes";

function luminance(hex: string) {
  const rgb = (hex.slice(1).match(/../g) ?? []).map((value) => parseInt(value, 16) / 255).map((n) => n <= 0.04045 ? n / 12.92 : ((n + 0.055) / 1.055) ** 2.4);
  return rgb[0] * 0.2126 + rgb[1] * 0.7152 + rgb[2] * 0.0722;
}
function contrast(a: string, b: string) {
  const first = luminance(a), second = luminance(b);
  return (Math.max(first, second) + 0.05) / (Math.min(first, second) + 0.05);
}
test("Las paletas admitidas incluyen la original y rechazan campos o identificadores ajenos", () => {
  assert.equal(sitePaletteIds.length, 5);
  for (const palette of sitePaletteIds) assert.equal(sitePaletteSchema.safeParse({ palette }).success, true);
  assert.equal(sitePaletteSchema.safeParse({ palette: "other" }).success, false);
  assert.equal(sitePaletteSchema.safeParse({ palette: "terracotta", isOwner: true }).success, false);
});
test("Los textos principales, secundarios y botones mantienen contraste AA en cada paleta", () => {
  for (const [name, colors] of Object.entries(sitePalettes)) {
    for (const [foreground, background] of [[colors.primaryText, colors.primary], [colors.primaryText, colors.primaryHover], [colors.primary, colors.siteBg], [colors.primary, colors.surfaceSoft], [colors.primaryHover, colors.surfaceSoftHover], [colors.ink, colors.siteBg], [colors.muted, colors.siteBg], [colors.muted, colors.surfaceSoft], [colors.celebrateText, colors.celebrate], [colors.celebrateText, colors.celebrateHover]]) {
      assert.ok(contrast(foreground, background) >= 4.5, `${name}: ${foreground} sobre ${background}: ${contrast(foreground, background)}`);
    }
  }
});

test("El contrato OpenAPI de paletas publica los identificadores y operaciones vigentes", async () => {
  const { readFile } = await import("node:fs/promises");
  const { join } = await import("node:path");
  // JSON es también YAML válido y evita añadir un analizador para esta especificación.
  const spec = JSON.parse(await readFile(join(__dirname, "../../../docs/openapi/site-palettes.yaml"), "utf8"));
  assert.deepEqual(spec.components.schemas.SitePalette.properties.palette.enum, [...sitePaletteIds]);
  assert.ok(spec.paths["/site-palette"].get.responses[200]);
  assert.equal(spec.paths["/owner/site-palette"], undefined);
});
