import { tr } from "./i18n";
import {
  useEffect,
  useRef,
  useId,
  Children,
  cloneElement,
  isValidElement,
  type ReactNode,
  type ReactElement,
} from "react";
import { Link } from "react-router-dom";
import {
  PartyPopper,
  ArrowUpRight,
  CalendarDays,
  MapPin,
  ArrowRight,
  X,
  Check,
  Clock,
  Users,
  CheckCircle2,
  CircleHelp,
} from "lucide-react";
import {
  themes,
  type Event,
  type Metrics,
  type User,
} from "@tuevento/contracts";
import { dateText } from "./context";
export function Logo({
  compact = false,
  to = "/",
}: {
  compact?: boolean;
  to?: string;
}) {
  return (
    <Link to={to} className="logo" aria-label={tr("TuEventoFun, inicio")}>
      <span className="logo-mark">
        <PartyPopper size={23} />
      </span>
      {!compact && (
        <span>
          TuEvento<span className="logo-fun">Fun</span>
          <i />
        </span>
      )}
    </Link>
  );
}
export function Avatar({
  user,
  size = "",
}: {
  user: Pick<User, "firstName" | "lastName" | "avatar">;
  size?: string;
}) {
  return (
    <span className={`avatar ${size}`}>
      {user.avatar ? (
        <img src={user.avatar} alt={tr("Avatar del anfitrión")} />
      ) : (
        `${user.firstName[0] || ""}${user.lastName[0] || ""}`
      )}
    </span>
  );
}
export function Empty({
  title,
  children,
  action,
}: {
  title: string;
  children: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="empty">
      <span className="empty-icon">
        <PartyPopper size={30} />
      </span>
      <h2>{title}</h2>
      <p>{children}</p>
      {action}
    </div>
  );
}
export function ErrorBox({ message }: { message: string }) {
  return (
    <p className="error-box" role="alert">
      {tr(message)}
    </p>
  );
}
export function Field({
  label,
  error,
  children,
  hint,
}: {
  label: string;
  error?: string;
  children: ReactNode;
  hint?: string;
}) {
  const id = useId();
  const describe =
    [hint ? `${id}-hint` : null, error ? `${id}-error` : null]
      .filter(Boolean)
      .join(" ") || undefined;
  const connect = (nodes: ReactNode): ReactNode =>
    Children.map(nodes, (node) => {
      if (!isValidElement(node)) return node;
      const element = node as ReactElement<Record<string, unknown>>;
      if (
        typeof element.type === "string" &&
        ["input", "textarea", "select"].includes(element.type)
      )
        return cloneElement(element, {
          id,
          "aria-describedby": describe,
          "aria-invalid": !!error,
        });
      return element.props.children
        ? cloneElement(
            element,
            {},
            connect(element.props.children as ReactNode),
          )
        : element;
    });
  return (
    <div className="field">
      <span>
        <label htmlFor={id}>{label}</label>
      </span>
      {connect(children)}
      {hint && <small id={`${id}-hint`}>{hint}</small>}
      {error && (
        <small id={`${id}-error`} className="field-error" role="alert">
          {tr(error)}
        </small>
      )}
    </div>
  );
}
export function Modal({
  title,
  onClose,
  children,
  wide = false,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
  wide?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    ref.current?.showModal();
    const original = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = original;
    };
  }, []);
  return (
    <dialog
      ref={ref}
      className={`modal ${wide ? "wide" : ""}`}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onClick={(e) => {
        if (e.target === ref.current) onClose();
      }}
      aria-labelledby="modal-heading"
    >
      <div className="modal-inner">
        <header>
          <h2 id="modal-heading">{title}</h2>
          <button
            className="icon-button"
            onClick={onClose}
            aria-label={tr("Cerrar")}
          >
            <X size={20} />
          </button>
        </header>
        {children}
      </div>
    </dialog>
  );
}
export function Stats({
  metrics,
  compact = false,
}: {
  metrics: Metrics;
  compact?: boolean;
}) {
  return (
    <div className={`stats ${compact ? "compact" : ""}`}>
      <div className="stat">
        <span className="stat-icon neutral">
          <Users size={20} />
        </span>
        <div>
          <span>{tr("Personas invitadas")}</span>
          <strong>{metrics.people}</strong>
          <small>
            {metrics.adults}
            {" " + tr("adultos ·") + " "}
            {metrics.children}
            {" " + tr("niños")}
          </small>
        </div>
      </div>
      <div className="stat">
        <span className="stat-icon accepted">
          <CheckCircle2 size={20} />
        </span>
        <div>
          <span>{tr("Confirmados")}</span>
          <strong>{metrics.accepted}</strong>
          <small>
            {metrics.people
              ? Math.round((metrics.accepted / metrics.people) * 100)
              : 0}
            {tr("% de tus invitados")}
          </small>
        </div>
      </div>
      <div className="stat">
        <span className="stat-icon pending">
          <Clock size={20} />
        </span>
        <div>
          <span>{tr("En espera")}</span>
          <strong>{metrics.pending}</strong>
          <small>{tr("Aún por confirmar")}</small>
        </div>
      </div>
      <div className="stat">
        <span className="stat-icon declined">
          <X size={20} />
        </span>
        <div>
          <span>{tr("No asistirán")}</span>
          <strong>{metrics.declined}</strong>
          <small>{tr("Para la próxima")}</small>
        </div>
      </div>
    </div>
  );
}
export function AttendanceBar({ metrics }: { metrics: Metrics }) {
  return (
    <div
      className="attendance-bar"
      aria-label={tr(
        "{{accepted}} confirmados, {{pending}} en espera y {{declined}} no asistirán",
        metrics,
      )}
    >
      <span
        className="bar-accepted"
        style={{
          width: `${metrics.people ? (100 * metrics.accepted) / metrics.people : 0}%`,
        }}
      />
      <span
        className="bar-pending"
        style={{
          width: `${metrics.people ? (100 * metrics.pending) / metrics.people : 0}%`,
        }}
      />
      <span
        className="bar-declined"
        style={{
          width: `${metrics.people ? (100 * metrics.declined) / metrics.people : 0}%`,
        }}
      />
    </div>
  );
}
export function EventCard({ event }: { event: Event }) {
  const theme = themes.find((t) => t.id === event.theme)!;
  return (
    <article className="event-card">
      <Link className="event-photo" to={`/eventos/${event.id}`}>
        <img
          src={`/images/${theme.image}`}
          alt={tr(theme.name)}
          loading="lazy"
        />
        <span className="date-stamp">
          <strong>
            {dateText(event.date, event.timeZone, { day: "2-digit" })}
          </strong>
          <span>
            {dateText(event.date, event.timeZone, { month: "short" }).replace(
              ".",
              "",
            )}
          </span>
        </span>
        <span className="event-tag">{tr(theme.name)}</span>
      </Link>
      <div className="event-card-body">
        <Link to={`/eventos/${event.id}`} className="event-title">
          <h3>{event.title}</h3>
          <ArrowUpRight size={19} />
        </Link>
        <p className="location">
          <MapPin size={14} />
          {event.location}
        </p>
        <AttendanceBar metrics={event.metrics} />
        <div className="event-bottom">
          <span>
            <span className="dot accepted" />
            {event.metrics.accepted}
            {" " + tr("confirmados")}
          </span>
          <span>
            {event.metrics.people}
            {" " + tr("invitados")}
          </span>
        </div>
      </div>
    </article>
  );
}
export function ThemePicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (id: Event["theme"]) => void;
}) {
  return (
    <div className="theme-picker">
      {themes.map((t) => (
        <button
          key={t.id}
          type="button"
          className={`theme-choice ${value === t.id ? "selected" : ""}`}
          onClick={() => onChange(t.id)}
          aria-pressed={value === t.id}
        >
          <img src={`/images/${t.image}`} alt="" />
          <span>{tr(t.name)}</span>
          {value === t.id && (
            <i>
              <Check size={14} />
            </i>
          )}
        </button>
      ))}
    </div>
  );
}
export function InvitationArt({
  event,
  name = tr("Estás invitado"),
  large = false,
}: {
  event: Pick<Event, "title" | "date" | "timeZone" | "location" | "theme">;
  name?: string;
  large?: boolean;
}) {
  const theme = themes.find((t) => t.id === event.theme)!;
  return (
    <div
      className={`invitation-art theme-${event.theme} ${large ? "large" : ""}`}
    >
      <img
        src={`/images/${theme.image}`}
        alt={tr("Decoración {{theme}}", { theme: tr(theme.name) })}
        className="invitation-photo"
      />
      <div className="invitation-words">
        <span className="invitation-symbol">
          <PartyPopper size={27} />
        </span>
        <p>{name}</p>
        <h2>{event.title || tr("Un motivo para celebrar")}</h2>
        <div className="invitation-rule" />
        <p className="invitation-date">
          {event.date && Number.isFinite(Date.parse(event.date))
            ? dateText(event.date, event.timeZone, {
                day: "numeric",
                month: "long",
                year: "numeric",
              })
            : tr("Una fecha especial")}
        </p>
        <p>
          {event.date && Number.isFinite(Date.parse(event.date))
            ? dateText(event.date, event.timeZone, {
                hour: "numeric",
                minute: "2-digit",
              })
            : tr("Hora por confirmar")}
        </p>
        <span className="invitation-location">
          {event.location || tr("Un lugar para encontrarnos")}
        </span>
      </div>
    </div>
  );
}
export const SectionHeading = ({
  title,
  children,
}: {
  title: string;
  children?: ReactNode;
}) => (
  <div className="section-heading">
    <h2>{title}</h2>
    {children}
  </div>
);
export const ArrowLink = ({
  to,
  children,
}: {
  to: string;
  children: ReactNode;
}) => (
  <Link className="text-link" to={to}>
    {children}
    <ArrowRight size={16} />
  </Link>
);
