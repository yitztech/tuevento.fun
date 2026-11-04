// Genera los recursos gráficos propios del prototipo (SVG originales) y procesa las fotografías.
//
//   npm run assets -w @tuevento/new-design
//
// - Logotipo, decoraciones e invitaciones: SVG dibujados aquí, sin material de terceros.
// - Fotografías: si existe `photos-src/<clave>.jpg|jpeg|png|webp`, se recorta a la proporción de la
//   ranura y se exporta a WebP en tres anchos. Si no existe, se genera un marcador de posición con la
//   misma ruta y proporción (queda marcado como «marcador» en docs/assets-manifest.md).
import { existsSync, mkdirSync, readdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const out = (p) => join(root, "public/assets", p);
const write = (p, data) => {
  mkdirSync(dirname(out(p)), { recursive: true });
  writeFileSync(out(p), data);
};

function rng(seed) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const f = (n) => Number(n.toFixed(1));
const svg = (w, h, body, defs = "") =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}">${defs ? `<defs>${defs}</defs>` : ""}${body}</svg>\n`;

// ── Piezas vectoriales ────────────────────────────────────────────────────────
const GREEN = ["#6F8450", "#8A9D68", "#A7B58A"];

function leaf(x, y, angle, len = 34, fill = GREEN[0]) {
  const w = len * 0.32;
  return `<g transform="translate(${f(x)} ${f(y)}) rotate(${f(angle)})"><path d="M0 0C${f(len * 0.3)} ${f(-w)} ${f(len * 0.75)} ${f(-w)} ${f(len)} 0C${f(len * 0.75)} ${f(w)} ${f(len * 0.3)} ${f(w)} 0 0Z" fill="${fill}"/><path d="M2 0L${f(len * 0.9)} 0" stroke="#fff" stroke-opacity=".35" stroke-width="1"/></g>`;
}

function branch(x0, y0, x1, y1, bend, count, seed, len = 34) {
  const r = rng(seed);
  const cx = (x0 + x1) / 2 + bend;
  const cy = (y0 + y1) / 2;
  let g = `<path d="M${x0} ${y0}Q${f(cx)} ${f(cy)} ${x1} ${y1}" fill="none" stroke="#6F8450" stroke-width="2.2" stroke-linecap="round"/>`;
  for (let i = 1; i <= count; i++) {
    const t = i / (count + 1);
    const px = (1 - t) * (1 - t) * x0 + 2 * (1 - t) * t * cx + t * t * x1;
    const py = (1 - t) * (1 - t) * y0 + 2 * (1 - t) * t * cy + t * t * y1;
    const base = (Math.atan2(y1 - y0, x1 - x0) * 180) / Math.PI;
    const side = i % 2 ? -1 : 1;
    g += leaf(px, py, base + side * (45 + r() * 25), len * (0.75 + r() * 0.5), GREEN[i % 3]);
  }
  return g + leaf(x1, y1, (Math.atan2(y1 - y0, x1 - x0) * 180) / Math.PI, len, GREEN[1]);
}

function flower(cx, cy, r, colors, petals = 9, seed = 1) {
  const rand = rng(seed);
  let g = "";
  colors.forEach((c, i) => {
    const s = 1 - i * (0.7 / colors.length);
    const off = (i * 360) / petals / 2 + rand() * 12;
    for (let k = 0; k < petals; k++) {
      const a = off + (k * 360) / petals;
      g += `<ellipse cx="${f(cx)}" cy="${f(cy - r * s * 0.52)}" rx="${f(r * s * 0.36)}" ry="${f(r * s * 0.54)}" fill="${c}" stroke="#fff" stroke-opacity=".28" stroke-width=".8" transform="rotate(${f(a)} ${f(cx)} ${f(cy)})"/>`;
    }
  });
  return `${g}<circle cx="${f(cx)}" cy="${f(cy)}" r="${f(r * 0.13)}" fill="#E8B56A"/>`;
}

