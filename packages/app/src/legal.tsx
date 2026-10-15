import { useEffect } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import {
  localizedPage,
  localizedPath,
  type Locale,
  type LocalizedPage,
} from "@tuevento/contracts";
import { Logo, Container } from "./components";
import { LanguageSwitcher, RichText, formatLocale, tr, useLocale } from "./i18n";
import { legalTexts, type LegalContent } from "./legal-texts";

/**
 * Titular del servicio y canal de contacto para privacidad. No se inventan: lo que sea
 * null se indica en la página sin dar datos falsos. El domicilio, escrito en cada idioma,
 * está en legal-texts y es incompleto a propósito (ciudad, estado y país) hasta tener el
 * definitivo.
 */
export const LEGAL_OWNER: { name: string | null; contact: string | null } = {
  name: "YunitzTech",
  contact: "contacto@tuevento.fun",
};
/** Fecha de la última revisión del texto (AAAA-MM-DD). */
export const LEGAL_UPDATED = "2026-10-14";

export type LegalKind = Extract<LocalizedPage, "privacy" | "terms">;
export function legalPageFor(pathname: string): LegalKind | null {
  const page = localizedPage(pathname);
  return page === "privacy" || page === "terms" ? page : null;
}
/** Ruta de la página legal en el idioma del dominio actual. */
export const legalPath = (kind: LegalKind, locale: Locale) => localizedPath(kind, locale);

function legalContent(page: LegalKind, locale: Locale): LegalContent {
  const texts = legalTexts[locale];
  const owner = {
    name: LEGAL_OWNER.name ?? texts.missing,
    address: texts.address ?? texts.missing,
    contact: LEGAL_OWNER.contact ?? texts.missing,
  };
  return texts[page](owner);
}

/** Enlaza el correo de contacto (no los remitentes no-reply) con mailto. */
const withMailLinks = (text: string) => {
  const mail = LEGAL_OWNER.contact;
  if (!mail?.includes("@") || !text.includes(mail)) return text;
  return text.split(mail).flatMap((part, i) =>
    i
      ? [
          <a key={i} href={`mailto:${mail}`}>
            {mail}
          </a>,
          part,
        ]
      : [part],
  );
};


export function LegalPage({ page }: { page: LegalKind }) {
  const { locale } = useLocale();
  const content = legalContent(page, locale);
  const other: LegalKind = page === "privacy" ? "terms" : "privacy";
  useEffect(() => {
    document.title = `${content.title} · TuEventoFun`;
  }, [content.title]);
  const updated = new Intl.DateTimeFormat(formatLocale(), {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${LEGAL_UPDATED}T00:00:00Z`));
  return (
    <div className="legal-page">
      <Container width="prose">
        <header>
          <Logo />
          <LanguageSwitcher />
        </header>
        <main>
          <Link to="/" className="text-link">
            <ArrowLeft size={16} />
            {tr("common.backHome")}
          </Link>
          <h1>{content.title}</h1>
          <p className="legal-updated">{tr("legal.lastUpdated", { date: updated })}</p>
          <p className="legal-intro">{content.intro}</p>
          {content.sections.map((section) => (
            <section key={section.title}>
              <h2>{section.title}</h2>
              {section.body.map((text) => (
                <p key={text}>{withMailLinks(text)}</p>
              ))}
            </section>
          ))}
          <p className="legal-other">
            <Link to={legalPath(other, locale)}>
              {tr(other === "privacy" ? "legal.privacyPolicy" : "legal.termsOfUse")}
            </Link>
          </p>
        </main>
      </Container>
    </div>
  );
}
/** Enlaces a las páginas legales en el idioma del dominio, para pies y formularios. */
export function LegalLinks({ className }: { className?: string }) {
  const { locale } = useLocale();
  return (
    <span className={className}>
      <Link to={legalPath("privacy", locale)}>{tr("legal.privacy")}</Link>
      <Link to={legalPath("terms", locale)}>{tr("legal.terms")}</Link>
    </span>
  );
}
/** Aviso legal bajo los formularios de registro y acceso. */
export function AuthLegalNotice({ registerMode }: { registerMode: boolean }) {
  const { locale } = useLocale();
  const privacyPath = legalPath("privacy", locale);
  const termsPath = legalPath("terms", locale);
  if (!registerMode)
    return (
      <p className="auth-legal">
        <Link to={termsPath}>{tr("legal.termsOfUse")}</Link> ·{" "}
        <Link to={privacyPath}>{tr("legal.privacyPolicy")}</Link>
      </p>
    );
  return (
    <p className="auth-legal">
      <RichText
        k="legal.acceptOnRegister"
        components={{ terms: <Link to={termsPath} />, privacy: <Link to={privacyPath} /> }}
      />
    </p>
  );
}
