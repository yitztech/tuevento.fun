import { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import type { OwnerMetrics } from '@tuevento/contracts';
import { useApp, errorText } from './context';
import { useLocale } from './i18n';
import { ErrorBox } from './components';
export function OwnerDashboard() {
 const {api,user} = useApp(); const {locale}=useLocale(); const t=(es:string,en:string)=>locale==='es'?es:en;
 const [days,setDays]=useState(30),[data,setData]=useState<OwnerMetrics|null>(null),[error,setError]=useState(''),[revision,setRevision]=useState(0);
 useEffect(()=>{if(!user?.isOwner)return; let active=true; setData(null);setError('');api.request<OwnerMetrics>(`/owner/metrics?days=${days}`).then(v=>{if(active)setData(v)}).catch(e=>{if(active)setError(errorText(e))});return()=>{active=false}},[api,days,revision,user?.isOwner]);
 if(!user?.isOwner)return <Navigate to="/app" replace/>;
 const labels = [t('Visitantes únicos','Unique visitors'),t('Visitas','Visits'),t('Registros','Registrations'),t('Inicios de sesión','Sign-ins'),t('Clics de descarga','Download clicks')];
 return <section className="owner-dashboard"><div className="page-heading"><div><h1>{t('El pulso de TuEventoFun','The pulse of TuEventoFun')}</h1><p>{t('Personas que llegan, crean su cuenta y vuelven a celebrar.','People arriving, creating accounts and coming back to celebrate.')}</p></div><label>{t('Periodo','Period')}<select aria-label={t("Periodo","Period")} value={days} onChange={e=>setDays(Number(e.target.value))}>{[7,30,90].map(n=><option key={n} value={n}>{n} {t('días','days')}</option>)}</select></label></div>
 <p className="analytics-note">{t('Datos desde la activación de las métricas. Días en UTC. Las cuentas de demostración no suman registros ni accesos.','Data since analytics activation. Days in UTC. Demo accounts do not count as registrations or sign-ins.')}</p>
 {error?<><ErrorBox message={error}/><button className="button" onClick={()=>setRevision(v=>v+1)}>{t('Reintentar','Retry')}</button></>:!data?<p role="status">{t('Cargando métricas…','Loading metrics…')}</p>:<>
 <dl className="owner-totals">{Object.values(data.totals).map((v,i)=><div key={labels[i]}><dt>{labels[i]}</dt><dd>{v.toLocaleString(locale)}</dd></div>)}</dl>
 <h2>{t('Desde dónde nos eligen','Where people find us')}</h2><p className="mobile-only analytics-note">{t("Desliza la tabla para ver todas las métricas.","Swipe the table to see all metrics.")}</p><div className="analytics-table" tabIndex={0} role="region" aria-label={t("Tabla desplazable de métricas","Scrollable metrics table")}><table><caption>{t('Actividad por cliente','Activity by client')}</caption><thead><tr>{[t('Cliente','Client'),...labels.slice(1)].map(s=><th key={s}>{s}</th>)}</tr></thead><tbody>{(['web','android','ios'] as const).map(platform=>{const r=data.sources.find(r=>r.platform===platform);return <tr key={platform}><th>{platform==='ios'?'iOS':platform==='android'?'Android':'Web'}</th>{['visits','registrations','logins','downloads'].map(k=><td key={k}>{r?.[k as 'visits']||0}</td>)}</tr>})}</tbody></table></div>
 <h2>{t('Día a día','Day by day')}</h2>{!data.daily.length?<p>{t('Todavía no hay actividad en este periodo. Las primeras visitas aparecerán aquí.','No activity in this period yet. The first visits will appear here.')}</p>:<div className="analytics-table" tabIndex={0} role="region" aria-label={t("Tabla desplazable de métricas","Scrollable metrics table")}><table><caption>{t('Actividad diaria en UTC','Daily activity in UTC')}</caption><thead><tr>{[t('Fecha','Date'),...labels.slice(1)].map(s=><th key={s}>{s}</th>)}</tr></thead><tbody>{data.daily.map(d=><tr key={d.day}><th>{d.day}</th><td>{d.visits}</td><td>{d.registrations}</td><td>{d.logins}</td><td>{d.downloads}</td></tr>)}</tbody></table></div>}
 <p className="analytics-note">{t('Un visitante equivale a un navegador o instalación identificada anónimamente. Borrar sus datos puede contarlo de nuevo. El origen es declarado por el cliente; los clics no prueban instalaciones.','A visitor represents an anonymously identified browser or installation. Clearing its data may count it again. Clients declare their platform; clicks do not prove installations.')}</p>
 </>}
 </section>
}
