import { ArrowRight, Check, ChevronRight, ChartColumn, Pencil, Play, Quote, Send, CircleCheck, Heart, Users } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router-dom";
import { EventCategoryCard } from "@/components/events/EventCategoryCard";
import { InvitationCard } from "@/components/invitations/InvitationCard";
import { InvitationCarousel } from "@/components/invitations/InvitationCarousel";
import { PhoneInvitation } from "@/components/invitations/PhoneInvitation";
import { RSVPCard } from "@/components/invitations/RSVPCard";
import { NewsletterForm } from "@/components/forms/NewsletterForm";
import { DecorativeBackground } from "@/components/shared/DecorativeBackground";
import { FAQAccordion } from "@/components/shared/FAQAccordion";
import { Photo } from "@/components/shared/Photo";
import { SectionHeading } from "@/components/shared/SectionHeading";
import { Button } from "@/components/ui/button";
import { sampleGuests } from "@/features/demo/guests";
import { designById, designs } from "@/features/invitations/designs";
import { cn } from "@/lib/cn";
import { copy } from "@/lib/copy";
import type { PhotoKey } from "@/lib/photos";
import type { InvitationTag, RsvpStatus } from "@/types";

const wrap = "mx-auto w-full max-w-page px-4 sm:px-6 lg:px-8";
const panel = "rounded-2xl border border-white/70 bg-card/70 shadow-card backdrop-blur-sm";

/* 1 · Hero ------------------------------------------------------------------- */
export function Hero() {
  const trust = [Users, Heart, CircleCheck];
  return (
    <section className="relative isolate overflow-hidden" aria-labelledby="hero-title">
      <DecorativeBackground piece="corner-left" className="-z-10 top-auto -bottom-40 -left-40 w-60 opacity-50 md:-left-28 md:w-72" />
      <div className={cn(wrap, "grid items-center gap-6 pt-8 pb-8 lg:grid-cols-[minmax(0,0.92fr)_minmax(0,1.08fr)] lg:gap-2 lg:pt-14 lg:pb-14")}>
        <div className="relative z-10 max-w-xl">
          <p className="eyebrow mb-4">{copy.hero.eyebrow}</p>
          <h1 id="hero-title" className="display-title">
            {copy.hero.titleA}
            <em className="block font-serif font-semibold italic">{copy.hero.titleB}</em>
          </h1>
          <p className="mt-5 max-w-md text-base text-foreground/90 sm:text-[1.05rem]">{copy.hero.lead}</p>
          <div className="mt-7 flex flex-wrap items-center gap-3">
            <Button asChild size="lg">
              <Link to="/registro">
                {copy.hero.primary}
                <ArrowRight aria-hidden />
              </Link>
            </Button>
            <Button asChild variant="outline" size="lg" className="border-transparent bg-card/70">
              <Link to="/demo">
                <span aria-hidden className="grid size-7 place-items-center rounded-full bg-primary text-primary-foreground">
                  <Play className="size-3 translate-x-px fill-current" />
                </span>
                {copy.hero.demo}
              </Link>
            </Button>
          </div>
          <ul className="mt-8 grid gap-3 sm:grid-cols-3 sm:gap-4">
            {copy.hero.trust.map((t, i) => {
              const Icon = trust[i];
              return (
                <li key={t} className="flex items-center gap-2.5 text-xs text-foreground/85 sm:items-start">
                  <span className="grid size-8 shrink-0 place-items-center rounded-full bg-accent-soft text-primary ring-1 ring-accent/60">
                    <Icon aria-hidden className="size-4" />
                  </span>
                  <span className="max-w-[9rem] leading-snug">{t}</span>
                </li>
              );
            })}
          </ul>
        </div>
        <HeroComposition />
      </div>
    </section>
  );
}

