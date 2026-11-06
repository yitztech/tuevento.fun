import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { ArrowLeft, ArrowRight, CheckCircle2 } from "lucide-react";
import {
  agencyPlans,
  discountedCents,
  guestTiers,
  localizedPath,
  personalPlans,
  upgradeCents,
  type AgencyPlan,
  type AppliedCoupon,
  type Event,
  type GuestTier,
  type Locale,
  type PersonalPlan,
  type TierIndex,
} from "@tuevento/contracts";
import { ApiError } from "@tuevento/client";
import { Logo, Container, ErrorBox } from "./components";
import { CouponField } from "./coupon";
import { errorText, useApp } from "./context";
import { LanguageSwitcher, tr, useLocale } from "./i18n";
import { Button } from "./ui/button";
import { SiteLayout } from "./ui/site/site-layout";

/** Ruta de la página de precios en un idioma (/precios, /pricing…). */
export const pricingPath = (locale: Locale) => localizedPath("pricing", locale);

/** Precio en dólares: $5.00, $10.00… (igual en todos los idiomas). */
const price = (usd: number) => `$${usd.toFixed(2)}`;

/** Precio de la oferta pública: «$0» para el plan gratis y «$14.99» para el resto. */
const planPrice = (usd: number) => (usd === 0 ? "$0" : price(usd));

/** Nombre de cada plan público, en el idioma de quien lee (cada clave, escrita entera). */
const planNames = {
  free: () => tr("pricing.planFree"),
  essential: () => tr("pricing.planEssential"),
  plus: () => tr("pricing.planPlus"),
  premium: () => tr("pricing.planPremium"),
  celebration: () => tr("pricing.planCelebration"),
  grandEvent: () => tr("pricing.planGrandEvent"),
  starter: () => tr("pricing.planStarter"),
  business: () => tr("pricing.planBusiness"),
  agency: () => tr("pricing.planAgency"),
} satisfies Record<PersonalPlan["key"] | AgencyPlan["key"], () => string>;

/** Invitados que cubre un plan: «Hasta 20», «21–60» o «501 o más». */
function guestsText(plan: PersonalPlan) {
  if (plan.minGuests === 0) return tr("pricing.guestsUpTo", { max: plan.maxGuests });
  if (plan.maxGuests === null) return tr("pricing.guestsFrom", { min: plan.minGuests });
  return tr("pricing.guestsRange", { min: plan.minGuests, max: plan.maxGuests });
}

