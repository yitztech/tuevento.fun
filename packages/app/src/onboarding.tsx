import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { ArrowRight, MailCheck } from "lucide-react";
import { Controller, useForm, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { AccountType } from "@tuevento/contracts";
import { accountTypes, addPhoneSchema, validationOptions } from "@tuevento/contracts";
import { getLocale, tr } from "./i18n";
import { errorText, useApp } from "./context";
import { AuthShell } from "./account";
import { ErrorBox } from "./components";
import { NeedsConnection } from "./offline";
import { PhoneField } from "./phone-field";
import { Button } from "./ui/button";

/** Primer paso tras registrarse: sin el correo confirmado, la app no pasa de aquí. */
export function VerifyEmailGate({ onLogout }: { onLogout: () => void }) {
  const { api, user, setUser, online } = useApp(),
    [sent, setSent] = useState(false),
    [waiting, setWaiting] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  /** Consulta la cuenta: el enlace suele abrirse en otra pestaña o en otro dispositivo. */
  const refresh = async () => {
    const current = await api.me();
    setUser(current);
    return !current.mustVerifyEmail;
  };
  useEffect(() => {
    const onReturn = () => {
      if (document.visibilityState === "visible") void refresh().catch(() => {});
    };
    document.addEventListener("visibilitychange", onReturn);
    return () => document.removeEventListener("visibilitychange", onReturn);
  }, []);
  const run = async (action: () => Promise<void>) => {
    setBusy(true);
    setError("");
    try {
      await action();
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  };
  const check = () => run(async () => setWaiting(!(await refresh())));
  const resend = () =>
    run(async () => {
      await api.resendVerification();
      setSent(true);
      setWaiting(false);
    });
  return (
    <AuthShell side="register">
      <h2>{tr("onboarding.verifyTitle")}</h2>
      <div className="success-box" role="status">
        <MailCheck size={22} />
        <div>
          <span>
            {sent
              ? tr("account.verificationSent", { email: user?.email ?? "" })
              : tr("onboarding.verifyIntro", { email: user?.email ?? "" })}
          </span>
        </div>
      </div>
      {waiting && <p role="status">{tr("onboarding.verifyPending")}</p>}
      {error && <ErrorBox message={error} />}
      <NeedsConnection online={online} />
      <div className="onboarding-actions">
        <Button className="full" disabled={busy || !online} onClick={() => void check()}>
          {tr("onboarding.verifyDone")}
          <ArrowRight size={18} />
        </Button>
        {!sent && (
          <Button variant="outline" className="full" disabled={busy || !online} onClick={() => void resend()}>
            {tr("account.resendVerification")}
          </Button>
        )}
        <Button variant="ghost" className="full" disabled={!online} onClick={onLogout}>
          {tr("app.signOut")}
        </Button>
      </div>
    </AuthShell>
  );
}

const typeText = {
  organizer: () => ({ title: tr("account.organizerTitle"), hint: tr("account.organizerHint") }),
  provider: () => ({ title: tr("account.providerTitle"), hint: tr("account.providerHint") }),
  agency: () => ({ title: tr("account.agencyTitle"), hint: tr("account.agencyHint") }),
} satisfies Record<AccountType, () => { title: string; hint: string }>;

/** Segundo paso, con el correo ya confirmado: cada tipo de cuenta sigue a su bienvenida. */
export function ChooseAccountType() {
  const { api, setUser, online } = useApp(),
    { pathname } = useLocation(),
    navigate = useNavigate(),
    [type, setType] = useState<AccountType | null>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!type) return;
    setBusy(true);
    setError("");
    try {
      const updated = await api.chooseAccountType(type);
      // Conectar una app o un asistente es un paso en curso: se sigue ahí
      if (!pathname.startsWith("/conectar-")) navigate("/bienvenida", { replace: true });
      setUser(updated);
    } catch (e) {
      setError(errorText(e));
      setBusy(false);
    }
  };
  return (
    <AuthShell side="register">
      <form onSubmit={(event) => void submit(event)}>
        <fieldset className="account-type">
          <legend>
            <h2>{tr("account.accountTypeLegend")}</h2>
          </legend>
          {accountTypes.map((option) => {
            const { title, hint } = typeText[option]();
            return (
              <label key={option} className="account-type-option">
                <input
                  type="radio"
                  name="accountType"
                  value={option}
                  checked={type === option}
                  onChange={() => setType(option)}
                />
                <span>
                  <strong>{title}</strong>
                  <small>{hint}</small>
                </span>
              </label>
            );
          })}
        </fieldset>
        {error && <ErrorBox message={error} />}
        <NeedsConnection online={online} />
        <Button className="full" disabled={!type || busy || !online}>
          {busy ? tr("account.justMoment") : tr("onboarding.continue")}
          <ArrowRight size={18} />
        </Button>
      </form>
    </AuthShell>
  );
}

