import { ChevronLeft, ChevronRight } from "lucide-react";
import { useRef } from "react";
import { InvitationCard } from "@/components/invitations/InvitationCard";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";
import { copy } from "@/lib/copy";
import type { InvitationDesign } from "@/types";

type Props = {
  designs: InvitationDesign[];
  /** Si se pasa, las tarjetas son opciones seleccionables (demostración) */
  selectedId?: string;
  onSelect?: (id: string) => void;
  className?: string;
  itemClass?: string;
};

/** Carrusel con scroll-snap: táctil de forma nativa, flechas visibles y teclado (← →, Inicio, Fin). */
export function InvitationCarousel({ designs, selectedId, onSelect, className, itemClass }: Props) {
  const track = useRef<HTMLUListElement>(null);
  const page = (dir: 1 | -1) => {
    const el = track.current;
    if (el) el.scrollBy({ left: dir * el.clientWidth * 0.85, behavior: "smooth" });
  };
  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowRight") page(1);
    else if (e.key === "ArrowLeft") page(-1);
    else if (e.key === "Home") track.current?.scrollTo({ left: 0, behavior: "smooth" });
    else if (e.key === "End") track.current?.scrollTo({ left: track.current.scrollWidth, behavior: "smooth" });
    else return;
    e.preventDefault();
  };
  return (
    <div className={cn("relative", className)}>
      {/* biome-ignore lint/a11y/noNoninteractiveTabindex: región desplazable que debe poder enfocarse para usar el teclado */}
      <ul
        ref={track}
        tabIndex={0}
        aria-label={copy.designs.carousel}
        aria-roledescription="carrusel"
        onKeyDown={onKeyDown}
        className="-mx-2 flex snap-x snap-mandatory gap-3 overflow-x-auto scroll-smooth px-2 py-2.5 [-ms-overflow-style:none] [scrollbar-width:none] focus-visible:rounded-lg [&::-webkit-scrollbar]:hidden"
      >
        {designs.map((d) => (
          <li key={d.id} className={cn("w-[42%] shrink-0 snap-start sm:w-[28%] md:w-[22%] lg:w-[18.5%]", itemClass)}>
            {onSelect ? (
              <button
                type="button"
                onClick={() => onSelect(d.id)}
                aria-pressed={selectedId === d.id}
                className={cn("block w-full cursor-pointer rounded-lg outline-none transition-transform hover:-translate-y-0.5 focus-visible:ring-[3px] focus-visible:ring-ring/50 motion-reduce:transition-none", selectedId === d.id && "ring-[3px] ring-primary ring-offset-2 ring-offset-card")}
              >
                <InvitationCard design={d} />
              </button>
            ) : (
              <InvitationCard design={d} />
            )}
          </li>
        ))}
      </ul>
      <Button variant="light" size="icon" onClick={() => page(1)} aria-label={copy.designs.next} className="absolute top-1/2 -right-3 hidden -translate-y-1/2 shadow-soft sm:inline-flex">
        <ChevronRight />
      </Button>
      <Button variant="light" size="icon" onClick={() => page(-1)} aria-label={copy.designs.prev} className="absolute top-1/2 -left-3 hidden -translate-y-1/2 shadow-soft sm:inline-flex">
        <ChevronLeft />
      </Button>
    </div>
  );
}
