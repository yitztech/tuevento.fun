import type * as React from "react";
import { cn } from "@/lib/cn";
import { type PhotoKey, photoSources } from "@/lib/photos";

type Props = Omit<React.ComponentProps<"img">, "src" | "srcSet" | "alt"> & { name: PhotoKey; sizes: string; eager?: boolean; alt?: string };

/** Fotografía responsive: WebP en varios anchos, dimensiones declaradas y carga diferida salvo `eager`. */
export function Photo({ name, sizes, eager = false, alt, className, ...rest }: Props) {
  const { w, h, srcSet, src, alt: defaultAlt } = photoSources(name);
  const text = alt ?? defaultAlt;
  return (
    <img
      src={src}
      srcSet={srcSet}
      sizes={sizes}
      width={w}
      height={h}
      alt={text}
      loading={eager ? "eager" : "lazy"}
      fetchPriority={eager ? "high" : "auto"}
      decoding="async"
      className={cn("size-full object-cover", className)}
      {...rest}
    />
  );
}
