import { useEffect, useRef, useState } from "react";
import { Link, Navigate, useParams } from "react-router-dom";
import { ChevronLeft, ChevronRight, Globe, Mail, MapPin, MessageCircle, Phone, Share2 } from "lucide-react";
import { ApiError } from "@tuevento/client";
import { providerCategoryLabels, providerPath, type ProviderImage, type ProviderPublic } from "@tuevento/contracts";
import { getLocale, LanguageSwitcher, tr } from "./i18n";
import { errorText, useApp } from "./context";
import { ErrorBox, Logo, Modal } from "./components";
import { MapLinks, MapView } from "./location";
import { priceText } from "./provider";

/** wa.me con el número en E.164 sin el «+» y el mensaje ya escrito en el idioma de la página. */
const whatsappUrl = (p: ProviderPublic) =>
  `https://wa.me/${p.whatsapp.replace(/\D/g, "")}?text=${encodeURIComponent(tr("providers.whatsappMessage", { name: p.businessName }))}`;

const networks = [
  ["instagramUrl", "Instagram"],
  ["facebookUrl", "Facebook"],
  ["tiktokUrl", "TikTok"],
] as const;

/** Título, descripción y datos estructurados (LocalBusiness) al navegar dentro de la SPA. */
function usePageMeta(p: ProviderPublic | null) {
  useEffect(() => {
    if (!p) return;
    const category = p.categories[0] ? tr(providerCategoryLabels[p.categories[0]]) : "";
    const previous = document.title;
    document.title = tr("providers.seoTitle", { name: p.businessName, category });
    const data = {
      "@context": "https://schema.org",
      "@type": "LocalBusiness",
      name: p.businessName,
      description: p.headline || p.description || undefined,
      url: window.location.href.split(/[?#]/)[0],
      image: p.cover ? new URL(p.cover.urls[1600], window.location.origin).href : undefined,
      telephone: p.phone || p.whatsapp || undefined,
      email: p.publicEmail || undefined,
      sameAs: networks.map(([key]) => p[key]).filter(Boolean),
      address: {
        "@type": "PostalAddress",
        streetAddress: p.address || undefined,
        addressLocality: p.city || undefined,
        addressRegion: p.region || undefined,
        postalCode: p.postalCode || undefined,
        addressCountry: p.country,
      },
      geo: p.geo && p.addressVisibility === "exact" ? { "@type": "GeoCoordinates", latitude: p.geo.lat, longitude: p.geo.lng } : undefined,
    };
    const script = document.createElement("script");
    script.type = "application/ld+json";
    // JSON escapado para un <script>: un «</script>» del texto del proveedor no lo cierra
    script.textContent = JSON.stringify(data).replace(/</g, "\\u003c");
    document.head.append(script);
    return () => {
      document.title = previous;
      script.remove();
    };
  }, [p]);
}

/** Página pública de un proveedor publicado: /proveedores/<dirección> en cada idioma. */
export function ProviderPage() {
  const slug = useParams().slug ?? "",
    { api } = useApp(),
    [profile, setProfile] = useState<ProviderPublic | null>(null),
    [error, setError] = useState(""),
    [missing, setMissing] = useState(false);
  useEffect(() => {
    setProfile(null);
    setError("");
    api
      .providerPage(slug)
      .then(setProfile)
      .catch((e) => {
        setMissing(e instanceof ApiError && e.status === 404);
        setError(errorText(e));
      });
  }, [api, slug]);
  usePageMeta(profile);
  if (profile && profile.slug !== slug) return <Navigate to={providerPath(profile.slug, getLocale())} replace />;
  if (!profile)
    return (
      <div className="startup">
        <Logo />
        {missing ? (
          <>
            <h1>{tr("providerPage.notFoundTitle")}</h1>
            <p>{tr("providerPage.notFoundText")}</p>
          </>
        ) : error ? (
          <ErrorBox message={error} />
        ) : (
          <p role="status">{tr("common.loading")}</p>
        )}
      </div>
    );
  return <ProviderView profile={profile} />;
}

function ProviderView({ profile: p }: { profile: ProviderPublic }) {
  const place = [p.city, p.region].filter(Boolean).join(", ");
  return (
    <div className="provider-page">
      <header className="provider-page-top">
        <Logo />
        <LanguageSwitcher />
      </header>
      <main>
        <section className="provider-hero" aria-labelledby="provider-name">
          {p.cover && <img className="provider-hero-cover" src={p.cover.urls[1600]} alt={p.cover.alt} />}
          <div className="provider-hero-text">
            {p.logo && <img className="provider-logo" src={p.logo.urls[480]} alt={p.logo.alt} />}
            <h1 id="provider-name">{p.businessName}</h1>
            {p.headline && <p className="provider-headline">{p.headline}</p>}
            <ul className="provider-tags">
              {p.categories.map((c) => (
                <li key={c}>{tr(providerCategoryLabels[c])}</li>
              ))}
            </ul>
            {place && (
              <p className="provider-place">
                <MapPin size={16} aria-hidden="true" /> {place}
              </p>
            )}
          </div>
        </section>

        <Contact profile={p} />

        {p.services.length > 0 && (
          <section className="provider-section" aria-labelledby="provider-services">
            <h2 id="provider-services">{tr("providerPage.services")}</h2>
            <ul className="provider-service-grid">
              {p.services.map((service) => {
                const photo = p.images.find((i) => i.serviceId === service.id);
                return (
                  <li key={service.id} className="provider-service">
                    {photo && <img src={photo.urls[480]} alt={photo.alt} loading="lazy" />}
                    <h3>{service.title}</h3>
                    <p className="provider-price">{priceText(service)}</p>
                    {service.description && <p className="provider-text">{service.description}</p>}
                  </li>
                );
              })}
            </ul>
          </section>
        )}

        {p.images.length > 0 && <Gallery images={p.images} />}

        {p.description && (
          <section className="provider-section" aria-labelledby="provider-about">
            <h2 id="provider-about">{tr("providerPage.about")}</h2>
            {/* Texto plano: los saltos de línea se respetan con CSS, nunca se interpreta HTML */}
            <p className="provider-text">{p.description}</p>
          </section>
        )}

        <section className="provider-section" aria-labelledby="provider-location">
          <h2 id="provider-location">{tr("providerPage.location")}</h2>
          {p.addressVisibility === "exact" && p.address && <p>{p.address}</p>}
          <p className="provider-place">
            {p.serviceRadiusKm > 0 ? tr("providerPage.serviceRadius", { count: p.serviceRadiusKm }) : tr("providerPage.onlyAtVenue")}
          </p>
          {p.geo && <MapView point={p.geo} label={p.businessName} approximate={p.addressVisibility !== "exact"} />}
          {p.addressVisibility === "exact" ? (
            <MapLinks label={[p.businessName, p.address, place].filter(Boolean).join(", ")} geo={p.geo} />
          ) : (
            <p className="field-note">{tr("providerPage.approximate")}</p>
          )}
        </section>

        <aside className="provider-own">
          <p>{tr("providerPage.ownBusiness")}</p>
          <Link className="button secondary" to="/registro?tipo=proveedor">
            {tr("providerPage.ownBusinessLink")}
          </Link>
        </aside>
      </main>
    </div>
  );
}

function Contact({ profile: p }: { profile: ProviderPublic }) {
  const { runtime, toast } = useApp();
  const share = async () => {
    const url = window.location.href.split(/[?#]/)[0];
    const text = tr("providerPage.shareText", { name: p.businessName });
    try {
      if (runtime.share) await runtime.share({ title: p.businessName, text, url });
      else {
        await runtime.copy(url);
        toast(tr("providerPage.linkCopied"));
      }
    } catch {
      // La persona cerró la hoja de compartir: no es un error
    }
  };
  return (
    <section className="provider-section provider-contact" aria-labelledby="provider-contact">
      <h2 id="provider-contact">{tr("providerPage.contact")}</h2>
      <div className="button-group">
        {p.whatsapp && (
          <a className="button" href={whatsappUrl(p)} target="_blank" rel="noopener noreferrer">
            <MessageCircle size={18} aria-hidden="true" />
            {tr("providerPage.whatsapp")}
          </a>
        )}
        {p.phone && (
          <a className="button secondary" href={`tel:${p.phone}`}>
            <Phone size={18} aria-hidden="true" />
            {tr("providerPage.call")}
          </a>
        )}
        {p.publicEmail && (
          <a className="button secondary" href={`mailto:${p.publicEmail}`}>
            <Mail size={18} aria-hidden="true" />
            {tr("providerPage.email")}
          </a>
        )}
        {p.website && (
          <a className="button secondary" href={p.website} target="_blank" rel="noopener noreferrer nofollow">
            <Globe size={18} aria-hidden="true" />
            {tr("providerPage.website")}
          </a>
        )}
        <button type="button" className="button secondary" onClick={share}>
          <Share2 size={18} aria-hidden="true" />
          {tr("providerPage.share")}
        </button>
      </div>
      {networks.some(([key]) => p[key]) && (
        <ul className="provider-networks">
          {networks.map(
            ([key, network]) =>
              p[key] && (
                <li key={key}>
                  <a href={p[key]} target="_blank" rel="noopener noreferrer nofollow">
                    {tr("providerPage.onNetwork", { name: p.businessName, network })}
                  </a>
                </li>
              ),
          )}
        </ul>
      )}
    </section>
  );
}

/** Cuadrícula de fotos con visor: flechas para moverse, Esc para cerrar y el foco vuelve a la foto. */
function Gallery({ images }: { images: ProviderImage[] }) {
  const [open, setOpen] = useState<number | null>(null);
  const openers = useRef<(HTMLButtonElement | null)[]>([]);
  const close = () => {
    const index = open;
    setOpen(null);
    if (index !== null) requestAnimationFrame(() => openers.current[index]?.focus());
  };
  const isOpen = open !== null;
  const count = images.length;
  const move = (step: number) => setOpen((i) => (i === null ? i : (i + step + count) % count));
  // Flechas en todo el visor (el foco empieza en su botón de cerrar); Esc lo cierra el diálogo
  useEffect(() => {
    if (!isOpen) return;
    const keys = (e: KeyboardEvent) => {
      const step = e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0;
      if (step) setOpen((i) => (i === null ? i : (i + step + count) % count));
    };
    window.addEventListener("keydown", keys);
    return () => window.removeEventListener("keydown", keys);
  }, [isOpen, count]);
  const current = open === null ? null : images[open];
  return (
    <section className="provider-section" aria-labelledby="provider-gallery">
      <h2 id="provider-gallery">{tr("providerPage.gallery")}</h2>
      <ul className="provider-gallery">
        {images.map((image, index) => (
          <li key={image.id}>
            <button
              type="button"
              ref={(el) => {
                openers.current[index] = el;
              }}
              aria-label={tr("providerPage.openPhoto", { number: index + 1, total: images.length })}
              onClick={() => setOpen(index)}
            >
              <img src={image.urls[480]} alt={image.alt} loading="lazy" width={image.width} height={image.height} />
            </button>
          </li>
        ))}
      </ul>
      {current && open !== null && (
        <Modal title={tr("providerPage.viewer", { number: open + 1, total: images.length })} onClose={close} wide>
          <div className="provider-viewer">
            <img src={current.urls[1600]} alt={current.alt} />
            {images.length > 1 && (
              <div className="button-group">
                <button type="button" className="button secondary" onClick={() => move(-1)}>
                  <ChevronLeft size={18} aria-hidden="true" />
                  {tr("providerPage.previous")}
                </button>
                <button type="button" className="button secondary" onClick={() => move(1)}>
                  {tr("providerPage.next")}
                  <ChevronRight size={18} aria-hidden="true" />
                </button>
              </div>
            )}
          </div>
        </Modal>
      )}
    </section>
  );
}
