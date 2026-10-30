import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { ArrowLeft, ArrowRight, CheckCircle2 } from "lucide-react";
import {
  guestTiers,
  localizedPath,
  upgradeCents,
  type Event,
  type GuestTier,
  type Locale,
  type TierIndex,
} from "@tuevento/contracts";
import { Logo, Container, ErrorBox } from "./components";
import { errorText, useApp } from "./context";
import { LanguageSwitcher, tr, useLocale } from "./i18n";
import { Button } from "./ui/button";

/** Ruta de la página de precios en un idioma (/precios, /pricing…). */
export const pricingPath = (locale: Locale) => localizedPath("pricing", locale);

/** Precio en dólares: $5.00, $10.00… (igual en todos los idiomas). */
const price = (usd: number) => `$${usd.toFixed(2)}`;

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
    <div className="legal-page pricing-page">
      <Container width="prose">
        <header>
          <Logo />
          <LanguageSwitcher />
        </header>
        <main>
          <Link to="/" className="text-link">
            <ArrowLeft size={16} />
            {tr("common.backHome")}
          </Link>
          <h1>{tr("pricing.title")}</h1>
          <p className="legal-intro">{tr("pricing.intro")}</p>
          <TierList />
          <Button asChild><Link to="/registro" className="pricing-cta">
            {tr("pricing.buy")}
            <ArrowRight size={18} />
          </Link></Button>
        </main>
      </Container>
    </div>
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
  const { api, runtime } = useApp(),
    [busy, setBusy] = useState<number | null>(null),
    [error, setError] = useState("");
  const pay = async (tier: TierIndex) => {
    setBusy(tier);
    setError("");
    try {
      const { url } = await api.checkout(event.id, tier);
      // En la web, la página de Stripe sustituye a esta; en la app se abre en el navegador
      if (runtime.platform && runtime.platform !== "web") runtime.openExternal(url);
      else window.location.assign(url);
    } catch (e) {
      setError(errorText(e));
      setBusy(null);
    }
  };
  if (event.paidTier === guestTiers.length - 1) return <p className="legal-intro">{tr("pricing.topTier")}</p>;
  return (
    <>
      {event.paidTier !== null && <p>{tr("pricing.upgradeNote")}</p>}
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
                  {busy === position
                    ? tr("pricing.goingToCheckout")
                    : tr("pricing.payTier", { price: price(upgradeCents(event.paidTier, position) / 100) })}
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
