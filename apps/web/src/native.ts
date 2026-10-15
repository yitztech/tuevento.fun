import { Capacitor, CapacitorHttp } from '@capacitor/core';
import { App } from '@capacitor/app';
import { Browser } from '@capacitor/browser';
import { Clipboard } from '@capacitor/clipboard';
import { EventApi } from '@tuevento/client';
import { tr, type Runtime } from '@tuevento/app';
const base64url=(buffer:ArrayBuffer)=>btoa(String.fromCharCode(...new Uint8Array(buffer))).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
export async function nativeRuntime():Promise<Runtime> {
 const origin = new URL(import.meta.env.VITE_PUBLIC_ORIGIN || 'https://invalid.local');
 if(origin.protocol!=='https:' || origin.hostname==='invalid.local')throw new Error('VITE_PUBLIC_ORIGIN must be the public HTTPS application origin.');
 const platform=Capacitor.getPlatform() as 'android'|'ios';
 const transport:typeof fetch=async(input,init)=>{
  const url=String(input);if(!url.startsWith(`${origin.origin}/api/`))throw new Error('Blocked API origin');
  const headers=Object.fromEntries(new Headers(init?.headers).entries());
  const result=await CapacitorHttp.request({url,method:init?.method||'GET',headers,data:init?.body?JSON.parse(String(init.body)):undefined,responseType:'json',connectTimeout:15000,readTimeout:30000,disableRedirects:true});
  return new Response(JSON.stringify(result.data),{status:result.status,headers:result.headers});
 };
 const api=new EventApi({baseUrl:`${origin.origin}/api`,platform,fetch:transport,appVersion:import.meta.env.VITE_APP_VERSION||'1.0.0'});
 const handleURL=async(url:string)=>{
  // Solo el App Link verificado del propio dominio; el esquema tueventofun:// se retiró
  // porque cualquier app puede registrarlo y robar el código.
  const parsed=new URL(url);if(parsed.protocol!=='https:'||parsed.hostname!==origin.hostname||parsed.pathname!=='/app-link/auth')return;
  const verifier=localStorage.getItem('tueventofun:pkce');if(!verifier)return;
  try{await api.request('/auth/mobile/exchange','POST',{code:parsed.searchParams.get('code'),verifier});localStorage.removeItem('tueventofun:pkce');await Browser.close().catch(()=>{});window.location.hash='/app';window.location.reload()}catch{window.alert(tr('app.sessionConnectError'))}
 };
 await App.addListener('appUrlOpen',({url})=>{void handleURL(url)});
 const launch=await App.getLaunchUrl();if(launch?.url)void handleURL(launch.url);
 await App.addListener('backButton',({canGoBack})=>{if(canGoBack)window.history.back();else void App.exitApp()});
 document.body.classList.add('native-app');
 // El origen capacitor://localhost es cross-site frente a la API: la cookie SameSite=lax
 // de sesión no viaja en EventSource, así que aquí se usa sondeo corto y recarga al volver
 // a primer plano en lugar de SSE. Latencia máxima de unos 10 s (la web usa SSE).
 const subscribe=(onChange:()=>void)=>{
  const timer=setInterval(()=>{if(document.visibilityState==='visible')onChange()},10000);
  const resume=App.addListener('appStateChange',({isActive})=>{if(isActive)onChange()});
  return ()=>{clearInterval(timer);void resume.then(handle=>handle.remove())};
 };
 return {apiBase:`${origin.origin}/api`,publicOrigin:origin.origin,platform,appVersion:import.meta.env.VITE_APP_VERSION||'1.0.0',fetch:transport,subscribe,
 copy:async text=>{await Clipboard.write({string:text})},
 openExternal:url=>{const u=new URL(url);if(['https:','mailto:','tel:'].includes(u.protocol))window.open(url,'_blank','noopener,noreferrer')},
 startNativeLogin:async()=>{const verifier=base64url(crypto.getRandomValues(new Uint8Array(32)).buffer);localStorage.setItem('tueventofun:pkce',verifier);const challenge=base64url(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(verifier)));await Browser.open({url:`${origin.origin}/acceso?appChallenge=${challenge}&source=${platform}`})}
 };
}
