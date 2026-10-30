import type * as React from "react";
import { cn } from "@/lib/cn";

/** Marco de teléfono dibujado con CSS (sin imagen). El contenido escala con el ancho del marco. */
export function PhoneFrame({ children, className, label }: { children: React.ReactNode; className?: string; label?: string }) {
  return (
    <div className={cn("@container w-full", className)} role={label ? "img" : undefined} aria-label={label}>
      <div className="relative aspect-[9/18.6] w-full rounded-[13cqw] bg-[#2a1a15] p-[2.6cqw] shadow-[0_30px_60px_-24px_rgb(70_25_15/0.55)]">
        <div className="relative flex size-full flex-col overflow-hidden rounded-[10.6cqw] bg-card">
          <span aria-hidden className="absolute top-[2.6cqw] left-1/2 z-10 h-[4.6cqw] w-[26cqw] -translate-x-1/2 rounded-full bg-[#2a1a15]" />
          {children}
        </div>
      </div>
    </div>
  );
}
