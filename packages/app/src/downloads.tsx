import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Smartphone, ArrowDownToLine, ArrowLeft } from 'lucide-react';
import type { AppRelease } from '@tuevento/contracts';
import { EventApi } from '@tuevento/client';
import { Logo, ErrorBox } from './components';
import { useLocale, LanguageSwitcher, tr } from './i18n';
export function DownloadsPage({api}:{api:EventApi}) {
 const {locale}=useLocale();
 useEffect(()=>{document.title=tr('downloads.documentTitle');},[locale]);
 const [releases,setReleases]=useState<AppRelease[]|null>(null),[error,setError]=useState(''),[retry,setRetry]=useState(0);
 useEffect(()=>{let active=true;setError('');api.request<AppRelease[]>('/releases').then(r=>{if(active)setReleases(r)}).catch(()=>{if(active)setError(tr('downloads.loadError'))});return()=>{active=false}},[api,retry,locale]);
 return <div className="downloads-page"><header><Logo/><LanguageSwitcher/></header><main><Link to="/" className="text-link"><ArrowLeft size={16}/>{tr('common.backHome')}</Link><h1>{tr('downloads.title')}</h1><p className="downloads-intro">{tr('downloads.intro')}</p><div className="download-layout"><img src="/images/minimal.jpg" alt={tr('downloads.imageAlt')}/><div>
 {error?<><ErrorBox message={error}/><button className="button" onClick={()=>setRetry(v=>v+1)}>{tr('common.retry')}</button></>:releases===null?<p role="status">{tr('downloads.searching')}</p>:['android','ios'].map(platform=>{const items=releases.filter(r=>r.platform===platform);return <section className="download-platform" key={platform}><Smartphone aria-hidden="true"/><h2>{platform==='ios'?'iPhone · iOS':'Android'}</h2><p>{platform==='ios'?tr('downloads.iosNote'):tr('downloads.androidNote')}</p>{!items.length?<p className="release-pending">{tr('downloads.pending')}</p>:items.map(r=><div key={r.id}><a className="button" href={r.url} target="_blank" rel="noopener noreferrer" onClick={()=>{void api.request(`/releases/${r.id}/download`,'POST',{}).catch(()=>{})}}><ArrowDownToLine size={17}/>{r.channel==='direct'?tr('downloads.downloadApk'):r.channel==='testflight'?'TestFlight':platform==='ios'?'App Store':'Google Play'} · {r.version}</a><p>{tr('downloads.build',{build:r.build})}</p>{r.notes&&<p>{r.notes}</p>}{r.sha256&&<details><summary>SHA-256</summary><code className="download-checksum">{r.sha256}</code></details>}</div>)}</section>})}
 </div></div><p>{tr('downloads.meanwhile')}</p><Link className="button" to="/app">{tr('common.openApp')}</Link></main></div>
}
