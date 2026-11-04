import { Link } from "react-router-dom";
import { Logo } from "@/components/shared/Logo";
import { copy } from "@/lib/copy";

const linkClass = "rounded px-1 py-2 text-[0.78rem] text-foreground/90 hover:text-primary";

export function Footer() {
  return (
    <footer className="border-t border-border/60 bg-background">
      <div className="mx-auto grid w-full max-w-page gap-6 px-4 py-10 sm:px-6 lg:grid-cols-[auto_1fr_auto] lg:items-center lg:gap-10 lg:px-8">
        <div>
          <Logo variant="compact" />
          <p className="mt-1 text-xs text-muted-foreground">{copy.brand.tagline}</p>
        </div>
        <nav aria-label={copy.footer.label} className="flex flex-wrap items-center gap-x-5 gap-y-1 lg:justify-center">
          <Link to="/login" className={linkClass}>{copy.footer.space}</Link>
          <Link to="/#disenos" className={linkClass}>{copy.footer.designs}</Link>
          <Link to="/proveedores" className={linkClass}>{copy.footer.providers}</Link>
          <Link to="/#faq" className={linkClass}>{copy.footer.faq}</Link>
          <a href="https://tuevento.fun/privacidad" className={linkClass}>{copy.footer.privacy}</a>
          <a href="https://tuevento.fun/condiciones" className={linkClass}>{copy.footer.terms}</a>
        </nav>
        <p className="text-xs text-muted-foreground">{copy.footer.rights}</p>
      </div>
    </footer>
  );
}
