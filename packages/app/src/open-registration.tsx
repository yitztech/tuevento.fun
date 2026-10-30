import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, Trash2 } from "lucide-react";
import { tr } from "./i18n";
import { useApp, errorText } from "./context";
import { ErrorBox, Field } from "./components";
import { openInvitationLimits, type Status } from "@tuevento/contracts";
import { Input } from "./ui/input";
import { NativeSelect } from "./ui/native-select";
import { Button } from "./ui/button";

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
      <Field label={tr("registration.name")}>
        <Input value={name} maxLength={120} onChange={(e) => setName(e.target.value)} />
      </Field>
      <Field label={tr("registration.email")}>
        <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
      </Field>
      <Field label={tr("registration.phone")}>
        <Input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} />
      </Field>
      <h3>{tr("registration.people")}</h3>
      {people.map((p, index) => (
        <fieldset className="rsvp-member" key={index}>
          <legend>{tr("registration.personNumber", { number: index + 1 })}</legend>
          <Field label={tr("registration.personName")}>
            <Input value={p.name} maxLength={50} onChange={(e) => update(index, { name: e.target.value })} />
          </Field>
          <div className="form-row">
            <Field label={tr("registration.personKind")}>
              <NativeSelect value={p.kind} onChange={(e) => update(index, { kind: e.target.value as Person["kind"] })}>
                <option value="adult">{tr("common.adult")}</option>
                <option value="child">{tr("common.child")}</option>
              </NativeSelect>
            </Field>
            <Field label={tr("registration.personStatus")}>
              <NativeSelect value={p.status} onChange={(e) => update(index, { status: e.target.value as Status })}>
                <option value="accepted">{tr("status.accepted")}</option>
                <option value="declined">{tr("status.declined")}</option>
                <option value="pending">{tr("status.pending")}</option>
              </NativeSelect>
            </Field>
          </div>
          {people.length > 1 && (
            <Button variant="link" size="inline" type="button" onClick={() => setPeople((l) => l.filter((_, i) => i !== index))}>
              <Trash2 size={15} />
              {tr("registration.removePerson")}
            </Button>
          )}
        </fieldset>
      ))}
      {people.length < openInvitationLimits.members && (
        <Button variant="outline" type="button" onClick={() => setPeople((l) => [...l, emptyPerson()])}>
          <Plus size={16} />
          {tr("registration.addPerson")}
        </Button>
      )}
      {error && <ErrorBox message={error} />}
      <Button className="full" onClick={submit} disabled={busy}>
        {busy ? tr("registration.sending") : tr("registration.submit")}
      </Button>
    </div>
  );
}
