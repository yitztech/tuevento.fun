import "./errors";
import "@tuevento/app/styles.css";
import ReactDOM from "react-dom/client";
import type { ReactNode } from "react";
import { BrowserRouter, HashRouter, Routes, Route } from "react-router-dom";
import { TuEventoApp, SeoLinks, getLocale, tr, type Runtime } from "@tuevento/app";
import { LandingPage } from "@tuevento/app/landing";
import { Capacitor } from '@capacitor/core';
import { EventApi } from '@tuevento/client';
import { DownloadsPage } from '@tuevento/app/downloads';
import { LegalPage } from '@tuevento/app/legal';
import { localizedPages, localizedPath, supportedLocales } from '@tuevento/contracts';
import { PricingPage } from '@tuevento/app/pricing';
import { LanguageSuggestion, pathPrefix, usePathPrefix } from '@tuevento/app/i18n';
import { Analytics } from './analytics';
const runtime: Runtime = {
  apiBase: "/api",
  platform: (["android", "ios"].includes(new URLSearchParams(window.location.search).get("source") || "") ? new URLSearchParams(window.location.search).get("source") : "web") as "web" | "android" | "ios",
  // Con el prefijo del idioma (yourevent.fun/pt): los invitados abren el enlace en ese idioma
  get publicOrigin() {
    return window.location.origin + pathPrefix();
  },
  copy: (text) => navigator.clipboard.writeText(text),
  openExternal: (url) => {
    window.open(url, "_blank", "noopener,noreferrer");
  },
  getPosition: () =>
    new Promise((resolve, reject) =>
      navigator.geolocation
        ? navigator.geolocation.getCurrentPosition(
            ({ coords }) => resolve({ lat: coords.latitude, lng: coords.longitude }),
            reject,
            { enableHighAccuracy: true, timeout: 15000 },
          )
        : reject(new Error("geolocation")),
    ),
  // Hoja de compartir del navegador (móviles); en escritorio, la app copia el texto
  share: typeof navigator !== "undefined" && "share" in navigator ? (data) => navigator.share(data) : undefined,
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

/**
 * Router web con base en el prefijo del idioma (/pt, /de en yourevent.fun). Al cambiar
 * de idioma sin recargar, la URL ya es la nueva y el router se vuelve a montar con su base.
 */
function WebRouter({ children }: { children: ReactNode }) {
  const prefix = usePathPrefix();
  return <BrowserRouter key={prefix} basename={prefix || undefined}>{children}</BrowserRouter>;
}

async function start() {
 const native=Capacitor.isNativePlatform();
 const activeRuntime=native?await (await import('./native')).nativeRuntime():runtime;
 const api=new EventApi({baseUrl:activeRuntime.apiBase,fetch:activeRuntime.fetch,platform:activeRuntime.platform,locale:()=>getLocale()});
 const Router=native?HashRouter:WebRouter;
 ReactDOM.createRoot(document.getElementById("root")!).render(
  <Router><Analytics api={api} native={native}/>{!native&&<><SeoLinks/><LanguageSuggestion/></>}{native?<TuEventoApp runtime={activeRuntime}/>:<Routes>
   <Route path="/" element={<LandingPage/>}/><Route path="/descargas" element={<DownloadsPage api={api}/>}/>
   {localizedPages.flatMap(page=>supportedLocales.map(locale=><Route key={`${page}-${locale}`} path={localizedPath(page,locale)} element={page==='pricing'?<PricingPage/>:<LegalPage page={page}/>}/>))}
   <Route path="*" element={<TuEventoApp runtime={activeRuntime}/>}/>
  </Routes>}</Router>);
}
void start().catch(()=>{const root=document.getElementById('root')!;root.textContent=tr('app.startupError');});
