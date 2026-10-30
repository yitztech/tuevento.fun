import type { InvitationDesign } from "@/types";

export const designs: InvitationDesign[] = [
  { id: "boda-floral", background: "boda-floral", tags: ["bodas", "floral", "elegante"], title: "Nuestra Boda", subtitle: "", caption: "12 · DIC · 2026", font: "script", color: "#7a2a1b", top: 34, label: "Boda floral" },
  { id: "cumpleanos-globos", background: "cumpleanos-globos", tags: ["cumpleanos", "celebracion"], title: "Cumpleaños", subtitle: "¡Estás invitado!", caption: "", font: "script", color: "#c9482f", top: 50, label: "Cumpleaños con globos" },
  { id: "noche-bokeh", background: "noche-bokeh", tags: ["celebracion", "elegante"], title: "Una noche para recordar", subtitle: "", caption: "12 de diciembre de 2026", font: "serif", color: "#ffffff", top: 42, label: "Una noche para recordar" },
  { id: "infantil-oso", background: "infantil-oso", tags: ["infantil", "cumpleanos"], title: "Vamos a celebrar", subtitle: "", caption: "", font: "serif", color: "#7a2a1b", top: 17, label: "Fiesta infantil con osito" },
  { id: "xv-rosas", background: "xv-rosas", tags: ["floral", "celebracion"], title: "XV Valentina", subtitle: "", caption: "15 · NOV · 2026", font: "script", color: "#8a2f3a", top: 40, label: "XV años con rosas" },
  { id: "minimalista", background: "minimalista", tags: ["minimalista", "bodas"], title: "Nos vemos pronto", subtitle: "", caption: "Sábado · 18:00 h", font: "serif", color: "#2d1f1c", top: 38, label: "Minimalista" },
  { id: "elegante", background: "elegante", tags: ["elegante", "bodas"], title: "Celebremos juntos", subtitle: "", caption: "Con cariño", font: "serif", color: "#e8c98a", top: 40, label: "Elegante" },
  { id: "evento-especial", background: "evento-especial", tags: ["celebracion"], title: "Graduación 2026", subtitle: "¡Celebra con nosotros!", caption: "", font: "serif", color: "#ffffff", top: 40, label: "Evento especial" },
];

export const designById = (id: string) => designs.find((d) => d.id === id) ?? designs[0];
