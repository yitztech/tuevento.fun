import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, Check } from "lucide-react";
import type { MessageKey } from "@tuevento/contracts";
import { tr } from "../../i18n";
import type { SitePhotoName } from "./photos";
import { SitePhoto } from "./site-photo";
import { SiteTopBar } from "./site-layout";

export type AuthSide = "login" | "register" | "recover";

const sides: Record<AuthSide, { photo: SitePhotoName; quote: MessageKey; items: MessageKey[]; title?: MessageKey }> = {
  login: {
    photo: "login",
    quote: "site.loginQuote",
    items: ["site.loginBenefitEvents", "site.loginBenefitReplies", "site.loginBenefitDesigns", "site.loginBenefitProviders"],
  },
  register: {
    photo: "register",
    quote: "site.registerQuote",
    items: ["site.registerBenefitUnique", "site.registerBenefitGuests", "site.registerBenefitDesigns", "site.trustOnePlace"],
  },
  recover: {
    photo: "recover",
    quote: "site.recoverQuote",
    title: "site.recoverHelpTitle",
    items: ["site.recoverHelpSpam", "site.recoverHelpEmail", "site.recoverHelpLink"],
  },
};

/** Composición del acceso: formulario a la izquierda; foto, frase y ayuda a la derecha. */
export function SiteAuthShell({ side, children }: { side: AuthSide; children: ReactNode }) {
  const { photo, quote, items, title } = sides[side];
  return (
    <div className="site-surface page-wash min-h-dvh">
      <SiteTopBar />
      <main id="contenido" className="mx-auto w-full max-w-site-auth px-4 pt-2 pb-14 sm:px-6 lg:px-8 lg:pt-4">
        <div className="grid grid-cols-1 overflow-hidden rounded-2xl border border-white/70 bg-card/75 shadow-site-card backdrop-blur-sm lg:grid-cols-[1fr_1.05fr]">
          <section className="mx-auto w-full max-w-xl p-6 sm:p-10 lg:flex lg:max-w-none lg:flex-col lg:justify-center lg:p-14 xl:px-20">
            <Link className="back-link" to="/">
              <ArrowLeft size={16} aria-hidden />
              {tr("common.backHome")}
            </Link>
            <div className="w-full lg:max-w-md">{children}</div>
          </section>
          <aside className="relative order-first hidden h-56 overflow-hidden sm:block sm:h-72 lg:order-last lg:h-auto lg:min-h-[44rem] lg:p-5 lg:pl-0">
            <div className="relative size-full overflow-hidden lg:rounded-[2rem] lg:rounded-l-[7rem]">
              <SitePhoto name={photo} eager />
              <div aria-hidden className="absolute inset-0 bg-linear-to-t from-shade/35 via-transparent to-transparent lg:from-transparent" />
              <p className="absolute top-1/2 left-1/2 w-[62%] max-w-[17rem] -translate-x-1/2 -translate-y-[70%] rotate-[-5deg] rounded-md bg-note/95 px-5 py-6 text-center font-script text-3xl leading-[1.15] text-title shadow-site-soft sm:text-4xl lg:left-[56%] lg:-translate-y-[95%]">
                {tr(quote)}
              </p>
              <div className="absolute right-4 bottom-4 left-4 hidden rounded-xl bg-card/94 p-5 shadow-site-soft lg:block">
                {title && <h2 className="mb-3 font-sans text-sm font-bold text-title">{tr(title)}</h2>}
                <ul className="space-y-2">
                  {items.map((item) => (
                    <li key={item} className="flex items-center gap-2.5 text-[0.82rem] font-semibold text-title">
                      <span className="grid size-7 shrink-0 place-items-center rounded-full bg-accent-soft text-primary">
                        <Check aria-hidden className="size-4" />
                      </span>
                      {tr(item)}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </aside>
        </div>
      </main>
    </div>
  );
}
