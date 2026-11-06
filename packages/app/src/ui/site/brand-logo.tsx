import { cn } from "cn";
import type { Locale } from "@tuevento/contracts";
import { useLocale } from "../../i18n";

const widths = [240, 480, 720, 1080] as const;
const dir = "/images/brand-v2";

const sizes = {
  default: { cls: "w-[168px] sm:w-[200px]", hint: "(min-width: 640px) 200px, 168px" },
  compact: { cls: "w-[140px] sm:w-[160px]", hint: "(min-width: 640px) 160px, 140px" },
  panel: { cls: "w-[150px] sm:w-[160px]", hint: "(min-width: 640px) 160px, 150px" },
} as const;

/**
 * Logo completo (símbolo y nombre) en el idioma activo. Los archivos son 3:1 y traen
 * cuatro anchos: el navegador toma el que corresponde a su densidad de pantalla.
 * Es decorativo: el enlace que lo contiene lleva el texto accesible. El tamaño se elige
 * por variante: Tailwind solo ve las clases escritas en `src/ui`.
 */
export function BrandLogo({ size = "default", locale }: { size?: keyof typeof sizes; locale?: Locale }) {
  const active = useLocale().locale;
  const lang = locale ?? active;
  return (
    <img
      src={`${dir}/logo-${lang}-480.webp`}
      srcSet={widths.map((w) => `${dir}/logo-${lang}-${w}.webp ${w}w`).join(", ")}
      sizes={sizes[size].hint}
      alt=""
      width={720}
      height={240}
      style={{ filter: "var(--brand-image-filter, grayscale(1) sepia(1) saturate(3) hue-rotate(325deg))" }}
      className={cn("aspect-[3/1] h-auto max-w-full shrink-0", sizes[size].cls)}
    />
  );
}

/** Solo el símbolo, para espacios compactos. */
export function BrandMark({ className }: { className?: string }) {
  return (
    <img
      src={`${dir}/icon-96.webp`}
      srcSet={`${dir}/icon-96.webp 96w, ${dir}/icon-192.webp 192w`}
      sizes="40px"
      alt=""
      width={96}
      height={96}
      style={{ filter: "var(--brand-image-filter, grayscale(1) sepia(1) saturate(3) hue-rotate(325deg))" }}
      className={cn("size-10 shrink-0", className)}
    />
  );
}
