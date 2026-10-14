import { validationOptions } from "@tuevento/contracts";
import { tr, getLocale, LanguageSwitcher } from "./i18n";
import { useState, useEffect } from "react";
import {
  Link,
  useNavigate,
  useParams,
  useSearchParams,
} from "react-router-dom";
import { useForm, useFieldArray, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { fromZonedTime, formatInTimeZone } from "date-fns-tz";
const eventTimeZones = [
  "America/Mexico_City",
  "America/Cancun",
  "America/Tijuana",
  "America/Monterrey",
  "America/Bogota",
  "America/New_York",
  "Europe/Madrid",
  "UTC",
];
/** Zona del usuario para un evento nuevo, si está entre las ofrecidas. */
function defaultTimeZone() {
  try {
    const own = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (eventTimeZones.includes(own)) return own;
  } catch {}
  return "America/Mexico_City";
}
import {
  Plus,
  ArrowLeft,
  ArrowRight,
  Check,
  CalendarDays,
  MapPin,
  Users,
  Search,
  Share2,
  Trash2,
  Pencil,
  Monitor,
  Copy,
  Mail,
  MessageCircle,
  ExternalLink,
  Archive,
  RefreshCw,
  UserRound,
  ChevronDown,
  CheckCircle2,
  X,
  Clock,
} from "lucide-react";
import {
  eventSchema,
  invitationSchema,
  themes,
  statusLabels,
  type Event,
  type EventInput,
  type Invitation,
  type InvitationInput,
  type Status,
} from "@tuevento/contracts";
import { useApp, dateText, errorText } from "./context";
import {
  ThemePicker,
  InvitationArt,
  Field,
  ErrorBox,
  Stats,
  Modal,
  Empty,
  AttendanceBar,
} from "./components";
const formSchema = eventSchema.extend({
  date: z.string().min(1, "Elige una fecha y hora."),
});
export function EventEditor() {
  const { id } = useParams(),
    [query] = useSearchParams(),
    { api, reload, toast } = useApp(),
    navigate = useNavigate();
  const [error, setError] = useState(""),
    [loading, setLoading] = useState(!!id);
  const form = useForm<EventInput>({
    resolver: zodResolver(
      formSchema,
      validationOptions(getLocale()),
    ) as Resolver<EventInput>,
    defaultValues: {
      title: "",
      description: "",
      date: "",
      location: "",
      theme: themes.some((t) => t.id === query.get("tema"))
        ? (query.get("tema") as Event["theme"])
        : "floral",
      timeZone: defaultTimeZone(),
      archived: false,
    },
  });
  useEffect(() => {
    if (!id) return;
    api
      .event(id)
      .then((e) =>
        form.reset({
          ...e,
          date: formatInTimeZone(e.date, e.timeZone, "yyyy-MM-dd'T'HH:mm"),
        }),
      )
      .catch((e) => setError(errorText(e)))
      .finally(() => setLoading(false));
  }, [id]);
  const values = form.watch();
  const preview = {
    ...values,
    date: values.date
      ? fromZonedTime(values.date, values.timeZone).toISOString()
      : "",
  };
  const save = form.handleSubmit(async (data) => {
    setError("");
    try {
      const payload = eventSchema.parse({
        ...data,
        date: fromZonedTime(data.date, data.timeZone).toISOString(),
      });
      const event = await api.saveEvent(payload, id);
      await reload();
      toast(
        id
          ? tr("Cambios guardados.")
          : tr("¡Tu evento está listo! Ahora invita a los tuyos."),
      );
      navigate(`/eventos/${event.id}`);
    } catch (e) {
      setError(errorText(e));
    }
  });
  if (loading) return <p role="status">{tr("Cargando tu evento…")}</p>;
  return (
    <>
      <Link className="back-link" to={id ? `/eventos/${id}` : "/eventos"}>
        <ArrowLeft size={16} />
        {tr("Volver a") + " "}
        {id ? tr("mi evento") : tr("mis eventos")}
      </Link>
      <div className="page-heading">
        <div>
          <h1>
            {id ? tr("Cada detalle cuenta.") : tr("Hay algo que celebrar.")}
          </h1>
          <p>
            {id
              ? tr("Ajusta la información y dale tu toque personal.")
              : tr("Empieza por los detalles. Lo mejor está por venir.")}
          </p>
        </div>
      </div>
      <form onSubmit={save} className="editor-layout" noValidate>
        <div className="form-panel">
          <h2>{tr("Cuéntanos de tu evento")}</h2>
          <Field
            label={tr("Nombre del evento")}
            error={form.formState.errors.title?.message}
          >
            <input
              {...form.register("title")}
              placeholder={tr("Por ejemplo: La boda de Sofía & Alejandro")}
              maxLength={100}
            />
          </Field>
          <div className="form-row">
            <Field
              label={tr("Fecha y hora")}
              error={form.formState.errors.date?.message}
            >
              <input type="datetime-local" {...form.register("date")} />
            </Field>
            <Field
              label={tr("Zona horaria")}
              error={form.formState.errors.timeZone?.message}
            >
              <select {...form.register("timeZone")}>
                <option value="America/Mexico_City">
                  {tr("Ciudad de México")}
                </option>
                <option value="America/Cancun">Cancún</option>
                <option value="America/Tijuana">Tijuana</option>
                <option value="America/Monterrey">Monterrey</option>
                <option value="America/Bogota">Bogotá</option>
                <option value="America/New_York">{tr("Nueva York")}</option>
                <option value="Europe/Madrid">Madrid</option>
                <option value="UTC">UTC</option>
              </select>
            </Field>
          </div>
          <Field
            label={tr("¿Dónde nos vemos?")}
            error={form.formState.errors.location?.message}
          >
            <input
              {...form.register("location")}
              placeholder={tr("Nombre del lugar y dirección")}
              maxLength={300}
            />
          </Field>
          <Field
            label={tr("Un mensaje para tus invitados")}
            error={form.formState.errors.description?.message}
            hint={tr(
              "Incluye indicaciones, código de vestimenta o lo que deben llevar.",
            )}
          >
            <textarea
              {...form.register("description")}
              rows={4}
              placeholder={tr(
                "Nos hace mucha ilusión compartir este día contigo…",
              )}
              maxLength={2500}
            />
          </Field>
          <div className="form-section-heading">
            <h2>{tr("Elige el estilo de tu invitación")}</h2>
            <p>{tr("Podrás cambiarlo cuando quieras.")}</p>
          </div>
          <ThemePicker
            value={values.theme}
            onChange={(value) =>
              form.setValue("theme", value, { shouldDirty: true })
            }
          />
          {error && <ErrorBox message={error} />}
          <div className="form-actions">
            <Link
              className="button secondary"
              to={id ? `/eventos/${id}` : "/eventos"}
            >
              {tr("Cancelar")}
            </Link>
            <button
              className="button"
              type="submit"
              disabled={form.formState.isSubmitting}
            >
              {form.formState.isSubmitting
                ? tr("Guardando…")
                : id
                  ? tr("Guardar cambios")
                  : tr("Crear mi evento")}
              <ArrowRight size={17} />
            </button>
          </div>
        </div>
        <aside className="preview-panel">
          <div className="preview-label">
            <span className="dot accepted" />
            {tr("Tu invitación cobra vida")}
          </div>
          <InvitationArt event={preview} />
          <p>
            {tr("Vista previa del diseño. Cada invitado recibirá")}
            <br />
            {tr("su propio enlace y saludo personalizado.")}
          </p>
        </aside>
      </form>
    </>
  );
}
export function EventDetail() {
  const { id } = useParams(),
    { api, events, reload, toast } = useApp(),
    navigate = useNavigate();
  const event = events.find((e) => e.id === id),
    [invitations, setInvitations] = useState<Invitation[]>([]),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [filter, setFilter] = useState<Status | "all">("all"),
    [search, setSearch] = useState(""),
    [editing, setEditing] = useState<Invitation | "new" | null>(null),
    [sharing, setSharing] = useState<Invitation | null>(null),
    [deleting, setDeleting] = useState<Invitation | "event" | null>(null),
    [busy, setBusy] = useState(false);
  const load = async () => {
    if (!id) return;
    try {
      setInvitations(await api.invitations(id));
      setError("");
    } catch (e) {
      setError(errorText(e));
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    void load();
  }, [id, events]);
  const remove = async () => {
    if (!event || !deleting) return;
    setBusy(true);
    try {
      if (deleting === "event") {
        await api.deleteEvent(event.id);
        await reload();
        navigate("/eventos");
        toast(tr("Evento eliminado."));
      } else {
        await api.deleteInvitation(event.id, deleting.id);
        await load();
        await reload();
        toast(tr("Invitación eliminada."));
      }
      setDeleting(null);
    } catch (e) {
      toast(errorText(e));
    } finally {
      setBusy(false);
    }
  };
  const archive = async () => {
    if (!event) return;
    setBusy(true);
    try {
      await api.saveEvent({ ...event, archived: !event.archived }, event.id);
      await reload();
      toast(
        event.archived
          ? tr("Evento reactivado.")
          : tr("Evento archivado. Sus enlaces ya no aceptan respuestas."),
      );
    } catch (e) {
      toast(errorText(e));
    } finally {
      setBusy(false);
    }
  };
  if (!event)
    return error ? (
      <ErrorBox message={error} />
    ) : (
      <p role="status">{tr("Cargando evento…")}</p>
    );
  const list = invitations.filter(
    (i) =>
      (i.name + " " + i.members.map((m) => m.name).join(" "))
        .toLowerCase()
        .includes(search.toLowerCase()) &&
      (filter === "all" || i.members.some((m) => m.status === filter)),
  );
  return (
    <>
      <Link className="back-link" to="/eventos">
        <ArrowLeft size={16} />
        {tr("Mis eventos")}
      </Link>
      <div className="event-heading">
        <div>
          <span className="soft-label">
            {event.archived
              ? tr("Archivado")
              : tr(themes.find((t) => t.id === event.theme)?.name || "")}
          </span>
          <h1>{event.title}</h1>
          <div className="event-meta">
            <span>
              <CalendarDays size={16} />
              {dateText(event.date, event.timeZone, {
                day: "numeric",
                month: "long",
                hour: "numeric",
                minute: "2-digit",
              })}
            </span>
            <span>
              <MapPin size={16} />
              {event.location}
            </span>
          </div>
        </div>
        <div className="button-group">
          <Link className="button secondary" to={`/eventos/${id}/pantalla`}>
            <Monitor size={17} />
            {tr("Modo pantalla")}
          </Link>
          <Link className="button secondary" to={`/eventos/${id}/editar`}>
            <Pencil size={17} />
            {tr("Editar evento")}
          </Link>
        </div>
      </div>
      <Stats metrics={event.metrics} compact />
      <div className="section-heading">
        <div>
          <h2>
            {tr("Tu lista de invitados")}{" "}
            <span className="count-inline">{invitations.length}</span>
          </h2>
          <p className="muted">
            {tr("Una invitación por persona o familia. Cada respuesta cuenta.")}
          </p>
        </div>
        <button className="button" onClick={() => setEditing("new")}>
          <Plus size={18} />
          {tr("Añadir invitación")}
        </button>
      </div>
      <div className="list-toolbar">
        <div className="tabs scroll-tabs">
          {(["all", "accepted", "pending", "declined"] as const).map((s) => (
            <button
              key={s}
              onClick={() => setFilter(s)}
              className={filter === s ? "active" : ""}
              aria-pressed={filter === s}
            >
              {s === "all" ? tr("Todos") : tr(statusLabels[s])}
              {s !== "all" && <span className={`dot ${s}`} />}
            </button>
          ))}
        </div>
        <label className="search-field">
          <Search size={17} />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={tr("Buscar invitado o familia")}
            aria-label={tr("Buscar invitado o familia")}
          />
        </label>
      </div>
      {error && <ErrorBox message={error} />}{" "}
      {loading ? (
        <p role="status">{tr("Cargando invitaciones…")}</p>
      ) : list.length ? (
        <div className="guest-table">
          <div className="guest-table-head">
            <span>{tr("Invitación / integrantes")}</span>
            <span>{tr("Tipo")}</span>
            <span>{tr("Asistencia por persona")}</span>
            <span>{tr("Acciones")}</span>
          </div>
          {list.map((i) => (
            <div className="guest-row" key={i.id}>
              <div className="guest-name">
                <span
                  className={`initial-avatar ${i.kind === "family" ? "rose" : ""}`}
                >
                  {i.kind === "family" ? (
                    <Users size={20} />
                  ) : (
                    i.name.slice(0, 2).toUpperCase()
                  )}
                </span>
                <div>
                  <button className="name-button" onClick={() => setEditing(i)}>
                    {i.name}
                  </button>
                  <small>{i.members.map((m) => m.name).join(", ")}</small>
                </div>
              </div>
              <span className="type-tag">
                {i.kind === "family" ? tr("Familiar") : tr("Individual")} ·{" "}
                {i.members.length}
              </span>
              <div className="member-statuses">
                {i.members
                  .filter((m) => filter === "all" || m.status === filter)
                  .map((m) => (
                    <span
                      className={`status-pill ${m.status}`}
                      key={m.id}
                      title={`${m.name}: ${tr(statusLabels[m.status])}`}
                    >
                      <span className={`dot ${m.status}`} />
                      {m.name.split(" ")[0]}
                      <span className="sr-only">
                        : {tr(statusLabels[m.status])}
                      </span>
                    </span>
                  ))}
              </div>
              <div className="row-actions">
                <button
                  className="icon-button"
                  onClick={() => setSharing(i)}
                  aria-label={tr("Compartir invitación de {{name}}", {
                    name: i.name,
                  })}
                  title={tr("Compartir invitación")}
                >
                  <Share2 size={17} />
                </button>
                <button
                  className="icon-button"
                  onClick={() => setEditing(i)}
                  aria-label={tr("Editar {{name}}", { name: i.name })}
                  title={tr("Ficha de integrantes")}
                >
                  <Pencil size={16} />
                </button>
                <button
                  className="icon-button danger-text"
                  onClick={() => setDeleting(i)}
                  aria-label={tr("Eliminar {{name}}", { name: i.name })}
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <Empty
          title={
            invitations.length
              ? tr("No hay coincidencias")
              : tr("Los mejores planes empiezan con tu gente")
          }
          action={
            !invitations.length ? (
              <button className="button" onClick={() => setEditing("new")}>
                <Plus size={17} />
                {tr("Añadir mi primera invitación")}
              </button>
            ) : (
              <button
                className="button secondary"
                onClick={() => {
                  setFilter("all");
                  setSearch("");
                }}
              >
                {tr("Limpiar filtros")}
              </button>
            )
          }
        >
          {invitations.length
            ? tr("Prueba otro nombre o estado de asistencia.")
            : tr(
                "Añade personas o familias y comparte una invitación hecha para ellas.",
              )}
        </Empty>
      )}
      <div className="event-footnote">
        <span>
          <span className="dot accepted" />
          {tr("Las respuestas se actualizan automáticamente")}
        </span>
        <span>
          {event.metrics.adults}
          {" " + tr("adultos ·") + " "}
          {event.metrics.children}
          {" " + tr("niños ·")} {event.metrics.invitations}
          {" " + tr("invitaciones")}
        </span>
      </div>
      <details className="event-options">
        <summary>{tr("Más opciones del evento")}</summary>
        <div>
          <button
            className="button secondary"
            disabled={busy}
            onClick={archive}
          >
            <Archive size={17} />
            {event.archived ? tr("Reactivar evento") : tr("Archivar evento")}
          </button>
          <button
            className="button danger-outline"
            onClick={() => setDeleting("event")}
          >
            <Trash2 size={17} />
            {tr("Eliminar evento")}
          </button>
        </div>
        <p>
          {tr(
            "Archivar conserva tus datos y desactiva las invitaciones públicas.",
          )}
        </p>
      </details>
      {editing && (
        <InvitationEditor
          event={event}
          invitation={editing === "new" ? undefined : editing}
          onClose={() => setEditing(null)}
          onSaved={async () => {
            setEditing(null);
            await load();
            await reload();
          }}
        />
      )}
      {sharing && (
        <ShareDialog
          event={event}
          invitation={sharing}
          onClose={() => setSharing(null)}
        />
      )}
      {deleting && (
        <Modal
          title={
            deleting === "event"
              ? tr("¿Eliminar este evento?")
              : tr("¿Eliminar esta invitación?")
          }
          onClose={() => setDeleting(null)}
        >
          <p>
            {deleting === "event"
              ? tr(
                  "Se eliminarán también sus invitaciones, integrantes y notificaciones. Esta acción no se puede deshacer.",
                )
              : tr(
                  "Se eliminarán la invitación de {{name}} y sus integrantes. Su enlace dejará de funcionar.",
                  { name: deleting.name },
                )}
          </p>
          <div className="form-actions">
            <button
              className="button secondary"
              onClick={() => setDeleting(null)}
            >
              {tr("Cancelar")}
            </button>
            <button className="button danger" disabled={busy} onClick={remove}>
              {busy ? tr("Eliminando…") : tr("Sí, eliminar")}
            </button>
          </div>
        </Modal>
      )}
    </>
  );
}
function InvitationEditor({
  event,
  invitation,
  onClose,
  onSaved,
}: {
  event: Event;
  invitation?: Invitation;
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const { api, toast } = useApp(),
    [error, setError] = useState("");
  const form = useForm<InvitationInput>({
    resolver: zodResolver(
      invitationSchema,
      validationOptions(getLocale()),
    ) as Resolver<InvitationInput>,
    defaultValues: invitation || {
      name: "",
      phone: "",
      email: "",
      notes: "",
      kind: "individual",
      members: [{ name: "", kind: "adult", notes: "" }],
    },
  });
  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "members",
    keyName: "formKey",
  });
  const kind = form.watch("kind");
  const submit = form.handleSubmit(async (data) => {
    setError("");
    try {
      await api.saveInvitation(event.id, data, invitation?.id);
      toast(
        invitation
          ? tr("Invitación actualizada.")
          : tr("Invitación creada. Ya puedes compartirla."),
      );
      await onSaved();
    } catch (e) {
      setError(errorText(e));
    }
  });
  return (
    <Modal
      title={
        invitation
          ? tr("Ficha de la invitación")
          : tr("Hagamos sitio para alguien especial")
      }
      onClose={onClose}
      wide
    >
      <form onSubmit={submit} noValidate>
        <div className="choice-pair">
          <button
            type="button"
            className={kind === "individual" ? "selected" : ""}
            disabled={fields.length > 1}
            onClick={() => form.setValue("kind", "individual")}
          >
            <UserRound size={20} />
            <strong>{tr("Individual")}</strong>
            <span>{tr("Una persona")}</span>
          </button>
          <button
            type="button"
            className={kind === "family" ? "selected" : ""}
            onClick={() => form.setValue("kind", "family")}
          >
            <Users size={20} />
            <strong>{tr("Familiar o grupal")}</strong>
            <span>{tr("Varios integrantes")}</span>
          </button>
        </div>
        <Field
          label={tr("Nombre de la invitación")}
          error={form.formState.errors.name?.message}
          hint={tr("Puedes usar un nombre, correo o teléfono de contacto.")}
        >
          <input
            {...form.register("name")}
            placeholder={
              kind === "family"
                ? tr("Por ejemplo: Familia García")
                : tr("Por ejemplo: Mariana Torres")
            }
          />
        </Field>
        <div className="form-row">
          <Field
            label={tr("Correo de contacto (opcional)")}
            error={form.formState.errors.email?.message}
          >
            <input
              type="email"
              {...form.register("email")}
              placeholder="nombre@ejemplo.com"
            />
          </Field>
          <Field
            label={tr("Teléfono (opcional)")}
            error={form.formState.errors.phone?.message}
          >
            <input
              type="tel"
              {...form.register("phone")}
              placeholder="+52 777 123 4567"
            />
          </Field>
        </div>
        <div className="form-section-heading">
          <h3>
            {kind === "family"
              ? tr("Integrantes de la familia")
              : tr("Persona invitada")}
          </h3>
          <p>{tr("Las notas son privadas y solo tú puedes verlas.")}</p>
        </div>
        <div className="member-edit-list">
          {fields.map((field, index) => (
            <div className="member-edit" key={field.formKey}>
              <div className="member-edit-top">
                <strong>
                  {kind === "family"
                    ? tr("Integrante {{number}}", { number: index + 1 })
                    : tr("Sus datos")}
                </strong>
                {fields.length > 1 && (
                  <button
                    type="button"
                    className="icon-button danger-text"
                    onClick={() => remove(index)}
                    aria-label={tr("Eliminar integrante {{number}}", {
                      number: index + 1,
                    })}
                  >
                    <Trash2 size={16} />
                  </button>
                )}
              </div>
              <div className="form-row">
                <Field
                  label={tr("Nombre")}
                  error={form.formState.errors.members?.[index]?.name?.message}
                >
                  <input
                    {...form.register(`members.${index}.name`)}
                    placeholder={tr("Nombre de la persona")}
                  />
                </Field>
                <Field label={tr("Tipo")}>
                  <select {...form.register(`members.${index}.kind`)}>
                    <option value="adult">{tr("Adulto")}</option>
                    <option value="child">{tr("Niño")}</option>
                  </select>
                </Field>
              </div>
              <Field
                label={tr("Notas individuales (opcional)")}
                error={form.formState.errors.members?.[index]?.notes?.message}
              >
                <input
                  {...form.register(`members.${index}.notes`)}
                  placeholder={tr("Alergias, menú especial, observaciones…")}
                  maxLength={500}
                />
              </Field>
            </div>
          ))}
        </div>
        {kind === "family" && (
          <button
            className="button secondary full"
            type="button"
            onClick={() => append({ name: "", kind: "adult", notes: "" })}
            disabled={fields.length >= 50}
          >
            <Plus size={17} />
            {tr("Añadir integrante")}
          </button>
        )}
        <Field
          label={tr("Observaciones de la invitación (opcional)")}
          error={form.formState.errors.notes?.message}
        >
          <textarea {...form.register("notes")} rows={2} maxLength={1000} />
        </Field>
        {form.formState.errors.members?.root?.message && (
          <ErrorBox message={form.formState.errors.members.root.message} />
        )}{" "}
        {error && <ErrorBox message={error} />}
        <div className="form-actions sticky-actions">
          <button className="button secondary" type="button" onClick={onClose}>
            {tr("Cancelar")}
          </button>
          <button className="button" disabled={form.formState.isSubmitting}>
            {form.formState.isSubmitting
              ? tr("Guardando…")
              : invitation
                ? tr("Guardar cambios")
                : tr("Crear invitación")}
            <Check size={17} />
          </button>
        </div>
      </form>
    </Modal>
  );
}
export function ShareDialog({
  event,
  invitation,
  onClose,
}: {
  event: Event;
  invitation: Invitation;
  onClose: () => void;
}) {
  const { runtime, toast } = useApp(),
    [copied, setCopied] = useState(false);
  // El idioma lo da el dominio: el enlace usa el origen actual, sin ?lang=.
  const url = `${runtime.publicOrigin}/i/${invitation.token}`,
    message = tr(
      "¡Hola, {{name}}! Te invitamos a {{event}}. Consulta los detalles y confirma tu asistencia aquí: {{url}}",
      { name: invitation.name, event: event.title, url },
    );
  const copy = async () => {
    try {
      await runtime.copy(url);
      setCopied(true);
      toast(tr("Enlace copiado."));
    } catch {
      toast(
        tr("No pudimos copiarlo. Selecciona el enlace y cópialo manualmente."),
      );
    }
  };
  return (
    <Modal title={tr("Lo bueno se comparte")} onClose={onClose}>
      <p>
        {tr("Esta invitación es para") + " "}
        <strong>{invitation.name}</strong>.
      </p>
      <div className="share-link">
        <input
          aria-label={tr("Enlace privado de invitación")}
          value={url}
          readOnly
          onFocus={(e) => e.target.select()}
        />
        <button
          className="icon-button"
          onClick={copy}
          aria-label={tr("Copiar enlace")}
        >
          {copied ? <Check size={19} /> : <Copy size={19} />}
        </button>
      </div>
      <div className="share-actions">
        <button
          className="button"
          onClick={() =>
            runtime.openExternal(
              `https://wa.me/${invitation.phone.replace(/\D/g, "")}?text=${encodeURIComponent(message)}`,
            )
          }
        >
          <MessageCircle size={18} />
          WhatsApp
        </button>
        <a
          className="button secondary"
          href={`mailto:${invitation.email}?subject=${encodeURIComponent(tr("Te invitamos: {{event}}", { event: event.title }))}&body=${encodeURIComponent(message)}`}
        >
          <Mail size={18} />
          {tr("Correo electrónico")}
        </a>
      </div>
      <a className="preview-link" href={url} target="_blank" rel="noreferrer">
        <ExternalLink size={16} />
        {tr("Ver invitación como invitado")}
      </a>
      <p className="privacy-note">
        {tr(
          "El enlace permite ver y responder esta invitación. Compártelo solo con sus destinatarios. WhatsApp y correo abren el mensaje; tú decides cuándo enviarlo.",
        )}
      </p>
    </Modal>
  );
}
export function TvPage() {
  const { id } = useParams(),
    { events } = useApp();
  const event = events.find((e) => e.id === id);
  if (!event)
    return (
      <div className="startup">
        <p>{tr("Cargando tablero…")}</p>
        <Link to="/eventos">{tr("Volver")}</Link>
      </div>
    );
  return (
    <div className="tv-page">
      <header>
        <LanguageSwitcher />
        <Link to={`/eventos/${id}`} className="button secondary">
          <ArrowLeft size={20} />
          {tr("Volver al evento")}
        </Link>
        <span>
          <span className="dot accepted" />
          {tr("En vivo")}
        </span>
        <button
          className="button secondary"
          onClick={() => {
            if (document.fullscreenElement) void document.exitFullscreen();
            else void document.documentElement.requestFullscreen();
          }}
        >
          <Monitor size={20} />
          {tr("Pantalla completa")}
        </button>
      </header>
      <main>
        <p className="greeting">{tr("Qué alegría tenerlos aquí.")}</p>
        <h1>{event.title}</h1>
        <p className="tv-date">
          {dateText(event.date, event.timeZone)} · {event.location}
        </p>
        <Stats metrics={event.metrics} />
        <AttendanceBar metrics={event.metrics} />
        <p className="tv-footer">
          {event.metrics.adults}
          {" " + tr("adultos ·") + " "}
          {event.metrics.children}
          {" " + tr("niños ·")} {event.metrics.invitations}
          {" " + tr("invitaciones")}
        </p>
      </main>
    </div>
  );
}
