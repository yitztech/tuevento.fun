import { tr, LanguageSwitcher, Lines } from "./i18n";
import { useState, useEffect, type FormEvent } from "react";
import { Link, Navigate, useParams } from "react-router-dom";
import { Heart, CalendarDays, MapPin, Lock, LayoutDashboard } from "lucide-react";
import {
  eventLandingPath,
  googleCalendarUrl,
  mapLinks,
  type EventLanding as EventLandingView,
  type LandingAddress,
  type PublicEvent,
} from "@tuevento/contracts";
import { ApiError } from "@tuevento/client";
import { useApp, errorText, dateText } from "./context";
import { Logo, Avatar, ErrorBox } from "./components";
import { MapLinks, MapView } from "./location";
import { PostcardCanvas } from "./postcard-canvas";
import { CalendarLinks } from "./calendar-links";
import { PublicRsvp } from "./public-rsvp";

/** Fuera de los buscadores: la landing es solo para los invitados y el organizador. */
function useNoIndex() {
  useEffect(() => {
    const robots = document.createElement("meta");
    robots.name = "robots";
    robots.content = "noindex";
    document.head.append(robots);
    return () => robots.remove();
  }, []);
}

/**
 * Landing del evento (/<código>/<dirección>). El organizador la ve con el enlace a su panel; un
 * invitado que entró con su enlace personal, con su invitación para responder; y con contraseña,
 * quien la acierte. Sin acceso, solo un aviso de que es para invitados.
 */
export function EventLanding() {
  const { code, slug } = useParams(),
    { api } = useApp(),
    [landing, setLanding] = useState<EventLandingView | null>(null),
    [error, setError] = useState(""),
    [guestsOnly, setGuestsOnly] = useState(false),
    [loading, setLoading] = useState(true);
  useNoIndex();
  const load = () =>
    api
      .landing(code!, slug!)
      .then((data) => {
        setLanding(data);
        setError("");
      })
      .catch((e) => {
        setGuestsOnly(e instanceof ApiError && e.status === 404);
        setError(errorText(e));
      })
      .finally(() => setLoading(false));
  useEffect(() => {
    setLoading(true);
    void load();
  }, [code, slug]);
  if (loading)
    return (
      <div className="startup">
        <Logo />
        <p role="status">{tr("publicEvent.opening")}</p>
      </div>
    );
  if (!landing)
    return guestsOnly ? (
      <div className="startup">
        <Logo />
        <Lock size={28} />
        <h1>{tr("eventLanding.guestsOnlyTitle")}</h1>
        <p>{tr("eventLanding.guestsOnlyText")}</p>
        <Link className="button secondary" to="/registro">
          {tr("rsvp.createOwnEvent")}
        </Link>
      </div>
    ) : (
      <div className="startup">
        <Logo />
        <h1>{tr("publicEvent.unavailable")}</h1>
        <ErrorBox message={error} />
      </div>
    );
  if (landing.access === "guest")
    return (
      <>
        {landing.eventId && <OwnerBar eventId={landing.eventId} />}
        <PublicRsvp token={landing.token} />
      </>
    );
  if (landing.access === "locked") return <PasswordGate code={code!} slug={slug!} onUnlocked={load} />;
  return (
    <EventView
      event={landing.event}
      icsHref={`/api/public/landing/${code}/${slug}/calendar.ics`}
      ownerEventId={landing.access === "owner" ? landing.eventId : undefined}
    />
  );
}

/** Las direcciones /e/<dirección> de antes de la landing llevan a ella. */
export function LegacyEventAddress() {
  const { slug } = useParams(),
    { api } = useApp(),
    [address, setAddress] = useState<LandingAddress | null>(null),
    [error, setError] = useState("");
  useNoIndex();
  useEffect(() => {
    api
      .legacyEventAddress(slug!)
      .then(setAddress)
      .catch((e) => setError(errorText(e)));
  }, [slug]);
  if (address) return <Navigate to={eventLandingPath(address.code, address.slug)} replace />;
  return (
    <div className="startup">
      <Logo />
      {error ? (
        <>
          <h1>{tr("publicEvent.unavailable")}</h1>
          <ErrorBox message={error} />
          <Link className="button secondary" to="/registro">
            {tr("rsvp.createOwnEvent")}
          </Link>
        </>
      ) : (
        <p role="status">{tr("publicEvent.opening")}</p>
      )}
    </div>
  );
}

