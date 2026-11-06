import assert from "node:assert/strict";
import test from "node:test";
import { PALETTES, parsePalette } from "./palette.mjs";

test("acepta las paletas conocidas", () => {
  for (const palette of PALETTES) assert.equal(parsePalette({ palette }), palette);
});

test("rechaza con 422 lo que no sea solo una paleta conocida", () => {
  for (const body of [null, [], {}, { palette: "no-existe" }, { palette: 1 }, { palette: "terracotta", css: "x" }]) {
    assert.throws(() => parsePalette(body), { status: 422 });
  }
});
