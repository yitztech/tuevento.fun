import { useCallback, useEffect, useId, useMemo, useState, type FormEvent } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { ArrowLeft, LocateFixed, MapPin, Search, SearchX, WifiOff, X } from "lucide-react";
import { ApiError } from "@tuevento/client";
import {
  accountLimits,
  providerCategories,
  providerCategoryLabels,
  providerPath,
  searchLimits,
  type GeoPlace,
  type GeoPoint,
  type ProviderCard,
  type ProviderCategory,
  type ProviderSearchResult,
  type SearchSort,
} from "@tuevento/contracts";
import { formatLocale, getLocale, tr, useLocale } from "./i18n";
import { SiteLayout } from "./ui/site/site-layout";
import { errorText, useApp } from "./context";
import { Field } from "./components";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { NativeSelect } from "./ui/native-select";

/** Distancias que se ofrecen (km). La del servicio por defecto va en medio. */
export const searchRadii = [10, searchLimits.defaultRadiusKm, 50, 100] as const;

/** Lo que se busca. Vive en la URL en la página y en el estado del panel del evento (fase 7). */
export type SearchFilters = {
  q: string;
  categories: ProviderCategory[];
  point: GeoPoint | null;
  /** Nombre del lugar elegido («Cuernavaca, Morelos»); vacío con «Cerca de mí». */
  place: string;
  radiusKm: number;
  sort: SearchSort;
};

export const emptyFilters: SearchFilters = {
  q: "",
  categories: [],
  point: null,
  place: "",
  radiusKm: searchLimits.defaultRadiusKm,
  sort: "relevance",
};

const isCategory = (value: string): value is ProviderCategory =>
  (providerCategories as readonly string[]).includes(value);
const coordinate = (raw: string | null, max: number) => {
  if (raw === null || raw.trim() === "") return null;
  const value = Number(raw);
  return Number.isFinite(value) && Math.abs(value) <= max ? value : null;
};

/** Filtros a partir de `?q=&cat=&lat=&lng=&r=&sort=&place=`: lo que no es válido se ignora. */
export function filtersFromParams(params: URLSearchParams): SearchFilters {
  const lat = coordinate(params.get("lat"), 90),
    lng = coordinate(params.get("lng"), 180);
  const point = lat !== null && lng !== null ? { lat, lng } : null;
  const radius = Number(params.get("r"));
  return {
    q: (params.get("q") ?? "").slice(0, accountLimits.search),
    categories: [...new Set((params.get("cat") ?? "").split(",").filter(isCategory))],
    point,
    place: point ? (params.get("place") ?? "").slice(0, accountLimits.geoQuery) : "",
    radiusKm: (searchRadii as readonly number[]).includes(radius) ? radius : searchLimits.defaultRadiusKm,
    sort: point && params.get("sort") === "distance" ? "distance" : "relevance",
  };
}

/** Lo contrario: solo los parámetros con valor, para una URL corta y compartible. */
export function filtersToParams(filters: SearchFilters): URLSearchParams {
  const params = new URLSearchParams();
  if (filters.q.trim()) params.set("q", filters.q.trim());
  if (filters.categories.length) params.set("cat", filters.categories.join(","));
  if (filters.point) {
    params.set("lat", filters.point.lat.toFixed(5));
    params.set("lng", filters.point.lng.toFixed(5));
    if (filters.place) params.set("place", filters.place);
    if (filters.radiusKm !== searchLimits.defaultRadiusKm) params.set("r", String(filters.radiusKm));
    if (filters.sort === "distance") params.set("sort", "distance");
  }
  return params;
}

const money = (cents: number, currency: string) =>
  new Intl.NumberFormat(formatLocale(), { style: "currency", currency, maximumFractionDigits: cents % 100 ? 2 : 0 }).format(
    cents / 100,
  );
const kilometres = (km: number) =>
  new Intl.NumberFormat(formatLocale(), { maximumFractionDigits: km < 10 ? 1 : 0 }).format(km);

