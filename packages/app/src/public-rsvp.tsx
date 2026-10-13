import { tr, LanguageSwitcher } from "./i18n";
import { useState, useEffect } from "react";
import { Link, useParams } from "react-router-dom";
import {
  Check,
  X,
  Clock,
  CalendarDays,
  MapPin,
  Heart,
  ArrowRight,
  CheckCircle2,
  ExternalLink,
} from "lucide-react";
import {
  rsvpSchema,
  type PublicInvitation,
  type Status,
} from "@tuevento/contracts";
import { useApp, errorText, dateText } from "./context";
import { Logo, InvitationArt, Avatar, ErrorBox } from "./components";
export function PublicRsvp() {
  const { token } = useParams(),
    { api } = useApp(),
    [invitation, setInvitation] = useState<PublicInvitation | null>(null),
    [statuses, setStatuses] = useState<Record<string, Status>>({}),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [saved, setSaved] = useState(false),
    [loading, setLoading] = useState(true);
  useEffect(() => {
    api
      .publicInvitation(token!)
      .then((data) => {
        setInvitation(data);
        setStatuses(
          Object.fromEntries(data.members.map((m) => [m.id, m.status])),
        );
      })
      .catch((e) => setError(errorText(e)))
      .finally(() => setLoading(false));
  }, [token]);
  const save = async () => {
    setBusy(true);
    setError("");
    try {
      const data = rsvpSchema.parse({
        members: invitation!.members.map((m) => ({
          id: m.id,
          status: statuses[m.id],
        })),
      });
      setInvitation(await api.rsvp(token!, data.members));
      setSaved(true);
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  };
  if (loading)
    return (
      <div className="startup">
        <Logo />
        <p role="status">{tr("Abriendo tu invitación…")}</p>
      </div>
    );
  if (!invitation)
    return (
      <div className="startup">
        <Logo />
        <h1>{tr("No encontramos tu invitación")}</h1>
        <ErrorBox message={error} />
        <p>{tr("Pide al anfitrión que te comparta de nuevo su enlace.")}</p>
        <Link className="button secondary" to="/registro">
          {tr("Crear mi propio evento")}
        </Link>
      </div>
    );
  const event = invitation.event;
  return (
    <div className="public-page">
      <header className="public-header">
        <Logo />
        <LanguageSwitcher />
        <span>{tr("Un buen motivo para estar juntos.")}</span>
      </header>
      {invitation.isDemo && (
        <div className="public-demo">
          {tr(
            "Invitación de demostración · Los nombres y datos son de ejemplo.",
          )}
        </div>
      )}
      <main className="rsvp-layout">
        <section className="public-art">
          <InvitationArt
            event={event}
            name={tr("Para {{name}}", { name: invitation.name })}
            large
          />
          <div className="host-signature">
            <Avatar user={invitation.host} />
            <div>
              <small>{tr("Con mucho cariño,")}</small>
              <strong>
                {invitation.host.firstName} {invitation.host.lastName}
              </strong>
            </div>
            <Heart size={22} />
          </div>
        </section>
        <section className="rsvp-content">
          <span className="rsvp-heart">
            <Heart size={24} />
          </span>
          <h1>{tr("Sin ti, no es lo mismo.")}</h1>
          <p className="rsvp-greeting">
            {tr("Hola,") + " "}
            <strong>{invitation.name}</strong>
            {tr(". Nos encantará compartir este momento contigo.")}
          </p>
          <div className="rsvp-details">
            <div>
              <CalendarDays size={21} />
              <p>
                <strong>
                  {dateText(event.date, event.timeZone, {
                    weekday: "long",
                    day: "numeric",
                    month: "long",
                    year: "numeric",
                  })}
                </strong>
                <span>
                  {dateText(event.date, event.timeZone, {
                    hour: "numeric",
                    minute: "2-digit",
                  })}{" "}
                  ·{" "}
                  {event.timeZone.replace("America/", "").replaceAll("_", " ")}
                </span>
              </p>
            </div>
            <div>
              <MapPin size={21} />
              <p>
                <strong>{event.location}</strong>
                <a
                  target="_blank"
                  rel="noreferrer"
                  href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(event.location)}`}
                >
                  {tr("Ver ubicación")}
                  <ExternalLink size={13} />
                </a>
              </p>
            </div>
          </div>
          {event.description && (
            <p className="host-message">{event.description}</p>
          )}
          <div className="rsvp-form">
            <h2>{tr("¿Nos acompañas?")}</h2>
            <p>
              {invitation.members.length > 1
                ? tr("Confirma la asistencia de cada integrante.")
                : tr(
                    "Elige tu respuesta y guárdala. Puedes cambiarla después.",
                  )}
            </p>
            {invitation.members.length > 1 && (
              <button
                className="text-button"
                onClick={() => {
                  setStatuses(
                    Object.fromEntries(
                      invitation.members.map((m) => [m.id, "accepted"]),
                    ),
                  );
                  setSaved(false);
                }}
              >
                <CheckCheckIcon />
                {tr("Todos asistirán")}
              </button>
            )}
            <div className="rsvp-members">
              {invitation.members.map((m) => (
                <fieldset className="rsvp-member" key={m.id}>
                  <legend>
                    {m.name}
                    <small>
                      {m.kind === "child" ? tr("Niño") : tr("Adulto")}
                    </small>
                  </legend>
                  <div className="rsvp-options">
                    {(
                      [
                        {
                          value: "accepted",
                          label: tr("¡Sí, asistiré!"),
                          icon: Check,
                        },
                        {
                          value: "declined",
                          label: tr("No podré ir"),
                          icon: X,
                        },
                        {
                          value: "pending",
                          label: tr("En espera"),
                          icon: Clock,
                        },
                      ] as const
                    ).map(({ value, label, icon: Icon }) => (
                      <button
                        type="button"
                        key={value}
                        className={`${value} ${statuses[m.id] === value ? "selected" : ""}`}
                        aria-pressed={statuses[m.id] === value}
                        onClick={() => {
                          setStatuses((s) => ({ ...s, [m.id]: value }));
                          setSaved(false);
                        }}
                      >
                        <Icon size={17} />
                        {label}
                      </button>
                    ))}
                  </div>
                </fieldset>
              ))}
            </div>
            {error && <ErrorBox message={error} />}{" "}
            {saved && (
              <div className="success-box" role="status">
                <CheckCircle2 size={23} />
                <div>
                  <strong>{tr("¡Tu respuesta está guardada!")}</strong>
                  <span>
                    {tr(
                      "Tu anfitrión ya puede verla. Puedes modificarla cuando lo necesites.",
                    )}
                  </span>
                </div>
              </div>
            )}
            <button
              className="button full"
              onClick={save}
              disabled={busy || saved}
            >
              {busy
                ? tr("Guardando tu respuesta…")
                : saved
                  ? tr("Respuesta guardada")
                  : tr("Guardar mi respuesta")}
              <Check size={18} />
            </button>
            <small className="rsvp-no-account">
              {tr("Sin registros. Solo las ganas de compartir el momento.")}
            </small>
          </div>
        </section>
      </main>
      <section className="public-cta">
        <div>
          <h2>{tr("Ahora, el motivo lo pones tú.")}</h2>
          <p>
            {tr("Crea una invitación especial para tu próxima celebración.")}
          </p>
        </div>
        <Link className="button" to="/registro">
          {tr("Crear mi propio evento")}
          <ArrowRight size={17} />
        </Link>
      </section>
      <footer className="public-footer">
        {tr("Con cariño y TuEventoFun") + " "}
        <Heart size={13} />
      </footer>
    </div>
  );
}
const CheckCheckIcon = () => <CheckCircle2 size={16} />;
