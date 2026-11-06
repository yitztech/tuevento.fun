import { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import type { OwnerMetrics } from '@tuevento/contracts';
import { useApp, errorText } from './context';
import { useLocale, tr, formatLocale } from './i18n';
import { ErrorBox } from './components';
import { Button } from "./ui/button";
export function OwnerDashboard() {
 const {api,user} = useApp(); useLocale();
 const [days,setDays]=useState(30),[data,setData]=useState<OwnerMetrics|null>(null),[error,setError]=useState(''),[revision,setRevision]=useState(0);
 useEffect(()=>{if(!user?.isOwner)return; let active=true; setData(null);setError('');api.request<OwnerMetrics>(`/owner/metrics?days=${days}`).then(v=>{if(active)setData(v)}).catch(e=>{if(active)setError(errorText(e))});return()=>{active=false}},[api,days,revision,user?.isOwner]);
 if(!user?.isOwner)return <Navigate to="/app" replace/>;
 const labels = [tr('owner.uniqueVisitors'),tr('owner.visits'),tr('owner.registrations'),tr('owner.signIns'),tr('owner.downloadClicks')];
 return <section className="owner-dashboard"><div className="page-heading"><div><h1>{tr('owner.title')}</h1><p>{tr('owner.subtitle')}</p></div><label>{tr('owner.period')}<select aria-label={tr('owner.period')} value={days} onChange={e=>setDays(Number(e.target.value))}>{[7,30,90].map(n=><option key={n} value={n}>{tr('owner.days',{count:n})}</option>)}</select></label></div>
 <p className="analytics-note">{tr('owner.dataNote')}</p>
 {error?<><ErrorBox message={error}/><Button onClick={()=>setRevision(v=>v+1)}>{tr('common.retry')}</Button></>:!data?<p role="status">{tr('owner.loading')}</p>:<>
 <dl className="owner-totals">{Object.values(data.totals).map((v,i)=><div key={labels[i]}><dt>{labels[i]}</dt><dd>{v.toLocaleString(formatLocale())}</dd></div>)}</dl>
 <h2>{tr('owner.sources')}</h2><p className="mobile-only analytics-note">{tr('owner.swipe')}</p><div className="analytics-table" tabIndex={0} role="region" aria-label={tr('owner.scrollableTable')}><table><caption>{tr('owner.byClient')}</caption><thead><tr>{[tr('owner.client'),...labels.slice(1)].map(s=><th key={s}>{s}</th>)}</tr></thead><tbody>{(['web','android','ios'] as const).map(platform=>{const r=data.sources.find(r=>r.platform===platform);return <tr key={platform}><th>{platform==='ios'?'iOS':platform==='android'?'Android':'Web'}</th>{['visits','registrations','logins','downloads'].map(k=><td key={k}>{r?.[k as 'visits']||0}</td>)}</tr>})}</tbody></table></div>
 <h2>{tr('owner.dayByDay')}</h2>{!data.daily.length?<p>{tr('owner.empty')}</p>:<div className="analytics-table" tabIndex={0} role="region" aria-label={tr('owner.scrollableTable')}><table><caption>{tr('owner.dailyCaption')}</caption><thead><tr>{[tr('owner.date'),...labels.slice(1)].map(s=><th key={s}>{s}</th>)}</tr></thead><tbody>{data.daily.map(d=><tr key={d.day}><th>{d.day}</th><td>{d.visits}</td><td>{d.registrations}</td><td>{d.logins}</td><td>{d.downloads}</td></tr>)}</tbody></table></div>}
 <p className="analytics-note">{tr('owner.footnote')}</p>
 </>}
 </section>
}
