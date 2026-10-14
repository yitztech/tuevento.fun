import "@tuevento/app/styles.css";
import ReactDOM from "react-dom/client";
import { BrowserRouter, HashRouter, Routes, Route } from "react-router-dom";
import { TuEventoApp, SeoLinks, type Runtime } from "@tuevento/app";
import { LandingPage } from "@tuevento/app/landing";
import { Capacitor } from '@capacitor/core';
import { EventApi } from '@tuevento/client';
import { DownloadsPage } from '@tuevento/app/downloads';
import { LegalPage } from '@tuevento/app/legal';
import { localizedPaths } from '@tuevento/contracts';
import { Analytics } from './analytics';
const runtime: Runtime = {
  apiBase: "/api",
  platform: (["android", "ios"].includes(new URLSearchParams(window.location.search).get("source") || "") ? new URLSearchParams(window.location.search).get("source") : "web") as "web" | "android" | "ios",
  publicOrigin: window.location.origin,
  copy: (text) => navigator.clipboard.writeText(text),
  openExternal: (url) => {
    window.open(url, "_blank", "noopener,noreferrer");
  },
  subscribe: (onChange) => {
    const source = new EventSource("/api/stream", { withCredentials: true });
    source.onmessage = (event) => {
      try {
        if (JSON.parse(event.data).type === "changed") onChange();
      } catch {}
    };
    return () => source.close();
  },
};

async function start() {
 const native=Capacitor.isNativePlatform();
 const activeRuntime=native?await (await import('./native')).nativeRuntime():runtime;
 const api=new EventApi({baseUrl:activeRuntime.apiBase,fetch:activeRuntime.fetch,platform:activeRuntime.platform});
 const Router=native?HashRouter:BrowserRouter;
 ReactDOM.createRoot(document.getElementById("root")!).render(
  <Router><Analytics api={api} native={native}/>{!native&&<SeoLinks/>}{native?<TuEventoApp runtime={activeRuntime}/>:<Routes>
   <Route path="/" element={<LandingPage/>}/><Route path="/descargas" element={<DownloadsPage api={api}/>}/>
   {(['privacy','terms'] as const).flatMap(page=>(['es','en'] as const).map(locale=><Route key={`${page}-${locale}`} path={localizedPaths[page][locale]} element={<LegalPage page={page}/>}/>))}
   <Route path="*" element={<TuEventoApp runtime={activeRuntime}/>}/>
  </Routes>}</Router>);
}
void start().catch(()=>{const root=document.getElementById('root')!;root.textContent='No se pudo iniciar TuEventoFun. Revisa la conexión y vuelve a abrir la app. / Could not start TuEventoFun. Check your connection and reopen the app.';});
