import { useMemo } from "react";
import { EventApi } from "@tuevento/client";
import { SitePaletteProvider } from "./site-palette";
import { HashRouter } from "react-router-dom";
import { TuEventoApp, type Runtime } from "./App";
/**
 * Entry for a future Electron/Tauri renderer. The host owns the trusted
 * transport, cookies, external links, clipboard and stream connection.
 * It must constrain apiBase and every outgoing URL to an allowlist.
 */
export function DesktopApp({ runtime }: { runtime: Runtime }) {
  const api = useMemo(() => new EventApi({ baseUrl: runtime.apiBase, fetch: runtime.fetch, platform: runtime.platform, appVersion: runtime.appVersion }), [runtime]);
  return (
    <SitePaletteProvider api={api}><HashRouter>
      <TuEventoApp runtime={runtime} />
    </HashRouter></SitePaletteProvider>
  );
}
