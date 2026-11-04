// Ranuras de fotografía. Las rutas y proporciones coinciden con `photoSlots` de
// scripts/generate-assets.mjs, que genera los anchos en WebP.
export type PhotoKey =
  | "providers/hero-mesa"
  | "events/mesa-gracias"
  | "events/hero-fondo"
  | "providers/salones"
  | "providers/catering"
  | "providers/fotografia"
  | "providers/decoracion"
  | "providers/musica"
  | "providers/experiencias"
  | "providers/pasteles"
  | "providers/coordinacion"
  | "events/auth-login"
  | "events/auth-registro"
  | "events/auth-recuperar";

type Slot = { w: number; h: number; alt: string };

export const photoSlots: Record<PhotoKey, Slot> = {
  "providers/hero-mesa": { w: 1600, h: 1000, alt: "Mesa de banquete con flores y velas" },
  "events/mesa-gracias": { w: 1400, h: 1000, alt: "Mesa de celebración con arreglo floral" },
  "events/hero-fondo": { w: 1600, h: 900, alt: "" },
  "providers/salones": { w: 960, h: 720, alt: "Salón de eventos con mesas decoradas" },
  "providers/catering": { w: 960, h: 720, alt: "Platillos de catering para un evento" },
  "providers/fotografia": { w: 960, h: 720, alt: "Fotógrafo durante una celebración" },
  "providers/decoracion": { w: 960, h: 720, alt: "Decoración floral de una mesa" },
  "providers/musica": { w: 960, h: 720, alt: "Músico en vivo en un evento" },
  "providers/experiencias": { w: 960, h: 720, alt: "Brindis durante una celebración" },
  "providers/pasteles": { w: 960, h: 720, alt: "Pastel personalizado para una fiesta" },
  "providers/coordinacion": { w: 960, h: 720, alt: "Coordinación de un evento" },
  "events/auth-login": { w: 1000, h: 1250, alt: "Arreglo de flores con velas" },
  "events/auth-registro": { w: 1000, h: 1250, alt: "Persona sonriendo ante su portátil durante una celebración" },
  "events/auth-recuperar": { w: 1000, h: 1250, alt: "Sobre con un corazón sobre flores" },
};

const widths = [480, 960, 1600];

export function photoSources(key: PhotoKey) {
  const slot = photoSlots[key];
  const available = widths.filter((w) => w <= slot.w || w === widths[0]);
  const srcSet = available.map((w) => `/assets/${key}-${w}.webp ${w}w`).join(", ");
  const src = `/assets/${key}-${available[Math.min(1, available.length - 1)]}.webp`;
  return { ...slot, srcSet, src };
}
