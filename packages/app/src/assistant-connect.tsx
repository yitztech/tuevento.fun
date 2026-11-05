import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useApp, errorText } from './context';
import { useLocale, tr } from './i18n';
import { ErrorBox } from './components';
import { Button } from "./ui/button";

type Consent={clientName:string};

/** Consentimiento de un asistente MCP: el flujo OAuth vuelve aquí y sigue con la URL que da la API. */
export function AssistantConnect(){
 const {api,user}=useApp();const [query]=useSearchParams();useLocale();
 const path=`/mcp/oauth/interaction/${encodeURIComponent(query.get('uid')??'')}`;
 const [consent,setConsent]=useState<Consent|null>(null),[expired,setExpired]=useState(false),[error,setError]=useState(''),[busy,setBusy]=useState(false);
 useEffect(()=>{let active=true;api.request<Consent>(`${path}/details`).then(data=>{if(active)setConsent(data)}).catch(()=>{if(active)setExpired(true)});return()=>{active=false}},[api,path]);
 const decide=async(allow:boolean)=>{setBusy(true);setError('');try{const {redirectTo}=await api.request<{redirectTo:string}>(`${path}/decision`,'POST',{allow});window.location.assign(redirectTo)}catch(e){setError(errorText(e));setBusy(false)}};
 return <section><h1>{tr('assistantConnect.title')}</h1>
  {expired&&<ErrorBox message={tr('assistantConnect.expired')}/>}
  {consent&&<><p>{tr('assistantConnect.intro',{client:consent.clientName})}</p><p>{tr('assistantConnect.readOnly')}</p><p>{user?.email}</p>
   {error&&<ErrorBox message={error}/>}
   <Button disabled={busy} onClick={()=>void decide(true)}>{tr('assistantConnect.allow')}</Button>{' '}
   <Button variant="outline" disabled={busy} onClick={()=>void decide(false)}>{tr('assistantConnect.deny')}</Button></>}
 </section>
}
