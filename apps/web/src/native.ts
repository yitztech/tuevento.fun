import { Capacitor, CapacitorHttp } from '@capacitor/core';
import { App } from '@capacitor/app';
import { Browser } from '@capacitor/browser';
import { Clipboard } from '@capacitor/clipboard';
import { Geolocation } from '@capacitor/geolocation';
import { Network } from '@capacitor/network';
import { Share } from '@capacitor/share';
import { SecureStorage } from '@aparajita/capacitor-secure-storage';
import { EventApi } from '@tuevento/client';
import { landingRoute } from '@tuevento/contracts';
import { tr, type Runtime } from '@tuevento/app';
import { clearOfflineStore, offlineOwner, openOfflineStore } from './offline-store';

declare const __PRUEBAS__: boolean;
// Solo pruebas: sin red simulada (el simulador de iOS no puede quitarse la red por línea de comandos)
const SIN_RED='tueventofun:pruebas-sin-red';
const sinRedSimulada=()=>__PRUEBAS__&&localStorage.getItem(SIN_RED)==='1';
// Verificador PKCE del acceso con navegador: vive en el llavero de iOS o el Keystore de Android
// solo mientras dura el flujo (FE-03), nunca en localStorage.
const PKCE_KEY='tueventofun:pkce';
const base64url=(buffer:ArrayBuffer)=>btoa(String.fromCharCode(...new Uint8Array(buffer))).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
export async function nativeRuntime():Promise<Runtime> {
 const origin = new URL(import.meta.env.VITE_PUBLIC_ORIGIN || 'https://invalid.local');
 if(origin.protocol!=='https:' || origin.hostname==='invalid.local')throw new Error('VITE_PUBLIC_ORIGIN must be the public HTTPS application origin.');
 const platform=Capacitor.getPlatform() as 'android'|'ios';
 const transport:typeof fetch=async(input,init)=>{
  const url=String(input);if(!url.startsWith(`${origin.origin}/api/`))throw new Error('Blocked API origin');
  if(sinRedSimulada())throw new TypeError('Failed to fetch');
  const headers=Object.fromEntries(new Headers(init?.headers).entries());
  const result=await CapacitorHttp.request({url,method:init?.method||'GET',headers,data:init?.body?JSON.parse(String(init.body)):undefined,responseType:'json',connectTimeout:15000,readTimeout:30000,disableRedirects:true});
  // CapacitorHttp solo interpreta como JSON `application/json`: un error en `application/problem+json` llega como texto
  const data=typeof result.data==='string'?(()=>{try{return JSON.parse(result.data)}catch{return result.data}})():result.data;
  return new Response(JSON.stringify(data),{status:result.status,headers:result.headers});
 };
 const api=new EventApi({baseUrl:`${origin.origin}/api`,platform,fetch:transport,appVersion:import.meta.env.VITE_APP_VERSION||'1.0.0'});
 const handleURL=async(url:string)=>{
  // Solo el App Link verificado del propio dominio; el esquema tueventofun:// se retiró
  // porque cualquier app puede registrarlo y robar el código.
  const parsed=new URL(url);if(parsed.protocol!=='https:'||parsed.hostname!==origin.hostname)return;
  // Enlace personal o landing de un evento: la misma pantalla, dentro de la app
  if(parsed.pathname.startsWith('/i/')||landingRoute(parsed.pathname)){window.location.hash=parsed.pathname;return}
  if(parsed.pathname!=='/app-link/auth')return;
  const verifier=await SecureStorage.getItem(PKCE_KEY).catch(()=>null);if(!verifier)return;
  try{await api.request('/auth/mobile/exchange','POST',{code:parsed.searchParams.get('code'),verifier});await SecureStorage.removeItem(PKCE_KEY).catch(()=>{});await Browser.close().catch(()=>{});window.location.hash='/app';window.location.reload()}catch{window.alert(tr('app.sessionConnectError'))}
 };
 localStorage.removeItem(PKCE_KEY); // de versiones anteriores
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
 // Red según el sistema: la copia local se usa sin esperar a que una petición falle (fase 8b)
 let connected=(await Network.getStatus().catch(()=>({connected:true}))).connected;
 const networkListeners=new Set<(online:boolean)=>void>();
 const online=()=>connected&&!sinRedSimulada();
 const notify=()=>{for(const listener of networkListeners)listener(online())};
 await Network.addListener('networkStatusChange',status=>{connected=status.connected;notify()});
 const network={online,onChange:(listener:(online:boolean)=>void)=>{networkListeners.add(listener);return ()=>{networkListeners.delete(listener)}}};
 if(__PRUEBAS__)Object.assign(window,{
  tueventoPruebasSinRed:(sinRed:boolean)=>{if(sinRed)localStorage.setItem(SIN_RED,'1');else localStorage.removeItem(SIN_RED);notify()},
  // La copia local ya tiene el usuario y una sincronización completa: se puede quitar la red
  tueventoPruebasCopiaLista:async(email:string)=>{const owner=await offlineOwner();if(!owner)return false;const store=await openOfflineStore(owner);return (await store.get<{email:string}>('meta','user'))?.email===email&&!!(await store.get('meta','sync-last'))},
 });
 return {apiBase:`${origin.origin}/api`,publicOrigin:origin.origin,platform,appVersion:import.meta.env.VITE_APP_VERSION||'1.0.0',fetch:transport,subscribe,network,openOfflineStore,clearOfflineStore,offlineOwner,
 copy:async text=>{await Clipboard.write({string:text})},
 getPosition:async()=>{const {coords}=await Geolocation.getCurrentPosition({enableHighAccuracy:true,timeout:15000});return {lat:coords.latitude,lng:coords.longitude}},
 share:async({title,text,url})=>{await Share.share({title,text,url,dialogTitle:title})},
 openExternal:url=>{const u=new URL(url);if(['https:','mailto:','tel:'].includes(u.protocol))window.open(url,'_blank','noopener,noreferrer')},
 startNativeLogin:async()=>{const verifier=base64url(crypto.getRandomValues(new Uint8Array(32)).buffer);await SecureStorage.setItem(PKCE_KEY,verifier);const challenge=base64url(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(verifier)));await Browser.open({url:`${origin.origin}/acceso?appChallenge=${challenge}&source=${platform}`})}
 };
}
