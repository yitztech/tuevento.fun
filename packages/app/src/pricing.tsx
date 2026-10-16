import { useEffect } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { guestTiers, localizedPath, type GuestTier, type Locale } from "@tuevento/contracts";
import { Logo, Container } from "./components";
import { LanguageSwitcher, tr, useLocale } from "./i18n";

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
          <Link to="/registro" className="button pricing-cta">
            {tr("pricing.buy")}
            <ArrowRight size={18} />
          </Link>
        </main>
      </Container>
    </div>
  );
}

/** Página de pago de la cuenta (demostración incluida). El cobro todavía no está conectado. */
export function PaymentPage() {
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
          <Link to="/app" className="text-link">
            <ArrowLeft size={16} />
            {tr("pricing.back")}
          </Link>
          <h1>{tr("pricing.payService")}</h1>
          <p className="legal-intro">{tr("pricing.paymentPending")}</p>
          <TierList />
        </main>
      </Container>
    </div>
  );
}
