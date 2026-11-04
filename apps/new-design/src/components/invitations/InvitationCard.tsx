import { cn } from "@/lib/cn";
import type { InvitationDesign } from "@/types";

type Props = {
  design: InvitationDesign;
  title?: string;
  subtitle?: string;
  caption?: string;
  className?: string;
  /** Giro en grados, para composiciones superpuestas */
  tilt?: number;
  /** Prioriza la carga (solo el hero) */
  eager?: boolean;
};

/**
 * Invitación: fondo ilustrado en SVG y texto en HTML con su tipografía. El tamaño del texto usa
 * unidades de contenedor (cqw), así que la tarjeta se ve igual en 90 px que en 400 px.
 */
export function InvitationCard({ design, title, subtitle, caption, className, tilt = 0, eager = false }: Props) {
  const t = title ?? design.title;
  const s = subtitle ?? design.subtitle;
  const c = caption ?? design.caption;
  return (
    <div
      className={cn("@container relative aspect-[2/3] w-full overflow-hidden rounded-lg bg-card shadow-card", className)}
      style={tilt ? { transform: `rotate(${tilt}deg)` } : undefined}
      role="img"
      aria-label={`${design.label}: ${t}`}
    >
      <img
        src={`/assets/invitations/${design.background}.svg`}
        alt=""
        width={600}
        height={900}
        loading={eager ? "eager" : "lazy"}
        decoding="async"
        className="absolute inset-0 size-full object-cover"
      />
      <div aria-hidden className="absolute inset-x-[9%] text-center" style={{ top: `${design.top}%`, color: design.color }}>
        <p className={cn("leading-[1.02]", design.font === "script" ? "font-script text-[17cqw]" : "font-serif text-[9.4cqw] font-medium")}>{t}</p>
        {s && <p className="mt-[3cqw] font-serif text-[6.2cqw] italic">{s}</p>}
        {c && <p className="mt-[4cqw] text-[3.8cqw] font-semibold tracking-[0.22em] uppercase opacity-80">{c}</p>}
      </div>
    </div>
  );
}
