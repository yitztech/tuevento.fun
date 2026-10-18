import test from "node:test";
import assert from "node:assert/strict";
import { postcardSchema, postcardShadowLimits } from "./index";

const texto = {
  content: "Feliz cumple",
  font: "playfair",
  size: 64,
  color: "#112233",
  align: "center",
  x: 10,
  y: 20,
  width: 80,
};
const diseno = (text: object) => ({
  background: { type: "color", color: "#ffffff" },
  photos: [],
  texts: [text],
});
const sombra = { color: "#000000", blur: 2, x: 0.5, y: -1 };

test("Un texto sin sombra (diseño anterior) sigue siendo válido", () => {
  assert.ok(postcardSchema.safeParse(diseno(texto)).success);
});

test("Un texto con sombra válida se acepta y conserva sus valores", () => {
  const parsed = postcardSchema.parse(diseno({ ...texto, shadow: sombra }));
  assert.deepEqual(parsed.texts[0].shadow, sombra);
});

test("La sombra acepta los límites exactos y rechaza lo que se sale", () => {
  const { blur, offset } = postcardShadowLimits;
  const limite = { ...texto, shadow: { color: "#abcdef", blur, x: -offset, y: offset } };
  assert.ok(postcardSchema.safeParse(diseno(limite)).success);
  for (const roto of [
    { ...sombra, blur: blur + 0.5 },
    { ...sombra, blur: -1 },
    { ...sombra, x: offset + 1 },
    { ...sombra, y: -offset - 1 },
    { ...sombra, color: "rojo" },
    { ...sombra, color: "#12345" },
    { ...sombra, color: "url(javascript:x)" },
  ]) {
    assert.equal(postcardSchema.safeParse(diseno({ ...texto, shadow: roto })).success, false, JSON.stringify(roto));
  }
});

test("Un color de texto personalizado solo se acepta en formato #rrggbb", () => {
  assert.ok(postcardSchema.safeParse(diseno({ ...texto, color: "#A1B2C3" })).success);
  assert.equal(postcardSchema.safeParse(diseno({ ...texto, color: "azul" })).success, false);
});
