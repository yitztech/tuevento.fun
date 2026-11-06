import { useEffect, useState, type ReactNode } from "react";
import { Link, useLocation } from "react-router-dom";
import { ArrowRight, Menu, X } from "lucide-react";
import { localizedPath } from "@tuevento/contracts";
import { cn } from "cn";
import { LanguageSwitcher, tr, useLocale } from "../../i18n";
import { LegalLinks } from "../../legal";
import { pricingPath } from "../../pricing";
import { Button } from "../button";
import { BrandLogo } from "./brand-logo";

const linkClass = "rounded-md px-1 py-2 text-[0.82rem] font-semibold whitespace-nowrap text-foreground/90 transition-colors hover:text-primary";
const primary = "/registro?empezar=evento";

/** Logo del sitio público. Las apps conservan su icono propio. */
export function SiteLogo({ compact = false }: { compact?: boolean }) {
  return (
    <Link to="/" className="inline-flex items-center" aria-label={tr("common.tueventofunHome")}>
      <BrandLogo size={compact ? "compact" : "default"} />
    </Link>
  );
}

export function SiteHeader() {
  const { locale } = useLocale();
  const [open, setOpen] = useState(false);
  const { pathname, hash } = useLocation();
  // biome-ignore lint/correctness/useExhaustiveDependencies: el menú se cierra al cambiar de ruta o de ancla
  useEffect(() => setOpen(false), [pathname, hash]);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);
  const close = () => setOpen(false);
  const links = [
    { to: { pathname: "/", hash: "#disenos" }, label: tr("landing.designs") },
    { to: { pathname: "/", hash: "#como-funciona" }, label: tr("landing.howWorks") },
    { to: localizedPath("providers", locale), label: tr("providerSearch.navLink") },
    { to: pricingPath(locale), label: tr("pricing.title") },
    { to: { pathname: "/", hash: "#preguntas" }, label: tr("landing.frequentlyAskedQuestions") },
  ];
  return (
    <header className="landing-header sticky top-0 z-40 bg-site/85 backdrop-blur-md">
      <a
        href="#contenido"
        className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50 focus:rounded-md focus:bg-card focus:px-3 focus:py-2 focus:font-bold focus:text-primary"
      >
        {tr("common.skipContent")}
      </a>
      <div className="mx-auto flex h-16 w-full max-w-site items-center justify-between gap-3 px-4 sm:px-6 lg:h-[4.5rem] lg:px-8">
        <SiteLogo />
        <nav
          id="site-navigation"
          aria-label={tr("landing.siteNavigation")}
          className={cn(
            "items-center gap-5 xl:flex",
            open
              ? "absolute inset-x-0 top-full flex flex-col items-stretch gap-1 border-t border-border/70 bg-site px-4 py-4 shadow-site-soft sm:px-6 xl:static xl:flex-row xl:items-center xl:gap-5 xl:border-0 xl:bg-transparent xl:p-0 xl:shadow-none"
              : "hidden",
          )}
        >
          <Link to="/acceso" onClick={close} className={cn(linkClass, "sm:hidden", open && "max-xl:flex max-xl:min-h-12 max-xl:items-center max-xl:px-3 max-xl:text-base max-xl:text-title")}>
            {tr("landing.logIn")}
          </Link>
          {links.map((l) => (
            <Link key={l.label} to={l.to} onClick={close} className={cn(linkClass, open && "max-xl:flex max-xl:min-h-12 max-xl:items-center max-xl:px-3 max-xl:text-base max-xl:text-title")}>
              {l.label}
            </Link>
          ))}
          <Link to="/descargas" onClick={close} className={cn(linkClass, "xl:hidden", open && "max-xl:flex max-xl:min-h-12 max-xl:items-center max-xl:px-3 max-xl:text-base max-xl:text-title")}>
            {tr("landing.downloadApp")}
          </Link>
        </nav>
        <div className="flex items-center gap-1.5 sm:gap-3">
          <LanguageSwitcher />
          <Link to="/acceso" className={cn(linkClass, "hidden sm:inline-block")}>
            {tr("landing.logIn")}
          </Link>
          <Button asChild size="sm" className="hidden sm:inline-flex">
            <Link to={primary}>
              {tr("landing.createEvent")}
              <ArrowRight aria-hidden />
            </Link>
          </Button>
          <Button
            variant="ghost"
            size="round"
            className="xl:hidden"
            aria-expanded={open}
            aria-controls="site-navigation"
            aria-label={open ? tr("common.closeMenu") : tr("common.openMenu")}
            onClick={() => setOpen((v) => !v)}
          >
            {open ? <X aria-hidden /> : <Menu aria-hidden />}
          </Button>
        </div>
      </div>
    </header>
  );
}

export function SiteFooter() {
  const { locale } = useLocale();
  return (
    <footer className="border-t border-border/60 bg-site">
      <div className="mx-auto grid w-full max-w-site gap-6 px-4 py-10 sm:px-6 lg:grid-cols-[auto_1fr_auto] lg:items-center lg:gap-10 lg:px-8">
        <div>
          <SiteLogo compact />
          <p className="mt-1 text-xs text-muted-foreground">{tr("common.madeBringFavoritePeople")}</p>
        </div>
        <nav aria-label={tr("landing.footerLinks")} className="flex flex-wrap items-center gap-x-5 gap-y-1 lg:justify-center [&_a]:rounded [&_a]:px-1 [&_a]:py-2 [&_a]:text-[0.78rem] [&_a]:text-foreground/90 [&_a:hover]:text-primary">
          <Link to="/acceso">{tr("common.signSpace")}</Link>
          <Link to={pricingPath(locale)}>{tr("pricing.title")}</Link>
          <Link to={localizedPath("providers", locale)}>{tr("providerSearch.navLink")}</Link>
          <Link to="/descargas">{tr("landing.downloadApp")}</Link>
          <Link to="/registro">{tr("common.exploreDemo")}</Link>
          <Link to={{ pathname: "/", hash: "#preguntas" }}>{tr("landing.frequentlyAskedQuestions")}</Link>
          <LegalLinks className="contents" />
        </nav>
        <p className="text-xs text-muted-foreground">© {new Date().getFullYear()} TuEventoFun</p>
      </div>
    </footer>
  );
}

/** Barra mínima: logo e idioma. La usan el acceso y, dentro de las apps, las páginas públicas. */
export function SiteTopBar() {
  return (
    <div className="mx-auto flex min-h-16 w-full max-w-site items-center justify-between gap-3 px-4 pt-[env(safe-area-inset-top)] sm:px-6 lg:px-8">
      <SiteLogo />
      <LanguageSwitcher />
    </div>
  );
}

/** Capacitor se anuncia en window: las apps no llevan la navegación del sitio web. */
const insideApp = () =>
  Boolean((window as { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor?.isNativePlatform?.());

/** Marco del sitio público: fondo, cabecera, contenido y pie. */
export function SiteLayout({ children }: { children: ReactNode }) {
  const app = insideApp();
  return (
    <div className="site-surface page-wash flex min-h-dvh flex-col">
      {app ? <SiteTopBar /> : <SiteHeader />}
      <main id="contenido" className="flex-1">
        {children}
      </main>
      {!app && <SiteFooter />}
    </div>
  );
}
