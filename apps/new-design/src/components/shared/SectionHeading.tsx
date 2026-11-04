import type * as React from "react";
import { cn } from "@/lib/cn";

type Props = { size?: "md" | "sm"; eyebrow?: string; title: React.ReactNode; text?: string; as?: "h1" | "h2"; className?: string; id?: string };

export function SectionHeading({ size = "md", eyebrow, title, text, as: Tag = "h2", className, id }: Props) {
  return (
    <div className={cn("max-w-xl", className)}>
      {eyebrow && <p className="eyebrow mb-3">{eyebrow}</p>}
      <Tag id={id} className={size === "sm" ? "text-[clamp(1.55rem,1.15rem+1.15vw,2.1rem)] leading-[1.12] font-semibold" : "section-title"}>
        {title}
      </Tag>
      {text && <p className="mt-3 text-[0.95rem] text-muted-foreground">{text}</p>}
    </div>
  );
}
