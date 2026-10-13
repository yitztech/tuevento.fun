import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useApp, errorText } from './context';
import { useLocale } from './i18n';
import { ErrorBox } from './components';
export function MobileConnect(){
 const {api,user}=useApp();const [query]=useSearchParams();const {locale}=useLocale();const t=(a:string,b:string)=>locale==='es'?a:b;
 const [error,setError]=useState(''),[busy,setBusy]=useState(false);
 return <section><h1>{t('Conectar tu app','Connect your app')}</h1><p>{t('Continúa solo si acabas de iniciar el acceso desde TuEventoFun en tu teléfono.','Continue only if you just started signing in from TuEventoFun on your phone.')}</p><p>{user?.email}</p>{error&&<ErrorBox message={error}/>}<button className="button" disabled={busy} onClick={async()=>{setBusy(true);setError('');try{const {code}=await api.request<{code:string}>('/auth/mobile/authorize','POST',{challenge:query.get('challenge')});window.location.assign(`tueventofun://auth?code=${encodeURIComponent(code)}`)}catch(e){setError(errorText(e))}finally{setBusy(false)}}}>{t('Volver a la app','Return to the app')}</button></section>
}
