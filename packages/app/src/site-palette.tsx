import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import type { EventApi } from "@tuevento/client";
import { sitePalettes, sitePaletteSchema, type SitePaletteId } from "@tuevento/contracts";
import { brandFilter, brandHueRotation } from "./ui/site/brand-palette";

const cacheKey = "tuevento.sitePalette";
const defaultThemeColor = "#fff6f2";

/** Última paleta guardada: evita el parpadeo al cargar y sirve a las apps sin conexión. */
function cachedPalette(): SitePaletteId {
  try {
    const result = sitePaletteSchema.safeParse({ palette: localStorage.getItem(cacheKey) });
    return result.success ? result.data.palette : "terracotta";
  } catch {
    return "terracotta";
  }
}
function rememberPalette(id: SitePaletteId) {
  try {
    localStorage.setItem(cacheKey, id);
  } catch {
    // Sin almacenamiento se pide al servidor en cada carga
  }
}

/** Solo se escriben los valores de la tabla compartida, nunca CSS recibido del servidor. */
function applyPalette(id: SitePaletteId) {
  const root = document.documentElement;
  root.style.setProperty("--brand-image-filter", brandFilter(brandHueRotation[id]));
  let favicon = document.querySelector<HTMLLinkElement>('#palette-favicon');
  if (!favicon) {
    favicon = document.createElement("link");
    favicon.id = "palette-favicon";
    favicon.rel = "icon";
    favicon.type = "image/svg+xml";
    favicon.sizes.add("any");
    document.head.appendChild(favicon);
  }
  favicon.href = `/images/brand-v2/favicon-${id}.svg`;
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", id === "terracotta" ? defaultThemeColor : sitePalettes[id].siteBg);
  const names = Object.keys(sitePalettes["fuchsia-plum-amber"]);
  for (const key of [...names, "siteTitle", "sitePeach", "siteCoral", "siteAccentSoft", "siteNote", "siteBand", "sitePhone", "siteShade"]) {
    root.style.removeProperty(`--${key.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`)}`);
  }
  if (id === "terracotta") {
    delete root.dataset.sitePalette;
    return;
  }
  const colors = sitePalettes[id];
  const values = { ...colors, siteTitle: colors.ink, sitePeach: colors.surfaceSoftHover, siteCoral: colors.accentSecondary, siteAccentSoft: colors.surfaceSoft, siteNote: colors.surfaceSoft, siteBand: colors.primary, sitePhone: colors.ink, siteShade: colors.ink };
  for (const [key, value] of Object.entries(values)) {
    root.style.setProperty(`--${key.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`)}`, value);
  }
  root.dataset.sitePalette = id;
}

/** Aplica la paleta global, que solo se cambia en el panel de administración (apps/admin). */
export function SitePaletteProvider({ api, children }: { api: EventApi; children: ReactNode }) {
  const [palette, setPalette] = useState<SitePaletteId>(cachedPalette);
  const serial = useRef(0);
  const refresh = useCallback(async () => {
    const current = ++serial.current;
    try {
      const response = sitePaletteSchema.parse(await api.request<unknown>("/site-palette"));
      if (current === serial.current) { setPalette(response.palette); rememberPalette(response.palette); }
    } catch {
      // Sin respuesta se mantiene la última paleta conocida
    }
  }, [api]);
  useEffect(() => {
    void refresh();
    const interval = window.setInterval(() => {
      if (document.visibilityState === "visible") void refresh();
    }, 30000);
    return () => { serial.current++; window.clearInterval(interval); };
  }, [refresh]);
  useLayoutEffect(() => { applyPalette(palette); }, [palette]);
  return <>{children}</>;
}
