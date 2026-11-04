import { Heart } from "lucide-react";
import { useState } from "react";
import { Photo } from "@/components/shared/Photo";
import { providerCategories } from "@/features/providers/data";
import { copy } from "@/lib/copy";
import type { Provider } from "@/types";

export function ProviderCard({ provider }: { provider: Provider }) {
  const [saved, setSaved] = useState(false);
  const category = providerCategories.find((c) => c.id === provider.category)?.title;
  return (
    <article className="group overflow-hidden rounded-xl border border-border/70 bg-card shadow-card transition-transform duration-300 hover:-translate-y-1 motion-reduce:transition-none motion-reduce:hover:translate-y-0">
      <div className="relative aspect-[4/3] overflow-hidden">
        <Photo name={provider.photo} alt="" sizes="(min-width:1024px) 22vw, (min-width:640px) 45vw, 90vw" className="transition-transform duration-500 group-hover:scale-105 motion-reduce:transition-none motion-reduce:group-hover:scale-100" />
        <span className="absolute top-3 left-3 rounded-full bg-card/90 px-2.5 py-1 text-[0.68rem] font-bold text-primary">{copy.providers.example}</span>
        <button type="button" aria-label={`${copy.providers.save}: ${provider.name}`} aria-pressed={saved} onClick={() => setSaved((v) => !v)} className="absolute top-2 right-2 grid size-11 cursor-pointer place-items-center rounded-full text-white outline-none hover:text-accent focus-visible:ring-[3px] focus-visible:ring-white/80">
          <Heart aria-hidden className={`size-5 drop-shadow ${saved ? "fill-current" : ""}`} />
        </button>
      </div>
      <div className="p-4">
        <h3 className="font-sans text-[0.95rem] font-bold text-title">{provider.name}</h3>
        <p className="mt-0.5 text-sm text-foreground">{provider.specialty}</p>
        <p className="mt-1 text-xs text-muted-foreground">{category}</p>
      </div>
    </article>
  );
}
