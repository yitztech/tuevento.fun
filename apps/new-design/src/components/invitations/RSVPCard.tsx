import { Check, CircleCheck, Clock, Heart, X } from "lucide-react";
import { useId } from "react";
import { cn } from "@/lib/cn";
import { copy } from "@/lib/copy";
import { initials } from "@/lib/format";
import type { Guest, RsvpStatus } from "@/types";

const options: { value: RsvpStatus; label: string; icon: typeof Check; on: string }[] = [
  { value: "attending", label: copy.rsvp.attending, icon: Check, on: "border-secondary bg-accent-soft text-primary" },
  { value: "waiting", label: copy.rsvp.waiting, icon: Clock, on: "border-warning bg-warning-soft text-warning-foreground" },
  { value: "declined", label: copy.rsvp.declined, icon: X, on: "border-destructive/50 bg-destructive-soft text-destructive" },
];

export function attendingCount(guests: Guest[]) {
  return guests.filter((g) => g.status === "attending").length;
}

function Avatar({ name }: { name: string }) {
  return (
    <span aria-hidden className="grid size-9 shrink-0 place-items-center rounded-full bg-linear-to-br from-accent to-secondary font-serif text-base font-semibold text-white">
      {initials(name)}
    </span>
  );
}

type Props = {
  guests: Guest[];
  onChange: (id: string, status: RsvpStatus) => void;
  title?: string;
  hint?: string;
  className?: string;
  /** Muestra el encabezado con el corazón (tarjeta de la portada) */
  showHeader?: boolean;
};

/** Respuesta por persona: un grupo de radios nativos por invitado (teclado y lector de pantalla incluidos). */
export function RSVPCard({ guests, onChange, title, hint, className, showHeader = true }: Props) {
  const uid = useId();
  const n = attendingCount(guests);
  return (
    <section className={cn("rounded-xl border border-border/70 bg-card p-5 shadow-card sm:p-6", className)} aria-labelledby={`${uid}-t`}>
      {showHeader && (
        <header className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h3 id={`${uid}-t`} className="font-serif text-lg font-semibold text-primary">
              {title ?? copy.rsvp.title}
            </h3>
            <p className="text-xs text-muted-foreground">{hint ?? copy.rsvp.hint}</p>
          </div>
          <Heart aria-hidden className="size-5 text-primary/80" />
        </header>
      )}
      <ul className="space-y-3">
        {guests.map((g) => (
          <li key={g.id}>
            <fieldset className="min-w-0">
              <legend className="sr-only">{copy.rsvp.group(g.name)}</legend>
              <div className="mb-1.5 flex items-center gap-3">
                <Avatar name={g.name} />
                <span className="text-sm font-bold text-foreground">{g.name}</span>
                <span className="ml-auto text-xs text-muted-foreground">{g.kind === "adult" ? copy.rsvp.adult : copy.rsvp.child}</span>
              </div>
              <div className="grid grid-cols-3 gap-2">
                {options.map((o) => {
                  const checked = g.status === o.value;
                  return (
                    <label
                      key={o.value}
                      className={cn(
                        "relative flex min-h-10 cursor-pointer items-center justify-center gap-1.5 rounded-md border px-1.5 text-[0.72rem] font-semibold transition-colors has-focus-visible:ring-[3px] has-focus-visible:ring-ring/40 sm:text-xs",
                        checked ? o.on : "border-border bg-card text-muted-foreground hover:bg-accent-soft/60",
                      )}
                    >
                      <input type="radio" name={`${uid}-${g.id}`} value={o.value} checked={checked} onChange={() => onChange(g.id, o.value)} className="sr-only" />
                      <o.icon aria-hidden className="size-3.5 shrink-0" />
                      {o.label}
                    </label>
                  );
                })}
              </div>
            </fieldset>
          </li>
        ))}
      </ul>
      <p className="mt-4 flex items-center gap-2 text-sm font-bold text-primary" aria-live="polite">
        <CircleCheck aria-hidden className="size-5" />
        {copy.rsvp.summary(n, guests.length)}
      </p>
    </section>
  );
}
