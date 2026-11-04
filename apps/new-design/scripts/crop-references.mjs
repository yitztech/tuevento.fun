// Recorta las fotografías de las dos imágenes de referencia hacia photos-src/ (provisional).
// Son maquetas de 1024–1536 px generadas por IA: sirven para ver el diseño completo, no para publicar.
// Sustitúyelas por fotografías con licencia guardando el original con el mismo nombre en photos-src/.
//
//   node scripts/crop-references.mjs && npm run assets
import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const landing = join(root, "design/01_Landing.png");
const collage = join(root, "design/Collage UI de TuEventoFun en español.png");
mkdirSync(join(root, "photos-src"), { recursive: true });

// nombre → [imagen, izquierda, arriba, ancho, alto]; sin texto ni esquinas redondeadas de la maqueta
const crops = {
  salones: [landing, 331, 1113, 78, 82],
  catering: [landing, 426, 1113, 80, 82],
  fotografia: [landing, 523, 1113, 80, 82],
  decoracion: [landing, 620, 1113, 81, 82],
  musica: [landing, 720, 1113, 80, 82],
  experiencias: [landing, 819, 1113, 81, 82],
  "mesa-gracias": [landing, 740, 825, 190, 110],
  "hero-mesa": [collage, 300, 505, 246, 85],
  "hero-fondo": [landing, 700, 825, 300, 110],
  "auth-login": [collage, 322, 56, 176, 108],
  "auth-registro": [collage, 862, 52, 146, 246],
  "auth-recuperar": [landing, 740, 825, 190, 110],
  pasteles: [landing, 616, 1113, 89, 82],
  coordinacion: [landing, 716, 1113, 88, 82],
};
for (const [name, [file, left, top, width, height]] of Object.entries(crops)) {
  await sharp(file).extract({ left, top, width, height }).png().toFile(join(root, "photos-src", `${name}.png`));
}
console.log(`${Object.keys(crops).length} recortes en photos-src/`);
