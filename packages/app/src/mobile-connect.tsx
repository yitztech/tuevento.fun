import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useApp, errorText } from './context';
import { useLocale } from './i18n';
import { ErrorBox } from './components';
export function MobileConnect(){
 const {api,user}=useApp();const [query]=useSearchParams();const {locale}=useLocale();const t=(a:string,b:string)=>locale==='es'?a:b;
 const [error,setError]=useState(''),[busy,setBusy]=useState(false),[link,setLink]=useState('');
 // Dos pasos: primero se pide el código y después el usuario toca el enlace. Los
 // App Links de iOS no se abren desde una navegación programática, solo desde un toque.
 const authorize=async()=>{setBusy(true);setError('');try{const {code}=await api.request<{code:string}>('/auth/mobile/authorize','POST',{challenge:query.get('challenge')});setLink(`${window.location.origin}/app-link/auth?code=${encodeURIComponent(code)}`)}catch(e){setError(errorText(e))}finally{setBusy(false)}};
 return <section><h1>{t('Conectar tu app','Connect your app')}</h1><p>{t('Continúa solo si acabas de iniciar el acceso desde TuEventoFun en tu teléfono.','Continue only if you just started signing in from TuEventoFun on your phone.')}</p><p>{user?.email}</p>{error&&<ErrorBox message={error}/>}
  {link?<a className="button" href={link} rel="noopener">{t('Abrir TuEventoFun','Open TuEventoFun')}</a>:<button className="button" disabled={busy} onClick={()=>void authorize()}>{t('Conectar mi app','Connect my app')}</button>}
 </section>
}