const PEACH = ["#F4B79B", "#F8CDB8", "#FBE1D2"];
const ROSE = ["#E58A8E", "#EFA9AB", "#F7CDCB"];
const CORAL = ["#E9825B", "#F1A07D", "#F8C4A8"];
const CREAM = ["#F3D3B5", "#F8E4D0", "#FDF1E4"];

function balloon(cx, cy, r, c1, c2, id) {
  const ry = r * 1.18;
  const defs = `<radialGradient id="${id}" cx=".35" cy=".3" r=".8"><stop offset="0" stop-color="${c1}"/><stop offset="1" stop-color="${c2}"/></radialGradient>`;
  const body = `<path d="M${f(cx)} ${f(cy + ry)}q-4 22 4 46t-6 40" fill="none" stroke="#B8A99E" stroke-width="1.4"/><ellipse cx="${f(cx)}" cy="${f(cy)}" rx="${f(r)}" ry="${f(ry)}" fill="url(#${id})"/><path d="M${f(cx - 5)} ${f(cy + ry - 2)}l5 9 5-9z" fill="${c2}"/><ellipse cx="${f(cx - r * 0.38)}" cy="${f(cy - ry * 0.4)}" rx="${f(r * 0.16)}" ry="${f(ry * 0.3)}" fill="#fff" fill-opacity=".45" transform="rotate(25 ${f(cx - r * 0.38)} ${f(cy - ry * 0.4)})"/>`;
  return { defs, body };
}

function balloons(items, prefix) {
  let defs = "";
  let body = "";
  items.forEach(([x, y, r, c1, c2], i) => {
    const b = balloon(x, y, r, c1, c2, `${prefix}${i}`);
    defs += b.defs;
    body += b.body;
  });
  return { defs, body };
}

function confetti(w, h, n, seed, palette) {
  const r = rng(seed);
  let g = "";
  for (let i = 0; i < n; i++) {
    const x = r() * w;
    const y = r() * h;
    const c = palette[Math.floor(r() * palette.length)];
    const s = 3 + r() * 6;
    const a = r() * 180;
    g +=
      i % 3 === 0
        ? `<circle cx="${f(x)}" cy="${f(y)}" r="${f(s / 2)}" fill="${c}"/>`
        : `<rect x="${f(x)}" y="${f(y)}" width="${f(s * 1.8)}" height="${f(s * 0.7)}" rx="1" fill="${c}" transform="rotate(${f(a)} ${f(x)} ${f(y)})"/>`;
  }
  return g;
}

function bokeh(w, h, n, seed, colors) {
  const r = rng(seed);
  let defs = "";
  let g = "";
  for (let i = 0; i < n; i++) {
    const c = colors[i % colors.length];
    defs += `<radialGradient id="bk${seed}${i}"><stop offset="0" stop-color="${c}" stop-opacity=".95"/><stop offset=".55" stop-color="${c}" stop-opacity=".35"/><stop offset="1" stop-color="${c}" stop-opacity="0"/></radialGradient>`;
    g += `<circle cx="${f(r() * w)}" cy="${f(r() * h)}" r="${f(10 + r() * 46)}" fill="url(#bk${seed}${i})"/>`;
  }
  return { defs, body: g };
}

const heartPath = (cx, cy, s) =>
  `M${f(cx)} ${f(cy + s * 0.95)}C${f(cx - s * 1.5)} ${f(cy - s * 0.1)} ${f(cx - s * 1.1)} ${f(cy - s * 1.0)} ${f(cx - s * 0.5)} ${f(cy - s * 0.95)}C${f(cx - s * 0.2)} ${f(cy - s * 0.93)} ${f(cx)} ${f(cy - s * 0.6)} ${f(cx)} ${f(cy - s * 0.45)}C${f(cx)} ${f(cy - s * 0.6)} ${f(cx + s * 0.2)} ${f(cy - s * 0.93)} ${f(cx + s * 0.5)} ${f(cy - s * 0.95)}C${f(cx + s * 1.1)} ${f(cy - s * 1.0)} ${f(cx + s * 1.5)} ${f(cy - s * 0.1)} ${f(cx)} ${f(cy + s * 0.95)}Z`;

