import { tr, formatLocale, useLocale, LanguageSwitcher } from "./i18n";
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
import { AuthPage, ProfilePage } from "./account";
import { PublicRsvp } from "./public-rsvp";
import { LegalPage, legalPageFor } from "./legal";
export type { Runtime } from "./context";
export { SeoLinks } from "./i18n";
export function TuEventoApp({ runtime }: { runtime: Runtime }) {
  const { locale } = useLocale();
  // <html lang> lo fija el gateway según el dominio; aquí solo el título.
  useEffect(() => {
    document.title =
      locale === "en"
        ? "TuEventoFun · A good reason to celebrate"
        : "TuEventoFun · Un buen motivo para celebrar";
  }, [locale]);
  const api = useMemo(
    () =>
      new EventApi({
        baseUrl: runtime.apiBase,
        fetch: runtime.fetch,
        platform: runtime.platform,
        appVersion: runtime.appVersion,
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
  const isPublic = location.pathname.startsWith("/i/") || legal !== null,
    isAuth = ["/registro", "/acceso"].includes(location.pathname);
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
          if (!isPublic && !isAuth && c.demoEnabled && (!runtime.platform || runtime.platform === "web")) u = await api.demo();
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
        <div className="loading-dots" aria-label={tr("Cargando")} />
        <p>{tr("Preparando buenos momentos…")}</p>
      </div>
    );
  if (error)
    return (
      <div className="startup">
        <Logo />
        <ErrorBox message={error} />
        <button className="button" onClick={() => window.location.reload()}>
          {tr("Volver a intentar")}
        </button>
      </div>
    );
  const unread = notifications.filter((n) => !n.read).length;
  const navigation = [
    ...(user?.isOwner ? [{ to: "/administracion", text: tr("Panel del sistema"), icon: LayoutDashboard }] : []),
    { to: "/app", text: tr("Mi resumen"), icon: LayoutDashboard },
    { to: "/eventos", text: tr("Mis eventos"), icon: CalendarDays },
    { to: "/invitados", text: tr("Invitados"), icon: Users },
    { to: "/disenos", text: tr("Diseños de invitación"), icon: Palette },
    { to: "/notificaciones", text: tr("Notificaciones"), icon: Bell },
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
      ) : isPublic ? (
        <Routes>
          <Route path="/i/:token" element={<PublicRsvp />} />
        </Routes>
      ) : isAuth ? (
        <AuthPage
          key={location.pathname}
          registerMode={location.pathname === "/registro"}
        />
      ) : !user ? (
        <Navigate to="/acceso" replace />
      ) : location.pathname.endsWith("/pantalla") ? (
        <Routes>
          <Route path="/eventos/:id/pantalla" element={<TvPage />} />
        </Routes>
      ) : (
        <div className="app-shell">
          <a className="skip-link" href="#main">
            {tr("Saltar al contenido")}
          </a>
          {menu && (
            <button
              className="mobile-scrim"
              aria-label={tr("Cerrar navegación")}
              onClick={() => setMenu(false)}
            />
          )}
          <aside className={`sidebar ${menu ? "open" : ""}`}>
            <div className="sidebar-logo">
              <Logo to="/app" />
              <button
                className="icon-button mobile-only"
                aria-label={tr("Cerrar menú")}
                onClick={() => setMenu(false)}
              >
                <X />
              </button>
            </div>
            <div className="workspace-label">
              <span className="workspace-dot" />
              {tr("Tu espacio para celebrar")}
            </div>
            <nav aria-label={tr("Navegación principal")}>
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
                  {tr("Los buenos momentos")}
                  <br />
                  {tr("se comparten.")}
                </strong>
                <p>
                  {tr("Tú pones el motivo.")}
                  <br />
                  {tr("Nosotros, la invitación.")}
                </p>
                <Link to="/eventos/nuevo">
                  {tr("Vamos a celebrar") + " "}
                  <ArrowUpRightIcon />
                </Link>
              </div>
              {user.isDemo && (
                <Link to="/registro" className="demo-label">
                  <span className="dot pending" />
                  {tr("Espacio de demostración")}
                  <ChevronRight size={14} />
                </Link>
              )}
              <NavLink className="side-secondary" to="/ayuda">
                <CircleHelp size={18} />
                {tr("Ayuda y primeros pasos")}
              </NavLink>
              <NavLink className="side-secondary" to="/perfil">
                <Settings size={18} />
                {tr("Mi perfil")}
              </NavLink>
              <div className="sidebar-profile">
                <Avatar user={user} />
                <div>
                  <strong>
                    {user.firstName} {user.lastName}
                  </strong>
                  <span>
                    {user.isDemo ? tr("Cuenta de ejemplo") : tr("Anfitrión")}
                  </span>
                </div>
                <button
                  className="icon-button"
                  onClick={logout}
                  aria-label={tr("Cerrar sesión")}
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
                  aria-label={tr("Abrir menú")}
                >
                  <Menu />
                </button>
                <span>{tr("Mi espacio")}</span>
                <ChevronRight size={13} />
                <strong>
                  {navigation.find(
                    (n) =>
                      n.to !== "/app" && location.pathname.startsWith(n.to),
                  )?.text ||
                    (location.pathname === "/perfil"
                      ? tr("Mi perfil")
                      : tr("Mi resumen"))}
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
                  aria-label={tr("Notificaciones, {{count}} sin leer", {
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
                <Link to="/perfil" aria-label={tr("Mi perfil")}>
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
                <Route path="/disenos" element={<TemplatesPage />} />
                <Route path="/invitados" element={<AllGuests />} />
                <Route path="/notificaciones" element={<NotificationsPage />} />
                <Route path="/perfil" element={<ProfilePage />} />
                <Route path="/ayuda" element={<HelpPage />} />
                <Route
                  path="*"
                  element={
                    <div className="empty">
                      <h1>{tr("No encontramos esta página")}</h1>
                      <Link className="button" to="/app">
                        {tr("Volver al resumen")}
                      </Link>
                    </div>
                  }
                />
              </Routes>
            </main>
            <footer className="app-footer">
              <span>{tr("Hecho para reunir a tus personas favoritas.")}</span>
              <span>
                TuEventoFun <Heart size={12} />
              </span>
            </footer>
          </div>
        </div>
      )}
      {message && (
        <div className="toast" role="status">
          {tr(message)}
          <button
            className="icon-button"
            onClick={() => setMessage("")}
            aria-label={tr("Cerrar aviso")}
          >
            <X size={17} />
          </button>
        </div>
      )}
    </AppContext.Provider>
  );
}
const ArrowUpRightIcon = () => <ArrowRight size={16} />;
