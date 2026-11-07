import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Smartphone, ArrowDownToLine, ArrowLeft } from 'lucide-react';
import type { AppRelease } from '@tuevento/contracts';
import { EventApi } from '@tuevento/client';
import { ErrorBox } from './components';
import { useLocale, tr } from './i18n';
import { SiteLayout } from './ui/site/site-layout';
import { Button } from "./ui/button";
export function DownloadsPage({api}:{api:EventApi}) {
 const {locale}=useLocale();
 useEffect(()=>{document.title=tr('downloads.documentTitle');},[locale]);
 const [releases,setReleases]=useState<AppRelease[]|null>(null),[error,setError]=useState(''),[retry,setRetry]=useState(0);
 useEffect(()=>{let active=true;setError('');api.request<AppRelease[]>('/releases').then(r=>{if(active)setReleases(r)}).catch(()=>{if(active)setError(tr('downloads.loadError'))});return()=>{active=false}},[api,retry,locale]);
 return <SiteLayout><div className="downloads-page"><div><Link to="/" className="text-link"><ArrowLeft size={16}/>{tr('common.backHome')}</Link><h1>{tr('downloads.title')}</h1><p className="downloads-intro">{tr('downloads.intro')}</p><div className="download-layout"><img src="/site/photos/events/mesa-gracias-960.webp" srcSet="/site/photos/events/mesa-gracias-480.webp 480w, /site/photos/events/mesa-gracias-960.webp 960w" sizes="(min-width: 768px) 50vw, 100vw" alt={tr('downloads.imageAlt')}/><div>
 {error?<><ErrorBox message={error}/><Button onClick={()=>setRetry(v=>v+1)}>{tr('common.retry')}</Button></>:releases===null?<p role="status">{tr('downloads.searching')}</p>:['android','ios'].map(platform=>{const items=releases.filter(r=>r.platform===platform);return <section className="download-platform" key={platform}><Smartphone aria-hidden="true"/><h2>{platform==='ios'?'iPhone · iOS':'Android'}</h2><p>{platform==='ios'?tr('downloads.iosNote'):tr('downloads.androidNote')}</p>{!items.length?<p className="release-pending">{tr('downloads.pending')}</p>:items.map(r=><div key={r.id}><Button asChild><a href={r.url} target="_blank" rel="noopener noreferrer" onClick={()=>{void api.request(`/releases/${r.id}/download`,'POST',{}).catch(()=>{})}}><ArrowDownToLine size={17}/>{r.channel==='direct'?tr('downloads.downloadApk'):r.channel==='testflight'?'TestFlight':platform==='ios'?'App Store':'Google Play'} · {r.version}</a></Button><p>{tr('downloads.build',{build:r.build})}</p>{r.notes&&<p>{r.notes}</p>}{r.sha256&&<details><summary>SHA-256</summary><code className="download-checksum">{r.sha256}</code></details>}</div>)}</section>})}
 </div></div><p>{tr('downloads.meanwhile')}</p><Button asChild><Link to="/events">{tr('common.openApp')}</Link></Button></div></div></SiteLayout>
}