function HeroComposition() {
  const [wedding, birthday, night, xv] = ["boda-floral", "cumpleanos-globos", "noche-bokeh", "xv-rosas"].map(designById);
  return (
    <div className="relative mx-auto aspect-[1.08/1] w-full max-w-[40rem] lg:max-w-none">
      <Photo name="events/hero-fondo" alt="" eager sizes="(min-width:1024px) 55vw, 100vw" className="absolute inset-0 -z-10 rounded-[3rem] opacity-30 [mask-image:radial-gradient(closest-side,#000_40%,transparent)]" />
      <div className="absolute top-[16%] left-[3%] w-[27%]">
        <InvitationCard design={birthday} tilt={-10} eager />
      </div>
      <div className="absolute top-[3%] left-[66%] w-[24%]">
        <InvitationCard design={night} tilt={7} eager />
      </div>
      <div className="absolute top-[20%] left-[76%] w-[24%]">
        <InvitationCard design={xv} tilt={13} eager />
      </div>
      <div className="absolute top-[-1%] left-[31%] z-20 w-[35%]">
        <PhoneInvitation design={wedding} title="Nuestra Boda" place="" eager label={copy.hero.phoneLabel} />
      </div>
      <p className="absolute right-[1%] bottom-[7%] z-30 w-[42%] rotate-[-7deg] rounded-md bg-[#fbe7da] px-[3%] py-[2.6%] text-center font-script text-[clamp(1.1rem,2.6vw,1.9rem)] leading-tight text-title shadow-soft">
        {copy.hero.ribbon} <Heart aria-hidden className="inline size-[0.7em] fill-current text-primary" />
      </p>
    </div>
  );
}

/* 2 · Categorías ------------------------------------------------------------- */
export function Categories() {
  return (
    <section aria-label={copy.categories.label} className={cn(wrap, "relative z-10")}>
      <ul className={cn(panel, "grid grid-cols-2 gap-x-2 gap-y-6 px-4 py-6 min-[480px]:grid-cols-3 lg:grid-cols-6 lg:px-6")}>
        {copy.categories.items.map((item) => (
          <EventCategoryCard key={item.id} item={item} />
        ))}
      </ul>
    </section>
  );
}

/* 3 · Diseños ---------------------------------------------------------------- */
const tagKeys = Object.keys(copy.designs.tags) as (InvitationTag | "todos")[];

export function DesignsGallery() {
  const [tag, setTag] = useState<InvitationTag | "todos">("todos");
  const shown = tag === "todos" ? designs : designs.filter((d) => d.tags.includes(tag));
  return (
    <section id="disenos" aria-labelledby="disenos-title" className={cn(wrap, "scroll-mt-24 pt-6 lg:pt-8")}>
      <div className={cn(panel, "grid gap-6 p-5 sm:p-7 lg:grid-cols-[minmax(0,17rem)_minmax(0,1fr)] lg:gap-8")}>
        <div className="flex flex-col items-start">
          <SectionHeading size="sm" id="disenos-title" eyebrow={copy.designs.eyebrow} title={copy.designs.title} text={copy.designs.text} />
          <Button asChild size="lg" className="mt-6">
            <Link to="/demo">
              {copy.designs.all}
              <ArrowRight aria-hidden />
            </Link>
          </Button>
        </div>
        <div className="min-w-0">
          <div role="group" aria-label={copy.designs.filters} className="-mx-1 mb-3 flex gap-1.5 overflow-x-auto px-1 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {tagKeys.map((k) => (
              <button
                key={k}
                type="button"
                aria-pressed={tag === k}
                onClick={() => setTag(k)}
                className={cn("min-h-9 shrink-0 cursor-pointer rounded-full px-3.5 text-xs font-semibold transition-colors outline-none focus-visible:ring-[3px] focus-visible:ring-ring/40", tag === k ? "bg-primary text-primary-foreground" : "text-foreground/85 hover:bg-accent-soft")}
              >
                {copy.designs.tags[k]}
              </button>
            ))}
          </div>
          {shown.length ? <InvitationCarousel designs={shown} /> : <p className="py-10 text-center text-sm text-muted-foreground">{copy.designs.empty}</p>}
        </div>
      </div>
    </section>
  );
}

