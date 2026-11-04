import { cn } from "cn";
import { sitePhotos, type SitePhotoName } from "./photos";

/** Fotografía decorativa: el texto importante nunca va solo en la imagen. */
export function SitePhoto({ name, eager = false, className }: { name: SitePhotoName; eager?: boolean; className?: string }) {
  return (
    <img
      src={sitePhotos[name]}
      alt=""
      width={1200}
      height={800}
      loading={eager ? "eager" : "lazy"}
      decoding="async"
      className={cn("size-full object-cover", className)}
    />
  );
}
