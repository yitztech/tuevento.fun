import { Baby, CalendarDays, Flower2, LayoutGrid, Wine } from "lucide-react";
import type * as React from "react";
import { RingsIcon } from "@/components/shared/RingsIcon";
import { copy } from "@/lib/copy";

const icons: Record<string, React.ComponentType<{ className?: string }>> = {
  bodas: RingsIcon,
  cumpleanos: CalendarDays,
  bautizos: Baby,
  aniversarios: Wine,
  especiales: Flower2,
  mas: LayoutGrid,
};

type Item = (typeof copy.categories.items)[number];

export function EventCategoryCard({ item }: { item: Item }) {
  const Icon = icons[item.id] ?? LayoutGrid;
  return (
    <li className="flex flex-col items-center gap-1.5 px-1 text-center">
      <span className="grid size-16 place-items-center rounded-full bg-accent-soft text-primary ring-1 ring-accent/50">
        <Icon className="size-8" />
      </span>
      <span className="text-sm font-bold text-title">{item.title}</span>
      <span className="text-xs text-muted-foreground">{item.text}</span>
    </li>
  );
}
