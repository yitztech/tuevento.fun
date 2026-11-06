import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { EventApi } from "@tuevento/client";
import { sitePalettes, sitePaletteSchema, type SitePaletteId } from "@tuevento/contracts";

type PaletteContextValue = {
  saved: SitePaletteId;
  selected: SitePaletteId;
  loading: boolean;
  error: boolean;
  saving: boolean;
  preview: (palette: SitePaletteId) => void;
  cancel: () => void;
  save: () => Promise<void>;
  refresh: () => Promise<void>;
};
const PaletteContext = createContext<PaletteContextValue | null>(null);

/** Solo se escriben los valores de la tabla compartida, nunca CSS recibido del servidor. */
function applyPalette(id: SitePaletteId) {
  const root = document.documentElement;
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

export function SitePaletteProvider({ api, children }: { api: EventApi; children: ReactNode }) {
  const [saved, setSaved] = useState<SitePaletteId>("terracotta");
  const [draft, setDraft] = useState<SitePaletteId | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [saving, setSaving] = useState(false);
  const serial = useRef(0);
  const draftRef = useRef<SitePaletteId | null>(null);
  draftRef.current = draft;
  const refresh = useCallback(async () => {
    const current = ++serial.current;
    try {
      const response = sitePaletteSchema.parse(await api.request<unknown>("/site-palette"));
      if (current === serial.current && draftRef.current === null) { setSaved(response.palette); setError(false); }
    } catch {
      if (current === serial.current) setError(true);
    } finally {
      if (current === serial.current) setLoading(false);
    }
  }, [api]);
  useEffect(() => {
    void refresh();
    const interval = window.setInterval(() => {
      if (document.visibilityState === "visible" && draftRef.current === null) void refresh();
    }, 30000);
    return () => { serial.current++; window.clearInterval(interval); };
  }, [refresh]);
  useEffect(() => { applyPalette(draft ?? saved); }, [draft, saved]);
  const preview = useCallback((id: SitePaletteId) => { draftRef.current = id; setDraft(id); }, []);
  const cancel = useCallback(() => { draftRef.current = null; setDraft(null); void refresh(); }, [refresh]);
  const save = useCallback(async () => {
    if (draftRef.current === null) return;
    const candidate = draftRef.current;
    const current = ++serial.current;
    setSaving(true);
    try {
      const response = sitePaletteSchema.parse(await api.request<unknown>("/owner/site-palette", "PUT", { palette: candidate }));
      if (current === serial.current) { setSaved(response.palette); draftRef.current = null; setDraft(null); setError(false); }
    } finally { setSaving(false); }
  }, [api]);
  const value = useMemo(() => ({ saved, selected: draft ?? saved, loading, error, saving, preview, cancel, save, refresh }), [saved, draft, loading, error, saving, preview, cancel, save, refresh]);
  return <PaletteContext.Provider value={value}>{children}</PaletteContext.Provider>;
}
export function useSitePalette() {
  const value = useContext(PaletteContext);
  if (!value) throw new Error("SitePaletteProvider missing");
  return value;
}
