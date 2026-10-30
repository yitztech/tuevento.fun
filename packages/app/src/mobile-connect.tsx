import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useApp, errorText } from './context';
import { useLocale, tr } from './i18n';
import { ErrorBox } from './components';
import { Button } from "./ui/button";
export function MobileConnect(){
 const {api,user}=useApp();const [query]=useSearchParams();useLocale();
 const [error,setError]=useState(''),[busy,setBusy]=useState(false),[link,setLink]=useState('');
 // Dos pasos: primero se pide el código y después el usuario toca el enlace. Los
 // App Links de iOS no se abren desde una navegación programática, solo desde un toque.
 const authorize=async()=>{setBusy(true);setError('');try{const {code}=await api.request<{code:string}>('/auth/mobile/authorize','POST',{challenge:query.get('challenge')});setLink(`${window.location.origin}/app-link/auth?code=${encodeURIComponent(code)}`)}catch(e){setError(errorText(e))}finally{setBusy(false)}};
 return <section><h1>{tr('mobileConnect.title')}</h1><p>{tr('mobileConnect.intro')}</p><p>{user?.email}</p>{error&&<ErrorBox message={error}/>}
  {link?<Button asChild><a href={link} rel="noopener">{tr('common.openApp')}</a></Button>:<Button disabled={busy} onClick={()=>void authorize()}>{tr('mobileConnect.connect')}</Button>}
 </section>
}
