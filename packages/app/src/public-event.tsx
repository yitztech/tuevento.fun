import { tr, LanguageSwitcher, Lines } from "./i18n";
import { useState, useEffect } from "react";
import { Link, useParams } from "react-router-dom";
import { Heart, CalendarDays, MapPin } from "lucide-react";
import type { PublicEvent as PublicEventView } from "@tuevento/contracts";
import { useApp, errorText, dateText } from "./context";
import { Logo, Avatar, ErrorBox } from "./components";
import { PostcardCanvas } from "./postcard-canvas";

/** Página pública de un evento con dirección propia (/e/:slug): la postal y los datos, sin invitados. */
export function PublicEvent() {
  const { slug } = useParams(),
    { api } = useApp(),
    [event, setEvent] = useState<PublicEventView | null>(null),
    [error, setError] = useState(""),
    [loading, setLoading] = useState(true);
  useEffect(() => {
    api
      .publicEvent(slug!)
      .then(setEvent)
      .catch((e) => setError(errorText(e)))
      .finally(() => setLoading(false));
  }, [slug]);
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
            {event.location}
          </p>
          {event.description && <p className="rsvp-description">{event.description}</p>}
          <p className="public-event-note">
            <Lines k="publicEvent.inviteHint" />
          </p>
        </section>
      </main>
    </div>
  );
}
