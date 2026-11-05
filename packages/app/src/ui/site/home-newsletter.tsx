import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Mail } from "lucide-react";
import { accountLimits } from "@tuevento/contracts";
import { cn } from "cn";
import { tr, useLocale } from "../../i18n";
import { legalPath } from "../../legal";
import { Button } from "../button";
import { wrap } from "./home-shared";

type State = "idle" | "loading" | "success" | "error";

/** Banda final: la suscripción real al boletín, con su aviso legal. */
export function HomeNewsletter() {
  const { locale } = useLocale();
  const [email, setEmail] = useState("");
  const [state, setState] = useState<State>("idle");
  const [message, setMessage] = useState("");
  const subscribe = async (e: FormEvent) => {
    e.preventDefault();
    if (!email) return;
    setState("loading");
    setMessage("");
    try {
      const res = await fetch("/api/newsletter/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-TuEvento-Client": "1" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setState("success");
        setMessage(data.message || tr("newsletter.thanks"));
        setEmail("");
      } else {
        setState("error");
        setMessage(data.message || tr("common.couldntCompleteRequest"));
      }
    } catch {
      setState("error");
      setMessage(tr("common.couldntCompleteRequest"));
    }
  };
  return (
    <section aria-labelledby="cta-title" className={cn(wrap, "pt-10 pb-10")}>
      <div className="relative isolate overflow-hidden rounded-2xl bg-band bg-[url(/site/backgrounds/cta-band.svg)] bg-cover bg-center px-6 py-9 text-white shadow-site-soft sm:px-10 lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:items-center lg:gap-10 lg:px-12">
        <img src="/site/decorations/balloons.svg" alt="" aria-hidden width={220} height={320} loading="lazy" className="pointer-events-none absolute -right-2 -bottom-6 -z-10 hidden w-44 opacity-95 md:block lg:w-56" />
        <img src="/site/decorations/leaf-branch.svg" alt="" aria-hidden width={260} height={420} loading="lazy" className="pointer-events-none absolute -bottom-10 left-1/3 -z-10 hidden w-40 rotate-[20deg] opacity-30 lg:block" />
        <div>
          <h2 id="cta-title" className="font-serif text-[clamp(1.6rem,1.2rem+1.6vw,2.4rem)] leading-tight font-semibold text-balance text-white">
            {tr("landing.nextMemoryStartsHere")}
          </h2>
          <p className="mt-2 text-sm text-white/90">{tr("landing.getCelebrationIdeasExclusive")}</p>
        </div>
        <div className="mt-6 lg:mt-0 lg:pr-24">
          <Button asChild size="lg" className="mb-5 max-w-full whitespace-normal bg-white px-3 text-center text-primary hover:bg-accent-soft">
            <Link to="/registro?empezar=evento">
              {tr("common.createFirstEvent")}
              <ArrowRight aria-hidden />
            </Link>
          </Button>
          <form onSubmit={subscribe} className="w-full">
            <div className="flex flex-col gap-2 sm:flex-row">
              <input
                type="email"
                required
                autoComplete="email"
                maxLength={accountLimits.email}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={state === "loading"}
                placeholder={tr("common.email")}
                aria-label={tr("common.email")}
                className="min-h-12 min-w-0 flex-1 rounded-md border border-white/60 bg-white px-4 text-base text-foreground outline-none placeholder:text-muted-foreground focus-visible:ring-[3px] focus-visible:ring-white/70 sm:text-sm"
              />
              <Button type="submit" size="lg" disabled={state === "loading"} className="bg-primary-hover hover:bg-title">
                <Mail aria-hidden />
                {state === "loading" ? tr("common.loadingEllipsis") : tr("landing.subscribe")}
              </Button>
            </div>
          </form>
          <p className="mt-2 text-xs text-white/85">
            {tr("landing.wellWriteLanguageUnsubscribe")}{" "}
            <Link to={legalPath("privacy", locale)} className="underline">
              {tr("legal.privacyPolicy")}
            </Link>
          </p>
          {message && (
            <p role="status" className={cn("mt-2 rounded bg-white/95 px-2 py-1 text-xs font-semibold", state === "error" ? "text-destructive" : "text-title")}>
              {message}
            </p>
          )}
        </div>
      </div>
    </section>
  );
}