/** Planes para personas: un pago único por evento según los invitados. */
function PersonalPlans() {
  return (
    <section aria-labelledby="pricing-personal">
      <h2 id="pricing-personal">{tr("pricing.personalTitle")}</h2>
      <p className="legal-intro">{tr("pricing.intro")}</p>
      <table className="pricing-table">
        <thead>
          <tr>
            <th scope="col">{tr("pricing.colPlan")}</th>
            <th scope="col">{tr("pricing.colGuests")}</th>
            <th scope="col">{tr("pricing.colPrice")}</th>
          </tr>
        </thead>
        <tbody>
          {personalPlans.map((plan) => (
            <tr key={plan.key}>
              <th scope="row">{planNames[plan.key]()}</th>
              <td>{guestsText(plan)}</td>
              <td>{planPrice(plan.usd)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

/** Planes para agencias y organizadores: suscripción mensual. */
function AgencyPlans() {
  return (
    <section aria-labelledby="pricing-agency">
      <h2 id="pricing-agency">{tr("pricing.agencyTitle")}</h2>
      <p className="legal-intro">{tr("pricing.agencyIntro")}</p>
      <table className="pricing-table">
        <thead>
          <tr>
            <th scope="col">{tr("pricing.agencyColPlan")}</th>
            <th scope="col">{tr("pricing.agencyColPrice")}</th>
          </tr>
        </thead>
        <tbody>
          {agencyPlans.map((plan) => (
            <tr key={plan.key}>
              <th scope="row">{planNames[plan.key]()}</th>
              <td>{planPrice(plan.usd)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

/** Rótulo de un tramo: «Hasta 50 invitados» o «Más de 150 invitados». */
function tierLabel(tier: GuestTier, index: number) {
  if (tier.maxGuests !== null) return tr("pricing.upTo", { guests: tier.maxGuests });
  // Solo el último tramo no tiene máximo: el anterior marca el límite
  const previous = Number(guestTiers[index - 1].maxGuests);
  return tr("pricing.moreThan", { guests: previous });
}

function TierList() {
  return (
    <ul className="pricing-tiers">
      {guestTiers.map((tier, index) => (
        <li key={index} className="pricing-tier">
          <span>{tierLabel(tier, index)}</span>
          <strong>
            {price(tier.usd)} <small>{tr("pricing.perEvent")}</small>
          </strong>
        </li>
      ))}
    </ul>
  );
}

/** Página pública de precios: visible sin registrarse, en la ruta de cada idioma. */
export function PricingPage() {
  const { locale } = useLocale();
  useEffect(() => {
    document.title = `${tr("pricing.title")} · TuEventoFun`;
  }, [locale]);
  return (
    <SiteLayout>
    <div className="legal-page pricing-page">
      <Container width="prose">
        <div>
          <Link to="/" className="text-link">
            <ArrowLeft size={16} />
            {tr("common.backHome")}
          </Link>
          <h1>{tr("pricing.title")}</h1>
          <p className="legal-intro">{tr("pricing.publicIntro")}</p>
          <PersonalPlans />
          <AgencyPlans />
          <Button asChild><Link to="/registro" className="pricing-cta">
            {tr("pricing.buy")}
            <ArrowRight size={18} />
          </Link></Button>
        </div>
      </Container>
    </div>
    </SiteLayout>
  );
}

/** Estado del plan de un evento: gratuito o el tramo pagado. */
export function planText(event: Pick<Event, "paidTier">) {
  if (event.paidTier === null) return tr("pricing.freePlan");
  const tier = guestTiers[event.paidTier];
  return tier.maxGuests !== null
    ? tr("pricing.paidUpTo", { guests: tier.maxGuests })
    : tr("pricing.paidMoreThan", { guests: Number(guestTiers[event.paidTier - 1].maxGuests) });
}

/** Ruta del pago de un evento. */
export const paymentPath = (eventId: string) => `/pago?evento=${eventId}`;

/** Tramos con su botón de pago: solo los mayores que el pagado que cubren a los invitados. */
function CheckoutTiers({ event }: { event: Event }) {
  const { api, reload, runtime } = useApp(),
    navigate = useNavigate(),
    [busy, setBusy] = useState<number | null>(null),
    [error, setError] = useState(""),
    [coupon, setCoupon] = useState<AppliedCoupon | null>(null);
  const pay = async (tier: TierIndex) => {
    setBusy(tier);
    setError("");
    try {
      const { url, paid } = await api.checkout(event.id, tier, coupon?.code);
      // Un cupón que lo cubre todo no pasa por Stripe: el pago ya está confirmado
      if (paid || !url) {
        // Si la recarga falla, el pago sigue hecho: la página de vuelta lo comprueba sola
        await reload().catch(() => undefined);
        setCoupon(null);
        setBusy(null);
        navigate(`${paymentPath(event.id)}&pagado=1`);
        return;
      }
      // En la web, la página de Stripe sustituye a esta; en la app se abre en el navegador
      if (runtime.platform && runtime.platform !== "web") runtime.openExternal(url);
      else window.location.assign(url);
    } catch (e) {
      // El cupón dejó de valer entre aplicarlo y pagar: vuelven los precios completos
      if (e instanceof ApiError && e.code === "coupon_invalid") setCoupon(null);
      setError(errorText(e));
      setBusy(null);
    }
  };
  /** Texto del botón de un tramo, con el descuento del cupón si hay uno aplicado. */
  const payLabel = (position: TierIndex) => {
    const full = upgradeCents(event.paidTier, position);
    const cents = coupon ? discountedCents(full, coupon) : full;
    return cents === 0 ? tr("pricing.payFree") : tr("pricing.payTier", { price: price(cents / 100) });
  };
  if (event.paidTier === guestTiers.length - 1) return <p className="legal-intro">{tr("pricing.topTier")}</p>;
  return (
    <>
      {event.paidTier !== null && <p>{tr("pricing.upgradeNote")}</p>}
      <CouponField coupon={coupon} onChange={setCoupon} />
      {error && <ErrorBox message={error} />}
      <ul className="pricing-tiers" aria-label={tr("pricing.tiersLabel")}>
        {guestTiers.map((tier, index) => {
          const position = index as TierIndex;
          const included = event.paidTier !== null && position <= event.paidTier;
          const tooSmall = tier.maxGuests !== null && event.metrics.people > tier.maxGuests;
          return (
            <li key={index} className="pricing-tier">
              <span>{tierLabel(tier, index)}</span>
              {included ? (
                <small>{tr("pricing.tierIncluded")}</small>
              ) : tooSmall ? (
                <small>{tr("pricing.tierTooSmall")}</small>
              ) : (
                <Button disabled={busy !== null} onClick={() => void pay(position)}>
                  {busy === position ? tr("pricing.goingToCheckout") : payLabel(position)}
                </Button>
              )}
            </li>
          );
        })}
      </ul>
    </>
  );
}

/** Vuelta de Stripe: el pago cuenta cuando llega su webhook, así que se espera a verlo pagado. */
function useConfirmingPayment(event: Event | undefined, returned: boolean) {
  const { reload } = useApp();
  const waiting = returned && !!event && event.paidTier === null;
  useEffect(() => {
    if (!waiting) return;
    const timer = setInterval(() => void reload().catch(() => undefined), 2000);
    const stop = setTimeout(() => clearInterval(timer), 60_000);
    return () => {
      clearInterval(timer);
      clearTimeout(stop);
    };
  }, [waiting]);
  return waiting;
}

/**
 * Página de pago de un evento (`/pago?evento=…`) o, sin evento, la lista para elegirlo. Sin los
 * pagos activos en el servidor solo muestra los precios y que el cobro no está conectado.
 */
export function PaymentPage() {
  const { config, events } = useApp(),
    [params] = useSearchParams();
  const event = events.find((e) => e.id === params.get("evento")),
    returned = params.get("pagado") === "1";
  const confirming = useConfirmingPayment(event, returned);
  useEffect(() => {
    document.title = `${tr("pricing.payService")} · TuEventoFun`;
  }, []);
  return (
    <div className="legal-page pricing-page">
      <Container width="prose">
        <header>
          <Logo />
          <LanguageSwitcher />
        </header>
        <main>
          <Link to={event ? `/eventos/${event.id}` : "/app"} className="text-link">
            <ArrowLeft size={16} />
            {tr("pricing.back")}
          </Link>
          <h1>{tr("pricing.payService")}</h1>
          {!config.paymentsEnabled ? (
            <>
              <p className="legal-intro">{tr("pricing.paymentPending")}</p>
              <TierList />
            </>
          ) : event ? (
            <>
              <h2>{event.title}</h2>
              <p className="legal-intro">
                {tr("pricing.guestsNow", { count: event.metrics.people })} {planText(event)}
              </p>
              {returned && event.paidTier !== null && (
                <p className="success-box" role="status">
                  <CheckCircle2 size={18} />
                  {tr("pricing.paymentReceived")}
                </p>
              )}
              {confirming ? (
                <p role="status">{tr("pricing.confirming")}</p>
              ) : (
                <CheckoutTiers event={event} />
              )}
            </>
          ) : (
            <>
              <p className="legal-intro">{tr("pricing.intro")}</p>
              <h2>{tr("pricing.chooseEvent")}</h2>
              {events.filter((e) => !e.archived).length ? (
                <ul className="pricing-tiers">
                  {events
                    .filter((e) => !e.archived)
                    .map((e) => (
                      <li key={e.id} className="pricing-tier">
                        <Link to={paymentPath(e.id)}>{e.title}</Link>
                        <small>{planText(e)}</small>
                      </li>
                    ))}
                </ul>
              ) : (
                <p>{tr("pricing.noEvents")}</p>
              )}
              <TierList />
            </>
          )}
        </main>
      </Container>
    </div>
  );
}
