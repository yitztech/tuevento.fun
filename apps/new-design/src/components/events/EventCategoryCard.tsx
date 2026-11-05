import { Baby, CalendarDays, Flower2, LayoutGrid, Wine } from "lucide-react";
import type * as React from "react";
import { Link } from "react-router-dom";
import { RingsIcon } from "@/components/shared/RingsIcon";
import type { copy } from "@/lib/copy";

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
    <li className="text-center">
      <Link to={item.id === "mas" ? "/demo" : `/demo?category=${item.id === "especiales" ? "celebracion" : item.id}`} className="flex h-full flex-col items-center gap-1.5 rounded-xl px-1 py-2 outline-none hover:bg-accent-soft/60 focus-visible:ring-[3px] focus-visible:ring-ring/40">
      <span className="grid size-16 place-items-center rounded-full bg-accent-soft text-primary ring-1 ring-accent/50">
        <Icon className="size-8" />
      </span>
      <span className="text-sm font-bold text-title">{item.title}</span>
      <span className="text-xs text-muted-foreground">{item.text}</span>
      </Link>
    </li>
  );
}
