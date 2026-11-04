import { useState } from "react";
import { Check, CircleCheck, Clock, Heart, X } from "lucide-react";
import type { MessageKey, Status } from "@tuevento/contracts";
import { cn } from "cn";
import { tr } from "../../i18n";

const family = [
  { name: "Ana", kind: "common.adult", initial: "accepted" },
  { name: "Leo", kind: "common.child", initial: "pending" },
  { name: "Luz", kind: "common.adult", initial: "accepted" },
] as const;

const options: { value: Status; label: MessageKey; icon: typeof Check; on: string }[] = [
  { value: "accepted", label: "landing.attending", icon: Check, on: "border-coral bg-accent-soft text-primary" },
  { value: "pending", label: "status.pending", icon: Clock, on: "border-warning bg-warning-soft text-warning-foreground" },
  { value: "declined", label: "landing.notAttending", icon: X, on: "border-destructive/50 bg-destructive-soft text-destructive" },
];

/** Ejemplo de asistencia por persona: no escribe en ningún evento. */
export function RsvpCard({ className }: { className?: string }) {
  const [answers, setAnswers] = useState<Status[]>(family.map((person) => person.initial));
  const attending = answers.filter((status) => status === "accepted").length;
  return (
    <section className={cn("rounded-xl border border-border/70 bg-card p-5 shadow-site-card sm:p-6", className)} aria-labelledby="rsvp-title">
      <header className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h3 id="rsvp-title" className="font-serif text-lg font-semibold text-primary">
            {tr("landing.oneFamilyThreeReplies")}
          </h3>
          <p className="text-xs text-muted-foreground">{tr("landing.tryAttendanceExample")}</p>
        </div>
        <Heart aria-hidden className="size-5 text-primary/80" />
      </header>
      <ul className="space-y-3">
        {family.map((person, index) => (
          <li key={person.name}>
            <div className="mb-1.5 flex items-center gap-3">
              <span aria-hidden className="grid size-9 shrink-0 place-items-center rounded-full bg-linear-to-br from-peach to-coral font-serif text-base font-semibold text-white">
                {person.name.charAt(0)}
              </span>
              <span className="text-sm font-bold text-foreground">{person.name}</span>
              <span className="ml-auto text-xs text-muted-foreground">{tr(person.kind)}</span>
            </div>
            <div className="grid grid-cols-3 gap-2" role="group" aria-label={tr("landing.replyFromName", { name: person.name })}>
              {options.map((option) => {
                const on = answers[index] === option.value;
                return (
                  <button
                    key={option.value}
                    type="button"
                    aria-pressed={on}
                    onClick={() => setAnswers((previous) => previous.map((answer, i) => (i === index ? option.value : answer)))}
                    className={cn(
                      "flex min-h-10 cursor-pointer items-center justify-center gap-1.5 rounded-md border px-1.5 text-[0.72rem] font-semibold transition-colors outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50",
                      on ? option.on : "border-border bg-card text-muted-foreground hover:bg-accent-soft/60",
                    )}
                  >
                    <option.icon aria-hidden className="size-3.5 shrink-0" />
                    {tr(option.label)}
                  </button>
                );
              })}
            </div>
          </li>
        ))}
      </ul>
      <p className="mt-4 flex items-center gap-2 text-sm font-bold text-primary" role="status">
        <CircleCheck aria-hidden className="size-5" />
        {tr("landing.count3PeopleAttending", { count: attending })}
      </p>
    </section>
  );
}
