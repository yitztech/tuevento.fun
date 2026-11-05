import { ChartColumn, Pencil, Send } from "lucide-react";
import type { MessageKey } from "@tuevento/contracts";
import { cn } from "cn";
import { tr } from "../../i18n";
import { wrap } from "./home-shared";
import { SectionHeading } from "./section-heading";

const steps: [typeof Pencil, MessageKey, MessageKey][] = [
  [Pencil, "landing.planSomethingSpecial", "landing.giveCelebrationNameChoose"],
  [Send, "landing.shareExcitement", "landing.createInvitationEachPerson"],
  [ChartColumn, "landing.knowWhoComing", "landing.eachPersonConfirmsTheir"],
];

export function HomeSteps() {
  return (
    <section id="como-funciona" aria-labelledby="pasos-title" className={cn(wrap, "scroll-mt-24 py-12 lg:py-16")}>
      <div className="grid gap-6 px-2 sm:px-4 md:grid-cols-3 lg:grid-cols-[minmax(0,17rem)_repeat(3,minmax(0,1fr))] lg:items-center lg:gap-6">
        <SectionHeading
          size="sm"
          id="pasos-title"
          eyebrow={tr("site.stepsEyebrow")}
          title={tr("landing.lessPlanningStressMore")}
          className="md:col-span-3 lg:col-span-1"
        />
        {steps.map(([Icon, title, text], i) => (
          <div key={title} className="flex gap-3 lg:border-l lg:border-border lg:pl-5">
            <span className="mt-0.5 grid size-9 shrink-0 place-items-center rounded-full bg-accent-soft text-sm font-bold text-primary">
              {i + 1}
            </span>
            <div>
              <h3 className="flex items-center gap-2 font-sans text-[0.95rem] font-bold text-primary">
                <Icon aria-hidden className="size-5 shrink-0" />
                {tr(title)}
              </h3>
              <p className="mt-1 text-[0.82rem] text-muted-foreground">{tr(text)}</p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
