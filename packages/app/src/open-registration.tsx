import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, Trash2 } from "lucide-react";
import { tr } from "./i18n";
import { useApp, errorText } from "./context";
import { ErrorBox } from "./components";
import { openInvitationLimits, type Status } from "@tuevento/contracts";

type Person = { name: string; kind: "adult" | "child"; status: Status };
const emptyPerson = (): Person => ({ name: "", kind: "adult", status: "pending" });

/**
 * Invitación genérica: el invitado escribe sus propios datos y personas, y se crea
 * su invitación ya respondida. Después se le lleva a su propia invitación.
 */
export function OpenRegistration({ token }: { token: string }) {
  const { api, toast } = useApp(),
    navigate = useNavigate(),
    [name, setName] = useState(""),
    [email, setEmail] = useState(""),
    [phone, setPhone] = useState(""),
    [notes, setNotes] = useState(""),
    [people, setPeople] = useState<Person[]>([emptyPerson()]),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const update = (index: number, change: Partial<Person>) =>
    setPeople((list) => list.map((p, i) => (i === index ? { ...p, ...change } : p)));
  const submit = async () => {
    setBusy(true);
    setError("");
    try {
      const { token: own } = await api.registerInvitation(token, {
        name,
        email,
        phone,
        notes,
        kind: people.length > 1 ? "family" : "individual",
        members: people.map((p) => ({ ...p, notes: "" })),
      });
      toast(tr("registration.saved"));
      navigate(`/i/${own}`);
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="rsvp-form open-registration">
      <h2>{tr("registration.title")}</h2>
      <p>{tr("registration.intro")}</p>
      <label className="field">
        <span>{tr("registration.name")}</span>
        <input value={name} maxLength={120} onChange={(e) => setName(e.target.value)} />
      </label>
      <label className="field">
        <span>{tr("registration.email")}</span>
        <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
      </label>
      <label className="field">
        <span>{tr("registration.phone")}</span>
        <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} />
      </label>
      <h3>{tr("registration.people")}</h3>
      {people.map((p, index) => (
        <fieldset className="rsvp-member" key={index}>
          <legend>{tr("registration.personNumber", { number: index + 1 })}</legend>
          <label className="field">
            <span>{tr("registration.personName")}</span>
            <input value={p.name} maxLength={50} onChange={(e) => update(index, { name: e.target.value })} />
          </label>
          <div className="form-row">
            <label className="field">
              <span>{tr("registration.personKind")}</span>
              <select value={p.kind} onChange={(e) => update(index, { kind: e.target.value as Person["kind"] })}>
                <option value="adult">{tr("common.adult")}</option>
                <option value="child">{tr("common.child")}</option>
              </select>
            </label>
            <label className="field">
              <span>{tr("registration.personStatus")}</span>
              <select value={p.status} onChange={(e) => update(index, { status: e.target.value as Status })}>
                <option value="accepted">{tr("status.accepted")}</option>
                <option value="declined">{tr("status.declined")}</option>
                <option value="pending">{tr("status.pending")}</option>
              </select>
            </label>
          </div>
          {people.length > 1 && (
            <button type="button" className="text-button" onClick={() => setPeople((l) => l.filter((_, i) => i !== index))}>
              <Trash2 size={15} />
              {tr("registration.removePerson")}
            </button>
          )}
        </fieldset>
      ))}
      {people.length < openInvitationLimits.members && (
        <button type="button" className="button secondary" onClick={() => setPeople((l) => [...l, emptyPerson()])}>
          <Plus size={16} />
          {tr("registration.addPerson")}
        </button>
      )}
      {error && <ErrorBox message={error} />}
      <button className="button full" onClick={submit} disabled={busy}>
        {busy ? tr("registration.sending") : tr("registration.submit")}
      </button>
    </div>
  );
}
