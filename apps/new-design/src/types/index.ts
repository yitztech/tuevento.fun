import type { PhotoKey } from "@/lib/photos";

export type RsvpStatus = "attending" | "waiting" | "declined";

export type Guest = { id: string; name: string; kind: "adult" | "child"; status: RsvpStatus };

export type InvitationTag = "bodas" | "cumpleanos" | "infantil" | "minimalista" | "floral" | "elegante" | "celebracion";

export type InvitationDesign = {
  id: string;
  /** Archivo SVG de fondo en /assets/invitations */
  background: string;
  tags: InvitationTag[];
  title: string;
  subtitle: string;
  caption: string;
  font: "script" | "serif";
  color: string;
  /** Posición vertical del bloque de texto, en % del alto de la tarjeta */
  top: number;
  label: string;
};

export type ProviderCategoryId = "salones" | "catering" | "fotografia" | "decoracion" | "musica" | "pasteles" | "coordinacion" | "experiencias";

export type Provider = {
  id: string;
  name: string;
  specialty: string;
  category: ProviderCategoryId;
  photo: PhotoKey;
};
