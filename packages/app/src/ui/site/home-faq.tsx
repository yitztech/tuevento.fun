import { Check, Quote } from "lucide-react";
import type { MessageKey } from "@tuevento/contracts";
import { cn } from "cn";
import { tr } from "../../i18n";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "../accordion";
import { panel, wrap } from "./home-shared";
import { SectionHeading } from "./section-heading";

const faq: [MessageKey, MessageKey][] = [
  ["landing.doGuestsNeedSign", "landing.noTheyOpenTheir"],
  ["landing.organizeMoreThanOne", "landing.yesAccountBringsTogether"],
  ["landing.howDoSendInvitations", "landing.eachInvitationHasPrivate"],
  ["landing.changeDesignDetails", "landing.yesEditEventInformation"],
];

const points: MessageKey[] = ["site.promisePointTap", "site.promisePointNoSignup", "site.promisePointPrivate"];

export function HomeFaq() {
  return (
    <section id="preguntas" aria-labelledby="faq-title" className={cn(wrap, "scroll-mt-24 pt-4")}>
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-[minmax(0,1fr)_minmax(0,0.8fr)_minmax(0,1.15fr)] lg:items-center lg:gap-8">
        <figure className={cn(panel, "p-6 sm:p-7")}>
          <Quote aria-hidden className="mb-3 size-8 fill-peach text-peach" />
          <blockquote className="font-serif text-lg leading-snug text-title italic">{tr("site.promiseQuote")}</blockquote>
          <figcaption className="mt-4 text-xs font-bold tracking-wide text-primary uppercase">{tr("site.promiseCaption")}</figcaption>
          <ul className="mt-3 space-y-1.5">
            {points.map((p) => (
              <li key={p} className="flex items-center gap-2 text-sm text-foreground">
                <Check aria-hidden className="size-4 shrink-0 text-primary" />
                {tr(p)}
              </li>
            ))}
          </ul>
        </figure>
        <SectionHeading
          size="sm"
          id="faq-title"
          eyebrow={tr("landing.frequentlyAskedQuestions")}
          title={tr("landing.readyTakeFirstStep")}
          text={tr("landing.fewAnswersBeforeCelebration")}
        />
        <div className="md:col-span-2 lg:col-span-1">
          <Accordion type="single" collapsible className="border-t border-border/90">
            {faq.map(([question, answer]) => (
              <AccordionItem key={question} value={question} className="border-border/90 last:border-b">
                <AccordionTrigger className="min-h-12 items-center py-3 font-semibold text-title hover:text-primary hover:no-underline">
                  {tr(question)}
                </AccordionTrigger>
                <AccordionContent className="text-muted-foreground">{tr(answer)}</AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
      </div>
    </section>
  );
}
