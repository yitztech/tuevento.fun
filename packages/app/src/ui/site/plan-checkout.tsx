import { useId, useMemo, useState, type ReactNode } from "react";
import { Link, Navigate, useSearchParams } from "react-router-dom";
import { ArrowLeft, Check, CreditCard, Info, Lock } from "lucide-react";
import { accountLimits, localizedPath } from "@tuevento/contracts";
import { cn } from "cn";
import { LanguageSwitcher, RichText, tr, useLocale } from "../../i18n";
import { countryOptions, defaultCountryByLocale, flagOf } from "../../phone-field";
import { Button } from "../button";
import { Input } from "../input";
import { Label } from "../label";
import { NativeSelect } from "../native-select";
import { checkoutPlanFor, planCurrency, planGuests, planInfo, planPrice, type CheckoutPlan } from "./plan-catalog";
import { leaves } from "./plans-page";
import { SiteLogo } from "./site-layout";

// Nombres de marca: no se traducen
const cardBrands = ["Visa", "Mastercard", "Amex", "Discover"];
const paymentBrands = ["Visa", "Mastercard", "Amex", "Apple Pay", "Google Pay"];
const paypal = "PayPal";

const chip = "rounded-md border border-border bg-card px-2 py-1 text-[0.68rem] font-bold text-foreground/80";

/** Resumen del plan elegido: lo que se compra, lo que incluye y cómo se cobra. */
function PlanSummary({ choice }: { choice: CheckoutPlan }) {
  const { icon: Icon, name, features } = planInfo[choice.plan.key];
  const personal = choice.kind === "personal";
  return (
    <>
      <section aria-label={tr("pricing.checkoutSummary")} className="mt-7 rounded-2xl border border-border/70 bg-card/80 p-4 shadow-site-soft">
        <div className="flex items-center gap-4 rounded-xl bg-accent-soft/60 p-4">
          <span aria-hidden className="grid size-14 shrink-0 place-items-center rounded-full bg-card/70 text-primary">
            <Icon className="size-7" strokeWidth={1.6} />
          </span>
          <div className="min-w-0 flex-1">
            <h2 className="font-sans text-[1.3rem] leading-tight font-bold text-title">{name()}</h2>
            {personal && <p className="text-[0.9rem] text-foreground/85">{planGuests(choice.plan)}</p>}
          </div>
          <p className="text-right font-bold text-title">
            <span className="block text-[1.6rem] leading-none tabular-nums">{planPrice(choice.plan.usd)}</span>
            <span className="mt-1 block text-[0.75rem] font-medium">{personal ? tr("pricing.checkoutOneTime") : tr("pricing.checkoutMonthly")}</span>
          </p>
        </div>
        <ul className="mt-4 grid gap-2.5 px-2 pb-1">
          {features().map((feature) => (
            <li key={feature} className="flex items-start gap-3 text-[0.9rem] text-foreground/90">
              <Check aria-hidden className="mt-0.5 size-5 shrink-0 text-primary" strokeWidth={2.6} />
              {feature}
            </li>
          ))}
        </ul>
      </section>
      <p className="mt-4 flex items-start gap-3 rounded-xl border border-border/70 bg-card/60 p-4 text-[0.88rem] text-foreground/90">
        <Info aria-hidden className="mt-0.5 size-5 shrink-0 text-primary" />
        <span>
          <RichText k={personal ? "pricing.checkoutOneTimeNote" : "pricing.checkoutMonthlyNote"} components={{ strong: <strong /> }} />
        </span>
      </p>
    </>
  );
}

function MethodOption({ checked, onChange, children }: { checked: boolean; onChange: () => void; children: ReactNode }) {
  return (
    <label
      className={cn(
        "flex min-h-12 cursor-pointer items-center gap-3 rounded-lg border bg-card px-3 py-2 text-[0.85rem] font-medium has-[:focus-visible]:ring-[3px] has-[:focus-visible]:ring-ring/30",
        checked ? "border-2 border-primary" : "border-input",
      )}
    >
      <input type="radio" name="payment-method" checked={checked} onChange={onChange} className="size-4 accent-primary" />
      {children}
    </label>
  );
}

/**
 * Datos de la tarjeta. Es solo la forma de la pantalla: un número de tarjeta nunca pasa por campos
 * propios (PCI DSS). Al integrar Stripe, este bloque se sustituye por su Payment Element, que los
 * recoge en su propio iframe; hasta entonces van desactivados y sin `name`.
 */
