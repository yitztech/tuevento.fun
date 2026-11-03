import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import type { OutboxOperation } from "@tuevento/client";
import type { Event, Invitation } from "@tuevento/contracts";
import { tr, trMessage } from "./i18n";
import { dateText, errorText, useApp } from "./context";
import { Empty, ErrorBox } from "./components";
import { NeedsConnection } from "./offline";
import { Button } from "./ui/button";

type Row = { label: string; value: string };

const text = (value: unknown) => (typeof value === "string" && value.trim() ? value : tr("offline.emptyValue"));

/** Campos que se comparan, con la misma forma para la versión del teléfono y la del servidor. */
function rows(operation: OutboxOperation, data: Partial<Event & Invitation> | null): Row[] {
  if (!data) return [];
  if (operation.entity.kind === "event")
    return [
      { label: tr("events.eventName"), value: text(data.title) },
      {
        label: tr("events.dateTime"),
        value: data.date
          ? dateText(data.date, data.timeZone, { day: "numeric", month: "long", year: "numeric", hour: "numeric", minute: "2-digit" })
          : tr("offline.emptyValue"),
      },
      { label: tr("events.whereMeeting"), value: text(data.location) },
      { label: tr("events.messageGuests"), value: text(data.description) },
      { label: tr("events.cancelEvent"), value: data.cancelled ? tr("offline.cancelledYes") : tr("offline.cancelledNo") },
    ];
  return [
    { label: tr("events.invitationName"), value: text(data.name) },
    { label: tr("offline.fieldPeople"), value: text((data.members ?? []).map((m) => m.name).join(", ")) },
    { label: tr("offline.fieldContact"), value: text([data.email, data.phone].filter(Boolean).join(" · ")) },
  ];
}

function Versions({ operation, saved }: { operation: OutboxOperation; saved: Event | Invitation | null }) {
  const mine = rows(operation, operation.body as Partial<Event & Invitation>);
  const theirs = rows(operation, saved);
  return (
    <div className="sync-versions">
      <section>
        <h3>{tr("offline.yourVersion")}</h3>
        <dl>
          {mine.map((row) => (
            <div key={row.label} className={theirs.find((t) => t.label === row.label)?.value !== row.value ? "changed" : ""}>
              <dt>{row.label}</dt>
              <dd>{row.value}</dd>
            </div>
          ))}
        </dl>
      </section>
      <section>
        <h3>{tr("offline.savedVersion")}</h3>
        {saved ? (
          <dl>
            {theirs.map((row) => (
              <div key={row.label}>
                <dt>{row.label}</dt>
                <dd>{row.value}</dd>
              </div>
            ))}
          </dl>
        ) : (
          <p>{tr("offline.savedMissing")}</p>
        )}
      </section>
    </div>
  );
}

function Change({ operation }: { operation: OutboxOperation }) {
  const { offline, online, toast } = useApp();
  const [saved, setSaved] = useState<Event | Invitation | null | undefined>(undefined),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const conflict = operation.state === "conflict";
  useEffect(() => {
    if (!online || !offline || !conflict) return;
    let alive = true;
    offline
      .saved(operation)
      .then((value) => alive && setSaved(value))
      .catch((e) => alive && setError(errorText(e)));
    return () => {
      alive = false;
    };
  }, [operation.id, online, conflict]);
  if (!offline) return null;
  const act = async (action: () => Promise<void>, done: string) => {
    setBusy(true);
    setError("");
    try {
      await action();
      toast(done);
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  };
  const kind =
    operation.entity.kind === "event"
      ? tr("offline.kindEvent")
      : operation.entity.kind === "invitation"
        ? tr("offline.kindInvitation")
        : tr("offline.kindNotifications");
  const title = (operation.body as { title?: string; name?: string } | undefined);
  return (
    <article className="sync-change">
      <header>
        <span className="soft-label">{kind}</span>
        <h2>{title?.title || title?.name || kind}</h2>
      </header>
      {conflict ? (
        !online ? (
          <p>{tr("offline.reviewNeedsConnection")}</p>
        ) : saved === undefined && !error ? (
          <p role="status">{tr("offline.loadingSaved")}</p>
        ) : saved !== undefined ? (
          <Versions operation={operation} saved={saved} />
        ) : null
      ) : (
        <>
          <h3>{tr("offline.failedTitle")}</h3>
          {operation.error && <ErrorBox message={trMessage(operation.error)} />}
        </>
      )}
      {error && <ErrorBox message={error} />}
      <div className="form-actions">
        <Button
          variant="outline"
          disabled={!online || busy}
          onClick={() => act(() => offline.keepSaved(operation), tr("offline.usedSaved"))}
        >
          {conflict ? tr("offline.useSaved") : tr("offline.discardChange")}
        </Button>
        {conflict && (
          <Button disabled={!online || busy || saved === undefined} onClick={() => act(() => offline.keepMine(operation), tr("offline.keptMine"))}>
            {tr("offline.keepMine")}
          </Button>
        )}
      </div>
      <NeedsConnection online={online} />
    </article>
  );
}

/** Cambios hechos sin conexión que el servidor no aceptó: conflictos de versión y errores. */
export function SyncReview() {
  const { offline } = useApp();
  const review = offline?.queue.filter((o) => o.state !== "pending") ?? [];
  return (
    <>
      <Link className="back-link" to="/app">
        <ArrowLeft size={16} />
        {tr("app.backOverview")}
      </Link>
      <div className="page-heading">
        <div>
          <h1>{tr("offline.conflictsTitle")}</h1>
          <p>{tr("offline.conflictsIntro")}</p>
        </div>
      </div>
      {review.length ? (
        <div className="sync-list">
          {review.map((operation) => (
            <Change key={operation.id} operation={operation} />
          ))}
        </div>
      ) : (
        <Empty title={tr("offline.nothingToReview")}>{""}</Empty>
      )}
    </>
  );
}
