/**
 * Las fotografías del sitio, en una sola tabla. Hoy son las de docs/ASSETS.md (con licencia);
 * cuando lleguen las definitivas solo cambia este archivo.
 */
export const sitePhotos = {
  family: "/images/gold.jpg",
  login: "/images/gold.jpg",
  register: "/images/floral.jpg",
  recover: "/images/minimal.jpg",
} as const;

export type SitePhotoName = keyof typeof sitePhotos;
