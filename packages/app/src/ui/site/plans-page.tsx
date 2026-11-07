import { Link } from "react-router-dom";
import { Briefcase, Check, CircleDollarSign, Globe, MonitorSmartphone, ShieldCheck, Star, Users, type LucideIcon } from "lucide-react";
import { agencyPlans, localizedPath, personalPlans } from "@tuevento/contracts";
import { cn } from "cn";
import { tr, useLocale } from "../../i18n";
import { Button } from "../button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../tabs";
import { wrap } from "./home-shared";
import { planCurrency, planGuests, planInfo, planPrice, popularPlan, type PlanKey } from "./plan-catalog";

// Todos los colores salen de los tokens del tema (primary, muted, border…): al cambiar la paleta del
// sitio cambia también esta página. Ningún color va fijo.

const pageWidth = "mx-auto w-full max-w-[92rem] px-4 sm:px-6 lg:px-8";

/** Hojas del fondo: la forma sale del SVG y el color, del tema (una máscara, no una imagen). */
export const leaves =
  "pointer-events-none absolute -z-10 bg-primary/10 [mask:url(/site/decorations/leaf-branch.svg)_center/contain_no-repeat] [-webkit-mask:url(/site/decorations/leaf-branch.svg)_center/contain_no-repeat]";

type Card = { key: PlanKey; usd: number; guests?: string; suffix?: string };

/** Tarjeta de un plan: icono, nombre, precio, lo que incluye y su botón. */
function PlanCard({ plan }: { plan: Card }) {
  const { locale } = useLocale();
  const { icon: Icon, name, features } = planInfo[plan.key];
  const popular = plan.key === popularPlan;
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
        {popular && (
          <p className="absolute -top-3.5 left-1/2 inline-flex -translate-x-1/2 items-center gap-1.5 rounded-full bg-primary px-3 py-1 text-[0.72rem] font-bold whitespace-nowrap text-primary-foreground">
            <Star aria-hidden className="size-3.5 fill-current" />
            {tr("pricing.mostPopular")}
          </p>
        )}
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
        <p className="mt-2 text-[0.85rem] text-foreground/85">{plan.guests ?? plan.suffix}</p>
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
  const agency = agencyPlans.map((plan): Card => ({ key: plan.key, usd: plan.usd, suffix: tr("pricing.perMonth") }));
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
            <ul className="mx-auto grid max-w-4xl gap-x-3 gap-y-6 sm:grid-cols-3">
              {agency.map((plan) => (
                <PlanCard key={plan.key} plan={plan} />
              ))}
            </ul>
          </TabsContent>
        </Tabs>
        <Benefits />
      </div>
    </div>
  );
}
