import { tr, LanguageSwitcher, RichText } from "./i18n";
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
import { Logo, Avatar, ErrorBox } from "./components";
import { PostcardCanvas } from "./postcard-canvas";
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
        <p role="status">{tr("rsvp.openingInvitation")}</p>
      </div>
    );
  if (!invitation)
    return (
      <div className="startup">
        <Logo />
        <h1>{tr("rsvp.couldntFindInvitation")}</h1>
        <ErrorBox message={error} />
        <p>{tr("rsvp.askHostShareLink")}</p>
        <Link className="button secondary" to="/registro">
          {tr("rsvp.createOwnEvent")}
        </Link>
      </div>
    );
  const event = invitation.event;
  return (
    <div className="public-page">
      <header className="public-header">
        <Logo />
        <LanguageSwitcher />
        <span>{tr("rsvp.goodReasonTogether")}</span>
      </header>
      {invitation.isDemo && (
        <div className="public-demo">
          {tr(
            "rsvp.demoInvitationNamesDetails",
          )}
        </div>
      )}
      <main className="rsvp-layout">
        <section className="public-art">
          <PostcardCanvas design={invitation.postcard.design} photos={invitation.postcard.photos} />
          <div className="host-signature">
            <Avatar user={invitation.host} />
            <div>
              <small>{tr("rsvp.withLove")}</small>
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
          <h1>{tr("rsvp.wouldntSameWithout")}</h1>
          <p className="rsvp-greeting">
            <RichText
              k="rsvp.greeting"
              values={{ name: invitation.name }}
              components={{ strong: <strong /> }}
            />
          </p>
          <h2 className="rsvp-event-title">{event.title}</h2>
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
                  {tr("rsvp.viewLocation")}
                  <ExternalLink size={13} />
                </a>
              </p>
            </div>
          </div>
          {event.description && (
            <p className="host-message">{event.description}</p>
          )}
          <div className="rsvp-form">
            <h2>{tr("rsvp.joinUs")}</h2>
            <p>
              {invitation.members.length > 1
                ? tr("rsvp.confirmAttendanceEachMember")
                : tr(
                    "rsvp.chooseReplySaveChange",
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
                {tr("rsvp.everyoneAttending")}
              </button>
            )}
            <div className="rsvp-members">
              {invitation.members.map((m) => (
                <fieldset className="rsvp-member" key={m.id}>
                  <legend>
                    {m.name}
                    <small>
                      {m.kind === "child" ? tr("common.child") : tr("common.adult")}
                    </small>
                  </legend>
                  <div className="rsvp-options">
                    {(
                      [
                        {
                          value: "accepted",
                          label: tr("rsvp.yesIllThere"),
                          icon: Check,
                        },
                        {
                          value: "declined",
                          label: tr("rsvp.cantMake"),
                          icon: X,
                        },
                        {
                          value: "pending",
                          label: tr("status.pending"),
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
                  <strong>{tr("rsvp.replySaved")}</strong>
                  <span>
                    {tr(
                      "rsvp.hostSeeNowChange",
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
                ? tr("rsvp.savingReply")
                : saved
                  ? tr("rsvp.replySavedShort")
                  : tr("rsvp.saveReply")}
              <Check size={18} />
            </button>
            <small className="rsvp-no-account">
              {tr("rsvp.noAccountNeededJust")}
            </small>
          </div>
        </section>
      </main>
      <section className="public-cta">
        <div>
          <h2>{tr("rsvp.nowTurnCelebrate")}</h2>
          <p>
            {tr("rsvp.createSpecialInvitationNext")}
          </p>
        </div>
        <Link className="button" to="/registro">
          {tr("rsvp.createOwnEvent")}
          <ArrowRight size={17} />
        </Link>
      </section>
      <footer className="public-footer">
        {tr("rsvp.loveTueventofun") + " "}
        <Heart size={13} />
      </footer>
    </div>
  );
}
const CheckCheckIcon = () => <CheckCircle2 size={16} />;
