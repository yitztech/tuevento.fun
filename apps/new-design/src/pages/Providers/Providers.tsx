import { ArrowRight, Building2, Cake, Camera, ClipboardList, Flower2, Handshake, Heart, LayoutGrid, Music, Search, UtensilsCrossed, Wine } from "lucide-react";
import type * as React from "react";
import { useState } from "react";
import { Link } from "react-router-dom";
import { ProviderCard } from "@/components/providers/ProviderCard";
import { Photo } from "@/components/shared/Photo";
import { Button } from "@/components/ui/button";
import { filterProviders, providerCategories } from "@/features/providers/data";
import { cn } from "@/lib/cn";
import { copy } from "@/lib/copy";
import type { ProviderCategoryId } from "@/types";

const icons: Record<ProviderCategoryId | "all", React.ComponentType<{ className?: string }>> = {
  all: LayoutGrid,
  salones: Building2,
  catering: UtensilsCrossed,
  fotografia: Camera,
  decoracion: Flower2,
  musica: Music,
  pasteles: Cake,
  coordinacion: ClipboardList,
  experiencias: Wine,
};

const wrap = "mx-auto w-full max-w-page px-4 sm:px-6 lg:px-8";

export function Providers() {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<ProviderCategoryId | "all">("all");
  const results = filterProviders(query, category);
  const tiles = [{ id: "all" as const, title: copy.providers.all }, ...providerCategories];
  const clear = () => {
    setQuery("");
    setCategory("all");
  };

  return (
    <>
      <section aria-labelledby="prov-hero" className="relative isolate overflow-hidden">
        <div className={cn(wrap, "grid items-center gap-8 pt-8 pb-8 lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)] lg:gap-6 lg:pt-12 lg:pb-12")}>
          <div className="relative z-10 max-w-xl">
            <p className="eyebrow mb-4">{copy.providers.eyebrow}</p>
            <h1 id="prov-hero" className="display-title !text-[clamp(2.4rem,1.7rem+3.4vw,4.2rem)]">
              {copy.providers.title}
            </h1>
            <p className="mt-4 max-w-md text-base text-foreground/90 sm:text-[1.05rem]">{copy.providers.text}</p>
            <form role="search" onSubmit={(e) => e.preventDefault()} className="mt-7 flex max-w-lg items-stretch overflow-hidden rounded-lg border border-input bg-card shadow-soft focus-within:ring-[3px] focus-within:ring-ring/30">
              <label htmlFor="prov-q" className="sr-only">
                {copy.providers.searchLabel}
              </label>
              <Search aria-hidden className="my-auto ml-3.5 size-[1.15rem] shrink-0 text-muted-foreground" />
              <input id="prov-q" type="search" value={query} onChange={(e) => setQuery(e.target.value)} maxLength={100} autoComplete="off" placeholder={copy.providers.searchPlaceholder} className="min-h-12 min-w-0 flex-1 bg-transparent px-3 text-base outline-none placeholder:text-muted-foreground/80 sm:text-sm" />
              <Button type="submit" aria-label={copy.providers.searchSubmit} className="m-1 rounded-md px-4">
                <Search aria-hidden />
              </Button>
            </form>
          </div>
          <div className="relative mx-auto w-full max-w-[40rem] lg:max-w-none">
            <div className="aspect-[1.35/1] overflow-hidden md:aspect-[2/1] lg:aspect-[1.35/1] rounded-[2rem] rounded-tl-[6rem] shadow-card">
              <Photo name="providers/hero-mesa" eager sizes="(min-width:1024px) 50vw, 100vw" />
            </div>
            <p className="absolute right-3 bottom-4 w-[52%] max-w-[17rem] rotate-[-5deg] rounded-md bg-[#fbe7da]/95 px-4 py-4 text-center font-script text-[clamp(1.25rem,2.4vw,1.9rem)] leading-tight text-title shadow-soft sm:right-6">
              {copy.providers.ribbon} <Heart aria-hidden className="inline size-[0.7em] fill-current text-primary" />
            </p>
          </div>
        </div>
      </section>

      <section aria-label={copy.providers.categoriesLabel} className={cn(wrap, "relative z-10")}>
        <div role="group" aria-label={copy.providers.categoriesLabel} className="grid grid-cols-3 gap-2 rounded-2xl border border-white/70 bg-card/75 p-3 shadow-card sm:grid-cols-5 lg:grid-cols-9">
          {tiles.map((t) => {
            const Icon = icons[t.id];
            const active = category === t.id;
            return (
              <button key={t.id} type="button" aria-pressed={active} onClick={() => setCategory(t.id)} className={cn("flex min-h-24 cursor-pointer flex-col items-center justify-start gap-2 rounded-xl px-1.5 py-3 text-center text-[0.74rem] leading-tight font-semibold transition-colors outline-none focus-visible:ring-[3px] focus-visible:ring-ring/40", active ? "bg-accent-soft text-primary ring-1 ring-secondary/60" : "text-title hover:bg-accent-soft/60")}>
                <span className={cn("grid size-11 place-items-center rounded-full ring-1 ring-accent/60", active ? "bg-primary text-primary-foreground" : "bg-accent-soft text-primary")}>
                  <Icon className="size-[1.35rem]" />
                </span>
                {t.title}
              </button>
            );
          })}
        </div>
      </section>

      <section aria-labelledby="prov-feat" className={cn(wrap, "pt-8 lg:pt-10")}>
        <div className="mb-4 flex flex-wrap items-end justify-between gap-2">
          <div>
            <h2 id="prov-feat" className="font-serif text-2xl font-semibold text-title">
              {copy.providers.featured}
            </h2>
            <p className="mt-1 text-xs text-muted-foreground" role="status">
              {copy.providers.results(results.length)} · {copy.providers.exampleNote}
            </p>
          </div>
          <Button variant="link" onClick={clear} className="text-sm font-bold">
            {copy.providers.viewAll}
            <ArrowRight aria-hidden />
          </Button>
        </div>
        {results.length ? (
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {results.map((p) => (
              <li key={p.id}>
                <ProviderCard provider={p} />
              </li>
            ))}
          </ul>
        ) : (
          <div className="rounded-xl border border-dashed border-input bg-card/60 px-6 py-12 text-center">
            <p className="mx-auto max-w-sm text-sm text-muted-foreground">{copy.providers.empty}</p>
            <Button variant="outline" onClick={clear} className="mt-4">
              {copy.providers.clear}
            </Button>
          </div>
        )}
      </section>

      <section aria-labelledby="prov-cta" className={cn(wrap, "py-10")}>
        <div className="flex flex-col items-start gap-4 rounded-2xl border border-white/70 bg-card/80 p-5 shadow-card sm:flex-row sm:items-center sm:gap-6 sm:p-6">
          <span aria-hidden className="grid size-14 shrink-0 place-items-center rounded-full bg-accent-soft text-primary ring-1 ring-accent/60">
            <Handshake className="size-7" />
          </span>
          <div className="flex-1">
            <h2 id="prov-cta" className="font-serif text-lg font-semibold text-title">
              {copy.providers.ctaTitle}
            </h2>
            <p className="text-sm text-muted-foreground">{copy.providers.ctaText}</p>
          </div>
          <Button asChild size="lg" className="w-full sm:w-auto">
            <Link to="/registro">
              {copy.providers.ctaButton}
              <ArrowRight aria-hidden />
            </Link>
          </Button>
        </div>
      </section>
    </>
  );
}
