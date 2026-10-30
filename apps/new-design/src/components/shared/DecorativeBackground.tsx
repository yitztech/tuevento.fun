import { cn } from "@/lib/cn";

type Piece = "corner-left" | "corner-right" | "branch" | "confetti" | "balloons";

const pieces: Record<Piece, { src: string; cls: string }> = {
  "corner-left": { src: "floral-corner", cls: "-left-24 top-24 w-64 rotate-[8deg] opacity-80 md:-left-16 md:w-80" },
  "corner-right": { src: "floral-corner", cls: "-right-28 top-10 w-72 scale-x-[-1] opacity-70 md:w-96" },
  branch: { src: "leaf-branch", cls: "-left-8 bottom-0 w-32 opacity-70 md:w-44" },
  confetti: { src: "confetti", cls: "right-0 top-0 w-80 opacity-80" },
  balloons: { src: "balloons", cls: "right-4 top-4 w-28 opacity-90 md:w-36" },
};

/** Adorno vectorial posicionado en absoluto; no recibe foco ni lo leen los lectores de pantalla. */
export function DecorativeBackground({ piece, className }: { piece: Piece; className?: string }) {
  const p = pieces[piece];
  return <img src={`/assets/decorations/${p.src}.svg`} alt="" aria-hidden width={420} height={460} loading="lazy" decoding="async" className={cn("pointer-events-none absolute -z-0 select-none", p.cls, className)} />;
}