/** El organizador ve la landing como sus invitados, con el acceso a su panel. */
function OwnerBar({ eventId }: { eventId: string }) {
  return (
    <div className="landing-owner-bar">
      <p>{tr("eventLanding.ownerNote")}</p>
      <Link className="button" to={`/eventos/${eventId}`}>
        <LayoutDashboard size={17} />
        {tr("eventLanding.goToPanel")}
      </Link>
    </div>
  );
}

/** La postal y los datos del evento, sin invitados. */
function EventView({ event, icsHref, ownerEventId }: { event: PublicEvent; icsHref: string; ownerEventId?: string }) {
  const start = new Date(event.date);
  return (
    <div className="public-page">
      <header className="public-header">
        <Logo />
        <LanguageSwitcher />
        <span>{tr("rsvp.goodReasonTogether")}</span>
      </header>
      {ownerEventId && <OwnerBar eventId={ownerEventId} />}
      <main className="rsvp-layout">
        <section className="public-art">
          <PostcardCanvas design={event.postcard.design} photos={event.postcard.photos} />
          <div className="host-signature">
            <Avatar user={event.host} />
            <div>
              <small>{tr("publicEvent.hostedBy")}</small>
              <strong>
                {event.host.firstName} {event.host.lastName}
              </strong>
            </div>
            <Heart size={22} />
          </div>
        </section>
        <section className="rsvp-content">
          {event.cancelled && (
            <p className="event-cancelled-notice" role="status">
              {tr("publicEvent.cancelled")}
            </p>
          )}
          <h1 className="rsvp-event-title">{event.title}</h1>
          <p className="rsvp-detail">
            <CalendarDays size={18} />
            {dateText(event.date, event.timeZone, {
              weekday: "long",
              day: "numeric",
              month: "long",
              year: "numeric",
              hour: "2-digit",
              minute: "2-digit",
            })}
          </p>
          <p className="rsvp-detail">
            <MapPin size={18} />
            <a href={mapLinks({ label: event.location, geo: event.geo }).google} target="_blank" rel="noreferrer">
              {event.location}
            </a>
          </p>
          {event.geo && <MapView point={event.geo} label={event.location} />}
          <MapLinks label={event.location} geo={event.geo} />
          {event.description && <p className="rsvp-description">{event.description}</p>}
          <CalendarLinks
            icsHref={icsHref}
            googleHref={googleCalendarUrl({
              title: event.title,
              description: event.description,
              start,
              location: event.location,
            })}
          />
          {!ownerEventId && (
            <p className="public-event-note">
              <Lines k="publicEvent.inviteHint" />
            </p>
          )}
        </section>
      </main>
    </div>
  );
}

/** Contraseña del evento; sin acertarla no se muestra nada de él. */
function PasswordGate({ code, slug, onUnlocked }: { code: string; slug: string; onUnlocked: () => void }) {
  const { api } = useApp(),
    [password, setPassword] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      await api.unlockLanding(code, slug, password);
      onUnlocked();
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="startup">
      <Logo />
      <Lock size={28} />
      <h1>{tr("publicEvent.lockedTitle")}</h1>
      <p>{tr("publicEvent.lockedText")}</p>
      <form className="password-gate" onSubmit={submit}>
        <label className="field">
          <span>{tr("publicEvent.passwordLabel")}</span>
          <input
            type="password"
            autoComplete="off"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </label>
        {error && <ErrorBox message={error} />}
        <button className="button full" disabled={busy || !password}>
          {tr("publicEvent.unlock")}
        </button>
      </form>
    </div>
  );
}
