import { Link } from "react-router-dom";
import { Briefcase, Check, CircleDollarSign, Globe, Info, MonitorSmartphone, ShieldCheck, Star, Tag, Users, type LucideIcon } from "lucide-react";
import { agencyPlans, localizedPath, personalPlans, type AgencyPlan } from "@tuevento/contracts";
import { cn } from "cn";
import { tr, useLocale } from "../../i18n";
import { Button } from "../button";
import { Popover, PopoverContent, PopoverTrigger } from "../popover";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../tabs";
import { wrap } from "./home-shared";
import { planCurrency, planGuests, planInfo, planPrice, popularPlans, type PlanKey } from "./plan-catalog";

// Todos los colores salen de los tokens del tema (primary, muted, border…): al cambiar la paleta del
// sitio cambia también esta página. Ningún color va fijo.

const pageWidth = "mx-auto w-full max-w-[92rem] px-4 sm:px-6 lg:px-8";

/** Hojas del fondo: la forma sale del SVG y el color, del tema (una máscara, no una imagen). */
export const leaves =
  "pointer-events-none absolute -z-10 bg-primary/10 [mask:url(/site/decorations/leaf-branch.svg)_center/contain_no-repeat] [-webkit-mask:url(/site/decorations/leaf-branch.svg)_center/contain_no-repeat]";

type Card = { key: PlanKey; usd: number; guests: string };

function PopularBadge() {
  return (
    <p className="absolute -top-3.5 left-1/2 inline-flex -translate-x-1/2 items-center gap-1.5 rounded-full bg-primary px-3 py-1 text-[0.72rem] font-bold whitespace-nowrap text-primary-foreground">
      <Star aria-hidden className="size-3.5 fill-current" />
      {tr("pricing.mostPopular")}
    </p>
  );
}

/** Tarjeta de un plan de personas: icono, nombre, precio, invitados, lo que incluye y su botón. */
function PlanCard({ plan }: { plan: Card }) {
  const { locale } = useLocale();
  const { icon: Icon, name, features } = planInfo[plan.key];
  const popular = popularPlans.includes(plan.key);
  const free = plan.usd === 0;
  const to = free ? "/registro" : `${localizedPath("checkout", locale)}?plan=${plan.key}`;
  return (
    <li className="flex">
      <article
        aria-labelledby={`plan-${plan.key}`}
        className={cn(
          "relative flex w-full flex-col rounded-2xl border bg-card/90 p-5 text-center shadow-site-soft",
          popular ? "border-2 border-primary bg-accent-soft/40" : "border-border/70",
        )}
      >
        {popular && <PopularBadge />}
        <span
          aria-hidden
          className={cn(
            "mx-auto grid size-14 place-items-center rounded-full",
            plan.key === "grandEvent" ? "bg-celebrate/30 text-primary" : "bg-accent-soft text-primary",
          )}
        >
          <Icon className="size-7" strokeWidth={1.6} />
        </span>
        <h2 id={`plan-${plan.key}`} className="mt-3 font-sans text-[1.2rem] leading-tight font-bold text-title">
          {name()}
        </h2>
        <p className="mt-2 font-bold text-title">
          <span className="text-[1.75rem] leading-none tabular-nums">{planPrice(plan.usd)}</span>{" "}
          <span className="text-[0.85rem] font-medium">{planCurrency}</span>
        </p>
        <p className="mt-2 text-[0.85rem] text-foreground/85">{plan.guests}</p>
        <ul className="mt-4 grid flex-1 content-start gap-2.5 border-t border-border/70 pt-4 text-left">
          {features().map((feature) => (
            <li key={feature} className="flex items-start gap-2 text-[0.8rem] leading-snug text-foreground/90">
              <Check aria-hidden className="mt-0.5 size-4 shrink-0 text-primary" strokeWidth={2.6} />
              {feature}
            </li>
          ))}
        </ul>
        <Button asChild variant={popular ? "default" : "outline"} className={cn("mt-5 w-full", !popular && "text-primary")}>
          <Link to={to} aria-label={free ? undefined : tr("pricing.choosePlanLabel", { plan: name() })}>
            {free ? tr("pricing.startFree") : tr("pricing.choosePlan")}
          </Link>
        </Button>
      </article>
    </li>
  );
}

