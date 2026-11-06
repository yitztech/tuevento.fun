import { useRef, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, ChevronLeft, ChevronRight } from "lucide-react";
import { themes, type MessageKey } from "@tuevento/contracts";
import { cn } from "cn";
import { tr } from "../../i18n";
import { Button } from "../button";
import { panel, wrap } from "./home-shared";
import { SectionHeading } from "./section-heading";
import { ThemeCard, type SiteTheme } from "./theme-card";

type Tag = "all" | "weddings" | "birthdays" | "kids" | "minimal" | "floral" | "elegant" | "party";

const tagLabels: Record<Tag, MessageKey> = {
  all: "common.allMasculine",
  weddings: "site.catWeddings",
  birthdays: "site.catBirthdays",
  kids: "site.tagKids",
  minimal: "site.tagMinimal",
  floral: "site.tagFloral",
  elegant: "site.tagElegant",
  party: "site.tagParty",
};

const themeTags: Record<SiteTheme["id"], Tag[]> = {
  gold: ["elegant", "weddings"],
  neon: ["party", "birthdays"],
  tropical: ["party"],
  minimal: ["minimal", "weddings"],
  floral: ["floral", "weddings"],
  kids: ["kids", "birthdays"],
  winter: ["elegant"],
  spring: ["floral"],
  autumn: ["floral"],
  silver: ["elegant", "weddings"],
  copper: ["elegant"],
  disco: ["party", "birthdays"],
  starlight: ["elegant", "party"],
  sand: ["minimal"],
  wildflower: ["floral", "weddings"],
  pastel: ["kids", "minimal"],
};

const themeCaptions: Partial<Record<SiteTheme["id"], MessageKey>> = {
  copper: "site.captionCopper",
  wildflower: "site.captionWildflower",
  pastel: "site.captionPastel",
};

const inspirationPhotos: { file: string; alt: MessageKey; caption: MessageKey; tag: Tag }[] = [
  { file: "cumple-infantil-jardin", alt: "site.birthdayPhotoGarden", caption: "site.captionBirthdayPhotoGarden", tag: "birthdays" },
  { file: "cumple-infantil-mesa", alt: "site.birthdayPhotoKidsTable", caption: "site.captionBirthdayPhotoKidsTable", tag: "birthdays" },
  { file: "cumple-amigos-jardin", alt: "site.birthdayPhotoFriendsGarden", caption: "site.captionBirthdayPhotoFriendsGarden", tag: "birthdays" },
  { file: "cumple-amigos-picnic", alt: "site.birthdayPhotoPicnic", caption: "site.captionBirthdayPhotoPicnic", tag: "birthdays" },
  { file: "cumple-amigos-cena", alt: "site.birthdayPhotoDinner", caption: "site.captionBirthdayPhotoDinner", tag: "birthdays" },
  { file: "infantil-jardin", alt: "site.inspirationKidsGarden", caption: "site.captionInspirationKidsGarden", tag: "kids" },
  { file: "infantil-pastel", alt: "site.inspirationKidsPastel", caption: "site.captionInspirationKidsPastel", tag: "kids" },
  { file: "infantil-picnic", alt: "site.inspirationKidsPicnic", caption: "site.captionInspirationKidsPicnic", tag: "kids" },
  { file: "infantil-arte", alt: "site.inspirationKidsCrafts", caption: "site.captionInspirationKidsCrafts", tag: "kids" },
  { file: "infantil-safari", alt: "site.inspirationKidsSafari", caption: "site.captionInspirationKidsSafari", tag: "kids" },
  { file: "infantil-arcoiris", alt: "site.inspirationKidsRainbow", caption: "site.captionInspirationKidsRainbow", tag: "kids" },
  { file: "bodas-jardin", alt: "site.inspirationWedding", caption: "site.captionInspirationWedding", tag: "weddings" },
  { file: "minimalista-mesa", alt: "site.inspirationMinimal", caption: "site.captionInspirationMinimal", tag: "minimal" },
  { file: "minimalista-lino", alt: "site.inspirationMinimalLinen", caption: "site.captionInspirationMinimalLinen", tag: "minimal" },
  { file: "minimalista-terraza", alt: "site.inspirationMinimalTerrace", caption: "site.captionInspirationMinimalTerrace", tag: "minimal" },
  { file: "minimalista-brindis", alt: "site.inspirationMinimalToast", caption: "site.captionInspirationMinimalToast", tag: "minimal" },
  { file: "minimalista-pastel", alt: "site.inspirationMinimalCake", caption: "site.captionInspirationMinimalCake", tag: "minimal" },
  { file: "minimalista-jardin", alt: "site.inspirationMinimalGarden", caption: "site.captionInspirationMinimalGarden", tag: "minimal" },
  { file: "floral-fiesta", alt: "site.inspirationFloral", caption: "site.captionInspirationFloral", tag: "floral" },
  { file: "elegante-cena", alt: "site.inspirationElegant", caption: "site.captionInspirationElegant", tag: "elegant" },
  { file: "celebracion-amigos", alt: "site.inspirationParty", caption: "site.captionInspirationParty", tag: "party" },
];

