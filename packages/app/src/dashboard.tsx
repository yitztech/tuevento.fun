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
        <Link to="/eventos/nuevo" className="button">
          <Plus size={18} />
          {tr("dashboard.createEvent")}
        </Link>
      </div>
      {user?.isDemo && (
        <div className="demo-notice" role="note">
          <p>
            {tr(
              "dashboard.exploringDemoEventsTheir",
            )}
          </p>
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
          <Link to="/disenos" className="button pink">
            {tr("dashboard.findInvitation") + " "}
            <ArrowUpRight size={18} />
          </Link>
        </div>
        <div className="welcome-photo">
          <img
            src="/images/gold.jpg"
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
              <Link className="button" to="/eventos/nuevo">
                <Plus size={17} />
                {tr("common.createFirstEvent")}
              </Link>
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
        <Link className="button" to="/eventos/nuevo">
          <Plus size={18} />
          {tr("dashboard.createEvent")}
        </Link>
      </div>
      <div className="list-toolbar">
        <div className="tabs" aria-label={tr("dashboard.filterEvents")}>
          {[
            ["active", tr("dashboard.upcoming")],
            ["past", tr("dashboard.past")],
            ["archived", tr("events.filters.archived")],
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
              <Link to="/eventos/nuevo" className="button">
                {tr("dashboard.createEvent")}
              </Link>
            ) : undefined
          }
        >
          {tr("dashboard.tryAnotherSearchPlan")}
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
          <h1>{tr("dashboard.invitationsPersonality")}</h1>
          <p>
            {tr("dashboard.sixWaysSayWant")}
          </p>
        </div>
        <span className="soft-label">
          <PaletteIcon />
          {tr("dashboard.step6DesignsCelebrate")}
        </span>
      </div>
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
                  title:
                    t.id === "floral"
                      ? tr("dashboard.doForever")
                      : t.id === "kids"
                        ? tr("dashboard.makeWish")
                        : t.id === "neon"
                          ? tr("dashboard.tonightOurs")
                          : t.id === "tropical"
                            ? tr("dashboard.underSameSun")
                            : t.id === "gold"
                              ? tr("dashboard.nightRemember")
                              : tr("dashboard.celebrateSimpleThings"),
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
              <Link
                className="icon-button"
                to={`/eventos/nuevo?tema=${t.id}`}
                aria-label={tr("dashboard.useTheme", { theme: tr(t.name) })}
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
          <Link
            className="button full"
            to={`/eventos/nuevo?tema=${preview.id}`}
          >
            {tr("dashboard.createEventDesign")}
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
        <button
          className="button secondary"
          disabled={busy || !notifications.some((n) => !n.read)}
          onClick={mark}
        >
          <CheckCheck size={18} />
          {tr("dashboard.markAllRead")}
        </button>
      </div>
      <div className="tabs">
        <button
          className={!onlyUnread ? "active" : ""}
          onClick={() => setOnlyUnread(false)}
        >
          {tr("common.allFeminine")}
        </button>
        <button
          className={onlyUnread ? "active" : ""}
          onClick={() => setOnlyUnread(true)}
        >
          {tr("dashboard.unreadCount", {
            count: notifications.filter((n) => !n.read).length,
          })}
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
          <h1>{tr("dashboard.favoritePeople")}</h1>
          <p>
            {tr(
              "dashboard.viewAllInvitationsOpen",
            )}
          </p>
        </div>
        <span className="soft-label">
          <Users size={17} />
          {tr("dashboard.peopleInvitedCount", {
            count: rows.reduce((n, i) => n + i.members.length, 0),
          })}
        </span>
      </div>
      <label className="search-field standalone">
        <Search size={18} />
        <input
          placeholder={tr("dashboard.searchPeopleFamilies")}
          aria-label={tr("dashboard.searchPeopleFamilies")}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </label>
      {loading ? (
        <p role="status">{tr("dashboard.loadingGuests")}</p>
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
                {tr("common.peopleCount", { count: i.members.length })}
              </span>
              <ArrowUpRight size={18} />
            </Link>
          ))}
        </div>
      ) : (
        <Empty
          title={tr("dashboard.letsMakeGuestList")}
          action={
            <Link className="button" to="/eventos">
              {tr("dashboard.goEvents")}
            </Link>
          }
        >
          {tr("dashboard.addGuestsEachEvent")}
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