function CardFields() {
  const number = useId();
  const holder = useId();
  return (
    <fieldset disabled className="grid gap-2 disabled:opacity-75">
      <legend className="mb-1.5 text-xs font-[650]">{tr("pricing.checkoutCardDetails")}</legend>
      <div className="relative">
        <Input id={number} aria-label={tr("pricing.checkoutCardNumber")} placeholder="1234 5678 9012 3456" autoComplete="off" />
        <span aria-hidden className="absolute top-1/2 right-2 hidden -translate-y-1/2 gap-1 sm:flex">
          {cardBrands.map((brand) => (
            <span key={brand} className={chip}>
              {brand}
            </span>
          ))}
        </span>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <Input aria-label={tr("pricing.checkoutExpiry")} placeholder={tr("pricing.checkoutExpiryHint")} autoComplete="off" />
        <Input aria-label={tr("pricing.checkoutCvc")} placeholder={tr("pricing.checkoutCvc")} autoComplete="off" />
      </div>
      <Label htmlFor={holder} className="mt-2">
        {tr("pricing.checkoutCardName")}
      </Label>
      <Input id={holder} placeholder={tr("pricing.checkoutCardNameHint")} autoComplete="off" />
    </fieldset>
  );
}

/** Formulario de pago. El cobro aún no está conectado: el botón no se activa hasta integrar Stripe. */
function PaymentForm({ choice }: { choice: CheckoutPlan }) {
  const { locale } = useLocale();
  const email = useId();
  const country = useId();
  const [method, setMethod] = useState<"card" | "paypal">("card");
  const [billing, setBilling] = useState(defaultCountryByLocale[locale]);
  const countries = useMemo(countryOptions, [locale]);
  const { name } = planInfo[choice.plan.key];
  const price = planPrice(choice.plan.usd);
  const amount = tr("pricing.checkoutAmount", { price, currency: planCurrency });
  return (
    <form onSubmit={(event) => event.preventDefault()} className="rounded-2xl border border-border/60 bg-card p-5 shadow-site-card sm:p-8">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/70 pb-4">
        <p className="flex items-center gap-2.5 text-[0.9rem] font-bold text-title">
          <Lock aria-hidden className="size-5 text-primary" />
          {tr("pricing.checkoutSecure")}
        </p>
        <p className="text-[0.78rem] text-muted-foreground">{tr("pricing.checkoutSecuredBy")}</p>
      </div>
      <h2 className="mt-5 font-sans text-[1.3rem] font-bold text-title">{tr("pricing.checkoutPaymentInfo")}</h2>
      <div className="mt-4 grid gap-4">
        <div className="grid gap-1.5">
          <Label htmlFor={email}>{tr("common.email")}</Label>
          <Input id={email} type="email" autoComplete="email" maxLength={accountLimits.email} placeholder={tr("pricing.checkoutEmailHint")} />
        </div>
        <fieldset>
          <legend className="mb-1.5 text-xs font-[650]">{tr("pricing.checkoutMethod")}</legend>
          <div className="grid gap-2 sm:grid-cols-2">
            <MethodOption checked={method === "card"} onChange={() => setMethod("card")}>
              <CreditCard aria-hidden className="size-5 shrink-0 text-primary" />
              {tr("pricing.checkoutCard")}
            </MethodOption>
            <MethodOption checked={method === "paypal"} onChange={() => setMethod("paypal")}>
              {paypal}
            </MethodOption>
          </div>
        </fieldset>
        {method === "card" && <CardFields />}
        <div className="grid gap-1.5">
          <Label htmlFor={country}>{tr("pricing.checkoutBilling")}</Label>
          <NativeSelect id={country} autoComplete="country" value={billing} onChange={(event) => setBilling(event.target.value)}>
            {countries.map(({ iso, name: countryName }) => (
              <option key={iso} value={iso}>
                {`${flagOf(iso)} ${countryName}`}
              </option>
            ))}
          </NativeSelect>
        </div>
      </div>
      <dl className="mt-5 grid gap-2 rounded-xl border border-border/70 p-3 text-[0.88rem]">
        <div className="flex justify-between gap-4 px-1">
          <dt>
            {choice.kind === "personal" ? (
              <RichText k="pricing.checkoutPlanLine" values={{ plan: name(), guests: planGuests(choice.plan) }} components={{ strong: <strong /> }} />
            ) : (
              <RichText k="pricing.checkoutPlanLineMonthly" values={{ plan: name() }} components={{ strong: <strong /> }} />
            )}
          </dt>
          <dd className="whitespace-nowrap tabular-nums">{amount}</dd>
        </div>
        <div className="flex justify-between gap-4 px-1">
          <dt>{tr("pricing.checkoutTaxes")}</dt>
          <dd className="whitespace-nowrap tabular-nums">{tr("pricing.checkoutAmount", { price: "$0.00", currency: planCurrency })}</dd>
        </div>
        <div className="flex items-center justify-between gap-4 rounded-lg bg-accent-soft/60 px-3 py-2.5 font-bold text-title">
          <dt className="text-[1rem]">{tr("pricing.checkoutTotal")}</dt>
          <dd className="text-[1.15rem] whitespace-nowrap tabular-nums">{amount}</dd>
        </div>
      </dl>
      <p role="status" className="mt-4 flex items-start gap-2.5 rounded-lg bg-muted p-3 text-[0.82rem] text-foreground/90">
        <Info aria-hidden className="mt-0.5 size-4 shrink-0 text-primary" />
        {tr("pricing.paymentPending")}
      </p>
      <Button type="submit" size="lg" disabled className="mt-4 w-full rounded-full">
        <Lock aria-hidden className="size-4" />
        {tr("pricing.checkoutPay", { amount })}
      </Button>
      <p className="mt-3 text-center text-[0.75rem] text-muted-foreground">
        <RichText
          k="pricing.checkoutLegal"
          components={{
            terms: <Link to={localizedPath("terms", locale)} className="text-primary underline underline-offset-2" />,
            privacy: <Link to={localizedPath("privacy", locale)} className="text-primary underline underline-offset-2" />,
          }}
        />
      </p>
    </form>
  );
}

