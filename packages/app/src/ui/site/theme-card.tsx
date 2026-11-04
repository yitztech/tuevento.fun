import type { themes } from "@tuevento/contracts";
import { cn } from "cn";
import { tr } from "../../i18n";
import { themeImageSrcSet } from "../../theme-images";

export type SiteTheme = (typeof themes)[number];

type Props = {
  theme: SiteTheme;
  className?: string;
  /** Giro en grados, para composiciones superpuestas */
  tilt?: number;
  eager?: boolean;
  /** Muestra el nombre del diseño sobre la foto */
  named?: boolean;
};

/** Tarjeta de un diseño real de invitación: su foto y, si se pide, su nombre. */
export function ThemeCard({ theme, className, tilt = 0, eager = false, named = false }: Props) {
  return (
    <span
      className={cn("relative block aspect-[2/3] w-full overflow-hidden rounded-lg bg-card shadow-site-card", className)}
      style={tilt ? { transform: `rotate(${tilt}deg)` } : undefined}
    >
      <img
        src={`/images/${theme.image}`}
        srcSet={themeImageSrcSet(theme)}
        sizes="(min-width:1024px) 16vw, 40vw"
        alt=""
        width={600}
        height={900}
        loading={eager ? "eager" : "lazy"}
        decoding="async"
        className="absolute inset-0 size-full object-cover"
      />
      {named && (
        <span className="absolute inset-x-0 bottom-0 bg-linear-to-t from-shade/75 to-transparent px-2 pt-6 pb-2 text-center text-xs font-bold text-white">
          {tr(theme.name)}
        </span>
      )}
    </span>
  );
}
