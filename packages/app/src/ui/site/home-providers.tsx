import { Link } from "react-router-dom";
import { ArrowRight, Camera, ChevronRight, Music, PartyPopper, Sparkles, Store, UtensilsCrossed } from "lucide-react";
import { localizedPath, providerCategoryLabels, type ProviderCategory } from "@tuevento/contracts";
import { cn } from "cn";
import { tr, useLocale } from "../../i18n";
import { Button } from "../button";
import { wrap } from "./home-shared";
import { SectionHeading } from "./section-heading";
import { SitePhoto } from "./site-photo";
import type { SitePhotoName } from "./photos";

const tiles: [ProviderCategory, typeof Store, SitePhotoName][] = [
  ["venue", Store, "venue"],
  ["catering", UtensilsCrossed, "catering"],
  ["photo-video", Camera, "photography"],
  ["decoration", Sparkles, "decoration"],
  ["live-music", Music, "music"],
  ["entertainment", PartyPopper, "experiences"],
];

export function HomeProviders() {
  const { locale } = useLocale();
  const search = localizedPath("providers", locale);
  return (
    <section aria-labelledby="prov-title" className={cn(wrap, "py-12 lg:py-16")}>
      <div className="grid gap-6 px-2 sm:px-4 lg:grid-cols-[minmax(0,16rem)_minmax(0,1fr)_auto] lg:items-center lg:gap-6">
        <div className="flex flex-col items-start">
          <SectionHeading
            size="sm"
            id="prov-title"
            eyebrow={tr("site.providersEyebrow")}
            title={tr("site.providersTitle")}
            text={tr("site.providersText")}
          />
          <Button asChild size="lg" className="mt-5">
            <Link to={search}>
              {tr("site.providersCta")}
              <ArrowRight aria-hidden />
            </Link>
          </Button>
        </div>
        <ul aria-label={tr("site.providersList")} className="grid grid-cols-3 gap-3 sm:grid-cols-6">
          {tiles.map(([code, _Icon, photo]) => (
            <li key={code}>
              <Link to={`${search}?cat=${code}`} className="group block rounded-lg outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50">
                <span className="block aspect-square overflow-hidden rounded-lg shadow-site-soft">
                  <SitePhoto name={photo} className="transition-transform duration-500 group-hover:scale-105 motion-reduce:transition-none" />
                </span>
                <span className="mt-2 block text-center text-[0.82rem] font-bold text-title">{tr(providerCategoryLabels[code])}</span>
              </Link>
            </li>
          ))}
        </ul>
        <Link to={search} className="group flex items-center gap-3 self-center rounded-lg py-2 text-xs font-semibold text-primary outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 lg:flex-col lg:gap-2 lg:text-center">
          <span className="grid size-11 place-items-center rounded-full border border-input bg-card transition-colors group-hover:bg-accent-soft">
            <ChevronRight aria-hidden className="size-5" />
          </span>
          <span className="max-w-[5rem]">{tr("site.providersMore")}</span>
        </Link>
        <p className="flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-border/70 pt-4 text-sm text-foreground lg:col-span-3">
          <strong className="font-bold text-title">{tr("landing.providersTitle")}</strong>
          <span className="text-muted-foreground">{tr("landing.providersText")}</span>
          <Button asChild variant="link" size="inline" className="text-sm font-bold">
            <Link to="/registro?tipo=proveedor">
              {tr("landing.providersAction")}
              <ArrowRight aria-hidden />
            </Link>
          </Button>
        </p>
      </div>
    </section>
  );
}
