import { HashRouter } from "react-router-dom";
import { TuEventoApp, type Runtime } from "./App";
/**
 * Entry for a future Electron/Tauri renderer. The host owns the trusted
 * transport, cookies, external links, clipboard and stream connection.
 * It must constrain apiBase and every outgoing URL to an allowlist.
 */
export function DesktopApp({ runtime }: { runtime: Runtime }) {
  return (
    <HashRouter>
      <TuEventoApp runtime={runtime} />
    </HashRouter>
  );
}
