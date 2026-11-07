import { tr, Lines } from "./i18n";
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
  Heart,
  PartyPopper,
  MapPin,
  Sparkles,
  Trash2,
} from "lucide-react";
import {
  themes,
  emptyMetrics,
  type Metrics,
  type UserPostcard,
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
import { PostcardCanvas } from "./postcard-canvas";
import { ConfirmDelete } from "./provider";
import { Button } from "./ui/button";
import { ToggleGroup, ToggleGroupItem } from "./ui/toggle-group";
export function Dashboard() {
  const { user, events, notifications, api, setUser, toast } = useApp(),
    navigate = useNavigate(),
    [demoBusy, setDemoBusy] = useState(false);
  // Una cuenta registrada abre la demostración desde su espacio
  const exploreDemo = async () => {
    setDemoBusy(true);
    try {
      setUser(await api.demo());
      navigate("/events");
    } catch (e) {
      toast(errorText(e));
    } finally {
      setDemoBusy(false);
    }
  };
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
            {tr("common.helloName", { name: user?.firstName ?? "" })}{" "}
            <span className="greeting-spark">
              <Sparkles size={16} />
            </span>
          </p>
          <h1>{tr("dashboard.lifeBetterCelebratedTogether")}</h1>
          <p>
            {tr(
              "dashboard.spacePlansPeopleWho",
            )}
          </p>
        </div>
        {user && !user.isDemo && (
          <Button variant="outline" disabled={demoBusy} onClick={exploreDemo}>
            {tr("common.exploreDemo")}
          </Button>
        )}
        <Button asChild><Link to="/eventos/nuevo">
          <Plus size={18} />
          {tr("dashboard.createEvent")}
        </Link></Button>
      </div>
      {user?.isDemo && (
        <div className="demo-notice" role="note">
          <p>
            {tr(
              "dashboard.exploringDemoEventsTheir",
            )}
          </p>
          <Button asChild><Link to="/pago" className="demo-pay">
            {tr("pricing.payService")}
            <ArrowRight size={16} />
          </Link></Button>
          <Link to="/registro">
            {tr("common.createMyAccount")}
            <ArrowRight size={16} />
          </Link>
        </div>
      )}
      <section className="welcome-banner">
        <div className="welcome-copy">
          <h2>
            <Lines k="dashboard.welcomeTitle" />
          </h2>
          <p>
            {tr("dashboard.invitationsStyleAllFavorite")} <br />
            {tr("dashboard.everyDetailTakenCare")}
          </p>
          <Button asChild variant="celebrate"><Link to="/disenos">
            {tr("dashboard.findInvitation") + " "}
            <ArrowUpRight size={18} />
          </Link></Button>
        </div>
        <div className="welcome-photo">
          <img
            src="/site/photos/events/mesa-gracias-960.webp"
            srcSet="/site/photos/events/mesa-gracias-480.webp 480w, /site/photos/events/mesa-gracias-960.webp 960w"
            sizes="(min-width: 1024px) 40vw, 100vw"
            alt={tr(
              "dashboard.celebrationTableColorfulFlowers",
            )}
            fetchPriority="high"
          />
          <div className="photo-note">
            <span>
              <Heart size={19} />
            </span>
            <div>
              <strong>{tr("dashboard.detailsMakeParty")}</strong>
              <small>{tr("dashboard.beingTogetherWhatMatters")}</small>
            </div>
          </div>
        </div>
        <div className="banner-flower" aria-hidden="true">
          <Sparkles size={40} />
        </div>
      </section>
      <div className="summary-label">
        <h2>{tr("dashboard.celebrationsGlance")}</h2>
        <span>
          <span className="dot accepted" />
          {tr("dashboard.liveUpdates")}
        </span>
      </div>
      <Stats metrics={metrics} />
      <section className="events-section">
        <SectionHeading title={tr("dashboard.upcomingEvents")}>
          <ArrowLink to="/eventos">
            {tr("dashboard.viewAll") + " "}
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
            title={tr("dashboard.nextStoryStartsHere")}
            action={
              <Button asChild><Link to="/eventos/nuevo">
                <Plus size={17} />
                {tr("common.createFirstEvent")}
              </Link></Button>
            }
          >
            {tr(
              "dashboard.pickDateInviteFavorite",
            )}
          </Empty>
        )}
      </section>
      <div className="dashboard-lower">
        <section className="activity-section">
          <SectionHeading title={tr("dashboard.latestUpdates")}>
            <ArrowLink to="/notificaciones">{tr("dashboard.viewActivity")}</ArrowLink>
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
              {tr("dashboard.whenSomeoneRepliesYoull")}
            </p>
          )}
        </section>
        <section className="inspiration-strip">
          <div>
            <span className="tiny-flowers">
              <PartyPopper size={25} />
            </span>
            <h2>
              <Lines k="dashboard.designsTitle" />
            </h2>
            <p>
              <Lines k="dashboard.designsText" />
            </p>
            <ArrowLink to="/disenos">{tr("dashboard.exploreDesigns")}</ArrowLink>
          </div>
          <div className="mini-invites" aria-hidden="true">
            <div className="mini-invite mint">
              <Heart size={24} />
              <strong>
                <Lines k="dashboard.miniWedding" />
              </strong>
              <span>Sofía & Alejandro</span>
            </div>
            <div className="mini-invite rose">
              <PartyPopper size={23} />
              <strong>
                <Lines k="dashboard.miniParty" />
              </strong>
              <span>{tr("dashboard.letGoodTimesBegin")}</span>
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
          <h1>{tr("common.events")}</h1>
          <p>
            {tr("dashboard.everyCelebrationAllDetails")}
          </p>
        </div>
        <Button asChild><Link to="/eventos/nuevo">
          <Plus size={18} />
          {tr("dashboard.createEvent")}
        </Link></Button>
      </div>
      <div className="list-toolbar">
        <ToggleGroup
          type="single"
          variant="tabs"
          className="tabs"
          aria-label={tr("dashboard.filterEvents")}
          value={filter}
          onValueChange={(value) => value && setFilter(value)}
        >
          {[
            ["active", tr("dashboard.upcoming")],
            ["past", tr("dashboard.past")],
            ["archived", tr("events.filters.archived")],
          ].map(([id, label]) => (
            <ToggleGroupItem key={id} value={id}>
              {label}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
        <label className="search-field">
          <Search size={18} />
          <input
            placeholder={tr("dashboard.searchEvents")}
            aria-label={tr("dashboard.searchEvents")}
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
          title={tr("dashboard.nothingHereYet")}
          action={
            filter === "active" ? (
              <Button asChild><Link to="/eventos/nuevo">
                {tr("dashboard.createEvent")}
              </Link></Button>
            ) : undefined
          }
        >
          {tr("dashboard.tryAnotherSearchPlan")}
        </Empty>
      )}
    </>
  );
}
/** Postales propias guardadas: cada una abre su editor y se puede borrar. */
function MyPostcards({ postcards, onRemove }: { postcards: UserPostcard[]; onRemove: (postcard: UserPostcard) => void }) {
  return (
    <section className="my-postcards" aria-labelledby="my-postcards-title">
      <h2 id="my-postcards-title">{tr("dashboard.myPostcards")}</h2>
      <ul className="my-postcards-grid">
        {postcards.map((postcard) => {
          const date = dateText(postcard.updatedAt, Intl.DateTimeFormat().resolvedOptions().timeZone, { day: "numeric", month: "short", year: "numeric" });
          return (
            <li key={postcard.id}>
              <Link to={`/disenos/${postcard.id}`} aria-label={tr("dashboard.editPostcard", { date })}>
                <PostcardCanvas design={postcard.design} photos={postcard.photos} />
              </Link>
              <div className="my-postcards-caption">
                <span>{tr("dashboard.postcardSavedOn", { date })}</span>
                <Button type="button" variant="ghost" size="icon" aria-label={tr("dashboard.deletePostcard", { date })} onClick={() => onRemove(postcard)}>
                  <Trash2 size={18} aria-hidden />
                </Button>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

export function TemplatesPage() {
  const [preview, setPreview] = useState<(typeof themes)[number] | null>(null);
  const [postcards, setPostcards] = useState<UserPostcard[]>([]);
  const [removing, setRemoving] = useState<UserPostcard | null>(null);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");
  const { api, online, toast } = useApp();
  const navigate = useNavigate();
  useEffect(() => {
    if (!online) return;
    let alive = true;
    api.postcardDesigns().then((list) => alive && setPostcards(list)).catch((e) => alive && setError(errorText(e)));
    return () => {
      alive = false;
    };
  }, [api, online]);
  const designOwn = async () => {
    setCreating(true);
    setError("");
    try {
      const postcard = await api.createPostcardDesign();
      navigate(`/disenos/${postcard.id}`);
    } catch (e) {
      setError(errorText(e));
      setCreating(false);
    }
  };
  return (
    <>
      <div className="page-heading">
        <div>
          <h1>{tr("dashboard.invitationsPersonality")}</h1>
          <p>
            {tr("dashboard.waysSayWant")}
          </p>
        </div>
        <span className="soft-label">
          <PaletteIcon />
          {tr("dashboard.designsCelebrate", { count: themes.length })}
        </span>
      </div>
      <div className="templates-create-own">
        <div>
          <h2>{tr("dashboard.designOwnTitle")}</h2>
          <p>{tr("dashboard.designOwnDescription")}</p>
        </div>
        <Button type="button" disabled={creating || !online} onClick={() => void designOwn()}>
          {tr("dashboard.designOwnAction")}
        </Button>
      </div>
      {error && <ErrorBox message={error} />}
      {postcards.length > 0 && <MyPostcards postcards={postcards} onRemove={setRemoving} />}
      <div className="templates-grid">
        {themes.map((t) => (
          <article className={`template-card theme-${t.id}`} key={t.id}>
            <button
              className="template-preview"
              onClick={() => setPreview(t)}
              aria-label={tr("dashboard.previewTheme", {
                theme: tr(t.name),
              })}
            >
              <InvitationArt
                event={{
                  title: tr(t.previewTitle),
                  date: "2026-12-12T23:00:00Z",
                  timeZone: "America/Mexico_City",
                  location: tr("dashboard.specialPlace"),
                  theme: t.id,
                }}
              />
            </button>
            <div className="template-caption">
              <div>
                <h2>{tr(t.name)}</h2>
                <p>{tr(t.description)}</p>
              </div>
              <Button asChild variant="ghost" size="icon"><Link
                to={`/eventos/nuevo?tema=${t.id}`}
                aria-label={tr("dashboard.useTheme", { theme: tr(t.name) })}
              >
                <ArrowUpRight size={23} />
              </Link></Button>
            </div>
          </article>
        ))}
      </div>
      {removing && (
        <ConfirmDelete
          text={tr("dashboard.confirmDeletePostcard")}
          onClose={() => setRemoving(null)}
          onConfirm={async () => {
            await api.removePostcardDesign(removing.id);
            setPostcards((list) => list.filter((postcard) => postcard.id !== removing.id));
            setRemoving(null);
            toast(tr("dashboard.postcardDeleted"));
          }}
        />
      )}
      {preview && (
        <Modal title={tr(preview.name)} onClose={() => setPreview(null)}>
          <InvitationArt
            event={{
              title: tr("dashboard.nextGreatCelebration"),
              date: "2026-12-12T23:00:00Z",
              timeZone: "America/Mexico_City",
              location: tr("dashboard.placeChoose"),
              theme: preview.id,
            }}
          />
          <p className="muted">
            {tr(
              "dashboard.makeYoursEventName",
            )}
          </p>
          <Button asChild><Link
            className="full"
            to={`/eventos/nuevo?tema=${preview.id}`}
          >
            {tr("dashboard.createEventDesign")}
            <ArrowRight size={17} />
          </Link></Button>
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
      toast(tr("dashboard.notificationsMarkedRead"));
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
          <h1>{tr("dashboard.goodNewsComesHere")}</h1>
          <p>{tr("dashboard.repliesAttendanceUpdatesFrom")}</p>
        </div>
        <Button variant="outline"
          disabled={busy || !notifications.some((n) => !n.read)}
          onClick={mark}
        >
          <CheckCheck size={18} />
          {tr("dashboard.markAllRead")}
        </Button>
      </div>
      <ToggleGroup
        type="single"
        variant="tabs"
        className="tabs"
        value={onlyUnread ? "unread" : "all"}
        onValueChange={(value) => value && setOnlyUnread(value === "unread")}
      >
        <ToggleGroupItem value="all">{tr("common.allFeminine")}</ToggleGroupItem>
        <ToggleGroupItem value="unread">
          {tr("dashboard.unreadCount", {
            count: notifications.filter((n) => !n.read).length,
          })}
        </ToggleGroupItem>
      </ToggleGroup>
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
                <span className="dot accepted" aria-label={tr("dashboard.unread")} />
              )}
            </Link>
          ))}
        </div>
      ) : (
        <Empty title={tr("dashboard.youreAllCaught")}>
          {tr("dashboard.newRepliesAppearHere")}
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
          <h1>{tr("dashboard.fromIdeaParty")}</h1>
          <p>
            {tr("dashboard.everythingNeedBringPeople")}
          </p>
        </div>
      </div>
      <div className="help-content">
        <section>
          <h2>{tr("dashboard.step1ShapeEvent")}</h2>
          <p>
            {tr(
              "dashboard.chooseCreateEventAdd",
            )}
          </p>
          <Link className="text-link" to="/eventos/nuevo">
            {tr("common.createMyEvent")}
            <ArrowRight size={16} />
          </Link>
        </section>
        <section>
          <h2>{tr("dashboard.step2BuildGuestList")}</h2>
          <p>
            {tr(
              "dashboard.addIndividualFamilyInvitations",
            )}
          </p>
        </section>
        <section>
          <h2>{tr("dashboard.step3ShareInvitation")}</h2>
          <p>
            {tr(
              "dashboard.eachInvitationHasOwn",
            )}
          </p>
        </section>
        <section>
          <h2>{tr("dashboard.step4GetTheirReplies")}</h2>
          <p>
            {tr(
              "dashboard.guestsDontNeedAccount",
            )}
          </p>
        </section>
        <section>
          <h2>{tr("dashboard.demoWorkspace")}</h2>
          <p>
            {tr(
              "dashboard.demoNamesEventsLocations",
            )}
          </p>
          <Link className="text-link" to="/registro">
            {tr("common.createMyAccount")}
            <ArrowRight size={16} />
          </Link>
        </section>
      </div>
    </>
  );
}