/** Tarjeta de un resultado: toda ella enlaza al perfil (o lo abre en el panel con `onOpen`). */
function ResultCard({ card, onOpen }: { card: ProviderCard; onOpen?: (card: ProviderCard) => void }) {
  const place = [card.city, card.region].filter(Boolean).join(", ");
  const body = (
    <>
      <span className="search-card-cover">
        {card.coverUrl && <img src={card.coverUrl} alt="" loading="lazy" width={480} height={360} />}
      </span>
      <span className="search-card-body">
        <strong className="search-card-name">{card.businessName}</strong>
        {card.headline && <span className="search-card-headline">{card.headline}</span>}
        <span className="search-card-tags">
          {card.categories.map((c) => (
            <span key={c}>{tr(providerCategoryLabels[c])}</span>
          ))}
        </span>
        {(place || card.distanceKm !== null) && (
          <span className="search-card-place">
            <MapPin size={14} aria-hidden="true" />
            {[place, card.distanceKm !== null ? tr("providerSearch.distance", { distance: kilometres(card.distanceKm) }) : ""]
              .filter(Boolean)
              .join(" · ")}
          </span>
        )}
        {card.priceFrom && (
          <span className="search-card-price">
            {tr("providerSearch.priceFrom", { price: money(card.priceFrom.fromCents, card.priceFrom.currency) })}
          </span>
        )}
      </span>
    </>
  );
  return (
    <li className="search-card">
      {onOpen ? (
        <button type="button" onClick={() => onOpen(card)}>
          {body}
        </button>
      ) : (
        <Link to={providerPath(card.slug, getLocale())}>{body}</Link>
      )}
    </li>
  );
}

type Status = "loading" | "ready" | "error" | "offline";

/**
 * Búsqueda de proveedores: texto, categorías con su número de resultados, ubicación (cerca de mí o
 * una ciudad buscada al pulsar), distancia y orden. Los filtros los guarda quien la usa (`filters`
 * y `onChange`): la página en la URL, el panel del evento en su estado.
 */
