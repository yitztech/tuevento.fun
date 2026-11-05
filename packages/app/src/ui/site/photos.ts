/** Imágenes ilustrativas generadas para la identidad visual del sitio. */
export const sitePhotos = {
  family: "/site/photos/events/mesa-gracias",
  login: "/site/photos/events/auth-login",
  register: "/site/photos/events/auth-registro",
  recover: "/site/photos/events/auth-recuperar",
  hero: "/site/photos/events/hero-fondo",
  venue: "/site/photos/providers/salones",
  catering: "/site/photos/providers/catering",
  photography: "/site/photos/providers/fotografia",
  decoration: "/site/photos/providers/decoracion",
  music: "/site/photos/providers/musica",
  experiences: "/site/photos/providers/experiencias",
} as const;
export type SitePhotoName = keyof typeof sitePhotos;
