import type { Provider, ProviderCategoryId } from "@/types";

// Perfiles ilustrativos: no son negocios reales ni llevan valoraciones, disponibilidad ni ciudad.
export const providerCategories: { id: ProviderCategoryId; title: string }[] = [
  { id: "salones", title: "Salones y espacios" },
  { id: "catering", title: "Catering y banquetes" },
  { id: "fotografia", title: "Fotografía y video" },
  { id: "decoracion", title: "Decoración" },
  { id: "musica", title: "Música y entretenimiento" },
  { id: "pasteles", title: "Pasteles y repostería" },
  { id: "coordinacion", title: "Coordinación de eventos" },
  { id: "experiencias", title: "Experiencias" },
];

export const providers: Provider[] = [
  { id: "p1", name: "Salón con jardín", specialty: "Espacios para bodas y fiestas", category: "salones", photo: "providers/salones" },
  { id: "p2", name: "Banquetes y buffet", specialty: "Catering para eventos", category: "catering", photo: "providers/catering" },
  { id: "p3", name: "Fotografía de eventos", specialty: "Fotografía y video", category: "fotografia", photo: "providers/fotografia" },
  { id: "p4", name: "Flores y ambientación", specialty: "Decoración floral", category: "decoracion", photo: "providers/decoracion" },
  { id: "p5", name: "Música en vivo", specialty: "Bandas y DJ para fiestas", category: "musica", photo: "providers/musica" },
  { id: "p6", name: "Pasteles personalizados", specialty: "Repostería para celebraciones", category: "pasteles", photo: "providers/pasteles" },
  { id: "p7", name: "Coordinación integral", specialty: "Planeación y coordinación", category: "coordinacion", photo: "providers/coordinacion" },
  { id: "p8", name: "Brindis y experiencias", specialty: "Barras y momentos especiales", category: "experiencias", photo: "providers/experiencias" },
];

const normalize = (s: string) => s.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();

export function filterProviders(query: string, category: ProviderCategoryId | "all") {
  const q = normalize(query.trim());
  const catTitle = (id: ProviderCategoryId) => providerCategories.find((c) => c.id === id)?.title ?? "";
  return providers.filter((p) => {
    if (category !== "all" && p.category !== category) return false;
    if (!q) return true;
    return normalize(`${p.name} ${p.specialty} ${catTitle(p.category)}`).includes(q);
  });
}
