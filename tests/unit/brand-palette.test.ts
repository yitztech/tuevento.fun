import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { sitePaletteIds } from "@tuevento/contracts";
import { brandFilter, brandHueRotation } from "../../packages/app/src/ui/site/brand-palette";

test("Cada paleta tiene un filtro y un favicon con el mismo tratamiento", async () => {
  assert.deepEqual(Object.keys(brandHueRotation).sort(), [...sitePaletteIds].sort());
  for (const id of sitePaletteIds) {
    const hue = brandHueRotation[id];
    const svg = await readFile(`apps/web/public/images/brand-v2/favicon-${id}.svg`, "utf8");
    assert.match(svg, /data:image\/png;base64,/);
    if (hue === null) {
      assert.equal(brandFilter(hue), "none");
      assert.doesNotMatch(svg, /hueRotate/);
    } else {
      assert.match(brandFilter(hue), new RegExp(`hue-rotate\\(${hue}deg\\)`));
      assert.ok(svg.includes(`type="hueRotate" values="${hue}"`));
    }
  }
});
