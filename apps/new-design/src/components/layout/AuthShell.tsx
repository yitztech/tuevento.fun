import { Check } from "lucide-react";
import type * as React from "react";
import { Photo } from "@/components/shared/Photo";
import type { PhotoKey } from "@/lib/photos";

type Props = {
  photo: PhotoKey;
  quote: string;
  children: React.ReactNode;
  /** Tarjetas de beneficios sobre la foto (solo escritorio) */
  benefits?: readonly string[];
  /** Panel de ayuda sobre la foto (recuperar contraseña) */
  help?: { title: string; items: readonly string[] };
};

/** Composición dividida de acceso: formulario a la izquierda, fotografía y tarjetas a la derecha. */
export function AuthShell({ photo, quote, children, benefits, help }: Props) {
  return (
    <div className="mx-auto w-full max-w-auth px-4 pt-2 pb-14 sm:px-6 lg:px-8 lg:pt-6">
      <div className="grid grid-cols-1 overflow-hidden rounded-2xl border border-white/70 bg-card/75 shadow-card backdrop-blur-sm lg:grid-cols-[1fr_1.05fr]">
        <section className="mx-auto w-full max-w-xl p-6 sm:p-10 lg:flex lg:max-w-none lg:flex-col lg:justify-center lg:p-14 xl:px-20">
          <div className="w-full lg:max-w-md">{children}</div>
        </section>
        <aside className="relative order-first h-56 overflow-hidden sm:h-72 lg:order-last lg:h-auto lg:min-h-[44rem] lg:p-5 lg:pl-0">
          <div className="relative size-full overflow-hidden lg:rounded-[2rem] lg:rounded-l-[7rem]">
            <Photo name={photo} eager sizes="(min-width:1024px) 45vw, 100vw" />
            <div aria-hidden className="absolute inset-0 bg-linear-to-t from-[#3a1a12]/35 via-transparent to-transparent lg:from-transparent" />
            <p className="absolute top-1/2 left-1/2 w-[62%] max-w-[17rem] -translate-x-1/2 -translate-y-[70%] rotate-[-5deg] rounded-md bg-[#fbe7da]/95 px-5 py-6 text-center font-script text-3xl leading-[1.15] text-title shadow-soft sm:text-4xl lg:left-[56%] lg:-translate-y-[95%]">
              {quote}
            </p>
            {benefits && (
              <ul className="absolute right-4 bottom-4 left-4 hidden space-y-2 lg:block">
                {benefits.map((b) => (
                  <li key={b} className="flex items-center gap-3 rounded-lg bg-card/92 px-4 py-2.5 text-[0.82rem] font-semibold text-title shadow-soft">
                    <span className="grid size-7 place-items-center rounded-full bg-accent-soft text-primary">
                      <Check aria-hidden className="size-4" />
                    </span>
                    {b}
                  </li>
                ))}
              </ul>
            )}
            {help && (
              <div className="absolute right-4 bottom-4 left-4 hidden rounded-xl bg-card/94 p-5 shadow-soft lg:block">
                <h2 className="font-sans text-sm font-bold text-title">{help.title}</h2>
                <ul className="mt-3 space-y-2">
                  {help.items.map((i) => (
                    <li key={i} className="flex items-center gap-2.5 text-[0.82rem] text-foreground">
                      <Check aria-hidden className="size-4 shrink-0 text-primary" />
                      {i}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}
