import { z } from "zod";

/** Las invitaciones tienen su propio tema; esta paleta solo afecta a la interfaz. */
export const sitePaletteIds = ["terracotta", "fuchsia-plum-amber", "plum-champagne", "mandarin-raspberry", "raspberry-vanilla"] as const;
export type SitePaletteId = (typeof sitePaletteIds)[number];
export const sitePaletteSchema = z.strictObject({ palette: z.enum(sitePaletteIds) });

const common = { ground: "#ffffff", primaryText: "#ffffff", brandFuchsia: "#ff0054", lineStrong: "#9c7588" } as const;
export const sitePalettes = {
  "fuchsia-plum-amber": { ...common, primary: "#d9004b", primaryHover: "#b80040", celebrate: "#ffc400", celebrateHover: "#e6ae00", celebrateText: "#3d002b", accentSecondary: "#ff8a00", accentGold: "#ffc400", ink: "#3d002b", muted: "#755b6b", siteBg: "#fff7fa", surfaceSoft: "#fff0f5", surfaceSoftHover: "#ffe3ee", line: "#e9d6df" },
  "plum-champagne": { ...common, primary: "#570035", primaryHover: "#3d002b", celebrate: "#ffd166", celebrateHover: "#f4bf46", celebrateText: "#320d26", accentSecondary: "#ff8a00", accentGold: "#ffd166", ink: "#320d26", muted: "#735d69", siteBg: "#fffaf5", surfaceSoft: "#fff1f6", surfaceSoftHover: "#ffe3ee", line: "#ead8e1" },
  "mandarin-raspberry": { ...common, primary: "#b94a00", primaryHover: "#963a00", celebrate: "#d9004b", celebrateHover: "#b80040", celebrateText: "#ffffff", accentSecondary: "#ffc400", accentGold: "#ffc400", ink: "#40152d", muted: "#775a66", siteBg: "#fff9f3", surfaceSoft: "#fff0e3", surfaceSoftHover: "#ffe4cd", line: "#eeddd0" },
  "raspberry-vanilla": { ...common, primary: "#a90046", primaryHover: "#850037", celebrate: "#ffe08a", celebrateHover: "#f4cd6d", celebrateText: "#3d102a", accentSecondary: "#ff8a00", accentGold: "#ffe08a", ink: "#3d102a", muted: "#735d68", siteBg: "#fffdf5", surfaceSoft: "#fff0f6", surfaceSoftHover: "#ffe1ed", line: "#eddee3" },
} as const;
