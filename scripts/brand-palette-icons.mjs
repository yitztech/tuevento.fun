import { copyFile, mkdir, readFile, writeFile } from "node:fs/promises";
import { brandHueRotation } from "../packages/app/src/ui/site/brand-palette.ts";

// Variantes del favicon para el sitio: cada paleta tiene su SVG con el filtro aplicado.
const source = "apps/web/public/images/brand-v2";
const png = (await readFile(`${source}/favicon-64.png`)).toString("base64");
for (const [palette, hue] of Object.entries(brandHueRotation)) {
  const effect = hue === null ? "" : `<filter id="brand" color-interpolation-filters="sRGB"><feColorMatrix type="saturate" values="0"/><feColorMatrix type="matrix" values=".393 .769 .189 0 0 .349 .686 .168 0 0 .272 .534 .131 0 0 0 0 0 1 0"/><feColorMatrix type="saturate" values="3"/><feColorMatrix type="hueRotate" values="${hue}"/></filter>`;
  const filter = hue === null ? "" : ' filter="url(#brand)"';
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64">${effect}<image width="64" height="64" href="data:image/png;base64,${png}"${filter}/></svg>\n`;
  await writeFile(`${source}/favicon-${palette}.svg`, svg);
}

// El panel es otro workspace de Angular y no puede tomar assets fuera de su raíz: guarda una copia
// del logo completo en español, que tiñe en el navegador con el mismo filtro de cada paleta.
const adminDir = "apps/admin/src/web/brand";
await mkdir(adminDir, { recursive: true });
for (const file of ["logo-es-240.webp", "logo-es-480.webp"]) {
  await copyFile(`${source}/${file}`, `${adminDir}/${file}`);
}
