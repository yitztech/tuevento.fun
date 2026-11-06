import type { SitePaletteId } from "@tuevento/contracts";

/** Tono aplicado al logo desaturado; null conserva la marca fucsia original. */
export const brandHueRotation: Record<SitePaletteId, number | null> = {
  terracotta: 325,
  "fuchsia-plum-amber": null,
  "plum-champagne": 260,
  "mandarin-raspberry": 345,
  "raspberry-vanilla": 285,
  "ocean-aqua": 155,
  "forest-mint": 75,
  "indigo-ice": 180,
  "petrol-lime": 130,
};

export function brandFilter(hue: number | null): string {
  return hue === null ? "none" : `grayscale(1) sepia(1) saturate(3) hue-rotate(${hue}deg)`;
}
