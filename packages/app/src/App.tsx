import { tr, formatLocale, getLocale, useLocale, LanguageSwitcher, Lines } from "./i18n";
import { useEffect, useState, useMemo, useCallback, useRef } from "react";
import {
  Routes,
  Route,
  Link,
  NavLink,
  useNavigate,
  useLocation,
  Navigate,
} from "react-router-dom";
import {
  LayoutDashboard,
  CalendarDays,
  Users,
  Palette,
  Bell,
  Settings,
  LogOut,
  Menu,
  X,
  ArrowRight,
  Plus,
  Heart,
  CircleHelp,
  ChevronRight,
} from "lucide-react";
import { EventApi, ApiError } from "@tuevento/client";
import type { User, Event, Notification } from "@tuevento/contracts";
import { AppContext, type Runtime, errorText } from "./context";
import { Logo, Avatar, ErrorBox } from "./components";
import {
  Dashboard,
  EventsPage,
  TemplatesPage,
  NotificationsPage,
  AllGuests,
  HelpPage,
} from "./dashboard";
import { EventEditor, EventDetail, TvPage } from "./event-pages";
import { MobileConnect } from "./mobile-connect";
import { OwnerDashboard } from "./owner";
import {
  AuthPage,
  ProfilePage,
  ForgotPasswordPage,
  ResetPasswordPage,
} from "./account";
import { localizedPage, passwordResetPaths } from "@tuevento/contracts";
import { PublicRsvp } from "./public-rsvp";
import { PostcardEditor } from "./postcard-editor";
import { LegalPage, legalPageFor } from "./legal";
import { PaymentPage, PricingPage } from "./pricing";
export type { Runtime } from "./context";
export { SeoLinks, getLocale, switchAppLocale, tr } from "./i18n";
export function TuEventoApp({ runtime }: { runtime: Runtime }) {
  const { locale } = useLocale();
  // <html lang> lo fija el gateway según el dominio; aquí solo el título.
  useEffect(() => {
    document.title = tr("app.documentTitle");
  }, [locale]);
  const api = useMemo(
    () =>
      new EventApi({
        baseUrl: runtime.apiBase,
        fetch: runtime.fetch,
        platform: runtime.platform,
        appVersion: runtime.appVersion,
        // Las apps nativas usan un solo dominio: la API responde en el idioma de la app
        locale: getLocale,
      }),
    [runtime],
  );
  const [user, setUser] = useState<User | null>(null),
    [events, setEvents] = useState<Event[]>([]),
    [notifications, setNotifications] = useState<Notification[]>([]),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [message, setMessage] = useState(""),
    [menu, setMenu] = useState(false),
    [config, setConfig] = useState({ googleClientId: "", demoEnabled: false });
  const location = useLocation(),
    navigate = useNavigate(),
    timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const legal = legalPageFor(location.pathname);
  const pricing = localizedPage(location.pathname) === "pricing";
  const isPublic = location.pathname.startsWith("/i/") || legal !== null || pricing,
    isAuth = [
      "/registro",
      "/acceso",
      passwordResetPaths.request,
      passwordResetPaths.reset,
    ].includes(location.pathname);
  const toast = useCallback((text: string) => {
    setMessage(text);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setMessage(""), 5000);
  }, []);
  const reload = useCallback(async () => {
    const [e, n] = await Promise.all([api.events(), api.notifications()]);
    setEvents(e);
    setNotifications(n);
  }, [api, locale]);
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const c = await api.config();
        if (alive) setConfig(c);
        let u: User | null = null;
        try {
          u = await api.me();
        } catch (e) {
          if (!(e instanceof ApiError && e.status === 401)) throw e;
        }
        if (alive) setUser(u);
      } catch (e) {
        if (alive) setError(errorText(e));
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
      clearTimeout(timer.current);
    };
  }, [api]);
  useEffect(() => {
    if (!user) return;
    void reload().catch((e) => toast(errorText(e)));
    const off = runtime.subscribe?.(() => {
      void reload().catch(() => {});
    });
    const timer = setInterval(() => {
      if (document.visibilityState === "visible") void reload().catch(() => {});
    }, 30000);
    return () => {
      off?.();
      clearInterval(timer);
    };
  }, [user?.id, reload, runtime, toast]);
  useEffect(() => {
    setMenu(false);
    window.scrollTo(0, 0);
  }, [location.pathname]);
  const context = {
    api,
    runtime,
    user,
    setUser,
    events,
    notifications,
    reload,
    toast,
    config,
  };
  if (loading)
    return (
      <div className="startup">
        <Logo />
        <div className="loading-dots" aria-label={tr("common.loading")} />
        <p>{tr("app.gettingGoodTimesReady")}</p>
      </div>
    );
  if (error)
    return (
      <div className="startup">
        <Logo />
        <ErrorBox message={error} />
        <button className="button" onClick={() => window.location.reload()}>
          {tr("app.tryAgain")}
        </button>
      </div>
    );
  const unread = notifications.filter((n) => !n.read).length;
  const navigation = [
    ...(user?.isOwner ? [{ to: "/administracion", text: tr("app.systemDashboard"), icon: LayoutDashboard }] : []),
    { to: "/app", text: tr("app.overview"), icon: LayoutDashboard },
    { to: "/eventos", text: tr("common.events"), icon: CalendarDays },
    { to: "/invitados", text: tr("app.guests"), icon: Users },
    { to: "/disenos", text: tr("app.invitationDesigns"), icon: Palette },
    { to: "/notificaciones", text: tr("app.notifications"), icon: Bell },
  ];
  const logout = async () => {
    try {
      await api.logout();
      setUser(null);
      setEvents([]);
      setNotifications([]);
      navigate("/acceso");
    } catch (e) {
      toast(errorText(e));
    }
  };
  return (
    <AppContext.Provider value={context}>
      {legal ? (
        <LegalPage page={legal} />
      ) : pricing ? (
        <PricingPage />
      ) : isPublic ? (
        <Routes>
          <Route path="/i/:token" element={<PublicRsvp />} />
        </Routes>
      ) : location.pathname === passwordResetPaths.request ? (
        <ForgotPasswordPage />
      ) : location.pathname === passwordResetPaths.reset ? (
        <ResetPasswordPage />
      ) : isAuth ? (
        <AuthPage
          key={location.pathname}
          registerMode={location.pathname === "/registro"}
        />
      ) : !user ? (
        <Navigate to="/acceso" replace />
      ) : location.pathname === "/pago" ? (
        <PaymentPage />
      ) : location.pathname.endsWith("/pantalla") ? (
        <Routes>
          <Route path="/eventos/:id/pantalla" element={<TvPage />} />
        </Routes>
      ) : (
        <div className="app-shell">
          <a className="skip-link" href="#main">
            {tr("common.skipContent")}
          </a>
          {menu && (
            <button
              className="mobile-scrim"
              aria-label={tr("app.closeNavigation")}
              onClick={() => setMenu(false)}
            />
          )}
          <aside className={`sidebar ${menu ? "open" : ""}`}>
            <div className="sidebar-logo">
              <Logo to="/app" />
              <button
                className="icon-button mobile-only"
                aria-label={tr("common.closeMenu")}
                onClick={() => setMenu(false)}
              >
                <X />
              </button>
            </div>
            <div className="workspace-label">
              <span className="workspace-dot" />
              {tr("app.spaceCelebrate")}
            </div>
            <nav aria-label={tr("app.mainNavigation")}>
              {navigation.map(({ to, text, icon: Icon }) => (
                <NavLink key={to} to={to} end={to === "/app"}>
                  <Icon size={19} />
                  <span>{text}</span>
                  {to === "/notificaciones" && unread > 0 && (
                    <b className="nav-count">{unread}</b>
                  )}
                  {to === "/eventos" && (
                    <b className="event-count">
                      {events.filter((e) => !e.archived).length}
                    </b>
                  )}
                </NavLink>
              ))}
            </nav>
            <div className="sidebar-bottom">
              <div className="celebrate-note">
                <Heart size={24} />
                <strong>
                  <Lines k="app.goodTimesShared" />
                </strong>
                <p>
                  <Lines k="app.occasionAndInvitation" />
                </p>
                <Link to="/eventos/nuevo">
                  {tr("app.letsCelebrate") + " "}
                  <ArrowUpRightIcon />
                </Link>
              </div>
              {user.isDemo && (
                <Link to="/registro" className="demo-label">
                  <span className="dot pending" />
                  {tr("app.demoWorkspace")}
                  <ChevronRight size={14} />
                </Link>
              )}
              <NavLink className="side-secondary" to="/ayuda">
                <CircleHelp size={18} />
                {tr("app.helpGettingStarted")}
              </NavLink>
              <NavLink className="side-secondary" to="/perfil">
                <Settings size={18} />
                {tr("app.profile")}
              </NavLink>
              <div className="sidebar-profile">
                <Avatar user={user} />
                <div>
                  <strong>
                    {user.firstName} {user.lastName}
                  </strong>
                  <span>
                    {user.isDemo ? tr("app.demoAccount") : tr("common.host")}
                  </span>
                </div>
                <button
                  className="icon-button"
                  onClick={logout}
                  aria-label={tr("app.signOut")}
                >
                  <LogOut size={18} />
                </button>
              </div>
            </div>
          </aside>
          <div className="main-shell">
            <header className="topbar">
              <div className="breadcrumb">
                <button
                  className="icon-button mobile-only"
                  onClick={() => setMenu(true)}
                  aria-label={tr("common.openMenu")}
                >
                  <Menu />
                </button>
                <span>{tr("app.space")}</span>
                <ChevronRight size={13} />
                <strong>
                  {navigation.find(
                    (n) =>
                      n.to !== "/app" && location.pathname.startsWith(n.to),
                  )?.text ||
                    (location.pathname === "/perfil"
                      ? tr("app.profile")
                      : tr("app.overview"))}
                </strong>
              </div>
              <div className="topbar-actions">
                <LanguageSwitcher />
                <span className="today">
                  {new Intl.DateTimeFormat(formatLocale(), {
                    day: "numeric",
                    month: "long",
                    year: "numeric",
                  }).format(new Date())}
                </span>
                <Link
                  className="bell-button icon-button"
                  to="/notificaciones"
                  aria-label={tr("app.notificationsCountUnread", {
                    count: unread,
                  })}
                >
                  <Bell size={20} />
                  {unread > 0 && (
                    <span aria-hidden="true">
                      {unread > 99 ? "99+" : unread}
                    </span>
                  )}
                </Link>
                <Link to="/perfil" aria-label={tr("app.profile")}>
                  <Avatar user={user} />
                </Link>
              </div>
            </header>
            <main id="main" className="main-content">
              <Routes>
                <Route path="/" element={<Navigate to="/app" replace />} />
                <Route path="/app" element={<Dashboard />} />
                <Route path="/conectar-app" element={<MobileConnect />} />
                <Route path="/administracion" element={<OwnerDashboard />} />
                <Route path="/eventos" element={<EventsPage />} />
                <Route path="/eventos/nuevo" element={<EventEditor />} />
                <Route path="/eventos/:id" element={<EventDetail />} />
                <Route path="/eventos/:id/editar" element={<EventEditor />} />
                <Route path="/eventos/:id/postal" element={<PostcardEditor />} />
                <Route path="/disenos" element={<TemplatesPage />} />
                <Route path="/invitados" element={<AllGuests />} />
                <Route path="/notificaciones" element={<NotificationsPage />} />
                <Route path="/perfil" element={<ProfilePage />} />
                <Route path="/ayuda" element={<HelpPage />} />
                <Route
                  path="*"
                  element={
                    <div className="empty">
                      <h1>{tr("app.couldntFindPage")}</h1>
                      <Link className="button" to="/app">
                        {tr("app.backOverview")}
                      </Link>
                    </div>
                  }
                />
              </Routes>
            </main>
            <footer className="app-footer">
              <span>{tr("common.madeBringFavoritePeople")}</span>
              <span>
                TuEventoFun <Heart size={12} />
              </span>
            </footer>
          </div>
        </div>
      )}
      {message && (
        <div className="toast" role="status">
          {message}
          <button
            className="icon-button"
            onClick={() => setMessage("")}
            aria-label={tr("app.dismissNotification")}
          >
            <X size={17} />
          </button>
        </div>
      )}
    </AppContext.Provider>
  );
}
const ArrowUpRightIcon = () => <ArrowRight size={16} />;