/** Página de pago de un plan (`/planes/pago?plan=…`). Sin un plan de pago válido, vuelve a los planes. */
export function PlanCheckout() {
  const { locale } = useLocale();
  const [params] = useSearchParams();
  const choice = checkoutPlanFor(params.get("plan"));
  const plans = localizedPath("pricing", locale);
  if (!choice) return <Navigate to={plans} replace />;
  return (
    <div className="site-surface page-wash relative isolate min-h-dvh overflow-hidden pt-[env(safe-area-inset-top)]">
      <span aria-hidden className={cn(leaves, "-top-10 -left-16 h-96 w-56 -rotate-12")} />
      <span aria-hidden className={cn(leaves, "-bottom-10 -left-10 hidden h-96 w-56 rotate-12 lg:block")} />
      <main id="contenido" className="mx-auto grid w-full max-w-site gap-8 px-4 py-6 sm:px-6 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1fr)] lg:gap-14 lg:px-8 lg:py-8">
        <div>
          <div className="flex items-center justify-between gap-3">
            <Link to={plans} className="inline-flex min-h-11 items-center gap-2 text-[0.88rem] font-semibold text-foreground hover:text-primary">
              <ArrowLeft aria-hidden className="size-4" />
              {tr("pricing.back")}
            </Link>
            <LanguageSwitcher />
          </div>
          <div className="mt-4">
            <SiteLogo />
          </div>
          <h1 className="mt-6 font-sans text-[clamp(1.8rem,1.4rem+1.4vw,2.5rem)] leading-tight font-bold text-title">{tr("pricing.checkoutTitle")}</h1>
          <p className="mt-1.5 text-[1.05rem] text-foreground/80">
            {choice.kind === "personal" ? tr("pricing.checkoutIntro") : tr("pricing.checkoutIntroAgency")}
          </p>
          <PlanSummary choice={choice} />
          <p className="mt-6 flex items-center justify-center gap-2 text-[0.82rem] text-muted-foreground">
            <Lock aria-hidden className="size-4" />
            {tr("pricing.checkoutProcessedBy")}
          </p>
          <ul aria-label={tr("pricing.checkoutMethodsLabel")} className="mt-3 flex flex-wrap justify-center gap-2">
            {paymentBrands.map((brand) => (
              <li key={brand} className={chip}>
                {brand}
              </li>
            ))}
          </ul>
        </div>
        <PaymentForm choice={choice} />
      </main>
    </div>
  );
}
