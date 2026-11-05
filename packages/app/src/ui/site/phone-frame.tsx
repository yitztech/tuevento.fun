import type { ReactNode } from "react";
import { cn } from "cn";

/** Marco de teléfono dibujado con CSS (sin imagen). El contenido escala con el ancho del marco. */
export function PhoneFrame({ children, className, label }: { children: ReactNode; className?: string; label?: string }) {
  return (
    <figure className={cn("@container w-full", className)} aria-label={label}>
      <div className="relative aspect-[9/18.6] w-full rounded-[13cqw] bg-phone p-[2.6cqw] shadow-[0_30px_60px_-24px_rgb(70_25_15/0.55)]">
        <div className="relative flex size-full flex-col overflow-hidden rounded-[10.6cqw] bg-card">
          <span aria-hidden className="absolute top-[2.6cqw] left-1/2 z-10 h-[4.6cqw] w-[26cqw] -translate-x-1/2 rounded-full bg-phone" />
          {children}
        </div>
      </div>
    </figure>
  );
}
