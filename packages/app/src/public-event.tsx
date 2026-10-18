import { tr, LanguageSwitcher, Lines } from "./i18n";
import { useState, useEffect, type FormEvent } from "react";
import { Link, useParams } from "react-router-dom";
import { Heart, CalendarDays, MapPin, Lock } from "lucide-react";
import {
  googleCalendarUrl,
  mapsSearchUrl,
  type LockedPublicEvent,
  type PublicEvent as PublicEventView,
} from "@tuevento/contracts";
import { useApp, errorText, dateText } from "./context";
import { Logo, Avatar, ErrorBox } from "./components";
import { PostcardCanvas } from "./postcard-canvas";
import { CalendarLinks } from "./calendar-links";

/** Página pública de un evento con dirección propia (/e/:slug): la postal y los datos, sin invitados. */
export function PublicEvent() {
  const { slug } = useParams(),
    { api } = useApp(),
    [event, setEvent] = useState<PublicEventView | LockedPublicEvent | null>(null),
    [error, setError] = useState(""),
    [loading, setLoading] = useState(true);
  const load = () =>
    api
      .publicEvent(slug!)
      .then((data) => {
        setEvent(data);
        setError("");
      })
      .catch((e) => setError(errorText(e)))
      .finally(() => setLoading(false));
  useEffect(() => {
    setLoading(true);
    load();
  }, [slug]);
  // Página de evento privada por elección del organizador: fuera de los buscadores
  useEffect(() => {
    const robots = document.createElement("meta");
    robots.name = "robots";
    robots.content = "noindex";
    document.head.append(robots);
    return () => robots.remove();
  }, []);
  if (loading)
    return (
      <div className="startup">
        <Logo />
        <p role="status">{tr("publicEvent.opening")}</p>
      </div>
    );
  if (!event)
    return (
      <div className="startup">
        <Logo />
        <h1>{tr("publicEvent.unavailable")}</h1>
        <ErrorBox message={error} />
        <Link className="button secondary" to="/registro">
          {tr("rsvp.createOwnEvent")}
        </Link>
      </div>
    );
  if (event.locked) return <PasswordGate slug={slug!} onUnlocked={load} />;
  const start = new Date(event.date);
  return (
    <div className="public-page">
      <header className="public-header">
        <Logo />
        <LanguageSwitcher />
        <span>{tr("rsvp.goodReasonTogether")}</span>
      </header>
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
            <a href={mapsSearchUrl(event.location)} target="_blank" rel="noreferrer">
              {event.location}
            </a>
          </p>
          {event.description && <p className="rsvp-description">{event.description}</p>}
          <CalendarLinks
            icsHref={`/api/public/events/${slug}/calendar.ics`}
            googleHref={googleCalendarUrl({
              title: event.title,
              description: event.description,
              start,
              location: event.location,
            })}
          />
          <p className="public-event-note">
            <Lines k="publicEvent.inviteHint" />
          </p>
        </section>
      </main>
    </div>
  );
}

/** Contraseña para ver la página pública; sin acertarla no se muestra nada del evento. */
function PasswordGate({ slug, onUnlocked }: { slug: string; onUnlocked: () => void }) {
  const { api } = useApp(),
    [password, setPassword] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      await api.unlockEvent(slug, password);
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
