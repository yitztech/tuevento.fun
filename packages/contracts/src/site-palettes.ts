import { z } from "zod";

/** Las invitaciones tienen su propio tema; esta paleta solo afecta a la interfaz. */
export const sitePaletteIds = ["terracotta", "fuchsia-plum-amber", "plum-champagne", "mandarin-raspberry", "raspberry-vanilla", "ocean-aqua", "forest-mint", "indigo-ice", "petrol-lime"] as const;
export type SitePaletteId = (typeof sitePaletteIds)[number];
export const sitePaletteSchema = z.strictObject({ palette: z.enum(sitePaletteIds) });

const common = { ground: "#ffffff", primaryText: "#ffffff", brandFuchsia: "#ff0054", lineStrong: "#9c7588" } as const;
/** Familia fría, opuesta a las cálidas: mismo reparto de papeles, con un fondo casi blanco y tinta muy oscura. */
const cool = { ground: "#ffffff", primaryText: "#ffffff", lineStrong: "#7f94a3" } as const;
export const sitePalettes = {
  "fuchsia-plum-amber": { ...common, primary: "#d9004b", primaryHover: "#b80040", celebrate: "#ffc400", celebrateHover: "#e6ae00", celebrateText: "#3d002b", accentSecondary: "#ff8a00", accentGold: "#ffc400", ink: "#3d002b", muted: "#755b6b", siteBg: "#fff7fa", surfaceSoft: "#fff0f5", surfaceSoftHover: "#ffe3ee", line: "#e9d6df" },
  "plum-champagne": { ...common, primary: "#570035", primaryHover: "#3d002b", celebrate: "#ffd166", celebrateHover: "#f4bf46", celebrateText: "#320d26", accentSecondary: "#ff8a00", accentGold: "#ffd166", ink: "#320d26", muted: "#735d69", siteBg: "#fffaf5", surfaceSoft: "#fff1f6", surfaceSoftHover: "#ffe3ee", line: "#ead8e1" },
  "mandarin-raspberry": { ...common, primary: "#b94a00", primaryHover: "#963a00", celebrate: "#d9004b", celebrateHover: "#b80040", celebrateText: "#ffffff", accentSecondary: "#ffc400", accentGold: "#ffc400", ink: "#40152d", muted: "#775a66", siteBg: "#fff9f3", surfaceSoft: "#fff0e3", surfaceSoftHover: "#ffe4cd", line: "#eeddd0" },
  "raspberry-vanilla": { ...common, primary: "#a90046", primaryHover: "#850037", celebrate: "#ffe08a", celebrateHover: "#f4cd6d", celebrateText: "#3d102a", accentSecondary: "#ff8a00", accentGold: "#ffe08a", ink: "#3d102a", muted: "#735d68", siteBg: "#fffdf5", surfaceSoft: "#fff0f6", surfaceSoftHover: "#ffe1ed", line: "#eddee3" },
  "ocean-aqua": { ...cool, brandFuchsia: "#1fb6c9", primary: "#0a5a8a", primaryHover: "#084a72", celebrate: "#5ce1d6", celebrateHover: "#3fcfc3", celebrateText: "#06283d", accentSecondary: "#1fb6c9", accentGold: "#5ce1d6", ink: "#06283d", muted: "#4f6675", siteBg: "#f5fbfe", surfaceSoft: "#e8f5fb", surfaceSoftHover: "#d8edf7", line: "#d3e3ec" },
  "forest-mint": { ...cool, brandFuchsia: "#2fb67c", primary: "#12633f", primaryHover: "#0d4f32", celebrate: "#8ee6b8", celebrateHover: "#6fd8a1", celebrateText: "#0b2e20", accentSecondary: "#2fb67c", accentGold: "#8ee6b8", ink: "#0b2e20", muted: "#4f6a5d", siteBg: "#f5fcf8", surfaceSoft: "#e7f6ee", surfaceSoftHover: "#d6efe2", line: "#d2e6db" },
  "indigo-ice": { ...cool, brandFuchsia: "#5b8def", primary: "#3a3fb8", primaryHover: "#2e3296", celebrate: "#a9d6ff", celebrateHover: "#8cc6fb", celebrateText: "#15174a", accentSecondary: "#5b8def", accentGold: "#a9d6ff", ink: "#15174a", muted: "#5a5e7d", siteBg: "#f7f8fe", surfaceSoft: "#eceefb", surfaceSoftHover: "#dfe2f8", line: "#d9dcee" },
  "petrol-lime": { ...cool, brandFuchsia: "#27a8a0", primary: "#0f5c63", primaryHover: "#0b4a50", celebrate: "#c6ec5a", celebrateHover: "#b3de3f", celebrateText: "#0d2f33", accentSecondary: "#27a8a0", accentGold: "#c6ec5a", ink: "#0d2f33", muted: "#4d686a", siteBg: "#f6fbf9", surfaceSoft: "#e8f4f2", surfaceSoftHover: "#d8ece9", line: "#d3e4e1" },
} as const;