// ── Marca ─────────────────────────────────────────────────────────────────────
function mark(fill, leafFill, spark) {
  return `<path d="${heartPath(32, 40, 22)}" fill="${fill}"/><path d="M30 17C28 10 22 6 14 7c0 8 6 12 16 10Z" fill="${leafFill}"/><path d="M33 17c1-7 6-11 14-11 0 8-5 12-14 11Z" fill="${leafFill}" fill-opacity=".85"/><path d="M52 14l1.6 3.6 3.6 1.6-3.6 1.6L52 24.4l-1.6-3.6-3.6-1.6 3.6-1.6z" fill="${spark}"/>`;
}
write("branding/logo-mark.svg", svg(64, 64, mark("#B2402F", "#8A9D68", "#EA8659")));
write("branding/logo-mark-light.svg", svg(64, 64, mark("#FFFFFF", "#F6C6A4", "#FFE2CF")));
write("branding/favicon.svg", svg(64, 64, mark("#B2402F", "#8A9D68", "#EA8659")));
await sharp(Buffer.from(svg(180, 180, `<rect width="180" height="180" fill="#FFF6F2"/><g transform="translate(26 26) scale(1.9)">${mark("#B2402F", "#8A9D68", "#EA8659")}</g>`)))
  .png()
  .toFile(out("branding/apple-touch-icon.png"));
await sharp(Buffer.from(svg(64, 64, mark("#B2402F", "#8A9D68", "#EA8659")))).resize(32, 32).png().toFile(out("branding/favicon-32.png"));

// ── Decoraciones ──────────────────────────────────────────────────────────────
write(
  "decorations/leaf-branch.svg",
  svg(260, 420, branch(40, 400, 210, 30, 70, 8, 7, 44) + branch(60, 360, 20, 150, -30, 4, 9, 36)),
);
write(
  "decorations/floral-corner.svg",
  svg(
    420,
    460,
    branch(20, 440, 330, 40, 90, 9, 3, 50) +
      branch(30, 420, 250, 200, 30, 6, 5, 40) +
      flower(120, 330, 62, PEACH, 9, 1) +
      flower(230, 230, 46, ROSE, 8, 2) +
      flower(70, 215, 40, CORAL, 8, 3) +
      flower(310, 120, 34, PEACH, 8, 4) +
      flower(190, 400, 34, CREAM, 8, 5),
  ),
);
write("decorations/flower-peach.svg", svg(160, 160, flower(80, 80, 72, PEACH, 9, 11)));
write("decorations/flower-rose.svg", svg(160, 160, flower(80, 80, 72, ROSE, 9, 12)));
write("decorations/flower-coral.svg", svg(160, 160, flower(80, 80, 72, CORAL, 9, 13)));
{
  const b = balloons(
    [
      [70, 90, 48, "#FFC48A", "#EF8A3B"],
      [150, 70, 44, "#F8A5AE", "#E0626F"],
      [115, 150, 42, "#FFE08A", "#F2B93B"],
    ],
    "bl",
  );
  write("decorations/balloons.svg", svg(220, 320, b.body, b.defs));
}
write("decorations/confetti.svg", svg(600, 400, confetti(600, 400, 90, 21, ["#EA8659", "#F6C6A4", "#E58A8E", "#F2B93B", "#8A9D68", "#FFFFFF"])));
write("decorations/heart.svg", svg(64, 64, `<path d="${heartPath(32, 32, 24)}" fill="#E58A8E"/>`));
write("decorations/sparkle.svg", svg(40, 40, `<path d="M20 2l4.2 13.8L38 20l-13.8 4.2L20 38l-4.2-13.8L2 20l13.8-4.2z" fill="#F2B93B"/>`));
write(
  "backgrounds/peach-wash.svg",
  svg(
    1600,
    900,
    `<rect width="1600" height="900" fill="#FFF1EA"/><circle cx="1350" cy="120" r="520" fill="url(#a)"/><circle cx="160" cy="760" r="480" fill="url(#b)"/>`,
    `<radialGradient id="a"><stop offset="0" stop-color="#F8CDB8"/><stop offset="1" stop-color="#F8CDB8" stop-opacity="0"/></radialGradient><radialGradient id="b"><stop offset="0" stop-color="#F6C6A4" stop-opacity=".8"/><stop offset="1" stop-color="#F6C6A4" stop-opacity="0"/></radialGradient>`,
  ),
);
write(
  "backgrounds/cta-band.svg",
  svg(
    1400,
    260,
    `<rect width="1400" height="260" fill="url(#g)"/><circle cx="1210" cy="120" r="150" fill="#fff" fill-opacity=".1"/><circle cx="1320" cy="230" r="110" fill="#fff" fill-opacity=".08"/>`,
    `<linearGradient id="g" x1="0" x2="1"><stop offset="0" stop-color="#C45B45"/><stop offset=".55" stop-color="#E1795A"/><stop offset="1" stop-color="#EE9A6B"/></linearGradient>`,
  ),
);

