import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import {
  ArrowRight,
  Briefcase,
  CalendarDays,
  CircleDollarSign,
  Crown,
  Gem,
  Globe,
  MonitorSmartphone,
  Sparkles,
  Sprout,
  ShieldCheck,
  Star,
  Users,
  type LucideIcon,
} from "lucide-react";
import { agencyPlans, personalPlans, type PersonalPlan } from "@tuevento/contracts";
import { cn } from "cn";
import { tr } from "../../i18n";
import { Button } from "../button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../tabs";
import { wrap } from "./home-shared";

// Todos los colores salen de los tokens del tema (primary, muted, border…): al cambiar la paleta del
// sitio cambia también esta página. Ningún color va fijo.

/** Precio en dólares: «$0» el plan gratis y «$14.99» el resto (igual en todos los idiomas). */
const planPrice = (usd: number) => (usd === 0 ? "$0" : `$${usd.toFixed(2)}`);

/** Nombre, descripción e icono de cada plan, en el idioma de quien lee (cada clave, escrita entera). */
const planInfo = {
  free: { icon: Sprout, name: () => tr("pricing.planFree"), text: () => tr("pricing.descFree") },
  essential: { icon: Star, name: () => tr("pricing.planEssential"), text: () => tr("pricing.descEssential") },
  plus: { icon: Users, name: () => tr("pricing.planPlus"), text: () => tr("pricing.descPlus") },
  premium: { icon: Crown, name: () => tr("pricing.planPremium"), text: () => tr("pricing.descPremium") },
  celebration: { icon: Sparkles, name: () => tr("pricing.planCelebration"), text: () => tr("pricing.descCelebration") },
  grandEvent: { icon: Gem, name: () => tr("pricing.planGrandEvent"), text: () => tr("pricing.descGrandEvent") },
  starter: { icon: Sprout, name: () => tr("pricing.planStarter"), text: () => tr("pricing.descStarter") },
  business: { icon: Star, name: () => tr("pricing.planBusiness"), text: () => tr("pricing.descBusiness") },
  agency: { icon: Crown, name: () => tr("pricing.planAgency"), text: () => tr("pricing.descAgency") },
} satisfies Record<string, { icon: LucideIcon; name: () => string; text: () => string }>;

/** Invitados que cubre un plan: «Hasta 20», «21–60» o «501 o más». */
function guestsText(plan: PersonalPlan) {
  if (plan.minGuests === 0) return tr("pricing.guestsUpTo", { max: plan.maxGuests });
  if (plan.maxGuests === null) return tr("pricing.guestsFrom", { min: plan.minGuests });
  return tr("pricing.guestsRange", { min: plan.minGuests, max: plan.maxGuests });
}

type Row = {
  key: keyof typeof planInfo;
  guests?: string;
  price: string;
  suffix?: string;
  highlight?: boolean;
};

const head = "px-4 pb-1 text-[0.68rem] font-bold tracking-[0.16em] text-muted-foreground uppercase";
const cell = "border-y border-border bg-card px-4 py-3 align-middle first:rounded-l-xl first:border-l last:rounded-r-xl last:border-r";

