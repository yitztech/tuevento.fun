import { useEffect, useRef, useState } from "react";
import { Copy, Link2, LocateFixed, MapPin, Navigation, Search, Share2, ExternalLink } from "lucide-react";
import { accountLimits, mapLinks, type GeoPlace, type GeoPoint } from "@tuevento/contracts";
import { tr } from "./i18n";
import { errorText, useApp } from "./context";

/** Estilo de OpenFreeMap: teselas de OpenStreetMap gratis y sin clave (docs/PLAN-PROVEEDORES-Y-OFFLINE.md, D3). */
const mapStyle = "https://tiles.openfreemap.org/styles/liberty";

/**
 * Mapa con un marcador. MapLibre se carga solo cuando hay un mapa que pintar. Es un
 * complemento: si el dispositivo no tiene WebGL o las teselas no cargan, no se muestra y todo
 * sigue funcionando con los botones.
 */
export function MapView({ point, label, onMove }: { point: GeoPoint; label: string; onMove?: (point: GeoPoint) => void }) {
  const container = useRef<HTMLDivElement>(null);
  const map = useRef<{ remove(): void; jumpTo(o: object): void } | null>(null);
  const marker = useRef<{ setLngLat(p: [number, number]): void } | null>(null);
  const moved = useRef(onMove);
  moved.current = onMove;
  const [failed, setFailed] = useState(false);
  // biome-ignore lint/correctness/useExhaustiveDependencies: el mapa se crea una vez; los cambios de punto los aplica el efecto de abajo
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const [maplibre] = await Promise.all([import("maplibre-gl"), import("maplibre-gl/dist/maplibre-gl.css")]);
        if (!alive || !container.current) return;
        const instance = new maplibre.Map({
          container: container.current,
          style: mapStyle,
          center: [point.lng, point.lat],
          zoom: 15,
          attributionControl: { compact: true },
          cooperativeGestures: true,
        });
        instance.on("error", () => {});
        const pin = new maplibre.Marker({ color: "#882d17", draggable: !!moved.current })
          .setLngLat([point.lng, point.lat])
          .addTo(instance);
        pin.on("dragend", () => {
          const { lat, lng } = pin.getLngLat();
          moved.current?.({ lat: Number(lat.toFixed(6)), lng: Number(lng.toFixed(6)) });
        });
        map.current = instance;
        marker.current = pin;
      } catch {
        if (alive) setFailed(true);
      }
    })();
    return () => {
      alive = false;
      map.current?.remove();
      map.current = null;
    };
  }, []);
  // El punto cambió por otro camino (lista de resultados, enlace pegado)
  useEffect(() => {
    marker.current?.setLngLat([point.lng, point.lat]);
    // jumpTo, sin animación: respeta a quien pide movimiento reducido
    map.current?.jumpTo({ center: [point.lng, point.lat] });
  }, [point.lat, point.lng]);
  if (failed) return null;
  return <div ref={container} className="map-view" role="img" aria-label={tr("location.mapLabel", { place: label })} />;
}

/** Abrir el lugar en las apps de mapas del teléfono, copiar la dirección o compartirla. */
export function MapLinks({ label, geo }: { label: string; geo: GeoPoint | null }) {
  const { runtime, toast } = useApp();
  const links = mapLinks({ label, geo });
  const text = tr("location.shareText", { place: label, url: links.google });
  const share = async () => {
    try {
      if (runtime.share) await runtime.share({ title: label, text, url: links.google });
      else {
        await runtime.copy(text);
        toast(tr("location.copied"));
      }
    } catch {
      // Cerrar la hoja de compartir sin elegir nada no es un error
    }
  };
  return (
    <div className="map-links">
      <a className="button secondary" href={links.google} target="_blank" rel="noreferrer">
        <MapPin size={16} />
        {tr("location.openGoogle")}
        <ExternalLink size={13} />
      </a>
      <a className="button secondary" href={links.apple} target="_blank" rel="noreferrer">
        {tr("location.openApple")}
        <ExternalLink size={13} />
      </a>
      <a className="button secondary" href={links.waze} target="_blank" rel="noreferrer">
        {tr("location.openWaze")}
        <ExternalLink size={13} />
      </a>
      <a className="button secondary" href={links.directions} target="_blank" rel="noreferrer">
        <Navigation size={16} />
        {tr("location.directions")}
      </a>
      <button
        type="button"
        className="button secondary"
        onClick={async () => {
          await runtime.copy(label);
          toast(tr("location.copied"));
        }}
      >
        <Copy size={16} />
        {tr("location.copyAddress")}
      </button>
      <button type="button" className="button secondary" onClick={share}>
        <Share2 size={16} />
        {tr("location.share")}
      </button>
    </div>
  );
}