/** Tarjeta de un plan profesional: cabecera con descripción, precio mensual, eventos activos y lo que incluye. */
function AgencyPlanCard({ plan }: { plan: AgencyPlan }) {
  const { locale } = useLocale();
  const { icon: Icon, name, description, features } = planInfo[plan.key];
  const popular = popularPlans.includes(plan.key);
  return (
    <li className="flex">
      <article
        aria-labelledby={`plan-${plan.key}`}
        className={cn(
          "relative flex w-full flex-col rounded-2xl border bg-card/90 p-6 shadow-site-soft",
          popular ? "border-2 border-primary" : "border-border/70",
        )}
      >
        {popular && <PopularBadge />}
        <div className="flex items-start gap-4">
          <span aria-hidden className="grid size-16 shrink-0 place-items-center rounded-lg bg-accent-soft text-primary">
            <Icon className="size-8" strokeWidth={1.6} />
          </span>
          <div className="min-w-0">
            <h2 id={`plan-${plan.key}`} className="font-sans text-[1.5rem] leading-tight font-bold text-title">
              {name()}
            </h2>
            <p className="mt-1 text-[0.85rem] leading-snug text-foreground/85">{description?.()}</p>
          </div>
        </div>
        <p className="mt-4 font-bold text-title">
          <span className="text-[2.1rem] leading-none tabular-nums">{planPrice(plan.usd)}</span>{" "}
          <span className="text-[0.95rem] font-medium">{tr("pricing.currencyPerMonth", { currency: planCurrency })}</span>
        </p>
        <p className="mt-4 flex items-center gap-2.5 rounded-full bg-accent-soft/60 py-1 pr-1 pl-4 text-[0.85rem] font-semibold text-title">
          <Tag aria-hidden className="size-4 shrink-0 text-primary" />
          <span className="min-w-0 flex-1">{tr("pricing.activeEvents", { events: plan.activeEvents })}</span>
          <Popover>
            <PopoverTrigger aria-label={tr("pricing.activeEventsInfo")} className="grid size-8 shrink-0 cursor-pointer place-items-center rounded-full text-primary outline-none focus-visible:ring-[3px] focus-visible:ring-ring/30">
              <Info aria-hidden className="size-4" />
            </PopoverTrigger>
            <PopoverContent className="w-60 text-[0.82rem]">{tr("pricing.activeEventsHelp")}</PopoverContent>
          </Popover>
        </p>
        <ul className="mt-4 grid flex-1 content-start gap-2.5">
          {features().map((feature) => (
            <li key={feature} className="flex items-start gap-2.5 text-[0.88rem] leading-snug text-foreground/90">
              <Check aria-hidden className="mt-0.5 size-4 shrink-0 text-primary" strokeWidth={2.6} />
              {feature}
            </li>
          ))}
        </ul>
        <Button asChild size="lg" variant={popular ? "default" : "outline"} className={cn("mt-6 w-full", !popular && "text-primary")}>
          <Link to={`${localizedPath("checkout", locale)}?plan=${plan.key}`}>{tr("pricing.choosePlanName", { plan: name() })}</Link>
        </Button>
      </article>
    </li>
  );
}