export function ProviderSearch({
  filters,
  onChange,
  onOpen,
  headingLevel = 2,
}: {
  filters: SearchFilters;
  onChange: (filters: SearchFilters) => void;
  onOpen?: (card: ProviderCard) => void;
  headingLevel?: 2 | 3;
}) {
  const { api, runtime } = useApp();
  const { locale } = useLocale();
  const ids = useId();
  const [draft, setDraft] = useState(filters.q),
    [city, setCity] = useState(""),
    [cities, setCities] = useState<GeoPlace[] | null>(null),
    [locating, setLocating] = useState(false),
    [locationError, setLocationError] = useState(""),
    [items, setItems] = useState<ProviderCard[]>([]),
    [facets, setFacets] = useState<ProviderSearchResult["facets"]["categories"]>({}),
    [next, setNext] = useState<string | null>(null),
    [status, setStatus] = useState<Status>("loading"),
    [error, setError] = useState(""),
    [more, setMore] = useState(false),
    [attempt, setAttempt] = useState(0);
  const Heading = headingLevel === 2 ? "h2" : "h3";
  useEffect(() => setDraft(filters.q), [filters.q]);

  const failure = useCallback((e: unknown) => {
    const offline = !(e instanceof ApiError) && typeof navigator !== "undefined" && navigator.onLine === false;
    setStatus(offline ? "offline" : "error");
    setError(offline ? "" : errorText(e));
  }, []);
  // Valores simples: el objeto `filters` puede ser nuevo en cada render con los mismos datos
  const categoryKey = filters.categories.join(","),
    lat = filters.point?.lat,
    lng = filters.point?.lng;
  const query = useCallback(
    (cursor?: string) =>
      api.searchProviders({
        q: filters.q,
        categories: categoryKey ? (categoryKey.split(",") as ProviderCategory[]) : [],
        point: lat !== undefined && lng !== undefined ? { lat, lng } : null,
        radiusKm: filters.radiusKm,
        sort: filters.sort,
        cursor,
      }),
    [api, filters.q, categoryKey, lat, lng, filters.radiusKm, filters.sort],
  );
  // biome-ignore lint/correctness/useExhaustiveDependencies: `attempt` repite la búsqueda («Intentar de nuevo») y `locale` la traduce
  useEffect(() => {
    let alive = true;
    setStatus("loading");
    setError("");
    query()
      .then((result) => {
        if (!alive) return;
        setItems(result.items);
        setNext(result.nextCursor);
        setFacets(result.facets.categories);
        setStatus("ready");
      })
      .catch((e) => alive && failure(e));
    return () => {
      alive = false;
    };
  }, [query, attempt, locale, failure]);

  const loadMore = async () => {
    if (!next) return;
    setMore(true);
    try {
      const result = await query(next);
      setItems((current) => [...current, ...result.items.filter((i) => !current.some((c) => c.slug === i.slug))]);
      setNext(result.nextCursor);
    } catch (e) {
      failure(e);
    } finally {
      setMore(false);
    }
  };

  const update = (patch: Partial<SearchFilters>) => onChange({ ...filters, ...patch });
  const submit = (e: FormEvent) => {
    e.preventDefault();
    // Dentro del panel del evento el diálogo va en un portal, pero React propaga el envío al
    // formulario del evento: sin esto, buscar lo guardaría
    e.stopPropagation();
    update({ q: draft.trim().slice(0, accountLimits.search) });
  };
  const toggle = (category: ProviderCategory) =>
    update({
      categories: filters.categories.includes(category)
        ? filters.categories.filter((c) => c !== category)
        : [...filters.categories, category],
    });
  const nearMe = async () => {
    if (!runtime.getPosition) return;
    setLocating(true);
    setLocationError("");
    try {
      const point = await runtime.getPosition();
      setCities(null);
      update({ point, place: "" });
    } catch {
      setLocationError(tr("location.locationDenied"));
    } finally {
      setLocating(false);
    }
  };
  const findCity = async () => {
    setLocating(true);
    setLocationError("");
    try {
      setCities(await api.geoSearch(city.trim()));
    } catch (e) {
      setLocationError(errorText(e));
    } finally {
      setLocating(false);
    }
  };
  const pickCity = (found: GeoPlace) => {
    setCities(null);
    setCity("");
    update({ point: { lat: found.lat, lng: found.lng }, place: found.label });
  };
  const filtered = filters.q.trim() !== "" || filters.categories.length > 0 || filters.point !== null;
  const wider = searchRadii.find((r) => r > filters.radiusKm);

  return (
    <div className="provider-search">
      <search className="provider-search-filters" aria-label={tr("providerSearch.filters")}>
      <form onSubmit={submit}>
        <div className="provider-search-query">
          <Field label={tr("providerSearch.queryLabel")}>
            <Input
              type="search"
              value={draft}
              maxLength={accountLimits.search}
              enterKeyHint="search"
              placeholder={tr("providerSearch.queryPlaceholder")}
              onChange={(e) => setDraft(e.target.value)}
            />
          </Field>
          <Button type="submit">
            <Search size={16} aria-hidden="true" />
            {tr("providerSearch.submit")}
          </Button>
        </div>

        <fieldset className="provider-search-categories">
          <legend>{tr("providerSearch.categories")}</legend>
          <ul>
            {providerCategories.map((c) => (
              <li key={c}>
                <label>
                  <input
                    type="checkbox"
                    checked={filters.categories.includes(c)}
                    aria-describedby={status === "ready" ? `${ids}-count-${c}` : undefined}
                    onChange={() => toggle(c)}
                  />
                  <span>{tr(providerCategoryLabels[c])}</span>
                  {status === "ready" && <small aria-hidden="true">{facets[c] ?? 0}</small>}
                </label>
                {/* Fuera de la etiqueta: el nombre de la casilla es solo la categoría; el número, su descripción */}
                {status === "ready" && (
                  <span id={`${ids}-count-${c}`} className="sr-only">
                    {tr("providerSearch.categoryCount", { count: facets[c] ?? 0 })}
                  </span>
                )}
              </li>
            ))}
          </ul>
        </fieldset>

        <fieldset className="provider-search-location">
          <legend>{tr("providerSearch.location")}</legend>
          {filters.point ? (
            <p className="provider-search-place" role="status">
              <MapPin size={16} aria-hidden="true" />
              {filters.place ? tr("providerSearch.near", { place: filters.place }) : tr("providerSearch.nearMyLocation")}
              <Button variant="link" size="inline" type="button" onClick={() => update({ point: null, place: "", sort: "relevance" })}>
                <X size={14} aria-hidden="true" />
                {tr("providerSearch.clearLocation")}
              </Button>
            </p>
          ) : (
            <div className="provider-search-place-tools">
              {runtime.getPosition && (
                <Button variant="outline" type="button" disabled={locating} onClick={nearMe}>
                  <LocateFixed size={16} aria-hidden="true" />
                  {tr("providerSearch.nearMe")}
                </Button>
              )}
              <div className="provider-search-city">
                <Field label={tr("providerSearch.cityLabel")}>
                  <Input
                    value={city}
                    maxLength={accountLimits.geoQuery}
                    autoComplete="address-level2"
                    placeholder={tr("providerSearch.cityPlaceholder")}
                    onChange={(e) => setCity(e.target.value)}
                    onKeyDown={(e) => {
                      // Enter busca la ciudad, no envía el formulario del texto
                      if (e.key === "Enter") {
                        e.preventDefault();
                        if (city.trim().length >= 3) void findCity();
                      }
                    }}
                  />
                </Field>
                <Button variant="outline" type="button" disabled={locating || city.trim().length < 3} onClick={findCity}>
                  {tr("providerSearch.findCity")}
                </Button>
              </div>
            </div>
          )}
          {locating && <p role="status">{tr("location.searching")}</p>}
          {locationError && (
            <p className="field-error" role="alert">
              {locationError}
            </p>
          )}
          {cities &&
            (cities.length ? (
              <div className="location-results">
                <p id={`${ids}-cities`}>{tr("providerSearch.chooseCity")}</p>
                <ul aria-labelledby={`${ids}-cities`}>
                  {cities.map((found) => (
                    <li key={`${found.lat},${found.lng}`}>
                      <button type="button" onClick={() => pickCity(found)}>
                        <MapPin size={15} aria-hidden="true" />
                        {found.label}
                      </button>
                    </li>
                  ))}
                </ul>
                <small>{tr("location.attribution")}</small>
              </div>
            ) : (
              <p role="status">{tr("providerSearch.noCities")}</p>
            ))}
          {filters.point && (
            <div className="provider-search-selects">
              <Field label={tr("providerSearch.radius")}>
                <NativeSelect value={filters.radiusKm} onChange={(e) => update({ radiusKm: Number(e.target.value) })}>
                  {searchRadii.map((km) => (
                    <option key={km} value={km}>
                      {tr("providerSearch.radiusOption", { km })}
                    </option>
                  ))}
                </NativeSelect>
              </Field>
              <Field label={tr("providerSearch.sort")}>
                <NativeSelect value={filters.sort} onChange={(e) => update({ sort: e.target.value as SearchSort })}>
                  <option value="relevance">{tr("providerSearch.sortRelevance")}</option>
                  <option value="distance">{tr("providerSearch.sortDistance")}</option>
                </NativeSelect>
              </Field>
            </div>
          )}
        </fieldset>
      </form>
      </search>

      <section className="provider-search-results" aria-labelledby={`${ids}-results`} aria-busy={status === "loading"}>
        <Heading id={`${ids}-results`}>
          {tr("providerSearch.results")}
        </Heading>
        {status === "loading" ? (
          <>
            <p className="sr-only" role="status">
              {tr("common.loading")}
            </p>
            <ul className="search-card-grid" aria-hidden="true">
              {Array.from({ length: 6 }, (_, i) => (
                // biome-ignore lint/suspicious/noArrayIndexKey: marcadores fijos de la carga, sin datos
                <li key={i} className="search-card search-card-skeleton">
                  <span className="search-card-cover" />
                  <span className="search-card-body">
                    <span />
                    <span />
                  </span>
                </li>
              ))}
            </ul>
          </>
        ) : status === "offline" ? (
          <div className="provider-search-state" role="status">
            <WifiOff size={28} aria-hidden="true" />
            <p>{tr("providerSearch.offline")}</p>
            <Button variant="outline" type="button" onClick={() => setAttempt((n) => n + 1)}>
              {tr("app.tryAgain")}
            </Button>
          </div>
        ) : status === "error" ? (
          <div className="provider-search-state" role="alert">
            <p>{error}</p>
            <Button variant="outline" type="button" onClick={() => setAttempt((n) => n + 1)}>
              {tr("app.tryAgain")}
            </Button>
          </div>
        ) : items.length === 0 ? (
          <div className="provider-search-state" role="status">
            <SearchX size={28} aria-hidden="true" />
            <p className="provider-search-empty-title">{tr("providerSearch.emptyTitle")}</p>
            <p>{filtered ? tr("providerSearch.emptyHint") : tr("providerSearch.emptyNone")}</p>
            <div className="button-group">
              {filters.point && wider && (
                <Button variant="outline" type="button" onClick={() => update({ radiusKm: wider })}>
                  {tr("providerSearch.widenRadius", { km: wider })}
                </Button>
              )}
              {filtered && (
                <Button variant="outline" type="button" onClick={() => onChange(emptyFilters)}>
                  {tr("providerSearch.clearFilters")}
                </Button>
              )}
            </div>
          </div>
        ) : (
          <>
            <ul className="search-card-grid">
              {items.map((card) => (
                <ResultCard key={card.slug} card={card} onOpen={onOpen} />
              ))}
            </ul>
            {next && (
              <div className="provider-search-more">
                <Button variant="outline" type="button" disabled={more} onClick={loadMore}>
                  {more ? tr("common.loading") : tr("providerSearch.loadMore")}
                </Button>
              </div>
            )}
          </>
        )}
      </section>
    </div>
  );
}