/**
 * Herramientas para fijar el punto exacto de un lugar: buscar el texto en el mapa (al pulsar,
 * nunca mientras se escribe: lo exige Nominatim), usar la ubicación del dispositivo o pegar un
 * enlace de mapas. El texto del lugar nunca cambia solo: se ofrece la dirección del punto.
 */
export function LocationPicker({
  place,
  value,
  onChange,
  onUseAddress,
}: {
  place: string;
  value: GeoPoint | null;
  onChange: (geo: GeoPoint | null) => void;
  onUseAddress: (label: string) => void;
}) {
  const { api, runtime } = useApp();
  const getPosition = runtime.getPosition;
  const [busy, setBusy] = useState(false),
    [results, setResults] = useState<GeoPlace[] | null>(null),
    [linkOpen, setLinkOpen] = useState(false),
    [link, setLink] = useState(""),
    [error, setError] = useState(""),
    [suggestion, setSuggestion] = useState("");
  const run = async (task: () => Promise<void>) => {
    setBusy(true);
    setError("");
    try {
      await task();
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  };
  // Dirección del punto, para ofrecerla (sin cambiar el texto que escribió la persona)
  const suggest = (point: GeoPoint) =>
    api
      .geoReverse(point)
      .then(({ place: found }) => setSuggestion(found?.label ?? ""))
      .catch(() => setSuggestion(""));
  const pick = (found: GeoPlace) => {
    onChange({ lat: found.lat, lng: found.lng });
    if (!place.trim()) onUseAddress(found.label);
    setResults(null);
    setSuggestion("");
  };
  return (
    <div className="location-tools">
      <div className="button-group">
        <button
          type="button"
          className="button secondary"
          disabled={busy || place.trim().length < 3}
          onClick={() => run(async () => setResults(await api.geoSearch(place)))}
        >
          <Search size={16} />
          {tr("location.searchOnMap")}
        </button>
        {getPosition && (
          <button
            type="button"
            className="button secondary"
            disabled={busy}
            onClick={() =>
              run(async () => {
                const point = await getPosition().catch(() => {
                  throw new Error("location.locationDenied");
                });
                onChange(point);
                setResults(null);
                void suggest(point);
              })
            }
          >
            <LocateFixed size={16} />
            {tr("location.useMyLocation")}
          </button>
        )}
        <button
          type="button"
          className="button secondary"
          aria-expanded={linkOpen}
          onClick={() => setLinkOpen((open) => !open)}
        >
          <Link2 size={16} />
          {tr("location.pasteLink")}
        </button>
      </div>
      {linkOpen && (
        <div className="location-link">
          <label>
            <span>{tr("location.linkLabel")}</span>
            <input
              type="url"
              inputMode="url"
              value={link}
              maxLength={accountLimits.url}
              onChange={(e) => setLink(e.target.value)}
              placeholder={tr("location.linkPlaceholder")}
            />
          </label>
          <button
            type="button"
            className="button secondary"
            disabled={busy || !link.trim()}
            onClick={() =>
              run(async () => {
                const point = await api.parseMapLink(link.trim());
                onChange(point);
                setLink("");
                setLinkOpen(false);
                void suggest(point);
              })
            }
          >
            {tr("location.applyLink")}
          </button>
        </div>
      )}
      {busy && <p role="status">{tr("location.searching")}</p>}
      {error && (
        <p className="field-error" role="alert">
          {error}
        </p>
      )}
      {results &&
        (results.length ? (
          <div className="location-results">
            <p id="location-results-title">{tr("location.chooseResult")}</p>
            <ul aria-labelledby="location-results-title">
              {results.map((found) => (
                <li key={`${found.lat},${found.lng}`}>
                  <button type="button" onClick={() => pick(found)}>
                    <MapPin size={15} />
                    {found.label}
                  </button>
                </li>
              ))}
            </ul>
            <small>{tr("location.attribution")}</small>
          </div>
        ) : (
          <p role="status">{tr("location.noResults")}</p>
        ))}
      {value ? (
        <>
          <MapView
            point={value}
            label={place}
            onMove={(point) => {
              onChange(point);
              void suggest(point);
            }}
          />
          <p className="location-pin" role="status">
            <MapPin size={15} />
            {tr("location.pinSet")}
            <button type="button" className="text-button" onClick={() => onChange(null)}>
              {tr("location.removePin")}
            </button>
          </p>
          {suggestion && suggestion !== place && (
            <button
              type="button"
              className="text-button"
              onClick={() => {
                onUseAddress(suggestion);
                setSuggestion("");
              }}
            >
              {tr("location.useAddress", { address: suggestion })}
            </button>
          )}
        </>
      ) : (
        <small>{tr("location.hint")}</small>
      )}
    </div>
  );
}