/** Franja inferior: lo que vale para cualquier plan. */
function Benefits() {
  const items: { icon: LucideIcon; title: string; text: string }[] = [
    { icon: Globe, title: tr("pricing.benefitWorld"), text: tr("pricing.benefitWorldText") },
    { icon: ShieldCheck, title: tr("pricing.benefitStripe"), text: tr("pricing.benefitStripeText") },
    { icon: CircleDollarSign, title: tr("pricing.benefitCurrency"), text: tr("pricing.benefitCurrencyText") },
    { icon: MonitorSmartphone, title: tr("pricing.benefitDevices"), text: tr("pricing.benefitDevicesText") },
  ];
  return (
    <ul className="mt-10 grid gap-5 rounded-2xl border border-border/60 bg-card/60 p-5 shadow-site-soft sm:grid-cols-2 lg:p-6 xl:grid-cols-4 xl:gap-0">
      {items.map(({ icon: Icon, title, text }) => (
        <li key={title} className="flex items-center gap-4 xl:px-6 xl:[&:not(:first-child)]:border-l xl:[&:not(:first-child)]:border-border">
          <Icon aria-hidden className="size-9 shrink-0 text-primary" strokeWidth={1.5} />
          <div>
            <p className="text-[0.85rem] font-bold text-title">{title}</p>
            <p className="text-[0.78rem] text-muted-foreground">{text}</p>
          </div>
        </li>
      ))}
    </ul>
  );
}

const triggerClass =
  "h-auto min-w-0 flex-1 gap-3 rounded-full px-3 py-3 whitespace-normal text-foreground data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-none sm:px-6 [&_svg:not([class*='size-'])]:size-7";

function PlanTab({ icon: Icon, title, hint }: { icon: LucideIcon; title: string; hint: string }) {
  return (
    <>
      <Icon aria-hidden strokeWidth={1.6} className="hidden sm:block" />
      <span className="grid text-center sm:text-left">
        <span className="text-[0.95rem] font-bold">{title}</span>
        <span className="hidden text-[0.78rem] font-normal opacity-85 sm:block">{hint}</span>
      </span>
    </>
  );
}

/** Página pública de planes: título, dos pestañas con las tarjetas de planes y la franja común. */
export function PlansPage() {
  const personal = personalPlans.map((plan): Card => ({ key: plan.key, usd: plan.usd, guests: planGuests(plan) }));
  return (
    <div className="relative isolate overflow-hidden pb-12">
      <span aria-hidden className={cn(leaves, "-top-10 -left-24 h-96 w-56 -rotate-12")} />
      <span aria-hidden className={cn(leaves, "-top-16 -right-10 hidden h-96 w-56 rotate-[200deg] lg:block")} />
      <div className={cn(wrap, "pt-8 lg:pt-10")}>
        <p className="eyebrow">{tr("pricing.title")}</p>
        <h1 className="display-title mt-2 text-title">{tr("pricing.headline")}</h1>
        <p className="mt-3 max-w-3xl text-[1.05rem] text-foreground/85">{tr("pricing.subtitle")}</p>
      </div>
      <div className={pageWidth}>
        <Tabs defaultValue="personal" className="mt-8 gap-9">
          <TabsList aria-label={tr("pricing.plansLabel")} className="mx-auto w-full max-w-3xl rounded-full group-data-[orientation=horizontal]/tabs:h-auto border border-border bg-card/80 p-1.5 shadow-site-soft">
            <TabsTrigger value="personal" className={triggerClass}>
              <PlanTab icon={Users} title={tr("pricing.personalTitle")} hint={tr("pricing.personalTabHint")} />
            </TabsTrigger>
            <TabsTrigger value="professional" className={triggerClass}>
              <PlanTab icon={Briefcase} title={tr("pricing.agencyTitle")} hint={tr("pricing.agencyTabHint")} />
            </TabsTrigger>
          </TabsList>
          <TabsContent value="personal">
            <ul className="grid gap-x-3 gap-y-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
              {personal.map((plan) => (
                <PlanCard key={plan.key} plan={plan} />
              ))}
            </ul>
          </TabsContent>
          <TabsContent value="professional">
            <ul className="mx-auto grid max-w-md gap-x-6 gap-y-8 lg:max-w-6xl lg:grid-cols-3">
              {agencyPlans.map((plan) => (
                <AgencyPlanCard key={plan.key} plan={plan} />
              ))}
            </ul>
          </TabsContent>
        </Tabs>
        <Benefits />
      </div>
    </div>
  );
}
