import type { themes } from "@tuevento/contracts";

/** Smaller headers for phones; the full image stays sharp on tablets and desktop. */
export function themeImageSrcSet(theme: (typeof themes)[number]) {
  if (!("smallImage" in theme)) return undefined;
  const [small, full] = "imageWidths" in theme ? theme.imageWidths : [640, 1280];
  return `/images/${theme.smallImage} ${small}w, /images/${theme.image} ${full}w`;
}
