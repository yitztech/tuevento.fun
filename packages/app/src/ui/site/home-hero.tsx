import { Link } from "react-router-dom";
import { ArrowRight, CircleCheck, Heart, Play, Users } from "lucide-react";
import { themes } from "@tuevento/contracts";
import { cn } from "cn";
import { RichText, tr } from "../../i18n";
import { Button } from "../button";
import { FloralCorner } from "./decorative-background";
import { wrap } from "./home-shared";
import { PhoneInvitation } from "./phone-invitation";
import { ThemeCard } from "./theme-card";
import { SitePhoto } from "./site-photo";

const theme = (id: string) => themes.find((t) => t.id === id) ?? themes[0];

function HeroComposition() {
  return (
    <div className="relative mx-auto aspect-[1.08/1] w-full max-w-[40rem] lg:max-w-none">
      <SitePhoto name="hero" eager className="absolute inset-0 -z-10 rounded-[3rem] opacity-30 [mask-image:radial-gradient(closest-side,#000_40%,transparent)]" />
      <div aria-hidden className="absolute top-[16%] left-[3%] w-[27%]">
        <ThemeCard theme={theme("kids")} tilt={-10} eager />
      </div>
      <div aria-hidden className="absolute top-[3%] left-[66%] w-[24%]">
        <ThemeCard theme={theme("neon")} tilt={7} eager />
      </div>
      <div aria-hidden className="absolute top-[20%] left-[76%] w-[24%]">
        <ThemeCard theme={theme("gold")} tilt={13} eager />
      </div>
      <div className="absolute top-[-1%] left-[31%] z-20 w-[35%]">
        <PhoneInvitation theme={theme("floral")} eager label={tr("site.phonePreview")} />
      </div>
      <p className="absolute right-[1%] bottom-[7%] z-30 w-[42%] rotate-[-7deg] rounded-md bg-note px-[3%] py-[2.6%] text-center font-script text-[clamp(1.1rem,2.6vw,1.9rem)] leading-tight text-title shadow-site-soft">
        {tr("site.heroRibbon")} <Heart aria-hidden className="inline size-[0.7em] fill-current text-primary" />
      </p>
    </div>
  );
}

export function HomeHero() {
  const trust = [
    [Users, tr("site.trustNoAccount")],
    [Heart, tr("landing.individualFamilyInvitations")],
    [CircleCheck, tr("site.trustOnePlace")],
  ] as const;
  return (
    <section className="relative isolate overflow-hidden" aria-labelledby="hero-title">
      <FloralCorner className="-bottom-40 -left-40 -z-10 w-60 rotate-[8deg] opacity-50 md:-left-28 md:w-72" />
      <div className={cn(wrap, "grid items-center gap-6 pt-8 pb-8 lg:grid-cols-[minmax(0,0.92fr)_minmax(0,1.08fr)] lg:gap-2 lg:pt-14 lg:pb-14")}>
        <div className="relative z-10 max-w-xl">
          <p className="eyebrow mb-4">{tr("site.heroEyebrow")}</p>
          <h1 id="hero-title" className="display-title">
            <RichText k="site.heroTitle" components={{ em: <em className="block font-serif font-semibold italic" /> }} />
          </h1>
          <p className="mt-5 max-w-md text-base text-foreground/90 sm:text-[1.05rem]">{tr("site.heroLead")}</p>
          <div className="mt-7 flex flex-wrap items-center gap-3">
            <Button asChild size="lg">
              <Link to="/registro?empezar=evento">
                {tr("common.createFirstEvent")}
                <ArrowRight aria-hidden />
              </Link>
            </Button>
            <Button asChild variant="outline" size="lg" className="border-transparent bg-card/70">
              <Link to="/registro">
                <span aria-hidden className="grid size-7 place-items-center rounded-full bg-primary text-primary-foreground">
                  <Play className="size-3 translate-x-px fill-current" />
                </span>
                {tr("landing.exploreDemo")}
              </Link>
            </Button>
          </div>
          <ul className="mt-8 grid gap-3 sm:grid-cols-3 sm:gap-4">
            {trust.map(([Icon, text]) => (
              <li key={text} className="flex items-center gap-2.5 text-xs text-foreground/85 sm:items-start">
                <span className="grid size-8 shrink-0 place-items-center rounded-full bg-accent-soft text-primary ring-1 ring-peach/60">
                  <Icon aria-hidden className="size-4" />
                </span>
                <span className="max-w-[9rem] leading-snug">{text}</span>
              </li>
            ))}
          </ul>
        </div>
        <HeroComposition />
      </div>
    </section>
  );
}