/** Página pública /proveedores (y sus traducciones): cualquiera busca, con o sin cuenta. */
export function ProviderSearchPage() {
  const [params, setParams] = useSearchParams();
  const { locale } = useLocale();
  // biome-ignore lint/correctness/useExhaustiveDependencies: el título cambia con el idioma
  useEffect(() => {
    document.title = tr("providerSearch.seoTitle");
  }, [locale]);
  // Copia local: el router aplica la URL nueva en una transición y una casilla controlada
  // volvería un instante a su valor anterior. La URL manda al navegar (atrás y adelante).
  const fromUrl = useMemo(() => filtersFromParams(params), [params]);
  const [filters, setFilters] = useState(fromUrl);
  useEffect(() => setFilters(fromUrl), [fromUrl]);
  return (
    <SiteLayout>
    <div className="provider-page provider-search-page">
      <div>
        <Link to="/" className="text-link">
          <ArrowLeft size={16} aria-hidden="true" />
          {tr("common.backHome")}
        </Link>
        <p className="eyebrow">{tr("site.providersHeroEyebrow")}</p>
        <h1>{tr("providerSearch.title")}</h1>
        <p className="provider-headline">{tr("providerSearch.intro")}</p>
        <ProviderSearch
          filters={filters}
          onChange={(f) => {
            setFilters(f);
            setParams(filtersToParams(f));
          }}
        />
        <aside className="provider-own">
          <p>{tr("providerPage.ownBusiness")}</p>
          <Button asChild variant="outline">
            <Link to="/registro?tipo=proveedor">{tr("providerPage.ownBusinessLink")}</Link>
          </Button>
        </aside>
      </div>
    </div>
    </SiteLayout>
  );
}
