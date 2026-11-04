import { cn } from "cn";

/** Adorno floral en posición absoluta; no recibe foco ni lo leen los lectores de pantalla. */
export function FloralCorner({ className }: { className?: string }) {
  return (
    <img
      src="/site/decorations/floral-corner.svg"
      alt=""
      aria-hidden
      width={420}
      height={460}
      loading="lazy"
      decoding="async"
      className={cn("pointer-events-none absolute select-none", className)}
    />
  );
}
