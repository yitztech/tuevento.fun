import { validationOptions } from "@tuevento/contracts";
import { tr, getLocale, LanguageSwitcher, Lines } from "./i18n";
import { useEffect, useRef, useState } from "react";
import {
  Link,
  useNavigate,
  useLocation,
  useSearchParams,
} from "react-router-dom";
import { useForm, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  registerSchema,
  loginSchema,
  profileSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  passwordResetPaths,
  themeIds,
  type RegisterInput,
  type ProfileInput,
} from "@tuevento/contracts";
import {
  ArrowRight,
  ArrowLeft,
  Upload,
  Check,
  Eye,
  EyeOff,
  ShieldCheck,
  Heart,
  MailCheck,
} from "lucide-react";
import { useApp, errorText } from "./context";
import { Logo, Field, ErrorBox, Avatar, Container, Card } from "./components";
import { AuthLegalNotice } from "./legal";
function usePostAuthTarget() {
  const [query] = useSearchParams();
  const challenge = query.get("appChallenge");
  if (challenge && /^[A-Za-z0-9_-]{43}$/.test(challenge)) return `/conectar-app?challenge=${challenge}`;
  const theme = query.get("tema");
  if (theme && (themeIds as readonly string[]).includes(theme))
    return `/eventos/nuevo?tema=${theme}`;
  return query.get("empezar") === "evento" ? "/eventos/nuevo" : "/app";
}
async function readAvatar(file: File): Promise<string> {
  if (file.size > 2 * 1024 * 1024)
    throw new Error(tr("account.chooseImageNoLarger"));
  if (!["image/jpeg", "image/png", "image/webp"].includes(file.type))
    throw new Error(tr("account.chooseJpgPngWebp"));
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error(tr("account.couldntReadImage")));
    reader.readAsDataURL(file);
  });
}
/** Marco común de las pantallas de acceso: historia a la izquierda, formulario a la derecha. */
function AuthShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="auth-layout">
      <section className="auth-story">
        <Logo />
        <div>
          <span className="auth-heart">
            <Heart size={30} />
          </span>
          <h1>
            <Lines k="account.heroTitle" />
          </h1>
          <p>
            {tr("account.inviteGatherCelebrate")}
            <br />
            {tr("account.memoriesStartHere")}
          </p>
        </div>
        <img
          src="/images/gold.jpg"
          alt={tr("account.flowersGlassesTableSet")}
        />
        <span className="auth-story-footer">
          {tr("account.tueventofunMadeSharedMoments")}
        </span>
      </section>
      <section className="auth-form-wrap">
        <div className="auth-language">
          <LanguageSwitcher />
        </div>
        <Link className="back-link" to="/">
          <ArrowLeft size={16} />
          {tr("common.backHome")}
        </Link>
        <Container width="auth" className="auth-form">
          {children}
        </Container>
      </section>
    </div>
  );
}
export function AuthPage({ registerMode }: { registerMode: boolean }) {
  const postAuthTarget = usePostAuthTarget();
  const { search } = useLocation();
  const { api, setUser, config, toast } = useApp(),
    navigate = useNavigate(),
    [error, setError] = useState(""),
    [showPassword, setShowPassword] = useState(false),
    [avatar, setAvatar] = useState(""),
    [demoBusy, setDemoBusy] = useState(false);
  const form = useForm<RegisterInput>({
    resolver: zodResolver(
      registerMode ? registerSchema : loginSchema,
      validationOptions(getLocale()),
    ) as unknown as Resolver<RegisterInput>,
    defaultValues: {
      firstName: "",
      lastName: "",
      phone: "",
      email: "",
      username: "",
      password: "",
    },
  });
  const submit = form.handleSubmit(async (data) => {
    setError("");
    try {
      let user = registerMode
        ? await api.register(data)
        : await api.login(data.email, data.password);
      if (registerMode && avatar) {
        try {
          user = await api.avatar(avatar);
        } catch (e) {
          toast(
            tr(
              "account.accountReadyErrorAdd",
              { error: errorText(e) },
            ),
          );
        }
      }
      setUser(user);
      navigate(postAuthTarget);
    } catch (e) {
      setError(errorText(e));
    }
  });
  const demo = async () => {
    setDemoBusy(true);
    try {
      setUser(await api.demo());
      navigate("/app");
    } catch (e) {
      setError(errorText(e));
    } finally {
      setDemoBusy(false);
    }
  };
  return (
    <AuthShell>
          <h2>
            {registerMode
              ? tr("account.startSomethingWonderful")
              : tr("account.goodSeeAgain")}
          </h2>
          <p>
            {registerMode
              ? tr("account.createAccountPlanFirst")
              : tr("account.eventsPeopleWaiting")}
          </p>
          <GoogleLogin onError={setError} />
          <div className="or-divider">
            <span>{tr("account.continueEmail")}</span>
          </div>
          <form onSubmit={submit} noValidate>
            {registerMode && (
              <>
                <Field
                  label={tr("account.firstNames")}
                  error={form.formState.errors.firstName?.message}
                >
                  <input
                    autoComplete="given-name"
                    {...form.register("firstName")}
                  />
                </Field>
                <Field
                  label={tr("account.lastNames")}
                  error={form.formState.errors.lastName?.message}
                >
                  <input
                    autoComplete="family-name"
                    {...form.register("lastName")}
                  />
                </Field>
                <div className="form-row">
                  <Field
                    label={tr("common.phone")}
                    error={form.formState.errors.phone?.message}
                  >
                    <input
                      type="tel"
                      autoComplete="tel"
                      {...form.register("phone")}
                    />
                  </Field>
                  <Field
                    label={tr("common.username")}
                    error={form.formState.errors.username?.message}
                  >
                    <input
                      autoComplete="username"
                      {...form.register("username")}
                    />
                  </Field>
                </div>
              </>
            )}
            <Field
              label={tr("common.email")}
              error={form.formState.errors.email?.message}
            >
              <input
                type="email"
                autoComplete="email"
                {...form.register("email")}
              />
            </Field>
            <Field
              label={tr("common.password")}
              error={form.formState.errors.password?.message}
              hint={
                registerMode
                  ? tr("account.least10CharactersUse")
                  : undefined
              }
            >
              <span className="password-input">
                <input
                  type={showPassword ? "text" : "password"}
                  autoComplete={
                    registerMode ? "new-password" : "current-password"
                  }
                  {...form.register("password")}
                />
                <button
                  type="button"
                  className="icon-button"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={
                    showPassword
                      ? tr("account.hidePassword")
                      : tr("account.showPassword")
                  }
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </span>
            </Field>
            {!registerMode && (
              <p className="auth-forgot">
                <Link to={passwordResetPaths.request}>
                  {tr("account.forgotPassword")}
                </Link>
              </p>
            )}
            {registerMode && (
              <label className="upload-inline">
                {avatar ? (
                  <img src={avatar} alt={tr("account.avatarPreview")} />
                ) : (
                  <Upload size={20} />
                )}
                <span>
                  {tr("account.photoLogo")}{" "}
                  <small>{tr("account.optionalJpgPngWebp")}</small>
                </span>
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  aria-label={tr("account.uploadProfileImage")}
                  onChange={async (e) => {
                    if (e.target.files?.[0])
                      try {
                        setAvatar(await readAvatar(e.target.files[0]));
                        setError("");
                      } catch (error) {
                        setError(errorText(error));
                      }
                  }}
                />
              </label>
            )}
            {error && <ErrorBox message={error} />}
            <button
              className="button full"
              disabled={form.formState.isSubmitting}
            >
              {form.formState.isSubmitting
                ? tr("account.justMoment")
                : registerMode
                  ? tr("common.createMyAccount")
                  : tr("common.signSpace")}
              <ArrowRight size={18} />
            </button>
          </form>
          <p className="auth-switch">
            {registerMode
              ? tr("account.alreadyHaveAccount")
              : tr("account.firstTimeHere")}{" "}
            <Link to={`${registerMode ? "/acceso" : "/registro"}${search}`}>
              {registerMode ? tr("account.signIn") : tr("account.createAccount")}
            </Link>
          </p>
          {config.demoEnabled && (
            <button className="demo-button" disabled={demoBusy} onClick={demo}>
              {demoBusy
                ? tr("account.gettingDemoReady")
                : tr("common.exploreDemo")}
              <ArrowRight size={16} />
            </button>
          )}
          <AuthLegalNotice registerMode={registerMode} />
    </AuthShell>
  );
}
/** Pide el enlace para elegir contraseña nueva. Llega en el idioma de este dominio. */
export function ForgotPasswordPage() {
  const { api } = useApp(),
    [error, setError] = useState(""),
    [sent, setSent] = useState("");
  const form = useForm<{ email: string }>({
    resolver: zodResolver(forgotPasswordSchema, validationOptions(getLocale())),
    defaultValues: { email: "" },
  });
  const submit = form.handleSubmit(async ({ email }) => {
    setError("");
    try {
      setSent((await api.forgotPassword(email)).message);
    } catch (e) {
      setError(errorText(e));
    }
  });
  return (
    <AuthShell>
      <h2>{tr("account.getBackIntoAccount")}</h2>
      <p>
        {tr(
          "account.enterAccountEmailWell",
        )}
      </p>
      {sent ? (
        <div className="success-box" role="status">
          <MailCheck size={22} />
          <div>
            <strong>{tr("account.checkEmail")}</strong>
            <span>{sent}</span>
          </div>
        </div>
      ) : (
        <form onSubmit={submit} noValidate>
          <Field
            label={tr("common.email")}
            error={form.formState.errors.email?.message}
          >
            <input type="email" autoComplete="email" {...form.register("email")} />
          </Field>
          {error && <ErrorBox message={error} />}
          <button className="button full" disabled={form.formState.isSubmitting}>
            {form.formState.isSubmitting
              ? tr("account.justMoment")
              : tr("account.sendMeLink")}
            <ArrowRight size={18} />
          </button>
        </form>
      )}
      <p className="auth-switch">
        {tr("account.remembered")} <Link to="/acceso">{tr("account.signIn")}</Link>
      </p>
    </AuthShell>
  );
}
/** Elige la contraseña nueva desde el enlace del correo. */
export function ResetPasswordPage() {
  const { api, setUser, toast } = useApp(),
    navigate = useNavigate(),
    [query] = useSearchParams(),
    [error, setError] = useState(""),
    [showPassword, setShowPassword] = useState(false);
  // El token se lee una vez y se quita de la barra de direcciones y del historial
  const [token] = useState(() => query.get("token") || "");
  useEffect(() => {
    if (query.has("token"))
      window.history.replaceState(window.history.state, "", passwordResetPaths.reset);
  }, []);
  const form = useForm<{ token: string; password: string }>({
    resolver: zodResolver(resetPasswordSchema, validationOptions(getLocale())),
    defaultValues: { token, password: "" },
  });
  const submit = form.handleSubmit(async (data) => {
    setError("");
    try {
      setUser(await api.resetPassword(data.token, data.password));
      toast(tr("account.donePasswordChangedOther"));
      navigate("/app");
    } catch (e) {
      setError(errorText(e));
    }
  });
  const invalid = !/^[A-Za-z0-9_-]{43}$/.test(token);
  return (
    <AuthShell>
      <h2>{tr("account.chooseNewPassword")}</h2>
      {invalid ? (
        <>
          <ErrorBox message="common.passwordResetLinkInvalid" />
          <Link className="button full" to={passwordResetPaths.request}>
            {tr("account.requestNewLink")}
            <ArrowRight size={18} />
          </Link>
        </>
      ) : (
        <>
          <p>{tr("account.savingSignOutOther")}</p>
          <form onSubmit={submit} noValidate>
            <Field
              label={tr("account.newPassword")}
              error={form.formState.errors.password?.message}
              hint={tr("account.least10CharactersUse")}
            >
              <span className="password-input">
                <input
                  type={showPassword ? "text" : "password"}
                  autoComplete="new-password"
                  {...form.register("password")}
                />
                <button
                  type="button"
                  className="icon-button"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={
                    showPassword ? tr("account.hidePassword") : tr("account.showPassword")
                  }
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </span>
            </Field>
            {error && (
              <>
                <ErrorBox message={error} />
                <p className="auth-forgot">
                  <Link to={passwordResetPaths.request}>{tr("account.requestNewLink")}</Link>
                </p>
              </>
            )}
            <button className="button full" disabled={form.formState.isSubmitting}>
              {form.formState.isSubmitting ? tr("account.justMoment") : tr("account.saveAndSignIn")}
              <ArrowRight size={18} />
            </button>
          </form>
        </>
      )}
    </AuthShell>
  );
}
function GoogleLogin({ onError }: { onError: (error: string) => void }) {
  const postAuthTarget = usePostAuthTarget();
  const { api, setUser, config, runtime } = useApp(),
    navigate = useNavigate(),
    ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!config.googleClientId || runtime.startNativeLogin) return;
    let active = true;
    const init = async () => {
      try {
        const { nonce } = await api.googleNonce();
        if (!active) return;
        const google = (window as any).google;
        google.accounts.id.initialize({
          client_id: config.googleClientId,
          nonce,
          callback: async ({ credential }: { credential: string }) => {
            try {
              setUser(await api.google(credential, nonce));
              navigate(postAuthTarget);
            } catch (e) {
              onError(errorText(e));
            }
          },
        });
        google.accounts.id.renderButton(ref.current, {
          theme: "outline",
          size: "large",
          width: 360,
          text: "continue_with",
          locale: getLocale(),
        });
      } catch (e) {
        onError(errorText(e));
      }
    };
    let script = document.querySelector<HTMLScriptElement>(
      "script[data-google-signin]",
    );
    if ((window as any).google) void init();
    else {
      if (!script) {
        script = document.createElement("script");
        script.src = "https://accounts.google.com/gsi/client";
        script.async = true;
        script.dataset.googleSignin = "1";
        document.head.appendChild(script);
      }
      script.addEventListener("load", init);
      script.addEventListener("error", () =>
        onError(
          tr(
            "account.couldntConnectGoogleUse",
          ),
        ),
      );
    }
    return () => {
      active = false;
      script?.removeEventListener("load", init);
    };
  }, [config.googleClientId, getLocale(), postAuthTarget]);
  if (runtime.startNativeLogin && config.googleClientId) return <button type="button" className="google-button" onClick={() => { void runtime.startNativeLogin!().catch(e=>onError(errorText(e))); }}>{tr("account.continueGoogle")}</button>;
  if (!config.googleClientId)
    return (
      <div className="google-unavailable">
        <button type="button" className="google-button" disabled>
          <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
            <path
              d="M21 12.2c0-.7-.1-1.3-.2-1.9H12v3.6h5a4.3 4.3 0 0 1-1.9 2.8v2.3h3.1c1.8-1.7 2.8-4 2.8-6.8Z"
              fill="#4285f4"
            />
            <path
              d="M12 21c2.5 0 4.6-.8 6.2-2.1l-3.1-2.3c-.8.5-1.8.8-3.1.8-2.4 0-4.5-1.6-5.2-3.8H3.6v2.4A9.4 9.4 0 0 0 12 21Z"
              fill="#34a853"
            />
            <path
              d="M6.8 13.6a5.6 5.6 0 0 1 0-3.2V8H3.6a9 9 0 0 0 0 8Z"
              fill="#fbbc05"
            />
            <path
              d="M12 6.6c1.4 0 2.6.5 3.5 1.3l2.6-2.5A9 9 0 0 0 3.6 8l3.2 2.4A5.5 5.5 0 0 1 12 6.6Z"
              fill="#ea4335"
            />
          </svg>
          {tr("account.continueGoogle")}
        </button>
        <small>{tr("account.signOptionIsntEnabled")}</small>
      </div>
    );
  return <div ref={ref} className="google-container" />;
}
export function ProfilePage() {
  const { user, api, setUser, toast } = useApp(),
    [error, setError] = useState(""),
    [uploading, setUploading] = useState(false);
  const form = useForm<ProfileInput>({
    resolver: zodResolver(
      profileSchema,
      validationOptions(getLocale()),
    ) as Resolver<ProfileInput>,
    defaultValues: {
      firstName: user?.firstName,
      lastName: user?.lastName,
      phone: user?.phone,
      username: user?.username,
    },
  });
  if (!user) return null;
  const submit = form.handleSubmit(async (data) => {
    setError("");
    try {
      setUser(await api.profile(data));
      toast(tr("account.profileUpdated"));
    } catch (e) {
      setError(errorText(e));
    }
  });
  return (
    <>
      <div className="page-heading">
        <div>
          <h1>{tr("account.heartCelebration")}</h1>
          <p>{tr("account.howGuestsSee")}</p>
        </div>
      </div>
      <div className="profile-layout">
        <aside className="profile-identity">
          <Avatar user={user} size="big" />
          <h2>
            {user.firstName} {user.lastName}
          </h2>
          <p>
            {user.isDemo ? tr("account.demoHost") : tr("common.host")}
          </p>
          <label className="button secondary upload-button">
            <Upload size={17} />
            {uploading ? tr("common.loadingEllipsis") : tr("account.changePhotoLogo")}
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              aria-label={tr("account.changePhotoLogo")}
              disabled={uploading}
              onChange={async (e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                setUploading(true);
                setError("");
                try {
                  setUser(await api.avatar(await readAvatar(file)));
                  toast(tr("account.imageUpdated"));
                } catch (error) {
                  setError(errorText(error));
                } finally {
                  setUploading(false);
                }
              }}
            />
          </label>
          <small>{tr("account.jpgPngWebp2")}</small>
        </aside>
        <form onSubmit={submit} className="form-panel" noValidate>
          <h2>{tr("account.yourInformation")}</h2>
          <div className="form-row">
            <Field
              label={tr("common.firstName")}
              error={form.formState.errors.firstName?.message}
            >
              <input {...form.register("firstName")} />
            </Field>
            <Field
              label={tr("common.lastName")}
              error={form.formState.errors.lastName?.message}
            >
              <input {...form.register("lastName")} />
            </Field>
          </div>
          <Field label={tr("common.email")}>
            <input value={user.email} readOnly type="email" />
          </Field>
          <div className="form-row">
            <Field
              label={tr("common.phone")}
              error={form.formState.errors.phone?.message}
            >
              <input type="tel" {...form.register("phone")} />
            </Field>
            <Field
              label={tr("common.username")}
              error={form.formState.errors.username?.message}
            >
              <input {...form.register("username")} />
            </Field>
          </div>
          {error && <ErrorBox message={error} />}
          <div className="form-actions">
            <button className="button" disabled={form.formState.isSubmitting}>
              {form.formState.isSubmitting
                ? tr("common.saving")
                : tr("common.saveChanges")}
              <Check size={17} />
            </button>
          </div>
        </form>
      </div>
    </>
  );
}