// ── Invitaciones (fondo ilustrado; el texto lo pone el componente con su tipografía) ──
const W = 600;
const H = 900;
{
  // Boda floral
  const wreath =
    branch(20, 150, 300, 20, 40, 7, 31, 46) +
    branch(580, 150, 300, 20, -40, 7, 32, 46) +
    branch(20, 760, 300, 880, -40, 7, 33, 46) +
    branch(580, 760, 300, 880, 40, 7, 34, 46) +
    flower(60, 70, 52, PEACH, 9, 1) +
    flower(540, 70, 44, ROSE, 8, 2) +
    flower(50, 835, 46, CORAL, 8, 3) +
    flower(545, 830, 56, PEACH, 9, 4) +
    flower(140, 40, 26, CREAM, 8, 5) +
    flower(460, 40, 24, CORAL, 8, 6);
  write("invitations/boda-floral.svg", svg(W, H, `<rect width="${W}" height="${H}" fill="#FBF3E8"/><rect x="14" y="14" width="${W - 28}" height="${H - 28}" rx="8" fill="none" stroke="#E8CDB3" stroke-width="1.5"/>${wreath}`));
}
{
  // Cumpleaños
  const b = balloons(
    [
      [180, 150, 70, "#FFC48A", "#EF8A3B"],
      [300, 110, 64, "#F8A5AE", "#E0626F"],
      [410, 170, 66, "#FFE08A", "#F2B93B"],
      [250, 250, 58, "#9ED8D0", "#4FAFA3"],
      [360, 265, 52, "#F8A5AE", "#E0626F"],
    ],
    "bd",
  );
  write(
    "invitations/cumpleanos-globos.svg",
    svg(
      W,
      H,
      `<rect width="${W}" height="${H}" fill="url(#bg)"/>${confetti(W, H, 70, 41, ["#EA8659", "#F2B93B", "#E58A8E", "#9ED8D0", "#fff"])}${b.body}`,
      `<linearGradient id="bg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#FFF0DC"/><stop offset="1" stop-color="#FBC9BE"/></linearGradient>${b.defs}`,
    ),
  );
}
{
  // Noche (bokeh cálido)
  const k = bokeh(W, H, 34, 5, ["#FFD28A", "#FFB35C", "#FFE7B8"]);
  write(
    "invitations/noche-bokeh.svg",
    svg(
      W,
      H,
      `<rect width="${W}" height="${H}" fill="url(#bg)"/>${k.body}${flower(520, 830, 70, CORAL, 9, 8)}${branch(430, 880, 590, 760, 20, 4, 9, 40)}`,
      `<linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#2A1812"/><stop offset="1" stop-color="#140B08"/></linearGradient>${k.defs}`,
    ),
  );
}
{
  // Infantil con osito
  const bear = `<g transform="translate(300 600)"><circle cx="-92" cy="-122" r="44" fill="#C9935F"/><circle cx="92" cy="-122" r="44" fill="#C9935F"/><circle cx="-92" cy="-122" r="24" fill="#F0C9A0"/><circle cx="92" cy="-122" r="24" fill="#F0C9A0"/><ellipse cx="0" cy="130" rx="140" ry="100" fill="#D9A877"/><circle cx="0" cy="-30" r="124" fill="#D9A877"/><ellipse cx="0" cy="20" rx="58" ry="46" fill="#F0C9A0"/><circle cx="-44" cy="-42" r="11" fill="#3A2418"/><circle cx="44" cy="-42" r="11" fill="#3A2418"/><ellipse cx="0" cy="2" rx="17" ry="12" fill="#3A2418"/><path d="M0 14v14M-16 36q16 14 32 0" fill="none" stroke="#3A2418" stroke-width="4" stroke-linecap="round"/><circle cx="-76" cy="14" r="14" fill="#F4A6A0" fill-opacity=".55"/><circle cx="76" cy="14" r="14" fill="#F4A6A0" fill-opacity=".55"/><path d="M-72 -128 -40 -216 -10 -138z" fill="#A9D7D3" transform="rotate(-14 -40 -150)"/><circle cx="-44" cy="-220" r="12" fill="#F7D774"/></g>`;
  let flags = "";
  const cols = ["#F4A6A0", "#A9D7D3", "#F7D774", "#C7B5E4", "#F4A6A0", "#A9D7D3", "#F7D774", "#C7B5E4"];
  cols.forEach((c, i) => {
    flags += `<path d="M${40 + i * 70} ${60 + Math.sin(i) * 8}l30 0-15 38z" fill="${c}"/>`;
  });
  write(
    "invitations/infantil-oso.svg",
    svg(
      W,
      H,
      `<rect width="${W}" height="${H}" fill="url(#bg)"/><path d="M30 50Q300 130 570 50" fill="none" stroke="#B8A99E" stroke-width="2"/>${flags}${confetti(W, H, 40, 61, ["#F4A6A0", "#A9D7D3", "#F7D774", "#C7B5E4"])}${bear}`,
      `<linearGradient id="bg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#FFF4F0"/><stop offset="1" stop-color="#FDE0DA"/></linearGradient>`,
    ),
  );
}
{
  // XV años (rosas)
  const decor =
    branch(10, 220, 250, 20, 40, 6, 71, 40) +
    branch(590, 780, 350, 880, -30, 6, 72, 40) +
    flower(70, 100, 70, ROSE, 10, 21) +
    flower(170, 40, 40, PEACH, 9, 22) +
    flower(30, 230, 40, ROSE, 9, 23) +
    flower(520, 820, 76, ROSE, 10, 24) +
    flower(440, 880, 40, PEACH, 9, 25) +
    flower(575, 700, 40, ROSE, 9, 26);
  write(
    "invitations/xv-rosas.svg",
    svg(W, H, `<rect width="${W}" height="${H}" fill="url(#bg)"/><rect x="14" y="14" width="${W - 28}" height="${H - 28}" rx="8" fill="none" stroke="#F0B5B5" stroke-width="1.5"/>${decor}`, `<linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#FFE6E4"/><stop offset="1" stop-color="#FAC2C0"/></linearGradient>`),
  );
}
write(
  "invitations/minimalista.svg",
  svg(W, H, `<rect width="${W}" height="${H}" fill="#FBF7F3"/><rect x="40" y="40" width="${W - 80}" height="${H - 80}" fill="none" stroke="#2D1F1C" stroke-width="1.2"/><circle cx="300" cy="170" r="34" fill="#B2402F"/><path d="M220 760h160" stroke="#2D1F1C" stroke-width="1.2"/>`),
);
{
  const stars = confetti(W, H, 40, 91, ["#E3BE78", "#F2D9A0"]);
  write(
    "invitations/elegante.svg",
    svg(
      W,
      H,
      `<rect width="${W}" height="${H}" fill="url(#bg)"/><rect x="26" y="26" width="${W - 52}" height="${H - 52}" fill="none" stroke="#D9B26B" stroke-width="2"/><rect x="40" y="40" width="${W - 80}" height="${H - 80}" fill="none" stroke="#D9B26B" stroke-opacity=".5" stroke-width="1"/>${stars}<path d="M230 150h140M230 750h140" stroke="#D9B26B" stroke-width="1.5"/><path d="M300 128l6 14-6 14-6-14z" fill="#D9B26B"/>`,
      `<linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#5A2230"/><stop offset="1" stop-color="#2E111A"/></linearGradient>`,
    ),
  );
}
{
  const b = balloons([[480, 140, 46, "#FFE08A", "#F2B93B"], [540, 200, 38, "#F8A5AE", "#E0626F"]], "ev");
  write(
    "invitations/evento-especial.svg",
    svg(
      W,
      H,
      `<rect width="${W}" height="${H}" fill="url(#bg)"/>${confetti(W, H, 90, 101, ["#FFFFFF", "#F2B93B", "#E58A8E", "#EA8659"])}${b.body}<path d="M96 120l5 14 14 5-14 5-5 14-5-14-14-5 14-5z" fill="#fff"/>`,
      `<linearGradient id="bg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#F6B779"/><stop offset=".6" stop-color="#EE8F66"/><stop offset="1" stop-color="#C85A49"/></linearGradient>${b.defs}`,
    ),
  );
}

