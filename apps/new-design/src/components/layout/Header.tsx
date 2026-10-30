import { ArrowRight, Menu, X } from "lucide-react";
import { useEffect, useId, useState } from "react";
import { Link, NavLink, useLocation } from "react-router-dom";
import { Logo } from "@/components/shared/Logo";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";
import { copy } from "@/lib/copy";

const links = [
  { to: "/#disenos", label: copy.nav.designs },
  { to: "/#como-funciona", label: copy.nav.how },
  { to: "/proveedores", label: copy.nav.providers },
  { to: "/#faq", label: copy.nav.faq },
];

const linkClass = "rounded-md px-1 py-2 text-[0.82rem] font-semibold text-foreground/90 transition-colors hover:text-primary";

export function Header() {
  const [open, setOpen] = useState(false);
  const panel = useId();
  const { pathname, hash } = useLocation();

  // biome-ignore lint/correctness/useExhaustiveDependencies: el panel se cierra al cambiar de ruta o de ancla
  useEffect(() => setOpen(false), [pathname, hash]);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <header className="sticky top-0 z-40 border-b border-transparent bg-background/85 backdrop-blur-md supports-[backdrop-filter]:bg-background/70">
      <a href="#contenido" className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50 focus:rounded-md focus:bg-card focus:px-3 focus:py-2 focus:font-bold focus:text-primary">
        {copy.nav.skip}
      </a>
      <div className="mx-auto flex h-16 w-full max-w-page items-center justify-between gap-4 px-4 sm:px-6 lg:h-[4.5rem] lg:px-8">
        <Logo />
        <nav aria-label={copy.nav.label} className="hidden items-center gap-6 lg:flex xl:gap-8">
          {links.map((l) =>
            l.to.startsWith("/#") ? (
              <Link key={l.to} to={l.to} className={linkClass}>
                {l.label}
              </Link>
            ) : (
              <NavLink key={l.to} to={l.to} className={({ isActive }) => cn(linkClass, isActive && "text-primary underline decoration-2 underline-offset-8")}>
                {l.label}
              </NavLink>
            ),
          )}
        </nav>
        <div className="flex items-center gap-1.5 sm:gap-3">
          <Link to="/login" className={cn(linkClass, "hidden sm:inline-block")}>
            {copy.nav.login}
          </Link>
          <Button asChild size="sm" className="hidden sm:inline-flex">
            <Link to="/registro">
              {copy.nav.create}
              <ArrowRight aria-hidden />
            </Link>
          </Button>
          <Button variant="ghost" size="icon" className="lg:hidden" aria-expanded={open} aria-controls={panel} aria-label={open ? copy.nav.closeMenu : copy.nav.openMenu} onClick={() => setOpen((v) => !v)}>
            {open ? <X /> : <Menu />}
          </Button>
        </div>
      </div>
      <div id={panel} hidden={!open} className="border-t border-border/70 bg-background lg:hidden">
        <nav aria-label={copy.nav.label} className="mx-auto flex max-w-page flex-col gap-1 px-4 py-4 sm:px-6">
          {links.map((l) => (
            <Link key={l.to} to={l.to} className="flex min-h-12 items-center rounded-md px-3 text-base font-semibold text-title hover:bg-accent-soft">
              {l.label}
            </Link>
          ))}
          <div className="mt-2 grid gap-2 sm:grid-cols-2">
            <Button asChild variant="outline" size="lg">
              <Link to="/login">{copy.nav.login}</Link>
            </Button>
            <Button asChild size="lg">
              <Link to="/registro">
                {copy.nav.create}
                <ArrowRight aria-hidden />
              </Link>
            </Button>
          </div>
        </nav>
      </div>
    </header>
  );
}
