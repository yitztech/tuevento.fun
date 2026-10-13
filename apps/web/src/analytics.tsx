import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { EventApi } from '@tuevento/client';
export function Analytics({api,native=false}:{api:EventApi;native?:boolean}){
 const {pathname}=useLocation();
 useEffect(()=>{
  // No invitation tokens, contact fields, IPs or full URLs in telemetry.
  const route=pathname==='/'?(native?'app':'landing'):pathname==='/descargas'?'downloads':pathname==='/app'?'app':null;
  if(!route)return;
  try {
   const visitorId=localStorage.getItem('tueventofun:visitor')||crypto.randomUUID();localStorage.setItem('tueventofun:visitor',visitorId);
   const key=`tueventofun:visit:${route}:${new Date().toISOString().slice(0,10)}`;
   const visitId=sessionStorage.getItem(key)||crypto.randomUUID();sessionStorage.setItem(key,visitId);
   void api.request('/analytics/visit','POST',{visitorId,visitId,route}).catch(()=>{});
  }catch {/* Analytics never prevents a celebration. */}
 },[api,pathname,native]);
 return null;
}