export function HomeDesigns() {
  const [tag, setTag] = useState<Tag>("all");
  const [selected, setSelected] = useState<SiteTheme["id"]>("floral");
  const track = useRef<HTMLUListElement>(null);
  const shown = tag === "all" ? themes : themes.filter((t) => themeTags[t.id].includes(tag));
  const chooseTag = (next: Tag) => {
    setTag(next);
    const first = themes.find((t) => next === "all" || themeTags[t.id].includes(next));
    if (first) setSelected(first.id);
    track.current?.scrollTo({ left: 0 });
  };
  const page = (dir: 1 | -1) => {
    const el = track.current;
    if (el) el.scrollBy({ left: dir * el.clientWidth * 0.85 });
  };
  return (
    <section id="disenos" aria-labelledby="disenos-title" className={cn(wrap, "scroll-mt-24 pt-6 lg:pt-8")}>
      <div className={cn(panel, "grid gap-6 p-5 sm:p-7 lg:grid-cols-[minmax(0,17rem)_minmax(0,1fr)] lg:gap-8")}>
        <div className="flex flex-col items-start">
          <SectionHeading
            size="sm"
            id="disenos-title"
            eyebrow={tr("site.designsEyebrow")}
            title={tr("landing.invitationSpecialDay")}
            text={tr("landing.weddingAmongFlowersBirthday")}
          />
          <Button asChild size="lg" className="mt-6">
            <Link to={`/registro?tema=${selected}`}>
              {tr("landing.createDesign")}
              <ArrowRight aria-hidden />
            </Link>
          </Button>
        </div>
        <div className="min-w-0">
          <fieldset aria-label={tr("site.designFilters")} className="mb-3 flex flex-wrap gap-1.5">
            {(Object.keys(tagLabels) as Tag[]).map((k) => (
              <button
                key={k}
                type="button"
                aria-pressed={tag === k}
                onClick={() => chooseTag(k)}
                className={cn(
                  "min-h-11 cursor-pointer rounded-full px-3.5 text-xs font-semibold transition-colors outline-none focus-visible:ring-[3px] focus-visible:ring-ring/40",
                  tag === k ? "bg-primary text-primary-foreground" : "text-foreground/85 hover:bg-accent-soft",
                )}
              >
                {tr(tagLabels[k])}
              </button>
            ))}
          </fieldset>
          <fieldset className="relative" aria-label={tr("landing.chooseSampleDesign")}>
            <ul ref={track} className="-mx-2 flex snap-x snap-mandatory gap-3 overflow-x-auto px-2 py-2.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {shown.map((t) => (
                <li key={t.id} className="w-[42%] shrink-0 snap-start sm:w-[28%] md:w-[22%] lg:w-[18.5%]">
                  <button
                    type="button"
                    onClick={() => setSelected(t.id)}
                    aria-pressed={selected === t.id}
                    aria-label={tr(t.name)}
                    className={cn(
                      "block w-full cursor-pointer rounded-lg outline-none transition-transform hover:-translate-y-0.5 focus-visible:ring-[3px] focus-visible:ring-ring/50 motion-reduce:transition-none",
                      selected === t.id && "ring-[3px] ring-primary ring-offset-2 ring-offset-card",
                    )}
                  >
                    <ThemeCard theme={t} named caption={themeCaptions[t.id]} />
                  </button>
                </li>
              ))}
              {inspirationPhotos.filter((photo) => tag === "all" || photo.tag === tag).map(({ file, alt, caption }) => (
                <li key={file} className="w-[42%] shrink-0 snap-start sm:w-[28%] md:w-[22%] lg:w-[18.5%]">
                  <div className="relative aspect-[2/3] overflow-hidden rounded-lg bg-card shadow-site-card">
                    <img
                      src={`/site/photos/events/${file}-960.webp`}
                      srcSet={`/site/photos/events/${file}-480.webp 480w, /site/photos/events/${file}-960.webp 960w`}
                      sizes="(min-width:1024px) 16vw, 40vw"
                      alt={tr(alt)}
                      width={640}
                      height={960}
                      loading="lazy"
                      decoding="async"
                      className="absolute inset-0 size-full object-cover"
                    />
                    <span className="absolute inset-x-0 bottom-0 bg-linear-to-t from-shade/75 to-transparent px-2 pt-6 pb-2 text-center text-xs font-bold text-white">
                      {tr(caption)}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
            <Button variant="light" size="round" onClick={() => page(1)} aria-label={tr("site.moreDesigns")} className="absolute top-1/2 -right-3 inline-flex -translate-y-1/2 shadow-site-soft">
              <ChevronRight aria-hidden />
            </Button>
            <Button variant="light" size="round" onClick={() => page(-1)} aria-label={tr("site.previousDesigns")} className="absolute top-1/2 -left-3 inline-flex -translate-y-1/2 shadow-site-soft">
              <ChevronLeft aria-hidden />
            </Button>
          </fieldset>
        </div>
      </div>
    </section>
  );
}