/* 4 · Tres pasos ------------------------------------------------------------- */
export function Steps() {
  const icons = [Pencil, Send, ChartColumn];
  return (
    <section id="como-funciona" aria-labelledby="pasos-title" className={cn(wrap, "scroll-mt-24 pt-4")}>
      <div className={cn(panel, "grid gap-6 p-5 sm:p-7 md:grid-cols-3 lg:grid-cols-[minmax(0,17rem)_repeat(3,minmax(0,1fr))] lg:items-center lg:gap-6")}>
        <SectionHeading size="sm" id="pasos-title" eyebrow={copy.steps.eyebrow} title={copy.steps.title} className="md:col-span-3 lg:col-span-1" />
        {copy.steps.items.map((s, i) => {
          const Icon = icons[i];
          return (
            <div key={s.title} className="flex gap-3 lg:border-l lg:border-border lg:pl-5">
              <span className="mt-0.5 grid size-9 shrink-0 place-items-center rounded-full bg-accent-soft text-sm font-bold text-primary">{i + 1}</span>
              <div>
                <p className="flex items-center gap-2 font-sans text-[0.95rem] font-bold text-primary">
                  <Icon aria-hidden className="size-5" />
                  {s.title}
                </p>
                <p className="mt-1 text-[0.82rem] text-muted-foreground">{s.text}</p>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

/* 5 · Asistencia familiar ---------------------------------------------------- */
export function FamilyRsvp() {
  const [guests, setGuests] = useState(sampleGuests);
  const change = (id: string, status: RsvpStatus) => setGuests((g) => g.map((x) => (x.id === id ? { ...x, status } : x)));
  return (
    <section aria-labelledby="familia-title" className={cn(wrap, "pt-4")}>
      <div className="grid gap-4 lg:grid-cols-[minmax(0,0.78fr)_minmax(0,1.22fr)]">
        <div className="relative z-10">
          <RSVPCard guests={guests} onChange={change} />
          <p className="mt-2 px-1 text-xs text-muted-foreground">{copy.rsvp.simulation}</p>
        </div>
        <div className={cn(panel, "relative overflow-hidden")}>
          <div className="relative aspect-[16/10] md:aspect-[21/9] lg:absolute lg:inset-y-0 lg:right-0 lg:aspect-auto lg:w-[62%]">
            <Photo name="events/mesa-gracias" sizes="(min-width:1024px) 45vw, 100vw" className="lg:[mask-image:linear-gradient(to_right,transparent,#000_38%)]" />
            <p className="absolute top-1/2 left-1/2 w-[46%] max-w-[13rem] -translate-x-1/2 -translate-y-1/2 rotate-[-6deg] rounded-md bg-[#fbe7da]/95 px-4 py-4 text-center font-script text-[clamp(1.2rem,2.4vw,1.9rem)] leading-tight text-title shadow-soft lg:left-[58%]">
              {copy.family.card}
            </p>
          </div>
          <div className="relative z-10 p-6 sm:p-8 lg:max-w-[48%] lg:p-10">
            <SectionHeading size="sm" id="familia-title" eyebrow={copy.family.eyebrow} title={copy.family.title} text={copy.family.text} />
            <ul className="mt-5 space-y-2.5">
              {copy.family.bullets.map((b) => (
                <li key={b} className="flex items-center gap-2.5 text-sm text-foreground">
                  <CircleCheck aria-hidden className="size-[1.15rem] shrink-0 text-primary" />
                  {b}
                </li>
              ))}
            </ul>
            <Button asChild variant="link" className="mt-5 font-bold">
              <Link to="/demo">
                {copy.family.cta}
                <ArrowRight aria-hidden />
              </Link>
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}

/* 6 · Proveedores (resumen) -------------------------------------------------- */
const teaserTiles: { key: PhotoKey; label: string }[] = [
  { key: "providers/salones", label: copy.providersTeaser.tiles[0] },
  { key: "providers/catering", label: copy.providersTeaser.tiles[1] },
  { key: "providers/fotografia", label: copy.providersTeaser.tiles[2] },
  { key: "providers/decoracion", label: copy.providersTeaser.tiles[3] },
  { key: "providers/musica", label: copy.providersTeaser.tiles[4] },
  { key: "providers/experiencias", label: copy.providersTeaser.tiles[5] },
];

export function ProvidersTeaser() {
  return (
    <section aria-labelledby="prov-title" className={cn(wrap, "pt-4")}>
      <div className={cn(panel, "grid gap-6 p-5 sm:p-7 lg:grid-cols-[minmax(0,16rem)_minmax(0,1fr)_auto] lg:items-center lg:gap-6")}>
        <div className="flex flex-col items-start">
          <SectionHeading size="sm" id="prov-title" eyebrow={copy.providersTeaser.eyebrow} title={copy.providersTeaser.title} text={copy.providersTeaser.text} />
          <Button asChild size="lg" className="mt-5">
            <Link to="/proveedores">
              {copy.providersTeaser.cta}
              <ArrowRight aria-hidden />
            </Link>
          </Button>
        </div>
        <ul aria-label={copy.providersTeaser.list} className="grid grid-cols-3 gap-3 sm:grid-cols-6">
          {teaserTiles.map((t) => (
            <li key={t.key}>
              <Link to="/proveedores" className="group block rounded-lg outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50">
                <span className="block aspect-square overflow-hidden rounded-lg shadow-soft">
                  <Photo name={t.key} alt="" sizes="(min-width:1024px) 9vw, 30vw" className="transition-transform duration-500 group-hover:scale-105 motion-reduce:transition-none" />
                </span>
                <span className="mt-2 block text-center text-[0.82rem] font-bold text-title">{t.label}</span>
              </Link>
            </li>
          ))}
        </ul>
        <Link to="/proveedores" className="group flex items-center gap-3 self-center rounded-lg py-2 text-xs font-semibold text-primary outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 lg:flex-col lg:gap-2 lg:text-center">
          <span className="grid size-11 place-items-center rounded-full border border-input bg-card transition-colors group-hover:bg-accent-soft">
            <ChevronRight aria-hidden className="size-5" />
          </span>
          <span className="max-w-[5rem]">{copy.providersTeaser.more}</span>
        </Link>
      </div>
    </section>
  );
}

/* 7 · Promesa + preguntas frecuentes ---------------------------------------- */
export function PromiseAndFaq() {
  return (
    <section id="faq" aria-labelledby="faq-title" className={cn(wrap, "scroll-mt-24 pt-4")}>
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-[minmax(0,1fr)_minmax(0,0.8fr)_minmax(0,1.15fr)] lg:items-center lg:gap-8">
        <figure className={cn(panel, "p-6 sm:p-7")}>
          <Quote aria-hidden className="mb-3 size-8 fill-accent text-accent" />
          <blockquote className="font-serif text-lg leading-snug text-title italic">{copy.promise.quote}</blockquote>
          <figcaption className="mt-4 text-xs font-bold tracking-wide text-primary uppercase">{copy.promise.caption}</figcaption>
          <ul className="mt-3 space-y-1.5">
            {copy.promise.points.map((p) => (
              <li key={p} className="flex items-center gap-2 text-sm text-foreground">
                <Check aria-hidden className="size-4 shrink-0 text-primary" />
                {p}
              </li>
            ))}
          </ul>
        </figure>
        <SectionHeading size="sm" id="faq-title" eyebrow={copy.faq.eyebrow} title={copy.faq.title} text={copy.faq.text} />
        <div className="md:col-span-2 lg:col-span-1">
          <FAQAccordion />
        </div>
      </div>
    </section>
  );
}

/* 8 · CTA final y newsletter ------------------------------------------------- */
export function FinalCta() {
  return (
    <section aria-labelledby="cta-title" className={cn(wrap, "pt-10 pb-10")}>
      <div className="relative isolate overflow-hidden rounded-2xl bg-[#d6694f] bg-[url(/assets/backgrounds/cta-band.svg)] bg-cover bg-center px-6 py-9 text-white shadow-soft sm:px-10 lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:items-center lg:gap-10 lg:px-12">
        <img src="/assets/decorations/balloons.svg" alt="" aria-hidden width={220} height={320} loading="lazy" className="pointer-events-none absolute -right-2 -bottom-6 -z-10 hidden w-44 opacity-95 md:block lg:w-56" />
        <img src="/assets/decorations/leaf-branch.svg" alt="" aria-hidden width={260} height={420} loading="lazy" className="pointer-events-none absolute -bottom-10 left-1/3 -z-10 hidden w-40 rotate-[20deg] opacity-30 lg:block" />
        <div>
          <h2 id="cta-title" className="text-balance font-serif text-[clamp(1.6rem,1.2rem+1.6vw,2.4rem)] leading-tight font-semibold text-white">
            {copy.newsletter.title}
          </h2>
          <p className="mt-2 text-sm text-white/90">{copy.newsletter.text}</p>
        </div>
        <div className="mt-6 lg:mt-0 lg:pr-24">
          <NewsletterForm />
        </div>
      </div>
    </section>
  );
}