/** Tabla de planes: una fila-tarjeta por plan, con su icono, su descripción y su precio. */
function PlanTable({ rows, withGuests }: { rows: Row[]; withGuests: boolean }) {
  return (
    <table className="mt-5 w-full border-separate border-spacing-y-2 text-left">
      <thead>
        <tr>
          <th scope="col" className={head}>
            {tr("pricing.colPlan")}
          </th>
          {withGuests && (
            <th scope="col" className={head}>
              {tr("pricing.colGuests")}
            </th>
          )}
          <th scope="col" className={cn(head, "text-right")}>
            {tr("pricing.colPrice")}
          </th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => {
          const info = planInfo[row.key];
          const Icon = info.icon;
          return (
            <tr key={row.key}>
              <th scope="row" className={cn(cell, "font-normal", row.highlight && "bg-muted")}>
                <span className="flex items-center gap-3.5">
                  <span aria-hidden className="hidden size-11 shrink-0 place-items-center rounded-full bg-accent-soft text-primary sm:grid">
                    <Icon className="size-5" />
                  </span>
                  <span className="grid">
                    <span className="text-[0.95rem] font-bold text-title">{info.name()}</span>
                    <span className="text-[0.8rem] text-muted-foreground">{info.text()}</span>
                  </span>
                </span>
              </th>
              {withGuests && <td className={cn(cell, "text-[0.9rem] whitespace-nowrap", row.highlight && "bg-muted")}>{row.guests}</td>}
              <td className={cn(cell, "text-right whitespace-nowrap", row.highlight && "bg-muted")}>
                <span className="text-xl font-bold text-title tabular-nums sm:text-[1.35rem]">{row.price}</span>
                {row.suffix && <small className="block text-[0.7rem] font-medium text-muted-foreground">{row.suffix}</small>}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

/** Tarjeta de un tipo de plan: icono, título, subtítulo, etiqueta del cobro y tabla. */
function PlanCard({ icon: Icon, title, subtitle, badge, children }: { icon: LucideIcon; title: string; subtitle: string; badge: string; children: ReactNode }) {
  return (
    <div className="rounded-2xl border border-white/70 bg-card/80 p-5 shadow-site-card backdrop-blur-sm sm:p-7">
      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-3">
        <div className="flex items-start gap-4">
          <Icon aria-hidden className="mt-1 size-9 shrink-0 text-primary" strokeWidth={1.5} />
          <div>
            <h2 className="text-[clamp(1.4rem,1.1rem+1vw,1.85rem)] leading-tight font-semibold">{title}</h2>
            <p className="mt-1 text-[0.95rem] text-muted-foreground">{subtitle}</p>
          </div>
        </div>
        <span className="rounded-full bg-muted px-3.5 py-1.5 text-[0.78rem] font-medium text-foreground/80">{badge}</span>
      </div>
      {children}
    </div>
  );
}

/** Filas del plan de personas. Se arman al dibujar: los textos dependen del idioma en uso. */
const personalRows = (): Row[] =>
  personalPlans.map((plan) => ({ key: plan.key, guests: guestsText(plan), price: planPrice(plan.usd), highlight: plan.usd === 0 }));

/** Lo bueno de comprar, a la izquierda del título. */
function Highlights() {
  const items: { icon: LucideIcon; title: string; text: string }[] = [
    { icon: CalendarDays, title: tr("pricing.featureQuick"), text: tr("pricing.featureQuickText") },
    { icon: Users, title: tr("pricing.featureSimple"), text: tr("pricing.featureSimpleText") },
    { icon: ShieldCheck, title: tr("pricing.featureSecure"), text: tr("pricing.featureSecureText") },
  ];
  return (
    <ul className="mt-9 grid gap-5 sm:grid-cols-3">
      {items.map(({ icon: Icon, title, text }) => (
        <li key={title} className="grid content-start gap-2.5">
          <span aria-hidden className="grid size-11 place-items-center rounded-full bg-accent-soft text-primary">
            <Icon className="size-5" />
          </span>
          <h3 className="font-sans text-[0.9rem] font-bold text-title">{title}</h3>
          <p className="text-[0.78rem] leading-snug text-muted-foreground">{text}</p>
        </li>
      ))}
    </ul>
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
    <div className="mt-14 border-t border-border/70 bg-muted/60">
      <ul className={cn(wrap, "grid gap-6 py-7 sm:grid-cols-2 lg:grid-cols-4 lg:gap-0")}>
        {items.map(({ icon: Icon, title, text }) => (
          <li key={title} className="flex items-center gap-4 lg:px-6 lg:first:pl-0 lg:[&:not(:first-child)]:border-l lg:[&:not(:first-child)]:border-border">
            <Icon aria-hidden className="size-9 shrink-0 text-primary" strokeWidth={1.5} />
            <div>
              <h3 className="font-sans text-[0.85rem] font-bold text-title">{title}</h3>
              <p className="text-[0.78rem] text-muted-foreground">{text}</p>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

// Hojas del fondo: la forma sale del SVG y el color, del tema (una máscara, no una imagen)
const leaves =
  "pointer-events-none absolute -z-10 bg-primary/10 [mask:url(/site/decorations/leaf-branch.svg)_center/contain_no-repeat] [-webkit-mask:url(/site/decorations/leaf-branch.svg)_center/contain_no-repeat]";

/** Página pública de planes: presentación a la izquierda y los planes, en dos pestañas, a la derecha. */
export function PlansPage() {
  const triggerClass =
    "h-auto flex-none gap-2.5 rounded-full px-5 py-3 text-[0.9rem] font-semibold text-foreground data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-none";
  return (
    <div className="relative isolate overflow-hidden">
      <span aria-hidden className={cn(leaves, "-bottom-10 -left-10 h-96 w-56 -rotate-12")} />
      <span aria-hidden className={cn(leaves, "-right-12 bottom-24 hidden h-96 w-56 rotate-[18deg] lg:block")} />
      <div className={cn(wrap, "grid gap-10 pt-10 lg:grid-cols-[minmax(0,25rem)_minmax(0,1fr)] lg:gap-14 lg:pt-14 xl:grid-cols-[minmax(0,28rem)_minmax(0,1fr)]")}>
        <section aria-labelledby="planes-title" className="lg:pt-24">
          <p className="eyebrow">{tr("pricing.title")}</p>
          <h1 id="planes-title" className="display-title mt-3 text-title">
            {tr("pricing.title")}
          </h1>
          <p className="mt-6 max-w-md text-[1.05rem] leading-relaxed text-foreground/85">{tr("pricing.publicIntro")}</p>
          <Highlights />
          <Button asChild size="lg" className="mt-10 rounded-full px-8">
            <Link to="/registro">
              {tr("pricing.buyNow")}
              <ArrowRight aria-hidden />
            </Link>
          </Button>
        </section>
        <Tabs defaultValue="personal" className="min-w-0 gap-4">
          <TabsList aria-label={tr("pricing.plansLabel")} className="h-auto w-fit max-w-full self-end rounded-full border border-border bg-card/80 p-1.5 shadow-site-soft">
            <TabsTrigger value="personal" className={triggerClass}>
              <Users aria-hidden />
              {tr("pricing.personalTitle")}
            </TabsTrigger>
            <TabsTrigger value="professional" className={triggerClass}>
              <Briefcase aria-hidden />
              {tr("pricing.agencyTitle")}
            </TabsTrigger>
          </TabsList>
          <TabsContent value="personal">
            <PlanCard icon={Users} title={tr("pricing.personalTitle")} subtitle={tr("pricing.personalIntro")} badge={tr("pricing.personalBadge")}>
              <PlanTable rows={personalRows()} withGuests />
            </PlanCard>
          </TabsContent>
          <TabsContent value="professional">
            <PlanCard icon={Briefcase} title={tr("pricing.agencyTitle")} subtitle={tr("pricing.agencyIntro")} badge={tr("pricing.agencyBadge")}>
              <PlanTable
                withGuests={false}
                rows={agencyPlans.map((plan) => ({ key: plan.key, price: planPrice(plan.usd), suffix: tr("pricing.perMonth") }))}
              />
            </PlanCard>
          </TabsContent>
        </Tabs>
      </div>
      <Benefits />
    </div>
  );
}
