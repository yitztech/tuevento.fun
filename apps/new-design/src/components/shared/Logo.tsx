import { Link } from "react-router-dom";
import { cn } from "@/lib/cn";
import { copy } from "@/lib/copy";

type Props = { variant?: "horizontal" | "compact" | "mark"; tone?: "dark" | "light"; className?: string; asLink?: boolean };

export function LogoMark({ tone = "dark", className }: { tone?: "dark" | "light"; className?: string }) {
  return <img src={`/assets/branding/logo-mark${tone === "light" ? "-light" : ""}.svg`} alt="" width={64} height={64} className={cn("size-10 shrink-0", className)} />;
}

export function Logo({ variant = "horizontal", tone = "dark", className, asLink = true }: Props) {
  const body = (
    <>
      <LogoMark tone={tone} className={variant === "compact" ? "size-9" : "size-10"} />
      {variant !== "mark" && (
        <span className={cn("font-serif leading-none font-bold tracking-tight", variant === "compact" ? "text-xl" : "text-[1.7rem]", tone === "light" ? "text-white" : "text-primary")}>
          {copy.brand.name}
        </span>
      )}
    </>
  );
  const cls = cn("inline-flex items-center gap-1.5", className);
  return asLink ? (
    <Link to="/" className={cls} aria-label={variant === "mark" ? copy.nav.home : undefined}>
      {body}
    </Link>
  ) : (
    <span className={cls}>{body}</span>
  );
}
