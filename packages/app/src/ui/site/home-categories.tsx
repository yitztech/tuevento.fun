import { Baby, CalendarDays, Flower2, LayoutGrid, Wine } from "lucide-react";
import type { MessageKey } from "@tuevento/contracts";
import { cn } from "cn";
import { tr } from "../../i18n";
import { panel, wrap } from "./home-shared";
import { RingsIcon } from "./rings-icon";

const items: [typeof Baby | typeof RingsIcon, MessageKey, MessageKey][] = [
  [RingsIcon, "site.catWeddings", "site.catWeddingsText"],
  [CalendarDays, "site.catBirthdays", "site.catBirthdaysText"],
  [Baby, "site.catBaptisms", "site.catBaptismsText"],
  [Wine, "site.catAnniversaries", "site.catAnniversariesText"],
  [Flower2, "site.catSpecial", "site.catSpecialText"],
  [LayoutGrid, "site.catMore", "site.catMoreText"],
];

export function HomeCategories() {
  return (
    <section aria-label={tr("site.categoriesLabel")} className={cn(wrap, "relative z-10")}>
      <ul className={cn(panel, "grid grid-cols-2 gap-x-2 gap-y-6 px-4 py-6 min-[480px]:grid-cols-3 lg:grid-cols-6 lg:px-6")}>
        {items.map(([Icon, title, text]) => (
          <li key={title} className="flex flex-col items-center gap-1.5 px-1 text-center">
            <span className="grid size-16 place-items-center rounded-full bg-accent-soft text-primary ring-1 ring-peach/50">
              <Icon aria-hidden className="size-8" />
            </span>
            <span className="text-sm font-bold text-title">{tr(title)}</span>
            <span className="text-xs text-muted-foreground">{tr(text)}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
