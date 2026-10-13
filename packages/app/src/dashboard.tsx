import { tr } from "./i18n";
import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  Plus,
  ArrowRight,
  ArrowUpRight,
  CalendarDays,
  Check,
  CheckCheck,
  Clock,
  Search,
  SlidersHorizontal,
  Mail,
  Users,
  Heart,
  PartyPopper,
  MapPin,
  Sparkles,
} from "lucide-react";
import {
  themes,
  emptyMetrics,
  type Metrics,
  type Invitation,
  type Event,
} from "@tuevento/contracts";
import { useApp, dateText, errorText } from "./context";
import {
  Stats,
  EventCard,
  Empty,
  SectionHeading,
  ArrowLink,
  ErrorBox,
  InvitationArt,
  Modal,
} from "./components";
export function Dashboard() {
  const { user, events, notifications } = useApp();
  const active = events.filter(
    (e) => !e.archived && new Date(e.date) >= new Date(),
  );
  const metrics = active.reduce((sum, e) => {
    for (const key of Object.keys(sum) as (keyof Metrics)[])
      sum[key] += e.metrics[key];
    return sum;
  }, emptyMetrics());
  return (
    <>
      <div className="page-heading">
        <div>
          <p className="greeting">
            {tr("Hola,") + " "}
            {user?.firstName}{" "}
            <span className="greeting-spark">
              <Sparkles size={16} />
            </span>
          </p>
          <h1>{tr("La vida se celebra juntos.")}</h1>
          <p>
            {tr(
              "Un espacio para tus planes y las personas que los hacen especiales.",
            )}
          </p>
        </div>
        <Link to="/eventos/nuevo" className="button">
          <Plus size={18} />
          {tr("Crear evento")}
        </Link>
      </div>
      {user?.isDemo && (
        <div className="demo-notice" role="note">
          <p>
            {tr(
              "Estás explorando una demostración. Los eventos y sus datos son de ejemplo.",
            )}
          </p>
          <Link to="/registro">
            {tr("Crear mi cuenta")}
            <ArrowRight size={16} />
          </Link>
        </div>
      )}
      <section className="welcome-banner">
        <div className="welcome-copy">
          <h2>
            {tr("Tú imagina el momento.")}
            <br />
            {tr("Nosotros te ayudamos")}
            <br />
            {tr("a reunirlos.")}
          </h2>
          <p>
            {tr("Invitaciones con tu estilo. Todos tus invitados.")} <br />
            {tr("Y cada detalle, en su lugar.")}
          </p>
          <Link to="/disenos" className="button pink">
            {tr("Encuentra tu invitación") + " "}
            <ArrowUpRight size={18} />
          </Link>
        </div>
        <div className="welcome-photo">
          <img
            src="/images/gold.jpg"
            alt={tr(
              "Mesa festiva con flores coloridas y copas listas para celebrar",
            )}
            fetchPriority="high"
          />
          <div className="photo-note">
            <span>
              <Heart size={19} />
            </span>
            <div>
              <strong>{tr("Los detalles hacen la fiesta.")}</strong>
              <small>{tr("Lo importante es estar juntos.")}</small>
            </div>
          </div>
        </div>
        <div className="banner-flower" aria-hidden="true">
          <Sparkles size={40} />
        </div>
      </section>
      <div className="summary-label">
        <h2>{tr("Así van tus celebraciones")}</h2>
        <span>
          <span className="dot accepted" />
          {tr("Actualizado en vivo")}
        </span>
      </div>
      <Stats metrics={metrics} />
      <section className="events-section">
        <SectionHeading title={tr("Tus próximos eventos")}>
          <ArrowLink to="/eventos">
            {tr("Ver todos") + " "}
            <span className="count-inline">{active.length}</span>
          </ArrowLink>
        </SectionHeading>
        {active.length ? (
          <div className="event-grid">
            {active.slice(0, 3).map((e) => (
              <EventCard key={e.id} event={e} />
            ))}
          </div>
        ) : (
          <Empty
            title={tr("Tu próxima historia empieza aquí")}
            action={
              <Link className="button" to="/eventos/nuevo">
                <Plus size={17} />
                {tr("Crear mi primer evento")}
              </Link>
            }
          >
            {tr(
              "Elige una fecha, invita a tus personas favoritas y deja que empiece la celebración.",
            )}
          </Empty>
        )}
      </section>
      <div className="dashboard-lower">
        <section className="activity-section">
          <SectionHeading title={tr("Las últimas noticias")}>
            <ArrowLink to="/notificaciones">{tr("Ver actividad")}</ArrowLink>
          </SectionHeading>
          {notifications.length ? (
            <div className="activity-list">
              {notifications.slice(0, 3).map((n) => (
                <Link
                  key={n.id}
                  to={`/eventos/${n.eventId}`}
                  className="activity-row"
                >
                  <span className="activity-icon">
                    <Check size={16} />
                  </span>
                  <div>
                    <strong>{n.guestName}</strong>
                    <p>{n.message}</p>
                    <small>{n.eventTitle}</small>
                  </div>
                  <time>
                    {dateText(n.createdAt, undefined, {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </time>
                </Link>
              ))}
            </div>
          ) : (
            <p className="muted empty-small">
              {tr("Cuando alguien responda, aquí te enterarás primero.")}
            </p>
          )}
        </section>
        <section className="inspiration-strip">
          <div>
            <span className="tiny-flowers">
              <PartyPopper size={25} />
            </span>
            <h2>
              {tr("Cada fiesta tiene")}
              <br />
              {tr("su propia personalidad.")}
            </h2>
            <p>
              {tr("Descubre nuestros 6 diseños y encuentra")}
              <br />
              {tr("ese que se siente tan tú.")}
            </p>
            <ArrowLink to="/disenos">{tr("Explorar diseños")}</ArrowLink>
          </div>
          <div className="mini-invites" aria-hidden="true">
            <div className="mini-invite mint">
              <Heart size={24} />
              <strong>
                {tr("Un sí,")}
                <br />
                {tr("para siempre.")}
              </strong>
              <span>Sofía & Alejandro</span>
            </div>
            <div className="mini-invite rose">
              <PartyPopper size={23} />
              <strong>
                {tr("¡Hoy se")}
                <br />
                {tr("celebra!")}
              </strong>
              <span>{tr("Que empiece lo bueno")}</span>
            </div>
          </div>
        </section>
      </div>
    </>
  );
}
export function EventsPage() {
  const { events } = useApp();
  const [filter, setFilter] = useState("active"),
    [search, setSearch] = useState("");
  const filtered = events.filter(
    (e) =>
      (filter === "archived"
        ? e.archived
        : filter === "past"
          ? !e.archived && new Date(e.date) < new Date()
          : !e.archived && new Date(e.date) >= new Date()) &&
      e.title.toLowerCase().includes(search.toLowerCase()),
  );
  return (
    <>
      <div className="page-heading">
        <div>
          <h1>{tr("Mis eventos")}</h1>
          <p>
            {tr("Cada celebración, con todos sus detalles en un solo lugar.")}
          </p>
        </div>
        <Link className="button" to="/eventos/nuevo">
          <Plus size={18} />
          {tr("Crear evento")}
        </Link>
      </div>
      <div className="list-toolbar">
        <div className="tabs" aria-label={tr("Filtrar eventos")}>
          {[
            ["active", tr("Próximos")],
            ["past", tr("Pasados")],
            ["archived", tr("Archivados")],
          ].map(([id, label]) => (
            <button
              className={filter === id ? "active" : ""}
              key={id}
              onClick={() => setFilter(id)}
              aria-pressed={filter === id}
            >
              {label}
            </button>
          ))}
        </div>
        <label className="search-field">
          <Search size={18} />
          <input
            placeholder={tr("Buscar un evento")}
            aria-label={tr("Buscar un evento")}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </label>
      </div>
      {filtered.length ? (
        <div className="event-grid">
          {filtered.map((e) => (
            <EventCard key={e.id} event={e} />
          ))}
        </div>
      ) : (
        <Empty
          title={tr("Nada por aquí todavía")}
          action={
            filter === "active" ? (
              <Link to="/eventos/nuevo" className="button">
                {tr("Crear evento")}
              </Link>
            ) : undefined
          }
        >
          {tr("Prueba otra búsqueda o prepara una nueva celebración.")}
        </Empty>
      )}
    </>
  );
}
export function TemplatesPage() {
  const [preview, setPreview] = useState<(typeof themes)[number] | null>(null);
  return (
    <>
      <div className="page-heading">
        <div>
          <h1>{tr("Invitaciones con personalidad.")}</h1>
          <p>
            {tr("Seis formas de decir «quiero que estés ahí». Elige la tuya.")}
          </p>
        </div>
        <span className="soft-label">
          <PaletteIcon />
          {tr("6 diseños para celebrar")}
        </span>
      </div>
      <div className="templates-grid">
        {themes.map((t) => (
          <article className={`template-card theme-${t.id}`} key={t.id}>
            <button
              className="template-preview"
              onClick={() => setPreview(t)}
              aria-label={tr("Vista previa de {{theme}}", {
                theme: tr(t.name),
              })}
            >
              <InvitationArt
                event={{
                  title:
                    t.id === "floral"
                      ? tr("Un sí para siempre")
                      : t.id === "kids"
                        ? tr("¡A soplar las velitas!")
                        : t.id === "neon"
                          ? tr("Esta noche es nuestra")
                          : t.id === "tropical"
                            ? tr("Bajo el mismo sol")
                            : t.id === "gold"
                              ? tr("Una noche inolvidable")
                              : tr("Celebremos lo simple"),
                  date: "2026-12-12T23:00:00Z",
                  timeZone: "America/Mexico_City",
                  location: tr("Un lugar especial"),
                  theme: t.id,
                }}
              />
            </button>
            <div className="template-caption">
              <div>
                <h2>{tr(t.name)}</h2>
                <p>{tr(t.description)}</p>
              </div>
              <Link
                className="icon-button"
                to={`/eventos/nuevo?tema=${t.id}`}
                aria-label={tr("Usar {{theme}}", { theme: tr(t.name) })}
              >
                <ArrowUpRight size={23} />
              </Link>
            </div>
          </article>
        ))}
      </div>
      {preview && (
        <Modal title={tr(preview.name)} onClose={() => setPreview(null)}>
          <InvitationArt
            event={{
              title: tr("Tu próxima gran celebración"),
              date: "2026-12-12T23:00:00Z",
              timeZone: "America/Mexico_City",
              location: tr("El lugar que tú elijas"),
              theme: preview.id,
            }}
          />
          <p className="muted">
            {tr(
              "Personaliza el nombre, la fecha y los detalles de tu celebración.",
            )}
          </p>
          <Link
            className="button full"
            to={`/eventos/nuevo?tema=${preview.id}`}
          >
            {tr("Crear evento con este diseño")}
            <ArrowRight size={17} />
          </Link>
        </Modal>
      )}
    </>
  );
}
const PaletteIcon = () => <Sparkles size={16} />;
export function NotificationsPage() {
  const { api, notifications, reload, toast } = useApp();
  const [onlyUnread, setOnlyUnread] = useState(false),
    [busy, setBusy] = useState(false);
  const mark = async () => {
    setBusy(true);
    try {
      await api.readNotifications();
      await reload();
      toast(tr("Notificaciones marcadas como leídas."));
    } catch (e) {
      toast(errorText(e));
    } finally {
      setBusy(false);
    }
  };
  const list = notifications.filter((n) => !onlyUnread || !n.read);
  return (
    <>
      <div className="page-heading">
        <div>
          <h1>{tr("Las buenas noticias llegan aquí.")}</h1>
          <p>{tr("Respuestas y cambios de asistencia de tus invitados.")}</p>
        </div>
        <button
          className="button secondary"
          disabled={busy || !notifications.some((n) => !n.read)}
          onClick={mark}
        >
          <CheckCheck size={18} />
          {tr("Marcar todas como leídas")}
        </button>
      </div>
      <div className="tabs">
        <button
          className={!onlyUnread ? "active" : ""}
          onClick={() => setOnlyUnread(false)}
        >
          {tr("Todas")}
        </button>
        <button
          className={onlyUnread ? "active" : ""}
          onClick={() => setOnlyUnread(true)}
        >
          {tr("Sin leer (")}
          {notifications.filter((n) => !n.read).length})
        </button>
      </div>
      {list.length ? (
        <div className="notification-list">
          {list.map((n) => (
            <Link
              className={`notification-row ${!n.read ? "unread" : ""}`}
              to={`/eventos/${n.eventId}`}
              key={n.id}
            >
              <span className="activity-icon">
                <Mail size={20} />
              </span>
              <div>
                <h3>{n.guestName}</h3>
                <p>{n.message}</p>
                <small>{n.eventTitle}</small>
              </div>
              <time dateTime={n.createdAt}>
                {dateText(n.createdAt, undefined, {
                  day: "numeric",
                  month: "short",
                  hour: "2-digit",
                  minute: "2-digit",
                  second: "2-digit",
                })}
              </time>
              {!n.read && (
                <span className="dot accepted" aria-label={tr("Sin leer")} />
              )}
            </Link>
          ))}
        </div>
      ) : (
        <Empty title={tr("Todo al día")}>
          {tr("Las nuevas respuestas aparecerán aquí automáticamente.")}
        </Empty>
      )}
    </>
  );
}
export function AllGuests() {
  const { api, events, toast } = useApp();
  const [rows, setRows] = useState<
      (Invitation & {
        event: Event;
      })[]
    >([]),
    [search, setSearch] = useState(""),
    [loading, setLoading] = useState(true);
  useEffect(() => {
    let active = true;
    Promise.all(
      events.map(async (event) =>
        (await api.invitations(event.id)).map((i) => ({ ...i, event })),
      ),
    )
      .then((data) => {
        if (active) setRows(data.flat());
      })
      .catch((e) => toast(errorText(e)))
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [events, api]);
  const filtered = rows.filter((i) =>
    (i.name + " " + i.members.map((m) => m.name).join(" "))
      .toLowerCase()
      .includes(search.toLowerCase()),
  );
  return (
    <>
      <div className="page-heading">
        <div>
          <h1>{tr("Tus personas favoritas.")}</h1>
          <p>
            {tr(
              "Consulta todas tus invitaciones y abre un evento para administrarlas.",
            )}
          </p>
        </div>
        <span className="soft-label">
          <Users size={17} />
          {rows.reduce((n, i) => n + i.members.length, 0)}
          {" " + tr("personas invitadas")}
        </span>
      </div>
      <label className="search-field standalone">
        <Search size={18} />
        <input
          placeholder={tr("Buscar persona o familia")}
          aria-label={tr("Buscar persona o familia")}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </label>
      {loading ? (
        <p role="status">{tr("Cargando invitados…")}</p>
      ) : filtered.length ? (
        <div className="guest-directory">
          {filtered.map((i) => (
            <Link key={i.id} to={`/eventos/${i.event.id}`}>
              <span className="initial-avatar">
                {i.name.slice(0, 2).toUpperCase()}
              </span>
              <div>
                <strong>{i.name}</strong>
                <span>{i.event.title}</span>
              </div>
              <span className="directory-members">
                {i.members.length}{" "}
                {i.members.length === 1 ? tr("persona") : tr("personas")}
              </span>
              <ArrowUpRight size={18} />
            </Link>
          ))}
        </div>
      ) : (
        <Empty
          title={tr("Hagamos la lista")}
          action={
            <Link className="button" to="/eventos">
              {tr("Ir a mis eventos")}
            </Link>
          }
        >
          {tr("Añade a tus invitados desde cada evento y encuéntralos aquí.")}
        </Empty>
      )}
    </>
  );
}
export function HelpPage() {
  return (
    <>
      <div className="page-heading">
        <div>
          <h1>{tr("De la idea a la fiesta.")}</h1>
          <p>
            {tr("Todo lo que necesitas para empezar a reunir a los tuyos.")}
          </p>
        </div>
      </div>
      <div className="help-content">
        <section>
          <h2>{tr("1. Dale forma a tu evento")}</h2>
          <p>
            {tr(
              "Elige «Crear evento», completa fecha, hora, zona horaria y lugar, y selecciona uno de los seis diseños. Puedes editarlo después.",
            )}
          </p>
          <Link className="text-link" to="/eventos/nuevo">
            {tr("Crear mi evento")}
            <ArrowRight size={16} />
          </Link>
        </section>
        <section>
          <h2>{tr("2. Prepara tu lista")}</h2>
          <p>
            {tr(
              "Dentro del evento, añade invitaciones individuales o familiares. Cada integrante tiene su nombre, clasificación de adulto o niño y notas privadas para ti. Las notas no aparecen en la invitación pública.",
            )}
          </p>
        </section>
        <section>
          <h2>{tr("3. Comparte su invitación")}</h2>
          <p>
            {tr(
              "Cada invitación tiene un enlace único. Cópialo o abre WhatsApp o tu cliente de correo con el mensaje preparado. Tú decides cuándo enviarlo. Cualquier persona que reciba el enlace puede ver y responder esa invitación; compártelo únicamente con sus destinatarios.",
            )}
          </p>
        </section>
        <section>
          <h2>{tr("4. Recibe sus respuestas")}</h2>
          <p>
            {tr(
              "No necesitan crear una cuenta. Pueden confirmar, declinar o dejar su respuesta en espera por cada persona. Tus métricas y notificaciones se actualizan automáticamente. Abre «Modo pantalla» desde un evento para consultar el tablero en el recinto.",
            )}
          </p>
        </section>
        <section>
          <h2>{tr("Tu espacio de demostración")}</h2>
          <p>
            {tr(
              "Los nombres, eventos y lugares de la demostración son ejemplos. Puedes probar todos los flujos sin afectar a otras cuentas. Regístrate para empezar con un espacio vacío y tus propios datos.",
            )}
          </p>
          <Link className="text-link" to="/registro">
            {tr("Crear mi cuenta")}
            <ArrowRight size={16} />
          </Link>
        </section>
      </div>
    </>
  );
}
