import { validationOptions } from "@tuevento/contracts";
import { tr, getLocale, LanguageSwitcher, Lines } from "./i18n";
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
/** Zonas horarias que ofrece el editor de eventos, con su nombre en cada idioma. */
const timeZones: [string, MessageKey][] = [
  ["America/Mexico_City", "events.timeZones.mexicoCity"],
  ["America/Cancun", "events.timeZones.cancun"],
  ["America/Tijuana", "events.timeZones.tijuana"],
  ["America/Monterrey", "events.timeZones.monterrey"],
  ["America/Bogota", "events.timeZones.bogota"],
  ["America/New_York", "events.timeZones.newYork"],
  ["Europe/Madrid", "events.timeZones.madrid"],
  ["UTC", "events.timeZones.utc"],
];
/** Zona del usuario para un evento nuevo, si está entre las ofrecidas. */
function defaultTimeZone() {
  try {
    const own = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (timeZones.some(([value]) => value === own)) return own;
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
  type MessageKey,
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
  date: z.string().min(1, "events.chooseDateTime"),
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
          ? tr("events.changesSaved")
          : tr("events.eventReadyNowInvite"),
      );
      navigate(`/eventos/${event.id}`);
    } catch (e) {
      setError(errorText(e));
    }
  });
  if (loading) return <p role="status">{tr("events.loadingEvent")}</p>;
  return (
    <>
      <Link className="back-link" to={id ? `/eventos/${id}` : "/eventos"}>
        <ArrowLeft size={16} />
        {tr(id ? "events.backToEvent" : "events.backToEvents")}
      </Link>
      <div className="page-heading">
        <div>
          <h1>
            {id ? tr("events.everyDetailCounts") : tr("events.theresSomethingCelebrate")}
          </h1>
          <p>
            {id
              ? tr("events.fineTuneDetailsAdd")
              : tr("events.startDetailsBestYet")}
          </p>
        </div>
      </div>
      <form onSubmit={save} className="editor-layout" noValidate>
        <div className="form-panel">
          <h2>{tr("events.tellUsAboutEvent")}</h2>
          <Field
            label={tr("events.eventName")}
            error={form.formState.errors.title?.message}
          >
            <input
              {...form.register("title")}
              placeholder={tr("events.exampleSofiaAlejandrosWedding")}
              maxLength={100}
            />
          </Field>
          <div className="form-row">
            <Field
              label={tr("events.dateTime")}
              error={form.formState.errors.date?.message}
            >
              <input type="datetime-local" {...form.register("date")} />
            </Field>
            <Field
              label={tr("events.timeZone")}
              error={form.formState.errors.timeZone?.message}
            >
              <select {...form.register("timeZone")}>
                {timeZones.map(([value, label]) => (
                  <option key={value} value={value}>
                    {tr(label)}
                  </option>
                ))}
              </select>
            </Field>
          </div>
          <Field
            label={tr("events.whereMeeting")}
            error={form.formState.errors.location?.message}
          >
            <input
              {...form.register("location")}
              placeholder={tr("events.venueNameAddress")}
              maxLength={300}
            />
          </Field>
          <Field
            label={tr("events.messageGuests")}
            error={form.formState.errors.description?.message}
            hint={tr(
              "events.includeDirectionsDressCode",
            )}
          >
            <textarea
              {...form.register("description")}
              rows={4}
              placeholder={tr(
                "events.wereSoExcitedShare",
              )}
              maxLength={2500}
            />
          </Field>
          <div className="form-section-heading">
            <h2>{tr("events.chooseInvitationStyle")}</h2>
            <p>{tr("events.changeWheneverLike")}</p>
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
              {tr("common.cancel")}
            </Link>
            <button
              className="button"
              type="submit"
              disabled={form.formState.isSubmitting}
            >
              {form.formState.isSubmitting
                ? tr("common.saving")
                : id
                  ? tr("common.saveChanges")
                  : tr("common.createMyEvent")}
              <ArrowRight size={17} />
            </button>
          </div>
        </div>
        <aside className="preview-panel">
          <div className="preview-label">
            <span className="dot accepted" />
            {tr("events.invitationComesLife")}
          </div>
          <InvitationArt event={preview} />
          <p>
            <Lines k="events.previewNote" />
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
        toast(tr("events.eventDeleted"));
      } else {
        await api.deleteInvitation(event.id, deleting.id);
        await load();
        await reload();
        toast(tr("events.invitationDeleted"));
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
          ? tr("events.eventReactivated")
          : tr("events.eventArchivedLinksNo"),
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
      <p role="status">{tr("events.loadingEventShort")}</p>
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
        {tr("common.events")}
      </Link>
      <div className="event-heading">
        <div>
          <span className="soft-label">
            {event.archived
              ? tr("events.archivedBadge")
              : tr(themes.find((t) => t.id === event.theme)!.name)}
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
            {tr("events.displayMode")}
          </Link>
          <Link className="button secondary" to={`/eventos/${id}/editar`}>
            <Pencil size={17} />
            {tr("events.editEvent")}
          </Link>
        </div>
      </div>
      <Stats metrics={event.metrics} compact />
      <div className="section-heading">
        <div>
          <h2>
            {tr("events.guestList")}{" "}
            <span className="count-inline">{invitations.length}</span>
          </h2>
          <p className="muted">
            {tr("events.oneInvitationPerPerson")}
          </p>
        </div>
        <button className="button" onClick={() => setEditing("new")}>
          <Plus size={18} />
          {tr("events.addInvitation")}
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
              {s === "all" ? tr("common.allMasculine") : tr(statusLabels[s])}
              {s !== "all" && <span className={`dot ${s}`} />}
            </button>
          ))}
        </div>
        <label className="search-field">
          <Search size={17} />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={tr("events.searchGuestsFamilies")}
            aria-label={tr("events.searchGuestsFamilies")}
          />
        </label>
      </div>
      {error && <ErrorBox message={error} />}{" "}
      {loading ? (
        <p role="status">{tr("events.loadingInvitations")}</p>
      ) : list.length ? (
        <div className="guest-table">
          <div className="guest-table-head">
            <span>{tr("events.invitationMembers")}</span>
            <span>{tr("events.type")}</span>
            <span>{tr("events.attendancePerPerson")}</span>
            <span>{tr("events.actions")}</span>
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
                {i.kind === "family" ? tr("common.family") : tr("common.individual")} ·{" "}
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
                  aria-label={tr("events.shareNameSInvitation", {
                    name: i.name,
                  })}
                  title={tr("events.shareInvitation")}
                >
                  <Share2 size={17} />
                </button>
                <button
                  className="icon-button"
                  onClick={() => setEditing(i)}
                  aria-label={tr("events.editName", { name: i.name })}
                  title={tr("events.memberDetails")}
                >
                  <Pencil size={16} />
                </button>
                <button
                  className="icon-button danger-text"
                  onClick={() => setDeleting(i)}
                  aria-label={tr("events.deleteName", { name: i.name })}
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
              ? tr("events.noMatchesFound")
              : tr("events.bestPlansStartPeople")
          }
          action={
            !invitations.length ? (
              <button className="button" onClick={() => setEditing("new")}>
                <Plus size={17} />
                {tr("events.addFirstInvitation")}
              </button>
            ) : (
              <button
                className="button secondary"
                onClick={() => {
                  setFilter("all");
                  setSearch("");
                }}
              >
                {tr("events.clearFilters")}
              </button>
            )
          }
        >
          {invitations.length
            ? tr("events.tryAnotherNameAttendance")
            : tr(
                "events.addPeopleFamiliesShare",
              )}
        </Empty>
      )}
      <div className="event-footnote">
        <span>
          <span className="dot accepted" />
          {tr("events.repliesUpdateAutomatically")}
        </span>
        <span>
          {tr("common.adultsCount", { count: event.metrics.adults })} ·{" "}
          {tr("common.childrenCount", { count: event.metrics.children })} ·{" "}
          {tr("common.invitationsCount", { count: event.metrics.invitations })}
        </span>
      </div>
      <details className="event-options">
        <summary>{tr("events.moreEventOptions")}</summary>
        <div>
          <button
            className="button secondary"
            disabled={busy}
            onClick={archive}
          >
            <Archive size={17} />
            {event.archived ? tr("events.reactivateEvent") : tr("events.archiveEvent")}
          </button>
          <button
            className="button danger-outline"
            onClick={() => setDeleting("event")}
          >
            <Trash2 size={17} />
            {tr("events.deleteEvent")}
          </button>
        </div>
        <p>
          {tr(
            "events.archivingKeepsDataDisables",
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
              ? tr("events.deleteEventConfirm")
              : tr("events.deleteInvitationConfirm")
          }
          onClose={() => setDeleting(null)}
        >
          <p>
            {deleting === "event"
              ? tr(
                  "events.invitationsMembersNotificationsAlso",
                )
              : tr(
                  "events.invitationNameMembersDeleted",
                  { name: deleting.name },
                )}
          </p>
          <div className="form-actions">
            <button
              className="button secondary"
              onClick={() => setDeleting(null)}
            >
              {tr("common.cancel")}
            </button>
            <button className="button danger" disabled={busy} onClick={remove}>
              {busy ? tr("events.deleting") : tr("events.yesDelete")}
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
          ? tr("events.invitationUpdated")
          : tr("events.invitationCreatedReadyShare"),
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
          ? tr("events.invitationDetails")
          : tr("events.makeRoomSomeoneSpecial")
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
            <strong>{tr("common.individual")}</strong>
            <span>{tr("events.onePerson")}</span>
          </button>
          <button
            type="button"
            className={kind === "family" ? "selected" : ""}
            onClick={() => form.setValue("kind", "family")}
          >
            <Users size={20} />
            <strong>{tr("events.familyGroup")}</strong>
            <span>{tr("events.multipleMembers")}</span>
          </button>
        </div>
        <Field
          label={tr("events.invitationName")}
          error={form.formState.errors.name?.message}
          hint={tr("events.useNameEmailContact")}
        >
          <input
            {...form.register("name")}
            placeholder={
              kind === "family"
                ? tr("events.exampleGarciaFamily")
                : tr("events.exampleMarianaTorres")
            }
          />
        </Field>
        <div className="form-row">
          <Field
            label={tr("events.contactEmailOptional")}
            error={form.formState.errors.email?.message}
          >
            <input
              type="email"
              {...form.register("email")}
              placeholder={tr("events.emailPlaceholder")}
            />
          </Field>
          <Field
            label={tr("events.phoneNumberOptional")}
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
              ? tr("events.familyMembers")
              : tr("events.guest")}
          </h3>
          <p>{tr("events.notesPrivateOnlySee")}</p>
        </div>
        <div className="member-edit-list">
          {fields.map((field, index) => (
            <div className="member-edit" key={field.formKey}>
              <div className="member-edit-top">
                <strong>
                  {kind === "family"
                    ? tr("events.memberNumber", { number: index + 1 })
                    : tr("events.guestDetails")}
                </strong>
                {fields.length > 1 && (
                  <button
                    type="button"
                    className="icon-button danger-text"
                    onClick={() => remove(index)}
                    aria-label={tr("events.removeMemberNumber", {
                      number: index + 1,
                    })}
                  >
                    <Trash2 size={16} />
                  </button>
                )}
              </div>
              <div className="form-row">
                <Field
                  label={tr("common.firstName")}
                  error={form.formState.errors.members?.[index]?.name?.message}
                >
                  <input
                    {...form.register(`members.${index}.name`)}
                    placeholder={tr("events.personsName")}
                  />
                </Field>
                <Field label={tr("events.type")}>
                  <select {...form.register(`members.${index}.kind`)}>
                    <option value="adult">{tr("common.adult")}</option>
                    <option value="child">{tr("common.child")}</option>
                  </select>
                </Field>
              </div>
              <Field
                label={tr("events.individualNotesOptional")}
                error={form.formState.errors.members?.[index]?.notes?.message}
              >
                <input
                  {...form.register(`members.${index}.notes`)}
                  placeholder={tr("events.allergiesSpecialMealsAdditional")}
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
            {tr("events.addMember")}
          </button>
        )}
        <Field
          label={tr("events.invitationNotesOptional")}
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
            {tr("common.cancel")}
          </button>
          <button className="button" disabled={form.formState.isSubmitting}>
            {form.formState.isSubmitting
              ? tr("common.saving")
              : invitation
                ? tr("common.saveChanges")
                : tr("events.createInvitation")}
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
  // El idioma lo dan el dominio y su prefijo (publicOrigin los incluye), sin ?lang=.
  const url = `${runtime.publicOrigin}/i/${invitation.token}`,
    message = tr(
      "events.hiNameYoureInvited",
      { name: invitation.name, event: event.title, url },
    );
  const copy = async () => {
    try {
      await runtime.copy(url);
      setCopied(true);
      toast(tr("events.linkCopied"));
    } catch {
      toast(
        tr("events.couldntCopySelectLink"),
      );
    }
  };
  return (
    <Modal title={tr("events.goodThingsMeantShared")} onClose={onClose}>
      <p>
        {tr("events.invitationFor") + " "}
        <strong>{invitation.name}</strong>.
      </p>
      <div className="share-link">
        <input
          aria-label={tr("events.privateInvitationLink")}
          value={url}
          readOnly
          onFocus={(e) => e.target.select()}
        />
        <button
          className="icon-button"
          onClick={copy}
          aria-label={tr("events.copyLink")}
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
          href={`mailto:${invitation.email}?subject=${encodeURIComponent(tr("events.youreInvitedEvent", { event: event.title }))}&body=${encodeURIComponent(message)}`}
        >
          <Mail size={18} />
          {tr("common.email")}
        </a>
      </div>
      <a className="preview-link" href={url} target="_blank" rel="noreferrer">
        <ExternalLink size={16} />
        {tr("events.viewGuest")}
      </a>
      <p className="privacy-note">
        {tr(
          "events.linkAllowsAnyoneView",
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
        <p>{tr("events.loadingDashboard")}</p>
        <Link to="/eventos">{tr("common.back")}</Link>
      </div>
    );
  return (
    <div className="tv-page">
      <header>
        <LanguageSwitcher />
        <Link to={`/eventos/${id}`} className="button secondary">
          <ArrowLeft size={20} />
          {tr("events.backEvent")}
        </Link>
        <span>
          <span className="dot accepted" />
          {tr("events.live")}
        </span>
        <button
          className="button secondary"
          onClick={() => {
            if (document.fullscreenElement) void document.exitFullscreen();
            else void document.documentElement.requestFullscreen();
          }}
        >
          <Monitor size={20} />
          {tr("events.fullScreen")}
        </button>
      </header>
      <main>
        <p className="greeting">{tr("events.wereSoGladYoure")}</p>
        <h1>{event.title}</h1>
        <p className="tv-date">
          {dateText(event.date, event.timeZone)} · {event.location}
        </p>
        <Stats metrics={event.metrics} />
        <AttendanceBar metrics={event.metrics} />
        <p className="tv-footer">
          {tr("common.adultsCount", { count: event.metrics.adults })} ·{" "}
          {tr("common.childrenCount", { count: event.metrics.children })} ·{" "}
          {tr("common.invitationsCount", { count: event.metrics.invitations })}
        </p>
      </main>
    </div>
  );
}