/** Registro con Google, tras elegir el tipo: Google no da el teléfono y aquí se pide, válido. */
export function AddPhone() {
  const { api, setUser, online } = useApp(),
    { pathname } = useLocation(),
    navigate = useNavigate(),
    [error, setError] = useState("");
  const form = useForm<{ phone: string }>({
    resolver: zodResolver(addPhoneSchema, validationOptions(getLocale())) as Resolver<{ phone: string }>,
    defaultValues: { phone: "" },
  });
  const submit = form.handleSubmit(async (data) => {
    setError("");
    try {
      const updated = await api.addPhone(data.phone);
      // Conectar una app o un asistente es un paso en curso: se sigue ahí
      if (!pathname.startsWith("/conectar-")) navigate("/bienvenida", { replace: true });
      setUser(updated);
    } catch (e) {
      setError(errorText(e));
    }
  });
  return (
    <AuthShell side="register">
      <form onSubmit={(event) => void submit(event)} noValidate>
        <h2>{tr("onboarding.phoneTitle")}</h2>
        <p>{tr("onboarding.phoneIntro")}</p>
        <Controller
          control={form.control}
          name="phone"
          render={({ field }) => (
            <PhoneField
              label={tr("common.phone")}
              placeholder={tr("account.placeholderPhone")}
              error={form.formState.errors.phone?.message}
              value={field.value}
              onChange={field.onChange}
            />
          )}
        />
        {error && <ErrorBox message={error} />}
        <NeedsConnection online={online} />
        <Button className="full" disabled={form.formState.isSubmitting || !online}>
          {form.formState.isSubmitting ? tr("account.justMoment") : tr("onboarding.continue")}
          <ArrowRight size={18} />
        </Button>
      </form>
    </AuthShell>
  );
}

const welcomeText = {
  organizer: () => ({
    title: tr("onboarding.organizerTitle"),
    intro: tr("onboarding.organizerIntro"),
    steps: [tr("onboarding.organizerStep1"), tr("onboarding.organizerStep2"), tr("onboarding.organizerStep3")],
    action: tr("common.createMyEvent"),
    to: "/eventos/nuevo",
  }),
  provider: () => ({
    title: tr("onboarding.providerTitle"),
    intro: tr("onboarding.providerIntro"),
    steps: [tr("onboarding.providerStep1"), tr("onboarding.providerStep2"), tr("onboarding.providerStep3")],
    action: tr("onboarding.providerAction"),
    to: "/negocio",
  }),
  agency: () => ({
    title: tr("onboarding.agencyTitle"),
    intro: tr("onboarding.agencyIntro"),
    steps: [tr("onboarding.agencyStep1"), tr("onboarding.agencyStep2"), tr("onboarding.agencyStep3")],
    action: tr("onboarding.agencyAction"),
    to: "/eventos/nuevo",
  }),
} satisfies Record<AccountType, () => { title: string; intro: string; steps: string[]; action: string; to: string }>;

/** Bienvenida privada de cada tipo de cuenta: primeros pasos y la acción con la que empezar. */
export function WelcomePage() {
  const { user } = useApp();
  if (!user) return null;
  const { title, intro, steps, action, to } = welcomeText[user.accountType]();
  return (
    <section className="welcome-page">
      <h1>{title}</h1>
      <p>{intro}</p>
      <ol>
        {steps.map((step) => (
          <li key={step}>{step}</li>
        ))}
      </ol>
      <Button asChild>
        <Link to={to}>
          {action}
          <ArrowRight size={18} />
        </Link>
      </Button>
    </section>
  );
}
