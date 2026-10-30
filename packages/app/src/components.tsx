import { tr, trMessage } from "./i18n";
import {
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
import { themeImageSrcSet } from "./theme-images";
import { Card } from "./ui/card";
import {
  Dialog,
  DialogCloseButton,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "./ui/dialog";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { NativeSelect } from "./ui/native-select";
import { Textarea } from "./ui/textarea";
export function Logo({
  compact = false,
  to = "/",
}: {
  compact?: boolean;
  to?: string;
}) {
  return (
    <Link to={to} className="logo" aria-label={tr("common.tueventofunHome")}>
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
        <img src={user.avatar} alt={tr("common.hostAvatar")} />
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
      {trMessage(message)}
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
        [Input, Textarea, NativeSelect].includes(element.type as never) ||
        (typeof element.type === "string" &&
          ["input", "textarea", "select"].includes(element.type))
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
      <Label htmlFor={id}>{label}</Label>
      {connect(children)}
      {hint && <small id={`${id}-hint`}>{hint}</small>}
      {error && (
        <small id={`${id}-error`} className="field-error" role="alert">
          {trMessage(error)}
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
  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent size={wide ? "wide" : "default"} aria-describedby={undefined}>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogCloseButton label={tr("common.close")} />
        </DialogHeader>
        {children}
      </DialogContent>
    </Dialog>
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
          <span>{tr("common.peopleInvited")}</span>
          <strong>{metrics.people}</strong>
          <small>
            {tr("common.adultsCount", { count: metrics.adults })} ·{" "}
            {tr("common.childrenCount", { count: metrics.children })}
          </small>
        </div>
      </div>
      <div className="stat">
        <span className="stat-icon accepted">
          <CheckCircle2 size={20} />
        </span>
        <div>
          <span>{tr("status.accepted")}</span>
          <strong>{metrics.accepted}</strong>
          <small>
            {tr("common.percentOfGuests", {
              percent: metrics.people
                ? Math.round((metrics.accepted / metrics.people) * 100)
                : 0,
            })}
          </small>
        </div>
      </div>
      <div className="stat">
        <span className="stat-icon pending">
          <Clock size={20} />
        </span>
        <div>
          <span>{tr("status.pending")}</span>
          <strong>{metrics.pending}</strong>
          <small>{tr("common.yetConfirm")}</small>
        </div>
      </div>
      <div className="stat">
        <span className="stat-icon declined">
          <X size={20} />
        </span>
        <div>
          <span>{tr("status.declined")}</span>
          <strong>{metrics.declined}</strong>
          <small>{tr("common.maybeNextTime")}</small>
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
        "common.acceptedAttendingPendingPending",
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
    <Card asChild flush className="event-card">
    <article>
      <Link className="event-photo" to={`/eventos/${event.id}`}>
        <img
          src={`/images/${theme.image}`}
          srcSet={themeImageSrcSet(theme)}
          sizes="(max-width: 767px) 100vw, (max-width: 1200px) 50vw, 33vw"
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
            {tr("common.attendingCount", { count: event.metrics.accepted })}
          </span>
          <span>
            {tr("common.guestsCount", { count: event.metrics.people })}
          </span>
        </div>
      </div>
    </article>
    </Card>
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
          <img
            src={`/images/${t.image}`}
            srcSet={themeImageSrcSet(t)}
            sizes="160px"
            loading="lazy"
            alt=""
          />
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
  name = tr("common.youreInvited"),
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
        srcSet={themeImageSrcSet(theme)}
        sizes={large ? "(max-width: 767px) 100vw, 650px" : "(max-width: 767px) 100vw, (max-width: 1200px) 50vw, 500px"}
        loading="lazy"
        alt={tr("common.themeDecoration", { theme: tr(theme.name) })}
        className="invitation-photo"
      />
      <div className="invitation-words">
        <span className="invitation-symbol">
          <PartyPopper size={27} />
        </span>
        <p>{name}</p>
        <h2>{event.title || tr("common.reasonCelebrate")}</h2>
        <div className="invitation-rule" />
        <p className="invitation-date">
          {event.date && Number.isFinite(Date.parse(event.date))
            ? dateText(event.date, event.timeZone, {
                day: "numeric",
                month: "long",
                year: "numeric",
              })
            : tr("common.specialDate")}
        </p>
        <p>
          {event.date && Number.isFinite(Date.parse(event.date))
            ? dateText(event.date, event.timeZone, {
                hour: "numeric",
                minute: "2-digit",
              })
            : tr("common.timeConfirmed")}
        </p>
        <span className="invitation-location">
          {event.location || tr("common.placeComeTogether")}
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

export type ContainerWidth = "page" | "flow" | "prose" | "form" | "auth";

/**
 * Contenedor estándar alineado con micitaentiempo.online.
 * - page: páginas públicas, catálogos (1152px)
 * - flow: flujos guiados y modales amplios (896px)
 * - prose: lectura larga, legales, notas (72ch)
 * - form: formularios estándar de una columna (640px)
 * - auth: tarjetas de acceso y registro (448px)
 */
export function Container({
  className = "",
  width = "page",
  children,
  ...props
}: {
  className?: string;
  width?: ContainerWidth;
  children?: ReactNode;
} & React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={`ui-container ${width} ${className}`.trim()} {...props}>
      {children}
    </div>
  );
}

export { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "./ui/card";

