import { Link } from "react-router-dom";
import { ArrowRight, CircleCheck } from "lucide-react";
import type { MessageKey } from "@tuevento/contracts";
import { cn } from "cn";
import { tr } from "../../i18n";
import { Button } from "../button";
import { panel, wrap } from "./home-shared";
import { RsvpCard } from "./rsvp-card";
import { SectionHeading } from "./section-heading";
import { SitePhoto } from "./site-photo";

const bullets: MessageKey[] = [
  "landing.individualFamilyInvitations",
  "landing.adultsChildrenOnePerson",
  "landing.repliesNotificationsDashboard",
];

export function HomeFamily() {
  return (
    <section aria-labelledby="familia-title" className={cn(wrap, "pt-4")}>
      <div className="grid gap-4 lg:grid-cols-[minmax(0,0.78fr)_minmax(0,1.22fr)]">
        <div className="relative z-10">
          <RsvpCard />
          <p className="mt-2 px-1 text-xs text-muted-foreground">{tr("landing.interactiveExampleNoReplies")}</p>
        </div>
        <div className={cn(panel, "relative overflow-hidden")}>
          <div className="relative aspect-[16/10] md:aspect-[21/9] lg:absolute lg:inset-y-0 lg:right-0 lg:aspect-auto lg:w-[62%]">
            <SitePhoto name="family" className="lg:[mask-image:linear-gradient(to_right,transparent,#000_38%)]" />
            <p className="absolute top-1/2 left-1/2 w-[46%] max-w-[13rem] -translate-x-1/2 -translate-y-1/2 rotate-[-6deg] rounded-md bg-note/95 px-4 py-4 text-center font-script text-[clamp(1.2rem,2.4vw,1.9rem)] leading-tight text-title shadow-site-soft lg:left-[58%]">
              {tr("site.familyNote")}
            </p>
          </div>
          <div className="relative z-10 p-6 sm:p-8 lg:max-w-[48%] lg:p-10">
            <SectionHeading
              size="sm"
              id="familia-title"
              eyebrow={tr("site.familyEyebrow")}
              title={tr("landing.everyPersonCountsWithin")}
              text={tr("landing.anaComingLeoStill")}
            />
            <ul className="mt-5 space-y-2.5">
              {bullets.map((b) => (
                <li key={b} className="flex items-center gap-2.5 text-sm text-foreground">
                  <CircleCheck aria-hidden className="size-[1.15rem] shrink-0 text-primary" />
                  {tr(b)}
                </li>
              ))}
            </ul>
            <Button asChild variant="link" size="inline" className="mt-5 text-sm font-bold">
              <Link to="/registro">
                {tr("common.exploreDemo")}
                <ArrowRight aria-hidden />
              </Link>
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}