// ── Fotografías ───────────────────────────────────────────────────────────────
// clave → [carpeta, ancho máximo, alto máximo, matiz del marcador]
export const photoSlots = {
  "providers/hero-mesa": ["providers", 1600, 1000, "#E9B79B"],
  "events/mesa-gracias": ["events", 1400, 1000, "#E8B493"],
  "events/hero-fondo": ["events", 1600, 900, "#F3CDB8"],
  "providers/salones": ["providers", 960, 720, "#E4B391"],
  "providers/catering": ["providers", 960, 720, "#E2A57B"],
  "providers/fotografia": ["providers", 960, 720, "#C99E86"],
  "providers/decoracion": ["providers", 960, 720, "#EBBFAE"],
  "providers/musica": ["providers", 960, 720, "#7A4A6A"],
  "providers/experiencias": ["providers", 960, 720, "#D9A67E"],
  "providers/pasteles": ["providers", 960, 720, "#F0C3B3"],
  "providers/coordinacion": ["providers", 960, 720, "#D8B09A"],
  "events/auth-login": ["events", 1000, 1250, "#E6B392"],
  "events/auth-registro": ["events", 1000, 1250, "#EBB7A6"],
  "events/auth-recuperar": ["events", 1000, 1250, "#E9C1A3"],
};
const widths = [480, 960, 1600];
const srcDir = join(root, "photos-src");
for (const [key, [, maxW, maxH, tint]] of Object.entries(photoSlots)) {
  const original = ["jpg", "jpeg", "png", "webp"].map((e) => join(srcDir, `${key.split("/")[1]}.${e}`)).find(existsSync);
  for (const w of widths.filter((v) => v <= maxW || v === widths[0])) {
    const h = Math.round((w * maxH) / maxW);
    const input = original
      ? sharp(original).resize(w, h, { fit: "cover", position: "attention" })
      : sharp(Buffer.from(placeholder(w, h, tint, key)));
    mkdirSync(dirname(out(`${key}-${w}.webp`)), { recursive: true });
    await input.webp({ quality: original ? 78 : 60 }).toFile(out(`${key}-${w}.webp`));
  }
}
function placeholder(w, h, tint, key) {
  const k = bokeh(w, h, 18, key.length * 7, ["#FFFFFF", "#FFF0DC", tint]);
  return svg(w, h, `<rect width="${w}" height="${h}" fill="url(#bg)"/>${k.body}`, `<linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${tint}"/><stop offset="1" stop-color="#FBE3D6"/></linearGradient>${k.defs}`);
}

const have = existsSync(srcDir) ? readdirSync(srcDir).length : 0;
console.log(`Recursos generados en public/assets (${Object.keys(photoSlots).length} ranuras de foto, ${have} originales en photos-src).`);
