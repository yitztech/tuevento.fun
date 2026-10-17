import type { themes } from "@tuevento/contracts";

/** Smaller headers for phones; the full image stays sharp on tablets and desktop. */
export function themeImageSrcSet(theme: (typeof themes)[number]) {
  return "smallImage" in theme
    ? `/images/${theme.smallImage} 640w, /images/${theme.image} 1280w`
    : undefined;
}
