import { useEffect, useRef, useState } from "react";
import { ArrowLeft, ExternalLink, Store } from "lucide-react";
import { providerPath, type GeoPoint, type ProviderPublic } from "@tuevento/contracts";
import { getLocale, tr } from "./i18n";
import { errorText, useApp } from "./context";
import { ErrorBox, Modal } from "./components";
import { ProviderDetails } from "./provider-page";
import { emptyFilters, ProviderSearch, type SearchFilters } from "./provider-search";
import { Button } from "./ui/button";

/** «Ahora no» es una comodidad de este dispositivo, no un dato: si el almacenamiento falla, se ignora. */
const hiddenKey = (eventKey: string) => `tueventofun:sin-proveedores:${eventKey}`;
function readHidden(eventKey: string) {
  try {
    return localStorage.getItem(hiddenKey(eventKey)) === "1";
  } catch {
    return false;
  }
}
function saveHidden(eventKey: string) {
  try {
    localStorage.setItem(hiddenKey(eventKey), "1");
  } catch {
    // Sin almacenamiento (modo privado): la tarjeta se oculta solo hasta recargar
  }
}

/** Conexión del dispositivo según el navegador o el WebView de la app. */
function useOnline() {
  const [online, setOnline] = useState(() => typeof navigator === "undefined" || navigator.onLine !== false);
  useEffect(() => {
    const update = () => setOnline(navigator.onLine !== false);
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);
  return online;
}

/**
 * Invitación a buscar proveedores cerca del evento (en su editor y en su detalle). Abre la búsqueda
 * en un diálogo con la ubicación del evento: el formulario de detrás no se pierde porque no se navega.
 */
export function ProviderFinder({ eventKey, location, geo }: { eventKey: string; location: string; geo: GeoPoint | null }) {
  const { api, runtime, online: appOnline } = useApp();
  // La red según el navegador y, en las apps, según el sistema
  const online = useOnline() && appOnline;
  const opener = useRef<HTMLButtonElement>(null);
  const [hidden, setHidden] = useState(() => readHidden(eventKey)),
    [open, setOpen] = useState(false),
    [preparing, setPreparing] = useState(false),
    [filters, setFilters] = useState<SearchFilters>(emptyFilters),
    [slug, setSlug] = useState<string | null>(null),
    [profile, setProfile] = useState<ProviderPublic | null>(null),
    [error, setError] = useState("");
  useEffect(() => setHidden(readHidden(eventKey)), [eventKey]);
  useEffect(() => {
    if (!slug) return;
    let alive = true;
    setProfile(null);
    setError("");
    api
      .providerPage(slug)
      .then((p) => alive && setProfile(p))
      .catch((e) => alive && setError(errorText(e)));
    return () => {
      alive = false;
    };
  }, [api, slug]);
  if (hidden) return null;

  /** Punto del evento: sus coordenadas o, si no tiene, su dirección buscada en el mapa. */
  const start = async () => {
    const place = location.trim();
    let point = geo;
    if (!point && place.length >= 3) {
      setPreparing(true);
      point = await api
        .geoSearch(place)
        .then((found) => (found[0] ? { lat: found[0].lat, lng: found[0].lng } : null))
        .catch(() => null);
      setPreparing(false);
    }
    setFilters({ ...emptyFilters, point, place: point ? place : "" });
    setSlug(null);
    setOpen(true);
  };
  const close = () => {
    setOpen(false);
    setSlug(null);
    // El diálogo se desmonta: el foco vuelve al botón que lo abrió
    requestAnimationFrame(() => opener.current?.focus());
  };

  return (
    <aside className="provider-finder" aria-labelledby={`provider-finder-${eventKey}`}>
      <Store size={22} aria-hidden="true" />
      <div className="provider-finder-text">
        <p id={`provider-finder-${eventKey}`} className="provider-finder-title">
          {tr("eventProviders.title")}
        </p>
        <p>{online ? tr("eventProviders.text") : tr("eventProviders.offline")}</p>
      </div>
      <div className="button-group">
        <Button ref={opener} type="button" variant="outline" disabled={!online || preparing} onClick={start}>
          {preparing ? tr("location.searching") : tr("eventProviders.search")}
        </Button>
        <Button
          type="button"
          variant="ghost"
          onClick={() => {
            saveHidden(eventKey);
            setHidden(true);
          }}
        >
          {tr("eventProviders.notNow")}
        </Button>
      </div>
      {open && (
        <Modal title={tr("eventProviders.panelTitle")} onClose={close} wide>
          {slug ? (
            <div className="provider-finder-detail">
              <div className="button-group">
                <Button type="button" variant="outline" onClick={() => setSlug(null)}>
                  <ArrowLeft size={16} aria-hidden="true" />
                  {tr("eventProviders.back")}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => runtime.openExternal(`${runtime.publicOrigin}${providerPath(slug, getLocale())}`)}
                >
                  <ExternalLink size={16} aria-hidden="true" />
                  {tr("eventProviders.openFull")}
                </Button>
              </div>
              {profile ? (
                <ProviderDetails profile={profile} embedded />
              ) : error ? (
                <ErrorBox message={error} />
              ) : (
                <p role="status">{tr("common.loading")}</p>
              )}
            </div>
          ) : (
            <ProviderSearch filters={filters} onChange={setFilters} onOpen={(card) => setSlug(card.slug)} headingLevel={3} />
          )}
        </Modal>
      )}
    </aside>
  );
}
